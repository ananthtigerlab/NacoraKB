# Rating Lookup Tables

## What it is

Rating lookup tables are the two consolidation layers that sit between raw risk values and the Base Rater's permutation table. They exist to keep the rate table a manageable size on any policy that covers a non-trivial number of countries or commodity groups.

There are two lookup tables:

- The **Routes lookup table** groups departure and destination countries into named route groups (for example, "Asia to Europe", "Middle East to Europe", "Domestic Poland"). Once configured, the group name is what appears as a value in the rate table — not every possible pairing of every country in the world.
- The **Commodity Groups lookup table** consolidates individual commodity groups (as seeded on the policy through the Risks step) into named categories (for example, "General Cargo", "High Value", "Hazardous"). Once configured, the category name is what appears as a value in the rate table — not every individual commodity group.

Both tables are technically optional, but in practice both are used on almost every real policy. The Base Rater's permutation table is the multiplicative product of the number of values in every rating factor — 20 raw commodity groups combined with 5 other factors easily produces thousands of rows. Consolidation into 2 categories cuts that footprint by an order of magnitude and turns the rate-setting exercise into something a human can finish in an afternoon.

## Who uses it & where

- **Administrators and Brokers** build and maintain both lookup tables during rating setup on a policy.
- **The rating engine** consults the lookup tables at rating time to resolve a shipment's origin, destination, and commodity into the corresponding group and category values, then uses those values to find the matching row in the rate table.
- **Participants and shipment writers** never see the lookup tables directly. They see the effect: their country selection lands in a particular route group, their commodity selection lands in a particular commodity category, and the platform prices accordingly.

Lookup tables live under the **Lookup Tables** section in the Base Rater's left panel, alongside the **Rater** section that contains the Base Rater and Special Rater. Both tables are reached the same way as the Base Rater itself:

- From the policy creation form's Rating step, click **Set up Rating**. The Base Rater opens in a new tab.
- From the Policy 360 or Incomplete Policy 360 page, click the Actions Menu (three-dot icon, top right) and select **Configure Rating**.

On the left panel, select **Lookup Tables → Routes** or **Lookup Tables → Commodity Groups** as required.

## How it works

### When to build them

Build both lookup tables **before** adding rating factors to the Base Rater. If a lookup table exists at the point of adding a rating factor, that factor can be sourced directly from the table — the rating factor value list is the list of named route groups (or commodity categories) rather than the raw country list (or raw commodity list). This keeps the rate table small from the moment it is first generated.

If you add rating factors first and then build lookup tables afterwards, you will have to redo the rating factors to point at the tables — and the rate table itself will have been generated at the larger, pre-consolidation size in the meantime.

### The Routes lookup table

A Route group is a named combination of departure countries and destination countries. Any shipment whose origin and destination fall into the same group is treated identically at rating time.

To add a Route group:

- From the Base Rater's left panel, select **Lookup Tables → Routes**.
- Click **Add Item**.
- Enter a **Return Value** — the name this group will carry throughout the rate table. Choose it deliberately, because the name is what shows up on every row of the rate table that references this group. "Asia to Europe" or "Domestic Poland" is more useful than "Group 1".
- Select **Departure Countries**. The country picker supports three search modes:
  - Search by country name (typing "Ger" narrows to Germany, Georgia, and so on).
  - Search by country code (typing "DE" narrows to Germany).
  - Search by region (typing "Asia" lists all Asian countries and lets you multi-select them in a single action).
- Select **Destination Countries** using the same search modes.
- Click **Add Item +** to save the group.

To edit an existing group later, click the pencil icon on that row and adjust the countries. To remove a group entirely, click the trash icon on that row.

**Overlapping route definitions are now permitted.** Route groups no longer need to strictly partition every country on the policy. Different route groups may share countries as long as the departure and destination combinations do not produce a fully ambiguous match (from I2G-30093). A worked example: a "Europe → Europe & Asia" group and a "Europe → Asia" group can now coexist — a shipment leaving Europe bound for Asia matches both, and the rating engine follows the deterministic ordering rules to pick the more specific one. The earlier behaviour was more conservative and over-flagged legitimate route layouts as duplicates; the current behaviour matches how the business actually thinks about routes.

If a shipment ends up genuinely ambiguous across two overlapping groups (the same departure and destination land in two equally-specific groups), the platform surfaces an overlapping-route error at save time on the route configuration itself — the ambiguity is caught at configuration time rather than at rating time. Route groups must therefore still be built with intent, but they no longer have to be a strict mathematical partition.

**Route matching is bidirectional at rating time.** A group defined as "Asia → Europe" also matches shipments moving Europe → Asia. Do not build both directions as separate groups — that is redundant and can lead to inconsistent rating decisions on the two directions of the same commercial lane.

**Worked planning example.** Suppose a policy covers movements between six regions: Europe, Asia, North America, Middle East, Africa, and LATAM. A sensible route layout might be:

- Europe intra-EU (all EU countries as both departure and destination).
- Europe to Asia (EU countries as departure, Asian countries as destination).
- Asia to Europe (mirror of the above, but note this is bidirectional so it may be one group).
- Europe to North America.
- Middle East to Europe.
- Africa to Europe.
- LATAM to North America.

Every EU country appears in the departure list of "Europe to Asia" and the destination list of "Europe intra-EU". This is legal — a country can belong to multiple groups as long as it is on different *sides* (departure vs destination) or across groups whose scopes do not overlap for its role. What is not legal is the same country appearing in the departure list of two overlapping route groups.

### The Commodity Groups lookup table

A commodity category is a named consolidation of multiple individual commodity groups (as configured on the policy's Risks step). Any shipment whose commodity falls into the same category is treated identically at rating time.

To add a commodity category:

- From the Base Rater's left panel, select **Lookup Tables → Commodity Groups**.
- Click **Add Item**.
- Enter a **Return Value** — the name of the grouped category (for example, "General Cargo"). This is the value that appears in the rate table.
- Select the individual commodity groups to include. Multi-select is supported. There is also a **Select All** control which includes every commodity group configured on the policy in a single click — useful when a category is meant to be the catch-all.
- Click **Add Item +** to save.

To review what a category contains, click its row to open a side drawer listing every commodity group currently included in that category. Use the pencil icon to edit the membership. Use the trash icon to delete the category entirely.

**Worked example of the impact.** Suppose the policy carries 20 individual commodity groups. Without consolidation, those 20 groups become 20 separate values in the rate table. Every other rating factor is multiplied by 20 rows.

With consolidation, the same 20 groups can be consolidated into (say) 2 categories — "General Cargo" and "Special Handling". The rate table now sees only 2 commodity values, which reduces the permutation count by a factor of 10 across every other rating factor that touches commodity.

That is a real reduction: a policy that would otherwise generate 20 × 3 × 2 × 4 × 5 = 2,400 rows collapses to 2 × 3 × 2 × 4 × 5 = 240 rows.

### Using lookup tables as rating factor sources

Once lookup tables are configured, they become available as **Rating Factor Sources** when adding rating factors to the Base Rater. The source dropdown offers two families:

- **Risk List** — draws values from the policy's Risks step: Conveyance, Packing, Coverages.
- **Lookup Tables** — draws values from the tables you built: Routes, Commodity Groups.

A rating factor sourced from the Routes lookup table will show the named route groups (not the raw country list) as its values. A rating factor sourced from the Commodity Groups lookup table will show the named categories (not the raw commodity groups) as its values.

This is the whole point of building the tables in the first place. The permutation table is generated with the consolidated values, and the rate-assignment work stays proportional to how the business actually prices the risk rather than how many countries are on the map.

### Editing or deleting an existing entry

Both tables share the same row-level controls:

- **Pencil icon** — opens the entry for editing.
- **Trash icon** — deletes the entry.

Editing a route group changes the countries it covers. Editing a commodity category changes which individual commodity groups fall inside it. Both operations affect the rate table's interpretation of future shipments immediately — a shipment that was formerly matching one group may match another after an edit.

Deleting an entry that is currently referenced by an active rate table may leave rate rows orphaned. Treat edits and deletes on lookup tables as changes that require re-testing the affected permutations.

### Base Rater sorting and filtering

The Base Rater's main permutation table supports column sorting and filtering on the rate value itself (from I2G-29582). The user can click a column header to sort by rate ascending or descending, and apply a filter to see only rows above or below a numeric threshold. This is useful when reviewing a large rate table for outliers — an ascending sort surfaces the lowest rates first, a threshold filter isolates the rows above a given percentage for spot-checking against underwriting policy.

## Business rules & calculations

- **Overlapping route groups are permitted, provided the combination remains unambiguous.** Two route groups can share countries as long as the departure and destination combinations do not produce identical scope. Ambiguous overlaps are blocked at save time.
- **Route matching is bidirectional at rating time.** A group named "Asia → Europe" also matches shipments Europe → Asia. Only build one direction of each lane.
- **Lookup tables are optional but almost always used.** Skipping them causes the permutation table to explode into thousands of rows on any real policy.
- **Build lookup tables before adding rating factors.** Rating factors sourced from the raw risk list produce a much larger permutation table than factors sourced from the lookup tables.
- **The Return Value is the visible name.** It is what appears in the rate table, in filters, and in reporting. Choose a business-meaningful name — "General Cargo", "Asia to Europe" — not a numeric code.
- **Consolidation is multiplicative in effect.** Reducing a factor's value count from 20 to 2 divides every downstream row count by 10 wherever that factor is combined with others.
- **Edits and deletes affect future shipments immediately.** They do not retroactively re-rate past shipments — the rating version pinned at the time of the earlier quote controls its outcome — but the next shipment quoted after the edit will follow the new consolidation.
- **A category can Select All.** For policies where every commodity group belongs in a single category, the Select All action populates the membership in one click.

## Related concepts

- Rating
- Special Rate
- Special Rate Request Flow
- Choices
- Business Rules
- Policy Creation
