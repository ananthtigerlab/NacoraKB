# Celery Tasks & Async Processing

## What it is

Anything the platform does that must not block a user's click runs as an asynchronous background job. Sending a batch of notification emails, refreshing exchange rates overnight, publishing a rating product when a new policy activates, processing thousands of rows in a bulk upload, streaming an event to the analytics warehouse, writing an audit record — all of these run outside the request/response cycle so the user sees a fast UI while the heavy work happens behind the scenes.

The platform uses **Celery** as its async task framework, with **RabbitMQ** as the message broker in production. Jobs are grouped onto **queues** — different queues for different classes of work, so a slow email backlog cannot delay a critical audit event, and an ordered, sequential job cannot be reordered by a parallel worker. A **Beat scheduler** (a Celery companion process) triggers the recurring cron-style jobs — the FX sync every night, the mail-queue drain every two minutes, the stuck-events retry every five minutes.

Every task carries its own retry policy, its own dead-letter behaviour, and its own idempotency guarantee. Operations engineers monitor task health through Sentry (for failures), through the RabbitMQ management UI and Flower dashboard (for queue depth and worker liveness), and through the Backoffice admin surfaces that expose each task's persisted outputs (the mail queue log, the outbound event log, the bulk upload log).

## Who uses it & where

- **Operations** — monitor queue depth, retry failed tasks, watch the dead-letter pile, tune worker concurrency. They are the primary audience for the async subsystem's operational health.
- **Every user** benefits indirectly. A booking looks instant to the participant because the confirmation email, the GeoRisk webhook, the analytics event, and the audit trail write all queue rather than block. A bulk upload of five thousand shipments returns immediately to the uploader, then runs to completion on a background worker while the uploader gets on with their day.
- **Nacora administrators** interact with the outputs — the mail queue, the outbound data-stream log, the bulk upload progress screen — without ever needing to think about Celery directly. Those admin surfaces are the human-facing view of task progress and outcomes.
- **Finance and analytics teams** rely on the Beat schedule keeping the FX rates fresh, the bordereau generated monthly, and the event stream flowing without gaps.

## How it works

### The queue topology

Tasks are enqueued to specific queues based on the class of work they represent. The current deployment defines three queues, each with its own workers and its own concurrency profile.

