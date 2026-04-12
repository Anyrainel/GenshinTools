# Codebase Abstraction & Refactoring Report

Full audit of the GenshinTools codebase for major abstraction problems that cause workarounds at call sites, repeated brittle handling logic, misleading APIs, or poor readability.

## Completed Refactors

| # | Refactor | Files Created/Changed |
|---|----------|-----------------------|
| 2.1 | Extract duplicate `getMaxIds` to shared `idUtils.ts` | +`src/lib/account-data/idUtils.ts`, ~`mergeAccountData.ts`, ~`characterEditor.ts` |
| 3.1 | Extract generic `useAsyncComputation` hook, deduplicate 3 async hooks | +`src/hooks/useAsyncComputation.ts`, ~`useAsyncOptimizer.ts`, ~`useAsyncGenerator.ts`, ~`useAsyncWeaponChoice.ts` |
| 1.5 | Add `getTeamById()` method to `useTeamStore` | ~`src/stores/useTeamStore.ts`, ~`src/hooks/useTeamInventory.ts` |
| 2.2+2.3 | Extract normalize + entity maps to shared `entityMaps.ts` | +`src/lib/account-data/entityMaps.ts`, ~`goodConversion.ts`, ~`hoyolabFetcher.ts` |
| 3.7 | Move 26 ER calc inline i18n ternaries to `i18n-ui.ts` | ~`src/data/i18n-ui.ts`, ~`ERCalcView.tsx`, ~`ERResultsPanel.tsx`, ~`TimelineStrip.tsx`, ~`TeamSetup.tsx` |
| 1.3 | Batch import mutation helper `applyAccountImport()` | +`src/stores/applyAccountImport.ts`, ~`AccountData.tsx`, ~`useArtifactManagerJob.ts`, ~`ArtifactManagerDialog.tsx` |
| 4.2 | Migrate `halfSet1`/`halfSet2` from `number\|string` to `string` only | ~`types.ts`, ~`ItemIcon.tsx`, ~`ItemPicker.tsx`, ~`buildUtils.ts`, ~`buildEvaluation.ts`, ~`buildOptimizer.ts`, ~`AutoTuneDialog.tsx`, ~`AutoTuneView.tsx`, ~`buildMigration.ts`, + test updates |
| 3.4 | Clean up `useCharacterFilters` return value — remove tier/ownership passthrough | ~`useCharacterFilters.ts`, ~`CharacterBuildView.tsx`, ~`CharacterView.tsx` |
| 2.7 | Document error handling conventions in CLAUDE.md | ~`CLAUDE.md` (formalized existing patterns rather than forcing new Result type) |
| 1.1 | `useActiveAccountData()` / `useActiveAccount()` / `useActiveAccountScores()` hooks | +`src/hooks/useActiveAccount.ts`, ~15 files updated to use hooks instead of `useAccountStore(getActiveAccount)` + `?.data \|\| null` boilerplate |
| 1.2 | Replace raw internal map accesses with existing selectors | ~`useOwnership.ts` (4 sites → `getActiveAccount`), ~`CharacterDetailPanel.tsx` (2 sites → `getActiveAccount`) |
| 2.5 | Rename `replaceArtifactsFromSnapshot` → `rebuildAccountFromSnapshot` | ~`storeSync.ts`, ~`useArtifactManagerJob.ts`, ~`ArtifactManagerDialog.tsx`, ~`data-mutation-map.md`, + test updates |
| 3.6 | Remove unnecessary `t` prop drilling — components now call `useLanguage()` directly | ~`FormulaBreakdown.tsx`, ~`DamageCard.tsx`, ~`TriageCard.tsx`, ~`TriageHelpDialog.tsx`, ~`FlexPatternDialog.tsx`, ~`AutoTuneResults.tsx`, ~`AutoTuneResultCard.tsx`, + caller updates |

## Deferred Refactors

