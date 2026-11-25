# Email Scheduler (ReachInbox assignment)

A full-stack email job scheduler: an Express + TypeScript API, a separate BullMQ worker that sends
through Ethereal SMTP, and a React dashboard with Google login, a compose flow, scheduled and sent tabs,
search, and Slack alerts when the rate limit is hit.

- **Run it:** [HOW_TO_RUN.md](HOW_TO_RUN.md)
- **Set it up on a new laptop (accounts, env vars):** [HANDOVER.md](HANDOVER.md)
- **Test it:** [TESTING.md](TESTING.md)

## Architecture

```
React (Vite)  ──fetch, cookie──▶  Express API ──createMany──▶ Postgres (Neon)
  :5173                            :4000      ──addBulk────▶ Redis (BullMQ delayed jobs)
                                     │        ──bulk index─▶ Elasticsearch
                                     └─ /admin/queues (Bull Board)

                                   Worker (separate process)
                                     ├─ claims row in Postgres (idempotency)
                                     ├─ Redis INCR per sender-hour (rate limit)
                                     ├─ nodemailer → Ethereal SMTP
                                     ├─ updates Postgres + Elasticsearch
                                     └─ Slack incoming webhook on limit hit
```

| Part | Tech |
|---|---|
| Backend | Express 5, TypeScript, Prisma (Postgres), BullMQ + ioredis, nodemailer, @elastic/elasticsearch, Bull Board, passport-google-oauth20, JWT in an httpOnly cookie |
| Frontend | Vite, React 18, TypeScript, Tailwind, TanStack Query, react-hot-toast |
| Infra | Neon Postgres, Redis Cloud, Elastic Cloud, ngrok (for the Slack callback). No Docker. |

### Backend layout
```
backend/
  prisma/schema.prisma      users, slack_connections, senders, campaigns, emails
  prisma/seed.ts            creates Ethereal sender accounts if missing, prints logins
  src/config.ts             every setting read from env vars
  src/lib/redis.ts          the one shared ioredis connection factory (maxRetriesPerRequest: null)
  src/server.ts             API entry: CORS, cookies, routes, Bull Board
  src/worker.ts             worker entry: reconcile on start-up, BullMQ Worker
  src/queue/queue.ts        queue + enqueueEmails (addBulk in chunks of 500)
  src/queue/processor.ts    claim → rate limit → send → update
  src/queue/rateLimit.ts    Redis per-sender hourly counters, notify-once key
  src/routes/api.ts         /api/campaigns, /api/emails, /api/emails/counts, /api/search, /api/senders
  src/routes/slack.ts       /slack/connect, /slack/callback, /slack/disconnect, /slack/test
  src/auth/                 Google OAuth + JWT helpers
  src/services/             mailer, Elasticsearch, Slack
  scripts/stats.ts          `npm run stats`: status counts, duplicate check, sends per sender-hour
```

### Frontend layout
```
frontend/src/
  components/ui/            Button, Field/Input/Textarea, Modal, DataTable, StatusBadge, Spinner, EmptyState, Avatar, Pagination
  components/               Header, Tabs, EmailTable, ComposeModal, SlackCard, SearchBox
  hooks/queries.ts          all TanStack Query hooks (one place for keys and polling)
  lib/api.ts                typed fetch client (credentials: 'include')
  lib/leads.ts              CSV/text lead parser
  pages/                    LoginPage, DashboardPage
  types.ts                  API types
```

## How scheduling works (no cron)

1. `POST /api/campaigns` receives subject, body, recipients (parsed from the uploaded CSV/text file),
   start time, delay between emails and an optional hourly limit.
2. Recipients are trimmed, lower-cased, de-duplicated and validated.
3. One `emails` row per recipient is inserted with `createMany` (in chunks of 1000):
   `scheduledAt = startTime + i × delayBetweenMs`, and senders are assigned **round-robin**.
4. One BullMQ **delayed job** per email is added with `addBulk` in chunks of 500.
   `delay = scheduledAt − now`, and **`jobId = email.id`**.
5. The rows are bulk-indexed into Elasticsearch.

