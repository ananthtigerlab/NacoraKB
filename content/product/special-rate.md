# Special Rate

## What it is

A **Special Rate** is a non-standard, negotiated rate that applies to a specific combination of risk factors on a specific policy. It exists to handle one-off pricing decisions the standard Base Rater cannot cover: a particular commodity on a particular route for a defined period, a strategic customer with a bespoke rate, a temporary discount, a promotional rate, or any negotiated deal that would be inappropriate to add to the general rate table.

There are two related entities to understand:

- A **Special Rate Request** is the application submitted by a producer, broker, or participant asking the underwriter to publish a special rate. A request has a lifecycle: Draft → Pending Approval → Approved → In Use → Expired, with Declined as a terminal side-path.
- A **Special Rate** is the approved, published rate that the platform's rating engine picks up automatically whenever a shipment matches its scope. It is the outcome of a confirmed request.

Special Rates are consumed by the **Special Rater**, which the platform consults alongside the **Base Rater** at rating time. If an active Special Rate matches the shipment's permutation, its values override the Base Rater's cell. If no Special Rate applies, the shipment falls back to the Base Rater.

## Who uses it & where

- **Producers, brokers, and participants** submit requests, either from the Back Office or from the Shipment Portal. What they see on the request form depends on the role signing in.
- **Underwriters (Back Office users)** review requests in the Pending Approval queue and decide combination by combination whether to approve, decline, or send back for revision.
- **The rating engine** looks for a matching Special Rate every time it rates a shipment on a policy that has any approved Special Rates. If it finds one, it applies it. If it does not, it falls back to the Base Rater.
- **Analytics and finance** can download the list of active Special Rates and the shipments that used them.

Special Rates are surfaced through two dashboards:

- The **Special Rates Dashboard** lists approved and in-use rates — everything that is either live now or will be live once its effective date arrives. Use this dashboard to audit what rates exist, investigate a specific shipment's premium, or start a fresh request from the same screen via **Create Special Rate**. The dashboard header also carries a **Bulk Upload** action for creating many Special Rates in one operation (from I2G-29868 and I2G-30080) — the user downloads a template, fills it with the combinations, and uploads. The platform validates the file, creates one Special Rate Request per row (or a consolidated request per grouping, depending on the file structure), and returns a per-row error report for anything that failed validation.
- The **Special Rate Requests Dashboard** lists every request regardless of state, with tabs filtering by lifecycle: **Draft**, **Pending Approval**, **Approved**, **Declined**, and **In Use**. This is the shared working surface for submitters and approvers alike.

Visibility on the requests dashboard is role-scoped. Submitters see the requests they created; Back Office users see every request in the system. The underlying record is the same — only the filter changes.

## How it works

### The two-step request form

A Special Rate Request is created through a two-step form. Step 0 defines the scope; Step 1 lists the specific rate lines the Back Office will review.

**Step 0 — General Details.** The submitter picks the **Policy** the rate will apply to, then defines the **scope** of the rate. Scope dimensions typically include:

- The route (departure and destination).
- The commodity group.
- The conveyance.
- The effective date and the expiry date.

At least one scope dimension is required, and the scope must be consistent with the policy — picking a commodity group the policy does not allow raises a validation error at this step. The submitter also adds a free-text **description** explaining why the rate is needed. That description travels with the request through the whole lifecycle and shows up during underwriter review.

**Step 1 — Combinations.** The combinations table is the heart of the request. Each row is one specific tuple of risk factors paired with a suggested rate — the actual pricing lines the Back Office will review.

To add a combination, the submitter clicks **Add combination** to open a side drawer. Inside the drawer they set the **risk factors** (matching the dimensions defined in Step 0), enter the **suggested rate**, and add any per-combination charges. They save the combination and repeat until every proposed line is present. Rows can be removed via the row controls.

**Custom special conditions inline.** From the same drawer the submitter can enter a one-time **special condition** — a piece of bespoke wording that will attach to shipments matching this combination only (from I2G-29925). Unlike a full clause added to the global or policy library, an inline special condition does not require the mandatory clause metadata (category, insurer, cluster) and is scoped strictly to the combination on this request. It is not promoted to the policy's clause library and is not available to any other combination or shipment. This is the right pattern for one-off underwriting concessions that would clutter the library if added there.

