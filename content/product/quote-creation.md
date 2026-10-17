# Quote Creation (Creating and Booking a Shipment)

## What it is

Quote creation is the end-to-end flow that turns a planned cargo movement into a priced, documented, and eventually bound insurance quote under an active cargo policy. It has three phases stitched together on one journey. First, the participant (or a broker acting on their behalf) declares the shipment — assured, trip, cargo. Second, the system rates the declaration and returns a quote with a premium breakdown and a draft certificate. Third, the participant either books the quote (turning it into live cover) or lets it sit until it is edited, referred, cancelled, or expires.

For most participants, this is the entire reason they sign in to the Shipment Portal. For brokers and underwriters in the Back Office, it is the same declaration form but with additional interfaces for creating shipments on behalf of a participant, overriding premium, and editing clauses.

## Who uses it & where

- **Participants** — shippers, consignees, freight forwarders. They declare, quote, and book shipments in the Shipment Portal for their own participant company. This is the highest-frequency task on the platform.
- **Producers and brokers** — do the same flow from the Back Office when they need to submit a shipment on behalf of a participant who cannot transact directly, or when they need to intervene on the premium or clauses.
- **Underwriters** — do not create shipments, but they enter this flow through referrals when the rating engine cannot resolve a declaration automatically.
- **Bulk-upload jobs** — bypass the declaration form entirely. Shipments imported in bulk land directly as Booked and skip the quote step.

The declaration form is the same underlying record either way — a shipment created from one interface is immediately visible in the other.

## How it works

### Starting a shipment

The participant lands on the Shipment Dashboard and presses **Create Shipment** (labelled **Create Quote** in some builds). A policy-selection dialog appears listing every active policy the signed-in user has access to. The user picks the policy under which they want to declare this movement and confirms. In the Back Office, a producer can start the same flow from the top-navigation **Create** action and pick the participant on whose behalf they are declaring.

Once the policy is chosen, the declaration form opens with a **policy summary card** at the top showing the holder, the policy version, and the Maximum Insurable Limit per Shipment. That card is a constant reminder of what this policy can price. Below it, the form is organised into three sections that must be completed in order.

### Section one — assured details

The user picks an existing Named Assured from a dropdown or creates a new one inline by pressing **Create new** and typing the name and address. There is no need to set the assured up beforehand — inline creation is supported directly from the form.

In the Back Office, a producer additionally chooses the **Participant Company** when more than one is valid on the policy. Participants in the Shipment Portal are already scoped to their own participant company, so no choice is offered.

### Section two — trip details

Every field here shapes both the price and the eligibility of the movement.

- **Conveyance** — air, sea, road, or multimodal. The dropdown is filtered to conveyances the policy allows. If the policy is a Poland-road MVP policy, only road appears.
- **Departure city** and **departure country** — the origin of the movement. Address entry uses the Google Maps autocomplete so the user picks a real, resolvable location rather than free-typing.
- **Destination city** and **destination country** — the endpoint of the movement, also with Google Maps autocomplete.
- **Vessel name** (sea) or **flight name / number** (air) — required for those conveyances so the certificate can name the carrier.
- **Incoterms** — the commercial term governing risk and cost transfer (for example CIF, FOB, EXW). Drives interpretation of who has insurable interest at each leg.
- **Departure date** and **arrival date** — planned dates for the movement.

### Section three — cargo details

- **Commodity group** — the classification of what is being shipped. The dropdown is filtered to the commodity groups allowed on this policy. A free-text description above the picker feeds an AI suggestion engine that proposes the most likely group, which the user accepts or overrides.
- **Detailed description** — a free-text elaboration of the cargo. Appears verbatim on the certificate.
- **Packing** — how the cargo is packed (professionally packed, unpacked, and so on). A rating dimension.
- **Coverage** — the depth of cover requested (broadly aligned to Institute Cargo Clauses A, B, or C, plus any policy-specific variants).
- **Insured value** — the declared value of the cargo, with a currency dropdown. The currency list is drawn from the policy's billing settings, not a global list — so the user only sees currencies that policy is configured to price in. The insured value must respect the policy's Maximum Insurable Limit per Shipment; declaring above the cap does not fail the form outright but will trigger a referral to the underwriter.
- **Freight charges** — a separate amount, held apart from the goods value so the rating engine can treat freight independently of the insured value if the policy requires it.
- **Insurance language** — the language the certificate will be issued in. Defaults to the policy's primary certificate language; the user can switch to the secondary language when one is configured on the policy.

