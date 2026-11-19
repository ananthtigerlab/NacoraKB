# Rating Engine

## What it is

The rating engine is the service pipeline that turns a shipment declaration into a priced quote. It lives in `src/clients/nacora/ratings/services.py` and is composed of two collaborating classes: **`ShipmentRatingResponseService`** (public entry point — called by the shipment CRUD view, the SOAP `BookShipment` handler, and the bulk re-rate task) and **`ShipmentRatingPayloadService`** (assembles the lookup key from a `PolicyVersionItem` and its parent `PolicyVersion`).

Everything that gets stamped onto `PolicyVersionItem.pricing_breakdown` — base rate, adjusted rate, cargo premium, charges by level, total premium, FX-converted amounts, min-premium floor — is produced here. The engine is the single source of pricing truth; downstream code (certificate PDF, BMS bordereau emit, event stream) reads the persisted breakdown rather than recomputing.

## Who owns it or touches it

- **Backend engineers** on the rating team — own the service classes, their tests, and the base-rater client.
- **Underwriters** — indirectly, via `SpecialRateRequest` rows they approve. The engine sees SRR combinations as override data, not as user actions.
- **BAs** validating quotes against manual spreadsheets during onboarding.
- **SREs** debugging a pricing mismatch reported against a specific certificate number.

## How it works

### End-to-end call sequence

An incoming rate request follows these stages (called from `PolicyVersionItemViewSet.rate` and from `nacora.api.v1.soap.handlers.BookShipment`):

1. **Payload assembly.** `ShipmentRatingPayloadService.build(shipment)` reads the shipment's `attributes` JSON and the parent `PolicyVersion.attributes`, and produces a lookup dict:
   - `commodity_group` (Nacora `Choices.key`, e.g. `general_merchandise`)
   - `packing` (`Choices.key`, e.g. `containerised`)
   - `conveyance` (`Choices.key`, e.g. `sea`)
   - `coverage` (`Choices.key`, e.g. `icc_a`)
   - `departure_country`, `destination_country` (ISO-3166)
   - `sum_insured`, `sum_insured_currency`
   - `voyage_dates`, `named_assured`, `participant_company_id`
2. **Commodity-group rate-category resolution.** Before the base-rater lookup, the engine reads the policy's commodity table. If the policy defines its own commodity list, the shipment's commodity is resolved against the policy's entries. The engine then looks up the rate category the policy assigns to that commodity group. If a commodity group has no rate category linked, the shipment is referred with a reason naming the unlinked group — it is never priced at zero.
3. **Base-rater lookup.** The engine calls the policy's Base Rater catalogue (external service, product-scoped) with the six-tuple key and receives:
   - `base_rate` (percentage or fixed)
   - `min_premium` (currency-scoped floor)
   - `return_type` (`PERCENTAGE` / `FIXED` / `RATE`)
   - Any base clauses that must attach.
   Rates accept up to three decimal places only. The conveyance dimension is added to the lookup key when the policy prices by conveyance (for example, merged tariffs where Air/Sea and Road/Rail have separate rate columns).
3. **SRR override.** The engine queries `RiskFactorCombinations` where `special_rate_request__policy = shipment.policy`, `status = 'ACTIVE'`, `is_active = True`, and `key_signature = <hash of key_values>`. If a row matches:
   - `special_rate` replaces `base_rate` (subject to `return_type`).
   - `min_premium` replaces the base floor if higher.
   - `special_condition` text is captured on the breakdown.
   - Any `ClauseObjectRelation` rows attached to the combination are queued for attachment.
   - Latest-active wins if multiple rows share the same `key_signature` (deactivated rows are ignored).
4. **Business-rule evaluation.** `RulesEvaluationService.evaluate(shipment)` runs — see Business Rules Engine. A `SET_MIN_PREMIUM` action can bump the floor above the SRR value. A `REFERRAL` or `DECLINE` short-circuits the pricing and returns the shipment in the corresponding status without a completed breakdown.
5. **Cargo premium computation.**
   - Percentage return: `cargo_premium = sum_insured * effective_rate`.
   - Fixed return: `cargo_premium = fixed_amount`.
   - Rate return: `cargo_premium = insured_value * rate_per_unit`.
   - `cargo_premium = max(cargo_premium, effective_min_premium)`.