**Participant Company scope.** The SRR now supports three modes for participant selection (from I2G-29934): **All Participant Companies** (the rate applies to every participant on the policy), **multi-select** (a specific subset), or **single** (one participant only). If the user submitting the request has access to only one policy, that policy is pre-selected automatically and the participant selector reflects the participants on that policy. Back Office approvers see the participant scope on the request header before confirming.

### Submitting the request

The buttons shown at the bottom of the form depend on who is signed in:

- **Participants** (and other submitters from the Shipment Portal) see **Submit for Approval**. Clicking it moves the request to **Pending Approval** and drops it into the Back Office queue, notifying the underwriter assigned to the policy.
- **Back Office users** see two additional actions: **Confirm Rates** (direct approval, available only when every combination has a defined rate) and **Save Draft** (parked in Draft, no one notified).
- A saved **Draft** notifies no one and remains editable by the author until they submit it.

### Approving in the Back Office

Approval is one of the highest-leverage actions an underwriter takes: once a rate is confirmed, it auto-applies to every matching shipment from that moment onward. Turnaround also matters, because whichever participant triggered the request is waiting for it.

Before deciding, an underwriter should:

- Read the description the submitter wrote in Step 0. It is the rationale for the ask and the primary context.
- Open the policy and compare the suggested rates against the Base Rater and the participant's shipping history. A small deviation is usually reasonable; a large deviation should be supported by evidence.
- Decide whether to act on the whole request at once (Confirm Rates / Decline All) or combination by combination. Both patterns are supported.
- Have clear reasons ready for any decline — reasons are permanent on the audit trail.

**Deciding combination by combination.** The request detail page shows each combination row with its own status: **Draft**, **Approved**, or **Declined**. To review one, the underwriter clicks the combination to open the side drawer, reads the proposed rate, and marks it **Approved** or **Declined**. Declined combinations require a reason.

**Finalising the request.** The header actions depend on the state of the combinations:

- **Confirm Rates** — available only when *every* combination is marked Approved. Clicking it promotes the request to a published Special Rate.
- **Decline All** — rejects the entire request with a single reason. Terminal.
- **Edit** — reopens the form. Available while the request is in Draft or Pending Approval.
- **Change Assignee** — reassigns review to a different Back Office user.
- **Duplicate** — creates a copy as a starting point for a new request.
- **Delete** — removes the request. Only allowed in early lifecycle states.

The underwriter cannot Confirm Rates while any combination is still Draft or Declined; every combination must be resolved first.

**Business rule bypass on approval.** Before pressing Confirm Rates, the approver picks one of three options that determine how future shipments matching this Special Rate are evaluated against the policy's Business Rules (from I2G-29887):

- **Apply all Policy Business Rules** — every active rule on the policy is evaluated on each matching shipment. This is the normal setting.
- **Apply sanctions-only rules** — only the sanctions and compliance rules run (Cargo Description Sanction Check, Departure Embargo, Destination Embargo, Sanction check). Non-compliance rules such as insured-value limits or vessel-age checks are skipped. Used when the Special Rate has already been agreed by underwriting and the intent is to let shipments through with only the mandatory compliance gate.
- **Always refer** — every matching shipment is referred regardless of rule outcomes. Used when the underwriter wants a manual eye on every shipment that lands under this rate.

The selection sits on the Special Rate itself and is visible in reporting, so the choice is auditable after the fact.

**Clause attachment under sanctions-only and always-refer.** Regardless of which bypass option is chosen, policy clauses are now attached to matching shipments. Under sanctions-only, the clause attachment runs alongside the sanctions check — non-compliance rules are skipped, but clauses still land on the shipment. Under always-refer, the clauses are attached before the referral is raised, so the underwriter sees the full clause picture on the referral activity page.

**Applicable-clauses preview.** The SRR form shows, per combination, which clauses will attach to a shipment matching that permutation based on the active Business Rules on the policy (from I2G-29727). This gives approvers the full clause scope before pressing Confirm Rates — no more surprises about which clauses end up on the certificate of a Special-Rate-priced shipment.

### Bulk vs individual approval

