# Business Partner

## What it is

A **Business Partner** is any person, group, or company Nacora needs to know about. Every policy, every shipment, every premium, every clause, every referral, every certificate, every audit line — all of it hangs off Business Partners. There is no separate "user account" concept: a user *is* a Business Partner with a set of roles attached to it. There is no separate "customer" concept either: a policyholder is a Business Partner with a Policyholder role. The model is deliberately unified so that the same person can carry multiple hats (an underwriter who is also an administrator, a producer who is also a Named Assured on some other policy) without needing multiple identities.

The model is hierarchical and role-driven. Every Business Partner is placed in exactly one **category** — Person, Group, or Company — and carries one or more **roles** which describe what it does. Roles are attached to the record and stay with the person or entity wherever they operate; categories are structural.

## Who uses it & where

- **Broker Company (Producer role):** creates policies, adds participant companies, sees all shipments across their broker cluster. Works in the Backoffice.
- **Participant Company staff (Participant role):** quotes and books shipments under their broker's policy. Works in the Shipment Portal.
- **Insurance Company (Underwriter role):** reviews shipments, approves special rates, manages referrals. Works in the Backoffice.
- **Policyholder:** the named entity on the policy contract (usually a Company; occasionally a Person for individual insureds).
- **Named Assured:** the specific party being insured on a shipment or policy — a data marker only, not a sign-in role.
- **Surveyors:** the group named on the certificate for claims contact.
- **Administrator, Company Admin, Organisation Admin:** approve pending users, maintain master data, manage the platform.

Administrators are the primary stewards of Business Partner records. Producers and underwriters read partner data constantly but rarely edit it; participants never edit partner data.

## The three categories

Every Business Partner belongs to exactly **one** of three categories. The category is the structural bucket; the roles then describe what the partner does inside that bucket.

| Category | Examples | Notes |
|---|---|---|
| **Person** | Producers, Underwriters, Participants, Administrators, Named Assureds | A human user. Has first name and last name, one or more emails, one or more phones, one or more addresses. Sign-in identities are always Person records. |
| **Group** | Sales Unit, Participant Group, Insurance Group, Admin Group, Surveyor Group | A bundle of people or sub-organisations. Used to grant role-based permissions at group level and to model containers such as an underwriting team or a surveyor bureau. |
| **Company** | Broker Company, Policyholder, Participant Company, Insurance Company | A legal entity. Has a registration name, one or more addresses, tax or registration identifiers. |

A Person can carry more than one role — an underwriter who is also an administrator is a normal pattern, and a producer who is also listed as a Named Assured on a personal policy is fine.

## The roles

A Business Partner has one or more roles attached. Each role declares which categories it applies to and unlocks different parts of the system.

| Role | Applies to | What it lets the partner do |
|---|---|---|
| **Producer** | Person | Build and edit policies, submit shipments on behalf of participants, submit special rate requests, endorse and cancel policies. |
| **Underwriter** | Person | Review and resolve referrals, override premiums and clauses on shipments, approve or decline special rate requests. |
| **Participant** | Person | Sign in to the Shipment Portal, create, quote, book, endorse, and cancel shipments under the Participant Company they belong to. |
| **Named Assured** | Person or Company | Recorded on a policy or shipment as an insured party. Not a sign-in role. |
| **Administrator** | Person | Full access to all admin pages including Pending Approvals, master data, global clauses, choices, business rules, exchange rates. |
| **Company Admin** | Person | Admin scoped to a single company. Can approve pending users in that company only. |
| **Organisation Admin** | Person | Admin scoped across an organisation — for example, across multiple brokers in a region. Can approve pending users at the organisation level. |
| **Sales Unit** | Group | Container for producers. Owns policies created by its members. |
| **Insurance Group** | Group | Container for underwriters of a given insurer. |
| **Admin Group** | Group | Container for administrators. |
| **Participant Group** | Group | Container for participants, used for cross-cutting access such as a regional team. |
| **Surveyors** | Group | The group named on a policy for cargo inspection and claims handling. |
| **Broker Company** | Company | Acts as the broker on policies. Sits at the top of the operational tree. |
| **Policyholder** | Company (or Person for individual insureds) | Owns a policy — the named entity on the contract. |
| **Participant Company** | Company | Operates under a policy. Typically a regional branch or affiliate. Sits beneath a Broker Company and holds Person BPs as members. |
| **Insurance Company** | Company | Underwrites policies. Up to three per policy with a mandatory Lead designation and shares totalling 100%. |

## Attributes

Each role can carry **typed attributes** — key/value pairs configured by an administrator. Attributes appear as extra form fields on the partner detail page once a role that uses them is attached. Common examples:

- **Nature of business** on a Policyholder (Shipper/Consignee, Freight Forwarder) — drives commodity-group handling in the policy wizard.
- **Cost-centre code** on a Participant Company (e.g. PLKTW for Kraków, PLPOZ for Poznań) — matched against PDM mappings to route SSO sign-ins.
- **Correspondence language**, **preferred channel**, **vulnerable-customer flag** on Person records — surfaced on generated documents and used for notification routing.

