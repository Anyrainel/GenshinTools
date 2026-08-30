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
acquisition preferences, explicit execution assumptions, and bounded account-
inventory facts. It must not contain source claim IDs, requested resolutions,
recommendation fields, or source-condition prose.

A source-specific wrapper owns the mapping from an exact source-condition leaf
to a typed context query. The mapping pins the condition-array, full-predicate,
leaf-path, and leaf hashes. Context may refine only a previously unresolved
leaf; it cannot replace an exact-roster result or an omitted-energy
prerequisite. Omitted request facts remain unknown. A missing inventory item is
false only when the corresponding inventory domain is explicitly complete, and
account facts must retain their snapshot identity.

Derived context applicability must preserve the original source resolution and
provenance separately. `applicable-under-supplied-context` means only that the
supplied facts satisfy the mapped condition. It is not source authorization,
comparative performance, rank, suitability, account advice, or a player-facing
recommendation, and independently evaluated contexts must not be multiplied
into one build.

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

The standalone Kokomi Luna V adapter selects exactly member 0's first artifact
condition from the exact Kokomi/Ineffa/Columbina/Sucrose team record. It
preserves one 4pc Ocean-Hued Clam payload with source classification
`recommended` and ordering `unranked`. The pinned ordered roster conjunction is
source-matched, so context applicability is `source-already-matched` with no
request fact or binding. All five Kokomi condition arrays are nonempty: one is
selected and four are exact holdouts. The slice consumes, binds, or energy-
classifies none of the holdouts.

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

Authentication and catalog admission are separate gates. The current Kokomi
slice is authenticated standalone but is not a current catalog input. Its
source classification, source order, matched predicate, and occurrence-scoped
not-energy-deferred statement therefore do not change catalog or coverage until
a later source-specific integration explicitly admits that exact occurrence.

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

The current authenticated catalog contains 56 entries: 53 typed bindings and 3
exact-text acknowledgements. The non-structural coverage partition is 123 rows:
53 typed, 3 acknowledged, and 67 unbound. Its 86 unique ordered arrays contain
31 typed-only, 54 unbound-only, and one mixed acknowledged/unbound set. The
independent energy ledger remains 15 deferred, 50 explicitly not energy-
deferred, 61 nonempty unclassified, and 16 empty unconditional arrays.
Those checkpoint 28 totals remain current after the standalone Kokomi report.
The next integration target, not a current result, is 57 catalog entries = 54
typed + 3 acknowledged; non-structural coverage 123/54/3/66; unique arrays 32
typed-only + 53 unbound-only + 1 mixed; and energy 15 deferred + 51 not-energy-
deferred + 60 nonempty unclassified + 16 empty.

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
witness.

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
