# Clauses

## What it is

A **clause** is a piece of insurance wording that can be attached to policies or shipments, and rendered on Quote documents, Certificate documents, and the Insuring Conditions Page. Clauses are how the platform expresses the actual insurance contract language — Institute Cargo Clauses A, B, and C; general exclusions; war and strikes clauses; sanctions wording; commodity-specific amendments; broker-specific overrides.

NacoraHub Embedded Cargo maintains clauses in three layers:

- **Global clauses** live in the central Global Clauses Library, administered by Administrators only. They are the reusable pool of standard wording that any policy can pull from — Institute Clauses, sanctions clauses, payment terms, and similar boilerplate.
- **Cluster-level clauses** are scoped to a Cluster — a regional or business grouping that spans multiple policies (from I2G-29837). Clauses managed at cluster scope can auto-assign themselves to every policy in the cluster on policy creation, which is how a region-wide clause set (say, an EMEIA sanctions rider) gets onto every new policy without the broker having to remember to import it. See Cluster-Level Configuration.
- **Policy clauses** are scoped to a single policy version. They can either be imported copies of global clauses, copies of cluster-level clauses, or fully custom clauses created directly on the policy for one-off wording.

All three layers share the same authoring experience and the same details view. The differences are scope (many policies vs a cluster of policies vs one policy), access (admins only for global; admins and cluster administrators for cluster; anyone with policy access for policy-level), and lineage (an imported global or cluster clause carries a link back to its source until edited).

**Cluster auto-assignment toggle.** Each policy has a toggle that controls whether cluster-specific clauses auto-assign on policy creation. Turning the toggle off is how a broker onboards a policy that sits inside a cluster but should not inherit the cluster's default clause set. In the same panel the Global Clauses Library visibility can be restricted per cluster — a cluster can opt to hide certain global clauses from its policies during import, so brokers on that cluster see a curated subset rather than the full global list (from I2G-29921).

Clauses are not applied to shipments automatically. Adding a clause to a policy only makes the wording *available*. Attaching it to a shipment happens through **Business Rules** — a rule evaluates shipment conditions, and when they match, the rule attaches the specified clauses to the shipment. This design lets a single policy apply different clauses to different shipments based on the actual cargo profile.

## Who uses it & where

- **Administrators** create, update, version, duplicate, activate, and deactivate global clauses in the Global Clauses Library.
- **Administrators and Brokers** configure policy-level clauses — importing from the global library or creating custom ones — during policy setup and afterwards from the policy's actions menu.
- **Participants** have no access to the Global Clauses Library. They see clause outputs on the quote and certificate documents but do not manage the wording.
- **Business Rules** attach clauses to individual shipments based on the shipment's attributes.
- **The document generator** reads the attached clauses to render Quote and Certificate PDFs and to populate the Insuring Conditions Page.

The Global Clauses Library is reached from the Main Navigation Menu under **Settings → Global Clauses**. Policy Clauses Setup is reached either from the policy creation form (Step 9, "Clauses"), which opens the Clauses page in a new tab via **Set Up Clauses**, or from the Incomplete Policy 360 page by clicking the Actions Menu and selecting **Manage Clauses**.

## How it works

### The Global Clauses Library

The Global Clauses Library is the central repository of reusable insurance wording. It supports:

- Standardised clause wording across policies.
- Reusability of common insurance clauses.
- Centralised clause management by Administrators.
- Version control for wording updates.
- Search and filtering by category, insurer, cluster, tags, and status.

Global clauses can be imported into policy-level clause setup by Administrators and Brokers during policy configuration. Global clauses cannot be deleted — they can only be deactivated. This is deliberate: a deleted global clause could break historical documents that reference it, whereas deactivation preserves the record and simply hides it from future selection.

**The Global Clauses Overview page** displays every clause created in the library. Each row shows:

