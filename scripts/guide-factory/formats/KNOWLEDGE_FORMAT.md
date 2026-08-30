# Consolidated Knowledge Format V1

The consolidated format is a union of exact-team, team-template,
character-role, character-guide, energy-guidance, and source-authored
rotation-fixture records. It does not merge assertions from different sources.

Every record has:

- a stable ID namespaced by source;
- `baseline` or `candidate` review status;
- explicit promotion eligibility for external manual observations;
- one or more source references;
- explicit unknowns.

An indexed manual observation may consolidate only when its source has exactly
one registry entry, is active, uses `manual-observation` with
`manual-observation-v1`, and is not `permission-required`. Missing, duplicate,
planned, blocked, permission-required, or format-mismatched sources fail closed;
collection validation reports the permission case as
`provenance.manual_source_ingestion_not_permitted`. This gate authorizes the
configured ingestion path only. It does not make the source authoritative or
make an unreviewed record promotion-eligible.

## Team records

A team has exactly four distinct members. Each member may preserve:

- a selected weapon and optional refinement;
- a selected 4-piece artifact set or two 2-piece effect-group IDs;
- an optional sourced ER floor in percent;
- an exact, one-sided, two-sided, or unspecified constellation investment
  state, plus Talent levels when the source actually supplies them;
- unranked or ranked weapon and artifact recommendations with conditions;
- ordinal main-stat and substat recommendations;
- optional ER targets when the source binds them directly to that team.

An editorial team also records whether it is an example or prescription,
whether its list is exhaustive, and whether the source makes a ranking claim.
Source rotations remain notation plus unresolved segments; they do not become
formula counts automatically.

An exact constellation and a constellation range are mutually exclusive.
One-sided ranges remain one-sided in serialized knowledge: `C2+` is
`minConstellation: 2`, not exact C2 and not an invented C2-C6 record set.
Unspecified investment may be technically non-conflicting with a later local
assumption, but it is not explicit source evidence for every constellation.

Derived source-to-baseline comparison is constellation-only and preserves both
raw scopes. An unspecified source does not constrain the baseline. A constrained
source against an unspecified baseline remains unresolved. A baseline scope
wholly inside the source scope is guaranteed to satisfy it; disjoint scopes
conflict; overlapping scopes that are not wholly contained remain unresolved.
This comparator does not evaluate Talent levels, equipment, or gameplay
applicability, and it never serializes implicit C0 or C6 endpoints for a
one-sided source range.

An optional formula-count damage plan contains positive counts for formulas
owned by members of the team. Formula IDs are structurally validated in this
checkpoint; engine availability and gameplay feasibility are deferred until an
exact calculation variant exists.

## Rotation-fixture records

A rotation fixture preserves one source-authored character rotation plus
positive exact counts under source-local action tokens. Consolidation keeps the
rotation, token labels, counts, source references, and unknowns one-to-one. It
does not map those tokens to calculator formula IDs, join equipment, infer ER,
or attach the fixture to a team. These records must remain `candidate` with
`promotionEligible: false`; a later comparison may observe a mismatch but
cannot promote either side into rotation truth.

## Team-template records

A team template has exactly four slots. Each slot's required `options` contain
one or more explicit alternative selectors:

- named character IDs;
- lowercase element IDs;
- source-defined role labels;
- unrestricted `any`.

An optional `highlightedOptions` list preserves named characters, elements, or
source-defined roles that the source calls out within an otherwise broad slot.
Highlights are recommendations, not additional matching requirements, and
cannot use `any`. Coverage therefore evaluates only `options`; it does not
silently narrow an unrestricted slot to the highlighted examples.

Templates preserve example or prescriptive intent, exhaustiveness, and ranking
claims. They are not expanded into exact teams during consolidation. Current
coverage computation can resolve character, element, and unrestricted slots;
role slots remain unresolved because V1 has no global role catalog.

## Character-role records

A character-role record preserves positive named members for exactly one hard
role option in one same-source team-template slot. Members can carry source-
stated conditions and optional minimum or maximum constellation bounds. The
record also preserves whether the source claims the list is exhaustive and
whether it claims an order; absent members are not negative evidence unless a
future reviewed, explicitly exhaustive record supports that interpretation.

Manual character-role records consolidate one-to-one as candidates with
`promotionEligible: false`. They are not merged across templates, slots, pages,
or publishers. Their named members can be inventoried as bounded evidence, but
they do not resolve role selectors in template coverage or create a reusable
character-to-role catalog. When two records are inspected together, fully
captured source-positive member lists remain intact and only explicit
exact-team targets may be validated; unexercised members do not authorize a
Cartesian pair domain.

## Character-guide records

A character guide can preserve weighted internal build records or heading-
scoped external recommendations. Weighted builds may contain:

- artifact configuration;
- minimum constellation;
- roles and styles;
- weighted Sands, Goblet, Circlet, and substat recommendations.

Weights remain source weights. They are not converted into ranks or damage
percentages.

External recommendations preserve their source scope (`weapons`, `artifact-
sets`, `artifact-stats`, or `energy`), whether order is meaningful, the
difference between alternatives and tied ranks, and applicability conditions.
They may carry both minimum and maximum constellation bounds for advice that
applies only to a limited investment range.
An unranked source list never becomes a ranking merely because its items have a
display order.

Applicability conditions in V1 remain attributed source prose. A source-
specific validator may acknowledge an exact condition through an explicit
text-to-predicate table, but it must report which predicates are merely roster-
decidable and which remain unresolved build or gameplay inputs. It must not
parse prose into a global condition ontology. Weapon and artifact arrays that
share one recommendation are also not an atomic pair in V1; coupled equipment
advice must remain deferred unless a first-class coupled shape is added.

