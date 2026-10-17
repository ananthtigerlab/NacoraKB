# APIs & Integrations

## What it is

Nacora exposes several API surfaces and consumes a handful of third-party services. This page catalogues every one — the REST v1 namespaces, the older v3 endpoints, the SOAP inbound endpoint that mimics the Kuehne+Nagel Salog ShipmentWebService, the outbound webhooks, and every third-party API the platform calls.

## Who uses it & where

- **Frontend engineers** integrating with the REST layer.
- **Integration partners** (Kuehne+Nagel operational systems) hitting the SOAP endpoint.
- **DevOps** provisioning environments — needs to know which env vars govern which integration.
- **Support / SRE** debugging an integration outage — this page is the reference sheet.

## How it works

### REST API layers

The platform exposes two REST layers:

- **`/api/v1/**` — Nacora-specific endpoints.** Mounted from `src/clients/nacora/urls.py`. Every Nacora endpoint lives here.
- **`/api/v3/**` — Shared platform endpoints.** Older layer with generic CRUD, plus the Exporter framework.

Both layers use DRF ViewSets, `DefaultRouter` for URL registration, camelCase JSON via `JSON_UNDERSCOREIZE`, and share the three-tier permission model (see Security & Permissions).

### `/api/v1/**` — Nacora namespaces

| Prefix | Purpose | Responsible service class |
|---|---|---|
| `/api/v1/business-partners/` | BP CRUD, attributes, addresses, role attachment | `partners.services.*` |
| `/api/v1/rating/` | Rating catalogue, special rate requests, bulk re-rating | `ratings.services.*`, `clients.nacora.ratings.services.ShipmentRatingResponseService` |
| `/api/v1/policies/` | Policy + PolicyVersion + PolicyVersionItem CRUD, clause attach/detach | `clients.nacora.policies.services.*` |
| `/api/v1/policies/shipment-items/` | Shipment (PolicyVersionItem) CRUD + booking + cancel | `clients.nacora.policies.services.*` |
| `/api/v1/commodities/` | Commodity classification (AWS Bedrock) | `clients.nacora.commodity_classification.services.CommodityClassificationService` |
| `/api/v1/mails/` | Email queue read + resend | `mails.services.*` |
| `/api/v1/documents/` | Certificate/quote PDF generation, live preview | `clients.nacora.documents.services.DocumentGenerationService` |
| `/api/v1/audit_trail/` | Audit-trail search (read-only) | `audit_trail.*` |
| `/api/v1/i2go-rules/` | Business rule CRUD, activation, deactivation | `i2go_rules.services.*`, `clients.nacora.i2go_rules.services.RulesEvaluationService` |
| `/api/v1/third-parties/` | External-service status + dry-run endpoints (GeoRisk, sanctions screen) | `clients.nacora.cargo_sanctions.services.*` |
| `/api/v1/clauses/` | Clause CRUD + attachment | `clients.nacora.clauses.services.*` |
| `/api/v1/bulk-upload/` | Excel bulk shipment upload | `clients.nacora.bulk_upload.handler.NacoraBulkUploadHandler` |
| `/api/v1/soap/` | Salog SOAP inbound (see below) | `clients.nacora.api.v1.soap.handlers.*` |
| `/api/v1/admin/` | Admin-only endpoints (setup, health) | `clients.nacora.admin_ui.*` |
| `/api/v1/nacora-claims/` | FNOL / claims (basic MVP; full claims post-MVP) | `clients.nacora.claims.services.*` |
| `/webhooks/**` | Outbound webhooks (see below) + inbound GeoRisk enrichment | `webhooks.*` |

### REST conventions

- **HTTP verbs** map to standard DRF actions — `GET /resource/` = list, `POST /resource/` = create, `GET /resource/{id}/` = retrieve, `PATCH /resource/{id}/` = partial update, `DELETE /resource/{id}/` = soft delete.
- **Filtering** via query params (django-filter). Common shape: `?status=BOOKED&broker_company=<uuid>&created_after=2026-01-01`.
- **Pagination** default is DRF's `PageNumberPagination` with `page_size=50` (configurable per view).
- **Auth** is Session cookie or bearer token (`Authorization: Bearer <token>`) or DRF Token (`Authorization: Token <token>`).
- **CSRF** applies to session-authenticated writes; token-authenticated writes are exempt.
- **Errors** return DRF-standard `{ detail: "...", ... }` with HTTP 4xx/5xx.
- **Naming** — JSON keys are camelCase on the wire; ORM models are snake_case. Django auto-translates via `djangorestframework-camel-case`.

