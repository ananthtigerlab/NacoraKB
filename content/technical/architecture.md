# Architecture Overview

## What it is

Nacora is delivered on **TigerLab's InSurance platform** — a multi-tenant Django monorepo with a matching Nx-based TypeScript frontend. The Nacora tenant is one client among many that share the underlying platform, and it customises the platform by overriding settings, URLs, services, and templates rather than forking the code. This override-not-fork pattern is the single most important thing to understand about the codebase.

At the highest level the system is:

- **A Django 4.x backend** (`src/`) — HTTP APIs, background jobs, business services, ORM models, audit trail, event stream.
- **A React Nx frontend** (`frontend/`) — two Nacora apps (`nacora-embedded-cargo`, `nacora-shipment-portal`) plus a shared search app, backed by TypeScript libraries under `libs/nacora/` and `libs/i2go/`.
- **A per-client customisation layer** (`src/clients/nacora/`) — Django app that plugs into `INSTALLED_APPS`, layers new settings on top of base defaults, and provides service classes that override generic platform behaviour.
- **PostgreSQL** for durable state, **Redis** for cache and session, **RabbitMQ** for the Celery broker, **DynamoDB** for the append-only audit trail, and **S3** for attachments and analytics-stream landing.
- **Third-party integrations** wired in as pluggable services with feature flags — CurrencyAPI.com, AWS Bedrock, Comprehend, SES, SanctionScanner, KN PDM, GeoRisk, Vessel Finder, Salog SOAP.

## Who uses it & where

- **Backend engineers** work primarily in `src/clients/nacora/` and the shared platform modules under `src/`.
- **Frontend engineers** work in `frontend/apps/nacora-*/` and `frontend/libs/nacora/`.
- **DevOps / SREs** own `config/deploy.yml`, the Docker build under `docker/`, and env / secret management.
- **Data engineers** consume the analytics event stream landing in S3 → Athena.
- **Architects and delivery leads** review this page, the Data Model, and the Request Lifecycle before onboarding a new team member.

## How it works

### The override-not-fork pattern

Nacora does not fork any platform code. Instead, the Django app at `src/clients/nacora/apps.py` (`ClientConfig`) is registered in `INSTALLED_APPS` and provides all Nacora-specific extensions in three ways:

1. **Settings layer.** `src/clients/nacora/settings.py` imports named objects from `src/insurance/settings.py` (base) and rebuilds `INSTALLED_APPS`, `MIDDLEWARE`, `CELERY_TASK_ROUTES`, `WEBPACK_LOADER`, and dozens of platform-specific dicts on top of the base values. It never modifies `insurance.settings` in place; the base module remains untouched.
2. **URL layer.** The environment sets `ROOT_URLCONF = f"clients.{CLIENT_SLUG}.urls"` where `CLIENT_SLUG = "nacora"`. Nacora's URL module (`src/clients/nacora/urls.py`) mounts its own API v1 endpoints, the two React SPAs, and the admin queue, then delegates unmatched paths to the base `insurance.urls`.
3. **Service override.** Nearly every platform behaviour that Nacora needs to customise is expressed as a service class configured in settings. `CUSTOM_POLICY_STATUS_SERVICE`, `CUSTOM_QUERYSET_SERVICE`, `CUSTOM_PERMISSION_CLASS`, `CUSTOM_CHOICES_VALIDATION_SERVICE`, `CUSTOM_CHOICES_LOOKUP_ITEM_SERVICE`, `CANCELLATION_SERVICES`, and others resolve to concrete classes at `src/clients/nacora/**`. The base platform loads and calls them via a factory pattern.

The upshot is that reading the codebase means reading two files in parallel: the base module and its Nacora override. If a behaviour looks like it comes from `src/policies/`, check first whether `src/clients/nacora/policies/services.py` has swapped in a Nacora-specific service.

### Request lifecycle

An inbound HTTP request travels through these stages before it reaches business logic:

