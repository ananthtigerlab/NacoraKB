# Choices

## What it is

Choices are the fixed pick-lists that power almost every dropdown in NacoraHub Embedded Cargo: commodity groups, packing types, conveyances (Air, Sea, Road, Rail, and multimodal combinations), coverage types, currencies, and countries. Each choice carries a short internal identifier and a set of display attributes — a name, a symbol where relevant, a code, and optional metadata such as descriptions and worked examples.

Choices are the raw material from which policies are built. Which commodities a policy covers, which packing methods it accepts, which conveyances participants can book, which coverage types are available on a certificate — all of these are decided by selecting from the Choices catalogue. The rating engine then uses the same choice identifiers as its lookup key into the rate table, so a policy's Choices selection propagates directly into what shipments can be quoted.

The Nacora tenant maintains its own choice values on top of the platform-wide set, and per-policy selection further narrows what participants see in a given policy's forms.

## Who uses it & where

- **Administrators** seed and maintain the Nacora-specific choice values — commodity groups, currencies, packing types, coverage types, conveyance modes, and countries.
- **Policy builders (Administrators and Brokers)** select from the Choices catalogue when configuring a policy's Risks tabs — Conveyance, Packing, Coverages, Commodity Group, and the Departure & Destination Countries tabs.
- **Shipment writers** — participants and brokers filling in the quote form — pick from whichever subset of the Choices catalogue the policy has surfaced for that shipment context.
- **The rating engine** uses the choice identifiers as lookup keys into the Base Rater and the Special Rater.
- **Inbound automated integrations (SOAP)** translate external partner codes into the internal choice identifiers before the shipment reaches the rating engine.

## How it works

### Choices seeding at the tenant level

Choices are grouped into types — one type per dropdown domain. There is a commodity group type, a currency type, a conveyance type, a packing type, a coverage type, a country type, and so on. Each type holds many individual choice values.

Values are seeded when the Nacora tenant is provisioned. The commodity group set is populated from a Nacora-supplied Excel file grouped by category; the supported currency set covers 30-plus codes (USD, EUR, GBP, JPY, CNY, and many more). Additional values can be added over time.

### Per-policy selection during Risks setup

Once the tenant-wide catalogue exists, each policy chooses which subset of it is available on that policy. This is done through the Risks step of policy setup, which has five tabs:

- **Conveyance tab.** Defines the transport modes the policy covers — Air, Sea, Road, Rail, and multimodal combinations. Each conveyance carries its own **shipment backdating tolerance**, expressed as the number of days a participant is allowed to backdate a shipment's departure date. Shipments that exceed the tolerance are automatically referred. To add a conveyance, open the Conveyance tab, click Add, pick the mode from the drawer, set the backdating tolerance, and click Add. To set or change the tolerance later, hover the row and click the pin icon.
- **Packing tab.** Lists the packing types the policy accepts (Professionally Packed, Unpacked, and any others configured on the tenant). The insurer's underwriting appetite frequently depends on how cargo is packed, so this tab is where that scope is bounded.
- **Coverages tab.** Lists the coverage types available under the policy — ICCA, ICCC, and any others the tenant has enabled. The chosen coverages drive three downstream things: pricing (via the rating step), business rules, and which clauses appear on certificates. It is essential that the insurer has agreed to underwrite every coverage listed here — adding a coverage the insurer has not signed off on creates a quote the customer cannot actually claim against.
- **Commodity Group tab.** Behaves differently depending on the policyholder's Nature of Business (set on the policyholder's Business Partner record). For a **Freight Forwarder** policyholder, commodity groups are auto-generated from the Choices list — administrators cannot manually select or modify them. The AI-assisted commodity suggestion in the shipment form uses this generated set. For a **Shipper / Consignee** policyholder, commodity groups are defined manually on the tab: open the tab, click Add, enter the Commodity Group Name and Description, and Save. The manually defined groups become the only options participants see in the shipment form for that policy, and the AI-assisted commodity suggestion is not used.
- **Departure & Destination Countries tabs.** All active countries from the Choices list are automatically included on every policy. Participants can select any active country as a departure or destination. There is no manual per-policy country selection.

Each Risks tab has its own grid and validation. Tabs with validation errors show a visible error indicator in the tab bar. Every tab that carries an entry into the rate table (Conveyance, Packing, Coverages, Commodity Group) also implicitly seeds the Base Rater — the rating step must have a rate for every configured combination of these values.

### How Choices flow into the rating engine

