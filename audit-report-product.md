# Product Space — Audit & Discovery Report

**Generated:** 2026-07-03
**Author:** Senior technical writer pass over the Product space.
**Scope:** 57 existing pages under `content/product/*.md`, audited against the InSurance / nacora-embedded-cargo / nacora-shipment-portal code surface, the KT doc transcript, the official docs at nacora-docs.i2go.io, and the MGA Jira board (filter 12060).

---

## Environmental constraint on this pass

The InSurance source repo (`/Users/tigerlab/Downloads/GitHubProjects/InSurance`) was **not accessible** in this session due to sandbox scoping. The auditor could not read source files directly. Inventory below is therefore derived from:

1. The existing 57 Product pages (which were themselves grounded in the code during prior sessions).
2. Cross-references between pages that expose latent gaps.
3. Ticket keys already inlined in the prose (I2G-29xxx and I2G-30xxx series from filter 12060).
4. The KT doc content the pages carry.

Where the code would have been the only authoritative signal (e.g. a subtle back-end job with no user-visible surface), the audit conservatively skipped rather than invent detail. That backlog is captured at the end under **Discovery backlog — not touched this pass**.

---

## Method

Every page was read end-to-end and classified against the seven-section mandatory floor:

- **What it is / Who uses it & where / How it works / Options & choices / Business rules & calculations / States & transitions / Related concepts.**

Classifications:

- **ADEQUATE** — end-to-end, mandatory sections present, option lists exhaustive, rules stated, journeys stepped. No action.
- **NEEDS EXPANSION** — specific gaps identified. Fix in place.
- **INADEQUATE** — stub or badly summarised. Full rewrite.
- **MISSING** — feature exists (referenced from other pages, in Jira, or in KT) but no dedicated page.

---

## Tier 1 feature inventory (Product space)

Grouped by capability cluster.

### Access, identity, permissions

| Feature | Existing page | Classification |
|---|---|---|
| Sign-in flows (Backoffice SSO, Backoffice direct, Portal SSO, Portal OTP) | `login.md` | ADEQUATE |
| Roles and portal split | `roles-and-portals.md` | ADEQUATE |
| Permissions layer (nav, queryset, object) | `permissions.md` | ADEQUATE |
| Admin approvals queue for pending users | `admin-queue-approvals.md` | ADEQUATE (verified) |
| Session lifecycle, sign-out, timeout | covered in `login.md` | ADEQUATE |
| First-day guides for each role | `first-day-guides.md` | ADEQUATE |

### Business Partner & organisation model

| Feature | Existing page | Classification |
|---|---|---|
| Business Partner master concept | `business-partner.md` | ADEQUATE |
| Broker Companies partner type | `partner-type-broker-companies.md` | ADEQUATE |
| Insurance Companies partner type | `partner-type-insurance-companies.md` | ADEQUATE |
| Participant Companies partner type | `partner-type-participant-companies.md` | ADEQUATE |
| Policyholders partner type | `partner-type-policyholders.md` | ADEQUATE |
| Surveyor Groups partner type | `partner-type-surveyor-groups.md` | ADEQUATE |
| Cluster-level configuration | `cluster-level-configuration.md` | ADEQUATE |

### Policy lifecycle

| Feature | Existing page | Classification |
|---|---|---|
| Policy Creation (wizard end-to-end) | `policy-creation.md` | ADEQUATE |
| Configuration Steps Overview | `config-steps-overview.md` | ADEQUATE |
| Policy Lifecycle & statuses | `policy-lifecycle.md` | ADEQUATE |
| Policy Duplication | `policy-duplication.md` | ADEQUATE |
| Adjustments (MTA) | `adjustments-mta.md` | ADEQUATE |
| Cancellations (policy + shipment) | `cancellations.md` | ADEQUATE |
| Renewals | `renewals.md` | **NEEDS EXPANSION** — missing options/choices table, missing full state list, no journeys for the underwriter or finance role, no "renewed policy statuses" table, thin edge cases |
| Policy Billing Setup | `policy-billing-setup.md` | ADEQUATE |
| Risks — configuration umbrella | `risks-configuration.md` | ADEQUATE |
| Risks — Commodity Groups | `risks-commodity-groups.md` | ADEQUATE |
| Risks — Conveyance | `risks-conveyance.md` | ADEQUATE |
| Risks — Countries | `risks-countries.md` | ADEQUATE |
| Risks — Coverages | `risks-coverages.md` | ADEQUATE |
| Risks — Packing | `risks-packing.md` | ADEQUATE |

