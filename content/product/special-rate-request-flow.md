# Special Rate Request Flow

## What it is

The Special Rate Request Flow is the end-to-end operational process by which a non-standard rate moves from a proposal into a live, applied rate on shipments. It covers the two-step submission form, the two dashboards where requests are found and managed, and the underwriter's review and confirmation actions.

This page is the focused step-by-step. The conceptual overview — what a Special Rate is, how it relates to the Base Rater, the full lifecycle — is on the Special Rate page. Both pages describe the same underlying entity; this one walks the process linearly.

## Who uses it & where

- **Producers, brokers, and participants** create and submit requests. From the Shipment Portal they see one set of buttons; from the Back Office they see a superset that includes direct approval.
- **Underwriters (Back Office users)** review requests in the Pending Approval queue, decide combination by combination, and either confirm the rates, decline the request, or send it back for revision.
- **The rating engine** picks up approved rates automatically the next time a matching shipment is submitted. No manual step is required to make the rate live on shipments.

Two dashboards support the flow:

- The **Special Rates Dashboard** is the outcome view — a list of every approved and in-use rate. Each row here is a published rate that may already be applying to shipments. Use it to audit what rates exist and to investigate a specific shipment's premium.
- The **Special Rate Requests Dashboard** is the working view — every request in the system, filterable by lifecycle state via the tabs Draft, Pending Approval, Approved, Declined, and In Use.

Both dashboards carry a **Create Special Rate** button that opens the two-step request form.

## How it works

### Step 0 — General Details (defining the scope)

