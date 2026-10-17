# Permissions Management

## What it is

Nacora enforces permissions at three layers: **navigation** (what menu items a user sees), **queryset filtering** (which policies and shipments they can list), and **object-level checks** (whether they can act on a specific record). All three read from the same source — the user's roles attached to their Business Partner record. There are no group permissions in the platform: permissioning is purely role-based.

Two things ultimately decide what a user sees and what they can do:

- **Their role** decides *what work they own*. It is attached to their Business Partner record and stays with them wherever they sign in.
- **Their portal** decides *where they do that work*. Participants use the Shipment Portal. Brokers, underwriters, and administrators use the Backoffice.

Put simply: **role = what you do, portal = where you do it.** The two are related but not the same. Roles are not per-portal; they are per-person. An underwriter who is also an administrator holds both roles, both give access in the Backoffice, and neither gives Shipment Portal access.

## Who uses it & where

- Every API endpoint runs a permission check on the caller's role list.
- The dashboard navigation only renders menu items linked to the user's roles.
- The admin queue and audit trail are visible only to Administrator roles.
- Underwriter-only actions (approve/decline a referral, decide a special rate request, override a premium) are visible only to Underwriter roles for the matching insurance company.
- Producer-only actions (create a policy, activate, endorse, cancel) are visible only to Producer roles within the appropriate Broker Company hierarchy.

## The two portals — where each role can sign in

The two interfaces share the same underlying platform — a shipment submitted from the Shipment Portal is immediately visible in the Backoffice — but the surfaces are tuned for different audiences and expose different controls.

|  | Shipment Portal | Backoffice (NacoraHub) |
|---|---|---|
| Who signs in | Participants — shippers, consignees, freight forwarders | Brokers/Producers, Underwriters, Administrators |
| Authentication | Passwordless: email OTP or Microsoft SSO | Microsoft SSO (recommended) or direct email and password |
| Submits shipments | Yes | Yes (brokers, on behalf of participants) |
| Books, amends, requests cancellation | Yes | Yes (brokers can endorse and cancel directly) |
| Reviews referrals and special-rate requests | No — receives notifications and responds when asked | Yes |
| Configures policies, master data, business rules | No | Yes |
| Audit visibility | Own activity only | Full audit across records accessible to the role |

## Roles vs. companies — a conceptual distinction

Two concepts sit alongside each other and are easy to confuse. Both matter and they answer different questions.

- **The Companies concept** — the structural tree of Business Partner records. Broker Companies, Policyholders, Participant Companies, Insurance Companies, Surveyor Groups. This decides *where* a user sits and therefore *what data they can see*.
- **The Roles concept** — the set of role tags attached to a person. Producer, Underwriter, Participant, Administrator, Company Admin, Organisation Admin, Named Assured. This decides *what a user can do* wherever they can see.

A user with the Underwriter role but no attached Insurance Company sees no referrals — they can sign in and the menu shows Referrals, but the queryset is empty. A user with a Participant Company but no Participant role signs in and sees an empty portal. Both pieces have to be right.

## The roles in detail

### Producer / Broker

- Signs in to the Backoffice.
- Designs cargo policies end-to-end using the policy wizard: general details, participant companies, other parties, billing, risks, quote document, certificate document, rating, clauses, business rules.
- Activates policies so participants can transact under them.
- Endorses policies when terms, parties, or coverage change mid-term.
- Cancels policies when the relationship ends.
- Submits shipments on behalf of participants who cannot or do not transact directly.
- Submits special-rate requests when standard rating does not fit a specific risk.
- Manages referrals assigned to them alongside the underwriting team.
- **Data scope:** sees only shipments and policies linked to their Broker Company (and its descendants).

### Underwriter

- Signs in to the Backoffice.
- Resolves referrals flagged by the rating engine or business rules — approves, declines, or sends back for more information.
- Reviews and adjusts premiums and clauses on individual shipments when standard rating needs an override.
- Approves or rejects special-rate requests raised by producers or participants.
- Calls out patterns — repeated referrals on the same risk usually mean a business rule needs to change.
- **Data scope:** sees only referrals and special-rate requests for policies where they are the lead insurer (or a listed insurer, depending on setup). Sees only shipments whose insurance-company attribute matches their own.

### Participant

- Signs in to the Shipment Portal.
- Quotes and books shipments under their company's active policies.
- Provides additional information when an underwriter or producer requests it.
- Endorses shipments when something changes — value, destination, conveyance, dates.
- Cancels shipments that no longer apply.
- Submits special-rate requests when a quoted price does not work for a specific movement.
- **Data scope:** sees only their own shipments. Even within the same Participant Company, one participant cannot see another participant's drafts.

