# Business Rules

## What it is

Business Rules are the conditional logic layer that sits on top of the Base Rater and the Special Rater. They are how a policy expresses its non-standard behaviour — referral triggers, discounts, surcharges, minimum premiums, clause attachments, decline conditions, participant-facing questions — without hard-coding any of it into the rating engine.

Each rule is a block of "if this, then that" logic scoped to a single policy version. Every time a shipment is quoted under the policy, the platform evaluates every active rule attached to that policy version. Rules that match fire their actions. Rules that do not match stay silent so the audit trail is not polluted with negative matches.

A rule has two halves:

- **Conditions** — one or more checks against shipment data, combined with an **ALL** operator (every row must match) or an **ANY** operator (any single row triggers).
- **Actions** — one or more outcomes applied when the conditions match. Actions include premium adjustments, fixed discounts, rate overrides, minimum premiums, refer-to-underwriter, decline, clause attachment, or participant Q&A prompts.

Business Rules are how the platform turns the discretionary parts of underwriting — sanctions, embargoes, vessel classification, unusual cargo — into automated referrals with a traceable reason instead of ad-hoc manual review.

## Who uses it & where

- **Administrators and Underwriters** create, edit, activate, and retire rules in the Business Rules manager attached to each policy version.
- **Brokers** attach rules to their own policies during the New Business flow and manage them thereafter.
- **Participants** never see the rule editor. What they see are the *effects* of matched rules: a shipment being referred, a follow-up question appearing on the shipment form, a clause added to a certificate, a decline reason on a rejected booking.
- **The rating engine** consults rule actions to see whether a shipment needs a minimum premium bump, a rate override, or a full referral.

The Business Rules manager for a policy is reached from the wizard sidebar during policy setup — click **Business Rules**, then click **Set up Business Rules** on the info card. It can also be opened later from the policy's actions menu.

The rules list is the operational surface for managing rules once they exist. From there users can review the rule set as a whole, check whether a specific rule is active, audit changes over time, or clean up obsolete rules in bulk.

## How it works

### The Business Rules dashboard

The rules list is scoped to a single policy version. Each row shows the rule's name, a short description, a category tag, the condition logic (ALL or ANY), and the current status (Active or Inactive). Clicking any row opens a side panel with extended details:

| Column | Meaning |
| --- | --- |
| **Name** | The rule's display name. |
| **Description** | A short summary, also surfaced in the side panel. |
| **Category** | The tag used for filtering and reporting. |
| **Condition Logic** | ALL (every condition must match) or ANY (any one condition triggers). |
| **Status** | Active (evaluated on new shipments) or Inactive (kept on record but not enforced). |
| **Actions** | Row-level Edit, Duplicate, or Delete. |

The side panel adds the category, the condition operator, the number of conditions and actions on the rule, the status, the created and modified timestamps, and a link into the audit trail for that rule.

**Browsing behaviour.** A keyword search finds rules by name or description. Filters narrow the list by category or status. Pagination handles long lists. All sorting and filtering happen against the live policy version, so the list is always current.

**Deleting rules in bulk.** Tick the rows to remove, use the action island that appears at the bottom of the list, and confirm. Deleted rules disappear from the list but their audit trail is preserved — the history remains queryable even after the record is removed from the working view.

**Marking the step complete.** When the rule set is finalised, click **Mark as complete** from the top of the list. This is the same action as the Mark Complete button on the Business Rules configuration step of the policy wizard.

A useful bit of context on the side panel: it shows the policy's billing currency next to any amount-based action, so an underwriter reviewing a "$500 minimum premium" rule can see immediately whether that number is in dollars, euros, or something else.

### Adding a rule

To add a rule, click **Add rule** on the rules list. The form has three sections.

**General section:**

- **Name** — required. Displayed everywhere the rule appears.
- **Description** — optional, but strongly recommended. It is what shows up in the side panel and reports.
- **Category** — required. Drives filtering and reporting later.
- **Active** toggle — defaults to off. Leaving the toggle off keeps the rule on record but inert while it is being designed and tested. A rule saved with Active on immediately evaluates against the next shipment quoted under this policy.

**Conditions section:**

- Pick the condition operator: **ALL** (every row must match for the rule to fire) or **ANY** (any single row is enough).
- For each condition row, pick the **attribute** (for example, insured value, commodity group, destination country), the **operator** (for example, greater-than-or-equal, equals, in), the **value type** (text, number, list — determined by the attribute), and the **value**.
- Click **Add row** to add more condition rows.

The attribute catalogue is deployment-specific — the exact list of shipment attributes exposed to rule conditions is configured per environment. If an expected attribute is missing from the dropdown, that is an implementation matter rather than a user error.

**Actions section:**

- Pick the **action type** — the outcome to produce when conditions match. Types include premium adjustment, fixed discount, rate override, minimum premium, refer, decline, attach clauses, and participant Q&A prompt.
- Enter the action's **parameters** — amount, currency, percentage, referral assignee, clause list, question text — determined by the type.
- Enter a **reason** — mandatory. The reason is logged in the audit trail for every future change on this rule and shows up wherever the action's effect is visible.
- Click **Add row** to add more action rows.

