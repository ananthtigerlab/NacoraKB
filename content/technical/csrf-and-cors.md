# CSRF & CORS

## What it is

Two related but distinct security layers:

- **CSRF (Cross-Site Request Forgery) protection** — enforced by Django's `CsrfViewMiddleware`. Applies to session-authenticated writes; ensures a form / API POST originated from a page the browser rendered under the same origin.
- **CORS (Cross-Origin Resource Sharing)** — controlled by `django-cors-headers` (`corsheaders.middleware.CorsMiddleware`). Governs which origins can issue browser-initiated cross-origin requests, and whether credentials are sent.

Both interact with the SPA front-ends (which POST from the browser) and with token-authenticated integrations (which are typically server-to-server and bypass most of this).

## Who owns it or touches it

- **Backend engineers** wiring new endpoints — decide whether the endpoint accepts session or token auth, and set the CSRF exemption accordingly.
- **Frontend engineers** ensure the CSRF token is included in write requests and that CORS pre-flight passes.
- **DevOps** sets `CORS_ALLOWED_ORIGINS` per environment.
- **Security team** audits both lists for over-permission.

## How it works

### CSRF — CsrfViewMiddleware

`CsrfViewMiddleware` is in the base `MIDDLEWARE` list. On every write request (`POST` / `PUT` / `PATCH` / `DELETE`):

1. Read `csrftoken` cookie.
2. Read `X-CSRFToken` header (or `csrfmiddlewaretoken` form field).
3. Compare using constant-time equality after normalisation.
4. On mismatch → 403 with a CSRF-specific reason string.

**Session vs token auth.** DRF's default view configuration exempts endpoints that use `TokenAuthentication` or `OAuth2Authentication` from CSRF automatically — `enforce_csrf` only runs on `SessionAuthentication`. The exemption is at the view level (via DRF), not middleware-level.

**SPA / cookie-authenticated writes** still require CSRF. Both Nacora front-ends fetch the `csrftoken` cookie and include it in an `X-CSRFToken` header on every write. This is done in the API-client wrappers under `frontend/libs/nacora/data-access/`.

**Cross-domain CSRF.** With the two portals on different subdomains (`nacora-bo.i2go.io` and `nacora-sp.i2go.io`), a session cookie set on one does not travel to the other. That's the intended isolation — see Domain Isolation on Security & Permissions.

**CSRF-trusted origins.** `CSRF_TRUSTED_ORIGINS` (per env) lists the schemes+hosts that are trusted for CSRF check bypass on cross-origin form submits. In prod this is exactly:

```
CSRF_TRUSTED_ORIGINS = [
  'https://nacora-bo.i2go.io',
  'https://nacora-sp.i2go.io',
]
```

Wildcards are not permitted in prod. In dev, `http://localhost:8000` and `http://localhost:4200` are added.

**When to exempt.** New CSRF exemptions are exceptional. If a view must be exempt (e.g. a webhook receiver posted from outside), use `@csrf_exempt` explicitly and pair it with an HMAC signature check on the incoming payload.

### CORS — corsheaders

`corsheaders.middleware.CorsMiddleware` is at the top of the middleware stack (before `SessionMiddleware`) so CORS pre-flight requests never touch the DB or session parsing.

**Configured allowed origins** — per env, enumerated exhaustively:

| Environment | Allowed origins |
|---|---|
| dev | `http://localhost:4200`, `http://localhost:8000` |
| staging | `https://nacora-staging.i2go.io` |
| prod | `https://nacora-bo.i2go.io`, `https://nacora-sp.i2go.io` |

Never `CORS_ALLOWED_ORIGINS_ALL_ORIGINS = True` in staging or prod. Wildcards on origins would defeat the same-origin protection provided by CORS.

**Credentials mode.** `CORS_ALLOW_CREDENTIALS = True` — the SPA needs to send cookies on cross-origin requests. With this enabled, the browser refuses `Access-Control-Allow-Origin: *` responses, which is another reason wildcards are impossible.

**Headers allowed.** `CORS_ALLOW_HEADERS` includes the DRF-standard set plus `X-CSRFToken` and `X-Requested-With`.

**Methods allowed.** All standard REST verbs; explicit list rather than default.

**Pre-flight caching.** `CORS_PREFLIGHT_MAX_AGE = 86400` (24 h) — browsers can cache the pre-flight response, cutting the overhead of the `OPTIONS` round-trip.

### Interaction: session auth + CORS + CSRF

The most common flow is a SPA calling the API with a session cookie:

