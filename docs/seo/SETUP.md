# Scanonix Search Console — Local Setup

Read-only local SEO reporting for Scanonix. **No credentials in git. No write access.**

## Prerequisites

- Node.js 20+ (matches project)
- Google account with **existing** Scanonix Search Console access
- Google Cloud project (Scanonix-owned — do not reuse unrelated OAuth clients)

## Security rules

- Scope: `https://www.googleapis.com/auth/webmasters.readonly` **only**
- Never request `https://www.googleapis.com/auth/webmasters` (write)
- Never paste client secrets or tokens into Cursor chat
- Never commit `client_secret*.json`, `token*.json`, or `.tmp-seo/` output
- Do not submit/remove sitemaps or request indexing via API

## Step 1 — Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a **Scanonix** project (if no suitable project exists → `HUMAN_SETUP_REQUIRED`)
3. Enable **Google Search Console API** (Webmasters API)
4. Configure OAuth consent screen if prompted
5. Create credentials → **OAuth client ID** → **Desktop app**
6. Download the JSON file

## Step 2 — Store credentials locally

```text
.secrets/gsc/client_secret.json   ← OAuth client JSON (gitignored)
.secrets/gsc/token.json           ← created by npm run seo:auth (gitignored)
```

Alternative paths via environment variables:

```env
GSC_SECRETS_DIR=.secrets/gsc
GSC_OAUTH_CLIENT_SECRET_PATH=/absolute/path/to/client_secret.json
GSC_OAUTH_TOKEN_PATH=/absolute/path/to/token.json
```

Add these to `.env.local` only — never commit real values.

## Step 3 — Authorize (read-only)

```bash
npm run seo:auth
```

1. Browser opens Google OAuth
2. Sign in with the account that has Scanonix Search Console access
3. Approve **read-only** Search Console access only
4. Token saved to `.secrets/gsc/token.json`

## Step 4 — Run reports

```bash
npm run seo:report      # full baseline + opportunities (alias: seo:gsc)
npm run seo:index-audit # optional 36-tool URL inspection (~40s, rate-limited)
```

JSON output (gitignored): `.tmp-seo/seo-report.json`

## Property identification

The tooling **lists** accessible properties and selects the Scanonix property automatically when unambiguous. It does **not** guess between `sc-domain:scanonix.com` and `https://www.scanonix.com/` if both exist — resolve manually and set:

```env
GSC_SITE_URL=https://www.scanonix.com/
```

(Planned env override — if multiple properties match, human picks one.)

## Troubleshooting

| Symptom | Action |
|--------|--------|
| `HUMAN_SETUP_REQUIRED` | Complete steps 1–3 above |
| No properties listed | Verify Google account has GSC access |
| Write scope error | Delete `token.json`, re-run `seo:auth` with read-only scope |
| Empty analytics | Normal for new/low-volume sites — see EARLY SIGNAL rules in SPECIALIST-RULES.md |

## What this does NOT do

- No production code changes
- No sitemap submit/remove
- No Indexing API
- No new GSC property creation
- No GA4 installation (see ANALYTICS-DECISION.md)
