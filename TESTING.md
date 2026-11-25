# Testing Guide

Start everything as in HOW_TO_RUN.md. Keep Bull Board open in a tab: http://localhost:4000/admin/queues

Create a small leads file to use in the tests:
```bash
printf "email\nalice@example.com\nbob@example.com\ncarol@example.com\ndave@example.com\nerin@example.com\n" > ~/leads5.csv
```

## 1. Scheduling
1. Dashboard → **Compose New Email**. Enter a subject and body.
2. Upload `~/leads5.csv` → it should say **5 emails detected**.
3. Start time: 2 minutes from now. Delay between emails: `5`. Hourly limit: empty.
4. Click **Schedule** → toast "Scheduled 5 emails".
5. **Scheduled Emails** tab lists 5 rows, 5 s apart. Bull Board shows 5 jobs under **Delayed**.
6. At the start time they move to **Sent Emails** (the page refreshes every 5 s). Click **Preview ↗** to see the email on Ethereal.

## 2. Restart safety
1. Schedule the 5 leads again with start time **3 minutes from now**.
2. In the worker terminal press `Ctrl+C`. Also stop the API (`Ctrl+C`) to simulate a full restart.
3. Wait until the start time has passed. Nothing is sent (worker is down); rows stay "scheduled".
4. Start the API and worker again (`npm run dev`, `npm run worker`).
5. The worker log prints `reconcile checked N pending email(s)` and the overdue emails are sent right away; anything still in the future is sent at its original time. Jobs live in Redis and rows in Postgres, so nothing is lost or restarted.

## 3. No duplicates
1. After any test, in `backend/` run:
   ```bash
   npm run stats
   ```
   It must print **No duplicate sends found.**
2. Optional stronger test: run a **second** worker in another terminal (`npm run worker`) while a campaign is sending.
   Each email row is claimed with `UPDATE ... WHERE status IN ('scheduled','delayed')`, so only one worker can send it. `npm run stats` still shows no duplicates.
3. Restart the worker several times during a campaign: still no duplicates (BullMQ job id = email id, and the DB claim blocks re-sends).

## 4. Rate limit + Slack message
1. Dashboard → **Connect Slack** → approve in Slack and pick a channel. You return to the dashboard with "Slack connected", and a confirmation message appears in that Slack channel. (**Send test** sends another one.)
2. Compose with `~/leads5.csv`, start time = now (or 1 minute ahead), delay `2`, **Hourly limit `1`**.
   (There are 2 senders, round-robin, so each sender may send 1 per hour → 2 emails go out, 3 are delayed.)
3. Expected (if nothing else was sent in this clock hour; the limit counts every send in the hour,
   so after earlier tests fewer, possibly 0, go out immediately; the rest still behaves the same):
   - 2 emails become **sent**.
   - 3 become **delayed**, with scheduled time moved to the start of the next hour (order preserved).
   - Slack gets a ":warning: Hourly limit reached for sender ..." message, **once per sender per hour** (not once per email).
   - Bull Board shows the 3 jobs back under **Delayed**.
4. Disconnect check: click **Disconnect**, schedule again with limit `1` → emails still delay correctly, no Slack message, no crash. Reconnect → notifications work again without restarting anything.

Alternative: set `MAX_EMAILS_PER_HOUR_PER_SENDER=3` in `backend/.env` and restart the API + worker. The UI limit can only lower this value, never raise it.

## 5. 1000-email load
1. Generate 1000 leads:
   ```bash
   node -e 'console.log("email");for(let i=1;i<=1000;i++)console.log(`lead${i}@example.com`)' > ~/leads1000.csv
   ```
2. Compose → upload → **1000 emails detected**. Start time: now. Delay: `0`. Hourly limit: `10`.
3. Click **Schedule**. It returns in a few seconds (DB insert in chunks of 1000, `addBulk` in chunks of 500).
4. Expected:
   - Scheduled tab: total 1000 (paginated). Bull Board: 1000 jobs.
   - The worker sends at most 1 email every `MIN_SEND_DELAY_MS` (default 2 s), no matter how many jobs are due.
   - Each sender sends at most 10 in the current hour (20 total with 2 senders). The rest become **delayed** to the next hour, in their original order, and continue hour by hour. Nothing is dropped or failed.
     (Each over-limit check also uses one limiter slot, so the remaining rows flip from "scheduled" to "delayed" at about one every 2 s, not all at once.)
   - One Slack message per sender per hour.
   - `npm run stats` shows sends per sender per hour never above the limit, and no duplicates.
5. You don't need to wait for all 1000. To clean up, delete the jobs in Bull Board (**Delayed → Clean**) or leave them.

## 6. Search (Elasticsearch)
Type a recipient address or a subject word in the dashboard search box. Results come from Elasticsearch and include status updates (scheduled → sent). If Elasticsearch is down the box shows "Search is unavailable" and sending continues normally.
