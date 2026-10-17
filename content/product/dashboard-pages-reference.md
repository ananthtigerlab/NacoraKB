# Dashboard Pages Reference

## What it is

A cross-reference of every dashboard in NacoraHub — what each one contains, what filters and columns it exposes, and what actions are available on each. Every day-to-day operation on the platform runs through one of these dashboards. Most of them share the same underlying layout — a filterable table with a detail panel — but the columns, filters, and actions are tuned per area.

The dashboards split into two audiences. **Shipment Portal** dashboards are for participants. **Back Office** dashboards are for brokers, underwriters, and administrators. Some dashboards appear in both, showing the same underlying data at a different scope.

## Who uses it & where

- **Participants** work primarily from the Shipment Dashboard and the Referrals Dashboard in the Shipment Portal. Special Rates dashboards are also available to them.
- **Brokers** work across policy, shipment, referral, quotation, and business partner dashboards in the Back Office.
- **Underwriters** work primarily from the Referrals Dashboard and the Special Rate Requests Dashboard in the Back Office.
- **Administrators** work across the master data and configuration dashboards in the Back Office.

## How it works

### Common layout

Every search-and-detail dashboard in NacoraHub shares the same shape.

- **Search bar** at the top — matches across the most useful fields for the area (shipment number, reference, policy name, partner name, and so on).
- **Filter panel** — area-specific filters (status, role, currency, date range, assignee, and so on).
- **Results grid** with sortable columns. Click a header to sort single-column, Shift-click for multi-column sort.
- **Selected-row panel or drawer** with details and quick actions on the highlighted row.
- **Action menu on each row** (Edit, Open, View activity, and so on) — status-driven.
- **Add / Create button** at the top right where new records can be created.

Cross-links between pages are live throughout. Clicking a policyholder on a policy opens that partner's record; clicking a policy number on a partner's record opens the policy. References are bidirectional across the whole platform.

Visibility is enforced server-side. Participants see only their own records; Back Office users see the full pipeline subject to their role permissions.

### The Shipment Dashboard

**Where it lives.** In both the Shipment Portal (for participants) and the Back Office (as the operational pipeline view for brokers).

**Purpose.** The home screen for both interfaces. Lists every shipment the signed-in user has access to, with search, filters, and status-appropriate actions.

**Portal layout.** Counter cards at the top for Quoted, Booked, and Referred — counts, not sums. A Create Shipment button to start a new declaration. A data grid with the columns below. Row click opens the shipment 360 view.

**Back Office layout.** A data grid with full pipeline visibility, an Export action that downloads the filtered grid as a comma-separated file, additional columns configurable per user or role (assigned underwriter, participant company, and so on), and a top-navigation Create action for brokers to submit shipments on behalf of participants.

**Columns.**

- **Shipment number** — auto-generated identifier.
- **Status** — one of the lifecycle states (Draft, Quoted, Booked, Referred, and so on). See the Shipment Statuses page.
- **Policy** — the policy the shipment is under.
- **Holder** — the policyholder.
- **Insured value** — declared value with its currency.
- **Created date** — when the shipment was first saved.
- **Actions** — quick actions per status (Edit, Endorse, Cancel request, and so on).

**Filters.** Status, date range, policy, currency. Search field matches shipment number, reference, policy name, and holder name.

**Actions available from the dashboard.** Create Shipment (participant, and broker via Create on behalf of); Export (Back Office); row-level actions per shipment status.

### The Referrals Dashboard

**Where it lives.** In both interfaces.

**Purpose.** For underwriters and brokers, the daily inbox for referrals awaiting decision. For participants, the place to see what the underwriter needs from them.

**Back Office layout.** Status tabs — Pending (new referrals awaiting review), Awaiting Information (Back Office has asked the participant), Approved, Declined. In some builds surfaced as Under Review / Approved / Declined; the semantics are the same. Grid columns are Back Office-flavoured: assignee, due date, originating shipment, status. Filters cover policy, participant company, commodity, date range, and assignee. A dropdown selector switches between All referrals, Assigned to Me, and Assigned to my group.

**Portal layout.** A single list of the participant's own referrals. Status badge on each row indicates whether action is needed — an Awaiting Information row is where the ball is with them. Approved and Declined rows are informational.

**Actions available from the dashboard.** Open a referral (both interfaces); Assign to Underwriter, Request Information, edit risk details or premium inside the referral, manage clauses, add internal comments, Approve, Decline (all Back Office); Submit Information (participant, when in Awaiting Information).

### The Special Rates Dashboard

**Where it lives.** In the Shipment Portal (accessible to participants and to brokers) and mirrored in the Back Office.

