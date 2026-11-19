# Bulk Upload & Exporter

## What it is

Two closely related batch pipelines: **bulk upload** ingests many shipments at once from an Excel template, and the **exporter framework** produces reports and downloadable extracts. Both use the same `xls_mapper` submodule for column-to-attribute mapping and share the row-processor pattern. This page describes both.

## Who uses it & where

- **Backend engineers** extending the bulk-upload column set or adding a new exporter.
- **DevOps** monitoring async job queues.
- **Support** helping brokers who hit upload errors or want a specific export.

## How it works

### Bulk upload — ingest side

**Endpoint:** `/api/v1/bulk-upload/` (POST with multipart file).

**Handler:** `NacoraBulkUploadHandler` in `src/clients/nacora/bulk_upload/handler.py`.

**Row processor:** `NacoraBulkUploadRowProcessor` in `src/clients/nacora/bulk_upload/row_processor.py`.

**Config:** `NACORA_SHIPMENT_BULK_UPLOAD_COLUMNS` in `src/clients/nacora/bulk_upload/configs.py` — declares each column's source (spreadsheet cell), target (shipment attribute path), type, and validation.

### Flow

1. User (participant or broker) downloads the blank Excel template from the Bulk Upload page. The template has 56 columns covering all shipment attributes.
2. User fills in rows and uploads the file via the API endpoint.
3. Handler opens the workbook with `openpyxl`.
4. For each row (skipping header + hint rows), the row processor:
   - Reads each column into a canonical dict.
   - Validates required fields (policy name, participant company, conveyance, date of departure, destination, destination country, commodity, packing, coverage, insured value, insured value currency).
   - Resolves lookups: policy name → Policy; participant company → BusinessPartner; named assured → BusinessPartner (auto-create if `BULK_UPLOAD_ALWAYS_CREATE_NAMED_ASSURED=True` and the assured doesn't exist).
   - Translates Choices values (commodity, packing, conveyance, coverage) into internal choice keys.
   - Maps date columns from `DD-MMM-YYYY` to Python `date` objects.
   - Builds the `PolicyVersionItem.attributes` and `.details` JSON structures.
5. If `conveyance = Sea`, vessel IMO is required — enforced by the row processor.
6. Rating: `ShipmentRatingResponseService` runs on each row using the current active rating version of the target policy.
7. **Optional pricing override:** if the row provides `cargo_premium`, `charges_level_1..12`, `total_cost` columns, those override the rated values — useful when the broker is backfilling historical shipments with negotiated rates.
8. **Status:** shipments are created with `status = BOOKED_BULK_UPLOADED_STATUS = 150` (Nacora-specific status distinguishing bulk-uploaded from Quote-then-Book flow).
9. Every row's outcome is logged to a `Report` and an `Activity` for status tracking. Errors get row-level messages ("Policy not found", "Invalid commodity", "Missing vessel IMO for Sea conveyance", etc.).
10. **Inline rating and referral (CGDEV-80).** Each bulk-uploaded row is now rated inline during processing. When the rating engine cannot find an applicable rate for a row, the shipment is automatically referred instead of failing. This means bulk uploads produce a mix of booked shipments (where a rate was found) and referred shipments (where no rate matched), allowing underwriters to handle exceptions through the normal referral queue rather than rejecting the entire upload.
11. **Business rules.** Previously bulk-uploaded shipments bypassed the rules engine entirely to avoid mass-referring historical data. With inline rating and referral now in place, the rules engine integrates with the bulk flow for rate-driven referrals. Full business-rule evaluation on bulk rows remains a live post-MVP ask.

### Column configuration pattern

`NACORA_SHIPMENT_BULK_UPLOAD_COLUMNS` is a list of column descriptors, each with:

- `source` — spreadsheet cell reference or column name.
- `target` — the JSON path in the shipment's `attributes` / `details` / `pricing_breakdown` where the value lands.
- `type` — string / decimal / date / lookup(choice_type).
- `required` — boolean or conditional (e.g. required when `conveyance=Sea`).
- `validator` — optional Python callable for row-level validation.

Adding a new column is a code change: add the descriptor, add the column to the blank template file, redeploy.

### Response

The endpoint returns a summary payload:

```
{
  "rows_processed": 200,
  "rows_ok": 195,
  "rows_errored": 5,
  "report_id": "<uuid>",
  "activity_id": "<uuid>",
  "error_report_url": "<presigned S3 URL to error CSV>"
}
```

The error CSV lists row number, the problematic column, and the error message. The broker fixes the file and re-uploads.

### Bulk re-rate

`bulk_rerate_shipments` (Celery task, `default` queue) — re-rate a batch of shipments against a specific rating version. Used when the base rater changes and existing shipments need re-quoting. Chains one task per shipment for progress tracking; creates a Report and Activity for status.

Parameters:

- `shipment_ids`: list of PolicyVersionItem IDs.
- `target_rating_version_id`: which version to re-rate against.
- `dry_run`: if true, compute new premiums and log but don't save.

Outcome per shipment: new premium vs. old, delta, any conflicts (e.g. now-referred where previously-booked).

### Exporter framework

**Base:** `src/api_v3/exporter/`.
**Nacora overrides:** `src/clients/nacora/exporter.py`.

Every exporter is a pair — a **Formatter** that flattens ORM objects into rows, and an **Exporter** that generates the file (CSV or XLSX).

**Registered exporters:**

| Exporter | Formatter | Purpose |
|---|---|---|
| `PolicyBillingReportExporter` | `PolicyBillingReportFormatter` | Monthly billing report per broker company. Premiums, taxes, commissions per shipment. |
| `PolicyVersionItemExportExporter` | `PolicyVersionItemExportFormatter` | Shipment export with all attributes + pricing. Used for broker download or audit sample. |
| `SpecialRateDataExporter` | `SpecialRateFormatter` | Special Rate Request data denormalised from `RiskFactorCombinations`. |
| `RiskFactorCombinationsExporter` | `RiskFactorCombinationsFormatter` | Rating catalogue export — the raw permutation table. |

**Field labels** are customised per client. `API_V3_EXPORTER_LABELS_OVERRIDES` in Nacora settings redefines column headers so exports read as business-friendly labels rather than model field names:

```
API_V3_EXPORTER_LABELS_OVERRIDES = {
  'PolicyVersionItem': {
    'number': 'Shipment Number',
    'details.named_assured.value_display': 'Named Assured',
    'pricing_breakdown.premiums.after_conversion.total_premium': 'Total Premium',
    'attributes.commodity.value_display': 'Commodity',
    'attributes.conveyance.value_display': 'Conveyance',
    ...
  },
  'SpecialRateRequest': {
    'special_rate_id': 'Special Rate ID',
    'policy_number': 'Policy No.',
    ...
  },
}
```

### Async execution and S3 storage

Large exports are async. The flow:

1. User clicks "Export" on a list page → POST `/api/v3/exporter/<name>/` with filters.
2. Server creates a `Report` row (status=PENDING), enqueues a Celery task.
3. Task runs, formatter iterates rows, exporter writes to a temporary CSV/XLSX.
4. **`USE_S3_FOR_SCRIPT_REPORTS = True`** — the file is uploaded to S3 with a random path. A presigned URL (typically 24-hour expiry) is stored on the `Report` row.
5. User polls the Report status or receives an email when ready.
6. User downloads via the presigned URL. The URL expires; a new one can be minted.

Small exports (bordereau slip previews, a handful of rows) are synchronous — the endpoint returns the CSV/XLSX directly in the response.

### Bordereau generation

Not strictly an exporter — a scheduled monthly job that produces the bordereau (slip) sent to the insurer.

- **Schedule:** first of each month (Celery Beat).
- **Aggregates:** all shipments booked in the prior calendar month, grouped by broker company.
- **Contents:** broker name, policy count, shipment count, total gross premium, total commission, total net premium, currency. Per-shipment rows also included.
- **Output:** stored as a `Bordereau` row (`src/bordeareaux/`) with an attached CSV/XLSX file (S3).
- **Event:** `bordereau.created` emits to the analytics stream and to the BMS webhook.
- **Feature flag:** none — always on.

## Business rules & constraints

- **Bulk-uploaded shipments bypass business rules today.** Post-MVP scope is to run the rules engine on upload; not yet implemented.
- **Required columns are enforced pre-rating.** Missing values → row error, no partial save.
- **Named assured auto-creation** is on when `BULK_UPLOAD_ALWAYS_CREATE_NAMED_ASSURED=True`. Turn off for tenants that manage their assured registry manually.
- **Vessel IMO is required for Sea conveyance.** Currently dormant because MVP is road-only.
- **`BOOKED_BULK_UPLOADED_STATUS = 150`** — bulk-uploaded shipments carry a distinct status flag so downstream reporting can distinguish them from Quote-then-Book flow. This status is Nacora-specific; not present on other tenants.
- **Pricing override columns are optional.** When absent, rating engine values are used. When present, they win.
- **Async exports live in S3 with presigned URLs** (24h expiry by default). The bucket has a lifecycle policy to purge old exports.
- **Bordereau numbering is sequential per broker.** Reference format: `BDX-YYYY-MM-{seq}`.
- **Exporter labels are per-tenant.** Nacora's overrides don't affect other clients on the platform.

## Related concepts

- Background Jobs & Celery
- Data Model & Entities
- APIs & Integrations
- Environments & Config
