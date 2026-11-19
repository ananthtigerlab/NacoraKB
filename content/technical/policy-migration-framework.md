# Policy Migration Framework

The policy migration framework is a command-driven pipeline that onboards third-party and country-specific policies into Nacora from external source workbooks stored in S3. It is built as a Django app under the Nacora client with 441 source files covering wave orchestration, step appliers, clause book parsing, change logs and testing.

## Architecture

### Module layout

The framework is organised into these layers:

- **Core** — wave runner, wave scoping, S3 path resolution, preflight checks, schema validation, registry, reporting, rating readiness, undo
- **Appliers** — one module per migration concern: billing, business rules, clauses, documents, holder, policy settings, rating. Each applier reads source data and writes to the domain models.
- **Duplication** — policy builder (from scratch, not cloning), revert logic, third-party-specific build steps
- **Imports** — creator updates, special rate imports, commodity dimension imports
- **Changelog** — comparison, delta computation, fingerprinting, identity resolution between source and target states
- **Activation** — selectors and service for activating migrated policies through the rating gate
- **Waves** — per-wave YAML manifests defining steps, source files and jurisdiction scope (LATAM, Turkey and Hong Kong, National, and third-party Wave 1)

### Wave runner

The wave runner is the orchestrator. It reads a wave manifest, builds inputs from S3, then executes each step the manifest lists. Each step is an existing management command invoked programmatically, so each keeps its own reporting, dry-run default and revert capability.

### S3 integration

Source workbooks are stored in S3 rather than the repository. The preflight reads the wave's workbooks from S3 like every other command. S3 paths are resolved per wave and per environment.

### Rehearsal mechanism

Every commit run replays the full wave inside a database transaction that is rolled back at the end. This is not a dry run — every step executes for real, creating partners, policies and clauses, but nothing survives the rollback. Steps that would fail are collected so the operator sees all problems in one pass. The transaction is then committed step by step if the rehearsal passed.

This design means:

- A step's own dry run is not needed — the rehearsal covers cross-step dependencies (for example, the clone step finding holders the BP step created)
- Nothing scheduled to happen on commit (emails, rating calls) ever fires during rehearsal
- A step that fails is reported and the rehearsal continues

### Third-party policy builder

Third-party policies are built from scratch rather than cloned from an existing KN policy. The builder creates:

- Contract, policy, draft version and quotation on the product plan
- Steps 1 through 5 from the migration drop
- Empty lookup tables and base rater
- System rules from the standard Nacora rule set
- Quotation and certificate templates with no secondary logo

A reset option discards and rebuilds policies from previous runs. Live policies or those with shipments are never discarded.

### Clause book parsing

Each wave can carry its own clause book. Turkey and Hong Kong have per-policy clause books. National policies use a format where each row names its policy and charges are marked as fixed or conditional. The clause applier reads the book, matches clauses to policies and attaches them with the correct charge configuration.

### Change log

The changelog module tracks what changed between migration runs. It computes fingerprints and deltas between source and target states, resolves identity across runs, and produces comparison reports.

### Idempotency

Every step is safe to re-run. Completed records report as existing or unchanged. The wave runner supports resuming from a failed step with a start-at option. Each step commits independently so partial progress is preserved.

## Operational controls

- Jurisdiction scoping narrows a wave to a single country
- Activation runs the rating gate — a policy whose base rater prices nothing is refused
- Preflight checks validate source schemas before any step runs
- Rating readiness and rating repair tools verify and fix rate configurations
- Undo support allows reverting specific steps
- Bulk command audit traces every write for compliance

## Related concepts

- Clauses — clause books are parsed and attached during migration
- Rating Engine — base raters and rate categories are configured per migrated policy
- Special Rates — imported from wave source files per jurisdiction
- Business Rules Engine — activate and deactivate entries applied from the drop
- Billing — billing currency and cut-off settings carried from the migration drop
- Zurich E-Sign — migrated China policies with Zurich lead get certificate signing
