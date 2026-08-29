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
bindings, or subject leakage. They must not parse arbitrary English, infer a
predicate from repetition, or turn coverage frequency into confidence,
ranking, or recommendation quality.

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
- a team-specific join to character-wide build advice;
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
