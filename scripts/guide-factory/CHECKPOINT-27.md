# Checkpoint 27: authenticated flat Klee claim-join witness

This checkpoint asks one deliberately narrower question than build
composition: after source conditions have been resolved for one exact team, can
the factory retain several independently applicable claims together without
silently turning them into a build? The answer is represented by one flat Klee
witness and one exact-team negative control. No payload compatibility,
selection, ranking, or performance claim is made.

## Authenticated upstream boundary

`src/kleeTeamScopedClaimJoinWitness.ts` consumes two existing durable evidence
boundaries:

- the authenticated Klee Luna IV source-local condition slice; and
- the authenticated current manual condition-array coverage report.

The wrapper authenticates the durable Klee slice against a fresh canonical
rebuild from its raw repository, snapshot, index, and source-registry inputs. It
also requires the coverage report to match its current exact path/hash boundary
and authenticated internal contract. The main validator independently rebuilds
coverage before authenticating this witness.

Only the four Klee occurrences selected at checkpoint 26 may enter the witness.
Each is cross-linked across the selected occurrence, source claim, source cell,
request projection, condition control, and exact manual-coverage row. All links
retain their source, record, schema path, subject, ordered-condition, predicate,
payload, and provenance hashes. The dependency direction remains one-way:

```text
raw Klee records
        |
        v
authenticated Klee source-local slice
        |
        v
authenticated current condition-binding catalog and manual coverage
        |
        v
authenticated Klee team-scoped flat claim-join witness
```

A stale durable report, current-input hash drift, changed occurrence identity,
subject leakage, roster change, altered resolution, payload change, partial
cross-link, or capability crossing makes the witness non-comparable.

## One flat positive witness

The positive fixture is the exact, non-exhaustive, unordered source example:

- Klee / Furina / Albedo / Xilonen.

Four claims from two source records are independently applicable for that exact
team:

| Claim payload | Source resolution | Supplied-context result |
| --- | --- | --- |
| Circlet: CR or CD | unresolved gameplay role | applicable under explicit team-scoped Klee on-field intent |
| Goblet: Pyro DMG Bonus | unresolved gameplay role | applicable under explicit team-scoped Klee on-field intent |
| Sands: ATK% | unresolved gameplay role | applicable under explicit team-scoped Klee on-field intent |
| 4pc Marechaussee Hunter | matched by exact Furina roster presence | source already matched |

CR and CD remain one unchosen source payload group. The wrapper does not split
that group, select a Circlet stat, or assert that the four payloads are jointly
compatible, complete, effective, or optimal.

The exact source claims, team, source cells, and request projections are
preserved. The act of retaining claims from two source records in one flat set
is authored by Guide Factory, not by KQM. The explicit on-field role facts are
also Guide Factory fixture inputs scoped to this team and Klee; recommendation
role metadata is not treated as condition truth.

## Exact-team negative control

The control fixture is the other exact, non-exhaustive, unordered source
example:

- Klee / Chevreuse / Durin / Fischl.

Its separately scoped on-field role fact makes the same three main-stat claims
applicable. The exact roster does not contain Furina, so the Marechaussee Hunter
claim remains source-definitely-inapplicable. Request context cannot replace
that roster result. The control therefore retains three applicable claims and
one inapplicable claim but constructs no positive witness.

This control prevents the flat join from degrading into “keep every selected
Klee claim whenever Klee is on field.” It does not compare the two teams or
declare either team better.

## Holdout and capability boundary

All 11 Klee occurrences withheld by checkpoint 26 remain holdouts. This witness
consumes zero of them and authors no predicate, applicability, energy status, or
payload inference for them.

The durable report records exactly:

- 1 positive flat witness;
- 4 positive claims from 2 source records;
- 1 negative-control team with 3 applicable claims and 1 source-definitely-
  inapplicable claim;
- 4 exact manual-coverage cross-links;
- 0 assembled builds; and
- 0 candidates.

It also keeps all of the following disabled:

- arbitrary-English parsing and recommendation-metadata condition truth;
- payload-axis expansion, alternative selection, and payload compatibility;
- build assembly, candidate construction, and Cartesian products;
- recommendation composition, ranking, guide output, and publication;
- generator and optimizer execution;
- formula, rotation, damage, DPS, stat-allocation, and ideal-roll work; and
- ER inputs, calculation, adequacy, or requirements.

Independent applicability means only that each retained claim evaluates as
matched for the exact fixture under its preserved source cell and request
projection. It does not establish that the claims form a playable, sensible,
legal, or high-performing build.

## Durable authentication

The CLI writes the report only when the candidate equals a fresh canonical
rebuild. `validate.ts` reads the durable Klee slice, manual coverage, and their
raw dependencies, rebuilds the upstream coverage boundary in dependency order,
then authenticates the complete serialized witness against current inputs. The
report closes six direct source files and its declared generated-from boundary;
the durable object must match the canonical object exactly.

Run this checkpoint after its two upstream reports:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-source-local-condition-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-team-scoped-claim-join-witness.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
```

## Next non-ER gate

The next source-local slice should exercise the Diona, Citlali, and Bennett
support-artifact recommendations embedded in the same exact C6
Diona/Mavuika/Citlali/Bennett team record. It should preserve each character's
artifact group and source alternatives, bind only explicit team-and-character-
scoped support-role facts, retain the other 15 nonempty Diona condition
occurrences as exact holdouts, and preserve the eight empty arrays as
unconditional source closure.

That slice must not infer ordering, compatibility, a multi-character build, or
a recommendation from same-record proximity. ER-sensitive Diona rows remain
deferred until the non-ER repository, validation, and composition work is
further along.
