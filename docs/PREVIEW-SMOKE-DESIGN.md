# Preview deployment smoke — design notes (Phase 130I-4)

Automatic preview URL discovery is **not implemented** in this phase to avoid credential invention.

## Recommended next step

Add `.github/workflows/preview-smoke.yml`:

```yaml
on:
  deployment_status:
    types: [success]

jobs:
  preview-smoke:
    if: github.event.deployment_status.environment == 'Preview'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - run: node scripts/regression/generate-fixtures.mjs --verify
      - run: npm run verify:regression:server-local
        env:
          REGRESSION_BASE_URL: ${{ github.event.deployment_status.target_url }}
      - run: npm run verify:regression:client-e2e
        env:
          REGRESSION_BASE_URL: ${{ github.event.deployment_status.target_url }}
```

## Manual preview smoke (safe now)

```bash
export REGRESSION_BASE_URL="https://your-preview.vercel.app"
npm run verify:regression:server-local
npm run verify:regression:client-e2e
```

## Background Remover on preview

Only when Vercel Preview environment includes `REMBG_SERVICE_URL` (and related secrets):

```bash
RUN_EXTERNAL_SMOKE=1 REGRESSION_BASE_URL="https://..." npm run verify:regression:server-local
```

Distinguish `422 no_subject` (fixture) from `503 NOT_CONFIGURED` (infra).
