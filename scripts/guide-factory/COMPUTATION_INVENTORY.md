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

## Source-backed equipment scenario seam

`src/sourceBackedEquipmentScenario.ts` materializes a calculator fixture by
joining two explicit knowledge layers. It requires an external exact team and,
for each member, one baseline or accepted character-guide record, one build ID,
and one weapon from that guide's explicit `weaponOrder`. It validates exact
member/guide association, guide status, unique weapon presence/order, and build
presence, and refuses to overwrite source equipment. The materializer does not
itself validate weapon-type compatibility or team suitability.

The result is a fixture, not a recommendation or a merged guide. It selects a
weapon and artifact configuration only. It does not copy an artifact stat
sheet, weapon refinement, or ER target, and it does not claim the selected
character-wide build is suitable for the external team.

The first scenario uses the external Keqing/Ineffa/Furina/Xilonen team with:

- Keqing: Mistsplitter Reforged and build `1WswsAu` (4pc Thundering Fury);
- Ineffa: Fractured Halo and build `FeFiQU8` (4pc Aubade of Morningstar and
  Moon);
- Furina: Splendor of Tranquil Waters and build `BQAI0BO` (4pc Golden Troupe);
- Xilonen: Peak Patrol Song and build `Dbt0Wkm` (4pc Scroll of the Hero of
  Cinder City).

The calculation assumptions are explicitly level 90, C0, R1, 10/10/10 talents,
with calculator-default combat options. These are fixture assumptions, not
facts copied from the external source.

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
defaults. A claim may be an exact positive count or a bounded nonnegative range
only when the source count is genuinely optional. Each mapped formula states
whether it covers all source tokens or only the supported portion. The
comparator rejects invalid ranges, unavailable formulas, duplicate lines, and
missing mapping explanations. That check validates comparison structure, not
whether an action was mapped to the right calculator formula.

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

The second durable draft uses the source-backed Keqing/Ineffa/Furina/Xilonen
fixture. It exposes 13 positive and 5 zero-count calculator defaults. The
source translation contains 11 exact formula count claims, with 10 complete
token mappings and 1 partial mapping. Furina's Skill count is exactly one: the
source footnote moves it beside her Burst on subsequent rotations rather than
making the cast optional. Six direct counts disagree with defaults: Keqing's
Charged Attack, Skill slash, and Stiletto, plus Xilonen's Skill, N2 sequence,
and Burst. Keqing's Charged Attack mapping is explicitly partial because the
eight N1 hits in `8[N1C]` have no C0 formula. The generic comparator supports
ranges for genuinely optional source counts, but this plan uses no ranges.

Six cases remain unmapped instead of receiving guessed counts: those eight
Keqing N1 hits, Ineffa's 10-discharge aggregate, Furina's 32-hit Salon
aggregate, and Lunar-Charged ownership/count formulas for Ineffa, Keqing, and
Furina. The report remains `needs-domain-review`, supports no guide claim, and
is not a full rotation damage calculation.

The damage-replay readiness assessment covers every available formula. Across
18 formulas it records 11 mapped, 5 unresolved, 2 source-absent, and 0
unclassified. Across the 13 positive defaults it records 10 mapped, 3
unresolved, and 0 unclassified. Eight blockers remain: unreviewed status, one
partial token mapping, five unresolved formula mappings, and one unresolved
source token. The report is therefore not considered ready for damage replay
and supports no guide claim. This assessment is advisory; `replayTeamDamage`
does not consume or enforce it, and this checkpoint does not produce or
authorize a replay. A readiness-enforcing wrapper is future work if useful.

## Artifact-choice search-domain seam

`src/artifactChoiceSearchCoverage.ts` calls the existing analyzer's exported
`buildArtifactSetChoiceCandidates()` and
`buildTwoPieceArtifactChoiceCandidates()` functions. It compares that released
candidate grammar with every eligible artifact occurrence in the consolidated
repository while preserving record status, source references, visibility,
constellation bounds, roles, conditions, and team-member context.

