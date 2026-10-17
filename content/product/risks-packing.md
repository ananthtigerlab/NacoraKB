# Risks — Packing

## What it is

The Packing tab is one of the tabs inside the Risks step of the Marine Cargo policy wizard. It lists the packing methods the policy accepts — for example Professionally Packed, Unpacked, or other categories configured for the deployment. The insurer's underwriting appetite often depends on how cargo is packed, so this tab is where that scope is defined.

The list on this tab drives the packing-type dropdown participants see on the shipment submission form. A packing method that is not on this tab cannot be selected on a shipment.

## Who uses it & where

- **Brokers and Producers** — configure the tab during policy creation. Adjust it during an endorsement when the customer's packing profile changes.
- **Rating Configuration** — treats each selected packing type as a rating dimension. The rate matrix must have a rate for every packing type configured here.
- **Participants** — see the packing-type options on the shipment form filtered to what is on this tab.

## How it works

### Adding a packing type

1. On the Risks step, open the Packing tab.
2. Click Add. A side drawer opens.
3. Pick the packing type from the drawer.
4. Click Add.

The type appears as a row on the tab.

### Removing a packing type

Two ways to remove:
- Click the trash-bin icon on the individual row.
- Tick one or more rows to bring up the bulk action banner, then click Remove.

### Options offered

The options in the drawer are drawn from the Packing type list in the Choices module. If a required packing method is missing, the Administrator adds it to Choices before it becomes selectable in the wizard. Typical values include:

- Professionally Packed — cargo prepared by a professional packer for transit.
- Unpacked — cargo shipped without formal packing.
- Any other category the deployment has configured (for example specific pallet types, container types, or refrigerated packing) depending on the customer profile.

### Effect on rating

Every packing type selected on this tab becomes a rating dimension. When the broker later configures the Base Rater, Packing is one of the sources for rating factors. Each type added multiplies the number of rate permutations that need to be filled in. Any type selected here without a matching rate in the Base Rater causes shipments in that packing to fall to the No Applicable Rates Available system rule and be referred.

Packing type is one of the fields participants can be prompted to answer if a custom Business Rule requires it — the platform can flag combinations of packing and other attributes for manual review, for example unpacked shipments over a certain insured value.

## Business rules & calculations

- **The Packing tab must contain at least one entry** for the Risks step to pass validation.
- **Every packing type must have a rate** in the Base Rater. Missing rates lead to referrals under the No Applicable Rates Available rule.
- **Packing options come from the Choices module.** Missing options require Administrator action.
- **Packing type is available as an attribute** in custom Business Rule conditions, so brokers can build rules like Refer if Packing equals Unpacked AND Insured Value greater than X.

## Related concepts

- Risks Configuration
- Risks — Conveyance
- Risks — Coverages
- Rating
- Business Rules
- Policy Creation (New Business)
