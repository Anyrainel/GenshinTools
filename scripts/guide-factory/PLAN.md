# Living Plan

This plan records the direction, not a promise that the current formats or
algorithms will survive contact with real data.

## 1. Accumulate source knowledge

- Add one source manifest before adding observations from that source.
- Prefer deterministic adapters for internal or explicitly reusable structured
  data.
- Use manual or agent-assisted proposals for unstructured editorial sources.
- Preserve missing assumptions as `unknowns`.
- Keep source-native records separate; do not join team and character advice
  merely because their IDs happen to match.

Questions to learn from real data:

- Which sources express actual rankings, tied groups, or just examples?
- How often are recommendations conditional on a team, constellation, weapon,
  or ER assumption?
- Which source formats remain stable enough for deterministic adapters?
- Which sources need permission before systematic ingestion?

## 2. Consolidate without erasing disagreement

- Normalize names to repository IDs without fuzzy matching.
- Keep a source assertion distinct from our interpretation of it.
- Preserve separate records when applicability or assumptions differ.
- Record whether a candidate supports, broadens, narrows, conflicts with, or is
  uncovered by the current GenshinTools baseline.
- Require human review before a candidate becomes accepted knowledge.

Six KQM pages have been ingested but not human-reviewed. Together they forced
separate energy guidance, explicit unranked lists, alternatives versus tied
ranks, bounded constellation applicability, exact teams versus four-slot team
templates, example-team intent, source-defined role constraints, and coupled
multi-character artifact assignments into the schema. The Keqing Luna I slice
is specifically a source-breadth test for
refreshing an old character when a new release changes available teams; it is
not evidence that the captured Lunar-Charged teams are optimal. The Kokomi Luna
V slice preserves a conditional Kokomi/Columbina artifact delegation without
turning its two assignments into independent global recommendations.
The Noelle Luna VIII slice adds another old-character refresh: a newer Hexerei
weapon condition, investment-scoped stat branches, and a new exact team are
kept as separate claims rather than being merged into one implied build.
The Klee Luna IV slice adds separate best-generalist claims by weapon rarity,
contextual artifact sets, a C2+ support branch, and two exact teams. It leaves
`Klee Combo` unresolved and records the missing C4+ standalone-playstyle shape
as a schema gap.

## 3. Build validation tooling

Start with facts that can be checked deterministically:

- schema versions and unknown fields;
- exactly four distinct team members;
- known character, weapon, and artifact IDs;
- weapon-type compatibility;
- legal artifact and main-stat shapes;
- nonempty and duplicate-free recommendation groups;
- explicit ER units and ranges when supplied;
- positive formula counts owned by a team member;
- valid source references and stable normalization.

Do not initially validate team quality, ranking truth, rotation feasibility,
buff uptime, ER adequacy, or source authority.

Current progress: a durable corpus inventory now exposes record kinds, statuses,
explicit evidence-field counts, source attribution, and explicit-only character
presence across all 387 records. It excludes ER details from evidence and
character-presence counts while keeping the historical energy record visible in
kind/status totals. These counts are descriptive coverage only.

A second durable inventory projects the contributing non-ER guide inputs across
all 125 guide-domain-eligible characters at every C0-C6 boundary. Its 875 rows
are backed by 3,084 group-level observations. Exactly five characters have no
contributing guide input: Aloy and the Anemo, Electro, Geo, and Hydro Traveler
forms. This is missing evidence, not an unsupported-character verdict. Likewise,
constellation-unspecified applicability is not broadened to all investments.
Of 888 exact-team member investments, 887 remain constellation-unspecified; C6
Diona is the sole explicit case.

