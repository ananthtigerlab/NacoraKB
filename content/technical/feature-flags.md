# Feature Flags

## What it is

A feature flag in Nacora is a Django settings key — usually a boolean, occasionally a dict of enabled sub-events — that gates a whole subsystem or integration. Flags let a subsystem be turned off per-environment without a code change, and let new integrations ship dark. This page documents every flag in use, where it lives in the settings-loading chain, and the discipline for adding one.

## Who owns it / who touches it

- **Backend engineers** shipping a new integration or high-risk feature.
- **DevOps / SREs** flipping flags in response to a provider outage.
- **On-call** correlating an incident with which flags are on in the affected environment.
- **Delivery leads** planning a phased rollout that toggles features per-tenant.

## How it works

### Where flags live

Flags are defined at the client-settings layer in `src/clients/nacora/settings.py`. Two shapes are used:

1. **Top-level boolean.** `NACORA_GEORISK_WEBHOOK_ENABLED = True`. Read as `getattr(settings, 'NACORA_GEORISK_WEBHOOK_ENABLED', False)` in code.
2. **Nested dict.** `CARGO_SANCTION_SETTINGS = {'ENABLED': False, 'MAX_ENTITIES': 10, ...}`. Read as `settings.CARGO_SANCTION_SETTINGS['ENABLED']`.

Both shapes can be overridden by an env var via the per-env overlay in `docker/local_settings.py.<env>` or an inline env-var lookup in `src/clients/nacora/settings.py` itself.

### The settings-loading chain

Flag values pass through the same four-level chain as all other config (see Configuration Loading):

1. `src/insurance/settings.py` — base platform default (often absent — new flags are Nacora-specific).
2. `src/clients/nacora/settings.py` — Nacora default. Usually the source of the flag definition.
3. `docker/local_settings.py.<env>` — per-env overlay, useful for staging/prod-specific values.
4. **Env var** — runtime override at container start. Overrides everything.

The pattern for a flag with an env override:

```
NACORA_GEORISK_WEBHOOK_ENABLED = os.environ.get(
    'NACORA_GEORISK_WEBHOOK_ENABLED', 'True'
) == 'True'
```

### The full flag inventory

| Flag | Default | Purpose |
|---|---|---|
| `NACORA_SPECIAL_RATE_ENABLED` | `True` | Enables the Special Rate Request workflow (creation, activation of `RiskFactorCombinations`). |
| `NACORA_GEORISK_WEBHOOK_ENABLED` | `True` | Enables post-booking GeoRisk enrichment webhook. Off in dev; typically on in staging + prod. |
| `CARGO_SANCTION_SETTINGS['ENABLED']` | `False` | Enables Comprehend + SanctionScanner + OFAC SDN cargo-description screening. Off by default; enabled per-env. |
| `CARGO_SANCTION_SETTINGS['SDN_FUZZY_ENABLED']` | `True` | Enables the offline OFAC SDN fallback if the vendor is unreachable. |
| `SOAP_INBOUND_ENABLED` | `True` | Enables `/api/v1/soap/` endpoint. `False` returns a SOAP fault immediately. |
| `SOAP_DRY_RUN_ALLOWED` | `True` | Permits `?dryRun=1` on SOAP requests. Set `False` in prod once the SOAP integration stabilises. |
| `AUDIT_TRAIL_ENABLED` | `True` | Enables DynamoDB audit-trail dispatch. Off during load tests to avoid audit spam. |
| `ENABLE_NEW_360_ATTACHMENTS` | `True` | Route attachments to the new S3-backed storage backend. |
| `NACORA_PDM_SIMULATION_ENABLED` | `False` (prod) / `True` (dev) | Return canned PDM data. Dev-only. |
| `POLICY_AUTOMATED_PDF_CREATION` | `False` | Auto-generate certificate PDFs on booking (queued). Off — PDFs are minted on demand. |
| `EVENT_STREAM_ENABLED_EVENTS` | dict per event | Per-event on/off for the analytics stream. |
| `NACORA_ANALYTICS_SETTINGS['STALE_SYNC_ENABLED']` | `False` | Nightly re-emit of shipments edited outside normal flows. Enable when analytics drift is detected. |
| `USE_MOZILLA_OIDC` | env-driven | Enable Okta OIDC login flow. `True` in staging/prod; `False` in local dev. |
| `IGNORE_GROUP_OBJECT_PERMISSION` | `True` | Disable `django-guardian` group-based object permissions. |
| `SESSION_COOKIE_SECURE` | env-driven | HTTPS-only cookies. `True` in staging/prod. |
| `SESSION_COOKIE_HTTPONLY` | `True` | Block JS from reading session cookies. |
| `ALLOW_CONCURRENT_LOGIN` | `True` | User may be logged in from multiple devices. |
| `USE_S3_FOR_SCRIPT_REPORTS` | `True` | Push async export outputs to S3 with presigned URLs. |
| `BULK_UPLOAD_ALWAYS_CREATE_NAMED_ASSURED` | `True` | Auto-create the named-assured BP if it doesn't exist during bulk upload. |
| `SEND_EMAIL_WHEN_BLOCKED` | `True` | Send lockout notification email on `MAX_LOGIN_ATTEMPTS`. |
| `ADMIN_SHOW` | `False` | Show a Django-admin link in the nav. Off — admin URL is unlisted. |
| `EXCHANGE_RATE_API_PROVIDER` | `CurrencyAPI.com` | Which FX provider to use. Not strictly a flag, but the same layering applies. |

