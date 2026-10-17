# Partner Type — Insurance Companies

## What it is

An **Insurance Company** is the carrier that underwrites a cargo policy. In Nacora, two insurers are relevant to the operational scope:

- **GFH** — Nacora's in-house underwriting agency, used for Nacora-branded policies.
- **Allianz Global Risks US** — the third-party underwriter used for non-Nacora-branded policies.

The platform supports **co-insurance** — multiple insurers can share a single policy, each with a defined percentage share, and exactly one of them designated as the Lead Insurer. This is common enough in cargo insurance that the platform makes it a first-class feature rather than a workaround.

## Who uses it & where

- **Administrators** create and maintain Insurance Company records in the Backoffice. This is a low-frequency activity — a new insurer being added is a strategic event, not routine data entry.
- **Producers / Brokers** select insurance companies on the policy wizard's Other Parties step and assign the shares. They also nominate the Lead Insurer at the same step.
- **Underwriters** belong to an Insurance Company via the Insurance Group they sit in. Their data scope is defined by which Insurance Company they underwrite for — they see referrals and special-rate requests only for policies where their Insurance Company is a listed insurer.
- **Participants** never see the Insurance Company as a management surface. It appears on their certificate, but they do not select or edit it.

## Typical use in the platform

When a policy is being configured, the producer picks one, two, or three insurers on the Other Parties step and assigns each a percentage share. The percentages must total exactly 100%. One insurer is nominated as the Lead — this is the one that carries the largest share, or by policy convention, the one that acts as the coordinating insurer for referrals and communications.

For Nacora-branded policies, the pattern is GFH as the sole insurer at 100%. For third-party policies, Allianz Global Risks US typically sits as the sole insurer. When co-insurance is used (rare in the current scope), the shares are agreed commercially and entered on the wizard exactly as agreed.

Once the policy is active, the insurers are what determines who reviews any referrals. A shipment referred to underwriting lands with the underwriters of the Lead Insurer by default; special-rate requests likewise flow to the Lead. Underwriters at co-insurers may be looped in but the Lead owns the decision.

## Key facts

- Category: Company. Role: Insurance Company.
- **Maximum of three** insurance companies per policy.
- Exactly **one** must be marked *Lead*.
- Each insurer is assigned a **percentage share**; shares must total exactly 100% across the row set.
- Configured on the policy at the Other Parties step.
- The insurer set is snapshotted onto the policy. Changing the Insurance Company record later (rename, address change) does not retroactively rewrite existing policies.

## Attributes specific to insurance companies

- **Registration name** — e.g. Allianz Cargo, GFH. Required. Prints on certificates.
- **Head-office address** — required. Prints on certificate headers for new policies.
- **Primary email** — for notifications and referral correspondence. Required.
- **Primary phone** — optional.
- **Tax / registration IDs** — recorded as applicable.

## Relationships an insurance company participates in

- **Underwrites** one or more policies via the Other Parties step. The policy names the insurer along with its share and Lead flag.
- **Parent of** one or more Insurance Groups, each containing Underwriter Person records. Direction: Insurance Group → Insurance Company (belongs-to).

## Underwriting users

Underwriters from the insurer are modelled as Person Business Partners with the Underwriter role, grouped into an Insurance Group that belongs to the Insurance Company. Their data scope is scoped to that Insurance Company — an Allianz underwriter cannot see referrals for a policy where Allianz is not a listed insurer.

## Adding an insurance company — step by step

1. From the Business Partners dashboard, click **Add**. Choose **Category = Company**.
2. Set the **registration name** (e.g. *Allianz Cargo*).
3. Add the **head-office address**. All address fields are required.
4. Add a **primary email** and, if known, a **phone**.
5. Attach the **Insurance Company** role.
6. Click **Save**.

Once saved, the company appears in the Insurance Companies dropdown on the policy wizard's Other Parties step. Underwriters for the insurer are then created as separate Person records in an Insurance Group belonging to the Insurance Company.

## Maintaining an insurance company

- **Renaming.** Updates new policies only. Existing policies keep their snapshot.
- **Deactivation.** Removes the insurer from the selection lists on the wizard but does not alter existing policies.
- **Address change.** Updates certificate headers on new policies only.

Never delete an Insurance Company that has been used on any policy. Deactivate instead.

## How the insurance company appears in dashboards, policies, and shipments

- **Business Partners dashboard.** Shows in the grid with its registration name and *Insurance Company* tag. Filtering by role = Insurance Company produces the list of insurers configured for the platform.
- **Policy wizard — Other Parties step.** Insurance Companies are picked from a dropdown here, along with their shares and Lead designation. The form blocks save if shares do not total 100% or if a Lead is not nominated.
- **Policy header.** The insurers and shares are shown on the policy summary.
- **Certificates.** The insurer name and address print on every certificate generated from the policy.
- **Referrals dashboard.** Underwriters see only referrals for policies where their Insurance Company is listed. Filtering by Insurance Company narrows the queue on the Backoffice side.
- **Special Rate Requests dashboard.** Special-rate requests inherit the insurer set from the policy. The Lead's underwriters decide.
- **Bordereau reports.** Monthly billing splits by insurer share where co-insurance is in use.

## Business rules & calculations

- **Share totals must equal 100%.** The form blocks save if the percentages do not add up. Adjust the existing rows before adding a fourth.
- **The three-insurer cap is enforced by the form.** If a policy needs more than three carriers, coordinate with an administrator — this is a platform-level constraint.
- **Exactly one insurer must be marked Lead.** The Lead is the one that owns referral decisions and special-rate approvals for the policy.
- **The Lead is not automatically the largest share.** The producer nominates the Lead explicitly on the wizard. In practice they are usually the same, but the form allows them to differ.
- **Insurers are snapshotted onto the policy.** Renaming or changing an Insurance Company later does not retroactively rewrite existing policies or certificates.
- **Underwriter data scope follows the Insurance Company.** An underwriter sees only referrals and special-rate requests for policies where their Insurance Company is listed. There is no cross-insurer visibility unless the underwriter is explicitly given a second role for the other insurer.

## Related concepts

- Business Partner
- Partner Type — Broker Companies
- Partner Type — Policyholders
- Partner Type — Surveyor Groups
- Referral Management
- Special Rate
