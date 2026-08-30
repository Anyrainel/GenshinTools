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

Indexed manual snapshots now fail closed unless their source has exactly one
registry entry, is active, uses the manual-observation V1 contract, and does not
require permission. A blocked or permission-required source remains outside the
manual index and consolidated repository.

## 2. Consolidate without erasing disagreement

- Normalize names to repository IDs without fuzzy matching.
- Keep a source assertion distinct from our interpretation of it.
- Preserve separate records when applicability or assumptions differ.
- Record whether a candidate supports, broadens, narrows, conflicts with, or is
  uncovered by the current GenshinTools baseline.
- Require human review before a candidate becomes accepted knowledge.

Eight KQM guide pages have been ingested but not human-reviewed. A separate
ninth indexed snapshot preserves one Xiao source-authored rotation fixture.
Together they forced
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
The Xiao Version 5.5 slice adds three conditional artifact branches, source-
grouped 5-star weapons, an explicitly unranked 4-star list, and the exact FFXX
team. Its guide snapshot deliberately omits ER advice, while the separate
rotation fixture preserves source-local action counts without mapping them to
calculator formulas or attaching them to a team. Checkpoint 42 preserves that
source boundary and adds a separate Guide Factory-owned alias witness: Skill
counts match at 2, while High Plunge is source 12 versus calculator-default 11.
The mismatch is retained for review rather than resolved by the adapter.

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
presence across all 402 records: 191 baseline and 211 candidate. It excludes ER
details from evidence and
character-presence counts while keeping the historical energy record visible in
kind/status totals. These counts are descriptive coverage only.

A second durable inventory projects the contributing non-ER guide inputs across
all 125 guide-domain-eligible characters at every C0-C6 boundary. Its 875 rows
are backed by 3,126 group-level observations. Exactly five characters have no
contributing guide input: Aloy and the Anemo, Electro, Geo, and Hydro Traveler
forms. This is missing evidence, not an unsupported-character verdict. Likewise,
constellation-unspecified applicability is not broadened to all investments.
Of 904 exact-team member investments, 902 remain constellation-unspecified;
C6 Diona is exact and C2+ Xilonen is one lower-bounded case.

All 72 indexed KQM records remain unreviewed. The 70 contributing guide records
provide provenance or coverage; the energy-guidance and rotation-fixture
records contribute no guide observation. The repository currently has zero
repository-authored `damagePlans`. The inventory links 1,026 weapon and 1,075
artifact policy observations to their existing search-coverage classifications.
Linkage is not a positive representability result: 28 linked artifact outcomes
are explicitly not representable, and 12 linked weapon outcomes have native
type mismatches.
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
stat-derived two-piece pairs. Across 1,075 artifact-choice fields on
non-rejected guide and team records, 1,026 are initially enumerated, 21 are
conditionally representable, and 28 are not representable by the current
grammar. The failures include 19 Instructor and 2 Exile occurrences filtered
out with all non-five-star sets, five choices whose half-set families are
absent from dynamic two-piece discovery, and Thundersoother plus Retracing Bolide
Oath occurrences excluded by the tier-list-derived four-piece policy. This
does not establish
that any enumerated choice can be generated,
evaluated, or ranked successfully. The count includes both assignments in the
new coupled Kokomi/Columbina plan, but only proves that each set name is in the
individual candidate grammar; it does not prove joint-plan enumeration.

The weapon candidate-policy audit now reports separate coverage axes for weapon
ID, refinement specificity, and native weapon-type compatibility. Its released
mirror contains 236 weapon IDs and 309 weapon/refinement pairs. All 1,026 non-ER
repository occurrences have an ID in that global domain, but none supplies a
refinement; 1,014 match the character's native type and 12 legacy selections do
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

The repository now also preserves team-member constellation intervals. Exact,
lower-bounded, upper-bounded, and closed-range source shapes remain distinct;
mixed exact/range and inverted intervals are invalid. A narrow Itto Version 5.6
slice exercises this with one C2+ Xilonen exact-team member while leaving the
other eleven new team-member observations constellation-unspecified. Formula
drafts and artifact-generation preflight reject concrete assumptions outside a
captured interval, and exact-team baseline overlap is explicitly roster-only
with investment unevaluated.

