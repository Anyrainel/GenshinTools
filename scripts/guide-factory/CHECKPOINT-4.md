# Checkpoint 4: Source-Backed Equipment Fixture

Date: 2026-08-29

This checkpoint still is not a guide factory. It composes an uncovered external
exact team with explicit baseline character-guide selections and learns what
the current formula-count comparison cannot yet represent. It does not compute
full rotation damage, rank equipment, or modify production data.

## Materializing a fixture across knowledge layers

The new `sourceBackedEquipmentScenario` seam requires:

- one external exact team;
- one explicit baseline or accepted character-guide record for every member;
- one build ID from each selected guide record;
- one weapon present in each selected guide's explicit `weaponOrder`.

It validates the exact team-member/guide association, baseline or accepted
guide status, weapon presence and unique order position in that guide, and
build presence. It also refuses to overwrite equipment already present on the
external team. The materializer does not itself validate weapon-type
compatibility or team suitability. Its output is a deterministic calculator
fixture, not a recommendation. It copies no artifact stat sheet, refinement,
or ER target, and it does not assert that character-wide baseline advice is
appropriate for the external team.

The first fixture uses the external Keqing, Ineffa, Furina, Xilonen example and
these explicit selections:

| Character | Weapon | Baseline build | Artifact choice |
| --- | --- | --- | --- |
| Keqing | Mistsplitter Reforged | `1WswsAu` | 4pc Thundering Fury |
| Ineffa | Fractured Halo | `FeFiQU8` | 4pc Aubade of Morningstar and Moon |
| Furina | Splendor of Tranquil Waters | `BQAI0BO` | 4pc Golden Troupe |
| Xilonen | Peak Patrol Song | `Dbt0Wkm` | 4pc Scroll of the Hero of Cinder City |

The calculation fixture then adds explicit level 90, C0, R1, 10/10/10 talents
and calculator-default combat options. These are experiment assumptions, not
claims found in the KQM team record.

## Formula-count result

`reports/keqing-ineffa-formula-plan-draft.json` exposes 13 positive-count and 5
available zero-count calculator defaults. Its manual source translation contains
11 formula count claims, all exact:

- 10 mappings cover their source tokens completely;
- the Keqing Charged Attack mapping covers its source tokens only partially.

Furina's Skill count is exactly one. The source footnote relocates the
parenthesized opening Skill beside Furina's Burst on subsequent rotations; it
does not make the cast optional. The generic comparator can represent ranges,
but only when a source count is genuinely optional. This translation contains
zero range claims.

Six direct counts disagree with calculator defaults:

- Keqing Charged Attack, Skill slash, and Stiletto;
- Xilonen Skill rush, N2 sequence, and Burst.

Keqing's Charged Attack mapping is marked partial. The source notation contains
eight `N1C` sequences, but the C0 calculator catalog has a Charged Attack formula
and no corresponding N1 formula. Counting eight Charged Attacks therefore does
not pretend to cover the eight Normal hits.

Six source mappings remain unresolved rather than receiving guessed values:

- the 8 unsupported Keqing N1 hits;
- Ineffa's 10-discharge aggregate;
- Furina's 32-hit Salon aggregate;
- Lunar-Charged ownership and counts for Ineffa, Keqing, and Furina.

Five of those unresolved cases name available calculator formulas; the Keqing
N1 source token has no formula. The report remains `needs-domain-review`, does
not support guide claims, and is not promotion-eligible.

## Advisory damage-replay readiness assessment

The report classifies every available formula and every source mapping to show
whether this formula-plan draft should be considered ready for a damage replay:

- all 18 available formulas: 11 mapped, 5 unresolved, 2 explicitly
  source-absent, and 0 unclassified;
- 13 positive calculator defaults: 10 mapped, 3 unresolved, and 0 unclassified;
- source mapping: 11 exact claims, 0 ranges, 10 complete mappings, and 1
  partial mapping.

Eight blockers keep `readyForDamageReplay` false: the unreviewed translation,
one partial mapping, five unresolved formula mappings, and one unresolved
source token. Complete classification is useful audit evidence, but this is an
advisory report-level assessment. `replayTeamDamage` does not consume or enforce
it. This checkpoint does not produce or authorize a replay or publication of
rotation damage. A wrapper that enforces readiness before calling the replay
seam remains possible future work.

## What the experiment changed

The useful result is a model correction, not a team verdict. A scalar formula
count alone was insufficient for an action whose calculator mapping covered
only part of the notation. The generic comparison format now records explicit
complete-versus-partial token coverage. It also supports bounded count ranges
for genuinely optional source counts, although this translation uses none.

This still does not establish action order, duration, buff-window coverage,
reaction ownership, aggregate-hit timing, executable rotation damage, or
equipment suitability. Calculator-default combat options are recorded rather
than presented as source-backed behavior.

## Validation and boundaries

`validate.ts` now rebuilds six durable reports in memory and rejects stale
checked-in output:

1. corpus inventory;
2. team-template coverage;
3. Furina/Neuvillette formula-count draft;
4. Keqing/Ineffa formula-count draft;
5. Diona comparison;
6. historical Diona ER calibration.

All work remains under `scripts/guide-factory`; application and Worker bundles
do not import it. ER work remains deferred, and no new ER target or solver
behavior was added.

## Next evidence gates

1. Review the six direct discrepancies and the partial Keqing mapping.
2. Decide how to represent Keqing's unsupported N1 hits and the two baked
   aggregate formulas without inventing timing or hit counts.
3. Establish reaction ownership/count assumptions before using any
   Lunar-Charged formula.
4. Add an explicitly authored artifact stat sheet only after the formula plan
   is reviewable.
5. Replay the resulting selected loadout through both calculator paths before
   comparing a weapon, artifact set, or stat allocation.

None of these outputs may modify production presets without a separate review
and acceptance step.
