# Numbering

## What it is

The generator behind every human-readable identifier in the system: policy numbers (`MC-000123`), business rule numbers (`BR-000019`), clause numbers (`CLAUSE-000031`), shipment / certificate numbers (`MC-000123-000001`), and any other kind-scoped sequence.

The mechanism is `submodules.numbering` — a `NumberingMixin` on the model, backed by a small `Numbering` counter table keyed by kind. Nacora adds `ShipmentNumberingService` for the tricky case of shipment numbering that must remain continuous across PolicyVersion boundaries (renewal, endorsement, cancellation).

This is the Technical view. The Product-space `numbering.md` describes the human-facing formats and what business events increment which counter.

## Who owns it or touches it

- **Backend engineers** writing a new model that needs a sequenced identifier.
- **BAs** verifying that the formats match business expectations (product-space page).
- **Support / QA** tracing a certificate number back to the shipment during an incident.

## How it works

### `NumberingMixin` pattern

Models that need a sequenced number inherit `submodules.numbering.NumberingMixin`. The mixin exposes:

```
class NumberingMixin:
    def _generate_number(self, kind, context=None, pattern=None):
        """
        Atomically increments the counter for `kind` and returns a formatted string.
        `context` optionally scopes the counter (e.g. per-policy shipment counter).
        `pattern` overrides the default format string.
        """
```

Under the hood, `_generate_number`:

1. Locks the `numbering.models.Numbering` row for `(kind, context_key)` via `SELECT ... FOR UPDATE`.
2. Reads `current_value`, increments by 1, writes back.
3. Formats the new value against the pattern (`MC-{number:06d}`) and returns the string.

The lock guarantees no two concurrent transactions produce the same number, even under contention.

### The `Numbering` counter table

```
class Numbering(models.Model):
    kind          = models.CharField(max_length=64)          # 'policy', 'rule', 'clause', 'shipment:<policy_uuid>', ...
    context_key   = models.CharField(max_length=128, null=True, blank=True)
    current_value = models.BigIntegerField(default=0)

    class Meta:
        unique_together = [('kind', 'context_key')]
```

- **Kind** is a string identifying the sequence family (`policy`, `rule`, `clause`).
- **Context key** scopes the counter — used for shipment numbering per-policy: `kind='shipment'`, `context_key=<policy_uuid>`.
- Every counter is guaranteed monotonic and gap-free within a kind+context.

### Format strings — where they live

Format patterns live in settings so they can be tuned per client without touching the model:

| Setting | Default | Applies to |
|---|---|---|
| `POLICY_NUMBERING_PATTERN` | `MC-{number:06d}` | `Policy.number` |
| `RULE_NUMBERING_PATTERN` | `BR-{number:06d}` | `Rule.number` |
| `CLAUSE_NUMBERING_PATTERN` | `CLAUSE-{number:06d}` | `Clause.number` |
| `SHIPMENT_NUMBERING_PATTERN` | `{policy_number}-{number:06d}` | Shipment (`PolicyVersionItem.number`) |
| `QUOTATION_NUMBERING_PATTERN` | `QUO-{number:06d}` | Quotations |
| `BORDEREAU_NUMBERING_PATTERN` | `BDX-{year}-{number:04d}` | Bordereaux |

Changing a pattern applies only to newly-generated numbers. Existing rows keep their historical format — the string is written to the field, not re-derived at read time.

### `ShipmentNumberingService` — cross-version continuity

Shipment numbers must be continuous across the versions of a policy. That is, the certificate numbers on a Renewal or MTA version continue the sequence from where the previous version left off — a policy that had shipments 001–042 on its New Business version and gets an MTA continues at 043 on the MTA version, not restart at 001.

The trick is that a new `PolicyVersion` inherits the counter state. This lives on the `PolicyVersion.extra_data` JSON:

```
policy_version.extra_data = {
  ...
  'shipment_latest_number': 42,
  ...
}
```

`ShipmentNumberingService.next(policy_version)`:

1. Reads `policy_version.extra_data['shipment_latest_number']` (defaulting to `0`).
2. Increments by 1.
3. Formats `{policy_number}-{number:06d}` (e.g. `MC-000123-000043`).
4. Writes back `shipment_latest_number = 43` on `PolicyVersion.extra_data`.