### Derived request/account applicability

Request and account context is experiment input, not source knowledge. A strict
context fixture may state team-scoped character intent, optimization goals,
character constellation, named Auto/Skill/Burst Talent levels, acquisition
preferences, explicit execution assumptions, and bounded account-inventory
facts. Constellation and Talent levels are request facts scoped to an exact
team and character, not verified account investment. It must not contain source
claim IDs, requested resolutions, recommendation fields, or source-condition
prose.

A source-specific wrapper owns the mapping from an exact source-condition leaf
to a typed context query. The mapping pins the condition-array, full-predicate,
leaf-path, and leaf hashes. Context may refine only a previously unresolved
leaf; it cannot replace an exact-roster result or an omitted-energy
prerequisite. Omitted request facts remain unknown. A missing inventory item is
false only when the corresponding inventory domain is explicitly complete, and
account facts must retain their snapshot identity.

Constellation facts and thresholds must be safe integers from 0 through 6.
Talent facts and thresholds must be positive safe integers and name `auto`,
`skill`, or `burst`. `constellation-at-most` is unknown when its fact is
omitted, true when the supplied value is at or below its threshold, and false
above it. `talent-level-is` is unknown when the named Talent fact is omitted,
true only for exact equality, and false for another supplied value. Numeric
predicates retain three-valued `all`/`any` semantics: `all` is false if any
child is false, true only if every child is true, and unknown otherwise; one
true child makes `any` true, every child must be false for `any` to be false,
and its remaining cases are unknown. Constellation and Talent facts remain
independent; one never derives the other.

Derived context applicability must preserve the original source resolution and
provenance separately. `applicable-under-supplied-context` means only that the
supplied facts satisfy the mapped condition. It is not source authorization,
comparative performance, rank, suitability, account advice, or a player-facing
recommendation, and independently evaluated contexts must not be multiplied
into one build.

The Noelle Luna VIII high-investment slice authenticates the source
condition `Noelle is C6 or her Burst Talent is Level 10 or higher.` for three
exact main-stat occurrences. The source predicate remains unresolved and keeps
Talent evaluation disabled. Only the wrapper-owned request mapping evaluates
`any(constellation >= 6, burst talent >= 10)`. Its durable exact-team context
supplies Noelle C6 and omits Burst Talent level, so the three source-unresolved
cells become applicable while the omitted branch remains unknown. This proves
typed context applicability only, not source authorization, account investment,
stat correctness, or a recommendation.

The separate Noelle lower-investment slice authenticates the source condition
`Noelle is C0–C5 and her Burst Talent is Level 9.` for three exact main-stat
occurrences. The source predicate remains unresolved and keeps Talent
evaluation disabled. Only the wrapper-owned request mapping evaluates
`all(constellation <= 5, burst talent == 9)`. Its exact-team context supplies
independent Noelle C5 and Burst Talent 9 facts, making both leaves and all three
effective cells matched. This proves only typed context applicability inside the
standalone slice; it does not make the cross-record team validation source-
authored or admit an occurrence to the current catalog.

### Derived source-local condition slices

A source-local slice may compose typed source-condition evaluation with strict
request/account applicability for a deliberately selected subset of one source
document. It must identify every selected occurrence by its exact source
record, schema path, ordered-condition hash, predicate hash, payload hash, and
repository counterpart, and it may evaluate only exact teams belonging to that
same document. Selected occurrences and explicit holdouts must close the
adapter's declared source boundary; unselected occurrences receive no binding
or energy classification merely because their wording is similar.

The source resolution remains primary. Request facts may refine only an exact
`unresolved-context` leaf and must be scoped independently to one team and
character. They cannot replace roster-decidable truth, deferred-energy
prerequisites, or omitted facts. A slice must retain source and effective
partitions separately and must not convert the resulting cells into
recommendation groups, builds, ranks, formula inputs, damage results, or ER
targets.

The current Klee Luna IV adapter selects exactly four of 15 occurrences: three
on-field-role main-stat rows and one Furina-roster artifact-set row. Two exact
teams yield eight cells with a source partition of 1 matched, 1 inapplicable,
and 6 unresolved. Explicit per-team Klee role intent yields an effective
partition of 7 matched and 1 inapplicable. The 11 holdouts receive no
classification from this slice.

The current Diona Luna VIII adapter selects three artifact condition
occurrences from one exact C6 Diona/Mavuika/Citlali/Bennett team record: Diona
member 0, Citlali member 2, and Bennett member 3. All three source predicates
remain unresolved gameplay-role facts until independent support facts scoped to
the exact team and exact character make them applicable. Diona's Song/Noblesse
group, Citlali's Scroll singleton, and Bennett's Noblesse/Instructor group retain
source order without becoming choices, assignments, or a composed team build.
The source boundary closes 26 arrays as 18 nonempty and 8 empty; the selected
three and 15 nonempty holdouts are exact and disjoint. Ten holdouts are ordinary
descriptive inventory and five are ER-deferred descriptive inventory. The slice
consumes, binds, or energy-classifies none of them.

The Kokomi Luna V adapter selects exactly member 0's first artifact
condition from the exact Kokomi/Ineffa/Columbina/Sucrose team record. It
preserves one 4pc Ocean-Hued Clam payload with source classification
`recommended` and ordering `unranked`. The pinned ordered roster conjunction is
source-matched, so context applicability is `source-already-matched` with no
request fact or binding. All five Kokomi condition arrays are nonempty: one is
selected and four are exact holdouts. The slice consumes, binds, or energy-
classifies none of the holdouts.

