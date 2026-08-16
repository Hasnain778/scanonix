# Analytics Decision — Phase 129C

## Measurement inventory (repository audit)

| System | Status | Location / notes |
|--------|--------|------------------|
| **GA4** | **BLOCKED_PENDING_MEASUREMENT_ID** | No `gtag`, `G-` measurement ID, or GA4 script in repo; no `NEXT_PUBLIC_GA_MEASUREMENT_ID` in env templates |
| **GTM** | **ABSENT** | No Google Tag Manager container |
| **Google Search Console verification** | **EXTERNAL** | Property already configured in GSC; no `google-site-verification` meta in repo (DNS/HTML verification likely used) |
| **Plausible** | **ABSENT** | Not in dependencies or layout |
| **PostHog** | **ABSENT** | Not in dependencies or layout |
| **Vercel Analytics** | **ABSENT** | Not in dependencies or layout |
| **Microsoft Clarity** | **ABSENT** | Not in dependencies or layout |
| **Consent / cookie banner** | **ABSENT** | Privacy policy mentions cookies/analytics (`lib/legal/content.ts`) but no CMP or consent UI |
| **Admin analytics** | **INTERNAL** | `/admin/analytics` — Supabase-backed product metrics, not GA4 |
| **Google Safe Browsing** | **OPTIONAL API** | `GOOGLE_SAFE_BROWSING_API_KEY` for scan feature only — not web analytics |

## Decision

| Item | Action |
|------|--------|
| GA4 | **BLOCKED_PENDING_MEASUREMENT_ID** — human must provide `G-XXXXXXXXXX`; do not add placeholder scripts without consent architecture |
| GTM | **DEFER** — absent; add only with human-approved measurement plan |
| Duplicate tracking | **N/A** — nothing to duplicate |

## GA4 prerequisites before implementation

1. Existing GA4 property + measurement ID (human creates in Google Analytics)
2. Consent management platform or equivalent (UK/EU requirement) — currently **CONSENT_IMPLEMENTATION_REQUIRED**
3. Privacy policy update review if analytics added
4. Separate approved phase (not 129C) for production install

## Consent status

**CONSENT_IMPLEMENTATION_REQUIRED**

- Privacy policy describes analytics in general terms
- No cookie banner, no consent state, no analytics storage gating
- **Do not silently load full analytics tracking**

## Recommended next step (129D or dedicated phase)

1. Human selects CMP approach (e.g. cookie banner with opt-in for UK/EU)
2. Human provides GA4 measurement ID
3. Implement via `next/script` with consent gate — server/local only config, no secrets in client beyond public measurement ID
4. Event model: see `GA4-EVENT-MODEL.md`
