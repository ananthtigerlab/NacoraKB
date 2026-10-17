# Third-Party Integrations — Failure Modes

## What it is

Nacora integrates with a dozen external services. Each has its own failure profile — timeout, 5xx, rate limit, misauthentication, silent partial success. This page catalogues every documented failure mode, the retry / fallback path in code, the feature flag that turns the integration off, and the operational signal that surfaces a real outage. It complements the APIs page (which lists what each integration *does*) with what happens *when it doesn't*.

## Who owns it / who touches it

- **On-call** correlating an incident with the offending integration.
- **DevOps** flipping kill switches and monitoring recovery.
- **Backend engineers** designing new integrations — the patterns here are the templates.
- **Compliance** confirming the sanctions fallback actually runs when Comprehend is down.

## How it works

### The pattern in three words

- **Timeout.** Every outbound HTTP call has a bounded timeout.
- **Fallback.** Where possible, degrade to a lesser-quality but still-functioning path.
- **Flag.** If neither works, the kill switch turns the whole integration off; the system carries on without it.

Every integration below implements at least two of the three.

### Integration-by-integration reference

#### 1. KN PDM API (SSO cost-centre lookup)

- **Called from.** `SocialAdapter.pre_social_login()` in `src/clients/nacora/auths/adapter.py`.
- **Timeout.** `NACORA_PDM_REQUEST_TIMEOUT = 10` seconds.
- **Failure classes.**
  - Timeout → treated as unreachable; fall back.
  - 5xx → treated as unreachable; fall back.
  - 401 / 403 → token expired; regenerate via cached-token flow (`NACORA_PDM_TOKEN_CACHE_KEY`) then retry once. If second attempt fails, fall back.
  - 4xx (other) → treated as bad request; log to Sentry with the pdmuid; fall back.
- **Fallback.** Static JSON mapping (`sso_partner_mappers.json`) shipped in the container image.
- **Terminal fallback.** If both live and static miss, user is stashed in the pending-approval queue.
- **Kill switch.** `NACORA_PDM_SIMULATION_ENABLED = True` (dev-only) — returns canned data. In prod, PDM is required; there is no prod kill switch.
- **Signal.** SSO error rate spike, Sentry `SocialAdapter.pre_social_login` traces, pending-approval queue growth.

#### 2. CurrencyAPI.com (FX rates)

- **Called from.** Daily Celery Beat task `submodules.currencies.tasks.update_usd_exchange_rates_daily` at midnight UTC.
- **Timeout.** Standard HTTP timeout (Python `requests` default, ~30s).
- **Failure classes.**
  - Timeout / 5xx → task fails; Celery retries (3 attempts, exponential backoff). If all fail, no new `ExchangeRate` row for today.
  - Missing API key → task logs "no key configured" and exits cleanly (dev pattern).
- **Fallback.** None at fetch time. Downstream conversion uses yesterday's `ExchangeRate` (already in the DB).
- **User-visible impact.** `pricing_breakdown.premiums.after_conversion.*` fields stored as `null` when no rate is available. Analytics excludes null-rate rows from aggregations.
- **Kill switch.** Not a flag — controlled by presence of `CURRENCY_API_KEY`.
- **Signal.** Sentry alert on repeated task failure; analytics dashboard tolerates one day's gap.

#### 3. AWS Bedrock (Claude — commodity classification)

- **Called from.** `CommodityClassificationService` in `src/clients/nacora/commodity_classification/services.py`.
- **Timeout.** Bounded per call; on timeout the classification silently returns an empty list.
- **Failure classes.**
  - Model unavailable / region outage → empty result. UI still allows manual dropdown selection.
  - Throttling (Bedrock TPM limits) → same as timeout — empty result.
  - Auth failure → Sentry.
- **Fallback.** Manual selection from the commodity Choices catalogue. Never blocks the shipment form.
- **Kill switch.** No explicit flag; controlled by AWS credential + region.
- **Signal.** Sentry `CommodityClassificationService.classify` traces; UI analytics on "manual selection rate".

