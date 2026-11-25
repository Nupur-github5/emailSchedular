# Handover Guide: Running This Project on Your Own Laptop

This project was built and tested on another laptop. Everything machine-specific or account-specific
lives in two files, `backend/.env` and `frontend/.env`, plus a few external accounts.
**You do not need to change any code.** Follow the steps below in order.

---

## 1. Install these first

| Tool | Where | Check it works |
|---|---|---|
| Node.js 20+ | https://nodejs.org | `node -v` |
| Git | https://git-scm.com | `git --version` |
| ngrok (free account) | https://ngrok.com | `ngrok version` |

No Docker is needed. The database, Redis and Elasticsearch are free cloud services (section 2).

---

## 2. Things YOU must create with your own accounts

The original developer's keys are **not** included and will not work for you. Create your own:

### Cloud services (database, Redis, search)

**Postgres: Neon** (https://neon.com)
1. Sign up → create a project.
2. Click **Connect**, turn **Connection pooling OFF**, and copy the connection string
   (it starts with `postgresql://` and ends with `?sslmode=require`). This is `DATABASE_URL`.

**Redis: Redis Cloud** (https://redis.io/try-free)
1. Sign up → create the **free** database (any region close to you).
2. Open the database → copy the **public endpoint** (host:port) and the **default user password**.
3. Build `REDIS_URL` as `redis://default:PASSWORD@HOST:PORT`.
   (Don't use Upstash's free plan: BullMQ talks to Redis constantly and uses up its free command limit.)

**Elasticsearch: Elastic Cloud** (https://cloud.elastic.co, free trial)
1. Sign up → create a deployment / project.
2. Copy the **Elasticsearch endpoint URL** → this is `ELASTICSEARCH_URL`.
3. Create an **API key** → this is `ELASTICSEARCH_API_KEY`.
   Note: the trial expires after a while. If search stops working, create a new trial or ask the developer.
   Emails still schedule and send even if search is down.

### a) ngrok static domain
1. Log in at https://dashboard.ngrok.com, run the `ngrok config add-authtoken ...` command shown there.
2. Go to **Domains** and claim your free static domain (e.g. `your-name.ngrok-free.app`).
3. Start it and leave this terminal open the whole time:
   `ngrok http --url=YOUR-DOMAIN.ngrok-free.app 4000`

### b) Google OAuth (for login)
1. https://console.cloud.google.com → create a project.
2. **APIs & Services → OAuth consent screen** → External → fill in app name + email →
   add **your own Gmail as a Test user**.
3. **Credentials → Create Credentials → OAuth client ID → Web application**.
4. Authorized redirect URI: `http://localhost:4000/auth/google/callback`
5. Copy the **Client ID** and **Client Secret**.

### c) Slack app (for rate-limit notifications)
1. Have a Slack workspace (create a free one if needed).
2. https://api.slack.com/apps → **Create New App → From scratch** → choose the workspace.
3. **Incoming Webhooks** → turn **On**.
4. **OAuth & Permissions**:
   - Redirect URL: `https://YOUR-DOMAIN.ngrok-free.app/slack/callback`.
     If Slack says "Please use a valid redirect URL", enter only the domain
     (`https://YOUR-DOMAIN.ngrok-free.app`, no path) — Slack accepts partial matches — then **Save URLs**.
     (Your ngrok domain may end in `.ngrok-free.app` or `.ngrok-free.dev`; use whatever ngrok shows.)
   - Scopes: add `incoming-webhook`
5. **Basic Information** → copy **Client ID** and **Client Secret**.

### d) Ethereal (fake email)
Nothing to do. The seed step creates test sender accounts automatically and prints their logins.
Use those logins at https://ethereal.email to see the "sent" emails.

---

## 3. Values to change in `backend/.env`

Copy `backend/.env.example` to `backend/.env`, then set:

| Variable | What to put | Must change? |
|---|---|---|
| `GOOGLE_CLIENT_ID` | From step 2b | **YES** |
| `GOOGLE_CLIENT_SECRET` | From step 2b | **YES** |
| `SLACK_CLIENT_ID` | From step 2c | **YES** |
| `SLACK_CLIENT_SECRET` | From step 2c | **YES** |
| `PUBLIC_URL` | `https://YOUR-DOMAIN.ngrok-free.app` | **YES** |
| `SLACK_REDIRECT_URI` | `https://YOUR-DOMAIN.ngrok-free.app/slack/callback` (must match Slack exactly) | **YES** |
| `JWT_SECRET` | Any long random string | **YES** |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/auth/google/callback` (must match Google exactly) | Only if you change the port |
| `DATABASE_URL` | Neon connection string (pooling off) | **YES** |
| `REDIS_URL` | `redis://default:PASSWORD@HOST:PORT` from Redis Cloud | **YES** |
| `ELASTICSEARCH_URL` | Elastic Cloud endpoint URL | **YES** |
| `ELASTICSEARCH_API_KEY` | Elastic Cloud API key | **YES** |
| `PORT` / `BACKEND_URL` | `4000` / `http://localhost:4000` | Only if port 4000 is already used |
| `FRONTEND_URL` | `http://localhost:5173` | Only if port 5173 is already used |
| `WORKER_CONCURRENCY` | e.g. `5` | Optional |
| `MIN_SEND_DELAY_MS` | e.g. `2000` (2 s between sends) | Optional |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | e.g. `50` (set `3` to demo the rate limit + Slack quickly) | Optional |

## 4. Values to change in `frontend/.env`

Copy `frontend/.env.example` to `frontend/.env`:

| Variable | What to put | Must change? |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | Only if backend port changed |

**If you change the backend port (4000)**, update it everywhere it appears: both `.env` files,
the ngrok command, and the Google redirect URI.

---

## 5. Run it

Exact commands are in **HOW_TO_RUN.md**. In short:
1. Make sure the cloud values from section 2 are in `backend/.env`
2. In `backend/`: `npm install`, `npm run db:setup` (migrate + seed, prints Ethereal logins), then `npm run dev` (API) and `npm run worker` (two terminals)
3. In `frontend/`: `npm install`, `npm run dev`
4. Keep ngrok running
5. Open http://localhost:5173 and log in with the Gmail you added as a Test user

---

## 6. Common problems

| Problem | Fix |
|---|---|
| Google says "access blocked" / "app not verified" | Add your Gmail as a Test user on the OAuth consent screen |
| Google `redirect_uri_mismatch` | `GOOGLE_CALLBACK_URL` must match the Google Console URI character-for-character |
| Slack `bad_redirect_uri` | `SLACK_REDIRECT_URI` must match the Slack app's Redirect URL exactly, and ngrok must be running |
| Prisma migrate fails / hangs with Neon | Use the connection string with pooling OFF, ending in `?sslmode=require` |
| Redis `ECONNREFUSED` / `NOAUTH` | Check host, port and password in `REDIS_URL` (format `redis://default:PASSWORD@HOST:PORT`) |
| Search returns nothing / ES errors in logs | Check `ELASTICSEARCH_URL` and `ELASTICSEARCH_API_KEY`; the Elastic trial may have expired |
| "port already in use" | Change `PORT`/`BACKEND_URL` (or `FRONTEND_URL`) in `.env` (see section 3) |
| No Slack message on rate limit | Click **Connect Slack** in the dashboard first; lower `MAX_EMAILS_PER_HOUR_PER_SENDER` to 3 to test |

## 7. Never commit or share
`backend/.env`, `frontend/.env`. They hold your secrets and are already in `.gitignore`.
