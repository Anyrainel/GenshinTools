# Checkpoint 37: authenticated runtime materialization preflight

This checkpoint completes a generic, fail-closed lattice-to-runtime
materialization preflight and one source-specific wrapper for the exact
Keqing/Ineffa/Furina/Xilonen Lunar-Charged roster. The wrapper authenticates
checkpoint 36's complete 36-node equipment lattice together with the exact
Keqing/Ineffa source-rotation formula draft before calling the generic core.
All nodes materialize in the existing `TeamBuild` runtime, but the retained
source-readiness blockers leave every node evaluator-not-ready.

This is a runtime compatibility and formula-availability result. It is not a
generator run, replay, damage result, score, rank, recommendation, gameplay
validation, ER result, or guide.

## Declared checkpoint-input authentication boundary

The source-specific wrapper authenticates the declared non-self checkpoint
input set, containing exactly 38 declared paths. That set includes selected
upstream and runtime dependencies for the checkpoint 36 lattice, the exact
Keqing/Ineffa formula draft, and the runtime registries required to resolve the
selected characters, weapons, artifacts, and formulas. It intentionally
excludes the source-specific producer, its CLI, and the emitted report to avoid
self-reference. It is explicitly not an exhaustive or transitive module-graph
claim. The durable wrapper/report binds the exact declared path set and every
byte hash. Missing, extra, stale, or digest-mismatched inputs cannot produce
authenticated durable output; a lattice or formula-draft authentication
failure withholds the generic core call.

The serialized dependency-set classification is
`authenticated-declared-non-self-checkpoint-inputs`, with
`transitiveModuleGraphClaimed: false`.

The wrapper establishes the source binding between the lattice, exact source
team and rotation IDs, and the formula draft's 11 authored lines. The generic
core records `sourceBindingEstablishedByCore: false`: it validates the
caller-authenticated envelope but does not independently interpret source
material. The canonical objective-line SHA-256 is
`cb0f071bd5151936f010b3cbbcc6582233b0ae08f2aace0df654f2f58afe060a`.

All 14 active checkpoint 36 occurrences have one exact resolution. Each
resolution binds the occurrence payload SHA-256 to one selected weapon and
refinement or one selected four-piece artifact set. The resolution set is an
exact closure: omissions, extras, duplicates, payload drift, equipment drift,
non-four-piece artifacts, missing registry entities, and partial lattice nodes
fail closed.

## Wrapper-owned runtime assumptions

The wrapper supplies one explicit technical environment for all 36 nodes:

- all four characters at level 90 and C0 with talents 10/10/10;
- enemy level 110 with 0.1 resistance;
- artifact roll multiplier 0.85 and substat budget `8_6`;
- empty combat options, null enemy aura, and no extra buffs; and
- Keqing, Ineffa, Furina, and Xilonen all listed as carry IDs.

Energy thresholds and per-character constraints are explicitly null. ER fields
or unknown assumption fields fail closed. Character levels, talent levels,
enemy context, carry selection, combat options, aura, buffs, and artifact-roll
budget are wrapper-owned runtime inputs. They are not source-authored guide
facts and must not be promoted into the knowledge repository as such.

## Complete materialization and availability checks

The generic core creates a fresh `TeamBuild` for every lattice node. It checks
the exact four-character order, investments, weapons, refinements, four-piece
artifact sets, objective/context hashes, and formula presence without retaining
runtime objects in the serialized report.

The completed result contains:

- 36/36 fresh `TeamBuild` materializations and 36/36 runtime-ready nodes;
- 396 objective-formula availability checks: 36 nodes x 11 exact lines; and
- 180 unresolved-formula-reference availability checks: 36 nodes x five
  non-null unresolved formula references.

Availability does not evaluate a formula. The preflight executes zero generator
calls, zero damage replays, zero damage evaluations, zero scoring or ranking
calls, zero recommendations, and zero ER calculations.

## Exact retained source-readiness blockers

The wrapper retains the formula draft's exact eight upstream blockers rather
than replacing them with core-authored readiness claims:

1. one `translation-unreviewed` blocker;
2. one `partial-token-mapping` blocker for Keqing's Charged Attack mapping;
3. one `unresolved-formula-mapping` blocker for Furina's Salon aggregate;
4. one `unresolved-formula-mapping` blocker for Furina Lunar-Charged ownership;
5. one `unresolved-formula-mapping` blocker for Ineffa's Birgitta aggregate;
6. one `unresolved-formula-mapping` blocker for Ineffa Lunar-Charged ownership;
7. one `unresolved-formula-mapping` blocker for Keqing Lunar-Charged ownership;
   and
8. one `unresolved-source-token` blocker for the unmapped Keqing N1 hits inside
   the source's N1C notation.

The report is therefore `authenticated-materialized-objective-not-ready`:
materialization is complete, but evaluator-ready node count remains zero. The
preflight does not infer rotation order, buff timing, field time, hit counts,
reaction ownership, gameplay applicability, or damage.

## Durable evidence and verification

The checked-in report is
`keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json`. Its byte
SHA-256 is
`df5f8d938223063d82cee70cbaf57dd666d10b01b95743e3d84f9e433b9698ec`
and its size is 555,200 bytes. It is durable report 34 overall and globally
integrated report 33. The validator rebuilds it canonically and the generic
guard recomputes a self-excluding content digest so post-build mutation of
nodes, counters, issues, cautions, or capabilities fails.

The focused generic-core, source-wrapper, and pipeline suite passes 3 files with
53 tests. The completed CP37 baseline passes 67 Guide Factory test files with
598 tests, Guide Factory TypeScript, global validation with 0 errors and 12
existing warnings, application TypeScript, and dependency-boundary validation.

## Next bounded non-ER checkpoint

Checkpoint 38 is the next unimplemented durable boundary: bounded execution of
the existing generator and replay modules over the authenticated preflight.
A transient technical probe has demonstrated that the current fixture can
complete 144 generator calls and 364 replays, but that probe is not durable
evidence and does not complete checkpoint 38.

Any durable checkpoint 38 result must retain composition provenance. A
four-character composition captured intact from one generator endpoint must be
distinguished from a synthetic cross-endpoint recombination of independently
captured character sheets. Neither class may be relabeled as source-authored,
reviewed, gameplay-validated, ranked, optimal, recommended, or ER evidence.
