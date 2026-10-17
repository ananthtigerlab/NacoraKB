# Session Security

## What it is

The session-security posture across cookies, idle-timeout, concurrent-login handling, and session revocation. Nacora runs Django sessions backed by Redis (via the `cache` engine), uses `SessionSecurityMiddlewareOverride` for idle timeout, and permits concurrent logins across devices — with an explicit toggle to disable if that changes.

This page consolidates the settings and middleware that shape session behaviour, and describes how session invalidation works in operational scenarios.

## Who owns it or touches it

- **Backend engineers** touching auth flows or session-scoped data.
- **DevOps** managing the Redis session store.
- **Security team** auditing cookie flags and CORS/CSRF interaction.
- **Support** helping a user whose session was invalidated by a concurrent login.

## How it works

### Cookie flags

Set in Nacora settings and enforced by the overlay in staging + prod:

| Setting | Value | Purpose |
|---|---|---|
| `SESSION_COOKIE_SECURE` | `True` in staging/prod | Cookie only sent over HTTPS |
| `SESSION_COOKIE_HTTPONLY` | `True` | JavaScript cannot read the cookie |
| `SESSION_COOKIE_SAMESITE` | `'Lax'` | CSRF-mitigating cookie policy — third-party sites cannot send the cookie in cross-origin sub-requests |
| `SESSION_COOKIE_NAME` | Platform default (`sessionid`) | Cookie name |
| `SESSION_COOKIE_AGE` | Platform default (2 weeks) | Absolute cookie lifetime |
| `SESSION_SAVE_EVERY_REQUEST` | `True` | Refresh the session's last-active timestamp on every request (needed for idle-timeout) |
| `SESSION_EXPIRE_AT_BROWSER_CLOSE` | `False` | Persist across browser restarts |

In dev, `SESSION_COOKIE_SECURE = False` (localhost is HTTP), everything else remains the same.

### Session store — Redis via cache engine

```
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
CACHES['default'] = { 'BACKEND': 'django_redis.cache.RedisCache', 'LOCATION': env.str('REDIS_URL'), ... }
```

Sessions live in the same Redis instance as the general cache. Consequences:

- **Fast session lookup.** No DB round-trip per request.
- **Session data must be small.** Session lives in Redis memory; keep session-attached data to a minimum. Big attachments belong in S3, not in `request.session`.
- **Flushing the cache flushes sessions.** `redis-cli FLUSHDB` invalidates every session; do not use as a routine cache reset.
- **No durability across a Redis wipe.** If Redis restarts without persistence (AOF), all sessions are lost — users must sign in again. In prod, Redis is configured with AOF (append-only file) so sessions survive Redis restarts within the AOF window.

### `SessionSecurityMiddlewareOverride`

Nacora's subclass of the `django-session-security` middleware. Wired into the middleware chain in Nacora settings.

**Behaviour:**

- Tracks the last activity timestamp per session (stored on the session).
- If `now - last_activity > SESSION_SECURITY_EXPIRE_AFTER`, the session is invalidated on the next request. The user is redirected to the login page.
- A warning modal appears in the SPA when `now - last_activity > SESSION_SECURITY_WARN_AFTER` — user can click "Stay signed in" to refresh the timestamp.
- The override customises the JSON keep-alive endpoint (`/session_security/ping/`) so it works with the DRF session-auth flow and the OTP shipment-portal flow without a full round-trip.

Typical values:

| Setting | Value | Purpose |
|---|---|---|
| `SESSION_SECURITY_EXPIRE_AFTER` | `1800` (30 min) | Idle timeout — invalidate after 30 min of inactivity |
| `SESSION_SECURITY_WARN_AFTER` | `1500` (25 min) | Show warning modal 5 min before expiry |
| `SESSION_SECURITY_PASSIVE_URLS` | `['/health', '/silk/*']` | URLs that do not count as activity |
| `SESSION_SECURITY_INSECURE` | `False` in staging/prod | Enforce HTTPS on the ping endpoint |

The middleware is compatible with the OTP portal — OTP-authenticated participants have the same idle-timeout policy as back-office users.

### Concurrent login handling

`ALLOW_CONCURRENT_LOGIN = True` — a user can be signed in from multiple devices simultaneously. Each login creates a separate session in Redis; sessions are independent.

If concurrent login is disabled (`ALLOW_CONCURRENT_LOGIN = False`), the login backend invalidates all other sessions for the user before creating the new one. This is not currently enabled but the code path exists.