Save is disabled until the rule has at least one condition row and at least one action row.

### Editing a rule

Editing a rule reopens the same form. From the rules list, click the row to open the side panel, then click **Edit**.

Editing is how a rule is kept current as the business changes:

- Retire a rule by turning the **Active** toggle off.
- Tighten or loosen a condition — for example, raise a referral threshold or add a country to an "in" list.
- Retune an action's amount or percentage.
- Add or remove conditions or actions.

If the rule is active before or after the save, the platform shows a red confirmation dialog reminding the user that the change will take effect against new shipments immediately. Existing shipments already quoted under the old logic are **not** retroactively re-rated — the change applies to the next shipment forward.

**Reasons on actions are append-only in the audit trail.** Editing a rule replaces the current reason field, but the previous reason remains queryable in the rule's history. Use the reason field to explain *why* the change is being made, not what the change is.

### Duplicating a rule

From the row's action menu or side panel, click **Duplicate**. A copy is created with "(copy)" appended to the name and the edit form opens on the copy. This is useful for cloning a rule as the starting point for a related but different rule on the same policy.

### Activating and deactivating rules

Activation is the moment a designed rule starts evaluating against real shipments. Until it is active, the rule is on record but inert — useful for staging and testing.

To activate a single rule, open it, tick the Active toggle in the General section, save, and confirm the red warning dialog. Deactivation follows the same path with the toggle unticked; the rule stays in the list so its history is preserved, but it stops evaluating from the moment of save until it is reactivated.

Overlapping active rules can produce non-obvious pricing. Test combined behaviour with sample shipments before activating multiple rules that touch the same attribute or fire competing actions.

### Marking the configuration step complete

The Mark as complete action on the Business Rules configuration step signals that the rule set is intentional. It does not require every rule to be active — a policy can go live with all rules inactive if that is by design.

Two edge cases worth naming:

- **At least one rule must exist** on the policy before Mark as complete becomes available. The button stays disabled until the prerequisite is met.
- **Mark Complete confirms the rule set is intentional**, not that every rule is currently enforced. A policy with three staged rules in Inactive can still be marked complete.

### Rule modes on a policy

The platform supports a policy-level rule mode that controls which rules are actually evaluated:

- **Apply all policy rules** — the normal mode. Every active rule on the policy is evaluated on every shipment.
- **Sanctions rules only** — restricts evaluation to just the sanctions rules. Used for policies that do not need full rule evaluation.
- **Always refer** — every shipment on this policy is referred regardless of rule outcomes. Used for policies still being validated, or for high-risk books where every quote is meant to be seen by an underwriter.

### Order of evaluation

The engine iterates rules in a defined order: platform-set rules first (sanctions, embargoes, vessel classification, standard referral checks), then the policy's custom rules. Only rules that actually match a shipment produce audit records — non-matching rules stay silent so the audit trail does not fill up with negative outcomes.

### Rule types Nacora uses in practice

The rule mechanism is generic, but the Nacora deployment uses it for a specific set of recurring patterns:

- **Cargo description keyword scan.** Free-text cargo descriptions are scanned for prohibited or high-risk keywords ("explosives", "bomb", specific weapon-related terms). A match triggers a referral rather than a decline, so a human can confirm intent.
- **Embargo country check.** If the origin or destination is North Korea, Iran, or Syria, the shipment is referred for underwriter approval. Sanctions rules run regardless of the policy's overall rule mode.
- **Vessel classification check (IACS).** The Vessel Finder API is consulted for the vessel's IMO number. If the vessel is not classified by IACS — the International Association of Classification Societies — the shipment is referred. This rule is dormant today because the MVP scope is Poland-road-only; it activates when sea freight goes live.
- **Vessel age check.** Using the same VesselFinder integration, if the vessel is older than a configured threshold the shipment is referred. Four vessel-age rules are pre-loaded on every policy with confirmed thresholds against VesselFinder's classification of the vessel type (from I2G-29933):

| Vessel type (VesselFinder classification) | Age threshold |
| --- | --- |
| Combination Carrier | Referral when age > 10 years |
| Container Vessel or Vehicle Carrier | Referral when age > 30 years |
| General Cargo | Referral when age > 20 years |
| Refrigerated Cargo | Referral when age > 20 years |

