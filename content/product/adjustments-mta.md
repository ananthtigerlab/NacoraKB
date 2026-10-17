# Adjustments (MTA / Endorsements)

## What it is

An adjustment on an active policy is called an Endorsement in the user-facing language of the platform, and a Mid-Term Adjustment (MTA) in the internal terminology. They are the same thing: a controlled change to a policy that is already active, made before it expires, without losing the previous version.

Endorsement is how commercial terms and coverage scope change mid-term. Adding a new participant company, switching billing currency, expanding commodity groups, revising clauses, adjusting maximum insurable limits, publishing updated values for business rules, replacing a Quote Document or Certificate template — all of these are endorsement actions. Every endorsement creates a new policy version with its own effective date; the previous version is preserved for audit and continues to govern shipments that were already submitted under it. Shipments are always governed by whichever version was active when they were submitted, so there is no retroactive change.

The action is initiated from the active policy's own detail page, not from the wizard's Create button. Once triggered, the wizard reopens the existing policy under a controlled amendment process — most steps are the same as during creation, but with additional constraints and a new mandatory step at the top of the sidebar.

## Who uses it & where

- **Brokers and Producers** — kick off endorsements from the policy's detail page in the Back-Office through the three-dot Actions menu.
- **Underwriters** — review the endorsement in the same approval flow used for New Business.
- **Billing (BMS side, not this platform)** — picks up the delta and processes an additional-premium invoice or a refund. The refund calculation itself is not internal to this platform.
- **Analytics** — treats each endorsement as a distinct line so reporting keeps original and amended premium separate.
- **Participants** — never trigger endorsements. They continue to submit shipments under whichever version is currently active for a given submission date.

## How it works

### Prerequisites

- The policy must be in Active status. Cancelled, Expired, or Incomplete policies cannot be endorsed.
- The Effective Date of the change must be agreed with the customer. Shipments submitted before this date will continue to use the previous configuration.
- A clear Endorsement Note must be drafted — a short, audit-ready explanation of why the policy is being endorsed. It appears on the audit trail and, for commercial endorsements, on the endorsement document.
- The broker must be aware of what is locked during an endorsement. Broker, Policyholder, Policy Type, Policy Contract Number, Start Date, and End Date cannot be changed. If any of those needs to change, the policy has to be cancelled and re-issued instead.

### Starting an endorsement

1. Open the active policy from the Policies search module.
2. On the policy's detail page, click the three-dot Actions button at the top right.
3. Select Endorse Policy.

The wizard opens in endorsement mode. The header reads Endorse Marine Cargo Policy instead of Create Marine Cargo Policy, and a Confirm Endorsement button appears at the top right alongside Save and Exit.

### What is different in endorsement mode

The endorsement wizard is not the policy creation flow. It reopens the existing policy under a controlled amendment process, with three key differences from creation:

- An MTA Details step appears at the top of the sidebar. The broker has to enter the Endorsement Note and the Effective Date before anything else can be edited. This step is hidden entirely on brand-new policies and only appears when the wizard is opened in endorsement mode.
- Some fields are locked. Broker, Policyholder, Policy Type, Policy Contract Number, Start Date, and End Date cannot be changed via endorsement.
- The header and the top-right button change — Confirm Endorsement replaces the standard Save/Save-and-Exit actions from creation.

### The MTA Details step

Two required fields.

**MTA Effective Date.** The date from which the amendment applies. Must fall within the valid range of tomorrow through to the policy's end date. Backdating is not allowed beyond tomorrow (the earliest permitted). No effective date can be set later than the policy's own end date.

**Endorsement Note.** Free-text justification for the change. Mandatory. Surfaces on the audit trail and, for commercial endorsements, on the endorsement document.

After completing the two fields the broker clicks Next to move on to General Details. The wizard advances with the locked fields populated from the existing active version.

### Making the changes

The broker navigates to whichever section they need to change using the sidebar. The form steps and configuration steps are the same as the original wizard, except for the locked fields. Two side effects are worth flagging:

- **Changing the billing currency while in endorsement mode** raises a warning, because rate tables in a non-matching currency need to be reconfigured before the new currency can take effect.
- **Changing risks (the Risks step) while in endorsement mode** surfaces a side-by-side comparison against the current active version so the broker can confirm exactly what is being altered before publishing.

At any point the broker can click Save and Exit to preserve the draft. The endorsement draft is stored on the policy and can be resumed later. The policy is now in the Active – MTA in Progress state; the previous policy version continues to govern all shipments until the endorsement is published.

### Publishing the endorsement

When the changes are ready, the broker clicks Confirm Endorsement at the top right of the wizard. A confirmation dialog opens; confirming publishes the endorsement. The browser navigates back to the policy's detail page.

On publish:
- The endorsement is committed and a new policy version is created.
- The previous version is preserved in the policy's version history for audit.
- The new version is the one used for any shipment submitted on or after the effective date.
- The policy's status returns to Active from Active – MTA in Progress.

### Effective date and shipments

The effective date determines which version of the policy applies to a given shipment. Two rules:

- Shipments submitted before the effective date continue to use the previous configuration — their rating, clauses, and document templates all come from the version that was active at submission time.
- Shipments submitted on or after the effective date use the updated configuration.

There is no retroactive change to shipments already in the system. Shipments in flight — whether Booked, Quoted, or somewhere else in their own lifecycle — do not change under them when a new endorsement is published. The endorsement only affects shipments submitted from its effective date onwards.

An endorsement with a future effective date does not govern any shipment until that date arrives. Publishing does not make it take effect immediately if the effective date is later.

### Version numbering and history

Every endorsement creates a new policy version and increments the version position. The policy's audit history shows the full chain of versions with their activation dates. Multiple endorsements over time are normal and expected. The version history is the canonical lookup for which configuration applied at any given point.

Ancillary versions — new rating versions and new document versions — are also created as part of the endorsement when the corresponding steps change. A shipment already generated against a prior document version continues to display that older template; new shipments after the effective date use the new template. Rating operates the same way.

### Shipment-level manual override

Separate from the endorsement flow, brokers can manually adjust the premium on an individual booked shipment through the updated-rate flow. No approval is needed; the broker is the authority for that single shipment. The change is tracked in the audit trail but does not create a new policy version.

## Known issues and limitations

- **No discard for scheduled versions.** If a broker schedules a rating or document version by mistake, there is no way to delete it in the current release. The workaround is to schedule another new version to overwrite. This is a known UX gap flagged in the platform knowledge transfer — inefficient but functional.
- **Rollback is only forward.** Brokers can revert to a prior version's configuration by scheduling that prior configuration as a new future activation, but not by pressing an Undo button. Rolling back is always another forward endorsement.
- **Locked fields cannot be endorsed.** Changing the Broker, Policyholder, Policy Type, Contract Number, Start Date, or End Date requires cancelling the policy and re-issuing a new one.
- **A draft endorsement on a cancelled policy cannot be confirmed.** If a policy is cancelled while an unpublished endorsement draft is open, the draft remains on the policy record but cannot be confirmed once the cancellation takes effect.

## Business rules & calculations

- **Effective dates are one-way.** A future-dated version does not retroactively apply to past shipments.
- **Version position** increments on each endorsement; the version history lists all past versions with their activation dates.
- **Cancellation cascade:** cancelling the underlying policy marks every version obsolete.
- **New shipments under a new version emit their own analytics event** tagged with the version — so analytics does not double-count.
- **Endorsement Effective Date must be within tomorrow through the policy end date.** No same-day and no past dates.
- **Endorsement Note is mandatory.** It appears on the audit trail and, for commercial endorsements, on the endorsement document.
- **Only active policies can be endorsed.** Cancelled, Expired, and Incomplete policies cannot.
- **Multiple endorsements over time are normal.** Each creates its own version.
- **Two side effects worth flagging during endorsement:** changing billing currency warns and forces rating reconfiguration; changing risks surfaces a side-by-side comparison against the current version.

## Related concepts

- Policy Creation
- Cancellations
- Policy Lifecycle
- Renewals
- Rating
- Referral Management
- Billing
