# Organisation Tree

## The hierarchy

Nacora's contracts are organised in a strict company hierarchy. Each level plays a specific role in the commercial and operational flow, and each is expressed in the platform as a Business Partner record linked to the level above via a typed relationship.

```
Broker Company (Nacora regional entity — the MGA broker)
  └── Policyholder (K+N regional entity — Bill-to-Party)
        └── Participant Company (K+N logistics team — actually submits shipments)
              └── Participants (individual users at logistics teams)
```

The tree is walked in both directions. Given any partner, you can drill down (a Broker Company to its Policyholders to its Participant Companies to its users) or drill up (a user to their Participant Company to their Broker Company). Almost every meaningful visibility question — "who can see this policy?", "which broker is this user under?", "who owns this shipment?" — is answered by walking the tree.

## Concrete example (from the slides)

**Broker Company:** Nacora Austria (parent for the current MVP)

**Policyholder (Bill-to-Party):** KN Poland

**Participant Companies under KN Poland (from the slides — non-exhaustive):**
- Poznan Road Logistics
- Chorzow Road Logistics
- Warsaw Road Logistics
- Wroclaw Road Logistics
- Katowice Road Logistics
- Lodz Road Logistics
- Gdynia Road Logistics
- Rusocin Road Logistics
- Torun Road Logistics

Each participant company has its own participant users who log into the Shipment Portal.

## Expansion roadmap

The MVP is Nacora Austria → KN Poland (road-freight scope only). The KT session flagged the next geographies to onboard under Nacora Austria as parent:

- **KN Bulgaria**
- **KN Croatia**
- **KN Hungary**

Each will follow the same structure — a K+N regional entity as Policyholder, its logistics teams as Participant Companies.

External participants (freight forwarders such as DHL, DSV) may also participate under a policy — they are not K+N-internal but they can be onboarded as Participant Companies.

## What each level does

**Broker Company (Nacora regional entity)**
- Owns the master policy contract with the insurer.
- Configures the rating catalog, clause library, business rules, and document templates.
- Its users (Producers/Brokers) work in the Backoffice via SSO.
- Sits at the top of the tree for operational visibility. Producers see only shipments and policies inside their Broker Company's descendant tree.

**Policyholder (K+N regional entity, the Bill-to-Party)**
- Named on the Policy. Financial responsibility flows here — bordereaux and commission statements roll up at this level.
- Not usually a hands-on system user; the entity is the commercial anchor.
- Filtered by the chosen Broker Company on the policy wizard. Changing the broker mid-configuration clears the policyholder — the policyholder is always relative to a broker.

**Participant Company (K+N logistics team or external freight forwarder)**
- Attached to the Policyholder or Broker Company via a *belongs-to* relation.
- Each carries a cost-centre code (e.g. PLKTW for Kraków, PLPOZ for Poznań) that is matched against PDM at SSO sign-in time.
- Its staff quote and book the actual shipments in the Shipment Portal.
- **Data isolation is strict** — a participant sees only shipments belonging to their own company. Cross-company visibility is not permitted, even within the same policyholder.

**Participants (individual users)**
- Log in via OTP (external non-K+N staff) or SSO (K+N staff).
- Bound to a specific Participant Company via cost-centre / directory lookup on first sign-in.
- Book shipments day-to-day; do not touch policies or clauses.
- Within a Participant Company, still see only shipments they personally created — one participant does not see another participant's drafts.

## Relationships — how the tree is wired

The tree is not a fixed schema; it is a graph of typed relationships between Business Partner records. Each relationship links two partners and gives the link a **relation type**. Direction matters — *belongs to* is Person → Company or Child → Parent, and reversing it produces a different (and usually meaningless) link.

The common relation types used in the tree:

| Relation type | Meaning | Typical direction |
|---|---|---|
| **Belongs to** | Hierarchical link inside the tree. | Child → Parent (Participant Company → Broker Company, Person → Participant Company) |
| **Broker of** | A Person or Company acting as broker for an insured party. | Broker Company → Policyholder |
| **Policy holder** | Links a policy to the Person or Company that owns it. | Policy → Policyholder |
| **Represents** | An agent or delegate of another Business Partner. Used for external consultants or delegated roles. | Delegate → Principal |

Relationships have concrete implications:

- **Removing a relation does not delete either partner.** Both stay on record; only the link is gone. This is how a user is moved from one Participant Company to another — delete the old *belongs-to*, add a new one.
- **Both partners must exist before a relation can be saved.** Companies and groups are created first; the Person records that link into them come afterwards.
- **Deletion of a partner cascades down the tree.** Deleting a Broker Company can silently remove its Participant Companies and their users if nothing blocks the cascade. Always prefer deactivation.
- **For SSO participants, the Pending Approvals flow is the preferred path** for creating relations. It attaches the right relation under the right cost centre automatically. Manual relations are for non-SSO exceptions and data fixes.
- **Both directions are navigable.** From a Broker Company you can see its Policyholders, its Participant Companies, and its users. From a user you can walk back up to their Participant Company and to the Broker Company at the top.

## Insurance side — sitting alongside the tree

Sitting alongside the Broker / Policyholder / Participant tree is the **Insurance Company** — one of two underwriters:

- **GFH** — Nacora's in-house underwriting agency (for Nacora-branded policies).
- **Allianz Global Risks US** — third-party underwriter (for non-Nacora-branded policies).

Underwriter users:
- Approve or decline referrals raised by business rules.
- Set and manage Special Rate Requests.
- Have data visibility scoped to their Insurance Company — they see only referrals and special-rate requests for policies where their Insurance Company is a listed insurer.

**Lead Insurer** concept: a policy can have up to three insurers with shares totalling exactly 100%. Exactly one of them must be marked Lead. The Lead is who owns referral decisions and special-rate approvals for the policy. Nomination is explicit — the Lead is not automatically the largest share, though in practice they usually are.

## Surveyor side — a small but load-bearing sibling

Every policy also names a **Surveyor Group** at the Other Parties step. This is the group whose contact details print on the certificate as the claims contact. There is one primary and, optionally, one secondary surveyor group. Surveyors do not typically sign into the platform for operational work — the group's contact information is what matters to the insured when a claim is opened.

## How the tree drives visibility

The tree is what makes data isolation possible. Every list of policies, shipments, referrals, or special rates is filtered before it reaches the API layer, based on the calling user's roles and their position in the tree:

- **Producers / Brokers** see shipments and policies where the creator or the policy agent sits somewhere inside their Broker Company's descendant tree.
- **Underwriters** see referrals and special-rate requests only for policies where their Insurance Company is listed.
- **Participants** see only their own shipments.
- **Administrators** bypass filtering and see everything.

The tree also drives cost-centre routing at sign-in. A K+N staff member signing in via SSO has their PDM identifier resolved to a cost centre, and the cost centre is matched against a Participant Company. The user is then attached under that Participant Company automatically. If the resolution fails (unmapped cost centre, missing PDM record), the user lands in Pending Approvals and an administrator places them by hand.

## Related concepts

- Client Overview
- How They Operate
- Insurer Relationships
- Cluster & Regional Structure
- Key People & Contacts
- Delivery Scope & Roadmap
- Business Partner (Product space)
- Partner Type — Broker Companies (Product space)
- Partner Type — Policyholders (Product space)
- Partner Type — Participant Companies (Product space)
- Partner Type — Insurance Companies (Product space)
- Partner Type — Surveyor Groups (Product space)
- Permissions Management (Product space)
- Login (Product space)
- Admin Queue & Approvals (Product space)