Persistence uses a `SELECT ... FOR UPDATE` on the `PolicyVersion` row, held for the duration of the transaction — combined with `ATOMIC_REQUESTS = True`, this serialises concurrent bookings on the same version.

**On PolicyVersion creation** (via endorsement, renewal, cancellation), the new version inherits `shipment_latest_number` from its parent:

```
new_version.extra_data['shipment_latest_number'] = parent.extra_data.get('shipment_latest_number', 0)
```

This inheritance is the cross-version continuity guarantee.

### Thread-safety

Two mechanisms combine:

1. **DB unique constraint** on `PolicyVersionItem.number` (per-policy). Even if the increment logic misbehaved, the DB would reject a duplicate.
2. **`SELECT ... FOR UPDATE` on the counter row.** Ensures only one transaction reads-and-writes at a time.

Under load, contention on the counter row can become a bottleneck; the mitigation is that shipment counters are per-policy, so contention is bounded by concurrent bookings on the same policy — usually low.

### Migration between formats

To change a format going forward:

- Update the pattern in Nacora settings.
- New numbers use the new format immediately.
- Existing rows are not backfilled — the historical numbers remain as-is.

A retro-format migration (rare) would be a `RunPython` data migration that re-formats existing values — not currently used.

### Related services

- **Referrals, Activities, Notes** — sequenced only via UUID; no human-readable number.
- **Bordereaux** — use `NumberingMixin` with year in the context key so counters reset annually.

## Configuration & operational levers

| Setting | Purpose |
|---|---|
| `POLICY_NUMBERING_PATTERN` | Policy `number` format |
| `RULE_NUMBERING_PATTERN` | Rule number format |
| `CLAUSE_NUMBERING_PATTERN` | Clause number format |
| `SHIPMENT_NUMBERING_PATTERN` | Shipment / certificate number format |
| `QUOTATION_NUMBERING_PATTERN` | Quotation number format |
| `BORDEREAU_NUMBERING_PATTERN` | Bordereau number format |
| `CUSTOM_NUMBERING_SERVICE` | Registers non-default numbering services (e.g. `ShipmentNumberingService`) |

Operational commands:

- `python src/manage.py shell` — inspect `Numbering.objects.filter(kind='...')` to check counter state.
- No standard reset command — resetting a counter is a manual operation and should never be needed in prod.

## Constraints, guarantees, and gotchas

- **Numbers are monotonic and gap-free within (kind, context).** A rolled-back transaction still consumes a counter value — the increment happens before commit, and a rollback frees the value only if no other transaction has already taken the next. In practice, gaps do happen and are considered acceptable.
- **Never create a `PolicyVersion` via raw SQL.** The `shipment_latest_number` inheritance is done in Python; a raw insert bypasses it and breaks cross-version continuity.
- **Never write a hand-picked number into a numbered field.** All fields flow through `NumberingMixin._generate_number()`. Hand-writing risks a collision with the DB unique constraint.
- **The counter row is contended on hot policies.** If a single policy handles a very high booking rate, `SELECT ... FOR UPDATE` becomes a serialisation point. In practice Nacora's throughput is far below this — mentioned for awareness.
- **Format changes don't backfill.** Changing `SHIPMENT_NUMBERING_PATTERN` affects only new shipments; existing certificate numbers stay in their historical format.
- **Cancellation and endorsement inherit correctly.** A new `PolicyVersion` for cancellation or endorsement inherits the parent's `shipment_latest_number` — shipments added post-endorsement continue the sequence.
- **Renewal creates a new counter conceptually, but Nacora treats it as continuation.** The new PolicyVersion inherits — renewal shipments continue the previous year's sequence. This is a Nacora decision; other clients might want a reset.
- **Bordereau counters reset annually via the `{year}` in the context key.** No manual intervention required on Jan 1.

## Related concepts

- Data Model & Entities
- Cancellation & Endorsement
- Rating Engine
- SOAP Inbound
- Service Override Pattern
- Migrations & Seed Commands