The submitter opens the request form (either from either dashboard's Create Special Rate button) and lands on Step 0.

- **Pick the Policy.** The rate will apply against this policy's Base Rater. The submitter must have rights to request rates on the chosen policy — the policy must be active and the submitter must be entitled to submit against it.
- **Set the scope.** At least one scope dimension is required. Typical dimensions include:
  - Route (departure country and destination country).
  - Commodity group.
  - Conveyance.
  - Effective date and expiry date.
- **Add a description.** Free-text explanation of why the rate is needed. It surfaces during underwriter review and in reporting.
- Click **Next** to move to Step 1.

**Validation at Step 0.** The scope must be consistent with the policy. Picking a commodity group the policy does not cover, for example, raises a validation error at this step — the platform blocks incoherent requests before the submitter invests time in defining combinations.

### Step 1 — Combinations (the actual rate lines)

Step 1 lists the specific rate lines the underwriter will review. Each row is one specific tuple of risk factors paired with a suggested rate.

- Click **Add combination**. A side drawer opens.
- In the drawer, set the **risk factors** for this row — they must match the dimensions defined in Step 0.
- Enter the **suggested rate**.
- Enter any per-combination **charges**.
- Save the combination.
- Repeat for every proposed line. Rows can be removed via the row-level controls.

The submitter typically adds one combination per meaningful risk permutation. The point of combinations is granularity — a single request can propose different rates for different (route, commodity, conveyance) tuples that all sit within the scope defined in Step 0.

### Submitting the request

The buttons at the bottom of the form depend on where the submitter is signed in:

- **From the Shipment Portal (participants and producers)** — a single **Submit for Approval** button. Clicking it moves the request to Pending Approval and notifies the underwriter assigned to the policy.
- **From the Back Office (underwriters and administrators)** — three buttons:
  - **Save Draft.** The request stays in Draft. Nobody is notified. It remains editable by the author.
  - **Submit for Approval.** Same behaviour as the participant flow — moves to Pending Approval.
  - **Confirm Rates.** Direct approval, available only when every combination has a defined rate. Skips the Pending Approval stage and takes the request straight to Approved.

Choose Save Draft when the request is still being drafted or waiting on external information. Choose Submit for Approval when the request is complete and needs an underwriter decision. Choose Confirm Rates only when a Back Office user has the authority to publish the rate directly and every rate line is deliberate.

### Editing an existing request

The right to edit depends on status:

- **Draft** — the author can edit freely from the Special Rate Requests Dashboard.
- **Pending Approval** — Back Office only.
- **Approved**, **Declined**, and **In Use** — read-only, with limited Back Office overrides.

To edit, open the request from the Special Rate Requests Dashboard, make changes to General Details or Combinations, and either **Save Draft** (if it is still in Draft) or **Resubmit for Approval** (if the Back Office sent it back for revision).

### The Special Rate Requests Dashboard in detail

Reach it at the Special Rate Requests navigation entry. The dashboard has one tab per lifecycle state — Draft, Pending Approval, Approved, Declined, In Use — and lists all requests in that state.

Each row shows:

| Column | Meaning |
| --- | --- |
| **Request ID** | Auto-generated identifier for the request. |
| **Scope** | The policy and the risk combinations the rate would apply to. |
| **Status** | The lifecycle state (matches the tab). |
| **Created date** | When the request was first saved. |
| **Assigned to** | The Back Office user who owns review. Visible in the Back Office. |

Visibility is role-scoped: submitters see requests they created; Back Office users see every request in the system. The record underneath is the same either way.

Common activities on this dashboard:

- Switch tabs to the state you want to work on.
- Search and filter for a specific request.
- Click a row to open the request in edit or view mode.
- Click **Create Special Rate** to start a new one.

### The Special Rates Dashboard in detail

Reach it at the Special Rates navigation entry. Unlike the Requests Dashboard, this view lists only the *outcome* — approved and in-use rates that will actually apply to shipments.

Each row shows:

| Column | Meaning |
| --- | --- |
| **Rate ID** | Auto-generated identifier. |
| **Scope** | Policy and risk combinations the rate covers. |
| **Status** | Usually Approved or In Use. |
| **Created date** | When the rate was created. |
| **Effective date** | When the rate becomes active on shipments. |

Common activities:

- Browse, search, or filter to audit what rates exist on which policies.
- Click a row to open the underlying request in view mode.
- Click **Create Special Rate** to start a new request from the same screen.
- Investigate a specific shipment's premium by finding the Special Rate whose scope covers the shipment.

The Special Rates Dashboard shows rates, not requests. For everything in Draft, Pending Approval, or Declined status, use the Special Rate Requests Dashboard.

### Approving in the Back Office — combination by combination

When a submitted request lands in Pending Approval, it appears in the Back Office queue on the Special Rate Requests Dashboard. The underwriter opens the Pending Approval tab, clicks the request, and lands on the request detail page.

**Preparation before deciding.** The underwriter should:

- Read the description on the request — that is the rationale the submitter wrote in Step 0.
- Open the policy and compare the suggested rates against the Base Rater cells and the participant's shipment history.
- Decide whether to act on the whole request at once or combination by combination.
- Have clear reasons ready for any decline — reasons are permanent on the audit trail.

**Deciding per combination.** The request detail page shows each combination with its own status (Draft, Approved, or Declined). To review one:

- Click the combination to open the side drawer.
- Review the proposed rate.
- Mark the combination **Approved** or **Declined**. Declined combinations require a reason.
- Repeat for every combination.

**Finalising the request.** The header actions depend on combination status:

- **Confirm Rates** — available only when every combination is marked Approved. Promotes the request to a published Special Rate.
- **Decline All** — rejects the entire request with a single reason. Terminal.
- **Edit** — reopens the form. Available while the request is in Draft or Pending Approval.
- **Change Assignee** — reassigns review to a different Back Office user.
- **Duplicate** — creates a copy as a starting point for a new request.
- **Delete** — removes the request. Only allowed in early lifecycle states.

The underwriter cannot Confirm Rates if any combination is still Draft or Declined. Every combination must be resolved first.

### Bulk approval when every rate is already defined

If the submitter's suggested rates on every combination are acceptable in bulk, the underwriter can approve the whole request in one action. Two paths lead to this:

- **Confirm Rates from the Pending Approval detail page**, after marking each combination Approved individually.
- **Confirm Rates from the Back Office submission form**, entered directly by the Back Office user when creating the request — this skips Pending Approval entirely.

Both routes end at the same place: Approved status, the rate published, the submitter notified.

### What happens after approval

- **Approved** is the request's new state. The Special Rate is now published and eligible to apply to shipments.
- The submitter is notified of the approval.
- The rating engine picks up the special rate automatically on the next matching shipment. No manual "activate" step is needed.
- The first time a shipment actually matches the scope, the request transitions from Approved to **In Use**. Subsequent matches keep it in In Use.

### What happens after decline

- **Decline All** takes the request to **Declined**. Terminal.
- The reason is stamped on the audit trail.
- The submitter can open a new request with revised combinations if the underlying commercial ask is still valid.

### What happens when the underwriter sends it back

- Editing the request while it is Pending Approval and choosing to send it back to Draft returns it to the author for revision.
- The author sees the request return to their Draft tab.
- The author revises the combinations or the scope in line with the feedback and clicks **Resubmit for Approval** to send it back to the underwriter.

### What happens on expiry

A Special Rate has two independent expiry paths, both automatic:

- **By date.** Once the request's end date passes, the rate moves to Expired. Terminal.
- **By inactivity.** If no shipment matches the rate for 90 consecutive days, the rate moves to Expired even if the end date is still in the future.

There is no advance notification before expiry. There is no extend action. If the rate is still needed after expiry, the submitter opens a new request.

## Business rules & calculations

- **The rate is not bounded.** A suggested rate can be higher or lower than the corresponding Base Rater cell. Underwriter discretion.
- **Confirm Rates requires every combination to be Approved.** Draft or Declined combinations block the bulk action.
- **Direct approval (Confirm Rates from the Back Office submission form) requires every combination to have a defined rate.** The button is disabled otherwise.
- **Notes on the request are internal.** The description surfaces during review and in reporting; it does not appear on the customer-facing quote or certificate.
- **The rate becomes live the moment Confirm Rates is clicked.** Subsequent matching shipments receive the special rate automatically — double-check the numbers before confirming.
- **The request moves to In Use only on first shipment match.** Approved status means the rate is published but has not yet been applied to any shipment.
- **One active Special Rate per permutation, latest wins.** Creating a second request covering the same combination causes the newer one to be applied on new shipments.
- **Sending back to Draft is a soft-return.** The request stays alive and editable by the submitter. It is not the same as declining.
- **Declines are terminal.** The submitter cannot resurrect a declined request; they must open a new one.
- **In Use ≠ Active forever.** Effective and expiry dates bound the rate; 90 days of inactivity also expire it.
- **Visibility is role-scoped on the Requests Dashboard.** Submitters see their own requests; Back Office users see everything.
- **Every decision writes to the audit trail.** Approvals, declines, reassignments, and reasons are permanent.

## Common scenarios

**"I need to fast-track a rate I have already agreed with the underwriter."** From the Back Office, use Create Special Rate, fill in Step 0 and Step 1, and click Confirm Rates directly. This skips Pending Approval.

**"An underwriter has already reviewed part of a large request."** Approve the reviewed combinations individually, save, and come back to finish the rest. The request stays in Pending Approval until every combination is resolved.

**"The rate has not appeared on a specific shipment."** Open the Special Rates Dashboard, find the rate, check the Scope column against the shipment's actual route, commodity, conveyance, and date. If any dimension is outside the scope, the Base Rater cell applies instead.

**"The underwriter returned the request to Draft."** Open it from the Requests Dashboard's Draft tab, revise the combinations or scope in line with the reason given, and click Resubmit for Approval.

**"The rate expired but the commercial arrangement continues."** Submit a new request. No extend action exists by design — each period gets a fresh underwriting decision.

## Related concepts

- Special Rate
- Rating
- Rating Lookup Tables
- Business Rules
- Referral Management
- Billing
