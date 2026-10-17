# Choices, Lookups & Code Maps

## What it is

The platform holds two overlapping structures for reference data: **Choices** (`ChoiceType` + `Choices`) — small, product-scoped enums used in rating and validation — and **Lookups** (`LookupCategory` + `LookupItem` + `LookupItemAttribute`) — larger reference tables that can be hierarchical and carry per-row metadata.

Nacora ships a `BiDirectionalLookupService` that resolves in both directions: given an external code (from a Salog SOAP request), return the internal `Choices.key`; given an internal `key`, return the external code (to emit on the SOAP response or on the BMS bordereau).

Seeding these tables is done via `management/commands/setup_nacora_*` — the same commands that fresh-installs and CI use to bring an environment to the current baseline.

## Who owns it or touches it

- **Backend engineers** who add a new rating dimension or new choice value.
- **BAs** who define what "commodity groups" mean at product level.
- **Integrators** aligning Nacora `Choices` to external partner codes (Salog, BMS).
- **QA** verifying that a new choice value round-trips through the SOAP layer without loss.

## How it works

### Model recap

| Model | Purpose |
|---|---|
| `ChoiceType` | List definition. `slug` is the key (`commodity_groups`, `conveyance`, `packing`, `coverages`, `currency`). Optional `content_type` + `object_id` scopes the type to a specific product or model |
| `Choices` | One value inside a `ChoiceType`. `key` is the internal identifier used in rating (`sea`, `air`, `general_merchandise`); `value` is the display label; `config_attributes` (JSON) carries region, HS code range, symbol, currency name, etc. |
| `LookupCategory` | Reference table (Routes, Commodity Group grouping). `is_global` marks tables shared across products |
| `LookupItem` | Row in a `LookupCategory`. Hierarchical via `parent`. `extra_data` (JSON) carries per-item metadata |
| `LookupItemAttribute` | Extra key-value on a `LookupItem` |

Choices are typically small, hard-coded enumerations. Lookups are larger, often externally-sourced tables that require metadata per row (region for a country, symbol for a currency).

### `BiDirectionalLookupService`

Registered via `CUSTOM_CHOICES_LOOKUP_ITEM_SERVICE = 'clients.nacora.i2go_choices.services.BiDirectionalLookupService'`.

Public methods (approximate):

```
class BiDirectionalLookupService:
    def resolve(self, direction, choice_type_slug, code):
        """
        direction = 'external_to_internal' or 'internal_to_external'
        Returns the resolved Choice/LookupItem or raises LookupNotMapped.
        """

    def to_internal(self, choice_type_slug, external_code):
        """External code -> internal `key` for the given ChoiceType."""

    def to_external(self, choice_type_slug, internal_key, target='salog'):
        """Internal key -> external code for a given partner (salog|bms|georisk)."""

    def resolve_lookup_item(self, category_slug, code_or_key, direction='internal'):
        """LookupItem resolution over LookupCategory rows."""
```

The service reads two sources when resolving:

1. **`Choices.config_attributes` JSON** — the primary source. Each `Choices` row carries a `codes` map like `{"salog": "FS", "bms": "SEA", "iso": "SEA"}`.
2. **Static settings map** — fallback for legacy codes. `SOAP_SALOG_CODE_MAP` (defined in Nacora settings) is consulted when the JSON doesn't have the requested direction.

Direction rules:

- **External → internal** (inbound SOAP): reverse-lookup on `config_attributes.codes.<partner>`; return the `Choices.key`.
- **Internal → external** (outbound SOAP response, BMS bordereau, GeoRisk webhook): forward-lookup on the same JSON.

Failure is loud: unknown codes raise `LookupNotMapped`, which the SOAP handler converts to `COMMODITY_NOT_MAPPED` / `COVERAGE_NOT_MAPPED` faults. No silent fallback to "unknown".

### Code map for SOAP — Salog integration

The Salog side uses its own compact codes (`FS` for sea, `FA` for air, numeric commodity codes). Nacora settings hold the canonical mapping:

```
SOAP_SALOG_CODE_MAP = {
  'conveyance': {
    'FS': 'sea',
    'FA': 'air',
    'FR': 'road',
    'FI': 'inland_waterway',
  },
  'commodity_groups': {
    '10': 'general_merchandise',
    '20': 'perishable',
    # ...
  },
  'coverages': {
    'A': 'icc_a',
    'B': 'icc_b',
    'C': 'icc_c',
  },
  # ...
}
```

`SOAP_POLICY_LOOKUP_FIELD` controls whether Salog references policies by `external_policy_number` (Salog side code) or internal `number` (`MC-XXXXXX`).