Attributes are extensible: administrators can add new attributes over time without needing a platform release, provided the underlying data type is supported.

## Relationships as a first-class concept

A **relationship** links two Business Partners and gives the link a meaning called the *relation type*. Almost every meaningful question about who can see what — "which broker is this user under?", "who owns this policy?", "who can this underwriter see?" — is answered by walking the relationship graph.

Relationships have a **direction**: *Business Partner from* → *Business Partner to*. Direction matters. *Belongs to* is typically Person → Company; reversing it produces a different (and usually meaningless) link. If you get the direction wrong, the shipment does not pass validation, or the user signs in and sees nothing.

The full list of relation types is configured by administrators and can grow as new arrangements need to be modelled. The common types used across the cargo product:

| Relation type | Meaning |
|---|---|
| **Policy holder** | Links a policy to the Person or Company that owns it. |
| **Belongs to** | Hierarchical link inside the partner tree — for example, a Participant Company belongs to a Broker Company, a Person belongs to a Participant Company. |
| **Broker of** | A Person or Company acting as broker for an insured party. |
| **Represents** | An agent or delegate of another Business Partner — used for external consultants or delegated roles. |

Both partners must exist before a relation can be saved. Companies and groups have to be created first; the Person records that link into them come afterwards.

Removing a relation does not delete either partner — the partners stay on record, only the link disappears. That is how a user is moved from one participant company to another: delete the old *belongs-to* relation, add the new one. Deleting a partner, however, does cascade down the tree: deleting a Broker Company removes its Participant Companies and their users unless something else blocks it. Deactivation is nearly always preferred.

For SSO participants, the Pending Approvals flow is the recommended path — it creates the right relations automatically and places the user under the correct cost centre. Manual relations bypass that and can leave the user under the wrong parent.

## How it works

1. A person signs in for the first time via SSO. The platform resolves their PDM identifier and cost centre and creates or updates the matching Person Business Partner record, attaching a Participant role and a *belongs-to* relation into the correct Participant Company.
2. Each Business Partner is linked to companies and groups via relationships. A Producer belongs to a Sales Unit and to a Broker Company; a Participant belongs to a Participant Group and to a Participant Company, which itself belongs to a Broker Company; an Underwriter belongs to an Insurance Group and to an Insurance Company.
3. Any list of policies, shipments, or referrals is filtered on the way out based on the calling user's roles and relations. There is no cross-broker data leakage because filtering happens before results reach the API layer.
4. Data visibility is scoped along the company tree:
   - A Producer sees shipments where either the creator or the policy agent sits anywhere inside their Broker Company hierarchy.
   - An Underwriter sees only shipments whose insurance company matches their own.
   - A Participant sees only shipments they personally created — even within the same Participant Company, one participant cannot see another participant's drafts.
   - An Administrator bypasses all filters and sees everything.
5. Menu items are also role-aware: the sidebar only renders links the user's role list authorises.
6. Every reference to a Business Partner from a policy or shipment is a snapshot at the moment of use. Editing a partner later — renaming, changing address — does not retroactively rewrite the existing policies or certificates. New policies and certificates pick up the new value.

## Adding a Business Partner — step by step

This flow is how new brokers, policyholders, participant companies, insurance companies, surveyor groups, and non-SSO users get into the system. For SSO participants, do **not** create the person manually — let them sign in, land in Pending Approvals, and be placed there.

Before you start, check that the partner does not already exist — the most common cause of duplicate records is skipping this check. For a Person, decide which group and company they should fall under; that is what places them in the hierarchy and decides what they see when they sign in. For a Company or Group, save it before you create any people underneath it, because relationship forms require both partners to exist.

1. Sign in to the Backoffice and open the **Business Partners** dashboard.
2. **Search first.** Use name, registration number, or email to make sure the partner does not already exist.
3. Click **Add** at the top right of the grid.
4. Choose the **Category** — Person, Group, or Company.
5. Fill in the **identity fields**:
   - *Person* — first name, last name, primary email.
   - *Group* — name, optional contact email.
   - *Company* — registration name, primary email, tax or registration IDs.
6. Add at least one **address** and mark the primary correspondence address. All address fields (line 1, postal code, city, state, country) are required whenever the partner is referenced from a policy.
7. Optionally add **phone numbers** — home, mobile, work, fax.
8. Attach the applicable **roles**.
9. If the partner is a Person, **link them to their company** using a relationship. Direction matters — *belongs to* is Person → Company.
10. Click **Save**.

The minimum required by partner type:

| Type | Minimum required |
|---|---|
| Broker Company | Registration name, address, Broker Company role, Cluster selection. |
| Policyholder | Registration name (becomes the official name on the policy), address, Policyholder role. |
| Participant Company | Registration name, address, Participant Company role, parent Broker Company relation. |
| Insurance Company | Registration name, address, Insurance Company role. |
| Surveyor Group | Name, Surveyors role. |
| Producer (Person) | Name, email, Producer role, Sales Unit group, Broker Company. |
| Underwriter (Person) | Name, email, Underwriter role, Insurance Group, Insurance Company. |
| Participant (Person) | Name, email, Participant role, Participant Group, Participant Company. |
| Administrator (Person) | Name, email, Administrator (or Company Admin / Organisation Admin) role, Admin Group. |