1. Browser sees the SPA is on `nacora-bo.i2go.io` and the API is at `nacora-bo.i2go.io/api/v1/...` — same origin. No CORS pre-flight.
2. Session cookie is sent automatically.
3. CSRF token is fetched from the `csrftoken` cookie by the SPA JS.
4. Write requests include `X-CSRFToken: <token>` header.
5. `CsrfViewMiddleware` validates. Success → view runs.

If the SPA is deployed under a different subdomain from the API (rare in Nacora but possible in dev), CORS pre-flight kicks in and `CORS_ALLOW_CREDENTIALS = True` is required for the session cookie to travel.

### Token-authenticated writes

SOAP inbound, service-to-service webhooks, and bearer-token API access do not carry Django session cookies. They authenticate via `Authorization: Bearer <token>` or WS-Security. For these:

- CSRF does not apply (DRF exempts token-auth endpoints from CSRF).
- CORS also does not apply in practice — server-to-server callers do not enforce CORS.
- Origin is validated by other means: IP allowlist, mTLS (on some upstream integrations), or HMAC of the payload for webhook receivers.

### Webhook receivers

Inbound webhooks (e.g. GeoRisk callback) are exempt from CSRF and authenticated by a shared secret:

- `@csrf_exempt` decorator on the view.
- HMAC signature check: the request body is signed with a shared secret; the view rejects on signature mismatch.
- Idempotency: dedup keys in DynamoDB where required.

### CORS pre-flight (OPTIONS) fast path

The `OPTIONS` request that browsers send for non-simple cross-origin requests:

1. Hits `CorsMiddleware` first — no session, no auth.
2. Middleware compares `Origin` against `CORS_ALLOWED_ORIGINS`.
3. If allowed: returns 204 with `Access-Control-Allow-*` headers. Cached per `CORS_PREFLIGHT_MAX_AGE`.
4. If not allowed: returns without the allow headers; browser blocks the follow-up request.

**No pre-flight for GET/HEAD/POST with simple content types.** Standard "simple request" rules apply. Most Nacora API writes include `Content-Type: application/json` which is non-simple, triggering pre-flight.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `CSRF_TRUSTED_ORIGINS` | Origins trusted for CSRF check bypass |
| `CSRF_COOKIE_SECURE` | HTTPS-only in staging/prod |
| `CSRF_COOKIE_HTTPONLY` | Whether JS can read the token cookie (`False` — SPA needs to read it) |
| `CSRF_COOKIE_SAMESITE` | `'Lax'` |
| `CSRF_HEADER_NAME` | `HTTP_X_CSRFTOKEN` |
| `CSRF_USE_SESSIONS` | `False` — token stored in cookie, not session |
| `CORS_ALLOWED_ORIGINS` | List of allowed origins per env |
| `CORS_ALLOW_CREDENTIALS` | `True` |
| `CORS_ALLOW_HEADERS` | Header allowlist |
| `CORS_ALLOW_METHODS` | Method allowlist |
| `CORS_PREFLIGHT_MAX_AGE` | Pre-flight cache TTL |

## Constraints, guarantees, and gotchas

- **No wildcards in prod.** `CORS_ALLOWED_ORIGINS = ['*']` or `CSRF_TRUSTED_ORIGINS = ['*']` are prohibited by review. Enumerate origins exhaustively.
- **`CSRF_COOKIE_HTTPONLY = False` is intentional.** The SPA needs to read the token cookie via JS to include it in the request header. This is standard Django CSRF — the token in the cookie is not itself a session, so exposing it to JS is safe.
- **Token-auth endpoints skip CSRF.** Never combine session + token auth on the same view — pick one. Combining them creates a bypass path.
- **`SameSite=Lax` on the session cookie interacts with CSRF.** Combined, they close most CSRF vectors; the CSRF middleware is defence-in-depth.
- **New integrations must not disable CORS globally.** If a third-party integration needs a specific origin allowed, add exactly that origin — not a broader pattern.
- **Webhook receivers need an alternate origin check.** Since they're `@csrf_exempt`, the HMAC signature is the only integrity check — do not merge a webhook receiver without one.
- **Cross-domain writes between the two portals do not happen.** The domain-guard middleware blocks that path first; CORS is a secondary defence.
- **Preflight failures manifest as opaque browser errors.** If a new SPA is failing to reach the API with a "CORS" error in the console, first check whether the origin is in `CORS_ALLOWED_ORIGINS` in the correct overlay file.

## Related concepts

- Security & Permissions
- Session Security
- Auth Backends
- Architecture Overview
- Configuration Loading
- SOAP Inbound