### Shipment lifecycle

| Feature | Existing page | Classification |
|---|---|---|
| Shipment Portal | `shipment-portal.md` | ADEQUATE |
| Quote Creation (declaration → quote → book) | `quote-creation.md` | ADEQUATE |
| Shipment Endorsing (amendment) | `shipment-endorsing.md` | ADEQUATE |
| Shipment Statuses | `shipment-statuses.md` | ADEQUATE |
| Bulk Upload | `bulk-upload.md` | ADEQUATE |
| User Preferences & Listing Configuration | `shipment-preference-persistence.md` | ADEQUATE |
| User Journeys & Screens | `user-journeys.md` | ADEQUATE |
| Dashboard Pages Reference | `dashboard-pages-reference.md` | ADEQUATE |

### Rating

| Feature | Existing page | Classification |
|---|---|---|
| Rating overview | `rating.md` | ADEQUATE |
| Rating Lookup Tables (Routes, Commodity Groups) | `rating-lookup-tables.md` | ADEQUATE |
| Special Rate | `special-rate.md` | ADEQUATE |
| Special Rate Request Flow | `special-rate-request-flow.md` | ADEQUATE |
| Special Rate Statuses | `special-rate-statuses.md` | ADEQUATE |

### Referral, review, compliance

| Feature | Existing page | Classification |
|---|---|---|
| Referral Management | `referral-management.md` | ADEQUATE |
| Sanctions & Compliance | `sanctions-and-compliance.md` | ADEQUATE |
| Business Rules | `business-rules.md` | ADEQUATE |
| Clauses | `clauses.md` | ADEQUATE |
| Choices | `choices.md` | ADEQUATE |
| Commodity Group Suggestion (AI) | `commodity-group-suggestion.md` | ADEQUATE |

### Documents, notifications, integration

| Feature | Existing page | Classification |
|---|---|---|
| Documents (quote/certificate templates + editor) | `documents.md` | ADEQUATE |
| Numbering | `numbering.md` | **NEEDS EXPANSION** — options list of every numbered entity incomplete (Certificate numbers, Referral numbers, Special Rate Request numbers, Bordereau numbers, Endorsement numbers); no state impact rules; no cross-reference to "certificate number editable at issuance" behaviour |
| Mail Notifications & Templates | `mail-notifications.md` | **NEEDS EXPANSION** — recipient list rules good; missing exhaustive **template catalogue** (all trigger points), missing per-role notification matrix, missing options for language/branding, no journey for the admin resending a failed mail, no state machine for a queued mail |
| SOAP Inbound Integration | `soap-inbound-integration.md` | **NEEDS EXPANSION** — operations named but not enumerated (BookShipment, VerifyCoverage, GetCertificate, QueryShipment, ChangeShipment, CancelShipment); fault code table incomplete; no request/response state machine; no options list for locale, dry-run, idempotency window |
| Third-Party Integrations | `third-party-integrations.md` | ADEQUATE |
| Webhooks & Event Stream | `webhooks-event-stream.md` | **NEEDS EXPANSION** — event catalogue incomplete (only `policy.activated`, `policy_item.activated`, `bordereau.created` named); no full trigger-by-trigger table, no per-event enrichment fields, no dead-letter journey for ops |
| Celery Tasks & Async Processing | `celery-tasks.md` | **NEEDS EXPANSION** — no exhaustive task catalogue (email queue, FX sync, rating publish, bulk-upload rows, analytics streaming, audit dispatch, renewal reminder cron, quote-expiry cron, special-rate-inactivity cron, bordereau generation, etc.); no options list; no state machine for a task |
| Billing | `billing.md` | ADEQUATE |
| Analytics & Reporting | `analytics-reporting.md` | ADEQUATE |
| Audit Trail Module | `audit-trail-module.md` | ADEQUATE |
| Embed Dashboard | `embed-dashboard.md` | ADEQUATE |
| FAQs & Knowledge Base | `faqs-knowledge-base.md` | ADEQUATE |

