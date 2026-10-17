# Background Jobs & Celery

## What it is

Anything that shouldn't block a user's click runs asynchronously on Celery. Nacora uses RabbitMQ as the broker and runs three separate queues, each consumed by a dedicated worker service. Scheduled jobs are dispatched by Celery Beat. This page catalogues the queues, tasks, retry policy, and cron schedule — plus the operational patterns for at-least-once delivery.

## Who uses it & where

- **Backend engineers** authoring or reviewing async tasks.
- **DevOps** provisioning worker services, monitoring queue depth, handling dead-letters.
- **On-call** debugging a stuck job, a slow queue, or a task that hit its retry limit.

## How it works

### Broker and delivery guarantees

- Broker: **RabbitMQ** at `CELERY_BROKER_URL` (env var, e.g. `amqp://user:pwd@rabbitmq:5672/`).
- Delivery: **at-least-once**. `CELERY_TASK_ACKS_LATE = True` (worker only acks after task completes) + `CELERY_TASK_REJECT_ON_WORKER_LOST = True` (requeue on OOM / crash). A task killed mid-execution is re-run.
- **Idempotency is the caller's responsibility.** Every task must tolerate being re-executed with the same arguments. Naming conventions and dedup keys in the task body handle this — no framework-level dedup.
- `CELERY_TASK_CREATE_MISSING_QUEUES = False` — every queue in `CELERY_TASK_ROUTES` must be declared on the broker at init time. Typos in routing fail fast rather than landing on the default queue.
- No global task timeout is set. Long-running tasks must be split or checkpointed by the caller.

### Queue configuration

Three durable queues, each with a specific role:

| Queue | Purpose | Exchange | Priority | Workers |
|---|---|---|---|---|
| `default` | General-purpose async (email, webhooks, rating product publish, bulk re-rate, misc.) | `default` | Normal | `celery-worker` |
| `sequential` | Order-sensitive tasks (must run serially — e.g. cross-shipment reconciliation) | `sequential` | Normal | `celery-worker` (single-threaded) |
| `audit_trail` | Audit-trail dispatch — writes to DynamoDB | `audit` (durable, direct) | Priority 0–10 | `celery-worker-audit-trail` (dedicated) |

Deployed workers (`config/deploy.yml`):

- **`celery-worker`** — consumes `default,sequential`. Runs with `-Q default,sequential`. Multiple replicas can be run for the `default` queue; concurrency inside a single worker is set by `--concurrency`.
- **`celery-worker-audit-trail`** — consumes `audit_trail` only. Runs with `-Q audit_trail`. Exactly one replica to preserve write ordering; queue depth is naturally bounded by the 3-second dedup window on the DynamoDB dispatcher.

`x-max-priority=10` on the audit queue lets high-priority audit events (e.g. destructive actions by administrators) jump ahead of routine model saves.

### Task routing

`CELERY_TASK_ROUTES` in `src/clients/nacora/settings.py` maps task names to queues. A task that's not in the map lands on `default`. Typical routings:

```
'nacora.mails.send_queued_mails':                  { 'queue': 'default' }
'nacora.tasks.publish_rating_product':             { 'queue': 'default' }
'nacora.tasks.create_rating_product_artifacts':    { 'queue': 'default' }
'nacora.tasks.bulk_rerate_shipments':              { 'queue': 'default' }
'audit_trail.tasks.dispatch_event':                { 'queue': 'audit_trail' }
'analytics.tasks.emit_event':                      { 'queue': 'default' }
'webhooks.tasks.deliver_webhook':                  { 'queue': 'default' }
```

### Named tasks (Nacora and platform)

| Task | Queue | Purpose |
|---|---|---|
| `nacora.mails.send_queued_mails` | `default` | Drains the `django-post-office` `Email` queue via `send_queued_mail` |
| `nacora.tasks.publish_rating_product` | `default` | Clones the policy's rating product at the external rater on activation (idempotent, 3 retries) |
| `nacora.tasks.create_rating_product_artifacts` | `default` | Creates the empty rating product / rate table for a new PolicyVersion |
| `nacora.tasks.bulk_rerate_shipments` | `default` | Re-rates N shipments against a specific rating version. Creates a `Report` and an `Activity` for status tracking |
| `audit_trail.tasks.*` | `audit_trail` | Audit-event writes to DynamoDB (dispatched real-time by default) |
| `analytics.tasks.emit_event` | `default` | Publishes an analytics event to Kinesis / S3 via `DataStreamLog` |
| `webhooks.tasks.deliver_webhook` | `default` | Delivers an outbound webhook (GeoRisk, BMS sync). 3 retries with exponential backoff |
| `submodules.currencies.tasks.update_usd_exchange_rates_daily` | `default` | Daily USD-based FX rate sync from CurrencyAPI.com |
| `nacora.tasks.requeue_stuck_data_streams` | `default` | Finds `DataStreamLog` rows stuck in PENDING > 10 min and requeues |
| `nacora.tasks.stale_sync_nacora_analytics` | `default` | Optional nightly re-emit of shipments edited outside normal flows (feature-flagged) |

### Retry policy

Framework default (applied via `autoretry_for` or explicit `bind=True` retries in task bodies):

- `autoretry_for = (Exception,)`
- `retry_backoff = True` (exponential: 2^attempt seconds)
- `retry_jitter = True` (adds randomness to reduce thundering-herd)
- `max_retries = 3`