Choices are the primary input to the rating lookup. When a shipment is submitted:

- The platform extracts each shipment attribute — commodity group, packing, conveyance, coverage, origin country, destination country, insured value, insured-value currency.
- Each attribute is expressed as a choice identifier rather than free-text.
- Country pairs are consolidated into named route groups via the Routes lookup table (see Rating Lookup Tables) so the matrix does not explode into every bilateral pair.
- Commodity groups may be consolidated into named categories via the Commodity Groups lookup table for the same reason.
- The rating engine looks up the matching permutation on the policy's active rating version and returns the base rate, minimum premium, and any special-rate override.

If a shipment carries a choice that is not present on the policy's active Choices selection, the platform blocks the quote — a stricter per-policy choice list can be applied so participants only ever see the values the policy actually supports.

### External code translation for inbound integrations

Automated shipment inbound (from Kuehne+Nagel via SOAP) does not send Nacora choice identifiers directly. It sends the external partner's codes: for example, `FS` for sea freight, `A` for air freight, and numeric commodity codes from the Salog catalogue. Before the rating engine sees any of these values, a Salog code map translates each external code into the corresponding internal choice identifier.

A bi-directional lookup service handles the reverse direction — turning an internal choice identifier back into whatever external code the counterpart system expects. This preserves the internal choice model as the single source of truth while still allowing round-tripping with external systems.

### Coverage: what "ICCA" and "ICC-A" mean here

Coverage codes for the Institute Cargo Clauses variants are the practical piece of terminology to know:

- Both `ICCA` and `ICC-A` are accepted forms for the same coverage — the platform recognises both spellings.
- `ICC-B` and `ICC-C` are recognised but not yet seeded for rating in the Nacora tenant.
- The chosen coverage drives which Institute clause appears on the certificate — this is enforced through the Clauses layer, not the rating layer.

### Note on the Choices administration flow

The official product documentation does not include a dedicated page for the Choices administration flow — how administrators add or edit tenant-level choice values, manage the Salog code map, or curate seed examples on commodity groups. What is documented is the *consumption* side: how the Risks tabs use Choices, how the Commodity Group tab behaves depending on nature of business, how countries are auto-included, and how the AI commodity suggestion uses seeded examples. The administration surface itself exists in the product but is currently covered only by internal knowledge and code-level references rather than published documentation. This is a documentation gap rather than a product gap.

## Business rules & calculations

- **Unknown commodity → integration fault.** If inbound SOAP sends a commodity code that is not present in the Salog code map (for example, the catch-all "9999 — others, not mentioned above"), the shipment is rejected with a `COMMODITY_NOT_MAPPED` SOAP fault. It does not silently rate at zero. That is the correct behaviour — an unmapped commodity is a data-quality issue that has to be resolved before the shipment can be rated.
- **Coverage codes have accepted aliases.** ICCA and ICC-A both work. ICC-B and ICC-C are recognised but not seeded for rating on the Nacora tenant today.
- **Conveyance drives validation elsewhere.** Sea conveyance requires a vessel IMO number at bulk-upload time; Air conveyance does not. Once sea freight is enabled beyond the current road-only MVP, the vessel classification (IACS) and vessel age business rules will also activate for sea shipments.
- **Packing drives rating.** "Professionally Packed" versus "Unpacked" flows into the rating engine as a factor and can change the final premium in that policy's rate table.
- **Backdating tolerance is a per-conveyance property.** Each conveyance carries its own tolerance in days. Shipments that exceed it are referred, not declined.
- **Countries are auto-included, not per-policy selected.** Every active country in the Choices list is available as a departure or destination on every policy. Country scope is expressed indirectly via Routes lookup groups on the rate table, not by hiding countries at the policy level.
- **Commodity group behaviour depends on nature of business.** Freight Forwarder policyholders get the auto-generated Choices list plus the AI commodity suggestion; Shipper / Consignee policyholders get a manually defined list with no AI suggestion.
- **Changing nature of business after Risks is configured clears commodity groups.** The Commodity Group tab prompts a clear-and-restart when the policyholder's nature of business flips between Freight Forwarder and Shipper / Consignee.
- **Per-policy choice validation.** Each policy can opt into a stricter choice list, in which case only a subset of the global Choices values is allowed. Submissions that reference a value outside that subset are rejected before rating.

## Related concepts

- Rating
- Rating Lookup Tables
- Commodity Group Suggestion
- Policy Creation
- SOAP Inbound Integration
- Third Party Integrations
