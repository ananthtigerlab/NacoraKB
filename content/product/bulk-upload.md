# Bulk Upload

## What it is

Bulk Upload is the batch path for brokers and participants who need to submit many shipments at once. The user downloads an Excel template, fills it in, and uploads it. The platform reads every row, validates the columns, resolves lookup values (policy names, participant companies, named assureds, choice codes), rates the shipments, and creates them directly as Booked — bypassing the Quote-then-Book flow entirely. Failed rows come back in a downloadable error report.

## Who uses it & where

- **Participants** in the Shipment Portal — the primary users.
- **Broker staff** in the Backoffice can also trigger uploads.
- **Admins** can push files through when brokers or participants have upload issues.

## Scope evolution (important)

Bulk upload was originally scoped as **post-MVP** but was pulled forward at client request. The MVP delivery ships bulk upload in a limited "read-only" form:

- Bulk-uploaded shipments are created as Booked.
- They cannot be edited afterwards through the normal shipment edit UI.
- Business rules do not re-run on them.
- Rate amendments are not permitted through the standard update flow.

**Post-MVP: Business Rules validation on bulk upload (backlogged as I2G-29926).** The planned enhancement is to run bulk-uploaded shipments through the full Business Rules pipeline in the same way as portal-declared shipments. Under the enhanced flow:

- Shipments matching a Refer rule move to Referred and enter the normal referral workflow.
- Shipments matching a Decline rule move to Declined with the rule's reason stamped on the record.
- Shipments passing every rule (or matching no rule) proceed to **Booked – Bulk Upload** and are treated as normal booked shipments from that point on.

This changes the current MVP behaviour, where Business Rules are bypassed entirely on bulk-uploaded rows. The MVP behaviour is intentional as a shortcut for the initial go-live; the post-MVP enhancement restores full parity with the portal path.

**On-demand certificate generation.** The Shipment 360 Documents tab includes a **Generate Certificate** action for bulk-uploaded shipments (from I2G-29926). Because bulk-uploaded shipments skip the Quote step, there is no automatic certificate produced at booking; the action lets the participant or broker generate the certificate PDF on demand from the shipment record.

**Further client ask:** bulk upload of **policy** data (not just shipments) — a future request.

## How it works

1. User downloads the blank template — 56 columns covering policy name, participant company, named assured, conveyance, dates, destination, commodity, packing, coverage, insured value + currency, billing currency, cargo premium, up to 11 levels of charges, total cost, and more.
2. User fills the sheet and uploads it via the Bulk Upload / Import Policy page.
3. The bulk-upload handler opens the workbook and iterates rows (header and hint rows skipped).
4. For each row:
   - Required fields checked. Missing values → row error.
   - Policy name resolved to a Policy record.
   - Participant Company resolved to a Business Partner.
   - Named Assured resolved. If missing and the setting allows it, auto-created with minimal fields.
   - Column values mapped to shipment attributes using the Nacora column configuration.
   - If conveyance is Sea, a vessel IMO is required (activates for sea shipments; road-only in MVP means this is normally skipped).
   - Rating runs on the row (base or SRR).
   - Shipment created with a "Bulk Uploaded" Booked status.
5. Row-level results are logged. On completion, the user gets a summary (rows processed, errors, warnings) and a downloadable error report identifying the row number and reason for every failure.

## Bulk upload for Special Rates

Alongside shipments, the platform supports bulk upload of **Special Rates** (from I2G-29868 and I2G-30080). The user downloads the Special Rates template from the Special Rates dashboard, fills it in with policy, scope, and combination-level rates, and uploads. The backend validates every row, creates the corresponding Special Rate Requests (with combinations pre-populated), and returns an error report for anything that failed validation. This is the batch path when a broker or Nacora is publishing many rates at once — for example, at the start of a new pricing period.

## Bulk rerate of booked and quoted shipments

The Special Rates dashboard also exposes a **bulk rerate** action (from I2G-29828 and I2G-29826). This takes a set of already-booked or already-quoted shipments and re-runs the rating engine against a new Base Rater version or a new Special Rate. It is the corrective mechanism when a rate change needs to propagate back to existing shipments rather than only forward to new ones. Rerated shipments carry a marker on the audit trail identifying the bulk operation that touched them, and premium deltas surface in the standard billing reports.

## Business rules & calculations

- **Required columns:** policy name, participant company, conveyance, date of departure, destination, destination country, commodity, packing, coverage, insured value, insured value currency.
- **Conditional required:** vessel IMO only when conveyance is Sea (dormant in road-only MVP).
- **Date format:** `DD-MMM-YYYY` (e.g. `15-Jan-2025`).
- **Currency codes:** ISO three-letter (USD, EUR, PLN, GBP…).
- **Pricing columns are optional.** If pricing is provided, it overrides the rated values — useful when the broker is booking historical shipments with negotiated rates.
- **Named assured auto-create** is enabled: if the sheet references a named assured that doesn't exist, the platform creates it on the fly with the country from configuration.
- **Bulk-uploaded shipments carry a distinct status flag** so downstream reporting can distinguish them from normal Quote-then-Book shipments.
- **Business rules do NOT run today on bulk rows** — this is exactly the post-MVP ask (I2G-29926 in Backlog).
- **Preferences persist across sessions.** Bulk upload listing pages — filter state, page size, column sort — remember the user's selections between sessions (from I2G-30185). Coming back the next day, the view opens as it was left. See Shipment Preference Persistence.

## Related concepts

- Quote Creation
- Business Partner
- Choices
- Rating
- SOAP Inbound Integration
- Shipment Preference Persistence
