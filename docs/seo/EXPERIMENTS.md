# Scanonix SEO Experiments (SEO-AUTO-2)

Local, gitignored experiment ledger and proposal workflow.

## Mandatory workflow

```text
GSC DATA
  → seo:report / existing .tmp-seo/seo-report.json
  → seo:propose  (proposal artifacts only)
  → HUMAN REVIEW
  → separate approved edit phase (manual; not this tooling)
  → validation (SEO verifiers / release gate)
  → deliberate release (human commit/push/deploy)
  → measurement hold
  → 7 / 14 / 28-day evaluation (seo:experiment-status)
```

## Critical rules

- **`npm run seo:propose` NEVER edits production SEO** (`constants/tool-seo.ts`, tool pages, etc.).
- Proposals are **investigation recommendations**, not code diffs and not ranking promises.
- Every proposal has `requiresHumanApproval: true`.
- Measurement holds (currently **OCR**) allow reporting but **block actionable edit proposals**.
- Sparse / anonymized GSC query evidence **blocks content-change recommendations**.
- Experiment approval is **explicit** (`markExperimentApproved`) — never automatic.
- Ledger data lives under **`.tmp-seo/experiments/`** (gitignored). Do not commit metrics dumps.
- OAuth remains **`webmasters.readonly` only**. Never print tokens/secrets.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run seo:report` | Pull/read GSC baseline (existing) |
| `npm run seo:propose` | Build proposal JSON under `.tmp-seo/proposals/` |
| `npm run seo:experiment-status` | Compare ledger baseline vs report metrics |
| `npm run verify:seo-auto-2` | Deterministic fixture checks |

### Propose options

```bash
npm run seo:propose
# uses .tmp-seo/seo-report.json when present

npm run seo:propose -- --from-report path/to/report.json
npm run seo:propose -- --live          # fetch GSC if credentials exist
npm run seo:propose -- --no-write      # console only
```

### Experiment status options

```bash
npm run seo:experiment-status
npm run seo:experiment-status -- --id <experiment-id>
npm run seo:experiment-status -- --from-report path/to/report.json
```

Status signals are **correlation / post-change observations only** — not causality:

- `NOT_ENOUGH_ELAPSED_TIME`
- `INSUFFICIENT_EVIDENCE`
- `IMPROVEMENT_SIGNAL`
- `DECLINE_SIGNAL`
- `MIXED_UNCLEAR`

## Ledger statuses

`proposed` → `approved` → `shipped` → `measuring` → `concluded`

Only humans move status forward after deliberate review.

## Position bands (not interchangeable)

| Band | Positions | Typical investigation |
|------|-----------|------------------------|
| TOP | 1–10 | Snippet/title CTR review when impressions are meaningful |
| STRIKING_DISTANCE | 11–30 | Ranking / content / internal links |
| EMERGING | 31–60 | Intent fit / emerging relevance |
| DEEP | 61–100 | Intent/content/authority — **not** a top-10 CTR tweak |

## Evidence quality

| Quality | Meaning |
|---------|---------|
| STRONG | Meaningful page impressions + enough visible query structure |
| SPARSE | Page metrics exist but query visibility is thin/anonymized |
| INSUFFICIENT | Too little page-level volume |

SPARSE and INSUFFICIENT block content-change recommendations.

## Intentionally retired URLs (SEO-AUTO-2.1)

Some tools (e.g. `/tools/background-remover`) were deliberately removed. GSC may still show historical impressions.

- Registry: `lib/seo/local/retired-urls.ts` (explicit allowlist only)
- `seo:propose` may still **list** them for visibility as `RETIRED_HISTORICAL`
- They are **not** active SEO candidates — historical TOP position is not a win to optimize
- Unknown 404 URLs are **not** auto-suppressed (may be real defects)

## Dirty-tree safety

SEO automation must **never** assume it owns the working tree. It writes only under `.tmp-seo/`. It must not stage, commit, push, or deploy.
