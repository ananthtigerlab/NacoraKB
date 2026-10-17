# Partner Type — Participant Companies

## What it is

A **Participant Company** is an organisational unit that operates under a Broker Company or Policyholder — typically a regional office or an affiliated branch. Each Participant Company is mapped to a **cost centre** (for example, PLKTW for Kraków, PLPOZ for Poznań, and similar codes for Warsaw, Wroclaw, Chorzow, Lodz, Gdynia, Rusocin, and Torun in the current MVP for KN Poland). It is also the entity that participants sit under, so the Participant Company decides what data a participant can see when they sign in.

Participant Companies play a dual role and it is important to hold both in mind at the same time — they are both a container for people and a listed party on a policy.

## Two distinct uses

The same Participant Company serves two related purposes:

- **As a cost-centre container** — the home of Person Business Partners with the Participant role. This is what places a user into a company on sign-in and what governs their data scope in the Shipment Portal.
- **As an entry on a policy** — listed on the policy's Participant Companies step to indicate the company is covered under the policy. Only users belonging to a listed Participant Company can book shipments under that policy.

The two uses are related but not identical. A Participant Company can exist as a container before a policy lists it; a Participant Company can also be listed on a policy without necessarily having users attached (rare — usually happens transiently during onboarding).

## Who uses it & where

- **Administrators** create and maintain Participant Company records in the Backoffice. They also coordinate with the team that maintains PDM to ensure the cost-centre code is mapped so that SSO sign-ins auto-route through Pending Approvals cleanly.
- **Producers / Brokers** select Participant Companies on the policy wizard's Participant Companies step. Every Participant Company listed on the policy becomes a legitimate booking party.
- **Participants** belong to a Participant Company via a *belongs-to* relation. Their data scope is defined by it — they see only shipments belonging to their Participant Company (and, within that, only shipments they personally created).
- **Underwriters** read the Participant Company on every shipment and referral to understand which regional team is transacting.

## Typical use in the platform

In the current MVP, the layout under KN Poland is a set of Road Logistics teams: Poznan, Chorzow, Warsaw, Wroclaw, Katowice, Lodz, Gdynia, Rusocin, and Torun. Each is a Participant Company. Each has its own cost-centre code that maps to PDM. Each employs one or more participants who sign in to the Shipment Portal.

When a KN Poland Road Logistics staff member signs in via SSO for the first time:

1. Their identity resolves through the K+N identity provider.
2. The platform pulls their PDM identifier and looks up their cost centre.
3. If the cost centre matches a Participant Company that has a valid PDM mapping, the user is attached under that company automatically.
4. From that point onwards, when they open the Shipment Dashboard, they see only shipments that belong to their Participant Company — and within that, only their own.

External participants (freight forwarders such as DHL or DSV) may also be onboarded as Participant Companies. They are not K+N-internal but they can transact under a Nacora policy, provided the policy lists their company on the Participant Companies step.

## Key facts

- Category: Company. Role: Participant Company.
- Has a **cost-centre code** attribute (e.g. PLKTW). The code is matched against PDM mappings maintained by administrators.
- Sits beneath a Broker Company in the partner tree (either directly or via a Policyholder, depending on the deployment).
- All participants at a Participant Company inherit that company's data scope.
- **Data isolation is strict.** A participant sees only shipments belonging to their own Participant Company. Cross-company visibility is not permitted, even within the same policyholder.

## Attributes specific to participant companies

- **Registration name** — e.g. Nacora Polska Kraków, Warsaw Road Logistics. Required.
- **Address** — required.
- **Cost-centre code** — e.g. PLKTW, PLPOZ. Required. Mapped against PDM so that SSO sign-ins from this cost centre route through Pending Approvals cleanly and end up placed here.
- **Parent Broker Company or Policyholder** — set via a *belongs-to* relation.

## Relationships a participant company participates in

- **Belongs to** a Broker Company (or a Policyholder that itself belongs to a Broker Company). Direction: Participant Company → Broker Company.
- **Parent of** its member Persons, who each carry the Participant role. Direction: Person → Participant Company (belongs-to).
- **Listed on** one or more policies via the policy's Participant Companies step.

