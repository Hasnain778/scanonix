# GA4 Event Model (Deferred)

**Status:** DEFERRED until GA4 property exists and consent architecture is implemented.

See `ANALYTICS-DECISION.md` — do not install GA4 in production until `CONSENT_IMPLEMENTATION_REQUIRED` is resolved.

## Design principles

- Privacy-first: no document content, filenames, or PII in events
- Consent-gated loading in UK/EU
- Complement Search Console (search visibility) with on-site behavior

## Suggested events

| Event | When | Parameters |
|-------|------|------------|
| `tool_view` | Tool page load | `tool_slug`, `tool_category`, `source_surface` |
| `tool_start` | User begins processing | `tool_slug`, `tool_category`, `processing_type` |
| `tool_success` | Successful completion | `tool_slug`, `tool_category`, `processing_type` |
| `tool_error` | Processing error | `tool_slug`, `error_code`, `processing_type` |
| `tool_download` | Output downloaded | `tool_slug`, `tool_category` |
| `find_tool_open` | Tool finder opened | `source_surface` |
| `find_tool_search` | Tool finder search | `query_length` (not raw query text if avoidable) |
| `pricing_view` | Pricing page view | — |
| `pro_cta_click` | Pro CTA clicked | `source_surface`, `tier` |

## Parameters (allowed)

- `tool_slug`, `tool_category`, `tier`, `processing_type`, `error_code`, `source_surface`

## Never transmit

- Filename, PDF/image contents, OCR text, user document text
- Password, email, auth token, document title, form contents, file bytes

## Conversion funnel (with Search Console)

```text
GSC impression → GSC click → tool_view → tool_start → tool_success → tool_download → pro_cta_click
```

Search Console and GA4 remain separate systems — no user-level joining.
