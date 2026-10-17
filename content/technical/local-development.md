# Local Development

## What it is

Bringing the Nacora stack up on a developer's laptop. This page covers prerequisites, the recommended Docker Compose flow, seeding sample data, iterating on the frontend, running tests, and the common commands used day-to-day.

## Who uses it & where

- **New engineers** on day one.
- **Existing engineers** returning to a rarely-touched area.
- **QA** running local smoke tests before a demo.

## How it works

### Prerequisites

- **Docker Desktop** (macOS or Linux) with at least 8 GB RAM allocated.
- **Node.js 20+** and **npm** (or **pnpm**, per workspace preference).
- **Python 3.11** if running the backend outside Docker (optional).
- **Git** with access to the InSurance monorepo.
- **AWS credentials** (`~/.aws/credentials`) with dev-tier permissions for Bedrock/Comprehend/S3 — required only if you want the AI or sanctions features working locally. Simulated fallbacks exist for both.
- **VS Code** with the Python and TypeScript extensions is the recommended editor.

### Clone and env setup

```
git clone git@bitbucket.org:tigerlab/insurance.git
cd insurance
cp .env.example .env
cp docker/local_settings.py.dev.example docker/local_settings.py.dev
```

Edit `.env` and `docker/local_settings.py.dev` to fill in:

- `SECRET_KEY` — any random string for dev.
- `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL` — the compose file provides defaults pointing at the compose services.
- `USE_MOZILLA_OIDC=False` — skip Okta for local; use username/password auth.
- `NACORA_PDM_SIMULATION_ENABLED=True` — return canned PDM data so you can test SSO without a live PDM connection.
- `CARGO_SANCTION_SETTINGS['ENABLED']=False` — skip Comprehend/SanctionScanner (no AWS calls).
- `NACORA_GEORISK_WEBHOOK_ENABLED=False` — skip the GeoRisk webhook.
- `SOAP_INBOUND_ENABLED=True` — keep the SOAP endpoint alive for testing.

### Bring up the stack with Docker Compose

```
docker compose up -d postgres redis rabbitmq       # start infrastructure only
docker compose up -d app                          # then start Django
docker compose logs -f app                         # tail the app log
```

Services:

- **postgres** on `localhost:5432` — auto-created via `docker/postgres/init.sql`.
- **redis** on `localhost:6379`.
- **rabbitmq** on `localhost:5672` (management UI on 15672 with `guest`/`guest`).
- **app** on `localhost:8000` — Django + Gunicorn.
- **celery-worker** — general worker for `default`/`sequential` queues.
- **celery-worker-audit-trail** — dedicated worker for the audit queue.
- **celery-beat** — periodic tasks scheduler.

Open http://localhost:8000/ once the app service is healthy.

### First-run migrations and seed

Inside the app container:

```
docker compose exec app python src/manage.py migrate
docker compose exec app python src/manage.py createsuperuser
docker compose exec app python src/manage.py setup_nacora_commodity_group_choices
docker compose exec app python src/manage.py setup_nacora_clause_categories
docker compose exec app python src/manage.py setup_nacora_lookup_categories
docker compose exec app python src/manage.py update_usd_exchange_rates
docker compose exec app python src/manage.py collectstatic --noinput
```

These commands:

- Apply Django migrations.
- Create a Django superuser for admin access.
- Seed the Nacora commodity groups, clause categories, and lookup categories (currencies, packing, coverages).
- Pull today's USD FX rates (needs `CURRENCY_API_KEY` — or leave empty and skip; conversions will produce nulls).
- Collect Django static files.

**Sample data.** For a broker-configured policy plus a handful of shipments, run:

```
docker compose exec app python src/manage.py seed_nacora_dev_data
```

This creates a Nacora Austria broker company, a KN Poland policyholder, one active policy with a filled base rater, three participant companies, and ~20 sample shipments across various statuses.

### Frontend dev server

Because the same Docker Compose serves both apps out of `dist/`, you have two workflows:

**Workflow A — one-off build (fastest for backend work).**

```
cd frontend
npm ci
npx nx build nacora-embedded-cargo --prod
npx nx build nacora-shipment-portal --prod
```

Then reload the app; Django picks up the new `webpack-stats.json`.

**Workflow B — Nx dev server with HMR (frontend work).**

```
cd frontend
npx nx serve nacora-embedded-cargo --port 4200
# in another terminal:
npx nx serve nacora-shipment-portal --port 4201
```

Nx dev server proxies API calls to `localhost:8000` and hot-reloads on file save. Open http://localhost:4200/ (wizard) or http://localhost:4201/ (portal). Auth still lands at the Django login, but the SPA is served with source maps and dev-mode error overlays.

Environment variables for the frontend live in `frontend/apps/<app>/src/environments/environment.ts`. `environment.dev.ts` is loaded during `nx serve`.

### Running tests

**Backend (pytest):**

```
docker compose exec app pytest src/clients/nacora/tests/
docker compose exec app pytest src/policies/tests/
docker compose exec app pytest -x -k "test_special_rate"    # single test by name
docker compose exec app pytest --cov=clients.nacora --cov-report=html
```

