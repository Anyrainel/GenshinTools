# Store Validation Strategy

Strategies to systematically prevent user cache breakage when new versions change persisted data shapes.

## Problem

Zustand persist stores deserialize data from localStorage with `as Type` casts, bypassing runtime type safety. When a new version adds/renames/removes fields, old cached data silently produces partially-valid objects that crash at consumption sites (e.g. `a.substats is not iterable`).

## Current State (as of 2026-03-21)

Every persisted store now has a `merge()` that runs repair functions on every rehydration. This catches missing fields but has gaps:

| Store | Version | Gaps |
|---|---|---|
| useBuildsStore | 5 | `computeOptions` not defaulted, `characterToBuildIds` not validated |
| useAccountStore | 3 | No semantic ID validation (character/artifact/weapon keys) |
| useTeamStore | 4 | `opts` (OptionMap) structure not validated |
| useTierStore | none | No versioning, no structural migration path |
| useTriageStore | none | No versioning, shallow merge only |
| usePreferencesStore | none | No versioning |
| useArtifactScoreStore | none | No versioning (already well-validated though) |
| useFreezeStore | 1 | Solid |

## Proposed Approaches

### 1. Schema Validation with Zod

Define Zod schemas for every persisted data shape. Use `.parse()` in `merge()` — Zod's `.catch()` fills in defaults automatically when fields are missing or wrong type. This replaces all ad-hoc `typeof` checks with a single source of truth.

```ts
const WeightedSubStatSchema = z.object({
  stat: z.string(),
  weight: z.number(),
});

const BuildSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  name: z.string().catch(""),
  visible: z.boolean().catch(true),
  composition: z.enum(["4pc", "2pc+2pc"]).catch("4pc"),
  substats: z.array(WeightedSubStatSchema).catch([]),
  sandsWeights: z.array(WeightedMainStatSchema).catch([]),
  gobletWeights: z.array(WeightedMainStatSchema).catch([]),
  circletWeights: z.array(WeightedMainStatSchema).catch([]),
  normalizer: z.number().catch(0),
  // optional fields use .optional() — no .catch() needed
  artifactSet: z.string().optional(),
  halfSet1: z.union([z.string(), z.number()]).optional(),
  halfSet2: z.union([z.string(), z.number()]).optional(),
});

// In merge():
const parsed = BuildSchema.parse(rawBuild); // throws on completely invalid
// or
const safe = BuildSchema.safeParse(rawBuild); // returns { success, data, error }
```

**Pros:**
- Single source of truth for data shape + defaults
- Self-documenting — the schema IS the migration spec
- Composable — nest schemas for ArtifactData inside AccountData
- `.catch()` at each level means partial corruption is repaired, not rejected

**Cons:**
- Adds zod dependency (~13KB gzipped)
- Initial effort to write schemas for all types
- Schemas must stay in sync with TypeScript types (or derive types from schemas with `z.infer`)

**Tip:** Derive TypeScript types FROM Zod schemas (`type Build = z.infer<typeof BuildSchema>`) so they can never drift apart.

### 2. Snapshot-Based Migration Tests

Save real localStorage JSON fixtures from each store version. Tests deserialize them through the current `migrate()` + `merge()` pipeline and assert the output matches expected shape. Catches regressions when someone adds a field but forgets migration.

```ts
// tests/stores/migration/builds-v4.json — real data from a v4 user
import V4_FIXTURE from "./fixtures/builds-v4.json";
import V3_FIXTURE from "./fixtures/builds-v3.json";

describe("builds store migration", () => {
  test("v4 data migrates and merges to valid current shape", () => {
    const migrated = migrateBuildsStore(V4_FIXTURE, 4);
    const merged = mergeBuildsStore(migrated, INITIAL_STATE);
    for (const build of Object.values(merged.builds)) {
      expect(Array.isArray(build.substats)).toBe(true);
      expect(typeof build.name).toBe("string");
      expect(Array.isArray(build.sandsWeights)).toBe(true);
      // ... assert every required field
    }
  });

  test("v3 data with string substats migrates correctly", () => {
    const migrated = migrateBuildsStore(V3_FIXTURE, 3);
    const merged = mergeBuildsStore(migrated, INITIAL_STATE);
    for (const build of Object.values(merged.builds)) {
      expect(build.substats.every(s => typeof s.stat === "string")).toBe(true);
    }
  });
});
```

**Pros:**
- Catches regressions at CI time
- Documents the evolution of data shapes
- Cheap to add incrementally — just save a JSON blob before each breaking change
- Works regardless of validation approach (Zod, manual, etc.)

**Cons:**
- Requires capturing fixtures for each version (easy to forget)
- Tests only cover shapes you've seen, not arbitrary corruption

**Workflow:** Before any store schema change, export current localStorage data as a fixture. Add a test that the old fixture migrates cleanly. This becomes a permanent regression test.

### 3. Version All Stores

Stores without `version` can't distinguish "old data missing field X" from "current data where field X was intentionally cleared." Add version numbers to all persisted stores.

Stores that currently lack versions:
- `useTierStore` / `useWeaponTierStore`
- `useTriageStore`
- `usePreferencesStore`
- `useArtifactScoreStore`

Even if their current shape doesn't need migration, having a version enables targeted migration when shapes change in the future. Without it, the only option is defensive `merge()` code that can't know whether data is old or intentionally empty.

### 4. Strengthen Existing merge() Repairs

Continue the current pattern: hand-written repair functions in `merge()`. The remaining gaps to close:

- **useBuildsStore:** Default `computeOptions` fields, validate `characterToBuildIds` entries reference existing builds
- **useTeamStore:** Validate `opts` (OptionMap) sub-fields exist
- **useTierStore:** Add version, validate tier assignment values are valid tier names

This is the lowest-effort option but scales poorly — every new field needs a manual repair line, and it's easy to forget.

## Recommendation

1. **Snapshot tests first** — cheapest, highest safety, works with any approach
2. **Then decide Zod vs manual** based on frequency of schema changes
3. **Version all stores** regardless — it's a one-line change that enables future migration

If the project is frequently adding fields to persisted types, Zod pays for itself quickly. If schema changes are rare, manual repair + snapshot tests is sufficient.
