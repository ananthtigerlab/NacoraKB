# Authentication Backends

## What it is

The auth-backend chain is the ordered list of Django `AUTHENTICATION_BACKENDS` that Nacora consults when resolving a login attempt or an authenticated request. Each backend covers a specific credential type — username/password, email confirmation token, OAuth2 bearer, Mozilla OIDC, or `django-guardian` object permission. The chain is the actual code path through which every human, machine, and integration reaches `request.user`; nothing else in the system is trusted to identify the caller.

## Who owns it / who touches it

- **Backend engineers** wiring new endpoints or debugging 401 / 403 responses.
- **Security team** reviewing SSO and OIDC configuration during audits.
- **DevOps** provisioning Okta clients and vault secrets (client IDs, discovery URLs).
- **Frontend engineers** implementing bearer-token handling in the CSP-mode shipment portal.

## How it works

### The backend chain

Nacora's `AUTHENTICATION_BACKENDS` — layered on top of the base list in `src/insurance/settings.py` and rebuilt in `src/clients/nacora/settings.py` — is consulted in order:

1. **`LoginBackend`** — username + password against Django's `User` model. Used by external underwriters (GFH, Allianz users) via `/accounts/login/`, and by local admins in dev. Enforces the `MAX_LOGIN_ATTEMPTS = 3` lockout and (with `SEND_EMAIL_WHEN_BLOCKED = True`) emails the user on lockout.
2. **`EmailConfirmationTokenBackend`** — validates a short-lived token embedded in an email link. Used for password reset and the OTP flow that lands external participants at the Shipment Portal.
3. **`ObjectPermissionBackend`** — the `django-guardian` object-permission backend. Formally in the chain but effectively inert in Nacora: `IGNORE_GROUP_OBJECT_PERMISSION = True` disables group-based object permissions, and Nacora enforces row-level scoping through queryset filter services instead.
4. **`OAuth2Backend`** — bearer-token authentication for API requests. Validates the token via `OAuth2TokenMiddleware` (in the middleware stack) and populates `request.user`. Used by the shipment portal in CSP mode and by API-first integrations.
5. **`OIDCBackend`** — Mozilla-OIDC. Active when `USE_MOZILLA_OIDC = True`. Handles the Okta / Keycloak login roundtrip.

Django tries each backend in order until one returns a `User` (or raises). The first backend that succeeds wins; subsequent backends are not called for that request.

### Okta / OIDC flow

Configured by `USE_MOZILLA_OIDC`, `OIDC_RP_CLIENT_ID`, `OIDC_RP_CLIENT_SECRET`, and discovery-endpoint env vars. On login:

1. Unauthenticated request to a protected route.
2. `OIDCBackend` initiates the authorisation-code flow — redirect to Okta.
3. Okta authenticates, redirects back with `code`.
4. Django exchanges the code for ID + access tokens.
5. `SocialAdapter.pre_social_login()` at `src/clients/nacora/auths/adapter.py` fires — the Nacora post-login hook (see below).
6. Session cookie is set. User lands at `LOGIN_REDIRECT_URL = /dashboard/`.

### The SocialAdapter post-login hook

`src/clients/nacora/auths/adapter.py` extends `django-allauth`'s `DefaultSocialAccountAdapter`:

1. Extract `pdmuid` from the Okta ID token's `extra_data`.
2. Call the **KN PDM API** (`NACORA_PDM_API_URL`) with the pdmuid to resolve the person's cost centre and org unit. 10-second timeout controlled by `NACORA_PDM_REQUEST_TIMEOUT`.
3. **Fallback chain:** on PDM timeout or 5xx, fall back to a static JSON mapping at `sso_partner_mappers.json`. If neither yields a mapping, the user is stashed in the **pending-approval queue** (see Security & Permissions).
4. Call `BusinessPartnerUtil.get_or_create_participant_company()` at `src/clients/nacora/utils.py` — creates or updates the Participant Company and attaches the person's Person BP via a `belongs_to` `BusinessPartnerRelation`.
5. Attach roles to the BP based on the resolution result (Producer, Participant, Underwriter, Administrator).

