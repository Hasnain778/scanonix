# Scanonix — Production Environment Checklist (Vercel)

Reference for configuring Vercel environment variables after Phase 6/6A.  
**This document lists variable NAMES only — never paste real secret values here or in Vercel notes.**

Related docs: [production-deployment.md](./production-deployment.md) · [scheduled-monitoring-cron.md](./scheduled-monitoring-cron.md)

---

## Security rules (read first)

- **Never** prefix secret keys with `NEXT_PUBLIC_`. Only publishable/anon keys belong in `NEXT_PUBLIC_*`.
- **Never** copy local Windows paths (`C:\…`, `D:\…`, `gswin64c.exe`, etc.) into Vercel. Vercel runs Linux serverless; local binary paths will not work.
- **Never** commit `.env.local` or paste secret values into this file, PR descriptions, or chat logs.
- These keys must remain **server-only** on Vercel (Production, Preview, Development scopes as applicable):
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `CRON_SECRET`
  - `OPENAI_API_KEY`
  - `CLOUDCONVERT_API_KEY`
  - All domain-reputation API keys
  - All `*_SERVICE_URL` worker endpoints (may embed auth tokens — treat as secrets)
- Native ML/PDF tools **do not** silently fall back to paid APIs. If a worker URL is unset, the route returns **503** with a clear message.

### Scope legend

| Column | Meaning |
|--------|---------|
| **Vercel Production** | Set before or during first production deploy |
| **Vercel Preview** | Set if preview deployments should exercise the same integrations (often test keys) |
| **Vercel Development** | Optional; local `next dev` uses `.env.local` instead |

---

## 1. REQUIRED FOR INITIAL VERCEL DEPLOYMENT

Minimum set for a working production site: auth, database, server APIs, and scheduled monitoring.

### `NEXT_PUBLIC_SITE_URL`

| | |
|---|---|
| **Used by** | Canonical site URL (links, redirects, OAuth callbacks, metadata) |
| **Exposure** | Browser-safe (`NEXT_PUBLIC_*`) |
| **Vercel Production** | **Yes** — production domain (e.g. `https://scanonix.com`, no trailing slash) |
| **Vercel Preview** | **Yes** — use the preview URL or a stable staging domain |
| **Vercel Development** | Optional — local dev uses `.env.local` |

### `NEXT_PUBLIC_SUPABASE_URL`

| | |
|---|---|
| **Used by** | Supabase client (auth, profiles, scan history, storage) |
| **Exposure** | Browser-safe |
| **Vercel Production** | **Yes** |
| **Vercel Preview** | **Yes** — same project or a dedicated staging project |
| **Vercel Development** | Optional — local `.env.local` |

### `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

| | |
|---|---|
| **Used by** | Supabase anon/publishable key for browser and server user-context calls |
| **Exposure** | Browser-safe (publishable/anon key only — **not** the service role key) |
| **Vercel Production** | **Yes** |
| **Vercel Preview** | **Yes** |
| **Vercel Development** | Optional — local `.env.local` |

### `SUPABASE_SERVICE_ROLE_KEY`

| | |
|---|---|
| **Used by** | Admin queries, webhooks, cron jobs, server-side privileged Supabase operations |
| **Exposure** | **Server-only** — never `NEXT_PUBLIC_*` |
| **Vercel Production** | **Yes** |
| **Vercel Preview** | **Recommended** if preview runs cron or admin flows |
| **Vercel Development** | Optional — local `.env.local` |

### `CRON_SECRET`

| | |
|---|---|
| **Used by** | `/api/cron/monitors/run` — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** — generate a random secret (e.g. 64-char hex) |
| **Vercel Preview** | **Optional** — only if preview cron is enabled |
| **Vercel Development** | **Not required** — local `next dev` skips cron auth |

---

## 2. REQUIRED WHEN STRIPE LIVE BILLING IS ENABLED

Omit this entire section if billing is disabled at launch. Without these, checkout, portal, and subscription webhooks return errors or are unavailable.

### `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

