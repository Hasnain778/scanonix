# Scanonix Release Gate — Phase 130I-4

Permanent regression protection and release policy. **Local/CI only** — no production env changes.

## Architecture

| Layer | Tooling | Purpose |
|-------|---------|---------|
| Static / unit | ~98 existing `scripts/verify-*` | Source-level contracts, analytics, SEO, quota |
| Core processing | `verify:core-processing` | Sharp/PDF structural ops offline |
| Sharp Linux | `verify:sharp-production` | NFT traces + libvips `.so` after build |
| Client E2E | **Puppeteer** (existing dep) | 21 anonymous client tools — validates output bytes |
| Server integration | `fetch` multipart | Compress + resize against local `next start` |
| CI | `.github/workflows/release-gate.yml` | ubuntu-latest PR + main gate |
| Orchestration | `scripts/verify-release.mjs` | FAST / FULL / EXTERNAL tiers |

No second browser framework. No Playwright.

## Commands

```bash
# Fast static gate (no build)
npm run verify:release:fast

# Full pre-release (build once + E2E against local server)
START_LOCAL_SERVER=1 npm run verify:release

# Production smoke (network; safe read-only + compress/resize)
npm run smoke:production

# Optional BG remover on production (single call)
RUN_EXTERNAL_SMOKE=1 npm run smoke:production

# Regenerate fixtures
npm run verify:regression:fixtures
```

## Fixtures

Permanent synthetic files under `tests/fixtures/regression/`. See `tests/fixtures/regression/README.md`.

## BLOCK RELEASE if

- `npm run build` fails
- `npm run lint` or `npm run typecheck` fails
- `verify:core-processing` fails
- `verify:sharp-production` fails (missing `@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64`, or `libvips-cpp.so.8.18.3` in compress/resize/bg-remover NFT traces)
- `verify:bg-remover-quota` fails (client + server double consumption)
- `verify:analytics-130e-subscription-complete` fails
- Any client E2E critical test fails (21 tools)
- Server compress/resize integration fails on CI
- Preview critical smoke fails (when enabled)

## POST-DEPLOY ROLLBACK if

- Image Compressor returns non-200 for valid fixture POST
- Image Resizer returns non-200 for valid fixture POST
- Background Remover critical smoke fails due to **infrastructure** (503, 500, timeout)
- Critical PDF/client operation broken in production smoke
- Widespread HTTP 500 on `/`, `/tools`, `/pricing`

**Not** rollback triggers:

- Background Remover `422` / `no_subject` on unsuitable fixture (user-input rejection)
- Anonymous 401 console noise on client tools
- Pro-gated tools (redact-pdf) for anonymous users

## Preview deployment smoke (design)

Vercel Preview URLs are per-PR and require explicit URL discovery:

1. **GitHub Actions `deployment_status` event** — on Vercel preview `success`, run workflow with `PREVIEW_URL` from deployment payload.
2. **Safe checks:** `GET /`, `/tools`, `/pricing`, `/tools/image-compressor`, `/tools/image-resizer`, `/tools/merge-pdf`.
3. **Processing:** POST compress/resize against preview origin (no secrets).
4. **Background Remover:** only when `RUN_EXTERNAL_SMOKE=1` **and** preview env has `REMBG_SERVICE_URL` configured in Vercel preview env group.
5. **Do not** invent credentials or auto-merge preview env secrets into CI.

Until `deployment_status` wiring exists, preview smoke is **documented only** — run manually:

```bash
REGRESSION_BASE_URL=https://<preview>.vercel.app START_LOCAL_SERVER=0 npm run verify:regression:server-local
REGRESSION_BASE_URL=https://<preview>.vercel.app npm run verify:regression:client-e2e
```

## Production smoke strategy

`scripts/smoke/production-smoke.mjs`:

- **Always:** HTTP GET `/`, `/tools`, `/pricing`, `/account`, `/robots.txt`, `/sitemap.xml`, `/favicon.ico`
- **Always:** one compress + one resize with `tests/fixtures/regression/sample.jpg`
- **Optional (`RUN_EXTERNAL_SMOKE=1`):** one background remover call with `bg-remover-subject.jpg`

Triggered manually via workflow_dispatch or post-deploy job — **not** on every PR.

## External-service limitations

| Service | CI default | Notes |
|---------|------------|-------|
| Background Remover worker | Skipped | `RUN_EXTERNAL_SMOKE=1` + secrets |
| Stripe | Never in CI | Existing verify scripts are static |
| Supabase auth quota delta live | Not in CI | `verify:bg-remover-quota` is static source check |
| HEIC encode | Linux CI | Windows may lack libheif; fixture committed from Linux |
| OCR (Tesseract.wasm) | Local E2E | Slow (~30–120s) but no external API |

## Coverage matrix

See final Phase 130I-4 report section M. Do not exaggerate — Pro/AI tools mostly static verification only.

## Deliberate failure proof

```bash
npm run verify:regression:deliberate-failures
```

Proves Sharp NFT wrong-marker and client assertion failures exit non-zero.

## Retained existing suites

Integrated into `verify:release:fast` / CI — not replaced:

- `verify:core-processing`
- `verify:sharp-production`
- `verify:background-remover-model-config`
- `verify:bg-remover-quota`
- `verify:analytics-130e-subscription-complete`
- `verify:seo-canonical-host`
- `verify:favicon` (optional — not in default gate to avoid Phase 130G coupling)