The authenticated Itto source-conditioned projection now preserves the three
guide records as fifteen atomic claim groups and projects them across the three
exact source teams without multiplying weapon, artifact, and stat axes into
builds. Of 45 cells, 3 match exact Furina roster facts, 6 are inapplicable from
Xianyun absence, 27 retain unresolved non-roster context, and 9 retain the
deliberately omitted energy prerequisite. The real roster-domain runtime accepts
the Yelan and Xingqiu PHEC examples and structurally rejects the separate Gorou
example. The sole exact baseline roster overlap remains investment-unresolved
because source C2+ Xilonen is compared with baseline-unspecified Xilonen.

That separate request/account-context experiment now exists. It authenticates
both the durable packet and a fresh canonical packet rebuild before projecting
three strict contexts independently. Team/character-scoped role and goal facts,
team-scoped preference and passive assumptions, and a global partial weapon
inventory can address 21 of the 27 source-unresolved non-ER cells. DEF Goblet
and Retracing Bolide remain unresolved because no buff-threshold/comparative or
artifact-quality contract exists. All repeated offensive-tail cells keep the
deferred energy prerequisite. The report preserves the source result in every
cell and creates no combined context, build, rank, account advice, or guide.

Checkpoint 25 established the broader condition inventory. It traverses only
the condition-array fields defined by the manual schema, preserves exact ordered
text and paths, requires a pre-schema raw `conditions` path/payload audit to
match the extractor, and verifies all 142 source occurrences against the
consolidated repository. Its historical non-structural boundary was 123
occurrences: 46 typed, 3 acknowledged, and 74 unbound. Binding identity includes
source, record kind, source record, schema path, ordered-array hash, and subject,
so identical Viridescent Venerer text cannot leak an acknowledgement from Jean,
Kazuha, or Sucrose to Sayu or Xianyun.

Checkpoint 26 now completes the first bounded source-local follow-up. A reusable
core composes the existing source-condition and request-context evaluators while
preserving both results and accepting only exact same-document claims and teams.
The Klee adapter selects three on-field-role main-stat occurrences and one
Furina-roster Marechaussee Hunter occurrence from the Luna IV page. Across two
exact Klee teams, the eight source cells contain 1 matched, 1 inapplicable, and
6 unresolved results. Explicit team-scoped Klee role facts produce an effective
7 matched and 1 inapplicable result without turning recommendation metadata into
runtime intent or replacing exact-roster truth.

The other 11 Klee occurrences are authenticated holdouts and receive no binding
or energy classification from the slice. At checkpoint 26, the downstream
catalog contained 53 entries: 50 typed and 3 exact-text acknowledged. That
checkpoint's non-structural coverage was 123/50/3/70, while its energy partition
was 15 deferred, 47 explicitly not energy-deferred, 64 nonempty unclassified,
and 16 empty unconditional arrays. No unbound row was presumed non-ER, and the
slice composed no recommendation or build.

Checkpoint 27 proves one narrower downstream operation over that authenticated
evidence. It fresh-authenticates the Klee source-local slice, requires the
current manual coverage boundary to remain authenticated, then cross-links the
same four exact occurrences into one flat positive witness for the exact
Klee/Furina/Albedo/Xilonen source team. The three
on-field-role main-stat claims are applicable under explicit team-scoped Guide
Factory role facts; the Furina-conditioned Marechaussee Hunter claim is already
matched by the source roster. All four remain independent claims from two
source records, and CR/CD stays one unchosen payload group.

The exact Klee/Chevreuse/Durin/Fischl team is a negative control. Its three role
claims remain applicable under the separately scoped request fact, but its
roster makes the Marechaussee Hunter claim source-definitely-inapplicable, so no
positive witness is constructed. The join is Guide Factory-authored and does
not become a source-authored build, compatibility result, candidate, cross-
product, choice, recommendation, rank, generator, optimizer, or guide. It
consumes zero of the 11 Klee holdouts and changes no binding-coverage or energy
classification.

Checkpoint 28 completes that Diona slice. It selects the exact member-0 Diona,
member-2 Citlali, and member-3 Bennett artifact condition occurrences from
`kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt`. All three source cells
remain unresolved gameplay-role predicates. Three separately scoped support-
role request facts, each bound to the exact team and exact character, make the
effective partition three matched without converting source condition text or
recommendation metadata into runtime intent.

