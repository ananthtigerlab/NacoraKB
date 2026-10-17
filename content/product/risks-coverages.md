# Risks — Coverages

## What it is

The Coverages tab is one of the tabs inside the Risks step of the Marine Cargo policy wizard. It lists the coverage types available under the policy — for example the Institute Cargo Clauses A set, ICC B set, ICC C set, and any additional coverages the deployment offers. The chosen coverages drive three things: pricing (via the Rating step), automated behaviour (via Business Rules), and which Institute clauses appear on the certificate.

The list on this tab drives the coverage dropdown participants see on the shipment submission form. A coverage that is not on this tab cannot be selected on a shipment.

## Who uses it & where

- **Brokers and Producers** — configure the tab during policy creation, having agreed the underwritten coverages with the insurer. Revisit it during endorsement when scope changes.
- **Insurers** — must have agreed to underwrite every coverage selected here. Adding a coverage the insurer has not signed off on creates a quote the customer cannot actually claim against.
- **Rating Configuration** — reads from this tab. The rate matrix has to have a rate for every coverage on it.
- **Documents / Clauses** — coverage selection drives which Institute clauses attach automatically on the certificate.
- **Participants** — see the coverage options on the shipment form filtered to what is on this tab.

## How it works

### Prerequisites

- Confirm with the insurer which coverages they have agreed to underwrite. Adding one here that the insurer has not signed off on creates a quote the customer cannot actually claim against.
- Confirm the rating tables have a rate for every coverage the broker intends to add. Coverage without a rate means quoting will fail on that coverage.

### Adding a coverage

1. On the Risks step, open the Coverages tab.
2. Click Add.
3. Pick a coverage from the dropdown.
4. Click Add.

The coverage appears as a row on the tab.

### Removing a coverage

- Click the trash-bin icon on the row.
- Or tick one or more rows to bring up the bulk action banner, then click Remove.

### Coverage types offered

The available options in the dropdown are drawn from the Coverages list in the Choices module. Typical values are the standard Institute Cargo Clauses sets:

- **ICC A.** The broadest coverage — an all-risks basis subject to standard exclusions. Cargo is covered against physical loss or damage from most fortuitous causes, apart from named exclusions like inherent vice, delay, ordinary wear and tear, insufficient packing, and the standard war and strikes exclusions.
- **ICC B.** Named-perils coverage narrower than A. Covers a defined list of causes including fire, explosion, vessel casualty, general average sacrifices, jettison, washing overboard, entry of sea water, and total loss of packages overboard or dropped during loading.
- **ICC C.** The narrowest of the three main sets — a shorter list of named perils focused on major casualties like fire, explosion, vessel casualty, and general average.

Additional coverages a deployment may offer include War, Strikes, and any custom Institute clause sets the insurer supports. Each carries its own clause wording.

### Per-coverage clauses on documents

The choice of coverage drives which Institute clauses automatically attach to the certificate. When ICC A is selected on a shipment, the ICC A clause set is embedded in the certificate; ICC B and ICC C attach their respective sets. This linkage is automatic — the broker does not manually attach the standard Institute clauses on each shipment, but does need to make sure the Global Clauses Library contains the wording the insurer has approved.

Custom or supplementary clauses (broker-specific wording, letter-of-credit language, jurisdictional carve-outs) still have to be attached explicitly in the Clauses configuration step.

### Interplay with rating

Every coverage selected on this tab is a rating dimension. When the broker later configures the Base Rater, Coverages is one of the sources for rating factors. Each coverage added multiplies the number of rate permutations. Any coverage selected here without a matching rate in the Base Rater causes shipments on that coverage to fall to the No Applicable Rates Available system rule and be referred.

## Business rules & calculations

- **The Coverages tab must contain at least one entry** for the Risks step to pass validation.
- **Every coverage must have a rate** in the Base Rater. Missing rates lead to referrals under the No Applicable Rates Available rule.
- **Coverage selection drives Institute clauses on certificates automatically** — the ICC A, B, and C rules each pick their own clause set. No manual attach is needed for the standard Institute wording.
- **Coverage options come from the Choices module.** Missing options require Administrator action.
- **Coverage is available as an attribute** in custom Business Rule conditions, so brokers can build rules that fire on specific coverage types.
- **The insurer must have signed off on each coverage.** The platform does not enforce this — the broker is responsible for confirming underwriting appetite before selection.

## Related concepts

- Risks Configuration
- Risks — Conveyance
- Risks — Packing
- Rating
- Clauses
- Documents
- Policy Creation (New Business)
