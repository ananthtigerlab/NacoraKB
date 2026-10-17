# Audit Trail

## What it is

Every material change in Nacora — policy created, shipment booked, referral status changed, rule matched, document generated, admin approved a user — is captured as an immutable audit event. Events live in a dedicated store (DynamoDB) and are queryable from the Backoffice. The audit trail is what compliance officers and examiners rely on to reconstruct exactly who did what and when.

## Who uses it & where

- **Compliance officers** browse and export events for regulatory reviews.
- **Operations** trace a shipment's lifecycle when investigating incidents.
- **Security** watches admin actions and unusual data-access patterns.
- **Every system flow** writes to the trail as a side-effect — users don't do anything special to enable auditing.

## How it works

1. When a tracked record is saved or updated, the audit library captures the event automatically. Nothing in the business flow calls the audit trail directly.
2. Each event carries the actor (which user made the change), the action (created / updated / deleted), the resource (which record), the timestamp, the IP address, and the diff (before → after) for updates.
3. Events are dispatched to DynamoDB asynchronously through a dedicated Celery queue so heavy audit traffic doesn't slow user actions down.
4. **Deduplication window:** consecutive identical events by the same actor within a 3-second window are collapsed into one row. This prevents rapid clicks or automated retries from spamming the log.
5. **Rule evaluation events are match-only:** only rules that actually matched a shipment produce audit rows. Non-matching evaluations stay silent. This is a deliberate noise-reduction choice — a policy with fifty rules would otherwise write fifty rows per shipment.
6. Retention: entries expire after a configured window via DynamoDB TTL. Older data is dropped automatically.
7. Query: the audit UI supports filters by resource type, actor, and date range, plus free-text search.

### Filtering and CSV export from the Audit Trail sidebar

The Audit Trail sidebar — the panel that surfaces record-level activity on referrals, shipments, policies, and business rules — supports three filter dimensions and a CSV export (from I2G-29766):

- **Filter by field** — narrow to events that touched a specific attribute (for example, only insured-value changes, or only status transitions).
- **Filter by action type** — narrow to Created, Updated, Deleted, Approved, Declined, or the record-specific action types.
- **Filter by date range** — narrow to a specific window.

Once the filter is applied, an **Export to CSV** action downloads the filtered slice. Compliance officers use this to hand a specific record's audit trail to an examiner without giving them platform access; operations users use it to line up a single shipment's activity next to a related shipment for comparison.

## Business rules & calculations

- **Tracked models:** Policy, PolicyVersion, Shipment, Referral, Activity, Special Rate Request, Risk Factor Combinations, Rules, and rule evaluations.
- **Actor resolution:** the actor is pulled from the request context. Background jobs record the "system" user.
- **Dispatch mode:** real-time by default. The audit event is on its way before the user's action returns.
- **Retention:** default retention window applies uniformly; sensitive audit categories may be extended.
- **No mutation:** audit events cannot be edited or deleted by any user, including administrators.

## Related concepts

- Business Rules
- Referral Management
- Admin Queue & Approvals
- Analytics & Reporting