The payloads remain atomic and source-ordered: Diona preserves Song of Days
Past then Noblesse Oblige, Citlali preserves the Scroll of the Hero of Cinder
City singleton, and Bennett preserves Noblesse Oblige then Instructor. The
slice does not choose, assign, compare, combine, or compose them. Its exact
source closure contains 26 condition arrays: 18 nonempty and 8 empty. The three
selected rows and 15 nonempty holdouts are disjoint and complete; the holdouts
remain descriptive inventory only, split into 10 ordinary and 5 ER-deferred
rows. Their consumed, bound, and slice-authored energy counts are all zero.

Catalog integration uses reusable `source-local-typed-predicate-ast` and
`source-local-not-energy-deferred` evidence labels while keeping the Diona and
Klee wrappers, authentication, extraction, identities, and exact `sliceId`
scopes source-specific. The resulting catalog has 56 entries: 53 typed and 3
acknowledged. Current non-structural coverage is 123/53/3/67, with 31 typed-
only, 54 unbound-only, and one mixed unique condition set. Energy remains
orthogonal at 15 deferred, 50 explicitly not energy-deferred, 61 nonempty
unclassified, and 16 empty arrays.

The dependency order is exact: Diona raw inputs feed the authenticated Diona
wrapper, then the 56-entry catalog, manual coverage, and finally the regenerated
checkpoint 27 Klee witness. The Klee witness changes only its authenticated
coverage dependency; its four Klee claims and interpretation boundary remain
the same. No build, recommendation, composition, rank, optimizer, damage,
rotation, or ER work is authorized.

Checkpoint 29 completes that standalone Kokomi slice. It authenticates the KQM
Kokomi Luna V snapshot and selects exactly
`members[0].artifactRecommendations[0].conditions` from
`kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example`. The exact
ordered roster is Sangonomiya Kokomi, Ineffa, Columbina, and Sucrose. Its pinned
four-member conjunction is source-matched, so context applicability is
`source-already-matched` with zero request facts, rules, or bindings.

The selected payload remains the single 4pc Ocean-Hued Clam group. Its source
classification is `recommended` and its source ordering is `unranked`; neither
field becomes a computed rank, assignment, or comparison. The Kokomi source
boundary closes at five nonempty and zero empty arrays. One occurrence is
selected, and all four holdouts remain unconsumed, unbound, and energy-
unclassified by the slice. The source remains agent-assisted, unreviewed,
permission-unknown, promotion-ineligible evidence.

Checkpoint 29 is authenticated directly by `validate.ts` but deliberately does
not enter the current binding catalog or manual coverage. Checkpoint 28 totals
therefore remain authoritative: catalog 56 = 53 typed + 3 acknowledged,
non-structural coverage 123/53/3/67, unique arrays 31 typed-only + 54 unbound-
only + 1 mixed, and energy 15 deferred + 50 not-energy-deferred + 61 nonempty
unclassified + 16 empty. The slice executes no build, candidate, assignment,
composition, recommendation, rank, optimizer, damage, rotation, or ER work.

Checkpoint 30 completes that separate admission. It accepts only checkpoint
29's authenticated member-0 Ocean-Hued Clam occurrence under the generic
source-local catalog evidence kinds. Kokomi, Klee, and Diona retain separate
wrapper authentication and extraction. A private normalized helper may perform
only the repeated selected-occurrence-to-source-claim-to-condition-control
cross-link and catalog-entry construction after the wrapper-specific checks;
it is not a generic wrapper, extractor, or prose parser.

The Kokomi admission pins the exact page/version, team and member-0 subject,
source condition and hash, ordered four-member roster conjunction and hash,
Ocean-Hued Clam payload and hash, `recommended` classification, `unranked`
ordering, and zero request bindings. The four named holdouts remain outside the
catalog: the character-wide Nod-Krai delegation condition, team artifact-plan
condition, Kokomi member-0 second artifact condition, and Columbina member-2
artifact condition. They stay unbound and energy-unclassified.

The authenticated catalog is now 57 = 54 typed + 3 acknowledged. Full nonempty
coverage is 54/3/69; non-structural coverage is 123/54/3/66; unique arrays are
32 typed-only + 53 unbound-only + 1 mixed; and energy is 15 deferred + 51 not-
energy-deferred + 60 nonempty unclassified + 16 empty. Display status remains a
separate projection: 51 typed + 57 known-but-unbound + 15 ER-deferred + 3
acknowledged + 16 unconditional. Manual coverage authenticates six wrapper
families over 17 source files and 67 generated-from paths.

