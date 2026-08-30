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
character-guide and team records: 1,075 occurrences in total. Of 188 guide
builds, 167 are initially enumerated, 14 are conditionally representable, and
7 are not representable by the current grammar. Of 840 team-member selected
artifacts, 820 are initially enumerated, 7 are conditional, and 13 are not
representable. Of 45 character-guide and team-member recommendation
occurrences, 37 are initially enumerated and 8 are not representable. Two more
occurrences are the assignments in one coupled Kokomi/Columbina artifact plan;
both are initially enumerated individually. The 28 failures are 19 Instructor
occurrences, 2 Exile occurrences, 5 two-piece combinations absent from the
dynamic half-set map, and the Thundersoother and Retracing Bolide occurrences
excluded by the current tier-list-derived four-piece candidate policy.

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

The consolidated repository has 1,026 non-ER weapon occurrences: 127 entries
in character-guide weapon orders, 840 selected exact-team weapons, and 59
character-guide recommendation entries. The last group includes the Itto source
slice's four contextual weapons and Xiao's 14 choices. There are no team-member
weapon recommendations yet.

All 1,026 weapon IDs occur in the global released candidate domain. Refinement
is a separate axis: none of the 1,026 observations supplies one, so the report
has 0 exact candidate pairs and 1,026 unspecified refinements. Native type is
also separate: 1,014 observations are compatible and 12 are mismatched. Every
mismatch is a selected weapon from the legacy candidate source; baseline and
KQM records have none.

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

## Source-scoped role-sample seams

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

`src/sourceScopedRolePairSample.ts` generalizes the structural check to exactly
two source-scoped role records, but only over explicit published exact-team
targets supplied by a wrapper. It requires the template, roles, and targets to
remain candidate and promotion-ineligible, and validates exact role-slot application,
lineage, eligible identities, member bindings, constellation bounds, exact
condition-text acknowledgements, complete slot bindings, and structural
multiplicity. Every target must pass or the combined result is withheld. Target
and binding order, including binding-object key order, is canonicalized for
deterministic output.

The Keqing wrapper pins the full captured member objects for the off-field-Hydro and
resistance-shred records, both with unspecified exhaustiveness and no rank. It
evaluates exactly the four same-page teams that publish Furina/Xilonen,
Aino/Sucrose, Furina/Jean, and Yelan/Kazuha pairings. Xingqiu, Sayu, and Xianyun
remain unexercised positive evidence. No other cross-role member pair is
constructed or judged. The exact Viridescent Venerer strings for Jean, Sucrose,
and Kazuha are reported as acknowledged text equality, not gameplay
verification.

The paired wrapper records all seven participating indexed extraction states,
requires the exact KQM page URL, reuses the independent checked-in catalog
fingerprints, and requires the Keqing template to remain
`withheld-unresolved-role` in both a fresh core replay and the checked-in
roster-domain report. The durable output contains named role evidence and four
targets but no global role catalog, expanded pair domain, team ranking, damage,
equipment, stat, or ER result.

## Source-conditioned guide-packet projection seam

`src/sourceConditionedGuidePacket.ts` is a descriptive projection core. It
retains atomic source claims once and evaluates a wrapper-supplied typed
predicate tree against exact source-team rosters. Predicate conjunction uses
the fail-closed precedence false, deferred, unknown, then true. Every condition
array is pinned by hash to its typed predicate; the core does not parse arbitrary
source prose. It authenticates a durable report only by rebuilding the complete
canonical result from current typed inputs.

The Itto wrapper retains 7 grouped stat entries, 4 artifact groups, and 4
weapon groups as 15 claims, then projects them across three exact source teams
for 45 cells. All three teams match the Furina/Marechaussee Hunter predicate and
reject the Xianyun-dependent Long Night's Oath and Fruitful Hook predicates.
The remaining 36 cells are withheld: 27 need non-roster gameplay, buff,
inventory, or preference context and 9 keep the deliberately omitted energy
prerequisite as a separate deferred subtype.

The wrapper also invokes the current roster-domain runtime boundary. The Yelan
and Xingqiu PHEC examples are accepted with structural multiplicity two and a
true Crystallize representation. The separate C2+ Xilonen/Gorou/Furina example
is structurally rejected by the PHEC template with multiplicity zero. Only that
roster overlaps a GenshinTools preset; its source C2+ Xilonen against baseline-
unspecified Xilonen remains unresolved in a constellation-only comparison.
Talent levels and baseline equipment are not evaluated or joined.

This seam assembles zero builds and runs no generator, optimizer, formula,
rotation, damage, ranking, ideal-roll, or ER calculation. It is validation of
unreviewed source-condition bookkeeping, not a guide or gameplay result.

## Request/account-context applicability seam

`src/guideRequestContext.ts` overlays typed request and account facts on an
immutable source-conditioned packet. A wrapper may replace only a pinned
`unresolved-context` leaf. Every binding identifies the claim, source-condition
array, full source predicate, leaf path, and leaf hash; exact-team facts and
deferred-energy prerequisites cannot be replaced. Request facts are scoped to
an exact team, with character role and optimization goal scoped further to one
member. Weapon inventory is account-scoped and distinguishes complete from
incomplete coverage, so an absent weapon is false only in a declared complete
inventory. Account facts also retain an explicit snapshot identity.

