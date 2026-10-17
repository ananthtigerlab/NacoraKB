# Mail Notifications & Templates

## What it is

NacoraHub sends structured, branded emails at every significant moment in its workflows — a shipment is booked, a referral is approved or declined, a policy is activated, a renewal reminder is due, a bulk-upload batch has finished processing, a Special Rate Request needs the underwriter's attention. Each notification is rendered from a versioned template stored in the platform, populated with live data (policy number, premium amount, broker name, action link) and dispatched through the mail service. Templates support the platform's supported languages so recipients receive the message in their own language.

The mail notifications layer is a shared platform capability tuned to Nacora's workflows. Every trigger point matters — a missed booking confirmation email creates a support ticket the next morning; a missed referral email leaves the participant guessing whether the underwriter is actually looking; a missed renewal reminder can lose the customer. The system is designed to be robust rather than fast: retries, bounce-handling, deduplication, and a queue that survives a mail-service outage without losing messages.

## Who uses it & where

- **All roles** — receive notifications for events they are involved in. Which events they see depends on their role and on their opt-in status per event category.
- **Administrators** — monitor the mail queue in the Backoffice mail admin, resend failed messages, review bounces and unsubscribes, and maintain the template library.
- **Content administrators** — author, edit, translate, and version email templates. This role is often held by the same person as the general Administrator.
- **Brokers** — receive renewal reminders, referral notifications on their assigned policies, and status updates on Special Rate Requests they submitted.
- **Underwriters** — receive assignment notifications on new referrals and Special Rate Requests, plus comment notifications on discussions they are tagged in.
- **Participants** — receive quote confirmations, booking confirmations, referral responses, cancellation approvals, and any other notification on their own shipments.

The notification surface itself is invisible to end users — recipients just see the emails in their inbox. The management surface (queue, templates, retry, resend) is a Backoffice-only area under the admin menu.

## How it works

### The trigger points

Every notification originates from a specific workflow moment. When that moment happens, the platform builds the notification and enqueues it. The catalogue below covers every trigger point known to the KB.

**Policy lifecycle**
- Policy activated — sent to broker and participants of the policy.
- Policy endorsed (MTA published) — sent to broker and participants.
- Policy cancellation scheduled — sent to broker, participants, and the underwriter.
- Policy cancelled (effective) — sent to broker, participants, and the underwriter.
- Policy expired — sent to broker.
- Policy renewal reminder — 60 / 30 / 14 / 7 days before end date. Recipients per Renewals page.

**Shipment lifecycle**
- Shipment quoted — sent to submitter (participant or broker on behalf).
- Shipment booked — sent to submitter and to the broker.
- Shipment endorsed — sent to submitter and to the broker.
- Shipment cancellation requested — sent to broker.
- Shipment cancellation approved — sent to submitter.
- Shipment cancellation rejected — sent to submitter with the rejection reason.
- Shipment quote expiring — sent to submitter 3 days before the 30-day quote validity ends.
- Shipment lapsed / expired — sent to broker (participant is not notified for lapsed since the policy notification already fires).

**Referral lifecycle**
- Referral raised — sent to the assigned underwriter (or group) and copied to the broker.
- Referral request for information — sent to the participant with a direct link to the shipment.
- Participant responded to referral — sent to the assigned underwriter.
- Referral approved — sent to the participant.
- Referral declined — sent to the participant with the decline reason.
- Referral comment addressed to a user — sent to the tagged user only.
- Referral reassigned — sent to the new assignee.

**Special Rate Request lifecycle**
- SRR submitted for approval — sent to the assigned underwriter.
- SRR sent back to draft — sent to the requester.
- SRR approved (Confirm Rates) — sent to the requester and any participants scoped in.
- SRR declined — sent to the requester with the decline reason.
- SRR combination declined (partial) — sent to the requester with the per-combination reason.

**Bulk operations**
- Bulk upload started — receipt-style acknowledgement sent to the uploader.
- Bulk upload completed — summary sent to the uploader (rows processed, rows succeeded, rows failed).
- Bulk upload failed — sent to the uploader and the platform administrator with the failure diagnostics.

**Bordereau**
- Bordereau ready — monthly, sent to the broker and finance recipients when the bordereau is generated.

**User lifecycle**
- Welcome email (direct-credential Backoffice user) — sent when an administrator creates the account. Contains a one-time password-setup link.
- OTP email (Shipment Portal sign-in) — six-digit code, valid 5 minutes, max 5 attempts.
- Password reset email (direct-credential user) — one-time link to reset the password.
- Password lockout notification — sent after three failed sign-in attempts.
- Pending approval — sent to administrators when a new user needs cost-centre placement.

**Compliance and platform**
- Sanctions match found — sent to the assigned underwriter for review, with the shipment reference and the matched entity.
- General Average event notification — sent to Nacora ops and the relevant broker when a linked shipment is caught up in a General Average declaration.
- Ad-hoc admin notification — free-form message an administrator can broadcast to a scoped recipient list.