All 57 upstream KQM manual records remain unreviewed. The 56 non-energy records
contribute provenance or coverage; the energy-guidance record contributes no
observation. The repository currently has zero repository-authored
`damagePlans`. The inventory links 1,008 weapon and 1,068 artifact policy
observations to their existing search-coverage classifications. Linkage is not
a positive representability result: 27 linked artifact outcomes are explicitly
not representable, and 12 linked weapon outcomes have native type mismatches.
Raw stat weights are not converted into ordinal priorities, page or array order
does not create rank, and the one coupled artifact plan is kept atomic.
Structured ER targets, floors, weapon conditions, energy-guidance records, and
rotations contribute no observations. Preserved unresolved free text may still
mention energy requirements, and ordinary `er` remains only a stat vocabulary
token. The report creates no recommendation, guide, rank, or damage claim.

## 4. Compose existing computation incrementally

Only begin after source and consolidated records are useful enough to provide
real comparison targets.

Candidate experiments, in increasing scope:

1. Reproduce one authored loadout without changing it.
2. Compare one weapon or artifact choice at a time.
3. Optimize one character's full loadout in a fixed team and formula-count
   plan.
4. Refine two characters together.
5. Refine all four characters together.
6. Test substitutions for an existing team.
7. Explore new team compositions.

Each experiment must emit intermediate results and discrepancies. Unexpected
results are review cases, not automatic preset changes.

Current progress: the offline bootstrap and direct-versus-compiled damage replay
remain structural-only. A team-template coverage pass now identifies present,
uncovered, and role-unresolved roster shapes without ranking them. Two exact
KQM Quickbloom examples now substantiate one uncovered template without being
promoted into presets. The Keqing Luna I slice adds another uncovered template
and four uncovered exact teams around the new Keqing–Ineffa core. Its
off-field-Hydro and resistance-shred slots remain role constraints so broad
element matches cannot create false coverage. One exact
Furina/Neuvillette/Kazuha/Xilonen roster is independently present in KQM and the
baseline. Its source sample rotation is now translated into action counts
and compared with the calculator's 12 positive and 6 zero-count defaults under
explicit level-90, C0, R1, 10/10/10 assumptions. The comparison finds five
token-supported count mismatches and retains six unresolved formula mappings.
Neither the mapping nor either count plan is accepted yet.

The second fixture materializes data from two independent
knowledge layers: the external exact Keqing/Ineffa/Furina/Xilonen roster and
one explicit baseline character-guide weapon/build selection per member. The
materializer validates exact member/guide association, baseline or accepted
guide status, weapon presence and unique order position, build presence, and
refusal to overwrite source equipment. It does not itself validate weapon-type
compatibility or team suitability. It emits a reproducible scenario; it does
not recommend the equipment or copy stat sheets, refinements, or ER targets.
The resulting draft exposes 13 positive and 5 zero-count defaults. Translating
the source rotation produced 11 exact claims, 10 complete mappings, and one
partial mapping because Keqing's eight N1 hits have no C0 formula. Furina's
Skill count is exactly one: the footnote relocates it beside her Burst rather
than making it optional. The generic comparator supports ranges only for a
genuinely optional source count; this translation has zero ranges.

The advisory readiness assessment accounts for all 18 available formulas: 11
mapped, 5 unresolved, 2 source-absent, and none unclassified. Ten of 13 positive
defaults are mapped and 3 remain unresolved. Eight blockers—the unreviewed
translation, one partial mapping, five unresolved formula mappings, and one
unresolved source token—mean the report is not considered ready for damage
replay. The assessment is advisory: `replayTeamDamage` does not consume or
enforce it, and this checkpoint does not produce or authorize a replay. An
enforced wrapper is future work if it becomes useful. This is concrete evidence that a scalar
formula count alone was too weak, so the comparator also preserves partial-token
coverage and a complete formula-classification ledger.

Before ranking any artifact set, the current checkpoint measures whether the
existing analyzer can name the choices already recorded in the repository. Its
released grammar contains 43 initial four-piece choices and at most 14
stat-derived two-piece pairs. Across 1,068 artifact-choice fields on
non-rejected guide and team records, 1,020 are initially enumerated, 21 are
conditionally representable, and 27 are not representable by the current
grammar. The failures include 19 Instructor and 2 Exile occurrences filtered
out with all non-five-star sets, five choices whose half-set families are
absent from dynamic two-piece discovery, and one Thundersoother occurrence
excluded by the tier-list-derived four-piece policy. This does not establish
that any enumerated choice can be generated,
evaluated, or ranked successfully. The count includes both assignments in the
new coupled Kokomi/Columbina plan, but only proves that each set name is in the
individual candidate grammar; it does not prove joint-plan enumeration.

