# Cancellations

## What it is

Cancellations run at two levels in NacoraHub. **Shipment cancellation** removes coverage from a single booked shipment when the cargo movement is not going to happen — or has already happened differently and needs to be unwound. It always begins as a participant request stating whether the shipment has actually arrived at destination, followed by a broker approval or rejection; the Back Office also has a direct-cancel route used sparingly. **Policy cancellation** ends the whole contract that shipments sit under, normally scheduled for a future date rather than executed immediately, giving participants time to wind down activity. Both flows leave an audit trail, notify the affected parties, and trigger downstream billing adjustments processed by the sister broker system.

Cancelled shipments are never deleted. They remain on record in Cancelled status for audit and reporting. The same is true of cancelled policies — they persist as historical versions and do not remove the policy or its shipment history. Policy cancellation ends the policy's ability to accept new shipments; shipments booked before the effective date continue under their own lifecycle. It is a separate action from creating a policy or endorsing one — the broker starts it from the active policy's own detail page, not from the wizard.

## Who uses it & where

- **Participants** raise shipment cancellation requests from their shipment detail page in the Shipment Portal.
- **Brokers and Producers** approve, reject, or issue direct shipment cancellations from the Back Office, and initiate policy cancellations from the policy detail page.
- **Underwriters** occasionally review pending cancellation requests where the policy's set-up routes shipment reviews to them rather than to the broker.
- **Finance and Billing** on the sister broker system process any resulting refund or additional charge. Reconciliation happens outside NacoraHub.
- **Analytics** consumes cancellation events to keep shipment-count and premium-earned figures accurate.

## How it works

### Shipment cancellation

There are two routes to cancelling a shipment. The normal route is a **cancellation request** raised by the participant, which the Back Office then approves or rejects. The alternate route is a **direct cancel** issued by the Back Office without a participant approval step.

**Preconditions for either route.** The shipment must be in Booked or Booked – Endorsed status. Drafts and quotes do not need to be cancelled — the participant can either delete a draft or let a quote sit and expire. Referred, Declined, Cancelled, Expired, and Lapsed shipments cannot be re-cancelled through this flow. A clear reason has to be ready before opening the flow — the reason is logged and is visible to whoever reviews or audits the cancellation later. Cancellation does not trigger an automatic refund; premium reversals are handled out-of-band by the sister broker system's finance process.