- **`default`** — general-purpose async work. Notification email dispatch, rating product publish, bulk-upload row processing, exchange-rate sync, stuck-events retry, most feature-side tasks. Broad concurrency (multiple workers, each handling multiple tasks in parallel) so throughput scales with load.
- **`sequential`** — order-sensitive work that must run one at a time. Jobs where a second run cannot legitimately start before the first completes go here (for example, certain bulk rerate flows where the second batch depends on the first batch's persisted output). Concurrency capped at one so tasks execute strictly in FIFO order.
- **`audit_trail`** — dedicated queue for audit-event dispatch. Isolated from the general workload so an email backlog or a bulk upload flood cannot delay an audit write. Configured with a priority attribute (max priority 10) so a high-priority audit event jumps ahead of routine ones.

The routing map (`CELERY_TASK_ROUTES` in the platform configuration) declares which task goes to which queue. Adding a task to a queue is a one-line configuration entry; changing a task's queue is done via configuration change rather than in code.

### The dispatch lifecycle

1. Code that needs async work calls the task's delayed dispatch method — for example, "send this batch of emails" or "publish this policy's rating product". The call is non-blocking; it returns as soon as the message is written to the broker.
2. The task lands on the RabbitMQ queue named in the routing map.
3. A Celery worker configured to consume that queue picks up the message. Multiple workers can consume the same queue concurrently (for the `default` and `audit_trail` queues); the `sequential` queue is served by a single-concurrency worker.
4. The worker executes the task body. During execution, the task may write to the database, dispatch further tasks, call external services, or produce a persisted output visible in the Backoffice (a mail queue row, a webhook log entry, a bulk-upload result).
5. On success, the worker acknowledges the message. RabbitMQ removes it from the queue.
6. On failure, the task's retry policy engages. Transient failures back off exponentially and re-attempt (up to a configured maximum). Persistent failures move to a dead-letter destination.

### Beat scheduler — the cron layer

A separate Celery Beat process runs alongside the workers and holds the recurring schedule. When a scheduled time arrives, Beat enqueues the corresponding task exactly as an application call would have — the task then runs like any other work item on its designated queue. Beat itself does not execute tasks; it only triggers them.

The Beat schedule is persistent across restarts. If Beat is restarted mid-day, it does not re-fire tasks that have already run — it picks up from the correct next slot. Missed slots (Beat itself was down) are not retroactively fired; if a nightly FX sync was missed because Beat crashed at 23:55 and came back at 01:00, the next slot is the following night. Ops watches Beat liveness with the same diligence as worker liveness.

### Retries, backoff, and idempotency

Retries are configured per task. The base pattern uses:

- **`autoretry_for`** — the exception classes that should trigger an automatic retry (typically transient error classes: connection timeouts, upstream 5xx responses, message-broker hiccups).
- **`retry_backoff`** — enable exponential backoff between retries so a genuinely broken counterparty is not hammered.
- **`retry_jitter`** — add random jitter to backoff so a mass of retries after a shared outage do not all fire together.
- **`max_retries`** — cap on the number of attempts, typically 3 for outbound integrations. Beyond the cap the task is treated as failed and dead-lettered.

Idempotency is a per-task discipline, because at-least-once delivery means a task can and sometimes does run twice for the same underlying fact. The main patterns:

- **Post-transaction dispatch.** Tasks that create outbound side effects (an event, a webhook, an email) are dispatched only after the database transaction that produced the state change commits. A rolled-back transaction produces no task.
- **External idempotency keys.** Webhooks include a natural key (shipment reference, policy version) that the counterparty uses to deduplicate on their side. Analytics events include a natural key that the warehouse materialisation deduplicates on.
- **Per-task guards.** Tasks that would otherwise duplicate work check the current state of the target record before writing. A rating publish task, for instance, is a no-op if the rating product already exists at the target version.

### Acknowledgement mode and worker crash handling

Workers are configured for **late acknowledgement** — the message is acknowledged only after the task body completes successfully. If the worker crashes mid-task, RabbitMQ notices (via a heartbeat) that the message was never acknowledged and re-queues it for another worker. This is what gives at-least-once delivery — a crashed worker does not silently lose the work.

The paired setting is **reject on worker lost** — a message consumed by a worker that then loses its connection is explicitly rejected back into the queue rather than left in an ambiguous state. Combined, these two settings mean tasks either complete successfully or are re-queued for another attempt.

The trade-off is duplicate execution risk: a task that completed but crashed just before acknowledging will be re-queued and run again. This is why idempotency matters.

### Eager mode in development, broker in production

Development environments can run Celery in **eager mode**, where `.delay()` calls execute the task synchronously in the same process instead of dispatching to a broker. This is convenient for local debugging — no worker to run, no broker to configure — but it hides concurrency and ordering issues that production would surface. Eager mode is **never** enabled in production. Every production task hits the RabbitMQ broker and runs on a dedicated worker.

### Monitoring and operational tools

Four surfaces make the async subsystem observable.

- **Sentry** — every task failure that exhausts retries raises a Sentry issue. Sentry is the ultimate dead-letter: the definitive list of outbound trouble that Ops must action.
- **RabbitMQ management UI** — shows the live queue depth per queue, message rates, consumer count, unacknowledged message count. Used for depth alerts (a queue growing without shrinking is the first sign of a worker outage or a downstream bottleneck).
- **Flower** — the Celery-native monitoring dashboard. Shows active tasks, worker health, task history, and lets Ops inspect an individual task's arguments and traceback.
- **Kamal aliases** — the deployment tooling exposes shell aliases for common Ops actions (restart workers, drain a queue, reroute jobs during maintenance). These are the day-to-day levers Ops pulls without needing to SSH into individual workers.

Alongside these, the Backoffice admin surfaces (mail queue log, outbound event log, bulk upload progress, audit trail sidebar) expose task outputs to the humans who care about specific business outcomes.

## Options & choices

### The full task catalogue

Every named background task known to the platform, its queue, its trigger, and its retry behaviour.

| Task | Queue | Purpose | Trigger | Retry policy | Dead-letter |
|---|---|---|---|---|---|
| `nacora.mails.send_queued_mails` | `default` | Drain the outbound mail queue — dispatch every Pending message via the mail provider. | Beat every 2 minutes | Up to 3 retries with exponential backoff on transient SMTP or provider failure | Failed messages move to a Failed pile in the mail queue admin; Sentry issue raised. Admin can resend. |
| `nacora.tasks.publish_rating_product` | `default` | Clone a rating product template into a new policy's rating configuration on policy activation. | Event: policy activated | 3 retries, exponential backoff | Sentry; Ops republishes manually if necessary |
| `nacora.tasks.create_rating_product_artifacts` | `default` | Set up an empty rating product structure (Base Rater, Lookup Tables) when a new product is created. | Event: rating product configured | 3 retries | Sentry |
| `nacora.tasks.bulk_rerate_shipments` | `sequential` | Rerate a batch of existing shipments against a new rating version. Sequential so batches process in order. | Admin action: initiate bulk rerate | 3 retries; failures per-shipment logged | Sentry for job-level failure; per-shipment failures logged in the rerate result |
| `submodules.currencies.tasks.update_usd_exchange_rates_daily` | `default` | Fetch daily USD-based cross rates from currencyapi.com and persist. | Beat daily at 00:00 UTC | 3 retries, exponential backoff | Sentry; a missed day leaves last day's rates in place; FX conversions with no rate fall to null (see 3rd Party Integrations) |
| `nacora.tasks.requeue_stuck_data_streams` | `default` | Scan the outbound event log for records stuck at PENDING past the freshness window and re-queue them for dispatch. | Beat every 5 minutes | Task itself does not need retry — next Beat tick sweeps again | N/A; individual events on the log dead-letter to FAILED per their own retry ladder |
| `nacora.tasks.stale_sync_nacora_analytics` | `default` | Optional drift-recovery job — re-emits shipments that were edited outside the normal flow (admin data-fix) so analytics catches up. | Off by default; Ops enables via feature flag when a corrective sync is needed | 3 retries per event batch | Sentry; disable the flag once caught up |
| `audit_trail.tasks.dispatch_event` | `audit_trail` | Write an audit event to DynamoDB. | Every tracked model save/update inside the audit library | 3 retries, exponential backoff | Sentry; priority-10 tasks jump ahead so critical events do not sit behind routine ones |
| `analytics.tasks.emit_event` | `default` | Publish a structured event to Kinesis Firehose for the analytics warehouse. | Every event in the event stream catalogue (policy.activated, shipment.updated, bordereau.created, etc.) | 3 retries; per-event enable key must be true | Outbound log FAILED status; Sentry; stuck-events retry sweeps every 5 min |
| `webhooks.tasks.deliver_webhook` | `default` | Dispatch an outbound webhook (GeoRisk, BMS) to its counterparty endpoint. | Every webhook trigger in the outbound webhook catalogue | 3 retries with exponential backoff | Outbound log FAILED status; Sentry; Ops can resend from the outbound admin surface |
| `nacora.tasks.renewal_reminder_30_days` | `default` | Send renewal reminder emails to brokers whose policies are 30 days from end date. | Beat daily at 07:00 local | 3 retries | Sentry; missed day sweeps on the next daily tick |
| `nacora.tasks.renewal_reminder_14_days` | `default` | Send renewal reminder emails at 14 days out, escalated to broker manager and underwriting team. | Beat daily at 07:00 local | 3 retries | Sentry; missed day sweeps on the next daily tick |
| `nacora.tasks.renewal_reminder_7_days` | `default` | Send renewal reminder emails at 7 days out, escalated. | Beat daily at 07:00 local | 3 retries | Sentry |
| `nacora.tasks.quote_expiring_reminder` | `default` | Notify submitters 3 days before their quote's 30-day validity expires. | Beat daily at 07:00 local | 3 retries | Sentry |
| `nacora.tasks.special_rate_inactivity_sweep` | `default` | Flag Special Rates with no shipment activity in 90 days for administrator review. | Beat weekly on Monday at 06:00 local | 3 retries | Sentry |
| `nacora.tasks.generate_monthly_bordereau` | `sequential` | Produce the monthly bordereau for each broker-insurer combination, emit the `bordereau.created` event, and dispatch the bordereau notification email. | Beat monthly on the 1st at 03:00 local | 3 retries; long-running task, may take minutes per broker | Sentry; partial completion resumes on retry |
| `nacora.tasks.policy_expiry_sweep` | `default` | Transition Active policies past their end date to Expired; emit the `policy.expired` event where enabled. | Beat daily at 00:15 local | 3 retries | Sentry |
| `nacora.tasks.marked_for_cancellation_sweep` | `default` | Transition Marked-for-Cancellation policies to Cancelled on their effective date. | Beat daily at 00:15 local | 3 retries | Sentry |
| `nacora.tasks.bulk_upload_process_row` | `default` | Process one row from a bulk upload — parse the row, validate, create the declaration, quote, and (if configured) book the shipment. Fan-out from a bulk-upload orchestrator task. | Bulk upload orchestrator dispatches one per row | 3 retries per row; row-level failure recorded in the upload result | Row marked Failed with reason; upload continues for other rows |

Additional infrastructure tasks (worker heartbeats, broker-level housekeeping, feature-flag cache invalidation) exist but are internal to the platform and do not carry business-visible outcomes.

### The Beat schedule at a glance

| Task | Cadence | Local timing |
|---|---|---|
| `send_queued_mails` | Every 2 minutes | Continuous |
| `requeue_stuck_data_streams` | Every 5 minutes | Continuous |
| `update_usd_exchange_rates_daily` | Daily | 00:00 UTC |
| `policy_expiry_sweep` | Daily | 00:15 local |
| `marked_for_cancellation_sweep` | Daily | 00:15 local |
| `renewal_reminder_30_days` | Daily | 07:00 local |
| `renewal_reminder_14_days` | Daily | 07:00 local |
| `renewal_reminder_7_days` | Daily | 07:00 local |
| `quote_expiring_reminder` | Daily | 07:00 local |
| `special_rate_inactivity_sweep` | Weekly, Monday | 06:00 local |
| `generate_monthly_bordereau` | Monthly, 1st of the month | 03:00 local |

The 60-day renewal reminder runs on the same 07:00 daily slot as the 30/14/7-day ones — it is grouped into the general renewal-reminder sweep. Ops can adjust cadences without a code deploy by updating the Beat schedule configuration.

### Task states

A single task walks through the following states from enqueue to completion.

| State | Meaning |
|---|---|
| PENDING | Enqueued on RabbitMQ, waiting for a worker to pick it up. |
| RUNNING | A worker has picked up the message and is executing the task body. |
| SUCCESS | Task body completed without raising. Message acknowledged and removed from the queue. |
| RETRY | Task raised a retriable exception. Sitting between attempts, backing off before the next try. |
| FAILED | Task exhausted all retries. Sentry issue raised. Task-specific dead-letter behaviour engaged (mail queue Failed pile, outbound log FAILED status, or bulk-upload row Failed). |
| DEAD_LETTER | The dead-letter destination — Sentry plus, where relevant, the persisted admin-visible surface (mail queue, outbound log, bulk upload results). Ops action required to resolve. |

The state machine is per task invocation. A retried task does not walk backwards — a new attempt is a fresh run of the state machine (PENDING → RUNNING → SUCCESS or → RETRY / → FAILED).

### Configuration options

The platform's Celery configuration exposes a small set of levers Ops can tune per environment.

- **`CELERY_TASK_ROUTES`** — the map of task name → queue. Routing changes are configuration.
- **`CELERY_TASK_ACKS_LATE = True`** — late acknowledgement, described above. Rarely changed.
- **`CELERY_TASK_REJECT_ON_WORKER_LOST = True`** — re-queue tasks whose worker connection dropped. Rarely changed.
- **`autoretry_for`, `retry_backoff`, `retry_jitter`, `max_retries`** — per-task, declared at task definition. Tuning these is a code change.
- **Eager mode flag** — off in production, sometimes on in local dev. Never on in UAT or production.
- **Feature-specific flags** — e.g. `EVENT_STREAM_ENABLED_EVENTS` (which events fire on the stream), `NACORA_GEORISK_WEBHOOK_ENABLED` (whether the GeoRisk webhook task even runs), the stale-sync master enable.
- **Worker concurrency** — how many worker processes serve each queue. Tuned per environment; production runs multiple workers per queue for `default` and `audit_trail`, one for `sequential`.

## Business rules & calculations

- **At-least-once delivery is the guarantee.** Tasks may run more than once for the same underlying fact. Every task must be idempotent — safe to run twice without duplicating side effects.
- **Post-transaction dispatch.** Tasks that trigger side effects (emails, webhooks, events, audit writes) are dispatched only after the initiating database transaction commits. A rolled-back transaction produces no task.
- **No eager execution in production.** Production runs every task through the broker; eager mode is a development-only convenience.
- **Retention of task results.** Completed task results (return values, tracebacks on failure) are retained in the result backend for a short window (typically 24 hours) unless the task explicitly persists to its own admin-visible log. Long-lived outputs live in domain records (mail queue log, outbound event log, bulk upload result) rather than in the Celery result backend.
- **Priority on the audit queue.** The `audit_trail` queue is configured with a max priority of 10 so a critical audit event can jump ahead of routine ones. Every dispatch to the audit queue specifies a priority; unspecified defaults to a mid-tier value.
- **Sequential means strictly one at a time.** The `sequential` queue is served by a single worker at concurrency 1. A slow task on this queue blocks all others behind it — this is by design, because the tasks routed here need order preservation more than they need throughput.
- **Sentry is the ultimate dead-letter for every task.** Ops treats the Sentry backlog as the definitive list of async trouble. The Backoffice admin surfaces (mail queue, outbound log, bulk upload result screen) are the domain-specific drilldowns.
- **Beat does not backfill missed slots.** If Beat itself was down at a scheduled slot, that slot is missed; the next slot fires normally. Ops watches Beat liveness with the same diligence as worker liveness.
- **Feature flags gate whole tasks.** A task governed by a disabled feature flag becomes a no-op — the message is still consumed, but the task body returns immediately. This is how the platform silences whole subsystems (e.g. GeoRisk webhook disabled) without breaking the queue topology.
- **Idempotency in outbound integrations relies on natural keys.** GeoRisk deduplicates by shipment reference; BMS deduplicates by policy version identifier; the analytics warehouse deduplicates events by their natural key on materialisation.
- **Bulk upload row failures are per-row, not per-batch.** A single bad row does not fail the whole upload. It is marked Failed with a reason and the upload continues; the uploader sees a mixed success/failure summary at the end.

## States & transitions

A single task invocation walks the following state machine:

- **PENDING** → **RUNNING.** A worker picks up the message.
- **RUNNING** → **SUCCESS.** Task body completed cleanly. Acknowledged and removed from the queue.
- **RUNNING** → **RETRY.** Task raised a retriable exception. Backoff, then re-queue.
- **RETRY** → **RUNNING.** Backoff elapsed; the retry attempt runs.
- **RETRY** → **FAILED.** Max retries exhausted.
- **RUNNING** → **PENDING (re-queued).** Worker crashed mid-run; RabbitMQ re-queues the unacknowledged message.
- **FAILED** → **DEAD_LETTER.** Sentry issue raised; task-specific dead-letter behaviour engaged (mail queue Failed pile, outbound log FAILED, bulk upload row Failed).
- **DEAD_LETTER** → **PENDING.** Ops action — resend from the mail queue, resend from the outbound log, or manually re-queue the task with fixed input.

The Beat scheduler adds one upstream state per cron task: **SCHEDULED** → **PENDING** on Beat tick. Beat itself is stateless with respect to individual invocations; it just triggers, then the task walks the machine above.

## Related concepts

- Audit Trail Module
- Mail Notifications & Templates
- Webhooks & Event Stream
- Analytics & Reporting
- 3rd Party Integrations
- Bulk Upload
- Renewals
- Cancellations
- Billing
