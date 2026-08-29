# Offline Computation Inventory

This inventory records callable seams that were inspected and tried from the
guide-factory Node environment. It is an integration map, not a claim that the
current inputs are sufficient to produce guides.

## First replay seam

`src/computationReplay.ts` performs the smallest useful calculation:

1. import `src/lib/dmgcalc/index.ts` to register calculator implementations;
2. preload character and weapon stats from `src/data/gameStatsLoader.ts`;
3. construct `TeamBuild` from four explicit `TeamSlotConfig` values;
4. reject every combo line not present in `TeamFormulaCatalog.getFormulaIds()`;
5. compute combo-wide stack-limited buff coverage with
   `buildBuffOverrides()`;
6. evaluate `TeamBuild.getComboDamageResult()`;
7. evaluate the same sheets through `compileComboTeamDamage()`; and
8. reject the replay unless the totals agree within a small absolute/relative
   floating-point tolerance.

The returned value contains only plain, normalized data. Artifact-sheet entries
and option keys are sorted, floating-point values are normalized, and the test
compares byte-stable JSON across repeated runs.

`src/eulaStructuralSmoke.ts` is deliberately weaker than a validation target.
It uses one selected Eula team, but assigns explicit test-only C0/R1, level 90,
10/10/10 talents, empty artifact sheets, and one Skill tap. Its output proves
that the offline wiring works. It does **not** support a claim about a rotation,
damage benchmark, stat allocation, ER, equipment ranking, or guide quality.

## Formula-count review seam

`src/formulaPlanDraft.ts` turns one exact consolidated team into a deterministic
view of the damage calculator's current `comboDescriptor` defaults. It requires
selected weapons and artifact sets plus explicit character level,
constellation, refinement, and all three talent levels. Every descriptor ID is
checked against the full formula catalog; formulas unavailable at the supplied
investment are omitted, and every available formula appears exactly once in a
positive-count or zero-count list.

This seam does not derive a rotation. Its output is labeled
`calculator-default-draft`, does not support guide claims, and records that
combat options use implementation defaults.

The same module also compares a manually translated source plan against those
defaults. It rejects unavailable formulas, duplicate lines, nonpositive counts,
and missing mapping explanations. That check validates comparison structure,
not whether an action was mapped to the right calculator formula.

The first durable draft uses the baseline
Furina/Neuvillette/Xilonen/Kaedehara Kazuha team that also appears as an exact
KQM example. Under explicit level 90, C0, R1, 10/10/10 assumptions it exposes
12 positive and 6 zero-count formulas. KQM's Xilonen sample rotation is captured
separately and translated into formula counts. Five token-supported rows
disagree with calculator defaults: Neuvillette's Judgment and Skill counts,
plus Xilonen's Skill rush, N2 sequence, and Burst. Furina's baked Salon
aggregate and C0 Normal Attack, Neuvillette's Spiritbreath proc count, and
Kazuha's absorbed plunge, absorbed Burst, and Swirl counts remain unresolved
rather than being assigned invented values.

## Callable modules for later experiments

- Direct damage and formula catalog:
  `src/lib/dmgcalc/core/teamBuild.ts`,
  `src/lib/dmgcalc/core/teamFormulaCatalog.ts`, and
  `src/lib/dmgcalc/core/comboBuffOverrides.ts`.
- Artifact sheets:
  `src/lib/dmgcalc/core/statSheet.ts` and
  `src/lib/artifact/scoring/sheetBuilder.ts`.
- Compiled evaluation:
  `src/lib/dmgcalc/core/formulaCompiler.ts`.
- Ideal artifact-stat heuristic:
  `src/lib/team-comp/generator/generator.ts::runGenerator`.
- Per-character weapon or artifact-set comparison:
  `src/lib/team-comp/analyzer/weaponChoice.ts::runWeaponChoice`.
- Joint assignment from a real owned-artifact inventory:
  `src/lib/team-comp/optimizer/teamOptimization.ts::runTeamOptimization`.
- Marginal stat weights:
  `src/lib/artifact-builds/auto-tune/autoTune.ts` and
  `src/lib/artifact-builds/auto-tune/pipeline.ts`.
- Constellation/refinement investment analysis and allocation-specific formula
  counts: `src/lib/team-comp/analyzer/analyzer.ts`.

None of these later modules is invoked by the first replay.

## Current blockers

- The consolidated repository still has no accepted executable damage plan.
  The source-rotation translation and its fixture investment are explicit but
  unreviewed. Team records still do not contain reviewed artifact main stats or
  substat rolls for a calculation target.
- Character combo descriptors provide formula counts, not action order, timing,
  buff-window coverage, or a full team rotation. Allocation-aware derivation
  still needs an authored template combo.
- Missing formulas are silently skipped by the normal direct and compiled
  calculator paths. The replay adds an explicit rejection boundary.
- Combat options, reactions, on-field overrides, enemy context, extra buffs,
  and stack-limited buff activations can change the result and must be explicit
  in a real validation fixture.
- Omitted talents default to 10/10/10, while weapon base stats are resolved at
  level 90. The replay therefore requires explicit talents and labels its
  weapon-level assumption in the fixture evidence.
- `runGenerator` is ordered greedy, not exhaustive joint optimization.
  `runWeaponChoice` varies one character at a time. The owned-artifact optimizer
  jointly assigns inventory pieces but does not search team weapons and sets.
- AutoTune varies one character while teammates use flower/plume-only sheets.
  If formulas are omitted, `autoTuneTeam` assigns count 1 to every available
  formula. `autoTune.ts` currently sets `DEFAULT_CALC_CTX.enemyRes` to `10`,
  while the normal calculator and analyzer defaults use `0.1`, and
  `autoTuneTeam` has no context override. These are unresolved assumptions that
  require validation before the pipeline can be reused; this inventory does not
  diagnose which value or policy was intended.

The next computation checkpoint should review the action-to-formula translation
and resolve or parameterize its aggregate hit counts. It can then add explicit
artifact stat sheets and replay the selected loadout through both calculator
paths. Optimization remains out of scope until that replay is credible.
