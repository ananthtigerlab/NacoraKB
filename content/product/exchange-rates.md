# Exchange Rates

## What it is

Exchange Rates is the administrative module that manages the foreign-exchange rate table used everywhere the platform converts money — rating a shipment in one currency against a policy billed in another, computing base-currency premiums for analytics, expressing minimum premiums, printing certificates in multi-currency deployments. Every conversion the platform does at rating time or reporting time draws from this table.

Rates are stored as pairs (from-currency → USD and USD → to-currency, so any cross-rate goes through USD as pivot) with an effective date. The table is refreshed daily against the platform's configured FX provider (CurrencyAPI.com in the current deployment) so quotes issued today use the previous day's closing rate. Administrators can also inspect, override, and backfill rates manually when the automated sync has failed or when historical figures need correction.

## Who uses it & where

- **Administrators** — read, refresh, override, and audit the rate table via the Exchange Rates sidebar module in the Backoffice.
- **Rating engine** — silently consumes rates during every shipment quote and every re-rate.
- **Bordereau generation** — reads rates to convert every shipment's premium into the analytics base currency (EUR) for cross-broker aggregation.
- **Analytics warehouse** — consumes the same base-currency figures for BI dashboards.
- **Finance** — reconciles bordereau totals against their own accounting system; occasionally challenges a rate that produced an unexpected number.

The module lives in the Backoffice under Admin → Exchange Rates. Participants never see it.

## How it works

### The daily sync

A scheduled background job runs at midnight UTC. It calls the FX provider, retrieves USD-cross rates for every currency the tenant has enabled, and writes each rate into the Exchange Rates table with the effective date set to today. Shipments quoted throughout the day use these rates — effectively **yesterday's closing rate** since the midnight sync captures the previous day's close.

If the daily sync fails (provider unreachable, API-key rejected, quota exceeded), the previous day's rates remain in effect — the platform does not silently guess. An administrator sees a red banner on the Exchange Rates module and receives an alert email. Manual re-run of the sync is available from the module.

### Manual override

An administrator can set a specific rate manually — either to backfill a missing rate, to correct an obviously wrong figure, or to lock a rate for a specific promotional or contractual period. Manual overrides are timestamped, attributed to the administrator, and shown in a distinct colour in the rate table so downstream investigators can distinguish "provider-supplied" from "manually set" values.

### Cross-currency via USD pivot

Every conversion goes through USD. To convert EUR → JPY, the platform multiplies EUR→USD by USD→JPY. This is deliberate: it keeps the table storage linear (N currencies means N rate pairs, not N² pairs) and it aligns with how the FX provider publishes its data. The pivot is invisible to the user — a rating call for a EUR policy with a JPY-denominated insured value simply gets the right converted figure.

### Missing rate handling

If the platform needs a rate that isn't in the table (e.g. a new currency the participant has selected but administrators haven't seeded), the rating call returns a **missing-rate error** rather than a zero premium or a 1:1 fallback. The shipment goes into referral with the "Missing exchange rate" reason. Ops resolves by adding the rate to the table and re-rating the shipment.

## Options & choices

| Option | Effect |
|---|---|
| Sync now | Manually re-run the daily sync against the FX provider |
| Add rate | Manually add a new currency + rate to the table |
| Edit rate | Override an existing rate; requires a reason and audit trail |
| Deactivate currency | Remove a currency from selectable lists across the platform (does not delete historical rates) |
| Export rate history | Download the full rate history as CSV for audit |
| View audit log | Filter the audit trail to Exchange Rates entries only |

## Business rules & calculations

| Rule | Behaviour |
|---|---|
| Sync cadence | Daily at midnight UTC |
| Rate age | Shipments quoted today use rates fetched at midnight (previous day's close) |
| Cross-rate pivot | Always via USD; direct A→B rates not stored |
| Missing rate | Referral with "Missing exchange rate" reason; no silent 1:1 |
| Provider failure | Yesterday's rates remain in effect; alert to admin; manual re-run available |
| Manual override | Timestamped, attributed, distinct colour in UI, exportable in audit |
| Deactivate | Currency vanishes from selectable lists; historical rows preserved |
| Base currency | EUR by tenant convention; all analytics aggregations converted to EUR |

## States & transitions

Rates themselves are not stateful in a workflow sense — each row is a value at an effective date. What matters operationally is the **sync status**:

| Status | Meaning | Transition |
|---|---|---|
| Fresh | Today's midnight sync succeeded | Automatic; next transition on tomorrow's sync |
| Stale | Today's sync failed; yesterday's rates still active | Manual "Sync now" or automatic retry on next midnight |
| Manually overridden | Administrator set a specific value | Persists until overwritten by another manual set or by a subsequent successful sync |

## Related concepts

- Rating
- Billing
- Analytics & Reporting
- Choices
- Third-Party Integrations
