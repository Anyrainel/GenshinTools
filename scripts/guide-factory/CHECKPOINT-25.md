# Checkpoint 25: authenticated manual condition-array coverage

This checkpoint turns the current structured source corpus into an exact,
reviewable backlog of condition bindings. It inventories what the manual
snapshots actually contain, proves that those arrays survived consolidation,
and overlays only the narrow typed or exact-text bindings already exercised by
authenticated Guide Factory checkpoints.

## Exact corpus boundary

The indexed manual-observation snapshots are the sole authoritative corpus for
this inventory. The consolidated repository is checked for exact parity; it is
not counted as a second source of evidence.

The current boundary contains seven KQM snapshots and 64 records. Every record
is still `agent-assisted` and `unreviewed`. The extractor walks every condition
array represented by the manual schema on:

- weapon and artifact recommendation groups;
- Sands, Goblet, and Circlet main-stat choices;
- substat choices and structured ER targets;
- team-level artifact plans; and
- character-role members.

It does not scan unknowns, assumptions, rotations, labels, templates, source
prose, or baseline-only data. Condition strings remain opaque: array order and
duplicates are retained and participate in each array hash. No arbitrary
English parser is used. Before schema parsing can strip unknown fields, a raw
recursive audit inventories every property named `conditions` and requires its
exact path and ordered payload to appear once in the extractor output. A new,
wrong-shaped, duplicate, or otherwise unsupported condition-bearing field
therefore fails closed instead of disappearing from coverage.

The durable result contains:

| Corpus measure | Count |
| --- | ---: |
| Condition-array occurrences | 142 |
| Empty arrays | 16 |
| Nonempty arrays | 126 |
| Unique exact ordered nonempty arrays | 89 |
| Condition-string occurrences | 159 |
| Unique condition strings | 97 |
| Exact manual-to-repository matches | 142 |
| Repository mismatches | 0 |

The 16 empty arrays are displayed as structurally unconditional observations.
That label means only that the extracted field lists no condition; it does not
prove universal gameplay applicability.

## Energy remains an independent ledger

Binding coverage does not classify a condition as non-ER. The report carries a
separate, fail-closed energy status:

- three structured ER-target arrays;
- three typed Itto substat prerequisites;
- nine exact authored Diona/Furina energy-sensitive arrays;
- 43 typed rows whose authenticated wrappers mark them not energy-deferred;
- 68 acknowledgement-only or unbound rows that remain energy-unclassified; and
- 16 empty arrays displayed as unconditional.

The first three groups produce 15 `er-deferred` occurrences across 12 unique
ordered arrays. The nine authored entries are pinned by exact occurrence ID,
ordered text, and hash; they are not found by a prose parser. An unclassified
row is not presumed non-ER, and `not-energy-deferred` does not supply an ER
requirement. This checkpoint supplies no rotation, default ER target, or energy
calculation.

## Authenticated binding coverage

Across all 126 nonempty arrays, binding classification is 46 typed, 3 exact-
text acknowledged, and 77 unbound. Excluding only the three structural ER
arrays gives the independent non-structural binding view: 123 occurrences, 86
unique ordered arrays, 156 string occurrences, and 94 unique strings.

| Non-structural binding status | Array occurrences | String occurrences |
| --- | ---: | ---: |
| Typed-bound | 46 | 68 |
| Exact-text acknowledged | 3 | 3 |
| Unbound | 74 | 85 |
| Invalid | 0 | — |
| Total | 123 | 156 |

The current binding catalog has 49 occurrence-scoped entries:

- 15 typed Itto entries authenticated through checkpoint 23, of which 12 are
  not energy-deferred and three retain the deferred energy prerequisite;
- 31 Keqing entries authenticated through the equipment-evidence report; and
- three Viridescent Venerer exact-text acknowledgements authenticated through
  the Keqing role-pair sample.

Each entry is joined by source, record kind, source record ID, exact claim path,
ordered condition-array hash, and subject. Repeated prose does not grant a
binding to another occurrence. In particular, the Viridescent Venerer text is
acknowledged only for Jean, Kaedehara Kazuha, and Sucrose; the same text on Sayu
and Xianyun remains known but unbound.

Across the 86 non-structural unique arrays, 26 are typed-only, 59 are unbound-
only, and one has the mixed acknowledged/unbound status produced by that
deliberately subject-scoped Viridescent Venerer boundary. There are no other
mixed sets.

`typed-bound` means the exact source condition has a machine-readable predicate
contract. It does not mean that predicate is true for a particular team,
account, rotation, or encounter. `exact-text-acknowledged` is narrower still:
it records an explicit source occurrence binding without validating aura,
timing, or gameplay execution. `known-but-unbound` means unknown to the typed
fact vocabulary, not false.

## Authentication and failure boundary

The report closes over 14 raw JSON inputs and 56 exact generated-from paths. It
authenticates the Itto source packet and requires the durable Keqing equipment
and role-pair reports to match fresh rebuilds. Raw UTF-8 bytes, parsed objects,
approved paths, source-record identity, condition hashes, repository parity,
and the current binding catalog must all agree.

Any missing, duplicate, stale, reordered, rebound, or capability-crossing input
makes the result non-comparable. The inventory CLI then refuses to overwrite
durable evidence, and `validate.ts` independently rebuilds the report and
rejects stale checked-in output.

Run the checkpoint and its complete validation boundary with:

```text
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-manual-condition-array-coverage.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
npm run type-check
npm run depcheck
```

## What this does not establish

This checkpoint provides:

- no human review, source authorization, quality score, popularity, confidence,
  or guide credibility;
- no proof that a typed, acknowledged, empty, or repeated condition is true;
- no team, weapon, artifact, main-stat, substat, or character recommendation;
- no recommendation order, rank, winner, or cross-source vote;
- no candidate composition, assembled build, generator, or optimizer run;
- no formula, rotation, damage, DPS, ideal-roll, or optimality result; and
- no ER input, requirement, computation, adequacy conclusion, or solved ER
  workflow.

## Next non-ER gate

Use the 74 non-structural unbound occurrences as a visible contract backlog.
Nine are already exact authored energy deferrals; the other 65 remain energy-
unclassified rather than presumed non-ER. Select a small source-local slice,
explicitly establish its energy boundary, and add a binding only when a narrow
typed fact model and occurrence-scoped evidence can support it. Re-run this
inventory before composing any recommendation groups. ER-related occurrences
remain deferred until the other evidence and composition work is complete.