| Column | Meaning |
| --- | --- |
| **Title** | Clause title shown to users during selection. |
| **Description** | Internal summary of the clause. |
| **Category** | Classification used for filtering and organisation. |
| **Insurer** | Insurance company linked to the clause. |
| **Cluster** | Regional or business grouping. |
| **Tags** | Additional labels used for search and filtering. |
| **Status** | Draft, Active, or Inactive. |
| **Actions** | Duplicate, Create new version, Activate, Deactivate. |

Keyword search and filters make it possible to narrow the list quickly by category, tags, insurer, cluster, or status.

### Creating a global clause

Only Administrators can create clauses in the Global Clauses Library. To create one:

- Go to **Settings → Global Clauses**.
- Click **Create Clause**.
- Complete the clause details.
- Enter the clause wording.
- Save the clause.

The clause detail form has three sections.

**General section.** This is metadata used for organisation, filtering, and search. It does not affect pricing, rating, referrals, or business rule logic — it only controls how the clause is found and grouped.

| Field | Required | Description |
| --- | --- | --- |
| **Title** | Yes | The clause name shown in clause lists and selection screens. |
| **Description** | No | Internal summary of the clause. |
| **Category** | Yes | Multi-select field used to classify the clause. Examples: Commodity Group, Conveyance, Insured Value, Packing, Coverages. |
| **Insurer** | Yes | The insurance company linked to the clause, sourced from the Business Partners records with the Insurance Company role. |
| **Cluster** | No | Regional or business grouping used for filtering. Examples: Hong Kong (APAC), BENELUX (EMEIA), Iberian (EMEIA), Middle East (EMEIA), Nordic (EMEIA), Northern (LATAM), Southern (LATAM), AT/EE (EMEIA). |
| **Tags** | No | Additional labels used for search and filtering. |

**Clause options.** Two toggles:

- **Is a Nested Clause** — when enabled, the clause is treated as nested. In documents, its title is hidden and the full wording is displayed directly.
- **Active** — when enabled, the clause is available for policy-level selection. When disabled, it stays stored in the library but is hidden from selection.

**Clause wording.** The editor supports bold and italic text, ordered and unordered lists, copy-paste from external sources, and undo / redo. This is the actual contract language that will appear on documents.

**PDF upload for wording.** As an alternative to pasting or typing the wording, the clause form accepts a **PDF upload** (from I2G-29881). The system extracts the text from the uploaded PDF and pre-populates the wording field, which the administrator can then edit as needed. This is a big time-saver for existing clause libraries that live as PDFs today — an administrator can seed the platform with the current wording without retyping every clause.

After completing the details, click **Save & Exit** to persist the clause, or **Cancel** to discard. Once active, the clause becomes available for Administrators and Brokers to import into policy-level clause setup.

### Managing global clauses

From the Actions Menu on the Global Clauses Overview page, an Administrator can duplicate a clause, create a new version of it, activate it, or deactivate it.

**Duplicating a global clause** creates a new global clause by copying every detail from the source. The duplicate is independent — changes to it do not affect the original. Common reasons to duplicate: a similar clause is needed for another insurer, a regional variation is required, or the wording should serve as a starting point for something new.

**Global clause versioning.** When the wording of an existing global clause needs to be updated, an Administrator creates a new version. A new version can update the title, the wording, or both. The new version applies only after it is published, and only to shipments quoted from the publish date onward. Shipments quoted before the new version was published continue to use the previous version — historical PDFs are never retroactively rewritten.

**Deactivating a global clause.** Because deletion is not allowed, deactivation is the way to retire wording. Deactivated clauses are hidden from future selection but remain stored in the library and remain attached to any policy that already imported them. If the clause is no longer wanted on those policies either, it must be removed from each policy explicitly.

| Status | Behaviour |
| --- | --- |
| **Active** | Available for import into policy setup. |
| **Inactive** | Hidden from future selection but preserved in the library. Existing policy imports keep functioning. |

### Policy Clauses Setup

The Policy Clauses Setup page defines which clauses are available for a specific policy. Administrators and Brokers can:

- Import clauses from the Global Clauses Library.
- Create custom clauses for the policy.
- Duplicate clauses.
- Edit imported global clauses by converting them into custom policy clauses.
- Remove clauses from the policy.
- Create new versions of custom policy clauses.

