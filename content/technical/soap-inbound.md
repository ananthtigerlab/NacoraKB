# SOAP Inbound

## What it is

The `/api/v1/soap/shipment-web-service` endpoint mimics the legacy Kuehne+Nagel Salog `ShipmentWebService` so K+N operational systems can book, verify, change, cancel, and query cargo insurance shipments programmatically. The handler lives under `src/clients/nacora/api/v1/soap/`.

This is the Technical view — service internals, code-map interaction, idempotency, chunked delivery, faults. The APIs page has the operation catalogue and public contract; this page is for engineers working on the SOAP surface itself.

**Status.** MVP 2nd-phase — implemented and enabled behind `SOAP_INBOUND_ENABLED`. The KN system upgrade to hit this endpoint goes live in a later delivery.

## Who owns it or touches it

- **Backend engineers** on the integration team own the handlers and their tests.
- **KN Salog integrators** on the K+N side are the sole consumers.
- **SREs** monitor throughput, DynamoDB dedup writes, and `CERTIFICATE_NOT_READY` fault rates.
- **Compliance** audits every `BookShipment` for zero-premium rejection and code-map completeness.

## How it works

### Endpoint

`POST /api/v1/soap/shipment-web-service` — accepts a SOAP envelope, returns a SOAP envelope. Content-Type: `text/xml; charset=utf-8` or `application/soap+xml`.

Only one endpoint URL; multiple operations dispatched via the SOAP `Action` header or the envelope body's top-level element.

### WS-Security UsernameToken auth

Every inbound envelope carries a `<Security><UsernameToken>` header. Two modes supported:

- **Plaintext password** (over TLS).
- **Password digest** — `Base64( SHA1( nonce + created + password ) )`.

Credentials live in `SOAP_WS_USERS`:

```
SOAP_WS_USERS = {
  'ws_salog': {
    'password':             '<vault-managed>',
    'service_partner_uuid': '<BP UUID>',            # the K+N service partner BP
    'default_agent_uuid':   '<BP UUID>',            # default agent when the envelope doesn't specify one
  },
}
```

The handler resolves the caller by username, verifies the password (or digest + nonce + created), and attaches the resolved `service_partner_uuid` to the request context. Requests with an unknown username or a bad password return a SOAP `<faultcode>ns:Security</faultcode>` fault.

**Nonce replay guard.** Nonces are cached in Redis for 5 minutes; a nonce seen twice within the window is rejected. This blocks trivial replay of a captured digest envelope.

### Operations

| Operation | Purpose | Idempotency |
|---|---|---|
| `BookShipment` | Create/book a shipment (`PolicyVersionItem`) | Dedup on MessageID → DynamoDB `nacora_soap_inbound` (90-day TTL) |
| `VerifyCoverage` | Dry-run coverage check for a commodity/route | Stateless |
| `GetCertificate` | Download the PDF certificate, streamed as base64 chunks | Stateless read |
| `ChangeShipment` | Modify a booked shipment | Dedup on MessageID |
| `CancelShipment` | Cancel a booked shipment | Dedup on MessageID |
| `QueryShipment` | Look up status by certificate number | Stateless |

### Idempotency (DynamoDB `nacora_soap_inbound`)

Every write envelope carries `<MessageControl><MessageID>`. The handler:

1. On first arrival, writes `(message_id, request_hash, initial_response=null)` to the dedup table with a 90-day TTL.
2. Processes the request.
3. On success, updates the row with the response bytes.
4. On replay: if the row exists and the response is populated, return the cached response. If the row exists but no response yet (mid-processing), return a `PROCESSING` fault with `Retry-After`.

**Table schema:** `message_id` (partition key), `request_hash`, `response`, `status` (`PROCESSING` / `SUCCESS` / `FAULTED`), `expires_at` (TTL). The 90-day window matches the K+N replay policy.

### Code translation