The request vocabulary also supports exact-team, exact-character numeric facts
for constellation and named Auto, Skill, or Burst Talent levels. Constellation
facts and thresholds are safe integers from 0 through 6; Talent facts and
thresholds are positive safe integers. In addition to lower-bound predicates,
`constellation-at-most` is unknown when its fact is omitted, true at or below
its threshold, and false above it; `talent-level-is` is unknown when its named
fact is omitted, true for exact equality, and false for another supplied level.
`all` and `any` retain three-valued semantics: `all` is false if any child is
false, true only if every child is true, and unknown otherwise. No
constellation fact derives a Talent level. These values have request provenance,
not verified account-investment provenance.

The Itto adapter uses a strict synthetic fixture with three independent
contexts. Its two-key control gate requires the checked-in checkpoint 23 report
to match a fresh canonical rebuild, then projects each context over all 45
source cells. The 135 results contain 21 source-unresolved-to-applicable
transitions. The six unique non-ER source cells for DEF Goblet and Retracing
Bolide remain outside the current grammar, and 27 repeated ER-tail cells remain
deferred. Source results and predicate rows are retained verbatim with hashes;
context applicability is recorded separately.

This seam does not authorize source claims, recommend account actions, combine
the contexts, compose a build, or compute a score, rank, formula, rotation,
damage result, ideal allocation, or ER requirement.

## Source-local condition-slice seam

`src/sourceLocalConditionSlice.ts` is a reusable, source-local composition of
the existing typed source-condition evaluator and strict request-context
evaluator. It accepts only exact condition occurrences and exact teams from one
source document. Occurrences are pinned by source, record, schema path,
ordered-array hash, predicate hash, payload hash, and repository parity.
Request facts are scoped independently to an exact team and character, may
refine only an `unresolved-context` leaf, and cannot replace a source-owned
roster result or deferred-energy prerequisite. The source result and the
context result remain separate.

The first adapter, `src/kleeSourceLocalConditionSlice.ts`, selects four of the
15 condition occurrences on the authenticated KQM Klee Luna IV page: three
on-field-role main-stat rows and the Marechaussee Hunter row conditioned on a
Furina roster. The other 11 exact occurrences are holdouts and receive neither
a binding nor an energy classification from this slice. Across two exact source
teams, the four selected occurrences form eight cells. Source evaluation is 1
matched, 1 inapplicable, and 6 unresolved. Supplying Klee's `on-field-dps`
intent independently for each team makes the effective partition 7 matched and
1 inapplicable; the two roster results remain source-owned.

The adapter authenticates four raw inputs and 13 exact generated-from paths,
requires the selected/holdout partition to close all 15 Klee occurrences, and
compares durable output with a fresh canonical rebuild before downstream use.
Its capabilities for recommendation composition, assembled builds, ranking,
generation, optimization, formulas, rotations, damage, ideal rolls, and ER are
all disabled. Context applicability is not a recommendation or a claim that a
preserved payload is best.

The second integrated adapter, `src/dionaSourceLocalSupportSlice.ts`, selects
three artifact condition occurrences from the exact
`kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt` record: Diona member 0,
Citlali member 2, and Bennett member 3. All three source cells remain unresolved
gameplay-role predicates. Independent support facts scoped to the exact team and
respective character make the effective partition three matched. The source
result and context result remain distinct.

The adapter preserves Diona's Song of Days Past/Noblesse Oblige alternatives,
Citlali's Scroll of the Hero of Cinder City singleton, and Bennett's Noblesse
Oblige/Instructor alternatives in source order. It performs no choice,
assignment, comparison, or composition. The Diona snapshot closes 26 condition
arrays as 18 nonempty and 8 empty. Three are selected; 15 nonempty occurrences
remain holdouts, descriptively inventoried as 10 ordinary and 5 ER-deferred.
The slice consumes, binds, and energy-classifies zero holdouts.

The standalone `src/kokomiSourceLocalArtifactSlice.ts` selects one exact
team-member condition from the KQM Kokomi Luna V page. The team record is
`kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example`, with exact
ordered roster Sangonomiya Kokomi, Ineffa, Columbina, and Sucrose. The selected
member-0 payload is one 4pc Ocean-Hued Clam group with source classification
`recommended` and source ordering `unranked`.

Its typed predicate is the ordered four-member exact-roster conjunction. The
source cell matches directly, so the context projection is `source-already-
matched` and carries zero request facts or bindings. The Kokomi snapshot closes
five nonempty and zero empty condition arrays: one selected plus four exact
holdouts. The slice consumes, binds, and energy-classifies none of those
holdouts. Checkpoint 30 admits only that selected occurrence to the current
catalog after source-specific authentication and extraction checks; the four
holdouts remain outside.

