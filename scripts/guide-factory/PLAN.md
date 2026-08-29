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
presence across all 365 records. It excludes ER details from evidence and
character-presence counts while keeping the historical energy record visible in
kind/status totals. These counts are descriptive coverage only.

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
and two uncovered exact teams around the new Keqing–Ineffa core. Its
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
stat-derived two-piece pairs. Across 1,059 artifact-choice fields on
non-rejected guide and team records, 1,015 are initially enumerated, 21 are
conditionally representable, and 23 are not representable by the current
grammar. The failures expose two specific search-domain gaps: 19 Instructor
and 2 Exile occurrences are filtered out with all non-five-star sets, while
two damage-oriented half-set choices are absent from dynamic two-piece
discovery. This does not establish that any enumerated choice can be generated,
evaluated, or ranked successfully. The count includes both assignments in the
new coupled Kokomi/Columbina plan, but only proves that each set name is in the
individual candidate grammar; it does not prove joint-plan enumeration.

The weapon candidate-policy audit now reports separate coverage axes for weapon
ID, refinement specificity, and native weapon-type compatibility. Its released
mirror contains 236 weapon IDs and 309 weapon/refinement pairs. All 987 non-ER
repository occurrences have an ID in that global domain, but none supplies a
refinement; 975 match the character's native type and 12 legacy selections do
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