The Noelle Luna VIII adapter selects exactly three occurrences from
the high-investment main-stat branch: DEF% Sands, Geo DMG Bonus Goblet, and CRIT
Rate/CRIT DMG Circlet. The exact 16-array boundary closes as three selected, 12
nonempty holdouts, and one empty occurrence. It projects the independent claims
over the exact Noelle/Durin/Nicole/Xilonen source team with a C6 request fact.
All three source cells remain unresolved; all three context projections become
applicable and effectively matched. Holdouts and the empty occurrence receive
no slice-authored binding or energy classification. The adapter creates zero
candidates, equipment assignments, optimizations, or assembled builds.

The lower-investment Noelle Luna VIII adapter separately selects exactly three
C0-C5/Burst-Talent-9 main-stat occurrences: ATK% Sands, Geo DMG Bonus Goblet,
and CRIT Rate/CRIT DMG Circlet. It uses the same exact
Noelle/Durin/Nicole/Xilonen team only as wrapper-owned cross-record validation.
The same 16-array source boundary closes as three selected, 12 nonempty
holdouts, and one empty occurrence; no substat is selected. Holdouts and the
empty occurrence receive no slice-authored binding or energy classification.
The standalone report authenticates four raw inputs and 13 generated-from paths
and creates zero candidates, assignments, optimizations, or builds.

A durable source-local report is downstream evidence only when it equals a
fresh authenticated rebuild from the exact raw inputs. Dependency direction
must stay acyclic: raw source inputs feed the source-local slice, an
authenticated slice may feed the condition-binding catalog, and that catalog
may feed coverage. The source-local evaluator must not read either downstream
artifact.

Catalog evidence kinds may be shared by source-local adapters only when the
entry retains its exact source-specific wrapper authentication, occurrence
identity, extraction contract, and `sliceId`. The current generic labels are
`source-local-typed-predicate-ast` and `source-local-not-energy-deferred`;
generic labels do not authorize a generic source extractor or cross-source
predicate inference.

Authentication and catalog admission are separate gates. Checkpoint 30 admits
only the already authenticated Kokomi selected occurrence. It pins the exact
source literals, hashes, team/member/subject identity, ordered roster predicate,
Ocean-Hued Clam payload, `recommended`/`unranked` metadata, and zero request-
binding boundary. The four exact Kokomi holdouts remain unbound and energy-
unclassified.

Checkpoint 32 separately admits only the three checkpoint 31 Noelle selected
occurrences. Admission requires exact durable/current report equality and
repeats the source identities, shared source and request predicates, three
payloads, numeric request projection, 3/12/1 selected/holdout/empty partition,
and disabled capability boundary before normalized entry construction. The 12
holdouts and one empty occurrence remain outside the catalog and receive no new
binding or energy classification.

Checkpoint 33 keeps the three lower-investment selected occurrences outside the
catalog. Their typed and not-energy-deferred classifications exist only inside
the standalone slice; manual coverage continues to classify those exact rows as
unbound and energy-unclassified. Any later admission requires a separate gate.

Checkpoint 34 supplies that separate gate. It requires exact durable/current
lower-investment report equality and repeats the lower wrapper's source,
identity, numeric-request, payload, recommendation-metadata, claim/control,
3/12/1 partition, and disabled-capability checks before normalized entry
construction. Only the three selected main-stat occurrences are admitted. All
12 nonempty holdouts and the one empty occurrence remain outside the catalog.
The high- and lower-investment Noelle branches remain occurrence-disjoint even
where payload or unresolved source-predicate hashes coincide.

A private normalized helper may perform only repeated selected-occurrence,
source-claim, and condition-control parity plus catalog-entry construction after
source-specific wrapper checks pass. It must not become a generic wrapper,
schema adapter, extractor, or prose parser.

### Derived condition-array coverage

Condition coverage is derived validation evidence, not a new knowledge record.
The extractor traverses only schema-defined condition arrays in indexed manual
snapshots and retains their exact source record, schema path, subject, ordered
strings, and ordered-array hash. It then verifies the same array at the exact
consolidated repository path; the repository copy is not counted as a second
observation. A separate pre-schema recursive audit requires every raw
`conditions` property to have one exact extracted path and ordered payload, so
new or unknown condition-bearing fields cannot be stripped and omitted
silently.

A machine-readable binding must identify the source, record kind, source record,
schema path, ordered-array hash, and subject. Text equality or hash equality
alone is insufficient because the same condition can occur for multiple role
members with different validation evidence. Binding and energy classifications
remain independent:

- `typed-bound` means an authenticated wrapper maps the exact array to explicit
  predicates; it does not mean those predicates are true;
- `exact-text-acknowledged` means an exact configured target carries the source
  text; it does not validate gameplay execution;
- `unbound` is an authoring backlog, not evidence that a condition is false;
- binding coverage is counted across nonempty arrays independently from energy
  status, with a separate non-structural view;
- structural ER, typed deferred prerequisites, and exact authored source-text
  deferrals remain explicit energy states; and
- acknowledgement-only and unbound arrays default to `energy-unclassified`,
  never semantic non-ER. A `not-energy-deferred` label requires an explicit
  wrapper contract and still does not compute an ER requirement.

Coverage reports must fail closed on stale or non-comparable wrappers,
repository mismatch, ambiguous or partial expansion, duplicate/conflicting
bindings, subject leakage, or a durable source-local report that differs from
its fresh authenticated rebuild. They must not parse arbitrary English, infer
a predicate from repetition, or turn coverage frequency into confidence,
ranking, or recommendation quality.

