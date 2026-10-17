# Risks — Departure and Destination Countries

## What it is

The Departure Countries and Destination Countries tabs are two of the tabs inside the Risks step of the Marine Cargo policy wizard. Unlike the other Risks tabs, they are not configured per policy — every active country from the Choices country list is included automatically on both tabs.

The purpose of these tabs is not to restrict which countries can be used on shipments (that restriction, when needed, comes from the Routes Lookup Table in Rating or from custom Business Rules), but to expose the country list to the rating engine and to give participants the full picture of what is technically available on the shipment form.

## Who uses it & where

- **Brokers and Producers** — see the auto-populated country lists during the Risks step and do not need to make any selections. During endorsement the tabs behave the same way.
- **Administrators** — control what appears here through the country list in the Choices module. Adding a country in Choices makes it appear on both tabs across every policy; deactivating it removes it.
- **Rating Configuration** — reads the country lists when building the Routes Lookup Table. The lookup table is where countries are grouped into named routes for rating purposes (for example Asia to Europe).
- **Participants** — see all active countries in the departure and destination dropdowns on the shipment submission form.

## How it works

### The two tabs

The Departure Countries tab and the Destination Countries tab display the same list — every country from the Choices country list that is currently marked Active. There is no configuration UI on either tab beyond viewing the list; there is no Add or Remove action to take.

### Where restrictions actually come from

Because the tabs themselves impose no restriction, restrictions on eligible countries happen at two other points in the platform:

- **Routes Lookup Table in the Rating step.** The broker builds named routes by picking a Return Value (a route name like Asia to Europe), a set of Departure Countries, and a set of Destination Countries. Each route becomes a single value the rating factor can use. Countries not covered by any route in the lookup table will not match any rate, and shipments to or from those countries will fall to the No Applicable Rates Available system rule and be referred.
- **Custom Business Rules.** The broker can build a rule with a condition like Departure Country equals X or Destination Country equals Y and an action such as Trigger Referral or Attach Clauses. This is how country-specific handling is layered on top of the base rate.

### Where the country list comes from

The country list is a deployment-level master list maintained by the Administrator in the Choices module. Every country has an Active or Inactive status; only Active countries appear on the tabs. The same list drives the departure and destination dropdowns on the shipment form.

If the customer needs to ship to or from a country that is not in the active list, the fix is at the Administrator level — add the country to Choices and mark it Active — not at the policy level.

### How countries feed rating

When configuring the Base Rater, the broker builds the Routes Lookup Table by selecting Departure Countries and Destination Countries into named route groupings. These groupings dramatically reduce the number of rate permutations because a set of countries can be treated as a single rating value.

Example: if the broker groups all Asian countries into one route origin and all European countries into one route destination, and rates the Asia-to-Europe route once, that single rate covers many country-to-country pairs. Adding the same country combinations as individual rows would multiply the permutation count considerably.

## Business rules & calculations

- **The Departure and Destination Countries tabs are auto-populated from the Choices country list.** No per-policy selection is possible.
- **Only active countries appear.** Deactivating a country in Choices removes it from every policy's tabs and from participant dropdowns.
- **Restriction happens through Rating (Routes Lookup Table) and Custom Business Rules, not through these tabs.** Countries not covered by any route in the lookup table cannot be rated and shipments to or from them are referred.
- **Adding a new country requires Administrator action in the Choices module.** There is no per-policy way to add a country.
- **The same country list drives both the Departure and Destination dropdowns on shipment forms.** They are not separately configurable.

## Related concepts

- Risks Configuration
- Rating
- Choices
- Business Rules
- Policy Creation (New Business)