The weapon candidate-policy audit now reports separate coverage axes for weapon
ID, refinement specificity, and native weapon-type compatibility. Its released
mirror contains 236 weapon IDs and 309 weapon/refinement pairs. All 1,008 non-ER
repository occurrences have an ID in that global domain, but none supplies a
refinement; 996 match the character's native type and 12 legacy selections do
not. Because runtime derives the search type from the equipped seed weapon,
those 12 mismatches can seed a wrong candidate class. This is a blocker, not a
weapon ranking.

The artifact-generation preflight now defines the missing refinement policy as
an experiment convention: preserve explicit values, otherwise compare 3- and
4-star weapons at R5 and 5-star weapons at R1. It binds those resolved values,
the artifact choices, native types, fixture provenance, formula-draft
assumptions, explicit investment fields, and readiness inventory. The current
Keqing/Ineffa fixture passes the technical-probe gates but remains blocked for a
reviewed generator experiment by the same eight formula-plan blockers.

The first direct generator probe now exercises four all-5-star combinations
assembled from independently recorded character-guide builds: Ineffa's
Aubade/Silken Moon choices crossed with Furina's Golden Troupe/Tenacity choices.
No source record binds those four build targets to this exact team or to one
another. Each candidate gets a fresh team and all four complete sequentially,
including the simultaneous two-character change. A fifth Xilonen/Instructor
build target is retained as a deterministic search-policy rejection and is
never passed to the generator. The runner prevalidates every translated
`charId` formula because the compiler otherwise silently drops invalid lines
and can produce plausible-looking output for a zero objective.

The report retains execution order for reproducibility but derives no
comparative ordering or ranking and stores no numerical damage. It compares
main stats and positive substat keys with the exact repository build records and
exposes three recurring review cases: Keqing chooses ATK% instead of the listed
Electro Goblet, Xilonen chooses Geo DMG instead of the listed DEF% Goblet, and
Furina's Tenacity cells choose HP% instead of the listed ER Sands. With ER
constraints and other gameplay assumptions unresolved, the probe cannot assign
causality or make an ER conclusion. These results are not guide
recommendations.

The follow-up sensitivity probe makes seven accepted calls with a fresh
`TeamBuild` each time. It holds the seed composition fixed across all four
algorithmic carry choices and runs the seed and two-character endpoint in both
forward and reverse execution order under Keqing carry. Keqing and Ineffa carry
produce one complete-artifact equivalence class; Furina and Xilonen each
produce a distinct class. The carry changes are not confined to the named
character: both Furina and Xilonen carry replace EM with flat ATK among
Keqing's positive Flower substat keys, alongside different carry Circlets.

The two endpoint candidates produce identical fingerprints under the two
tested schedules, so no cross-run execution-order effect is observed here.
This does not establish general order independence. The report retains hashes
and structural explanations but no damage, ranking, winner, or guide claim.
Formula-plan review remains required before comparative damage or ranking.

The bounded composition experiment now performs that step rather than merely
planning it. Sixteen fresh generator calls cover all four set-assignment nodes
and all four carry seeds. Node-local deduplication yields pools of 8, 16, 8,
and 16 compatible compositions, and all 48 cells pass interpreted-versus-
compiled replay agreement under the same 11 exact-valued but unreviewed
technical lines. Any failed run or replay removes the outer comparison and
withholds cached policies instead of ranking survivors.

The recombined reference exceeds the best intact carry by about 0.1191% in the
two Golden nodes and 0.4090% in the two Tenacity nodes under this objective.
Both Ineffa-set edges have exactly zero objective delta, while both Furina-set
edges have the same positive delta. Those facts are preserved as possible
objective blindness or implementation invariance, not artifact suitability or
causal game performance. The Golden nodes tie exactly and the Tenacity nodes
tie exactly; singular IDs are deterministic representatives only.

