# Consolidated Knowledge Format V1

The consolidated format is a union of team, character-guide, and energy-
guidance records. It does not merge assertions from different sources.

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

Those decisions will be introduced only after real source observations expose
the necessary distinctions.
