# Policy Creation (New Business)

## What it is

Policy creation — also called New Business — is the guided wizard for building a fresh Marine Cargo policy from scratch inside the Back-Office. It walks the broker through ten configuration steps, split across two phases (five form steps followed by five configuration steps), and ends with a deliberate activation action from the policy's detail page rather than from inside the wizard itself.

The wizard produces a draft policy that captures every setting the platform later needs to quote, book, invoice, endorse, and cancel shipments under it: who is covered, who underwrites, what modes of transport and packing are accepted, what commodities are eligible, what currencies apply, what limits are in force, what documents look like, how the rating is built up, what wording prints on the paperwork, and what automated rules run on each shipment submission. Everything downstream — quotes, certificates, referrals, endorsements, renewals, analytics — depends on the choices made here.

The wizard tracks progress across all ten steps and lets the broker save and resume at any point. A single policy can be configured across several sessions if needed. Until every step is complete, the policy lives in the Incomplete Policies list and cannot be activated. There is no time limit on an Incomplete Policy.

## Who uses it & where

- **Brokers and Producers** — the primary users. They need the Producer or Broker role on their user account to see the Create option in the top navigation. If the option is missing, either the role or the company assignment on the user record is incomplete and the Administrator needs to intervene.
- **Administrators** — do not run the wizard themselves, but the wizard depends entirely on master data they maintain. If any of that data is missing, the corresponding dropdown in the wizard is empty and the step cannot be completed.
- **Underwriters** — do not create policies from scratch. They come into the picture after activation, when the policy is being used to issue quotes, resolve referrals, and endorse.
- **Participants** — never see the wizard. Once the policy is activated, users at participant companies can submit shipments under it from the Shipment Portal.

The wizard lives in the Back-Office as a dedicated policy-creation flow. In the MVP scope for the Nacora go-live, the covered country is Poland and the covered mode is road only — although the wizard itself supports many more conveyance modes, the initial deployment is deliberately narrow.

## How it works

### Before starting: master data prerequisites

The wizard reads from master data maintained elsewhere in the platform. Any missing item translates to an empty dropdown that blocks progress. Confirm the following exist before opening the wizard:

**Business partner records**

- The Broker Company the policy is being created under.
- The Policyholder Company the policy covers. It must be linked to the Broker Company in the partner hierarchy (referred to internally as the Org Tree). If it is not linked, the dropdown filters it out.
- The Participant Companies that will submit shipments under the policy. Each must be linked to the Policyholder.
- The Insurance Company or Companies — up to three per policy — that will underwrite the risk.
- The Surveyor Group that will inspect cargo on a loss.

**Choices module entries**

- Billing Currency.
- Insured Value Currency.
- Country List — Departure and Destination countries are drawn from this single list.
- Policy Type.
- Reporting categories.
- Commodity Groups.
- Conveyance types.
- Packing types.
- Coverages.

**Clauses**

- All clauses the broker wants to attach to the policy must already exist in the Global Clauses Library and be marked Active. If wording is missing, the Administrator adds it before the broker reaches the Clauses step.

**Commercial information from the customer**

Before opening the wizard, the broker should already have agreed with the customer on: policy start and end dates; the official policyholder name and address; the billing currency; any allowed insured-value currencies; the maximum insurable limit per shipment; the co-insurance split if multiple insurers share the risk (percentages must total exactly 100); the conveyance modes, packing types, coverages, and commodity groups to be covered; and any additional shipment charges that apply — taxes, fees, rebates.

### The full journey at a glance

Setting up a policy is ten steps split into two phases. The wizard sidebar shows progress through each step.

**Phase 1 — Form steps (Steps 1 to 5).** Completed in order using the Back and Next buttons. Defines who the policy is for, what it covers, and how it is priced.

1. General Details — broker, policyholder, dates, policy type, certificate language.
2. Participant Companies — the companies that can submit shipments under the policy.
3. Other Parties — the insurers and their contribution share, plus the surveyor groups.
4. Billing — billing currency, insurable limit, billing date, shipment charges.
5. Risks — conveyance, packing, coverages, commodity groups, countries.

**Phase 2 — Configuration steps (Steps 6 to 10).** Accessed from the same sidebar and can be completed in any order, although the recommended sequence is the one below. Each step has to be explicitly marked complete — filling in the underlying editor is necessary but not sufficient. Green checks on the sidebar only appear once the Mark as Complete action has been taken.

