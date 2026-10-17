# Migrations & Seed Commands

## What it is

Two related but distinct machinery layers:

- **Django migrations** — schema evolution. Every model change produces a migration file under `<app>/migrations/`; Kamal runs `python src/manage.py migrate` on the first container of each release.
- **Seed / setup management commands** — idempotent data seeds under `src/clients/nacora/management/commands/`. These populate reference data (choices, lookups, clause categories) and refresh external datasets (OFAC SDN, FX rates).

Together they bring an environment from empty to functional and keep it in sync as code changes.

## Who owns it or touches it

- **Backend engineers** author migrations and seed commands.
- **DevOps** manages the deploy-time invocation and post-deploy sweeps.
- **QA** verifies the current setup runs cleanly on a fresh DB.
- **BAs** occasionally trigger `refresh_sdn_list` or `update_usd_exchange_rates` for compliance checkpoints.

## How it works

### Django migration flow

Standard Django, with a few Nacora conventions.

**Creation.** `python src/manage.py makemigrations <app>` after a model change. The convention is: one logical schema change per migration, descriptive filename (`0042_add_shipment_status_expiring.py` rather than `0042_auto.py`). Nacora's migrations live under `src/clients/nacora/migrations/`; shared platform migrations under `src/<app>/migrations/`.

**Application.** `python src/manage.py migrate` — applies pending migrations in dependency order. On deploy, Kamal runs this on the first container of the release before any traffic hits it.

**Zero-downtime patterns.** Kamal deploys are rolling — old and new containers run side-by-side for a few seconds. Schema changes must be backwards-compatible for that window:

| Change | Safe pattern |
|---|---|
| Add a new column | Deploy the migration first (nullable); backfill in a data migration or Celery task; deploy the code that requires the column |
| Remove a column | Deploy the code that stops reading it; deploy a migration that drops it |
| Rename a column | Add the new column, dual-write, backfill, remove the old — over multiple releases |
| Add a NOT NULL constraint | Add the column nullable; backfill; add the constraint in a follow-up migration |
| Rename a model | Only via `AlterModelTable` + rename in a single release; both names briefly resolve |
| Drop a table | Only after every reader is gone; verify with grep and staging soak |

**Roll-forward only.** Rolling back a migration in production is not supported by the pipeline. A broken migration is fixed with another migration. If a migration corrupts data, restore from PG backup — the migration graph itself is not the recovery tool.

**Data migrations.** For non-schema changes (backfills, deletions), use `RunPython` inside a migration or a one-shot management command. Prefer management commands for slow operations — they can be re-run and their progress can be monitored.

**Fake-apply.** In a rare recovery scenario (`--fake` on a migration whose state you know is already applied), the pipeline supports this but with heavy scrutiny in review.

### Seed / setup commands

All under `src/clients/nacora/management/commands/`. Each is:

- **Idempotent** — safe to re-run any number of times.
- **Additive** — creates or updates rows; does not delete rows that are absent from the seed.
- **Non-destructive by default** — a `--wipe` flag exists on some commands for testing, but is not used in prod.

| Command | What it seeds |
|---|---|
| `setup_nacora_commodity_group_choices` | `ChoiceType('commodity_groups')` + all `Choices` rows with `config_attributes.codes.salog` |
| `setup_nacora_clause_categories` | Hierarchical `ClauseCategory` rows |
| `setup_nacora_lookup_categories` | `LookupCategory` + `LookupItem` for currencies, packing, coverages, conveyance, routes |
| `setup_nacora_conveyance_choices` | Conveyance `Choices` + Salog code map |
| `setup_nacora_coverage_choices` | Coverage `Choices` (ICC A/B/C, WA, FPA, etc.) |
| `setup_nacora_dev_data` | Combined dev fixture — calls the individual seeders and adds a demo policy for local dev |
| `refresh_sdn_list` | Pulls the latest OFAC SDN CSV into `cargo_sanctions/data/sdn.csv` (offline sanctions fallback) |
| `update_usd_exchange_rates` | Manual trigger for the daily FX rate sync (also runs on Celery Beat) |

### When to run which

**Fresh install (local dev, staging init):**

```
python src/manage.py migrate
python src/manage.py setup_nacora_commodity_group_choices
python src/manage.py setup_nacora_clause_categories
python src/manage.py setup_nacora_lookup_categories
python src/manage.py setup_nacora_conveyance_choices
python src/manage.py setup_nacora_coverage_choices
python src/manage.py update_usd_exchange_rates
python src/manage.py refresh_sdn_list
# optional for dev:
python src/manage.py setup_nacora_dev_data
python src/manage.py createsuperuser
```