### The dispatch flow

1. A workflow reaches a moment that warrants notification.
2. The notification service builds the recipient list. Filtering is aware of the broker company hierarchy — a broker-company address can expand to include all descendant broker users. Participant OTP contact emails can be included too. Deduplication removes any address that would otherwise appear twice.
3. The correct template is loaded. Template selection considers the trigger, the recipient's role, and the recipient's language preference. If the recipient's language is not available, the template falls back to the deployment's default language.
4. Variables are interpolated into the template: policy number, shipment number, premium, broker name, action button URL, and any event-specific data (referral question text, cancellation reason).
5. The rendered email is written to the outbound queue with status Pending.
6. A background worker processes the queue every few minutes, dispatching each message through the mail provider (Amazon SES on production).
7. Delivery status is recorded — Sent, Bounced (hard), Bounced (soft), Complaint (unsubscribe), or Failed.
8. On failure, the record is marked for retry (up to three attempts with exponential backoff). Persistent failures move to a Failed pile visible to administrators for manual resend or investigation.

### The mail queue in the Backoffice

Administrators can open the mail queue from the Backoffice admin menu. The queue is a filterable list of every outbound message with status, timestamp, recipient, template, related record, and dispatch history.

Available actions:

- **Resend** — re-queues a Failed or Bounced message. The template and variables are re-rendered from scratch (so a template fix applies to the resent message).
- **Cancel** — removes a Pending message from the queue before dispatch. Rare use — typically only when a workflow was triggered in error.
- **View rendered content** — opens the rendered HTML the recipient would see, useful when a recipient reports the email did not arrive or was mis-rendered.
- **View history** — every dispatch attempt with timestamp, response code, and any error text.
- **Filter** — by status, recipient, template, related record, date range. The filter state persists per admin user (see User Preferences & Listing Configuration).
- **Export** — the filtered slice as CSV or XLSX for audit or handover.

### The Emails tab on the shipment 360 view

Every shipment carries an Emails tab showing every email sent to or from the platform in connection with the shipment. This is the surface the broker or the participant uses to confirm that the counterparty has actually been notified. Each row shows:

- Timestamp of dispatch.
- Recipient address.
- Template name (e.g. "Shipment Booked", "Referral Request for Information").
- Subject line.
- Delivery status (Sent, Bounced, Failed).
- A View action to see the rendered content.

The Emails tab is filtered to what the current viewer is authorised to see. Participants see only emails sent to their own address; Back Office users see the full history.

### Template management

Templates live in the Backoffice under Admin → Email Templates. Each template has:

- A name (used for internal reference, e.g. "Shipment Booked Confirmation").
- A subject line (with variable placeholders like `{{shipment.number}}`).
- A body (HTML + plaintext, with the same placeholder syntax).
- Translation files for every supported language.
- A branding section (from address, reply-to, logo, footer HTML).
- A versioning history — every edit creates a new version, with old versions retained for audit.

Admins edit templates in the Backoffice with a live preview alongside. A newly-saved template becomes the active version immediately for new dispatches; already-queued messages continue to render against the version they were queued with. This is the same versioning pattern as documents (see Documents).

### Recipient rules

**Deduplication.** The same email address receives at most one copy of an event's notification, even if it appears via multiple paths (broker descendant + direct assignment, participant plus company OTP contact).

**Opt-out.** A user can opt out of specific notification categories from their profile page. Opt-out is respected on every future dispatch until re-opted-in.

**Suppression list.** Addresses with a history of hard bounces or complaints are automatically suppressed. An administrator can manually remove an address from the suppression list once the underlying issue is fixed.

**Escalation.** Certain events (renewal reminders at 14 and 7 days, sanctions matches) escalate to additional recipients (broker manager, underwriting team) after the primary recipient. This is a per-event configuration.

### Language handling

Every template has translations for the deployment's supported languages. When rendering a notification for a specific recipient, the platform reads the recipient's language preference and picks the matching translation. If the translation is missing, the platform falls back to the deployment default (typically English) and logs the miss for the content admin to fill in.

Supported languages match the certificate languages: English, French, German, Spanish, Japanese, Chinese, Turkish, Portuguese.

### Action buttons and deep links

Every actionable email carries a call-to-action button — Review Shipment, Approve Referral, Renew Policy, Set Password. Each button is a deep link that lands the recipient (after sign-in if required) directly on the relevant page in the platform. The links are single-use tokens where the action itself is sensitive (password reset, one-time OTP) and permanent otherwise (link to a shipment or a referral).

## Options & choices

### Every trigger point, at a glance

