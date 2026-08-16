# Local SEO Scripts

Read-only Search Console tooling — **not bundled into Next.js client**.

## Commands

```bash
npm run seo:auth         # OAuth authorization (read-only scope)
npm run seo:report       # Full SEO report
npm run seo:gsc          # Alias for seo:report
npm run seo:index-audit  # 36-tool URL Inspection (optional, rate-limited)
```

## Setup

See [docs/seo/SETUP.md](../../docs/seo/SETUP.md).

## Architecture

```text
scripts/seo/          ← CLI entry points (tsx)
lib/seo/local/        ← GSC client, reports (local only)
.secrets/gsc/         ← OAuth credentials (gitignored)
.tmp-seo/             ← Report JSON output (gitignored)
```

## Scope

- `https://www.googleapis.com/auth/webmasters.readonly` only
- No write methods, no Indexing API, no sitemap submit

## Specialist rules

[docs/seo/SPECIALIST-RULES.md](../../docs/seo/SPECIALIST-RULES.md)
