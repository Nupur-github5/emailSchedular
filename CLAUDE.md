# Email Scheduler (ReachInbox assignment)

Be terse. Write code, no explanations unless asked. Do not start long-running dev servers or watch logs.
The full assignment is in ASSIGNMENT.md.

## Portability rule (VERY IMPORTANT)
This project will be handed to another person who runs it on their own laptop.
- NEVER hardcode URLs, ports, secrets, client IDs or domains in code. Read EVERYTHING from env vars (names below).
- Never overwrite an existing .env. Keep backend/.env.example and frontend/.env.example in sync with every env var used.
- One command must set up the DB (migrate + seed). Seed must create Ethereal senders automatically
  (nodemailer.createTestAccount) if none exist, and print their login credentials.
- Keep HANDOVER.md accurate: if you add or rename an env var, port or external setup step, update it.

## Stack
- /backend: Express + TypeScript, Prisma (Postgres), BullMQ + ioredis, nodemailer (Ethereal),
  @elastic/elasticsearch, @bull-board/express, passport-google-oauth20, JWT in httpOnly cookie
- /frontend: Vite + React + TS + Tailwind + TanStack Query + react-hot-toast
- NO Docker. All infra is hosted cloud services, reached only via env vars:
  - Postgres: Neon (DATABASE_URL includes ?sslmode=require; use the direct, non-pooled URL so Prisma migrations work)
  - Redis: Redis Cloud free DB (REDIS_URL like redis://default:PASSWORD@HOST:PORT). ioredis connection for BullMQ
    must set maxRetriesPerRequest: null. Use ONE shared connection factory.
  - Elasticsearch: Elastic Cloud (ELASTICSEARCH_URL + ELASTICSEARCH_API_KEY, client auth: { apiKey }).
    ES calls must never crash the app: wrap in try/catch, log a warning, and let sending continue.
- Separate processes: backend API (`npm run dev`) and worker (`npm run worker`)

## Env var names (use exactly these)
backend/.env:
DATABASE_URL, REDIS_URL, ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, PORT, BACKEND_URL, PUBLIC_URL, FRONTEND_URL, JWT_SECRET,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL,
SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI,
WORKER_CONCURRENCY, MIN_SEND_DELAY_MS, MAX_EMAILS_PER_HOUR_PER_SENDER
frontend/.env:
VITE_API_URL

## Auth details
- Google OAuth on backend -> set JWT cookie (httpOnly, sameSite=lax) -> redirect to FRONTEND_URL/dashboard.
- CORS: origin=FRONTEND_URL, credentials=true. Frontend fetch uses credentials: 'include'.
- Slack OAuth v2, scope `incoming-webhook`. The callback arrives via PUBLIC_URL (ngrok, a different domain),
  so the cookie is NOT available there: pass a short-lived signed JWT containing userId in the `state` param,
  verify it in /slack/callback, store incoming_webhook.url for that user, redirect to FRONTEND_URL/dashboard.
- /slack/disconnect deletes the row. No Slack connection -> notifications skipped silently, never crash.

## Scheduler hard rules
- NO cron of any kind. Scheduling = BullMQ delayed jobs only.
- POST /api/campaigns: createMany email rows, scheduledAt = startTime + i*delayBetweenMs,
  senders assigned round-robin, queue.addBulk in chunks of 500, delay = scheduledAt - now, jobId = email.id.
- Worker: concurrency = WORKER_CONCURRENCY, limiter {max:1, duration: MIN_SEND_DELAY_MS}.
- Idempotency: worker claims row via
  UPDATE emails SET status='sending' WHERE id=? AND status IN ('scheduled','delayed'); skip if 0 rows.
- Rate limit: Redis INCR rl:{senderId}:{YYYYMMDDHH} (EXPIRE 7200 on first incr), limit = MAX_EMAILS_PER_HOUR_PER_SENDER
  (campaign hourlyLimit from the UI may lower it, never raise it).
  Over limit -> DECR, status='delayed', update scheduledAt, job.moveToDelayed(nextHourStart + small offset preserving order),
  throw DelayedError. Slack notify once per sender-hour using SET NX notified:{senderId}:{hour}.
- On success: status='sent', sentAt, store nodemailer.getTestMessageUrl() as previewUrl. attempts:3 with backoff, then 'failed'.
- Index every email in Elasticsearch on create and on status change. GET /api/search?q=
- GET /api/emails?status=scheduled|sent (scheduled tab includes 'delayed' and 'sending').
- Bull Board at /admin/queues.

## Email statuses
scheduled | sending | delayed | sent | failed