| | |
|---|---|
| **Used by** | Stripe.js / client checkout UI |
| **Exposure** | Browser-safe (publishable key) |
| **Vercel Production** | **Yes** — live publishable key when billing goes live |
| **Vercel Preview** | **Yes** — use Stripe **test** publishable key for preview |
| **Vercel Development** | Optional — local `.env.local` |

### `STRIPE_SECRET_KEY`

| | |
|---|---|
| **Used by** | Checkout session creation, billing portal, subscription sync |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** — live secret key |
| **Vercel Preview** | **Yes** — test secret key |
| **Vercel Development** | Optional — local `.env.local` |

### `STRIPE_WEBHOOK_SECRET`

| | |
|---|---|
| **Used by** | `/api/stripe/webhook` — verifies Stripe webhook signatures |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** — from production webhook endpoint |
| **Vercel Preview** | **Optional** — separate test webhook if preview handles billing events |
| **Vercel Development** | Optional — Stripe CLI forward or local webhook secret |

### `STRIPE_PRO_MONTHLY_PRICE_ID`

| | |
|---|---|
| **Used by** | Pro plan checkout (monthly) |
| **Exposure** | **Server-only** (price IDs are not secrets but kept server-side) |
| **Vercel Production** | **Yes** — live price ID |
| **Vercel Preview** | **Yes** — test price ID |
| **Vercel Development** | Optional |

### `STRIPE_PRO_YEARLY_PRICE_ID`

| | |
|---|---|
| **Used by** | Pro plan checkout (yearly) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** |
| **Vercel Preview** | **Yes** |
| **Vercel Development** | Optional |

### `STRIPE_BUSINESS_MONTHLY_PRICE_ID`

| | |
|---|---|
| **Used by** | Business plan checkout (monthly) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** |
| **Vercel Preview** | **Yes** |
| **Vercel Development** | Optional |

### `STRIPE_BUSINESS_YEARLY_PRICE_ID`

| | |
|---|---|
| **Used by** | Business plan checkout (yearly) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** |
| **Vercel Preview** | **Yes** |
| **Vercel Development** | Optional |

---

## 3. REQUIRED WHEN EXTERNAL ML/PDF WORKERS ARE CONNECTED

On Vercel, native subprocess providers (Python, Ghostscript, NCNN binaries) **cannot** run. Each tool needs an external HTTP worker. Client contracts are implemented in the app; **workers are not provisioned yet**.

Until these URLs are set, the corresponding API routes return **503** (`NOT_CONFIGURED`). This is intentional — there is no silent fallback to CloudConvert or other paid APIs.

### `REMBG_SERVICE_URL`

| | |
|---|---|
| **Used by** | Server background removal (`/api/tools/background-remover/remove`) |
| **Exposure** | **Server-only** — treat URL (and any embedded token) as a secret |
| **Vercel Production** | **Yes** — when enabling server-side background removal |
| **Vercel Preview** | **Optional** — if testing the worker from preview |
| **Vercel Development** | **Not needed** — use `REMBG_PYTHON` locally instead |
| **Worker contract** | POST multipart: `file`, `model` → PNG response |

### `REMBG_SERVICE_SECRET` (optional companion)

| | |
|---|---|
| **Used by** | Bearer token sent from Vercel to rembg worker (`Authorization: Bearer …`) |
| **Exposure** | **Server-only** — must match worker `REMBG_WORKER_SECRET` |
| **Vercel Production** | **Recommended** when worker auth is enabled |
| **Vercel Preview** | Optional |
| **Vercel Development** | Optional — pair with local worker |

Worker implementation: `rembg-worker/` (see `rembg-worker/docs/DEPLOYMENT.md`).

### `REALESRGAN_SERVICE_URL`

| | |
|---|---|
| **Used by** | Image upscaling (`/api/tools/image/upscale`) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** — when enabling upscaling on Vercel |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | **Not needed** — use `REALESRGAN_BIN` locally instead |
| **Worker contract** | POST multipart: `file`, `scale`, optional `tile` → image response |

### `PDF_COMPRESSION_SERVICE_URL`

| | |
|---|---|
| **Used by** | PDF compression (`/api/tools/pdf/compress`) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** — when enabling PDF compression on Vercel |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | **Not needed** — use `GHOSTSCRIPT_BIN` locally instead |
| **Worker contract** | POST multipart: `file`, `level` (`low` / `medium` / `high`) → PDF response |