Access is controlled by role:

| Role | Access |
| --- | --- |
| **Administrator** | Can configure policy clauses. |
| **Broker** | Can configure policy clauses. |
| **Participant** | Cannot configure policy clauses. |

Policy clauses are first attached to the policy. They are then applied to shipments through clause-related business rules — adding a clause at the policy level makes the wording *available*; a business rule decides *when* that wording is actually attached to a shipment.

### Importing clauses from the Global Library

To import global clauses into a policy:

- Open the policy's Clauses Setup page.
- Select **Import from Global Library**.
- Use the search and filter options to locate the required clauses.
- Select the clauses to import.
- Click **Import**.

Only **Active** global clauses are available for import. Once imported, the clause appears in the policy-level clause list, and it retains a link back to its global source. Importing does not modify the original clause in the Global Clauses Library.

### Creating a custom policy clause

Custom clauses are created directly at the policy level and apply only to the selected policy. They are not added to the Global Clauses Library. To create one:

- Open the policy's Clauses Setup page.
- Select **Add Custom Clause**.
- Enter the clause **Title**.
- Enter the clause **Wording**.
- Configure the **Nested Clause** option if required.
- Click **Save**.

The full field set on a custom policy clause mirrors the global clause form:

| Field | Required | Description |
| --- | --- | --- |
| **Title** | Yes | The clause title shown in policy clause lists and documents. |
| **Description** | No | Internal summary of the clause. |
| **Category** | Yes | Classification used for filtering and organisation. |
| **Insurer** | Yes | Insurance company linked to the clause. |
| **Cluster** | No | Regional or business grouping used for filtering. |
| **Tags** | No | Additional labels used for search and filtering. |
| **Clause Wording** | Yes | The full wording of the clause. |
| **Is a Nested Clause** | No | Determines how the clause is displayed in documents. |

### Managing imported global clauses at the policy level

When a global clause is imported into a policy, three actions are available on it from the policy-level list.

**Remove from policy.** The clause is removed from the policy's clause list. The original clause in the Global Clauses Library is untouched — no deletion, no deactivation. If the clause is currently attached to an active business rule or an existing shipment, the platform may block removal until the referencing links are resolved.

**Duplicate.** Duplicating an imported global clause creates a new policy-level custom clause. The duplicate copies the imported clause's details, becomes independent of the global source, can be edited freely at the policy level, and does not affect the Global Clauses Library. This is useful when a policy needs wording similar to a global clause but with policy-specific adjustments — duplicate first, then edit the duplicate.

**Edit (with a warning).** Editing an imported global clause using the edit or pencil icon converts it into a custom policy clause. The platform surfaces a warning at this point: editing removes the link to the global source and future updates to the global clause will no longer flow into this policy. The user can accept the conversion or cancel.

After conversion:

- The policy keeps its own custom version of the clause.
- Future new versions of the original global clause do not update this policy's version.
- Any subsequent edits at the policy level do not affect the Global Clauses Library.

### Managing custom policy clauses

For custom policy clauses (whether created directly or converted from an imported global clause), users can edit the clause, duplicate it, remove it, or create a new version.

**Duplicating a custom policy clause** creates another custom clause in the same policy. The duplicate copies the source details and can be edited independently.

**Removing a custom policy clause** takes it out of the policy's clause list. As with global clause removal, if the custom clause is currently attached to an active business rule or an existing shipment, the platform may block removal until the referencing links are resolved.

### Policy clause versioning

Custom policy clauses can be versioned when the wording needs to change. A new version is called for when:

- The clause wording is updated.
- The clause title is updated.
- Existing quoted shipments must retain the previous wording.
- New quoted shipments should use the updated wording.

To create a new version:

- Open the policy's Clauses Setup page.
- Open the custom clause from the clause list.
- Select **Create New Version**.
- Update the clause title or wording.
- Save and publish the new version.

Existing quoted shipments continue to use the clause version that was applicable when they were quoted. New quoted shipments use the latest applicable version from the publish date onward. This is the same behaviour as global clause versioning — historical documents never rewrite themselves.

