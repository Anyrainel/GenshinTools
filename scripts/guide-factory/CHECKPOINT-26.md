# Checkpoint 26: reusable source-local condition slices

This checkpoint composes the existing typed source-condition evaluator and
request-context evaluator behind one reusable, fail-closed source-local core.
The first bounded adapter exercises that core over four exact Klee condition
occurrences and two exact teams from the same KQM Luna IV page. It expands the
authenticated condition-binding catalog; it does not compose a build or emit a
guide.

## Reusable core

`src/sourceLocalConditionSlice.ts` accepts a deliberately small source-document
slice:

- nonempty condition occurrences pinned by source identity, schema path,
  ordered-condition hash, predicate hash, payload hash, and exact repository
  parity;
- exact four-character teams from that same source document;
- optional request facts scoped independently to an exact team and character;
  and
- expected source and effective resolution partitions.

The core first evaluates source-owned predicates through the existing
source-conditioned packet evaluator. It then projects explicit request facts
through the existing request-context evaluator without replacing the preserved
source result. Request facts may refine only an exact `unresolved-context` leaf;
they cannot replace an exact-roster fact or an energy prerequisite. Omitted
facts remain unknown, recommendation role metadata is not runtime intent, and
the core does not parse arbitrary English.

The core is reusable across future source-local adapters, but its current
evidence is intentionally narrow. It evaluates no team template or preset
overlap, accepts no deferred-energy predicate, and keeps every guide,
recommendation, composition, rank, generator, optimizer, formula, rotation,
damage, and ER capability disabled.

## Exact Klee slice

The Klee adapter authenticates the KQM Klee Quick Guide, Luna IV snapshot. Its
seven source records contain 15 condition occurrences. The slice selects exactly
four and retains the other 11 as explicit holdouts.

| Selected occurrence | Preserved payload | Typed condition |
| --- | --- | --- |
| On-field Circlet main stat | CR or CD | Klee's intended role is supplied explicitly per exact team |
| On-field Goblet main stat | Pyro DMG Bonus | Klee's intended role is supplied explicitly per exact team |
| On-field Sands main stat | ATK% | Klee's intended role is supplied explicitly per exact team |
| Contextual artifact set | 4pc Marechaussee Hunter | The exact team roster includes Furina |

The exact team controls are both non-exhaustive, unordered source examples:

- Klee / Chevreuse / Durin / Fischl; and
- Klee / Furina / Albedo / Xilonen.

Four claims across two teams produce eight source-control cells:

| Source resolution | Count | Meaning in this slice |
| --- | ---: | --- |
| Matched | 1 | The Furina-roster condition in the exact Furina team |
| Inapplicable | 1 | The same condition in the exact Overload team |
| Unresolved | 6 | Three on-field-role conditions across both teams |

The request fixture supplies Klee's `on-field-dps` intent independently for
each exact team. That makes the six role cells applicable under supplied
context while leaving both exact-roster results source-owned. The effective
partition is therefore seven matched, one inapplicable, and zero unresolved.
This is context applicability only, not proof that the payload is optimal or a
recommendation to equip it.

The 11 exact holdouts close the remainder of the Klee condition corpus. Each
retains its occurrence ID, ordered array, payload, repository parity, and
primary contract gap. The slice authors neither a binding nor an energy
classification for any holdout. Similar words, shared roles, or the presence of
one selected field cannot partially bind another occurrence.

## Downstream coverage delta

The authenticated current binding catalog now contains 53 occurrence-scoped
entries:

- 15 typed Itto entries;
- 31 typed Keqing equipment entries;
- three exact-text Keqing Viridescent Venerer acknowledgements; and
- four typed Klee source-local entries.

That is 50 typed bindings plus three exact-text acknowledgements. Across the
123 nonempty, non-structural condition occurrences, current coverage is now 50
typed, 3 acknowledged, and 70 unbound. The four selected Klee rows move from
unbound to typed; the slice does not reclassify its 11 holdouts.

Energy remains an independent ledger. The four selected rows carry an explicit
slice-authored `not-energy-deferred` boundary. Current global totals are:

- 15 deferred rows: three structural ER arrays, three typed Itto prerequisites,
  and nine exact authored Diona/Furina deferrals;
- 47 rows explicitly marked not energy-deferred;
- 64 nonempty rows that remain energy-unclassified; and
- 16 empty arrays displayed as unconditional.

No ER target, rotation, or adequacy conclusion is supplied. ER work remains
deferred until the non-ER repository and composition work is further along.

## Acyclic authentication boundary

The dependency and evidence direction is deliberately one-way:

```text
raw Klee snapshot + index + registry + consolidated repository
                              |
                              v
authenticated Klee source-local slice
                              |
                              v
authenticated current condition-binding catalog
                              |
                              v
manual condition-array coverage report
```

The Klee adapter calls the generic extractor and evaluator cores directly; it
does not consume the downstream binding catalog or coverage report. Its durable
report closes four raw JSON objects and 13 generated-from paths, requires the
selected/holdout partition to cover all 15 Klee occurrences, and authenticates
source document, parent recommendation, exact-team, predicate, payload, and
repository lineage.

Before writing, the Klee CLI compares the candidate report with a canonical
rebuild from current inputs. The binding catalog accepts the four entries only
when the durable Klee report equals a fresh authenticated rebuild. The coverage
report then authenticates that catalog, and `validate.ts` independently rebuilds
the Klee report before rebuilding coverage. A stale durable report, changed
hash, rebound path, roster drift, partial holdout set, capability crossing, or
cycle in that direction fails closed.

Run the checkpoint in dependency order with:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/assemble-klee-source-local-condition-slice.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
```

## What this does not establish

This checkpoint provides:

- no source authorization, human review, source-quality score, or publication
  eligibility;
- no universal Klee role, team, artifact set, or main-stat conclusion;
- no claim that the four preserved payloads are best, ranked, or suitable for a
  particular account;
- no predicate, energy classification, or inferred applicability for the 11
  holdouts;
- no recommendation composition, assembled build, generator, optimizer,
  formula, rotation, damage, DPS, ideal-roll, or optimality result; and
- no ER input, requirement, calculation, or solved ER workflow.

The next non-ER slice should reuse the same exact occurrence, source-document,
request-scope, holdout, and durable/fresh authentication boundaries. The 70
remaining non-structural unbound occurrences are a validation backlog, not a
pool of recommendations: nine are explicit energy deferrals and the other 61
remain energy-unclassified.