6. **Charges application.** Load factors (`LoadFactor`) and tax/policy-level charges apply in a defined order: cargo premium → policy-level percentage charges → policy-level fixed charges → tax → grand total. Every charge is captured line-by-line in `pricing_breakdown.charges`.
7. **FX conversion.** If billing currency ≠ base currency (`NACORA_ANALYTICS_SETTINGS['BASE_CURRENCY'] = 'EUR'`), the engine converts via the **USD pivot**: `amount_billing → USD → base`. Both hops use yesterday's `ExchangeRate` row (`submodules.currencies`). A direct billing→base rate is not used even when it exists — the two-hop USD pivot is the single, auditable path so all analytics tie.
8. **Persistence.** `pricing_breakdown` is written to `PolicyVersionItem.pricing_breakdown` inside the request transaction. The shipment's status transitions per business-rule outcome (QUOTED, REFERRED, DECLINED).

### `pricing_breakdown` shape

The persisted JSON on `PolicyVersionItem` is the audit trail of every intermediate figure. Approximate shape:

```
{
  "base_rate":                { "value": 0.15, "return_type": "PERCENTAGE" },
  "adjusted_rate":            { "value": 0.12, "source": "SRR", "srr_reference": "SRR-2026-0042" },
  "effective_min_premium":    { "value": 250.00, "currency": "USD", "source": "SRR" },
  "cargo_premium":            { "value": 480.00, "currency": "USD" },
  "charges": [
    { "level": "policy",   "type": "percentage", "code": "admin_fee", "value": 24.00 },
    { "level": "policy",   "type": "fixed",      "code": "issuance", "value": 5.00 },
    { "level": "tax",      "type": "percentage", "code": "vat",       "value": 50.90 }
  ],
  "total_premium":            { "billing": { "amount": 559.90, "currency": "USD" },
                                "base":    { "amount": 519.10, "currency": "EUR", "fx_pivot": "USD" } },
  "fx": { "billing_to_usd": 1.0000, "usd_to_base": 0.9272, "as_of": "2026-07-03" },
  "clauses": [ { "clause_id": "...", "source": "SRR" } ],
  "rules_matched": [ { "rule_number": "BR-000019", "action": "SET_MIN_PREMIUM", "value": 250.00 } ]
}
```

### Testing patterns

The engine is unit-tested end-to-end against fixture policies. The two most important patterns:

- **Golden-path fixtures.** `src/clients/nacora/tests/ratings/fixtures/` holds JSON `PolicyVersion` and `Choices` snapshots. Each fixture drives `ShipmentRatingResponseService.rate(shipment)` and asserts on the produced `pricing_breakdown` — this keeps regression coverage for the exact numbers, not just the shape.
- **Base-rater stubbing.** The external catalogue is stubbed via a fake `BaseRaterClient` injected into the service. Tests never touch a real external URL. Nacora tests set `settings.NACORA_BASE_RATER_STUB = True` and register canned responses per `(product, key_signature)`.
- **SRR precedence tests.** For each `return_type`, tests assert that an active SRR row overrides the base value and that deactivating it (via `is_active=False`) reverts to base.
- **FX pivot tests.** Fixture currencies exercise EUR → USD → BASE and BASE → USD → EUR paths; a missing `ExchangeRate` row must produce `null` in the base-currency figure — never a silent 1:1 fallback.
- **Bulk re-rate.** `nacora.tasks.bulk_rerate_shipments` is exercised against a batch of 100 shipments to assert idempotence: re-running the task produces the same `pricing_breakdown` values and updates `updated_at` only.

## Configuration & operational levers

| Key | Layer | Purpose |
|---|---|---|
| `NACORA_ANALYTICS_SETTINGS['BASE_CURRENCY']` | Nacora settings | Base currency for cross-currency analytics (`EUR`) |
| `NACORA_SPECIAL_RATE_ENABLED` | Nacora settings | Master flag for SRR-based override — off means base rate only |
| `EXCHANGE_RATE_API_PROVIDER` | Base settings | Provider identifier for FX pulls (`CurrencyAPI.com`) |
| `CURRENCY_API_KEY` | Env var | CurrencyAPI.com API key |
| `POLICY_NUMBERING_PATTERN` | Nacora settings | Referenced when the engine stamps quote/certificate numbers |
| `SPECIAL_RATE_INACTIVE_DAYS` | Nacora settings | Days after which an ACTIVE SRR row auto-archives |
| `SHIPMENT_QUOTE_EXPIRY_DAYS` | Nacora settings | Days a quoted shipment stays valid |
| `NACORA_BASE_RATER_STUB` | Test settings | Enable stubbed base-rater responses in unit tests |