| Trigger category | Trigger event | Primary recipient | Escalation recipients |
|---|---|---|---|
| Policy | Activated | Broker, Participants | — |
| Policy | Endorsed | Broker, Participants | — |
| Policy | Cancellation scheduled | Broker, Participants, Underwriter | — |
| Policy | Cancelled (effective) | Broker, Participants, Underwriter | — |
| Policy | Expired | Broker | — |
| Policy | Renewal reminder | Broker (60/30/14/7 days) | Manager + Underwriter (14/7 days) |
| Shipment | Quoted | Submitter | — |
| Shipment | Booked | Submitter, Broker | — |
| Shipment | Endorsed | Submitter, Broker | — |
| Shipment | Cancellation requested | Broker | — |
| Shipment | Cancellation approved | Submitter | — |
| Shipment | Cancellation rejected | Submitter | — |
| Shipment | Quote expiring (3 days out) | Submitter | — |
| Shipment | Lapsed / Expired | Broker | — |
| Referral | Raised | Assigned Underwriter or Group | Broker (cc) |
| Referral | Request for information | Participant | — |
| Referral | Response submitted | Underwriter | — |
| Referral | Approved | Participant | — |
| Referral | Declined | Participant | — |
| Referral | Comment addressed to user | Tagged user | — |
| Referral | Reassigned | New assignee | — |
| SRR | Submitted | Assigned Underwriter | — |
| SRR | Sent back to draft | Requester | — |
| SRR | Approved | Requester, Scoped Participants | — |
| SRR | Declined | Requester | — |
| SRR | Combination declined | Requester | — |
| Bulk | Started | Uploader | — |
| Bulk | Completed | Uploader | — |
| Bulk | Failed | Uploader | Administrator |
| Bordereau | Ready | Broker, Finance | — |
| User | Welcome (direct-credential) | New user | — |
| User | OTP sign-in | User | — |
| User | Password reset | User | — |
| User | Lockout | User | Administrator |
| User | Pending approval created | Administrator | — |
| Compliance | Sanctions match | Assigned Underwriter | — |
| Compliance | General Average event | Nacora Ops, Broker | — |

### Delivery statuses

| Status | Meaning |
|---|---|
| Pending | Enqueued, not yet dispatched. |
| Sent | Handed off to the mail provider successfully. |
| Bounced (hard) | Address does not exist or is permanently rejecting. Adds to suppression list. |
| Bounced (soft) | Temporary failure (mailbox full, over quota). Retried up to three times. |
| Complaint | Recipient marked as spam or unsubscribed. Adds to suppression list. |
| Failed | Provider returned a fatal error other than a bounce. Visible for admin resend. |
| Cancelled | Pulled from the queue before dispatch. |

### Retry policy

- **Retries:** three attempts on SMTP or provider failure.
- **Backoff:** exponential — a few seconds, then a minute, then an hour.
- **After the third failure:** the record moves to Failed and appears in the Failed pile for admin action. No further automatic retry.

## Business rules & calculations

- **From address:** `no-reply@nacorahub.com` by default. Deployment can override per environment.
- **Recipient deduplication:** the same email address only receives one copy per event, even if it arrives from multiple paths.
- **Suppression respected on send:** hard-bounced or complained addresses are skipped automatically; the send attempt is recorded as Suppressed rather than Failed.
- **Retry cap:** three attempts on any non-terminal failure.
- **Action buttons carry deep links** back into the platform — clicking Review Shipment lands the recipient (after sign-in) on the shipment 360 page.
- **Language preference:** recipient language selects the translated body; missing translations fall back to the deployment default with a logged warning.
- **Template versioning:** editing a template creates a new version. Queued messages render against the version at the time of send, so a hotfix to a template applies to messages sent after the fix without needing to re-render already-queued messages.
- **Opt-out respected on future sends only.** A user opting out does not delete pending messages; it only prevents future dispatch to that address for that category.
- **Escalation is per event.** Not all events escalate. Renewals and sanctions matches do; routine booking confirmations do not.
- **Multiple templates per event across languages** — the "Shipment Booked" event has one template with translations, not eight distinct templates.
- **Suppression can be manually cleared.** Once the underlying issue is fixed (e.g. mailbox restored) the administrator lifts the suppression from the mail admin page.
- **Sensitive actions carry single-use tokens.** Password reset and OTP links are one-use; every other link is permanent.

## States & transitions

Each notification record moves through the following states:

- **Pending** → **Sent** on successful dispatch.
- **Pending** → **Bounced (soft)** → retry → **Sent** (or continues to next state on repeated soft bounce).
- **Pending** → **Bounced (hard)** → address added to suppression list. Terminal.
- **Pending** → **Complaint** → address added to suppression list. Terminal.
- **Pending** → **Failed** → after 3 retries. Visible for admin resend, which restarts the state machine.
- **Pending** → **Cancelled** by admin action. Terminal.

The Emails tab and the mail queue show every record in whichever state it currently sits.

## Related concepts

- Referral Management
- Cancellations
- Renewals
- Bulk Upload
- Admin Queue & Approvals
- Documents
- Login
- User Preferences & Listing Configuration
- Audit Trail Module