**Session ownership tracking:** the platform stores a `user_uuid → session_key` map in Redis under `session_ownership:<user_uuid>` for the disable path. When enabled, the login flow enumerates and deletes the old sessions.

### Session revocation

Several operational scenarios revoke sessions:

| Scenario | Mechanism |
|---|---|
| User signs out | `logout()` — session key deleted from Redis |
| Password change | Django's `update_session_auth_hash()` rotates the session key; old key invalidated |
| Account lockout (`MAX_LOGIN_ATTEMPTS = 3`) | Session invalidated + user flag flipped |
| Admin force-signout | Management command: `python src/manage.py invalidate_user_sessions <user_uuid>` — deletes all `session_ownership:<uuid>` keys and removes sessions |
| PDM re-approval required | `partner.extra_data.nacora_approval.status = 'PENDING'` → `PendingApprovalRedirectMiddleware` redirects on next request |
| Bulk revocation (incident) | `redis-cli KEYS "sessionid:*" \| xargs redis-cli DEL` — flushes all sessions; requires everyone to sign in again |

Each revocation is a Redis delete — the next request from that session receives a fresh login redirect.

### Session-scoped data

What can be safely put on `request.session`:

- Small state (dozens of bytes): current cart, wizard progress, pending referral acknowledgement.
- User preference flags that don't need durability across devices.

What should not be put on `request.session`:

- Anything more than a few hundred bytes.
- Anything durable — user preferences belong in the DB.
- Anything sensitive — session state can be inspected by an admin with Redis access.

### Interaction with token auth

Bearer-token API access (OAuth2 or DRF Token) does not create a Django session. Token-authenticated requests are stateless — no session cookie, no idle timeout, no CSRF check (token itself is the credential). See CSRF & CORS for the split.

### Interaction with SSO

Okta / OIDC sign-in produces a normal Django session on completion of the callback flow. The `SocialAdapter` fires, the BP is resolved, and the session is set. From there on, the idle timeout applies as usual — the fact that the underlying identity provider is Okta does not change the session behaviour.

Refresh-token handling for OIDC lives elsewhere (auth-backends); this page is only about the local Django session.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `SESSION_ENGINE` | `'django.contrib.sessions.backends.cache'` |
| `SESSION_COOKIE_SECURE` / `HTTPONLY` / `SAMESITE` | Cookie flags |
| `SESSION_COOKIE_AGE` | Absolute cookie lifetime |
| `SESSION_SAVE_EVERY_REQUEST` | Refresh last-active per request |
| `SESSION_SECURITY_EXPIRE_AFTER` / `WARN_AFTER` | Idle timeout tuning |
| `ALLOW_CONCURRENT_LOGIN` | Multi-device sign-in toggle |
| `MAX_LOGIN_ATTEMPTS` | Password lockout threshold |
| `SEND_EMAIL_WHEN_BLOCKED` | Notify user of lockout |
| `REDIS_URL` | Session store connection |

Operational commands:

- `python src/manage.py invalidate_user_sessions <user_uuid>` — force sign-out.
- `python src/manage.py clearsessions` — Django built-in that removes expired sessions (unnecessary with Redis cache backend, which auto-expires).

## Constraints, guarantees, and gotchas

- **Redis persistence is critical.** Without AOF, a Redis restart signs everyone out. Verify AOF is enabled in prod.
- **Session data must be small.** Big session payloads slow every request (session write on save-every-request) and hog Redis memory.
- **Idle timeout is 30 min by default.** Long-running underwriting sessions may need a longer timeout — per-user tuning is not currently supported, only global.
- **Concurrent login is on.** If policy demands a single active session per user, flip `ALLOW_CONCURRENT_LOGIN = False` — but be aware this will surprise users who sign in on a phone and desktop simultaneously.
- **`SameSite=Lax` blocks some cross-origin flows.** If a new integration requires cross-site session cookies (e.g. an iframe embed on a partner site), `Lax` will need reconsideration — check with security before changing.
- **Session cookie name is not client-specific.** Two clients on the same domain would collide — Nacora uses distinct domains (`nacora-bo.i2go.io`, `nacora-sp.i2go.io`) so this doesn't come up in practice.
- **Token auth bypasses the session.** Idle-timeout does not apply to token-authenticated integrations — tokens have their own TTL rules.
- **Flushing Redis flushes sessions AND cache.** Do not `FLUSHDB` in production without accepting that every user will be signed out.

## Related concepts

- Auth Backends
- CSRF & CORS
- Caching & Redis
- Security & Permissions
- Configuration Loading
- Observability
