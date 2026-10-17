# CI Pipeline

## What it is

The Nacora / InSurance monorepo runs its continuous integration on **Woodpecker CI**, driven by `.woodpecker.yml` at the repo root. Every push and every pull request runs through a fixed sequence of stages: Lint & Format → Type Check → Test → Build → Deploy. Deployment is gated on prior stages passing; production deployment requires a merge to the main branch and a tagged release.

## Who owns it or touches it

- **All engineers** — every PR runs the pipeline before it can merge.
- **DevOps** owns `.woodpecker.yml`, the runner infrastructure, and the container-registry credentials.
- **Release manager** (rotating) monitors deploy stage output and rolls back on failure.

## How it works

### Stage sequence

| Stage | Purpose | Blocking? | Approximate time |
|---|---|---|---|
| **Lint & Format** | `black`, `isort`, `flake8` on Python; `eslint`, `prettier` on TypeScript | Yes | 1–2 min |
| **Type Check** | `mypy` on Python (opt-in per package); `tsc --noEmit` on TypeScript | Yes | 2–4 min |
| **Test** | `pytest` for Python; `jest` for TypeScript; Nx-affected only on PRs | Yes | 5–10 min (affected only) or 15+ (full) |
| **Build** | Multi-stage Docker build (frontend + backend) → push to GHCR | Only on main + tagged | 6–8 min |
| **Deploy** | Kamal deploy to staging (on main) or prod (on tagged release) | Manual approval for prod | 3–5 min |

### Lint & Format

Runs `ruff` / `black` / `isort` / `flake8` (Python) and `eslint` / `prettier` (TypeScript). Non-zero exit on any violation fails the stage.

The commands are wrapped in the repo's `Makefile`: `make lint` and `make format-check`. Local pre-commit hooks (installed via `pre-commit`) run the same set before push, so CI is normally a rubber stamp.

### Type Check

- **Python:** `mypy` is opt-in per module — packages with a `py.typed` marker and a `mypy.ini` section are checked. Nacora client code is fully typed; some shared platform modules are still transitional.
- **TypeScript:** `tsc --noEmit` runs against every workspace project. `strict: true` is enabled in the shared `tsconfig.base.json`; individual apps may relax specific flags via override.

### Test

Config lives in `pytest.ini`:

- `DJANGO_SETTINGS_MODULE=clients.nacora.settings.test` — a test-mode settings module that layers on top of the Nacora settings with SQLite-in-memory DB, stubbed external services, and disabled Celery.
- `--reuse-db` for local dev, forbidden in CI (fresh DB per run).
- `testpaths = src` (Python), `frontend/apps/**/src` + `frontend/libs/**/src` (JS via Jest).

**Nx affected on PRs.** For a PR branch, CI runs only the Nx-affected projects using `nx affected --target=test --base=origin/main`. This dramatically reduces PR runtime; the full test suite runs on main-branch pushes.

**Fixtures:** Django fixtures live under `src/**/fixtures/` (JSON) and pytest fixtures under `src/**/conftest.py`. The rating engine's golden-path fixtures are pre-loaded so the pipeline sees regressions on any numeric change.

**External services in tests:**

- HTTP calls are recorded/replayed via `vcrpy` for third-party integration tests.
- AWS is stubbed via `moto` (Bedrock, Comprehend, S3, DynamoDB).
- Celery is `CELERY_TASK_ALWAYS_EAGER = True` in test settings — tasks run inline in the request cycle.

**Coverage:** `pytest-cov` produces a coverage report; CI does not enforce a threshold but does upload to the coverage dashboard for review.

### Build

Runs only on merges to `main` and on tagged release commits.

1. **Docker build** using `docker/Dockerfile.i2go` (see Docker Build for stage detail). Build args passed:
   - `APP_CLIENT=nacora`
   - `APP_ENV=<target env>` — `staging` on main, `prod` on tagged release
   - `REQUIREMENTS_FILE=production`
   - `FRONTEND_APPS=nacora-embedded-cargo,nacora-shipment-portal`