There are two supported patterns and they interact with combination-level status:

- **Bulk (Confirm Rates).** Only available when every combination on the request has already been approved individually or has a defined rate. It moves the whole request to Approved in one action.
- **Individual (per combination).** The underwriter approves or declines each row separately. The request itself flips to Approved only when the last combination is approved. Any combination left as Declined or Draft blocks the request-level Approved state.

### The rating engine picks up approved rates automatically

Once a request is confirmed, no manual step is needed to activate it on shipments. From that moment on, any shipment whose scope matches the combination inherits the special rate automatically. The premium reflects the Special Rate instead of the Base Rater cell, and the request transitions from **Approved** to **In Use** the first time a shipment actually matches it. Subsequent matches keep it in In Use.

If an approved rate does not appear on a shipment the participant expected, the reason is almost always scope: the shipment's route, commodity, conveyance, or dates do not fall within the combination defined on the request. In that case the standard Base Rater cell applies. Nothing is broken; the scope just does not match.

### Editing an existing request

The right to edit depends on status:

- **Draft** — the author can edit freely.
- **Pending Approval** — Back Office only.
- **Approved**, **Declined**, and **In Use** — read-only, with limited Back Office overrides.

To edit, open the request from the Special Rate Requests Dashboard, make changes to General Details or Combinations, and either **Save Draft** (still in Draft) or **Resubmit for Approval** (if it was sent back by the Back Office).

## Special Rate lifecycle

A Special Rate Request has five distinct statuses. The transitions are:

- **Draft** → **Pending Approval** by the author clicking Submit for Approval; or → deleted.
- **Pending Approval** → **Approved** when the Back Office confirms rates; or → **Declined** on rejection; or back to **Draft** if the Back Office sends it back for revision.
- **Approved** → **In Use** the first time a shipment matches; or → **Expired** if the end date passes before any shipment matches.
- **In Use** → **Expired** when the end date passes, *or* after 90 days of inactivity, whichever comes first.
- **Declined** and **Expired** are terminal.

### Ownership at each stage

| Status | Owner | Next action | Where it goes |
| --- | --- | --- | --- |
| **Draft** | The submitter (producer, broker, or participant) | Finish scope and combinations, then submit | Pending Approval or deleted |
| **Pending Approval** | Underwriter (Back Office) | Approve, decline, or send back | Approved, Declined, or back to Draft |
| **Approved** | System | Wait for a matching shipment | In Use (on first match) or Expired (if the end date passes first) |
| **In Use** | System | Apply the rate to matching shipments | Expired (end date, or 90 days of inactivity) |
| **Declined** | — | Terminal | — |
| **Expired** | — | Terminal | — |

### Combination-level vs request-level status

Each combination row inside a request carries its own status — Draft, Approved, or Declined. The request as a whole is only fully Approved once every combination is Approved. If any combination is Declined or Draft, the request-level status cannot move to Approved.

This is why partial approval is meaningful: the underwriter can approve most rows and decline the outliers, and the submitter is told exactly which rows survived rather than getting a blanket accept-or-reject on the whole application.

### Expiry rules

A Special Rate has two independent ways to expire, both enforced automatically:

- **By date.** Once the end date defined in the request passes, the rate moves to Expired. No renewal, no reminder — it simply stops being applied to new shipments.
- **By inactivity.** If no shipment matches the rate for 90 consecutive days, the rate moves to Expired even if its end date is still in the future.

There is no advance notification before expiry, and there is no "extend" action. Every new pricing period gets a fresh underwriting decision. If the rate is still needed after expiry, the submitter opens a new request.

## Business rules & calculations