Persistent failures after 3 retries are logged to **Sentry** with full task args and traceback. There is no built-in dead-letter queue — stuck messages sit in Sentry until an operator manually inspects and requeues via a management command.

### Celery Beat — scheduled tasks

Celery Beat runs on a dedicated service (`celery-beat`). Schedule declarations live in `src/clients/nacora/settings.py` under `CELERY_BEAT_SCHEDULE`:

| Task | Schedule | Purpose |
|---|---|---|
| `update_usd_exchange_rates_daily` | `crontab(hour=0, minute=0)` (midnight UTC) | Fetches USD-based FX rates from CurrencyAPI.com |
| `requeue_stuck_data_streams` | `crontab(minute='*/5')` (every 5 min) | Rescues stuck analytics events |
| `send_queued_mails` | `crontab(minute='*/2')` (every 2 min) | Drains the mail queue |
| `stale_sync_nacora_analytics` | `crontab(hour=2, minute=0)` (2am UTC, optional) | Re-emits shipments edited outside normal flows — enable when analytics drift is detected |
| `check_expiring_special_rates` | Daily | Marks SRR combinations inactive after 90 days (`SPECIAL_RATE_INACTIVE_DAYS`) |
| `send_renewal_reminders` | Daily | Emails brokers 30/14/7 days before policy expiry (`RENEWAL_REMINDER_DAYS`) |
| `expire_stale_quotes` | Daily | Marks quotes expired after 30 days (`SHIPMENT_QUOTE_EXPIRY_DAYS`) |

**Important:** the Beat schedule is defined in code, not in the database. A schedule change requires a deploy. `django-celery-beat` is installed and could store schedules in the DB — but this platform uses the code-defined path for reproducibility.

### Task authoring patterns

**Idempotency check inside the task:**

- Use a unique key from the arguments (e.g. policy ID, shipment number).
- Look up an idempotency ledger (in Redis or a small `IdempotencyLog` model) before doing work.
- If the key has already been processed, exit cleanly.

**Long-running work:**

- Split into batches. Each batch is its own task, chained via `chord()` or `chain()`.
- Report progress via a `Report` or `Activity` record.
- Bulk re-rate is the reference implementation: N shipments → one parent task that creates a report and spawns per-shipment child tasks.

**External API calls:**

- Wrap in try/except.
- Feature-flag the call so it can be disabled at runtime.
- On retry-eligible errors (timeout, 5xx), re-raise to trigger retry. On unrecoverable errors (400, 401, 403), log and abort.
- Bound the retries to prevent runaway.

**Dispatch pattern from services:**

- Never call a Celery task synchronously (`.delay()` is preferred over `.apply_async()` unless you need the extended options).
- Use `.on_commit()` when the task should only fire after the surrounding DB transaction commits. Otherwise you can race a task against a not-yet-committed row.

### Audit-trail dispatch

The audit-trail library uses a dedicated task path (`audit_trail.tasks.dispatch_event`) that lands on the `audit_trail` queue. The dispatch mode is configured by `AUDITTRAIL_DISPATCH_MODE`:

- `'realtime'` (default) — events are dispatched immediately on the receiving post-save signal.
- `'delayed'` — events are batched and dispatched by a periodic task (used to smooth spikes at scale; not currently active for Nacora).

Deduplication is applied at dispatch time: two identical events for the same object/field/actor within the `AUDITTRAIL_DEDUP['window_seconds']` (3s) are collapsed into one DynamoDB row.

### Monitoring and operational tools

- **Celery Flower** (optional) — dashboard for task counts, worker heartbeats, queue depth. Can be brought up on demand for debugging.
- **Sentry** — captures failed tasks with full args and traceback. Filter by `logger:celery`.
- **Django admin** — `django-celery-results` (if enabled) stores task results in the DB. Not used for high-volume workflows.
- **RabbitMQ management UI** — direct broker inspection (queue depth, message rates, connection counts). Access via VPN.
- **Kamal aliases** — `kamal app exec python src/manage.py <cmd>` for one-off ops (requeue a specific task, manually mark a stream as sent, etc.).

## Business rules & operational constraints

- **At-least-once semantics.** Every task must be idempotent. Common idempotency keys: policy ID + operation, shipment number + event.
- **`CELERY_TASK_CREATE_MISSING_QUEUES = False`** — a typo in the routing map fails the task immediately. Adjust the broker init when adding a queue.
- **`.on_commit()` for post-save tasks** — a task that reads a freshly created row must be dispatched after the outer transaction commits. Otherwise the row may not exist when the task runs.
- **No global task timeout.** Tasks that could hang (external API without their own timeout) must set their own `soft_time_limit` and `time_limit`.
- **Dedicated audit worker** — never merge `audit_trail` back into `default`. Audit ordering matters and audit spikes can pin the general worker.
- **Beat runs in exactly one replica.** Two Beat services would double-dispatch every schedule. Enforced by Kamal deploy config.
- **Sentry is the dead-letter path.** No configured DLX on RabbitMQ; operators triage from Sentry.
- **Post-office mail queue** is drained every 2 minutes — batching cuts SES API calls but adds up to 2 minutes of send latency. Acceptable for transactional email.

## Related concepts

- Event Stream & Audit Trail
- APIs & Integrations
- Architecture Overview
- Environments & Config
