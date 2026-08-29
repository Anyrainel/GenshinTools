# Generated Reports

Local validation, comparison, and computation reports belong here. They are
ignored by default because the report format is experimental. A report should
be committed only when it becomes durable review evidence.

Current durable pilot evidence:

- `knowledge-corpus-inventory.json` describes explicit record, evidence-field,
  source, and character presence across the consolidated repository. It emits
  no quality score, source vote, average, recommendation, or rank. ER guidance
  remains visible only in kind/status totals while ER is deferred.
- `team-template-coverage.json` compares external templates and exact manual
  teams with exact baseline rosters. It emits present, uncovered, or explicitly
  role-unresolved results and no quality score, rank, or winner. The current
  result has 3 present, 1 role-unresolved, and 2 uncovered templates, plus 1
  present and 5 uncovered exact external teams. Keqing Lunar-Charged is
  uncovered because the baseline lacks the required Keqing–Ineffa core; its
  off-field-Hydro and resistance-shred roles are not weakened into element
  matches.
- `furina-neuvillette-formula-plan-draft.json` exposes 12 positive and 6
  zero-count calculator-default formulas for a roster supported by both KQM and
  the baseline. It also translates KQM's sample rotation, reports five
  token-supported count mismatches, and preserves six unresolved mappings. Its
  status is `needs-domain-review`; it does not support guide claims.
- `keqing-ineffa-formula-plan-draft.json` materializes an external exact team
  with explicit baseline weapon/build selections, then exposes 13 positive and
  5 zero-count calculator defaults. Its source translation contains 11 exact
  claims, 10 complete mappings, 1 partial mapping, and no ranges. Furina's
  footnote relocates one exact Skill cast rather than making it optional. Its
  readiness ledger classifies all 18 formulas as 11 mapped, 5 unresolved, 2
  source-absent, and 0 unclassified; 8 blockers leave the report not considered
  ready for damage replay. The assessment is advisory and is not enforced by
  `replayTeamDamage`. It is a fixture rather than an equipment recommendation
  or full rotation damage result. Its status is `needs-domain-review`; it does
  not support guide claims or authorize a replay.

- `kqm-diona-comparison.json` compares nine source assertions with exact
  baseline fields and deliberately emits no aggregate winner or merged order.
- `kqm-diona-er-calibration.json` preserves the raw and formatted source values,
  complete engine input hashes and scenario, and two numerical probe results.
  Its status remains `assumption-incomplete` until source RNG, enemy-particle,
  duration, and Favonius-cooldown assumptions are comparable.

`validate.ts` rebuilds all six reports in memory and rejects stale checked-in
output. The Diona ER report is historical and deliberately decoupled from
unrelated knowledge-repository changes while ER work is deferred.
