# Environments & Config

## What it is

Nacora runs across three environments — **dev**, **staging**, **prod** — with the same container image and the same Django code, differentiated by environment variables, secrets, and a small per-env settings overlay. This page documents the settings-layering model, the load-bearing env vars, the feature flags, and how deployment is orchestrated with Kamal.

## Who uses it & where

- **DevOps / SREs** managing deployment, environment promotion, secret rotation.
- **Developers** running the stack locally — the layering model is the same locally, with a `docker/local_settings.py.dev` overlay.
- **Support / on-call** debugging a production incident — need to know which flag or env var governs which subsystem.

## How it works

### Settings layering (four levels)

Configuration is composed from four sources, in this order — later levels override earlier ones:

1. **Base platform defaults.** `src/insurance/settings.py` — installs common Django apps, defines the base middleware stack, wires DRF and Celery defaults, and provides sensible dev-mode fallbacks (like a hardcoded `SECRET_KEY` for dev only).
2. **Nacora client overrides.** `src/clients/nacora/settings.py` — imports named objects from the base module, rebuilds `INSTALLED_APPS` and `MIDDLEWARE`, adds Nacora-specific settings (feature flags, integration keys, custom service classes).
3. **Per-environment overlay.** `docker/local_settings.py.<env>` — a small overlay file baked into the container per environment. Loaded conditionally via env var (`DJANGO_LOCAL_SETTINGS_MODULE`).
4. **Environment variables.** Runtime injection at container start. Overrides anything above.

**The base module is never modified** to introduce Nacora-specific behaviour. Everything Nacora needs happens in step 2 or below.

### Critical environment variables

Set per environment via Kamal secrets or the container orchestrator. All secrets are vault-managed.

| Variable | Purpose | Example value |
|---|---|---|
| `SECRET_KEY` | Django cryptographic secret | `<random 32+ chars>` |
| `DATABASE_URL` | PostgreSQL connection (supersedes `DATABASES` dict) | `postgresql://user:pwd@pgbouncer:5432/insurance` |
| `REDIS_URL` | Redis cache + session store | `redis://:pwd@redis:6379/0` |
| `CELERY_BROKER_URL` | RabbitMQ broker URL | `amqp://user:pwd@rabbitmq:5672/` |
| `SENTRY_DSN` | Sentry project DSN | `https://<key>@sentry.io/<project>` |
| `SENTRY_ENVIRONMENT` | Sentry environment tag | `prod` |
| `SENTRY_TRACES_SAMPLE_RATE` | Sentry performance sampling | `0.1` (prod), `1.0` (dev) |
| `USE_MOZILLA_OIDC` | Enable Okta OIDC (True/False) | `True` |
| `OIDC_RP_CLIENT_ID` | Okta OAuth2 client ID | — |
| `OIDC_RP_CLIENT_SECRET` | Okta OAuth2 client secret | — (vault) |
| `NACORA_PDM_TOKEN_URL` | KN PDM OAuth2 token endpoint | — |
| `NACORA_PDM_API_URL` | KN PDM person-data endpoint | — |
| `NACORA_PDM_CLIENT_ID` | KN PDM OAuth2 client ID | — |
| `NACORA_PDM_CLIENT_SECRET` | KN PDM OAuth2 client secret | — (vault) |
| `NACORA_PDM_REQUEST_TIMEOUT` | KN PDM HTTP timeout in seconds | `10` |
| `NACORA_PDM_SIMULATION_ENABLED` | Use canned PDM data (dev only) | `False` in prod |
| `CURRENCY_API_KEY` | CurrencyAPI.com key | — (vault) |
| `BEDROCK_MODEL_ID` | AWS Bedrock model identifier | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `AWS_REGION_NAME` | AWS region for Bedrock/Comprehend/S3/DynamoDB | `eu-central-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS IAM credentials (or use IAM role) | — (vault) |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket for attachments | `nacora-attachments-prod` |
| `SANCTION_SCANNER_SEARCH_PROFILE_KEY` | SanctionScanner API key | — (vault) |
| `GEORISK_BASE_URL` | GeoRisk API endpoint | `https://nacora-georisk.i2go.io` |
| `GEORISK_TENANT_SLUG` | GeoRisk tenant | `nacora` |
| `GEORISK_API_TOKEN` | GeoRisk auth token | — (vault) |
| `GEORISK_REQUEST_TIMEOUT_SECONDS` | GeoRisk HTTP timeout | `10` |
| `GEORISK_PARTY_CACHE_SECONDS` | Redis TTL for GeoRisk party lookups | `86400` (24h) |
| `BMS_WEBHOOK_URL` | Sister BMS system sync endpoint | — |
| `BMS_WEBHOOK_SECRET_KEY` | HMAC key for BMS webhook signing | — (vault) |
| `SOAP_WS_SALOG_PASSWORD` | Salog SOAP WS-Security password | — (vault) |
| `VESSEL_FINDER_API_KEY` | Vessel Finder API key | — (vault) |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | — (vault) |
| `DEFAULT_FROM_EMAIL` | Sender for transactional email | `no-reply@nacorahub.com` |