The current authenticated catalog contains 66 entries: 63 typed bindings and 3
exact-text acknowledgements. The guide-selected corpus contains 163 arrays from
8 snapshots and 71 records: 20 empty and 143 nonempty. Full nonempty binding
coverage is 63 typed, 3 acknowledged, and 77 unbound. The non-structural
partition is 140 rows: 63 typed, 3 acknowledged, and 74 unbound. Its 102 unique
ordered arrays contain 37 typed-only, 64 unbound-only, and one mixed
acknowledged/unbound set. The independent energy ledger is 15 deferred, 60
explicitly not energy-deferred, 68 nonempty unclassified, and 20 empty
unconditional arrays. Display status is 60 typed, 65 known-but-unbound, 15 ER-
deferred, 3 acknowledged, and 20 unconditional. Coverage authenticates eight
wrapper families plus the Xiao slice across 20 source files and 81 generated-
from paths. The ninth
indexed snapshot is the separate Xiao rotation fixture and contributes no
condition array.

### Derived condition-resolved flat claim joins

A downstream witness may collect independently applicable claims under one
exact team only after authenticating the source-local condition slice and
condition-coverage boundary that identify them. Every retained claim must keep
its exact source record, payload group, source cell, request projection,
selected-occurrence control, coverage row, and authorship provenance. The join
must also retain a negative exact-team control when an otherwise shared claim
set contains a source-definitely-inapplicable roster condition.

Such a witness is a flat applicability evidence set, not a build. It must not
expand payload axes, select among alternatives, evaluate payload
compatibility, create a Cartesian product, infer completeness, or derive a
rank, recommendation, generator input, optimizer input, formula plan, damage
result, ideal-roll target, or ER requirement. Source-authored claims and teams
do not make a cross-record join source-authored; the wrapper must state its own
authorship explicitly.

The current Klee witness retains four independently applicable claims from two
source records for the exact Klee/Furina/Albedo/Xilonen source team. CR/CD stays
one unchosen payload group. The exact Klee/Chevreuse/Durin/Fischl control keeps
the three role claims applicable but leaves the Furina-conditioned
Marechaussee Hunter claim source-definitely-inapplicable, so it produces no
positive witness. None of the 11 Klee holdouts is consumed.
When upstream coverage changes, the durable Klee witness must be regenerated
and reauthenticated; a broader catalog does not add claims to that exact
witness. At checkpoint 34 the witness authenticates six source files, 76
generated-from paths, and 63 upstream bindings while retaining the same four
claims, positive team, negative control, and holdout exclusions.
Checkpoint 42 regenerates the same witness after Xiao's three independent
catalog admissions. Its semantics stay fixed while the authentication boundary
becomes six source files, 85 generated-from paths, and 66 upstream bindings.

### Derived source-specific applicable-claim projections

An applicable-claim projection may expose multiple exact evidence views over
one authenticated source-local slice. It must fresh-authenticate that slice,
retain the complete selected/holdout/empty partition, and preserve source facts
separately from wrapper- or request-owned facts. A request-resolved occurrence
must name its exact team, character, predicate, provenance, and source-
unresolved state; it cannot retroactively become source-authored.

Payload identity deduplication may group equal payloads only under explicit
technical identity fields. Every contributing occurrence and its different
applicability reason must remain visible. Multiplicity cannot become a vote,
corroboration, confidence, preference, or rank signal.

Checkpoint 43 applies this shape only to the three authenticated Xiao FFXX
occurrences. The source-only view is 2 matched / 1 unresolved; the exact FFXX
plus wrapper-C6 view is 3 matched / 0 unresolved. Source-only has one
Marechaussee Hunter group and one Anemo Goblet group. The request view remains
at two groups because its newly applicable C6 Anemo occurrence shares the
existing Anemo payload identity; both reasons remain visible. The projection
creates no Cartesian product, compatibility result, candidate, complete build,
recommendation, generator input, optimizer input, formula plan, damage result,
ideal-roll target, or ER requirement.

### Derived authenticated partial technical candidates

A partial technical candidate may join authenticated singleton axes only under
an explicit Guide Factory authorship boundary. Its identity must cover the
exact team and character, ordered present payloads, and a fixed present/missing
axis policy. View- or request-specific facts belong to provenance bindings and
must not alter technical identity unless they actually introduce a different
payload.

Every required but unadmitted build axis must remain explicitly missing without
a default. A partial candidate cannot be serialized as a complete guide
recommendation or runtime generator candidate by fabricating those fields.
Source-authored observations do not make the cross-record whole composition
source-authored, recommended, compatible, complete, ranked, or optimal.

Checkpoint 44 uses a six-axis vocabulary and joins only the authenticated Xiao
FFXX Marechaussee Hunter and Anemo Goblet singleton payloads. Weapon, Sands,
Circlet, and substats remain missing. The source-only and explicit-C6 views are
two provenance bindings to one Guide Factory-authored partial identity. The C6
reason adds no second payload or candidate. ER remains excluded and deferred,
and no choice selection, Cartesian enumeration, compatibility evaluation,
generator, optimizer, formula, damage, rotation, or ideal-roll computation is
performed.

### Derived authenticated source branch domains

A source branch domain preserves possible source rows before deciding which
ones are applicable or composable. Source array order may be exposed as a rank
only when the source record explicitly declares ranked groups. Members of one
tied group remain tied. An unranked record may retain source positions for
provenance, but those positions are not ordinal ranks. Separate rarity classes
remain incomparable unless an authenticated source or later computation
defines a cross-class objective.

Empty conditions identify source-condition-free observations, not universally
best choices. Nonempty conditions remain guarded until an exact fact adapter or
computation evaluates them. A guarded multi-stat row is one unresolved choice
group rather than several independently recommended leaves. Shared condition
text does not merge distinct payloads or priorities.

