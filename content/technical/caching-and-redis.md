# Caching & Redis

## What it is

Redis is Nacora's shared-memory layer. It backs the Django cache, the session store, and a handful of subsystem-specific caches (PDM OAuth2 tokens, GeoRisk party lookups, FX-rate lookups, choices/lookups). Everything Redis holds is either recomputable or reissuable — Nacora treats Redis as best-effort. This page enumerates every documented cache key, its TTL, its owner, and its invalidation strategy.

## Who owns it / who touches it

- **Backend engineers** adding new caches, invalidating existing ones, or debugging stale reads.
- **DevOps / SRE** sizing Redis, monitoring hit rate, handling failovers.
- **On-call** debugging "why did my session vanish", "why is FX conversion showing yesterday's rate", or "why did GeoRisk get called twice".

## How it works

### Redis at a glance

- **Backend URL.** `REDIS_URL` env var, e.g. `redis://:pwd@redis:6379/0`. Reused for cache and session.
- **Session engine.** `SESSION_ENGINE = 'django.contrib.sessions.backends.cache'` — sessions live entirely in Redis, no PostgreSQL fallback.
- **Django cache framework.** Standard `django.core.cache.cache` API. Key namespacing is by prefix convention — no global prefix is configured, so callers own their key hygiene.
- **Deployment shape.** One Redis instance per environment. No cluster; no replication in dev; managed replicated setup in prod (typically ElastiCache).

### Documented caches

| Cache | Key | TTL | Owner module | Populate | Invalidate |
|---|---|---|---|---|---|
| **Session store** | `session:<sessionid>` (Django-generated) | `SESSION_COOKIE_AGE` (env-configured) | `django.contrib.sessions` | Set on login | Deleted on logout, expiry, or password change |
| **PDM OAuth2 token** | `NACORA_PDM_TOKEN_CACHE_KEY = 'nacora_pdm_token'` | 10 minutes | `src/clients/nacora/auths/` | Populated on first PDM call after expiry | Naturally expires; can be manually flushed |
| **GeoRisk parties** | `georisk:party:<sha256(name+country)>` (or equivalent) | `GEORISK_PARTY_CACHE_SECONDS = 86400` (24h) | `src/clients/nacora/webhooks/` | Populated on GeoRisk webhook dispatch when the party is first seen | TTL-only |
| **FX rates (analytics enrichment)** | `fx:<from>:<to>:<date>` | 10 minutes | `src/clients/nacora/analytics/` | Populated on event-stream emit | TTL-only |
| **Choices catalogue lookups** | `choices:<slug>` or per-object-type variant | Long (until write) | `src/i2go_choices/` | On first read | Invalidated on `Choices.save()` signal |
| **Rating catalogue reads** | `rating:catalog:<policy_id>:<rating_version_id>` | Short (~5 min) | `src/clients/nacora/ratings/` | On first rating call in the window | TTL-only |
| **DRF throttle counters** | `throttle:*` (DRF-standard) | Sliding window per throttle scope | DRF | Every request | TTL-only |

Not every cache above is enumerated with a bespoke `set(...)` call site — some are consequences of DRF or Django defaults (throttle counters, session keys). The named caches (PDM, GeoRisk, FX, choices, rating catalogue) are load-bearing and documented.

### Cache patterns

**Read-through with TTL.** The dominant pattern:

1. Compute the cache key from the query parameters.
2. `cache.get(key)` — return if present.
3. On miss, call the underlying source (PDM API, DB, external service).
4. `cache.set(key, value, timeout=<ttl>)`.
5. Return.

**Signal-driven invalidation.** For catalogues that rarely change (Choices, LookupItem, ClauseCategory), a post-save signal on the model deletes the cached key. Reads are cheap; writes take the invalidation cost.

**Manual invalidation via management command.** For emergency cache flushes, `python manage.py flush_cache` (a Nacora-specific command) drops everything except session keys.

### Cache misses and degradation

Redis is best-effort. A Redis outage:

- **Sessions** — all logged-in users are logged out. Login page shows immediately; users re-authenticate.
- **PDM token** — the next SSO event re-issues the token via PDM's OAuth2 endpoint.
- **GeoRisk parties** — every webhook re-hits GeoRisk instead of using the 24h cache; expected latency + cost spike.
- **FX rates** — same, but the source (PostgreSQL `ExchangeRate` table) is cheap. No user-visible impact.
- **Choices catalogue** — every read hits PostgreSQL. Manageable at Nacora's scale.
- **Throttle counters** — throttling silently disabled (misses treated as "no prior request"). Not a security posture; a load posture.

Nothing in the platform blocks on Redis. A slow Redis hurts p95 but does not error a request.

### Redis sizing considerations

- **Session keys** are the dominant memory consumer. Each session is a few hundred bytes to a few KiB, depending on how many wizard-step values are stashed on the session.
- **PDM token** is a single key per environment — negligible.
- **GeoRisk parties** — one key per unique (shipper/consignee, country) pair. Grows with distinct booked parties; 24h TTL bounds it.
- **FX rates** — small (dozens of keys per environment).
- **Choices** — small (tens of keys).

Total working set is dominated by sessions. Sizing runbook: allocate for peak concurrent sessions × 4 KiB, add 25% headroom.

## Configuration & operational levers

| Env var / setting | Purpose | Typical value |
|---|---|---|
| `REDIS_URL` | Full connection URL (host, port, password, DB index) | `redis://:pwd@redis:6379/0` |
| `CACHES['default']` | Django cache backend config | `django-redis` (`django_redis.cache.RedisCache`) |
| `SESSION_ENGINE` | Session backend | `django.contrib.sessions.backends.cache` |
| `SESSION_COOKIE_AGE` | Session lifetime (seconds) | Env-defined |
| `NACORA_PDM_TOKEN_CACHE_KEY` | Redis key for PDM OAuth2 token | `'nacora_pdm_token'` |
| `GEORISK_PARTY_CACHE_SECONDS` | GeoRisk party TTL | `86400` |
| `SESSION_SECURITY_EXPIRE_AFTER` | Idle-timeout (session-security package) | Env-defined |
| `SESSION_SECURITY_WARN_AFTER` | Warn-before-expiry | Env-defined |

## Constraints, guarantees, and gotchas

- **Redis is not durable.** Do not put anything there that isn't reissuable. Financial data, audit events, and pricing decisions live in PostgreSQL / DynamoDB.
- **No cache stampede protection.** A cold key that many requests hit simultaneously will all miss and all recompute. In practice this is a problem only for the PDM token — bursty SSO events could re-authenticate against PDM. The 10-minute cache TTL is short enough that the current volume is fine; if bursts grow, a distributed lock (via `django-redis` `lock()`) is the intended remedy.
- **Session eviction is user-visible.** A Redis flush logs everyone out. Do it at low traffic and with communication.
- **`django-redis` is the client.** Its `lock()`, `delete_pattern()`, and pipelining APIs are available. Prefer `delete_pattern("prefix:*")` for bulk invalidation over iterating keys.
- **Key naming has no global namespace.** Callers own their prefixes. Convention: `<subsystem>:<entity>:<discriminator>`. When invalidating, delete by pattern.
- **Session cookie is HttpOnly + Secure + Lax in staging/prod.** Front-end JS cannot read it; cross-site requests can't leak it. Any deviation must be an explicit setting change.
- **Multi-tenant care.** Nacora shares a Redis with other tenants on some environments. Key collisions are prevented by convention (per-tenant prefix), not by separate DB indices. When adding a new key, prefix with `nacora:` to be explicit.
- **PDM cache-key rotation on secret change.** When `NACORA_PDM_CLIENT_SECRET` rotates, the cached token may still be valid until expiry; a manual `cache.delete('nacora_pdm_token')` is safe and forces reissue.

## Related concepts

- Session Security
- Authentication Backends
- Environments & Config
- Third-Party Integrations — Failure Modes
- Event Stream & Audit Trail