| # | Issue | Reason Deferred |
|---|-------|-----------------|
| 4.1 | Build composition discriminated union | Schema migration required — changes data shape for all builds |
| 3.2/3.3 | DamageCard/DamageDetail splitting | Massive component refactor (~800 LOC), risk of breaking UI |
| 1.4 | Derived state invalidation architecture | Requires rethinking cross-store coordination |
| 3.5 | useTeamInventory splitting into focused hooks | 10+ consumers |
| 3.8 | useAnalyzer fragile string cache key | 120 LOC of manual serialization |
| 4.3 | Typed store migrations | Retrofit per-version types on existing `any` migrations |
| 4.5 | Type assertions without validation (`as Slot`) | Add type guards, use `allSlots` for iteration |
| 4.6 | Untyped buff origins and triggers | Template literal types for `KitOrigin`, `BuffTrigger` |
| 4.7 | `number\|string` for form inputs | Separate form state types from internal state types |

## Rejected Refactors

| # | Issue | Reason Rejected |
|---|-------|-----------------|
| 2.4 | Substat iteration utility | Different null-checking semantics are intentional per domain (optimizer skips 0, scoring includes 0). Abstraction would hide correct behavior. |
| 2.6 | MergeResult wrapper inconsistency | `mergeEnkaImportWithInventory` is an internal helper only called by `mergeAccountData` which handles ID reassignment — plain array return is intentional. |
| 4.4 | null/undefined consistency | `== null` checks already handle both cases correctly everywhere. halfSet was fixed in 4.2. High churn, no actual bugs. |

---

## Table of Contents

