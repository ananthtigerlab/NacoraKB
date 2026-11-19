# Referral Management

## What it is

A referral is an underwriting review triggered when a shipment contains information that falls outside standard underwriting rules and requires back-office intervention before coverage can proceed. It is the mechanism by which the platform hands a shipment from automation back to a human when the automation cannot resolve it on its own. Until the referral is resolved the shipment is held — it cannot be booked and it cannot be edited by the participant.

Referrals exist so Nacora can handle exceptional or higher-risk scenarios that need a human decision rather than automatic approval. Common triggers include insured values exceeding approved thresholds, sanctions or compliance matches, restricted countries or trade routes, unusual cargo or conveyance combinations, missing or inconsistent shipment information, or any business rule specifically configured to require manual underwriting assessment.

**Replaces what used to be an email loop.** Before NacoraHub, referrals ran on email. The broker would ask the participant a question, forward it to the underwriter, the underwriter would respond, the broker would relay back. Nothing was durable, nothing was visible to the participant, and the audit trail was whatever survived in someone's inbox. In NacoraHub the whole conversation lives inside the platform. The participant sees the questions on their own portal, answers directly on their own shipment, and every question and every answer is timestamped and permanent. This is an internal Nacora innovation and one of the reasons the platform was commissioned.

## Who uses it & where

- **Participants** see referrals on their shipments in the Shipment Portal. When a shipment is in Referred status and the referral is in Awaiting Information sub-state, the ball is with them — they answer the underwriter's questions inline on the referral and upload supporting documents. Once they respond, the referral goes back to the underwriter.
- **Underwriters** own referrals in the Back Office. Every incoming referral lands in the Pending queue. From there the underwriter reviews the linked shipment, asks for more information if needed, adjusts premium or clauses inside the referral, and eventually approves or declines. Underwriters also handle the same review queue for Special Rate Requests.
- **Brokers (producers)** monitor the referral queue in the Back Office. They can leave internal comments not visible to the participant, assign the referral to a specific underwriter, and approve or decline directly when their authority covers the decision.

## How it works

### Creation

A referral is created automatically whenever a shipment triggers a matching business rule or an internal system check. Typical triggers include: the insured value exceeds the Maximum Insurable Limit; the cargo description contains a flagged keyword; a sanctions match is found on the named assured; the route touches a restricted country; the conveyance/commodity combination is unusual; the shipment has an **inland transit leg outside the policyholder's country** (a system-default rule that automatically triggers a referral in that case, from I2G-29870 and I2G-29565); or a rule explicitly configured on the policy fires with a Referral action. Underwriters can also raise a referral manually against a shipment when they see something the rule engine has not caught.

At the moment of creation, the shipment moves to Referred status. Both the participant and the broker receive an email notification immediately. The shipment is now on hold — it cannot be booked and it cannot be edited from the Shipment Portal until every referral on it is closed.

**Non-IACS vessel referral timing.** Sea shipments are referred for a non-IACS classification society only once the shipment names a vessel by IMO number. A quote saved before the vessel is known is not referred for non-IACS — the check runs only when the vessel carries an IMO. A vessel with an IMO and no classification society, or one whose society is outside the IACS list, is still referred. The separate "Cannot Locate Vessel" rule is controlled per policy in Business Rules, not in code.

### The Referrals Dashboard

Both interfaces have a Referrals dashboard, but they surface different views of the same underlying record.

**In the Back Office.** The referrals dashboard is the underwriter's daily inbox. It has four status tabs — **Pending** (new referrals awaiting review), **Awaiting Review** (formerly labelled "Under Review", renamed to "Awaiting Review" as part of I2G-30169), **Approved** (resolved with approval), **Declined** (resolved with rejection). The columns are Back Office-flavoured — assignee, due date, originating shipment, status. Filters cover policy, participant company, commodity, date range, and assignee. An **Assigned to: me** filter narrows the queue to the signed-in underwriter's own workload; **Assigned to my group** covers the group's shared workload. The recommended workflow is to filter to your own queue, sort oldest-first, and work down the list.