The standalone `src/noelleSourceLocalHighInvestmentSlice.ts` selects three
exact main-stat occurrences from the KQM Noelle Luna VIII high-investment
branch: DEF% Sands, Geo DMG Bonus Goblet, and CRIT Rate/CRIT DMG Circlet. All
three retain condition-array SHA-256
`92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4`
and independent payload hashes. They are projected over the exact
`kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii` source team.

The source predicate remains one unresolved `investment-threshold` leaf and
the source evaluator retains `talentLevelsEvaluated: false`. Only the wrapper-
owned request mapping evaluates `any(constellation >= 6, burst talent >= 10)`.
The durable context supplies Noelle C6 and omits Burst Talent level, making all
three cells applicable and effectively matched while the omitted branch stays
unknown. The wrapper does not infer Talent behavior from constellation, parse
source prose, or make its cross-record join source-authored.

The exact Noelle boundary contains 16 arrays: three selected, 12 nonempty
holdouts, and one empty occurrence. Holdouts and the empty occurrence remain
unconsumed and receive no slice-authored binding or energy classification. The
slice creates zero candidates, equipment assignments, optimizations, and
assembled builds. Checkpoint 32 admits only the three selected occurrences to
the current condition-binding catalog after a separate source-specific
authentication gate; the 12 holdouts and empty occurrence remain outside.

The standalone `src/noelleSourceLocalLowerInvestmentSlice.ts` selects the three
parallel C0-C5/Burst-Talent-9 main-stat occurrences: ATK% Sands, Geo DMG Bonus
Goblet, and CRIT Rate/CRIT DMG Circlet. The source predicate remains one
unresolved `investment-threshold` leaf. The wrapper-owned request mapping is
`all(constellation <= 5, burst talent == 9)`; independent C5 and Burst Talent 9
request facts scoped to the exact Noelle/Durin/Nicole/Xilonen team and Noelle
subject make all three effective cells matched while all three source cells
remain unresolved. Source Talent-level evaluation stays false, and the cross-
record team validation is not source-authored applicability.

The lower slice also closes the exact 16-array boundary as three selected, 12
nonempty holdouts, and one empty occurrence. No substat row is selected. The
holdouts and empty row are unconsumed and receive no slice-authored binding or
energy classification. Its report authenticates four raw inputs and 13
generated-from paths and creates zero candidates, equipment assignments,
optimizations, or assembled builds. Its source-local report remains standalone;
checkpoint 34 separately admits only the three selected occurrences downstream
after fresh source-specific authentication. The report total remains 31.

## Manual condition-array coverage seam

`src/manualConditionArrayCoverage.ts` traverses only the condition-array fields
defined by the manual snapshot schema. It retains each ordered array at its
exact source and repository path, preserves duplicates, and proves one-to-one
parity for all 163 current guide-selected occurrences across eight snapshots
and 71 records. The ninth indexed snapshot is the separate Xiao rotation
fixture and contributes no condition array. The repository is a consolidation
target, not a second evidence corpus. An independent recursive audit runs on
the raw snapshot values before schema parsing and requires every `conditions`
property to match one extracted path and ordered payload, so future or unknown
condition-bearing fields fail closed.

Indexed manual snapshots also pass a source-policy gate before parsing: their
source must have exactly one active registry entry, use the manual-observation
V1 mode and format, and not require permission. Crimson Witch is currently
blocked and permission-required, so it cannot enter this seam.

`src/currentConditionBindingCatalog.ts` overlays only eight authenticated
current wrapper families: Itto typed predicate ASTs, Keqing equipment predicate
IDs, exact-text Keqing Viridescent Venerer acknowledgements, and the four Klee
plus three Diona plus one Kokomi plus three high-investment and three lower-
investment Noelle source-local typed bindings.
Source-local catalog entries share the generic
`source-local-typed-predicate-ast` and
`source-local-not-energy-deferred` evidence labels, but wrapper authentication,
extraction, occurrence identity, literals, hashes, and `sliceId` remain source-
specific. A binding is addressed by source, record kind, source record, schema
path, ordered-array hash, and subject. Stale or non-comparable upstream reports,
partial expansions, duplicate or conflicting keys, subject mismatches, or a
durable source-local report that differs from its fresh source-specific rebuild
make the inventory non-comparable rather than converting evidence to an unbound
result.

A private normalized helper performs only the common selected-occurrence to
source-claim to condition-control parity check and catalog-entry construction.
Each wrapper must first validate its own page/version, raw closure, exact
selected and holdout sets, team/member/subject identity, condition text and
hash, predicate and hash, payload and hash, recommendation metadata, request-
binding boundary, and capability flags. The helper is not a generic wrapper,
extractor, schema adapter, or prose parser.

The durable report keeps binding and energy as independent ledgers. Across 20
empty and 143 nonempty arrays, the current catalog contributes 63 entries: 60
typed and 3 exact-text acknowledged. Nonempty binding coverage is therefore 60
typed, 3 acknowledged, and 80 unbound. Excluding only the three structural ER
arrays leaves 140 rows: 60 typed, 3 acknowledged, and 77 unbound, spanning 102
exact ordered arrays. Those arrays contain 34 typed-only sets, 67 unbound-only
sets, and one mixed acknowledged/unbound Viridescent Venerer set.