The current released grammar has 43 initial four-piece keys. Supplying every
legal artifact substat to the dynamic builder produces a maximum grammar of 14
two-piece pair keys. This is deliberately labeled conditional coverage: the
runtime derives positive substats from successful four-piece evaluations and
may append a smaller set in a real analyzer run.

The report accounts for every artifact-choice field on current non-rejected
character-guide and team records: 1,059 occurrences in total. Of 188 guide
builds, 167 are initially enumerated, 14 are conditionally representable, and
7 are not representable by the current grammar. Of 840 team-member selected
artifacts, 820 are initially enumerated, 7 are conditional, and 13 are not
representable. Of 29 character-guide and team-member recommendation
occurrences, 26 are initially enumerated and 3 are not representable. Two more
occurrences are the assignments in one coupled Kokomi/Columbina artifact plan;
both are initially enumerated individually. The 23
failures are 19 Instructor occurrences, 2 Exile occurrences, and 2
damage-oriented two-piece combinations absent from the dynamic half-set map.

This seam runs no artifact generator or damage formula and emits no score,
rank, winner, or guide recommendation. Candidate naming is not evidence that a
set is suitable or that its generation and evaluation path succeeds. Auditing
both assignments in a plan also does not show that the analyzer can enumerate
or optimize the coupled assignment jointly.

## Weapon-choice candidate-policy seam

`src/weaponChoiceSearchCoverage.ts` mirrors the private runtime
`getWeaponCandidates()` policy because calling the public analyzer just to
discover candidates would also run artifact generation and damage evaluation.
The report hashes both the mirror and the runtime source. Its default output
cannot independently execute the private function, so a clean comparison is
not presented as proof that the implementations are semantically identical.

For released data, the mirrored policy contains 236 weapon IDs and 309
weapon/refinement pairs:

| Rarity | Weapon IDs | Candidate refinements | Pairs |
| --- | ---: | --- | ---: |
| 3-star | 24 | R5 | 24 |
| 4-star | 139 | R5 | 139 |
| 5-star | 73 | R1 and R5 | 146 |

The consolidated repository has 987 non-ER weapon occurrences: 127 entries in
character-guide weapon orders, 840 selected exact-team weapons, and 16
character-guide recommendation entries plus the four Klee recommendation
occurrences, including Noelle's conditional Gest choice. There are no
team-member weapon recommendations yet.

All 987 weapon IDs occur in the global released candidate domain. Refinement is
a separate axis: none of the 987 observations supplies one, so the report has
0 exact candidate pairs and 987 unspecified refinements. Native type is also
separate: 975 observations are compatible and 12 are mismatched. Every mismatch
is a selected weapon from the legacy candidate source; baseline and KQM records
have none.

The runtime uses the currently equipped seed weapon's stats to choose the
candidate weapon class and skips the character if those stats are missing. A
wrong-type seed can therefore create a wrong-class search. The report does not
run that search, repair source rows, infer refinements, score weapons, or claim
that a globally present ID is usable in a specific analyzer run.

Three historical ER target weapon conditions are inventoried separately: two
specific conditions and one category condition, containing four explicit
weapon-ID occurrences in total. Their target numbers and adequacy are not
copied into the observations or analyzed while ER work is deferred.

## Artifact-generation preflight seam

`src/artifactGenerationPreflight.ts` turns the earlier coverage facts into an
executable gate. It preserves and validates explicit fixture refinements; when
the source fixture omits refinement, the named `comparison-baseline-v1`
experiment policy resolves 3- and 4-star weapons to R5 and 5-star weapons to
R1. Those values are labeled experiment inputs, never source evidence.

The preflight separately checks fixture evidence, exact weapon/refinement
pairs, native weapon types, initial artifact-set grammar, formula-draft member
and equipment binding, explicit investment compatibility, and formula-readiness
inventory binding. It exposes two outcomes:

- `equipmentReadyForTechnicalProbe` means the current computation can be
  exercised without claiming that its objective is correct;
- `readyForReviewedGeneratorExperiment` means all of those gates plus the
  reviewed formula-plan gate pass.