1. **URL routing.** Django resolves the path against `src/clients/nacora/urls.py`. The Nacora router owns `/dashboard/`, `/embedded-cargo/`, `/shipment-portal/`, `/api/v1/`, `/api/v1/soap/`, `/pending-approval/`, `/audit/`, and static asset routes for both SPAs. Unresolved paths fall back to base `insurance.urls`.
2. **Middleware stack.** ~25 middlewares run in order. Load-bearing ones for Nacora:
   - **`SessionMiddleware`, `AuthenticationMiddleware`** — resolve `request.user` from cookie session or bearer token.
   - **`OAuth2TokenMiddleware`** — validates OAuth2 access tokens on API requests.
   - **`URLRegexAccessMiddleware`, `CustomRedirectMiddleware`** — role-based redirects and the `WHITELIST_PATH` bypass that lets the shipment portal handle its own auth.
   - **`CurrentUserMiddleware`** — writes the authenticated user into a thread-local so services deeper in the call stack (including audit-trail dispatch) can attribute changes.
   - **`CspDomainRedirectMiddleware` (Nacora)** — pins each domain to its intended app: shipment-portal domain serves `/shipment-portal/*`; back-office domain serves the full dashboard. Cross-domain requests are rejected.
   - **`PendingApprovalRedirectMiddleware` (Nacora)** — if the user's Business Partner is in pending-approval status, every dashboard route redirects to `/pending-approval/`.
3. **View dispatch.** DRF ViewSets under `/api/v1/**` follow REST conventions via `DefaultRouter`. Each ViewSet declares its permission class and its queryset filter service.
4. **Permission check (Layer 1).** DRF permission class (`ReferralPermission`, `SpecialRateRequestPermission`, etc.) decides whether this user can act on this class of object at all.
5. **Queryset filter (Layer 2).** Before results are returned, a client-registered queryset filter narrows the row set to what this user is allowed to see. `PolicyVersionItemQuerysetFilterService` filters shipments by the user's org tree; `ReferralQuerysetFilterService` filters referrals by assignment. Filtering happens in the database, not the API layer — it is unforgeable from the client.
6. **Serializer validation.** DRF serializers validate the request body (types, enum values, required fields, cross-field rules).
7. **Service layer.** Business logic runs in service classes — `PolicyStatusService`, `CancellationService`, `ShipmentRatingResponseService`, `RulesEvaluationService`, `ReferralService`, etc. Services are stateless and take model instances or IDs, so they are easy to test.
8. **Model save.** The Django ORM writes to PostgreSQL inside an atomic transaction (`ATOMIC_REQUESTS = True` on the default database).
9. **Side effects.** Post-save signals fan out:
   - **Audit trail dispatch** — the `audit_trail` library writes an event to DynamoDB in real time (or delayed per `AUDITTRAIL_DISPATCH_MODE`).
   - **Event stream emit** — analytics serializers produce a payload, which lands in the `DataStreamLog` table and is picked up by a Celery task to push to Kinesis / S3.
   - **Webhooks** — configured outbound webhooks (e.g., GeoRisk on shipment booking, BMS on policy activate/endorse/cancel) enqueue Celery tasks.
   - **Mail queue** — templated emails are inserted into the post-office queue and drained by `send_queued_mails`.
10. **Response.** The serializer converts model → JSON. `JSON_UNDERSCOREIZE` in `REST_FRAMEWORK` renames `snake_case` → `camelCase` for the frontend.

### Backend layout at a glance

```
src/
├── insurance/            Django project (settings, urls, wsgi, asgi)
├── clients/nacora/       Nacora-specific overrides + code (urls, settings, services, middleware, ...)
├── policies/             Shared: Policy, PolicyVersion, PolicyVersionItem, Quotation
├── partners/             Shared: BusinessPartner, Role, Relation, Address, AttributeValue
├── ratings/              Shared: SpecialRateRequest, Risk, RiskFactorCombinations, LoadFactor
├── clauses/              Shared: Clause, ClauseCategory, ClauseObjectRelation
├── i2go_rules/           Shared: Rule, RuleCondition, RuleAction, RuleEvaluation
├── i2go_choices/         Shared: ChoiceType, Choices, LookupCategory, LookupItem
├── i2go_activities/      Shared: Activity, ActivityType, Priority, Status
├── activities/           Shared: Referral, Note, Attachment, AttachmentFolder
├── auths/                Shared: User, auth backends, OAuth2, OIDC, OTP, session locking
├── mails/                Shared: OutboundMail, templates, inbound mail parser
├── payments/             Shared: Transaction
├── commissions/          Shared: Commission
├── bordeareaux/          Shared: Bordereau (slip / manifest)
├── webhooks/             Shared: WebhookAction, HTTP dispatcher
├── analytics/            Shared: event stream, DataStreamLog
├── audit_trail/          Shared: audit dispatch + DynamoDB backend
├── api_v3/               Shared: DRF v3 endpoints + Exporter framework
├── submodules/           Shared: numbering, currencies, documents, pdf_generator, etc.
└── ...
```

Every file under `src/clients/nacora/**` mirrors a base module and may override behaviour by pointing a settings-configured service at its own class.

### Frontend layout at a glance