1. [Stores & State Management](#1-stores--state-management)
2. [Library / Utility Layer](#2-library--utility-layer)
3. [Components & Hooks](#3-components--hooks)
4. [Type System & Data Model](#4-type-system--data-model)
5. [Priority Matrix](#5-priority-matrix)

---

## 1. Stores & State Management

### 1.1 Forced Two-Step Lookup for Active Account ★★★

Every consumer must call `getActiveAccount` after `useAccountStore`, forcing an extra lookup that should be automatic.

```typescript
// Repeated ~14 times across the codebase:
const activeAccount = useAccountStore(getActiveAccount);
const accountData = activeAccount?.data || null;
```

**Examples:** `AccountData.tsx:171`, `DamageDetail.tsx:150`, `CharacterBuildView.tsx:67`

**Fix:** Add a `useActiveAccountData()` hook or make `getActiveAccount` the default selector. Consumers should get `accountData` directly without the intermediate step.

---

### 1.2 Raw Internal Maps Exposed to Consumers ★★★

Stores expose `Record<string, T>` internals, forcing every consumer to manually index and null-guard.

```typescript
// Repeated 20+ times:
const frozenEntry = useFreezeStore((s) => s.frozenTeams[team.id]);
const storeFrozen = new Set(frozenTeams[teamId]?.frozenCharIds ?? []);
const ids = state.characterToBuildIds[character.id];
```

**Examples:** `DamageDetail.tsx:157`, `FrozenView.tsx:166`, `CharacterBuildCard.tsx:176`

**Fix:** Provide semantic getters: `getFrozenEntry(teamId)`, `getTeamById(id)`, `getCharacterBuildIds(charId)`. The store already has `getFrozenTeam()` but it's underutilized — enforce its usage.

---

### 1.3 Multi-Store Mutations Not Batched ★★☆

Account import requires 3 separate operations called together at every import site:

```typescript
// Repeated in 5+ places (AccountData.tsx, ArtifactManagerDialog.tsx, useArtifactManagerJob.ts):
addOrUpdateAccount(routing.id, { data: routing.data, name: routing.name });
setActiveAccount(routing.activeId);
syncFreezeStoreAfterImport(routing.data, partialMergeMap);
```

**Fix:** Provide an `importAccount(id, data, name, setAsActive)` method that internally handles all three steps atomically.

---

### 1.4 Derived State Stored Separately ★★☆

`staleScoreCharIds` in `useAccountStore` is derived state manually invalidated from 3 different stores (`useAccountStore`, `useBuildsStore`, `useArtifactScoreStore`).

```typescript
// Called from 3 stores to manually track staleness:
invalidateScores([characterId]);  // useBuildsStore
invalidateScores();               // useArtifactScoreStore (x3)
```

**Fix:** Compute staleness at query time based on hashes/timestamps instead of maintaining separate derived state that must be manually invalidated.

---

### 1.5 Missing Lookup Helpers ★☆☆

`useTeamStore` exposes `teams[]` array but no `getTeamById()`. Consumers write `.find()` each time:

```typescript
const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
```

**Fix:** Add `getTeamById(id)` method to `useTeamStore`.

---

## 2. Library / Utility Layer

### 2.1 Duplicate `getMaxIds()` ★★★

The same 30-line function appears in two files:

- `src/lib/account-data/mergeAccountData.ts:17`
- `src/lib/account-data/characterEditor.ts:10`

**Fix:** Extract to a shared `src/lib/account-data/idUtils.ts` with `getMaxIds()`, `nextArtifactId()`, `nextWeaponId()`.

---

### 2.2 Duplicate String Normalization ★★☆

Same normalization logic appears in multiple files:

```typescript
// goodConversion.ts:94
const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

// hoyolabFetcher.ts:168
const normalize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
```

Both build identical character/weapon/artifact reverse-lookup maps from game data.

**Fix:** Extract `normalizeEntityName()` and centralize entity reverse maps into a single `src/lib/account-data/entityMaps.ts`.

---

### 2.3 Repeated Entity Map Building ★★☆

Three files build the same name→ID reverse maps independently:

- `goodConversion.ts:118-136` — eager initialization
- `hoyolabFetcher.ts:174-188` — lazy initialization
- `artifact-manager/keys.ts:13-21` — different direction but same data

**Fix:** Centralize into pre-built singletons in a shared module.

---

### 2.4 Repeated Substat Iteration ★★☆

Four+ files iterate artifact substats with slightly different null-checking semantics:

```typescript
// artifactScore.ts — uses `val == null`
// artifactValidation.ts — uses `value === undefined`
// scoring/scorer.ts — uses `val == null`
// triage/triageEngine.ts — uses `typeof val !== "number"`
```

**Fix:** Create an `iterateSubstats(artifact)` generator that yields `{ key, value }` with consistent null filtering.

---

### 2.5 `replaceArtifactsFromSnapshot` Misleading Name ★★☆

Function name suggests "replace artifacts only" but it also:
1. Clears all artifact slots on characters
2. Creates new stub characters for unequipped artifacts
3. Returns an artifact ID map where orphaned IDs map to `""`

**Fix:** Rename to `rebuildAccountFromArtifactSnapshot()` or split into focused operations.

---

### 2.6 MergeResult Wrapper Inconsistency ★☆☆

`mergePartialAccountData` and `mergeAccountData` return `MergeResult` wrappers, but `mergeEnkaImportWithInventory` returns a plain `ArtifactData[]`.

**Fix:** Either all merge functions return `MergeResult`, or document why the exception exists.

---

### 2.7 No Consistent Error Handling Strategy ★☆☆

- `enkaFetcher.ts` — throws on "Invalid UID format"
- `goodConversion.ts` — returns `null` for unknown entities
- `artifactSolver.ts` — returns `null` on invalid data
- `damageBuffs.ts` — throws detailed validation errors

Callers can't reliably distinguish "data not found" from "critical error."

**Fix:** Adopt a consistent pattern at library boundaries — either always throw, always return `Result<T>`, or document the strategy per module.

---

## 3. Components & Hooks

### 3.1 Async Generator Hooks — 95% Code Duplication ★★★

Three hooks with nearly identical implementations:

- `useAsyncOptimizer.ts`
- `useAsyncGenerator.ts`
- `useAsyncWeaponChoice.ts`

Same try/catch pattern, same generator loop logic, same isMounted/abort refs. Bug fixes must be manually replicated to all three.

**Fix:** Extract a generic `useAsyncComputation<T>(generatorFn)` hook. Each specific hook becomes a one-liner wrapper.

---

### 3.2 DamageCard — 22+ Props ★★★

`DamageCard` has an extremely bloated props interface mixing optimizer state, generator state, freeze state, swap overrides, and display results.

```typescript
interface DamageCardProps {
  team: Team;
  effectiveTeam: Team;
  updateTeam: (...) => void;
  resolvedFormula: { ... } | null;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  equippedArtifactsByChar: Record<...>;
  currentDisplayResult: DisplayResult | null | undefined;
  isComputing: boolean;
  teamProgress: TeamOptimizationProgress | null;
  teamResult: TeamOptimizationResult | null;
  teamError: Error | null;
  handleOptimize: () => void;
  // ... 10+ more
}
```

**Fix:** Split into focused sub-components: `<DamageResultView>`, `<OptimizerPanel>`, `<GeneratorPanel>`. Each owns its concern and hooks.

---

### 3.3 DamageDetail — 800 LOC, 53 React Hooks ★★★

Single component with ~53 `useMemo`/`useState`/`useCallback` calls, handling: loading state, empty state, 3+ result modes, freeze UI, swap UI.

**Fix:** Extract each visualization mode into its own component. Use a dispatch/mode pattern:

```typescript
const mode = resolveDamageMode(team, inventory, freeze);
return {
  equipped: <EquippedDamageView />,
  optimized: <OptimizedDamageView />,
  frozen: <FrozenDamageView />,
}[mode];
```

---

### 3.4 `useCharacterFilters` Leaky Return Value ★★☆

Returns 7 values including internal implementation details and unrelated store data:

```typescript
return {
  filters,                // Core
  handleFiltersChange,    // Core
  setCheckboxFilters,     // INTERNAL LEAK
  activeFilterCount,      // Should be caller's useMemo
  tierAssignments,        // Unrelated store data
  hasTierData,            // Unrelated store data
  isCharacterOwned,       // Ownership ≠ filters
};
```

**Fix:** Return only `{ filters, updateFilters }`. Let callers access tier data and ownership checking through their own store selectors.

---

### 3.5 `useTeamInventory` Prop Drilling ★★☆

Returns a complex nested object (`allArtifacts`, `availableArtifacts`, `frozenArtifactIds`, `perCharExtraArtifacts`, `forceReuseChars`) that gets passed wholesale to 10+ components, each using only 1-2 fields.

**Fix:** Create focused selector hooks:

```typescript
export function useFrozenArtifactIds(teamId: string): Set<string> { ... }
export function useAvailableArtifacts(teamId: string): ArtifactData[] { ... }
```

---

### 3.6 `t` Prop Drilling Through Non-Consuming Components ★★☆

`t` from `useLanguage()` is passed as a prop through component layers that don't use it locally (e.g., `DamageDetail` → `DamageCard` → `FormulaBreakdown`).

**Fix:** Let leaf components call `useLanguage()` directly. Remove `t` from intermediate component prop interfaces.

---

### 3.7 ER Calc i18n Inline Ternaries ★★☆

New ercalc components use 25+ inline `language === "zh" ? ... : ...` checks instead of `t.ui()`.

```typescript
// Scattered across ERCalcView.tsx, ERResultsPanel.tsx, TimelineStrip.tsx:
{language === "zh" ? "模式" : "Mode"}
{language === "zh" ? "粒子运" : "RNG"}
```

**Fix:** Add entries to `src/data/i18n-ui.ts` under an `erCalc` section and use `t.ui("erCalc.mode")`.

---

### 3.8 `useAnalyzer` Fragile String-Based Cache Key ★☆☆

120-line hook with 30+ lines of manual string concatenation to build cache keys. If any field is missing from serialization, cache misses silently.

**Fix:** Use a robust comparison strategy (structural equality via `useShallow`, or hash the serialized options).

---

## 4. Type System & Data Model

### 4.1 Build Composition Split Across Multiple Fields ★★★

A single logical concept (artifact configuration) is spread across dependent fields with no type enforcement:

```typescript
composition: "4pc" | "2pc+2pc";
artifactSet?: string;        // only valid when composition === "4pc"
halfSet1?: number | string;  // only valid when composition === "2pc+2pc"
halfSet2?: number | string;  // only valid when composition === "2pc+2pc"
```

Callers must check 3+ conditions before safe field access (5+ call sites).

**Fix:** Use a proper discriminated union:

```typescript
type Build = BaseFields & (
  | { composition: "4pc"; artifactSet: string }
  | { composition: "2pc+2pc"; halfSet1: string; halfSet2: string }
);
```

---

### 4.2 Legacy `number | string` Hybrid for Set IDs ★★★

`halfSet1` and `halfSet2` accept both legacy numeric IDs and new string IDs. Callers must `String()` convert before comparing.

**Examples:** `AutoTuneView.tsx:196-197`, `BuildCard.tsx:294`, `buildMigration.ts:49-60`

**Fix:** Complete the migration to string IDs. Add a one-time migration pass and remove the `number` type from the union.

---

### 4.3 `any` Types in Store Migrations ★★☆

Multiple store migration functions use `any` casts:

```typescript
state.teams = state.teams.map((t: any) => ({ ... }));
```

**Fix:** Define explicit per-version types (`V1Team`, `V2Team`, etc.) and type each migration as `(t: V1Team) => V2Team`.

---

### 4.4 `null | undefined` Inconsistency ★★☆

1,048 uses of `?.` and 1,023 uses of `??` across the codebase. Mixed usage of `null` and `undefined` for the same semantic concept (absence).

- `characters: (string | null)[]` — uses null
- `artifactSetId: string | null` — uses null
- `halfSet1?: number | string` — uses undefined (optional)

**Fix:** Establish a convention: `undefined` for optional fields, `null` for explicitly nullable values. Enforce gradually.

---

### 4.5 Type Assertions Without Validation ★★☆

Repeated `as Slot` and `as MainStat[]` casts bypass type safety:

```typescript
// storeSync.ts, characterEditor.ts:
for (const slot of Object.keys(c.artifacts) as Slot[]) { ... }
char.artifacts[slot as Slot] = updater({ ...art });
```

**Fix:** Create type guard functions (`isValidSlot()`) and use `allSlots` constant for iteration instead of `Object.keys()`.

---

### 4.6 Untyped Buff Origins and Triggers ★☆☆

`BuffSource.origin` is `string` but only valid values are `"C0"–"C6"`, `"A"`, `"E"`, `"Q"`, `"P1"–"P4"`, `"R1"–"R5"`. Typos silently fail at runtime.

```typescript
origin?: string;    // No validation
triggers?: string[]; // No validation
```

**Fix:** Use template literal types: `type KitOrigin = \`C${0|1|2|3|4|5|6}\` | "A" | "E" | "Q" | ...`

---

### 4.7 `number | string` for Form Inputs ★☆☆

Components like `GeneratorControls` use `number | string` to handle both form input strings and internal numeric values, forcing `Number()` conversions throughout.

**Fix:** Separate form state types (`string`) from internal state types (`number`). Convert at the form boundary only.

---

## 5. Priority Matrix

### Tier 1 — High Impact, Low-Medium Effort

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 3.1 | Async hook duplication (3 hooks) | Eliminates maintenance risk | Low — extract generic hook |
| 1.1 | Two-step active account lookup | Removes 14+ boilerplate sites | Low — add selector hook |
| 2.1 | Duplicate `getMaxIds()` | Eliminates silent divergence risk | Low — extract to shared file |
| 1.5 | Missing `getTeamById()` | Removes repeated `.find()` calls | Low — add one method |

### Tier 2 — High Impact, Medium Effort

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 4.1 | Build composition discriminated union | Type safety across 5+ call sites | Medium — schema migration |
| 4.2 | Legacy number/string set IDs | Removes `String()` gymnastics | Medium — data migration |
| 1.3 | Multi-store mutation batching | Prevents inconsistent state | Medium — new import method |
| 3.2/3.3 | DamageCard/DamageDetail splitting | Massive readability gain | Medium-High — component refactor |

### Tier 3 — Medium Impact, Low Effort

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 2.2 | Duplicate normalization | DRY | Low — extract function |
| 2.4 | Repeated substat iteration | Consistent null semantics | Low — extract iterator |
| 3.6 | `t` prop drilling | Cleaner component interfaces | Low — use hook directly |
| 3.7 | ER calc i18n inline ternaries | Consistent i18n | Low — add to i18n-ui.ts |
| 4.5 | Type assertions without guards | Safety | Low — add type guards |

### Tier 4 — Valuable but Large Effort

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1.4 | Derived state invalidation architecture | Eliminates cross-store coordination | High — rethink staleness |
| 4.3 | Typed store migrations | Safety during schema evolution | Medium — retrofit per-version types |
| 4.4 | null/undefined consistency | Codebase-wide clarity | High — gradual convention enforcement |
| 2.7 | Error handling strategy | Predictable error semantics | High — library-wide alignment |
