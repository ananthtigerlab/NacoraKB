# Document Generation

## What it is

Every PDF the platform emits — quote, certificate of insurance, endorsement schedule, cancellation letter — is produced by **`DocumentGenerationService`** at `src/clients/nacora/documents/services.py`. The service resolves the correct `DynamicTemplate` version for a given `(target_type, doc_type, language)` tuple, renders it via Jinja2 into HTML, and hands the HTML to **weasyprint** to produce a PDF. QR codes (for certificate verification links) are embedded via **segno**.

The public entry points are `/api/v1/documents/generate/`, `/api/v1/documents/preview/` (live preview for authors), and the SOAP `GetCertificate` operation.

## Who owns it or touches it

- **Backend engineers** own the service, weasyprint integration, and QR embedding.
- **BAs** and **marketing / legal** author template content — they edit `DynamicTemplateVersion` rows via the back-office UI or fixture files.
- **Underwriters** rely on rendered certificates for evidence of cover.
- **QA** validates PDFs against a golden-PDF fixture set (byte-diff excluding timestamps and QR payload).

## How it works

### Template resolution

`DocumentGenerationService.resolve_template(target, doc_type, language)`:

1. Look up the active `DynamicTemplate` matching `content_type = <target type>` and `object_id = <target id>` (for target-scoped templates) or `content_type` alone (for type-scoped templates).
2. Fetch the `DynamicTemplateVersion` with `status='ACTIVE'`, most recent `effective_date <= today`. If none, fall back to the platform default under `src/submodules/documents/templates/`.
3. Prefer the `language`-tagged version. If Nacora uses `correspondence_language = 'de'` on the policyholder BP, the German version wins. Otherwise fall back to English.
4. Return the resolved version's Jinja2 source.

Template versioning is important: editing a live template creates a new `DynamicTemplateVersion` (DRAFT → ACTIVE via approval), and previously-rendered PDFs are not re-rendered — they remain bound to the version they were rendered against. The audit trail records `document_generation.version_used`.

### Rendering pipeline

1. **Context assembly.** The service pulls a rich context from the target — for a certificate, that's the `PolicyVersionItem` + parent `PolicyVersion` + `Policy` + `BusinessPartner` chain, `attributes`, `details`, `pricing_breakdown`, `clauses` via `ClauseObjectRelation`, and a signed verification URL.
2. **Jinja2 render.** Template variables are resolved (`{{ policyholder.name }}`, `{{ shipment.pricing_breakdown.total_premium.billing.amount }}`, clause loops, conditional blocks).
3. **QR embedding.** If the template includes `{{ qr_code_url }}` or `{% qrcode … %}`, `segno` produces an SVG payload embedded inline. The QR payload is the shipment's certificate verification URL (signed with a short-TTL token).
4. **weasyprint conversion.** HTML → PDF. Fonts are loaded from `src/clients/nacora/static/fonts/`, CSS from `src/clients/nacora/static/pdf/`. weasyprint's `presentational_hints=True` is enabled for legacy inline attributes.
5. **PDF metadata.** The service stamps PDF metadata: `Title`, `Author = 'Nacora'`, `Subject = certificate number`, `CreationDate = now`.
6. **Return bytes.** `render(target, doc_type, language)` returns bytes; the caller decides whether to stream (SOAP `GetCertificate`) or attach (`AttachmentFolder → Attachment`).

### Live preview endpoint

`/api/v1/documents/preview/` accepts a `DynamicTemplateVersion` UUID plus a target ID and returns an HTML preview (not a PDF) so template authors can iterate without waiting for weasyprint. The preview:

- Uses the DRAFT template version (not just ACTIVE).
- Renders inline in the back-office UI.
- Runs the same Jinja2 pipeline but stops before weasyprint.
- Includes a "Rendered PDF" button that flips to the full PDF for a final visual check.

### Quote vs Certificate flows

**Quote PDF:**

- Triggered on `POST /api/v1/policies/shipment-items/{id}/quote-pdf/` or when the frontend displays "Download Quote".
- Uses `doc_type='QUOTE'`, resolves the quote-scoped template.
- Content: coverage summary, pricing breakdown, valid-until date (`SHIPMENT_QUOTE_EXPIRY_DAYS = 30`).
- Not attached to the shipment by default — served as a fresh render each time (so pricing reflects the current SRR/rule state).

**Certificate PDF:**

