# User Journeys & Screens

## What it is

NacoraHub is a two-interface platform. The **Shipment Portal** is the participant-facing experience where shipments are declared, quoted, booked, endorsed, and cancelled. The **Back Office** is the internal-facing experience where brokers configure policies, underwriters resolve referrals and approve special rates, and administrators maintain master data. Both interfaces share the same underlying records — a shipment created in one appears in the other — but each is tuned for a different audience and exposes a different scope of actions.

This page is the table-of-contents for how the system actually gets used. Every high-frequency journey is listed here, with a pointer to the detailed page that describes it. It also covers shipment-level endorsement — the "amend a booked shipment" action that is distinct from a policy-level Mid-Term Adjustment.

## Who uses it & where

- **Participants** — the highest-frequency users. Everything they do sits in the Shipment Portal. Their journeys are: sign in, declare a shipment, review the quote, book it, respond to referrals, request cancellations, download certificates.
- **Producers and brokers** — work in the Back Office. Their journeys are: create policies, manage participant companies on policies, configure clauses and rules, submit shipments on behalf of participants, approve or reject cancellation requests, oversee the shipment pipeline, publish premium and clause changes on individual shipments.
- **Underwriters** — work in the Back Office referral queue and the special rate approval queue. Their journeys are: review referrals, request information, approve or decline, review and approve special rate requests.
- **Administrators** — work in the Back Office admin pages. Their journeys are: manage business partners, maintain choices and lookups, edit the global clauses library, approve pending user sign-ups.

## How it works

### The participant journey — end to end

The participant journey in the Shipment Portal follows a single main sequence with several off-ramps and side loops.

**Sign in.** Passwordless sign-in with either an email one-time passcode or Microsoft single sign-on. On first ever sign-in the participant lands in an admin-approval queue and cannot transact until an administrator places them into a cost centre. See the Login page and the Admin Queue & Approvals page.

**Shipment Dashboard.** Home screen. Counter cards for Quoted, Booked, Referred at the top; a Create Shipment button; a data grid of every shipment the participant can see. See the Shipment Portal page for the full layout, columns, filters, and search behaviour.

**Create a shipment.** From the dashboard the participant presses Create Shipment, picks the policy in the policy-selection dialog, and completes the three-section declaration form — assured details, trip details, cargo details. The form has inline Q&A for business rules that require questions, Google Maps autocomplete on the addresses, an insured-value field with the policy's allowed currencies, and an attachment area for supporting documents. The participant can Save as Draft or Submit & Quote. See the Quote Creation page for the full field-by-field walkthrough.

**Review the quote.** Successful submission lands the participant on the Shipment Details page in Quoted status. Six tabs hold the record — General Details, Clauses, Documents, Emails, Activity, Referrals. Premium is on General Details; draft certificate is on Documents. See the Shipment Portal page for the tab-by-tab detail.

**Book the shipment.** If the customer accepts the quoted premium the participant presses Book. The shipment moves to Booked, the certificate is generated, and cover is in force under the policy's terms. See the Quote Creation page for the booking flow.

**Respond to a referral (side loop).** If the shipment was Referred instead of Quoted — because the rating engine could not resolve it automatically — the participant sees a referral on their Referrals Dashboard. When the referral is in Awaiting Information the participant answers the underwriter's questions inline and uploads any supporting documents. When they submit, the ball goes back to the underwriter. See the Referral Management page for the full choreography.

**Amend a booked shipment (endorsement).** When something material about a booked shipment changes — insured value corrected, vessel changed, description refined, dates adjusted — the participant endorses the shipment. From the shipment 360 page they press Amend Shipment (or Endorse), the form opens pre-populated with current values, they make their change, and submit. A new endorsement record is created, the shipment transitions to Booked – Endorsed, and the certificate is re-issued with the new values while the previous certificate stays available on the Documents tab. See the Shipment Endorsing page for the detail.

**Cancel a booked shipment.** When the movement is not happening or the shipment was booked in error, the participant raises a cancellation request. The request captures the mandatory arrival flag (has the shipment arrived at destination?) and a reason. The Back Office approves or rejects. See the Cancellations page.

**Download certificates and documents.** Available on the Documents tab of the shipment 360 page. Every certificate ever issued on the shipment stays there for the audit trail, including the pre-endorsement certificate after an amendment.

### The broker journey — end to end

Brokers spend their time across policy configuration and shipment oversight.

**Policy creation and configuration.** New policies are set up through a guided wizard covering general details, participant companies, billing, risks, clauses, rules, quote and certificate document templates, and rating. See the Policy Creation page.

**Managing shipments on behalf of participants.** From the Back Office Shipment Dashboard, a broker can press the top-navigation Create action to submit a shipment on behalf of a participant. The declaration form is the same as the participant's but with a Participant Company picker.

