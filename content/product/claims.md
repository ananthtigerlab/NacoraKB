# Claims

## What it is

Claims is where an insured party (via the broker, on the participant's or named assured's behalf) records a loss event against a booked shipment. In the MVP-1 build this is a **three-step logging module** — capture the incident, upload evidence, submit to the surveyor group named on the policy. The platform does not yet adjudicate, reserve, or pay claims; that is post-MVP scope pending selection of an external claims-management tool (LIMs or TIPs — vendor decision still open with the client). What the MVP delivers is the intake surface plus the outbound routing to the surveyor.

Every claim ties back to a specific booked shipment and inherits the policy's coverage, clause set, and insurers. The claim number, once generated, is the reference finance and the surveyor use for the rest of the loss lifecycle — even after adjudication moves off-platform.

## Who uses it & where

- **Brokers and Producers** — open claims on their booked shipments, upload documents, monitor status. Backoffice.
- **Participants** — cannot open claims directly in MVP-1; they contact the broker who opens on their behalf. This is a deliberate scoping choice for the initial rollout.
- **Surveyor Groups** — receive claim intake emails with the shipment reference and the initial evidence pack. They handle loss investigation off-platform.
- **Nacora operations** — monitor open claims across the book, chase surveyors, coordinate with the insurer, capture updates from off-platform activity.
- **Finance** — reads the claims list for premium/loss ratio calculations even before adjudication runs on-platform.

Claims live under the Backoffice **Claims** sidebar module. Each shipment 360 also has a Claims tab showing every claim raised against that shipment.

## How it works

### Step 1 — Capture the incident

The broker opens a booked shipment (or clicks New Claim from the Claims dashboard). The intake form asks for:

- **Date of loss** — when the incident occurred (not when it was reported).
- **Place of loss** — free text, with a Google Maps hint field for accuracy.
- **Type of loss** — dropdown (see Options & choices below).
- **Cause of loss** — free text description; several hundred characters allowed. This is what the surveyor reads first.
- **Estimated value of loss** — decimal, in the shipment's insured-value currency.
- **Contact person** — the named assured or their representative; defaults to the named assured on the shipment but is editable.
- **Whether the shipment has arrived** — Yes / No / Partially. Drives whether the surveyor will inspect goods at destination or at an interim location.

The form validates that the shipment is Booked or Endorsed (a Quoted shipment cannot have a claim; a Cancelled shipment can, but the flow warns and requires an explicit override). Once submitted, the platform generates a claim number and moves to step 2.

### Step 2 — Upload evidence

The broker uploads supporting documents into the claim's attachment folder. Typical items:

- Photographs of damage.
- Delivery notes and bills of lading.
- Commercial invoices for the affected cargo.
- Any customs or inspection reports already produced.
- Correspondence with the shipper, consignee, or logistics provider.

Any file type accepted by the platform's attachment layer is allowed — PDFs, JPEGs, PNGs, DOCX, XLSX. Files land in the shipment's attachment tree under a Claims folder. The broker can revisit and add more evidence at any point in the lifecycle.

### Step 3 — Submit to surveyor

The broker clicks Submit. The platform:

1. Sends a notification email to the surveyor group named on the policy's Other Parties step, with the claim number, the shipment reference, the date and place of loss, the type of loss, the cause description, and links to every uploaded document.
2. Copies the notification to the broker, the participant, and the assigned underwriter (if the policy has one).
3. Records the submission in the audit trail with actor, timestamp, and full recipient list.
4. Sets the claim status to **Reported** (see States & transitions).

From that moment on, the surveyor investigates off-platform. Loss adjustment, adjudication, settlement, and closure happen outside the MVP-1 surface. Status updates come back to the platform manually — the broker or an administrator sets Under Investigation, Settled, Closed, or Declined as they learn the outcome from the surveyor.

### The Claims dashboard

The Backoffice Claims module lists every claim across the book. Filters:

- Status.
- Broker company / policy / shipment.
- Date of loss (from-to).
- Type of loss.
- Estimated value bucket.

Column configuration honours the standard user-preferences persistence pattern.

## Options & choices

### Type of loss (dropdown)

| Value | Meaning |
|---|---|
| Damage | Physical damage during transit — impact, water, crushing, contamination |
| Theft | Cargo taken from vehicle, warehouse, or in-transit event |
| Non-Delivery | Cargo did not arrive at destination; whereabouts unknown or confirmed lost |
| Shortage | Cargo arrived but with fewer units than declared |
| Contamination | Cargo compromised by contact with another substance or condition |
| Temperature Excursion | Reefer cargo exposed to out-of-spec temperature (Refrigerated conveyance) |
| Delay | Cargo arrived materially late, triggering coverage under the policy's delay clause if any |
| Other | Free-text follow-up in the cause description |

### Claim actions

| Action | Who | Effect |
|---|---|---|
| New Claim | Broker | Opens a new claim on the selected shipment |
| Add Evidence | Broker | Attaches files to an existing claim |
| Update Status | Broker / Admin | Moves the claim through the lifecycle |
| Add Note | Broker / Admin / Underwriter | Appends a dated note visible to the internal team |
| Reassign | Admin | Changes the surveyor group (rare — the policy's default surveyor is preferred) |
| Export claim pack | Broker | Downloads a ZIP with the claim record and every attachment; used to hand off to an external claims-management tool |

## Business rules & calculations

- **Only Booked or Endorsed shipments** can have a claim opened against them without warning. Cancelled shipments require an explicit override; Quoted and Declined shipments cannot have a claim.
- **Claim number format:** `CLM-XXXXXX`, six-digit zero-padded, deployment-wide. Numbers are never reused.
- **Surveyor routing is per policy.** The policy's Other Parties step names the primary surveyor group; every claim on a shipment under that policy notifies that group. A secondary surveyor group can be configured for backup routing.
- **Reporting cadence:** a claim not moved out of Reported within 14 days triggers a chase email to the surveyor group and copies the broker.
- **Value cap:** if the estimated value of loss exceeds the shipment's insured value, the intake form flags it as a warning (not a hard block — some policies allow over-value claims under specific clauses).
- **Audit trail:** every claim action is captured; retention follows the standard audit retention window.

## States & transitions

Claims move through a small state machine, kept simple in MVP-1 because most adjudication happens off-platform.

| State | Meaning | Triggered by | Next states |
|---|---|---|---|
| Draft | Intake started, not yet submitted | Broker opens New Claim | Reported (on Submit) or discarded |
| Reported | Submitted to the surveyor group | Broker clicks Submit | Under Investigation, Declined, Closed |
| Under Investigation | Surveyor is actively investigating | Broker or Admin updates status | Settled, Declined, Closed |
| Settled | Loss adjusted and paid (off-platform); recorded here for the ledger | Admin updates status | Closed |
| Declined | Insurer or surveyor rejected the claim | Broker or Admin updates status | Closed |
| Closed | Terminal — no further action | Admin updates status | (terminal) |

Status transitions are manual — the platform does not attempt to infer state from surveyor emails or external systems in MVP-1.

## Related concepts

- Shipment Statuses
- Cancellations
- Documents
- Mail Notifications & Templates
- Business Partner
