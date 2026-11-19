# Rating

## What it is

Rating is how the platform decides the premium for a shipment. Every policy in NacoraHub Embedded Cargo has its own **Base Rater** — a fully-populated table of pricing outcomes for every legal combination of risk factors the policy accepts. When a participant, broker, or automated integration submits a shipment, the platform reads the shipment's risk attributes, matches them against a single row in that table, and returns a premium.

The Base Rater is the workhorse of pricing. On top of it, the platform layers a **Special Rater** for negotiated one-off rates, a set of **Business Rule** minimums and adjustments, and daily FX conversion so that everything ultimately produces one clean quote in the policy's billing currency.

Pricing is also shaped by **Commodity Group Rate Categories**. Each commodity group can be linked to its own rate category on the policy. The rating engine reads the commodity group, looks up the rate category the policy assigns to it, and prices accordingly. If a commodity group is not linked to a rate category, the shipment is referred with a clear reason rather than priced at zero.

The Base Rater step must be completed and marked as ready before a policy can be activated. A policy that goes live with an incomplete rate table will either quote shipments incorrectly or fail to quote them at all — and the platform is deliberate about that: any unmatched combination triggers the "No Applicable Rates Available" system rule and refers the shipment to an underwriter rather than guessing.

## Who uses it & where

- **Administrators and Brokers** build and maintain the Base Rater during policy setup, and maintain the Routes and Commodity Groups lookup tables that feed it. They also come back into the rater every time risks change on the policy.
- **Participants** never see the Base Rater directly. They see the premium it produces the moment they submit a quote in the Shipment Portal.
- **Underwriters** approve overrides via the Special Rater (Special Rate Requests) when a standard cell is not appropriate for a specific customer, route, or period.
- **Broker staff** in the Back Office can manually override premium on a booked shipment. The override is stamped as an "updated rate" and preserved in the audit trail — no additional approval, the broker is the authority for their own book.
- **Analytics** consumes the resulting premium breakdown to publish shipment events with base-currency equivalents.

Rating is reached from two entry points inside the policy setup:

- **From the policy creation form (Step 8, "Rating").** Progress through policy creation until the Rating step. Click **Set up Rating** and the Base Rater opens in a new browser tab.
- **From the Policy 360 or Incomplete Policy 360 page.** Open the policy record, click the **Actions Menu** (the three-dots icon in the top right), and select **Configure Rating**.

Once open, the Base Rater page has a left panel with two sections. The **Rater** section contains **Base Rater** and **Special Rater**. The **Lookup Tables** section contains **Routes** and **Commodity Groups**. Both sections are accessed by clicking the corresponding item on the left.

## How it works

Rating in NacoraHub follows a strict order: risks first, lookup tables second, rating factors third, permutation table fourth, and rate assignment last. Skipping steps causes cascading rework, so the sequence matters.

### Prerequisites: the Risks step must be finalised

The Base Rater does not invent the values it rates over. It reads them directly from the policy's **Risks** step. The list of conveyances, packing types, coverages, commodity groups, and departure and destination countries you configured under Risks is the pool of values from which the Base Rater draws.

If you have not finished the Risks step, do not start the Base Rater. If you change the Risks step after the Base Rater is built, you must revisit the rate table — the platform will not silently backfill new combinations, and any rate table that no longer covers a real risk combination becomes an implicit referral trigger the moment a shipment matches it.

The reason this matters: activating a policy with an incomplete rate table causes quoting to fail for any unrated combination. Those shipments trigger the **No Applicable Rates Available** business rule and are referred for manual review rather than receiving a quote at booking time. That is desired system behaviour — no rate, no automatic quote — but it should be a conscious choice rather than an accident.

### Understanding permutations

A **permutation** is one unique combination of values, taken one value at a time from each configured rating factor. The Base Rater generates every possible permutation for you. Your job is to assign a rate to each one.

The count of permutations is the product of the count of values in every rating factor.

**Simple example.**

| Rating factor | Values | Count |
| --- | --- | --- |
| Conveyance | Sea, Air | 2 |
| Packing | Professionally Packed, Unpacked | 2 |
| Coverage | ICCA, ICCC | 2 |

Total permutations = 2 × 2 × 2 = **8 rows**.

**Expanded example with a lookup table added.**

| Rating factor | Values | Count |
| --- | --- | --- |
| Conveyance | Sea, Air, Road | 3 |
| Packing | 2 types | 2 |
| Coverage | 4 types | 4 |
| Route (lookup table) | 5 named route groups | 5 |