The energy ledger marks three structural ER arrays, three typed Itto energy
prerequisites, and nine exact authored Diona/Furina energy-sensitive arrays as
deferred. Fifty-seven typed rows are explicitly not energy-deferred; 71
nonempty rows remain energy-unclassified; and 20 empty arrays are
unconditional. An unclassified row is not presumed non-ER. Exact-text equality
does not establish gameplay execution, and typed mapping does not establish
that a predicate is true for a team or account.

Display status is a separate projection over all 163 occurrences: 57 typed, 68
known-but-unbound, 15 ER-deferred, 3 acknowledged, and 20 unconditional. Manual
coverage authenticates eight wrapper families across 19 source files and 77
generated-from paths.

The Noelle catalog path first requires the durable report to equal a fresh
source-specific rebuild, then authenticates the exact source identities,
numeric request projection, three selected occurrences, 12 holdouts, one empty
row, and disabled capability boundary. Only the selected three become typed and
not energy-deferred; the holdouts and empty row receive no new state.

Checkpoint 34 separately adds only the lower-investment slice's three selected
rows to this path after durable/current equality and the full lower-specific
authentication boundary. The 12 holdouts and one empty row remain outside the
catalog. The resulting catalog is 63; the non-structural partition is 60/3/60,
the unique-array partition is 34/51/1, the energy ledger is 15/57/54/16, and
the display projection is 57/51/15/3/16.

The dependency direction remains acyclic. Authenticated source-specific Klee,
Diona, Kokomi, and both Noelle wrappers feed the 63-entry binding
catalog, then manual coverage and the regenerated checkpoint 27 Klee witness.
The validator follows that order. The generic source-local core and source-
specific wrappers never import the downstream catalog, coverage report, or
witness.

This seam runs no arbitrary-English parser, recommendation composer, generator,
optimizer, formula, rotation, damage, ranking, ideal-roll, or ER calculation.
Its output is an authenticated validation backlog, not a guide.

## Flat team-scoped claim-join witness seam

`src/kleeTeamScopedClaimJoinWitness.ts` consumes the authenticated Klee source-
local slice and authenticated manual condition coverage through a one-way
dependency boundary. It fresh-authenticates the durable Klee slice from raw
inputs, requires the current coverage report to remain comparable, and cross-
links exactly the same four occurrence identities, source claims, source cells,
request projections, selected-occurrence controls, and coverage rows. Any raw-
input, upstream-report, path, hash, subject, roster, resolution, or payload
drift makes the witness non-comparable.

The one positive witness is a flat set for the exact
Klee/Furina/Albedo/Xilonen source team. Three on-field main-stat claims are
applicable under explicit team-scoped Klee role facts, while the 4pc
Marechaussee Hunter claim is source-matched by Furina's roster presence. The
four independent claims come from two source records. CR/CD remains one
unchosen payload group; the seam neither expands it nor evaluates the joint
compatibility, completeness, effectiveness, or optimality of any payloads.

The exact Klee/Chevreuse/Durin/Fischl team is retained as a separation control.
Its three role claims are applicable under a separately scoped role fact, but
the Furina-conditioned Marechaussee Hunter claim remains source-definitely-
inapplicable, so the control cannot produce a positive witness. The cross-record
join and role fixtures are explicitly Guide Factory-authored rather than KQM-
authored.

The seam consumes zero of the 11 Klee holdouts and produces zero builds and
zero candidates. It runs no payload-axis expansion, choice selection,
compatibility evaluation, cross-product, recommendation composition, ranking,
generator, optimizer, formula, rotation, damage, ideal-roll, or ER calculation.
Independent applicability is validation evidence, not a build or guide.
Checkpoint 33 regenerates the durable witness against hash-refreshed manual
coverage. The generic predicate additions regenerate seven existing reports
for hash/dependency changes only and update the checkpoint 32 catalog's
`generatedFrom` pin without changing catalog entries or ledgers. The witness's
four Klee claims, positive team, negative control, and interpretation boundary
remain unchanged.

Checkpoint 34 regenerates manual coverage and the witness after the separate
lower-investment catalog admission. Manual coverage authenticates 19 source
files and 73 generated-from paths. The witness authenticates six source files,
76 generated-from paths, and 63 upstream bindings while preserving the same
four Klee claims, positive team, negative control, zero consumption of 11 Klee
holdouts, and interpretation boundary.

The completed checkpoint 34 verification passes TypeScript, 62 test files with
464 tests, and validation with 0 errors and 12 existing warnings. Its durable
report total remains 31.

## Isolated sign-only evidence triangulation seam

Checkpoint 35 adds a standalone Keqing wrapper over exactly five authenticated
inputs: the isolated ArtifactRatingDB snapshot, consolidated knowledge
repository, existing four-endpoint local-marginal diagnostic, raw KQM Keqing
snapshot, and existing Keqing Lunar equipment-evidence report. The wrapper
requires raw-KQM/repository recommendation parity and independently verifies
the equipment report's exact-team, default-main-stat, and eight-claim
projections: seven exact-team matches and one unresolved secondary condition.
The cross-record join is Guide Factory-authored validation only.

