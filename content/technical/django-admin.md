# Django Admin

## What it is

Nacora ships two admin surfaces:

- **The Django admin** at `/tiger-site-admin/` — the standard Django admin, customised for platform use, mostly for developers and platform-level support.
- **The Nacora admin queue** at `/dashboard/nacora-admin/` — a bespoke HTMX-powered UI for approving pending-approval users, reviewing referrals in bulk, and running rules-debugger sessions.

Both live in the same Django process, but they serve very different audiences. The Django admin is a raw-model editor; the Nacora admin is a workflow-shaped queue.

## Who owns it or touches it

- **Backend engineers** register new models on the Django admin and maintain the HTMX Nacora admin views.
- **Platform support** uses Django admin for direct model inspection and quick fixes.
- **Nacora operations** (approvals, referral triage) uses the Nacora admin queue.
- **Compliance** never touches these UIs directly — every admin action is audited via DynamoDB, and audit search runs from `/api/v1/audit_trail/`.

## How it works

### `/tiger-site-admin/` — the Django admin

The URL is deliberately non-default. Two settings drive this:

| Key | Value | Effect |
|---|---|---|
| `ADMIN_URL_PATH` | `'tiger-site-admin'` | Mounts the admin at `/tiger-site-admin/` instead of `/admin/` |
| `ADMIN_SHOW` | `False` | Hides any UI link/back-office nav that would otherwise expose the admin path |

The admin URL is not linked from any user-facing page. Discovery requires knowing the path. This is a mild but useful defence against unauthenticated probes — combined with the standard Django admin auth (staff-only), it keeps the surface quiet.

**Customisations:**

- The admin site is themed via **jazzmin** (`JAZZMIN_SETTINGS`) — a bootstrap-based skin that renders search boxes, hierarchical list views, and inline forms.
- Model registrations live under each app's `admin.py`. Nacora-specific registrations are in `src/clients/nacora/admin.py` and its subordinate modules.
- `admin.site.site_header`, `site_title`, `index_title` are branded "Nacora Admin".
- Some models are read-only in admin — Choices are seed-managed and marked with `has_add_permission = False` / `has_delete_permission = False`.

**Access control:**

- Standard Django `is_staff = True` on `User` — required to log in.
- `is_superuser = True` — unlocks all model permissions.
- Object-level permissions via `django-guardian` are available but not used by Nacora day-to-day (see Security & Permissions — `IGNORE_GROUP_OBJECT_PERMISSION = True`).
- Every admin action fires the standard Django `LogEntry` and the platform audit-trail dispatch to DynamoDB — see Event Stream & Audit Trail.

**Login flow:** the admin uses the standard Django admin login form. SSO / Okta users can also access admin if their `User` row has `is_staff=True`; the platform's SSO adapter sets this flag when appropriate.

### `/dashboard/nacora-admin/` — the Nacora admin queue (HTMX)

Purpose-built for operational workflows that the Django admin can't express cleanly. Lives under `src/clients/nacora/admin_ui/` and uses HTMX for partial-page updates without a JS SPA.

**Sections:**

| Path | Purpose |
|---|---|
| `/dashboard/nacora-admin/pending-approvals/` | Approve or reject users stuck in the pending-approval queue (SSO-resolved but no PDM match, or manual signups) |
| `/dashboard/nacora-admin/referrals/` | Bulk-view referrals across policies; filter by assignee, status, age |
| `/dashboard/nacora-admin/rules-debugger/` | Enter a shipment ID and a rule ID; see per-condition truth values and which actions would fire |
| `/dashboard/nacora-admin/data-stream/` | Inspect the `DataStreamLog` queue; requeue stuck rows |
| `/dashboard/nacora-admin/soap-messages/` | View recent inbound SOAP messages by dedup ID |
| `/dashboard/nacora-admin/health/` | Admin dashboard health summary (queue depths, PDM cache size, FX age) |

**How HTMX is used:**

- Server renders full HTML on first load (Django template).
- Filter changes, pagination clicks, and approve/reject actions post to the same URL with `hx-post` / `hx-get` attributes.
- Server returns the partial HTML for the affected row/panel.
- No JavaScript build step; templates live under `src/clients/nacora/templates/admin_ui/`.

**Access control:**

- URL prefix is behind the standard Nacora auth stack (`LoginRequired`, `PermissionRequired`).
- Only users with the `Administrator` role see the nav link and can access the URLs.
- Object-level access follows the queryset filter services — an administrator sees all pending approvals; a broker admin sees only approvals scoped to their org tree (if this scope exists in the future).

**Actions:**

- Approve pending user: sets `partner.extra_data['nacora_approval'].status = 'APPROVED'`, attaches the BP to the correct participant company, sends a welcome email. Audited.
- Reject pending user: sets `status = 'REJECTED'` with the reason, sends a rejection email. Audited.
- Requeue data-stream row: sets `DataStreamLog.status = 'PENDING'` for the row, which the next `emit_event` task picks up.

### Admin URL routing

From `src/clients/nacora/urls.py`:

- `/tiger-site-admin/` → `admin.site.urls` (via `path(ADMIN_URL_PATH, admin.site.urls)`).
- `/dashboard/nacora-admin/` → Nacora HTMX views under `admin_ui.urls`.

Any request to `/admin/` (the Django default) returns 404 — that path is not routed.

### Session & CSRF

Both admin surfaces use standard Django session cookies + CSRF tokens. HTMX requests include the CSRF token via the standard middleware. See CSRF & CORS and Session Security.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `ADMIN_URL_PATH` | Non-default admin path (`tiger-site-admin`) |
| `ADMIN_SHOW` | Hide admin from user-facing nav (`False`) |
| `JAZZMIN_SETTINGS` | Django admin theming |
| `NACORA_ADMIN_QUEUE_PAGE_SIZE` | Default page size on HTMX queue lists |
| `NACORA_ADMIN_APPROVAL_NOTIFICATION_ENABLED` | Toggle approval/rejection notification emails |

Operational commands:

- `python src/manage.py createsuperuser` — bootstrap the first admin user in a fresh environment.
- `python src/manage.py changepassword <user>` — force reset via CLI.

## Constraints, guarantees, and gotchas

- **Every admin write is audited.** The DynamoDB audit trail captures the actor, IP, timestamp, model, field diff. There is no way to "silently" edit a model from the admin.
- **The admin URL is not discoverable in the UI, but is not secret.** It's a mild obscurity measure — never a substitute for real authentication.
- **`ADMIN_SHOW = False` hides the link, not the URL.** Anyone who knows the path can visit it; access is gated only by staff auth.
- **Choices and lookups are seed-managed.** Adding rows via the admin is possible but discouraged for anything that must exist in every environment. Prefer edits to the seed commands.
- **The Nacora admin queue is not the Django admin.** They share auth but live at different URLs and expose different data. Avoid confusing "the admin" (which one?) in tickets and docs.
- **HTMX has no offline mode.** The Nacora admin requires a live backend for every action — there's no client-side caching layer.
- **Superuser accounts should be a minority.** Prefer `is_staff` + Django model permissions for narrow access. Every superuser can bypass every queryset filter.

## Related concepts

- Security & Permissions
- Auth Backends
- Event Stream & Audit Trail
- Session Security
- Environments & Config
- Observability