**Updating premium and clauses.** From the shipment 360 page, a broker or underwriter can press Update Premium & Clauses. The shipment moves to its Under Review sub-status (Quoted – Under Review, Booked – Under Review, or Booked – Endorsed – Under Review), participants are locked out, the Back Office user overrides insured value, rate, or charges (with a mandatory reason) and/or edits clauses, then publishes changes. The shipment returns to its prior status with the new values active. See the Shipment Portal page.

**Reviewing and resolving referrals.** From the Back Office Referrals Dashboard, referrals in the Pending queue are the underwriter's workload. Actions: Assign to Underwriter, Request Information, edit risk details or premium inside the referral, manage clauses, add internal comments, Approve, Decline. See the Referral Management page for the full mechanics.

**Approving or rejecting cancellation requests.** Shipments in Pending Cancellation status appear in the Back Office pipeline. The reviewer reads the participant's arrival flag and reason, and either approves cancellation (shipment → Cancelled) or rejects (shipment → back to Booked or Booked – Endorsed). See the Cancellations page.

**Approving special rate requests.** The same underwriter queue that handles referrals also handles special rate requests. See the Special Rate page.

**Policy cancellation and endorsement.** Policies themselves can be cancelled (three-phase: scheduled, effective-date, after) or endorsed via Mid-Term Adjustment. See the Cancellations page for policy cancellation and the Adjustments (MTA) page for policy endorsement.

### Shipment-level endorsement (Amendment)

Shipment endorsement is distinct from a policy MTA. A policy MTA changes the policy itself and creates a new policy version. A shipment endorsement changes a single booked shipment and creates a new endorsement record on that shipment while keeping the original booking on the record.

The endorsement carries the new values forward while preserving history. Nothing is overwritten. The full history stays intact for audit and reporting. See the Shipment Endorsing page for the mechanics.

### Where each screen lives — pointer index

Every user-facing surface in NacoraHub, with a pointer to its detail page:

- **Sign-in and admin approval** — Login page; Admin Queue & Approvals page.
- **Shipment Dashboard (both interfaces)** — Shipment Portal page; Dashboard Pages Reference page.
- **Declaration form and quote result** — Quote Creation page.
- **Shipment Details 360 view** — Shipment Portal page.
- **Shipment lifecycle and statuses** — Shipment Statuses page; Shipment Portal page.
- **Shipment-level endorsement** — Shipment Endorsing page.
- **Shipment cancellation** — Cancellations page.
- **Premium and clause overrides from Back Office** — Shipment Portal page.
- **Referrals Dashboard, Referral Activity page, and response flow** — Referral Management page.
- **Special rates and special rate requests** — Special Rate page; Dashboard Pages Reference page.
- **Policy lifecycle — creation, MTA, cancellation, duplication, renewal** — Policy Creation, Adjustments (MTA), Cancellations, Policy Duplication, and Renewals pages.
- **Master data — partners, choices, clauses library, rating catalogue** — Business Partner, Choices, Clauses, and Rating pages.
- **Documents — quotes and certificates** — Documents page.
- **Audit trail** — Audit Trail Module page.
- **Notifications** — Mail Notifications page.
- **Reports and analytics** — Analytics & Reporting page.
- **Bulk shipment import** — Bulk Upload page.
- **External integrations — Salog, e-Marine, GeoRisk, PDM, Vessel Finder, Google Maps** — Third-Party Integrations and SOAP Inbound Integration pages.

## Business rules & calculations

- **Two interfaces, one dataset.** A record created or edited in one interface is immediately visible in the other. The interfaces differ in navigation, visibility scoping, and which actions are exposed — not in the underlying data.
- **Participant visibility is scoped by participant company.** Every participant sees only their own shipments and the shipments belonging to their participant company (and its descendants in the organisation tree). Enforcement is server-side.
- **Back Office sees the full pipeline.** Brokers, underwriters, and administrators see records across the broker cluster, subject to their role's permissions.
- **Route guards.** Portal URLs redirect if the user tries to reach a page their role does not have access to. There is no way to jump between interfaces by URL guess.
- **Auto-save.** The declaration form and the wizard steps auto-save on step exit so no data is lost between navigation moves. The declaration form additionally prompts on accidental navigation.
- **Login destination.** Users land at their most recently used context — for brokers, the last-visited policy step; for participants, the Shipment Dashboard.
- **Shipment endorsement is different from policy MTA.** Shipment-level endorsement changes one shipment (Amend Shipment / Endorse). Policy-level endorsement changes the policy contract (MTA — Mid-Term Adjustment) and creates a new policy version.

## Related concepts

- Shipment Portal
- Quote Creation (Creating and Booking a Shipment)
- Shipment Endorsing (Amendment)
- Cancellations
- Referral Management
- Shipment Statuses
- Dashboard Pages Reference
- Login
