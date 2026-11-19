# Risks — Commodity Groups

## What it is

The Commodity Group tab is one of the tabs inside the Risks step of the Marine Cargo policy wizard. It defines which commodity groups are eligible under the policy. This tab is distinct from the AI-assisted commodity suggestion feature that appears at shipment-submission time — the policy-level tab captures scope, the shipment-level suggestion helps a participant classify a specific cargo.

Behaviour on this tab depends entirely on the policyholder's Nature of Business, set on General Details. Two modes exist:

- Freight Forwarder policyholders — commodity groups are generated automatically from the Choices list. The broker cannot manually select or modify them. The auto-generated groups also power the AI-assisted commodity suggestion on the shipment form.
- Shipper or Consignee policyholders — the tab is used to define commodity groups manually. This becomes the only list available to participants on the shipment form. The AI-assisted commodity suggestion is not used for this policyholder type.

When the holder is a Shipper or Consignee for whom commodity scope is captured per shipment instead of at the policy level, the tab is hidden entirely from the wizard.

## Who uses it & where

- **Brokers and Producers** — configure the tab during policy creation. Behaviour depends on the policyholder's Nature of Business, which the broker has set on General Details.
- **Administrators** — maintain the master list of commodity groups in the Choices module; that list is the source for Freight Forwarder auto-population.
- **Participants** — see the commodity-group options on the shipment form filtered to whatever is set on this tab.
- **Rating Configuration** — treats each commodity group as a rating dimension. The rate matrix must have a rate for every combination that includes each commodity group, either individually or via the Commodity Groups Lookup Table.

## How it works

### Freight Forwarder policyholder path

When the policyholder's Nature of Business is Freight Forwarder:

- Commodity groups are generated automatically from the Choices list.
- The broker cannot manually select or modify them on this tab.
- The auto-generated list powers the AI-assisted commodity-description suggestion on the shipment submission form. When a participant types a cargo description, the platform matches it against the auto-populated groups and suggests the best fit.

Because the list is deployment-wide (drawn from the Choices module), the way to change it for a Freight Forwarder policyholder is to have the Administrator update the Choices list.

### Shipper or Consignee policyholder path

When the policyholder's Nature of Business is Shipper or Consignee (and the tab is visible for the deployment), the broker defines commodity groups manually:

1. On the Risks step, open the Commodity Group tab.
2. Click Add.
3. Enter a Commodity Group Name and a Description.
4. Click Save.

These manually defined groups become the only options available to participants in the shipment form for that policy. The AI-assisted commodity-suggestion feature is not used on this policyholder type — the participant selects directly from the manually defined list.

### Removing or editing manual entries

For Shipper or Consignee policyholders where the tab is manual, entries can be removed via the trash-bin icon on each row or via the bulk action banner after ticking multiple rows.

### When the tab is hidden

For some Shipper or Consignee policyholders the commodity scope is captured per shipment rather than at the policy level. In that configuration the Commodity Group tab is hidden entirely and no policy-level list is required.

### Nature of Business changes after configuration

If the broker changes the policyholder's Nature of Business on General Details after the Commodity Group tab has been configured, a prompt appears to clear the commodity groups. This is required because the manually built list is not compatible with the Freight Forwarder auto-population model, and vice versa.

### Per-policy commodity lists

Some policies define their own commodity list rather than relying on the default commodity groups from the Choices module. When a policy has its own list, shipments are priced against the commodities on that list. The rating engine reads the policy's commodity table first and resolves the shipment's commodity against the policy's own entries.

Third-party policies always allow commodity entry regardless of the policyholder's Nature of Business.

### Rate category linking

Each commodity group can be linked to a rate category. The rate category tells the rating engine which column of the rate table to price against for that commodity. A commodity group cannot be activated on a policy without a rate category linked to it — the platform blocks the activation and displays the reason.

If a commodity group is activated and later its rate category link is removed, shipments in that commodity are referred with a clear reason rather than priced at zero. The back-office policy page lists any unlinked groups and any shipments that were booked at zero premium before this safeguard was introduced.

When a rate category is linked to a commodity group for the first time (or restored after being unlinked), any open quotes affected by that group are automatically re-rated so they receive a price.

### Interplay with rating

Every commodity group (or every Commodity Groups Lookup Table category) is a rating dimension. When the broker later configures the Base Rater, Commodity Groups can be added as a rating factor either from the Risks list directly (using each individual group) or through a Lookup Table that groups commodities into a single named category to reduce permutations.

The rate matrix must cover every combination that includes each configured commodity group. A group without a rate in the matrix causes shipments in that commodity to fall to the No Applicable Rates Available system rule and be referred.

### Distinct from the AI shipment suggestion

The AI-assisted commodity suggestion on the shipment form is a separate feature from this tab. The tab captures which commodity groups the policy is willing to accept. The AI suggestion is a shipment-time feature that helps a participant classify their cargo description into the right group; it uses the auto-populated commodity groups for Freight Forwarder policies and is not used for Shipper or Consignee policies where the participant chooses directly from the manual list.

## Business rules & calculations

- **Tab behaviour depends on the policyholder's Nature of Business.**
  - Freight Forwarder — auto-populated from Choices, not editable.
  - Shipper or Consignee (policy-level) — manually defined.
  - Shipper or Consignee (shipment-level) — tab hidden entirely.
- **The AI-assisted commodity suggestion is only used for Freight Forwarder policies.** It is not used for policies where commodity groups are defined manually.
- **Every configured commodity group must be covered by the rate matrix**, either individually or via a Commodity Groups Lookup Table. Missing rates cause referrals.
- **A commodity group cannot be switched on without a rate category.** If the group has no rate category linked, the platform blocks activation and explains why.
- **A no-rate referral cannot be approved without a rate or cargo premium.** The Approve button is disabled with the reason, and the API enforces the same constraint.
- **Per-policy commodity lists override defaults.** When a policy defines its own commodity list, the rating engine resolves against the policy's entries, not the deployment-wide defaults.
- **Third-party policies always allow commodity entry** regardless of the policyholder's Nature of Business.
- **Changing the Nature of Business after configuring commodity groups prompts to clear the tab.** The two models are not compatible.
- **The manual list becomes the exhaustive list of options participants can pick.** Any commodity outside the list cannot be shipped under the policy.
- **Rating can use grouped or individual entries.** The Commodity Groups Lookup Table lets the broker treat multiple related commodities as a single rating category to reduce permutations.

## Related concepts

- Risks Configuration
- Commodity Group Suggestion
- Rating
- Choices
- Special Rate
- Policy Creation (New Business)
