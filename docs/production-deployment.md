# Scanonix Production Deployment Guide

Complete checklist for deploying Scanonix to Vercel with Supabase, Stripe, and Google OAuth.

---

## Pre-deploy validation

Run locally with production-like env vars:

```bash
node --env-file=.env.local scripts/validate-production-env.mjs
npm run build
npm run lint
```

Apply all Supabase migrations (`001` through `011`) in order.

---

## Required Vercel environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SITE_URL` | **Yes** | `https://your-domain.com` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Yes** | Anon/publishable key only |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Server-only — never expose to client |
| `CRON_SECRET` | **Yes** | Random 64-char hex — protects cron endpoint |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **Yes** | Stripe live/test publishable key |
| `STRIPE_SECRET_KEY` | **Yes** | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | **Yes** | From Stripe webhook endpoint |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | **Yes** | Live price IDs for production |
| `STRIPE_PRO_YEARLY_PRICE_ID` | **Yes** | |
| `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | **Yes** | |
| `STRIPE_BUSINESS_YEARLY_PRICE_ID` | **Yes** | |
| `OPENAI_API_KEY` | Recommended | Cloud AI for Pro/Business scans & tools |

Optional domain reputation providers: `GOOGLE_SAFE_BROWSING_API_KEY`, etc.

---

## Supabase settings

### Migrations

Run all files in `supabase/migrations/` in numeric order in the Supabase SQL editor.

Critical migrations:
- `001_profiles.sql` — user profiles
- `003_billing.sql` — Stripe fields + billing protection
- `005_scan_history.sql` — scan storage
- `008_admin_role.sql` — admin role column
- `010_security_monitors.sql` — scheduled monitoring
- `011_production_indexes.sql` — performance + job idempotency

### Auth redirect URLs

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://your-domain.com`
- **Redirect URLs:**
  - `https://your-domain.com/auth/callback`
  - `http://localhost:3000/auth/callback` (development)

### Google OAuth

Supabase Dashboard → Authentication → Providers → Google:

1. Enable Google provider
2. Add Google Cloud OAuth client ID and secret
3. In Google Cloud Console → Credentials → OAuth 2.0 Client:
   - **Authorized JavaScript origins:** `https://your-domain.com`
   - **Authorized redirect URIs:** `https://<project-ref>.supabase.co/auth/v1/callback`

### Storage buckets

Ensure buckets exist: `avatars`, `user-files` (run `scripts/provision-storage.mjs` if needed).

### First admin user

After migration `008_admin_role.sql`:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
```

---

## Stripe settings

### Products & prices

Create Pro and Business products with monthly/yearly prices. Copy live price IDs to Vercel env vars.

### Webhook

Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **URL:** `https://your-domain.com/api/stripe/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### Customer portal

Enable Stripe Customer Portal for subscription management.

---

## Cron settings

### vercel.json

Included in repo — runs `/api/cron/monitors/run` every 15 minutes.

Requires **Vercel Pro** plan for cron jobs.

### CRON_SECRET

1. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Set in Vercel env vars as `CRON_SECRET`
3. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on cron invocations

See `docs/scheduled-monitoring-cron.md` for details.

---

## Health checks

| Endpoint | Access | Purpose |
|----------|--------|---------|
| `GET /api/health` | Public | Liveness (`{ ok: true }`) |
| `GET /api/health/supabase` | Production: CRON_SECRET or Bearer | Detailed Supabase check |

---

## Security (built-in)

- Security headers via `next.config.ts` (HSTS, X-Frame-Options, etc.)
- Cron auth: skipped in development, required in production
- Rate limiting on expensive API routes (scans, AI, monitors)
- Admin routes: `requireAdmin()` / `requireAdminApi()`
- Demo scan reports disabled in production
- Service role key never exposed to client (`config/env.public.ts` for browser-safe vars only)
- Upload limits capped at 25 MB (engine + Vercel body limit)

---

## Post-deploy verification

- [ ] `GET https://your-domain.com/api/health` returns 200
- [ ] Sign up / log in with email
- [ ] Google OAuth sign-in works
- [ ] Run a website security scan
- [ ] Upgrade to Pro via Stripe checkout
- [ ] Webhook updates profile plan (check Supabase `profiles`)
- [ ] Create a security monitor at `/monitors`
- [ ] Trigger cron manually or wait for schedule
- [ ] Admin dashboard at `/admin` (admin user only)
- [ ] PDF export works for owned scans
- [ ] `robots.txt` and `sitemap.xml` load correctly

---

## Remaining manual steps

1. **Custom domain** — Vercel → Domains → add and verify DNS
2. **SSL** — Automatic via Vercel
3. **Email provider** — Connect Resend/SendGrid for monitor alert emails (queue stub exists)
4. **Error monitoring** — Optional: Sentry, Vercel log drains
5. **Upstash Redis** — Optional upgrade for distributed rate limiting across serverless instances

---

## Deployment checklist (exact order)

1. Apply Supabase migrations `001`–`011`
2. Configure Supabase auth URLs + Google OAuth
3. Create Stripe products, prices, webhook
4. Set all Vercel environment variables
5. Connect GitHub repo to Vercel
6. Deploy to production
7. Run `node scripts/validate-production-env.mjs` against production env (or verify in Vercel UI)
8. Promote first admin user via SQL
9. Test auth, scan, billing, monitoring, admin
10. Enable Vercel Cron (verify in Vercel → Cron Jobs tab)
11. Monitor `/admin/monitoring` for job health