**In the Shipment Portal.** The participant sees a single list of the referrals raised on their own shipments. The status badge on each row makes it clear whether action is needed — an Awaiting Information row is where the ball is with them. Approved and Declined rows are informational; the resolution comment on the referral explains the outcome. Visibility is role-scoped: participants see only referrals on their own shipments, not the whole Back Office pipeline.

### The Referral Activity Page

Clicking any referral row opens the full referral record. The header carries the referral reference, the current status, the assigned broker or underwriter, the responsible party, and the **referral reason** — which Business Rule fired to raise the referral, or, for manually-raised referrals, the free-text reason the underwriter typed. The same reason is surfaced on the Shipment 360 view so anyone looking at the shipment can see immediately why it went to review (from I2G-29895). Beneath the header sit the sections that make up the referral.

- **Risk Details** — a full mirror of the shipment risk: commodity, conveyance, route, insured value, named assured, vessel. The referral holds its own copy so that adjustments inside the referral can be applied to the shipment on approval without polluting the live shipment while review is under way.
- **Premium** — the current premium breakdown. Viewable, and editable from inside the referral.
- **Clauses** — the clauses attached to this referral. Manageable independently of the shipment's existing policy clauses.
- **Additional Information** — the durable question-and-answer thread between the underwriter and the participant. Every question the underwriter has posted and every answer the participant has submitted lives here, timestamped.
- **Activity** — the full timestamped log of every action, comment, and communication. Includes internal Back Office comments (not visible to participants). The Activity view is a filterable audit trail: users can narrow by field, action type, or date range, and export the filtered slice to CSV (from I2G-29766).
- **Documents** — files uploaded by either side to support the review.

### The underwriter's actions

From the Referral Activity Page in the Back Office, the underwriter has a set of actions that shape how the referral progresses.

**Assign to an underwriter.** If the referral needs a specialist or someone with higher authority, the assignee is changed. The Back Office user presses **Assign to Underwriter**, picks the target from the panel of available underwriters, optionally adds a comment, and confirms. The newly-assigned underwriter receives an email with a direct link to the referral. When the assignee has no email address (for example, an underwriting group mailbox that was never configured), the system sends the notification to the referral's responsible office instead, so the referral is never silently lost. Reassigning an open referral (in Awaiting Review status) now emails the new assignee; a business rule that creates and immediately reassigns a referral still sends a single email rather than two. Reassigning is unlimited; every assignment change is captured in the activity log.

Referrals can also be assigned to a **user group** in addition to a named underwriter (from I2G-29988). Group assignment is the pattern used when a specialist team, rather than one individual, owns a category of referrals — the referral appears in the shared queue for every member of the group and any of them can pick it up. On the KN Poland and Eastern Europe books, referrals route by country and region rather than to a shared mailbox: for example, referrals from certain countries go directly to Marcel Behnke (from I2G-30081). This is configured on the underlying business rule and can be overridden manually on any specific referral.

**Request information from the participant.** When the underwriter needs more detail before they can decide, they press **Request Information**. The dialog lets them tick pre-canned questions or write free-form ones, and add internal-only comments not visible to the participant. On submit, the referral moves to Awaiting Information. The participant receives an email with a subject line along the lines of "Action Required — Shipment [number]" and a direct link back into their portal. When the participant answers, the referral returns to Pending on the Back Office side, the underwriter is notified, and the exchange is logged. Requests for information can be issued repeatedly — each exchange is stacked in the activity trail with timestamps.

The pre-canned questions come from **Question Templates**, a library of reusable question sets managed from the Choices page. An underwriter picks a template from the dropdown in the Request Information dialog to drop a curated set of questions into the referral without retyping them each time (from I2G-30189). Templates are maintained centrally so the phrasing stays consistent across underwriters.