**Cluster on Broker Company creation.** The Broker Company creation form now includes a **Cluster** selection (from I2G-29838). The Cluster is the regional or business grouping the broker belongs to — for example, an EMEIA cluster or an APAC cluster — and it drives cluster-level clause auto-assignment (see the Clauses page) as well as cluster-scoped visibility on the analytics side. See Cluster-Level Configuration for how clusters are configured centrally and what they unlock across the platform.

Once saved, the partner is immediately available across the platform — searchable in dashboards, eligible for policies and shipments, and navigable from either side of any relationship.

## Maintaining a Business Partner — the day-to-day work

Maintenance is the ongoing work of keeping the record accurate as the real world changes — a company renames, a user moves between companies, a contact leaves. Done well it preserves history and access for everyone downstream. Done carelessly it silently breaks sign-ins or rewrites a partner's name on records that should stay frozen.

Before touching anything, decide **deactivate vs. delete**. The safe default for any partner that has touched a policy or shipment is deactivate. For role changes, coordinate with the user — removing a role strips their access immediately and they should not find out by being locked out. For company or cost-centre moves, know the target before you start; half-moved users are awkward to clean up.

### Editing identity, roles, or addresses

1. Open the Business Partners dashboard.
2. Use the search bar at the top (email, registration name, or first / last name) or the filter panel (by role, category, or active status).
3. Click the row to open the detail view.
4. Make changes in the relevant section:
   - **Identity** — names, emails, phones.
   - **Roles** — add or remove. Reducing roles immediately strips access; warn the user first.
   - **Addresses** — add a new one, promote it to primary, unset the old one.
   - **Attributes** — role-specific extras such as correspondence language or vulnerable-customer flag.
5. Click **Save**.

### Moving a user between companies

1. Open the user (Person Business Partner).
2. Open the **Relations** section.
3. Find the *belongs-to* relation pointing at the old company. Delete it.
4. Create a new relation: from the user, type *belongs to*, to the new company.
5. If the user is in a group that is also moving (for example, they shift from one Participant Group to another), update that relation too.
6. Click **Save**.

The user sees the new company's data scope on their next page load.

### Adding a user to a company (post-hoc)

1. Open the user's record.
2. Open the **Relations** section.
3. Click **Add relation**.
4. Set: *Business partner from* = the Person; *Relation type* = typically *belongs to*; *Business partner to* = the Company.
5. Click **Save**.

For SSO participants, prefer the Pending Approvals flow to this manual approach — the approvals flow attaches the right relation under the right cost centre automatically.

### Bulk changes

The Business Partners grid supports bulk selection via row checkboxes. Available bulk actions include activate, deactivate, and export to CSV. For larger imports — for example, an annual broker refresh — an administrator can run a one-off data import rather than keying the records in by hand.

### Notes on the record

Free-text notes can be added to any Business Partner record. They are audit-visible and stay with the partner across changes — useful for capturing "renamed on 12 March 2026 from Old Ltd to New GmbH; existing policies retain old name" kinds of context.

### Deactivate vs. delete — the golden rule

The platform preserves history wherever a partner is referenced by a policy or a shipment. Because of that:

- **Deactivate** (un-tick *Active*) is almost always the right choice for people who leave. They can no longer sign in, but historical shipments and policies still resolve their name correctly.
- **Delete** should only be used for partners with no references — usually test data. Deleting a partner that owns active records is refused. Deleting a parent in the hierarchy cascades to its children unless something blocks it.

Deletion cascades down the tree — deleting a Broker Company removes its Participant Companies and their users if no active policies block it. Always prefer deactivation.

## Business rules & calculations

- **Excluded from admin creation forms:** Policyholder, Contact Person, and Insured Object roles cannot be created through the standalone Business Partner form. They are always attached from another record (a policy or a shipment).
- **Excluded from partner listings:** the same set is hidden from the partners API so the list stays short and manageable.
- **Role-relation mapping is enforced:** the platform requires that a Participant Company relates to a Policyholder as `POLICY_HOLDER` in the "to" direction. Get the direction wrong and the shipment fails validation.
- **Report bypass:** an Administrator sees every report unfiltered, regardless of the assigned-to field. Everyone else sees only reports assigned to them or their group.
- **Snapshots, not live links.** When a policy is configured, the policyholder's name and address are snapshotted onto the policy. Editing the record later does not retroactively rewrite the existing policy or its certificates.
- **Renaming a company is safe but not retroactive.** New policies and certificates use the updated name; existing policies keep the name from when they were configured.
- **Reducing roles strips access immediately.** This is not a delayed change. Coordinate with the user before saving in production.
- **Deletion cascades down the tree.** Use deactivation instead.
- **A person can hold multiple roles.** An underwriter who is also a company admin is a normal, supported pattern.
- **Both partners must exist before a relation can be saved.** Save companies and groups first, then the people who link into them.

## Related concepts

- Login
- Permissions Management
- Admin Queue & Approvals
- Organisation Tree
- Roles and Portals
- First Day Guides
- Cluster-Level Configuration