Checkpoint 30 adds no durable report, so the count remains 29. Manual coverage
and the checkpoint 27 Klee witness are regenerated; the latter's four Klee
claims, positive fixture, negative control, and interpretation boundary remain
unchanged. No assignment, recommendation, build, rank, optimizer, damage,
rotation, or ER work is authorized.

Checkpoint 31 completes that standalone Noelle experiment. The source-specific
wrapper authenticates the Luna VIII snapshot at
`d6927fed20fc0f77e8f721e18b7c9f8db37009258ba5c582b7184fb16be558e0`
and selects exactly three high-investment main-stat occurrences from
`kqm:character-guide:noelle-c6-or-talent-10-artifact-stats-luna-viii`: DEF%
Sands, Geo DMG Bonus Goblet, and CRIT Rate/CRIT DMG Circlet. All share condition
hash `92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4`
but retain independent payload identities.

The three claims are projected over the exact
`kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii` source team.
Their source predicate remains one unresolved `investment-threshold` leaf;
source Talent-level evaluation stays false. The wrapper maps only that pinned
leaf to `any(constellation >= 6, burst talent >= 10)`. Constellation and Talent
levels remain independent request facts scoped to the exact team and Noelle
subject. The durable context supplies C6 and omits Burst Talent level, so all
three source-unresolved cells become applicable and effectively matched while
the omitted branch remains unknown. This does not derive a Talent level from
constellation or make the wrapper-owned cross-record join source-authored.

The Noelle source boundary closes 16 arrays as three selected, 12 nonempty
holdouts, and one empty array. The holdouts and empty occurrence are unconsumed
and receive no slice-authored binding or energy classification. The slice
produces zero candidates, equipment assignments, optimizations, and assembled
builds. It makes no recommendation, rank, formula, damage, rotation, ideal-roll,
or ER claim.

Checkpoint 31 adds the thirtieth durable report but remains outside the current
catalog. Catalog 57 = 54 typed + 3 acknowledged, non-structural coverage
54/3/66, unique arrays 32/53/1, energy 15/51/60/16, and six catalog wrapper
families over 17 source files and 67 generated-from paths remain unchanged.
The shared request-context change regenerates affected Itto, Klee, Diona, and
Kokomi reports, manual coverage, and the Klee witness without changing their
established semantics.

Checkpoint 32 completes that separate admission. It requires exact equality
between the durable Noelle report and a fresh source-specific rebuild, then
rechecks the pinned source and repository identities, shared source and request
predicates, three independent payloads, exact C6 request projection, 3/12/1
selected/holdout/empty partition, and disabled capability boundary. Only after
those checks may the private normalized selected-to-claim-to-control helper
construct entries for the three selected occurrences. The 12 holdouts and one
empty occurrence remain outside the catalog.

The authenticated catalog is now 60 = 57 typed + 3 acknowledged. Full nonempty
coverage is 57/3/66; non-structural coverage is 123/57/3/63; unique arrays are
33 typed-only + 52 unbound-only + 1 mixed; and energy is 15 deferred + 54 not-
energy-deferred + 57 nonempty unclassified + 16 empty. Display status is 54
typed + 54 known-but-unbound + 15 ER-deferred + 3 acknowledged + 16
unconditional. Manual coverage authenticates seven wrapper families over 18
source files and 70 generated-from paths.

Checkpoint 32 adds no durable report, so the total remains 30. Manual coverage
and the checkpoint 27 Klee witness are regenerated in that order; the witness's
four Klee claims, positive fixture, Overload negative control, zero-holdout
consumption, and interpretation boundary remain unchanged. No assignment,
recommendation, build, rank, optimizer, damage, rotation, or ER work is
authorized.

Checkpoint 33 completes that standalone lower-investment experiment. The
generic request-context and source-local ASTs add `constellation-at-most` and
`talent-level-is`. Omitted exact-team, exact-character facts remain unknown;
the former is true at or below its threshold and false above it, while the
latter is true only for exact equality and false for another supplied value.
The existing three-valued `all` operator is false if any child is false, true
only if every child is true, and unknown otherwise. Constellation remains C0-C6,
Talent levels remain positive named-Talent integers, request provenance/scope
is preserved, and constellation never derives a Talent level.