#### 4. AWS Comprehend (entity extraction) + SanctionScanner (fuzzy match)

- **Called from.** Cargo sanctions pipeline in `src/clients/nacora/cargo_sanctions/`.
- **Timeout.** Standard HTTP; sanctions pipeline runs asynchronously via a post-save signal.
- **Failure classes.**
  - Comprehend unavailable → skip entity extraction; treat the raw description as one entity for fuzzy match against SDN.
  - SanctionScanner unavailable → fall back to local OFAC SDN fuzzy match (`cargo_sanctions/data/sdn.csv`).
  - Both down → the whole sanctions pipeline no-ops if `CARGO_SANCTION_SETTINGS['ENABLED']=False`; otherwise it logs to Sentry and produces no screening result (shipment proceeds).
- **Fallback.** OFAC SDN CSV, offline, fuzzy-matched via `rapidfuzz` at `CARGO_SANCTION_SETTINGS['SDN_FUZZY_THRESHOLD']`.
- **Kill switch.** `CARGO_SANCTION_SETTINGS['ENABLED'] = False` disables the pipeline entirely. A dry-run endpoint (`/api/v1/third-parties/sanctions/screen-cargo-text/`) always runs regardless of the flag — used to spot-check descriptions.
- **Signal.** Sentry alerts; dry-run endpoint returning empty for previously-known-hit texts.

#### 5. GeoRisk (post-booking enrichment webhook)

- **Called from.** `webhooks.tasks.deliver_webhook` for the GeoRisk endpoint, dispatched on `PolicyVersionItem` created / booked.
- **Timeout.** `GEORISK_REQUEST_TIMEOUT_SECONDS = 10`.
- **Failure classes.**
  - Timeout / 5xx → Celery retries (3 attempts, exponential backoff with jitter).
  - 4xx → Sentry; no retry (deterministic failure).
- **Fallback.** None. Shipment booking is not affected either way; enrichment is a separate concern.
- **Party cache.** `GEORISK_PARTY_CACHE_SECONDS = 86400` (24h) in Redis. On cache miss, the webhook still fires; on hit, the cached party detail is included in the payload so GeoRisk can shortcut lookup.
- **Kill switch.** `NACORA_GEORISK_WEBHOOK_ENABLED = True/False`.
- **Signal.** Sentry alerts; GeoRisk-side dashboard for received webhooks; missing-enrichment complaints from underwriters.

#### 6. BMS webhook (policy activate / endorse / cancel + bordereau)

- **Called from.** `webhooks.tasks.deliver_webhook` for the BMS endpoint.
- **Timeout.** Standard HTTP; likely `BMS_REQUEST_TIMEOUT_SECONDS` in settings.
- **Failure classes.**
  - Timeout / 5xx → Celery retries (3 attempts, exponential backoff + jitter).
  - 4xx → Sentry; no retry.
  - Signature verification fails on BMS side → Sentry; BMS side rejects; manual investigation.
- **Fallback.** None. Failed retries land in Sentry; operator manually requeues via management command.
- **Kill switch.** Removing the webhook URL disables the flow (no dedicated flag).
- **Signal.** Sentry alerts; BMS reconciliation gap.

#### 7. Salog SOAP (inbound to Nacora)

- **Called from.** `/api/v1/soap/shipment-web-service` — inbound, not outbound. Failure modes are for the client to worry about; Nacora's job is to be reliable.
- **Nacora's failure surface (as viewed by the caller).**
  - Idempotency cache (DynamoDB `nacora_soap_inbound`, 90-day TTL) — replay of a message ID returns the cached response. Prevents double-booking on client retry.
  - Zero-premium rejection — SOAP fault (never a silent zero-premium booking).
  - Unknown code → SOAP fault (`COMMODITY_NOT_MAPPED`, `COVERAGE_NOT_MAPPED`, `POLICY_NOT_FOUND`).
  - Certificate not ready → `CERTIFICATE_NOT_READY` fault + `Retry-After` hint (`SOAP_CERTIFICATE_RETRY_AFTER_SECONDS = 30`).
  - Request too large → HTTP 413 (`SOAP_MAX_REQUEST_BYTES = 2 * 1024 * 1024`).
