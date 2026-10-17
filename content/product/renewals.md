# Renewals

## What it is

Renewals are how a policy continues past its end date. Rather than expiring silently, the platform watches every active policy and, as its end date approaches, prompts the broker to renew it. A renewed policy is not a fresh contract — it is a **new version of the same policy**, carrying the same policy number, the same participant companies, the same clause and rating configuration, and defaulting to a start date the day after the parent version's end date. The broker adjusts whatever needs to change (premium indexation, new participants, updated rating), the underwriter approves, and the renewed version becomes the current version at the effective moment.

The policy number stays the same; only the version bumps. That continuity matters because it preserves the historical link between last year's book and this year's — analytics can compare period on period, brokers can talk to their customer about "your policy" without prefixing every conversation with "the old one versus the new one", and audit ties cleanly across the boundary.

Renewals sit alongside — but are distinct from — Mid-Term Adjustments and Cancellations. An MTA changes a live policy in the middle of its term. A cancellation ends coverage entirely. A renewal picks up where the current version leaves off and extends coverage for another period. See Adjustments (MTA) and Cancellations for the other two.

## Who uses it & where

- **Brokers and Producers** — receive the reminder emails, initiate the renewal from the email link or from the policy detail page, and complete the wizard. They are the primary owner of the renewal journey end-to-end.
- **Underwriters** — approve the renewed version using the same approval flow as New Business. Where the renewal touches insurance-company shares or introduces a materially different risk profile, the underwriter's sign-off is what unlocks activation.
- **Administrators** — occasionally intervene when a renewal is stuck (for example, the participant company hierarchy needs cleanup before the new version can activate) but do not routinely own the flow.
- **Participants** — never touch the renewal wizard. They continue transacting on the parent version until the renewed version's effective date arrives; from that date onwards, new shipments attach to the renewed version automatically.
- **Finance** — reads the renewed-premium event stream to track retention KPIs (renewal rate, premium retained versus lost, average premium change on renewal).

Renewals are triggered and completed in the Backoffice only. There is no participant-facing surface.

## How it works

### The reminder cycle

The platform runs a daily background job that scans every Active policy and every Active – MTA in Progress policy. For each one it compares the end date against today.

1. **Sixty days out.** The first reminder email is sent to the assigned broker. Subject line typically reads "Policy [number] is due for renewal in 60 days". The body contains the policy number, the current end date, and a **Renew this policy** button that opens the renewal wizard.
2. **Thirty days out.** A second reminder is sent to the broker if no renewal has been initiated.
3. **Fourteen days out.** A third reminder is sent to the broker and, in most deployments, copied to the broker manager and the underwriting team so the risk of an unrenewed lapse is visible outside the broker's own inbox.
4. **Seven days out.** A final reminder is sent to the broker, the broker manager, and the underwriter. This one is treated as escalation.
5. **On the end date.** If no renewal has activated by that moment, the policy transitions to Expired automatically. New shipments cannot be booked against it, and existing booked shipments continue to run under the Expired policy until their own lifecycles conclude.

The reminder schedule is configurable per deployment — smaller books may want a shorter cycle, larger enterprise books may want a longer one — but the four-touch pattern (60 / 30 / 14 / 7 days) is the platform default.

### Starting a renewal

Two entry points, both leading to the same wizard.

- **From the reminder email.** The broker clicks Renew this policy. They are redirected into the Backoffice (signing in if necessary) and landed directly on the renewal wizard with the parent version's data pre-filled.
- **From the policy detail page.** The broker opens the policy, clicks the three-dot Actions menu at the top-right of the policy header, and selects Renew Policy. Same wizard, same pre-fill.

A renewal cannot be initiated more than 90 days ahead of the parent's end date. Attempting it earlier surfaces a validation error asking the broker to wait until the renewal window opens.

### The renewal wizard

The wizard is the same guided flow as New Business — General Details, Participant Companies, Other Parties, Billing, Risks, followed by the five Configuration Steps (Quote Document, Certificate Document, Rating, Clauses, Business Rules) — with three important differences.

