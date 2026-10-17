# Cancellation & Endorsement

## What it is

Two distinct operations on a bound policy — **cancellation** (voiding cover from a specified date) and **endorsement / MTA** (mid-term amendment: changing cover, insured sum, named assured, dates, etc.). Both are implemented in `src/clients/nacora/cancellation/services.py` and `src/clients/nacora/policies/services.py`, driven by `CancellationService` (registered via `CANCELLATION_SERVICES`) and the policy-version orchestration.

The Nacora rules on cancellation are stricter than the platform default: cancellations can be either **future-dated** (schedule a cancel for a date ahead of `today`) or **immediate**, they must obsolesce any pending MTAs on the same policy, and they always emit a downstream BMS sync webhook.

## Who owns it or touches it

- **Backend engineers** own the service orchestration and its state-machine logic.
- **Underwriters** initiate cancellations from the back-office UI.
- **BMS** receives the sync webhook — every cancellation lands in the sister billing system.
- **Compliance** audits every cancellation via the DynamoDB audit trail.

## How it works

### Cancellation — targets

Two target kinds:

| Target | Meaning |
|---|---|
| **Policy-level cancellation** | The entire `Policy` is cancelled. A new `PolicyVersion` is created with `title = 'Cancellation'`, `state = 'PUBLISHED'`, `is_current_version = True`; the previous current version has its flag flipped to `False`. Cover ceases as of `cancel_date` or `future_cancel_date`. |
| **Shipment-level cancellation** | A single `PolicyVersionItem` is cancelled. The parent `PolicyVersion` remains active; the item's status transitions to `CANCELLED`. Downstream: certificate PDF is superseded (a `CancellationConfirmation` document is generated), BMS webhook fires with `policyversionitem.cancelled`. |

`CANCELLATION_SERVICES` maps target kinds to concrete services:

```
CANCELLATION_SERVICES = {
  'policy':     'clients.nacora.cancellation.services.PolicyCancellationService',
  'shipment':   'clients.nacora.cancellation.services.ShipmentCancellationService',
}
```

Both subclass a shared `CancellationService` base with the common state-machine logic.

### The `CancellationService.cancel(...)` contract

Approximate signature:

```
def cancel(self, target, effective_date, reason, user, *, immediate=False):
    """
    target: Policy or PolicyVersionItem
    effective_date: date (must be >= today; use `immediate=True` for now)
    reason: str (audit trail)
    user: User initiating the cancellation
    immediate: bool — if True, cancel now regardless of effective_date

    Returns the cancellation record (PolicyVersion for policy-level;
    updated PolicyVersionItem for shipment-level).
    """
```

Behaviour:

1. **Validation.** Reject if target is already cancelled or expired. Reject if `effective_date < today` (backdating requires a special permission and a separate code path).
2. **Future vs immediate decision.**
   - `immediate=True` or `effective_date == today` → `cancel_date` is set on the target, status flips immediately.
   - Otherwise → `future_cancel_date` is stamped; a Celery task or nightly cron sweeps at midnight and flips the status when the date arrives.
3. **MTA obsolescence (policy-level only).** All pending MTAs (draft `PolicyVersion` rows with `title = 'Endorsement'`, `state ∈ {'DRAFT', 'PROPOSED'}`) on the same policy are marked `state = 'OBSOLETE'` in the same transaction. This prevents the MTA workflow from re-activating a cancelled policy.
4. **Persist.** New `PolicyVersion` for policy-level; status update for shipment-level. Both inside a single DB transaction.
5. **Side effects (post-save signals).**
   - Audit-trail dispatch (DynamoDB) — captures actor, timestamp, reason.
   - Analytics event emit — `policy.cancelled` or `shipment.cancelled`.
   - Outbound webhook — BMS sync (`policy.cancelled` / `shipment.cancelled`).
   - Cancellation document render — `DocumentGenerationService.render(target, 'CANCELLATION', language)`.
   - Email notification via `send_templated_notification` to holder + broker + participant company.

### Future-dated cancellation sweep

For future-dated cancellations, `nacora.tasks.apply_future_dated_cancellations` runs on Celery Beat (nightly) and calls the target service's `_finalise(target)` for every row whose `future_cancel_date <= today` and whose current state is not yet cancelled. The task is idempotent — re-running it flips no additional rows once every eligible target is already cancelled.

### Endorsement / MTA orchestration

Endorsements are managed by the `PolicyVersion` lifecycle — the platform's version model does most of the work; Nacora contributes hooks:

1. **Draft creation.** A user clicks "Endorse" in the UI. `EndorsementService.create_draft(policy, changes, user)`:
   - Creates a new `PolicyVersion` with `title = 'Endorsement'`, `state = 'DRAFT'`, `start_date = <effective date>`, parent = `policy`.
   - Copies `attributes` from the current version and applies `changes`.
   - Copies `PolicyVersionItem` rows onto the new version (deep-copy of shipments with regenerated `PolicyVersionItem.parent` FK to the new version).
   - Assigns a new `PolicyVersion.number` via `NumberingMixin`.
2. **Re-rating.** All shipments on the new version are re-rated by the rating engine using the amended `attributes`.
3. **Approval flow.** If the endorsement triggers a `REFERRAL` action via the rules engine, the version stays in `DRAFT` until an underwriter approves.
4. **Activation.** On approval, `EndorsementService.publish(version, user)`:
   - Flips the new version to `state = 'ACTIVE'`, `is_current_version = True`.
   - Flips the previous current version to `is_current_version = False`.
   - Records `published_at`.
   - Fires side effects — audit, analytics, BMS webhook (`policy.endorsed`), document render.
5. **Shipment continuity.** `ShipmentNumberingService` inherits `shipment_latest_number` from the parent version onto the new version so shipment numbers continue their sequence without collision.

Cancellation and endorsement can coexist: a future-dated cancellation blocks new endorsement drafts, but a future-dated endorsement does not block a same-day cancellation. If both are pending, cancellation wins and obsolesces the endorsement.

### Rating and rules interaction

- **Endorsement re-rating** uses the same `ShipmentRatingResponseService` and `RulesEvaluationService` as new business — there is no separate MTA rating path.
- **Cancellation refund calculation** is not run by this service. A cancellation event marks the ledger; refund computation happens in the sister BMS on the bordereau side.
- **Rules can decline an endorsement.** A `DECLINE` action during re-rating leaves the endorsement in `DRAFT` and marks the target shipment as `DECLINED` — the endorsement is not published.

### Backdating

Backdating (`effective_date < today`) requires:

- The user has the `nacora.can_backdate_cancellation` object permission.
- A reason must be provided that fits `BACKDATE_REASONS` (settings-controlled enum).
- The audit trail records `backdated=True` and the actor.

Without the permission, backdated calls raise `PermissionDenied` before touching the DB.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `CANCELLATION_SERVICES` | Dict mapping target kind to service class |
| `BACKDATE_REASONS` | Allowed reasons for backdated cancellations |
| `NACORA_CANCELLATION_NOTIFICATION_ENABLED` | Toggle email notifications on cancel |
| `CANCELLATION_DOCUMENT_TEMPLATE_SLUG` | Which `DynamicTemplate` to use for cancellation confirmation PDFs |
| `MTA_OBSOLESCENCE_ON_CANCEL` | Whether pending MTAs obsolesce on policy cancel (default `True`) |

Beat schedule (from `background-jobs`):

- `nacora.tasks.apply_future_dated_cancellations` — nightly sweep of `future_cancel_date`.

## Constraints, guarantees, and gotchas

- **Cancellations and endorsements always create a new `PolicyVersion`.** Never mutate the previous version in place — the version chain is the audit source.
- **Only one `is_current_version=True` at a time.** Flipped inside the same transaction as the new version's persist. Never both true, never both false.
- **MTA obsolescence is transactional with the cancellation.** If the transaction rolls back, MTAs remain intact.
- **Future-dated cancellations rely on the nightly sweep.** If Celery Beat is down for a day, the flip happens the next morning. Cancellations that must fire at a specific hour should be immediate rather than future-dated.
- **Shipment numbering continuity is critical.** New PolicyVersion inherits `shipment_latest_number`; never create versions via raw SQL. See Numbering.
- **BMS sync is best-effort.** Three retries with exponential backoff (see APIs), then Sentry. A missed BMS sync doesn't roll back the cancellation — support must manually replay.
- **Reason text is captured in the audit trail.** DynamoDB `audit_events` includes the reason; this is the audit of record for compliance.
- **Backdated cancellations are gated.** The default permission set does not include backdating; explicit grant is required.
- **Refunds are computed downstream.** This platform emits the event; the BMS side runs refund calculation and cash allocation.

## Related concepts

- Data Model & Entities
- Service Override Pattern
- Rating Engine
- Business Rules Engine
- Numbering
- Event Stream & Audit Trail