The standalone `src/noelleSourceLocalLowerInvestmentSlice.ts` and durable
`reports/noelle-source-local-lower-investment-slice.json` authenticate the same
Luna VIII snapshot and select exactly the ATK% Sands, Geo DMG Bonus Goblet, and
CRIT Rate/CRIT DMG Circlet occurrences from
`kqm:character-guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii`. Their
shared exact condition is represented only by the wrapper-owned
`all(constellation <= 5, burst talent == 9)` request predicate. Independent C5
and Burst Talent 9 facts scoped to the exact
Noelle/Durin/Nicole/Xilonen source team make all three source-unresolved cells
applicable and effectively matched. The source evaluator still does not
evaluate Talent levels, and the team join remains wrapper-owned rather than
source-authored.

The exact boundary remains 16 arrays: three selected main-stat rows, 12
nonempty holdouts, and one empty array. No substat is selected. Holdouts and the
empty occurrence are unconsumed and receive no slice-authored binding or energy
classification. Four raw input files and 13 generated-from paths are
authenticated. The slice produces zero candidates, equipment assignments,
optimizations, and assembled builds and makes no recommendation, guide, rank,
formula, damage, rotation, ideal-roll, or ER claim.

Checkpoint 33 adds the thirty-first durable report but does not admit the lower
slice to the catalog. Catalog 60 = 57 typed + 3 acknowledged; full nonempty
coverage 57/3/66; non-structural coverage 57/3/63; unique arrays 33/52/1;
energy 15/54/57/16; display 54/54/15/3/16; and seven wrapper families over 18
source files and 70 generated-from paths all remain exactly checkpoint 32. The
three lower rows remain catalog-unbound and energy-unclassified.

The generic predicate additions regenerate seven existing durable reports for
authenticated hash/dependency changes only. The checkpoint 32 catalog's
`generatedFrom` pin changes, but its entries and ledgers do not; manual coverage
and the Klee witness retain their established semantics. Verification passes
TypeScript, 62 test files with 461 tests, and validation with 0 errors and 12
existing warnings.

Checkpoint 34 completes that separate catalog admission. The catalog first
requires the durable lower-investment Noelle report to equal a fresh source-
specific rebuild, then repeats its exact page/version, raw-input closure,
guide/team/subject identities, source and request predicates, independently
scoped C5 and Burst Talent 9 facts, three payloads, recommendation metadata,
source-claim and condition-control cross-links, 3/12/1 partition, and disabled
capabilities. Only after those checks pass may the private normalized helper
construct the three entries.

Only the ATK% Sands, Geo DMG Bonus Goblet, and CRIT Rate/CRIT DMG Circlet
occurrences are admitted. The 12 named nonempty holdouts and one empty
occurrence remain outside the catalog and receive no new binding or energy
classification. The high- and lower-investment branches remain occurrence-
disjoint even when a payload hash or their unresolved source-predicate hash is
the same.

The authenticated catalog is now 63 = 60 typed + 3 acknowledged. Full nonempty
coverage is 60/3/63, including 82/3/74 condition-string occurrences. The 123
non-structural rows are 60/3/60, including 82/3/71 strings, while the 86 unique
arrays split 34 typed-only, 51 unbound-only, and one acknowledged/unbound mixed
set. Energy is 15 deferred, 57 explicitly not deferred, 54 nonempty
unclassified, and 16 empty; display is 57 typed, 51 known-but-unbound, 15 ER-
deferred, 3 acknowledged, and 16 unconditional.

Manual coverage authenticates eight wrapper families through 19 source files
and 73 generated-from paths. The regenerated Klee witness authenticates six
source files, 76 generated-from paths, and 63 upstream bindings while retaining
the same four claims, positive team, negative control, 11-holdout exclusion,
and interpretation boundary. No durable report is added, so the total remains
31. Verification passes TypeScript, 62 test files with 464 tests, and validation
with 0 errors and 12 existing warnings.

Checkpoint 34 adds no application or Worker integration and makes no guide,
recommendation, assignment, rank, optimization, damage, rotation, ideal-roll,
or ER claim.

Checkpoint 35 completes the isolated Keqing triangulation across
ArtifactRatingDB's source-native heuristic coefficients, attributed KQM
equipment/stat evidence, and the existing four-endpoint local-marginal
diagnostic. Its five-file closure authenticates the ArtifactRatingDB snapshot,
consolidated repository, marginal report, raw KQM snapshot, and Keqing
equipment-evidence report. It requires raw-KQM/repository recommendation parity
and the equipment report's exact-team, default-main-stat, and eight-claim
projections, with seven exact-team matches and one unresolved secondary
condition.