Salog uses short codes (`FS`, `FA`, `A`, `B`); the platform uses Nacora `Choices.key` (`sea`, `air`, `icc_a`). Translation happens via **`BiDirectionalLookupService`** and the `SOAP_SALOG_CODE_MAP` fallback (see Choices, Lookups & Code Maps).

Every inbound field goes `Salog code → internal key`; the response uses `internal key → Salog code`. Unknown codes fail with specific faults:

- `COMMODITY_NOT_MAPPED`
- `COVERAGE_NOT_MAPPED`
- `CONVEYANCE_NOT_MAPPED`
- `POLICY_NOT_FOUND`

No silent fallback to "unknown" — an unmapped code is a data-quality issue and must be caught.

### Policy lookup

Controlled by `SOAP_POLICY_LOOKUP_FIELD`:

- `external_policy_number` (default) — Salog side code (e.g. `SL-000001`).
- `number` — internal `MC-XXXXXX` format.

The handler queries `Policy.objects.filter(<field>=<value>, is_active=True).first()`; missing → `POLICY_NOT_FOUND` fault.

### Chunked certificate delivery

`GetCertificate` streams the PDF as base64 in chunks. Settings:

- `SOAP_CERTIFICATE_CHUNK_BYTES = 65536` — chunk size in bytes.
- `SOAP_CERTIFICATE_RETRY_AFTER_SECONDS = 30` — hint returned on `CERTIFICATE_NOT_READY`.

The response envelope contains:

```
<GetCertificateResponse>
  <CertificateNumber>MC-000123-000001</CertificateNumber>
  <TotalChunks>3</TotalChunks>
  <ChunkIndex>0</ChunkIndex>
  <ChunkData>...base64...</ChunkData>
</GetCertificateResponse>
```

The Salog caller iterates `ChunkIndex` from 0 to `TotalChunks-1` (via multiple SOAP calls) to reassemble the PDF. Chunks are content-hashed to guarantee integrity.

If the certificate has not been rendered yet (async render still queued), the response is a `CERTIFICATE_NOT_READY` fault with `Retry-After: 30` — the caller retries after 30 seconds.

### Request-size limit

`SOAP_MAX_REQUEST_BYTES = 2 * 1024 * 1024` (2 MiB). Larger requests return HTTP 413 before the handler runs. This bounds memory usage per request.

### Dry-run

`SOAP_DRY_RUN_ALLOWED = True` permits `?dryRun=1` on the URL or `<DryRun>true</DryRun>` in the envelope:

- Runs the full validation, code translation, rating, and rules evaluation.
- Rolls back the transaction on completion — no `PolicyVersionItem` persists, no side effects fire.
- Returns the same response shape as a real book, with a `<DryRun>true</DryRun>` marker.

Used during onboarding to verify the mapping is correct without polluting the DB.

**Prod hardening path:** flip `SOAP_DRY_RUN_ALLOWED = False` once the integration is stable, so dry-run cannot be used to probe pricing without an audit trail.

### Zero-premium rejection

After the rating engine produces `pricing_breakdown`, the handler checks `total_premium.billing.amount`. If it is zero (or missing), the response is a `ZERO_PREMIUM_REJECTED` fault. This blocks silent free bookings if the catalogue is misconfigured — an insurer never wants a $0 policy accidentally persisted.

### Status mapping

Internal Nacora statuses map to Salog codes via `SOAP_STATUS_MAP['to_salog']`:

| Nacora | Salog |
|---|---|
| `QUOTED` | `QUO` |
| `REFERRED` | `REF` |
| `BOOKED` | `BOK` |
| `DECLINED` | `REJ` |
| `CANCELLED` | `CAN` |
| `EXPIRED` | `EXP` |

The reverse map is used for `QueryShipment` filtering.

### Feature flag

`SOAP_INBOUND_ENABLED = True` — master toggle. False returns a specific SOAP fault (`SERVICE_DISABLED`) immediately. Used in dev environments where the SOAP surface isn't needed, and during controlled outages.

### Fault taxonomy