- **Kill switch.** `SOAP_INBOUND_ENABLED = True` — set `False` and the endpoint returns an immediate SOAP fault.
- **Signal.** Sentry logs; SOAP-endpoint access log; K+N-side dashboard.

#### 8. Amazon SES (outbound mail)

- **Called from.** `nacora.mails.send_queued_mails` Celery task via anymail.
- **Timeout.** SES SDK default (~30s).
- **Failure classes.**
  - Throttled → post-office `Email.status = queued` remains; next drain retries.
  - Hard bounce → SNS notification updates row to `failed`. No automatic retry — the address is dead.
  - Complaint → same as bounce; address is suppressed on the SES side.
  - Rate limit → same as throttled.
- **Fallback.** None; SES is single-source. Alternate providers can be swapped via `POST_OFFICE['BACKENDS']` but this is a config change, not a runtime fallback.
- **Kill switch.** None dedicated; sending stops if SES creds are removed.
- **Signal.** Sentry alerts; SES CloudWatch metrics; mail-queue age monitoring.

#### 9. Vessel Finder (IMO lookup)

- **Called from.** `src/clients/nacora/thirdapis/` (dormant — MVP is road-only).
- **Failure classes.**
  - Timeout / 5xx → sea-shipment record is stored with `vessel_details = null`.
  - Rate limited → same.
- **Fallback.** None. Sea-conveyance shipments proceed without vessel enrichment; the user can enter details manually.
- **Kill switch.** Not wired at flag level; controlled by presence of `VESSEL_FINDER_API_KEY`.
- **Signal.** N/A until sea-freight is turned on.

#### 10. Google Maps API (address autocomplete)

- **Called from.** Frontend directly (`GOOGLE_MAPS_API_KEY`). Not yet wired for Nacora.
- **Failure classes.**
  - Missing key → autocomplete unavailable; address becomes free-text.
- **Fallback.** Free-text entry.
- **Kill switch.** Frontend feature flag on the presence of the API key.
- **Signal.** N/A until wired.

#### 11. Amazon DynamoDB (audit trail store)

- **Called from.** `audit_trail.tasks.dispatch_event` Celery task.
- **Timeout.** boto3 default; wrapped in retry.
- **Failure classes.**
  - Throttled → boto3 auto-retries with exponential backoff.
  - Table unavailable → Celery task fails; retries per task retry policy; final failure to Sentry.
  - PutItem-only guarantee — no updates or deletes; app cannot rewrite history.
- **Fallback.** None. If DynamoDB is down, audit events accumulate in the RabbitMQ `audit_trail` queue. On recovery they drain.
- **Kill switch.** `AUDIT_TRAIL_ENABLED = True/False`. Off means dispatch is skipped entirely.
- **Signal.** RabbitMQ audit queue depth; Sentry alerts on repeated dispatch failure.

#### 12. AWS Athena / S3 (analytics warehouse)

- **Called from.** `analytics.tasks.emit_event` Celery task.
- **Failure classes.**
  - S3 write failure → task fails; `DataStreamLog.status = FAILED`.
  - Athena query failure → reader-side; not blocking to the writer path.
- **Fallback.** None at write. `nacora.tasks.requeue_stuck_data_streams` every 5 min retries `PENDING > 10min` rows.
- **Kill switch.** `EVENT_STREAM_ENABLED_EVENTS` per-event dict.
- **Signal.** Sentry alerts; `DataStreamLog` FAILED count.

### Retry semantics summary

