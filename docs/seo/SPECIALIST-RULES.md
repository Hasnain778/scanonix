# Scanonix SEO Specialist Rules

Operating guide for Cursor and human SEO work on Scanonix.

## Core principles

1. **Search Console data is READ ONLY.** Never auto-submit sitemaps, request indexing, or change property settings via API.
2. **Never make production code changes from one day's tiny data.** Scanonix has relatively low Search Console volume — treat small samples as **EARLY SIGNAL**, not SEO WIN/LOSS.
3. **Separate OBSERVATION → HYPOTHESIS → RECOMMENDATION.** Document each layer before proposing code changes.
4. **Prioritize real user intent.** Tools must match what searchers need (merge PDF, compress PDF, etc.).
5. **No keyword stuffing, doorway pages, fake reviews, or false Free/Privacy claims.**

## Thresholds (Phase 129C)

| Metric | Threshold | Label |
|--------|-----------|-------|
| Impressions (meaningful row) | ≥ 10 | Below = EARLY SIGNAL |
| Cannibalization (total query imp) | ≥ 20 | Below = EARLY SIGNAL |
| Cannibalization (per URL imp) | ≥ 5 | Minimum per competing URL |
| High-impression CTR review | ≥ 50 imp, CTR < 2% | ACTION_CANDIDATE |
| Position bands | 4–15, 8–20 | Striking distance monitoring |

## Protected surfaces

- **128F UX** — do not redesign tool UI for SEO
- **Tool engines** — never modify `lib/tools/*` engines during SEO work
- **Canonicals / sitemap** — do not change casually; require tests + human approval
- **Legal pages** — self-canonical (`/privacy`, `/terms`, `/contact`)
- **Canonical host** — `https://www.scanonix.com` (129B-FIX1)

## Workflow

### Weekly / release check

```bash
npm run seo:report
```

Review: baseline 28d, 7d vs previous 7d (label low volume), opportunities, sitemap status.

### Before SEO code changes

1. Run `verify-seo-canonical-host`, `verify-seo-129b`, tool matrix regressions
2. Document hypothesis with GSC evidence (not single-day spikes)
3. Propose minimal diff — metadata/copy only unless P0 technical issue
4. Human review + commit/deploy approval required

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

## Release gate

Proposed SEO releases require:

- [ ] Regression scripts pass
- [ ] No secrets in diff
- [ ] Human approved commit/deploy
- [ ] Before/after GSC comparison scheduled (28d window)
