# Checkpoint 29: standalone authenticated Kokomi artifact slice

This checkpoint authenticates one exact-team Kokomi artifact condition while
deliberately stopping before catalog admission. It proves that the source-local
boundary can resolve a fully roster-decidable condition without request facts.
It does not assign Ocean-Hued Clam, compare it with another set, or change the
current coverage ledger.

## Exact source boundary

`src/kokomiSourceLocalArtifactSlice.ts` authenticates the KQM Kokomi Luna V
snapshot at `data/source-snapshots/kqm-kokomi-manual.json` against the
consolidated repository, manual snapshot index, and source registry. The four
raw inputs must have byte and parsed-object closure and exact path/hash parity.

The bounded adapter accepts exactly this source team:

`kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example`

Its exact ordered roster is:

1. Sangonomiya Kokomi
2. Ineffa
3. Columbina
4. Sucrose

The source record is a non-exhaustive example and makes no team-ranking claim.
The selected claim and exact team share the same record and page lineage. The
source extraction remains agent-assisted and unreviewed; registry permission is
unknown and promotion eligibility is false.

## One selected artifact occurrence

The slice selects exactly:

`members[0].artifactRecommendations[0].conditions`

The selected payload is one 4pc Ocean-Hued Clam artifact group for Sangonomiya
Kokomi. The wrapper preserves the source recommendation metadata:

- classification: `recommended`;
- grouping: `single`; and
- ordering: `unranked`.

`recommended` is a preserved source classification, not Guide Factory approval.
`unranked` explicitly prevents the array position from becoming a computed
rank. The singleton is not an assignment, comparison winner, or instruction to
equip the set.

## Source-owned roster match

The exact source condition is represented as an ordered conjunction of four
`exact-team-roster-includes` predicates, one for each member above. Every leaf
matches the exact source-team control, so the source resolution is `matched`.

Because the source already decides the predicate, the context projection is
`source-already-matched`. It contains:

- zero request facts;
- zero request-context rules;
- zero request bindings; and
- no account input.

Request context does not restate or replace the source roster. The effective
partition remains one matched cell. This establishes only that the pinned
condition applies to the exact source team; it does not establish that Ocean-
Hued Clam is correct, compatible, complete, or optimal for a player account.

## Complete Kokomi holdout boundary

The snapshot condition closure is exact:

| Boundary | Count |
| --- | ---: |
| Total condition arrays | 5 |
| Nonempty condition arrays | 5 |
| Empty condition arrays | 0 |
| Selected occurrences | 1 |
| Holdout occurrences | 4 |

The selected and holdout sets are unique, disjoint, and close all five nonempty
arrays. Every holdout remains descriptive inventory only, with:

- `consumedBySlice = false`;
- `bindingAuthoredBySlice = false`; and
- `energyClassificationAuthoredBySlice = false`.

The slice does not borrow conditions or payloads from the character-wide Kokomi
record, the team artifact plan, Kokomi's second team-member artifact row, or
Columbina's team-member artifact row. Similar team lineage does not permit those
four holdouts to enter this result.

The one selected row carries an occurrence-scoped `not-energy-deferred`
classification inside the standalone report. That does not change the global
energy ledger and does not provide an ER requirement or adequacy conclusion.

## Deliberately outside catalog and coverage

`validate.ts` authenticates the durable Kokomi report against a fresh canonical
rebuild, making it the twenty-ninth durable report. Checkpoint 29 deliberately
does not pass it into `currentConditionBindingCatalog.ts` or regenerate manual
coverage from it. Authentication is not catalog admission.

The current checkpoint 28 totals therefore remain unchanged:

| Ledger | Current result after checkpoint 29 |
| --- | --- |
| Catalog | 56 entries = 53 typed + 3 acknowledged |
| Non-structural coverage | 123 = 53 typed + 3 acknowledged + 67 unbound |
| Unique non-structural arrays | 31 typed-only + 54 unbound-only + 1 mixed |
| Energy | 15 deferred + 50 not-energy-deferred + 61 nonempty unclassified + 16 empty |

The checked-in manual coverage and checkpoint 27 Klee witness therefore require
no Kokomi-driven regeneration in this standalone checkpoint.

## Capability boundary

The report executes zero:

- assembled builds and candidates;
- artifact assignments or payload comparisons;
- team, build, or recommendation compositions;
- player-facing recommendations, ranks, or guides;
- generator or optimizer calls;
- formula, rotation, damage, DPS, stat-allocation, or ideal-roll work; and
- ER inputs, calculations, targets, floors, or adequacy claims.

It also supplies no source authorization, human review, publication approval,
or quality score.

Run this standalone checkpoint with:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-kokomi-source-local-artifact-slice.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
```

## Next integration checkpoint

The next checkpoint should admit only this exact authenticated occurrence into
the generic source-local catalog evidence kinds while retaining Kokomi-specific
wrapper authentication, extraction, occurrence identity, payload checks, and
`sliceId`. If that integration remains comparable, the expected totals are:

- catalog 57 = 54 typed + 3 acknowledged;
- non-structural coverage 123/54/3/66;
- unique arrays 32 typed-only + 53 unbound-only + 1 mixed; and
- energy 15 deferred + 51 not-energy-deferred + 60 nonempty unclassified + 16
  empty.

After catalog admission, regenerate manual condition coverage and then the
checkpoint 27 Klee witness in dependency order. These are validation targets,
not checkpoint 29 results. ER remains deferred.
