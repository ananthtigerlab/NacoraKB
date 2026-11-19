# Billing Enhancements

Billing enhancements are a set of improvements to how Nacora prices, bills and reports shipments. They cover per-shipment billing currency, charge detail transparency in bordereau events, and CIEL reference fields in search and reporting.

## Who uses it and where

Brokers and policyholders see billing amounts on the Shipment Portal at nacora-sp.i2go.io. Administrators manage billing settings in the back office at nacora-bo.i2go.io. BMS (the broker management system) receives bordereau events with enriched charge details. Finance teams consume billing reports with CIEL references.

## How it works

### Per-shipment billing currency

A policy can be configured so that each shipment bills in its own insured value currency rather than the policy's single billing currency. When this option is ticked:

- Each new shipment bills in whatever currency its insured value is stated in, with no foreign exchange conversion
- One policy can therefore bill in several currencies across its shipments
- The rule a shipment was first priced under is stamped in its details and kept through endorsements, bulk re-rates and bulk uploads
- A policy MTA (mid-term adjustment) only affects new shipments. Shipments priced before the change stay on the currency they were originally billed in.
- If the insured value currency changes during an endorsement, the billing currency moves with it.

When the option is unticked, the policy billing currency applies to all shipments with conversion as before.

Ticking the option no longer wipes the selected insured value currencies from the policy settings.

### Charge details in bordereau events

Each billed shipment row in a bordereau.created event now carries charge details alongside the existing charges columns:

- Charge ID
- Charge name
- Charge type
- Charge basis
- Value type
- Value
- Currencies

The details are aligned by position with the existing charges columns so BMS can show what each charge is and what it covers. Reversal rows reuse the invoiced snapshot's details. The CSV export and the existing charges key are unchanged.

### Billing report charge columns

Billing report charge columns are now named after the actual charge rather than using generic column headers. Unused charge columns are dropped from the report.

### CIEL name in shipment search

Conveyance and CIEL Name are now available as columns in shipment search results, making it easier to find and filter shipments by their CIEL reference.

## Business rules and calculations

- Per-shipment billing currency is a policy-level setting. Changing it does not retroactively re-bill existing shipments.
- The pricing rule stamp is immutable once set on a shipment — it survives endorsements and re-rates
- Bordereau charge details are informational. They do not change how amounts are calculated.
- Migrated policies carry the drop's billing currency, cut-off dates, insured-value currencies and backdating tolerance

## Related concepts

- Rating — pricing determines the amounts that flow into billing
- Cancellations and Endorsements — endorsement currency changes interact with billing currency rules
- Policy Migration — migrated policies inherit billing settings from the source drop
- SOAP Inbound Integration — Salog-booked shipments are billed under the same rules
- Shipment Search — CIEL name now searchable alongside other shipment fields