| Integration | Retry attempts | Backoff | Where |
|---|---|---|---|
| PDM | 1 (token refresh) | none | `SocialAdapter` |
| CurrencyAPI | 3 | exponential | Celery task |
| Bedrock | 0 (fail-open) | — | Service class |
| Comprehend / SanctionScanner | 0 (fall back to SDN) | — | Sanctions pipeline |
| GeoRisk webhook | 3 | exponential + jitter | `webhooks.tasks.deliver_webhook` |
| BMS webhook | 3 | exponential + jitter | `webhooks.tasks.deliver_webhook` |
| SOAP inbound | N/A (inbound) | — | Client's job |
| SES / anymail | Continuous (queued state) | — | `send_queued_mails` |
| DynamoDB | boto3 default | exponential | boto3 SDK |
| Athena / S3 event write | Celery task | exponential | `emit_event` |

### Observability signals

- **Sentry** is the dead-letter path for every integration. Alerts on `logger:integration_<name>`.
- **RabbitMQ management UI** — queue depth on `default` (all outbound webhooks) and `audit_trail`.
- **Redis metrics** — for cache-backed integrations (PDM token, GeoRisk parties, FX).
- **SES CloudWatch** — SendRate, BounceRate, ComplaintRate.
- **DynamoDB CloudWatch** — ThrottledRequests, UserErrors, SystemErrors on `audit_events`.
- **Health check `/health`** does not verify third-party liveness — only Django/DB. Third-party health is monitored separately.

## Configuration & operational levers

| Env var / setting | Purpose | Typical value |
|---|---|---|
| `NACORA_PDM_REQUEST_TIMEOUT` | PDM HTTP timeout | `10` |
| `GEORISK_REQUEST_TIMEOUT_SECONDS` | GeoRisk HTTP timeout | `10` |
| `GEORISK_PARTY_CACHE_SECONDS` | GeoRisk party cache TTL | `86400` |
| `CARGO_SANCTION_SETTINGS['SDN_FUZZY_THRESHOLD']` | Offline SDN fuzzy match threshold | Env-defined (0-100) |
| `SOAP_CERTIFICATE_RETRY_AFTER_SECONDS` | Chunked-cert retry hint | `30` |
| `SOAP_MAX_REQUEST_BYTES` | SOAP request size limit | `2097152` (2 MiB) |
| Celery `max_retries` on webhooks | Outbound retries | `3` |
| Celery `retry_backoff` | Exponential backoff toggle | `True` |
| Celery `retry_jitter` | Randomise backoff | `True` |
| `AUDIT_TRAIL_ENABLED` | Global audit dispatch kill switch | `True` |
| `CARGO_SANCTION_SETTINGS['ENABLED']` | Sanctions pipeline kill switch | `False` (opt-in) |
| `NACORA_GEORISK_WEBHOOK_ENABLED` | GeoRisk webhook kill switch | `True` |
| `SOAP_INBOUND_ENABLED` | SOAP endpoint kill switch | `True` |

## Constraints, guarantees, and gotchas

- **Every outbound call must have a timeout.** No unbounded `requests.get(...)`. New integrations without a documented timeout are rejected in code review.
- **Every fallback path must be logged.** Silent fallbacks make outages invisible to on-call. The PDM → static-JSON fallback logs the pdmuid + reason at WARNING.
- **The kill switch is not a substitute for a fallback.** A flag that turns off sanctions screening cannot undo shipments already booked with sanctioned entities. Flags stop new work; the fallback lets existing work continue at reduced quality.
- **BMS webhook has no automatic dead-letter replay.** Sentry is the DLQ; operators manually requeue.
- **DynamoDB never gets an update or delete.** Even a "rollback" is a new event, never a modification of the original.
- **CurrencyAPI outage produces null base amounts, not silent 1:1 conversions.** Analytics knows to exclude nulls; a 1:1 fallback would silently distort aggregates.
- **Presigned URLs from GeoRisk payloads expire.** Cache the URL client-side only for the URL's lifetime; regenerate on stale.
- **Sanctions dry-run endpoint bypasses the kill switch.** By design — it exists to let admins verify the pipeline works even when the flag is off.
- **PDM simulation must be off in prod.** `NACORA_PDM_SIMULATION_ENABLED = True` in prod bypasses real cost-centre resolution and puts every user into the demo mapping.

## Related concepts

- APIs & Integrations
- Background Jobs & Celery
- Caching & Redis
- Feature Flags
- Observability