### Attachments and Q&A during creation

Beyond the three form sections, the user may see two other interactions.

**Attachments.** The user can upload supporting documents at declaration time — packing lists, commercial invoices, prior certificates, photographs. These attachments are stored on the shipment and travel with it through referral and booking. Documents attached during creation are always visible on the Documents tab of the shipment record and remain available through the shipment's whole life.

**Inline business-rule questions.** As the user completes the form, the system evaluates business rules against the shipment. When a rule is configured with a question prompt (for example "Is the cargo temperature-controlled?" or "Is the declared value net of packaging?"), the question appears inline on the shipment form. The participant answers directly before submitting. Answers are stored on the shipment and are visible in the audit trail and to any downstream underwriter who reviews the referral. Answers cannot be silently rewritten later — they are permanent.

### Saving or quoting

Once the three sections are complete, the user picks one of two exits.

- **Save as Draft** — persists the shipment in Draft status. No premium is calculated. The user, or a colleague on the same participant company, can return later and finish it. Drafts do not expire on any fixed schedule but are ignored by the rating engine and by every dashboard filter other than "Draft".
- **Submit & Quote** — validates the form, persists the shipment, and runs the rating pipeline. If the rating engine can resolve the shipment against the policy's rating tables, business rules, and any applicable special rates, the shipment moves to Quoted status and the user is taken straight to the shipment 360 view. If the engine cannot resolve it with confidence — for example the value crosses a threshold, a country is restricted, a sanctions match fires, or an underwriting rule is triggered — the shipment moves to Referred instead. The user cannot book a referred shipment; the referral has to close first.

The form preserves data across navigation. If the user accidentally leaves the page, they are prompted to discard or save as draft — no work is silently lost.

### The quote result page (shipment 360 view)

A successful quote lands the user on the Shipment Details page, also called the Shipment 360 view — the complete record of the shipment. The header shows the shipment number, a status badge (Quoted), and the actions available for that status. Below the header, six tabs hold the shipment's data.

- **General Details** — every fact captured at declaration, grouped into General Information (number, creator, creation date, policy, holder, expiry), Trip Details (participant company, named assured, conveyance, origin and destination, departure info), Cargo Details (commodity, commodity group, coverage, packing, insured value, vessel details), and the Premium Breakdown showing every line item the rating engine produced.
- **Clauses** — the clauses attached to this specific shipment. The base list is inherited from the policy; any clauses added on top by a broker sit here too. The Back Office can edit this list when the shipment is Under Review.
- **Documents** — the draft certificate for a Quoted shipment, the issued certificate once Booked, plus any endorsement notes and any documents uploaded by either side. Language variants appear when the policy has both primary and secondary certificate languages configured.
- **Emails** — the history of every email sent to or from the system in connection with this shipment. Useful for confirming whether the participant has actually been notified.
- **Activity** — the audit trail. Every state change, edit, referral action, override, and user action against this shipment is timestamped and captured here. In participant view, internal Back Office actions are filtered out; in Back Office view, everything is visible.
- **Referrals** — a grid of every referral raised against this shipment. A shipment can accumulate more than one referral over its life.

The action buttons on the header change with the status. For a Quoted shipment the participant sees **Edit** and **Book**, and a Back Office user additionally sees **Update Premium & Clauses**.

### Booking a shipment

