# Policy Duplication

## What it is

Duplication lets a broker clone an existing policy as the starting point for a new one — same participants, same clauses, same rating configuration, same document templates. The broker then tweaks whatever needs to change (usually new policyholder, new insurer, new term dates) and activates. It's the fastest path to a new policy that shares 80%+ of its terms with an existing one, and it's heavily used during production ramp-up when Nacora onboards a batch of similar policies.

## Who uses it & where

- **Broker staff** use it from the policy detail page in the Backoffice.
- **White-label or ramp-up scenarios** — clone a "master" template policy per customer.

## How it works

1. Broker opens an existing policy, clicks "Duplicate".
2. The system creates a new policy version with title "Incomplete" and state Draft.
3. The following are copied from the source, all five wizard steps:
   - General details (name, term, product).
   - Quote document template.
   - Certificate document template.
   - Rating configuration (base rates, lookup tables, active version).
   - Clauses and business rules attached.
4. **Shipments are not copied.** The new policy starts empty.
5. The broker can change any of these during the copy:
   - **Insurer** (GFH or Allianz).
   - **Policyholder**.
   - Any other detail across the five steps.
6. The broker is dropped into the New Business wizard, pre-populated with the copied data. They review each step and adjust.
7. Save and activate. A fresh policy number is generated. The new policy is now independent — future changes to the source do not cascade.

## Known issues (flagged in KT)

Thiva (departing PM) flagged that **duplication has functional issues post-copy that need fixing**. The KT didn't specify which — treat any duplicated policy as needing extra review across all five steps until the bugs are addressed. This is a known-limitations item, not a blocker.

## Document template persistence on duplicate

Both the Quote Document template and the Certificate Document template configurations carry over correctly to the duplicated policy (from I2G-30110). The templates retain their activation state — an active template on the source produces an active template on the copy; an in-progress template stays in progress. This is the fix for an earlier bug where duplicated policies would land with the deployment's default template instead of the source's bespoke template, which forced brokers to rebuild the template configuration from scratch on every duplicate.

The templates are still independent copies on the new policy — future edits to the source's template do not cascade to the copy — but the starting point is now correct rather than empty.

## Business rules & calculations

- **Policy number is fresh** by default. The system generates the next `MC-XXXXXX` number.
- **Incomplete state:** the new policy stays in "Incomplete" until the broker actively reviews and activates.
- **Insurer and Policyholder can be changed** during duplication — this is the main lever that makes duplication useful.
- **Clauses are copied by reference to the latest active version.** If the underlying clause is later updated, only newly-attached shipments get the new version; existing ones remain on the version they were issued against.
- **Rules do not deep-copy** — they are re-linked. Editing the rule on the copy edits it on the source too. Break the link explicitly if you need divergence.
- **New empty quotation** is created for the copy. The source's quotations do not carry over.
- **Quote and Certificate templates carry activation state.** Whether the source template is active or in-progress, the copy lands in the same state.

## Related concepts

- Policy Creation
- Renewals
- Clauses
- Business Rules
- Open Questions & Risks