6. Quote Document — the PDF template participants receive with their quote.
7. Certificate Document — the PDF template issued as proof of cover.
8. Rating — the base rates and rating logic.
9. Clauses — the wording that prints on quotes and certificates.
10. Business Rules — the eighteen pre-loaded system rules plus any custom rules the broker adds.

At any point the broker can click Save and Exit, and the policy is saved as Incomplete and appears in the Incomplete Policies list.

### Step 1 — General Details

The foundational step. Several fields in later steps depend on what is selected here, so care matters.

**Broker Company.** Required. The broker company the policy is being created under. This drives filtering everywhere else: the Policyholder dropdown only shows policyholders brokered by this company, and the same filter applies through Steps 2 and 3.

**Policy Type.** Required. Sourced from the Choices module. Typical values are the Kuehne+Nagel policy type or a third-party policy type. The choice matters because certain features — for example the Named Assured marker on participant companies — are only surfaced on third-party policies.

**Policy Name.** Required. A clear, descriptive name for the policy. This appears on generated documents.

**Policy Contract Number.** Required. The contract reference number. Appears on generated documents.

**Start Date.** Required. The date from which the policy is active. Can be a future date or backdated.

**End Date.** Required. Must be at least one day after the Start Date.

**Policyholder.** Required. The dropdown is disabled until a Broker Company is selected, and once enabled it only shows policyholders linked to that broker in the Org Tree. If the expected policyholder is missing from the list, the relationship has not been set up and the Administrator needs to fix it.

**Policyholder Official Name.** Auto-populated from the policyholder's business partner record. The broker can override it here — the override applies to this policy only and does not update the underlying record.

**Policyholder Address.** Auto-populated in the same way and overridable in the same way.

**Reporting.** Required. Selects the reporting category, sourced from Choices. Used later by analytics to bucket the policy.

**Certificate Language.** Required. Selects the primary language used on generated certificate documents.

**Secondary Certificate Language.** Optional. Selects an additional certificate language for bilingual certificates. Both versions are rendered inside a single PDF when this is set. Leave blank if only the primary language is needed.

Clicking Next proceeds to Step 2. Save and Exit saves the policy as Incomplete for later resumption.

### Step 2 — Participant Companies

Defines which participant companies can create shipments under this policy. At least one is required.

The step is empty until the Policyholder is set on General Details. Only participant companies linked to the selected policyholder appear in the selection panel. If a company is missing from the panel, the relationship has not been set up in the Org Tree and the Administrator needs to add it.

**Adding participant companies.** Clicking Add opens a selection panel showing all available participant companies. The broker can select all, multi-select, or single-select. Ticking the checkbox next to each desired company and clicking Add attaches them to the policy.

**Address.** Auto-populated from the business partner record for each participant.

**Named Assured marker.** Appears only on third-party policy types. Used to mark specific participants as explicitly named on the certificate. For third-party policies the broker should decide in advance which participants should be marked. For non-third-party policies the column is hidden entirely.

**Removing a participant company.** Either click the trash-bin icon on the row, or reopen the side panel and untick the company.

**Bulk operations.** Ticking one or more rows brings up the action island at the bottom of the page with three actions:
- Mark Named Assured (third-party policies only).
- Unmark Named Assured (third-party policies only).
- Remove — detaches the participant from the policy. Does not delete the underlying business partner.

**Effect of changing the Policyholder.** Going back to General Details and changing the Policyholder clears every participant company on this step, because the participants are filtered by the policyholder relationship.

Clicking Next proceeds to Step 3.

### Step 3 — Other Parties

Two sections — the insurers underwriting the policy and the surveyors responsible for cargo inspection on a loss.

**Section A — Insurance Companies.** Up to three insurers per policy. Their contribution percentages must total exactly 100.

To add an insurer, the broker clicks Add in the Insurance Companies section, picks the insurer from the panel (only insurers linked to the Broker Company are visible; insurers already selected are filtered out), and enters the contribution percentage. Repeat for each additional insurer.

Exactly one insurer must be marked as Lead Insurance Company. The Lead is assigned by three rules:
- One insurer added — automatically Lead, not editable.
- Two insurers at an even 50/50 split — the broker chooses the Lead manually.
- Two or more insurers at an unequal split — the insurer with the highest contribution is automatically Lead and the flag is not editable.

