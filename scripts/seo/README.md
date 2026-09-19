# Local SEO Scripts

Read-only Search Console tooling — **not bundled into Next.js client**.

## Commands

```bash
npm run seo:auth               # OAuth authorization (read-only scope)
npm run seo:report             # Full SEO report
npm run seo:gsc                # Alias for seo:report
npm run seo:index-audit        # Tool URL Inspection (optional, rate-limited)
npm run seo:propose            # Proposal artifacts only — NEVER edits production SEO
npm run seo:monitor            # Snapshot compare / watchlist (SEO-AUTO-3)
npm run seo:experiment-status  # Ledger vs GSC report (correlation only)
npm run verify:seo-auto-2      # Deterministic SEO-AUTO-2 checks
npm run verify:seo-auto-3      # Deterministic SEO-AUTO-3 checks
```

## Setup

See [docs/seo/SETUP.md](../../docs/seo/SETUP.md).

## Architecture

```text
scripts/seo/          ← CLI entry points (tsx)
lib/seo/local/        ← GSC client, evidence, proposals, snapshots, monitor
.secrets/gsc/         ← OAuth credentials (gitignored)
.tmp-seo/             ← Report / snapshots / proposals / monitor (gitignored)
```

## Scope

- `https://www.googleapis.com/auth/webmasters.readonly` only
- No write methods, no Indexing API, no sitemap submit
- `seo:propose` / `seo:monitor` never mutate `constants/tool-seo.ts` or production pages

## Specialist rules

[docs/seo/SPECIALIST-RULES.md](../../docs/seo/SPECIALIST-RULES.md) · [docs/seo/EXPERIMENTS.md](../../docs/seo/EXPERIMENTS.md) · [docs/seo/MONITORING.md](../../docs/seo/MONITORING.md)