The output is exactly ten stable, unranked sign-only observations: four source-
nonzero/local-positive, four source-zero/local-zero, one Elemental Mastery
objective-coverage gap, and one Electro DMG Bonus source-only row. Coefficient
and marginal magnitudes are not compared, KQM priority values are not sorted,
and context comparability is not established. The pinned reaction-free
technical objective retains eight readiness blockers. Two `SPRatioBase`
occurrences remain deferred source evidence; no ER work is performed.

The report is durable evidence number 32, but ArtifactRatingDB remains outside
the shared source registry, consolidated repository, condition catalog, global
validator, application, and Worker. Its permission is still mixed and
consolidation remains blocked pending review. Guide, rank, scalar-weight,
promotion, recommendation, candidate, optimizer, ideal-stat, and ER outputs all
remain false. Verification passes Guide Factory TypeScript, 63 test files with
487 tests, application TypeScript, and dependency-boundary validation.

Checkpoint 36 completes that bounded source-backed equipment candidate lattice.
The generic core, added in `3e6982a1`, owns only exact four-member/eight-axis
shape checks, bounded Cartesian enumeration, deterministic identity binding,
and completeness validation. The source-specific
Keqing/Ineffa/Furina/Xilonen wrapper owns all source authentication.

Its exact nine-input closure retains nine source groups/lists and 20
occurrences: 14 active, four outside the bounded first-build fixture scope, one
Xilonen C6 build withheld by the C0 request, and one Furina ER-derived artifact
choice held out while ER work remains deferred. Only equipment identity is
projected; preset main-stat and substat weights are not consumed.

The eight axes form `(3 x 2) x (1 x 1) x (3 x 2) x (1 x 1)`, producing exactly
36 nodes and 288 selection references. KQM ranked-group ordering, its tie and
alternative structure, conditional artifacts, and preset list positions are
retained without inventing numeric rank values: every `sourceLocalRank` is
null. The roster structurally resolves the Lunar-Charged condition, the R5
request map structurally resolves equal refinement, and an explicit request
assumption structurally resolves the top-contributor condition. Gameplay
applicability remains unknown.

Sources do not author the within-character weapon/artifact pairings or any
cross-character composition. All 36 whole candidates are wrapper-authored,
zero are source-published, and the Xilonen Scroll warning remains attached.
Enumeration is the only enabled capability; guide, team/equipment
recommendation, rank, optimality, evaluation, generator, optimizer, damage,
gameplay-validation, promotion, and ER outputs remain false.

The checkpoint adds durable report 33 and globally integrates it, raising the
global report count to 32. Verification passes Guide Factory TypeScript, 65
test files with 554 tests, validation with 0 errors and 12 existing warnings,
application TypeScript, and dependency-boundary validation.

Checkpoint 37 completes that materialization and technical-preflight gate. A
generic fail-closed core consumes a complete authenticated lattice, an exact
objective envelope, exact occurrence resolutions, explicit runtime
assumptions, and a caller-supplied fresh-`TeamBuild` materializer. The
Keqing/Ineffa/Furina/Xilonen wrapper authenticates the declared non-self
checkpoint input set containing 38 selected upstream/runtime dependency paths
for checkpoint 36's lattice and the 11-line Keqing/Ineffa formula draft, then
binds all 14 active occurrences to their exact payload hashes and selected
equipment. The set excludes the producer, CLI, and emitted report to avoid
self-reference; it explicitly makes no exhaustive or transitive module-graph
claim.

The wrapper supplies level 90, C0, talents 10/10/10, enemy level 110 with 0.1
resistance, roll multiplier 0.85, budget `8_6`, empty options, null aura, no
extra buffs, and all four carry IDs. These are technical runtime assumptions,
not source-authored guide facts. ER thresholds and per-character constraints
remain explicitly null.

All 36 nodes materialize through fresh `TeamBuild` instances. The preflight
performs 396 objective-formula availability checks and 180 non-null unresolved-
reference availability checks without evaluating damage. It retains the exact
eight upstream blockers—one `translation-unreviewed`, one
`partial-token-mapping`, five `unresolved-formula-mapping`, and one
`unresolved-source-token`—so the result is materialized but evaluator-not-ready.
Generator, replay, damage, scoring, ranking, recommendation, optimization, and
ER call counts remain zero.