For the Keqing/Ineffa fixture, every equipment and binding gate passes. Its
four unspecified 5-star weapons resolve to R1 under the experiment policy. The
technical-probe outcome is therefore true, while the reviewed-experiment
outcome remains false because the formula translation retains eight blockers.
The report runs no generator or damage calculation and contains no generated
build, score, or ranking.

## Artifact-generation technical-probe seam

`src/artifactGenerationTechnicalProbe.ts` calls `runGenerator()` directly
rather than going through the one-character-at-a-time `runWeaponChoice()`
comparison wrapper. The first probe is a bounded 2x2 matrix assembled from
independently recorded character-guide builds: Ineffa uses either 4pc Aubade of
Morningstar and Moon or 4pc Silken Moon's Serenade, while Furina uses either
4pc Golden Troupe or 4pc Tenacity of the Millelith. Keqing remains on 4pc
Thundering Fury and Xilonen on 4pc Scroll of the Hero of Cinder City. No source
record binds these four build targets to the exact team or to one another.

All four matrix cells completed with their requested assignments. A fifth
repository-recorded build target that gives Xilonen 4pc Instructor is retained
as a `non-five-star-set` rejection with `generatorInvoked: false`. That rejection is
a deterministic experiment policy, not evidence that `runGenerator()` itself
cannot accept Instructor. The probe admits only 5-star sets because the
generator's lower-rarity display/flex-piece path can select a random 5-star set
key; excluding that path keeps repeated probe output byte-stable.

The runner deliberately narrows the experiment boundary:

- it creates a fresh `TeamBuild` for every candidate and runs candidates
  sequentially, so one mutation-heavy generator run cannot contaminate the
  next;
- it supplies the explicit enemy level 110, enemy resistance 0.1, roll
  multiplier 0.85, and `8_6` substat budget;
- it passes neither buff overrides nor a `perChar` constraint map, so no ER
  threshold is invented or enforced;
- it validates the requested sets independently before and after generation;
  and
- it retains generated artifact shapes, main stats, positive substat keys, and
  candidate-local failures, but no numerical damage, score, rank, winner, or
  recommendation.

One integration trap was concrete rather than hypothetical. The guide-factory
draft line type calls its owner field `characterId`, while the runtime combo
line type requires `charId`. Passing draft lines through unchanged does not
necessarily fail loudly: the normal compiled path filters invalid lines, so a
zero objective can still yield plausible-looking generated artifacts. The
probe therefore checks every character/formula pair against the rebuilt
candidate catalog and explicitly translates `characterId` to `charId` before
calling the generator.

The completed output is structurally valid but already disagrees with its
source-build validation targets. Every matrix cell generates an ATK% Goblet
for Keqing where the source build lists Electro DMG, and a Geo DMG Goblet for
Xilonen where the source build lists DEF%. Both Tenacity cells generate an HP%
Sands for Furina where that source build lists ER. ER constraints and other
gameplay assumptions remain unresolved, so the probe cannot adjudicate or
assign a cause to that experiment outcome. Generated filler flat-stat keys can
also be absent from the source priority list, which is not treated as a
contradiction because that source list is not exhaustive.

This seam proves that the existing generator can be driven reproducibly across
one small multi-character set matrix. It does not show that the unreviewed
formula objective is correct, that its greedy result is jointly optimal, or
that any generated stat choice belongs in a guide.

## Artifact-generation sensitivity seam

`src/artifactGenerationSensitivityProbe.ts` wraps the same fail-closed
technical runner and records two bounded observations that the first matrix did
not expose:

- does changing the generator's algorithmic `carryCharId` alter its artifact
  output for one fixed assignment; and
- does merely reversing two independent candidate executions alter either
  output within the same process?

The Keqing/Ineffa fixture makes exactly seven accepted generator calls. It runs
assignment A then B and B then A under Keqing carry, then runs A under Ineffa,
Furina, and Xilonen carry while reusing the forward A/Keqing result as the
fourth carry cell. Every invocation constructs a distinct `TeamBuild` and runs
sequentially. The wrapper passes no `perChar` constraints, buff overrides,
set-key overrides, ignored-set fallback, or ER threshold.

