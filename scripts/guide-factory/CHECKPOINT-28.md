# Checkpoint 28: authenticated Diona same-record support slice

This checkpoint applies the reusable source-local condition boundary to three
team-member artifact conditions carried by one exact Diona team record. It
authenticates their source identity and context applicability, then integrates
only those exact occurrences into the current condition-binding catalog. It
does not choose or assign artifacts, compose a team build, or perform ER work.

## Exact source boundary

`src/dionaSourceLocalSupportSlice.ts` authenticates four raw source files:

- the consolidated knowledge repository;
- the KQM Diona Luna VIII manual snapshot;
- the manual snapshot index; and
- the source registry.

The wrapper requires byte and parsed-object closure, exact repository parity,
the same KQM page and source version, the five expected raw records, and one
exact team record:

`kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt`

The team is the non-exhaustive source example C6 Diona / Mavuika / Citlali /
Bennett. All selected claims and the team control share that exact source
record. No cross-record or cross-source join is performed.

## Three selected support conditions

The slice selects exactly three nonempty team-member artifact condition
occurrences:

| Member | Exact member path | Preserved artifact payload |
| --- | --- | --- |
| Diona | `members[0].artifactRecommendations[0].conditions` | 4pc Song of Days Past, then 4pc Noblesse Oblige |
| Citlali | `members[2].artifactRecommendations[0].conditions` | 4pc Scroll of the Hero of Cinder City |
| Bennett | `members[3].artifactRecommendations[0].conditions` | 4pc Noblesse Oblige, then 4pc Instructor |

The payload arrays retain their exact source order. That preservation is not a
derived ranking, preference, compatibility result, or instruction to equip the
sets together. Diona's and Bennett's alternatives remain intact groups, while
Citlali's singleton remains one source payload.

Each source condition says that the named character uses a support build in
this team. The wrapper maps each exact occurrence to an unresolved gameplay-
role predicate; condition text and recommendation metadata are not accepted as
runtime role truth. It then supplies three independent Guide Factory request
facts:

- Diona has the support role for the exact team;
- Citlali has the support role for the exact team; and
- Bennett has the support role for the exact team.

Each fact is scoped to both the exact team and the exact character. No fact may
leak to another character or team. The source partition remains three
unresolved cells, while the separately preserved effective partition becomes
three matched cells under supplied context. This is applicability evidence
only, not proof that the source payloads form a coherent or optimal team build.

## Complete Diona condition inventory

The wrapper closes the entire Diona snapshot condition boundary without
silently classifying unselected rows:

| Boundary | Count |
| --- | ---: |
| All condition arrays | 26 |
| Nonempty arrays | 18 |
| Empty unconditional arrays | 8 |
| Selected nonempty occurrences | 3 |
| Nonempty holdouts | 15 |
| Ordinary descriptive holdouts | 10 |
| ER-deferred descriptive holdouts | 5 |

The selected and holdout occurrence sets are exact, unique, disjoint, and close
all 18 nonempty arrays. All 15 holdouts have
`consumedBySlice = false`, `bindingAuthoredBySlice = false`, and
`energyClassificationAuthoredBySlice = false`. The five ER-deferred labels are
descriptive inventory inherited from the existing authored deferral boundary;
this checkpoint performs no ER interpretation or calculation. The eight empty
arrays remain unconditional source structure and receive no inferred predicate.

Only the three selected support-role conditions receive exact typed bindings
and occurrence-scoped `not-energy-deferred` classifications. That label means
only that these three conditions are outside this slice's deferred ER work. It
does not establish an ER floor, adequacy, rotation, or energy model.

## Catalog and coverage integration

The catalog now uses reusable evidence-kind labels for source-local slices:

- `source-local-typed-predicate-ast`; and
- `source-local-not-energy-deferred`.

Only the labels are generic. Klee and Diona still use separate wrappers, fresh
authentication, exact extraction rules, occurrence identities, payload checks,
and `sliceId` scopes. The Diona entries are accepted only from the exact
authenticated Diona slice; the catalog does not gain a generic source parser.

The current catalog and coverage totals become:

| Ledger | Current partition |
| --- | --- |
| Catalog entries | 56 = 53 typed + 3 acknowledged |
| Non-structural occurrence coverage | 123 = 53 typed + 3 acknowledged + 67 unbound |
| Unique non-structural ordered arrays | 31 typed-only + 54 unbound-only + 1 mixed |
| Energy status | 15 deferred + 50 not-energy-deferred + 61 nonempty unclassified + 16 empty |

Binding and energy remain independent. Typed binding does not mean a predicate
is true; unbound does not mean false; energy-unclassified does not mean non-ER.

## Exact dependency order

The new durable dependency direction is:

```text
Diona raw inputs
        |
        v
authenticated Diona source-local wrapper
        |
        v
56-entry current condition-binding catalog
        |
        v
authenticated manual condition-array coverage
        |
        v
regenerated checkpoint 27 Klee flat claim-join witness
```

The Klee witness declares manual coverage as an input, so it is regenerated
after the three Diona entries change that report. Its four Klee claims, exact
positive team, exact negative control, and interpretation boundary remain
unchanged. The validator follows this order and fails closed on stale durable
reports, changed path/hash boundaries, partial selected/holdout sets, subject or
member leakage, changed payload order, or a capability crossing.

## What this checkpoint does not establish

The Diona slice and its catalog integration provide:

- no source authorization, human review, publication eligibility, or quality
  score;
- no choice between Song of Days Past, Noblesse Oblige, Scroll of the Hero of
  Cinder City, or Instructor;
- no artifact assignment, multi-character compatibility, team composition,
  build composition, recommendation, rank, or guide;
- no generator or optimizer invocation;
- no formula, rotation, damage, DPS, stat allocation, or ideal-roll result; and
- no ER input, target, floor, adequacy claim, or calculation.

Run the checkpoint in dependency order with:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-diona-source-local-support-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-team-scoped-claim-join-witness.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
```

## Next non-ER gate

The next source-local slice should authenticate the exact
Kokomi/Ineffa/Columbina/Sucrose team-member condition for 4pc Ocean-Hued Clam.
It should select exactly that one occurrence and retain the other four nonempty
Kokomi conditions as holdouts. Exact-roster matching is still only condition
applicability; it is not an artifact assignment, comparison, recommendation, or
build.

That Kokomi slice should remain outside the current condition-binding catalog
until a separate integration checkpoint authenticates the wrapper, extraction,
generic evidence labels, updated coverage, and downstream regeneration order.
ER remains deferred.