The contribution progress bar has three states — green when the total is exactly 100 (valid), yellow when the total is below 100 (incomplete), red when the total exceeds 100 (invalid). The wizard blocks progress until the bar is green.

**Section B — Surveyor Groups.**

Primary Surveyor Group is required. Chosen from a dropdown sourced from Choices and filtered by Broker Company.

Secondary Surveyor Group is optional. Typically used for specialist cargo or high-risk routes as a backup surveyor.

Clicking Next proceeds to Step 4.

**Downstream effect.** Once the policy is activated, the Lead Insurer is the only insurer with permission to manage referral cases and special-rate requests. Other insurers can see records under the policy but cannot manage its related activities. Surveyors linked to the selected surveyor group are printed on the certificate document.

### Step 4 — Billing

Defines the commercial pricing skeleton: which currency the policyholder is invoiced in, the maximum insurable limit per shipment, when invoices are generated, and any additional charges applied to shipment premiums.

**Billing Currency.** Required. The currency in which premiums are billed. Selected from the Choices list. Switching the billing currency after activation is disruptive — it forces the rating tables to be reconfigured — so the broker confirms this with the customer up front.

**Maximum Insurable Limit per Shipment.** Required. A hard cap on any single shipment's insured value. When a shipment declaration exceeds this cap, the High Value Shipment Alert activity is raised to the Producer.

**Insured Value Same as Billing Currency.** Optional checkbox. When ticked, participants can only insure shipments in the billing currency and the Insured Value Currencies multi-select is disabled.

**Insured Value Currencies.** Required when the checkbox above is unticked. Multi-select. The currencies participants are allowed to declare insured value in.

**Billing Date.** Two options for when invoices are generated each month:
- Last day of the month — the default.
- Specific day of the month — a fixed day between 1 and 31. If the chosen day does not exist in a given month (for example 31 in February), invoicing falls back to the last day of that month.

**Shipment Charges.** Optional. Up to ten additional charges can be added. Each charge applies to every shipment premium under the policy.

For each charge the broker specifies:
- Charge Name — a descriptive label.
- Charge Type — Tax (percentage only), Rebate (percentage only), or Additional Charge (percentage or fixed amount).
- Charge Value — the percentage or amount.

Charges apply sequentially in the order they appear on the page. Each charge is calculated on the running subtotal after the previous charge has been applied, not on the original base premium. Worked example: base premium USD 1,000; then a 10 percent tax of USD 100 gives a subtotal of USD 1,100; then a 10 percent additional charge on that subtotal (USD 110) gives a final total of USD 1,210. Drag-and-drop reorders the rows and changes the order of application.

**Currency change with existing fixed charges.** If the billing currency is changed on the same policy while amount-based charge rows already exist, a confirmation message appears before those fixed amounts are cleared. Confirming lets the broker manually re-enter the amounts in the new currency.

Clicking Next proceeds to Step 5.

### Step 5 — Risks

Defines the risk profile the policy accepts. Selections here directly control what options participants see on the shipment submission form and what combinations the rating engine has to cover. This is covered in depth on the Risks Configuration page and its per-tab sub-pages; the summary here mirrors the structure.

- **Conveyance tab.** The modes of transport accepted under the policy — Air, Sea, Road, Rail, or combinations. Each conveyance can carry its own shipment backdating tolerance in days. Shipments that exceed the tolerance are automatically referred.
- **Packing tab.** The packing methods accepted (for example Professionally Packed, Unpacked).
- **Coverages tab.** The coverage types available on shipments — for example the ICC A, ICC B, ICC C sets. The rating step later requires a rate for every coverage configured here.
- **Commodity Group tab.** Behaviour depends on the policyholder's Nature of Business. Freight Forwarders get commodity groups generated automatically from the Choices list; Shippers and Consignees define commodity groups manually. The tab is hidden entirely when the holder is a Shipper or Consignee for whom scope is captured per shipment.
- **Departure and Destination Countries tabs.** All active countries from the Choices list are included automatically. Nothing is configured per policy.

Clicking Save and Exit saves the policy as Incomplete and takes the broker to a view that lets them continue to the configuration steps.

### Step 6 — Quote Document

Opens the quote document editor for this policy — the PDF template used to issue quotes to participants. Every quote produced under this policy renders through whichever template version is published here.

Even if the deployment's default template is acceptable as-is, this step still has to be visited: the policy cannot activate until the step is marked complete, and the button to mark it complete is disabled until the editor has been opened and saved once.