**Edit risk details or premium.** Before deciding, the underwriter may need to adjust the risk itself or the price. From the Risk Details section they can press Edit, update insured value, coverage, conveyance, or other fields, and save. From the Premium tab they can press Edit and adjust the premium components. Any adjustments made inside the referral are applied to the shipment on approval — they do not touch the shipment while the referral is still open.

**Manage clauses.** Inside the referral, clauses can be added from the policy clause library, edited, duplicated, or removed independently of the shipment's clauses. When adding a clause the underwriter indicates whether it should appear as a Special Condition on the certificate — Special Conditions display in a separate section below the standard Insuring Conditions. On approval, every clause attached to the referral is copied to the shipment.

**Add comments.** From the Activity section the underwriter can post a comment at any point. Comments are visible to all Back Office users with access to the referral and are hidden from the participant. Comments can be addressed to a specific user, in which case that user receives an email notification along the lines of "New Comment on Referral Activity — [referral number]". Assigned comments are the mechanism for internal escalation, flagging for a colleague, or holding a decision pending someone else's response. Internal comments remain internal forever — even after the referral closes, the participant never sees them. Use them freely for handover and audit.

**Approve the referral.** Once the underwriter has enough information to proceed, they press **Approve** and confirm in the dialog. On approval every risk adjustment made inside the referral is written back to the shipment, every clause attached to the referral is copied to the shipment, the system re-rates the shipment automatically with the updated details, and the participant receives an email along the lines of "Shipment Quotation Available — [number]". The shipment leaves Referred, re-enters Quoted, and is now bookable.

**Decline the referral.** When coverage cannot be offered, the underwriter presses **Decline**, provides a mandatory reason for the record, and confirms. The participant receives an email along the lines of "Shipment Quotation Unable to Proceed — [number]". The shipment returns to Quoted but cannot be booked under the declined terms — the participant will normally edit and re-submit with different values.

Decline reasons and approve comments both live permanently on the record and are visible on the shipment 360 page under Referral and Decline Reasons. They should be phrased clearly — the audit trail surfaces them out of context.

### The participant's response

When the referral is in Awaiting Information, the participant sees it in their Referrals Dashboard with a clear status flag. Opening the referral shows the questions the underwriter has raised on the Additional Information tab.

The participant reads the questions, gathers any supporting documents that would help resolve them (packing lists, commercial invoices, prior certificates typically resolve a referral faster than text answers alone), then presses **Submit Information**. Each open question is answered inline. Documents are uploaded to the Documents tab. Once complete, they press **Submit**. The referral moves back to Pending on the Back Office side and the underwriter is notified.

The participant sees only what is relevant to them — the risk details, the questions they were asked, the shared documents. Internal Back Office comments, internal activity-log entries, and the Approve and Decline buttons are hidden from the portal. The shipment itself is locked while in Referred — the participant cannot edit the shipment fields directly. If something on the shipment is wrong they mention it in their response and the underwriter handles it inside the referral.

If the referral is not currently in Awaiting Information — for example it is in Pending or terminal — the Submit Information button is hidden. There is nothing for the participant to do; the ball is with the underwriter.

### The referral lifecycle — end-to-end choreography

Reading the flow as a story: the participant submits a shipment. The system runs rating and business rules, decides the shipment cannot be resolved automatically, creates a referral in Pending status, and moves the shipment to Referred. The underwriter opens the referral. If they need more information they press Request Information, the referral moves to Awaiting Information, the participant is notified, the participant answers, and the referral returns to Pending. When the underwriter has enough to decide they either approve (shipment returns to Quoted and the participant can book) or decline (shipment returns to Quoted but is held under those terms and the participant will normally edit and re-submit).

The status transitions on the referral itself are:

- **Pending → Awaiting Information** — underwriter requests information from the participant.
- **Awaiting Information → Pending** — participant submits their response, ball returns to the underwriter.
- **Pending → Approved** — underwriter approves. Terminal for the referral; shipment returns to Quoted and is bookable.
- **Pending → Declined** — underwriter declines with a mandatory reason. Terminal; shipment returns to Quoted but is not bookable under those terms.

