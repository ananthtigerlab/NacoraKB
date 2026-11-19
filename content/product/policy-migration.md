# Policy Migration

Policy migration is the framework that onboards third-party and country-specific policies into Nacora from external source files. It runs in waves, each covering a jurisdiction or group of countries, reading configuration workbooks from S3 and building fully functional policies without cloning from existing ones.

## Who uses it and where

Administrators and the product operations team trigger migration waves from the command line. The framework reads source workbooks from S3 and writes policies, clauses, rates, business rules and partner records into the back office at nacora-bo.i2go.io.

## How it works

### Wave structure

Each migration wave covers a jurisdiction or group of countries. Three waves have been run so far:

- Wave 1 (LATAM) — Nacora Chile and Latin American policies
- Wave 2 (Turkey and Hong Kong) — policies with their own clause books
- Wave 3 (National) — nine National policies with per-row clause books and fixed or conditional charges

A wave is defined by a manifest that lists the steps to execute and the source files to read.

### Running a wave

1. The operator names the wave and optionally a jurisdiction to narrow scope (for example, Spain alone).
2. The system reads the wave's workbooks from S3 — migration drop, clause book, business rules file, special rate sheets.
3. A rehearsal runs by default. Every step executes inside a single transaction that is rolled back at the end. Nothing is written, nothing is emailed, nothing is rated. Problems from every step are collected in one pass.
4. If the rehearsal passes, the operator runs the wave with commit. Steps execute and commit one by one. If a step fails, the run stops and can be resumed from that step.
5. An optional activation step at the end runs each built policy through the rating gate. A policy whose base rater prices nothing is refused.

### What each step does

- **Build** — reads the drop from S3 and assembles the workbooks each later step needs
- **Business partners** — creates or updates holders, brokers, insurers and surveyor groups from the drop
- **Policies** — builds each third-party policy from scratch (contract, policy, draft version, quotation on the product plan, Steps 1 through 5 from the drop, empty lookup tables and base rater, system rules, certificate template). Nothing comes from an existing policy.
- **Clauses** — reads the wave's clause book. Turkey and Hong Kong have per-policy clause books. National policies name their policies on every row and carry fixed or conditional charges.
- **Business rules** — reads the drop's Business Rules file and applies activate or deactivate entries per policy
- **Rating** — links commodity groups to their rate categories, sets up the base rater and special rates
- **Creators** — assigns policy creators from the drop
- **Activation** — runs the rating gate and activates ready policies

### Rehearsal before write

Every commit run replays the whole wave inside a rolled-back transaction before writing anything. If the tenth step would refuse its arguments, the operator sees that before any earlier steps have committed. The rehearsal can be skipped with a flag, but activation is never rehearsed.

### Reset

The reset option discards policies a previous run built and rebuilds them. A live policy or one with shipments is never discarded.

## Business rules and calculations

- Each third-party policy is built from scratch, not cloned from an existing KN policy
- A wave can be narrowed to a single jurisdiction so only that country's policies and their dependencies are processed
- Steps are idempotent. Re-running a completed step reports records as existing or unchanged.
- S3 source files are read once per wave. The drop's billing currency, cut-off dates, insured-value currencies and backdating tolerance carry onto built policies.
- Special rates are imported per wave (BE, DE, IT, PT, ES in CGMIGR-10)
- If a named assured names its broker as a specific entity the Product Owner has excluded, that assured is left out of the wave

## Related concepts

- Clauses — clause books are the source for each policy's clause set during migration
- Rating — base raters and rate categories are configured per migrated policy
- Special Rates — imported from wave source files for each jurisdiction
- Business Rules — activate and deactivate entries applied from the drop's rules file
- Business Partners — holders, brokers, insurers created as part of the wave