Cached coordinate descent reaches the two-node reference plateau from the seed
with zero evaluator calls, while a synthetic 2x2 case proves the policy can
miss a pair-only improvement. The width-one beam remains a non-calibrated,
non-exhaustive coverage trace even though it happens to visit all four nodes in
this tiny table. The reusable bounded composition and cached-policy seams can
now support later experiments, but the unreviewed formula plan still prevents
guide or performance claims. Further work should add new bounded evidence
tables and validation targets rather than extrapolate this one fixture.

The first roster-expansion seam now selects all six current repository team
templates and builds compact domains for the four that contain no unresolved
actual role option. It uses 125 guide-domain-eligible stable character IDs
after withholding 14 Manekin/Manekina special-avatar forms and enforces one
shared playable identity across the seven Traveler elements. Hypercarry/Mono
and Keqing Lunar-Charged remain withheld; highlighted options are annotations,
not fallback role resolution.

The core records slot-pool hashes, duplicate rejections, canonical
multiplicities, and runtime `TeamMeta.hasReaction` acceptance at C0 with no
enemy aura. It emits no expanded candidate-roster array. The four resolved
templates currently contain 41,866 accepted canonical Electro-Charged rosters,
57,607 Freeze, 27,413 Quickbloom, and 77,477 Vaporize rosters. These are domain
membership observations, not rankings or evidence of intended execution.

Twenty template/team associations over 19 unique repository records currently
match their expected structural multiplicity and runtime outcome. Two are
same-page Quickbloom extraction checks, 17 associations over 16 unique
GenshinTools baseline records are template-overlap observations, and two are
explicit Electro-Charged reaction-gate negatives, with one negative also in
the baseline-overlap class. Same-page slot fits are explicitly inferred and the
Keqing binding is a cross-page audit fit, not a source-published mapping. The
report preserves this overlap and records zero independent gameplay-validation
targets. Runtime errors, validation mismatch, or role-withholding drift make
the whole wrapper not comparable rather than ranking surviving domains.

The first full-team stat-marginal diagnostic now captures four fresh final
sheet maps for the fixed Keqing/Ineffa Aubade-and-Golden composition, once per
algorithmic carry. It evaluates one baseline plus nine non-ER +1-average-roll
perturbations for every team member at every endpoint. All 148 current replay
points pass interpreted-versus-compiled agreement, but the result remains a
local derivative over an unreviewed objective rather than a feasible roll
allocation.

The cross-endpoint layer preserves raw, relative, and within-character
normalized ranges plus tolerance-aware signs; it performs no endpoint average.
The existing GenshinTools 100/75/50 build-priority bands remain categorical
overlap metadata, not a scale comparable with those marginals. This already
surfaces two kinds of review evidence: Keqing and Ineffa EM are all-zero under
an objective with no reaction lines or overrides, while Furina CR is positive
at three endpoints and zero at the Furina-carry endpoint. The former is an
objective-coverage gap and the latter is operating-point sensitivity; neither
is a guide disagreement.

The exact four-carry domain, four generator calls, sequential concurrency, all
sheet/config fingerprints, and all 148 replay outcomes are fail-closed. A
capture failure skips the diagnostic, and a replay or agreement failure removes
the cross-endpoint summary rather than averaging survivors. Before deriving
weights, later experiments should review the objective and test budget-neutral
roll exchanges or another legality-preserving local move across multiple
operating points.

The first source-scoped role sample now preserves one unreviewed KQM
observation that names Xilonen for the healer slot of Furina's Hypercarry / Mono
template. It validates that observation only against the exact same-page
Furina/Neuvillette/Kazuha/Xilonen example and its explicit inferred binding.
The two unrestricted flex slots yield the expected structural multiplicity of
two; this is permutation evidence, not two recommendations.

