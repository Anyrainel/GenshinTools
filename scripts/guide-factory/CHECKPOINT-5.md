# Checkpoint 5: Artifact-Choice Search Coverage

Date: 2026-08-29

This checkpoint still is not a guide factory. It tests a prerequisite for
artifact ranking: whether the existing analyzer can represent artifact choices
that are already present in the consolidated knowledge repository. It does not
generate artifact stats, compute damage, rank sets, or modify production data.

## Measured search grammar

The audit calls the analyzer's existing exported candidate builders rather than
reimplementing their policy:

- `buildArtifactSetChoiceCandidates()` supplies the initial four-piece choices;
- `buildTwoPieceArtifactChoiceCandidates(statPools.substat)` supplies the
  largest two-piece grammar discoverable from every legal substat.

With the released catalog, the first builder returns 43 unique four-piece set
keys. The beta-only Glacier and Snowfield set is excluded and causes the report
to fail if it leaks into released candidates.

The maximum dynamic grammar contains 14 unique two-piece pair keys. This is an
upper bound, not a guarantee that a real analyzer run reaches all 14. Runtime
discovery happens after successful initial four-piece evaluations and uses only
the positive generated substats from those evaluations.

## Repository coverage result

The report classifies every artifact-choice field on current non-rejected
character-guide and team records without merging or deduplicating source
claims:

| Repository slice | Total | Initial 4pc | Conditional 2pc | Not representable |
| --- | ---: | ---: | ---: | ---: |
| Guide builds | 188 | 167 | 14 | 7 |
| Team-member selected artifacts | 840 | 820 | 7 | 13 |
| Guide and team-member recommendations | 18 | 16 | 0 | 2 |
| All eligible occurrences | 1,046 | 1,003 | 21 | 22 |

Every occurrence retains provenance and its applicable context. Build
visibility, minimum constellation, roles, and styles remain attached.
Recommendations retain status, source references, grouping, conditions,
constellation bounds, and team-member context. Team selections retain their
team and member context. Rejected records are intentionally excluded.

## Concrete gaps

Eighteen occurrences use Instructor, which the analyzer excludes through its
five-star-only initial-set filter. These include:

- baseline Aino, Gorou, Klee, Nilou, and Xilonen builds;
- KQM's Diona character-guide recommendation;
- KQM's Bennett team-member recommendation in the C6 Diona forward-Melt team.

The other 11 Instructor occurrences are selected artifacts on baseline team
members. Two selected artifacts on candidate legacy teams use The Exile, which
is excluded by the same five-star filter.

Two baseline two-piece choices are also outside dynamic discovery:

- hidden Freminet build `Apmx9Du`: Cryo DMG plus Skill DMG;
- C6 Yelan build `7TUW-dG`: Hydro DMG plus Hydro DMG.

These 22 cases are not representable by the current analyzer search grammar.
That is not a verdict about whether the source advice is correct or whether a
choice can be configured manually. Conversely, representable choices are not
proven suitable, competitive, generatable, or damage-optimal.

## Fail-closed behavior

The report distinguishes beta-only artifacts, missing runtime entities,
non-five-star and tier-list filters, missing or unmapped half-set families,
repeated half-sets without two distinct released five-star sets, and unexpected
candidate-builder omissions. Synthetic tests cover the presently reachable
failure classes, while zero-count categories remain explicit in the report.

The output contains no score, rank, winner, damage result, energy target, or
guide recommendation. Its `supportsGuideClaims` flag is false.

## Validation and boundaries

`validate.ts` hashes the knowledge repository, artifact catalogs, analyzer
implementation, and related data modules. It rebuilds the report in memory and
rejects stale checked-in output. The deterministic tests also require unique
observation IDs, stable ordering, mutation-free input handling, exact current
coverage counts, and preserved recommendation context.

All new files remain under `scripts/guide-factory`. No application source file
was changed, and no website or Worker module imports the report or audit code.
ER work remains deferred.

## Next evidence gates

1. Add a narrow structured-source pilot with explicit provenance and licensing
   boundaries, then measure its incremental team, rotation, and equipment
   coverage before accepting any records.
2. Decide whether non-five-star support sets belong in the artifact analyzer's
   candidate policy or require a separate support-oriented search mode.
3. Decide how damage-oriented and repeated elemental two-piece families should
   enter the search without exploding the candidate space.
4. For one reviewed fixture, run the real artifact-generation path and record
   which nominally representable candidates fail or depend on earlier results.
5. Do not rank artifact choices until a reviewed formula plan, combat context,
   and authored stat allocation make the comparison interpretable.

None of these outputs may modify production presets without a separate review
and acceptance step.
