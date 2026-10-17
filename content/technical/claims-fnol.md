# Claims (FNOL) — MVP 1 Scope

## What it is

Claims — First Notice Of Loss (FNOL) — is the MVP-1 module for capturing a loss event against a booked shipment. The MVP scope is deliberately minimal: log the loss, notify the underwriter, attach evidence documents. Full claims handling (adjuster workflow, settlement, recovery) is post-MVP and lives in a sister system. This page describes the current in-code module.

## Who owns it / who touches it

- **Backend engineers** extending the FNOL model or wiring the notification.
- **Participants / brokers** logging a claim through the shipment portal (BO mode) or embedded-cargo UI.
- **Underwriters** receiving the notification and following up out-of-band.
- **Support** helping a broker who cannot see their claim in the queue.

## How it works

### Where it lives

- **Backend module.** `src/clients/nacora/api/v1/nacora_claims/` — Django app + DRF ViewSet + service classes.
- **Shared model.** `src/claims/` — the platform-level claims model, extended by Nacora if needed.
- **URL prefix.** `/api/v1/nacora-claims/`.
- **Frontend.** Claims screens are within `frontend/apps/nacora-embedded-cargo/` (BO scope) and `frontend/apps/nacora-shipment-portal/` (participant scope).

### MVP-1 scope

The MVP captures exactly enough to hand off to the sister claims system:

- **Log a claim** against a `PolicyVersionItem` — event date, event location, loss cause (from a Choices catalogue), estimated loss amount, currency, contact person.
- **Attach evidence** — photos, bill of lading, invoice, damage report. Stored as `Attachment` rows on the claim's GenericFK.
- **Notify the underwriter** — `send_templated_notification('nacora_claim_logged', to=<underwriter>)` fires post-save.
- **Read-only status queue** — the underwriter or admin can list open claims and view their detail.

Not in MVP-1:

- Reserve setting.
- Payments.
- Recovery / subrogation.
- Adjuster assignment / workflow.
- Loss-development factors.

These live post-MVP in the sister system.

### Data model (approximate)

| Model | Purpose | Key fields |
|---|---|---|
| `Claim` | The claim entity. | `number` (`CL-YYYY-{seq}`), `policy_version_item` (FK), `policy_version` (FK), `policy` (FK), `event_date`, `event_location`, `loss_cause` (FK Choices), `estimated_loss_amount` (Decimal), `currency`, `contact_person` (FK BP), `description` (text), `status` (LOGGED / UNDER_REVIEW / SENT_TO_ADJUSTER / CLOSED), `created_by`, `created_at`, `updated_at` |
| `ClaimAttachment` | Attachment specific to a claim (may reuse platform `Attachment` via GFK). | Standard attachment fields. |

Model naming follows the same conventions as the rest of the domain — UUID PKs, soft delete, `created_at` / `updated_at`.

### Lifecycle

1. **Log.** User (broker or participant) opens the shipment detail, clicks "Log a claim", fills the form, uploads evidence. Client POSTs to `/api/v1/nacora-claims/`.
2. **Server-side validation.** Serializer enforces required fields (event_date, event_location, loss_cause, estimated_loss_amount, currency). Shipment must be `BOOKED` or a downstream Nacora-specific status.
3. **Create.** `Claim` row inserted with `status = LOGGED`, `created_by = request.user`.
4. **Attachments.** Files uploaded as `Attachment` rows linked via GenericFK to the `Claim`. See Storage & Attachments.
5. **Notify.** `send_templated_notification('nacora_claim_logged', to=<underwriter_email>, context={ 'claim': ... })` — the underwriter of the shipment's insurance company is resolved via the policy's `insurance_companies` attribute.
6. **Audit + analytics.** Post-save signal writes an audit-trail row and emits a `shipment.updated` analytics event (the shipment now has a claim in progress).

### Read model

- **`GET /api/v1/nacora-claims/`** — list scoped by role (broker sees their own; underwriter sees their insurance-company's; participant sees only their own; admin sees all).
- **`GET /api/v1/nacora-claims/{id}/`** — detail with attachments.
- **`PATCH /api/v1/nacora-claims/{id}/`** — MVP allows only status transitions and adding attachments; no field edits to event details after logging.

Queryset filtering is applied via the standard `CUSTOM_QUERYSET_SERVICE` pattern; a Claim queryset filter service is registered under the class name `Claim`.

### Permissions

Read scope:

- Broker: claims on shipments they can see (via `PolicyVersionItemQuerysetFilterService`).
- Underwriter: claims on shipments where their insurance company is on the policy.
- Participant: only claims they created.
- Administrator: all.

Write scope:

- Broker / participant: can log a claim on a shipment they can see.
- Underwriter: can update status.
- Administrator: full.

### Handoff to the sister system

The MVP does not push to the sister claims system automatically. The current handoff is manual:

- Admin flips the claim status to `SENT_TO_ADJUSTER`.
- A `send_templated_notification('nacora_claim_handoff')` fires to the adjuster's inbox with the claim details + evidence links (presigned S3 URLs, 24h).
- The adjuster proceeds in their own system.

An outbound webhook to the sister claims system is post-MVP.

### UI touchpoints

- **Shipment detail page** — "Log a claim" CTA (opens a modal with the FNOL form).
- **Admin queue** — `/dashboard/nacora-admin/claims/` (HTMX admin UI) shows all open claims with quick-view details.
- **Claim detail** — full form + attachments + status history.

## Configuration & operational levers

| Setting / env var | Purpose | Typical value |
|---|---|---|
| Claim number pattern | Numbering format | `CL-YYYY-{seq}` |
| Underwriter resolution | Policy's `insurance_companies` attribute + BP roles | — |
| `send_templated_notification('nacora_claim_logged')` | Notification slug | Configured in post-office templates |
| Attachment storage | Backend | `insurance.storage_backends.PrivateStorage` |
| `CUSTOM_QUERYSET_SERVICE['Claim']` | Row-level scoping service | Registered in Nacora settings |

## Constraints, guarantees, and gotchas

- **MVP is intentionally minimal.** Do not add reserve, payment, or recovery logic in the current module. Post-MVP scope is a separate module.
- **No automatic handoff webhook.** The adjuster is notified by email; the sister claims system does not currently poll or receive from Nacora.
- **Once logged, event details are locked.** Correcting a wrong `event_date` or `event_location` requires an admin override — brokers cannot edit after submission.
- **Attachments follow presigned-URL semantics.** Every download regenerates a URL. Do not cache URLs client-side.
- **Notification is best-effort.** A failed notification does not fail the claim log — the row persists; the mail queue may retry.
- **Number pattern is unique per year.** `CL-YYYY-{seq}` — the sequence resets on year change. Numbering continuity across years is not preserved.
- **Claim can be logged only on a BOOKED-and-later shipment.** DRAFT / QUOTED shipments cannot host a claim; the validator enforces this.
- **Data-scoping is defensive.** A participant who tries to `GET` another participant's claim gets 404, not 403 (no ID enumeration signal).

## Related concepts

- APIs & Integrations
- Mail & Notification Pipeline
- Storage & Attachments
- Security & Permissions
- Business Rules Engine