2. **Image tag**: `ghcr.io/tigerlab/insurance:<git-sha>` plus `:latest-staging` or `:prod-<version>`.
3. **Push to GHCR** (GitHub Container Registry) using `GHCR_TOKEN` from the CI secrets vault.

### Deploy

Kamal orchestrates the deploy. The deploy stage:

1. SSH's to the target host(s) using `config/deploy.yml`.
2. Pulls the tagged image from GHCR.
3. Runs `python src/manage.py migrate` on the first container of the release. Zero-downtime rules apply (see Migrations & Seed Commands).
4. Rolls containers one at a time behind the Kamal proxy: new container up → Kamal calls `/health` until healthy → old container gracefully stops.
5. Runs post-deploy hooks (if any) — usually a `collectstatic` and a Sentry release-created event.

**Staging deploys** happen automatically on every merge to `main`.

**Prod deploys** are gated on:

- Successful staging deploy of the same commit.
- Tagged release (`v<major>.<minor>.<patch>`).
- Manual approval in Woodpecker.

### PR gate mechanics

A PR cannot merge until:

- All required checks pass on the head commit.
- At least one code-review approval.
- The base branch (`main`) hasn't diverged in ways that require re-run.

Woodpecker reports statuses to GitHub / Gitea via webhooks. Individual checks are visible on the PR page.

### Rollback

Kamal supports `kamal rollback` — reverts to the previously-active image tag. Practical rollback:

- **Fast rollback** (image only) — one command, safe when no schema migration was involved.
- **Migration rollback** — not supported in-band. Roll-forward with a fix migration is the accepted pattern (see Migrations & Seed Commands).

### Notifications

Pipeline status → Slack via a Woodpecker plugin. Success on staging is quiet; any failure pings the release channel.

## Configuration & operational levers

| File / key | Purpose |
|---|---|
| `.woodpecker.yml` | Stage definitions, per-stage image, when-run rules |
| `Makefile` | Command wrappers used by CI (`make lint`, `make test`, `make build`) |
| `pytest.ini` | Pytest config + Django settings module |
| `mypy.ini` | Type-check config |
| `.eslintrc.json`, `.prettierrc` | Frontend lint/format |
| `tsconfig.base.json` | TypeScript compiler options |
| `nx.json` | Nx workspace config — projects and affected calculation |
| `GHCR_TOKEN` (CI secret) | Push access to the container registry |
| `KAMAL_REGISTRY_PASSWORD` (CI secret) | Kamal pull access on target hosts |
| `SENTRY_AUTH_TOKEN` (CI secret) | For creating Sentry releases |

### Common CI operations

- Re-run a failed pipeline: Woodpecker UI → "Restart" on the failed step, or comment `/retry` on the PR.
- Skip CI for a docs-only commit: `[skip ci]` in the commit message.
- Force full test suite on a PR: set the label `full-tests` on the PR (Woodpecker rule reads the label and disables Nx affected filtering).

## Constraints, guarantees, and gotchas

- **Lint failures block everything else.** If lint fails, no further stages run — the failure is intentional to avoid wasting CI minutes on badly-formatted code.
- **`--reuse-db` is forbidden in CI.** Every CI run starts from a fresh migration; a broken migration is caught here rather than on deploy.
- **Nx affected can miss cross-project changes.** If a change to a shared lib should trigger a downstream app test, the change graph needs to be accurate — occasionally an explicit `nx run-many` is required (opt-in via the `full-tests` label).
- **Prod deploys require manual approval.** No auto-deploy to prod even on green — a human is always in the loop.
- **Migrations run on the first container of the release.** If migrations fail, the release fails and the previous image continues to serve. The failure is highly visible in the Kamal output.
- **Rollback is image-only.** Schema changes require a roll-forward. Never assume a Kamal rollback restores DB state.
- **Secrets are not exposed in logs.** Woodpecker masks known secret values in the console output. New secrets must be registered via the CI secrets store; hard-coding them in `.woodpecker.yml` is rejected in review.
- **PR checks are required.** Bypass ("admin override") should be reserved for hotfixes and is logged.

## Related concepts

- Docker Build
- Environments & Config
- Migrations & Seed Commands
- Local Development
- Observability
- Frontend Architecture
