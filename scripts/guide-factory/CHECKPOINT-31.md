# Checkpoint 31: standalone Noelle numeric request context

This checkpoint authenticates one bounded, source-local Noelle high-investment
slice. It preserves three exact main-stat occurrences from the KQM Noelle Luna
VIII guide, projects them over one exact source team, and tests their shared
numeric condition against an independently supplied C6 request fact. It does
not promote the occurrences into the current condition-binding catalog.

## Exact source boundary

The wrapper is `src/noelleSourceLocalHighInvestmentSlice.ts`, its slice ID is
`kqm-noelle-source-local-high-investment-slice-luna-viii`, and its durable
report is `reports/noelle-source-local-high-investment-slice.json`.

The authenticated source snapshot is
`data/source-snapshots/kqm-noelle-manual.json`, with file SHA-256
`d6927fed20fc0f77e8f721e18b7c9f8db37009258ba5c582b7184fb16be558e0`.
The source guide record is
`kqm:character-guide:noelle-c6-or-talent-10-artifact-stats-luna-viii`.
The projection team is the exact source record
`kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii`, whose ordered
roster is Noelle, Durin, Nicole, and Xilonen.

The wrapper-owned cross-record join is not KQM-authored merely because the
guide record and team record share one source document.

## Three selected occurrences

The slice selects exactly these main-stat condition occurrences:

| Slot | Exact occurrence | Preserved payload | Payload SHA-256 |
| --- | --- | --- | --- |
| Sands | `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.sands[0].conditions` | DEF% | `804a06075305e59b97c800d1a8ba0fdfff51f9f5cbe37862d3f574721b38d53e` |
| Goblet | `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.goblet[0].conditions` | Geo DMG Bonus | `27b0565556c4d4cb4abe6c800046b0e1269484e769b15ce91ec7581ec6e9026a` |
| Circlet | `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.circlet[0].conditions` | CRIT Rate / CRIT DMG | `d227c8c1fb0defbc9cfba9365cea3a70d5ae13927f0f1438188c48dd5e437603` |

All three retain the exact source condition:

`Noelle is C6 or her Burst Talent is Level 10 or higher.`

Its ordered condition-array SHA-256 is
`92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4`.
The source predicate remains one unresolved `investment-threshold` leaf with
SHA-256
`a700f51166e436253a9943351cc4255141d6ebaf083273fc0bacf8fda0b85a8a`.
The three payloads remain independent source claims. This checkpoint does not
assemble them into one equipment build.

## Numeric request overlay

Only the request overlay evaluates the source-specific typed predicate:

```text
any(
  Noelle constellation >= 6,
  Noelle Burst Talent level >= 10
)
```

Its predicate SHA-256 is
`b93bfd12ebefae9aaae8434d4d316315a78fe6081698a73dd0ee047bcbbbc596`.
Constellation and Talent levels are independent request facts scoped to the
exact team and Noelle subject. They are not verified account investment, and
constellation never derives a Talent level. The source-only evaluator retains
`talentLevelsEvaluated: false`.

The durable fixture supplies Noelle C6 and omits her Burst Talent level. The
constellation branch is true, the Burst branch remains unknown, and the `any`
predicate is true. All three source cells therefore move from source-unresolved
to `applicable-under-supplied-context`, producing an effective partition of
three matched, zero inapplicable, and zero unresolved cells.

The generic request evaluator also preserves exact three-valued behavior for
the two independent branches: one below-threshold fact with the other omitted
remains unknown; both supplied below threshold are false; and either supplied
fact meeting its threshold is true. No source prose is parsed to obtain these
rules; the wrapper owns the exact hash-pinned mapping.

## Holdout and empty-array closure

The Noelle source boundary contains 16 condition arrays: 15 nonempty and one
empty. Three nonempty occurrences are selected, 12 nonempty occurrences are
holdouts, and the one unconditional Husk occurrence remains empty. The 12
holdouts and the empty occurrence are unconsumed and receive no slice-authored
binding or energy classification.

The selected occurrences are classified inside this standalone slice as typed
and not energy-deferred. That classification is occurrence-scoped validation
evidence only. It neither computes an ER requirement nor changes the current
catalog or manual-coverage ledgers.

## Catalog and report boundaries

Checkpoint 31 adds one durable report, bringing the validator total to 30. It
does not add a current catalog wrapper or entry. The checkpoint 30 ledgers
therefore remain exactly:

- catalog 57 = 54 typed + 3 acknowledged;
- non-structural coverage 54 typed + 3 acknowledged + 66 unbound;
- unique non-structural arrays 32 typed-only + 53 unbound-only + 1 mixed;
- energy 15 deferred + 51 not-energy-deferred + 60 nonempty unclassified +
  16 empty; and
- six catalog wrapper families across 17 source files and 67 generated-from
  paths.

The shared numeric request-context vocabulary changes the authenticated bytes
of existing Itto, Klee, Diona, and Kokomi request/source-local reports. Those
reports, manual coverage, and the downstream Klee witness are regenerated in
dependency order, but their established gameplay semantics and counts do not
change.

## Regeneration and verification

Run the affected chain from the repository root:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-itto-source-conditioned-guide-packets.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-itto-request-context-applicability.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-source-local-condition-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-diona-source-local-support-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-kokomi-source-local-artifact-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-noelle-source-local-high-investment-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-team-scoped-claim-join-witness.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
```

The completed verification passed TypeScript, 61 test files with 446 tests,
and validation with 0 errors and 12 warnings.

## What this checkpoint does not establish

This slice creates zero candidates, equipment assignments, optimizations, and
assembled builds. It performs no artifact choice, recommendation composition,
team composition, ranking, generator or optimizer execution, formula, damage,
rotation, DPS, ideal-roll, or ER calculation. It does not authorize the source,
establish account ownership, validate the preserved stat payloads as optimal,
or create a player-facing guide.

## Next non-ER gates

The next gate should separately consider catalog admission for only these three
exact authenticated Noelle occurrences. If that admission succeeds, a later
standalone experiment should model the lower-investment Noelle branch. Neither
gate is implemented by checkpoint 31. ER remains deferred.