### Missing pages (feature exists, no dedicated page)

The following capabilities are referenced across the KB but do not have their own Product page. They meet the "own workflow, own options, own state, own permission model" bar.

| Feature | Justification | Classification |
|---|---|---|
| **Exchange Rates administration** | Called out in `roles-and-portals.md` and `dashboard-pages-reference.md` as a sidebar module; owned by admins; feeds FX conversion across rating and billing; has its own screen and its own daily-sync behaviour | **MISSING** |
| **Claims (3-step logging MVP)** | KT and CLAUDE.md flag it explicitly ("Claims is 3-step logging only. Full claims + LIMs/TIPs vendor pick is post-MVP"). No page. | **MISSING** |
| **Referral Activity Page** | Explicitly named in the KB style guidance (BA-allowed term) and cross-referenced from `referral-management.md`. Has its own layout, its own actions, its own history rendering. | **MISSING** — folded into `referral-management.md` today but deserves its own page for BA navigability |
| **Named Assured management** | Concept threaded through `quote-creation.md`, `permissions.md`, and `business-partner.md`. Has its own inline-create workflow, own auto-create rule under bulk, own visibility on documents. No dedicated page. | **MISSING** |
| **Search & Filter behaviour** | Cross-cutting pattern (server-side search across multiple fields, filter panel, per-listing persistence); referenced by every dashboard page; no consolidated page explaining what the search field matches or how filters combine | **MISSING** |
| **Global Clauses Library** | Distinct from per-policy clauses; separate administration surface; separate audit; owned by admins; separate journey. The `clauses.md` page mixes both concepts. | **MISSING** — split from clauses would improve navigability, but on balance `clauses.md` already covers global vs policy well. **Reclassify to ADEQUATE (in clauses.md)** |
| **Emails Tab (Shipment 360)** | Named on `quote-creation.md` and `shipment-portal.md` as one of six shipment tabs; has its own filtering and its own record type; no dedicated explanation of what it shows or what triggers each row | **MISSING** — will be folded into `mail-notifications.md` expansion |

Final MISSING list to be **created** as new pages this pass:

1. `exchange-rates.md`
2. `claims.md`
3. `referral-activity-page.md`
4. `named-assured.md`
5. `search-and-filter.md`

---

## Delivery plan

- Expand `renewals.md`, `numbering.md`, `mail-notifications.md`, `soap-inbound-integration.md`, `webhooks-event-stream.md`, `celery-tasks.md` to the seven-section floor.
- Create the five MISSING pages.
- No ADEQUATE pages will be re-touched (per instruction: "Note it and move on").

---

*Delivery summary appended at bottom after execution.*

---

## Delivery notes

- `webhooks-event-stream.md` — expanded to the seven-section floor (198 lines, ~4,045 words). Added full event catalogue, per-event enrichment, outbound webhook catalogue (GeoRisk + BMS), Kinesis Firehose pipeline description, dead-letter journey and Ops actions, feature-flag hierarchy, cluster-map maintenance, EUR/FX conversion rules, and full state machine. Done 2026-07-04.
- `celery-tasks.md` — expanded to the seven-section floor (197 lines, ~3,503 words). Added full task catalogue by queue, Beat schedule table, task state machine, configuration options, monitoring tools, and idempotency guarantees. Done 2026-07-04.
