# Shipment Portal

## What it is

The Shipment Portal is the participant-facing interface of NacoraHub — the standalone web experience where shippers, consignees, and freight forwarders declare shipments, view their quotes, book coverage, download certificates, and request amendments or cancellations. It is deliberately narrower than the Back Office. There is no clause library editor, no rule editor, no policy administration, no partner administration. Just a shipment declaration form, a shipment tracker, referral responses, and the documents that come out the other end.

The portal shares the underlying data with the Back Office (NacoraHub). A shipment declared from the portal is immediately visible to brokers and underwriters; a shipment created by a broker on behalf of a participant is immediately visible in the portal. The two interfaces are two doors into the same set of records, each tuned for a different audience. Authentication is passwordless — sign-in is either an email one-time passcode or Microsoft single sign-on.

Everything in the Shipment Portal revolves around a single, defined lifecycle. Every shipment is in exactly one status at any moment, and the status decides what the user can and cannot do — which actions the header offers, which fields are editable, which dashboards the shipment shows up on, and whether the Back Office is currently blocking further work.

## Who uses it & where

- **Participants (participant company staff)** — the primary audience. These are the people at Kuehne+Nagel regional teams and their captive logistics units who actually book cargo shipments. For many of them, the Shipment Portal is the only surface on the platform they ever see.
- **Freight forwarders and consignees** — external parties who declare shipments under a policy where they have participant standing.
- **Producers and brokers** — do not normally use the portal directly, but can act on behalf of a participant from the Back Office. Shipments they create for a participant appear in that participant's portal view.
- **Underwriters** — do not use the portal. Their referral queue lives in the Back Office.

The portal enforces visibility scoping server-side. Every participant sees only their own shipments and the shipments belonging to their participant company (and its descendants). Nothing across the wider broker cluster is exposed.

## How it works

### The Shipment Dashboard

The dashboard is the home screen for the participant and the page they return to dozens of times a day. It lists every shipment the signed-in user has access to, with search, filters, sortable columns, and the actions appropriate to each row's status.

At the top of the dashboard sit **counter cards** for quick triage — how many shipments are in Quoted, how many in Booked, how many in Referred. The counters show shipment counts, not sums of insured values.

Beside the counter cards is a **Create Shipment** button, which opens the policy-selection dialog and starts a new declaration.

Below sits the main **data grid**. It supports search across shipment number, participant reference, policy name, and holder name. A filter panel allows narrowing by status, date range, policy, currency, **conveyance** (from I2G-30053), and other axes. Column headers are sortable — clicking sorts single-column, Shift-clicking builds a multi-column sort. Clicking a row opens the Shipment Details page for that shipment.

**Preference persistence.** The dashboard remembers the signed-in user's page size, sort order, applied filters, and column configuration across sessions (from I2G-30185 and I2G-30169). Coming back the next day, the grid opens exactly as it was left — no need to re-apply filters or reset the sort. See Shipment Preference Persistence.

**Locale-aware formatting.** Number and date formats on the grid and on the shipment detail respect the signed-in user's locale (from I2G-29595). Thousand separators, decimal points, and MM/DD versus DD/MM date order all follow the user's preference — a Polish user sees `15.03.2026` and `1 000,00 PLN`; a US user sees `03/15/2026` and `1,000.00 USD`. This applies wherever numbers and dates are rendered on the portal, not only on the grid.

The columns on the participant grid are:

- **Shipment number** — the auto-generated identifier used throughout the platform.
- **Status** — the lifecycle state (Draft, Quoted, Booked, and so on).
- **Policy** — the policy this shipment is declared under.
- **Holder** — the policyholder.
- **Insured value** — the declared value with its currency.
- **Created date** — when the shipment was first saved.
- **Actions** — quick actions tuned to the row's status (Edit, Endorse, Cancel request, and so on).

The Back Office version of the same dashboard adds an **Export** action that downloads the filtered grid as a comma-separated file, plus configurable columns such as assigned underwriter and participant company. Brokers additionally see a top-navigation **Create** action for submitting shipments on behalf of participants.

### The Shipment Details page (Shipment 360 view)

Clicking a shipment opens its complete record. The header carries the shipment number, a status badge, and the actions available for that status. Six tabs hold the data.

- **General Details** — number, created date and user, policy, holder, expiry, plus trip details (conveyance, departure and destination), cargo details (commodity, insured value, language), and the premium breakdown.
- **Clauses** — the clauses applicable to this shipment. Editable by the Back Office when the shipment is Awaiting Review.
- **Documents** — certificates, endorsement notes, and any other generated documents, with language variants where applicable and upload/download controls.
- **Emails** — the history of emails sent to or from the system for this shipment.
- **Activity** — the audit trail. Every state change, edit, and user action, timestamped.
- **Referrals** — a grid of every referral linked to this shipment.

The header actions vary by status. The mapping is:

- **Draft** — Edit, Delete, Submit & Quote.
- **Quoted** — Edit, Book, and (Back Office only) Update Premium & Clauses.
- **Quoted – Awaiting Review** — Publish Changes (Back Office). The label "Awaiting Review" replaces the earlier "Under Review" label across shipment and referral state indicators (from I2G-30169).
- **Booked** — Amend Shipment, Request Cancellation (participant) or Cancel Shipment (Back Office), and Update Premium & Clauses (Back Office). The Back Office also has a **Reassign Survey Agent** action on the shipment detail (from I2G-29871) for reassigning the surveyor group when the originally-picked surveyor is not available.
- **Booked – Endorsed** — same as Booked, applied on top of an already-endorsed shipment.
- **Booked – Endorsed – Awaiting Review** — Publish Changes (Back Office).
- **Pending Cancellation** — Approve cancellation or Reject (Back Office).
- **Referred** — Open referral.
- **Cancelled, Expired, Lapsed** — view only, no actions.

### Shipment form additions

Two additions on the shipment declaration form that are visible during shipment creation:

- **Letter of Credit toggle** (from I2G-29832). When a shipment is financed under a Letter of Credit, ticking the toggle surfaces the LC-specific fields and drives downstream clause attachment (a Letter of Credit clause is typically attached by Business Rule when this toggle is set).
- **SRR — All Participant Companies option** in the participant selector on the Special Rate Request form (from I2G-30169). When set, the resulting Special Rate applies to every participant on the policy rather than a specific one or a subset. This is the option surfaced from the participant scope work described on the Special Rate page.

Tabs and actions are gated by interface. Participants do not see internal-only fields or the full audit stream — internal actions such as broker private notes are filtered out. Back Office users see the entire record plus additional administrative actions.

### The shipment lifecycle

Every shipment travels through a defined sequence of statuses. The sequence, and who owns each state, is the map every user needs to know.

**Draft** — the shipment has been saved but no premium has been calculated. Owned by the participant (or the producer submitting on their behalf). The next move is to complete the form and press **Submit & Quote** — which validates, persists, runs the rating engine, and moves the shipment to Quoted. Or the participant can delete it, which takes it out of the system entirely.

**Quoted** — the rating engine has produced a premium and a draft certificate. Owned by the participant. The next move is either to Book (which turns the quote into live cover) or to let it sit while the customer decides. Booking a quoted shipment blocks after 30 days from the point the quote was calculated — a stale quote must be re-rated.

**Quoted – Awaiting Review** — a Back Office user has opened the shipment to edit premium or clauses. Owned by the Back Office (typically an underwriter). Participants can still see the shipment but cannot act on it. This sub-status is intentionally visible — participants know that the Back Office is working on their shipment, which avoids "why is nothing changing?" confusion. Exits back to Quoted when the Back Office user publishes changes. The label was previously "Under Review" and was renamed to "Awaiting Review" as part of I2G-30169.

**Referred** — a business rule or underwriting trigger has held the shipment for human decision. Owned by the Back Office. Sub-states inside the referral itself decide what happens next: Pending (with the underwriter), Awaiting Information (with the participant), Approved (the shipment returns to Quoted for booking), or Declined (the shipment returns to Quoted but is not bookable under those terms — the participant will normally edit and re-submit). See Referral Management.

**Booked** — the participant has pressed Book and the shipment is now live cover. Owned by the participant, though nothing is required — cover is in force under the policy's terms. From here the shipment can be amended (endorsed), can be cancelled by request from the participant, can be cancelled directly by the Back Office, can be reopened by the Back Office for a premium or clause change (moves to Booked – Awaiting Review), can expire when the policy end date passes, or can lapse if the policy lapses.

**Booked – Awaiting Review** — Back Office is editing a booked shipment. Same participant-blocking behaviour as Quoted – Awaiting Review. Exits back to Booked on Publish Changes.

**Booked – Endorsed** — the shipment has been amended after booking. All the same exits as Booked apply. Endorsements can be repeated; a Booked – Endorsed shipment can be endorsed again, and every endorsement is kept in the audit trail.

**Booked – Endorsed – Awaiting Review** — same idea for an endorsed shipment.

**Pending Cancellation** — a participant has raised a cancellation request. Owned by the Back Office. The next move is Approve (transitions to Cancelled) or Reject (returns to Booked or Booked – Endorsed).

**Cancelled** — terminal. Coverage has been terminated, either by direct Back Office cancel or by an approved participant request. The certificate stays on the Documents tab for the audit trail. Cancelling a Booked – Endorsed shipment cancels every endorsement alongside the original booking — there is no per-endorsement reversal.

**Expired** — terminal. The policy end date passed while this shipment was in force. System-triggered.

**Lapsed** — terminal. The underlying policy lapsed. System-triggered.

### Updating premium and clauses from the Back Office

