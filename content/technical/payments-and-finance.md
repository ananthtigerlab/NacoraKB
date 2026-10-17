# Payments & Finance Architecture

## What it is

Nacora records the financial lifecycle of every insured shipment but does not itself close the books. The platform generates ledger entries (`Transaction`), commission lines (`Commission`), bordereaux (`Bordereau`), and payments (`Payment`); the sister **BMS system** is the ultimate reconciler and invoicing engine. This page describes the models, the signal-driven emit flow, and the boundary where Nacora hands data off to BMS.

## Who owns it / who touches it

- **Backend engineers** wiring new financial events or debugging a missing ledger entry.
- **Finance / billing team** consuming the bordereau + BMS webhook events.
- **Data engineers** validating the analytics stream numbers against the transactional store.
- **On-call** debugging a missed BMS sync webhook.

## How it works

### Ownership boundary

Nacora is a system of *record* for shipment-level pricing and bordereaux, but not a system of *reconciliation*. Cash allocation, invoicing, and commission payout happen in BMS. Nacora emits events; BMS consumes.

### The financial models

Under `src/payments/`, `src/commissions/`, `src/bordeareaux/`, and `src/finances/`:

| Model | Location | Purpose | Key fields |
|---|---|---|---|
| `Transaction` | `src/payments/models.py` | Ledger entry — one row per debit / credit / reversal on a policy or shipment. | `policy` (FK), `policy_version` (FK), `policy_version_item` (FK, optional), `type` (DEBIT / CREDIT / REVERSAL), `amount`, `currency`, `description`, `created_at`, `posted_at`, `related_transaction` (FK self for reversals) |
| `Commission` | `src/commissions/models.py` | Broker/agent commission line. | `policy_version_item` (FK), `broker` (FK BP), `amount`, `currency`, `rate` (percentage), `status` (PENDING / APPROVED / PAID / REVERSED), `paid_at` |
| `Bordereau` | `src/bordeareaux/models.py` | Slip / manifest — monthly batch of shipments grouped per broker. | `number` (`BDX-YYYY-MM-{seq}`), `broker` (FK BP), `insurer` (FK BP), `period_start`, `period_end`, `policy_versions` (M2M), `total_gross_premium`, `total_commission`, `total_net_premium`, `currency`, `file` (S3 attachment), `status` (DRAFT / SENT / ACCEPTED / REJECTED) |
| `Payment` | `src/payments/models.py` | Payment against a Quotation or a set of Transactions. | `quotation` (FK, optional), `amount`, `currency`, `payer` (FK BP), `method` (BANK_TRANSFER / CARD / WALLET), `reference`, `posted_at`, `status` (PENDING / RECEIVED / CLEARED / FAILED) |

**Finance module.** `src/finances/` provides higher-level book-keeping abstractions (per-broker balance, per-partner ledger view). Nacora reads these; BMS reconciles.

### Signal-driven emit flow

The lifecycle events that produce financial state:

1. **Shipment booked (`PolicyVersionItem.status → BOOKED`).**
   - `Transaction` row created (DEBIT for premium receivable).
   - `Commission` row created (PENDING).
   - Both saves fire post-save signals which:
     - Emit an analytics event (`shipment.updated`).
     - Add an audit-trail row (see `AUDITTRAIL_MODELS`).

2. **Policy activated (`Policy → ACTIVE`).**
   - Analytics event `policy.activated` fires with the `NacoraPolicyVersionSerializer` payload.
   - BMS webhook fires with `BmsPolicySyncSerializer` payload (containing the policy, its holder, the broker, and the associated commission rate).

3. **Policy endorsed.**
   - `PolicyVersion` created with `title = Endorsement`.
   - `Transaction` rows may be added (positive or negative depending on premium delta).
   - Analytics event `policy.endorsed`; BMS webhook fires.

4. **Policy cancelled.**
   - `PolicyVersion` created with `title = Cancellation`.
   - Reversal `Transaction` rows added (CREDIT to unwind unearned premium).
   - `Commission` rows transitioned to REVERSED where applicable.
   - Analytics event `policy.cancelled`; BMS webhook fires.

5. **Bordereau generated (monthly cron).**
   - Beat task runs on the first of the month.
   - Aggregates all shipments booked in the previous calendar month, groups by broker.
   - Writes a `Bordereau` row with the aggregate + a per-shipment XLSX attached (S3).
   - Fires the `bordereau.created` analytics event and BMS webhook.

### BMS sync webhook

Endpoint: `BMS_WEBHOOK_URL`. Auth: HMAC-signed payload (`BMS_WEBHOOK_SECRET_KEY`).

