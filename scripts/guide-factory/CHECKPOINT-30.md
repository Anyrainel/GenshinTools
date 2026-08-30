# Checkpoint 30: exact Kokomi catalog admission

This checkpoint promotes only checkpoint 29's already authenticated Kokomi
Ocean-Hued Clam occurrence into the current condition-binding catalog. It adds
no new source claim, report, parser, recommendation, or computation. The
promotion succeeds only after Kokomi-specific invariants authenticate the exact
serialized slice and its selected/holdout boundary.

## Source-specific admission before normalization

Kokomi, Klee, and Diona continue to own separate source wrappers and extraction
contracts. The Kokomi path checks the Luna V page, snapshot and repository
parity, raw records, source registry, exact team, selected occurrence, four
holdouts, condition text, hashes, predicate, payload, recommendation metadata,
request projection, and disabled capability boundary before producing any
catalog entry.

Only after those checks pass may the private
`buildSourceLocalCatalogEntry` helper perform the repeated operations shared by
the three wrappers:

1. cross-link the selected occurrence to exactly one source claim;
2. cross-link it to exactly one condition control;
3. verify their repeated selected/claim/control parity; and
4. construct one occurrence-scoped catalog entry.

The helper is not a generic source wrapper, extractor, schema adapter, condition
parser, or prose interpreter. It cannot select occurrences, authorize a source,
weaken wrapper-specific literals, or admit a holdout.

## Exact admitted occurrence

The only new catalog occurrence is:

`kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[0].conditions`

The Kokomi wrapper pins all of the following:

- source page and version: KQM Kokomi Quick Guide, Luna V;
- snapshot: `kqm-kokomi-manual.json`;
- exact team: `kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example`;
- exact subject and member: Sangonomiya Kokomi, member 0;
- exact condition: `For Kokomi in this exact Lunar-Charged example team.`;
- condition-array SHA-256:
  `a9c6d3b2681ecb2119368d210164542577464049656217eb1fcc296ff4fd2295`;
- ordered roster predicate: Sangonomiya Kokomi, Ineffa, Columbina, and Sucrose;
- predicate SHA-256:
  `2c60322cf3d1b6691dbde84bd5484364752c87bb18634bd9303fd6ec2e03dcda`;
- payload: one 4pc Ocean-Hued Clam artifact group;
- payload SHA-256:
  `bfd412bb94e8e50e9deec6813ef5329eb71c656fdd1af64fc8b5a2243543e1a0`;
- source recommendation classification `recommended`, grouping `single`, and
  ordering `unranked`; and
- one source-matched cell with `source-already-matched` context applicability
  and zero request facts, rules, or bindings.

Catalog admission retains the generic evidence kinds
`source-local-typed-predicate-ast` and `source-local-not-energy-deferred`, plus
the exact Kokomi `sliceId`, selected-occurrence hash, predicate hash, payload
hash, and condition-control hash. Generic evidence kinds do not make the
Kokomi extraction generic.

## Four holdouts remain excluded

The promotion names and rechecks all four checkpoint 29 holdouts:

| Holdout occurrence | Condition-array SHA-256 |
| --- | --- |
| `kqm:character_guide:kokomi-on-field-nod-krai-artifact-delegation-luna-v:recommendation.artifactRecommendations[0].conditions` | `a2933a2e2f7adf74da82241024b08ef3cc933e97875a60ed24a995e23dff7300` |
| `kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:artifactPlans[0].conditions` | `2e7b7109ed56cdbdbe8106429ff4a37bf8a76c4af7a6a96c1f71f123fbc19320` |
| `kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[1].conditions` | `345334cc6648346f0746fcee75a300703ef38cbbf2c290e80d9e0bb3ddbf12e9` |
| `kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[2].artifactRecommendations[0].conditions` | `2b615a74c769bcf02abb64b35d64bf8baf94eefb23f5f9a6e3044b540184d50f` |

They remain exact, unconsumed, unbound, and energy-unclassified. The admitted
Ocean-Hued Clam occurrence does not partially bind the character-wide Nod-Krai
delegation, coupled team artifact plan, Kokomi's second team-member artifact
row, or Columbina's team-member artifact row.

## Catalog and coverage result

Checkpoint 30 produces the expected one-occurrence delta:

| Ledger | Current result |
| --- | --- |
| Catalog | 57 = 54 typed + 3 acknowledged |
| Full nonempty binding coverage | 126 = 54 typed + 3 acknowledged + 69 unbound |
| Non-structural binding coverage | 123 = 54 typed + 3 acknowledged + 66 unbound |
| Unique non-structural ordered arrays | 32 typed-only + 53 unbound-only + 1 mixed |
| Energy | 15 deferred + 51 not-energy-deferred + 60 nonempty unclassified + 16 empty |
| Display status | 51 typed + 57 known-but-unbound + 15 ER-deferred + 3 acknowledged + 16 unconditional |

Binding and energy remain independent. `typed-bound` does not establish that a
condition is true outside its preserved source cell. `not-energy-deferred` is
occurrence-scoped and does not establish an ER floor or adequacy result.

## Authentication and regeneration order

Manual condition coverage now authenticates six wrapper families. Its raw
boundary contains 17 source files, and its exact generated-from boundary
contains 67 paths. Source-specific wrappers feed the catalog; the catalog feeds
coverage. None of those downstream files feeds a source-local wrapper.

The dependency order is:

```text
authenticated Klee, Diona, and Kokomi source-local reports
                              |
                              v
                    57-entry catalog
                              |
                              v
              regenerated manual condition coverage
                              |
                              v
          regenerated checkpoint 27 Klee claim-join witness
```

The Klee witness changes only its authenticated manual-coverage dependency. Its
four Klee claims, positive Furina team, Overload negative control, zero-holdout
consumption, and prohibited interpretations remain unchanged.

Checkpoint 30 adds no durable report, so `validate.ts` still authenticates 29
durable reports. It rejects stale Kokomi evidence, catalog drift, the wrong
wrapper count, wrong source/generated-from closure, unexpected holdout
admission, stale manual coverage, or a stale Klee witness.

Run the regenerated dependency chain with:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-kokomi-source-local-artifact-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-team-scoped-claim-join-witness.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
```

## What this checkpoint does not establish

This promotion executes no artifact assignment, alternative selection,
recommendation composition, build or candidate construction, ranking,
generator, optimizer, formula, rotation, damage, DPS, stat allocation, ideal-
roll, or ER work. It provides no source authorization, human review,
publication approval, or gameplay-performance claim.

## Next non-ER checkpoint

The next bounded experiment should be a standalone Noelle request-context slice
for a numeric source condition satisfied by C6 or Burst Talent level 10. It is
not implemented yet. The slice must preserve the source OR structure, keep
constellation and Talent-level facts distinct, scope supplied facts to the
exact request subject, and remain outside catalog integration until separately
authenticated. ER remains deferred.
