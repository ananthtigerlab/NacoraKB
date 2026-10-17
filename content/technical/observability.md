# Observability

## What it is

The tooling that lets an engineer answer "what is the system doing right now?" and "what went wrong five minutes ago?". Nacora leans on a small, well-scoped set of tools:

- **Sentry** — error tracking + performance monitoring.
- **Silk** — Django request/query profiler (staging and local only).
- **Django Debug Toolbar** — local-only DB / template / cache introspection.
- **RabbitMQ management UI** — queue depth, message rates.
- **Celery Flower** — task-level worker state (on-demand).
- **`/health` endpoint** — Kamal / load-balancer health check.
- **Docker `json-file` log driver** — bounded, rotated log capture per container.

There is no dedicated APM (Datadog / New Relic) — Sentry's performance sampling is the primary APM signal.

## Who owns it or touches it

- **SREs / on-call** are the primary users; the dashboards drive incident triage.
- **Backend engineers** debug their own tasks and views via Sentry and Silk locally.
- **DevOps** maintains the Docker log driver config, RabbitMQ / Flower access.
- **Compliance** verifies that Sentry does not receive PII (see below).

## How it works

### Sentry integration

Wired via `sentry-sdk` initialised in `src/insurance/settings.py`. Three env vars govern behaviour:

| Env var | Purpose | Typical value |
|---|---|---|
| `SENTRY_DSN` | Sentry project DSN | `https://<key>@sentry.io/<project>` |
| `SENTRY_ENVIRONMENT` | Environment tag on every event | `dev`, `staging`, `prod` |
| `SENTRY_TRACES_SAMPLE_RATE` | Fraction of requests captured for performance | `0.1` prod, `1.0` dev |

**What Sentry captures:**

- Every unhandled exception in a Django view, Celery task, or middleware.
- Performance traces at the configured sample rate — spans for DB queries, cache hits, HTTP calls to third parties.
- Custom breadcrumbs from `sentry_sdk.add_breadcrumb(...)` in service classes.
- Release information from the Kamal deploy (`SENTRY_RELEASE` set to the container image tag).

**What Sentry does not capture:**

- Request bodies are scrubbed for sensitive fields (`password`, `token`, `secret`) via `before_send` hooks.
- No email addresses, phone numbers, or `BusinessPartner` PII are attached to events — actor identity is captured as a UUID, not as an email.
- No audit-trail events (those go to DynamoDB; Sentry is for exceptions and performance, not compliance).

**Integrations enabled** (via `sentry_sdk.integrations`):

- `DjangoIntegration` — auto-capture of unhandled exceptions in views.
- `CeleryIntegration` — auto-capture in tasks; span-attached to the task run.
- `LoggingIntegration` — errors from Python's logging framework promoted to Sentry events.
- `RedisIntegration` — spans for cache/lookup operations.

### Silk request profiling

`django-silk` is enabled in staging and local dev; disabled in prod. When enabled, every HTTP request is logged with its SQL query list and rendering times, browsable at `/silk/`.

**Enable/disable:**

- Adds `silk` to `INSTALLED_APPS` and `silk.middleware.SilkyMiddleware` when `ENABLE_SILK=True`.
- Access to `/silk/` is gated behind `is_staff = True`.
- Storage: the silk profile data lives in the app DB — retention is short (Silk auto-prunes older-than-7-days by default).

**Use case:** identifying N+1 queries and slow templates before shipping. Not a production APM.

### Django Debug Toolbar

Local-only. Enabled when `DEBUG=True` and the client IP is in `INTERNAL_IPS`. Provides:

- SQL panel with per-query timings and `EXPLAIN` links.
- Cache panel showing hits/misses.
- Template panel with per-tag render times.
- Signals panel.

Never enabled in staging or prod — the toolbar's introspection is expensive and its content can include DB dumps.

### RabbitMQ management UI

Exposed on port `15672` on the broker host (`nacora-rabbitmq`). Access is via HTTP basic auth with per-env creds. Useful for:

- **Queue depth per queue** — `default`, `sequential`, `audit_trail`.
- **Message rate** — `publish`, `deliver`, `ack`.
- **Consumer count** — number of workers attached to each queue.
- **Stuck messages** — messages in queue with no consumer.

Local dev exposes the UI at `localhost:15672` with `guest`/`guest`.

### Celery Flower (on demand)

Not always running. Started ad-hoc during incident investigation:

```
kamal app exec celery -A insurance flower --port=5555
```

Flower shows:

- Live task events (started, succeeded, failed, retried).
- Per-worker state and concurrency.
- Task run history for the current process lifetime.