**On every deploy:** `migrate` runs automatically. Seed commands do not — they run only when a new one is added (Kamal `deploy_hooks` or a manual `kamal app exec`).

**Regular operational cadence:**

- `update_usd_exchange_rates` — daily via Celery Beat (`submodules.currencies.tasks.update_usd_exchange_rates_daily`).
- `refresh_sdn_list` — weekly, either via Beat or a manual pull when OFAC publishes an update.

### Framework and conventions

- **Class-based command.** Every seed extends `BaseCommand`; verbose `--dry-run`, `--force`, `--wipe` flags where relevant.
- **Progress output.** Long seeds print row counts and a summary; short ones print a single "OK" line.
- **Idempotency via `get_or_create`.** Rows are keyed by natural keys (slug, code, key). Re-running never duplicates.
- **`config_attributes` merging.** The seed does not replace existing JSON attributes wholesale — it merges keys so that ad-hoc edits from the admin UI survive a re-run.
- **Tests.** Each seed has a `tests/test_setup_<name>.py` that runs it against a fresh DB and asserts row counts and key JSON attributes.
- **Deletion protection.** `is_active=False` is preferred over row deletion. Seed commands never remove rows — that would silently break historical shipments referencing the removed key.

### Migration + seed interaction

A common pattern: a migration adds a new column with a default that the seed then populates.

- Migration: `AddField(model='Choices', name='config_attributes', field=JSONField(default=dict))`.
- Follow-up seed: re-run `setup_nacora_commodity_group_choices` to populate `config_attributes.codes.salog` on every existing row.

The migration is fast and safe; the seed does the heavier lifting and can be re-run for correctness.

### Failure modes

**Migration failure on deploy.** Kamal aborts the release; the previous image continues to serve. Diagnose via the migration log, fix with an additional migration, redeploy. Never `--fake` past a legitimate failure.

**Seed failure.** Fails loudly with a stacktrace; no partial rows persist (each `get_or_create` is transactional per row). Fix the seed, re-run.

**Beat missed a night.** `update_usd_exchange_rates` was designed to catch up — the next run pulls "yesterday's" rate; if two nights are missed, one gap remains and analytics reflects `null` for that day. Manual `python src/manage.py update_usd_exchange_rates --date 2026-06-30` backfills a specific date.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| Migration files under each `<app>/migrations/` | Schema evolution |
| Seed commands under `src/clients/nacora/management/commands/` | Reference-data setup |
| Celery Beat schedule | Recurring seeds (FX, SDN) |
| Kamal `deploy_hooks:` in `config/deploy.yml` | Run a seed on every deploy (rare) |
| `--dry-run`, `--force`, `--wipe` flags | Per-command runtime toggles |

Common ops:

- `kamal app exec python src/manage.py migrate` — from an ops box.
- `kamal app exec python src/manage.py setup_nacora_commodity_group_choices` — re-run a specific seed.
- `kamal migrate` — Kamal alias for the above migrate command.
- `python src/manage.py showmigrations` — list applied and pending migrations.
- `python src/manage.py sqlmigrate <app> <migration>` — dump the SQL a migration would emit.

## Constraints, guarantees, and gotchas

- **Migrations are the schema source of truth.** Do not hand-edit tables in prod. Every schema change goes through a migration file that is code-reviewed and applied on deploy.
- **Roll-forward only.** Rolling back a migration is not a supported operation. Fix with a new migration.
- **Never drop a column that active code still references.** The rolling deploy window guarantees old readers exist for a few seconds during release — a same-release drop breaks them.
- **Seeds are additive.** If a code change requires removing a row (e.g. a deprecated commodity group), the seed does not remove it — the removal is a migration `RunPython` that deactivates the row.
- **`config_attributes` merges are shallow.** A nested `codes` map is replaced wholesale if the seed provides one; edits to sub-keys via admin can be overwritten. If you edit a nested attribute in admin, either update the seed to include your edit or move the edit into a migration.
- **The dev seed is a superset.** `setup_nacora_dev_data` runs everything and adds sample policies. Never run it in staging or prod.
- **`refresh_sdn_list` needs egress.** It downloads from the OFAC website; a firewalled environment must either mirror the URL or ship an offline CSV.
- **Fake migrations require sign-off.** `--fake` skips SQL execution and marks the migration applied. Use only in documented recovery, never in normal flow.

## Related concepts

- Environments & Config
- Local Development
- CI Pipeline
- Docker Build
- Choices, Lookups & Code Maps
- Data Model & Entities
