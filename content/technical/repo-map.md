# Repo Map

## What it is

The InSurance monorepo at `~/Downloads/GitHubProjects/InSurance` is one repository containing:

- The Django backend for every TigerLab client (Nacora is one of them).
- Shared platform modules under `src/`.
- Client-specific overrides under `src/clients/<slug>/`.
- Reusable internal libraries under `src/submodules/`.
- The Nx frontend workspace under `frontend/`.
- Deployment config (Kamal) at repo root.
- Docker build under `docker/`.

The Nacora-relevant subset is captured in the KB's `nacora.paths.json` — primary paths (Nacora-owned) plus shared paths (platform code Nacora depends on).

This page is the map: "where does X live?"

## Who uses it & where

Every developer or architect touching the code — day one, and every time they onboard onto a new area. The map is the shortest path to the right file.

## How it works

### Top-level layout

```
InSurance/
├── src/                          Django backend (Python)
│   ├── insurance/                Django project — settings, urls, wsgi, asgi
│   ├── clients/nacora/           Nacora-specific overrides (this is where Nacora work happens)
│   ├── policies/                 Shared: Policy, PolicyVersion, PolicyVersionItem
│   ├── partners/                 Shared: BusinessPartner, Role, Relation
│   ├── ratings/                  Shared: SpecialRateRequest, RiskFactorCombinations
│   ├── clauses/                  Shared: Clause, ClauseCategory, ClauseObjectRelation
│   ├── i2go_rules/               Shared: Rule, Condition, Action
│   ├── i2go_choices/             Shared: Choices, LookupCategory
│   ├── i2go_activities/          Shared: Activity, Referral
│   ├── activities/               Shared: Referral, Note, Attachment
│   ├── auths/                    Shared: User, auth backends, OAuth2/OIDC, OTP, session locking
│   ├── mails/                    Shared: OutboundMail, inbound parser
│   ├── payments/                 Shared: Transaction
│   ├── commissions/              Shared: Commission
│   ├── bordeareaux/              Shared: Bordereau
│   ├── webhooks/                 Shared: WebhookAction
│   ├── analytics/                Shared: event stream, DataStreamLog
│   ├── audit_trail/              Shared: DynamoDB dispatch
│   ├── api_v3/                   Shared: DRF v3, Exporter framework
│   ├── core/                     Shared: base models, storage backends
│   ├── submodules/               Reusable internal libraries (see below)
│   ├── notifications/            Shared: notification dispatch
│   ├── finances/                 Shared: finance transactions
│   └── manage.py                 Django management command entry
├── frontend/                     Nx TypeScript monorepo (React)
│   ├── apps/
│   ├── libs/
│   └── dist/                     webpack outputs (git-ignored, built on deploy)
├── config/
│   └── deploy.yml                Kamal deployment config
├── docker/                       Dockerfile.i2go + per-env local_settings
├── requirements/                 pip requirement files (base, dev, production)
├── .woodpecker.yml               CI pipeline
└── frontend/nx.json              Nx workspace config
```

### Inside `src/clients/nacora/`

This is where all Nacora-specific work lives. Mirror structure to the shared platform:

```
src/clients/nacora/
├── apps.py                       Django AppConfig — registers Nacora in INSTALLED_APPS
├── settings.py                   Nacora settings overrides (imports base, then overrides)
├── urls.py                       Nacora URL config — mounts /api/v1/*, /dashboard/*, SPAs
├── middleware.py                 CspDomainRedirectMiddleware, PendingApprovalRedirectMiddleware
├── audittrail_settings.py        AUDITTRAIL_MODELS — which models are audited and how
├── models.py                     Nacora-specific models (usually empty; overrides in services)
├── utils.py                      BusinessPartnerUtil, PDM helpers, cost-centre resolution
├── exporter.py                   Nacora exporters (PolicyBillingReportFormatter, SpecialRateFormatter)
├── tasks.py                      Nacora Celery tasks (send_queued_mails, publish_rating_product, ...)
├── api/v1/                       All Nacora REST + SOAP endpoints
│   ├── business_partners/        Partner CRUD
│   ├── rating/                   Rating catalog + SRR
│   ├── policies/                 Policy CRUD + shipment (PolicyVersionItem)
│   ├── commodities/              Commodity classification (AWS Bedrock)
│   ├── mails/                    Mail queue endpoints
│   ├── documents/                Certificate/quote generation
│   ├── audit_trail/              Audit-trail search (read-only)
│   ├── i2go_rules/               Business rule CRUD
│   ├── third_parties/            GeoRisk, sanctions screen status
│   ├── clauses/                  Clause CRUD + attachment
│   ├── bulk_upload/              Excel bulk shipment upload
│   ├── soap/                     Salog SOAP inbound service
│   ├── admin/                    Admin-only endpoints
│   └── nacora_claims/            FNOL / claims
├── auths/                        SSO SocialAdapter, PDM lookup, OTP config
│   └── adapter.py                Post-login hook — creates/updates BP, sets cost centre
├── policies/                     Policy service overrides (PolicyStatusService, filter services)
├── ratings/                      Rating service overrides (ShipmentRatingResponseService)
├── i2go_activities/              Referral / activity services (ReferralService)
├── i2go_rules/                   Rule evaluation services (RulesEvaluationService, action handlers)
├── i2go_choices/                 Choices validation + BiDirectionalLookupService
├── clauses/                      Clause services
├── cancellation/                 Cancellation service — CancellationService orchestration
├── cargo_sanctions/              Comprehend + SanctionScanner + local OFAC SDN
│   └── data/sdn.csv              Offline OFAC SDN fallback (refreshed via manage.py refresh_sdn_list)
├── commodity_classification/     Bedrock LLM + reranker for commodity groups
├── mails/                        Nacora mail services (send_templated_notification, filters)
├── documents/                    DocumentGenerationService (weasyprint, QR codes)
├── admin_ui/                     HTMX views for the Nacora admin queue
├── numbering/                    ShipmentNumberingService — cross-version continuity
├── bulk_upload/                  NacoraBulkUploadHandler + row processor
├── webhooks/                     Outbound webhooks (GeoRisk, BMS sync)
├── analytics/                    NacoraShipmentSerializer, NacoraPolicyVersionSerializer, cluster map
├── faqs/                         Contextual FAQ service
├── templates/                    Django templates (email HTML, PDF templates, admin UI)
├── static/                       Nacora-specific images, PDFs, fonts
├── management/commands/          setup_nacora_* commands (choice seeding, clause seeding, ...)
└── tests/                        Nacora-specific pytest suites
```

### Shared platform modules of interest

| Path | What it holds |
|---|---|
| `src/policies/models.py` | `Contract`, `Policy`, `PolicyVersion`, `PolicyVersionItem`, `Quotation`, `PolicyStatus` |
| `src/partners/models.py` | `BusinessPartner`, `BusinessPartnerRole`, `BusinessPartnerRelation`, `Address`, `AttributeValue`, `SalesAccount` |
| `src/ratings/models.py` | `SpecialRateRequest`, `Risk`, `RiskFactorCombinations`, `LoadFactor` |
| `src/clauses/models.py` | `Clause`, `ClauseCategory`, `ClauseObjectRelation` |
| `src/i2go_rules/models.py` | `Rule`, `RuleCondition`, `RuleAction`, `RuleEvaluation` |
| `src/i2go_choices/models.py` | `ChoiceType`, `Choices`, `LookupCategory`, `LookupItem` |
| `src/activities/models.py` | `Activity`, `Referral`, `Note`, `Attachment`, `AttachmentFolder` |
| `src/auths/models.py` | `User`, `Group`, custom permissions |
| `src/api_v3/exporter/` | Exporter framework (base) — Nacora overrides at `clients/nacora/exporter.py` |
| `src/audit_trail/` | Audit-trail library — DynamoDB dispatcher, model registry, dedup |

### `src/submodules/` — reusable internal libraries

Small, well-scoped libraries reused across clients:

| Submodule | Purpose |
|---|---|
| `numbering/` | Sequence generators — used by Policy / Shipment / Rule / Clause numbering |
| `currencies/` | `ExchangeRate` model + CurrencyAPI.com daily sync task |
| `documents/` | PDF template engine (Jinja2 + weasyprint) |
| `pdf_generator/` | PDF-specific helpers (page numbers, headers, QR embedding) |
| `countries/` | ISO-3166 country list + region groupings |
| `vehicles/` | Vehicle master data (for motor products; unused by cargo) |
| `tours/` | Tour master data (for travel products; unused by cargo) |
| `wallets/` | Wallet balances (payment holds) |
| `catnat/` | Catastrophe classifications |
| `faqs/` | FAQ entry + generic-relation attachment |
| `supports/` | Support ticket entities |
| `xls_mapper/` | Excel column-to-attribute mapping helpers (used by bulk upload) |
| `insuredsum/` | Insured-sum aggregation utilities |
| `messages_api/` | Message broker abstraction |
| `abex/` | ABEX-specific integration |
| `nps/` | Net-Promoter-Score survey capture |

