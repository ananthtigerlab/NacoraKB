# Webhooks & Event Stream

## What it is

Two distinct mechanisms carry Nacora's outbound signals to the outside world. The **event stream** is a broadcast bus — every material state change (a policy activated, a shipment endorsed, a bordereau produced) is packaged into a structured event and published to the analytics pipeline. **Webhooks** are targeted HTTPS calls to specific external systems that need to know about specific moments (the GeoRisk provider needs to see a shipment as soon as it is booked, the K+N BMS needs to see a policy the moment it is activated so it can post commission and premium into the group ledger).

The two mechanisms sit alongside each other. The event stream is broadcast: a single event goes out and any warehouse consumer can pick it up. Webhooks are point-to-point: a signed request is delivered to one specific counterparty and its acknowledgement is tracked. Both are queued, retried, and dead-lettered — a webhook or an event that fails on the first attempt does not disappear silently.

Every event and every webhook has a feature flag governing whether it fires at all, a per-event enable switch, and a per-consumer configuration. This is deliberate — the same platform runs in development (streaming a subset), UAT (streaming a wider set for consumer testing), and production (streaming everything). Feature flags make each environment's behaviour explicit and predictable.

## Who uses it & where

- **GeoRisk** — the geographic risk-scoring provider used for shipment analytics — receives a webhook every time a shipment is booked or endorsed. GeoRisk feeds risk scores back into the analytics warehouse.
- **Kuehne+Nagel BMS** — the K+N group Broker Management System — receives a webhook every time a policy is activated or endorsed. BMS is the system of record for commissions, ceded premium, and group accounting; the webhook feeds the version of the policy that BMS should post.
- **Analytics warehouse (Athena / S3)** — receives the full event stream via Kinesis Firehose. Every enabled event lands as a row in the warehouse, ready for the executive, finance, and operations dashboards.
- **Finance data pipeline** — consumes the bordereau event on the same warehouse feed for month-end reconciliation.
- **Nacora Operations** — monitor delivery success and failure. They are the audience for the dead-letter workflow: when a webhook or an event is stuck, they see it, decide whether to resend, and confirm the counterparty received it.
- **Downstream analytics jobs** — nightly warehouse materialisation, penetration reporting, retention KPIs — all read the event stream indirectly through the warehouse tables it populates.

None of this is a surface any broker or participant ever sees. The webhook and event-stream layer is entirely a back-end integration surface. The Ops-facing view is the outbound queue admin area in the Backoffice, where a data-stream log lists every queued and dispatched item.

## How it works

### The two mechanisms side by side

**The event stream** is a fire-and-forget broadcast. When a policy activates, a serialiser builds a structured event (`policy.activated` with the enriched policy payload), the event is written to an internal outbound log with status Pending, and a background job picks it up and publishes it to Kinesis Firehose. Firehose buffers, batches, and writes the stream to S3, from where the analytics warehouse materialises the rows nightly. The platform does not know or care who reads the stream — any consumer with access to the S3 bucket can subscribe.

**Webhooks** are directed calls. When a shipment is booked, the platform builds a payload, signs it (HMAC signature in the case of the BMS webhook), and posts it to the counterparty's HTTPS endpoint. The counterparty acknowledges with an HTTP 2xx status; failure to acknowledge triggers the retry ladder. Every attempt is logged against the outbound record so Ops can reconstruct exactly what happened.

Both mechanisms use the same underlying queue infrastructure (a Celery task deposits work into the queue; a Celery worker dispatches it). Both write a per-event or per-webhook status record so failures are visible. Both are governed by a feature flag so the mechanism can be turned off wholesale for a given environment without a code change.

### Trigger points and the event catalogue

Every event fires at a specific moment in a workflow — a policy transitions to Active, a shipment moves to Booked, a bordereau finishes generating for the month. The trigger is always a specific state transition captured by the platform's business logic, not a database write or a UI click. This distinction matters: an event fires when the business fact becomes true (the policy is activated), not when a form field changes.

The full catalogue of events Nacora emits today is set out in the Options & choices section below. Each event carries a specific serialiser (a structured schema for the payload) and a specific set of Nacora enrichment fields on top of the base object. The enrichment fields are what make the event usable for cross-broker analytics — the raw policy record does not carry a broker cluster, a region, or an EUR-normalised amount, but the analytics warehouse needs all three to aggregate across brokers.