These are the confirmed values agreed with the client after mapping VesselFinder's ship-type taxonomy onto Nacora's underwriting categories.
- **Missing rate check.** If the Base Rater has no cell matching the shipment's permutation, the shipment is referred via the No Applicable Rates Available system rule.
- **Backdating tolerance check.** Each conveyance carries a backdating tolerance (days). A shipment with a departure date backdated beyond that tolerance is referred.
- **High insured value check.** Shipments above a configured value threshold trigger a referral or an automatic clause attachment.
- **Commodity-based clause attachment.** For example, cargo described as "antique art" or "animals" automatically attaches three specific clauses. Broker can still remove or add clauses manually.
- **Maximum Insurable Limit rule with independent currency.** The Maximum Insurable Limit rule accepts a currency selection that is independent of the policy's billing currency (from I2G-29965). A policy billed in EUR can therefore express its limit in USD if that is the natural underwriting cap, and shipments are converted at the current FX rate for the comparison. This decouples the underwriting cap from the invoicing currency.
- **Inland transit outside the policyholder's country.** A system-default rule that fires when the inland leg of a shipment (the road or rail portion) is outside the policyholder's country of establishment (from I2G-29565). Auto-applies to every policy on activation; the underwriter can deactivate it if it does not fit the book.

### System-default Referral rule — No Clauses Attached

A separate system-default rule sits on every policy for the specific case where a shipment reaches the certificate stage without any clauses attached (from I2G-30106):

- **Category:** Referral.
- **Condition (non-editable):** attached-clauses count equals 0.
- **Action:** Refer. Default reason on the referral: "Shipment is referred due to no clauses being attached."
- **Assignee (editable):** defaults to the policy's broker group and can be reassigned per policy.
- **Active toggle:** inactive by default. Available on every policy — the underwriter switches it on where the business wants the safety net.

System-default rules like this one are marked in the Business Rules overview with a **gear icon** so they are distinguishable from custom rules. Their conditions are locked; only the assignee, the reason text, and the active toggle can be changed.

### Actions the engine can fire

- **Refer.** Creates a referral record on the shipment and notifies the assigned underwriter (either the policy's default agent, a named underwriter, or an underwriter group). A Refer rule can carry additional thresholds that decide whether the referral is routed to **Nacora for automated review** or held for **manual underwriter review** (from I2G-29776). The threshold sits alongside the condition and typically keys off insured value or route sensitivity — high-value or sensitive shipments go to the underwriter directly, everything else gets the automated Nacora path.
- **Decline.** Sets the shipment status to Declined with the decline reason stamped on it.
- **Minimum Premium.** Stamps a floor onto the shipment. The rating engine respects it: the final premium becomes at least that amount.
- **Attach Clauses.** Adds specific clauses to the shipment on top of the policy's default clause set. This is how policy clauses are actually applied to individual shipments — clauses attached to a policy are only *available* until a business rule attaches them.
- **Trigger Q&A prompts.** The participant is presented with follow-up questions on the shipment form (for example, "Is the cargo temperature-controlled?"). Answers are stored inline on the shipment and are visible to the underwriter during referral review.

### Q&A instead of email loops

Historically, referral questions between broker and underwriter went by email. In NacoraHub the equivalent conversation happens inline on the shipment record: the rule fires, the participant sees the question on the portal, they answer, and the answer travels with the referral for the underwriter to see. This is an internal platform innovation rather than a client requirement — but it materially reduces round-trip time on referrals.

### Multiple referrals per shipment

Every matching rule creates its own referral record. If three rules match, the shipment carries three referrals and every one of them must be resolved before the shipment can move forward. The referrals may go to different underwriters depending on rule configuration.

## Business rules & calculations

- **Rules do not retroactively re-rate.** New shipments quoted under updated rule logic use the new rules; shipments already quoted keep the premium they were calculated with, whatever the rule state was at that moment.
- **Order matters: platform first, then policy-custom.** Sanctions and vessel checks run before any custom rule. A shipment referred for embargo does not need to pass any subsequent custom rule to become a referral.
- **Only matched rules write audit records.** Non-matches are silent. The audit trail focuses on outcomes, not evaluations.
- **Manual clause override remains possible.** Even when a rule attaches clauses automatically, a broker can add or remove clauses on the specific shipment. Manual actions are recorded in the audit trail.
- **Auto-assignment is configurable.** A referral action can auto-assign to the policy's agent, a named underwriter, or an underwriter group.
- **Cluster-based clause auto-assignment.** Proposed post-MVP: auto-attach clauses by similarity to previous cargo descriptions the shipment resembles. Not implemented today.
- **Deleting a rule does not delete its history.** The audit log survives deletion — if a shipment was rated under a rule and the rule is later deleted, the historical record still shows which rule matched.
- **Overlapping active rules produce non-obvious pricing.** Test combined behaviour with sample shipments before activating rules that touch the same attribute.
- **BR rules re-attach to versioned clauses.** When a policy clause is versioned (a new wording version is published), any Business Rule that had the previous version attached is automatically re-attached to the new version so the rule keeps firing with up-to-date wording (from I2G-29616). This closes a gap where a versioned clause would silently detach from the rule.

### Known caveats under active fix

- Validation on empty condition values and enforcement of the incomplete-status blocker (a rule saved with a missing condition value should not be allowed to move to complete) have known gaps. Both are being resolved via I2G-30099.

## Related concepts

- Clauses
- Referral Management
- Rating
- Special Rate
- Third Party Integrations
- Audit Trail
- Sanctions and Compliance