### `/api/v3/**` — Shared platform endpoints

Older namespace kept for cross-client CRUD and the Exporter framework. Notable v3 endpoints Nacora uses:

- `/api/v3/exporter/*` — kicks off async exports (billing reports, shipment exports, special-rate exports). See Bulk Upload & Exporter.
- `/api/v3/policy-service/*` — legacy policy CRUD (superseded by v1 for new work).
- `/api/v3/audit-events/*` — direct DynamoDB audit-trail read (paginated).

### SOAP inbound — the Salog service (`/api/v1/soap/shipment-web-service`)

Mimics the legacy Kuehne+Nagel Salog ShipmentWebService so K+N operational systems can book cargo insurance programmatically.

**Status:** MVP 2nd phase — implemented and enabled, but the KN system upgrade to hit it goes live in a later phase.

**Auth.** WS-Security UsernameToken (digest or plaintext). Credentials from `SOAP_WS_USERS` in settings:

```
SOAP_WS_USERS = {
  'ws_salog': {
    'password': '<vault-managed>',
    'service_partner_uuid': '<BP UUID>',
    'default_agent_uuid': '<BP UUID>',
  },
}
```

**Operations:**

| Operation | Purpose | Idempotency |
|---|---|---|
| `BookShipment` | Create/book a shipment (`PolicyVersionItem`) | Message ID cache (DynamoDB `nacora_soap_inbound`, 90-day TTL) |
| `VerifyCoverage` | Dry-run — check if a commodity/route is coverable | Stateless |
| `GetCertificate` | Download the PDF certificate, streamed as base64 in chunks | Stateless (GET) |
| `ChangeShipment` | Modify a booked shipment | Message ID cache |
| `CancelShipment` | Cancel a booked shipment | Message ID cache |
| `QueryShipment` | Look up status by certificate number | Stateless |

**Behaviour:**

- **Code translation.** External Salog codes are mapped to internal Nacora `Choices.key` via `SOAP_SALOG_CODE_MAP` before the rating engine sees them. For example, `FS` → `Sea`, `FA` → `Air`, numeric commodity codes → Nacora commodity groups. Unknown codes fail with a specific SOAP fault (`COMMODITY_NOT_MAPPED`, `COVERAGE_NOT_MAPPED`, `POLICY_NOT_FOUND`).
- **Policy lookup.** Controlled by `SOAP_POLICY_LOOKUP_FIELD` — either `external_policy_number` (default: Salog side code) or `number` (internal `MC-XXXXXX`).
- **Idempotency.** Each SOAP envelope carries `<MessageControl><MessageID>`. The response is cached to DynamoDB; a replay of the same message ID returns the cached response.
- **Zero-premium rejection.** If the rating engine returns $0 premium after all overrides, the shipment is rejected with a SOAP fault — silent zero-premium bookings are not permitted.
- **Chunked certificate delivery.** `GetCertificate` streams the PDF as base64 in `SOAP_CERTIFICATE_CHUNK_BYTES = 65536` chunks. If the PDF hasn't rendered yet, the response is a `CERTIFICATE_NOT_READY` fault with a `Retry-After` hint (`SOAP_CERTIFICATE_RETRY_AFTER_SECONDS = 30`).
- **Dry-run.** `?dryRun=1` on the URL, or `<DryRun>true</DryRun>` in the envelope, runs the full validation path but rolls back the transaction — used during onboarding. Controlled by `SOAP_DRY_RUN_ALLOWED = True`.
- **Request-size limit.** `SOAP_MAX_REQUEST_BYTES = 2 * 1024 * 1024` (2 MiB) — over-sized requests return HTTP 413.
- **Status back to Salog.** Nacora maps its internal statuses onto Salog codes via `SOAP_STATUS_MAP['to_salog']` — QUOTED→QUO, REFERRED→REF, BOOKED→BOK, DECLINED→REJ, CANCELLED→CAN.