The editor is a two-pane layout — template navigator on the left, live PDF preview on the right. Sections can be reordered, added, removed, and edited inline. The Quote Document configuration is covered in depth on the Documents page.

Once the template is configured, saved, and previewed, the broker returns to the step page and clicks Mark as Complete.

### Step 7 — Certificate Document

Opens the certificate document editor. The certificate is the proof-of-cover document issued on booked shipments and presented to banks, customs, and counterparties. Layout and editor are shared with the Quote Document step, but the templates are independent.

If a secondary language is set on General Details, the certificate editor surfaces a language toggle so both versions can be reviewed and edited before publishing.

Certificate-specific sections include Premium Information (what premium value prints), Settling Agent Information, Signatures, Instructions (which appear on the page reached via the QR code or embedded link), Clause Court of Jurisdiction, Footer, and Certificate Language selection.

Once the template is configured, saved, and previewed in both languages if applicable, the broker returns to the step page and clicks Mark as Complete.

### Step 8 — Rating

Sets up the pricing logic. Every shipment quoted under the policy is rated using this configuration, so care matters.

Two optional-but-recommended structures — Lookup Tables — group multiple values into named categories to reduce the number of permutations needing individual rates. Routes group departure and destination country combinations into named routes (for example Asia to Europe). Commodity Groups group commodity groups into a single named category.

The Base Rater is opened via Configure Rate. Rating factors are added — each factor is a risk dimension used to generate permutations. Sources for factors are either the Risk List (Conveyance, Packing, Coverages) or Lookup Tables (Routes, Commodity Groups). Each factor added multiplies the total number of permutations: Conveyance (three values) times Packing (two) times Coverage (four) times Routes (five groups) is 120 permutations.

Once the factors are set, the system generates the full permutation table. For each row the broker enters a Rate (percentage) and a Minimum Premium (if applicable). The table can be exported at any time to review offline before entering rates. Permutations without a rate fall to the No Applicable Rates Available system rule and the shipment is referred for review.

Once every row is rated the step is saved and marked complete.

### Step 9 — Clauses

The wording attached to quotes and certificates. The broker either imports clauses from the Global Library or authors custom clauses specific to this policy.

**Import from the Global Library.** Filter the panel by category, insurer, cluster, or tags. Tick the clauses to import and click Import. Only Active clauses appear in the panel. Wording missing from the library has to be added by the Administrator.

**Add a Custom Clause.** For wording specific to this policy that should not enter the global library. Title, Wording, and an optional Nested Clause flag — when on, only the wording prints on documents and the title is hidden.

**Reorder.** Drag-and-drop the row handles to change the order clauses appear in on documents.

The step is gated: it cannot be marked complete until at least one clause is configured.

### Step 10 — Business Rules

Automated conditions that the system evaluates on every shipment submission. When a rule's conditions are met, its action fires automatically — before the quote is returned.

**System rules.** The platform pre-loads eighteen system rules on every policy. Their conditions are fixed and cannot be edited; the values they evaluate against are configurable. Examples:
- Insured Value Exceeds Maximum Insurable Limit — the limit value is set here.
- High Value Shipment Alert — the value that triggers the alert email is set here.
- Minimum Premium Setup — the floor premium amount and the conditions it applies to.
- Refer Matching Keyword in Cargo Description — the list of keywords.
- Vessel Classification Society — the list of accepted societies.
- Sanction and embargo checks (six rules) — no values to configure; these fire automatically against the active sanctions and embargo lists.
- Vessel age and type rules (five rules) — thresholds are fixed per vessel type; no value to configure.
- Backdating Tolerance Check — the value is taken from the conveyance tolerances set in the Risks step.

**Custom rules.** The broker can add rules on top of the system set. Each custom rule has a Rule Name, a Rule Type (Set Maximum Limit, Set Minimum Premium, Attach Clauses, Ask Questions, Trigger Referral), an IF section defining the conditions, and a THEN section defining the action.

Conditions use an Attribute (Conveyance, Packing, Coverage, Commodity Group, Departure Country, Destination Country, Insured Value, Insured Value as a percentage of the Maximum Insurable Limit), an Operator (Equal, Greater than, Greater than or equal to, Less than, Less than or equal to), and a Value. Actions vary by rule type — capping a limit, enforcing a floor premium, attaching clauses, asking questions of the participant during submission, or triggering a referral for manual review.