Complete generated artifact records exist only transiently and are retained as
canonical SHA-256 fingerprints. The report keeps main stats and positive
substat keys as an explainable structural summary. It stores no artifact
records, damage value, score, rank, winner, or ER conclusion. A failed run is
preserved as `not-comparable`; later scheduled calls still run, and every
dependent comparison also becomes `not-comparable` instead of manufacturing a
boolean result.

The fixed A assignment currently produces three artifact-output equivalence
classes: Keqing and Ineffa carry match, Furina differs, and Xilonen differs.
Furina carry changes Furina's Circlet from CRIT Rate to CRIT DMG and replaces
EM with flat ATK among Keqing's positive Flower substat keys. Xilonen carry
makes the same Keqing Flower change and changes Xilonen's Circlet from DEF% to
CRIT DMG. This shows that the privileged carry path can change another
character's greedy substat allocation; it does not say which output is better.

Assignments A and B each produce identical complete fingerprints under the
forward and reverse schedules. That is no observed cross-run execution-order
effect for two candidates with fresh teams in this fixture, not a proof that
the generator or a future cache is generally order-independent.

## Bounded joint artifact-stat composition seam

`src/boundedJointArtifactExperiment.ts` composes the generator and replay seams
without changing either runtime. It accepts exactly four released 5-star set
nodes, four distinct carry seeds, and positive unreviewed technical formula
lines. For each of 16 sequential calls it constructs a fresh team, captures the
final complete artifact fingerprint, `StatSheet` dumps, and team configs, then
deduplicates sheets per character inside that set node. It never creates a
cross-node sheet pool and cannot warm-start `runGenerator`.

The Keqing/Ineffa wrapper derives its 11 formula lines from exact-valued
authored-translation comparisons and records the formula fixture, source team,
sample rotation, 10 complete and 1 partial mappings, and all 8 readiness
blockers. The generic core records that it does not itself establish that
source binding. The wrapper therefore explains the objective's provenance
without treating it as reviewed rotation truth.

The observed node-local pool sizes are:

| Node | Keqing | Ineffa | Furina | Xilonen | Cartesian cells |
| --- | ---: | ---: | ---: | ---: | ---: |
| Aubade / Golden | 2 | 1 | 2 | 2 | 8 |
| Aubade / Tenacity | 2 | 2 | 2 | 2 | 16 |
| Silken / Golden | 2 | 1 | 2 | 2 | 8 |
| Silken / Tenacity | 2 | 2 | 2 | 2 | 16 |

All 48 cells pass the direct-versus-compiled replay check. No explicit
generator or formula buff override is passed. The replay's independently
computed formula-override map has zero entries in every current cell and is
retained as a count and hash; this is not a claim that implementation buffs are
absent. Complete artifacts and sheet entries remain transient, while the
durable report retains hashes, pool membership, objectives, calculator
agreement, and failure data.

Within the bounded table, node-local recombination exceeds the strongest intact
carry by about 0.1191% in the two Golden nodes and 0.4090% in the two Tenacity
nodes. The two Golden nodes tie exactly, and the two Tenacity nodes tie exactly
at the outer reference. Both Ineffa-set edges have zero technical-objective
delta; both Furina-set edges share the same positive delta. This is
objective-sensitivity evidence that may reveal objective blindness or
implementation invariance. It is not artifact suitability or causal game
performance.

`src/boundedLatticePolicy.ts` is a reusable, evaluator-free cached-table seam.
Its reference selector reports tolerance-equivalent node IDs and fails closed
when any declared node is a cached failure. Coordinate descent exposes strict
improvements, equal-neighbor plateaus, and a separate
`neighborhood-incomparable` terminal. In this fixture it moves from
Aubade/Golden to the Aubade/Tenacity representative and exposes
Silken/Tenacity as an equal neighbor. A synthetic `10, 9, 9, 12` table proves
the policy can miss a pair-only improvement. Beam output is explicitly a
non-calibrated, non-exhaustive coverage trace; it makes no evaluator call.

Any generator/capture failure skips that node's recombination, and any replay
failure makes its node not comparable. One failed node removes the cross-node
reference and causes the fixture wrapper to withhold cached policy traces. This
failure boundary prevents a survivor-only ordering from appearing complete.