**Kill switch.** `SOAP_INBOUND_ENABLED = True` toggles the whole endpoint; set false to return a SOAP fault immediately (used in dev and during controlled outages).

### Outbound webhooks

Configured under `WEBHOOK_URLS` and dispatched via `webhooks.services.WebhookAction`. Each webhook has a Celery task, three retries with exponential backoff, and lands in the dead-letter path (Sentry) on final failure.

| Event | Endpoint | Purpose |
|---|---|---|
| `PolicyVersionItem` created / booked | GeoRisk (`GEORISK_BASE_URL/t/{tenant}/api/v1/shipments/`) | Geographic risk enrichment (score, sanctions cross-check, hazmat) |
| `policy.activated` / `.endorsed` / `.cancelled` | BMS webhook (`BMS_WEBHOOK_URL`) | Sister broker/billing system sync (`BmsPolicySyncSerializer`) |
| `bordereau.created` | BMS or data warehouse | Slip → billing reconciliation |

Retries are three attempts, exponential backoff (2^n seconds with jitter). GeoRisk parties (shipper, consignee) are cached in Redis for 24 hours (`GEORISK_PARTY_CACHE_SECONDS`) to avoid repeated calls for the same named assured.

### Third-party APIs consumed

| Service | Purpose | Module | Key env / settings | Feature flag |
|---|---|---|---|---|
| **CurrencyAPI.com** | Daily USD-crossed FX rates | `submodules/currencies/` | `CURRENCY_API_KEY`, `EXCHANGE_RATE_API_PROVIDER=CurrencyAPI.com` | — (daily cron) |
| **AWS Bedrock (Claude)** | Commodity classification LLM | `src/clients/nacora/commodities/` | `BEDROCK_MODEL_ID`, `AWS_REGION_NAME`, `COMMODITY_RERANK_KEYWORDS` | Silent fallback if unavailable |
| **AWS Comprehend** | Entity extraction on cargo description | `src/clients/nacora/cargo_sanctions/` | `CARGO_SANCTION_SETTINGS['MAX_ENTITIES']`, `['MIN_CONFIDENCE_*']`, `['LANGUAGE_CODE']` | `CARGO_SANCTION_SETTINGS['ENABLED']` |
| **SanctionScanner** | Fuzzy match extracted entities against global sanctions lists | `src/clients/nacora/cargo_sanctions/` | `SANCTION_SCANNER_SEARCH_PROFILE_KEY`, `['VENDOR_MIN_MATCH_RATE']`, `['VENDOR_MAX_MATCH_RATE']` | `CARGO_SANCTION_SETTINGS['ENABLED']` |
| **Local OFAC SDN CSV** | Offline fallback for sanctions | `src/clients/nacora/cargo_sanctions/data/sdn.csv` | `CARGO_SANCTION_SETTINGS['SDN_FUZZY_ENABLED']`, `['SDN_FUZZY_THRESHOLD']` | Same flag |
| **KN PDM API** | Cost-centre + org-unit lookup at SSO time | `src/clients/nacora/auths/` | `NACORA_PDM_TOKEN_URL`, `NACORA_PDM_API_URL`, `NACORA_PDM_CLIENT_ID/SECRET`, `NACORA_PDM_REQUEST_TIMEOUT` (10s) | `NACORA_PDM_SIMULATION_ENABLED` (dev-only canned data) |
| **GeoRisk** | Post-booking enrichment via outbound webhook | `src/clients/nacora/webhooks/` | `GEORISK_BASE_URL`, `GEORISK_TENANT_SLUG`, `GEORISK_API_TOKEN`, `GEORISK_REQUEST_TIMEOUT_SECONDS`, `GEORISK_PARTY_CACHE_SECONDS` (86400) | `NACORA_GEORISK_WEBHOOK_ENABLED` |
| **Google Maps API** | Address autocomplete (blueprint; not wired for Nacora yet) | `src/core/` | `GOOGLE_MAPS_API_KEY` | Frontend-side flag |
| **Vessel Finder API** | IMO lookup — vessel name/flag/year/type/H-value for sea freight | `src/clients/nacora/thirdapis/` | `VESSEL_FINDER_API_KEY` | Dormant (MVP is road only) |
| **Amazon SES** (via anymail + post-office) | Transactional email queue | `src/mails/` | `POST_OFFICE['BACKENDS']['default']='anymail.backends.amazon_ses.EmailBackend'`, AWS creds | — |
| **AWS S3** | Attachment storage, analytics event landing | `insurance.storage_backends.PrivateStorage` | `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_REGION_NAME`, IAM role | — |
| **AWS Athena** | Analytics warehouse queries (over S3 event stream) | `src/analytics/` | `ATHENA_DATABASE`, `ATHENA_S3_OUTPUT_LOCATION` | — |
| **AWS DynamoDB** | Append-only audit trail store | `src/audit_trail/` | AWS region (`eu-central-1`), table `audit_events`, TTL attribute `expires_at` | `AUDIT_TRAIL_ENABLED` |
| **Sentry** | Error tracking + performance monitoring | Root settings | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | — |
| **RabbitMQ** | Celery broker (durable queues, three fixed queues) | Celery config | `CELERY_BROKER_URL=amqp://...` | — |
| **Redis** | Cache + session store + short-TTL lookups (PDM token, GeoRisk parties) | Django cache | `REDIS_URL=redis://...` | — |