Total permutations = 3 × 2 × 4 × 5 = **120 rows**.

Every rating factor you add multiplies the row count. Every value you add inside a factor multiplies it further. This is why the Routes and Commodity Groups lookup tables exist — they consolidate raw country pairs and raw commodity codes into named groups so that the rate table stays a manageable size rather than exploding into thousands of unrateable cells.

Recommended order of work: (1) build the lookup tables so you have consolidated groupings ready; (2) add rating factors, choosing the consolidated groupings rather than the raw values; (3) assign rates to the resulting permutation table.

### Part A: Lookup Tables

Lookup tables let you consolidate many raw values into a single named group before the permutation table is generated. They are optional but strongly recommended, and are essentially always used on any policy with a non-trivial commodity list or an international routing.

There are two lookup tables: **Routes** and **Commodity Groups**. They are configured independently. Both live under **Lookup Tables** in the Base Rater's left panel.

#### Routes lookup table

The Routes lookup table groups departure and destination countries into named route groups (for example, "Asia to Europe" or "Middle East to Europe"). Once configured, the group name is what appears as a value in the rate table — not every possible pairing of every country.

To add a Route group:

- From the Base Rater's left panel, select **Lookup Tables → Routes**.
- Click **Add Item**.
- Enter a **Return Value** — this is the name the group will carry throughout the rate table. Choose it deliberately: "Asia to Europe" is more informative than "Group 1".
- Select **Departure Countries**. You can search by country name, by country code, or by region. Typing "Asia", for example, lists all Asian countries and lets you select them all in one click.
- Select **Destination Countries** using the same search behaviour.
- Click **Add Item +** to save the group.

To edit a group later, click the pencil icon on that row. To remove one, click the trash icon.

**A country can only belong to one route group.** This is a hard constraint of the platform, and it is enforced to prevent conflicting or overlapping route matching at rating time. If Germany is assigned to the group **Asia → Europe**, Germany cannot also be added to **Middle East → Europe** — the second attempt is blocked with an overlapping-route error.

The implication is that route groups must partition the countries you cover, not overlap them. Plan the whole route layout before you start adding entries. If, halfway through, you realise Germany belongs in a different group, you must first remove it from the group that currently owns it before adding it to the new one.

#### Commodity Groups lookup table

The Commodity Groups lookup table consolidates multiple individual commodity groups (the ones seeded on the policy via the Risks step) into single named categories that the rate table treats as one value.

To add a Commodity Group category:

- From the Base Rater's left panel, select **Lookup Tables → Commodity Groups**.
- Click **Add Item**.
- Enter a **Return Value** — the name of the grouped category (for example, "General Cargo").
- Select the individual commodity groups to include. Multi-select is supported, and there is a **Select All** control if the whole configured commodity list should sit in one grouping.
- Click **Add Item +** to save.

To review what a category contains, click its row to open a side drawer listing all the commodity groups included. Use the pencil icon to edit. Use the trash icon to delete.

**Why grouping matters — a worked example.** Without grouping, 20 individual commodity groups become 20 separate values in the rate table. Every other rating factor on the policy is multiplied by 20. With grouping, those same 20 commodity groups can be consolidated into (say) 2 categories — dropping the multiplier from 20 to 2 and reducing the permutation count by a factor of 10 across every combination they touch.

### Part B: Rating Factors

Rating factors are the risk dimensions the platform uses to generate the permutation table. Each rating factor you add multiplies the row count. Add only the factors that genuinely drive different pricing — every extra factor makes the rate table larger and slower to fill in.

To add rating factors:

- From the left panel, select **Rater → Base Rater**.
- Click **Configure Rate**.
- Click **+ Add Rating Factor**.
- For each factor, provide:
  - **Rating Factor Name** — the label the platform will use to describe this column in the rate table.
  - **Rating Factor Source** — where the values for this factor come from.
- Repeat for each factor you need.

The available sources are:

| Source | Available values |
| --- | --- |
| **Risk List** (drawn from Policy Step 5, Risks) | Conveyance, Packing, Coverages |
| **Lookup Tables** | Routes, Commodity Groups |

The source determines whether the rating factor pulls its values straight from the risk configuration or from a pre-built lookup grouping. If you built Routes and Commodity Groups lookup tables, you should almost always choose them here rather than the raw values.