```
frontend/
├── apps/
│   ├── nacora-embedded-cargo/         React SPA — sales/policy wizard (back-office)
│   ├── nacora-embedded-cargo-e2e/     Playwright E2E harness
│   ├── nacora-shipment-portal/        React SPA — participant portal + BO shipment ops
│   ├── nacora-shipment-portal-e2e/    Playwright E2E harness
│   └── search-mui/                    Shared search-UI app (per-client config)
├── libs/
│   ├── nacora/                        Nacora-specific data-access, UI, models
│   └── i2go/                          Platform-wide shared libraries
└── dist/                              webpack outputs (loaded by Django via webpack-loader)
```

Both SPAs are React + TypeScript. The shipment portal runs in two modes controlled by an `APP_MODE` env var: **CSP mode** (external participants sign in via OTP, hosted at `nacora-sp.i2go.io`) and **BO mode** (embedded inside the back-office dashboard for underwriters and brokers). See Frontend Architecture for the full picture.

### Integration surface

The platform's external dependencies land in a small number of pluggable modules, each with a kill-switch feature flag so the app degrades gracefully when a provider is down:

| Domain | Provider | Module |
|---|---|---|
| FX rates | CurrencyAPI.com | `submodules/currencies/` |
| Commodity classification LLM | AWS Bedrock (Claude) | `src/clients/nacora/commodities/` |
| Entity extraction | AWS Comprehend | `src/clients/nacora/cargo_sanctions/` |
| Sanctions fuzzy match | SanctionScanner + local OFAC SDN CSV | `src/clients/nacora/cargo_sanctions/` |
| SSO / OIDC | Okta (via allauth) | `src/clients/nacora/auths/` |
| Cost centre lookup | Kuehne+Nagel PDM API | `src/clients/nacora/auths/` (SocialAdapter) |
| Post-booking enrichment | GeoRisk webhook | `src/clients/nacora/webhooks/` |
| Address autocomplete | Google Maps API | `src/core/` (platform-level; not wired for Nacora yet) |
| Vessel classification | Vessel Finder API | `src/clients/nacora/thirdapis/` |
| Transactional email | Amazon SES (via anymail + post-office) | `src/mails/` |
| Attachment storage | AWS S3 (via django-storages) | `insurance.storage_backends` |
| Analytics warehouse | AWS Athena over S3 | `src/analytics/` |
| Error tracking | Sentry | root settings |
| Inbound shipment web service | Kuehne+Nagel Salog (SOAP) | `src/clients/nacora/api/v1/soap/` |

Every integration has a matching `NACORA_*_ENABLED` or `CARGO_SANCTION_SETTINGS['ENABLED']`-style flag so it can be turned off cleanly in a specific environment without a code change.

## Business rules & architectural constraints

- **Two databases of record.** PostgreSQL holds transactional state; DynamoDB (`audit_events` in eu-central-1) holds the append-only audit trail. Audit events cannot be edited or deleted by any application code — the writing library targets `PutItem` only.
- **At-least-once delivery for background jobs.** `CELERY_TASK_ACKS_LATE = True` and `CELERY_TASK_REJECT_ON_WORKER_LOST = True` — a task killed mid-execution is re-queued. Every task must be idempotent.
- **Queue creation is not automatic.** `CELERY_TASK_CREATE_MISSING_QUEUES = False` — Kamal or the broker init script must declare every queue at deploy time. A typo in `CELERY_TASK_ROUTES` fails fast rather than silently landing on `celery` default.
- **Never trust the client for row-level access.** Every list endpoint runs a queryset filter service before results leave the DB. Frontend cannot ask for arbitrary IDs and expect to receive them.
- **`ATOMIC_REQUESTS = True`** on the default database — every HTTP request is a single DB transaction, rolled back on any unhandled exception. Long-running background work must not be inside a request.
- **JSON round-tripping** is enforced by `JSON_UNDERSCOREIZE` and the DRF camelCase renderer/parser. Rename a field on either side without the other and the payload silently drops.
- **Two frontend build outputs, one Django app.** Django serves `dist/apps/nacora-embedded-cargo/` and `dist/apps/nacora-shipment-portal/` under distinct URL prefixes; both are loaded via `webpack-loader` reading `webpack-stats.json`. A frontend rebuild refreshes the manifest; Django needs no rebuild.
- **Feature flags first.** Any new external integration or high-risk feature ships behind a settings flag so it can be disabled per-environment without a redeploy.

## Related concepts

- Repo Map
- Data Model & Entities
- APIs & Integrations
- Environments & Config
- Security & Permissions
- Background Jobs & Celery
- Event Stream & Audit Trail
- Frontend Architecture