### What this means for the linked shipment

While any referral on a shipment is open, the shipment sits in Referred. It cannot be edited by the participant and cannot be booked. When the last open referral resolves, the shipment returns to Quoted. From there the next move is Book (if all referrals approved) or Edit (if any declined). Approval and decline both close the referral; the shipment is left in a state the participant can act on.

### Multiple referrals per shipment

A shipment can have more than one referral raised against it. Common examples are an underwriting referral fired by insured value plus a separate compliance referral fired by a sanctions match. The dashboard surfaces them as separate rows. The shipment stays in Referred until every referral on it is closed — each referral is handled independently, and each has its own status track. When the last one clears, the shipment exits Referred.

## Business rules & calculations

- **Referral blocks booking.** A Referred shipment cannot be booked. Every referral has to resolve first.
- **Shipment is locked in Referred.** The participant cannot edit the shipment while it is Referred. All adjustments happen inside the referral.
- **Auto-assignment.** Referrals default to the policy's agent. Business rules can override with a specific underwriter or group. Reassignment is unlimited and audited.
- **Multiple referrals stack.** A shipment can hold more than one open referral; each closes independently. The shipment leaves Referred when the last one closes.
- **Q&A answers are permanent.** Every question and every answer is timestamped and captured in the activity log. Answers cannot be silently rewritten. This is the audit backbone of the workflow.
- **Internal comments stay internal forever.** Participants never see them, before or after the referral closes.
- **Adjustments inside a referral do not touch the shipment.** Risk edits, premium overrides, and clause changes made inside the referral only apply to the shipment on approval. They do not leak into the live shipment while the review is under way.
- **Approved referrals survive non-material edits.** When a shipment with an approved referral is amended (for example, correcting a typo in the description or updating a non-risk field), the existing approval and its attached clauses are carried forward. The shipment is not re-referred for the same reason. Only a material change to the risk (changing commodity, route, insured value, or other rule-triggering fields) can raise a fresh referral.
- **Special Conditions surface separately.** Any clause added inside a referral can be marked as a Special Condition; it then appears in a distinct section on the certificate below the standard Insuring Conditions.
- **Approve triggers a re-rate.** On approval the system re-rates the shipment using the updated risk details, premium overrides, and clauses from the referral.
- **Decline is not the end of the movement.** A declined referral means the shipment cannot proceed under those exact terms. The participant can edit the shipment (change value, route, conveyance) and re-submit — the rating engine may produce a quote that does not trigger a referral this time. If the issue is purely pricing, a Special Rate Request may be the right path.
- **No auto-escalation.** Referrals do not time out. A slow referral sits in the queue until acted on. The escalation mechanism is assignment and assigned comments, not a timer.
- **Underwriter also handles Special Rate Requests.** The same Back Office reviewers work referrals and Special Rate Request approvals from the same interfaces.
- **Notifications on every hand-off.** Every state change that shifts ownership between participant, broker, and underwriter fires an email with a direct link back into the platform. Every hand-off is also logged in the activity trail.
- **Decision comments live forever.** Approve and decline comments are permanent, visible on the shipment 360 page, and will be read by future underwriters and auditors out of context. Phrase them accordingly.

### Known caveats under active fix

Two edge-case behaviours are known and being resolved through open work items:

- **Referral state on re-quote.** When a referred shipment is re-quoted, the referral state, referral reasons, and referral history should persist against the shipment, and a new referral activity should be created for the re-quote. The current build has known gaps in that persistence; the fix is under test as I2G-30038.
- **Referral Override logic.** The Referral Override action (used to force an approval or decline outside the normal flow) has edge-case bugs in specific combinations of shipment state and referral state. Being fixed via I2G-29728.

## Related concepts

- Shipment Portal
- Quote Creation (Creating and Booking a Shipment)
- Shipment Statuses
- Business Rules
- Special Rate
- Cancellations
- Dashboard Pages Reference
- Sanctions and Compliance
