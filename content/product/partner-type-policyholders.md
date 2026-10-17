# Partner Type — Policyholders

## What it is

A **Policyholder** is the Business Partner that owns a cargo policy. In practice the policyholder is almost always a Company-category partner carrying the Policyholder role; individual insureds are rare but supported (in which case a Person-category partner carries the Policyholder role instead).

Everything on the policy — the official name printed on documents, the addresses used on certificates, the nature of business that drives commodity handling — flows from this record. For most K+N-branded arrangements the policyholder is a K+N regional entity (in the current MVP, KN Poland) that fronts the contract for a group of downstream logistics teams. Those logistics teams are Participant Companies underneath the policyholder in the operational tree.

## Who uses it & where

- **Administrators** create and maintain policyholder records in the Backoffice. This is the standard onboarding task before a producer can configure a policy for a new customer.
- **Producers / Brokers** select the policyholder on the General Details step of the policy wizard. They cannot create a policy without one, and they cannot proceed past that step until a valid policyholder has been picked.
- **Underwriters** read the policyholder to understand who they are covering when reviewing a referral or a special-rate request.
- **Participants** never edit the policyholder directly, but the policyholder is what places them in the correct data scope — a participant sees only the shipments belonging to Participant Companies that sit under their policyholder.

## Typical use in the platform

The policyholder is the anchor of every commercial arrangement. When a Nacora regional broker entity sells a policy to a K+N regional entity, that K+N regional entity is registered as a policyholder in the platform first, and the policy is then configured with that policyholder attached at the top of General Details.

Downstream:

- The policyholder appears on the policy header and on every certificate generated from that policy.
- The policyholder decides which addresses print on the certificate.
- The policyholder's nature of business (Shipper/Consignee, Freight Forwarder) drives which commodity groups are available to the participants in the shipment form.
- The policyholder is where bordereau reports roll up — monthly billing statements are grouped by policyholder for the BMS side to pick up and invoice against.
- In dashboards, filtering by policyholder is one of the most common queries — brokers watching a specific customer, underwriters reviewing exposure by policyholder, administrators auditing partner health.

## Key facts

- Category: Company. Role: Policyholder. (Occasionally Person + Policyholder for individual insureds.)
- Selected on the policy at General Details, and only after the Broker Company has been chosen.
- **Filtered by the chosen Broker Company.** Changing the broker clears the policyholder — because a policyholder is always relative to a broker.
- The form auto-populates the official name, the address fields, and the nature of business from the partner record.
- **Changing the policyholder mid-configuration** clears participant companies and (depending on the new nature of business) the commodity groups, with a confirmation dialog. This is protective — the wizard does not silently rewrite fields that depend on the policyholder.

## Attributes specific to policyholders

- **Registration name** — the "official name" printed on policies and certificates. Required. Renaming later updates new policies only; existing policies keep the snapshot name from when they were configured.
- **Primary address** — used as the holder address on policies and certificates. Required. Line 1, postal code, city, state, country are all mandatory whenever the policyholder is referenced from a policy.
- **Primary email** — used for notifications and quote dispatch. Required.
- **Nature of business** — Shipper/Consignee, Freight Forwarder. Drives commodity-group handling on the policy wizard. A change is flagged in the wizard with a warning because it can invalidate commodity groups on in-flight configurations.
- **Tax / registration IDs** — recorded for compliance and shown on certificates as applicable.
- **Additional addresses** — extra correspondence addresses can be added and one marked primary at a time.

## Relationships a policyholder participates in

- **Belongs to** a Broker Company. Direction: Policyholder → Broker Company. This is what filters the policyholder dropdown on the wizard — only policyholders belonging to the selected Broker Company appear.
- **Owns** one or more policies via the *policy holder* relation type. Direction: Policyholder → Policy.
- **Parent of** one or more Participant Companies, when the deployment models the logistics teams as branches under the policyholder. Direction: Participant Company → Policyholder (belongs-to).

## Adding a policyholder — step by step

1. From the Business Partners dashboard in the Backoffice, click **Add**. Choose **Category = Company**.
2. Set the **registration name** — this becomes the official name on the policy.
3. Add at least one **address** with line 1, postal code, city, state, country. Mark it as the primary correspondence address.
4. Add an **email** and, if known, a **phone**.
5. Attach the **Policyholder** role.
6. Link the policyholder to a Broker Company via a relationship (typically *broker of*, direction chosen so the policyholder sits under the broker).
7. Set the **nature of business** attribute (Shipper/Consignee or Freight Forwarder) — this drives commodity handling later in the wizard.
8. Click **Save**.

Once saved, the policyholder appears in the policy wizard's General Details dropdown for the chosen Broker Company.

## Maintaining a policyholder

The most common edits:

- **Address change.** Add the new address, mark it primary, save. New policies and certificates pick it up immediately. Existing policies keep the address snapshot they were configured with.
- **Name change.** Edit the registration name. Existing policies retain the name from when they were configured; new policies use the updated value. This is intentional — a policy issued last year should keep the name that was on it last year.
- **Nature of business change.** The wizard warns you before saving because it can invalidate commodity groups on in-flight configurations. Coordinate with any producer who has an unpublished draft policy for this customer.
- **Deactivation.** Un-tick *Active* — the policyholder can no longer be selected on new policies. Existing policies are untouched.

Never delete a policyholder that is referenced by an active or historical policy. Deactivate instead.

## How the policyholder appears in dashboards, policies, and shipments

- **Business Partners dashboard.** The record appears in the grid with its registration name, primary address, and *Policyholder* role tag. Filtering the grid by role = Policyholder produces the full list.
- **Policy header.** The policyholder name and address sit at the top of every policy view.
- **Certificates.** The policyholder is printed as the insured party on every certificate generated from the policy.
- **Shipments.** Every shipment inherits the policyholder from its parent policy. Filtering shipments by policyholder is a common broker workflow — "show me every shipment this quarter for KN Poland".
- **Bordereau reports.** Monthly billing rolls up per policyholder. This is what the BMS side reads for invoicing.
- **Referrals and Special Rates.** Referrals and special-rate requests inherit the policyholder from the shipment and policy respectively. Underwriters filter by policyholder to see all exposure for a customer.

## Business rules & calculations

- **The registration name is the official name on the policy.** Do not use trading names or short-hand — this is what prints on certificates and appears in bordereaux.
- **Snapshots, not live links.** When a policy is configured, the policyholder's name and address are snapshotted onto the policy. Editing the record later does not retroactively rewrite existing policies or certificates.
- **Changing the broker resets the policyholder.** If you are mid-configuration on a policy, choose the broker first and only then the policyholder.
- **Changing the nature of business can invalidate commodity groups.** The wizard flags this with a warning. Avoid the change while a draft policy for the same customer is in flight.
- **Renaming is safe but not retroactive.** New policies use the new name; existing policies keep the old name.
- **Do not delete a policyholder referenced by any policy.** Deletion is refused where a reference exists. Use deactivation.
- **Only one primary address at a time.** Adding a new address and marking it primary automatically unsets the old primary.

## Related concepts

- Business Partner
- Partner Type — Broker Companies
- Partner Type — Participant Companies
- Partner Type — Insurance Companies
- Organisation Tree
- Policy Creation
