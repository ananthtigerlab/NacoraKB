# Numbering

## What it is

Every meaningful record in NacoraHub — policies, shipments, certificates, referrals, business rules, clauses, special rate requests, endorsements, bordereaux — gets a stable, human-readable sequential number the moment it is created. Numbers are never reused. They appear on certificates, quotes, audit logs, referral emails, bordereaux, and SOAP integrations. External systems (Kuehne+Nagel operational platforms, GeoRisk, finance exports) reference records by these numbers, so the numbering scheme is treated as a contract — the patterns are fixed and consistent so parsers upstream and downstream can rely on them.

The numbering module is a shared platform capability but Nacora carries a few number-format specifics that distinguish it from other clients. Certificate numbers, for instance, are editable at issuance so an underwriter can align the certificate reference with an external banking or customs reference — a Nacora requirement not present on every deployment.

## Who uses it & where

- **Users** — see numbers everywhere: on the shipment 360 header, on the policy header, on every certificate, on every quote PDF, on every referral email subject, on the audit trail, on the bordereau download.
- **External systems** — reference records by number in every inbound and outbound integration. SOAP calls carry the policy number and shipment number in the message body; webhook posts to GeoRisk carry them in the payload; finance exports use them as the join key.
- **Support and Operations** — search by number when investigating incidents. The single most common triage question is "what's your shipment number?" or "what's the policy number?".
- **Compliance and Audit** — trace a record's full history by number across the audit trail.
- **Finance** — reconciles bordereau lines by shipment number and certificate number against the client's own accounting system.

Numbering is never a user action. Every number is assigned automatically at record creation.

## How it works

### The numbered entities

Every record type has its own counter with its own prefix. Counters live per-tenant so numbers are unique across the whole Nacora deployment but do not clash with other tenants on the same platform.

| Record type | Prefix pattern | Counter scope | Example |
|---|---|---|---|
| Policy | `MC-XXXXXX` | Deployment-wide, six-digit zero-padded | `MC-000123` |
| Shipment | `<policy-number>-XXXXXX` | Per policy version, six-digit zero-padded, continuous across MTAs and renewals | `MC-000123-000045` |
| Certificate | Defaults to the shipment number; editable at issuance | Per shipment, one active certificate at a time | `MC-000123-000045` (default) or a custom value chosen by the underwriter |
| Endorsement | Shipment number plus an incrementing suffix | Per shipment | `MC-000123-000045-E1`, `MC-000123-000045-E2` |
| Quote (draft certificate) | Shipment number plus quote token | Per shipment quote iteration | `MC-000123-000045-Q1` |
| Business Rule | `BR-XXXXXX` | Deployment-wide | `BR-000042` |
| Clause | `CLAUSE-XXXXXX` | Deployment-wide | `CLAUSE-000108` |
| Referral | `REF-XXXXXX` | Deployment-wide | `REF-001204` |
| Special Rate Request | `SRR-XXXXXX` | Deployment-wide | `SRR-000031` |
| Special Rate (approved) | `SR-XXXXXX` | Deployment-wide, allocated on Confirm Rates | `SR-000022` |
| Bordereau | `BDX-YYYYMM-<broker-slug>` | Per broker company per month | `BDX-202607-KN-PL` |
| Cancellation transaction | `CXN-XXXXXX` | Deployment-wide | `CXN-000017` |
| Bulk Upload batch | `BU-YYYYMMDD-XXXX` | Per calendar day | `BU-20260703-0002` |
| Audit event | UUID (not user-facing) | Per event | — |

Every one of the above is assigned at record creation, with no manual step for the user. There is no override on the record type — the certificate is the one exception, where the number is editable at the point of issuance if the underwriter needs to align with an external reference.

### Certificate number editable at issuance

The certificate number defaults to the parent shipment number. On the certificate issuance dialog the underwriter can override that default with a bespoke value (from I2G-30154) — most commonly to match a Letter of Credit reference, a customs declaration reference, or a bank-imposed identifier. The custom value is what appears on the printed certificate PDF and in every outbound reference to that certificate; the shipment number remains the primary internal identifier and is unchanged.

The central sequence tracking (from I2G-29882) ensures the platform still records that a certificate number has been consumed even when the user overrides it — subsequent auto-generated certificates increment past the manually-set number so collisions are impossible. If the user tries to set the certificate number to a value already in use, the platform rejects the change with an inline error.

### Shipment numbering across MTAs and renewals

Shipment numbering is careful about policy versioning. The sequence counter lives on the policy — not on the individual policy version — and is inherited when a new version is created. This means:

- **After an MTA:** the shipment counter continues from wherever the parent version left off. Shipment 46 under MTA-1 comes right after shipment 45 under the original version. No gaps, no duplicates, no restarts.
- **After a renewal:** same behaviour. The renewed version's first shipment picks up the counter where the parent's last shipment left it.

This continuity is deliberate. Brokers and participants think of "the policy" as a single ongoing arrangement even across MTAs and renewals; the shipment numbering reflects that mental model.

