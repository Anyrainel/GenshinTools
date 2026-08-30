# Checkpoint 45: authenticated Xiao non-ER equipment branch source slice

This checkpoint expands the Xiao evidence repository before attempting another
composition. It authenticates thirteen source observations from three Version
5.5 KQM character-guide records: five-star weapons, four-star weapons, and
offensive artifact stats. It does not join those observations to FFXX or to the
checkpoint-44 partial candidate.

The output is a source-only branch inventory, not a Xiao guide. It retains
thirteen source recommendation observations but emits no Guide Factory
candidate, build, equipment assignment, recommendation, winner, damage result,
formula result, rotation, stat-weight vector, ideal-roll allocation, or Energy
Recharge result.

## Preserved weapon semantics

The five-star source record contains three ranked groups with tied membership:

1. Primordial Jade Winged-Spear, Staff of Homa, and Lumidouce Elegy;
2. Vortex Vanquisher and Calamity Queller; and
3. Staff of the Scarlet Sands, Engulfing Lightning, and Skyward Spine.

Only the first two groups are source-condition-free. The third retains its
owned-and-best-available guard and its source classification. Group order is
preserved, but members inside a group remain tied.

The six four-star rows remain explicitly unranked. Their array positions are
source provenance only and must not become ordinal ranks. Deathmatch is the
only source-condition-free four-star row. Lithic Spear, Prospector's Drill,
Blackcliff Pole, Favonius Lance, and Missive Windspear retain their exact
guards. The Favonius row preserves its stated Refinement 3 floor while leaving
the floor unevaluated and every energy implication deferred.

The report establishes no ordering between a five-star group and a four-star
option. In particular, it does not place Deathmatch after five-star rank group
2 or before rank group 3.

## Preserved stat semantics

The artifact-stat record contributes:

- one source-condition-free ATK% Sands group;
- one guarded Circlet choice group containing CRIT Rate and CRIT DMG;
- priority 1 CRIT Rate / CRIT DMG with the source's at-least-70% CRIT Rate and
  near-1:2 target; and
- priority 2 ATK%.

The Circlet condition requires weapon and artifact stats that are not supplied
to this source slice, so neither Circlet is selected. The two substat rows share
one exact guard but retain distinct priorities and payload identities. They are
only the offensive tail after the source's omitted Energy Recharge need, so
they are not promoted into a complete substat priority plan.

## Exact boundary

The slice contains 13 occurrences across 3 source records:

- 9 weapon groups containing 14 unique weapon IDs;
- 3 ranked five-star tied groups containing 8 weapons;
- 6 unranked four-star single options containing 6 weapons;
- 2 main-stat groups containing 3 stat leaves; and
- 2 substat priority groups containing 3 stat leaves.

Four occurrences are source-condition-free and nine retain nonempty guards.
The nine guarded occurrences contain eight unique condition arrays because the
two substat priorities share the same guard. The immediately condition-free
weapon domain is three groups and six leaves: the first two five-star groups
plus Deathmatch. Those counts are not candidates, rankings, votes, or
compatibility results.

The report byte-authenticates the exact eighteen declared inputs. Five JSON
inputs also require parsed-object parity: the consolidated repository, Xiao
manual snapshot, manual index, source registry, and checkpoint-42 durable
report. The closure includes the path resolver used by the CLI to select those
files. It fresh-authenticates checkpoint 42 through its complete eleven-path
boundary before projecting nine former holdout rows and four empty-condition
rows. Their checkpoint-42 dispositions remain historical facts; this slice
does not retroactively add condition bindings to checkpoint 42.

Checkpoint 43's request fact, checkpoint 44's partial candidate, the separate
formula-count witness, rotations, and ER inputs are outside the closure. Any
raw byte, parsed object, upstream report, record membership, source order,
tied-group membership, unranked marker, classification, condition, stat
choice, priority, target, count, or disabled capability drift makes the report
non-comparable and emits no source branch rows.

The durable report is
`xiao-non-er-equipment-branch-source-slice.json`. It is 44,129 bytes with
SHA-256
`97e1b1fc63979d684d7cbb227d3ed1ae440e325e9b5df880b6c3a7b3ce017b51`.

The completed checkpoint passes:

- 13 focused deterministic and adversarial tests;
- 92 Guide Factory test files with 879 passed tests and 2 skipped tests;
- Guide Factory TypeScript;
- offline validation with 0 errors and the 12 existing corpus weapon-type
  warnings while historical Diona/ER regeneration is deferred;
- application TypeScript; and
- dependency-boundary validation.

## Next non-ER boundary

The next checkpoint may compose only the authenticated source-condition-free
domain with the checkpoint-44 partial candidate. It must preserve five-star
rank groups, four-star unranked status, and the lack of a cross-rarity order.
Guarded weapons, Circlet selection, and the incomplete offensive substat tail
must remain visibly unresolved unless a later experiment supplies and
authenticates the exact facts needed to evaluate them.
