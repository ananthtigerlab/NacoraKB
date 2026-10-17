# Roles and Portals

## What it is

Two things decide what a user sees and what they can do in Nacora:

- **Their role** decides *what work they own*. It is attached to their Business Partner record and stays with them wherever they sign in.
- **Their portal** decides *where they do that work*. Participants use the Shipment Portal. Brokers, underwriters, and administrators use the Backoffice.

Put simply: **role = what you do, portal = where you do it.** The two are related but not the same. A role is a property of the person; a portal is a property of the interface. An underwriter who also holds an administrator role is a normal pattern, and both roles operate in the Backoffice; a participant is only ever a participant, and always in the Shipment Portal.

The platform is delivered through the two portals as connected interfaces. They share the same underlying data — a shipment submitted from the Shipment Portal is immediately visible in the Backoffice, and vice versa — but the two surfaces are tuned for very different audiences and expose different controls.

## Who uses it & where

- **Participants** (K+N logistics staff, external freight forwarders) — Shipment Portal only.
- **Producers / Brokers** (K+N staff, occasionally external brokers) — Backoffice.
- **Underwriters** (GFH staff for Nacora-branded policies, Allianz Global Risks US staff for third-party policies) — Backoffice.
- **Administrators, Company Admins, Organisation Admins** (K+N staff) — Backoffice.

## The two portals side by side

|  | Shipment Portal | Backoffice |
|---|---|---|
| Who signs in | Participants — shippers, consignees, freight forwarders | Brokers/Producers, Underwriters, Administrators |
| Authentication | Passwordless: email OTP or Microsoft SSO | Microsoft SSO (recommended) or direct email and password |
| Submits shipments | Yes | Yes (brokers, on behalf of participants) |
| Books, amends, requests cancellation | Yes | Yes (brokers can endorse and cancel directly) |
| Reviews referrals and special-rate requests | No — receives notifications and responds when asked | Yes |
| Configures policies, master data, business rules | No | Yes |
| Audit visibility | Own activity only | Full audit across records the role can access |

## The role-to-portal matrix

| Role | Signs in via | Portal |
|---|---|---|
| Participant | OTP email or Microsoft SSO | Shipment Portal |
| Producer / Broker | Microsoft SSO or direct credentials | Backoffice |
| Underwriter | Microsoft SSO or direct credentials | Backoffice |
| Administrator | Microsoft SSO | Backoffice |
| Company Admin | Microsoft SSO | Backoffice (scoped to their company) |
| Organisation Admin | Microsoft SSO | Backoffice (scoped to their organisation) |
| Named Assured | Not a sign-in role | — |

The domains are cross-checked. A request for a Backoffice page from the Shipment Portal domain, or the other way around, is refused before authentication is even attempted.

## The Backoffice — what it does

The Backoffice is the main operational and configuration interface. Administrators, Producers, and Underwriters use it to:

- Configure and activate policies end-to-end.
- Manage shipments and endorsements.
- Review referrals and special-rate requests.
- Configure master data, clauses, business rules, and rating.
- Access dashboards, reporting, and search pages.

The Backoffice houses the policy wizard (the ten-step design flow for a cargo policy), the referrals dashboard, the special-rate requests dashboard, the Business Partners dashboard, the pending approvals queue, the global clauses library, choices administration, exchange rates, and business rules configuration.

## The Shipment Portal — what it does

The Shipment Portal is the participant-facing operational interface. Participants use it to:

- Create and quote shipments.
- Book shipments.
- Request special rates.
- Request shipment cancellations.
- View shipment documents and shipment status.

Participants never see admin surfaces, and never see other participants' shipments — even within the same Participant Company, one participant's drafts are invisible to another participant.

## How it works — visibility scoping

- **Brokers** see only shipments and policies linked to their Broker Company (and its descendants).
- **Underwriters** see only referrals and special-rate requests for policies where they are the lead insurer (or a listed insurer, depending on setup).
- **Participants** see only their own shipments.
- **Administrators** have visibility across the entire system.

Menu items are also role-aware. The sidebar renders only the links the user's role list authorises. A participant does not see a Referrals menu item because they do not have the Underwriter role; an underwriter does not see a Policy Wizard entry because they do not have the Producer role.

## How the interfaces combine in practice

The same record is visible in both interfaces, but each interface shows it differently. This is what makes broker-on-behalf-of-participant workflows possible.