**PDM token cache.** The OAuth2 token that Nacora uses to call PDM is cached in Redis under `NACORA_PDM_TOKEN_CACHE_KEY = 'nacora_pdm_token'` with a 10-minute TTL, so bursty SSO events do not each re-authenticate against PDM.

**Simulation mode.** `NACORA_PDM_SIMULATION_ENABLED = True` (dev only) returns canned PDM data — used for local development without a live PDM connection.

### OTP flow (drfpasswordless)

External participants sign in to `nacora-sp.i2go.io` via email OTP. Powered by `drfpasswordless` with Nacora-specific configuration:

| Setting | Value | Purpose |
|---|---|---|
| `PASSWORDLESS_AUTH_TYPES` | `['EMAIL']` | Email OTP only (no SMS) |
| `PASSWORDLESS_TOKEN_EXPIRE_TIME` | `300` | 5-minute code lifetime |
| `PASSWORDLESS_USER_EMAIL_FIELD_NAME` | `get_email_or_bp_email` | Nacora custom getter — resolves either the User email or the BP email alias |
| `PASSWORDLESS_REGISTER_NEW_USERS` | `False` | OTP must land on a pre-provisioned User; no auto-signup |
| `PASSWORDLESS_EMAIL_NOREPLY_ADDRESS` | `'i2go@tigerlab.com'` | From-address on the OTP email |
| `CHECK_OTP_USER_DIRECT_FROM_ALIAS` | `True` | Match against BP email alias, not `User.email`; lets external BPs OTP without a linked User row |

Five wrong OTP submissions in a session force the participant to request a new code.

### OAuth2 model (in-house)

The platform exposes an internal OAuth2 provider at `src/auths/` — used by the shipment portal (CSP mode) and API integrations to obtain and refresh bearer tokens. Key concepts:

- **Access token** — short-lived (`OAUTH2_ACCESS_TOKEN_EXPIRE_SECONDS`), sent as `Authorization: Bearer <token>`.
- **Refresh token** — longer-lived, exchanged for a new access token when the previous one expires.
- **`OAuth2TokenMiddleware`** — extracts the bearer token, validates against the token table, populates `request.user`. Runs before DRF's authentication.
- **Revocation** — administrative endpoint invalidates all outstanding tokens for a User (used on de-provisioning).

### Session cookie flow (back-office)

Once authenticated via any backend, the response sets `SESSIONID`. Subsequent requests read from `SESSION_ENGINE = 'django.contrib.sessions.backends.cache'` — Redis-backed for fast lookup and easy invalidation. Session invalidation is O(1) on Redis; the audit trail captures the invalidating actor.

### Session security middleware

`SessionSecurityMiddlewareOverride` (Nacora-shipped override of the stock `session-security` package) enforces:

- **Idle timeout** — user is logged out after `SESSION_SECURITY_EXPIRE_AFTER` seconds of no activity.
- **Warn window** — client is warned `SESSION_SECURITY_WARN_AFTER` seconds before expiry.
- **Concurrent login** — `ALLOW_CONCURRENT_LOGIN = True` permits the same user across multiple devices simultaneously; setting to `False` invalidates prior sessions on new login.

### Post-login redirect

`LOGIN_REDIRECT_URL = '/dashboard/'` for back-office; the shipment portal's post-OTP redirect lands at its SPA root. The redirect target is honoured only when it matches an allowlisted path — `URLRegexAccessMiddleware` and `CustomRedirectMiddleware` co-operate here.

## Configuration & operational levers

