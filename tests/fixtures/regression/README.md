# Regression test fixtures

Permanent, synthetic fixtures for automated regression tests. **No personal information.**

| File | Source / generation |
|------|---------------------|
| `single-page-a.pdf` | pdf-lib — one page labeled "MERGE A" |
| `single-page-b.pdf` | pdf-lib — one page labeled "MERGE B" |
| `two-page.pdf` | pdf-lib — two pages "PAGE 1" / "PAGE 2" |
| `fillable-form.pdf` | pdf-lib AcroForm (text + checkbox fields; same pattern as `scripts/verify-fill-pdf-export.ts`) |
| `sample.jpg` | sharp synthetic 320×200 blue JPEG |
| `sample.png` | sharp synthetic 200×200 RGBA PNG |
| `sample.webp` | sharp WebP encode of `sample.png` |
| `sample.heic` | sharp HEIF/HEVC encode of `sample.png` on Linux CI; fallback: Nokia HEIF conformance `C002.heic` (no personal data) |
| `ocr-test.png` | sharp-rendered SVG with exact text `SCANONIX OCR TEST 12345` |
| `qr-test.png` | `npx qrcode` PNG encoding payload `SCANONIX-QR-REGRESSION` |
| `bg-remover-subject.jpg` | sharp-rendered SVG person silhouette on white background |

Regenerate (safe, overwrites):

```bash
npm run verify:regression:fixtures
```

Verify presence only:

```bash
node scripts/regression/generate-fixtures.mjs --verify
```
