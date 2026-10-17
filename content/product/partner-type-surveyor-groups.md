# Partner Type — Surveyor Groups

## What it is

A **Surveyor Group** is a group of people responsible for inspecting cargo on loss or arranging claims investigation. Every cargo policy configured on the platform has a **primary** surveyor group and may optionally have a **secondary** surveyor group. The chosen group's contact details print on the certificate issued for each shipment, so the insured knows exactly whom to contact if something goes wrong in transit.

Surveyor groups matter operationally in a specific and narrow way — they are the first phone call when a claim is opened. If the phone number or email printed on a certificate is out of date, the insured has an unpleasant surprise at the worst possible moment. That is why keeping surveyor contact details current is one of the small, repetitive maintenance tasks that has an outsized real-world impact.

## Who uses it & where

- **Administrators** create and maintain Surveyor Group records in the Backoffice, and coordinate with the surveyor bureau to keep contact details current.
- **Producers / Brokers** select the primary and (optionally) secondary surveyor group on the policy wizard's Other Parties step.
- **Underwriters** read the surveyor group when evaluating a claims scenario or when checking a policy's setup during referral review.
- **Participants** see the surveyor's name and contact details on the certificate they download for a shipment. They do not select or edit the surveyor group.
- **Surveyors themselves** typically do not sign into the platform for day-to-day operational work. The group's contact details are what matter to the insured. Individual surveyors can be attached as Person records under the group if the deployment wants to track them.

## Typical use in the platform

When a producer is configuring a new policy, they nominate a primary surveyor group on the Other Parties step. The group's contact information is then baked into every certificate issued from that policy. If a shipment arrives with damage, the participant reads the certificate, finds the surveyor's phone number or email, and initiates a claim.

Because the certificate is issued at booking and lives with the shipment for the life of that consignment, the contact details captured on the surveyor record at the moment of booking are the ones the insured sees months later when the claim is opened. Post-hoc edits to the surveyor group do not retroactively rewrite existing certificates — the snapshot is what the insured has.

## Key facts

- Category: Group. Role: Surveyors.
- Assigned on the policy at the Other Parties step.
- One **primary** surveyor group is required per policy.
- One **secondary** surveyor group is optional.
- The choice surfaces on certificates so the insured can reach the surveyor directly.
- Contact details are snapshotted onto certificates at issue time.

## Attributes specific to surveyor groups

- **Group name** — e.g. *Marine Surveyors Polska*. Required. Prints on certificates.
- **Primary email** — for claims contact. Required.
- **Primary phone** — for claims contact. Required.
- **Contact address** — for correspondence and certificate footers. Required.
- **Members** — individual surveyors can optionally be added as Person records with relations into the group.

## Relationships a surveyor group participates in

- **Assigned to** one or more policies as the primary or secondary surveyor group, via the Other Parties step.
- **Parent of** individual surveyors as Person records, via *belongs-to* relations. Direction: Person → Surveyor Group.

## Adding a surveyor group — step by step

1. From the Business Partners dashboard, click **Add**. Choose **Category = Group**.
2. Set the **name** (e.g. *Marine Surveyors Polska*).
3. Add a primary **email**, **phone**, and contact **address**. All three are required — they print on the certificate.
4. Attach the **Surveyors** role.
5. Optionally, add individual surveyors as Person Business Partners with relations into the group.
6. Click **Save**.

Once saved, the surveyor group appears in the Primary and Secondary Surveyor Group dropdowns on the policy wizard's Other Parties step.

## Maintaining a surveyor group

- **Contact details.** Keep the email and phone current. These print on certificates and are the insured's first point of contact in a claim. Audit at every renewal.
- **Members.** Add or remove individual surveyors by editing the relations between the group and its Person members.
- **Deactivation.** Removes the group from selection lists on the policy wizard. Existing policy certificates are unaffected — they retain the surveyor snapshot from the moment they were issued.
- **Renaming.** Safe. Updates certificates issued after the rename; existing certificates keep the old name.

Never delete a surveyor group that has been assigned to any policy. Deactivate instead.

## How the surveyor group appears in dashboards, policies, and shipments

- **Business Partners dashboard.** Shows in the grid with its group name, contact email, and *Surveyors* tag. Filtering by role = Surveyors produces the full list.
- **Policy wizard — Other Parties step.** Primary and Secondary Surveyor Group dropdowns are populated from the list of active Surveyor Groups.
- **Policy header.** The primary surveyor group is shown alongside the insurers on the policy summary.
- **Certificate PDF.** The surveyor's name, phone, email, and address print in the claims-contact block of every certificate generated for a shipment under the policy.
- **Shipments dashboard.** No direct surveyor filter — the surveyor is a property of the policy the shipment is under.

## Business rules & calculations

- **Every policy must have a primary surveyor group.** The Other Parties step blocks activation without one.
- **Only one primary at a time.** The wizard's Primary Surveyor field is single-select.
- **Secondary is optional.** Left blank if not needed.
- **Contact details are snapshotted at certificate issue.** Editing the surveyor group after certificates have been issued does not rewrite the certificates. New certificates use the current details.
- **Stale contact details on a certificate are a real claims problem.** A claim filed against an out-of-date phone or email is the worst possible time to discover the issue. Audit surveyor contact details at every renewal.
- **Deactivation does not remove the surveyor from existing policies.** Only new policies are affected. This is deliberate — existing coverage cannot be silently unmoored from its claims contact.

## Related concepts

- Business Partner
- Partner Type — Insurance Companies
- Partner Type — Policyholders
- Policy Creation
- Documents