The report emits ten stable, explicitly unranked rows. Four pair a nonzero
ArtifactRatingDB heuristic coefficient with an all-positive Keqing local-
marginal sign, four pair a zero coefficient with an all-zero sign, Elemental
Mastery is retained as an objective-coverage gap, and Electro DMG Bonus is
retained as source-main-stat-only because it is outside the nine-stat marginal
perturbation domain. Only sign/zero classifications and endpoint identities
cross the local-diagnostic boundary.

No coefficient magnitude is compared with a marginal magnitude. No KQM
priority number is sorted or treated as a validated order. ArtifactRatingDB's
unknown team, role, weapon, constellation, and scenario prevent any claim of
cross-source context comparability. The reaction-free technical objective
retains eight readiness blockers, so the Elemental Mastery row is an objective
coverage gap rather than a source disagreement.

Both source `SPRatioBase` occurrences remain deferred evidence. The report
executes no ER calculation and produces no guide, rank, scalar stat weight,
promotion, recommendation, candidate, optimizer result, or ideal-stat
allocation. It is durable report 32, but its mixed permission and blocked
consolidation state keep it outside the shared registry, consolidated
repository, condition catalog, global validator, application, and Worker.

Checkpoint 35 passes Guide Factory TypeScript, 63 test files with 487 tests,
application TypeScript, and dependency-boundary validation. At that checkpoint,
the next bounded non-ER gate was a generic source-backed four-character
equipment candidate lattice; it was required not to reinterpret this sign-only
seam as weight, priority, recommendation, or context-equivalence evidence.

## Authenticated source-backed equipment lattice

Checkpoint 36 adds a generic finite-product core and one source-specific
Keqing/Ineffa/Furina/Xilonen wrapper. The core, committed separately as
`3e6982a1`, validates exact four-member/eight-axis structure, source-local
group metadata, bounded count arithmetic, deterministic node IDs, domain
membership, and complete Cartesian coverage. It does not authenticate source
claims or evaluate equipment.

The wrapper authenticates nine direct files spanning the consolidated
repository, raw and normalized source snapshots, source registry/index, live
build preset, prior equipment evidence, and weapon/artifact coverage. It
retains nine groups/lists with 20 occurrences: 14 active, four fixture-scope
holdouts, one C6 investment holdout, and one ER-derived artifact-choice
holdout. Active preset builds project artifact identity only; their main-stat,
substat, and ER-weight fields do not enter the lattice.

The eight active domains have cardinalities `3, 2, 1, 1, 3, 2, 1, 1`. Their
complete product contains 36 nodes and 288 references. KQM group ordering, the
two-member tie, the later alternative, conditional artifact alternatives, and
preset list indexes are retained. `sourceLocalRank` is null throughout because
none of these source records supplies a numeric rank value.

Exact-team facts, the R5 request map, and a named request assumption resolve
the three structural Keqing conditions separately. These resolutions do not
establish gameplay applicability. Preset team applicability is unknown, and
the KQM warning about Xilonen generally being unable to activate Scroll for
Hydro remains attached.

The roster and active member occurrences are source-backed, but every
weapon/artifact pairing and cross-character composition is wrapper-authored.
There are zero source-published whole candidates and zero gameplay-validated
candidates. The module performs enumeration only. Team/equipment
recommendations, optimality, rank, evaluation, candidate generation,
optimization, damage, guide production, gameplay validation, and ER all remain
disabled.

The report is durable evidence 33 and global report 32. Checkpoint 36 passes
Guide Factory TypeScript, 65 test files with 554 tests, validation with 0 errors
and 12 existing warnings, application TypeScript, and dependency-boundary
validation. At that checkpoint, materializing and preflighting the 36 nodes was
the next unimplemented non-ER computation boundary.

## Authenticated runtime materialization preflight

Checkpoint 37 adds a generic lattice-to-runtime core and one source-specific
Keqing/Ineffa/Furina/Xilonen wrapper. The wrapper authenticates the declared
non-self checkpoint input set containing selected upstream/runtime dependencies
across 38 declared paths for checkpoint 36's complete 36-node lattice and the
exact 11-line Keqing/Ineffa formula draft. The set excludes the source-specific
producer, CLI, and emitted report to avoid self-reference; it explicitly makes
no exhaustive or transitive module-graph claim. The wrapper establishes
caller-side source binding while the generic core records that it establishes
no source binding itself.

All 14 active lattice occurrences have one exact payload-and-equipment
resolution. The core requires each node to select exactly one weapon and one
four-piece artifact set per member and rejects missing, extra, duplicate,
drifted, partial, non-four-piece, ER-bearing, or registry-unresolvable inputs.