The wrapper reuses the existing 125-ID stable guide-domain catalog only as a
transient eligibility boundary and retains counts and hashes rather than a
global role roster. Fresh catalog counts, complete and ID-only hashes, and the
playable-identity count must match the independently stored boundary in the
checked-in roster-domain report, including after a same-count membership
change. The wrapper also independently confirms that the broader Hypercarry
template remains `withheld-unresolved-role` under the existing roster-domain
core. The named observation therefore adds a validation target without
silently becoming a global `healer` selector. More attributed, context-bearing
role observations are needed before designing a bounded role candidate domain.

The paired Keqing seam now retains two fully captured, unranked source-positive
role inventories and validates them only through four exact teams published on the
same KQM page. Each configured binding has structural multiplicity one. The
exact Viridescent Venerer text for Jean, Sucrose, and Kaedehara Kazuha is
acknowledged and reported as text-set equality, not gameplay satisfaction.
Xingqiu, Sayu, and Xianyun remain unexercised positive members; no missing or
additional role-member pair is evaluated. The wrapper pins all member objects,
the four target identities and bindings, the exact page URL, and seven indexed
extraction states. It also requires both a fresh roster-domain replay and the
checked-in report to keep Keqing Lunar-Charged
`withheld-unresolved-role`. This is a stronger validation target, not a role
catalog or a candidate-team generator.

The first source-conditioned equipment seam now preserves seventeen KQM
Keqing Lunar-Charged records as 42 claim units and checks them against only the
four published rosters. The wrapper maps sixteen exact condition strings to
explicit predicates; it can acknowledge Lunar-Charged scope, Furina presence,
and Nod-Krai roster count, but withholds every build, gameplay, refinement,
threshold, contribution, shield, healing, and timing condition. Candidate KQM
records remain validation targets and never enter the source-backed fixture or
generator.

The same report cross-references 30 equipment claims with the existing search-
coverage builders. All 21 weapon claims are released native-type-compatible
Sword observations with source refinements still unspecified. Five artifact
claims are currently representable; Thundersoother plus three traditional 2pc
combinations are not. The internal Keqing baseline structurally overlaps the
source default main stats and Mistsplitter, differs on the ATK-versus-EM
priority relation, and lists 4pc Thundering Fury only under an unresolved
source condition. These are discrepancies and coverage boundaries, not guide
judgments. V1 also retains the source's other-5-star-versus-Mistsplitter
ordering as a schema gap rather than inferring an order across separate
recommendation records.

The first source-conditioned candidate lattice now groups those observations
without flattening them: 13 weapon groups, 6 artifact groups, and 12 stat
claims are projected onto the four exact source teams. Its 76 equipment-group
cells and 48 stat-claim cells retain all 168 claim/team resolutions. Condition
resolution and search representability stay independent, so Thundersoother and
the three unsupported traditional 2pc choices remain unresolved holdouts in
all four teams instead of being dropped.

The lattice creates no cross-product or assembled build. The exact
Keqing/Ineffa/Furina/Xilonen formula fixture is attached only as blocked
availability metadata: Mistsplitter matches a source claim, 4pc Thundering Fury
remains condition-withheld, the source refinement is unspecified, and the
unreviewed fixture still has eight readiness blockers. Thus the current lattice
authorizes zero technical comparisons.

The next gate now exists as an explicit Guide Factory-authored cross-record
composition contract. It rebuilds exactly two unordered input compositions:
matched general Mistsplitter plus either 4pc Marechaussee Hunter or the matched
exactly-one-Nod-Krai Night of the Sky's Unveiling branch, joined to seven
matched default stat claims. The CRIT Rate Circlet claim and the two-Nod-Krai
artifact branch remain withheld. Exact source conditions, group provenance,
recommendation metadata, the eight-cell stat inventory, teammate lineage, and
every upstream no-claim/no-comparison flag are pinned; any drift withholds both
compositions. Condition resolution is explicitly owned by the Guide Factory
exact-team wrapper, and a serialized report is trusted only after a fresh
typed-input rebuild and exact hash-bound comparison. The contract still
executes no generator, damage, ranking, technical comparison, or ER work. A
later bounded technical wrapper must derive its composed targets from this
freshly authenticated contract and must separately identify execution as an
experiment policy rather than source authorization.

