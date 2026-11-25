# How to Run (Ubuntu)

You need **4 terminals**. Do the one-time setup first.
Before starting, make sure `backend/.env` and `frontend/.env` exist (see HANDOVER.md for how to fill them).

## One-time setup

```bash
# Node 20+ via nvm (skip if `node -v` already shows v20 or newer)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

```bash
cd ~/path/to/project/backend      # change to where you put the project
npm install
npm run db:setup                  # creates the DB tables + Ethereal senders, prints their logins
```

Write down the Ethereal logins it prints. Use them at https://ethereal.email/login to read the sent emails.

```bash
cd ../frontend
npm install
```

## Every time you run it

**Terminal 1 – ngrok** (needed for the Slack callback):
```bash
ngrok http --url=YOUR-DOMAIN.ngrok-free.app 4000
```

**Terminal 2 – backend API:**
```bash
cd ~/path/to/project/backend
npm run dev
```

**Terminal 3 – worker (the process that actually sends emails):**
```bash
cd ~/path/to/project/backend
npm run worker
```

**Terminal 4 – frontend:**
```bash
cd ~/path/to/project/frontend
npm run dev
```

Open **http://localhost:5173** and click **Continue with Google**.

| What | URL |
|---|---|
| Dashboard | http://localhost:5173 |
| API health | http://localhost:4000/health |
| BullMQ dashboard (Bull Board) | http://localhost:4000/admin/queues |
| Sent mail (Ethereal inbox) | https://ethereal.email/messages |

## Handy commands (in `backend/`)

| Command | What it does |
|---|---|
| `npm run stats` | Counts emails by status, checks for duplicate sends, shows sends per sender per hour |
| `npm run db:seed` | Prints the Ethereal sender logins again (creates senders if missing) |
| `npx prisma studio` | Opens a browser UI to look at the database |
| `npm run typecheck` | TypeScript check |

To stop anything: press `Ctrl+C` in its terminal.