**Serializer:** `BmsPolicySyncSerializer` in `src/clients/nacora/webhooks/serializers.py`. Same serializer is used for `policy.endorsed`, `policy.cancelled`, and (dormant) `policy.renewed`.

**Payload shape (approximate):**

```
{
  "event": "policy.activated",
  "policy": { "number": "MC-000123", "external_number": "SL-9999", ... },
  "holder": { "id": "...", "name": "..." },
  "broker": { "id": "...", "name": "...", "commission_rate": 0.125 },
  "insurer": { "id": "...", "name": "..." },
  "current_version": { "state": "ACTIVE", "start_date": "...", "end_date": "..." },
  "transactions": [ { "type": "DEBIT", "amount": 1234.56, "currency": "EUR", ... } ],
  "signature": "hmac-sha256-of-body"
}
```

**Delivery pattern.** Enqueued via `webhooks.tasks.deliver_webhook`. Three retries with exponential backoff + jitter. Persistent failure → Sentry.

### Bordereau numbering

`BDX-YYYY-MM-{seq}` — sequence is per-(broker, year, month). A given broker has one bordereau per period; re-running the cron over an already-generated period is a no-op (idempotency check on `broker + period_start`).

### Currency handling

- Every financial model carries `currency` (ISO 4217).
- Analytics-stream aggregation converts to `NACORA_ANALYTICS_SETTINGS['BASE_CURRENCY']` (EUR) using yesterday's `ExchangeRate`.
- Transactional records are NOT converted — the recorded currency is the executed currency.
- Missing FX rate at aggregation time → `null` base amount; analytics excludes the row rather than silently 1:1.

### Wallets (dormant for cargo)

`src/submodules/wallets/` provides a wallet-balance model used by other tenants. Not wired to the cargo product; retained for platform consistency.

### Reversal semantics

- A `Transaction` with `type=REVERSAL` and `related_transaction` set to the original completes an undo.
- A `Commission` transitions to REVERSED and gets an audit-trail row; the original PAID / APPROVED status is preserved for history.
- Both reversal shapes are additive (no rows deleted) — the ledger is append-only.

## Configuration & operational levers

| Setting / env var | Purpose | Typical value |
|---|---|---|
| `BMS_WEBHOOK_URL` | Sister BMS sync endpoint | Env-defined |
| `BMS_WEBHOOK_SECRET_KEY` | HMAC key for signing outbound payloads | From vault |
| `NACORA_ANALYTICS_SETTINGS['BASE_CURRENCY']` | Cross-currency aggregation base | `EUR` |
| Celery Beat entry (bordereau) | Monthly bordereau schedule | `crontab(day_of_month=1, hour=1, minute=0)` |
| Retry policy on `webhooks.tasks.deliver_webhook` | Retry attempts & backoff | 3 retries, 2^n seconds + jitter |
| Bordereau reference pattern | Numbering | `BDX-YYYY-MM-{seq}` |

## Constraints, guarantees, and gotchas

- **Nacora is a source-of-record, not a reconciliation engine.** Cash matching, invoicing, and commission payout are BMS's responsibility. Do not add invoicing logic here.
- **Ledger is append-only.** Reversals are additive rows, not deletes. This keeps history verifiable and lets the audit trail attribute every change.
- **BMS webhook is at-least-once.** BMS must dedupe by (event_id, policy_id) — Nacora sends the same event on retry.
- **HMAC signing is mandatory.** `BMS_WEBHOOK_SECRET_KEY` must be present; missing key aborts the webhook with a config error rather than sending unsigned.
- **Bordereau cron is idempotent per period.** Re-running is safe; will not double-create.
- **Currency mismatches at the transactional level are allowed.** A broker in DACH selling policies in USD produces USD `Transaction` rows. Analytics converts to EUR; transactional preserves USD.
- **Reversals cascade to Commission.** If a booking transaction reverses, its Commission row transitions to REVERSED. The commission-payout side (in BMS) must handle a REVERSED Commission on a previously PAID line by issuing a claw-back.
- **`policy.renewed` event is disabled.** Renewals emit a fresh `policy.activated` from the new version. Analytics + BMS consumers must not depend on `policy.renewed`.
- **Wallets are dormant.** Do not wire wallet balance into new cargo flows without a delivery-lead sign-off.
- **Bordereau uses S3 storage.** The bordereau file lives at a private S3 key; the BMS side gets a presigned URL in the webhook payload.

## Related concepts

- Event Stream & Audit Trail
- APIs & Integrations
- Storage & Attachments
- Bulk Upload & Exporter
- Data Model & Entities