The `BiDirectionalLookupService` prefers the per-row `config_attributes.codes.salog` when present (so BAs can align a new choice by editing one row in the DB rather than editing a settings file), and falls back to `SOAP_SALOG_CODE_MAP` for legacy codes.

### Seed commands

Choices and lookups are seeded via idempotent management commands under `src/clients/nacora/management/commands/`:

| Command | Populates |
|---|---|
| `setup_nacora_commodity_group_choices` | `ChoiceType('commodity_groups')` + `Choices` rows for all supported commodity groups. Includes `config_attributes.codes.salog` |
| `setup_nacora_clause_categories` | `ClauseCategory` hierarchy (not a Choice, but a peer reference table) |
| `setup_nacora_lookup_categories` | `LookupCategory` rows for `currencies`, `packing`, `coverages`, `conveyance`, `routes` |
| `setup_nacora_conveyance_choices` | `Choices` for the conveyance types (sea/air/road/etc.) with Salog codes |
| `setup_nacora_coverage_choices` | Coverage clauses (ICC A/B/C etc.) |
| `setup_nacora_dev_data` | Combined dev fixture that calls the individual seeders and adds a demo policy |

Each command is idempotent — safe to re-run on an environment that's already partially seeded. Commands use `get_or_create` on `(slug, key)` and update `config_attributes` in place when re-running.

### Adding a new choice or code map

1. Edit the appropriate seed command (`setup_nacora_<X>_choices.py`) to add the row(s).
2. Include `config_attributes.codes = {"salog": ..., "bms": ..., ...}` for every downstream partner.
3. Run the command in dev (`python src/manage.py setup_nacora_<X>_choices`) — verify the row is present and the reverse resolution works.
4. Deploy — Kamal calls migrations automatically; if the seed command needs to run post-deploy, add it to `deploy_hooks:` or run manually via `kamal app exec`.

For a one-off code addition that shouldn't be baked into the seed (e.g., a partner-specific alias), edit the `Choices.config_attributes` JSON directly through the admin UI at `/tiger-site-admin/`. This survives migrations but is not idempotently re-created.

### Validation service

`CUSTOM_CHOICES_VALIDATION_SERVICE` — used by DRF serializers when validating incoming payloads. Given a `choice_type_slug` and a candidate `key`, it returns `True` if the key exists and is active in that ChoiceType. Invalid keys produce a normal DRF `ValidationError` field-level message.

### Read paths

- Rating engine: `Choices.key` values passed in the payload dict.
- Rules engine: `RuleCondition.value` is compared against `Choices.key` where the attribute is a choice.
- Frontend: options are pulled from `/api/v1/i2go-choices/` (list ChoiceTypes + their values).
- SOAP: `to_internal` on inbound, `to_external` on outbound.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `CUSTOM_CHOICES_LOOKUP_ITEM_SERVICE` | Register `BiDirectionalLookupService` |
| `CUSTOM_CHOICES_VALIDATION_SERVICE` | Register the Nacora validation subclass |
| `SOAP_SALOG_CODE_MAP` | Static fallback code map |
| `SOAP_POLICY_LOOKUP_FIELD` | Which policy field Salog references (`external_policy_number` or `number`) |

## Constraints, guarantees, and gotchas

- **Every choice used by rating or rules must exist as an active `Choices` row.** Referring to a non-existent key produces a validation error at serializer time, not a silent miss at rating time.
- **Fail loud on unmapped external codes.** SOAP raises `COMMODITY_NOT_MAPPED` / `COVERAGE_NOT_MAPPED` faults; there is no "unknown → default" fallback. This is intentional — a silent default would produce wrong ratings.
- **Seed commands are idempotent but not destructive.** They add rows and update `config_attributes`; they do not remove rows that are no longer in the seed. Removing a value requires a migration or admin action.
- **`config_attributes.codes` per-row wins over `SOAP_SALOG_CODE_MAP`.** The static settings map is a fallback for legacy codes; new code alignments should be added to the DB rows, not to settings.
- **Lookup vs Choice choice.** Small, product-owned enum? Use `Choices`. Larger, cross-product reference table with per-row metadata? Use `LookupCategory` + `LookupItem`. Currencies live in both — the display list is a Choice, the FX-adjacent metadata (symbol, ISO code, decimal places) is a LookupItem.
- **Deactivating a Choice does not delete it.** `is_active=False` hides it from new UI drop-downs but existing shipments referencing that key still resolve — historical rating stays consistent.
- **Multiple ChoiceTypes with the same slug are not allowed.** Enforced by a DB unique constraint.

## Related concepts

- Data Model & Entities
- Rating Engine
- SOAP Inbound
- Business Rules Engine
- Migrations & Seed Commands
- Service Override Pattern
