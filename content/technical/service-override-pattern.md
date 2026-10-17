# Service Override Pattern

## What it is

Nacora does not fork the TigerLab platform. Every behaviour that Nacora needs to customise is expressed as a **service class** whose fully-qualified path is registered in Nacora's settings and loaded by the base platform via a factory. The base platform never changes; Nacora ships its own concrete classes and points settings at them.

This page enumerates every override slot, its registration key, its contract, and how the platform loads it. Together they form the API between "the platform" and "the Nacora customisations".

## Who owns it or touches it

- **Backend engineers** writing or reviewing a Nacora-specific behaviour — they add or edit a class under `src/clients/nacora/**` and register it in `src/clients/nacora/settings.py`.
- **Architects** reviewing whether a new customisation belongs in an existing override or needs a brand-new settings key on the base platform.
- **Platform engineers** (base team) exposing new override slots — they define the registration key, the loader, and the abstract contract.

## How it works

### The general shape

Every override slot follows the same pattern:

1. **Base platform defines a factory / loader.** The base code imports a class path from `settings.<KEY>` (or `settings.<KEY>[<model_name>]` for per-model registries) and calls `import_string(path)` to get the concrete class.
2. **Base platform ships a default.** Usually a sensible generic implementation lives in the shared module (e.g. `src/policies/services.py`). Nacora's settings point at the Nacora subclass instead.
3. **Nacora subclass lives under `src/clients/nacora/<module>/services.py`.** It either extends the base class (`super()` on relevant hooks) or implements a small, well-defined interface from scratch.
4. **Contract is enforced by convention, not by an ABC.** The platform documents the method signatures in the base class docstring; new overrides mirror those signatures.

Because loading is settings-driven, unit tests can substitute test doubles by patching `settings.<KEY>` and re-importing the loader — no monkey-patching of module globals.

### The override slots

| Setting key | Kind | Contract summary | Nacora concrete class |
|---|---|---|---|
| `CUSTOM_POLICY_STATUS_SERVICE` | Single class | `resolve_status(policy_version)` returns the target `PolicyStatus` slug given the current state and pending actions | `clients.nacora.policies.services.PolicyStatusService` |
| `CUSTOM_QUERYSET_SERVICE` | Dict `{model_name: path}` | `filter_queryset(qs, user)` returns a filtered queryset for row-level access | `clients.nacora.policies.services.PolicyVersionItemQuerysetFilterService` (and siblings, one per model) |
| `CUSTOM_PERMISSION_CLASS` | Dict `{model_name: {class, ...}}` | DRF permission class contract — `has_permission`, `has_object_permission` | `clients.nacora.policies.permissions.ReferralPermission`, `SpecialRateRequestPermission` |
| `CUSTOM_CHOICES_VALIDATION_SERVICE` | Single class | `validate(choice_type_slug, key)` returns bool, `validate_many(choice_type_slug, keys)` | Nacora subclass under `clients.nacora.i2go_choices.services` |
| `CUSTOM_CHOICES_LOOKUP_ITEM_SERVICE` | Single class | `resolve(direction, source, code)` returns a `LookupItem` — bidirectional (external code → internal `key`, and reverse) | `clients.nacora.i2go_choices.services.BiDirectionalLookupService` |
| `CANCELLATION_SERVICES` | Dict `{target_kind: path}` | `cancel(target, effective_date, reason, user)` returns the cancellation record | `clients.nacora.cancellation.services.CancellationService` |
| `CUSTOM_BULK_UPLOAD_HANDLER` | Single class | `handle(file, user)` returns the job token | `clients.nacora.bulk_upload.handler.NacoraBulkUploadHandler` |
| `CUSTOM_EXPORTER_FORMATTERS` | Dict `{report: path}` | Row formatter for each async export | `clients.nacora.exporter.PolicyBillingReportFormatter`, `SpecialRateFormatter` |
| `CUSTOM_MAIL_TEMPLATE_SERVICE` | Single class | Resolve a template + context by name + language | Nacora subclass under `clients.nacora.mails.services` |
| `CUSTOM_RATING_RESPONSE_SERVICE` | Single class | `rate(shipment)` returns the priced breakdown | `clients.nacora.ratings.services.ShipmentRatingResponseService` |
| `CUSTOM_RULES_EVALUATION_SERVICE` | Single class | `evaluate(target)` returns list of `ActionOutcome` | `clients.nacora.i2go_rules.services.RulesEvaluationService` |
| `CUSTOM_DOCUMENT_GENERATION_SERVICE` | Single class | `render(policy, doc_type, language, context)` returns bytes | `clients.nacora.documents.services.DocumentGenerationService` |
| `CUSTOM_REFERRAL_SERVICE` | Single class | `handle(referral, action, user)` transitions the referral | `clients.nacora.i2go_activities.services.ReferralService` |
| `CUSTOM_NUMBERING_SERVICE` | Dict `{kind: path}` | `next(kind, context)` returns the next number | `clients.nacora.numbering.services.ShipmentNumberingService` (for shipments) + `submodules.numbering.NumberingMixin` for others |