### Endorsement numbering on a shipment

When a booked shipment is endorsed (amended), the endorsement gets a suffix appended to the shipment number: `-E1` for the first endorsement, `-E2` for the second, and so on. The parent shipment number does not change. Every endorsement is retrievable by its suffixed number for audit and certificate re-issuance.

### Cancellation transaction numbering

When a policy or shipment is cancelled, the cancellation itself gets a `CXN-XXXXXX` transaction number recorded on the policy's or shipment's history. This is the identifier finance uses to reconcile the cancellation event on the bordereau against the policy or shipment.

Transaction Type on the affected policy is set to Cancellation, not New Business (from I2G-29994) — this ensures the cancellation transaction is categorised correctly in premium reporting.

### Bordereau numbering

Bordereaux are monthly per broker. The number format is `BDX-YYYYMM-<broker-slug>` — `BDX-202607-KN-PL` for the Kuehne+Nagel Poland bordereau covering the month of July 2026. This is the identifier finance quotes when reconciling.

### Bulk upload numbering

Each bulk upload batch gets a per-day sequence: `BU-YYYYMMDD-XXXX`. The batch number is what appears on the bulk upload dashboard and on the individual imported shipments as a marker of their origin.

### Never reused

Numbers are never reused once allocated. A cancelled policy's number is retired — the next new-business policy gets the next number in sequence, not the cancelled one. Even if a record is deleted (which is rare and normally blocked), its number is retired. This is a hard guarantee the platform makes so external systems can rely on the reference being permanent.

### No manual restart

Cancelling a policy does not roll numbering back. Cancelling a shipment does not roll numbering back. Even wiping a deployment's data does not roll numbering back if the sequence table is preserved. Restarting numbering is treated as an emergency intervention available only to the platform operator.

## Options & choices

### What is auto-generated versus editable

| Number | Auto-generated | Editable at any point | Editable at issuance only |
|---|---|---|---|
| Policy number | Yes | No | No |
| Shipment number | Yes | No | No |
| Certificate number | Yes (defaults from shipment) | No | Yes (from I2G-30154) |
| Endorsement suffix | Yes | No | No |
| Referral number | Yes | No | No |
| Business Rule number | Yes | No | No |
| Clause number | Yes | No | No |
| Special Rate Request number | Yes | No | No |
| Bordereau number | Yes | No | No |
| Cancellation transaction number | Yes | No | No |
| Bulk upload batch number | Yes | No | No |

### Where each number appears

- **Policy number** — top of every policy 360 view, top of every quote PDF, top of every certificate, on every shipment header, on every referral email, in every audit line, in every SOAP request.
- **Shipment number** — top of every shipment 360 view, on the certificate PDF, in the URL of the shipment page, on every referral email, in every bordereau line.
- **Certificate number** — printed prominently on the certificate PDF, on the shipment's Documents tab, in bordereau reconciliation.
- **Referral number** — subject line of every referral email, on the referral header, in the audit trail.
- **Special Rate Request number** — on the request header, in the request approval email, in the shipment's premium breakdown when a Special Rate is applied.
- **Bordereau number** — on the downloadable bordereau file, in the bordereau notification email to the broker.

## Business rules & calculations

- **Never reused.** A cancelled policy's number is retired; the next new-business policy takes the next number.
- **Six-digit padding on all counters** — supports up to 999,999 records per counter before overflow becomes a concern. The platform monitors sequence health and alerts operations well before the ceiling is approached.
- **Shipment continuity across versions:** counter stored on the policy (not the policy version), inherited on version creation. Continuity is the point — cancellation, MTA, and renewal all keep the same shipment counter incrementing.
- **No reset on cancellation.** Cancelling a policy does not roll numbering back.
- **Certificate number is the only editable number, and only at issuance.** Once a certificate is issued the number is locked; any change requires an endorsement, which produces a new certificate with a new suffix.
- **Central sequence tracking prevents collisions** even when the certificate number is manually overridden (from I2G-29882).
- **Transaction Type reflects the transaction, not the policy state.** A cancellation carries Transaction Type "Cancellation", not "New Business" (from I2G-29994).
- **Bordereau grouping.** Monthly per broker company; a broker with multiple sub-brokers gets one bordereau per sub-broker plus one aggregated. The number reflects the level at which the bordereau is produced.
- **Bulk upload batch numbers are per-day.** Two batches on the same day get sequential suffixes; two batches on different days start at `-0001` again.

## States & transitions

Numbering does not have a state machine of its own. Numbers are allocated at creation and never change. The only conceptual states are:

- **Allocated** — a number has been assigned to a record.
- **Retired** — the record has been cancelled, deleted, or archived; the number cannot be reused.

Every number is in one of these two states. There is no revert path from Retired to Allocated.

## Related concepts

- Policy Creation
- Adjustments (MTA)
- Renewals
- Cancellations
- SOAP Inbound Integration
- Business Rules
- Clauses
- Documents
- Bulk Upload
- Billing