### `PDF_REDACTION_SERVICE_URL`

| | |
|---|---|
| **Used by** | Secure PDF redaction (`/api/tools/security/redact-pdf`) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Yes** — when enabling secure redaction on Vercel |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | **Not needed** — use `PDF_REDACTION_PYTHON` locally instead |
| **Worker contract** | POST multipart: `file`, `areas` (JSON) → PDF response |

### `REMBG_MODEL` (optional companion)

| | |
|---|---|
| **Used by** | Default rembg model name passed to worker or local Python |
| **Exposure** | **Server-only** (not sensitive; no `NEXT_PUBLIC_*`) |
| **Vercel Production** | **Optional** — defaults to `isnet-general-use` if unset |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | Optional — local `.env.local` |

---

## 4. OPTIONAL

Features work with graceful degradation (503, deterministic fallback, or reduced capability) when unset.

### `OPENAI_API_KEY`

| | |
|---|---|
| **Used by** | Cloud AI: scan assistant, translate, rewrite, summary (Pro/Business) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Recommended** for premium AI features |
| **Vercel Preview** | **Optional** — use a separate or rate-limited key |
| **Vercel Development** | Optional — local `.env.local` |
| **If unset** | Deterministic/local AI fallback; premium cloud AI unavailable |

### `CLOUDCONVERT_API_KEY`

| | |
|---|---|
| **Used by** | PDF↔Word conversion (`/api/tools/pdf-to-word`, `/api/tools/word-to-pdf`) |
| **Exposure** | **Server-only** — must never be `NEXT_PUBLIC_*` |
| **Vercel Production** | **Optional** — required only for CloudConvert document conversion |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | Optional — local `.env.local` |
| **If unset** | Routes return **503**; no silent fallback from native tools |

### `GOOGLE_SAFE_BROWSING_API_KEY`

| | |
|---|---|
| **Used by** | URL/domain reputation during security scans |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Optional** — enhances scan coverage |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | Optional |

### `URLHAUS_API_KEY`

| | |
|---|---|
| **Used by** | URL/domain reputation (URLhaus feed) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Optional** |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | Optional |

### `PHISHTANK_API_KEY`

| | |
|---|---|
| **Used by** | URL/domain reputation (PhishTank) |
| **Exposure** | **Server-only** |
| **Vercel Production** | **Optional** |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | Optional |

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

| | |
|---|---|
| **Used by** | Fallback alias for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Exposure** | Browser-safe |
| **Vercel Production** | **Optional** — prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | Optional |

### `SUPABASE_URL`

| | |
|---|---|
| **Used by** | Server-side fallback alias for `NEXT_PUBLIC_SUPABASE_URL` |
| **Exposure** | **Server-only** alias (URL is not secret) |
| **Vercel Production** | **Optional** — prefer `NEXT_PUBLIC_SUPABASE_URL` |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | Optional |

### `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`

| | |
|---|---|
| **Used by** | Server-side fallback aliases for publishable key |
| **Exposure** | Server-only alias (publishable key is safe to expose, but these are not inlined to browser) |
| **Vercel Production** | **Optional** — prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Vercel Preview** | **Optional** |
| **Vercel Development** | Optional |

---

## 5. LOCAL-DEVELOPMENT-ONLY — NEVER ADD TO VERCEL

These configure local subprocesses or Windows/Linux filesystem paths. They **will not work** on Vercel serverless and must not be copied from `.env.local`.