- **Shipment Dashboard.** Participants see counter cards and a Create Shipment action; brokers see the full pipeline grid with filters, assignment, and export.
- **Shipment Details.** The Backoffice sees Update Premium & Clauses; participants do not.
- **Referrals.** The Backoffice sees status tabs, assignment controls, and a full pipeline; participants see only their own referrals and only for the purpose of answering questions.
- **Documents tab.** Both interfaces surface the quote PDF and certificate PDF once generated. Only the Backoffice can regenerate or edit.

## Navigation — the layouts you will see

The platform uses a small number of consistent layouts across every page. Knowing the layouts once means not having to relearn them on every screen — the search field, the action bar, the side panel, and the step indicators behave the same everywhere they appear.

### The four layouts

| Layout | Where you see it |
|---|---|
| **Wizard layout** | The policy wizard. A sidebar of steps on the left, the form on the right, previous/next controls at the bottom. |
| **Dashboard layout** | The shipment, referral, and special-rates dashboards. Search and filter bar at the top, a data grid, and an action island that appears when rows are selected. |
| **Standalone page** | The shipment form and the referral details page. A centred page with no sidebar, optimised for completion in one go. |
| **Drawer page** | Special-rate forms. A page with a side drawer for per-row edits. |

### The top navigation and left navigation

Every screen carries a **top bar** with global search, the user menu, and the notification bell. On dashboard-style pages, the top bar sits above a search-and-filter row for the grid below.

The **left navigation** (sidebar) renders the modules a user's roles authorise. Typical Backoffice entries include Policies, Shipments, Referrals, Special Rates, Business Partners, Choices, Clauses, Business Rules, Exchange Rates, Reports, and (for administrators) Pending Approvals. The Shipment Portal sidebar is much shorter — Shipments, Referrals (for the participant's own), Documents, plus the user menu.

### Shared UI elements

- **Search field** — top-left of every list. Server-side; works across multiple fields per dataset.
- **Filter panel** — opens via an icon next to search. Settings persist across navigation within a session.
- **Action island** — a floating bar that appears when rows are ticked in a grid. Bulk actions live here — activate/deactivate, delete, mark as Named Assured, export.
- **Side panel** — slides in from the right with details for a selected row.
- **Confirmation dialog** — used for any action with side effects (publish, delete, override). Reads the action and consequences before asking to confirm.

### Save, draft, and discard

Most forms support three save modes:

- **Save Draft** — persist work without leaving the form, no downstream effects.
- **Save** (variants include *Submit & Quote*, *Submit Endorsement*, *Publish Changes*) — commit and apply the change.
- **Discard** — abandon unsaved changes. Always confirmed.

Navigating away with unsaved changes always pops a confirmation modal, so work cannot be lost by mistake.

### Step indicators (wizards)

The policy wizard and the special-rate request wizard show step indicators in their sidebar:

- **Empty circle** — the step has not been started.
- **Half circle or pencil icon** — the step has data but has not been marked complete.
- **Green check** — the step has been marked complete.

A step with data but not marked complete does not block *Save*, but it does block *policy activation*.

### Keyboard tips

- **Tab** moves between fields predictably across every form.
- **Enter** in a single-field form submits it.
- **Shift + click** on a column header adds a secondary sort.
- **Esc** closes the topmost modal or drawer.

## Common patterns

- **List pages.** Search field at top-left, filter icon next to it, grid below, action island when rows are ticked. The same pattern applies to Business Partners, Policies, Shipments, Referrals, and Special Rates.
- **360° pages.** A record's full detail — policy, shipment, or partner — is shown on a single page organised into tabs (General Details, Documents, Activity, Relations, and so on). The tabs are consistent across similar record types.
- **Action menus.** Row-level actions live in a three-dot menu at the end of each grid row. Bulk actions live in the action island above the grid.

## Business rules & calculations

- **Roles are attached to Person Business Partners.** One person can hold more than one role. Multiple roles are additive.
- **A person can hold multiple roles.** An underwriter who is also an administrator is a normal, supported pattern.
- **Portal access follows role.** A person with only the Participant role cannot sign in to the Backoffice, even if the URL is known. The domain guard rejects the request.
- **Named Assured is not a sign-in role.** It is a data marker used on policies and shipments.
- **Group permissions are turned off globally.** The platform relies purely on the Roles concept. Group memberships influence data scope (via the tree) but do not carry additional permission bits.
- **Menu items render conditionally.** The sidebar is filtered by the current user's roles at render time.
- **Element labels may vary slightly between deployments.** The patterns above (search, action island, side panel, step indicators) are the same everywhere; the labels may differ.

## Related concepts

- Login
- Business Partner
- Permissions Management
- First Day Guides
- Admin Queue & Approvals
