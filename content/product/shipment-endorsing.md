# Shipment Endorsing (Amendment)

## What it is

Shipment endorsement is a controlled change to a single shipment after it has been booked. The endorsement carries the new values forward while keeping the original booking on the record. Nothing is overwritten — the full history stays intact for audit and reporting. It is the mechanism by which a booked shipment is amended without recreating it or losing its history.

Shipment endorsement is distinct from a policy Mid-Term Adjustment (MTA). A policy MTA changes the policy itself and creates a new policy version. A shipment endorsement changes one specific shipment and creates a new endorsement record on that shipment. The participant-facing action is often labelled "Amend Shipment" in the interface; internally and in documentation the same action is called an Endorsement.

## Who uses it & where

- **Participants** endorse their own booked shipments from the Shipment Portal — the primary audience. They amend the insured value, the vessel or flight, the cargo description, or the dates when something material has changed since booking.
- **Brokers and producers** endorse shipments on behalf of participants from the Back Office when the participant cannot transact directly.
- **Underwriters** do not endorse shipments directly, but they interact with endorsements when the endorsement triggers a referral — in which case the endorsement is held while the referral is reviewed.

## How it works

### When endorsement is the right action

An endorsement is the right tool whenever something material about a booked shipment changes and needs to be reflected on the certificate. Common reasons:

- The insured value needs correcting — the declared value at booking was wrong or the underlying goods value has been revised.
- The vessel or flight has changed — the original booking was against a specific carrier that is no longer operating that leg.
- The cargo description or commodity needs refining — the initial description was too vague or was miscategorised.
- The departure or arrival dates need adjusting — the movement has slipped or has been brought forward.

If the shipment is not going to happen at all, endorsement is not the right action — cancellation is. If the shipment is arriving differently and needs to be unwound entirely, cancellation is again the right path (though an arrival flag on the cancellation request will alert the broker to scrutinise the case). Endorsement is for genuine amendments, not for reversal.

### Preconditions

The shipment must be in Booked or Booked – Endorsed status. The Endorse action (labelled Amend Shipment in the participant-facing interface) is hidden on every other status. A Draft or Quoted shipment does not need to be endorsed — it can be edited in place. A Cancelled, Expired, Lapsed, Pending Cancellation, Referred, or Under Review shipment cannot be endorsed because either cover is not in force or the shipment is currently locked.

Before starting, the user should know exactly what they are changing. The form opens pre-populated with the current values, and it is easy to leave a field untouched by mistake — always review the whole form even when only one field needs changing.

Participants should be aware that endorsements can trigger a referral if the change crosses a configured threshold. Raising the insured value above the Maximum Insurable Limit is a common trigger; changing the commodity into a restricted class is another. When an endorsement triggers a referral, the endorsement is held in Referred status until the referral resolves.

### The endorsement steps

The user opens the shipment from the Shipment Dashboard or from a notification link. They land on the shipment 360 view. From the header, they press **Endorse** (or **Amend Shipment**, depending on the interface label).

The endorsement form opens with every current value pre-populated. It has the same shape as the create-shipment form — assured details, trip details, cargo details — but every field is already filled with the value from the current booking (or the latest endorsement if the shipment is already Booked – Endorsed).

The user makes their changes. Editable fields include the assured, conveyance, departure and destination cities and countries, vessel or flight, incoterms, departure and arrival dates, commodity group, description, packing, coverage, insured value and currency, freight charges, and insurance language. As with the initial declaration, address changes use Google Maps autocomplete so the endpoints on the certificate remain resolvable.

When ready, the user presses **Submit Endorsement**. The system runs validation, then either creates the endorsement record and moves the shipment to Booked – Endorsed, or (if the change triggers a business rule) moves the endorsement into Referred status and creates a referral for the Back Office.

### What happens after submission

- A new endorsement record is created on the shipment. The original booking stays on the record. Every endorsement adds another layer; the full history is preserved and visible on the Activity tab.
- The shipment transitions to Booked – Endorsed.
- The certificate is re-issued with the new values. The previous certificate stays available on the Documents tab for traceability.
- If the endorsement triggers a referral, the endorsement is held in Referred status until the referral resolves. On approval, the endorsement takes effect. On decline, the endorsement is not applied and the shipment reverts to its pre-endorsement state.
- An email notification is fired to the participant and to the broker.

### Endorsement chains

Endorsements can be repeated. A Booked – Endorsed shipment can be endorsed again, creating a chain of endorsements. Each one is kept in the history. The shipment stays in Booked – Endorsed status through the chain — the status does not accumulate levels ("Booked – Endorsed – Endorsed" is not a thing). The chain is visible in the Activity tab and each endorsement produces its own certificate re-issue.

### Endorsement and cancellation

Cancelling a Booked – Endorsed shipment cancels every endorsement in the chain alongside the original booking. Endorsements are not reversible individually. If a specific endorsement was wrong and needs to be undone, the correct approach is another endorsement that restores the desired values — not a cancellation of the whole shipment.

### Endorsement vs Back Office premium override

There are two mechanisms to change a booked shipment. Endorsement is used when the amendment is a change to the risk itself — the insured value, the vessel, the cargo, the dates. Endorsement re-runs rating and creates a new endorsement record.

The Back Office premium and clauses update is used when the amendment is a commercial adjustment or a clause change without a change to the underlying risk — for example, applying an ad-hoc discount that no business rule covers, or adding a specific clause. It moves the shipment through the Under Review sub-status rather than creating an endorsement record. Every override is audited with a mandatory reason. See the Shipment Portal page for the Update Premium & Clauses flow.

Endorsement and Back Office overrides can both re-issue the certificate.

## Business rules & calculations

- **Only Booked and Booked – Endorsed shipments can be endorsed.** Every other status blocks the action.
- **The form opens pre-populated.** The user is amending, not re-declaring. Every current value is already filled in.
- **History is preserved.** The original booking (and every prior endorsement in the chain) stays on record. Nothing is overwritten.
- **Endorsements can trigger a referral.** Value increases, commodity changes, or route changes that cross configured thresholds hold the endorsement in Referred until the referral resolves.
- **Certificate re-issue on every endorsement.** The current certificate is replaced by a new one carrying the amended values; the previous certificate remains on the Documents tab.
- **Endorsements chain.** A Booked – Endorsed shipment can be endorsed again. The chain is unlimited.
- **Cancellation cascades through the chain.** Cancelling a Booked – Endorsed shipment cancels every endorsement alongside the original booking. There is no per-endorsement reversal.
- **The status does not accumulate.** After the first endorsement the shipment is Booked – Endorsed; further endorsements keep it in Booked – Endorsed rather than adding levels.
- **Participants can endorse their own shipments.** The endorsement action is available in the Shipment Portal without a broker step, though the resulting endorsement can still be caught by a referral.
- **Endorsement is distinct from Back Office premium override.** Endorsement changes the risk; the Back Office premium and clauses update changes the commercial terms or the wording without touching the risk. Both are audited.
- **Endorsement is distinct from policy MTA.** Endorsement changes one shipment; MTA changes the policy and creates a new policy version. The two flows are unrelated.
- **Every endorsement is audited.** Every submission is captured on the Activity tab with the actor, the timestamp, the field changes, and any comment.

## Related concepts

- Shipment Portal
- Quote Creation (Creating and Booking a Shipment)
- Shipment Statuses
- Cancellations
- Referral Management
- Adjustments (MTA)
