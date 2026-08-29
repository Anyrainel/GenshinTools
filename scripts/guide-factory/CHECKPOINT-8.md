# Checkpoint 8: Artifact-generation preflight and Noelle refresh

Date: 2026-08-29

This checkpoint still is not a working guide factory. It adds a machine-checked
gate in front of the existing ideal-artifact generator and expands the source
repository with one current old-character guide slice. It deliberately stops
before presenting generated stats or damage as recommendations.

## Why a preflight was necessary

The knowledge repository names weapons but does not specify refinement for any
of its 983 non-ER weapon occurrences. The existing Keqing/Ineffa formula fixture
had silently used R1 for all four 5-star weapons. That was a calculator fixture
assumption, not source evidence.

The named `comparison-baseline-v1` experiment policy now makes the convention
explicit:

- preserve and validate an explicit fixture refinement;
- use R5 when an unspecified weapon is 3- or 4-star;
- use R1 when an unspecified weapon is 5-star.

This matches the current comparison candidate domain. It is not a weapon
recommendation, an account default, or an inferred source fact.

## Gates that now run before generation

`artifactGenerationPreflight.ts` checks these concerns independently:

1. four unique team members and complete selected equipment;
2. one consistent source-backed equipment evidence row per member;
3. resolved refinements that form exact released weapon/refinement candidates;
4. native character and weapon-type compatibility;
5. selected artifacts in the analyzer's initial four-piece grammar;
6. exact member, weapon, artifact, refinement, and explicit-investment binding
   between the fixture and formula draft;
7. exact formula-inventory binding between the formula draft and its readiness
   assessment; and
8. formula-plan review readiness.

Synthetic tests fail closed on unsupported explicit refinements, wrong native
types, non-enumerated artifacts, extra or inconsistent evidence, formula
equipment and investment drift, readiness-inventory drift, and inconsistent
candidate metadata.

## Current Keqing/Ineffa outcome

All four selected weapons are 5-star and resolve to R1 under the experiment
policy. Their exact candidate pairs and native types pass. The four selected
artifact sets are initially enumerable, all evidence rows agree, and the
formula draft is bound to the same members, equipment, refinements, and formula
inventory.

The report distinguishes two outcomes:

- `equipmentReadyForTechnicalProbe: true`: the computation can be exercised as
  a structural experiment without claiming its objective is correct;
- `readyForReviewedGeneratorExperiment: false`: the unreviewed formula plan
  still has eight blockers—one review-state blocker, one partial token mapping,
  five unresolved formula mappings, and one unresolved source token.

The preflight itself runs no artifact generator or damage calculation. It emits
no generated artifact, stat sheet, score, rank, winner, or guide recommendation.
Character level 90, C0, R1, and 10/10/10 talents are retained under the explicit
`calculator-fixture-experiment-assumptions` label because the source team does
not provide them.

## Noelle Luna VIII source slice

The KQM Noelle Quick Guide snapshot adds five narrow, unreviewed records:

- Gest of the Mighty Wolf as an unranked conditional choice in Hexerei teams;
- 4pc Husk of Opulent Dreams as a general unranked/default artifact choice;
- one offensive artifact-stat branch for C0–C5 with Burst Talent Level 9;
- one offensive artifact-stat branch for C6 or Burst Talent Level 10+; and
- the exact Noelle/Durin/Nicole/Xilonen Hexerei example team and its source
  sample rotation.

The general weapon, artifact, and stat claims are not attached to the exact
team. The snapshot contains no refinement inference, computed threshold,
formula count, ranking between teams, or ER recommendation. The team remains an
example with unspecified equipment and investment.

After consolidation, the repository contains 358 records: 191 baseline and 167
candidate; 133 character guides, 218 exact teams, 6 templates, and 1 historical
energy record. KQM contributes 28 records, 8 exact teams, and 10 explicit
rotation entries. The Noelle team is uncovered by the baseline, not promoted
into it.

The expanded search audits now contain:

- 1,053 artifact observations: 1,010 initially enumerable, 21 conditional, and
  22 not representable;
- 983 non-ER weapon observations: all 983 IDs in the global released domain,
  all 983 refinements unspecified in source knowledge, 971 native-type
  compatible, and the same 12 legacy mismatches.

## Validation and boundaries

The durable preflight report hashes the source repository, formula-fixture
inputs, comparison policy, runtime candidate code, and relevant game data.
`validate.ts` rebuilds it in memory and rejects stale output. All new code and
data remain under `scripts/guide-factory`; no application or Worker module
imports this lab, so the distributed website bundle is unchanged.

No production preset is changed, no candidate is accepted, and no new ER data,
logic, or active analysis is added. The historical Diona ER artifact remains
untouched and deferred, while the existing validator continues to check it as
before.

Verification for this checkpoint:

- guide-factory TypeScript check: passed;
- guide-factory tests: 22 files and 103 tests passed;
- pipeline validation: 0 errors and the 12 known legacy weapon-type warnings;
- dependency-boundary check: 754 modules and 3,975 dependencies checked with
  no violations.

## Next evidence gate

Run one bounded `runGenerator()` technical probe behind the passing technical
gates. Preserve candidate-specific failures, deterministic generated artifact
structure, and requested-set satisfaction, but withhold comparative damage and
all guide/ranking claims while the formula plan remains unreviewed.

Separately, the eight formula blockers are now a concrete domain-review queue.
Resolving them requires gameplay judgment about Keqing's unsupported N1 hits,
Ineffa and Furina aggregate hit assumptions, and Lunar-Charged ownership; the
factory must not guess those values.
