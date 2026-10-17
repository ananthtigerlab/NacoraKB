# Technical space — audit + delivery report

Status: **IN PROGRESS** (updated at end of pass).

Scope: audit every page in `content/technical/`, classify against the Tier 1 subsystem inventory, and produce all missing pages plus expansions in one pass.

Constraints on this pass: local Bash access to the InSurance repo was denied, so code paths, module names, settings keys, and class names are traced through the existing (already code-grounded) 11 Technical pages. Anything cited across those pages is treated as authoritative and re-used without new invention. Where an inference is required (e.g. what a subsystem *should* cover based on citations), the new page reuses vocabulary that already appears in the existing corpus.

---

## Tier 1 subsystem inventory

Each row is a self-contained Technical entry a developer or architect would look up.

| # | Subsystem / concern | Existing page | Classification | Gap summary |
|---|---|---|---|---|
| 1 | Overall system architecture, request lifecycle, override-not-fork pattern | `architecture.md` | ADEQUATE | End-to-end. Cited across every other page. |
| 2 | Repo layout, `src/clients/nacora/` structure, submodules, seed commands | `repo-map.md` | ADEQUATE | Comprehensive map. |
| 3 | Domain data model, entity relationships, ORM patterns | `data-model.md` | ADEQUATE | Fully catalogued. |
| 4 | REST v1 / v3, SOAP inbound, outbound webhooks, third-party API list | `apis.md` | ADEQUATE | Complete. |
| 5 | AuthN (SSO/OIDC/OTP), AuthZ (permission classes), row scoping (queryset filters), sanctions layer, session security | `security-and-permissions.md` | NEEDS EXPANSION | Adequate on flows, but auth-backend chain, OAuth2 provider model, and session-locking / session-security middleware detail belong on a dedicated page. |
| 6 | Celery queues, task authoring, Beat schedule, retry policy, audit dispatch mode | `background-jobs.md` | ADEQUATE | Complete. |
| 7 | Analytics stream + DynamoDB audit trail | `event-stream-and-audit.md` | ADEQUATE | Complete. |
| 8 | Bulk upload + exporter framework + bordereau | `bulk-upload-and-exporter.md` | ADEQUATE | Complete. |
| 9 | Frontend workspace (Nx), dual-mode SPA, EndpointWrapper, build/deploy contract | `frontend-architecture.md` | ADEQUATE | Complete. |
| 10 | Env vars, feature flags, Kamal deploy, secret rotation, migrations flow | `environments.md` | ADEQUATE | Complete. |
| 11 | Docker Compose dev flow, seed commands, debugging tools, local gotchas | `local-development.md` | ADEQUATE | Complete. |
| 12 | Authentication backend chain (`LoginBackend`, `EmailConfirmationTokenBackend`, `OAuth2Backend`, `OIDCBackend`, `ObjectPermissionBackend`), OAuth2 model, OTP internals, session-security middleware | — | MISSING | Split out from Security & Permissions and Architecture — auth-backend chain is not fully documented anywhere. |
| 13 | Caching & Redis usage (cache keys, TTLs, invalidation, session store) | — | MISSING | Referenced in six other pages (PDM token cache, GeoRisk party cache, session cache, FX rate cache) but has no home. |
| 14 | Feature flag pattern (settings-flags vs env vars, layering, defaults, roll-out) | — | MISSING | Referenced everywhere. No page pulling the pattern together. |
| 15 | Notification & mail dispatch pipeline (post-office + anymail + SES + templates + queue drain) | — | MISSING | Product space has a user-facing "Mail Notifications & Templates" page; a Technical page for the backend pipeline is missing. |
| 16 | Storage & attachments (S3 backend, `PrivateStorage`, folder hierarchy, presigned URLs, attachment folder model) | — | MISSING | Referenced in Bulk Upload & Exporter and Data Model; no dedicated page. |
| 17 | Payments & finance architecture (`Transaction`, `Commission`, `Bordereau`, `Payment` + signals + reconciliation to BMS) | — | MISSING | Data Model mentions the models; the flow across modules is undocumented. |
| 18 | Claims (basic FNOL MVP-1 scope, endpoint, model, workflow hooks) | — | MISSING | Mentioned in APIs and Repo Map but no page describes the module. |
| 19 | Third-party retry & fallback patterns (Comprehend → OFAC SDN, PDM live → static, GeoRisk retry + DLQ, CurrencyAPI daily, BMS retry) | — | MISSING | Listed piecemeal in APIs; a single failure-mode reference is needed. |
| 20 | Migrations + one-off setup commands (`setup_nacora_*`, `refresh_sdn_list`, `update_usd_exchange_rates`, `seed_nacora_dev_data`) — how they hang together | — | MISSING | Local Development shows the invocations; the framework + convention is undocumented. |
| 21 | Django admin surface (`/tiger-site-admin/`, `ADMIN_SHOW=False`, admin site customisations, HTMX admin queue) | — | MISSING | Mentioned in Environments and Repo Map; no page. |
| 22 | Observability tooling (Sentry, Silk, Debug Toolbar, RabbitMQ management UI, Flower, health check) | — | MISSING | Referenced across four pages; no consolidated page. |
| 23 | CI pipeline (`.woodpecker.yml` stages beyond `local-development`) | — | MISSING | Referenced in Repo Map / Frontend / Environments as one line; expanded page needed. |
| 24 | Docker build layers (multi-stage frontend + Python, build args, image size, layering strategy) | — | MISSING | Environments describes the two stages; a page dedicated to the build is missing. |
| 25 | Rating engine internals (`ShipmentRatingResponseService`, base-rater lookup, SRR override, FX conversion, business-rule bump) | — | MISSING | Data Model gives the algorithm in prose; the service's operational + testing story deserves its own page. |
| 26 | Content service pattern (custom service classes, queryset filter services, custom permission classes, cancellation service, DRF ViewSets, override contract) | — | MISSING | The override-not-fork pattern is defined in Architecture; the concrete registration keys and their contracts belong on a dedicated page. |
| 27 | Configuration loading order (`insurance/settings.py` → `clients/nacora/settings.py` → `docker/local_settings.py.<env>` → env vars) — imports, layering, precedence | Partially — Environments | NEEDS EXPANSION covered as a subsection there. A pure Config Loading page adds detail on `named-imports`, `INSTALLED_APPS` rebuild, `MIDDLEWARE` rebuild, and per-env module resolution. | Splitting into its own page. |
| 28 | Numbering / sequences (`submodules.numbering`, `NumberingMixin`, format patterns, shipment continuity across versions) | Partially — Data Model | NEEDS EXPANSION | Present as a paragraph on Data Model; deserves its own page. |
| 29 | Document generation & PDF pipeline (`DocumentGenerationService`, weasyprint, DynamicTemplate versioning, QR codes) | — | MISSING | Data Model has one paragraph; no page. |
| 30 | Business rules engine (`RulesEvaluationService`, condition/action model, evaluation order, `MatchOnlyAuditEvaluationService`) | — | MISSING | Data Model + Event Stream cover pieces; the engine itself has no page. |
| 31 | Choices, lookups, `BiDirectionalLookupService`, code translation for SOAP | — | MISSING | Data Model catalogues the models; the resolution service is not documented. |
| 32 | Cancellation & endorsement service orchestration | — | MISSING | Referenced across Data Model and APIs; no page. |