The wrapper supplies one explicit technical environment: all members at level
90, C0, talents 10/10/10; enemy level 110 and resistance 0.1; roll multiplier
0.85 and budget `8_6`; empty options, null aura, no extra buffs; and all four
members as carry IDs. These values are wrapper-owned runtime assumptions, not
source-authored guide facts. ER thresholds and per-character constraints are
null.

The core creates 36/36 fresh existing-runtime `TeamBuild` instances and checks
exact order, investment, weapon, refinement, four-piece artifact set, hashes,
and formula availability. It completes 396 objective checks (36 x 11) and 180
non-null unresolved-reference checks (36 x 5). It evaluates no formula and
executes zero generator, replay, damage, scoring, ranking, recommendation,
optimization, or ER calls.

The exact upstream readiness closure remains active: one
`translation-unreviewed`, one `partial-token-mapping`, five
`unresolved-formula-mapping`, and one `unresolved-source-token` blocker. Thus
all nodes are runtime-ready and materialized, but zero are evaluator-ready.
Runtime compatibility does not establish rotation order, buff timing, field
time, hit counts, reaction ownership, gameplay applicability, or damage.

The 555,200-byte report has byte SHA-256
`df5f8d938223063d82cee70cbaf57dd666d10b01b95743e3d84f9e433b9698ec`.
It is durable evidence 34 and global report 33. Checkpoint 37 passes Guide
Factory TypeScript, 67 test files with 598 tests, validation with 0 errors and
12 existing warnings, application TypeScript, and dependency-boundary
validation.

## Authenticated bounded full-team technical computation

Checkpoint 38 adds a generic fail-closed bounded computation core and one
source-specific Keqing/Ineffa/Furina/Xilonen wrapper. The generic core consumes
a complete authenticated runtime preflight, checks generator and replay caps
with decimal `bigint` arithmetic before bootstrap, audits a distinct runtime
identity for every node/carry, deduplicates complete sheet dumps within each
node, and enumerates only the complete node-local Cartesian product. Incomplete
nodes do not produce node references, and an incomplete overall domain produces
no global reference.

The source-specific wrapper authenticates a 64-path declared non-self selected
checkpoint set. It binds checkpoint 37's durable report and authentication
surfaces, the generic checkpoint 38 core, selected generator/artifact-sheet and
replay inputs, current runtime data, calculator core files, and the relevant
artifact, character, and weapon implementations. The source-specific producer,
CLI, and output report are deliberately excluded to avoid self-reference. This
is not an exhaustive dependency closure and makes no transitive module-graph
claim. Notably, `artifact2pc.ts` remains in the selected set because four-piece
builds automatically apply their declared two-piece half-set.

The checkpoint 37 report is the authenticated trust root. Its nested 36-node
generic preflight must remain complete, with the same exact equipment
resolutions, objective envelope, wrapper-owned runtime assumptions, and eight
readiness blockers. The source supports the four-character roster only. The
rotation text is merely upstream input to the unreviewed wrapper-authored
formula translation, not source support for the resulting technical damage
plan. Equipment, investment, generated artifact stats, formula mapping,
levels, talents, enemy context, and artifact roll budget are not source facts.

After source-specific authentication succeeds, the exact default environment
creates the real `TeamBuild` instances. The generic core itself authenticates
runtime-identity freshness rather than a concrete class. The real default
environment completes:

- 36 equipment nodes;
- 144 generator calls and 144 distinct fresh runtime identities;
- 364 deduplicated node-local compositions and 364 successful replays;
- 139 compositions matching at least one intact four-character generator
  endpoint and 225 cross-endpoint recombinations; and
- interpreted/compiled agreement for every replay within the implementation's
  absolute and relative tolerance.

There is no cross-node sheet composition. All 36 node-local bounded technical
references are cross-endpoint recombinations and therefore must not be called
generator-produced. The complete-domain technical reference is
`926093.666196721`; the best intact-endpoint technical reference is
`914219.528685479`; and the exact result fingerprint is
`ea78f4ea4252bd2b39cfe9d99fb0a7ba37d172e2095c628f9df07d82825392b5`.
These values describe the exact finite table under an unreviewed objective. A
deterministic fingerprint and direct/compiled agreement do not independently
validate game damage or applicability.

Checkpoint 38 is durable evidence 35 and global report 34. The checked-in
2,011,434-byte report has SHA-256
`c1e62f94d50be01cb5a8b24f2b419a9e52ecafad6829320e2341322691111063`.
The 69-file Guide Factory suite passes 642 tests with one intentional opt-in
skip; validation has zero errors and the same 12 existing warnings. Generator
and damage-computation execution are true only as operation facts. Source, guide,
team/equipment recommendation, rank, damage, DPS, gameplay, optimality, ER, and
promotion claims all remain false. This is neither a working guide factory nor
an equipment recommendation.

## Authenticated generated-sheet and displayed-allocation evidence

Checkpoint 39 adds a generic capture core and a source-specific wrapper around
the exact checkpoint-38 runtime domain. Before executing the real default
runner, the wrapper authenticates five selected non-self inputs: the durable
checkpoint-38 computation, generic capture core, source-specific target builder,
semantic target-scope builder, and scoped-semantic dependency implementation.
The semantic scope binds 11 exact dependencies and 26 normalized source/
consolidated parities without treating unrelated repository drift as relevant.
This set is not an exhaustive or transitive runtime dependency closure. After
execution, the wrapper binds the exact generic result and full report payload.

