# Checkpoint 11: Bounded Joint Artifact-Stat Experiment

## Status

This checkpoint runs and exhausts one deliberately tiny offline composition
table. It is a measurement of the existing generator and replay seams, not a
working guide factory and not evidence that the selected objective describes
real play.

Everything remains under `scripts/guide-factory`. No application, Worker,
production preset, or distributed-bundle path imports this work. ER remains
deferred.

## Question under test

Checkpoint 10 showed that the existing greedy generator can return different
artifact outputs when only its algorithmic `carryCharId` changes. The next
bounded question was therefore empirical:

> If every carry-derived character sheet is retained, can compatible sheets be
> recombined and evaluated jointly inside each current artifact-set node, and
> how does that finite reference compare with intact generator outputs and
> cached search policies?

This question does not ask which build is correct, which artifact set should be
recommended, or what the team's real damage is.

## Fixed but unreviewed fixture

The four-character fixture remains Keqing, Ineffa, Furina, and Xilonen at level
90, C0, R1, and 10/10/10. It uses the same independently recorded baseline
weapons/build evidence and the same four released 5-star set nodes:

| Node | Ineffa | Furina | Keqing / Xilonen |
| --- | --- | --- | --- |
| `01-seed-aubade-golden` | Aubade | Golden Troupe | Thundering Fury / Scroll |
| `02-aubade-tenacity` | Aubade | Tenacity | Thundering Fury / Scroll |
| `03-silken-golden` | Silken Moon | Golden Troupe | Thundering Fury / Scroll |
| `04-silken-tenacity` | Silken Moon | Tenacity | Thundering Fury / Scroll |

No source binds any complete equipment row in this table to the exact external
team. Each character build is independently recorded. Instructor remains
outside this experiment because the released search policy rejected that
negative-control node before generator invocation in checkpoint 9.

The technical objective contains the 11 exact-valued source count claims from
the Keqing/Ineffa formula report. `exact-valued` describes the shape of those
claims, not their correctness. The translation remains agent-authored,
unreviewed, partial for Keqing's N1C token coverage, and blocked by the same
unresolved formula and source-token mappings. The experiment report carries
the lines and a fingerprint while stating that the core establishes no source
binding.

The fixture wrapper records the formula-draft fixture ID, exact source team and
`sample-rotation` IDs, derivation from 11 exact authored-translation
comparisons, 10 complete and 1 partial token mappings, and all 8 readiness
blockers. The blocker codes cover one unreviewed translation, one partial token
mapping, five unresolved formula mappings, and one unresolved source token.
This provenance explains where the technical lines came from without promoting
them to reviewed rotation evidence.

## Sixteen generator calls

Every node is run once with each team member supplied as `carryCharId`, for 16
accepted generator calls. Calls are sequential, the maximum observed
concurrency is one, and every invocation receives a fresh `TeamBuild`.

The generator receives:

- enemy level 110 and enemy resistance 0.1;
- roll multiplier 0.85 and the `8_6` substat budget;
- no ER threshold or `perChar` constraint;
- no explicit buff override, set-key override, or ignored-set fallback; and
- no warm start, because `runGenerator` resets rather than accepts a sheet
  seed.

The complete generated artifacts are retained only as SHA-256 fingerprints.
The final per-character `StatSheet` objects are canonicalized from sorted
`dump()` entries so future fields cannot be silently reconstructed from the
smaller structural summaries.

## Node-local exhaustive recombination

Sheets are deduplicated per character and per set node. They are never pooled
across nodes. The observed pools and exhaustive Cartesian counts are:

| Node | Keqing | Ineffa | Furina | Xilonen | Compositions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Aubade / Golden | 2 | 1 | 2 | 2 | 8 |
| Aubade / Tenacity | 2 | 2 | 2 | 2 | 16 |
| Silken / Golden | 2 | 1 | 2 | 2 | 8 |
| Silken / Tenacity | 2 | 2 | 2 | 2 | 16 |

All 48 expected compositions are observed. Each intact four-character carry
output is also located in its node-local Cartesian table, so comparison with
the recombined reference does not silently omit a generator endpoint.

## Replay boundary

Every composition is replayed through the interpreted and compiled calculator
paths with the same configs, combat context, and unreviewed technical formula
lines. All 48 cells pass the calculator-agreement tolerance.

No explicit formula buff override is supplied. The replay engine separately
computes formula-line overrides from the configs and formula lines; the current
map contains zero entries in every successful cell. The report retains that
fact as a count and a hash. It must not be shortened to “no buffs”: character,
weapon, artifact, and team implementations can still contribute effects
outside that computed override map.