Operational commands:

- `python src/manage.py update_usd_exchange_rates` — force-refresh FX rates (daily cron via Celery Beat is the normal source).
- `nacora.tasks.bulk_rerate_shipments` — batch re-rate a set of shipments against a specific rating version. The Bulk Re-rate screen endorses by default with documents and email.
- `python src/manage.py rerate_nacora_shipments` — re-rate named shipments from the command line. Accepts one or comma-separated shipment numbers. Quoted shipments are re-priced in place; Booked and Endorsed shipments are endorsed into a new version. Flags: `--commit` to execute (dry run by default), `--documents` to regenerate certificates, `--notify` to email the updated certificate, `--endorse` to endorse a booked shipment into a new version. A shipment that billing has already invoiced is never re-priced in place — an endorsement bills the difference instead.
- `python src/manage.py audit_nacora_commodity_groups` — reports which commodity groups are linked/unlinked across policies and lists shipments that found no rate.
- `python src/manage.py link_nacora_commodity_groups` — links commodity groups to rate categories. `--seed-rate-categories` stores the defaults; `--activate` switches a group back on once it is linked on every policy. Dry run unless told otherwise.

## Constraints, guarantees, and gotchas

- **The engine is stateless.** It takes a `PolicyVersionItem` instance and reads the DB; it never caches intermediate results across calls. Concurrent rate requests on the same shipment are serialised by DB transaction — the last commit wins.
- **Latest-active SRR wins.** If two `RiskFactorCombinations` rows share the same `key_signature` under the same SRR, only the row with `is_active=True` is considered; deactivate before creating a replacement.
- **Business-rule floors override SRR floors.** A `SET_MIN_PREMIUM` action set by a policy custom rule stacks on top of the SRR min-premium — the engine takes the higher of the two.
- **FX pivot via USD is mandatory.** Direct-pair rates are never trusted for base-currency reporting; USD is the single pivot so all analytics tie. If yesterday's USD rate is missing for either hop, the base-currency figures are `null` rather than silently 1:1.
- **Zero-premium bookings are rejected at the SOAP layer.** If the engine returns a $0 total after all overrides, the SOAP handler raises a fault — silent zero-premium bookings never persist. REST callers still see the `pricing_breakdown`, but the front-end blocks confirmation. The Bulk Re-rate also rejects zero-premium outcomes rather than endorsing at zero.
- **Commodity group rate-category enforcement.** A commodity group cannot be activated on a policy without a rate category linked. The rating engine reads the policy's commodity table, then the group's rate category. If the group has no category, the shipment is referred with the reason, not priced at zero. A no-rate referral cannot be approved without a rate or cargo premium — both the UI and the API enforce this.
- **Per-policy commodity lists.** Policies can define their own commodity list (distinct from the deployment-wide Choices). When present, the engine resolves the shipment's commodity against the policy's own entries. Migrated policies (LATAM, Turkey, Hong Kong, National) commonly use this.
- **Re-rate of invoiced shipments.** A shipment that billing has already invoiced is never re-priced in place. The old breakdown is kept in `rerate_history` and an endorsement bills the difference. This prevents billing from billing a record twice.
- **The base-rater catalogue is external.** A base-rater outage returns an error to the caller — there is no in-DB fallback catalogue. Nacora's SRE runbook covers restarting the base-rater client and, if needed, disabling `NACORA_SPECIAL_RATE_ENABLED` to force base-only pricing while the rater recovers.
- **`ATOMIC_REQUESTS = True` applies.** A partial pricing write is impossible; either the whole breakdown persists or none of it does.
- **Numbering is engine-adjacent, not engine-owned.** Shipment numbers come from `ShipmentNumberingService`, not from the rating engine. See Numbering.

## Related concepts

- Business Rules Engine
- Data Model & Entities
- Choices, Lookups & Code Maps
- Numbering
- SOAP Inbound
- Background Jobs & Celery