## Delivery plan for this pass

- **Expand** `security-and-permissions.md` — no. Leave as-is; instead, split into a dedicated `auth-backends.md` and cross-link.
- **Create** the following new pages (24 total): `auth-backends.md`, `caching-and-redis.md`, `feature-flags.md`, `mail-and-notifications.md`, `storage-and-attachments.md`, `payments-and-finance.md`, `claims-fnol.md`, `third-party-integrations-failure-modes.md`, `migrations-and-seeds.md`, `django-admin.md`, `observability.md`, `ci-pipeline.md`, `docker-build.md`, `rating-engine.md`, `service-override-pattern.md`, `configuration-loading.md`, `numbering.md`, `document-generation.md`, `business-rules-engine.md`, `choices-and-lookups.md`, `cancellation-and-endorsement.md`, plus three cross-cutting: `csrf-and-cors.md`, `session-security.md`, `soap-inbound.md` (split from APIs for depth).

Total: **11 existing pages** (1 expanded via sibling), **~24 new pages** to write.

---

## Delivery summary (written at end of pass)

Final 16 pages produced in the follow-on pass on 2026-07-04. Every page is grounded in citations that already exist in the earlier code-grounded Technical corpus (see the "Constraints on this pass" note above); no new settings keys, class names, or module paths were invented outside that corpus.

| # | Slug | Size (KB) |
|---|---|---|
| 1 | `rating-engine.md` | 10.0 |
| 2 | `business-rules-engine.md` | 9.3 |
| 3 | `service-override-pattern.md` | 9.3 |
| 4 | `document-generation.md` | 8.1 |
| 5 | `configuration-loading.md` | 9.3 |
| 6 | `choices-and-lookups.md` | 9.1 |
| 7 | `cancellation-and-endorsement.md` | 9.3 |
| 8 | `django-admin.md` | 7.4 |
| 9 | `observability.md` | 9.0 |
| 10 | `ci-pipeline.md` | 8.0 |
| 11 | `docker-build.md` | 8.5 |
| 12 | `session-security.md` | 8.9 |
| 13 | `csrf-and-cors.md` | 8.4 |
| 14 | `soap-inbound.md` | 10.6 |
| 15 | `migrations-and-seeds.md` | 9.6 |
| 16 | `numbering.md` | 8.3 |

**Total new pages written this pass:** 16.
**Combined size:** ~143 KB of Technical documentation.
**Technical space total:** 35 pages (11 pre-existing + 8 written earlier this session + 16 written in this pass).

Status: **COMPLETE**.