## Adding a participant company — step by step

1. From the Business Partners dashboard, click **Add**. Choose **Category = Company**.
2. Set the **registration name** (e.g. *Nacora Polska Kraków*).
3. Add an **address**.
4. Attach the **Participant Company** role.
5. Set the **cost-centre code** attribute (e.g. PLKTW).
6. Add a relation: from this company, type *belongs to*, to the parent Broker Company (or Policyholder if that is the model your deployment uses).
7. Ask an administrator to add the corresponding PDM mapping so that users of this cost centre auto-route through the pending-approvals queue.
8. Click **Save**.

Once saved, the Participant Company is available on the policy wizard's Participant Companies step.

## Onboarding new users under a participant company

In normal operation, new users at a Participant Company are **auto-provisioned by SSO** and routed through Pending Approvals. That is the preferred path — it creates the right relations automatically and places the user under the correct cost centre.

Create users manually only for non-SSO exceptions (external freight forwarders whose corporate identity is not federated, or one-off contractors). For those:

1. Create a Person Business Partner.
2. Attach the Participant role.
3. Link the person to the Participant Company via *belongs-to*.
4. Add them to a Participant Group if the deployment uses one.
5. Save.

## Maintaining a participant company

- **Renaming.** Safe — does not affect users or historical policies. New certificates use the new name; existing certificates keep the snapshot.
- **Cost-centre code change.** Rare and risky. Coordinate with the team that maintains PDM before doing it. An out-of-sync code blocks every new SSO sign-in from that company.
- **Moving users out.** For each user, delete the old *belongs-to* relation and add a new one pointing at the new company.
- **Deactivation.** Prevents new sign-ins from resolving into this company, but keeps historical shipment access valid.

Never delete a Participant Company that has any historical shipments. Deactivate instead.

## How the participant company appears in dashboards, policies, and shipments

- **Business Partners dashboard.** Shows in the grid with its registration name, cost-centre code, and *Participant Company* tag. From the row, an administrator can see all Person Business Partners belonging to it.
- **Policy wizard — Participant Companies step.** Every Participant Company listed on the policy is a legitimate booking party. Adding or removing a Participant Company on an active policy is typically done via an MTA endorsement.
- **Shipments dashboard.** Every shipment carries its Participant Company. Filtering by Participant Company gives a company-scoped view of the pipeline — useful for brokers monitoring a specific regional team.
- **Referrals and Special Rates.** Referrals and special-rate requests inherit the Participant Company from the shipment. Underwriters filter by Participant Company to see which regional team is generating exposure.
- **Pending Approvals.** New SSO sign-ins whose cost centre cannot be resolved to a live Participant Company end up in this queue. The queue row shows the inferred cost centre and the failure reason so the administrator can act.
- **Bordereau reports.** Monthly billing is subdivided by Participant Company under each policyholder.

## Business rules & calculations

- **A Person Business Partner with no Participant Company parent will sign in but see no data.** The Pending Approvals workflow exists to catch exactly this — do not work around it with manual relations. Manual bypass can leave the user under the wrong parent.
- **Cost-centre code changes ripple to PDM.** Coordinate with the PDM maintainer before changing the code — an out-of-sync code will block every new sign-in from that company.
- **Data isolation is enforced at the queryset level.** A participant at Warsaw Road Logistics cannot see shipments belonging to Kraków Road Logistics under any circumstances, even if URL parameters are manipulated.
- **Within a Participant Company, participants still cannot see each other's shipments.** The queryset filter narrows further — a participant sees only shipments they personally created.
- **A shipment must belong to a Participant Company listed on the policy.** If the participant's company is not on the policy's Participant Companies step, they cannot even see the policy in the shipment-creation dialog.
- **A Participant Company can be listed on multiple policies.** For example, Warsaw Road Logistics may transact under one policy for road freight and a separate policy for air freight if a future scope adds it.

## Related concepts

- Business Partner
- Partner Type — Policyholders
- Partner Type — Broker Companies
- Admin Queue & Approvals
- Organisation Tree
- Shipment Portal
