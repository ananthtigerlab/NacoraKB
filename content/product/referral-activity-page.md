# Referral Activity Page

## What it is

The Referral Activity Page is the single screen where an underwriter, broker, or participant sees everything about one referral in one place — what the shipment looks like, why the referral fired, what questions have been asked, what answers have been given, what clauses attach, what notes have been left, and the decision path (approve / decline / request more info / send back). It is the operational surface for the entire referral workflow. This page describes that screen; the broader referral concept lives on the Referral Management page.

The activity page is what someone lands on when they click a referral from the queue, from a shipment 360, or from a notification email. It is designed for one-shot triage — everything an underwriter needs to decide is on this screen without needing to leave it.

## Who uses it & where

- **Underwriters** — the primary users. They open the activity page from the Referrals dashboard, review, decide.
- **Brokers** — open it to monitor a referral they're waiting on, add clarifying notes, request the underwriter reassign, or (for their own referrals) reply to a request for information.
- **Participants** — see a scoped view of the same page from the Shipment Portal: the referral header, the outstanding questions, a reply box. They do not see internal notes or the full clause attachment editor.
- **Administrators** — read-only access for supervision, plus the ability to reassign a stuck referral to a different underwriter.

The page lives at a URL like `/referrals/<referral-number>` in the Backoffice; in the Shipment Portal it lives under the Shipment detail → Referral tab.

## How it works

### The page layout

The Referral Activity Page is structured as one long scrolling page with a fixed sticky header. Sections from top to bottom:

1. **Header.** Referral number, policy number, shipment number, current status (with the standard Awaiting Review / Under Investigation / Approved / Declined / Cancelled state chip), the assignee (individual underwriter or group), the reason that fired the referral, the SLA countdown if configured.
2. **Shipment snapshot.** Read-only summary of the shipment — assured, route, cargo description, insured value, coverage, packing, conveyance, dates. Enough for the underwriter to decide without opening the full Shipment 360.
3. **Rules triggered.** A list of every business rule that fired to raise this referral, with the rule name, category, and the condition that matched. Multiple referrals on the same shipment are shown as separate rows so the underwriter sees the full triggering picture.
4. **Questions & answers.** Every question the rule (or a manual note) has asked the participant, with the answer if received, the timestamp, and who answered. If the referral has questions that have not been answered yet, they appear in an "outstanding" area at the top of the section with a visual indicator.
5. **Clauses tab.** Both policy-level clauses inherited by this shipment and shipment-specific clauses attached by rules or by the underwriter directly (from I2G-29834). The underwriter can add, remove, or replace clauses from here without leaving the page.
6. **Premium & rating tab.** The full pricing breakdown for the shipment. If the underwriter is going to adjust the premium as part of resolving the referral, this is where they do it.
7. **Notes.** A threaded notes area for internal use (invisible to participants) plus a separate reply area for external correspondence with the participant. Every note is timestamped and attributed.
8. **Documents.** Anything the participant has uploaded in support of the referral (photos, letters of guarantee, custom-cargo declarations) plus anything the underwriter has attached (survey reports, correspondence with the insurer).
9. **Action bar.** The decision buttons — Approve, Decline, Request More Info, Send Back to Draft, Reassign. Which buttons are enabled depends on the referral's current state and the user's role.
10. **Timeline.** A collapsible audit trail specific to this referral — every state change, every question, every answer, every note, every clause edit, every premium adjustment. Read-only.

### The referral decision journey

An underwriter's typical journey on the page:

1. **Open** — from the Referrals dashboard or from the shipment 360.
2. **Read the shipment snapshot** to understand what's being insured.
3. **Read Rules triggered** to understand why the referral fired.
4. **Read Questions & answers** — decide whether the answers already given are sufficient or whether more information is needed.
5. **Either:**
   - **Approve** — click Approve. Optional comment. The shipment moves to Booked; the participant is notified.
   - **Decline** — click Decline. Mandatory decline reason. The shipment moves to Declined; the participant is notified with the reason.
   - **Request More Info** — click Request More Info. Compose a message to the participant with specific questions or evidence requests. The participant is notified; the referral stays open until they respond.
   - **Reassign** — click Reassign. Pick another underwriter or group. The referral moves to the new assignee's queue; the original assignee sees it fall off theirs.
   - **Adjust clauses** — modify the attached clause set from the Clauses tab; save. The referral stays open; the shipment carries the adjusted clauses forward on approval.
   - **Adjust premium** — modify the pricing breakdown from the Premium & rating tab; save. Same — carries forward on approval.