Checkpoint 45 applies this shape to thirteen Xiao observations. It contains
three ranked five-star tied groups, six unranked four-star options, ATK% Sands,
one guarded CR/CD Circlet group, and two guarded offensive-tail substat rows.
It emits no candidate, build, ranking beyond the source's three five-star group
positions, recommendation, formula, damage, ideal-roll allocation, or ER
result. The offensive-tail rows remain incomplete while the source's leading
ER term is deferred.

### Derived authenticated condition-free branch candidates

A condition-free branch candidate domain may combine one authenticated partial
candidate with source-condition-free leaves from an authenticated source branch
domain. The product bounds and admitted occurrence identities must be explicit,
and every generated object must retain Guide Factory authorship. Empty source
condition arrays are an admission rule only; they do not prove compatibility,
universal applicability, relative strength, or a recommendation.

Technical identity contains only the actual equipment/stat payloads and the
explicit missing-axis policy. Source ranks, tied membership, classifications,
occurrence identities, and request-view bindings belong to separate provenance
hashes. A source group rank cannot become an individual rank, serialization
order cannot become a rank, and separately ranked rarity classes cannot be
merged without an evaluated objective.

Checkpoint 46 applies this shape to checkpoint 44's one Xiao FFXX partial
candidate and checkpoint 45's six condition-free weapon leaves plus ATK% Sands.
The exact `1 x 6 x 1` product yields six partial candidates across three source
groups and twelve inherited view-evidence bindings. Every candidate contains a
weapon, 4pc Marechaussee Hunter, ATK% Sands, and Anemo DMG Bonus Goblet. Circlet
and substats remain guarded missing axes, all nine guarded source observations
remain withheld, and no candidate is complete or materializable as a guide or
runtime generator input. The report performs no selection, compatibility,
formula, damage, optimizer, ideal-roll, rotation, or ER computation.
The empty-condition admission label applies only to the new weapon and Sands
branches. Marechaussee Hunter and the Goblet remain explicitly team-conditioned
inherited payloads.

### Derived authenticated replay-representation preflights

A replay-representation preflight is a derived validation report, not a source
record, build, or recommendation. It may materialize one authenticated partial
candidate domain under explicit wrapper-owned calculator assumptions, but it
must keep source facts, upstream calculator defaults, wrapper-authored formula
order/flags, runtime materialization, and computed observations in separate
provenance fields.

Its raw boundary must hash the exact declared runtime and upstream inputs. When
the report claims a static first-party runtime closure, a separate graph check
must derive local value imports, re-exports, and literal dynamic imports and
reject both missing and unreachable paths. Binary resources are authenticated
as raw bytes rather than decoded text. Every parsed JSON object used by the
builder must agree with the authenticated bytes for that path.

Formula-count equality does not establish execution representation. Grouped
counts, unit-expanded lines, action order, reactions, and on-field flags must
be explicit. If interpreted and compiled calculator paths disagree for any
candidate, the report may authenticate the discrepancy but must mark the domain
non-comparable and emit no rank, winner, recommendation, or damage-comparison
claim. A representation that restores dual-path agreement is still only a
technical witness until its ordering, timing, and fixture assumptions have
independent authority.

Checkpoint 47 applies this shape to the six Xiao FFXX partial candidates. It
authenticates 118 raw-byte inputs, executes only the source-only C0 view, and
keeps the wrapper-C6 view outside execution identity. Six grouped replays fail
dual-path agreement; six unit-expanded replays agree and preserve interpreted
totals. Candidate observations are sorted and hashed by technical candidate ID,
not source rank. The source's twelve-plunge/no-external-buffs plan remains
withheld from the externally buffed FFXX fixture. The report therefore has zero
comparable or ranked candidates and supports no guide, build, stat, rotation,
damage, ideal-roll, or ER claim.

### Derived unit-expanded execution gates

A unit-expanded execution gate may project a freshly authenticated
representation preflight into candidate-level technical eligibility. The gate
must not duplicate a private fixture or trust a saved accepted label: it must
fresh-authenticate the upstream report through its complete raw boundary and
independently reproduce the normalized execution-unit plan.

Normalization must be explicitly scoped. Positive safe-integer counts,
maximum expansion size, contiguous authored line order, and preservation of
character/formula/reaction/on-field fields are part of the identity. Exact
equality with the upstream unit plan is required. This shape does not establish
that fractional, ranged, optional, timing-sensitive, or arbitrary future count
representations may be expanded the same way.

Eligibility and comparison are separate states. A candidate may become
eligible only after normalized interpreted/compiled agreement and grouped-
interpreted/normalized-interpreted invariance pass under one exact fixture.
The gate may preserve source-group membership in a separate provenance
projection, but source rank, rarity, tied membership, and source order cannot
affect technical identity or serialization. Until a downstream report actually
executes a comparison, pairwise count, rank count, winner count, and selection
count remain zero.

Checkpoint 48 applies this shape to checkpoint 47. It authenticates 121 raw-
byte inputs and thirteen JSON byte/object pairs, reproduces the exact thirteen
execution units, and admits six technical-ID-sorted observations. It records
three provenance groups and six membership edges, makes no additional
calculator replay, and marks comparison execution not performed. The result
supports no damage, guide, build, stat, rotation, ideal-roll, optimizer,
generator, AutoTune, or ER claim.

### Derived source-group validation diagnostics

A source-group validation diagnostic may join authenticated technical
observations to ordinal source groups only after both projections are preserved
separately. Technical observation identity must not contain source rank. Source
rank may enter the validation-target and joined diagnostic identities because
it defines the tested relation, but it cannot change the authenticated numeric
observation.