- Triggered on shipment booking (status → `BOOKED`).
- Uses `doc_type='CERTIFICATE'`, resolves the certificate-scoped template.
- If `POLICY_AUTOMATED_PDF_CREATION = True`, the certificate is rendered by a queued Celery task and attached to the shipment via `Attachment` under an `AttachmentFolder` named `Certificates`.
- If `POLICY_AUTOMATED_PDF_CREATION = False`, the certificate is rendered lazily on first download.
- Contains the QR code linking to `/verify/<signed-token>/` for third-party verification.
- SOAP `GetCertificate` streams the same PDF in base64 chunks of `SOAP_CERTIFICATE_CHUNK_BYTES = 65536`.

**Cancellation and endorsement documents** follow the same pattern — different `doc_type`, different template.

### Conveyance-specific certificate wording (CGDEV-81)

Each conveyance can now choose how it appears on the certificate. The conveyance choice carries two configuration attributes:

- **certificate_display** — one of three modes:
  - "Conveyance only" — prints the conveyance name as before (the default for backward compatibility).
  - "Vessel Name only" — prints the vessel name instead of the conveyance. Only valid for sea-related conveyances.
  - "Custom Display Name + Vessel Name" — prints a custom label followed by the vessel name. Only valid for sea-related conveyances.
- **certificate_label** — the custom label text, used when the display mode is "label and vessel".

A shipment without a conveyance, or a conveyance with no display configuration, falls back to the original behaviour. Rating and quotation are unaffected — they continue to use the conveyance key. Only the certificate rendering reads the display configuration.

Administrators configure these attributes in the Conveyance choice setup in the back office.

### Multi-language handling

- Every `DynamicTemplateVersion` carries a `language` tag (ISO 639-1: `en`, `de`, `fr`).
- `correspondence_language` on the policyholder BP is the primary preference.
- Fallback is English if the exact language version is missing.
- Currency formatting and date formatting are locale-aware via `Babel` inside the Jinja filters (`{{ amount | format_currency('EUR', 'de_DE') }}`).

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `POLICY_AUTOMATED_PDF_CREATION` | Enable async certificate rendering on booking |
| `SHIPMENT_QUOTE_EXPIRY_DAYS` | Days before a quote PDF is stamped "expired" |
| `SOAP_CERTIFICATE_CHUNK_BYTES` | `65536` — chunk size for SOAP `GetCertificate` streaming |
| `SOAP_CERTIFICATE_RETRY_AFTER_SECONDS` | `30` — hint returned on `CERTIFICATE_NOT_READY` |
| `DYNAMIC_TEMPLATE_DEFAULT_LANGUAGE` | Fallback language (`en`) |
| `WEASYPRINT_URL_FETCHER_TIMEOUT` | HTTP timeout for external asset fetches (fonts, images) |
| `QR_CODE_VERIFICATION_URL_TTL_SECONDS` | Signed verification URL TTL |
| `DOCUMENT_GENERATION_TIMEOUT_SECONDS` | Hard timeout for one render |

Operational commands:

- `python src/manage.py rerender_certificate <shipment_id>` — force re-render for support tickets.
- `nacora.tasks.render_certificate_pdf` — queued task invoked on booking when automated PDF creation is enabled.

## Constraints, guarantees, and gotchas

- **Renders are bound to the template version at the time of rendering.** Editing a template does not retroactively change PDFs already emitted. If a legal wording change requires re-rendering, ops calls `rerender_certificate` explicitly per shipment.
- **weasyprint is CPU-intensive.** A big certificate with many clauses can take several seconds. Async rendering (`POLICY_AUTOMATED_PDF_CREATION`) exists precisely to keep the booking response fast.
- **`CERTIFICATE_NOT_READY` fault on SOAP.** If SOAP `GetCertificate` is called before the async render finishes, the response is a fault with `Retry-After: 30` — Salog callers retry after 30 s.
- **QR payloads are signed and short-TTL.** A leaked verification URL expires per `QR_CODE_VERIFICATION_URL_TTL_SECONDS`; a longer window means longer exposure of the verification endpoint.
- **Font files must be bundled in the image.** External web-font URLs at render time will hit `WEASYPRINT_URL_FETCHER_TIMEOUT` and slow every render. Keep fonts under `static/fonts/`.
- **Preview uses DRAFT versions; production uses ACTIVE.** A change that looks fine in preview will not render for real users until it's promoted to ACTIVE with a valid `effective_date`.
- **Byte-for-byte diffs are unreliable across weasyprint versions.** The QA harness uses PDF-text extraction + structural asserts, not pixel-perfect byte diffs.
- **Certificates are attachments — access control applies.** Downloading a certificate PDF is a normal attachment fetch through `PrivateStorage` with signed URLs; queryset filters apply.

## Related concepts

- Data Model & Entities
- SOAP Inbound
- Storage & Attachments
- Rating Engine
- Choices, Lookups & Code Maps
- Mail & Notifications