### Applying clauses to shipments through business rules

Clauses added to a policy are not automatically applied to every shipment created under that policy. Policy clauses define the *available* wording; business rules define *when* that wording should be attached.

This is a deliberate design decision. Different shipments under the same policy should receive different clauses based on shipment details — commodity, conveyance, packing, coverage, insured value, route. A blanket "all clauses on every shipment" model would flood every certificate with irrelevant wording; a purely manual model would rely on brokers remembering to attach the right clauses every time. Business rules automate the decision.

The clause application flow works as follows:

- An Administrator or Broker adds clauses to the policy (imported globals, custom clauses, or a mix).
- The user creates one or more clause-related business rules on the same policy.
- Each rule defines its shipment conditions (for example, commodity group = Electronics; or conveyance = Sea; or insured value exceeds threshold X).
- The clauses are attached to the rule.
- When a shipment meets the rule conditions, the linked clauses are attached to that shipment.

**Attaching clauses to a business rule.** When configuring a clause-related business rule, the user selects from clauses that have already been added to the policy. Available clauses include imported global clauses, custom policy clauses, and custom versions created from imported global clauses. A clause must be available at the policy level before it can be attached to a business rule — if a clause does not appear in the rule editor, it needs to be added to the policy first through the Policy Clauses Setup page.

**Multiple clause rules on one policy.** A policy can have any number of clause-related business rules. Each defines its own conditions and its own clauses. Example scenarios:

| Rule condition | Clause attached |
| --- | --- |
| Commodity Group = Electronics | Electronics Clause |
| Conveyance = Sea | Institute Cargo Clause |
| Packing = Containerised | Containerised Cargo Clause |
| Insured Value exceeds configured threshold | High Value Cargo Clause |
| Coverage includes All Risks | All Risks Clause |

If more than one rule matches the same shipment, the shipment may receive clauses from every matching rule, subject to the configured rule logic.

**Reviewing applied clauses on a shipment.** Once a shipment is quoted and the relevant business rules have been evaluated, the attached clauses can be reviewed by Back Office users from the Shipment 360 page under the Clauses tab. The **Clauses tab on the Referral Activity page** displays both policy-level clauses (the reusable wording attached to the shipment via Business Rules) and shipment-specific clauses (any wording added directly to this shipment inside the referral) so the underwriter can see the full clause picture at review time (from I2G-29834).

**Selection persistence across pagination.** When importing clauses from a long list, the multi-select state is preserved as the user pages through the results (from I2G-29554). Ticking clauses on page 1, moving to page 2, ticking more, and coming back to page 1 keeps the original selections intact rather than clearing them. This is the expected behaviour on any long selection list, and it was fixed here after the previous behaviour was found to be lossy.

### Clause behaviour in documents

Clauses attached to a shipment can be reflected in shipment documents and the shipment record. They may appear in the Quote document, the Certificate document, the Insuring Conditions Page, and the Shipment 360 Clauses tab.

**Quote document.** Clause titles and wording are made available through the Insuring Conditions Page. Access is via the embedded link in the quote document or the QR code at the end of the quote document. The quote itself does not carry the full clause text.

**Certificate document.** Clauses appear under the Insuring Conditions section. The display depends on whether the clause is configured as nested or non-nested.

| Clause type | Certificate behaviour |
| --- | --- |
| **Non-nested clause** | The clause title is shown on the certificate. The full wording is available through the Insuring Conditions Page via the embedded link or QR code. |
| **Nested clause** | The full wording is displayed directly in the certificate PDF. The title may be hidden depending on the nested clause setup. |

Non-nested clauses keep the certificate concise by showing the title in the PDF while making the full wording available through the Insuring Conditions Page. Nested clauses inline the full wording, which is appropriate for short amendments or for cases where the wording must be visually present on the document.

**Insuring Conditions Page.** This is a separate page that contains the full wording of every clause attached to the shipment. Users reach it from the generated document using either the embedded link or the QR code. Its purpose is to keep the main PDF concise while still providing complete access to the applicable clause wording.

