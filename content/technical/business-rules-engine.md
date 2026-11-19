# Business Rules Engine

## What it is

The business rules engine evaluates a set of declarative rules against a target object (typically a shipment / `PolicyVersionItem`, sometimes a policy) and produces a list of actions to take: refer to an underwriter, decline the risk, attach clauses, raise a floor, ask a question, or apply a maximum insurable limit.

It lives in `src/clients/nacora/i2go_rules/services.py`. Two service classes are load-bearing: **`RulesEvaluationService`** (evaluates all applicable rules for a target and dispatches actions) and **`MatchOnlyAuditEvaluationService`** (writes `RuleEvaluation` audit rows only for rules that matched — so the audit table doesn't drown in "did-not-match" noise).

The models live under `src/i2go_rules/` (shared platform code). Rule authoring is done via `/api/v1/i2go-rules/` and the Rules UI in the back-office SPA.

## Who owns it or touches it

- **Backend engineers** on the rules team own the service classes, action handlers, and the CEL expression integration.
- **Underwriters and BAs** author rules via the UI — the engine is a runtime-neutral evaluator; humans write the rules.
- **QA** verifies that shipping a rule change through DRAFT → ACTIVE actually alters engine behaviour in a controlled way.
- **SREs** monitor rule-match rates via the analytics stream (every matched rule emits a `rules_matched` fragment on the shipment event).

## How it works

### Model recap

| Model | Role |
|---|---|
| `Rule` | Named rule with `number` (`BR-{:06d}`), `slug`, `category`, `priority` (lower runs first), `condition_logic` (`ALL`/`ANY`), a GenericForeignKey (`content_type` + `object_id`) to the owning object (Policy, Product, or platform-global), `effective_date`, `status`, `meta_data` |
| `RuleCondition` | One condition row per rule. `attribute_display_name` + `operator` + `value` (JSON) + `ordering` |
| `RuleAction` | One action row per rule. `action_type`, `reason`, `parameters` (JSON) |
| `RuleEvaluation` | Audit row emitted only when the rule matched — `matched=True`, `result` (JSON of the action outcomes) |

Rules can carry multiple conditions and multiple actions. All conditions are combined per `condition_logic`. All actions of a matched rule fire.

### Evaluation order

`RulesEvaluationService.evaluate(target)` runs in two passes:

1. **Platform-first passes.** Rules with `category` in `('REFERRAL', 'SANCTIONS', 'VESSEL_REFERRAL', 'NO_APPLICABLE_RATES')` — the platform-set safety net. These always run before policy-custom rules, regardless of `priority`. This ordering means a global sanctions rule cannot be silently overridden by a policy-level rule.
2. **Policy-custom pass.** All remaining rules linked to the target's Policy (via the GenericForeignKey) or the Product, ordered by ascending `priority`. Lower `priority` numbers run first — the intent is that a rule authored at priority `10` runs before one at priority `20`.

Within each pass, every rule is evaluated independently — there is no short-circuit unless an action explicitly halts the pipeline (see below).

### Condition evaluation

`RuleCondition.operator` supports:

| Operator | Semantics |
|---|---|
| `equals`, `not_equals` | Direct equality against `value` |
| `contains`, `starts_with` | Substring on the resolved attribute |
| `in`, `not_in` | Membership against a list `value` |
| `lt`, `lte`, `gt`, `gte` | Numeric comparison |
| `within_distance` | Geo-radius (Haversine over lat/lon in `attributes.origin`/`destination`) |
| `CEL` | Common Expression Language — full expression evaluated against the target as context |

The `CEL` operator is the escape hatch: any arithmetic, boolean logic, or string transform is expressible without needing a new opcode. CEL evaluation is sandboxed and time-bounded (the engine rejects a CEL expression that takes more than a few ms to evaluate — accidental infinite loops fail closed).

`condition_logic = 'ALL'` requires every condition to match; `'ANY'` requires at least one.

### Action handlers

Each `action_type` has a handler wired in `RulesEvaluationService._handlers`. Table of shipped handlers:

| Action type | Handler behaviour | Effect on shipment |
|---|---|---|
| `REFERRAL` | Creates a `Referral` row with `status=OPEN`, `assigned_to` from `parameters.assignee_uuid` or falls back to the policy `agent`. Opens an `Activity` for the assignee's queue and dispatches the referral email via `send_templated_notification`. Sets shipment status to `REFERRED`. | Non-terminal — an underwriter must respond |
| `DECLINE` | Sets shipment status to `DECLINED` with the rule's `reason` captured. No further actions run for this shipment. | Terminal — pipeline halts |
| `SET_MIN_PREMIUM` | Stamps `pricing_breakdown.effective_min_premium` with `parameters.value` in `parameters.currency`. The rating engine takes the max of this and any SRR/base floor. | Modifies pricing |
| `SET_MAX_LIMIT` / `SET_MAX_INSURABLE_LIMIT` | Caps `sum_insured` at `parameters.value`; if the declaration exceeds the cap the engine either refers (if the rule sets `on_breach=REFER`) or declines | Blocks over-limit shipments |
| `ATTACH_CLAUSES` | Attaches each `Clause` UUID in `parameters.clauses` via `ClauseObjectRelation` to the shipment. Marked `is_special=True` when the clause is an override | Modifies documents |
| `QUESTIONS` | Enqueues additional questions (from `parameters.question_ids`) for the shipment declaration UI. Only affects the frontend flow — the engine records the requirement | Adds UI questions |

Each fired action produces a fragment in `RuleEvaluation.result` and on the shipment's `pricing_breakdown.rules_matched` list.

### `MatchOnlyAuditEvaluationService`

The engine can produce a very large number of non-matches — one per unmatched rule per shipment per evaluation. To keep the audit trail readable, `MatchOnlyAuditEvaluationService` is registered as the audit hook and writes a `RuleEvaluation` row **only when `matched=True`**. Non-matches produce no rows.

If a diagnostic is needed (e.g. "why did this rule not fire?"), the underlying evaluator exposes an `explain(target, rule)` method that returns the per-condition truth values — this is used by the Rules Debugger view under `/dashboard/nacora-admin/rules-debugger/`.

### Rule mode toggles

Two setting-level toggles gate the engine in production:

| Setting | Purpose |
|---|---|
| `RULES_ENGINE_ENABLED` | Master kill switch. False → engine returns "no rules matched" for every input, and shipments proceed on base rating alone |
| `RULES_ENGINE_MODE` | `EVALUATE_AND_APPLY` (default), `EVALUATE_ONLY` (audit-only, no actions), or `DRY_RUN` (evaluate + return actions but do not persist referrals or status changes) |

`EVALUATE_ONLY` is used during rule authoring in staging: authors can watch the audit trail fill up without any operational side-effect.

### Vessel referral — IMO-gated non-IACS check (SNAC-66)

The `VESSEL_REFERRAL` category includes a non-IACS classification society check. Previously, any sea shipment without a vessel from an IACS society was referred immediately — including quotes saved before the vessel was known.

The updated logic only triggers the non-IACS referral once the shipment names a vessel by IMO number. If the IMO number is blank or absent (a common state for early quotes), the non-IACS condition evaluates to false and the shipment is not prematurely referred. Once the vessel is added with an IMO number and the shipment is re-saved, the non-IACS check runs normally.

This prevents false referrals on quotes in progress where the vessel has not yet been nominated.

### Where evaluations are triggered

- Shipment save → `RulesEvaluationService.evaluate(shipment)` runs after the rating engine and before the response is returned.
- Bulk re-rate (`nacora.tasks.bulk_rerate_shipments`) → re-evaluates on each shipment.
- SOAP `BookShipment` handler → runs inline; a `DECLINE` becomes a SOAP fault; a `REFERRAL` returns status `REF`.
- Rules Debugger view → runs `evaluate(target)` with side-effects suppressed for the UI to display the outcome.

## Configuration & operational levers

| Key | Purpose |
|---|---|
| `RULE_NUMBERING_PATTERN` | Format of `Rule.number` (`BR-{:06d}`) |
| `RULES_ENGINE_ENABLED` | Master toggle |
| `RULES_ENGINE_MODE` | `EVALUATE_AND_APPLY` / `EVALUATE_ONLY` / `DRY_RUN` |
| `RULES_CEL_TIMEOUT_MS` | CEL evaluation timeout (fails closed) |
| `RULES_MAX_ACTIONS_PER_TARGET` | Safety cap on actions per evaluation |

Beat schedule note: no scheduled sweep. The engine is invoked on save and on explicit re-rate. If a rule change needs to be applied to already-active shipments, the operator calls `bulk_rerate_shipments` for the affected slice.

## Constraints, guarantees, and gotchas

- **Platform categories always win.** REFERRAL / SANCTIONS / VESSEL_REFERRAL / NO_APPLICABLE_RATES fire first; a policy-custom rule cannot pre-empt them by having a lower `priority` number.
- **Non-IACS referral requires an IMO number.** Sea shipments are only referred as non-IACS once the vessel is named by IMO. A quote saved before the vessel is known is not referred — this prevents false referrals on work-in-progress quotes.
- **DECLINE halts.** No further actions run once a `DECLINE` action fires. Ordering matters: a low-priority `DECLINE` will still stop everything after it in its pass.
- **Audit is match-only.** Absence of a `RuleEvaluation` row does not mean the rule wasn't evaluated — it means the rule didn't match. Use the Rules Debugger to see the "why not".
- **CEL is sandboxed and time-bounded.** A runaway expression will fail rather than hang the request.
- **Actions are non-transactional across side-effects.** A `REFERRAL` action writes a `Referral` row, opens an `Activity`, and sends an email. If the email dispatch (queued) fails later, the referral row remains — mail resend is a separate operation.
- **Rules are versioned via `Rule.status`.** DRAFT rules are never evaluated; only ACTIVE rules run. Archiving a rule stops it from running but keeps its history for audit.
- **`condition_logic = 'ANY'` short-circuits on the first true condition.** Ordering by `ordering` matters when conditions have side-effects like CEL — cheap conditions first.
- **The engine does not fire on read.** Listing shipments does not re-evaluate; only save-path operations do.

## Related concepts

- Rating Engine
- Data Model & Entities
- Event Stream & Audit Trail
- Service Override Pattern
- SOAP Inbound
- Cancellation & Endorsement
