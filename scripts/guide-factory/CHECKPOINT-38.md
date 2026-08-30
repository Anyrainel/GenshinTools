# Checkpoint 38: authenticated bounded full-team technical computation

This checkpoint turns checkpoint 37's authenticated 36-node runtime preflight
into one durable, finite execution of the existing artifact generator and both
damage-calculator paths for the exact Keqing/Ineffa/Furina/Xilonen roster. It
executes the complete node-local sheet product under one unreviewed technical
objective and preserves whether each composition is an intact generator
endpoint or a cross-endpoint recombination.

This is internal computation and provenance evidence. It is not a working guide
factory, equipment recommendation, source-backed damage result, DPS result,
rank, gameplay validation, optimum, promotion candidate, or ER result.

## Declared checkpoint-input authentication boundary

The source-specific wrapper authenticates exactly 64 declared non-self selected
checkpoint inputs. This is deliberately a selected checkpoint boundary, not an
exhaustive dependency closure or transitive module-graph claim. It binds the
committed checkpoint 37 report, its source-specific and generic authentication
surfaces, the generic checkpoint 38 computation core, selected generator and
artifact-sheet inputs, the replay paths, and the current calculator
implementations relevant to this roster and equipment domain.

The exact declared set is:

- Guide Factory checkpoint and execution inputs (6):
  - `scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-runtime-preflight.json`;
  - `scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentRuntimePreflight.ts`;
  - `scripts/guide-factory/src/sourceBackedEquipmentRuntimePreflight.ts`;
  - `scripts/guide-factory/src/boundedFullTeamEquipmentTechnicalComputation.ts`;
  - `scripts/guide-factory/src/computationReplay.ts`; and
  - `scripts/guide-factory/src/io.ts`.
- Runtime data inputs (13):
  - `src/data/betaState.ts`, `src/data/charInfo.ts`, `src/data/constants.ts`, and
    `src/data/enums.ts`;
  - `src/data/game/artifact_stat.json`,
    `src/data/game/character_stats.json`, and
    `src/data/game/weapon_stats.json`;
  - `src/data/gameDataUtil.ts`, `src/data/gameResources.ts`, and
    `src/data/gameStatsLoader.ts`; and
  - `src/data/resources.ts`, `src/data/resources_beta.ts`, and
    `src/data/utils.ts`.
- Artifact-sheet and generator inputs (8):
  - `src/lib/artifact/scoring/constants.ts`,
    `src/lib/artifact/scoring/sheetBuilder.ts`, and
    `src/lib/artifact/scoring/utils.ts`;
  - `src/lib/team-comp/generator/constrainedGreedy.ts`,
    `src/lib/team-comp/generator/generator.ts`, and
    `src/lib/team-comp/generator/substatBudget.ts`;
  - `src/lib/team-comp/optimizer/erCrConstraints.ts`; and
  - `src/lib/team-comp/teamConfigUtils.ts`.
- Selected damage-runtime and core inputs (27):
  - `src/lib/dmgcalc/index.ts`, `src/lib/dmgcalc/constants.ts`, and
    `src/lib/dmgcalc/utils.ts`; and
  - `src/lib/dmgcalc/core/charBuild.ts`, `combo.ts`,
    `comboBuffOverrides.ts`, `damageFormula.ts`, `dynamicBuffEval.ts`,
    `expr.ts`, `exprStatSheet.ts`, `fieldState.ts`, `formulaCompiler.ts`,
    `formulaEval.ts`, `implModel.ts`, `marginalGain.ts`, `registry.ts`,
    `stackRank.ts`, `statBuff.ts`, `statSheet.ts`, `teamBuffLedger.ts`,
    `teamBuild.ts`, `teamExprStatSheet.ts`, `teamFormulaCatalog.ts`,
    `teamMeta.ts`, `teamReaction.ts`, `teamResonance.ts`, and
    `teamStatSheet.ts`.
- Roster- and equipment-relevant calculator implementations (10):
  - `src/lib/dmgcalc/impl/artifact2pc.ts` and `artifact4pc.ts`;
  - `src/lib/dmgcalc/impl/character5Fontaine.ts`,
    `character5Liyue.ts`, `character5Natlan.ts`, and
    `character5NodKrai.ts`;
  - `src/lib/dmgcalc/impl/helpers.ts`; and
  - `src/lib/dmgcalc/impl/weapon4Sword.ts`, `weapon5Polearm.ts`, and
    `weapon5Sword.ts`.

`artifact2pc.ts` is part of the selected boundary because a four-piece build
automatically applies the set's declared two-piece half-set. The set still does
not claim to cover every module imported transitively by the side-effect
registry.

The following producing paths are deliberately excluded to avoid a
self-referential digest:

- `scripts/guide-factory/src/keqingIneffaFurinaXilonenEquipmentTechnicalComputation.ts`;
- `scripts/guide-factory/src/compute-keqing-ineffa-furina-xilonen-equipment-technical.ts`;
- `scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json`.

