# Risks — Conveyance

## What it is

The Conveyance tab is one of the tabs inside the Risks step of the Marine Cargo policy wizard. It defines the transport modes the policy covers — Air, Sea, Road, Rail, or combinations of these — and captures a shipment backdating tolerance for each mode. The backdating tolerance is the number of days a participant is allowed to backdate a departure date for that mode; shipments that exceed the tolerance are automatically referred for manual review.

The list on this tab drives the transport-mode dropdown participants see on the shipment submission form. A mode that is not on this tab cannot be selected on a shipment.

## Who uses it & where

- **Brokers and Producers** — configure the tab during policy creation. Revisit it during endorsement when the customer's transport profile changes.
- **Rating Configuration** — treats each selected mode as a rating dimension. The rate matrix must have a rate for every conveyance configured here.
- **Participants** — see the mode options on the shipment form filtered to what is on this tab.
- **The Backdating Tolerance Check system rule** — reads the tolerance value from each row when evaluating shipment submissions.

## How it works

### Prerequisites

- The modes the customer actually ships in — decided in advance with the customer.
- For each mode, the tolerated number of backdating days — decided in advance.

### Adding a conveyance

1. On the Risks step, open the Conveyance tab.
2. Click Add. A side drawer opens.
3. In the drawer, pick the Conveyance (Air, Sea, Road, Rail, or a multimodal combination such as Sea and Road together).
4. Set the Shipment Backdating Tolerance — the number of days backdating is allowed for shipments using this mode.
5. Click Add.

The mode appears as a row on the tab.

### Setting or changing a backdating tolerance

For each conveyance row the broker can set the backdating tolerance separately, without re-adding the mode:

1. Hover over a conveyance row.
2. Click the pin icon that appears.
3. Enter the number of tolerance days.
4. Save.

Different modes can carry different tolerances. Road might allow three days of backdating, for example, while Sea allows seven.

### Removing a conveyance

Two ways to remove:
- Click the trash-bin icon on the individual row.
- Tick one or more rows to bring up the bulk action banner at the bottom of the page, then click Remove.

### Options offered

The available options in the drawer are drawn from the Conveyance type list in the Choices module. If a required mode is missing, the Administrator needs to add it to Choices before it becomes selectable in the wizard. Typical values include:

- Air.
- Sea.
- Road.
- Rail.
- Multimodal combinations (Sea and Road together, for example, or Air and Road together).

Sea conveyance in particular has downstream dependencies — the vessel classification and vessel age rules under Business Rules only fire when a shipment declares a sea leg, and the platform expects vessel data on those shipments.

### Interplay with rating

Every conveyance selected on this tab is a rating dimension. When the broker later configures the Base Rater, Conveyance is one of the sources for rating factors. Each mode added multiplies the number of rate permutations that need to be filled in — three modes multiplied by the other factors adds up quickly. Any mode selected here without a corresponding rate in the Base Rater causes shipments in that mode to fall to the No Applicable Rates Available system rule and be referred.

### Interplay with backdating

Backdating tolerance is enforced at shipment submission time by the Backdating Tolerance Check system rule under Business Rules. That rule reads its value directly from the conveyance tolerances set on this tab — there is no separate configuration under Business Rules for those values.

The rule fires when a submitted shipment's declared departure date is more than the configured tolerance in the past. When it fires, the shipment is referred automatically for manual review rather than being auto-quoted or auto-declined.

## Business rules & calculations

- **The Conveyance tab must contain at least one entry** for the Risks step to pass validation.
- **Backdating tolerance is captured per conveyance row.** Different modes can have different tolerances.
- **Shipments beyond the tolerance are automatically referred** through the Backdating Tolerance Check system rule.
- **Every conveyance must have a rate** in the Base Rater. Missing rates lead to referrals under the No Applicable Rates Available rule.
- **The conveyance options come from the Choices module.** Missing options require Administrator action.
- **Sea conveyance triggers vessel-related rules** — vessel classification society, vessel age, and vessel type checks. These fire only when a shipment declares a sea leg.
- **Adding a conveyance mid-term (endorsement)** propagates to the shipment form immediately from the endorsement's effective date onwards; shipments already in flight remain governed by their version.

## Related concepts

- Risks Configuration
- Risks — Packing
- Risks — Coverages
- Rating
- Business Rules
- Policy Creation (New Business)