### `frontend/` — Nx workspace

```
frontend/
├── apps/
│   ├── nacora-embedded-cargo/            Sales/policy wizard (back-office)
│   │   └── src/main.tsx                  React root — mounted on #root-nacora-embedded-cargo
│   ├── nacora-embedded-cargo-e2e/        Playwright E2E
│   ├── nacora-shipment-portal/           Participant portal + BO shipment ops
│   │   └── src/main.tsx                  Dual-mode React root (CSP + BO via APP_MODE)
│   ├── nacora-shipment-portal-e2e/       Playwright E2E
│   └── search-mui/                       Shared search UI (per-client config at src/app/config/clients/nacora/)
├── libs/
│   ├── nacora/                           Nacora-specific data-access, UI, models
│   │   ├── data-access/                  Redux slices, API services, models, filters, column configs
│   │   ├── ui/                           Shared React components
│   │   └── models/                       TypeScript models mirroring Django serializers
│   └── i2go/                             Platform-wide shared libraries (all clients)
├── nx.json                               Nx workspace config
├── package.json                          Root npm scripts
└── dist/                                 webpack outputs (per app) — loaded by Django via webpack-loader
```

### Config, build, deploy

| File | Purpose |
|---|---|
| `config/deploy.yml` | Kamal deployment: services (app, celery-worker, celery-worker-audit-trail, celery-beat), env vars, volumes, aliases |
| `docker/Dockerfile.i2go` | Multi-stage Dockerfile (node build for frontend → python build for backend) |
| `docker/local_settings.py.<env>` | Per-environment settings overlay (dev/staging/prod) |
| `requirements/base.txt` | Common Python deps |
| `requirements/production.txt` | Prod extras (gunicorn, sentry-sdk, ...) |
| `requirements/dev.txt` | Dev extras (pytest, black, isort, ...) |
| `.woodpecker.yml` | CI pipeline (lint → typecheck → test → build → deploy) |
| `Makefile` | Developer convenience targets (`make test`, `make lint`, `make shell`) |
| `manage.py` (at repo root) | Django management wrapper |
| `.env.example` | Env var template |

### Where to find configuration values

Nacora config lives in three files, read in this order (later overrides earlier):

1. `src/insurance/settings.py` — platform defaults (imports Python module).
2. `src/clients/nacora/settings.py` — Nacora overrides.
3. `docker/local_settings.py.<env>` — per-environment overlay (loaded conditionally via env var at container start).

Anything not in these files but consumed at runtime comes from environment variables. See Environments & Config for the full list.

### Where to find migrations

Django migrations live under each app's `migrations/` directory:

- Nacora migrations: `src/clients/nacora/migrations/`
- Shared platform migrations: `src/<app>/migrations/`

Migrations are tracked in Git despite the `.gitignore` `**/migrations/**` line — the explicit `!<app>/migrations/` pattern per client re-includes them. When adding a new migration, always run against a staging PG database first; Kamal deploys automatically call `python manage.py migrate` on release.

### Where to find seeded reference data

One-off setup commands live under `src/clients/nacora/management/commands/`:

- `setup_nacora_commodity_group_choices.py` — seeds the commodity-group Choices catalogue.
- `setup_nacora_clause_categories.py` — seeds ClauseCategory rows.
- `setup_nacora_lookup_categories.py` — seeds LookupCategory + LookupItem rows for currencies, packing, coverages.
- `refresh_sdn_list.py` — pulls the latest OFAC SDN CSV into `cargo_sanctions/data/sdn.csv`.
- `update_usd_exchange_rates.py` — manual trigger for the daily FX rate sync (also runs on cron).

Run these via the Kamal alias: `kamal app exec python src/manage.py setup_nacora_commodity_group_choices` (or `python src/manage.py <cmd>` locally).

### Where to find tests

Every Django app has a `tests/` directory. Nacora tests live under `src/clients/nacora/tests/`. Frontend E2E tests live under `frontend/apps/nacora-*-e2e/src/`. Storybook stories, when maintained, live alongside the components in `frontend/libs/nacora/ui/**/*.stories.tsx`.

## Related concepts

- Architecture Overview
- Data Model & Entities
- Environments & Config
- Local Development
- Frontend Architecture