### Administrator

- Signs in to the Backoffice.
- Maintains Business Partners — people, groups, and companies.
- Manages roles and access — who is allowed to do what, on whose behalf.
- Maintains choices and global libraries — clauses, commodity groups, conveyance modes, country lists, currencies.
- Reviews Pending Approvals — new Business Partner records waiting for cost-centre placement.
- Sets exchange rates.
- Deactivates (never deletes) partners that have been used on a policy.
- **Data scope:** unrestricted. Sees everything. Bypasses queryset filtering entirely.

### Company Admin

- Scoped admin variant. Manages users within their company only.
- Can approve pending users where the target company is their own.
- Cannot see or manage data outside their company.

### Organisation Admin

- Scoped admin variant. Manages users across an organisation (for example, across multiple brokers in a region).
- Can approve pending users at the organisation level.
- Broader scope than Company Admin, narrower than Administrator.

### Named Assured

- **Not a sign-in role.** A pure data marker used to record who is insured on a policy or shipment.
- A Person or Company can hold this role in addition to other roles.

### Surveyor (group-level)

- The Surveyors group is named on the policy and printed on certificates as the claims contact.
- Individual surveyors can be attached to the group as Person records.
- Surveyors do not typically sign into the platform for day-to-day operations — the group's contact details are what matter to the insured.

## How it works

1. When a user authenticates, their Business Partner record is loaded and their role list is stamped onto the request.
2. On every API request, before results are returned, a queryset filter narrows the results:
   - Producer sees shipments where the creator or the policy agent sits somewhere in the Broker Company's descendant tree.
   - Underwriter sees shipments whose insurance company matches their own.
   - Participant sees only shipments they personally created.
   - Administrator sees everything — no filtering.
3. For actions on a specific record (approve, edit, delete), an object-level permission check runs:
   - A referral can be viewed and answered by its creator (the broker) and by an Underwriter of the assigned insurance company.
   - A Special Rate Request can be edited by the requesting broker and by Underwriters of the underwriting company.
   - A policy can only be activated by a Producer in the relevant Broker Company.
4. Navigation is filtered at render time: the dashboard fetches only menu items linked to the current user's roles; anything they are not authorised to visit is not shown.
5. Group permissions are turned off globally. Nacora relies purely on the Roles concept — group memberships influence data scope (via the tree) but do not carry additional permission bits.

## How the interfaces combine in practice

The same record — a shipment, a referral — is visible in both interfaces, but each interface shows it differently. This is what makes broker-on-behalf-of-participant workflows possible.

- **Shipment Dashboard.** Participants see counter cards and a **Create Shipment** action; brokers see the full pipeline grid with assignment, filters, and export.
- **Shipment Details.** The Backoffice sees the **Update Premium & Clauses** action; participants do not.
- **Referrals Dashboard.** The Backoffice sees status tabs and assignment controls; participants see a list of their own referrals only.

## Deployment-specific role setup — KN Poland

The initial user roles and Business Rule permission set for the Kuehne+Nagel Poland deployment were configured as part of that market's go-live (from I2G-29831). The configuration covered:

- Roles for the KN Poland producer team, the KN Poland underwriter team, and the initial participant roster.
- Business Rule permissions defining who can create, edit, activate, and mark-complete rules on KN Poland policies.
- Cluster placement so that KN Poland sits inside the correct regional cluster for clause auto-assignment and analytics slicing.

This setup is the working template for onboarding subsequent Eastern-European markets (Bulgaria, Croatia, Hungary on the phase-two roadmap) — roles and Business Rule permissions are cloned from the Poland baseline and adjusted for the local team structure, rather than being designed from scratch each time.

## Business rules & calculations

- **Fallback role:** users with no role attached default to a limited read-only Prospect role. Effectively they see nothing operational.
- **Admin bypass:** an Administrator sees every list unfiltered and can act on every record. Use with restraint — the same power that makes cleanup possible makes accidents possible.
- **Report visibility:** most users see only reports assigned to them or their group; Administrators see all reports regardless of assignment.
- **No cross-broker data leakage:** the queryset filter is enforced before results reach the API layer, so it cannot be bypassed by tampering with URLs or query parameters.
- **Multiple roles are additive.** A person with Underwriter + Company Admin roles gets the union of both permission sets.
- **Reducing a role strips access on the next request.** This is not a delayed change; a user who loses the Underwriter role can no longer see the referrals dashboard the moment they refresh.

## Related concepts

- Business Partner
- Login
- Admin Queue & Approvals
- Roles and Portals
- First Day Guides
- Audit Trail