That bounded wrapper now executes the smallest source-conditioned technical
matrix. It authenticates the durable contract against a fresh rebuild, derives
exact full-payload Keqing targets for Marechaussee Hunter and the one-Nod-Krai
Night of the Sky's Unveiling branch, attaches the three exact baseline
teammate targets, and prevalidates both candidates before generation. The two
nodes run under all four carry seeds as eight fresh sequential calls. Any
failure stops the schedule and removes the entire matrix.

From each generator result, the durable output keeps only artifact and
validation-observation hashes. It also preserves the independently assembled
target provenance, assumptions, formula specification, and origin ledger. It
does not compare nodes or artifact sets, retain evaluated objective values, or
turn the source's record-local default/alternative labels into an order. The
source stat claims are post-generation validation observations, not generator
constraints or scoring weights. Formula-fixture artifact fields are recorded
as overridden seed provenance because the matrix supplies every runtime set
assignment. A private pre-await snapshot and frozen process-local capability
close caller-mutation seams. The full validator re-executes the current runtime
and compares the complete report; its checked-in hash list is explicitly a
declared direct-input list, not a transitive dependency claim.

The derived-formula-fixture adapter now inventories exactly two checked-in
technical fixtures as eight character-scenario observations across six unique
characters. It authenticates the current report bytes and embedded input hashes
without importing calculator runtime modules. Every observation is exact C0
only as a local fixture assumption; both source teams remain constellation-
unspecified, C1-C6 remain unobserved, and the report contains zero source-
validated or guide-ready plans. The Keqing fixture retains eight readiness
blockers. The older Furina fixture remains not assessed and has no token-
coverage ledger. Both source extractions and action translations remain
unreviewed, which is the next human-evidence gap. The adapter authorizes no
replay, optimization, recommendation, ranking, damage, source-validation, or ER
claim.

ER work is deferred. The Diona probe remains an assumption-incomplete
historical fixture; unrelated repository growth no longer changes its input
revision.

## 5. Derive guides only after the factory is credible

Potential derived products include:

- best-known teams for a character and investment profile;
- ranked or conditional weapon and artifact choices;
- main-stat and substat recommendations;
- ideal roll allocations for a supplied formula-count plan;
- patch-to-patch changes affecting old characters.

No result moves into `src/presets` until the data model, computation, and review
process have been explicitly accepted.

## Ask the domain owner when

- a source and the current preset disagree under apparently identical scope;
- a formula-count plan or buff assumption cannot be inferred safely;
- high-constellation behavior changes a character's role or team structure;
- an optimizer result is counterintuitive but no implementation defect is
  evident;
- a proposed consolidation rule would discard meaningful alternatives;
- source licensing or permission is unclear before systematic extraction.

Current owner-review target:

- Does each action-to-formula mapping in
  `reports/furina-neuvillette-formula-plan-draft.json` correctly translate the
  named KQM sample rotation?
- Should Neuvillette use four Judgments and two Skill instances, and should
  Xilonen use two Skill/N2 instances plus one Burst formula?
- What duration or hit-count assumptions should resolve Neuvillette's
  Spiritbreath procs, Furina's 32-hit Salon aggregate, and Kazuha's absorption
  and Swirl formulas?
- Should the first artifact allocation fixture use C0/R1, or another investment
  level that is more representative for validating the pipeline?
- For the Keqing/Ineffa fixture, how should the eight unsupported N1 hits, the
  10-discharge Ineffa aggregate, Furina's 32-hit Salon aggregate, and the three
  Lunar-Charged ownership/count mappings be represented?

Deferred ER questions remain recorded in `CHECKPOINT-2.md`; they are not on the
critical path for the current repository and damage-plan work.