Save and Validate finalises each custom rule. The step is gated in the same way as Clauses — it cannot be marked complete until at least one rule is configured, whether system or custom.

Active rules fire on the next shipment submission. Multiple rules can fire on the same shipment, and all their actions are applied; the broker reviews the rule set as a whole before activating the policy.

### Activating the policy

The wizard itself does not activate the policy. Save and Exit at any point — including after the last step is marked complete — saves the policy as an Incomplete Policy and navigates to its detail page. Activation is triggered from that detail page, not from inside the wizard.

The detail page shows a completion indicator. Until every mandatory configuration is in place and the indicator reaches 100 percent, activation is blocked and the platform lists which steps are still outstanding so the broker can return to the wizard and finish them.

Once the indicator is at 100 percent, activation runs from the three-dot Actions button at the top right of the detail page. Select Activate Policy and confirm. On success:

- The policy is assigned its policy number.
- Its status changes to Active.
- It moves from Incomplete Policies to Policies in the search modules.
- Participants linked to the policy can submit shipments under it immediately.

Under the hood, when the draft is saved the system also creates a rating product at the external rater in the background so the catalog is ready for the first quote. On activation the policy version is published, the earlier draft (if any) becomes obsolete, and the platform emits a policy-activated event to the analytics stream.

### Saving and resuming

The wizard supports Save and Exit at any point during either phase. The policy is saved as Incomplete and appears in the Incomplete Policies list. Reopening it resumes exactly where the broker left off; the sidebar shows which steps are complete and which are outstanding. There is no time limit on an Incomplete Policy.

### Upcoming Policy 360 cleanup (backlog)

The Policy 360 view (for activated policies) and the Incomplete Policy 360 view (for policies still in the wizard) are scheduled for a cleanup that removes elements not used in the Nacora deployment (I2G-30082, in Backlog):

- **Create Activity** action — removed.
- **Create Email** action — removed.
- **Edit in Admin Site** action — removed.
- **Activities** tab — hidden.
- **Emails** tab — hidden.

These are legacy platform surfaces carried over from the base product that Nacora does not use. Trimming them tightens the Policy 360 to only the tabs and actions the broker actually needs during onboarding and day-to-day policy administration. The cleanup is not yet in the live build; when it lands the Policy 360 will show a shorter tab list and a shorter three-dot Actions menu.

## Business rules & calculations

- **Policy number format:** MC followed by a six-digit sequence. Numbers are never reused.
- **Term rule:** start date must be on or before end date; issue date must be on or before start date.
- **Renewal reminders:** the platform emails the broker at 30, 14, and 7 days before the end date.
- **Single active quotation per version:** older quotations under the same version are marked obsolete when a new one activates.
- **Billing currency drives conversion:** every insured value on a shipment is converted into this currency before rating.
- **Insurer contributions must total exactly 100.** The wizard blocks progress at Other Parties until the indicator is green.
- **Exactly one Lead Insurer per policy.** Automatic in single-insurer and unequal-split cases; manual for a two-insurer 50/50 split.
- **Maximum three insurers per policy.**
- **Maximum ten shipment charges per policy.** Charges apply sequentially on the running subtotal, not the base premium.
- **Named Assured marker only exists on third-party policies.** The column is hidden on other policy types.
- **Commodity Group tab visibility depends on Nature of Business.** Hidden entirely for Shippers and Consignees; auto-populated for Freight Forwarders; manually authored for holders where the tab is shown.
- **Backdating tolerance is per conveyance mode.** Set in Risks; enforced by the Backdating Tolerance Check system rule.
- **Configuration steps must be explicitly marked complete.** Filling in the underlying editor is necessary but not sufficient.
- **Clauses and Business Rules are gated.** Neither step can be marked complete until at least one clause or rule is configured.
- **Every rating permutation must have a rate.** Permutations without a rate fall to the No Applicable Rates Available rule and the shipment is referred.
- **Activation is a deliberate action.** Save and Exit does not activate; the three-dot Actions menu on the policy detail page does.
- **MVP scope: Poland, road only.** The wizard supports many more conveyance modes globally, but the initial Nacora go-live is intentionally narrow.

## Related concepts

- Risks Configuration
- Policy Billing Setup
- Configuration Steps Overview
- Documents
- Policy Lifecycle
- Adjustments (MTA)
- Cancellations