There is a Back Office-only workflow that lets a broker or underwriter override a shipment's premium components or amend its clauses without recreating the shipment or forcing an endorsement. It is the main tool for applying an ad-hoc discount, adding or removing a specific clause, or making an insured-value adjustment reflected on the certificate.

The Back Office user opens the shipment and presses **Update Premium & Clauses**. The shipment transitions to its **Awaiting Review** sub-status (Quoted – Awaiting Review, Booked – Awaiting Review, or Booked – Endorsed – Awaiting Review depending on where it started). From that moment the participant is locked out — they can still see the shipment on their dashboard but cannot press Book, cannot request cancellation, cannot endorse.

Inside the Awaiting Review sub-status the Back Office user can:

- Override the insured value.
- Override the rate — a manual rate applied on top of the rating engine's result.
- Override individual charges — line-by-line adjustment of shipment charges.
- Provide a reason — free-text justification. Mandatory whenever any override is set. Every override is audited alongside the reason, and the reason is what makes the audit useful later.
- Edit the clauses on the Clauses tab — add or remove entries. Custom clauses can be authored on the fly from the shipment (drawn from the global clauses library in shipment-source mode).

When the Back Office user is satisfied, they press **Publish Changes**. The shipment returns to its prior status (Quoted, Booked, or Booked – Endorsed) with the new values live. Every override is logged with its reason. The participant sees the new premium and clauses on their next view. If a booked shipment had its premium changed, the certificate is re-issued on the Documents tab — the previous certificate is preserved.

Two operational rules apply. First, Awaiting Review is intentionally visible to participants. They can see that the Back Office is working on the shipment; the point is to avoid a silent lock. Second, closing the browser without publishing leaves the shipment stuck in Awaiting Review — another Back Office user can resume the flow, or press **Discard changes** to revert and exit Awaiting Review.

Special conditions deserve a specific mention. Any clause added at the shipment level can be explicitly marked as a Special Condition. Special Conditions appear on the certificate in a separate section below the standard Insuring Conditions, giving them the visual weight they need.

### MVP scope note

The current live MVP is scoped to Kuehne+Nagel Poland road logistics only. Sea, air, and rail conveyances are configured but not yet activated for live business. The participant company set is Poland-based logistics teams. Bulgaria, Croatia, and Hungary are on the phase-two roadmap along with the Salog SOAP integration, China Zurich e-Marine, sea/air/rail activation, full claims handling, bulk-upload-with-edits, and cluster-based clause auto-assignment. The portal is built for the full scope; the MVP is a deliberate restriction on which policies and conveyances are turned on.

## Business rules & calculations

- **Visibility is participant-scoped.** A Shipment Portal user sees only shipments they created or shipments belonging to their participant company (and its descendants in the organisation tree). Filtering is enforced server-side.
- **No admin power in the portal.** The Shipment Portal cannot edit clauses, rules, policies, or business partners. Those pages are Back Office-only and cannot be reached from the portal domain even by URL guess.
- **Live rating on every submission.** The same rating pipeline used in the Back Office runs on every portal quote — same rating catalogue, same special rates, same business rules, same FX table.
- **30-day quote validity.** Every Quoted shipment expires 30 days after the quote is calculated. Booking after that requires a re-rate.
- **Premium locks at booking.** Whatever the rating engine produced at the point of Book is what is bound onto the certificate. Subsequent changes require an endorsement, a Back Office override, or a cancellation.
- **Booked shipments are read-only in the portal.** All changes go through endorsement or cancellation. There is no in-place edit.
- **Awaiting Review locks participants out.** While the Back Office is mid-edit on premium or clauses, the participant cannot act on the shipment. The lock resolves on Publish Changes or Discard.
- **Referred blocks booking.** Every referral on a shipment must close before the shipment can be booked. A shipment can accumulate more than one referral over its life and each is closed independently.
- **Cancellation cascades through endorsements.** Cancelling a Booked – Endorsed shipment cancels every endorsement alongside the original booking. Endorsements are not reversible individually.
- **Awaiting Review is visible.** The sub-status is deliberately shown to participants so they know why they cannot act.
- **Bulk-uploaded shipments skip the portal.** Imported shipments land directly as Booked with a bulk-uploaded marker. There is no quote step and no participant intervention.
- **Passwordless authentication.** Sign-in is email one-time passcode or Microsoft single sign-on. There is no password to reset or leak.
- **Named assured auto-create.** When the setting is enabled, an unrecognised named assured typed into the form is created automatically. Bulk-upload rows do the same.
- **The counter cards on the dashboard show counts, not totals.** They are the number of shipments in each status, not the sum of insured values.

## Related concepts

- Quote Creation (Creating and Booking a Shipment)
- Shipment Statuses
- Referral Management
- Cancellations
- Shipment Endorsing (Amendment)
- Dashboard Pages Reference
- Shipment Preference Persistence
