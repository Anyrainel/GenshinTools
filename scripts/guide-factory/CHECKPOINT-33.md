# Checkpoint 33: standalone lower-investment Noelle slice

This checkpoint extends the generic three-valued numeric request vocabulary and
uses it in one bounded, source-local Noelle lower-investment experiment. The
slice authenticates three exact main-stat occurrences under the conjunction
`Noelle constellation <= 5` and `Noelle Burst Talent level == 9`, then evaluates
that conjunction against independently supplied C5 and Burst Talent 9 request
facts. It does not admit any occurrence to the current condition-binding
catalog.

## Generic numeric request vocabulary

The generic request-context and source-local predicate ASTs now include:

- `constellation-at-most`, whose result is unknown when the exact-team,
  exact-character constellation fact is omitted, true when the supplied value
  is at most the threshold, and false when it exceeds the threshold; and
- `talent-level-is`, whose result is unknown when the named Talent fact is
  omitted, true only when the supplied level equals the threshold, and false
  for another supplied level.

Constellation values and thresholds remain safe integers from C0 through C6.
Named Auto, Skill, and Burst Talent values and thresholds remain positive safe
integers. The existing three-valued `all` operator returns false when any child
is false, true only when every child is true, and unknown otherwise. Facts keep
their request provenance and exact team/character scope; constellation never
derives a Talent level.

## Exact source boundary

The wrapper is `src/noelleSourceLocalLowerInvestmentSlice.ts`, its assembler is
`src/assemble-noelle-source-local-lower-investment-slice.ts`, its slice ID is
`kqm-noelle-source-local-lower-investment-slice-luna-viii`, and its durable
report is `reports/noelle-source-local-lower-investment-slice.json`.

The authenticated source snapshot is
`data/source-snapshots/kqm-noelle-manual.json`, with file SHA-256
`d6927fed20fc0f77e8f721e18b7c9f8db37009258ba5c582b7184fb16be558e0`.
The exact guide record is
`kqm:character-guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii`. The
projection uses the exact source team
`kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii`, whose ordered
roster is Noelle, Durin, Nicole, and Xilonen. This is wrapper-owned cross-record
validation; the team does not source-author the guide condition or the
applicability join.

The durable report authenticates four raw input files and an exact 13-path
`generatedFrom` boundary. The source remains agent-assisted, unreviewed,
permission-unknown, and promotion-ineligible.

## Three selected occurrences

The slice selects exactly these main-stat condition occurrences:

| Slot | Exact occurrence | Preserved payload | Payload SHA-256 |
| --- | --- | --- | --- |
| Sands | `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.sands[0].conditions` | ATK% | `917185549050e86abe934fa610c2763e532ea9d6ca54682a8656efd9f8c6dc24` |
| Goblet | `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.goblet[0].conditions` | Geo DMG Bonus | `27b0565556c4d4cb4abe6c800046b0e1269484e769b15ce91ec7581ec6e9026a` |
| Circlet | `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.circlet[0].conditions` | CRIT Rate / CRIT DMG | `d227c8c1fb0defbc9cfba9365cea3a70d5ae13927f0f1438188c48dd5e437603` |

All three retain the exact source condition:

`Noelle is C0–C5 and her Burst Talent is Level 9.`

Its ordered condition-array SHA-256 is
`6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436`.
The source predicate remains one unresolved `investment-threshold` leaf with
SHA-256
`a700f51166e436253a9943351cc4255141d6ebaf083273fc0bacf8fda0b85a8a`.
The three payloads remain independent source claims; the slice does not combine
them into an equipment build.

## Exact request overlay

Only the request overlay evaluates the wrapper-owned predicate:

```text
all(
  Noelle constellation <= 5,
  Noelle Burst Talent level == 9
)
```

Its SHA-256 is
`a5b526ea3852b0e661f06a96c1bcec5062af2bc2580bffc0b1677a7a0546c868`.
The positive context supplies C5 and Burst Talent 9 as two independent request
facts scoped to the exact team and Noelle subject. Both leaves are true, so all
three source-unresolved cells become `applicable-under-supplied-context` and
effectively matched. Source Talent evaluation remains false, and no Talent
level is inferred from constellation.

## Holdout and empty-array closure

The exact Noelle boundary contains 16 condition arrays: 15 nonempty and one
empty. Three nonempty occurrences are selected, 12 nonempty occurrences are
holdouts, and the one unconditional Husk occurrence remains empty. No substat
occurrence is selected. All 12 holdouts and the empty occurrence are
unconsumed and receive no slice-authored binding or energy classification.

The selected occurrences are typed and not energy-deferred only inside this
standalone report. That occurrence-scoped classification does not compute an ER
requirement and does not enter current catalog or manual-coverage evidence.

## Catalog, report, and regeneration boundaries

Checkpoint 33 adds the thirty-first durable report. The current checkpoint 32
catalog and coverage remain exactly:

- catalog 60 = 57 typed + 3 acknowledged;
- full nonempty coverage 57 typed + 3 acknowledged + 66 unbound;
- non-structural coverage 57 typed + 3 acknowledged + 63 unbound;
- unique non-structural arrays 33 typed-only + 52 unbound-only + 1 mixed;
- energy 15 deferred + 54 not-energy-deferred + 57 nonempty unclassified +
  16 empty;
- display status 54 typed + 54 known-but-unbound + 15 ER-deferred + 3
  acknowledged + 16 unconditional; and
- seven catalog wrapper families across 18 source files and 70 generated-from
  paths.

The three lower-investment occurrences therefore remain catalog-unbound and
energy-unclassified. Seven existing durable reports are regenerated only for
authenticated hash/dependency refreshes after the generic predicate vocabulary
changes: Itto request-context applicability; the Klee, Diona, Kokomi, and high-
investment Noelle source-local slices; manual coverage; and the Klee witness.
The checkpoint 32 catalog's `generatedFrom` pin changes, but its entries,
ledgers, and capabilities do not. The checkpoint 27 Klee witness also retains
its four claims, exact positive fixture, Overload negative control, and zero
consumption of 11 Klee holdouts.

Run the affected chain from the repository root:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-itto-request-context-applicability.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-source-local-condition-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-diona-source-local-support-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-kokomi-source-local-artifact-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-noelle-source-local-high-investment-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-noelle-source-local-lower-investment-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-team-scoped-claim-join-witness.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
```

The completed verification passed TypeScript, 62 test files with 461 tests,
and validation with 0 errors and 12 existing warnings.

## What this checkpoint does not establish

This slice creates zero candidates, equipment assignments, optimizations, and
assembled builds. It performs no artifact or substat choice, recommendation
composition, team or build composition, ranking, generator or optimizer
execution, formula, damage, rotation, DPS, stat allocation, ideal-roll, or ER
calculation. It does not authorize or human-review the source, validate the
preserved payloads as optimal, or create a player-facing guide.

## Next non-ER checkpoint

The next gate should separately consider catalog admission for only these three
exact lower-investment occurrences. That admission is not implemented by
checkpoint 33. ER remains deferred.