Cross-group enumeration must be exhaustive and deterministic. Tied membership
inside one ordinal source group does not imply equal computed values, so it
must not create within-group ranks or equality failures unless the source
explicitly makes that stronger claim. Cross-rarity relations remain excluded
without authenticated source ordering. Floating tolerance must be labelled as
numeric equivalence rather than gameplay significance.

Checkpoint 49 applies this shape to checkpoint 48. It authenticates 124 raw-
byte inputs and fourteen JSON byte/object pairs, compares the complete three-
by-two five-star group cross-product, and records overlapping observed ranges,
two source-order alignments, four counterexamples, and zero tolerance ties.
Deathmatch remains an authenticated excluded observation. The output is a set
of validation targets, not source ground truth, a computed correction, a
weapon rank, a damage recommendation, or a guide result.

### Derived guarded local-marginal diagnostics

A guarded local-marginal diagnostic is another derived report, not a new
knowledge-record kind. It may admit source-listed stat keys as an experimental
domain only after the exact source occurrences, item/group identities,
conditions, and unresolved disposition are authenticated. Experimental
admission cannot change `guarded-unresolved` into source applicability, a
choice, a priority, or a recommendation.

When the computation reconstructs a private upstream fixture, independent
controls must reproduce its authenticated numeric result and activation trace
before any variant is admitted. Control executions remain outside the lattice
node count. Explicit main-stat and one-roll sheets must distinguish current
runtime constants from source-authored values and must say whether inherited
allocator metadata such as roll multiplier or budget participates.

Each one-roll marginal binds exactly one parent and one child with the same
candidate and main-stat context. A legal non-conflicting placement domain may
be recorded, but no slot or feasible allocation exists until one is selected
under an explicit artifact-quality policy. Local deltas cannot be aggregated
into scalar weights or a global stat order without a separately reviewed
objective and allocation method.

Checkpoint 50 applies this shape to the Xiao FFXX candidate domain. It
authenticates 127 raw-byte inputs and fifteen JSON byte/object pairs, executes
six no-Circlet reconstruction controls plus twelve CR/CD baselines and
thirty-six one-average-roll probes, and requires direct/compiled agreement plus
the exact Xianyun trace for all 54 replays. The 48 lattice nodes produce 36
local deltas, six same-weapon Circlet deltas, and twelve same-Circlet five-star
source-group validation pairs. Mixed-Circlet, perturbed cross-weapon, within-
group, and cross-rarity comparisons are absent.

The report's raw boundary declares the inherited 80-path replay-runtime set;
a focused AST test, rather than the report core, proves import closure and
reachability. Technical node identity retains the inherited checkpoint-46
candidate identity and missing-axis policy but excludes checkpoint-50 guard-
resolution/publication fields and the separate candidate-provenance hash.
Source-group membership remains authentication/provenance input and constructs
only the baseline validation pairs, not replay totals or technical nodes.

The cross-group rows split 5 aligned, 7 counterexamples, and 0 tolerance ties;
the CR and CD strata remain separate. The KQM 70% CR and near-1:2 conditions
remain unresolved because their reference frame and tolerance are undefined.
The output is not a stat priority, Circlet choice, legal roll allocation,
weapon order, build, damage/gameplay claim, or guide result. ER is not used.

### Derived isolated sign-only evidence joins

A permission-isolated source may participate in a standalone validation report
without entering the shared source registry or consolidated repository. Such a
report must hash-close every input independently, authenticate any raw-to-
repository parity it relies on, preserve the source's unknown context, and name
the wrapper as the author of every cross-record join.

Checkpoint 35 applies that rule to exactly five Keqing inputs:
ArtifactRatingDB, the consolidated repository, a four-endpoint local-marginal
diagnostic, the raw KQM snapshot, and the existing KQM equipment-evidence
report. It verifies the equipment report's exact-team, default-main-stat, and
eight-claim projections—seven exact-team matches and one unresolved secondary
condition—before emitting ten stable, unranked sign-only rows.
Those rows contain four source-nonzero/local-positive observations, four
source-zero/local-zero observations, one Elemental Mastery objective-coverage
gap, and one Electro DMG Bonus source-main-only observation.

This derived shape cannot compare coefficient or marginal magnitudes, sort KQM
priorities, establish context comparability, promote evidence, produce scalar
weights, or support guide, rank, main-stat, substat, candidate, optimizer,
ideal-allocation, or ER claims. Its two `SPRatioBase` occurrences remain
deferred, and its local objective retains eight readiness blockers. It is a
durable report, not a new knowledge-record kind. Mixed permission and blocked
consolidation keep it outside the shared registry, repository, condition
catalog, global validator, and application.

### Derived source-backed equipment candidate lattices

A source-backed equipment lattice is a derived report, not a knowledge-record
kind and not a recommendation. Its generic core may validate and enumerate a
finite product only after a source-specific wrapper has authenticated every
record, group/list, occurrence, request assumption, and search-coverage
reference used to form the axes. Failed source-specific authentication must
withhold the core call rather than enumerate and discard candidates afterward.

Checkpoint 36 authenticates nine direct inputs for the exact
Keqing/Ineffa/Furina/Xilonen roster. Its inventory contains nine groups/lists
and 20 occurrences: 14 active, four fixture-scope holdouts, one C6 holdout
under the C0 request, and one ER-derived holdout. Only equipment identities are
projected; source build main-stat and substat weights are not part of the
lattice payload.

The generic input contains exactly four members and eight ordered weapon/
artifact axes. The current domain cardinalities are `3, 2, 1, 1, 3, 2, 1, 1`,
so the bounded product contains 36 nodes and 288 references. Source ordering,
ties, alternatives, conditions, and preset list positions remain local
metadata. A source list position or ranked-group index must not be copied into
`sourceLocalRank`; that field stays null unless the source supplies an explicit
numeric rank.

