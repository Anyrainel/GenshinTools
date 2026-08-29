# Guide Factory Lab

This folder is an offline, experimental workspace for gradually building a
Genshin guide factory. Nothing here is imported by `src/`, `worker/`,
`functions/`, or `public/`, and no generated result is a production preset.

The formats and algorithms are intentionally provisional. They should change
when real source data, validation failures, or computation experiments show
that the current model is inadequate.

## Boundary

The allowed dependency direction is:

```text
scripts/guide-factory -> existing repository data and calculation modules
```

Application and Worker code must not import this folder. The boundary test
checks this invariant.

## Current checkpoint

Checkpoint 1 establishes only the data pipeline:

1. Register potential sources and their permitted ingestion mode.
2. Capture source-shaped snapshots without silently filling missing facts.
3. Consolidate those snapshots into one provisional repository format.
4. Validate objective structure and entity references.
5. Report unknowns instead of attempting gameplay judgments.

The first two active sources are already in this repository:

- the current GenshinTools team and character-build presets;
- the legacy `scripts/team_comps_research.json` aggregate.

The legacy aggregate is deliberately retained as a candidate source. It lists
several domains globally but has no per-team locator, so consolidation must not
treat any row as verified external knowledge.

## Commands

Run from the repository root:

```powershell
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/import-sources.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/consolidate.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/replay-eula-structural-smoke.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
```

The Eula replay prints stable JSON to stdout and does not write or modify
knowledge, preset, or production data. It is explicitly a structural calculator
smoke test, not a guide result.

`import-sources.ts` and `consolidate.ts` produce byte-stable JSON when their
inputs have not changed.

`validate.ts` also reruns both adapters and consolidation in memory. It reports
an error if a saved snapshot or the consolidated repository is stale, so a
structurally valid but incomplete generated file cannot pass silently.

## Data flow

```text
sources/registry.json
        +
repository source files
        |
        v
data/source-snapshots/*.json
        |
        v
data/knowledge/repository.json
        |
        v
validation and discrepancy reports
```

Source snapshots preserve what a source actually contains. The consolidated
repository preserves provenance and review status. Neither layer is allowed to
turn a selected item into a ranking or infer constellations, refinements, ER,
formula counts, or rotations that the source did not specify.

## What validation does not claim

Passing validation currently means that IDs, shapes, rankings, stat slots,
references, and formula-count syntax are internally consistent. It does not
mean that:

- a team is good or even playable;
- an equipment recommendation is correct;
- an ER value is sufficient;
- formula counts describe an executable rotation;
- a source is authoritative;
- two apparently conflicting sources share the same assumptions.

Those questions belong to later experiments and human review.

Candidate catalog defects are warnings and promotion blockers. The same defect
is an error on a baseline or accepted record.