| Setting / env var | Purpose | Typical value |
|---|---|---|
| `AUTHENTICATION_BACKENDS` | The chain itself (see above) | Rebuilt in `src/clients/nacora/settings.py` |
| `USE_MOZILLA_OIDC` | Toggle OIDC backend | `True` in staging/prod, `False` in local dev |
| `OIDC_RP_CLIENT_ID` / `OIDC_RP_CLIENT_SECRET` | Okta client credentials | From vault |
| `OIDC_OP_AUTHORIZATION_ENDPOINT` / `TOKEN_ENDPOINT` / `USER_ENDPOINT` / `JWKS_ENDPOINT` | Okta discovery URLs | From Okta tenant |
| `LOGIN_REDIRECT_URL` | Post-login target | `/dashboard/` |
| `SESSION_ENGINE` | Session backend | `django.contrib.sessions.backends.cache` (Redis) |
| `SESSION_COOKIE_SECURE` | HTTPS-only cookie | `True` in staging/prod |
| `SESSION_COOKIE_HTTPONLY` | Block JS cookie read | `True` |
| `SESSION_COOKIE_SAMESITE` | CSRF protection | `Lax` |
| `SESSION_SECURITY_EXPIRE_AFTER` | Idle-timeout seconds | Env-defined |
| `SESSION_SECURITY_WARN_AFTER` | Warn-before-expiry seconds | Env-defined |
| `ALLOW_CONCURRENT_LOGIN` | Multi-device login | `True` |
| `MAX_LOGIN_ATTEMPTS` | Password lockout threshold | `3` |
| `SEND_EMAIL_WHEN_BLOCKED` | Notify user on lockout | `True` |
| `PASSWORDLESS_TOKEN_EXPIRE_TIME` | OTP lifetime (seconds) | `300` |
| `PASSWORDLESS_AUTH_TYPES` | OTP channels | `['EMAIL']` |
| `PASSWORDLESS_USER_EMAIL_FIELD_NAME` | User field OTP looks up | `get_email_or_bp_email` (Nacora custom) |
| `PASSWORDLESS_REGISTER_NEW_USERS` | Auto-signup on OTP | `False` |
| `CHECK_OTP_USER_DIRECT_FROM_ALIAS` | OTP matches BP email alias | `True` |
| `NACORA_PDM_TOKEN_URL` / `_API_URL` / `_CLIENT_ID` / `_CLIENT_SECRET` | PDM OAuth2 + person data | From vault |
| `NACORA_PDM_REQUEST_TIMEOUT` | PDM HTTP timeout (seconds) | `10` |
| `NACORA_PDM_SIMULATION_ENABLED` | Dev-only canned PDM | `False` in prod |
| `NACORA_PDM_TOKEN_CACHE_KEY` | Redis key for PDM OAuth2 token | `nacora_pdm_token` |
| `IGNORE_GROUP_OBJECT_PERMISSION` | Disable guardian group perms | `True` |

## Constraints, guarantees, and gotchas

- **Backends are tried in order; first success wins.** Reordering the list changes behaviour — a custom `OIDCBackend` before `LoginBackend` would intercept password logins meant for external users. Do not reorder without knowing why the current order exists.
- **`ObjectPermissionBackend` is inert.** Even though it is present, `IGNORE_GROUP_OBJECT_PERMISSION = True` short-circuits its checks. Row-level scoping is done by queryset filter services — see Security & Permissions.
- **OIDC is env-toggled.** `USE_MOZILLA_OIDC = False` in local dev means the OIDC backend is essentially skipped. Turning it on locally requires a real (or simulated) Okta tenant.
- **`SocialAdapter.pre_social_login()` is the single choke point** for SSO. If it raises, the entire login roundtrip fails and the user sees a generic error. Errors here must be caught and logged with the pdmuid attached to Sentry.
- **PDM fallback chain is deterministic.** Live API (10s timeout) → `sso_partner_mappers.json` → pending-approval queue. No user is silently created with the wrong role.
- **OTP does not auto-register users.** `PASSWORDLESS_REGISTER_NEW_USERS = False`. A participant's User row must exist (via SSO or an admin action) before OTP works — otherwise OTP requests silently fail with "no such user".
- **Session cookies are Redis-backed.** Redis is the single point of session state; a Redis eviction of session keys logs everyone out.
- **`SessionSecurityMiddlewareOverride` runs on every request.** If it is misconfigured (missing settings, wrong middleware order), all users appear to be logged out. This middleware runs after `SessionMiddleware` and before `AuthenticationMiddleware`.
- **Concurrent login is allowed.** Two devices for the same user work fine, but any password reset revokes all sessions.

## Related concepts

- Security & Permissions
- Session Security
- Caching & Redis
- APIs & Integrations
- Third-Party Integrations — Failure Modes