There is no cron or polling anywhere. Redis holds each job until its delay ends, then BullMQ hands it to the worker.

## Persistence and restart safety

- **Postgres is the source of truth** for every email and its status. **Redis** (a hosted, persistent
  Redis Cloud DB) holds the delayed jobs. Neither lives in the API or worker process, so stopping
  either process loses nothing.
- If the worker is down when an email is due, the job waits in Redis and runs as soon as a worker starts.
  It is not restarted from the beginning: the job only knows its email id, and the row's status
  shows what has already happened.
- **Reconcile on start-up:** when the worker starts, it re-adds a job for every row still `scheduled`
  or `delayed`. Because `jobId = email.id`, BullMQ ignores ids that already exist, so this only fills
  gaps (for example, if Redis was wiped or the API crashed between the DB insert and `addBulk`).

## Idempotency (no duplicate sends)

Three layers:
1. **`jobId = email.id`**: one email can have at most one job in the queue.
2. **Atomic DB claim**: before sending, the worker runs
   `UPDATE emails SET status='sending' WHERE id=$1 AND status IN ('scheduled','delayed')`.
   If 0 rows change, another worker already has it or it is finished, so the job exits without sending.
   This is safe with any number of workers and any concurrency.
3. **Terminal statuses**: `sent` and `failed` rows can never be claimed again.

