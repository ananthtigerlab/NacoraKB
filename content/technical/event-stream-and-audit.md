# Event Stream & Audit Trail

## What it is

Nacora has two separate observability streams — both important, easy to confuse. **Analytics events** flow through Kinesis / S3 → Athena to power business intelligence, reconciliation, and downstream systems. The **audit trail** flows to DynamoDB and captures every material change with full attribution. This page distinguishes them, documents each in detail, and lists the concrete Nacora settings that govern them.

## Who uses it & where

- **Data engineers** consuming the analytics stream from Athena / S3.
- **Downstream systems** (BMS billing, GeoRisk, analytics dashboards) consuming specific event types via webhooks or S3 partitions.
- **Backend engineers** wiring new events, adding audited fields, or debugging why an event didn't emit.
- **Compliance officers and examiners** searching the audit trail during a review.
- **SRE** on-call when audit dispatch backs up or the analytics stream gets stuck.

## How it works

### Two systems side by side

|  | **Analytics event stream** | **Audit trail** |
|---|---|---|
| Purpose | Business intelligence, reconciliation, downstream consumers | Compliance, change history, incident forensics |
| Storage | Kinesis / S3 → Athena | DynamoDB `audit_events` in `eu-central-1` |
| Retention | Long-term (S3 tiering) | TTL on `expires_at` (typically 2 years) |
| Mutability | Immutable at S3 | Append-only; no update/delete API |
| Dispatch | Post-save signals + Celery task | Post-save signals + Celery task (dedicated queue) |
| Serialisation | Nacora-specific serializers per event | audit_trail library conventions |
| Dedup window | Retry gating by state on `DataStreamLog` | 3-second window per (actor, resource, action) |
| Read access | Athena queries + `/api/v3/audit-events/` for direct rows | HTMX audit UI + `/api/v1/audit_trail/` search API |

Both fan out from Django post-save signals. Both are asynchronous. Both are gated by feature flags. But they answer different questions — "how much premium did brokers write in EMEA-North last quarter?" versus "who edited this special rate combination and when?".

### Analytics event stream

**Events emitted.** Configured in `EVENT_STREAM_ENABLED_EVENTS` (per-event on/off):

| Event | Enabled by default | Serializer | Purpose |
|---|---|---|---|
| `policy.activated` | ✓ | `NacoraPolicyVersionSerializer` | New Business activation. Includes holder + broker enrichments |
| `policy.endorsed` | ✓ | `BmsPolicySyncSerializer` | Endorsement — BMS sync |
| `policy.cancelled` | ✓ | `BmsPolicySyncSerializer` | Policy cancellation |
| `policy.renewed` | ✗ | `BmsPolicySyncSerializer` | Renewal (currently disabled) |
| `policy_item.activated` | ✗ | `NacoraShipmentSerializer` | Shipment booking (disabled — shipments backfill via `policy.activated`) |
| `quotation.created` | ✗ | — | Quote creation (disabled) |
| `bordereau.created` | ✓ | `EventBordereauSerializer` | Bordereau (slip) creation |
| `shipment.updated` | ✓ | — | Shipment status change (generic) |

**Serialiser override map** — Nacora attaches its own serialisers to the event types via `EVENT_STREAM_SERIALIZER_OVERRIDES`:

```
EVENT_STREAM_SERIALIZER_OVERRIDES = {
  'policy.activated':      'clients.nacora.analytics.serializers.NacoraPolicyVersionSerializer',
  'policy_item.activated': 'clients.nacora.analytics.serializers.NacoraShipmentSerializer',
  'bordereau.created':     'clients.nacora.api.v1.policies.serializers.EventBordereauSerializer',
  'policy.endorsed':       'clients.nacora.webhooks.serializers.BmsPolicySyncSerializer',
  'policy.cancelled':      'clients.nacora.webhooks.serializers.BmsPolicySyncSerializer',
  'policy.renewed':        'clients.nacora.webhooks.serializers.BmsPolicySyncSerializer',
}
```

**Shipment payload schema** (`NacoraShipmentSerializer`) — flat columns for Athena:

- Metadata: `shipment_id`, `policy_id`, `policy_number`, `booking_date`, `created_at`, `updated_at`.
- Parties: `named_assured_id/name`, `participant_company_id/name`.
- Cargo: `commodity`, `commodity_group`, `conveyance`, `coverages`, `packing`, `hs_code`, `tracking_number`.
- Route: `departure`, `departure_country` (ISO-2), `destination`, `destination_country` (ISO-2), `incoterms`.
- Risk: `insured_value`, `insured_value_currency`, `insured_value_base` (EUR-converted), `fx_rate_to_base`.
- Status: `status_group` (draft / quoted / booked / referred / declined / expired / cancelled), `referral_decline_reasons`.
- Org: `broker_cluster` (from `CLUSTER_MAP`), `region` (derived from destination country's `config_attributes`).

**Analytics enrichment settings** (`NACORA_ANALYTICS_SETTINGS`):

```
BASE_CURRENCY:      'EUR'      # Cross-currency aggregation base
DEFAULT_REGION:     'Other'    # Fallback when destination country has no region
DEFAULT_CLUSTER:    'Other'    # Fallback when broker isn't in the cluster map
CLUSTER_MAP:        {}         # e.g. {'Nacora Insurance Brokers AG': 'DACH'}
STALE_SYNC_ENABLED: False      # Optional nightly re-emit of drift-edited shipments
```

**Delivery pipeline:**

1. Post-save signal on a tracked model creates a `DataStreamLog` row (state=PENDING) with the event type and serialised payload.
2. Celery task `analytics.tasks.emit_event` picks it up and pushes to Kinesis (or S3 via a data pipeline, depending on env config).
3. On success, the row is marked SENT.
4. On failure, marked FAILED with the error; Sentry captures the traceback.
5. Every 5 minutes, `nacora.tasks.requeue_stuck_data_streams` finds PENDING rows > 10 min old and requeues them.

Nightly, Athena materialises the S3 partitions into warehouse tables. BI dashboards (Looker, QuickSight) query Athena.

**Base-currency FX conversion.** All monetary fields are converted to EUR at event time using yesterday's rate (from the `ExchangeRate` table). Missing rate → base amount is `null`, never a silent 1:1. Analytics excludes null-rate rows from aggregations. FX rates are cached for 10 minutes in Redis to avoid repeated lookups during a busy hour.

**Cluster mapping.** The `CLUSTER_MAP` dict is a manual mapping of broker company display names to their business cluster (e.g. Nacora Austria → DACH, Nacora Poland → EMEA-East). Names are matched case-insensitively. Unmapped brokers fall into `DEFAULT_CLUSTER` = 'Other'. When onboarding a new broker cluster, this map is the config that must be updated (in `src/clients/nacora/settings.py`).

### Audit trail

**Storage:** DynamoDB `audit_events` table in `eu-central-1`. **Never** in PostgreSQL.

**Application code writes only.** No update/delete API is exposed. Retention is managed by DynamoDB TTL on the `expires_at` attribute set at record creation.

**Audited models.** Defined in `src/clients/nacora/audittrail_settings.py` under `AUDITTRAIL_MODELS`. Each model entry specifies which fields to track, which related fields to propagate to, and whether the instance itself is audited or only its relatives.

Load-bearing audited models:

- `policies.Policy` — `future_cancel_date`, `cancel_date`, `latest_renewal_at`, plus related `status.title/reason` and version `state/title/end_date/policy_term`.
- `policies.PolicyVersion` — `state`, `title`, `start_date`, `end_date`, `published_at`, `policy_term`, `headers`, `attributes` (JSON), `endorsement_note`.
- `policies.PolicyVersionItem` — `name`, `number`, `status`, `attributes`, `details`, `pricing_breakdown`, `metadata`. Excludes internal fields like QR-code lists and certificate URLs.
- `policies.Quotation` — `number`, `progress`, `status`, `expiry_date`, plus related PolicyVersion fields.
- `partners.BusinessPartner` — all email/phone/profile fields, roles, addresses. M2M edges tracked.
- `partners.BusinessPartnerRelation` — `skip_instance_audit=True`; changes propagate to the `from_partner` audit (mirror_on_related).
- `partners.AttributeValue` — `skip_instance_audit=True`; changes propagate to the partner.
- `ratings.SpecialRateRequest` — `reference`, `title`, `status`, plus related `assigned_to.name`.
- `ratings.Risk` — `skip_instance_audit=True`; propagates to SRR.
- `ratings.RiskFactorCombinations` — `key_values`, `factor_values`, `return_type`, `special_rate`, `min_premium`, `status`, `is_active`, `extra_data`. Also propagates to SRR.
- `clauses.Clause` — `code`, `version`, `name`, `wording`, `clause_type`, `status`, `effective_date`, `expiration_date`, `lines_of_business`, `jurisdictions`.
- `clauses.ClauseCategory` — propagates to clauses.
- `clauses.ClauseObjectRelation` — `skip_instance_audit=True`; propagates to the target object (so attaching a clause to a shipment audits the shipment).
- `i2go_rules.Rule` — `name`, `number`, `description`, `category`, `priority`, `condition_logic`, `effective_date`, `status`, `content_type`.
- `i2go_rules.RuleCondition`, `RuleAction` — propagate to the Rule.
- `dynamic_templates.DynamicTemplate` and `DynamicTemplateVersion` — template edits and version changes.
- `i2go_activities.Activity`, `ActivityType` — priority, status, reminders, related priority.
- `activities.Referral` — `reason`, `status`, `extra_data` (excluding rules that triggered it — those are stored separately), plus assignees.
- `partners.Address` — all address fields + `extra_data`.
- `faqs.FAQEntryObjectRelation` — FAQ attachments; propagates to the target.
- `i2go_choices.Choices` — `key`, `value`, `is_active`, `config_attributes`. Propagates to `choice_type.slug`.
- `i2go_choices.LookupCategory`, `LookupItem`, `LookupItemAttribute` — Choices admin flow, propagates upward.

**Dispatch mode:** `AUDITTRAIL_DISPATCH_MODE = 'realtime'`. Post-save signal fires → audit dispatch runs synchronously on the audit-trail Celery worker.

**Actor resolution:** `AUDITTRAIL_ACTOR_RESOLVER = 'auths.middleware.get_current_user'` — reads from thread-local user set by `CurrentUserMiddleware`. Background tasks record the "system" actor.

**Event structure:** every event carries actor (user), action (CREATED / UPDATED / DELETED), resource (model + PK), timestamp, IP address, and the field diff (before → after for updates).

**Deduplication:** `AUDITTRAIL_DEDUP = {'window_seconds': 3}` — consecutive identical events by the same actor within 3 seconds are collapsed into one row. Rapid successive clicks or automated bulk updates produce a single audit event, not fifty.

**Rule evaluation audits.** `MatchOnlyAuditEvaluationService` writes a `RuleEvaluation` row (and audit-trail event) **only when a rule matches** a shipment. Non-matching evaluations are silent. This is deliberate: a policy with 50 rules would otherwise write 50 rows for every shipment.

**Retention:** `expires_at` attribute set at write time, typically 2 years, enforced by DynamoDB native TTL. Older data expires automatically.

**Read access:**

- **HTMX UI** at `/audit/docs/` — timeline feed with filters by page, event type, actor, date range. Each entry expandable to full detail.
- **REST API** at `/api/v1/audit_trail/` — paginated search with filters. Read-only.
- **Direct DynamoDB** at `/api/v3/audit-events/` — lower-level access for exporters.

### Where they overlap and where they don't

- **Both fire from post-save signals** — same trigger, different consumers.
- **Analytics stream is business-facing** — it's for BI, reconciliation, downstream systems (BMS, GeoRisk, data warehouse). Payload is business-domain.
- **Audit trail is compliance-facing** — it's for regulators, examiners, incident forensics. Payload is field-level diffs.
- **Deduplication differs.** Analytics dedups by retry state (PENDING → SENT). Audit dedups by identical events within 3s.
- **A single model change may create both** — a `PolicyVersionItem` booking creates a `shipment.updated` analytics event AND an audit-trail row for the field diff.
- **Audit trail is the source of truth for who did what.** Analytics is not — it's a business-metrics stream.

### Data-warehouse consumers

Downstream from the analytics stream:

- **AWS Athena** materialises the S3 partitions into query-able tables (`nacora_shipments`, `nacora_policies`, `nacora_bordereaux`, etc.).
- **BI dashboards** — Looker or QuickSight query Athena for premium trends, top brokers, retention, referral rates.
- **Sister BMS system** — consumes `policy.activated`, `policy.endorsed`, `policy.cancelled` events via the BMS webhook for invoicing and commission reconciliation.
- **GeoRisk** — consumes shipment bookings via its own outbound webhook (not the same as analytics events, but originates from the same post-save signal). See APIs & Integrations.

### Feature flags

- `EVENT_STREAM_ENABLED_EVENTS` — per-event on/off (dict).
- `NACORA_ANALYTICS_SETTINGS['STALE_SYNC_ENABLED']` — nightly re-emit for drift recovery.
- `AUDIT_TRAIL_ENABLED` — global on/off for audit dispatch.
- Individual audit registrations can be disabled per model by removing the entry from `AUDITTRAIL_MODELS` (redeploy required).

## Business rules & operational constraints

- **Both streams are best-effort.** Failed events land in Sentry with the payload; the platform does not block the user's action on delivery failure.
- **Analytics stream retries every 5 min** via `requeue_stuck_data_streams`. Bounded queue depth means brief outages self-heal.
- **Audit trail is append-only.** No API path deletes or updates rows. TTL is the only way rows disappear.
- **Rule evaluation is match-only.** Silent non-matches keep the audit trail readable. Debugging why a rule *didn't* match requires reading the DB, not the audit trail.
- **FX rate misses produce null base amounts** in the analytics stream. Analytics excludes them; do not silently 1:1-convert.
- **Cluster map is manual.** Adding a broker cluster requires a code change to `NACORA_ANALYTICS_SETTINGS['CLUSTER_MAP']` and a deploy.
- **Audit deduplication is per-actor, per-resource, per-field.** Two different actors editing the same field within 3s produce two events. One actor rapidly editing the same field within 3s produces one.
- **Real-time audit dispatch requires the audit worker to be running.** If it's down, events queue in RabbitMQ up to broker capacity. Sentry alerts on queue depth.

## Related concepts

- Background Jobs & Celery
- APIs & Integrations
- Security & Permissions
- Architecture Overview
