# Security & Permissions

## What it is

Nacora's security model has three layers: authentication (who are you?), authorisation (what class of thing can you touch?), and data scoping (which rows of that thing can you see?). All three are enforced in the backend — the frontend cannot bypass them by tampering with URLs, IDs, or query parameters.

This page describes the authentication surface (SSO, OAuth2, OTP, session), the authorisation model (DRF permission classes), the row-level scoping (queryset filter services), the sanctions / compliance layer, and the domain isolation between the two portals.

## Who uses it & where

- **Backend engineers** wiring new endpoints — must attach the correct permission class and queryset filter.
- **Frontend engineers** implementing sign-in flows and error handling around 401/403 responses.
- **DevOps** provisioning Okta, KN PDM, and vault secrets.
- **Compliance / security team** reviewing the audit trail, sanctions screening, and access controls.

## How it works

### Authentication surface (three flows)

Different user populations use different sign-in mechanisms:

| User type | Where | Mechanism |
|---|---|---|
| **K+N internal staff** (brokers, admins) | Back Office at `nacora-bo.i2go.io` | **SSO via Okta OAuth2 / OIDC** |
| **External underwriters** (GFH, Allianz staff) | Back Office | **Username + password** (`LoginBackend`) |
| **External participants** (K+N logistics teams, freight forwarders) | Shipment Portal at `nacora-sp.i2go.io` | **OTP via email** (`drfpasswordless`), max 5 attempts per session |

**Backends enabled** (`AUTHENTICATION_BACKENDS`):

- `LoginBackend` — username + password against Django's `User` model.
- `EmailConfirmationTokenBackend` — email-token-based access (e.g. password reset).
- `ObjectPermissionBackend` — `django-guardian` for object-level permissions (rarely used in Nacora; scoping is done via queryset filter services instead).
- `OAuth2Backend` — bearer-token API access.
- `OIDCBackend` — Mozilla OIDC (Keycloak); active when `USE_MOZILLA_OIDC=True`.

### SSO flow — Okta / OIDC

1. Unauthenticated user hits the Back Office. Middleware redirects to Okta.
2. Okta authenticates and redirects back with an authorisation code.
3. Backend exchanges the code for ID + access tokens.
4. **`SocialAdapter.pre_social_login()`** (in `src/clients/nacora/auths/adapter.py`) fires:
   - Extracts `pdmuid` from the Okta ID token's `extra_data`.
   - Calls the KN PDM API (`NACORA_PDM_API_URL`) with the pdmuid to resolve the person's cost centre + org unit.
   - **10-second timeout.** If PDM is unreachable, falls back to a static JSON mapping (`sso_partner_mappers.json`). If both miss, the user goes into the pending-approval queue.
5. `BusinessPartnerUtil.get_or_create_participant_company()` creates or updates the participant company and attaches the user's Person BP to it via a `belongs_to` relation.
6. Roles are attached to the BP based on the resolution.
7. Session cookie is set; user is redirected to `LOGIN_REDIRECT_URL = /dashboard/`.

**PDM token cache.** `NACORA_PDM_TOKEN_CACHE_KEY = 'nacora_pdm_token'` — the OAuth2 token used to call PDM is cached in Redis with a 10-minute TTL to avoid re-authenticating on every SSO event.

**Simulation mode.** `NACORA_PDM_SIMULATION_ENABLED = True` (dev only) returns canned PDM data — used for local development without a live PDM connection.

### Username + password flow

Standard Django auth backend (`LoginBackend`). Used by:

- External underwriters (GFH, Allianz users) via `/accounts/login/`.
- Local administrators for dev/test environments.

**Lockout:** `MAX_LOGIN_ATTEMPTS = 3`. Three failed attempts blocks the account and sends a notification email (`SEND_EMAIL_WHEN_BLOCKED = True`). Blocked accounts are unlocked by an admin.

### OTP flow — Shipment Portal participants

Uses `drfpasswordless` configured via `PASSWORDLESS_AUTH`:

```
PASSWORDLESS_TOKEN_EXPIRE_TIME = 300           # 5-minute code
PASSWORDLESS_AUTH_TYPES = ['EMAIL']
PASSWORDLESS_USER_EMAIL_FIELD_NAME = 'get_email_or_bp_email'   # Nacora custom getter
PASSWORDLESS_REGISTER_NEW_USERS = False        # Do NOT auto-create users
PASSWORDLESS_EMAIL_NOREPLY_ADDRESS = 'i2go@tigerlab.com'
```