### Feature flags

Feature flags are Nacora settings (defined in `src/clients/nacora/settings.py`) that can be overridden by environment variables. They gate whole subsystems so a broken integration can be turned off without a redeploy.

| Flag | Default | Purpose |
|---|---|---|
| `NACORA_SPECIAL_RATE_ENABLED` | `True` | Enables the Special Rate Request workflow |
| `NACORA_GEORISK_WEBHOOK_ENABLED` | `True` | Enables post-booking GeoRisk enrichment webhook |
| `CARGO_SANCTION_SETTINGS['ENABLED']` | `False` | Enables cargo-description sanctions screening (Comprehend + SanctionScanner) |
| `SOAP_INBOUND_ENABLED` | `True` | Enables `/api/v1/soap/` endpoint. False returns SOAP fault |
| `SOAP_DRY_RUN_ALLOWED` | `True` | Permits `?dryRun=1` on SOAP requests (disable in prod once stable) |
| `AUDIT_TRAIL_ENABLED` | `True` | Enables DynamoDB audit-trail dispatch |
| `ENABLE_NEW_360_ATTACHMENTS` | `True` | Use new S3-backed attachment storage |
| `NACORA_PDM_SIMULATION_ENABLED` | `False` | Return canned PDM data (dev only) |
| `POLICY_AUTOMATED_PDF_CREATION` | `False` | Auto-generate certificate PDFs on booking (queued task) |

### Rating & pricing config

| Setting | Value | Purpose |
|---|---|---|
| `NACORA_ANALYTICS_SETTINGS['BASE_CURRENCY']` | `EUR` | Base for cross-currency analytics aggregations |
| `NACORA_ANALYTICS_SETTINGS['CLUSTER_MAP']` | `{}` | Broker name → business cluster mapping |
| `NACORA_ANALYTICS_SETTINGS['DEFAULT_CLUSTER']` | `Other` | Fallback when broker isn't in the cluster map |
| `NACORA_ANALYTICS_SETTINGS['STALE_SYNC_ENABLED']` | `False` | Nightly re-emit of shipments edited outside normal flows |
| `POLICY_NUMBERING_PATTERN` | `MC-{number:06d}` | Policy number format |
| `RULE_NUMBERING_PATTERN` | `BR-{number:06d}` | Business rule number format |
| `CLAUSE_NUMBERING_PATTERN` | `CLAUSE-{number:06d}` | Clause number format |
| `SHIPMENT_QUOTE_EXPIRY_DAYS` | `30` | Days before a quoted shipment expires |
| `SPECIAL_RATE_INACTIVE_DAYS` | `90` | Days before an active special rate combination auto-expires |
| `RENEWAL_REMINDER_DAYS` | `[30, 14, 7]` | Cadence of renewal reminder emails |
| `MAX_LOGIN_ATTEMPTS` | `3` | Wrong-password lockout threshold |

### Deployment — Kamal

Kamal (formerly MRSK) orchestrates deploys over SSH. Config lives at `config/deploy.yml`. Kamal has no Kubernetes dependency — it manages Docker containers directly on target VPS hosts.

**Services declared:**

| Service | Role | Command | Replicas |
|---|---|---|---|
| `app` | Django web via Gunicorn | `gunicorn src.insurance.wsgi --bind 0.0.0.0:8000` | 2+ |
| `celery-worker` | General-purpose worker (queues: `default`, `sequential`) | `celery -A insurance worker -l info -Q default,sequential` | 1+ |
| `celery-worker-audit-trail` | Dedicated worker (queue: `audit_trail`) | `celery -A insurance worker -l info -Q audit_trail` | 1 |
| `celery-beat` | Scheduler for periodic tasks | `celery -A insurance beat -l info` | 1 |

**Container image:**

- Base: `python:3.11-slim-bookworm`.
- Multi-stage Dockerfile at `docker/Dockerfile.i2go` — first stage builds the frontend (Node), second stage builds the Python app and copies frontend `dist/` in.
- Build args: `APP_CLIENT=nacora`, `APP_ENV=prod`, `REQUIREMENTS_FILE=production`, `FRONTEND_APPS=nacora-embedded-cargo,nacora-shipment-portal`.

**Volumes (per host):**

