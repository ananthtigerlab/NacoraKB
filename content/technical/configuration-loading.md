# Configuration Loading

## What it is

Nacora's configuration is composed at Django startup from four layers, each layered on top of the previous. This page documents the exact loading order, the named-import pattern used to layer settings without modifying the base module, how `INSTALLED_APPS` and `MIDDLEWARE` are rebuilt on top of the base defaults, and the environment variable + local-settings-module machinery that selects the right per-environment overlay at container start.

The end result is: same base module, same Nacora overrides, only per-environment overlay + env vars differ between dev / staging / prod.

## Who owns it or touches it

- **Backend engineers** adding a new setting — must decide which layer it belongs in.
- **DevOps / SREs** managing per-environment overlays and Kamal secrets.
- **On-call** debugging why a specific setting has a different value in prod than expected.
- **New contributors** grokking why `src/insurance/settings.py` and `src/clients/nacora/settings.py` both exist.

## How it works

### The four layers

| # | File / source | Loaded when | Overrides |
|---|---|---|---|
| 1 | `src/insurance/settings.py` (base) | Django import at process start | Platform defaults for every client |
| 2 | `src/clients/nacora/settings.py` | Imported explicitly from the Nacora entry point (`DJANGO_SETTINGS_MODULE=clients.nacora.settings`) | Nacora-specific overrides on top of layer 1 |
| 3 | `docker/local_settings.py.<env>` | Conditionally loaded from Nacora settings if `DJANGO_LOCAL_SETTINGS_MODULE` is set | Per-environment overlay baked into the container |
| 4 | Environment variables | Read via `os.environ` at import time or via `django-environ` | Runtime override — supersedes everything above |

`DJANGO_SETTINGS_MODULE` is set to `clients.nacora.settings` in every environment. That module is the single entry Django loads; the base module is only reached because Nacora's settings module explicitly imports from it.

### Named-import pattern

Nacora's settings module does not use `from insurance.settings import *`. Instead it names each object it wants to inherit and rebuilds where it needs to override. This keeps the diff diffable and prevents surprise overrides. Excerpt:

```
# src/clients/nacora/settings.py

from insurance.settings import (
    INSTALLED_APPS as BASE_INSTALLED_APPS,
    MIDDLEWARE as BASE_MIDDLEWARE,
    REST_FRAMEWORK as BASE_REST_FRAMEWORK,
    DATABASES,                               # inherited unmodified
    ATOMIC_REQUESTS,                         # inherited unmodified
    CELERY_TASK_ROUTES as BASE_CELERY_ROUTES,
    JAZZMIN_SETTINGS,                        # inherited unmodified
    # ... explicit list of every symbol used below
)

INSTALLED_APPS = BASE_INSTALLED_APPS + [
    'clients.nacora',
    # additional Nacora-installed apps
]

MIDDLEWARE = BASE_MIDDLEWARE + [
    'clients.nacora.middleware.CspDomainRedirectMiddleware',
    'clients.nacora.middleware.PendingApprovalRedirectMiddleware',
]

REST_FRAMEWORK = {
    **BASE_REST_FRAMEWORK,
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # Nacora-specific tweaks
}

CELERY_TASK_ROUTES = {
    **BASE_CELERY_ROUTES,
    'nacora.mails.send_queued_mails':   {'queue': 'default'},
    'nacora.tasks.publish_rating_product': {'queue': 'default'},
    # ...
}

# CUSTOM_* service registrations
CUSTOM_QUERYSET_SERVICE = { ... }
CUSTOM_PERMISSION_CLASS  = { ... }
CUSTOM_POLICY_STATUS_SERVICE = 'clients.nacora.policies.services.PolicyStatusService'
# ...

# Nacora-specific settings not present in base
NACORA_SPECIAL_RATE_ENABLED = True
NACORA_GEORISK_WEBHOOK_ENABLED = True
NACORA_ANALYTICS_SETTINGS = { ... }
SOAP_INBOUND_ENABLED = True
SOAP_SALOG_CODE_MAP = { ... }
```

Every base symbol used is explicitly named. That makes it obvious in a code review when a base setting is depended on, and prevents accidental picks-up from wildcard imports.

### `INSTALLED_APPS` and `MIDDLEWARE` rebuild

Both are declared as new lists that concatenate the base plus Nacora-specific additions. Order matters:

- `INSTALLED_APPS`: `clients.nacora` must appear after `django.contrib.auth` and after any app whose models it overrides. Nacora-specific apps (`clients.nacora.faqs`, etc.) that ship models must come before any app that references them via FK.
- `MIDDLEWARE`: order is critical. `HealthCheckMiddleware` is first (before session parsing) so `/health` returns 200 without a DB hit. `CspDomainRedirectMiddleware` runs after `SessionMiddleware` (needs the session) but before the URL resolver. `PendingApprovalRedirectMiddleware` runs after `AuthenticationMiddleware` (needs `request.user`).