Nacora-specific setting: **`CHECK_OTP_USER_DIRECT_FROM_ALIAS = True`** — the email token is validated against the BP's email alias, not against the `User.email` field. This lets external participants have OTP access without needing to be linked to a Django `User` row directly.

**5-attempt lockout.** After five wrong OTP submissions in a session the user must request a new code.

### Domain isolation between the two portals

The same Django container serves both portals. Domain isolation is enforced by **`CspDomainRedirectMiddleware`** (in `src/clients/nacora/middleware.py`):

- **Back Office domain** (`nacora-bo.i2go.io`) serves the full dashboard, all `/dashboard/*`, `/embedded-cargo/*`, and the API.
- **Shipment Portal domain** (`nacora-sp.i2go.io`) is restricted to `/shipment-portal/*`, `/api/v3/*`, `/accounts/*`, `/api/v1/rating/*`, `/api/v1/documents/*`, `/api/v1/policies/shipment-items/*`, and static assets. Any other path returns 403.
- `WHITELIST_PATH = ['/shipment-portal/']` bypasses the redirect middleware for this prefix so the SPA can handle its own auth via OAuth2 bearer tokens.

### Authorisation — permission classes

DRF permission classes gate what class of action each user can perform. Nacora registers custom classes via `CUSTOM_PERMISSION_CLASS` in settings:

```
CUSTOM_PERMISSION_CLASS = {
  'Referral': { 'class': 'clients.nacora.policies.permissions.ReferralPermission', ... },
  'SpecialRateRequest': { 'class': 'clients.nacora.policies.permissions.SpecialRateRequestPermission', ... },
}
```

**`ReferralPermission`** — a user can view/edit a referral if they:
- Hold Underwriter role in the referral's insurance company, OR
- Are the broker who created the referral, OR
- Are an Administrator.

**`SpecialRateRequestPermission`** — a user can view/edit an SRR if:
- They are the requester (broker who submitted), OR
- They are an Underwriter for the underwriting insurance company, OR
- They are an Administrator.

Other endpoints use `IsAuthenticated` (bare) or DRF's `DjangoModelPermissions` for standard CRUD.

### Data scoping — queryset filter services

The critical layer. Even after a permission class says "you can view referrals", the queryset filter narrows the actual rows returned to what this user is allowed to see. Registered via `CUSTOM_QUERYSET_SERVICE`:

```
CUSTOM_QUERYSET_SERVICE = {
  'PolicyVersionItem':   'clients.nacora.policies.services.PolicyVersionItemQuerysetFilterService',
  'PolicyVersion':       'clients.nacora.policies.services.PolicyVersionQuerysetFilterService',
  'Referral':            'clients.nacora.policies.services.ReferralQuerysetFilterService',
  'SpecialRateRequest':  'clients.nacora.policies.services.SpecialRateRequestQuerysetFilterService',
  'OutboundMail':        'clients.nacora.mails.services.OutboundMailQuerysetFilterService',
  'IncompleteOrder':     'clients.nacora.policies.services.IncompleteOrderQuerysetFilterService',
}
```

Filtering rules by role, for shipments (`PolicyVersionItemQuerysetFilterService`):

- **Producer / Broker** — sees shipments where the `created_by` user or the policy's `agent` sits anywhere in their Broker Company's descendant tree.
- **Underwriter** — sees shipments where the policy has their Insurance Company in the `insurance_companies` attribute.
- **Participant** — sees only shipments they personally created, scoped to their Participant Company.
- **Administrator** — sees everything (bypass).

Object-level checks by role, for editable objects:

- Referrals: creator OR underwriter OR admin can edit.
- SRRs: requester OR underwriter (of the underwriting co) OR admin can edit.
- Everything else: creator OR admin.

**Report visibility bypass.** `REPORT_ASSIGNED_TO_BYPASS_ROLES = ['ADMINISTRATOR']` — Administrators see every report regardless of the assigned-to field.

**Group permissions are OFF globally.** `IGNORE_GROUP_OBJECT_PERMISSION = True` — Nacora relies exclusively on the role-based mechanisms above, not on `django-guardian` object permissions.

### Three-layer enforcement summary

An API request that lists referrals gets filtered through:

1. **Layer 1 — authentication.** Middleware resolves `request.user` from session or bearer token. Missing → 401.
2. **Layer 2 — permission class.** `ReferralPermission` decides whether this user can list referrals at all. Denied → 403.
3. **Layer 3 — queryset filter service.** `ReferralQuerysetFilterService.filter_queryset(qs, request.user)` narrows the queryset to referrals this user is allowed to see. Others are simply absent from the response — no error, no leak.

Filtering runs in the database via `WHERE` clauses; there is no post-fetch filtering in Python. Frontend clients cannot ask for arbitrary IDs and receive rows outside their scope.

