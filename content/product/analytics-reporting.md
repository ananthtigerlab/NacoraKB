# Analytics & Reporting

## What it is

Every material Nacora event — shipment booked, policy activated, cancellation processed, bordereau created — is streamed into a data warehouse for reporting and BI. A Nacora-specific enrichment adds broker cluster, region, and EUR-base-currency amounts so cross-broker aggregation is meaningful. Downstream, Athena, Looker, and QuickSight power dashboards for executives, finance, and operations.

## Who uses it & where

- **Executives** — premium trends, top brokers, retention.
- **Finance** — bordereau reconciliation, commission accuracy, gross vs. net premium by region.
- **Operations** — shipment volumes, approval times, referral rates.
- **Data engineers** maintain the warehouse ingestion pipelines.

## How it works

1. When a shipment is booked, a post-save signal on the shipment record fires.
2. The Nacora shipment serialiser builds the analytics event: shipment number, policy number, premium, commodity, coverage, named assured, broker, underwriter, timestamps, FX rate used, base-currency premium.
3. The event is enriched: broker cluster (from the analytics cluster map), region (from the country choice metadata), EUR conversion.
4. The event is published to **AWS Kinesis Firehose**, which lands the event stream in S3 for downstream materialisation (from I2G-29865). Firehose is the delivery layer between the transactional platform and the analytics warehouse; it handles buffering, retries, and batched writes without the platform having to manage that itself.
5. A nightly Athena job materialises the stream into warehouse tables.
6. BI tools query those tables.
7. Similar pipelines exist for policy activation, cancellation, and bordereau creation.

### Dashboard data sources

The analytics warehouse consumes several distinct data streams which the executive and operations dashboards join together (from I2G-29922):

- **KN shipment data** — the full shipment stream from Kuehne+Nagel's operational systems, forming the reference set of what KN itself shipped over the period.
- **Nacora insured shipments** — the shipments actually declared and insured through the NacoraHub platform. Comparing this against KN's own shipment stream is the primary measure of penetration.
- **Claims data** — claims raised against the insured shipments, sourced from the claims-handling system.
- **Premium data** — the premium recognised on each insured shipment, sourced from the bordereau stream.
- **Customer segmentation** — the segmentation attributes (industry, size, region) needed to slice premium and penetration by customer type.
- **FX rates** — the exchange-rate table used to normalise every monetary figure into EUR for cross-broker aggregation.

**Phase 2 future integrations.** Two additional sources are on the phase-two roadmap and not yet live: **myKN** (Kuehne+Nagel's customer-facing portal) and **SALOG** (an internal logistics application). Both are earmarked for the phase-two Bulgaria/Croatia/Hungary rollout alongside the sea/air/rail activation described on the Shipment Portal page. See Embed Dashboard for the customer-facing surface these data sources ultimately populate.

## Business rules & calculations

- **Base currency: EUR.** All premium aggregations are done in EUR so brokers priced in USD, GBP, or JPY can be summed side-by-side.
- **Missing FX rate:** the base-currency amount is null. The row is excluded from aggregations rather than silently converted at 1:1 — this is a deliberate accuracy safeguard.
- **Broker cluster:** each broker company is mapped to a cluster (e.g. `EMEA-North`) in the analytics settings. Unmapped brokers fall into `Other`.
- **Stale-sync mode** exists but is off by default: when enabled, a nightly job re-emits shipments that were edited outside the normal flow, allowing analytics to recover from admin data-fixes.

## Related concepts

- Rating
- Billing
- Webhooks & Event Stream
- Audit Trail
- Business Partner
- Embed Dashboard