### Integration failure modes (planned, in-code)

- **CurrencyAPI down** — daily sync task retries; missing rate → `pricing_breakdown.premiums.after_conversion` fields stored as `null` (never a silent 1:1 fallback). Analytics excludes null-rate rows.
- **Bedrock timeout** — commodity classification returns an empty suggestion list. Manual dropdown still works. No toast.
- **Comprehend / SanctionScanner unavailable** — sanctions screening falls back to the local OFAC SDN CSV. If the whole feature is disabled (`CARGO_SANCTION_SETTINGS['ENABLED']=False`), the pipeline skips screening entirely; a dry-run endpoint (`/api/v1/third-parties/sanctions/screen-cargo-text/`) always runs regardless of the flag.
- **KN PDM timeout** — 10-second timeout, then falls back to a static JSON mapping (`sso_partner_mappers.json`). If both miss, user lands in pending-approval queue.
- **GeoRisk webhook failure** — 3 retries with exponential backoff; final failure goes to Sentry with the shipment ID. Shipment is not affected in either direction; enrichment is a separate concern from booking.
- **SES bounce** — outbound mail is marked as bounced; retries are limited (per SES rules).

### Nacora-specific API implementation notes

- **Camel-case JSON.** Everything on the wire is camelCase (`policyVersionItem.pricingBreakdown.totalPremium`). Frontend and ORM never speak directly to each other — the DRF serializer sits between them and does the translation.
- **UUID URLs.** All resource URLs use UUIDs, not sequential integers. Predictable-ID enumeration is structurally prevented.
- **Filtering respects the queryset filter service.** A `PolicyVersionItem?broker_company=<uuid>` query returns only shipments the current user can see. Filters are additive to (not a replacement for) the queryset filter service.
- **Bulk endpoints are async.** Bulk re-rate, bulk export, and bulk upload return a job token and create a Report / Activity for status. See Background Jobs.
- **Read-only endpoints for audit trail.** No mutations against the audit trail from the API surface — writes come only from post-save signals.

## Business rules & constraints

- **Every API request runs inside a DB transaction** (`ATOMIC_REQUESTS = True`) — unhandled exceptions roll everything back.
- **Every list endpoint applies its queryset filter before returning** — a user cannot ask for arbitrary IDs and receive them.
- **SOAP endpoint rejects zero-premium bookings** — safe against silently miscooked catalogues.
- **Idempotency at the SOAP layer only.** REST endpoints are not idempotent for `POST` (client is expected to handle deduplication with request IDs).
- **Feature flags are mandatory for new integrations** — every new external call must land behind a `<NAME>_ENABLED` env-controlled flag.
- **Retries are the caller's job for outbound webhooks that fail more than 3 times** — no automatic replay from the dead-letter path. Ops must investigate and manually requeue.

## Related concepts

- Architecture Overview
- Security & Permissions
- Event Stream & Audit Trail
- Background Jobs & Celery
- Environments & Config
- Bulk Upload & Exporter
