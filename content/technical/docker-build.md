# Docker Build

## What it is

The container image that runs every environment — dev, staging, prod — is produced by a single multi-stage Dockerfile: `docker/Dockerfile.i2go`. It builds the Nx frontend in a Node stage, builds the Django backend in a Python stage, and copies the frontend `dist/` output into the Python image. The result is one image per commit, tagged and pushed to GHCR by the CI pipeline.

Only build args and env vars change between environments; the image content is identical.

## Who owns it or touches it

- **DevOps** owns the Dockerfile and the build args.
- **Backend engineers** add new Python deps to the appropriate requirements file.
- **Frontend engineers** add new Node deps and Nx projects.
- **Release manager** watches image size and layer cache health.

## How it works

### Multi-stage layout

```
docker/Dockerfile.i2go

# ---------- Stage 1: Node — frontend build ----------
FROM node:20-slim AS frontend
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG FRONTEND_APPS=nacora-embedded-cargo,nacora-shipment-portal
RUN npx nx run-many --target=build --projects=$FRONTEND_APPS --configuration=production

# ---------- Stage 2: Python — backend + copy frontend ----------
FROM python:3.11-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=clients.nacora.settings

ARG APP_CLIENT=nacora
ARG APP_ENV=prod
ARG REQUIREMENTS_FILE=production

# System deps for weasyprint, psycopg, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libcairo2 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
    libffi-dev fonts-liberation curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements/ ./requirements/
RUN pip install --no-cache-dir -r requirements/$REQUIREMENTS_FILE.txt

COPY src/ ./src/
COPY manage.py ./
COPY config/ ./config/
COPY docker/local_settings.py.$APP_ENV ./docker/local_settings.py.$APP_ENV

# Copy frontend build output from stage 1
COPY --from=frontend /workspace/frontend/dist/ ./frontend/dist/

# Collect static files (baked into the image so it's ready at start)
RUN python src/manage.py collectstatic --noinput

CMD ["gunicorn", "src.insurance.wsgi", "--bind", "0.0.0.0:8000"]
```

Two stages, one final image. The frontend stage exists only during build — its intermediate layers are not shipped, only the copied `dist/` output ends up in the final image.

### Build args

Passed by CI via `docker build --build-arg ...`:

| Arg | Purpose | Typical values |
|---|---|---|
| `APP_CLIENT` | Tenant identifier baked into env + settings | `nacora` |
| `APP_ENV` | Which per-env overlay to include | `dev` / `staging` / `prod` |
| `REQUIREMENTS_FILE` | Which pip requirements file to install | `production` / `dev` / `base` |
| `FRONTEND_APPS` | Comma-separated Nx app names to build | `nacora-embedded-cargo,nacora-shipment-portal` |

Because `APP_CLIENT` and `APP_ENV` are build args, they are baked into the image and printed in the container's environment output on startup. Runtime env vars can still override individual settings, but the overlay module choice is fixed at build time.

### Layer caching strategy

The Dockerfile is ordered from least-frequently-changing to most-frequently-changing to maximise BuildKit layer cache hits:

1. `requirements/` copy + `pip install` — the biggest layer; changes only when a Python dep changes.
2. `frontend/package.json` copy + `npm ci` (in stage 1) — changes only when a JS dep changes.
3. `src/` copy — changes on almost every commit.
4. `collectstatic` — deterministic; only re-runs when static files change.

On a typical PR, only steps 3 and possibly 4 miss cache — the heavy pip and npm installs are cache hits.

### Frontend build detail

Nx runs `run-many --target=build --projects=...` — builds each project's production bundle in parallel. The output at `frontend/dist/apps/<app>/` includes:

- Compiled JS + CSS chunks.
- `webpack-stats.json` — read by Django's `webpack-loader` package to resolve the current bundle filenames.
- Static assets referenced by the app.

Only the projects listed in `FRONTEND_APPS` build. Adding a new app requires updating the CI's build arg.

### Python build detail