The list is authoritative for the current shipped codebase; adding a new slot is a base-platform change (define the loader + default) followed by a Nacora subclass.

### How a service override is resolved at runtime

Pseudocode of the general resolver:

```
from django.utils.module_loading import import_string
from django.conf import settings

def get_service(setting_key, model_name=None):
    conf = getattr(settings, setting_key, None)
    if conf is None:
        return DEFAULT_MAP[setting_key]     # shipped platform default
    if isinstance(conf, dict) and model_name is not None:
        entry = conf.get(model_name)
        if entry is None:
            return DEFAULT_MAP[setting_key]
        conf = entry['class'] if isinstance(entry, dict) else entry
    return import_string(conf)
```

Loaders are cached on first resolve so `import_string` runs once per process. Tests that need to swap an override call `django.utils.module_loading.import_string.cache_clear()` (or the platform's own reset hook) after patching settings.

### Why "override not fork"

- **Platform upgrades stay cheap.** A base-platform release adds new features; Nacora picks them up by rebasing settings, not by resolving merge conflicts.
- **Shared platform code is testable in isolation.** The base test suite runs against the default services; Nacora's suite runs against Nacora subclasses.
- **Diffable customisation.** `git log src/clients/nacora/` is the complete history of Nacora-specific behaviour.
- **Same container image, per-client wiring.** The Docker image is shared across clients; only the settings pointer differs between tenants.

### Reading the code

When a request appears to be doing something Nacora-specific, the right file to read is:

1. The base-platform view/service (`src/policies/services.py`, etc.) — this describes the contract.
2. `src/clients/nacora/settings.py` — this tells you which override is active.
3. The concrete class under `src/clients/nacora/**/services.py` — this is the Nacora behaviour.

## Configuration & operational levers

- Every override key can be set to the base-platform default (or omitted) to fall back — useful during an incident to revert Nacora-specific behaviour temporarily.
- Environment overrides via `docker/local_settings.py.<env>` can substitute an override just for one environment (e.g. a diagnostic queryset filter in staging).
- Test overrides via `@override_settings(CUSTOM_QUERYSET_SERVICE={...})` swap the class for a single test method.

| Setting | Layer | Purpose |
|---|---|---|
| `CUSTOM_*` (see table) | Nacora settings | Register concrete classes |
| `INSTALLED_APPS` | Nacora settings | Ensures `clients.nacora` is loaded so its modules can be imported |
| `AUDITTRAIL_MODELS` | `audittrail_settings.py` | Companion to overrides — declares which override outputs get audited |
| `RULES_ENGINE_MODE` | Nacora settings | Interacts with `CUSTOM_RULES_EVALUATION_SERVICE` |

## Constraints, guarantees, and gotchas

- **No monkey-patching.** All customisation is via settings + explicit subclass. If a behaviour is customised via `monkey_patch` in `apps.py.ready()`, that is a bug — file it against the platform to expose a proper override slot.
- **Overrides are per-tenant, not per-request.** A single container serves one client (`APP_CLIENT` build arg). Overrides are wired at process start and stay stable for the container lifetime.
- **Signature drift breaks silently.** If the base platform adds a positional argument to the default method, a Nacora subclass that doesn't accept it will fail at first invocation. Adding an override slot is a base-platform PR that must include a Nacora sync.
- **The queryset filter is not optional.** Every list endpoint that touches user-scoped data must resolve `CUSTOM_QUERYSET_SERVICE[<model>]` and apply it — see Security & Permissions. Skipping the filter is the most common security bug reviewers catch.
- **Overrides do not implicitly inherit hooks.** If the base default has a pre-save signal wired inside the class, the Nacora subclass must call `super()` on the relevant hook or re-attach the signal — the platform does not auto-detect missing calls.
- **Test doubles must clear the import cache.** Patching `settings.<KEY>` alone does not re-resolve the loader; the test must also clear `import_string`'s cache or use the platform's provided helper.

## Related concepts

- Architecture Overview
- Security & Permissions
- Rating Engine
- Business Rules Engine
- Cancellation & Endorsement
- Configuration Loading