On an SMTP error the row goes back to `scheduled` (so BullMQ's retry can claim it again) and the
error is stored. After **3 attempts** (exponential backoff starting at 5 s) it becomes `failed`.

Trade-off: if a worker process is killed *between* the SMTP send and the `status='sent'` update, the row
stays `sending` and is **not** retried. This is a deliberate *at-most-once* choice: for cold email,
sending someone a duplicate is worse than missing one. Those rows are easy to spot (`sending` that never changes).

## Throughput and rate limiting

All values are env vars (`backend/.env`), with nothing hard-coded:

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_CONCURRENCY` | 5 | BullMQ worker concurrency |
| `MIN_SEND_DELAY_MS` | 2000 | **Minimum 2 seconds between sends** (BullMQ limiter) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | 50 | Hourly limit per sender |

### Delay between emails
Two separate delays:
- **Campaign delay** (set in the UI): spreads the jobs' `scheduledAt` times, `startTime + i × delay`.
- **Provider throttle**: the worker uses BullMQ's limiter `{ max: 1, duration: MIN_SEND_DELAY_MS }`.
  The limiter is stored in Redis, so it applies across **all** worker processes. With the default,
  the whole system sends **at most 1 email every 2 seconds**, even if 1000 are due at once.

### Emails per hour (per sender)
- Redis counter key: `rl:{senderId}:{YYYYMMDDHH}` (UTC hour). `INCR` is atomic, so the limit holds
  across many workers and machines. On the first increment the key gets `EXPIRE 7200`.
- Effective limit = `min(MAX_EMAILS_PER_HOUR_PER_SENDER, campaign hourly limit from the UI)`.
  The UI can lower the limit but never raise it.
- If `INCR` returns more than the limit, the worker:
  1. runs `DECR` (gives the slot back),
  2. sets the row to `delayed` and `scheduledAt` = start of next hour + a small offset based on the
     email's position in its campaign (`1 s + seq × 5 ms`), **so the original order is kept**,
  3. calls `job.moveToDelayed(...)` and throws BullMQ's `DelayedError`. The job is not dropped,
     not failed, and does not use up a retry attempt.
- If the SMTP send fails, the slot is given back with `DECR` so failures don't use up the hour.

### Slack notification on limit hit
- When a sender first goes over its limit in an hour, the worker runs `SET notified:{senderId}:{hour} NX EX 7200`.
  Only the first caller succeeds, so **one message per sender per hour**, not one per email.
- The message is posted to the campaign owner's Slack **incoming webhook**, obtained through the real
  OAuth v2 flow (`incoming-webhook` scope) from the dashboard's **Connect Slack** button.
- The callback arrives on the ngrok `PUBLIC_URL`, a different domain where the login cookie is not sent.
  So the user id travels in a short-lived (10 min) signed JWT in the OAuth `state` parameter, which
  `/slack/callback` verifies.
- No connection means the notification is skipped silently. The connection is read from the DB on every
  notification, so connecting, disconnecting or reconnecting works immediately without a restart.

### Behaviour under load (1000+ emails at the same time)
- Scheduling: one `createMany` per 1000 rows plus `addBulk` per 500 jobs, so 1000 emails take a few round-trips.
- Sending: the limiter keeps it to 1 send per `MIN_SEND_DELAY_MS` overall. Concurrency 5 lets several
  jobs be in flight (DB, SMTP, ES), but the limiter controls the start rate.
- Over the hourly limit: each sender sends up to its limit this hour. Every other job is moved to
  the next hour in order, then the next, until all are sent. **Nothing is dropped.**
- Trade-off: an over-limit job is checked once per hour window and each check uses one limiter slot,
  so with a large backlog the extra jobs are moved one at a time at the limiter pace. It is simple and
  correct, but adds Redis/DB traffic. A refinement would be to reserve future hour slots up front so
  each email is rescheduled only once.
- Multiple worker instances: everything that has to be shared (limiter, hourly counters, notify keys,
  the claim) is in Redis or Postgres, so you can run more `npm run worker` processes safely.

## Elasticsearch
- Index `emails`: every email is indexed on create (bulk) and re-indexed on every status change
  (`sending` is skipped; `delayed`, `sent`, `failed` and the retry back to `scheduled` are indexed).
- `GET /api/search?q=` runs a `multi_match` (`bool_prefix`) on recipient, subject, body and status,
  filtered to the logged-in user.
- Every ES call is wrapped in try/catch and only logs a warning. If Elastic is down or not configured,
  scheduling and sending keep working, and the UI shows "Search is unavailable".

## Bull Board
Live BullMQ dashboard at **`BACKEND_URL/admin/queues`** (http://localhost:4000/admin/queues by default),
also linked from the dashboard header. It shows delayed, active, completed and failed jobs.

## Auth
- **Google OAuth** on the backend (passport). The callback upserts the user, sets a JWT in an
  httpOnly, `sameSite=lax` cookie (7 days) and redirects to `FRONTEND_URL/dashboard`.
- The header shows the user's name, email and avatar, plus a **Logout** button that clears the cookie.
- CORS: `origin = FRONTEND_URL`, `credentials: true`; the frontend sends `credentials: 'include'`.

## API reference

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/google` | – | Start Google login |
| GET | `/auth/google/callback` | – | Google callback → cookie → redirect |
| GET | `/auth/me` | cookie | Current user + Slack status |
| POST | `/auth/logout` | – | Clear cookie |
| POST | `/api/campaigns` | cookie | Schedule a campaign `{subject, body, recipients[], startTime, delayBetweenMs, hourlyLimit?}` |
| GET | `/api/emails?status=scheduled\|sent&page=&pageSize=` | cookie | Scheduled tab = scheduled + delayed + sending; Sent tab = sent + failed |
| GET | `/api/emails/counts` | cookie | Tab counts |
| GET | `/api/search?q=` | cookie | Elasticsearch search |
| GET | `/api/senders` | cookie | Senders + configured limits |
| GET | `/slack/connect` | cookie | Redirect to Slack OAuth |
| GET | `/slack/callback` | signed state | Store webhook → redirect |
| POST | `/slack/disconnect` | cookie | Remove Slack connection |
| POST | `/slack/test` | cookie | Send a test Slack message |
| GET | `/admin/queues` | – | Bull Board |
| GET | `/health` | – | Health check |

## Email statuses
`scheduled` → `sending` → `sent`, with `delayed` (hourly limit hit, moved to the next hour) and
`failed` (3 attempts used up).

## Frontend notes
No Figma file was available, so the UI is a clean Tailwind dashboard that covers every listed
requirement: a header with avatar, name, email and logout; Scheduled and Sent tabs with counts; a
**Compose New Email** modal (subject, body, CSV/text upload with the detected-email count, start time,
delay, hourly limit); tables with loading, empty and error states; toasts; a Slack connect card;
search; and auto-refresh every 5 s.
