# Data Model & Entities

## What it is

The Nacora data model is the shared TigerLab platform schema with a small amount of Nacora-specific extension. There are ~60 tables in the PostgreSQL database; a much smaller set carries the load. This page catalogues the core entities, their relationships, and the ORM patterns used to link them together — enough for a new engineer to reason about any query that comes through the API.

## Who uses it & where

- **Backend engineers** designing service classes, writing migrations, or debugging N+1 queries.
- **Data engineers** who need to understand event stream payload shapes before consuming from Athena.
- **QA and support** who trace a support ticket from Referral → Shipment → Policy → BusinessPartner.

## How it works

### Cross-cutting patterns

Before enumerating entities, four platform-wide conventions:

- **`AbstractModel` base.** Every domain model inherits from an abstract base that provides `uuid` primary key, `created_at`, `updated_at`, `deleted_at` (soft delete), `is_deleted`, and `is_active` fields. Queries by default exclude `is_deleted=True` rows through a custom manager.
- **GenericForeignKey.** Extensively used to link cross-cutting entities to any target model — `Activity`, `Note`, `Attachment`, `Referral`, `Rule`, `ClauseObjectRelation`, and `FAQEntryObjectRelation` all use `content_type` + `object_id` to point at policies, shipments, partners, or anything else.
- **Reversion.** `django-reversion` is installed and can create model-level revisions on demand. It is not the audit trail (which lives in DynamoDB) but is the mechanism behind version-history restores.
- **JSON attributes.** Many entities carry a `metadata`, `extra_data`, or `attributes` JSON column for flexible per-instance data (e.g. `PolicyVersionItem.attributes` is the entire shipment declaration). Query with the Django JSONField operators (`__contains`, `__has_key`, etc.).

### Business Partner side

The Business Partner (BP) is the unified identity model. Users, insurers, brokers, participants, and named assureds are all Business Partners; a "user account" is just a Person BP linked to a `User` record.

| Model | Purpose | Key fields |
|---|---|---|
| `BusinessPartner` | Person / Group / Company. FK to `User` (optional). | `category` (PERSON/GROUP/COMPANY), `first_name`, `last_name`, `nickname`, `email_primary/correspondence/billing`, `phone_mobile/work`, `dob`, `gender`, `registration_name`, `registration_code`, `extra_data` (JSON), `profile_picture`, `correspondence_language`, `preferred_communication` |
| `BusinessPartnerRole` | Role attached to a BP (POLICY_HOLDER, PARTICIPANT_COMPANY, PRODUCER, UNDERWRITER, NAMED_ASSURED, ADMINISTRATOR, INSURED_OBJ_*, CONTACT_PERSON, etc.). M2M. | `name`, `code`, `description` |
| `BusinessPartnerRelation` | Directed edge linking two BPs with a relation type. | `from_partner`, `to_partner`, `relation_type` (FK to `RelationType`), `created_at` |
| `Address` | Postal address. M2M to BP. | `line1`/`2`/`3`, `city`, `postal_code`, `country`, `state`, `district`, `building_name`, `unit_number`, `extra_data` |
| `AttributeValue` | Generic key-value pair on a BP. Renders as extra form fields on the partner detail page. | `partner`, `attribute` (FK to `Attribute`), `value`, `file`, `image` |
| `SalesAccount` | Grouping for sales-team members and customers. | `name`, `code`, `members` (M2M BP), `customers` (M2M BP), `is_subscribed` |
| `Group` | Django group; used together with `guardian` for object permissions. | `name` |

**Nacora usage:**

- Broker Company → `BusinessPartner` (COMPANY) + `BusinessPartnerRole` (PRODUCER or its Company-level equivalent).
- Policyholder → BusinessPartner + role POLICY_HOLDER.
- Participant Company → BusinessPartner + role PARTICIPANT_COMPANY, linked to Policyholder via `BusinessPartnerRelation` (`policy_holder`, direction "to").
- Insurance Company (GFH, Allianz) → BusinessPartner + role UNDERWRITER at Company level.
- Individual user → BusinessPartner (PERSON) linked to `User` via FK.
- Cost centre lookup at SSO time: `BusinessPartnerUtil.resolve_cost_center()` in `src/clients/nacora/utils.py` calls KN PDM API and creates or updates the person's BP.

### Policy side