**Shipment 360 Clauses tab.** Back Office users can review the clauses attached to a shipment from the Shipment 360 page's Clauses tab. The tab displays whichever clauses were attached to the shipment as a result of matched business rules.

### Marking the Clauses step complete

When all required clauses have been added to the policy, the user can mark the Clauses step complete:

- Open the policy's Clauses Setup page.
- Confirm that all required clauses have been added.
- Click **Mark as Complete**.

Marking the step complete confirms that the policy-level clause list is configured. It does not mean the clauses will automatically apply to every shipment — clause-related business rules must still be configured to define when the clauses are attached.

## Business rules & calculations

### Global vs custom policy clauses — the full comparison

| Area | Imported global clause | Custom policy clause |
| --- | --- | --- |
| **Source** | Imported from the Global Clauses Library | Created directly at policy level |
| **Scope** | Linked to a global source (until edited) | Applies only to the selected policy |
| **Can be removed from policy** | Yes | Yes |
| **Can be duplicated** | Yes — duplicate becomes a custom policy clause | Yes — duplicate remains a custom policy clause |
| **Can be edited** | Yes, but editing converts it into a custom policy clause | Yes |
| **Receives future global updates** | Yes, while it remains linked to the global source | No |
| **Affects Global Clauses Library** | No | No |
| **Applied to shipments automatically** | No — must be attached through business rules | No — must be attached through business rules |

### Behaviour summary

| Action | Behaviour |
| --- | --- |
| **Import from Global Library** | Adds an active global clause to the policy clause list. |
| **Create Custom Clause** | Creates a clause that applies only to the selected policy. |
| **Remove Imported Global Clause** | Removes the clause from the policy only. The global clause remains unchanged. |
| **Duplicate Imported Global Clause** | Creates a new custom policy clause copied from the import. |
| **Edit Imported Global Clause** | Breaks the link to the global source and converts the clause into a custom policy clause. |
| **Duplicate Custom Clause** | Creates another custom clause within the same policy. |
| **Create New Version of Custom Clause** | Creates an updated version for future quoted shipments. Old shipments keep the old version. |
| **Remove Custom Clause** | Removes the custom clause from the policy, subject to reference checks. |

### Rules and constraints

- **Global clauses cannot be deleted.** They can only be deactivated. Deactivation hides them from future selection while preserving history.
- **Removing a global clause from a policy does not delete or deactivate it globally.** The original stays in the library. Every other policy that imported it is unaffected.
- **Editing an imported global clause severs the global link.** The clause becomes a custom policy clause and stops receiving future global updates.
- **Custom policy clauses do not affect the Global Clauses Library.** Duplicating, versioning, or editing a custom clause is scoped to the single policy.
- **Versioning respects historical documents.** New versions apply only from the publish date onward. Shipments quoted under the old version keep the old wording. Historical PDFs are never regenerated.
- **Removal may be blocked by active references.** If a clause is currently attached to an active business rule or an existing shipment, the platform may block removal until the reference is resolved.
- **Clauses are only applied to shipments via business rules.** Adding a clause to a policy only makes the wording available. Attachment to individual shipments requires a matching rule.
- **Business rule clause options are limited to policy-level clauses.** Only clauses already present in the policy's clause list show up in the rule editor. If a clause is missing from the rule editor, it needs to be added to the policy first.
- **Manual clause override remains possible.** Broker staff can add or remove clauses on individual shipments (Booked or Under Review status) even after rules have run. Manual changes are recorded in the audit trail.
- **Ordering on the PDF.** General clauses first, then special clauses, then any clauses attached by business rules — this is the deterministic display order used by the document generator.
- **Nested vs non-nested is a display choice.** Nested inlines the full wording into the certificate; non-nested keeps the certificate short and pushes the wording to the Insuring Conditions Page. Neither has any effect on rating, referrals, or rule logic.

## Related concepts

- Business Rules
- Documents
- Policy Creation
- Choices
- Special Rate
- Audit Trail
- Cluster-Level Configuration
- Sanctions and Compliance