Checkpoint 37 adds durable report 34 and globally integrates it as report 33.
The 555,200-byte report has byte SHA-256
`df5f8d938223063d82cee70cbaf57dd666d10b01b95743e3d84f9e433b9698ec`.
The focused generic-core/source-wrapper/pipeline suite passes 3 files with 53
tests. Verification passes Guide Factory TypeScript, the 67-file/598-test CP37
baseline, validation with 0 errors and 12 existing warnings, application
TypeScript, and dependency-boundary validation.

Checkpoint 38 completes that bounded execution gate. Its source-specific
wrapper authenticates exactly 64 declared non-self selected checkpoint paths:
the checkpoint 37 report and authentication surfaces, generic checkpoint 38
core, selected artifact-sheet generator and replay inputs, runtime data,
calculator core, and roster/equipment-relevant implementations. The source-
specific producer, CLI, and output report are excluded to avoid self-reference.
The set is explicitly selected rather than exhaustive and makes no transitive
module-graph claim.

The source authority stops at the exact four-character roster. The published
rotation text is only upstream input to an unreviewed wrapper-authored
translation; checkpoint 38 does not claim source support for its formula
counts, mappings, or technical objective. Weapons, artifact sets, investment,
generated artifact stats, levels, talents, enemy context, roll budget, and
equipment compositions are also wrapper/runtime-authored. The exact eight
checkpoint 37 readiness blockers remain active.

After the source-specific authentication gate, the exact default environment
creates the real `TeamBuild` instances. The generic core audits distinct
runtime identities rather than claiming a concrete runtime type. The real
default runtime completes 36 nodes, 144 generator invocations with 144 distinct
runtime identities, and 364/364 node-local Cartesian replays with no cross-node
sheet mixing. All
replays pass the internal interpreted-versus-compiled agreement check. The 364
deduplicated compositions contain 139 intact-endpoint matches and 225 cross-
endpoint recombinations. Every node's bounded technical reference is a cross-
endpoint recombination rather than one intact generator output.

The complete-domain technical reference is `926093.666196721`; the best intact-
endpoint technical reference under the same unreviewed objective is
`914219.528685479`. The result fingerprint is
`ea78f4ea4252bd2b39cfe9d99fb0a7ba37d172e2095c628f9df07d82825392b5`.
These are internal finite-table observations, not source-backed damage, DPS,
gameplay, rank, equipment recommendation, or global optimality.

Checkpoint 38 adds durable report 35 and globally integrates it as report 34.
The current 2,011,434-byte report has SHA-256
`c1e62f94d50be01cb5a8b24f2b419a9e52ecafad6829320e2341322691111063`.
The complete 69-file Guide Factory suite passes 642 tests with one intentional
opt-in skip, validation has zero errors and the same 12 existing warnings, and
both application TypeScript and dependency validation pass. Generator and
damage-computation execution are recorded as
operations that ran, while every source, guide, team/equipment recommendation,
rank, damage, DPS, gameplay, optimality, promotion, and ER claim remains false.
This is not a working guide factory.

Checkpoint 39 exposes and authenticates that generated-sheet/allocation
evidence. It re-runs the exact 36-node/four-carry domain, retains 144 fresh
captures and 576 node/carry/character occurrences, and content-addresses 21
unique sheets with 23 stable displayed allocations. Every allocation round-
trips through `StatSheet.fromArtifacts` within the declared two-decimal display
envelope; rounded values do not reveal exact roll tiers or roll counts.

Exactly 4,608 non-ER occurrence rows compare three artifact main stats and five
unique positive displayed substats against 17 authority-labelled knowledge
targets. Applicability and matching target IDs survive the display-state
precedence rule. The resulting 816 resolved, 48 condition-withheld, 2,202
baseline-context-unknown, and 1,542 non-exhaustively unlisted rows are review
observations, not agreement scores or correctness verdicts. The exact-team
Keqing EM target's zero matches remain visible rather than being erased.

The source-specific wrapper authenticates five selected non-self inputs before
execution, including a semantic target scope over 11 exact dependencies and 26
normalized source/consolidated parities, and the exact generic/full payloads
after execution. Those paths are not an exhaustive transitive runtime closure,
and the deterministic report is replayable evidence rather than execution
attestation. The real default runner records generator-internal objective
optimization as executed, but checkpoint 39 performs no separate damage replay,
optimizer call, rank, recommendation, or guide production. All ER values and
post-ER priority claims are retained only as deferral provenance.