When the customer accepts the quoted premium, the participant opens the shipment and presses **Book**. A confirmation dialog appears; on confirm, the shipment transitions from Quoted to Booked. From that moment cover is in force under the policy's terms and conditions. The certificate document is generated and appears on the Documents tab, replacing the draft. If the shipment was in Quoted – Under Review (a Back Office user is mid-edit on premium or clauses) the Book action is hidden until they publish the change. Booking is also blocked while any referral is open against the shipment — the referral has to resolve first.

Once the shipment is Booked, editing is no longer possible in place. Every subsequent change is either an endorsement (which preserves history) or a cancellation.

### After booking — endorse, cancel, or let it run

A booked shipment continues in force until one of three things happens.

- The user needs to change something material — the insured value is wrong, the vessel has changed, the description needs refining, the dates have shifted. That is an endorsement, and it re-issues the certificate while keeping the original booking on record.
- The user needs the coverage removed — the movement is not happening, or the shipment was booked in error. That is a cancellation.
- The cover period ends — the policy expiry date passes, in which case the shipment moves to Expired, or the underlying policy lapses, in which case the shipment moves to Lapsed. Both are terminal.

### Special-rate escape hatch during quoting

If the rated premium does not work commercially for a particular movement — a large customer with a competitor's cheaper quote, a corridor priced too aggressively — the participant or the broker can submit a special-rate request from the shipment itself. That opens a parallel flow (see Special Rate) where an underwriter approves a bespoke rate that then feeds back into a re-rated quote on this shipment.

## Business rules & calculations

- **Quote validity is 30 days.** Every Quoted shipment carries a 30-day expiry from the moment the quote is generated. If the customer does not book within that window the shipment is treated as Expired and cannot be booked without being re-rated.
- **Premium locks at booking.** Whatever the rating engine produced when the participant pressed Book is what is bound onto the certificate. The only way to move that number afterwards is an endorsement, a Back Office premium override (audited, with a mandatory reason), or a cancellation followed by a fresh declaration.
- **Insured-value cap.** The declared value must respect the policy's Maximum Insurable Limit per Shipment. Declaring above it does not silently fail — the shipment moves to Referred so an underwriter can decide.
- **Currency is policy-scoped.** The Insured Value currency dropdown comes from the policy's billing settings, not a global list. This is deliberate — a Poland-road policy priced in PLN and EUR should never offer BRL as an option.
- **FX uses the previous day's rate.** The FX provider syncs every day at midnight; the rate applied to a shipment is the previous day's rate at the point of quoting.
- **Bulk-uploaded shipments skip the quote step.** Imported shipments land directly as Booked with a "bulk uploaded" marker. There is no draft, no quote, no Book action — the import is the booking.
- **Referral blocks booking.** A Quoted shipment with an open referral cannot be booked. The Book action is hidden until every referral on the shipment resolves.
- **Under-Review blocks booking.** A Quoted shipment where a Back Office user is mid-edit on premium or clauses is in the Under Review sub-status. Participants can see it but cannot act on it until the change is published.
- **Booked is read-only in the Shipment Portal.** Once bound, all changes go through endorsement or cancellation. There is no direct edit action on a Booked shipment.
- **MTA continuation.** When a policy is already endorsed and running, a new shipment attaches to the current endorsed policy version rather than creating a new version.
- **Named assured auto-create.** If the assured is not in the dropdown the user creates it inline; when the auto-create setting is enabled the system will also create one from bulk-upload rows silently.
- **Certificate re-issue on any change.** Any endorsement, any Back Office premium change, and any clause change on a Booked shipment re-issues the certificate. The previous certificate stays available on the Documents tab for traceability.
- **Everything is audited.** Every state change, edit, override, and action against the shipment is captured in the Activity tab. In back-office view every actor is named; in participant view internal actions are filtered but the participant's own actions are visible.

## Related concepts

- Shipment Portal
- Shipment Statuses
- Referral Management
- Cancellations
- Rating
- Business Rules
- Documents
