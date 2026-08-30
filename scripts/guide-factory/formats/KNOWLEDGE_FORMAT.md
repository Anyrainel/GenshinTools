# Consolidated Knowledge Format V1

The consolidated format is a union of exact-team, team-template,
character-role, character-guide, and energy-guidance records. It does not merge
assertions from different sources.

Every record has:

- a stable ID namespaced by source;
- `baseline` or `candidate` review status;
- explicit promotion eligibility for external manual observations;
- one or more source references;
- explicit unknowns.

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

The current authenticated catalog contains 63 entries: 60 typed bindings and 3
exact-text acknowledgements. Full nonempty binding coverage is 60 typed, 3
acknowledged, and 63 unbound. The non-structural partition is 123 rows: 60
typed, 3 acknowledged, and 60 unbound. Its 86 unique ordered arrays contain 34
typed-only, 51 unbound-only, and one mixed acknowledged/unbound set. The
independent energy ledger is 15 deferred, 57 explicitly not energy-deferred, 54
nonempty unclassified, and 16 empty unconditional arrays. Display status is 57
typed, 51 known-but-unbound, 15 ER-deferred, 3 acknowledged, and 16
unconditional. Coverage authenticates eight wrapper families across 19 source
files and 73 generated-from paths.

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

The next bounded execution layer must preserve provenance between an intact
four-character generator endpoint and a synthetic cross-endpoint recombination.
A transient 144-generator/364-replay technical run demonstrates feasibility
only; it is not durable checkpoint evidence and adds no knowledge claim.

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

Formula-count drafts and coverage reports are derived review evidence, not
additional knowledge-record kinds. A calculator-default formula draft cannot
be placed in a team's `damagePlans` until its counts and assumptions have been
reviewed as an authored validation target.

Those decisions will be introduced only after real source observations expose
the necessary distinctions.