6. **Add internal notes** as needed throughout — for supervisor visibility, for future reference, for cross-underwriter coordination.

### The participant view

Participants see a simplified version of the same page from the Shipment Portal:

- Header, shipment snapshot, and rules triggered are shown.
- Questions & answers section is fully visible — outstanding questions are prominent with a reply box.
- Clauses tab is read-only.
- Premium & rating tab shows the current pricing; not editable.
- Notes area shows only external correspondence — participants never see internal notes.
- Documents section allows uploading in support of the referral.
- Action bar shows only Reply (to answer outstanding questions).

## Options & choices

### Action bar buttons (Backoffice, by role and state)

| Button | Underwriter | Broker | Admin | State required |
|---|---|---|---|---|
| Approve | ✓ | via broker-owned deployments | ✓ | Awaiting Review / Under Investigation |
| Decline | ✓ | — | ✓ | Awaiting Review / Under Investigation |
| Request More Info | ✓ | ✓ | ✓ | Awaiting Review / Under Investigation |
| Send Back to Draft | ✓ (rare) | — | ✓ | Awaiting Review |
| Reassign | ✓ | — | ✓ | Any non-terminal |
| Adjust Clauses | ✓ | — | ✓ | Any non-terminal |
| Adjust Premium | ✓ | — | ✓ | Any non-terminal |
| Add Internal Note | ✓ | ✓ | ✓ | Any |
| Add External Reply | ✓ | ✓ | ✓ | Any non-terminal |

### Notes visibility

| Note type | Underwriter | Broker | Participant | Admin |
|---|---|---|---|---|
| Internal | ✓ | ✓ | — | ✓ |
| External (reply to participant) | ✓ | ✓ | ✓ | ✓ |

## Business rules & calculations

- **Every action on the page is audited.** Every state change, every note, every clause edit, every premium adjustment goes to the audit trail with actor, timestamp, and diff.
- **Outstanding questions block booking.** A referral with unanswered questions cannot be approved. The underwriter must either wait for the participant's reply or explicitly close the questions as no-longer-needed.
- **Multiple referrals per shipment must all resolve.** A shipment with two referrals must have both approved before it books. Declining any one moves the shipment to Declined.
- **Reassignment does not reset state.** Reassigning from underwriter A to underwriter B carries all questions, answers, notes, clause edits, and premium adjustments forward. The new assignee sees the full history.
- **Send Back to Draft is destructive.** It moves the referral back to Awaiting Review and re-triggers the rule evaluation on the underlying shipment. Used rarely, for cases where the underwriter believes the underlying shipment declaration is wrong and the participant needs to re-declare.

## States & transitions

The referral itself moves through a state machine tracked on this page:

| State | Meaning | Transitions from |
|---|---|---|
| Awaiting Review | New referral, not yet acted on by the underwriter | (created by rule engine or manual flag) |
| Under Investigation | Underwriter has picked it up but not yet decided | Awaiting Review |
| Approved | Underwriter approved; shipment moves to Booked | Awaiting Review, Under Investigation |
| Declined | Underwriter declined; shipment moves to Declined | Awaiting Review, Under Investigation |
| Cancelled | Referral closed because underlying shipment was cancelled | Any non-terminal |
| Awaiting Participant | Request More Info sent; waiting for participant reply | Any non-terminal |

Awaiting Participant returns to Under Investigation when the participant replies.

## Related concepts

- Referral Management
- Business Rules
- Sanctions & Compliance
- Special Rate
- Cancellations
- Clauses
