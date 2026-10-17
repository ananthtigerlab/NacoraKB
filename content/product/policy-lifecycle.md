# Policy Lifecycle

## What it is

A policy is the umbrella that every shipment, endorsement, and special rate hangs off. Understanding the policy's own lifecycle — from blank canvas in the wizard, through activation, through mid-term changes, to cancellation or expiry — is the foundation for everything else the platform does.

This page maps every status a policy can be in, who owns each status, and what each transition unlocks (or freezes) downstream. Most of what other people can do at any given moment depends on the policy's current status: it is the quickest reference for "why can't I do X right now?".

## Who uses it & where

- **Brokers and Producers** — drive most transitions themselves. They build the policy through Draft, Quote, and Config Complete; they Activate it; they Endorse it in place; they Cancel it when the customer relationship ends or when a fundamental change forces a re-issue.
- **Participants** — never see the Draft, Quote, or Config Complete states. They interact with a policy only once it is Active or Active – MTA in Progress (and existing shipments only when it is Cancelled or Expired).
- **The system itself** — owns the Expired transition, triggered automatically when the end date passes. It also runs the scheduled batch job that transitions a Marked for Cancellation policy into Cancelled on the effective date.
- **Analytics** — reads every state transition to keep the reporting shipment counts, premium-earned figures, and policy counts accurate.

## How it works

### The lifecycle at a glance

A policy moves through the following states over its life:

- **Draft.** The policy is being built in the wizard. Only the wizard surface exists; nothing is transactional. The producer or broker completes the Quote Configuration phase — General Details, Participant Companies, Other Parties, Billing, Risks.
- **Quote.** Reached when the quote configuration phase is complete and the policy has been saved. The five Configuration Steps (Quote Document, Certificate Document, Rating, Clauses, Business Rules) have to be completed and each marked complete from here.
- **Config Complete.** All five configuration steps have been marked complete. The policy is eligible for activation. Still not transactional — no participant can submit anything yet.
- **Active.** The policy has been activated from the three-dot Actions menu on its detail page. It has a policy number, it appears in the Policies search module, and participants linked to it can now submit shipments. Endorsements can be applied, special-rate requests can be raised, and shipments can be quoted, booked, endorsed, and cancelled under it.
- **Active – MTA in Progress.** The policy is Active and a broker has opened an endorsement (Mid-Term Adjustment) that has not yet been published. The previous version continues to govern shipments while the draft endorsement is being prepared. The state returns to Active once the endorsement is published.
- **Cancelled.** Terminal state. The policy has been explicitly cancelled and its cancellation effective date has arrived. No new shipments can be created; existing shipments continue under their own lifecycle. See the Cancellations page for the full flow.
- **Expired.** Terminal state. The policy's end date has passed without being cancelled and without being renewed. No new shipments can be created after the end date; existing shipments continue under their own lifecycle.

Between Active and Cancelled sits a soft-scheduled state — Marked for Cancellation — which the platform treats as Active for all practical purposes until the effective date arrives. Marked for Cancellation is described in detail on the Cancellations page.

### Transitions and who triggers them

- **Draft to Quote.** The broker completes the Quote Configuration phase and saves. Triggered by the broker.
- **Quote to Config Complete.** The broker marks the fifth and final configuration step complete. Triggered by the broker.
- **Config Complete to Active.** The broker opens the three-dot Actions menu on the policy detail page and selects Activate Policy, confirming when prompted. Triggered by the broker.
- **Active to Active – MTA in Progress.** The broker opens the three-dot Actions menu and selects Endorse Policy. Triggered by the broker.
- **Active – MTA in Progress back to Active.** The broker completes the endorsement in the wizard and clicks Confirm Endorsement. Triggered by the broker.
- **Active (or Active – MTA in Progress) to Cancelled.** The broker opens the three-dot Actions menu on the policy detail page and selects Cancel Policy, setting an effective date and reason. On the effective date the system transitions the policy to Cancelled. Triggered by the broker (initiation); triggered by the system on the effective date (completion).
- **Active (or Active – MTA in Progress) to Expired.** The system automatically moves the policy to Expired when the End Date passes without a preceding cancellation or renewal. Triggered by the system.

There is no "un-cancel" or "un-expire" transition. Both terminal states are permanent. Resuming cover requires issuing a new policy.

### Who owns what at each stage