Estimate the size of the resulting permutation table before proceeding. The multiplication is unforgiving: three factors of three values each are 27 rows; four factors of four values each are 256 rows; five factors of five values each are 3,125 rows.

### Part C: Assigning rates

Once the rating factors are saved, the platform automatically generates the full permutation table. Each row represents a unique risk combination, and every row must have a rate assigned before the Base Rater is considered complete.

To assign rates:

- Review the generated permutation table. Every combination the platform can produce from your configured factors will appear as a row.
- Use the filters above the table to narrow to specific permutations by Conveyance, Coverage, Packing, Routes, or Commodity Groups. Filtering is essential when the table is large — it lets you bulk-update rates across similar combinations rather than editing each row on its own.
- Select one or multiple rows.
- Enter the required rating values:
  - **Rate** — the pricing percentage applied to the insured value for this risk combination. Rates accept up to three decimal places only.
  - **Minimum Premium** — the floor premium for this combination. Leave blank if not applicable.
- Save.
- Repeat until every required permutation is rated.

Rows without a rate are treated as unrated combinations at submission time. Any shipment matching an unrated row triggers the **No Applicable Rates Available** system rule and is referred rather than quoted. That behaviour is intentional — it stops silent zero-rating — but it means an incomplete rate table quietly turns into a wall of referrals the moment the policy goes live. Fill in every row that represents a real, expected shipment.

When every required combination has been rated, click the **MARK AS READY** button. This is the signal that the rate table is finished and the step is ready to be closed out.

### Marking the step complete

Once the rate table is saved and marked as ready, return to the policy configuration steps.

- Click the policy name — you land on the Incomplete Policy 360 page.
- Click the three-dot **Actions** button on the Rating step.
- Select **Mark as Complete**.

The Rating step then shows as **Complete** in the step progress indicator. Combined with the other completed steps, the policy becomes eligible for activation.

After activating the policy, submit at least one test shipment covering a representative permutation from each rate group. This confirms the rating engine returns a quote correctly before participants begin submitting live shipments.

### Rating a live shipment end to end

When a shipment is submitted, the platform runs the following in order to produce a premium:

- Extract the shipment attributes: commodity group, packing, conveyance, coverage, origin country, destination country, insured value, and the currency of that insured value. Resolve the named assured and participant company. Read the policy's billing currency.
- Convert insured value into the billing currency using **yesterday's FX rate** (see the previous-day rule below). Cross-currency conversion always routes via USD.
- Look up the matching permutation on the active rating version:
  - Country pairs are consolidated into named route groups via the Routes lookup table so the matrix does not explode into every possible bilateral pair.
  - **Route matching is bidirectional** — a rate defined for Africa → Asia also applies to Asia → Africa.
- Read the base rate and minimum premium from that permutation.
- Apply overrides in this order:
  - **Special Rater override.** If an active Special Rate Request matches the shipment's permutation, its rate and minimum premium replace the Base Rater values. Only one active Special Rate is honoured per permutation — the most recently activated always wins.
  - **Business Rule minimum.** If a rule has a minimum-premium action for this shipment, the final premium is bumped up to that floor.
  - **Missing rate.** If the permutation is unrated (no cell in the Base Rater), the shipment is referred via the No Applicable Rates Available rule.
- Build the full premium breakdown: base rate, cargo premium, up to eleven configurable charge levels, total payable, FX rate used, and the base-currency (EUR) equivalent for analytics. All of this is stored on the shipment record.

### Conveyance as a rating dimension

Some policies price different conveyances at different rates — for example, a merged tariff where Air and Sea have one rate column, and Road and Rail have another. When a base-rate import sheet is priced by conveyance, the platform adds the conveyance dimension to the rating factors automatically. This expands the permutation table (for example, 242 route-commodity rows become 968 when four conveyances are added) but ensures the correct rate is applied to each mode of transport.

If the import fails after the dimension is added, the platform removes it and restores the previous rates.

### Re-rating booked shipments

Booked shipments can be re-rated after the fact — for example, when a commodity group was not priced at booking time and a rate category has since been linked. Re-rating works as follows:

- Quoted shipments are re-priced in place. The old breakdown is kept in the re-rate history.
- Booked and Endorsed shipments can be endorsed into a new version at the corrected premium.
- A shipment that billing has already invoiced is never re-priced in place. The invoiced record is left unchanged with the reason. An endorsement bills the difference.
- A shipment that re-rates to zero premium is rejected and reported as failed with the reason. Zero-premium bookings are never persisted.
- Re-rating can optionally regenerate the certificate documents and send a notification email.