The real default run retains 144 fresh captures across 36 nodes and four carry
IDs, producing 576 node/carry/character occurrence contexts. It content-
addresses 21 unique generated sheets and 23 stable displayed allocations; two
sheets map to two displayed allocations. Each allocation round-trips through
`StatSheet.fromArtifacts` within the declared display-rounding envelope. Exact
substat roll tiers and counts are not recoverable from rounded display values,
so they remain null.

Each occurrence contributes three main-stat and five unique positive non-ER
substat membership rows. The resulting 4,608 rows join to 17 authority-labelled
targets through the exact node/carry/character occurrence rather than a global
sheet ID. Their display states total 816 resolved, 48 condition-withheld, 2,202
baseline-context-unknown, and 1,542 non-exhaustively unlisted. The report keeps
all applicable/matching target IDs, 3,858 target match edges, 864 source
partial-order observations, conflicts, and zero-match targets. None becomes a
weight, rank, recommendation, correctness verdict, or exhaustive absence.

Checkpoint 39 executes zero separate damage replays, downstream optimizer
calls, ranks, recommendations, or guide production. Generator-internal
objective optimization is recorded only as an operation fact for the real
default environment. ER main stats, substats, floors, and post-ER priority
claims are retained only as deferral provenance.

Checkpoint 39 is durable evidence 36 and global report 35. The checked-in
17,499,104-byte report has SHA-256
`d6b8f196891ee122a9ce8267f7da7efae3e7e39076b5babf28c3d352b56e6b4a`.
Guide, recommendation, rank, scalar-weight, damage, gameplay, optimality, ER,
and promotion claims all remain false.

## Authenticated cached coordinate-policy audit

Checkpoint 40 consumes the authenticated checkpoint-38 and checkpoint-39
reports plus the cached-policy implementation, but emits only a compact
projection. Its four active dimensions have exact `3 x 2 x 3 x 2` closure;
Ineffa and Xilonen equipment remain fixed. The report retains 36 technical
nodes, 576 exact occurrence diagnostics, and 4,608 non-ER comparison rows
without embedding either upstream report.

From source sequence 0, the one-shot best-neighbor policy follows `0 -> 1`,
iterative best improvement follows `0 -> 1 -> 7`, and declared-order first
improvement follows `0 -> 1 -> 13`. Sequence 7 is the exhaustive cached-table
reference for this exact finite domain. Sequences 1 and 13 fall short by
`0.785708566169412%` and `0.531264473403165%` under the same unreviewed
objective. These are policy-adjacency observations, not ranks or advice.

Checkpoint-39 review diagnostics are attached only through exact
node/carry/character identity and are excluded from the objective and every
policy filter. The default environment attests zero fresh evaluator, generator,
damage replay, downstream optimizer, rank, recommendation, and ER calls. Those
counts and ER influence remain null for injected callbacks. Authentication
reads checkpoint-39 ER-deferral provenance, while no ER value is projected into
the policy table.

Checkpoint 40 is durable evidence 37 and global report 36. The checked-in
2,029,334-byte report has SHA-256
`a2ce1d99443deb81a9559bb0aed9c4d378aefa5d564d2f16074a82fadd987a46`.
Guide, recommendation, rank, scalar-weight, damage, gameplay, global-
optimality, ER, and promotion claims all remain false.

## Authenticated cached-policy robustness census

Checkpoint 41 authenticates checkpoint 40 plus the cached-policy and census
implementations, then projects only the ordered 36-node table, declared order,
direction, and tolerance. One-shot and best improvement run from all 36 starts;
declared first improvement runs over all 864 structurally effective orders for
31,104 traces. Best improvement has 24/12 terminal basins. Declared order has
18,576/12,528 terminal outcomes, 13 start partitions, 96 all-start path
families, and paths of at most seven moves.

The default census reports 31,177 cached-policy calls and zero fresh generator,
evaluator, replay, downstream-optimizer, recommendation, rank, or ER calls. It
reads upstream ER-deferral provenance only for authentication and projects no
ER value. Checkpoint 41 is durable evidence 38 and global report 37. Its
71,373-byte report has SHA-256
`c446dec2027cc2b77d20d46ea8d521d3ae4f43f798f34715a4c4ddb771ac2b73`.
Guide, recommendation, rank, scalar-weight, damage, gameplay, global-
optimality, ER, and promotion claims all remain false. The next non-ER boundary
should use the expanded repository for a second character/team slice.

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
- All-start/all-order cached-policy census and compact path partitions:
  `scripts/guide-factory/src/boundedLatticePolicyCensus.ts`.
- Full-team non-ER local marginals with fail-closed multi-endpoint ranges:
  `scripts/guide-factory/src/teamStatMarginalDiagnostic.ts`.