- **The rate is not bounded.** A Special Rate can be higher or lower than the corresponding Base Rater cell — pricing is at underwriter discretion.
- **Minimum premium acts as a floor.** If the combination carries a minimum premium, the final shipment premium is at least that amount, whichever computation produces the highest number.
- **One active Special Rate per permutation, latest wins.** Creating a second Special Rate covering the same combination causes the newer one to be applied. The older one still exists but is not consulted for new shipments.
- **Deactivating a Special Rate reverts to the Base Rater.** Nothing else on the policy changes.
- **Notes on the request are internal.** The description the submitter writes surfaces during review and in reporting; it does not appear on the customer-facing quote or certificate.
- **Confirm Rates is irreversible in the "live rate" sense.** Once clicked, the rate is picked up by the rating engine on the next matching shipment. Underwriters should double-check the numbers before confirming.
- **Reductions of scope do not re-rate historical shipments.** Tightening a Special Rate stops it applying to future shipments but does not change premiums on shipments already quoted.
- **Declines are terminal but not blocking.** A declined request stays on record with its reason. The submitter can open a new request with revised combinations.
- **Approvals and declines are audit-tracked.** Every decision, reason, and reassignment writes to the audit trail. Old reasons remain queryable in history even after new decisions supersede them.

## Common scenarios

**"My request was approved but the special rate is not showing up on a shipment."** The shipment's scope does not match the approved combination. Check departure country, destination country, commodity group, conveyance, and the effective / expiry dates of the request. If any dimension falls outside the combination scope, the Base Rater cell applies.

**"The underwriter sent the request back to Draft."** Open the request from the Special Rate Requests Dashboard, revise the combinations or the scope in line with the feedback in the reason field, and click Resubmit for Approval.

**"The rate expired but I still need it."** Submit a new request. There is no extend action by design — each period gets a fresh underwriting decision.

**"Two Special Rates now cover the same combination."** The newer one applies going forward. The older one remains on record. If the intent was to replace, deactivate the older rate; if the intent was to layer, that pattern is not supported — always the latest wins.

## Bulk rate adjustment and bulk rerate

For volume changes across many shipments — a book-wide rate refresh, a mid-year rebate roll-out, or a corrective re-pricing after an error is found — the Special Rates dashboard offers **bulk adjustment** and **bulk rerate** actions (from I2G-29826, I2G-29828, and I2G-29825):

- **Bulk adjustment** applies a percentage or absolute change to a selected set of Base Rates or Special Rates in one operation. The change is versioned so historical shipments continue on their pinned rating version and only new quotes pick up the adjusted values.
- **Bulk rerate** takes a set of already-booked or already-quoted shipments and re-runs the rating engine against a new Base Rater or Special Rate version. This is the mechanism for propagating a corrective repricing back through existing shipments rather than only forward. Every rerated shipment carries a marker on the audit trail identifying which bulk operation touched it.

Both actions are gated behind confirmation dialogs because the impact is broad; the confirmation summarises how many shipments are in scope and what the aggregate premium delta will be before the underwriter presses Confirm.

## Imported special rates from legacy systems

Special rates for migrated policies are loaded in bulk from workbooks provided by the legacy systems. The following country groups have been imported:

- **Belgium, Germany, Italy, Portugal, and Spain** — loaded from a consolidated workbook with shipping routes, client-code-keyed assureds, and row corrections for data quality issues.
- **Austria (Road and Rail)** — the first migration wave.
- **Austria (Air and Sea)** — a second wave covering the same ten Austrian policies plus KN Poland, priced across detailed shipping routes.

Each import run reads its configuration (routes, participant mappings, dimension aliases, and duplicate-row handling) from a named config file. Runs are scoped to named policies so that each policy can be imported independently as its conveyance setup is completed. The system caches participant lists and clause lookups for performance during large imports.

Where a workbook names shipping routes that the Routes tab does not define, the system resolves them through route families — groups of routes sharing a geographic region. A family's country lists are derived once from the Routes tab and applied to every route in the family, so a re-issued workbook that adds a route widens its family automatically.

An assured priced in multiple workbooks keeps a single request holding both sets of rates. The import uses update mode so that existing rates are refreshed rather than duplicated, and stale rates from other workbooks are not deactivated.

## Certificate numbering on SRR flows

Certificates generated from shipments priced under a Special Rate are stamped with a certificate number that follows the platform's numbering sequence (see the Numbering page). The sequence is tracked per-policy so numbers do not collide across the book, and the counter increments on every certificate issuance regardless of whether the underlying premium came from the Base Rater or a Special Rate (from I2G-29882).

## Related concepts

- Special Rate Request Flow
- Rating
- Rating Lookup Tables
- Business Rules
- Referral Management
- Billing
- Sanctions and Compliance
- Cluster-Level Configuration