Because Flower is not persistent, its history vanishes on restart. For durable task history, refer to Sentry breadcrumbs or the `Report` / `Activity` rows created by long-running tasks.

### `/health` endpoint

Served by **`HealthCheckMiddleware`**, the first middleware in the stack (before session parsing, before DB access):

- Returns `HTTP 200 OK` with body `ok` if the process is up.
- Optionally checks DB and cache health (`/health/deep` — off by default in prod because it counts against Kamal's health-check budget).
- Kamal polls every 10 s with a 5 s timeout. Unhealthy → container restart.

The endpoint is intentionally cheap. Any DB or cache dependence risks a cascading failure loop where a slow DB kills healthy containers.

### Log driver — `json-file` with rotation

Docker container logs use the `json-file` driver, configured in `config/deploy.yml`:

```
logging:
  driver: json-file
  options:
    max-size: 10m
    max-file: '10'
```

That's 100 MB max per container. Beyond that, oldest logs are rotated out. Logs are aggregated by the host's syslog/beat forwarder into the central log store (per-env).

**Log format** in prod:

- Structured JSON via a Python logging JSON formatter.
- Fields: `timestamp`, `level`, `logger`, `message`, `request_id`, `user_uuid`, `client=nacora`, `env`.
- Sensitive-field scrubbing runs before serialisation.

Locally, logs are plain text for readability.

### Health signals per component

| Signal | Where |
|---|---|
| Container status | Kamal `deploy.yml` health check on `/health` |
| Web request errors | Sentry (unhandled) |
| Web request latency | Sentry performance sampling at `SENTRY_TRACES_SAMPLE_RATE` |
| Queue depth | RabbitMQ management UI |
| Task success/failure | Sentry (task-level integration) + `Report` rows for long jobs |
| DB query hotspots | Silk (staging), Sentry span breakdown (prod) |
| Cache hit rate | Redis `INFO` stats — no dashboard, `redis-cli info` ad-hoc |
| DynamoDB dispatch backlog | Audit-trail worker queue depth |
| Third-party integration latency | Sentry HTTP spans per outbound webhook |

### Alerting

Sentry has issue-alert rules per environment: `prod` errors page on-call, `staging` errors post to a Slack channel, `dev` errors are ignored. Alert throttling (avoid alert storms on a single bad deploy) is configured on the Sentry side, not in code.

Kamal deploy failures notify via the CI Slack channel — see CI Pipeline.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `SENTRY_DSN` | Sentry project |
| `SENTRY_ENVIRONMENT` | `prod` / `staging` / `dev` |
| `SENTRY_TRACES_SAMPLE_RATE` | Perf sampling |
| `SENTRY_RELEASE` | Container image tag |
| `ENABLE_SILK` | Toggle Silk in staging/dev |
| `DEBUG` | Enables Django Debug Toolbar (dev only) |
| `INTERNAL_IPS` | IPs allowed to see the Debug Toolbar |
| `HEALTH_CHECK_DEEP_ENABLED` | Enable `/health/deep` (off in prod by default) |
| Docker `logging.driver` / `logging.options` | Log driver + rotation |

Operational commands / URLs:

- `/health` — Kamal / LB health check.
- `/silk/` — Silk profiler UI (staging, staff-only).
- `localhost:15672` — local RabbitMQ management UI.
- `kamal app exec celery -A insurance flower --port=5555` — spin up Flower.

## Constraints, guarantees, and gotchas

- **Sentry is not the audit trail.** Compliance uses DynamoDB; Sentry is for engineering signals only. Don't rely on Sentry retention for legally-required records.
- **PII scrubbing depends on the `before_send` hook.** Any new field that might carry PII (`ssn`, `dob`, `passport`) must be added to the scrub list — reviewer's checklist.
- **Silk in prod is expensive.** Never turn on `ENABLE_SILK` in production; it stores every query and hammers the DB.
- **`/health` deliberately doesn't touch the DB.** A stuck query would fail health checks and cause pod thrashing. `/health/deep` exists for on-demand introspection only.
- **RabbitMQ management UI is behind basic auth.** Rotate creds when a team member leaves.
- **Flower is ephemeral.** Its data disappears when the process ends; treat it as a live-view tool, not a history store.
- **Log rotation is per-container.** Killing a container drops its remaining local log tail; the syslog forwarder must catch it in time.
- **Sentry sample rate is not free.** At 100 % (`SENTRY_TRACES_SAMPLE_RATE=1.0`) every request produces a full trace — fine for dev, expensive at scale in prod.

## Related concepts

- Environments & Config
- Background Jobs & Celery
- Event Stream & Audit Trail
- CI Pipeline
- Session Security
- Third-Party Integrations Failure Modes