The seam supports bounded technical-objective comparison only. It does not
support guide, artifact-recommendation, game-performance, ER, or global-
optimality claims.

## Full-team local stat-marginal diagnostic seam

`src/teamStatMarginalDiagnostic.ts` accepts already captured four-character
team configs and `StatSheet` operating points. It evaluates one baseline plus
one average five-star roll of each of nine hard-coded non-ER stats for every
character. The generic core recomputes team-config and sheet fingerprints,
checks every replay through the interpreted and compiled calculator paths, and
fails the whole cross-endpoint summary closed after any capture, replay,
agreement, or finite-number error. A caller's complete-artifact capture hash is
explicitly opaque correlation metadata and receives syntax validation only.

The core retains raw and relative deltas, within-character endpoint-local
normalization, effective numerical tolerance, and tolerance-aware signs. It
aggregates endpoints only as min/max ranges and sign/zero classifications; it
does not average them into weights. A +1-roll perturbation is not budget-
neutral and does not enforce artifact legality, so the output is a local
derivative rather than an allocation.

The Keqing/Ineffa wrapper captures four fresh endpoints for the fixed
Aubade/Golden node through the existing technical-probe generator injection.
The exact carry set, four invocations, fresh teams, and maximum concurrency of
one are comparability gates. Across four endpoints, four characters, and nine
stats, the current run performs 148 full dual-path replays. All pass agreement;
the computed formula-override map is empty throughout.

The four captures yield one unique Ineffa sheet and two unique sheets each for
Keqing, Furina, and Xilonen. Several local marginals are visibly operating-
point dependent. Keqing CR remains positive but ranges from approximately
0.217 to 0.912 of that endpoint's largest positive Keqing marginal. Furina CR
is positive at three endpoints and tolerance-zero at the Furina-carry endpoint.
This is retained as an operating-point review case rather than averaged into a
single weight.

The wrapper separately overlays the fixed GenshinTools baseline build priority
bands. Their 100/75/50 values are categorical baseline labels, not external
truth and not a scale comparable with marginal normalization. Keqing and
Ineffa EM are baseline-listed but all-zero under the current objective. Because
the 11 unreviewed lines contain no reaction line or reaction override, these
are objective-coverage review cases, not guide disagreements. Existing
generator sheets may contain incidental or filler ER only as part of the
operating point and fingerprint; no ER threshold, perturbation, or conclusion
is present.

This seam addresses two weaknesses of direct AutoTune reuse: teammates retain
their complete generated operating-point sheets, and the full four-character
technical combo is replayed through both calculator paths at several endpoints.
It does not validate AutoTune's default context, replace constrained allocation,
or make the unreviewed objective credible enough for player-facing weights.

## Source-scoped role-sample seam

`src/sourceScopedRoleSample.ts` evaluates one named member from one
`character_role` knowledge record against one exact team and one applicable
template slot. It requires exact source/page lineage, one non-exhaustive and
unranked evidence member, an explicit same-page inferred binding, acknowledged
conditions and constellation bounds, and the expected structural binding
multiplicity. Any mismatch removes the survivor; it never ranks a surviving
subset.

The Furina wrapper uses the existing roster-domain fixture seam to obtain the
same 125 eligible stable IDs. That full catalog is transient: the durable report
keeps only catalog counts and hashes, plus Xilonen and the exact
Furina/Neuvillette/Kazuha/Xilonen target. It verifies the manual role record's
observed extraction status through the indexed snapshot. The fresh catalog's
count, full hash, ID-only hash, and identity count are compared with the
independently stored checked-in roster-domain report boundary; a same-count
membership mutation fails that seam. The exact binding has multiplicity two
because Neuvillette and Kazuha can exchange unrestricted flex slots.

The wrapper separately replays the existing roster-domain core on the full
Hypercarry template and requires it to remain `withheld-unresolved-role`. The
one source-scoped member is not installed as a global role resolver. This seam
therefore supports provenance and structural validation only, not complete role
membership, team recommendation, gameplay quality, damage, equipment, stats,
or ER.

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
- Node-local carry-sheet recombination and exhaustive replay:
  `scripts/guide-factory/src/boundedJointArtifactExperiment.ts`.
