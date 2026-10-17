# Shipment Statuses

## What it is

Every shipment in NacoraHub is in exactly one status at any moment. The status controls what actions are available on the shipment, who is allowed to act, which screens the shipment appears on, and whether the record is editable at all. This page is the canonical status reference — every status, its owner, what transitions are possible from it, and who can trigger each transition.

The lifecycle is deliberately not a simple linear chain. Shipments have side branches for Under Review sub-states (Back Office edits), Referred (underwriting review), Pending Cancellation (participant request awaiting decision), and terminal endings for Cancelled, Expired, and Lapsed.

## Who uses it & where

- **Participants** care about statuses because they decide whether the participant can act — Book, Amend, Request Cancellation.
- **Brokers and underwriters** care about statuses because they decide what is on the shipment pipeline view, what is stuck waiting for someone, and what actions are open to the Back Office.
- **Administrators and system operators** care about statuses for reporting and audit — every state change is timestamped and captured on the Activity tab of the shipment 360 view.

## How it works

### The full status list

The table below is the canonical set of shipment statuses, who creates them, whether the shipment can be edited in place, whether it can be amended by endorsement, and how each state behaves.

| Status | Created by | Editable? | Amend by endorsement? | Notes |
| --- | --- | --- | --- | --- |
| **Draft** | Participant or Broker | Yes | No | Saved but not yet rated. No premium; no quote. |
| **Quoted** | System (on Submit & Quote) | Yes (resubmit through Edit) | No | Premium calculated. Participant can book. Quote is valid for 30 days from calculation. |
| **Quoted – Under Review** | System (Back Office opens for edit) | Back Office only | No | Back Office is adjusting premium or clauses. Participant is locked out; the sub-status is intentionally visible so the participant knows why. |
| **Referred** | System (business rule or manual referral) | No (locked) | No | Referred to underwriting. Every referral on the shipment must close before the shipment can proceed. Sometimes surfaced as a Quoted sub-status ("Quoted – Under Review" in some builds) — the semantics are the same: a broker or underwriter is assessing the risk. |
| **Booked** | Participant or Broker | No | Yes | Cover is in force. Certificate has been issued. |
| **Booked – Under Review** | System (Back Office opens for edit) | Back Office only | No | A booked shipment is being edited by the Back Office. |
| **Booked – Endorsed** | Participant or Broker | No | Yes | Amended after booking via endorsement. Coverage remains in force. Updated certificate issued; previous certificate preserved. |
| **Booked – Endorsed – Under Review** | System | Back Office only | No | An amended shipment is currently being edited by the Back Office. |
| **Booked – Pending Cancellation Approval** | Participant | No | No | Participant has requested cancellation. Coverage continues until the Back Office approves or rejects. Often abbreviated to "Pending Cancellation". |
| **Cancelled** | Back Office | No | No | Terminal. Coverage terminated. Either Back Office cancelled directly or approved a participant cancellation request. Certificate and every prior document stay for audit. |
| **Expired** | System | No | No | Terminal. Policy end date passed while the shipment was in force. |
| **Lapsed** | System | No | No | Terminal. Underlying policy lapsed. |

### Transitions in detail

**From Draft.** The participant or the producer can Submit & Quote, which validates, persists, and runs the rating engine. On successful rating the shipment moves to Quoted. On a rating trigger — for example a business rule fires or a threshold is crossed — the shipment moves to Referred instead. The participant can also delete a Draft, which removes it from the system.

**From Quoted.** The participant presses Book to move to Booked; that is the primary exit. The Back Office can press Update Premium & Clauses to move the shipment to Quoted – Under Review while they edit. The system moves the shipment to Referred if a new business rule fires (for example, on a re-quote after edit). The Quoted state also expires after 30 days from the quote calculation date — a stale quote cannot be booked without re-rating.

**From Quoted – Under Review.** The Back Office user presses Publish Changes to move the shipment back to Quoted with the new premium or clauses active. Alternatively, they discard the changes and the shipment returns to Quoted with the original values.

**From Referred.** The referral owner (underwriter or broker) approves the referral and the shipment returns to Quoted, this time bookable. Or they decline and the shipment returns to Quoted but is held under those terms — the participant will normally edit and re-submit under different values. If the shipment carries more than one referral, all must close before it exits Referred.

**From Booked.** The participant can Amend Shipment (endorse) to move to Booked – Endorsed. The participant can Request Cancellation, which creates a pending-cancellation record and moves the shipment to Booked – Pending Cancellation Approval. The Back Office can Cancel directly, moving straight to Cancelled without participant approval. The Back Office can press Update Premium & Clauses to move to Booked – Under Review. The system moves the shipment to Expired when the policy end date passes and to Lapsed if the policy itself lapses.