### Compliance layer — sanctions screening

Beyond access control, Nacora runs a compliance layer on every shipment declaration:

**Pipeline** (in `src/clients/nacora/cargo_sanctions/`):

1. Cargo description text is sent to **AWS Comprehend** for entity extraction (PERSON, ORG, LOCATION).
2. Entities are filtered by confidence:
   - Orgs at ≥ 85% confidence.
   - People at ≥ 60% confidence.
   - Up to 10 entities per request (`MAX_ENTITIES`).
3. A **local noise block list** removes common shipping tokens ("marks & nos", "carton", "pallets", …) to reduce false positives.
4. Surviving entities are sent to **SanctionScanner** for fuzzy match against sanctions lists.
5. Hits with match rate ∈ [`VENDOR_MIN_MATCH_RATE`, `VENDOR_MAX_MATCH_RATE`] flag the shipment for underwriter review.
6. **Fallback:** if SanctionScanner is unavailable or below threshold, the local **OFAC SDN CSV** (`cargo_sanctions/data/sdn.csv`) is fuzzy-matched offline. Refreshed via `python manage.py refresh_sdn_list`.

**Kill switch:** `CARGO_SANCTION_SETTINGS['ENABLED'] = False` disables the whole pipeline. A dry-run endpoint (`/api/v1/third-parties/sanctions/screen-cargo-text/`) always runs regardless of the flag — used by underwriters to spot-check descriptions during onboarding.

### Pending-approval workflow

Users whose PDM lookup fails (or who signed in via SSO without a resolvable cost centre) are stashed in a pending-approval queue:

1. During SSO, `BusinessPartnerUtil.create_pending_participant()` sets `partner.extra_data['nacora_approval'] = {'status': 'PENDING', ...}`.
2. `PendingApprovalRedirectMiddleware` checks this flag on every request; if `PENDING`, redirects to `/pending-approval/` (a static landing).
3. Admin visits `/dashboard/nacora-admin/` and approves or rejects.
4. On approval, `nacora_approval.status → 'APPROVED'`, the user's BP is attached to the correct participant company, and the next login proceeds normally.

Approvals are audited via the DynamoDB audit trail with the approving user's identity, timestamp, and IP.

### Session security

- `SESSION_COOKIE_SECURE = True` — HTTPS-only cookie in staging and prod.
- `SESSION_COOKIE_HTTPONLY = True` — JS cannot read the cookie.
- `SESSION_COOKIE_SAMESITE = 'Lax'` — CSRF protection default.
- `SessionSecurityMiddlewareOverride` — idle-timeout session expiry.
- `SESSION_ENGINE = 'django.contrib.sessions.backends.cache'` — Redis-backed for fast session lookup and easy invalidation.
- `ALLOW_CONCURRENT_LOGIN = True` — user can be logged in from multiple devices simultaneously.

### CSRF and CORS

- CSRF enforced on session-authenticated writes (`CsrfViewMiddleware`).
- Token-authenticated writes are exempt from CSRF but still session-safe.
- CORS handled by `corsheaders.middleware.CorsMiddleware`. `CORS_ALLOWED_ORIGINS` list enumerated per env; wildcards not permitted in prod.

### Object-level flags on partner records

- `partner.extra_data['nacora_approval']` — pending / approved / rejected.
- `partner.status` (implicit via role attachments) — active / inactive.
- Deletion of a partner cascades down the tree unless blocked. **Always prefer deactivation.**

## Business rules & guarantees

- **No client-side row filtering.** Every list endpoint applies a queryset filter service in the DB. Cannot be bypassed.
- **Cross-domain requests blocked.** Shipment Portal domain will not serve back-office paths. Middleware rejects the request before any view runs.
- **Data isolation strict.** A participant sees only shipments they created. Even within the same participant company, one participant does not see another's drafts.
- **Admins see all — but every admin action is audited.** DynamoDB captures approving user, timestamp, IP.
- **Sanctions screening is a compliance layer, not a business rule.** Business rules can trigger a referral for hazardous cargo; sanctions screening runs as a separate pre-flight check with its own kill switch.
- **PDM lookup fallback is deterministic.** Live API 10s timeout → static JSON → pending approval. No user is ever silently created with the wrong role.
- **Group permissions disabled globally.** All authorisation flows through role membership + queryset filters.
- **All model saves audit through post-save signals** — see Event Stream & Audit Trail.

## Related concepts

- Architecture Overview
- APIs & Integrations
- Event Stream & Audit Trail
- Environments & Config
- Business Partner (product space)