- Cached finite-lattice reference, coordinate, and beam traces:
  `scripts/guide-factory/src/boundedLatticePolicy.ts`.
- Full-team non-ER local marginals with fail-closed multi-endpoint ranges:
  `scripts/guide-factory/src/teamStatMarginalDiagnostic.ts`.
- One named source-scoped role binding without a global resolver:
  `scripts/guide-factory/src/sourceScopedRoleSample.ts`.

The technical and sensitivity probes invoke only `runGenerator` and its
immediate calculation dependencies. The bounded joint seam now composes
`runGenerator` with the dual-path replay, but only over carry-derived,
node-local stat sheets. The comparison, owned-inventory optimization, AutoTune,
and investment analyzers remain inventoried rather than composed into the
factory.

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
- `runGenerator` also gives `carryCharId` a privileged initial and refinement
  path. The current sensitivity probe finds three outputs from four carry
  choices and a cross-character Keqing substat-key change. A factory cannot
  silently choose one carry seed and present its result as canonical.
- Exhausting the carry-derived node-local sheet pool is still not global
  artifact-stat optimization. The current bounded table also has zero objective
  sensitivity on both Ineffa-set edges, so apparently clean search completion
  can expose an objective-blind dimension rather than credible set guidance.
- The existing artifact analyzer does not enumerate non-five-star sets such as
  Instructor and cannot dynamically discover every damage-oriented two-piece
  family. Its two-piece candidate grammar is conditional on successful
  four-piece evaluations, not an unconditional search list.
- Coupled source plans are now representable in the knowledge schema, but the
  current analyzer varies one character at a time and has no joint artifact-set
  assignment search. Individual candidate coverage must not be reported as
  coupled-plan coverage.
- The current knowledge records do not specify refinements for any of the 987
  non-ER weapon occurrences. The preflight now states one comparison policy
  explicitly, but that convention remains an experiment input rather than a
  source fact.
- Twelve legacy selected weapons have the wrong native type. Since the runtime
  uses the equipped seed weapon to select a candidate class, they cannot safely
  seed a weapon search even though their IDs exist in the global domain.
- AutoTune varies one character while teammates use flower/plume-only sheets.
  If formulas are omitted, `autoTuneTeam` assigns count 1 to every available
  formula. `autoTune.ts` currently sets `DEFAULT_CALC_CTX.enemyRes` to `10`,
  while the normal calculator and analyzer defaults use `0.1`, and
  `autoTuneTeam` has no context override. These are unresolved assumptions that
  require validation before the pipeline can be reused; this inventory does not
  diagnose which value or policy was intended.
- The new stat-marginal seam uses complete generated team sheets and a normal
  resistance value, but each +1-roll probe is additive rather than a legal
  roll exchange. Its objective still has eight readiness blockers and omits
  reaction lines, so it cannot yet produce credible scalar weights or an ideal
  allocation.
- The repository now has one source-scoped role observation, but one named
  Xilonen sample cannot define a global healer catalog. Contextual conditions,
  constellation boundaries, overlaps, and source disagreements need multiple
  attributed validation targets before role-based roster expansion is safe.
- The bounded joint experiment intentionally passes no explicit buff
  overrides, although it now records that the computed formula-override map is
  empty in all 48 current cells. A future performance-bearing experiment must
  define or validate its buff semantics explicitly and verify that the same
  objective is applied throughout every greedy, refinement, and replay phase.

The current 2x2-by-four-carry table and its first nine-stat local derivative
pass are now executed rather than planned. The reusable seams can be applied to
another source-backed fixture or to budget-neutral roll exchanges, but each
expansion needs its own exhaustive boundary, intermediate discrepancies, and
fail-closed validation. The unreviewed formula plan, omitted reaction coverage,
zero-sensitivity Ineffa set dimension, and carry-dependent marginal ranges make
extrapolation unsafe. Formula-plan review and explicit gameplay assumptions
remain prerequisites for performance claims. ER remains deferred.