- **Every step opens pre-filled** from the parent version. The broker reviews and adjusts each step; unchanged steps can be marked complete immediately.
- **The new version's title defaults to "Renewed"**. The policy number is the same as the parent; the version identifier is incremented.
- **Dates default sensibly.** Start date defaults to the day after the parent's end date. End date defaults to Start date + 1 year. Both can be overridden.

The broker walks the steps, adjusts whatever needs adjusting (typically premium indexation on the Rating step, occasionally a new participant on the Participant Companies step, occasionally a refreshed clause set on the Clauses step), and marks each step complete.

### Approval and activation

Once every configuration step is marked complete, the completion indicator reaches 100 percent and the renewed version becomes eligible for activation. Two patterns exist, depending on deployment configuration:

- **Broker-owned activation.** For deployments where the broker holds the authority, the broker opens the three-dot Actions menu on the policy detail page and selects Activate Policy. Confirmation dialog, activation. The renewed version becomes the current active version at the moment of activation, or on the configured effective date if that is in the future.
- **Underwriter approval required.** For deployments (or for policies) that require underwriter sign-off on renewal, the broker submits the renewed version for approval. The underwriter reviews the changes side-by-side with the parent version, sees the delta, and either approves (activating the renewed version) or requests changes (returning the renewal to Draft). Decline is not the normal exit — a renewal that cannot be approved usually goes back for adjustment rather than being rejected outright.

### What survives the version bump — and what does not

The renewed version carries forward almost everything from the parent. What does not carry forward is deliberately excluded so the renewal does not accidentally repeat operational history.

**Carries forward:**

- General Details (name, term configuration, product, insurers and their shares).
- Participant Companies list (adjustable during wizard).
- Other Parties (Named Assured, Additional Insureds, Loss Payees).
- Billing configuration (currency, tax settings, charge levels).
- Risks configuration (commodity groups, conveyances, countries, packing, coverages).
- Quote Document and Certificate Document templates (retain activation state, per I2G-30110).
- Rating configuration (Base Rater, Special Rater, Lookup Tables — copied as a starting point; broker adjusts).
- Clauses (attached to the renewed version at the same versions used by the parent).
- Business Rules (attached to the renewed version at the same versions used by the parent).

**Does not carry forward:**

- **Shipments.** The renewed version starts with an empty shipment list. Shipments booked under the parent stay associated with the parent version and continue under their own lifecycles.
- **Quotations.** In-flight quotes on the parent do not transfer. A quote issued under the parent that has not been booked by the parent's end date has to be re-quoted under the renewed version (which will use the renewed version's rating).
- **Special Rate Requests in Draft.** Draft requests do not transfer; approved and In Use Special Rates do transfer as configuration.
- **Referrals.** Open referrals against the parent must be resolved on the parent version.

### The transition moment

On the renewed version's effective date, three things happen atomically for shipment routing:

1. New shipment declarations submitted from that date onwards attach to the renewed version.
2. Booked shipments already in force under the parent continue under the parent — the version does not roll them.
3. Any Quoted (but unbooked) shipments under the parent are held. They are still bookable under the parent's terms until the parent's end date; on that date, a Quoted shipment expires and needs re-rating.

If the renewed version has a later effective date than the parent's end date (a gap in cover), the platform treats the gap as an Expired window — no new shipments can be declared, existing booked shipments continue. This is unusual but supported for policies where the customer intentionally paused cover.

### Renewal after MTA

If the parent policy has been endorsed (Mid-Term Adjustment) at some point, the renewal always branches from the **latest active version** — not from the original. The renewed version inherits the endorsement's changes as its baseline.

### Renewal on a cancelled policy

A policy in Cancelled or Marked for Cancellation status cannot be renewed. Renewal is only available on Active and Active – MTA in Progress policies. If a customer whose policy was cancelled wants coverage again, the correct path is a new policy, not a renewal of the cancelled one.

## Options & choices

### Wizard steps opened during renewal

| Step | Default source | Broker action |
|---|---|---|
| General Details | Parent version | Review, adjust name/insurers/shares if changing |
| Participant Companies | Parent version | Add new participants, remove departing ones |
| Other Parties | Parent version | Review — usually unchanged |
| Billing | Parent version | Review — usually unchanged |
| Risks (5 tabs) | Parent version | Review each tab; add new commodity groups or conveyances if scope expanded |
| Quote Document | Parent version, template versioned | Review; changes create a new template version scoped to the renewed policy |
| Certificate Document | Parent version, template versioned | Review; changes create a new template version scoped to the renewed policy |
| Rating | Parent Base Rater and lookup tables | Review; typically applies indexation, may adjust rates cell by cell |
| Clauses | Parent clause attachments | Review; add or remove clauses as needed |
| Business Rules | Parent rule attachments | Review; adjust thresholds or add new rules if the market has shifted |

