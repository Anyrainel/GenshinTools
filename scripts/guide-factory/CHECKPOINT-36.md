# Checkpoint 36: authenticated four-character equipment candidate lattice

This checkpoint completes the first generic, non-ER equipment-candidate
lattice and one exact source-specific wrapper for the published
Keqing/Ineffa/Furina/Xilonen Lunar-Charged roster. It proves that a bounded
team-wide weapon/artifact product can be enumerated while retaining source
scope and provenance. It does not evaluate, rank, recommend, or validate any
whole candidate.

## Nine-input authentication boundary

The source-specific wrapper authenticates exactly nine direct inputs:

- the consolidated knowledge repository;
- the raw KQM Keqing snapshot;
- the GenshinTools preset snapshot;
- the manual-snapshot index;
- the source registry;
- the live AllCharacterBuilds preset JSON;
- the existing Keqing Lunar equipment-evidence report; and
- the weapon- and artifact-choice search-coverage reports.

The exact KQM team remains equipment-null and contains Keqing, Ineffa, Furina,
and Xilonen in source order. All four request investments are C0. Keqing's
three four-star weapon inputs are supplied at R5; the three preset-backed
characters' weapon inputs are supplied at R1. Refinements are request inputs,
not newly attributed source facts.

The wrapper reauthenticates raw-KQM/repository parity, preset-snapshot/
repository/live-preset parity, the five participating KQM equipment-evidence
claims, the exact team projection, and all 20 participating weapon/artifact
coverage observations. Generic enumeration is not called unless this entire
source-specific boundary closes.

## Exact inventory and finite product

The authenticated inventory contains nine source groups or lists and 20
occurrences:

- 14 active experiment-axis occurrences;
- four preset-build scope holdouts;
- one Xilonen C6 build withheld by the C0 request; and
- one Furina ER-derived `er-20 + er-20` artifact-choice holdout.

Only equipment identity is projected. Main-stat and substat weights, including
ER Sands or ER substat mentions on otherwise active preset builds, are not
consumed.

The eight ordered axes are:

```text
Keqing   3 weapons x 2 artifacts
Ineffa   1 weapon  x 1 artifact
Furina   3 weapons x 2 artifacts
Xilonen  1 weapon  x 1 artifact
```

Their exact bounded product is
`(3 x 2) x (1 x 1) x (3 x 2) x (1 x 1) = 36` nodes. Every node contains eight
selection references, for 288 references total. The generic core validates the
complete Cartesian product, deterministic identity binding, axis membership,
and the declared maximum before exposing the lattice. The core was added in
commit `3e6982a1`.

## Ordering, conditions, and authorship

KQM ranked-group order, the Lion's Roar/Black Sword tie, the Wolf-Fang
alternative, the two conditional Keqing artifact alternatives, and all preset
list positions are retained exactly. `sourceLocalRank` remains `null`: the
source supplies group order but no numeric rank value, so the wrapper does not
invent one. Furina's preset weapon indexes are list positions, not ranks.

The exact roster structurally satisfies the Lunar-Charged roster condition.
The R5 request map structurally satisfies the equal-refinement condition. A
named request assumption structurally satisfies the top-Lunar-Charged-
contributor/non-CRIT-set condition for this experiment. None of those
structural resolutions validates gameplay applicability.

Sources back the roster, active member-axis occurrences, and their local
groups/lists. They do not author a character's weapon/artifact pairing, any
cross-character composition, or a whole team-equipment candidate. All 36
whole candidates are wrapper-authored, zero are source-published, and
applicability remains unknown. The source warning that Xilonen generally
cannot activate Scroll for Hydro in this setup remains provenance-bound.

## Disabled capabilities and integration

This checkpoint executes candidate enumeration only. Team or equipment
recommendations, optimality, numeric or global rank, candidate evaluation,
candidate generation, optimization, damage calculation, gameplay validation,
guide production, promotion, and ER requirements all remain false.

The durable report is globally integrated and rebuilt by `validate.ts`. It is
the thirty-third durable report overall and raises the globally integrated set
from 31 to 32; checkpoint 35's permission-isolated ArtifactRatingDB report
remains outside the global runner.

## Verification

The completed boundary passes Guide Factory TypeScript, 65 test files with 554
tests, global validation with 0 errors and 12 existing warnings, application
TypeScript, and dependency-boundary validation.

## Next non-ER checkpoint

Checkpoint 37 may materialize the 36 nodes into isolated technical team-build
inputs and run a fail-closed preflight against existing computation modules.
That materialization/preflight is not implemented. It must not infer source
authorship, applicability, ranking, optimality, or ER requirements from the
enumerated lattice.