The durable report retains the numerical technical objective because the
purpose of this checkpoint is to compare search behavior. It labels the value
`unreviewedTechnicalObjective` and sets all guide, artifact-recommendation,
game-performance, and global-optimality support flags to false.

## Observed bounded-reference behavior

The maximum node-local recombination exceeds the strongest intact carry
composition by:

- about 0.1191% in both Golden Troupe nodes; and
- about 0.4090% in both Tenacity nodes.

These are improvements only inside carry-derived sheet pools under the fixed,
unreviewed objective. They do not establish a useful in-game improvement or a
preferred artifact set.

The outer nodes form two exact objective equivalence classes: Aubade/Golden is
equal to Silken/Golden, and Aubade/Tenacity is equal to Silken/Tenacity. The two
Tenacity nodes share the global bounded-reference objective. The report keeps
both references. Aubade/Tenacity is serialized as the deterministic
first-candidate representative only; it is not a unique best or winner.

Changing only the cached Ineffa-set coordinate has an exact zero objective
delta on both outer edges. Changing only the cached Furina-set coordinate has
the same positive objective delta on both outer edges. The report calls this
technical-objective sensitivity, not an artifact effect. Zero sensitivity may
expose objective blindness or implementation invariance; it cannot establish
that Aubade and Silken Moon are interchangeable or suitable, and the positive
edge cannot establish causal game performance.

## Cached policy traces

Policy functions consume only the evaluated four-node table and make zero
generator or evaluator calls.

Deterministic best-improvement coordinate descent starts at Aubade/Golden,
moves to Aubade/Tenacity, and stops because its Silken/Tenacity neighbor is an
exact tie rather than a strict improvement. The terminal node is therefore a
representative of the two-node reference class. The serialized terminal reason
is `no-strictly-improving-comparable-neighbor`, and it exposes
Silken/Tenacity in `equivalentNeighborNodeIds` with `plateauObserved: true`. A
separate synthetic 2x2 test
with values `10, 9, 9, 12` proves that the same coordinate policy can stop at a
local value and miss a pair-only improvement.

The width-one, depth-two beam is recorded only as a coverage trace. It is
explicitly `not-calibrated` and `exhaustive: false`. It happens to visit all
four cached nodes in this fixture while pruning one first-depth branch, which
does not imply exhaustive behavior on another lattice or justify a beam width.

## Failure contract

A generator or capture failure makes the affected node not comparable and
skips its Cartesian evaluation. A replay failure preserves the failed cell but
makes its node not comparable. If any one of the four nodes is not comparable:

- the cross-node bounded reference is `null`;
- no surviving node is ranked against it; and
- both cached policy traces are withheld.

The reusable cached-table reference selector independently fails closed with a
`withheld` result when any declared table node is a cached failure; it does not
select among only the surviving nodes. Coordinate descent uses a distinct
`neighborhood-incomparable` terminal when a failed neighbor prevents a clean
local conclusion.

The CLI summary reports generator/capture, node-configuration, and replay
failure counts separately. A focused joint-experiment test injects a replay
failure and verifies that the node, outer reference, and global comparison
become not comparable. Existing technical- and sensitivity-probe tests
separately exercise generator failures; the joint runner's generator-failure
branch is retained but is not claimed as a new checkpoint-11 injection test.

## What this checkpoint establishes

It establishes that, for this fixture:

- sixteen fresh generator runs can feed a reproducible node-local sheet pool;
- all 48 bounded recombinations can be replayed with calculator agreement;
- recombination finds technical-objective values not present in intact carry
  outputs;
- exact objective ties need first-class representation; and
- cached search-policy traces can be checked against the finite table without
  rerunning the evaluator.

It does not establish:

- a reviewed rotation or executable buff sequence;
- an ER requirement or rotation feasibility;
- correct main stats, substat priorities, or artifact recommendations;
- game damage, DPS, team quality, or relative set quality;
- general coordinate-descent or beam reliability; or
- a global optimum outside these four set nodes and their node-local
  carry-derived sheets.

## Verification

- the guide-factory TypeScript check passes;
- 28 guide-factory test files and 129 tests pass, including focused core,
  policy, wrapper, failure-boundary, and durable-output coverage;
- stale-report validation regenerates this report from hashed inputs with 0
  errors and the same 12 known legacy weapon-type warnings; and
- a runtime-boundary scan finds no `src`, Worker, function, or public import or
  reference to the guide-factory workspace.

## Next evidence gate

This checkpoint makes the composition seam concrete enough to reuse, but the
objective remains the weakest link. Further artifact or weapon search should
continue as bounded experiments with explicit intermediate tables and source
discrepancies. No result should be summarized into a player guide until the
formula plan and its gameplay assumptions receive domain review. ER remains
outside that critical path for now.