| Fault code | Meaning |
|---|---|
| `Security` | WS-Security auth failed |
| `NONCE_REPLAY` | Nonce already seen in the last 5 minutes |
| `POLICY_NOT_FOUND` | Policy lookup failed |
| `COMMODITY_NOT_MAPPED` / `COVERAGE_NOT_MAPPED` / `CONVEYANCE_NOT_MAPPED` | Code translation failed |
| `ZERO_PREMIUM_REJECTED` | Rating produced $0 |
| `RULES_DECLINED` | Business rule `DECLINE` action fired |
| `CERTIFICATE_NOT_READY` | Async render not done; retry after 30s |
| `PROCESSING` | Idempotency dedup match in-flight |
| `SERVICE_DISABLED` | `SOAP_INBOUND_ENABLED = False` |
| `REQUEST_TOO_LARGE` | Exceeded `SOAP_MAX_REQUEST_BYTES` |

Every fault includes a human-readable message; Salog logs them for support.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `SOAP_INBOUND_ENABLED` | Master kill switch |
| `SOAP_WS_USERS` | Credentials dict |
| `SOAP_WS_SALOG_PASSWORD` | Env var supplying the password into `SOAP_WS_USERS` at boot |
| `SOAP_SALOG_CODE_MAP` | Static code-map fallback (legacy) |
| `SOAP_POLICY_LOOKUP_FIELD` | `external_policy_number` or `number` |
| `SOAP_MAX_REQUEST_BYTES` | `2 * 1024 * 1024` (2 MiB) |
| `SOAP_DRY_RUN_ALLOWED` | Permit `?dryRun=1` |
| `SOAP_CERTIFICATE_CHUNK_BYTES` | `65536` |
| `SOAP_CERTIFICATE_RETRY_AFTER_SECONDS` | `30` |
| `SOAP_STATUS_MAP` | `to_salog` / `to_internal` status map |
| DynamoDB `nacora_soap_inbound` | Idempotency table (90-day TTL) |

Operational commands / URLs:

- `/api/v1/soap/shipment-web-service?wsdl` — WSDL description (if `SOAP_WSDL_ENABLED = True`).
- DynamoDB console → `nacora_soap_inbound` table — inspect a dedup row by MessageID.
- `python src/manage.py replay_soap_message <message_id>` — for support: re-emit the cached response.

## Constraints, guarantees, and gotchas

- **Idempotency is by MessageID, not by request content.** Two envelopes with different MessageIDs but identical bodies produce two shipments. Salog's own client is expected to reuse the MessageID on retries.
- **The dedup window is 90 days.** A replay 91 days later behaves like a fresh request. This matches Salog's replay policy.
- **Unknown codes fail loud.** No "unknown → default" mapping is ever inserted. This catches upstream misconfiguration at the earliest possible point.
- **Zero-premium is rejected, not persisted.** A silent free policy would be a serious billing bug; the handler rejects.
- **`CERTIFICATE_NOT_READY` is a normal, expected outcome.** Callers must handle it and retry — do not treat it as an error in production monitoring.
- **`SOAP_MAX_REQUEST_BYTES` is a hard limit.** A larger request is rejected at HTTP layer without touching the handler; do not raise without a bandwidth review.
- **Dry-run rollback covers the DB but not external side-effects.** If a rules action would have hit a third-party API during evaluation, the third-party call may still fire (rules-engine actions are transactional with the DB but not with third-party HTTP). Investigate before enabling dry-run against side-effect-heavy rules.
- **`SOAP_DRY_RUN_ALLOWED` should be `False` in prod once stable.** Leaving it on permits price probing without a persistent record.
- **The WS-Security nonce guard requires a working Redis.** A Redis outage would cause every request to be considered fresh — degradation mode is acceptable temporarily but not a substitute for real Redis.
- **Chunked certificate delivery is stateless.** Each chunk request re-reads the PDF from storage; no per-caller state persists between chunks.

## Related concepts

- APIs & Integrations
- Choices, Lookups & Code Maps
- Rating Engine
- Business Rules Engine
- Document Generation
- Event Stream & Audit Trail
