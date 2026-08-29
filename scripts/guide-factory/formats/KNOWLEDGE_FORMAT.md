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
- an explicitly specified or unspecified investment state.
- unranked or ranked weapon and artifact recommendations with conditions;
- ordinal main-stat and substat recommendations;
- optional ER targets when the source binds them directly to that team.

An editorial team also records whether it is an example or prescription,
whether its list is exhaustive, and whether the source makes a ranking claim.
Source rotations remain notation plus unresolved segments; they do not become
formula counts automatically.

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
