# Checkpoint 32: exact Noelle catalog admission

This checkpoint admits only checkpoint 31's three already authenticated Noelle
high-investment main-stat occurrences into the current condition-binding
catalog. It adds no source claim, durable report, parser, recommendation, or
computation. Admission succeeds only after the Noelle-specific path
authenticates the exact durable/current slice pair and its selected, holdout,
empty, numeric-request, and disabled-capability boundaries.

## Source-specific admission before normalization

The source wrapper remains
`src/noelleSourceLocalHighInvestmentSlice.ts`, with slice ID
`kqm-noelle-source-local-high-investment-slice-luna-viii` and durable report
`reports/noelle-source-local-high-investment-slice.json`. The admitted source
snapshot is `data/source-snapshots/kqm-noelle-manual.json`, with SHA-256
`d6927fed20fc0f77e8f721e18b7c9f8db37009258ba5c582b7184fb16be558e0`.
The source remains agent-assisted, unreviewed, permission-unknown, and
promotion-ineligible; catalog admission is not source promotion.

The catalog requires the durable report to equal a fresh canonical rebuild.
The Noelle extractor then rechecks the exact page and version, raw records,
source registry, repository parity, guide and team records, subject, selected
and excluded occurrence sets, source and request predicates, payloads,
recommendation metadata, request projection, and disabled capabilities before
producing any entry.

Only after every source-specific assertion passes may the private
`buildSourceLocalCatalogEntry` helper:

1. cross-link one selected occurrence to exactly one source claim;
2. cross-link it to exactly one condition control;
3. verify their repeated selected/claim/control parity; and
4. construct one occurrence-scoped catalog entry.

The helper is not a generic source wrapper, extractor, schema adapter,
condition parser, or prose interpreter. It cannot select a Noelle occurrence,
authorize the source, weaken a pinned literal, or admit a holdout.

## Exact admitted occurrences

The exact guide record is
`kqm:character-guide:noelle-c6-or-talent-10-artifact-stats-luna-viii`. The
request projection remains scoped to
`kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii`, whose ordered
roster is Noelle, Durin, Nicole, and Xilonen.

The catalog admits exactly these three independent main-stat occurrences:

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
The wrapper-owned request predicate remains
`any(Noelle constellation >= 6, Noelle Burst Talent level >= 10)`, with SHA-256
`b93bfd12ebefae9aaae8434d4d316315a78fe6081698a73dd0ee047bcbbbc596`.

The durable request context supplies Noelle C6 and omits her Burst Talent
level. Each source cell remains source-unresolved, while the constellation
branch is true, the Burst branch remains unknown, and each request projection
is applicable and effectively matched. The source evaluator retains
`talentLevelsEvaluated: false`; constellation does not derive a Talent level.

The shared recommendation metadata remains source index 0, ID
`c6-or-talent-10-artifact-stats`, label `C6 or Burst Talent Level 10+ artifact
stats`, scope `artifact-stats`, role `dps`, and null ordering, classification,
and grouping. The three payloads remain independent; catalog admission does not
assemble a DEF%/Geo%/CRIT build.

Each catalog row uses the generic evidence kinds
`source-local-typed-predicate-ast` and
`source-local-not-energy-deferred` while retaining the exact Noelle `sliceId`,
selected-occurrence hash, predicate hash, payload hash, and condition-control
hash. Generic evidence kinds do not make Noelle extraction generic.

## Twelve holdouts and one empty occurrence remain excluded

The Noelle-specific path names and rechecks all checkpoint 31 exclusions:

| Excluded occurrence | Condition-array SHA-256 |
| --- | --- |
| `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.circlet[0].conditions` | `6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436` |
| `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.goblet[0].conditions` | `6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436` |
| `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.sands[0].conditions` | `6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436` |
| `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[0].conditions` | `25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675` |
| `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[1].conditions` | `25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675` |
| `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[2].conditions` | `25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675` |
| `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.circlet[1].conditions` | `7444217b95d562ae6cffb22b51e7c6ef6da6891851967415925d6713c254e2c6` |
| `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.goblet[1].conditions` | `778b1c674223e02b4b58c3903c6ac809f5bab52e2c216e93003320fd1657f748` |
| `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[0].conditions` | `2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d` |
| `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[1].conditions` | `2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d` |
| `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[2].conditions` | `2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d` |
| `kqm:character_guide:noelle-hexerei-gest-luna-viii:recommendation.weaponRecommendations[0].conditions` | `f27375a8ce8833cc0326a17c94f52c71ed4f44a72868e15d087390b864e490cf` |
| `kqm:character_guide:noelle-general-husk-luna-viii:recommendation.artifactRecommendations[0].conditions` (empty) | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` |

The 12 nonempty holdouts and one empty occurrence remain exact, disjoint from
the selected set, unconsumed, and unauthored for binding or energy by the slice.
No identical wording elsewhere is admitted by implication.

## Catalog and coverage result

Checkpoint 32 produces the expected three-occurrence delta:

| Ledger | Current result |
| --- | --- |
| Catalog | 60 = 57 typed + 3 acknowledged |
| Full nonempty binding coverage | 126 = 57 typed + 3 acknowledged + 66 unbound |
| Non-structural binding coverage | 123 = 57 typed + 3 acknowledged + 63 unbound |
| Unique non-structural ordered arrays | 33 typed-only + 52 unbound-only + 1 mixed |
| Energy | 15 deferred + 54 not-energy-deferred + 57 nonempty unclassified + 16 empty |
| Display status | 54 typed + 54 known-but-unbound + 15 ER-deferred + 3 acknowledged + 16 unconditional |

Three selected occurrences share one exact ordered condition array, so the
unique-array partition moves only one set from unbound-only to typed-only.
Binding and energy remain independent. `typed-bound` does not establish source
truth, account suitability, or stat correctness. `not-energy-deferred` is
occurrence-scoped and computes no ER floor, adequacy result, or rotation.

## Authentication and regeneration order

Manual condition coverage now authenticates seven wrapper families. Its raw
boundary contains 18 source files, and its exact generated-from boundary
contains 70 paths. Dependency direction remains one-way:

```text
authenticated Noelle raw inputs
             |
             v
authenticated Noelle durable/current report pair
             |
             v
        60-entry catalog
             |
             v
regenerated manual condition coverage
             |
             v
regenerated checkpoint 27 Klee claim-join witness
```

The Klee witness changes only its authenticated manual-coverage dependency. Its
four Klee claims, positive Klee/Furina/Albedo/Xilonen fixture, Overload negative
control, zero consumption of 11 Klee holdouts, and prohibited interpretations
remain unchanged.

Checkpoint 32 adds no durable report, so `validate.ts` still authenticates 30
reports. It rejects stale Noelle evidence, numeric request-projection drift,
partial or conflicting selected evidence, holdout or empty-row admission,
catalog drift, the wrong wrapper/source/generated-from closure, stale manual
coverage, or a stale Klee witness.

Run the authenticated dependency chain from the repository root:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-noelle-source-local-high-investment-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-team-scoped-claim-join-witness.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
```

The completed verification passed TypeScript, 61 test files with 449 tests,
and validation with 0 errors and 12 existing warnings.

## What this checkpoint does not establish

This admission executes no artifact assignment, alternative selection,
recommendation composition, build or candidate construction, ranking,
generator, optimizer, formula, rotation, damage, DPS, stat allocation, ideal-
roll, or ER work. It provides no source authorization, human review,
publication approval, gameplay-performance claim, or player-facing guide.

## Next non-ER checkpoint

The next bounded experiment should be a separate standalone slice for Noelle's
lower-investment branch. It is not implemented yet. ER remains deferred.