- `python:3.11-slim-bookworm` base.
- System packages installed for weasyprint (Cairo, Pango, gdk-pixbuf) and psycopg (libpq-dev). Small footprint compared to the full `python:3.11` image, but not as minimal as `alpine` — bookworm is preferred because weasyprint's dep chain works cleanly there.
- Requirements installed non-cached (`--no-cache-dir`) to keep the pip layer small.
- Source code copied last so unrelated changes don't invalidate the deps layer.

### `.dockerignore`

Excludes files that shouldn't end up in the image and would slow the build context transfer:

- `.git/`, `.github/`, `.woodpecker.yml`
- `frontend/node_modules/` (frontend stage runs `npm ci` from scratch)
- `frontend/dist/` (built inside the container, not on the host)
- `**/*.pyc`, `__pycache__/`
- `data/`, local dev databases
- `docs/`, `README.md`, `.md` files (docs live in the KB, not the container)
- `.env`, secrets

Keeping the context tight helps CI throughput.

### Image size

Approximate final image size: **900 MB – 1.2 GB**. The bulk is:

- Python interpreter + system libs: ~250 MB.
- Site-packages (weasyprint, boto3, django, DRF, celery, etc.): ~400 MB.
- Frontend `dist/` for both apps: ~30–50 MB (minified + gzipped by nginx or the platform's proxy at serve time).
- Django `staticfiles` after `collectstatic`: ~50 MB.

There is room to trim (e.g. moving to `distroless`), but it hasn't been a priority — pull time on the deploy hosts is not currently the bottleneck.

### `collectstatic` in the image

Static files are collected at build time so the container is ready to serve immediately on start. If `STATIC_URL` and `STATIC_ROOT` change between environments, this means the image is env-specific — but since the overlay is already env-specific, this is not a new constraint.

### Multi-tenant image note

The image is per-tenant (`APP_CLIENT=nacora`). A different client (e.g. `otherclient`) would produce a different image with a different set of frontend apps and a different overlay file — the shared platform code is the same, but the image is not.

## Configuration & operational levers

| Where | Purpose |
|---|---|
| `docker/Dockerfile.i2go` | The build recipe |
| `docker/local_settings.py.<env>` | Per-env overlay, baked into the image at build |
| `docker/local_settings.py.<env>.example` | Template for adding a new environment |
| `requirements/base.txt` | Shared Python deps |
| `requirements/production.txt` | Prod extras (gunicorn, sentry, boto3) |
| `requirements/dev.txt` | Dev extras (pytest, black, isort, silk) |
| `.dockerignore` | Context exclusions |
| `frontend/nx.json` | Nx workspace config — projects, targets, caching |
| `.woodpecker.yml` (Build stage) | Build args and image tags |

Manual build commands:

- `docker build -f docker/Dockerfile.i2go --build-arg APP_CLIENT=nacora --build-arg APP_ENV=prod -t nacora:local .`
- `docker run -p 8000:8000 --env-file .env nacora:local`
- `docker system prune -a` — clean up cached layers when disk gets tight.

## Constraints, guarantees, and gotchas

- **Layer order matters.** Moving the `COPY src/` line above the requirements install would invalidate the pip layer on every commit — do not touch the ordering without a full CI cost analysis.
- **`APP_ENV` and `APP_CLIENT` are baked in.** A prod image cannot be "converted" to a staging image at runtime — build both separately.
- **Only `FRONTEND_APPS` in the build arg get built.** Adding a new SPA requires updating the CI arg and rebuilding.
- **weasyprint's system deps are non-optional.** Removing Cairo/Pango libs breaks PDF rendering silently at runtime.
- **`collectstatic` at build time can hide missing static files.** If a template references a static file that doesn't exist, the build succeeds but the request 404s. QA on staging catches this before prod.
- **The image includes the `.env` overlay file, not the env vars themselves.** Real secrets come from Kamal's runtime env; the overlay is for non-secret per-env config.
- **`--no-cache-dir` on pip is intentional.** It keeps the deps layer small; do not remove it without measuring the size delta.
- **`.dockerignore` excludes `frontend/dist/`.** The build must produce it fresh — a stale local `dist/` won't leak into the image.

## Related concepts

- Environments & Config
- CI Pipeline
- Frontend Architecture
- Configuration Loading
- Local Development
- Observability
