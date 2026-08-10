# Scheduled Security Monitoring — Cron Setup

This document describes how to run the monitor scheduler locally and in production on Vercel.

## Endpoint

```
GET /api/cron/monitors/run
```

The scheduler:

1. Enqueues due monitors into `monitor_job_queue`
2. Processes pending jobs (website scans, change detection, notifications)
3. Returns a JSON summary (`enqueued`, `processed`, `failures`, `emailsProcessed`)

---

## Environment variable

| Variable | Required | Description |
|----------|----------|-------------|
| `CRON_SECRET` | Production only | Shared secret for cron authentication |

Generate a value:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or:

```bash
openssl rand -hex 32
```

Add to:

- **Local:** `.env.local` (optional — see below)
- **Production:** Vercel → Project → Settings → Environment Variables

Never commit real secrets to git. Use `.env.example` / `.env.local.example` as templates only.

---

## Local development

When `NODE_ENV=development` (`next dev`):

- **No secret required** — cron auth is skipped automatically
- Trigger manually:

```bash
curl http://localhost:3000/api/cron/monitors/run
```

Expected response:

```json
{
  "ok": true,
  "enqueued": 0,
  "processed": 0,
  "failures": 0,
  "emailsProcessed": 0
}
```

You can optionally set `CRON_SECRET` in `.env.local` to test production-style auth with:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/monitors/run
```

---

## Production (Vercel Cron Jobs)

### 1. Set `CRON_SECRET` in Vercel

1. Open [Vercel Dashboard](https://vercel.com) → your Scanonix project
2. **Settings** → **Environment Variables**
3. Add:
   - **Name:** `CRON_SECRET`
   - **Value:** your generated secret (same command as above)
   - **Environment:** Production (and Preview if you want cron on preview deploys)
4. Redeploy after adding the variable

### 2. Cron schedule (`vercel.json`)

The repo includes:

```json
{
  "crons": [
    {
      "path": "/api/cron/monitors/run",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This runs every **15 minutes**. Adjust the cron expression if needed (Vercel uses standard cron syntax, UTC).

Deploy to Vercel so `vercel.json` is applied. Cron jobs require a **Vercel Pro** (or Enterprise) plan on the project.

### 3. How Vercel authenticates

Vercel automatically sends:

```
Authorization: Bearer <CRON_SECRET>
```

when invoking cron routes, using the `CRON_SECRET` environment variable configured in the project. No extra headers are required in `vercel.json`.

Alternative manual/curl invocation (e.g. external cron):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/monitors/run
```

Or:

```bash
curl -H "x-cron-secret: YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/monitors/run
```

### 4. Verify production

After deploy:

1. Vercel → **Project** → **Cron Jobs** — confirm `/api/cron/monitors/run` is listed
2. Trigger a manual run from the Vercel cron UI or curl with your secret
3. Check **Admin** → **Monitoring** (`/admin/monitoring`) for job counts and failures
4. Confirm monitor runs appear under `/monitors/{id}/history`

### 5. Prerequisites

- Migration `010_security_monitors.sql` applied in Supabase
- `SUPABASE_SERVICE_ROLE_KEY` set in Vercel (scheduler uses admin client)
- At least one **active** monitor with `next_scan_at` in the past

---

## Security notes

- Cron routes are **not** protected by user session auth — only `CRON_SECRET` in production
- In production, missing `CRON_SECRET` returns **401 Unauthorized**
- Do not expose cron URLs publicly without the secret in production
- Rotate `CRON_SECRET` if compromised; update Vercel env and redeploy

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 in production | Set `CRON_SECRET` in Vercel env vars and redeploy |
| Cron not running | Confirm Vercel Pro plan and `vercel.json` crons block |
| Jobs stuck pending | Check `/admin/monitoring` for failures; verify service role key |
| No scans enqueued | Ensure monitors are `active` and `next_scan_at <= now` |