### Nacora enrichment on every event

Every event dispatched by the event stream is passed through the Nacora analytics enrichment layer before publication. Enrichment adds three fields on top of whatever the base serialiser produces:

- **Broker cluster** — the regional grouping the broker company belongs to (e.g. EMEA-North, APAC, LATAM-South). The cluster is looked up from the analytics cluster map, a configured mapping of broker company → cluster maintained by administrators. Brokers not in the map fall into a catch-all `Other` cluster.
- **Region** — the broader geographic region, derived from the country choice metadata attached to the shipment or the policy.
- **Base-currency (EUR) amount** — every monetary value in the event (premium, sum insured, commission) is converted to EUR using the day's FX rate from the currencyapi.com sync. If the FX rate is missing for the source currency, the EUR field is left **null** rather than silently converted at 1:1. The analytics warehouse excludes null-rate rows from aggregations. This is the same rule the analytics page carries — accuracy over convenience.

Enrichment is applied by the Nacora serialisers (for example, the Nacora policy-version serialiser and the Nacora shipment serialiser) rather than by the raw platform serialisers. The platform serialisers describe the object; the Nacora serialisers describe the object *plus* the fields Nacora's analytics warehouse needs.

### Outbound webhook catalogue

Two outbound webhooks are configured in the current deployment. Both fire from the same underlying webhook framework — a task delivers the payload, retries on failure, and writes a status record — but each has its own trigger, payload, and authentication.

**The GeoRisk webhook.** Fires when a shipment reaches Booked status or is Endorsed. Payload is the enriched shipment JSON — every field on the shipment record plus the Nacora enrichment (cluster, region, EUR amount). Authentication is a token-based header carrying a shared secret. GeoRisk caches shipment records on its side; a repeat POST for the same shipment reference updates the cached record. The webhook does not carry PII beyond named counterparties already present on the shipment. Cache TTL on the GeoRisk side is not enforced by the platform — GeoRisk expires stale records on its own schedule.

**The BMS webhook.** Fires when a policy transitions to Active for the first time (initial activation), when a subsequent version (endorsement) is activated, and when a policy is cancelled. Payload is the policy sync payload — every field the K+N BMS ledger needs to post the policy (policy number, version, insurer shares, premium breakdown, commission split, effective dates, cancellation reason if applicable). Authentication is HMAC signing: the platform computes a signature over the payload using a shared secret, includes it in a header, and the BMS side verifies it before accepting the post. Replay protection is via a timestamp in the payload combined with the signature — a request more than the configured window old is rejected by the receiver.

Both webhooks are async (Celery task on the outbound queue), retried three times with exponential backoff on transient failures, and dead-lettered after the third failure. Their feature flags — one per webhook — can turn them off cleanly without code changes.

### The Kinesis Firehose pipeline

The event stream lands in the analytics warehouse via AWS Kinesis Firehose. Firehose is the delivery layer between the transactional platform and the warehouse; the platform hands events to Firehose and Firehose takes over from there. Practically that means:

1. When an event is dispatched (a background task picks it up from the outbound log), it is submitted to Firehose.
2. Firehose buffers the event alongside other events arriving from the same source. Firehose is configured with a buffer size and a buffer interval — once either threshold is reached, Firehose flushes the batch to S3.
3. The flushed batch lands as one or more JSON-line files in an S3 bucket, organised by date and event type.
4. A nightly Athena materialisation job reads the raw S3 files and writes the events into warehouse tables that the BI tools query.
5. Dashboards (Looker, QuickSight) query the warehouse tables — they never read the raw event stream directly.

The platform does not need to know about buffering, retries at the Firehose level, or the S3 layout. The platform's contract with Firehose is a single API call: "here is an event, please deliver it." If that call fails, the platform's own retry ladder engages (the event stays in the outbound log at Pending status and is retried by the requeue task described below). If it succeeds, the event moves to Sent status and the platform is done with it.

### The outbound log and status lifecycle

Every event and every webhook writes a record to the outbound data-stream log at the moment it is queued. The record captures the event type (or webhook target), the payload, the timestamp, and a status that walks through a small state machine.