- `~/.aws/` → `/root/.aws` — AWS credentials (SES, S3, Bedrock, Comprehend, DynamoDB).
- `/var/www/html/i2go/public/` → `/app/public` — Django `staticfiles`, `media`, compressed CSS/JS.
- `/home/ubuntu/app_logs/` → `/app/logs` — application log files (rotated by logrotate on the host).

**Kamal aliases** — shortcuts for common operations:

```
kamal app exec python src/manage.py migrate
kamal app exec python src/manage.py collectstatic --noinput
kamal app exec --interactive python src/manage.py shell
```

Or their bare aliases: `kamal migrate`, `kamal collect-static`, `kamal shell`.

**Health check:**

- Endpoint: `/health` (served by `HealthCheckMiddleware`, first in the stack).
- Frequency: every 10s.
- Timeout: 5s.
- Unhealthy → Kamal restarts the container.

**Secrets:**

- Stored in vault or the host's Kamal `secrets` file (age-encrypted).
- Injected at container start via `env.secret:` in `deploy.yml`.
- Never checked into the repo.

**Logging:**

- Docker driver: `json-file` with `max-size: 10m`, `max-file: 10` — bounded per container.
- Aggregation: syslog/beat forwarder (per environment).
- Structured logs use Python's `logging` framework with JSON formatter in prod.

### Environments

| Environment | Host | Domain | Purpose |
|---|---|---|---|
| **dev** | Local Docker Compose | `localhost:8000` | Individual developer, per-machine |
| **staging** | Staging VPS | `nacora-staging.i2go.io` | Integration testing, UAT, demos. Same image as prod |
| **prod** | Production VPS | `nacora-bo.i2go.io` (back office), `nacora-sp.i2go.io` (shipment portal) | Live |

The two production domains are served by the same container behind a domain-guard middleware (`CspDomainRedirectMiddleware`) that maps hostname → allowed URL prefix. See Security & Permissions.

### Migrations flow

- Django migrations live under each app's `migrations/` directory (Nacora at `src/clients/nacora/migrations/`).
- **Pre-deploy:** run `kamal app exec python src/manage.py migrate --plan` against staging to verify.
- **On deploy:** Kamal automatically calls `python src/manage.py migrate` on the first container of the release.
- **Zero-downtime patterns:** add nullable column → deploy → backfill in a data migration → deploy → make column required. Never rename or drop in a single release.
- **Roll-forward only.** Rolling back a schema migration in production is not supported by this pipeline; a broken migration is fixed with another migration.

### Secret rotation

- **API keys** (CurrencyAPI, SanctionScanner, GeoRisk, Vessel Finder): rotated by generating a new key at the provider, updating the Kamal secret, redeploying.
- **KN PDM client secret:** rotated with KN via a scheduled window.
- **Salog SOAP password:** rotated with KN and rolled out via `SOAP_WS_SALOG_PASSWORD` env var.
- **AWS IAM credentials:** avoided in favour of instance roles where possible. When keys are used, they rotate via IAM console.
- **Sentry DSN:** does not rotate unless the project is destroyed.

### Sizing and scaling

- **Web:** 2+ Gunicorn workers per app container, horizontally scaled.
- **Celery general worker:** starts with 1, scaled up when queue depth grows.
- **Celery audit-trail worker:** always exactly 1 to preserve ordering; queue depth is bounded by dedup.
- **Postgres:** connection-pooled via PgBouncer; `ATOMIC_REQUESTS` means one PG connection per HTTP request.
- **Redis:** small, mostly cache and session; also holds PDM tokens and GeoRisk parties.
- **RabbitMQ:** three durable queues (`default`, `sequential`, `audit_trail`); no dead-letter exchange configured — stuck messages logged to Sentry for manual retry.

## Business rules & operational constraints

- **`CELERY_TASK_CREATE_MISSING_QUEUES = False`** — every queue name in `CELERY_TASK_ROUTES` must be declared on the broker at init time. Typos fail fast.
- **`ATOMIC_REQUESTS = True`** on the default database — every HTTP request is a single transaction.
- **`ADMIN_URL_PATH = 'tiger-site-admin'`** and `ADMIN_SHOW = False` — the Django admin lives at a non-default URL, and its link is hidden from the nav.
- **Feature flags default to safe values.** New integrations ship disabled; individual environments opt in.
- **Prod `DEBUG=False`** with `ALLOWED_HOSTS` set explicitly. Any host mismatch returns 400 (`DisallowedHost`) before it reaches routing.
- **`SESSION_COOKIE_SECURE=True`, `SESSION_COOKIE_HTTPONLY=True`** in staging and prod. HTTPS-only, no JS cookie access.
- **AWS region** is `eu-central-1` for compliance and latency (GDPR-adjacent European data residency).

## Related concepts

- Architecture Overview
- Local Development
- Security & Permissions
- APIs & Integrations
- Background Jobs & Celery
