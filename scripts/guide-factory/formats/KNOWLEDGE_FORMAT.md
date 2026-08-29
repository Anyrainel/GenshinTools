# Consolidated Knowledge Format V1

The first consolidated format is intentionally a small union of team records
and character-guide records. It does not attempt to merge them yet.

Every record has:

- a stable ID namespaced by source;
- `baseline` or `candidate` review status;
- one or more source references;
- explicit unknowns.

## Team records

A team has exactly four distinct members. Each member may preserve:

- a selected weapon and optional refinement;
- a selected 4-piece artifact set or two 2-piece effect-group IDs;
- an optional sourced ER floor in percent;
- an explicitly specified or unspecified investment state.

An optional formula-count damage plan contains positive counts for formulas
owned by members of the team. Formula IDs are structurally validated in this
checkpoint; engine availability and gameplay feasibility are deferred until an
exact calculation variant exists.

## Character-guide records

A character guide preserves the source's weapon order and independent build
records. Each build may contain:

- artifact configuration;
- minimum constellation;
- roles and styles;
- weighted Sands, Goblet, Circlet, and substat recommendations.

Weights remain source weights. They are not converted into ranks or damage
percentages.

## Deliberate omissions

V1 does not define:

- cross-source consensus;
- a universal character build;
- a team-specific join to character-wide build advice;
- source confidence scores;
- rotation feasibility or DPS;
- ER adequacy;
- computed equipment rankings;
- publication eligibility.

Those decisions will be introduced only after real source observations expose
the necessary distinctions.