- **PENDING** — queued but not yet dispatched. The default state on creation.
- **SENT** — dispatched successfully. The counterparty (Firehose or the webhook endpoint) accepted the payload. Terminal.
- **FAILED** — dispatch failed after the retry ladder was exhausted. Visible in the Backoffice for Ops to inspect and, where appropriate, resend or mark handled.

A record can transition PENDING → SENT (happy path), PENDING → FAILED (after retries), or FAILED → PENDING (when Ops manually re-queues it, or when the stuck-events retry task picks it up). The log is append-only in spirit — status changes are captured on the same row with a history of attempts, so Ops can see when it was tried, what the response was, and how many attempts were made.

### Retries and the stuck-events recovery task

Two layers of retry protect against transient failures.

1. **Immediate retry inside the dispatch task.** Each dispatch attempt is followed by up to three retries with exponential backoff (a few seconds, then a minute, then longer). Transient network errors, temporary counterparty outages, and Firehose throttling are usually handled here without Ops intervention. If all three retries fail, the record moves to FAILED.

2. **Periodic stuck-events retry.** Every five minutes a background task scans the outbound log for records that are still at PENDING beyond a reasonable freshness window and re-queues them for dispatch. This is the safety net for the pathological cases: a worker crash mid-dispatch, a broker outage that lasted longer than the immediate retry ladder, a Firehose incident. The stuck-events task nudges these back into flight without Ops having to notice manually.

### Dead-letter journey and ops actions

Once a record reaches FAILED, the platform stops trying automatically. From that point the record is visible in the Backoffice outbound log with a red status indicator and a diagnostic panel showing every attempt and its response. Sentry receives a separate error report for the failure (this is the ultimate dead-letter for the platform — a Sentry issue that operations engineers see in their monitoring dashboard). Two actions are available to Ops:

- **Resend.** Re-queue the record. The status moves back to PENDING; the dispatch task picks it up again from scratch. The original attempt history is preserved.
- **Mark handled.** Close the record without dispatching. Used when Ops has confirmed the counterparty received the event by another route (for example, a manual re-import into BMS after a corrective phone call) and wants the record to stop showing as unhandled. The record status remains FAILED, but a "handled" annotation is added so the outstanding count on the Ops dashboard drops.

Ops action is intentionally manual. The platform does not automatically declare a failed record forever-lost — it defers to Ops judgement, because the correct next step often depends on the counterparty (a BMS 500 the third time is different from a GeoRisk timeout the third time).

### Cluster map, region metadata, and how they are maintained

The **analytics cluster map** is a configured mapping of broker company → cluster, held in the analytics settings under a `CLUSTER_MAP` entry. Adding a new broker company to a cluster means adding a line to that map; unmapping a broker means removing the line. Brokers absent from the map are streamed with the cluster field set to `Other`.

The map lives in configuration rather than in the choices module because it directly affects analytics aggregation across every event — a change to a broker's cluster changes every future event for that broker, and the analytics team needs to know about the change before it happens. In practice, maintenance sits with the same administrators who maintain the choices module, but the change lands via a deployment configuration update rather than an in-app screen. See the Cluster-Level Configuration page for the broader cluster model and how the choices module represents the user-facing cluster list.

Region metadata is derived from the country choice — every country in the choices module carries a region attribute (Europe, Asia, Americas, Africa, Oceania), and the enrichment layer reads that attribute when populating the region field on the event.

### Base currency and FX conversion behaviour

