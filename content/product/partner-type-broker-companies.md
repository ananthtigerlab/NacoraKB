# Partner Type — Broker Companies

## What it is

A **Broker Company** is the intermediary between insureds and insurers. In the platform, every cargo policy is tied to a Broker Company — the policyholder, participant companies, and underwriters all sit in relation to it. For most users the Broker Company is the top of the tree their daily work hangs off; producers, participants, and even the pending-approvals queue are ultimately anchored to a Broker Company.

Broker Companies are Nacora's regional entities. In the current MVP the parent broker company is **Nacora Austria**, which sits above KN Poland as the policyholder for the road-freight scope. The roadmap adds KN Bulgaria, KN Croatia, and KN Hungary as further policyholders under the same Nacora Austria broker.

## Who uses it & where

- **Administrators** create and maintain Broker Company records in the Backoffice. A broker company is one of the first records set up when the platform is spun up for a new regional deployment.
- **Producers / Brokers** — their own users belong to a Broker Company via the *belongs-to* relation. This is what places a producer in a Sales Unit and gives them visibility into the policies for that broker.
- **Underwriters** see policies filtered by broker company when scoping their referral queues.
- **Participants** never see the Broker Company directly, but their data scope is ultimately governed by which Broker Company sits at the top of their tree.

## Typical use in the platform

The Broker Company is the anchor of the entire operational tree. When a new region is being onboarded, the sequence is:

1. Create the Broker Company (for example, Nacora Austria).
2. Attach one or more Policyholders underneath it via *broker of* relations.
3. Attach one or more Participant Companies underneath either the Broker Company directly or the Policyholder, depending on the deployment.
4. Register the users — Producers as Person records belonging to a Sales Unit belonging to the Broker Company.
5. Configure the first policy in the wizard with the Broker Company selected on General Details.

Once that structure is in place, the day-to-day operational flow (participants booking shipments, referrals to underwriters, monthly bordereau) all reads from the tree that sits under the Broker Company.

## Key facts

- Category: Company. Role: Broker Company.
- Top of the partner tree for most users.
- Participant Companies sit beneath a Broker Company (either directly or via a Policyholder).
- Individual users (Producers) sit under a Sales Unit group which sits under the Broker Company.
- Selected **first** on the General Details step of the policy wizard. Every other dropdown on that step filters by the selected Broker Company.
- **Changing the broker mid-configuration cascades:** clears the policyholder, participant companies, coverages, commodity groups, and other parties, each with a confirmation. This is protective — every downstream choice depends on the broker.

## Attributes specific to broker companies

- **Registration name** — the official name (e.g. Nacora Polska, Nacora Austria). Required. Used as a search and reporting key downstream.
- **Head-office address** — required. Prints on new policy headers and certificates.
- **Primary email** — for notifications and correspondence. Required.
- **Primary phone** — optional.
- **Tax / registration IDs** — recorded as applicable.

## Relationships a broker company participates in

- **Parent of** one or more Policyholders, via *broker of* relations. Direction: Policyholder → Broker Company (the policyholder belongs to the broker in this reading; the broker acts as broker of the policyholder).
- **Parent of** one or more Participant Companies, via *belongs-to* relations. Direction: Participant Company → Broker Company. This is how the Participant Company is placed under the broker.
- **Parent of** one or more Sales Units (which contain Producers), via *belongs-to*.
- **Named on** every policy as the Broker Company for that policy. Selected first on the wizard's General Details step.

## Adding a broker company — step by step

1. From the Business Partners dashboard, click **Add**. Choose **Category = Company**.
2. Set the **registration name** (e.g. *Nacora Polska*).
3. Add the **head-office address**. All address fields are required.
4. Add a **primary email** and, if known, a **phone**.
5. Attach the **Broker Company** role.
6. Click **Save**.

Once saved, attach the associated Sales Units, Policyholders, and Participant Companies under it via relationships (typically *belongs-to*, direction from the child toward the Broker Company).

## Maintaining a broker company

- **Address change.** Affects new policy headers and certificates only. Existing policies keep their snapshot.
- **Deactivation.** Un-tick *Active*. This blocks new policies under the broker. Existing policies are untouched. Users under the broker can still resolve their historical shipments.
- **Renaming.** Safe between renewal periods. Avoid mid-renewal — the broker name is a common search and reporting key downstream and a change during renewal creates confusing intermediate states.

Never delete a Broker Company that has active or historical policies. Deactivate instead. Deletion cascades — a deleted Broker Company removes its Participant Companies and their users unless something else blocks the cascade.

## How the broker company appears in dashboards, policies, and shipments

- **Business Partners dashboard.** Shows in the grid with its registration name and *Broker Company* tag. Filtering by role = Broker Company produces the full list. From the row, an administrator can drill into the tree — Policyholders, Participant Companies, and users beneath.
- **Policy wizard — General Details.** The Broker Company is chosen first. Every other dropdown on the step filters by it.
- **Policy header.** The Broker Company name appears alongside the Policyholder on the policy header.
- **Shipments dashboard.** Filtering by Broker Company gives a broker-scoped view of the pipeline. Producers who belong to the Broker Company use this every day.
- **Referrals dashboard.** Filtering by Broker Company narrows the queue to a specific broker's exposure.
- **Bordereau reports.** Monthly billing is grouped by broker company at the top level before being subdivided by policyholder.

## Business rules & calculations

- **The Broker Company is the top of the operational tree.** Changes to it cascade downstream — this is why the wizard resets participant companies and policyholders when the broker is changed mid-configuration.
- **Do not rename a broker mid-renewal cycle.** The name is used as a search and reporting key. Renames are safer between renewal periods.
- **Deletion cascades.** Deleting a Broker Company removes its Participant Companies and users if no active policies block it. Always prefer deactivation.
- **Switching brokers on a policy resets downstream choices.** If you are configuring a new policy, set the broker first, then work through General Details top-to-bottom.
- **Data visibility follows the Broker Company tree.** Producers see only shipments where the creator or the policy agent sits somewhere inside the descendant tree. Cross-broker data leakage is impossible by design — the queryset filter is enforced before results reach the API.

## Related concepts

- Business Partner
- Partner Type — Policyholders
- Partner Type — Participant Companies
- Partner Type — Insurance Companies
- Organisation Tree
- Policy Creation
