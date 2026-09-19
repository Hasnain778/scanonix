# Scanonix SEO Monitoring (SEO-AUTO-3)

Local, gitignored recurring GSC monitoring and change detection.

## What this does

```text
seo:report  →  .tmp-seo/seo-report.json  +  .tmp-seo/snapshots/*.json
seo:monitor →  compare snapshots  →  .tmp-seo/monitor/latest.json
seo:propose →  proposal artifacts (separate; never auto-invoked to edit)
```

**`seo:monitor` NEVER edits production SEO.** It never stages, commits, pushes, or deploys.

## Snapshot storage

| Path | Role |
|------|------|
| `.tmp-seo/seo-report.json` | Latest convenience report (unchanged role) |
| `.tmp-seo/snapshots/` | Timestamped historical snapshots (schema v1) |
| `.tmp-seo/monitor/latest.json` | Latest monitor output |

Snapshots store page/query metrics, periods, GSC freshness — **never** OAuth tokens, refresh tokens, client secrets, or secret paths.

Same metric content is **not** duplicated (`contentHash` dedupe).

### Retention

- Applies **only** inside `.tmp-seo/snapshots/`
- Keeps up to ~45 newest snapshot files
- Never deletes `experiments/`, `proposals/`, or `seo-report.json`

## GSC data lag

Search Console is not real-time (often ~2–3 days behind).

Monitor reports:

- `generatedAt`
- `newestGscDataDate`
- `gscLagDays`

Missing newest calendar days are **GSC delay**, not an SEO decline.

## Change detection

Severities: `INFO` | `WATCH` | `IMPORTANT`

Tiny samples (e.g. 1→2 impressions) do **not** produce IMPORTANT alerts.

Incompatible windows (same GSC end date, schema mismatch) return `INCOMPARABLE` / insufficient history — no invented trends.

## Lifecycle

| Kind | Behavior |
|------|----------|
| ACTIVE | Eligible for watch/important signals |
| RETIRED (e.g. Background Remover) | Visibility only — never active optimization alerts |
| OCR MEASUREMENT HOLD | May appear on watchlist; no automatic production edit |

## Watchlist

Deterministic reasons such as:

- `MEASUREMENT_HOLD` (OCR)
- `SPARSE_EVIDENCE` (AI Translate / PDF to Word–like)
- `DEEP_RANKING_MONITOR` / `STRIKING_DISTANCE_MONITOR`

## Experiments

For `measuring` / `shipped` experiments, checkpoints report:

`NOT_DUE` | `DUE` | `AVAILABLE` | `INSUFFICIENT_DATA`

Language is **post-change signal**, never “this change caused ranking improvement.”

## Commands

```bash
npm run seo:report
npm run seo:monitor
npm run verify:seo-auto-3
```

## Future scheduling (NOT enabled in this phase)

Documented sequence only — no GitHub Actions / Vercel cron yet:

```text
scheduled read-only GSC collection
  → snapshot
  → seo:monitor
  → proposal artifact when READY_FOR_PROPOSAL_REVIEW
  → human review
  → separate approved edit phase
```

Prefer local/manual first. If CI is added later: report-only, secrets in Actions vault, `webmasters.readonly` only, never auto-commit.