Structural condition resolution and gameplay applicability are separate. The
exact roster may satisfy a roster condition, a request refinement map may
satisfy equal refinement, and an explicit request assumption may satisfy a
scenario condition without validating gameplay. Preset team applicability is
unknown. Source warnings, including the Xilonen Scroll activation warning,
remain provenance-bound.

Source backing also stops at the authenticated member axes. The source does
not thereby author a weapon/artifact pair, a cross-character composition, or a
whole team-equipment candidate. Checkpoint 36 therefore records zero source-
published whole candidates and marks every composition as wrapper-authored.
Enumeration does not support team/equipment recommendations, rank, optimality,
evaluation, candidate generation, optimization, damage, gameplay validation,
guide production, promotion, or ER requirements.

The checkpoint 36 report is globally integrated as report 32 and is durable
report 33 overall. Materialized team-build inputs and technical preflight are a
separate boundary; they cannot be inferred from lattice enumeration.

### Derived source-backed runtime materialization preflights

A runtime materialization preflight is also a derived report, not a new
knowledge-record kind. It may consume a complete authenticated lattice only
with a caller-authenticated exact objective envelope, an exact closure over all
active occurrence payloads and selected equipment, and explicit runtime
assumptions. The generic core validates those inputs but does not establish
source binding or interpret source prose; a source-specific wrapper must own
that responsibility.

Checkpoint 37's Keqing/Ineffa/Furina/Xilonen wrapper authenticates the declared
non-self checkpoint input set containing selected upstream/runtime dependencies
across 38 declared paths for the checkpoint 36 lattice and exact 11-line
Keqing/Ineffa formula draft.
The set excludes the producer, CLI, and emitted report to avoid self-reference;
it explicitly makes no exhaustive or transitive module-graph claim. It resolves
all 14 active occurrences, then supplies level-90, C0, talents-10/10/10,
enemy-110/resistance-0.1, roll-0.85/`8_6`, empty-options, null-aura, no-extra-
buffs runtime inputs with all four carry IDs. Those values are wrapper-owned
technical assumptions. They are not source-authored character, enemy, rotation,
or artifact-investment facts and must not be consolidated as such. ER
thresholds and per-character constraints are null.

All 36 nodes materialize through fresh existing-runtime `TeamBuild` instances.
The report records 396 objective-formula and 180 non-null unresolved-reference
availability checks, but availability is not formula evaluation. The exact
eight upstream readiness blockers remain present: one translation-unreviewed,
one partial-token-mapping, five unresolved-formula-mapping, and one unresolved-
source-token. Consequently the report is materialized but evaluator-not-ready.

The preflight produces no generator, replay, damage, score, rank,
recommendation, gameplay, guide, promotion, or ER evidence. Its 555,200-byte
durable report has byte SHA-256
`df5f8d938223063d82cee70cbaf57dd666d10b01b95743e3d84f9e433b9698ec`,
is durable report 34 overall, and is globally integrated as report 33.

### Derived bounded full-team technical computations

A bounded full-team technical computation is another derived report, not a new
knowledge-record kind and not a source-backed build. It may consume a complete
authenticated runtime preflight, but successful execution does not upgrade the
preflight's source readiness, objective review, or gameplay applicability.

Checkpoint 38's Keqing/Ineffa/Furina/Xilonen wrapper authenticates exactly 64
declared non-self selected checkpoint paths spanning the checkpoint 37 trust
root, generic checkpoint 38 core, selected artifact-sheet generator and replay
inputs, runtime data, calculator core, and relevant calculator
implementations. The source-specific producer, CLI, and report are excluded to
avoid self-reference. This is explicitly a selected boundary rather than an
exhaustive dependency closure, and it makes no transitive module-graph claim.

The source team record supports the exact roster only. Its rotation text is
upstream input to an unreviewed wrapper-authored formula translation, not a
source-supported technical damage plan. Selected equipment, investment,
generated artifact stats, formula counts and mappings, character levels,
talents, enemy context, and artifact budget are not source facts. None of those
derived values may be consolidated into source-authored fields.

After the source-specific authentication gate, the exact default environment
creates the real `TeamBuild` instances; the generic core audits distinct
runtime identities without claiming a concrete class. The bounded run completes
36 nodes, 144 generator invocations with 144 distinct runtime identities, and
364 node-local replays. Canonical node-local sheet deduplication produces 139
compositions matching at least one intact four-character endpoint and 225
cross-endpoint recombinations. All 36 bounded node references are cross-
endpoint recombinations. A recombination is evaluated by the replay runtime but
must not be called generator-produced, while an intact endpoint must not be
called source-authored.

The complete-domain technical reference `926093.666196721`, intact-endpoint
technical reference `914219.528685479`, and result fingerprint
`ea78f4ea4252bd2b39cfe9d99fb0a7ba37d172e2095c628f9df07d82825392b5`
are internal observations for this exact finite table and unreviewed objective.
Direct/compiled agreement is an implementation consistency check. These facts
do not support damage, DPS, rank, recommendation, gameplay, or optimality.

The checkpoint 38 report is durable report 35 overall and globally integrated
report 34. Its 2,011,434 bytes have SHA-256
`c1e62f94d50be01cb5a8b24f2b419a9e52ecafad6829320e2341322691111063`.
Every source, guide, team/equipment recommendation, rank, damage,
DPS, gameplay, optimality, promotion, and ER capability remains false.

### Derived generated-sheet evidence

