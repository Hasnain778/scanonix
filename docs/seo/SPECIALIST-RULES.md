# Scanonix SEO Specialist Rules

Operating guide for Cursor and human SEO work on Scanonix.

## Core principles

1. **Search Console data is READ ONLY.** Never auto-submit sitemaps, request indexing, or change property settings via API.
2. **Never make production code changes from one day's tiny data.** Scanonix has relatively low Search Console volume — treat small samples as **EARLY SIGNAL**, not SEO WIN/LOSS.
3. **Separate OBSERVATION → HYPOTHESIS → RECOMMENDATION.** Document each layer before proposing code changes.
4. **Prioritize real user intent.** Tools must match what searchers need (merge PDF, compress PDF, etc.).
5. **No keyword stuffing, doorway pages, fake reviews, or false Free/Privacy claims.**

## Thresholds (Phase 129C + SEO-AUTO-2)

| Metric | Threshold | Label |
|--------|-----------|-------|
| Impressions (meaningful row) | ≥ 10 | Below = EARLY SIGNAL |
| Cannibalization (total query imp) | ≥ 20 | Below = EARLY SIGNAL |
| Cannibalization (per URL imp) | ≥ 5 | Minimum per competing URL |
| High-impression CTR review | ≥ 50 imp, CTR < 2% | ACTION_CANDIDATE |
| Legacy position bands | 4–15, 8–20 | Striking distance monitoring |
| Position TOP | 1–10 | Snippet/CTR review territory |
| Position STRIKING_DISTANCE | 11–30 | Ranking/content/internal-link |
| Position EMERGING | 31–60 | Emerging relevance |
| Position DEEP | 61–100 | Intent/content/authority — not CTR-only |
| Evidence STRONG / SPARSE / INSUFFICIENT | see `lib/seo/local/evidence.ts` | Sparse blocks content-change proposals |

## Protected surfaces

- **128F UX** — do not redesign tool UI for SEO
- **Tool engines** — never modify `lib/tools/*` engines during SEO work
- **Canonicals / sitemap** — do not change casually; require tests + human approval
- **Legal pages** — self-canonical (`/privacy`, `/terms`, `/contact`)
- **Canonical host** — `https://www.scanonix.com` (129B-FIX1)
- **OCR measurement hold** — report/classify only; no actionable title/H1/content proposals while hold is active (`lib/seo/local/holds.ts`)

## Workflow

### Weekly / release check

```bash
npm run seo:report
npm run seo:propose
```

Review: baseline 28d, 7d vs previous 7d (label low volume), opportunities, evidence quality, proposals under `.tmp-seo/proposals/`.

**`seo:propose` NEVER edits production SEO.** It only writes gitignored proposal artifacts for human review.

Full experiment workflow: [EXPERIMENTS.md](./EXPERIMENTS.md)

```text
GSC DATA → PROPOSAL → HUMAN REVIEW → separate approved edit phase → validation → deliberate release → measurement hold → 7/14/28-day evaluation
```

### Before SEO code changes

1. Run `verify-seo-canonical-host`, `verify-seo-129b`, `verify:seo-auto-2`, tool matrix regressions as relevant
2. Document hypothesis with GSC evidence (not single-day spikes); require STRONG evidence for content changes
3. Propose minimal diff — metadata/copy only unless P0 technical issue
4. Human review + commit/deploy approval required
5. Record experiment baseline in `.tmp-seo/experiments/` (gitignored)

### Optional deep dive

```bash
npm run seo:index-audit   # 36 tools, rate-limited URL Inspection
```

Compare indexing vs declared canonicals. Do not request indexing.

## Analytics complement

Search Console measures **search visibility**. Product analytics (when implemented) measures **on-site behavior**.

Funnel (future, with consent-safe GA4):

```text
Google impression → click → tool page → tool_start → tool_success → download → Pro CTA
```

Do not attempt to identify individual Search Console users.

## Cannibalization

Flag when multiple Scanonix URLs earn meaningful impressions for the same query. **Two impressions is not cannibalization.** Human review required before changing canonicals or consolidating pages.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run seo:auth` | One-time OAuth (read-only) |
| `npm run seo:report` | Baseline + opportunities + sitemap |
| `npm run seo:gsc` | Alias for `seo:report` |
| `npm run seo:index-audit` | 36-tool index audit |
| `npm run seo:propose` | Proposal artifacts only (never edits production SEO) |
| `npm run seo:experiment-status` | Post-change measurement signals (not causality) |
| `npm run verify:seo-auto-2` | Deterministic SEO-AUTO-2 checks |

## Release gate

Proposed SEO releases require:

- [ ] Regression scripts pass
- [ ] No secrets in diff
- [ ] Human approved commit/deploy
- [ ] Before/after GSC comparison scheduled (28d window)
- [ ] Measurement hold respected for pages under observation (e.g. OCR)
