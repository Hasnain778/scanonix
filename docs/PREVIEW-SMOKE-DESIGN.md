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

Background Remover has been removed from the product and is no longer part of preview smoke.