Test config is at `pytest.ini` at repo root. A temporary PostgreSQL DB is created per test session; fixtures live in `conftest.py` per app.

**Frontend (Jest):**

```
cd frontend
npx nx test <lib>                # single library
npx nx affected --target=test    # only what changed
npx nx run-many --target=test    # everything
```

**E2E (Playwright):**

```
cd frontend
npx nx e2e nacora-embedded-cargo-e2e
npx nx e2e nacora-shipment-portal-e2e
```

Playwright needs the backend running. It can point at `localhost:8000` (via env var).

### Common day-to-day commands

**Django shell:**

```
docker compose exec app python src/manage.py shell
```

**One-off management command:**

```
docker compose exec app python src/manage.py <command_name> [args]
```

**Reset the local DB:**

```
docker compose down
docker volume rm insurance_postgres_data
docker compose up -d postgres redis rabbitmq
docker compose up -d app
# then re-run migrations and seed
```

**Load a fresh sample policy:**

```
docker compose exec app python src/manage.py seed_nacora_dev_data --reset
```

**Refresh OFAC SDN offline list:**

```
docker compose exec app python src/manage.py refresh_sdn_list
```

**Tail logs:**

```
docker compose logs -f app
docker compose logs -f celery-worker
docker compose logs -f celery-worker-audit-trail
```

**Enter a container:**

```
docker compose exec app bash
docker compose exec celery-worker bash
```

**Rebuild the Python container after `requirements/dev.txt` changes:**

```
docker compose build app
docker compose up -d app
```

### Debugging techniques

- **Django Silk** (`silk` middleware) — enabled in dev to profile every request. Visit `http://localhost:8000/silk/`.
- **Django Debug Toolbar** — enabled in dev when `DEBUG=True`. Sits at the right edge of every page.
- **Sentry local dev** — DSN can be set to a local Sentry instance or left empty; errors will surface in the terminal.
- **Celery task tracing** — set `CELERY_TASK_TRACK_STARTED=True` in dev to see per-task lifecycle events in logs.
- **DB inspection** — connect any PostgreSQL client to `localhost:5432` with user `insurance` and password from `.env`.

### Working with SOAP endpoint locally

The SOAP endpoint is enabled by default in dev. Send a request with WS-Security auth using a tool like SoapUI or `curl` with a hand-rolled envelope:

```
curl -X POST http://localhost:8000/api/v1/soap/shipment-web-service \
  -H "Content-Type: text/xml; charset=utf-8" \
  --data @sample-book-shipment.xml
```

Add `?dryRun=1` to any URL to exercise the validation path without touching the DB. `SOAP_LOG_RAW_MESSAGES=True` in dev writes full request/response XML to the app log.

### Common gotchas

- **Migrations after pulling latest.** Whenever you `git pull`, run `docker compose exec app python src/manage.py migrate` — new migrations may have landed.
- **Frontend dist stale after a merge.** If the wizard or portal is missing new features, rebuild with `npx nx build <app>`.
- **Celery Beat only runs on one container.** If you scale up locally, disable `celery-beat` on the extras.
- **PDM simulation is env-flagged.** With `NACORA_PDM_SIMULATION_ENABLED=False` and no live PDM, SSO fails silently — you'll land in pending-approval. Turn simulation on for dev.
- **Sanctions screening off by default.** Turn on only if you have AWS creds; otherwise the shipment form works fine without it.
- **Google Maps not wired.** Address autocomplete requires a `GOOGLE_MAPS_API_KEY`; without it, addresses are free-text.
- **currencyapi.com API key not required for dev.** Without it, `update_usd_exchange_rates` reports "no key configured" and skips. Rating still works but base-currency conversions will be null.

### Running against a real Okta

Set `USE_MOZILLA_OIDC=True` and fill in `OIDC_RP_CLIENT_ID`, `OIDC_RP_CLIENT_SECRET`, and the discovery endpoints from your Okta dev tenant. You'll also need a real (or simulated) KN PDM connection — set `NACORA_PDM_SIMULATION_ENABLED=False` and provide the four PDM env vars.

## Business rules & operational notes

- **Never run against the prod database from local.** Compose's PG runs on a Docker volume; production connections are firewalled.
- **Sensitive data.** `.env` and `local_settings.py.dev` are in `.gitignore`. Never commit real credentials.
- **Timing-sensitive tests.** Some tests (rate expiry, quote expiry, renewal reminders) use `freezegun` to freeze the clock. Don't mix real-time and frozen tests in the same session.
- **Docker Compose is dev only.** Staging and prod use Kamal with a slightly different Docker Compose layout. Compose config lives at repo root; Kamal config at `config/deploy.yml`.
- **Volumes persist between `up`/`down`.** To reset the DB fully, `docker volume rm insurance_postgres_data`.
- **Prefer `docker compose exec` over shelling in with `docker exec` directly** — the compose command routes through the right service name and network.

## Related concepts

- Environments & Config
- Repo Map
- Frontend Architecture
- Background Jobs & Celery
- Architecture Overview