### Renewal statuses

The renewed version follows the same policy lifecycle states as any new policy — Draft, Quote, Config Complete, Active, Active – MTA in Progress, Cancelled, Expired. The status is on the renewed version; the parent version continues to be visible with its own status until its end date.

### Reminder recipients

| Days before end date | Broker | Broker manager | Underwriting team |
|---|---|---|---|
| 60 | Yes | No | No |
| 30 | Yes | No | No |
| 14 | Yes | Yes | Yes |
| 7 | Yes | Yes | Yes |

### Options on the renewal wizard header

- **Save Draft** — parks the renewed version at any point; the broker can return to it.
- **Save and Exit** — persists the current state and returns to the policy detail page. The renewed version stays in Draft until every configuration step is complete.
- **Discard Renewal** — abandons the renewed version. Available only while the version is in Draft.
- **Submit for Approval** — appears when the deployment requires underwriter approval and every step is marked complete.
- **Activate Policy** — appears when the broker holds activation authority and every step is marked complete. Selected from the three-dot Actions menu on the policy detail page, not inside the wizard.

## Business rules & calculations

- **Same policy number, new version.** A renewal does not mint a new policy number. It is the same identifier with a new version. See Numbering.
- **Reminder cadence:** 60, 30, 14, and 7 days before end date. Configurable per environment.
- **Renewal window:** cannot be initiated more than 90 days ahead of the parent's end date.
- **Shipments do not carry over.** Every renewal starts with an empty shipment list. Prior-year history stays associated with the prior version.
- **Renewal branches from the latest active version.** If the parent has been endorsed one or more times, the renewed version inherits from the most recent endorsement, not from the original.
- **Broker-specific renewal discounts** (if configured on the broker company) apply to the base rate on the renewed version's rating step.
- **Analytics event:** on activation, the platform emits a `policy.renewed` event carrying the parent version identifier and the renewed version identifier, so retention KPIs and premium-change reporting can join the two versions cleanly.
- **Certificate template continuity.** Quote and Certificate document template configurations are carried over correctly to the renewed version, retaining their activation state (from I2G-30110). The renewed version's templates are independent copies — future edits do not cascade back to the parent.
- **No renewal on a cancelled policy.** Renewals are only available on Active and Active – MTA in Progress policies. A cancelled policy requires a fresh new-business policy to resume coverage.
- **Gap coverage.** If the renewed version's effective date is later than the parent's end date, the intervening period is uncovered. The platform will not automatically pick up this gap — the broker sets the dates deliberately.
- **Auto-active roles carry.** Participant Companies on the parent are re-attached with the same roles active on the renewed version. Participants do not need to re-approve.
- **Renewal reminders honour opt-out.** A broker or broker manager who has opted out of reminder emails receives no reminder — the escalation still goes to the underwriter and the manager at 14 and 7 days.
- **Failed renewal falls to Expired silently.** The system does not raise a warning at expiry — the broker is expected to have acted by then. Downstream analytics counts the unrenewed policy as lapsed.

## States & transitions

- **Parent version — Active → Renewal In Progress (parent state unchanged).** The renewed version is a Draft version of the same policy; the parent remains Active until its end date.
- **Renewed version — Draft → Quote → Config Complete → Active.** Same state machine as any new policy version. Owned by the broker (or the underwriter if approval required).
- **Renewed version — Active on effective date.** At the moment the effective date passes, the renewed version becomes the current active version. The parent version continues to display but no longer receives new shipments.
- **Parent version — Active → Expired on end date.** If the renewed version has activated by that moment, this is a routine handover; if not, coverage lapses.

## Related concepts

- Policy Creation (New Business)
- Adjustments (MTA)
- Cancellations
- Billing
- Documents
- Rating
- Numbering
- Analytics & Reporting