| Variable | Used by (local) | Why not on Vercel |
|----------|-----------------|-------------------|
| `REMBG_PYTHON` | Local rembg Python subprocess | Requires local Python + onnxruntime |
| `REMBG_MODEL_DIR` | Local rembg model cache (`U2NET_HOME`) | Filesystem path on your machine |
| `GHOSTSCRIPT_BIN` | Local Ghostscript PDF compression | Binary path (e.g. `gswin64c.exe` on Windows) |
| `GS_BIN` | Alias for Ghostscript binary | Same as above |
| `PDF_REDACTION_PYTHON` | Local PyMuPDF redaction subprocess | Requires local Python + pymupdf |
| `REALESRGAN_BIN` | Local NCNN Vulkan upscaler binary | Native GPU binary |
| `REALESRGAN_MODEL_DIR` | Local Real-ESRGAN model directory | Filesystem path |
| `REALESRGAN_MODEL` | Local model name (e.g. `realesrgan-x4plus`) | Used with local binary only |
| `REALESRGAN_GPU_ID` | Local GPU selection | Meaningless on Vercel |
| `REALESRGAN_PYTHON` | Legacy Python upscaler path | Local Python environment |
| `REALESRGAN_ONNX_PATH` | Legacy ONNX model path | Local filesystem path |

**On Vercel**, use the matching `*_SERVICE_URL` from section 3 instead.

---

## Tools that need no extra env vars on Vercel

These run in pure Node.js/JavaScript on Vercel with no additional configuration:

- Image compress / resize (sharp)
- PDF protect, unlock, watermark, metadata cleaner (pdf-lib)
- Browser background removal preview (@imgly — client-side)
- Core scan engine (no native binaries)

---

## CURRENT DEPLOYMENT BLOCKERS

1. **Vercel project env not yet configured** — Section 1 variables must be set in Vercel Production before first deploy.
2. **Supabase production setup** — migrations (`001`–`011`), auth redirect URLs, Google OAuth, storage buckets, and first admin user must be completed outside Vercel.
3. **External ML/PDF workers not deployed** — `REMBG_SERVICE_URL`, `REALESRGAN_SERVICE_URL`, `PDF_COMPRESSION_SERVICE_URL`, and `PDF_REDACTION_SERVICE_URL` are unset; native tools return **503** on Vercel until workers exist.
4. **Stripe live billing** — Section 2 variables required before enabling paid checkout in production.
5. **CloudConvert** — PDF↔Word requires `CLOUDCONVERT_API_KEY`; returns **503** without it (by design).
6. **Domain reputation providers** — optional; scans run with reduced third-party coverage if unset.

Phase 6A verification: production build and type check **PASS**. Application code is Vercel-safe for deployable features; worker provisioning is the remaining infrastructure gap.

---

## SAFE NEXT STEPS IN ORDER

1. **Apply Supabase migrations** and configure auth redirect URLs for production domain + localhost dev.
2. **Create Vercel project** (do not deploy yet unless ready) and add **Section 1** variables to **Production** scope only — names from this checklist, values from your secret store.
3. **Run local validation** before deploy:
   - `node --env-file=.env.local scripts/validate-production-env.mjs`
   - `npx tsc --noEmit`
   - `npm run build`
4. **Configure Vercel Cron** for `/api/cron/monitors/run` with `CRON_SECRET` (see [scheduled-monitoring-cron.md](./scheduled-monitoring-cron.md)).
5. **First production deploy** with Section 1 only — verify auth, health, and core tools that need no extra keys.
6. **Add Stripe (Section 2)** when enabling live billing — test mode on Preview first, then live keys on Production.
7. **Add optional keys (Section 4)** as needed: `OPENAI_API_KEY`, `CLOUDCONVERT_API_KEY`, reputation APIs.
8. **Provision external workers** (Railway, Fly.io, VPS, etc.) — one service per native tool; set Section 3 `*_SERVICE_URL` values on Vercel Production when each worker is verified.
9. **Smoke-test each worker** from production API routes; confirm **503** clears only for the tool whose URL was added.
10. **Never** copy Section 5 local paths to Vercel.

---

## Quick reference — Vercel-safe vs external-worker providers

| Vercel-safe (no worker) | External worker required on Vercel |
|-------------------------|----------------------------------|
| Supabase, Stripe, Cron | rembg → `REMBG_SERVICE_URL` |
| CloudConvert (API key) | Real-ESRGAN → `REALESRGAN_SERVICE_URL` |
| OpenAI (API key) | Ghostscript compression → `PDF_COMPRESSION_SERVICE_URL` |
| sharp, pdf-lib | PyMuPDF redaction → `PDF_REDACTION_SERVICE_URL` |
| Domain reputation APIs | |

---

*Generated for Phase 6B. Do not paste secret values into this file.*