Flags also appear at per-event or per-model granularity:

- **`EVENT_STREAM_ENABLED_EVENTS`** — dict of `{'policy.activated': True, 'policy.endorsed': True, 'policy.cancelled': True, 'policy.renewed': False, 'policy_item.activated': False, 'quotation.created': False, 'bordereau.created': True, 'shipment.updated': True}`.
- **`AUDITTRAIL_MODELS`** — remove a model entry to disable audit-trail for that model (redeploy required). Not a runtime flag.

### Layering behaviour

- **Env-var-first.** A container starts, reads `NACORA_GEORISK_WEBHOOK_ENABLED=False`, and the flag is off — regardless of what `settings.py` says.
- **Per-env overlay.** `docker/local_settings.py.dev` might set `NACORA_PDM_SIMULATION_ENABLED = True`; `docker/local_settings.py.prod` sets it `False`. Both are baked into the container per environment.
- **Base setting-file default.** The fallback if nothing else sets it.

Reading order in code:

```python
from django.conf import settings
if settings.NACORA_GEORISK_WEBHOOK_ENABLED:
    dispatch_georisk_webhook(shipment_id)
```

If the flag is unset, `AttributeError` is raised — Nacora prefers explicit failures over silent defaults. Every flag has a definition; nothing is `getattr(settings, ..., default)` without a documented reason.

### Discipline for adding a new flag

1. **Name it consistently.** Nacora-specific: `NACORA_<SUBSYSTEM>_<VERB>_ENABLED`. Platform: no prefix.
2. **Default to safe.** New integrations default `False`. Removing safety defaults to `False`.
3. **Define in `src/clients/nacora/settings.py`** with an env-var override.
4. **Read via `settings.<FLAG>`** — never `os.environ.get(...)` inline in application code; the settings layer is the single choke point.
5. **Document here.** Every flag on this page has a row in the inventory table.
6. **Announce the flip.** Flipping a flag in prod is an operational event — put it on the on-call channel with the reason and rollback plan.

### Kill-switch vs opt-in

- **Kill switch** — flag defaults on; can be turned off if the integration breaks. Used for GeoRisk webhook, SOAP inbound, event stream.
- **Opt-in** — flag defaults off; must be turned on per-env. Used for cargo sanctions (compliance sensitive), automated PDF creation (perf sensitive), stale sync.

### Rollout scenarios

- **Provider outage** — flip the kill switch off, redeploy or use env-only override, restart. GeoRisk webhook is the canonical example.
- **Compliance activation** — a new tenant onboards with sanctions screening required. Flip `CARGO_SANCTION_SETTINGS['ENABLED']=True` in staging first; validate with dry-run endpoint; roll to prod.
- **Dark launch** — new integration ships with the flag off. QA validates by flipping it in a QA env. Promoted to staging + prod after sign-off.

## Configuration & operational levers

See the full inventory table above. Every flag is at the settings level; every one can be set via env var at container start.

## Constraints, guarantees, and gotchas

- **Flags are read at runtime.** Setting an env var on the container requires a restart to take effect (Django settings are loaded once at process start).
- **A flag is not a rollout tool.** Toggling `NACORA_SPECIAL_RATE_ENABLED=False` disables the feature globally in the environment. Per-user or per-broker rollout is not supported by this pattern; use role-based scoping if the feature is per-user.
- **Beat-scheduled tasks may still fire when the flag is off.** The task must check the flag itself and no-op if disabled — the schedule declaration alone is not gated.
- **Serializer overrides** (like `EVENT_STREAM_SERIALIZER_OVERRIDES`) are per-key, not a flag. Removing a key falls back to the base serializer; setting a key to `None` fails.
- **Adding a new flag requires a deploy.** Env vars alone cannot introduce a flag that isn't defined in settings.
- **Removing a flag is a code change.** Deprecated flags stay in `settings.py` until every environment stops using them; then remove.
- **Feature flag ≠ audit-trail toggle.** `AUDIT_TRAIL_ENABLED=False` disables dispatch but does not clear the queue. Keep it on unless you have a specific reason.

## Related concepts

- Configuration Loading
- Environments & Config
- Third-Party Integrations — Failure Modes
- Background Jobs & Celery
- Architecture Overview