**Participant — request cancellation.** From the Shipment Portal, the participant opens the shipment and presses **Cancel Request**. A dialog collects two pieces of information. The first is the **arrival flag** — the participant must state whether the shipment has actually arrived at destination. This is the single most important signal on the request. A shipment still in transit is a routine cancellation. A shipment that has already arrived is a red flag — it usually means either a claim scenario is coming or that something has gone wrong operationally, and the broker will treat the review very differently. The arrival flag is mandatory and cannot be left blank. The second field is the free-text **reason** for the cancellation. On submit, a pending-cancellation record is created against the shipment, the shipment moves to Pending Cancellation status, and cover remains in force while the Back Office decides. An email notification is sent to the broker; an activity is opened and assigned (defaulting to the broker responsible for the policy, or to the policy's underwriter if configured that way).

**Back Office — approve a cancellation request.** From the Back Office, the broker or underwriter opens a shipment in Pending Cancellation. They review the participant's reason, the arrival flag, and the underlying shipment record. Where the arrival flag is set to arrived the reviewer treats the request with additional scrutiny — an arrived shipment being cancelled is almost never a legitimate cancellation and usually needs to be routed toward a claim. When the reviewer decides to accept the request they press **Approve cancellation**. The shipment transitions to Cancelled — a terminal state. The requester (the participant who raised the request) is notified. All endorsements on the shipment are cancelled alongside the original booking; they are not reversible individually.

**Salog (SOAP) cancellation requests.** When a cancellation comes through the SOAP integration channel, it follows the same approval flow as a portal request. The Salog client cannot answer the arrival-status question, so the back office must review and approve the cancellation before it becomes final and billing reads it. The SOAP response reports a pending status until the back office decides. A service account can still opt into immediate cancellation if its SOAP user record is configured with direct cancellation enabled; the default for all Salog cancellations is the approval flow.

**Back Office — reject a cancellation request.** From the same page, the reviewer can press **Reject**. They provide a reason for the rejection, which is logged. The shipment returns to Booked (or Booked – Endorsed, if that is where it came from), the pending-cancellation record is discarded, and coverage continues under the original terms.

**Back Office — direct cancel.** Used sparingly, and only in scenarios where a participant-request round-trip is not appropriate. The Back Office user opens the shipment, presses **Cancel**, provides a mandatory reason, and confirms. The shipment transitions to Cancelled immediately without a participant approval step. This route bypasses the arrival-flag question, so any information about whether the shipment has arrived has to be captured in the reason field. The normal expectation is the participant-request flow — that way the cancellation reason on record is the participant's own words, not the broker's paraphrase.

**What happens after cancellation.** The shipment is Cancelled — terminal, no further action. The certificate stays on the Documents tab for the audit trail. All endorsements on the shipment are also cancelled. Cover is no longer in force from the moment of cancellation; any new cargo movement needs a fresh shipment. Finance handles any premium reversal out-of-band on the sister broker system — the platform emits the cancellation event and the reversal is computed there, not here.

**Cancellation and endorsements.** Cancelling a Booked – Endorsed shipment cancels every endorsement alongside the original booking. There is no per-endorsement reversal — endorsements are not unwound individually. If a specific endorsement was the mistake, the correct path is another endorsement that puts the shipment back to the desired state, not a cancellation.

### Policy cancellation

Policy cancellation is used when the policyholder no longer requires cover, the policy is being replaced by a new contract, the broker relationship is ending, or an error in policy setup needs to be corrected by closing and re-issuing (the cancellation route is the only way to change fields an endorsement cannot — Broker, Policyholder, Policy Type, or Policy Dates).

**Prerequisites.** The policy must be in Active status. Cancelled, Expired, or Incomplete policies cannot be cancelled through this flow. The Cancellation Effective Date has to be agreed with the customer; the policy stays Active and accepts new shipments until that date arrives. The Cancellation Reason has to be known; the platform lists the configured reasons in a dropdown. If any participant has shipments still in Quoted status at the effective date, those quotes cannot be booked afterwards — worth letting the participant know in advance.

**Steps.**

1. Open the active policy from the Policies search module.
2. On the policy's detail page, click the three-dot Actions button at the top right.
3. Select Cancel Policy. A confirmation dialog opens.
4. Set the Cancellation Effective Date — the date the policy stops accepting new shipments.
5. Set the Cancellation Reason from the configured list.
6. Confirm.

### The three phases after confirmation

**Phase 1 — Scheduled.** Between confirming the cancellation and the effective date arriving, the policy shows as Marked for Cancellation. It remains Active for all practical purposes:
- Participants can still submit shipment declarations against it.
- Quotes can still be booked.
- Endorsements can still be applied, subject to the locked-field rules for endorsement.
- The cancellation can be reviewed by reopening the policy's detail page; the scheduled date and reason are shown alongside the status.

**Phase 2 — Effective date arrives.** On the effective date, the policy automatically transitions from Marked for Cancellation to Cancelled:
- New shipments can no longer be created under the policy.
- New quotes cannot be issued.
- The policy moves out of the active Policies list and into the Cancelled history.

Under the hood, if the cancel date is today or in the past, an immediate cancellation runs — a new policy version is created with title Cancelled and state Published, the previous version is marked no longer current, and any drafts under the policy are obsoleted. If the cancel date is in the future, the policy is flagged for cancellation and a batch job processes future cancellations on the scheduled day.

**Phase 3 — After cancellation.** Existing shipments continue under their own lifecycle. A shipment that was Booked before the effective date stays in force for its declared trip. A shipment that was Quoted but not booked before the effective date cannot be booked afterwards.

Billing adjustment (pro-rata refund or additional charge) is handed off to the BMS side. The refund calculation itself is not internal to this platform.

### What cancellation does NOT do

- It does not retroactively cancel shipments that were already booked. Those continue under their declared cover.
- It does not delete the policy. The policy and its full audit trail remain in the Back-Office for reporting and compliance.
- It does not roll back endorsements applied while the policy was Active. The endorsement history stays on record.

### Decline vs Cancel

Decline and Cancel are different. Decline is used on quotes and shipments before they are booked — the quote or shipment is rejected outright, no cover is issued. Cancel is used on a policy or on a booked shipment — cover has been in force and is now being wound down. Once a policy is in the Cancelled state, the terminal state is permanent; there is no un-cancel action. Before the effective date arrives the cancellation may still be reviewable by the Administrator, but once the effective date passes the policy is closed permanently and the only way to resume cover is to issue a new policy.

## Business rules & calculations

- **Arrival flag is mandatory on shipment cancellation.** The participant must state whether the shipment has arrived at destination. Cancelling an arrived shipment is a red flag for the broker and is treated with additional scrutiny — it usually indicates a claim scenario, not a legitimate cancellation.
- **Cancellable shipment statuses.** Only Booked and Booked – Endorsed. Draft, Quoted, Referred, Declined, Cancelled, Expired, and Lapsed shipments cannot be routed through the cancellation flow.
- **Idempotency.** A shipment cannot be cancelled twice; a policy cannot be cancelled twice. The Cancel action disappears once the shipment reaches a terminal status.
- **Requester tracking.** The logged-in user at the point of request is recorded on the pending-cancellation record. Every step is timestamped.
- **Reason field.** Free-text on shipment cancellation and on shipment direct-cancel; dropdown-selected on policy cancellation. Mandatory in every case. Stored on the record for audit.
- **No automatic refund.** Cancellation does not move money inside NacoraHub. The platform emits the cancellation event; the sister broker system computes any pro-rata refund or additional charge.
- **Endorsements collapse on shipment cancellation.** Cancelling a Booked – Endorsed shipment cancels every endorsement chained onto the original booking. There is no per-endorsement reversal.
- **Terminal on Cancelled.** No further action is available on a Cancelled shipment. The certificate and every prior document stay on the Documents tab for audit.
- **KN policies auto-renew annually.** Cancelling one is a deliberate action — a KN policy never lapses through inaction. Third-party policies expire if not renewed.
- **Direct cancel bypasses the participant.** The direct-cancel route from the Back Office skips the request flow entirely. The audit record captures the broker as the actor rather than the participant, which is why it should be used only when a participant round-trip is not appropriate.
- **Immediate policy cancellation is possible but uncommon.** Setting the effective date to today (or as early as the system allows) cancels the policy with no advance notice. Used sparingly — participants who were about to submit a shipment under the policy will find themselves blocked.
- **Cancellation does not affect the policy's open MTA draft.** If there is an unpublished endorsement on the policy at the time of cancellation, the draft remains on the policy record but cannot be confirmed once the cancellation takes effect.
- **No un-cancel.** Once the effective date passes and the policy is fully Cancelled, the state is terminal. Resuming cover requires issuing a new policy.
- **Only Active policies can be cancelled.** Cancelled, Expired, and Incomplete policies cannot be cancelled from this flow.
- **Notifications on every step.** Emails go out on request submission (to the broker), on approval (to the participant/requester), on rejection (to the participant/requester), and on direct cancel (to the participant/requester).
- **Cancellation email routing uses team mailboxes.** When a cancellation request is raised, the notification is sent to the agent's sales unit using a three-step resolution order. First, the system checks whether the sales unit has a mailbox configured specifically for cancellation requests in Settings, and optionally copies the agent if the mailbox row says so. Second, if no cancellation-specific mailbox is set, the email goes to the sales unit's main address. Third, if neither is available, the email falls back to the agent directly. Invalid email addresses on a mailbox row are refused and logged, and the next step in the order takes over. Every email records where it was delivered and which resolution step was used.
- **Salog cancellations require back-office approval by default.** A SOAP cancellation request opens a Shipment Cancellation Request activity for the back office, the same as a portal request. Direct cancellation (bypassing approval) is available only when the SOAP service account is explicitly configured with direct cancellation enabled. Salog coverage codes are mapped through the platform's code map alongside conveyance and commodity codes.

## Related concepts

- Shipment Portal
- Shipment Statuses
- Shipment Endorsing (Amendment)
- Adjustments (MTA)
- Policy Lifecycle
- Referral Management
- Audit Trail
- Billing
- Renewals