Every monetary field emitted on an event carries two values side by side: the source-currency amount (as the platform stored it) and the EUR base-currency amount (derived from that day's FX rate). The base-currency amount is what analytics uses for aggregation.

The FX rate used is the one synced at midnight UTC by the daily currency task (see Celery Tasks & Async Processing and 3rd Party Integrations). A shipment quoted at 09:00 uses the FX rate that was synced overnight — effectively the previous day's rate — and the analytics event carries that rate. If the source currency has no rate available for the day (because currencyapi.com had a gap, or the currency is new), the base-currency amount is **null** on the event. The warehouse materialisation drops null-rate rows from the aggregated tables rather than substituting a 1:1 or a prior day's rate. This is the same accuracy safeguard the analytics page carries — the platform is honest about missing data.

## Options & choices

### The full event catalogue

Every event the platform emits, its trigger, the serialiser that builds the payload, the enrichment fields added, and the default enable state per environment.

| Event | Trigger | Serialiser (payload shape) | Enrichment fields added | Default: dev | Default: UAT | Default: prod |
|---|---|---|---|---|---|---|
| `policy.activated` | A policy version transitions to Active for the first time (initial activation of a new policy version). | Nacora policy-version serialiser | Broker cluster, region, EUR-base amounts on premium and sum-insured | On | On | On |
| `policy.endorsed` | A policy endorsement (MTA) is published, activating the new version. | Nacora policy-version serialiser | Broker cluster, region, EUR-base amounts on premium and sum-insured; delta indicator vs. previous version | Off | On | On |
| `policy.cancelled` | A policy transitions to Cancelled on its cancellation effective date. | Nacora policy-version serialiser | Broker cluster, region, cancellation reason code | Off | On | On |
| `policy.renewed` | A renewed policy version is activated. Carries both the parent version identifier and the renewed version identifier so retention KPIs can join the two. | Nacora policy-version serialiser | Broker cluster, region, EUR-base amounts, parent version reference | Off | On | On |
| `policy_item.activated` | An individual policy item (a distinct insured-item entry inside a policy, applicable to some product configurations) reaches active status. | Nacora policy-item serialiser | Broker cluster, region | Off | On | On |
| `quotation.created` | A quote is issued for a shipment declaration (the shipment moves from Declaration to Quoted). | Nacora quotation serialiser | Broker cluster, region, EUR-base premium | Off | Off | On |
| `bordereau.created` | The monthly bordereau job produces the bordereau file for a broker-insurer combination. | Nacora bordereau event serialiser | Broker cluster, region, EUR-base total premium and commission | On | On | On |
| `shipment.updated` | A shipment record materially changes state (Booked, Endorsed, Cancelled) after initial declaration. This is the general-purpose shipment change event feeding the shipment-level warehouse tables. | Nacora shipment serialiser | Broker cluster, region, EUR-base premium and sum-insured | On | On | On |

Individual events are turned on and off via a per-event enable key inside the `EVENT_STREAM_ENABLED_EVENTS` configuration block. Adding a new event to the catalogue is a code change (a new serialiser and a new trigger point); enabling or disabling an existing event is a configuration change and does not require a deploy.

### The webhook catalogue

| Webhook | Trigger | Payload shape | Authentication | Cache / receiver behaviour | Feature flag |
|---|---|---|---|---|---|
| GeoRisk shipment webhook | Shipment reaches Booked or Endorsed status. | Enriched shipment JSON (source shipment fields + cluster, region, EUR amounts). | Token in header (shared secret). | GeoRisk caches per shipment reference; repeat POSTs update the cached record. TTL is on the GeoRisk side. | `NACORA_GEORISK_WEBHOOK_ENABLED` |
| BMS policy sync webhook | Policy activates (initial), endorsement is published, policy is cancelled. | Policy sync payload — full policy shape with insurer shares, premium and commission breakdown, dates, cancellation reason. | HMAC signature over payload with a shared secret; timestamp in the payload gives replay protection. | BMS records the policy version; repeat activations for the same version are idempotent on the receiver. | Environment-specific enable flag |

### The feature flag hierarchy

Three layers of configuration govern whether a given signal fires.

- **Master enable per mechanism.** The event stream as a whole can be disabled (typical for local development). The webhook subsystem as a whole can be disabled likewise.
- **Per-integration flag.** `NACORA_GEORISK_WEBHOOK_ENABLED` turns the GeoRisk webhook on or off without touching the rest of the outbound layer. A parallel flag exists for the BMS webhook.
- **Per-event enable key.** Inside the event stream configuration (`EVENT_STREAM_ENABLED_EVENTS`), each event carries its own `enabled` key. Turning `quotation.created` on for UAT without turning it on for dev is a matter of setting the enable key in the UAT configuration.

Order of precedence: the master enable overrides everything (if the mechanism is off, per-integration and per-event flags do not matter). Below that, per-integration flags gate the whole integration; per-event flags gate specific event types.

### Outbound record statuses

| Status | Meaning | Terminal? |
|---|---|---|
| PENDING | Queued but not yet dispatched, or awaiting retry after a transient failure. | No |
| SENT | Successfully dispatched to the counterparty (Firehose or the webhook endpoint). | Yes |
| FAILED | Dispatch failed after the retry ladder was exhausted. Ops action required. | No — Ops can re-queue |
| FAILED (handled) | Failed record annotated by Ops as handled by another route. No further action. | Yes (soft-terminal) |

### Retry policy at a glance

- **Immediate retry:** three attempts with exponential backoff.
- **Backoff base:** starts at a few seconds, doubles each attempt, capped at a modest ceiling so a single failing record does not sit for hours.
- **After the third failure:** the record moves to FAILED and a Sentry error is emitted.
- **Stuck-events retry task:** every five minutes, sweeps the outbound log for PENDING records past their freshness window and re-queues them.
- **Ops resend:** re-queues a FAILED record back to PENDING for another attempt.

## Business rules & calculations

- **Feature flag first, always.** No event fires and no webhook posts if the master mechanism is disabled. No integration fires if its per-integration flag is off. No event of a specific type fires if its per-event enable key is false.
- **Enrichment is mandatory.** Every event on the stream carries the Nacora enrichment fields — broker cluster, region, EUR-base amount. There is no path that skips enrichment; a raw platform serialiser is never published directly.
- **Missing FX means null, not one-to-one.** The EUR amount is left null when the source currency has no rate for the day. Analytics excludes null-rate rows. The platform never guesses.
- **Post-transaction dispatch.** Events and webhooks are queued *after* the database transaction that produced the state change commits. This is the anti-corruption boundary — an event or webhook only fires when the underlying business fact is durably persisted. A transaction that rolls back does not produce an outbound record.
- **At-least-once delivery.** The retry ladder means the same event or webhook may be dispatched more than once for the same underlying fact (a transient network error on the first send, then a successful second send). Counterparties are expected to be idempotent on the payload's natural key (shipment reference for GeoRisk, policy version identifier for BMS). Firehose deduplication in the warehouse layer is downstream of the platform's guarantee.
- **HMAC signing on BMS.** The BMS webhook includes an HMAC signature computed over the payload with a shared secret. Replay protection uses the timestamp inside the payload — a request whose timestamp is older than the configured window is rejected by BMS.
- **Cluster map maintained in configuration.** Broker-to-cluster mapping lives in the analytics settings under `CLUSTER_MAP`. Adding or moving a broker between clusters is a configuration change; changing the cluster list itself is also a configuration action and needs coordination with the analytics team so downstream dashboards continue to segment correctly.
- **Bordereau event is a monthly cadence.** `bordereau.created` fires once per broker-insurer combination per month, when the monthly bordereau generation task completes. It does not fire on every policy or every shipment.
- **Sentry is the ultimate dead-letter.** Every FAILED record raises a Sentry issue. Ops treats the Sentry backlog as the definitive list of outbound trouble; the outbound admin log in the Backoffice is the drilldown.
- **Ops resend re-renders the payload.** Resending a FAILED record rebuilds the payload from the current state of the underlying record rather than replaying the exact bytes originally queued. This matters when a corrective edit was made between the failure and the resend — the resent payload reflects the corrected state.

## States & transitions

Every outbound record walks through the following state machine.

- **PENDING** → **SENT.** The dispatch task succeeded on the first attempt (or on one of the immediate retries). Happy path.
- **PENDING** → **PENDING (retry pending).** The dispatch task failed transiently. The retry ladder engages; the status stays at PENDING between retries.
- **PENDING** → **FAILED.** All three immediate retries failed. The record moves to FAILED and a Sentry issue is raised.
- **PENDING (stuck)** → **PENDING (re-queued).** The stuck-events task detected a record that has sat at PENDING longer than the freshness window and re-queued it for dispatch.
- **FAILED** → **PENDING.** Ops selected Resend. The retry ladder restarts.
- **FAILED** → **FAILED (handled).** Ops annotated the record as handled outside the platform. No further dispatch attempts.

The state machine is per-record. A single event or webhook produces one record; the record walks its own machine independently of other records. There is no cross-record dependency — a failed BMS webhook for policy A does not block the BMS webhook for policy B.

## Related concepts

- 3rd Party Integrations
- Analytics & Reporting
- Celery Tasks & Async Processing
- Audit Trail Module
- Cluster-Level Configuration
- Rating
- Mail Notifications & Templates
