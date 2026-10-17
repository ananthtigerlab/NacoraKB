# Risks Configuration

## What it is

Risks Configuration — Step 5 of the Marine Cargo policy creation wizard — is where the broker defines the cargo profile the policy will accept. It captures how cargo moves (transport modes), how it is packed, what kinds of cover apply, what commodities are eligible, and which countries it can move between. Together these tabs decide which shipments the rating engine will quote and which it will reject before they ever reach an underwriter.

This step is the single biggest determinant of which shipments will be accepted under the policy. Forgetting a mode, packing type, coverage, or commodity group is the most common cause of shipments being rejected at quote time.

The step is composed of five tabs. Each tab has its own grid and validation, and tabs with validation errors get a visible error indicator in the tab bar. The step comes after Billing and before the Configuration Steps phase.

## Who uses it & where

- **Brokers and Producers** — configure the risk profile as part of the New Business wizard. Every combination selected here has to be matched later in the Rating step and in the Clauses step. They also revisit these tabs during endorsements when the customer's transport profile is being extended or narrowed.
- **Rating Configuration** — reads from these tabs. The rate matrix has to cover every configured combination of conveyance, packing, coverage, commodity group (where used), and country (via routes).
- **Clauses Configuration** — some coverages drive specific Institute clauses on certificates automatically.
- **Participants** — see the option dropdowns on the shipment submission form filtered exactly to whatever is set in these tabs.

## How it works

### Before opening the step

Two things need to be confirmed up front:

- The policyholder's Nature of Business, set on General Details. This determines what is visible in the Risks step — most importantly, the Commodity Group tab is hidden when the holder is a Shipper or Consignee.
- A clear picture of the routes, modes, packing types, coverages, and commodity groups the customer needs covered. Missing any of these is the most common cause of shipments being rejected at quote time.

### The five tabs

The tabs, in order:

- **Conveyance tab.** The transport modes the policy covers — Air, Sea, Road, Rail, or combinations. Each conveyance can carry its own shipment backdating tolerance (in days). Shipments that exceed the tolerance are automatically referred. Detailed on the Risks — Conveyance page.
- **Packing tab.** The packing methods accepted (for example Professionally Packed, Unpacked). The insurer's underwriting appetite often depends on how cargo is packed. Detailed on the Risks — Packing page.
- **Coverages tab.** The coverage types available under the policy (for example the ICC A, ICC B, ICC C sets). Detailed on the Risks — Coverages page.
- **Commodity Group tab.** Visibility and behaviour depend on the policyholder's Nature of Business. Detailed on the Risks — Commodity Groups page.
- **Departure and Destination Countries tabs.** Auto-populated with every active country from the Choices list. Nothing is configured per policy. Detailed on the Risks — Countries page.

### The general working pattern

On each of the tabs that require selections (Conveyance, Packing, Coverages, and Commodity Group for holders where it is manual), the working pattern is the same:

1. Click Add to open a side drawer.
2. Tick the entries to include.
3. Click Confirm (or Add).
4. Rows appear on the tab.
5. Remove an individual entry via the trash-bin icon on its row.
6. Select multiple rows to bring up the bulk action banner and remove several at once.

Each tab shows its own error indicator if validation fails — for example if Conveyance is empty when at least one is required.

### After completing the tabs

Once each tab is complete and the error indicators are clear, the broker clicks Save and Exit. The policy is saved as Incomplete and the broker is taken to a view that lets them continue to the Configuration Steps phase.

### How the choices feed downstream

- **Rating.** The rate matrix has to cover every configured combination. Rating factors in the Base Rater draw from the Risks selections (Conveyance, Packing, Coverages) and from Lookup Tables (Routes built from Countries, and Commodity Group groupings). Adding a value in the Risks step without a matching rate in the Base Rater means the shipment will fall to the No Applicable Rates Available rule and be referred.
- **Clauses.** Some coverages automatically pull specific Institute clauses onto the certificate. Adding a coverage that has no matching clause set may leave the certificate missing wording.
- **Shipment submission form.** Participants see the option dropdowns filtered to whatever is configured here. A conveyance not on the list cannot be selected.
- **Backdating.** Shipments whose departure date is more than the configured tolerance in the past are automatically referred through the Backdating Tolerance Check system rule.
- **AI commodity suggestions.** For Freight Forwarder policyholders, the auto-generated commodity groups power the cargo-description suggestions surfaced on the shipment submission form. For Shipper and Consignee policyholders, this suggestion is not used because commodity scope is captured per shipment instead.

## Business rules & calculations

- **Commodity Group tab visibility:** hidden when the policyholder's Nature of Business is Shipper or Consignee; commodity scope is captured per shipment instead. Visible for Freight Forwarders (auto-populated from Choices) and for holders where manual definition is expected.
- **Departure and Destination countries are not configured per policy.** All active countries from the Choices list are automatically included. Restrictions come from the Routes Lookup Table in Rating and from custom Business Rules.
- **Every combination must have a rate.** A conveyance, packing, coverage, or commodity group configured on this step without a matching rate in the Base Rater causes shipments to be referred.
- **Backdating tolerance is per conveyance.** Set on the Conveyance tab and enforced through the Backdating Tolerance Check system rule at shipment submission.
- **Changing the policyholder's Nature of Business after configuring commodity groups prompts to clear them.** The manual list built for a Shipper or Consignee is not compatible with the Freight Forwarder auto-population.
- **Tab-level validation is surfaced in the tab bar.** Broker cannot leave the step without clearing all indicators.

## Related concepts

- Risks — Conveyance
- Risks — Packing
- Risks — Coverages
- Risks — Commodity Groups
- Risks — Countries
- Rating
- Policy Creation (New Business)
