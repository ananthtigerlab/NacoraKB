# Frontend Architecture

## What it is

Nacora's frontend is a two-app monorepo in an Nx workspace under `frontend/`. Both apps are React + TypeScript. They share TypeScript libraries (data-access, UI, models) with the wider TigerLab platform. This page catalogues the workspace layout, the state and API-access patterns, the dual-mode shipment portal, and the build/deploy contract with Django.

## Who uses it & where

- **Frontend engineers** working on the wizard, portal, or shared components.
- **Backend engineers** who need to understand how their API responses land on screen.
- **DevOps** running the frontend build inside the Docker multi-stage build.

## How it works

### Workspace layout

```
frontend/
├── apps/
│   ├── nacora-embedded-cargo/           React SPA — sales/policy wizard (back-office)
│   ├── nacora-embedded-cargo-e2e/       Playwright E2E harness
│   ├── nacora-shipment-portal/          React SPA — participant portal + BO shipment ops
│   ├── nacora-shipment-portal-e2e/      Playwright E2E harness
│   └── search-mui/                      Shared search UI app (per-client config)
├── libs/
│   ├── nacora/
│   │   ├── data-access/                 Redux slices, API services, models, filters, column configs
│   │   ├── ui/                          Shared React components
│   │   └── models/                      TypeScript models mirroring Django serializers
│   └── i2go/                            Platform-wide shared libraries (all clients)
├── nx.json                              Nx workspace config
├── package.json                         Root scripts + shared devDeps
└── dist/                                webpack outputs (per app) — loaded by Django via webpack-loader
```

Nx orchestrates task running (build, test, lint) across apps and libs. Common commands:

- `npx nx serve nacora-embedded-cargo` — dev server for the wizard.
- `npx nx serve nacora-shipment-portal` — dev server for the portal.
- `npx nx build nacora-embedded-cargo --prod` — production build to `dist/apps/nacora-embedded-cargo/`.
- `npx nx e2e nacora-embedded-cargo-e2e` — Playwright suite.
- `npx nx test <lib>` — Jest unit tests.
- `npx nx affected --target=build` — build only what depends on changed files.

### The two apps

**`nacora-embedded-cargo`** — the sales / policy wizard used in the back office.

- Root: `ReactDOM.createRoot(document.getElementById('root-nacora-embedded-cargo'))`.
- Entry: `src/main.tsx`.
- Purpose: guided multi-step policy creation, MTA / endorsement, renewal, cancellation, business rules editor, clause library, base rater configuration.
- Rendered inside Django-served HTML on the back-office dashboard.
- Users: brokers, administrators.

**`nacora-shipment-portal`** — the participant portal (and BO shipment ops).

- Root: `ReactDOM.createRoot(document.getElementById('root-nacora-shipment-portal'))`.
- Entry: `src/main.tsx` — dual-mode based on `APP_MODE` env at build/serve time.
- **CSP mode** (`APP_MODE=CSP`) — external participants sign in via OTP, hosted at `nacora-sp.i2go.io`. Custom OAuth2 bearer-token interceptor via `setupAuthInterceptor()`.
- **BO mode** (`APP_MODE=BO`) — embedded inside the back-office dashboard for underwriters and brokers to view shipment ops, session-cookie auth.
- Users: participants (external), underwriters and brokers (internal).

The dual mode means the same TypeScript codebase compiles to two functionally-different bundles at build time. Session vs bearer-token auth is picked at the interceptor layer.

### State management

- **Redux Toolkit** for global state — the `store` is exported from `@nacora/data-access` and set up at app bootstrap.
- Redux slices under `libs/nacora/data-access/features/` and `libs/nacora/data-access/features/app/`, `features/i2go/`.
- **React Query is not the primary data fetcher** — the platform uses an in-house `EndpointWrapper` from `@i2go/data-access` that wraps Axios for API calls. See below.
- Component-local state uses React hooks; there's no explicit MobX/Zustand.

### API access — the EndpointWrapper pattern

`EndpointWrapper.initiate({ baseUrl, productSlug, productPlan, additionalEndpoints })` at app bootstrap wires up:

- A shared Axios instance with base URL from `environment.ts`.
- Auth interceptors (bearer for CSP mode, session for BO mode).
- Response transformers (camelCase JSON handling, error normalisation).
- Product-slug and plan headers.

Individual features declare their endpoints in Redux slices (`libs/nacora/data-access/services/**`) and call them via thunks or via the `EndpointWrapper`'s per-endpoint helpers.

Environment config lives in `src/environments/environment.ts`:

- `REACT_APP_BASE_URL` — root URL (differs per env).
- `REACT_APP_API_URL` — API base (`/api/v1/`, `/api/v3/`).
- `REACT_APP_BACKOFFICE_URL` — back-office root for cross-app links.
- `REACT_APP_PRODUCT_SLUG` — `nacora`.
- `APP_MODE` — `CSP` or `BO`.

### Auth interceptor (CSP mode)

`setupAuthInterceptor()` sets up:

- OTP request → bearer token flow via `drfpasswordless`.
- Attaches `Authorization: Bearer <token>` on every request.
- Handles 401 by clearing the token, showing the OTP form, and letting the user re-authenticate.
- Refresh flow if a longer-lived token is issued.

In BO mode this interceptor is not active — session cookies (`SESSIONID`) authenticate every request, and CSRF token is sent in a header.

### Home page — work queue (CGDEV-42)

The portal Home page was replaced with a work-queue layout. The new Home shows:

- **Needs Attention section** — shipments requiring action, with status-based counts.
- **Shipments section** — a summary grid of recent shipments with policy, insurer, and referral columns.
- **Policies section** — active policies and upcoming renewals with period numbers.

The BI dashboard that formerly lived on the Home page now has its own Analytics page, accessible from the sidebar. This separates day-to-day operational work from reporting.

