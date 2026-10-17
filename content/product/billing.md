# Billing

## What it is

Billing is how Nacora tracks commissions, generates bordereau reports for each broker, and hands premium data off to the finance systems. Every booked shipment carries a commission calculation — a percentage of the total premium that flows to the broker, with the balance being net premium to the insurer. Monthly bordereaux roll all of a broker's shipments into a single reconciliation document.

## Who uses it & where

- **Finance team** works with the bordereau reports and commission statements.
- **Broker managers** see commission summaries per policy.
- **Data exporters** produce CSV/XLSX files for downstream accounting systems.
- **Analytics** consumes bordereau events to feed the data warehouse.

## How it works

1. When a shipment is booked, its total premium is known. The system reads the commission rate from the policy (or the broker company's default rate if the policy doesn't override it).
2. A Transaction record is created with the gross premium, the commission percentage, the commission amount, and the net premium.
3. On the first of every month, a cron job aggregates all shipments booked during the previous month, grouped by broker company.
4. A Bordereau record is produced for each broker, containing every shipment number, gross premium, commission, net premium, and the reporting currency.
5. The bordereau is available as a CSV/XLSX download from the exporter interface.
6. A `bordereau.created` event is emitted to the analytics stream so the finance data warehouse can pick it up.

## Business rules & calculations

The core commission formula (plain English):

- **Commission Amount** = Total Premium × ( Commission % ÷ 100 )
- **Net Premium** = Total Premium − Commission Amount

Other rules:

- **Rate source:** the policy overrides the broker company default. If the policy has no explicit rate, the broker's default rate is used.
- **Currency:** commissions stay in the policy's billing currency for the shipment-level records; the bordereau converts everything into EUR (the analytics base currency) for cross-broker aggregation.
- **Cadence:** monthly, on the first, for the prior calendar month.
- **Included shipments:** only Booked and Endorsed shipments enter the bordereau. Quoted, Referred, and Declined shipments are excluded.
- **No-refund handling:** cancellations that produce refunds are handled externally by the billing system; the platform emits the cancellation event but does not book the refund itself.
- **Premium display logic — Minimum Premium vs Cargo Premium.** When a shipment's premium is set by the Minimum Premium (because the rated cargo premium is below the floor), the certificate, the quote, and the billing reports show the Minimum Premium and hide the Cargo Premium line. When the Cargo Premium exceeds the Minimum, the certificate shows the Cargo Premium and hides the Minimum Premium line (from I2G-30188). This avoids the visual confusion of the two lines appearing side-by-side with only one of them driving the actual premium.
- **Currency support: LBP.** Lebanese Pound (LBP) is now available in both the Billing Currency selector on the policy and the Insured Value Currency selector on the shipment (from I2G-30044). This was added to support the client's Middle East book.
- **Premium in Insured Value currency on reports.** Billing reports now include the premium expressed in the shipment's insured-value currency alongside the standard billing-currency figure (from I2G-29590). Where a shipment is billed in EUR but insured in USD, the report line carries both — the EUR premium (as before) and the USD-equivalent premium computed at the shipment's FX rate. This makes reconciliation easier for participants who track their book in the insured-value currency rather than the policy's billing currency.

## Related concepts

- Rating
- Policy Creation
- Cancellations
- Special Rate
- Analytics & Reporting