- **Draft.** Owned by the broker or producer. They complete the Quote Configuration phase to move to Quote.
- **Quote.** Owned by the broker or producer. They complete the five Configuration Steps and mark each one as complete.
- **Config Complete.** Owned by the broker or producer. They activate the policy.
- **Active.** Owned jointly by the broker or producer (who administers it) and participants (who transact under it). They manage day-to-day endorsements, special rates, and shipment activity.
- **Active – MTA in Progress.** Owned by the broker or producer. They complete the MTA Details step and republish the policy.
- **Cancelled.** No owner. Terminal state; existing shipments are governed by their own lifecycle.
- **Expired.** No owner. Terminal state; shipments after the end date cannot be booked.

### What each status unlocks downstream

- **Draft, Quote, and Config Complete.** Nothing transactional. The wizard is the only surface. No shipments, no referrals, no special rates. Analytics does not count these versions.
- **Active.** Quote, book, endorse, and cancel shipments. Submit and approve special-rate requests. Resolve referrals. Endorse the policy itself. Cancel the policy itself. Renewal reminders fire from the system side at thirty, fourteen, and seven days before the end date.
- **Active – MTA in Progress.** The wizard is open for a producer; shipments under the previous policy version continue normally. The new version takes effect once the MTA is published on its effective date.
- **Marked for Cancellation.** The policy is Active in every practical sense — participants can still submit shipment declarations, quotes can still be booked, endorsements can still be applied (subject to the endorsement's locked-field rules). The cancellation can be reviewed by reopening the policy's detail page; the scheduled date and reason are shown alongside the status.
- **Cancelled.** No new shipments. Existing shipments can still be endorsed or cancelled according to their own status. Endorsement history stays on record. The refund calculation happens on the BMS side, not in this platform.
- **Expired.** No new shipments after the end date. Existing shipments remain governed by their own lifecycle.

### Cancellation transaction type and MTA drafts

Two behaviours specific to how cancellations are reflected on the policy record:

- **Transaction Type on a cancelled policy.** A cancelled policy carries the Transaction Type "Cancellation" — not "New Business" — on its record after the cancellation completes (from I2G-29994). The earlier behaviour incorrectly showed "New Business" against the cancellation transaction, which distorted premium reporting; the fix ensures cancellation transactions are correctly categorised end-to-end. In the same fix, no renewal draft is auto-created on cancellation — cancelling a policy does not need to spin up a renewal that will never happen.
- **MTA drafts obsoleted on policy cancel.** When a policy is cancelled, any in-flight endorsement drafts (Mid-Term Adjustment drafts) associated with the policy are automatically obsoleted (from I2G-29546). A broker cannot leave a stale MTA draft attached to a cancelled policy — the draft is closed as part of the cancellation. If the customer relationship resumes, a fresh policy is required rather than resurrecting the old endorsement draft.

### Common scenarios

**"I want to change the participant companies on a live policy."** Open the policy, choose Endorse Policy from the three-dot Actions menu, set the MTA Details (Effective Date and Endorsement Note), and edit Participant Companies. The change takes effect on the endorsement's effective date. Shipments submitted before that date continue under the previous version.

**"A participant booked a shipment before I cancelled the policy. What happens to that shipment?"** The shipment continues under its own lifecycle. Cancelling the policy does not retroactively cancel booked shipments — each shipment is governed by its own shipment lifecycle.

**"The policy's end date has passed but there's a quote sitting at Quoted."** The quote cannot be booked. It has to be re-quoted under a renewed or new policy.

**"I need a special rate that applies to one specific commodity or route for the next three months."** The policy stays Active; a special-rate request is submitted against it, reviewed through the referral workflow, and applied for its own effective window.

**"I need to change the policy's start date."** Not possible via endorsement — Start Date is locked. The policy has to be cancelled and re-issued as a new policy.

## Business rules & calculations

- **The Draft, Quote, and Config Complete states are pre-transactional.** No participants can act on the policy in these states.
- **Activation is manual.** The three-dot Actions menu on the policy detail page triggers it; the wizard itself does not.
- **The completion indicator on the policy detail page must reach 100 percent before activation is possible.** Missing steps are listed for the broker to complete.
- **Every endorsement creates a new policy version.** The previous version is preserved for audit. Shipments submitted before the new version's effective date remain governed by the previous version.
- **Cancelled and Expired are terminal.** There is no reverse transition; resumption requires a new policy.
- **Marked for Cancellation is treated as Active** until the effective date arrives. It accepts new shipments, quotes, and endorsements up to that point.
- **The System owns Expired.** It fires automatically when the End Date passes.
- **The System owns the Cancelled transition on the scheduled effective date.** The broker owns the Cancelled initiation.
- **Renewal reminders fire at thirty, fourteen, and seven days before the end date.**
- **Analytics counts each version as a distinct line** so original and endorsed premium are kept separate.

## Related concepts

- Policy Creation (New Business)
- Adjustments (MTA)
- Cancellations
- Renewals
- Referral Management
- Special Rate