**From Booked – Under Review.** The Back Office publishes changes, returning to Booked with the new values active.

**From Booked – Endorsed.** All the same exits as Booked apply: Amend (creates a further endorsement, stays as Booked – Endorsed), Request Cancellation (to Pending Cancellation), Back Office direct Cancel (to Cancelled), Update Premium & Clauses (to Booked – Endorsed – Under Review), Expired, and Lapsed. Endorsements can be repeated indefinitely; each one is kept in the audit trail as a separate record.

**From Booked – Endorsed – Under Review.** The Back Office publishes changes, returning to Booked – Endorsed.

**From Booked – Pending Cancellation Approval.** The Back Office reviews and either approves cancellation (shipment moves to Cancelled) or rejects (shipment returns to Booked or Booked – Endorsed depending on where it came from).

**From Cancelled, Expired, Lapsed.** Terminal. No further action.

### Who owns each state and what they should do next

- **Draft** — owned by the participant (or the producer acting on their behalf). Next action: complete the form and press Submit & Quote. Otherwise delete.
- **Quoted** — owned by the participant. Next action: press Book to accept the quote and put cover in force. Or let it sit while the customer decides, aware of the 30-day validity.
- **Quoted – Under Review** — owned by the Back Office (typically an underwriter). Next action: finalise premium and clause edits and press Publish Changes.
- **Referred** — owned by the Back Office. Next action: resolve every open referral. See the Referral Management page for the mechanics.
- **Booked** — owned by the participant, though nothing is required. Cover is in force. Endorse or cancel only if something changes.
- **Booked – Under Review** — owned by the Back Office. Publish or discard.
- **Booked – Endorsed** — owned by the participant, though nothing is required. The endorsement is recorded and cover continues.
- **Booked – Endorsed – Under Review** — owned by the Back Office. Publish or discard.
- **Booked – Pending Cancellation Approval** — owned by the Back Office. Approve or reject the cancellation request.
- **Cancelled, Expired, Lapsed** — owned by the system or the Back Office. Terminal — no further action.

### Triggers — what causes each transition

- **Submit & Quote** validates the form, runs rating, and moves the shipment from Draft to Quoted (or to Referred if a business rule fires).
- **Book** locks the shipment, generates the certificate, and moves it to Booked.
- **Endorse (Amend Shipment)** opens the form pre-filled; submission creates an endorsement record and moves the shipment to Booked – Endorsed.
- **Request Cancellation (Participant)** moves the shipment to Booked – Pending Cancellation Approval.
- **Cancel (Back Office direct)** moves the shipment to Cancelled outright.
- **Approve / Reject cancellation (Back Office)** moves the shipment to Cancelled or back to Booked / Booked – Endorsed.
- **Update Premium & Clauses (Back Office)** moves the shipment to the relevant Under Review sub-status.
- **Publish Changes (Back Office)** exits Under Review and returns to the prior status with new values.
- **Underwriting referral** moves the shipment to Referred.
- **Policy end date passes** moves the shipment to Expired.
- **Policy lapses** moves the shipment to Lapsed.

## Business rules & calculations

- **Quote validity is 30 days.** A Quoted shipment cannot be booked more than 30 days after the quote was calculated. Older quotes require a re-rate.
- **Editable only in Draft, Quoted, and the Under Review sub-states.** Booked, Booked – Endorsed, Referred, Pending Cancellation, Cancelled, Expired, and Lapsed are not editable in place.
- **Amendment is only available in Booked and Booked – Endorsed.** Every other status either has no cover in force yet (Draft, Quoted) or is terminal or locked.
- **Referred locks the shipment.** The participant cannot edit or book while any referral is open. All adjustments happen inside the referral itself.
- **Under Review locks the participant.** The sub-status is intentionally visible so the participant knows why they are locked. Multiple Back Office users can share the Under Review work; a stuck Under Review can be discarded to release the lock.
- **Cancellation cascades through endorsements.** Cancelling a Booked – Endorsed shipment cancels every endorsement in the chain. There is no per-endorsement reversal.
- **A shipment can hold more than one referral.** Each closes independently. The shipment leaves Referred only when the last open referral closes.
- **Terminal states cannot be un-set.** Cancelled, Expired, and Lapsed are permanent. Re-covering the movement requires a fresh shipment.
- **Every state change is audited.** The Activity tab of the shipment 360 view captures the actor, the timestamp, and any comment or reason. The Back Office sees every actor including internal staff; the participant sees a filtered view.

## Related concepts

- Shipment Portal
- Quote Creation (Creating and Booking a Shipment)
- Shipment Endorsing (Amendment)
- Cancellations
- Referral Management
- Dashboard Pages Reference