- Bounded full-team node-local generator/replay execution with intact versus
  cross-endpoint provenance:
  `scripts/guide-factory/src/boundedFullTeamEquipmentTechnicalComputation.ts`.
- Isolated ArtifactRatingDB/KQM/local-marginal sign-only validation:
  `scripts/guide-factory/src/keqingArtifactRatingKqmMarginalValidationSlice.ts`.
- One named source-scoped role binding without a global resolver:
  `scripts/guide-factory/src/sourceScopedRoleSample.ts`.
- Two source-scoped roles checked only against configured published pairs:
  `scripts/guide-factory/src/sourceScopedRolePairSample.ts`.
- Source-conditioned Keqing equipment/stat evidence checked against exact
  rosters, the baseline guide, and real search-coverage builders:
  `scripts/guide-factory/src/keqingLunarEquipmentEvidenceValidation.ts`.
- Source-local equipment groups and stat claims projected onto exact rosters
  without constructing a cross-product:
  `scripts/guide-factory/src/keqingLunarSourceConditionedCandidateLattice.ts`.
- Generic typed source-condition projection and the bounded Itto adapter:
  `scripts/guide-factory/src/sourceConditionedGuidePacket.ts` and
  `scripts/guide-factory/src/ittoSourceConditionedGuidePacket.ts`.
- Generic typed request/account applicability and the bounded Itto adapter:
  `scripts/guide-factory/src/guideRequestContext.ts` and
  `scripts/guide-factory/src/ittoRequestContextApplicability.ts`.
- Generic source-local condition evaluation and the catalog-integrated Klee,
  Diona, Kokomi, high-investment Noelle, and lower-investment Noelle adapters:
  `scripts/guide-factory/src/sourceLocalConditionSlice.ts`,
  `scripts/guide-factory/src/kleeSourceLocalConditionSlice.ts`,
  `scripts/guide-factory/src/dionaSourceLocalSupportSlice.ts`,
  `scripts/guide-factory/src/kokomiSourceLocalArtifactSlice.ts`,
  `scripts/guide-factory/src/noelleSourceLocalHighInvestmentSlice.ts`, and
  `scripts/guide-factory/src/noelleSourceLocalLowerInvestmentSlice.ts`.
- Exact manual condition extraction, repository parity, and authenticated
  current-wrapper coverage:
  `scripts/guide-factory/src/manualConditionArrayCoverage.ts`,
  `scripts/guide-factory/src/currentConditionBindingCatalog.ts`, and
  `scripts/guide-factory/src/manualConditionArrayCoverageReport.ts`.
- Authenticated flat same-team Klee claim-join witness over those two upstream
  boundaries:
  `scripts/guide-factory/src/kleeTeamScopedClaimJoinWitness.ts`.

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
- The current knowledge records do not specify refinements for any of the 1,026
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
- The repository now has three source-scoped role observations, but neither the
  one-member Furina healer slice nor the two unreviewed Keqing positive lists
  define a global role catalog. The Keqing pair seam deliberately exercises
  only four exact published pairs and leaves three members unexercised;
  contextual conditions, constellation boundaries, overlaps, and source
  disagreements still need broader attributed evidence before role-based roster
  expansion is safe.
- Source guide applicability remains attributed prose in repository records.
  The exact inventory now identifies 60 non-structural occurrences as unbound;
  it does not parse them or presume they are non-ER. Nine are exact authored
  energy deferrals and the remaining 54 are energy-unclassified. The Keqing,
  Itto, Klee, Diona, Kokomi, and Noelle source-specific wrappers pin exact text
  to typed predicates and can resolve only their authored facts; they are not a
  global parser. The shared request-context vocabulary covers bounded role, goal,
  weapon-ownership/passive, preference, constellation, and named Talent-level
  facts, including lower-bound, constellation-at-most, and exact named-Talent
  comparisons. The high-investment Noelle slice applies its numeric subset only
  to three exact occurrences; checkpoint 32 admits those three while its 12
  nonempty holdouts receive no binding or energy state. The lower-investment
  slice independently authenticates three occurrences under C5 and Burst
  Talent 9 request facts; checkpoint 34 separately admits only those three while
  its 12 nonempty holdouts and one empty occurrence remain outside the catalog.
  High Base ATK, DMG Bonus, exceptional EM, contribution ownership, refinement,
  shield uptime, Bond clearance, CRIT overcap, artifact quality, comparative
  thresholds, gameplay, and omitted-energy inputs remain explicitly unresolved
  or deferred.
- The source evidence now exposes four artifact-search gaps: 4pc
  Thundersoother and three traditional 2pc combinations are recorded but not
  representable by the current candidate path. Search coverage is therefore a
  discrepancy report, not proof that the source options can be optimized.
- V1 has no atomic weapon-plus-artifact recommendation. The KQM Whimsy plus
  Finale claim is intentionally not flattened into independent choices.
- The first candidate lattice remains classification-only. Its separate
  authored composition contract and eight-cell technical matrix now exist, but
  neither promotes the unreviewed source evidence or blocked formula fixture
  into a guide, source-authored build, or gameplay comparison.
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