A generated-sheet evidence catalog is derived review material, not a new
knowledge-record kind. Checkpoint 39 re-runs checkpoint 38's exact bounded
domain and retains generated sheets and stable displayed allocations under the
exact node/carry/character occurrence that produced them. Content-addressing a
sheet does not permit targets from one occurrence to leak into another
occurrence that happens to share the same sheet.

The checkpoint contains 144 fresh captures, 576 occurrence contexts, 21 unique
sheets, and 23 displayed allocations. Displayed artifacts round-trip through
`StatSheet.fromArtifacts` within an explicit two-decimal rounding envelope.
Rounded values do not authenticate exact roll tiers or counts, so those fields
remain unknown.

Its 4,608 non-ER membership rows compare three main stats and five unique
positive displayed substats with 17 authority-labelled targets. Condition
status, baseline-context uncertainty, non-exhaustive absence, conflicting
targets, partial source order, and zero-match targets are retained as evidence.
They do not become correctness verdicts, scalar weights, ranks, or
recommendations. ER values remain deferral provenance only.

The checkpoint 39 report is durable report 36 overall and globally integrated
report 35. Its 17,499,104 bytes have SHA-256
`d6b8f196891ee122a9ce8267f7da7efae3e7e39076b5babf28c3d352b56e6b4a`.
Every guide, recommendation, rank, scalar-weight, damage, gameplay, optimality,
promotion, and ER capability remains false.

### Derived cached-policy audits

A cached-policy audit is derived computation evidence, not a knowledge record,
source ranking, or equipment recommendation. Checkpoint 40 projects the exact
checkpoint-38 36-node table into four active dimensions, proves complete
`3 x 2 x 3 x 2` closure, and compares deterministic coordinate policies without
invoking a fresh evaluator, generator, damage replay, or artifact optimizer.

Its one-shot, iterative best-improvement, and declared-order first-improvement
paths from one source-first start terminate at different cached nodes. The
finite-table reference and technical gaps are observations under the same
unreviewed objective. They do not define “best” outside that authenticated
table and do not upgrade any source or generated-sheet row.

Checkpoint-39 review diagnostics remain attached only through exact
node/carry/character occurrences and never become an objective or policy
filter. Authenticating checkpoint 39 reads its ER-deferral provenance, but no
ER value is projected into the policy table. Only the real default environment
attests zero forbidden downstream calls; injected environments retain unknown
counts and ER influence.

The checkpoint 40 report is durable report 37 overall and globally integrated
report 36. Its 2,029,334 bytes have SHA-256
`a2ce1d99443deb81a9559bb0aed9c4d378aefa5d564d2f16074a82fadd987a46`.
Every guide, recommendation, rank, scalar-weight, damage, gameplay, global-
optimality, promotion, and ER capability remains false.

Checkpoint 41's robustness census is another derived cached-policy audit. It
authenticates checkpoint 40 plus the cached-policy and census implementations,
then runs one-shot and best improvement from all 36 starts and declared first
improvement over all 864 structurally effective orders. Its 31,104 declared-
order traces retain only compact endpoint partitions, digests, and witnesses:
best improvement has 24/12 terminal basins, declared order has
18,576/12,528 terminal outcomes, and the paths collapse to 13 start partitions
and 96 all-start families with a seven-move maximum.

No source row, review diagnostic, or ER value becomes an objective or policy
filter. The default run records zero fresh generator, evaluator, replay,
downstream-optimizer, recommendation, rank, or ER calls. The checkpoint 41
report is durable report 38 overall and globally integrated report 37. Its
71,373 bytes have SHA-256
`c446dec2027cc2b77d20d46ea8d521d3ae4f43f798f34715a4c4ddb771ac2b73`.
Every guide, recommendation, rank, scalar-weight, damage, gameplay, global-
optimality, promotion, and ER capability remains false.

## Energy-guidance records

ER guidance is first-class and remains separate when a source supplies an ER
table for a team context but does not prove that it shares all assumptions with
a particular team card. A record may preserve:

- character and constellation applicability;
- required teammates and one-of teammate choices;
- weapon-specific or weapon-category bands;
- a rounded public band, formatted supporting cell, and separate raw
  supporting calculation value;
- the sourced rotation and duration when available;
- calculation assumptions and unresolved engine mappings.

An ER target is validation evidence. It is not accepted merely because the
current calculator can reproduce it.

## Deliberate omissions

V1 does not define:

- cross-source consensus;
- a universal character build;
- a team-specific build composed from character-wide advice;
- source confidence scores;
- rotation feasibility or DPS;
- ER adequacy;
- computed equipment rankings;
- cross-source publication eligibility.

Derived formula-count drafts and coverage reports are review evidence, not
additional knowledge-record kinds. This is distinct from a source-authored
`rotation_fixture`, which preserves only the source's own tokens and counts and
still supplies no calculator mapping. A calculator-default formula draft cannot
be placed in a team's `damagePlans` until its counts and assumptions have been
reviewed as an authored validation target.

The current derived inventory contains two legacy formula-plan drafts and one
Xiao count-parity-only witness: twelve calculator-team observations across nine
characters, 33 positive rows, 18 zero-default rows, and two Xiao count
comparisons. The Xiao source fixture supplies tokens and counts but no team or
calculator identifiers. Its `E -> xiao-skill` and
`HP -> xiao-plunge-high` mappings are separately owned, unreviewed aliases. A
2-versus-2 match does not prove formula-semantic equivalence, and the preserved
12-versus-11 mismatch does not identify a correct side. The inventory has zero
source-validated and zero guide-ready observations and executes no damage or ER
calculation. Its standalone rebuild authenticates the Xiao raw fixture and
preset semantic scope before accepting fields copied from the durable witness.

Those decisions will be introduced only after real source observations expose
the necessary distinctions.