Data hooks live under `libs/nacora/data-access/src/hooks/home/` — `useHomeKpis`, `useHomePolicies`, and `useWorkQueues` feed the three sections.

### 360 views — redesigned layout (CGDEV-95)

Policy and shipment 360 detail pages received a visual overhaul:

- **Key facts strip** at the top — the most important fields (status, reference, premium, dates) in a horizontal summary bar.
- **Grouped general details** — related fields grouped together instead of a flat list; darker text, slimmer versions table.
- **Page header card** replaces the old action bar — a single grouped "more actions" menu instead of scattered action buttons.
- **Removed actions** — edit policy removed from policy 360; send policy email dropped; payment log and update payment method added.
- **Activities and emails tabs** restored.
- **Parties card** shows marine cargo wording; View Departments links to a partner search of the policy's participant companies.
- **Incomplete order 360** follows the same layout — key facts strip, grouped details, documents tab, no edit order action, no premium in versions table.

### Routing

Both apps use React Router. Route definitions live per-app under `src/app/`. The wizard uses a step-based route pattern (`/general-details`, `/participants`, `/billing`, `/risks`, `/quote-document`, `/certificate-document`, `/rating`, `/clauses`, `/business-rules`, `/other-parties`). The portal uses a resource-first pattern (`/`, `/shipment/:id`, `/create`, `/referrals`, `/special-rates`, `/analytics`, …).

Deep-linking works — every step / detail page has a URL. Back / forward navigation preserves in-memory state via Redux.

### Django ↔ Frontend contract

Django serves the SPA and the API. The contract:

1. **Frontend builds to `dist/apps/<app>/`.**
2. **Django reads `webpack-stats.json`** from that directory via `django-webpack-loader`. The webpack stats file maps entry-point names → hashed asset filenames.
3. **A Django template renders the SPA shell** with `<script src="{% render_bundle 'main' 'js' %}"></script>` and `<link rel="stylesheet" href="{% render_bundle 'main' 'css' %}">` — resolved from the stats file.
4. **The container image includes both `dist/`s.** The multi-stage Dockerfile at `docker/Dockerfile.i2go` builds the frontend in a Node stage and copies `dist/` into the Python stage.
5. **Static assets are served under `/embedded-cargo/static/` and `/shipment-portal/static/`** by Django's static-file view, mapped to the corresponding `dist/apps/<app>/` directory.

Rebuilding the frontend regenerates `dist/` + `webpack-stats.json`. Django needs no rebuild — next request picks up the new manifest.

### Testing

- **Unit tests:** Jest, colocated with source files (`*.spec.ts`, `*.spec.tsx`).
- **E2E tests:** Playwright, in `frontend/apps/nacora-*-e2e/`. Cover critical user journeys (login → book shipment → certificate download; broker create policy → publish → shipment quote).
- **Storybook** (when maintained): `frontend/libs/nacora/ui/**/*.stories.tsx`. Design-system component showcase, deployed to a staging CDN for design review.
- **Nx affected** in CI runs only the tests for changed packages, keeping PR feedback under a few minutes.

### Sharing with the platform

`libs/i2go/` is platform-wide — used by every tenant on the InSurance platform. Nacora-specific extensions live in `libs/nacora/`. Shared conventions:

- **Column configs** — declarative column definitions for tables (name, formatter, sortable, filterable). Common table components consume these to render policy lists, shipment lists, referral queues, etc.
- **Filter configs** — declarative filter definitions for list pages (name, type, options, default).
- **Models** — TypeScript interfaces mirroring the Django DRF serializer output. Keeping these in sync with the backend is a manual convention; drift causes silent field drops.

### Static assets and localisation

- Icons, images, PDF templates, and fonts live in Django (`src/clients/nacora/static/`). The frontend consumes them via `REACT_APP_BASE_URL` static paths.
- Translation strings are baked at frontend build time (JSON dictionaries under `src/i18n/`). Nacora ships EN, FR, DE, ES, JP, CN, TR, PT.
- Certificate PDF templates are Django-side, not React. Generated by weasyprint from Jinja2 templates.

### webpack, TypeScript, ESLint

- **webpack** (Nx-managed) — code splitting, tree shaking, hash-per-bundle for cache busting.
- **TypeScript** — strict mode, checked via `nx run <app>:type-check` in CI.
- **ESLint + Prettier** — enforced in CI. Rules live at workspace root, overridable per app.
- **Sourcemaps** — external, uploaded to Sentry on release for stack-trace reconstruction.

## Business rules & constraints

- **Two apps, one image.** Both `dist/`s ship in the same container so Django can serve them together. Deploying a frontend change deploys both.
- **Camel-case JSON.** Backend and frontend never speak snake_case directly. DRF's camelCase renderer/parser + `JSON_UNDERSCOREIZE` handle translation.
- **UUIDs everywhere.** No sequential ID leakage; frontend can't guess neighbouring records.
- **CSP mode uses bearer tokens; BO mode uses sessions.** Wiring at the auth interceptor. Don't mix — a CSP flow that reaches a session-only endpoint returns 401.
- **The wizard steps are stateful.** Partial saves happen on step exit. Never load the wizard from `/general-details` after `/rating` was completed without going through the intermediate steps.
- **The shipment portal is scope-locked.** A participant sees only their own shipments; a broker in BO mode sees their broker cluster. Frontend cannot override — the queryset filter runs server-side.
- **Nx affected tests only.** Full test-run in CI would be too slow — trust the affected-package graph.
- **Environment config is baked at build time.** Changing `REACT_APP_BASE_URL` requires a rebuild.

## Related concepts

- Architecture Overview
- APIs & Integrations
- Environments & Config
- Security & Permissions
- Repo Map