The Bulk Re-rate screen endorses by default with documents and email. Individual shipments can also be re-rated from the command line.

### Rate versioning

Each policy has one active rating version at a time. A broker can create a new version by duplicating the current one and setting a future effective date. New quotes on or after that date use the new version; quotes already issued stay on the version they were quoted against. Historical PDFs are not regenerated.

There is a known UX limitation: version scheduling has no discard action. If a future rating version is scheduled by mistake, it cannot be deleted directly. To undo it, create another new version scheduled at or before the errant one so that the correct table takes precedence.

### Manual override on booked shipments

Brokers can manually change premium on a booked shipment after it has been quoted. The manual value is stamped as an "updated rate", the audit trail records the change, and no separate approval is required — the broker is treated as the authority for their own book.

## Business rules & calculations

The premium formula in plain business language:

- **Insured value in billing currency** = insured value in original currency × FX rate. The FX rate used is **yesterday's** closing rate, not a live intraday rate. Cross-currency conversions always route via USD.
- **Cargo premium** = insured value (billing currency) × rate percentage. The rate percentage comes from either the Base Rater cell for the matching permutation, or a Special Rater override for that permutation.
- **Total payable** = cargo premium + charge level 1 + charge level 2 + … + charge level N. Each charge is configured on the policy; charges can be flat amounts or percentages of a previous amount; up to eleven charge levels are supported; they are reorderable.
- **Final premium** = MAX ( total payable, business rule minimum, permutation minimum premium ). Whichever floor is highest wins.

Other rules and behaviours:

- **Previous day's rate.** FX rates sync from the upstream provider once a day at midnight. A shipment quoted at 09:00 uses the rate synced overnight, not a live intraday one. This is deliberate — it makes premium reproducible for a given day.
- **Only one Special Rate per permutation.** Creating a second Special Rate for the same permutation causes the newer one to take precedence. The older one continues to exist but is not applied to new shipments.
- **Special Rate deactivation.** Deactivating a Special Rate reverts that permutation to the Base Rater value. Nothing else on the policy changes.
- **A country belongs to exactly one route group.** Overlapping route definitions are blocked; they would cause ambiguous route matching at rating time.
- **Route matching is bidirectional.** A group defined as "Asia → Europe" also matches shipments going Europe → Asia. Do not create both directions as separate groups.
- **Unrated permutations refer, they do not silently rate at zero.** The No Applicable Rates Available system rule is a safety net against under-configuration.
- **Zero-premium bookings are rejected.** If the rating engine returns a zero total after all overrides, the booking is refused. This applies to both SOAP and REST callers.
- **Commodity groups must be linked to a rate category.** A commodity group cannot be switched on for a policy unless it is linked to a rate category. If a group is unlinked, shipments in that commodity are referred with a reason explaining which group could not be resolved.
- **Per-policy commodity lists.** Some policies define their own commodity list. When a policy has its own list, shipments are priced against the commodities on that list rather than the default commodity groups.
- **Rates accept up to three decimal places.** The Base Rater enforces a maximum of three decimal places on rate values. Values with more precision are rejected at import time.
- **Re-rating never produces a zero-premium booking.** If a re-rate finds no applicable rate, the shipment is left unchanged and reported as failed with the reason.
- **No external rater validation.** Rates are not cross-checked against an outside pricing system. The only in-product place to verify the resulting premium is the Total Cost Calculator on the shipment detail page, which shows the currency conversion and the applied rate side by side.
- **Test after activation.** Push a representative shipment through each rate group after go-live. It takes minutes and catches configuration mistakes that would otherwise fire in front of a live participant.

## Completion checklist

Before considering the Rating step complete:

- Risks in Policy Step 5 have been finalised.
- Routes lookup table has been configured (if routing is a rating factor).
- Commodity Groups lookup table has been configured (if used).
- All required rating factors have been added with the correct sources.
- The generated permutation table has been reviewed for unexpected or invalid combinations.
- A rate has been entered on every required permutation row.
- The rate table has been saved and marked as ready.
- The Rating step shows as Complete in the policy configuration steps.
- At least one test shipment covering a representative permutation from each rate group has been submitted successfully after activation.

## Related concepts

- Rating Lookup Tables
- Special Rate
- Special Rate Request Flow
- Business Rules
- Choices
- Quote Creation
- Adjustments (MTA)