**Purpose.** Lists the approved Special Rates available to be picked up by the rating engine. This is the outcome dashboard — every rate here is live (or will be once its effective date arrives) and may apply to matching shipments. Used to audit what rates exist, investigate a specific shipment's premium, or start a new request from the same screen.

**Columns.**

- **Rate ID** — auto-generated identifier.
- **Scope** — the policy and risk combinations the rate applies to.
- **Status** — usually Approved or In Use.
- **Created date** — when the rate was created.
- **Effective date** — when the rate becomes active.

**Actions available from the dashboard.** Row click opens the rate in view mode; a Create Special Rate button starts a fresh request.

### The Special Rate Requests Dashboard

**Where it lives.** In the Shipment Portal (accessible to submitters) and mirrored in the Back Office (used by approvers).

**Purpose.** Lists every Special Rate Request in the system, regardless of lifecycle state. The shared working surface for submitters and approvers.

**Tabs by lifecycle state.**

- **Draft** — being prepared by the author.
- **Pending Approval** — awaiting Back Office confirmation.
- **Approved** — confirmed and published.
- **Declined** — rejected.
- **In Use** — at least one shipment has matched the approved rate.

**Columns.**

- **Request ID** — auto-generated identifier.
- **Scope** — the policy and risk combinations the rate would apply to.
- **Status** — one of the request statuses (see the Special Rate Statuses page).
- **Created date** — when the request was first saved.
- **Assigned to** — the Back Office user who owns review (visible in the Back Office).

**Actions available from the dashboard.** Row click opens the request in edit or view mode; Create Special Rate starts a fresh request.

### Master data dashboards (Back Office)

- **Partners** — browse, search, and manage Business Partners: people, groups, and companies. Row click opens the partner record. See the Business Partner page.
- **Users** — manage user accounts and their roles.
- **Products** — browse and configure insurance products.

### Operational dashboards (Back Office)

- **Policies** — search and open policies. Click a row to see the policy detail, parties, clauses, and history.
- **Quotations** — search and open quotations. Row click opens the quotation record.
- **Items (Shipments)** — browse shipments from the Back Office admin side. Equivalent to the Shipment Portal dashboard but with Back Office-level visibility and columns.
- **Activities** — the audit-trail and activity stream across the system.
- **Mails** — inbound emails captured by NacoraHub.

### Pricing and rating dashboards (Back Office)

- **Rater** — manage rating tables: base rates, factors, and per-policy overrides.
- **Special rates and special rate requests dashboards** — described above; live in the Shipment Portal and mirror to the Back Office.

### Finance dashboards (Back Office)

- **Billing admin** — invoices, statements, and partner balances.
- **Reports** — run and download reports (commission, premium, claims, and so on).

### Configuration dashboards (Back Office)

- **Choices** — edit dropdown choices and lookup tables used throughout NacoraHub (currencies, commodity groups, country lists, rating parameters, and so on).
- **Configuration** — the Nacora settings landing page — currencies, commodity classifications, and other client-wide settings.
- **Pending approvals** — approve or reject newly arrived participant users. See the Admin Queue & Approvals page.

## Business rules & calculations

- **Visibility is role-scoped.** Every dashboard filters server-side by the signed-in user's scope. Participants see their own records; Back Office users see the full pipeline subject to their role permissions.
- **Counter cards show counts, not sums.** Dashboard counter cards indicate how many shipments (or referrals, or requests) are in each state — never a sum of insured value or premium.
- **Cross-links are bidirectional.** Clicking a policyholder on a policy opens that partner; clicking a policy on a partner opens the policy. Follows all the way through the object graph.
- **In Use is not the same as Active forever.** Special Rates in In Use have matched at least one shipment; they can still expire by effective/expiry dates or through 90 days of inactivity.
- **Search matches multiple fields per area.** The search bar on each dashboard matches across the most useful fields for that area — for shipments: number, reference, policy, holder — rather than a single primary key.
- **Filters combine additively.** Applying multiple filters narrows the result set; there is no OR filtering across different filter categories.
- **Exports are filtered exports.** The Back Office Export action downloads the currently filtered grid, not the whole underlying dataset.
- **Row actions depend on record status.** The Actions column on each row surfaces only the actions valid for that record's current state. A Cancelled shipment shows no actions; a Quoted shipment shows Edit and Book; a Booked shipment shows Amend and Request Cancellation.

## Related concepts

- Shipment Portal
- Referral Management
- Special Rate
- Shipment Statuses
- Special Rate Statuses
- Business Partner
- Policy Creation