The source-specific wrapper verifies the checkpoint 37 report's exact durable
bytes and full source-specific digest before computation. Its nested generic
preflight must also authenticate and remain complete. Missing, extra,
duplicated, malformed, stale, or byte-mismatched inputs fail before bootstrap,
generator construction, or replay.

## Authority and authored assumptions

The KQM team record supports the exact four-character roster only. The source's
rotation text is retained upstream as input to an unreviewed translation, but
checkpoint 38 does not treat the translated formula counts, mappings, or
technical objective as a source-supported damage plan. The source does not
support the selected weapons, artifact sets, investment, or generated artifact
stats. It publishes zero whole candidates for this 36-node equipment product.
In serialized evidence terms, only `roster` is supported; `damage_plan`,
`selected_weapons`, `selected_artifact_sets`, `investment`, and
`artifact_stats` are explicitly unsupported.

The wrapper retains checkpoint 37's technical assumptions:

- all four characters at level 90 and C0 with talents 10/10/10;
- enemy level 110 with 0.1 resistance;
- artifact roll multiplier 0.85 and substat budget `8_6`;
- empty combat options, null enemy aura, and no extra buffs; and
- each of Keqing, Ineffa, Furina, and Xilonen used once as the generator carry.

These are wrapper-authored inputs, as are the equipment compositions and the
formula translation. They are not source facts. No per-character threshold,
ER floor, warm start, cross-node sheet composition, explicit generator buff
override, or replay formula-buff override is supplied.

The exact eight checkpoint 37 readiness blockers remain active. The objective
is therefore unreviewed and source-not-ready even though the runtime can execute
it. Calculator success cannot resolve rotation order, duration, buff coverage,
field time, hit mapping, trigger ownership, or reaction ownership.

## Complete finite technical execution

After the source-specific authentication gate, the exact default environment
constructs the real `TeamBuild` instances. The generic core audits distinct
runtime identities without claiming their concrete implementation. The real
default runtime completes the entire authenticated finite domain:

- 36 equipment nodes;
- four generator invocations per node, for 144 generator invocations and 144
  distinct runtime identities;
- canonical sheet deduplication inside each node only;
- 364 complete node-local Cartesian compositions and 364 successful replays;
- zero cross-node sheet compositions; and
- interpreted and compiled calculator agreement for every replay under the
  implementation's absolute/relative tolerance.

The 364 deduplicated compositions separate into 139 compositions matching at
least one intact four-character generator endpoint and 225 cross-endpoint
recombinations. Those counts are composition counts, not generator-invocation
counts. Every one of the 36 node-local bounded technical references is a
cross-endpoint recombination; none was emitted intact by one generator call.

The complete-domain technical reference is `926093.666196721`. The best intact
generator-endpoint technical reference under the same unreviewed objective is
`914219.528685479`. Their difference is a finite-domain technical observation,
not evidence that either equipment composition is better in the game. The
authenticated result fingerprint is
`ea78f4ea4252bd2b39cfe9d99fb0a7ba37d172e2095c628f9df07d82825392b5`.
Reproducibility and direct/compiled agreement are internal implementation
checks, not independent damage validation.

## Capability boundary

Generator and damage-computation execution are true because those operations
ran. Every claim and publication capability remains false:

- source, guide, team-recommendation, equipment-recommendation, rank, damage,
  DPS, gameplay, optimality, and ER claims;
- ranking, recommendation, guide, optimizer, and ER production; and
- publication or promotion eligibility.

The word "maximum" applies only to the exact finite, node-local technical table
under the unreviewed objective. It must not be shortened to "best build" or
"best team." An intact endpoint is not source-authored, and a cross-endpoint
recombination must never be called generator-produced.

## Durable evidence and verification

The checked-in report is
`keqing-ineffa-furina-xilonen-equipment-technical-computation.json`. Its final
byte SHA-256 is
`eba5043b01e1381b1ae400e8cb4ea35da4a543f6266be7a331e30c8c3d99c03b` and its
final size is 2,011,250 bytes. It is durable report 35 overall and
globally integrated report 34.

Final focused verification covers 44 passing tests and one intentional opt-in
skip across the generic and source-specific files. The full Guide Factory suite
passes 69 files with 642 passing tests and one intentional opt-in skip. The
final checkpoint also passes Guide Factory TypeScript, global validation with
zero errors and the same 12 existing warnings, application TypeScript, and
dependency-boundary validation.

## Next bounded non-ER checkpoint

The next checkpoint should expose an authenticated generated-sheet and
artifact-allocation evidence catalog before adding a publication authority
gate. Checkpoint 38 retains 259 node/character/sheet pool cells backed by 21
globally unique sheet hashes, but deliberately omits the underlying sheet dumps
and displayed artifact allocations. Reproducing all 144 generator captures can
test whether displayed artifacts reconstruct the sheets that were evaluated
and can compare reviewable stat shapes with explicitly authority-labelled
knowledge targets.

It should not convert the finite technical maxima into equipment ranks or guide
recommendations. ER remains deferred.