Never insert into the middle of `BASE_MIDDLEWARE` without a review — the ordering encodes assumptions.

### Per-environment overlay — `docker/local_settings.py.<env>`

At the bottom of `src/clients/nacora/settings.py`:

```
_local = os.environ.get('DJANGO_LOCAL_SETTINGS_MODULE')
if _local:
    try:
        exec(open(_local).read())     # or importlib mechanism
    except FileNotFoundError:
        pass
```

Kamal sets `DJANGO_LOCAL_SETTINGS_MODULE=/app/docker/local_settings.py.prod` (or `.staging`, `.dev`). The overlay file typically holds:

- Environment-specific integration URLs (`GEORISK_BASE_URL`, `BMS_WEBHOOK_URL`).
- Feature-flag flips per environment (`CARGO_SANCTION_SETTINGS['ENABLED'] = True` in prod but not staging).
- Logging config overrides.
- `DEBUG`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`.
- `CORS_ALLOWED_ORIGINS` list.
- `SENTRY_ENVIRONMENT = 'prod'`.

Local dev uses a checked-in template: `docker/local_settings.py.dev.example` → developer copies to `.dev` and edits.

### Environment variable overrides — runtime

Any secret or environment-dependent value is read from `os.environ` at import time. `django-environ` provides typed helpers (`env.str`, `env.int`, `env.bool`, `env.list`, `env.db`). Examples:

```
env = environ.Env(
    DEBUG=(bool, False),
    SENTRY_TRACES_SAMPLE_RATE=(float, 0.1),
    NACORA_PDM_REQUEST_TIMEOUT=(int, 10),
    CORS_ALLOWED_ORIGINS=(list, []),
)

SECRET_KEY = env.str('SECRET_KEY')
DATABASE_URL = env.db('DATABASE_URL')
REDIS_URL = env.str('REDIS_URL')
```

Env-var values override anything set in layers 1–3 because they are read at the same import time.

### Per-env module resolution — the container start-up

At container start (Kamal `env:` block in `config/deploy.yml`):

```
env:
  DJANGO_SETTINGS_MODULE: clients.nacora.settings
  DJANGO_LOCAL_SETTINGS_MODULE: /app/docker/local_settings.py.prod
  APP_CLIENT: nacora
  APP_ENV: prod
  # ... secrets from Kamal vault
```

At Python import time, `settings.py` reads env vars, imports base, applies Nacora overrides, exec's the local overlay, and Django is ready.

### Where each type of value belongs

| Kind of setting | Layer |
|---|---|
| Platform defaults, shared with every client | 1 (base) |
| Nacora feature flag with a safe default | 2 (Nacora settings) |
| `CUSTOM_*` service class registration | 2 (Nacora settings) |
| Per-environment URL that isn't a secret (e.g. `GEORISK_BASE_URL` for staging vs prod) | 3 (overlay) |
| Secret (API key, DB password) | 4 (env var, Kamal secret) |
| Feature flag flipped only in one environment | 3 (overlay) or 4 (env var) — prefer overlay unless the value must be rotatable at runtime |
| DEBUG, ALLOWED_HOSTS | 3 (overlay) |

## Configuration & operational levers

- `DJANGO_SETTINGS_MODULE` = `clients.nacora.settings` always.
- `DJANGO_LOCAL_SETTINGS_MODULE` = absolute path to the per-env overlay in the container.
- `APP_CLIENT` = build arg + env var; identifies the tenant for logging and health.
- `APP_ENV` = `dev` / `staging` / `prod`; used by logging config and Sentry tagging.
- Verifying resolved settings: `python src/manage.py diffsettings` shows every setting whose value differs from Django's baked-in default; useful for auditing what a specific environment resolved to.

## Constraints, guarantees, and gotchas

- **The base module is never modified for Nacora.** Every Nacora-specific line lives in layer 2 or below. If you find yourself editing `src/insurance/settings.py`, stop and check whether it should be a Nacora override.
- **Named imports over `import *`.** Wildcard imports hide dependencies. Every symbol used from the base is explicitly named.
- **Overlay is `exec`'d, not imported.** The overlay file is not a real Python module — it's read and exec'd in the settings module's namespace. That means it can freely mutate any setting the settings module has already defined.
- **Env-var values are read once at import.** Rotating a secret requires a container restart to pick up the new value.
- **`diffsettings` is your friend.** When production behaves differently from staging, run it in both and diff.
- **Missing env vars fail fast.** `env.str('SECRET_KEY')` without a default raises `ImproperlyConfigured` at import — the container never starts. This is intentional.
- **The overlay file is baked into the image at build time.** Rebuilding is required to change it. That's why real per-environment differences that need to rotate live in env vars, not the overlay.
- **`CUSTOM_*` service registrations are picked up on first resolve.** Adding a new override at runtime (which shouldn't happen anyway) doesn't take effect until the process restarts.

## Related concepts

- Environments & Config
- Local Development
- Service Override Pattern
- Docker Build
- Feature Flags
- Session Security