| Model | Purpose | Key fields |
|---|---|---|
| `Contract` | Umbrella for one or more Policies. Same holder. | `agent` (FK BP), `insurer` (FK BP), `policies` (reverse M2M), `number` |
| `Policy` | The insurance contract. | `number` (`MC-{:06d}`), `external_policy_number` (Salog side code), `holder` (FK BP), `product` (FK `Product`), `agent` (FK BP), `status` (FK `PolicyStatus`), `versions` (reverse), `cancel_date`, `future_cancel_date`, `latest_renewal_at`, `published_at` |
| `PolicyStatus` | Workflow status row. | `title`, `reason`, `order`, `slug` |
| `PolicyVersion` | One iteration/endorsement of a Policy. Increments on every change. | `number`, `policy`, `state` (DRAFT/ACTIVE/ENDORSED/…), `title` (New Business / Endorsement / Renewal / Cancellation), `start_date`, `end_date`, `published_at`, `policy_term` (ANNUAL/MONTHLY/…), `attributes` (JSON policy-level params), `endorsement_note`, `is_current_version`, `incomplete_order` (FK Quotation) |
| `PolicyVersionItem` (shipment) | Line item on a PolicyVersion — a shipment. | `number` (certificate number, format `<policy>-{:06d}`), `parent` (FK PolicyVersion), `name`, `status` (DRAFT/QUOTED/REFERRED/BOOKED/CANCELLED/DECLINED/EXPIRED/OBSOLETE + Nacora-specific 100/110/120/130/140/150), `attributes` (JSON shipment declaration), `details` (JSON: named assured, participant company, tracking number, booking date, …), `pricing_breakdown` (JSON: base rate, cargo premium, charges by level, total premium in billing + base currency, FX rate), `metadata` (JSON) |
| `Quotation` | Quote state (progress %, expiry). | `number`, `policy_version` (FK), `progress` (0–100), `status` (OPEN/EXPIRED/PAID/DRAFT/…), `expiry_date` |
| `IncompleteOrder` | Legacy — superseded by `Quotation`. Retained for old rows. |  |

**Version semantics.** Each material change creates a new PolicyVersion:

- **New Business** → title=New Business, state=DRAFT, then ACTIVE on publish.
- **Endorsement / MTA** → title=Endorsement, references the parent policy, changes take effect from `start_date` of this version.
- **Renewal** → title=Renewal, chains from the latest active version.
- **Cancellation** → title=Cancellation, state=PUBLISHED, `is_current_version=True`, previous versions marked `is_current_version=False`.

Only one version is `is_current_version=True` at a time; historical shipments continue to reference the version they were quoted under.

### Rating side

| Model | Purpose | Key fields |
|---|---|---|
| `SpecialRateRequest` | Broker/participant request to override the default rating. | `reference` (`SRR-YYYY-{n}`), `title`, `policy` (FK), `partner` (FK requester BP), `assigned_to` (FK rater BP), `status` (DRAFT/PENDING/AWAITING_APPROVAL/APPROVED/DECLINED), `remarks`, `metadata`, `risks` (reverse), `combinations` (reverse) |
| `Risk` | A rating dimension on an SRR ("Commodity Risk", "Route Risk"). | `special_rate_request` (FK), `name`, `dimensions` (JSON list of factor names), `factors` (JSON), `factor_type` (CONTINUOUS/CATEGORICAL/RANGE), `result_type` (PERCENTAGE/FIXED/RATE) |
| `RiskFactorCombinations` | Lookup row: combination → premium/rate + clauses. | `special_rate_request` (FK), `key_values` (JSON: {commodity: "X", conveyance: "Y", …}), `key_signature` (hash of key_values), `factor_values` (JSON), `factor_signature` (hash), `return_type` (PERCENTAGE/FIXED/RATE), `special_rate` (Decimal), `min_premium` (Decimal), `special_condition` (text), `status` (DRAFT/ACTIVE/ARCHIVED), `is_active`, `clauses` (via `ClauseObjectRelation`) |
| `ExchangeRate` (from `submodules.currencies`) | Daily FX rate. | `from_currency`, `to_currency`, `rate` (Decimal), `date` |
| `LoadFactor` | Percentage or fixed load applied at rating time. | `name`, `product` (FK), `product_coverage` (FK), `percentage`, `factor`, `premium`, `start_date`, `end_date`, `is_active` |

**Rating lookup path.** `ShipmentRatingResponseService` in `src/clients/nacora/ratings/services.py`:

1. Build lookup key from shipment attributes: `{commodity_group, packing, conveyance, coverage, departure_country, destination_country}`.
2. Query the policy's Base Rater catalogue (external service) for the base row.
3. Search `RiskFactorCombinations` where `special_rate_request__policy=policy`, `status=ACTIVE`, `is_active=True`, `key_signature=<hash>`. If a match is found, override the base rate with the SRR's `special_rate` and `min_premium`.
4. Evaluate business rules; a rule with `action_type=SET_MIN_PREMIUM` bumps the floor.
5. Compute FX conversion via `ExchangeRate` (yesterday's rate cross-piloted via USD).
6. Persist final breakdown to `PolicyVersionItem.pricing_breakdown`.

### Clause side

| Model | Purpose | Key fields |
|---|---|---|
| `ClauseCategory` | Hierarchical grouping. Parent → child. | `name`, `code` (unique), `parent` (FK self), `description`, `display_order`, `is_active` |
| `Clause` | Insurance wording. Multi-versioned by `code`. | `code`, `version` (int), `name`, `summary`, `wording` (template with `{{vars}}`), `category` (FK), `partner` (FK insurer/owner BP), `clause_type` (COVERAGE/EXCLUSION/CONDITION/WARRANTY/ENDORSEMENT/DECLARATION/DEFINITION), `status` (DRAFT/UNDER_REVIEW/APPROVED/ACTIVE/DEPRECATED/ARCHIVED/INACTIVE), `effective_date`, `expiration_date`, `lines_of_business` (JSON), `jurisdictions` (JSON), `is_nested`, `details` (JSON) |
| `ClauseObjectRelation` | GenericForeignKey linking clause ↔ any model. Used to attach clauses to `PolicyVersionItem`, `RiskFactorCombinations`, `PolicyVersion`, and more. | `clause` (FK), `content_type` (CT), `object_id` (UUID), `content_object` (GFK), `description`, `metadata`, `is_special` (bool for special/override clauses) |

The clause library is a two-layer model: a **global clauses library** (`Clause` rows with `partner=NULL` or platform-owner) and **policy-level clauses** attached via `ClauseObjectRelation`. Editing a global clause creates a new version but does not affect PDFs already rendered against the previous version.

### Business rules side

| Model | Purpose | Key fields |
|---|---|---|
| `Rule` | Business rule with conditions and actions. Number `BR-{:06d}`. | `name`, `slug`, `number`, `description`, `category`, `priority` (lower runs first), `condition_logic` (ALL/ANY), `content_type` (GenericForeignKey target — e.g. Policy or Product), `object_id`, `effective_date`, `status` (DRAFT/INCOMPLETE/ACTIVE/ARCHIVED/INACTIVE), `meta_data` (JSON) |
| `RuleCondition` | One "if" clause. | `rule` (FK), `attribute_display_name`, `operator` (`equals`, `not_equals`, `contains`, `starts_with`, `in`, `not_in`, `lt`/`lte`/`gt`/`gte`, `within_distance`, `CEL`), `value` (JSON), `ordering` |
| `RuleAction` | One "then" clause. | `rule` (FK), `action_type` (`SET_MAX_LIMIT` / `SET_MIN_PREMIUM` / `ATTACH_CLAUSES` / `QUESTIONS` / `REFERRAL` / `DECLINE`), `reason` (text), `parameters` (JSON) |
| `RuleEvaluation` | Audit log of rule execution on an object (via `MatchOnlyAuditEvaluationService`, only matched rules produce rows). | `rule` (FK), `content_type`, `object_id`, `evaluated_at`, `matched`, `result` (JSON) |

**Evaluation order.** Platform-set rules first (categories: REFERRAL, SANCTIONS, VESSEL_REFERRAL, NO_APPLICABLE_RATES), then policy-custom rules by ascending `priority`. Non-matching rules produce no audit rows.

### Choices & lookups

| Model | Purpose |
|---|---|
| `ChoiceType` | List definition. `slug` acts as key ("commodity_groups", "conveyance", "packing", "coverages", "currency", …). Can be scoped by product or model via `content_type`+`object_id`. |
| `Choices` | Individual value in a ChoiceType. `key` is the internal identifier used in rating; `value` is the display; `config_attributes` (JSON) holds region, HS code range, symbol, currency name, etc. |
| `LookupCategory` | Global reference table (e.g. Routes, Commodity Groups grouping). `is_global` marks tables shared across all products. |
| `LookupItem` | Row in a `LookupCategory`. Hierarchical via `parent`. `extra_data` (JSON) carries per-item metadata (region, HS code range, currency symbol). |
| `LookupItemAttribute` | Extra key-value attribute on a `LookupItem`. |

`BiDirectionalLookupService` (registered as `CUSTOM_CHOICES_LOOKUP_ITEM_SERVICE`) resolves lookups in both directions — for example turning an internal commodity `key` back into the Salog numeric code required in outbound integrations, and vice versa on inbound SOAP.

### Activity, referral, and attachment side

| Model | Purpose |
|---|---|
| `Activity` | Task or activity record — a to-do on any object. Generic FK. |
| `ActivityType` | Template (e.g. "Follow-up Call", "Underwriting Review"). |
| `Referral` | Escalation on a shipment or policy. Assigned to an underwriter. Status: OPEN / ACCEPTED / DECLINED / CLOSED. Generic FK. |
| `Note` | Free-text annotation on any object. Generic FK. |
| `Attachment` | File in S3 or local storage. Generic FK. `attachment_folder` for organisation. |
| `AttachmentFolder` | Hierarchical grouping of attachments. |
| `Status`, `Priority` | Choice tables used by Activity and Referral. |

**Referral choreography** (`ReferralService.handle()` in `src/clients/nacora/i2go_activities/services.py`):

- Rule action `REFERRAL` fires → `Referral` row created, status=OPEN, `assigned_to` from rule params or policy agent.
- `Activity` opened linked to the same shipment for the assignee's queue.
- Email dispatched via `send_templated_notification`.
- Underwriter responds with approve / decline / request-more-info → status transitions and shipment status resolves.

### Financials

| Model | Purpose |
|---|---|
| `Transaction` (`src/payments/`) | Ledger entry. Type: DEBIT / CREDIT / REVERSAL. |
| `Commission` (`src/commissions/`) | Broker/agent commission line. Status: PENDING / APPROVED / PAID. |
| `Bordereau` (`src/bordeareaux/`) | Slip / manifest — batch of policies to the insurer. M2M to PolicyVersion. |
| `Payment` (`src/payments/`) | Payment against a Quotation. |

Nacora billing flows are ultimately reconciled in the sister BMS system — this platform emits the bordereau event and the transaction ledger; the BMS side runs invoicing and cash allocation.

### Dynamic templates (documents)

| Model | Purpose |
|---|---|
| `DynamicTemplate` | Base template — Quote PDF, Certificate PDF, email body, etc. Content-type-scoped. |
| `DynamicTemplateVersion` | Versioned iteration of a template. `status` (DRAFT/ACTIVE/ARCHIVED), `effective_date`. |

`DocumentGenerationService` (`src/clients/nacora/documents/services.py`) resolves the active template version for a given `(policy, doc_type, language)` tuple, binds it against the page context, and renders via weasyprint.

### Numbering

The `submodules.numbering.NumberingMixin` provides `_generate_number(kind=…)`. Under the hood it looks up the next sequence from `numbering.models.Numbering` — a small counter table keyed by kind. Format strings live in settings: `POLICY_NUMBERING_PATTERN`, `RULE_NUMBERING_PATTERN`, `CLAUSE_NUMBERING_PATTERN`, plus per-quotation and per-shipment increments computed dynamically. Shipment numbering is careful about MTA/renewal continuity — the sequence value is stored on the `PolicyVersion.extra_data['shipment_latest_number']` and inherited on version creation so numbers are never reused.

### Audit trail (separate storage)

The `audit_trail` app writes events to **DynamoDB** (`audit_events` table in eu-central-1), not to PostgreSQL. Every material change on a model registered in `audittrail_settings.py` produces an event with the actor, timestamp, action, resource IDs, and field diff. See Event Stream & Audit Trail for the full model.

## Business rules & data constraints

- **UUID primary keys everywhere.** No sequential integers on business rows. Predictable-ID attacks and enumeration are structurally prevented.
- **Soft delete by default.** `is_deleted=True` hides a row from default querysets; nothing is physically removed. Cascade delete of a Broker Company can silently cascade down to children — always prefer deactivation.
- **JSON attribute fields are unindexed** unless a `GinIndex` is declared on the model. Filtering by nested JSON keys at scale requires either an index or a materialised view.
- **GenericForeignKey referential integrity is application-level.** Deleting the target of a `content_type` + `object_id` link does not cascade to the link row unless a signal handler is registered. Always check for orphan links after mass deletes.
- **`is_current_version=True` invariant.** Exactly one PolicyVersion per Policy has this flag set. Activation of a new version explicitly flips the old one to false in the same transaction.
- **Shipment numbering continuity across versions.** New PolicyVersion inherits `shipment_latest_number` from parent; do not create versions manually or via raw SQL.
- **RiskFactorCombinations uniqueness is by (special_rate_request, key_signature) only.** Deactivating an existing combination reverts to base rate; a new combination with the same key overrides the old. Latest-active wins.
- **Audit trail is append-only.** Application code never issues `UpdateItem` or `DeleteItem` on the audit table.
- **Post-save signals dispatch heavy work off-thread.** Model save latency stays predictable because Celery, audit-trail dispatch, and event-stream emit all happen asynchronously.

## Related concepts

- Architecture Overview
- Repo Map
- APIs & Integrations
- Event Stream & Audit Trail
- Security & Permissions