Checkpoint 39 adds durable report 36 and globally integrates it as report 35.
The current 17,499,104-byte report has SHA-256
`d6b8f196891ee122a9ce8267f7da7efae3e7e39076b5babf28c3d352b56e6b4a`.
Every guide, recommendation, rank, scalar-weight, damage, gameplay, optimality,
promotion, and ER claim remains false.

Checkpoint 40 projects checkpoint 38's already complete 36-node table into four
active dimensions with exact `3 x 2 x 3 x 2` closure. From source sequence 0,
a single best-neighbor pass follows `0 -> 1`, iterative best improvement follows
`0 -> 1 -> 7`, and declared-order first improvement follows `0 -> 1 -> 13`.
Sequence 7 is only the complete finite-table technical reference; sequences 1
and 13 fall short by `0.785708566169412%` and `0.531264473403165%` under the
same unreviewed objective.

The compact projection retains 576 exact checkpoint-39 occurrence diagnostics
and 4,608 non-ER comparison rows without embedding the upstream reports. Those
diagnostics are excluded from the objective and every policy filter. The real
default report attests zero fresh evaluator, generator, replay, downstream
optimizer, rank, recommendation, and ER calls. Injected callbacks expose those
counts and ER influence as unknown. Checkpoint-39 ER-deferral provenance is
read for authentication, while no ER value is projected into the policy table.

Checkpoint 40 adds durable report 37 and globally integrates it as report 36.
The 2,029,334-byte report has SHA-256
`a2ce1d99443deb81a9559bb0aed9c4d378aefa5d564d2f16074a82fadd987a46`.
Every guide, recommendation, rank, scalar-weight, damage, gameplay, global-
optimality, promotion, and ER claim remains false.

Checkpoint 41 measures start and order sensitivity rather than extrapolating
from source sequence 0. It runs best improvement from all 36 starts and declared
first improvement over all 864 structurally effective orders represented by
3,456 syntactic declarations. The 31,104 declared-order traces split
18,576/12,528 between the two local terminals; best improvement splits its
starts 24/12. The report retains 13 start partitions, 96 all-start path
families, reconstruction digests, and witness traces without fresh generator,
replay, evaluator, or ER work. Checkpoint 41 is durable report 38 and global
report 37; its 71,373-byte output has SHA-256
`c446dec2027cc2b77d20d46ea8d521d3ae4f43f798f34715a4c4ddb771ac2b73`.
The next non-ER boundary should use the expanded repository for a second
character/team slice instead of tuning this one cached Keqing objective.

Checkpoint 42 uses that Xiao refresh for the next bounded non-ER slice. It
authenticates exactly three condition occurrences over the FFXX roster: two
Xianyun-presence predicates and one independently supplied Xiao-C6 request
predicate. Fourteen nonempty conditions and four empty arrays remain
unconsumed. The catalog is now 66 = 63 typed + 3 acknowledged. Manual coverage
still contains 163 arrays; its 140 non-structural rows are 63 typed, 3
acknowledged, and 74 unbound. It authenticates 20 source files and 81 generated-
from paths, while the regenerated Klee witness retains the same four Klee
claims over 6 source files, 85 generated-from paths, and 66 upstream entries.

A separate Xiao formula-count witness maps the source fixture's `E = 2` and
`HP = 12` through an unreviewed Guide Factory alias table. The calculator
default matches Skill at 2 and reports 11 High Plunges. The 12-versus-11
difference is retained as a validation target without damage evaluation or a
correctness verdict. Derived formula coverage is now three fixtures, twelve
member observations, nine characters, 33 positive rows, 18 zero rows, and two
Xiao count comparisons with one match and one mismatch. These are
validation-coverage changes, not recommendation evidence.

The Xiao witness also pins its source-document metadata and labels its code
hash boundary honestly as declared-file rather than transitive runtime
closure. The derived aggregate rebuilds the raw fixture/preset semantic scope
instead of trusting the saved witness's accepted label. Global condition
evidence retains the exact two source matches, one source-unresolved C6 cell,
and its exact FFXX/Xiao request-context resolution.

Human review of the Itto, Keqing, Klee, Diona, Kokomi, Noelle, and Xiao
bindings and source classifications remains a prerequisite for publication,
formula authoring, recommendation composition, or build composition.

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
