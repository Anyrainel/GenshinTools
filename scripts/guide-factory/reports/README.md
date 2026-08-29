# Generated Reports

Local validation, comparison, and computation reports belong here. They are
ignored by default because the report format is experimental. A report should
be committed only when it becomes durable review evidence.

Current durable pilot evidence:

- `kqm-diona-comparison.json` compares nine source assertions with exact
  baseline fields and deliberately emits no aggregate winner or merged order.
- `kqm-diona-er-calibration.json` preserves the raw and formatted source values,
  complete engine input hashes and scenario, and two numerical probe results.
  Its status remains `assumption-incomplete` until source RNG, enemy-particle,
  duration, and Favonius-cooldown assumptions are comparable.

`validate.ts` rebuilds both reports in memory and rejects stale checked-in
output.
