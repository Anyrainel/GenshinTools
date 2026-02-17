# Artifact Builds Preset System Redesign

## 1. Objectives

1.  **Separation of Concerns**: Decouple `hidden` state (User configuration) from `BuildPayload` (Data).
2.  **Delta-Based State**: Switch from a "clone and own" model to a "Reference + Delta" model for **Built-in Presets**.
    *   **Reference**: Deeply immutable Preset Data.
    *   **Delta**: User modifications (`builds` map), deletions (`deletedIds` list), and additions (`characterToBuildIds` list).
3.  **Unified Schema**: Flatten the `BuildPayload` schema to match the internal `useBuildsStore` structure for simpler O(1) lookups and easier merging.
4.  **Stable Identification**: Implement content-based hashing for build IDs to ensure stability across preset updates.

---

## 2. Architecture & Data Structures

### A. New Store Structure (`useBuildsStore`)

The store will transition to flattened maps.

```typescript
interface BuildsState {
  // --- Metadata ---
  // Store version is handled by Zustand persist middleware (migrate function).
  // These fields track the "Net Sum" metadata.
  author: string;  
  description: string;

  // --- Reference ---
  // The ID of the currently active preset (e.g., "anyrainel-v5"). 
  // If null, we are in "Custom Mode" (no preset active, all data is local).
  activePresetId: string | null; 

  // --- User State (The Delta) ---
  
  // 1. Modified & New Builds
  // A flat map containing:
  // - New builds created by the user (Timestamp IDs).
  // - Preset builds that have been modified (Hash IDs, Copy-on-Write).
  // - Valid Build objects.
  builds: Record<string, Build>;

  // 2. Character Mapping (User Additions/Overrides)
  // Maps Character ID to a list of Build IDs.
  // Logic: IDs in this list are Unioned with Preset IDs.
  // If a user modifies a preset build, its ID MUST be present here (or in the preset list).
  // To ensure modified builds survive preset deletion, we can ensure they are added here when modified.
  characterToBuildIds: Record<string, string[]>; 
  
  // 3. Deletions
  // IDs of builds from the Preset that the user has "deleted".
  presetDeletedBuildIds: string[];

  // 4. UI State (Independent)
  // Tracks which characters are hidden in the UI. 
  // NOT exported/imported via BuildPayload.
  hiddenCharacters: Record<string, boolean>;
  
  // 5. Validation cache.
  validationErrors: Record<string, string[]>;
}
```

### B. Updated `BuildPayload` Schema (v5)

Flattened JSON structure (v5).

```typescript
export type BuildPayloadV5 = {
  version: 5;
  id?: string; // Preset ID (e.g. "anyrainel-2025-02-12")
  author: string;
  description: string;
  lastModified?: number; // Timestamp
  
  // Flat Maps
  builds: Record<string, Build>;
  
  // Character mapping
  characterBuilds: Record<string, string[]>; 
  
  // Weapon defaults
  characterWeapons: Record<string, string[]>;
  
  // Compute Options
  computeOptions?: ComputeOptions;
};
```

### C. Resolution Logic (The "Read" Path)

When the UI requests builds for a character (e.g., `Ineffa`), the selector does:

```typescript
function getResolvedBuilds(charId: string, state: BuildsState, preset: BuildPayloadV5 | null) {
  // 1. Get Preset Candidate IDs
  const presetIds = preset ? (preset.characterBuilds[charId] || []) : [];
  
  // 2. Get User Candidate IDs
  const userIds = state.characterToBuildIds[charId] || [];
  
  // 3. Combine (Union)
  // We use a Set to remove duplicates.
  // This effectively merges the lists.
  const allIds = Array.from(new Set([...presetIds, ...userIds]));
  
  // 4. Resolve & Filter
  return allIds
    .filter(id => !state.presetDeletedBuildIds.includes(id)) // Filter deleted preset IDs
    .map(id => {
      // Priority 1: User Modified/Created version (in store.builds)
      if (state.builds[id]) return state.builds[id];
      
      // Priority 2: Preset version (Reference)
      if (preset && preset.builds[id]) return preset.builds[id];
      
      return null;
    })
    .filter(Boolean); // Remove nulls (e.g. build deleted in preset and not in store)
}
```

**Disappearing Build Protection**: 
If the user modifies a preset build `A`, it is stored in `state.builds['A']`.
If the preset update removes `A` from `preset.characterBuilds`:
*   As long as `A` is *also* in `state.characterToBuildIds`, it will survive (Union).
*   **Rule**: When modifying a build, ensure its ID is added to `state.characterToBuildIds` if not already present. This ensures survival.

---

## 3. ID Generation (Stable Hashing)

To support stable updates, we replace random timestamp IDs with deterministic hashes during **Export** (for Presets). Local edits still use timestamps.

**Hash Algorithm**:
Construct a string key:
`Base = ${CharacterID}:${ArtifactSetID}` (or `HalfSet1:HalfSet2`)
If multiple builds exist for the same Base:
`Key = ${Base}:${Style}:${Role}:${MinCons}:${Name}`

Generate a short hash (e.g. `b-{hash32}`) or use the Key string directly if clean enough (maybe sanitized).
*Decision*: Use `b-hash(Key)` to keep IDs short and URL-safe.

---

## 4. Import / Export Workflows

### Import (File / Clipboard)
**Behavior**: "No Preset" Mode.
1.  Clear `activePresetId`.
2.  Clear `presetDeletedBuildIds`.
3.  Load *All* builds from payload into `state.builds`.
4.  Load *All* mappings into `state.characterToBuildIds`.

### Import (Built-in Preset)
**Behavior**: "Reference" Mode.
1.  Set `activePresetId`.
2.  Do NOT copy builds to `state.builds` (unless conflicts/overrides exist? No, start fresh or keep existing user overrides).
3.  User overrides (`state.builds`) with matching IDs will naturally take precedence.

### Export
**Behavior**: "Net Sum".
1.  Result is a standalone JSON (v5).
2.  Iterate all resolved builds.
3.  Generate proper Hash IDs (for stability) if it's intended for a Preset (needs a flag? Or always hash?).
    *   *Correction*: If we re-hash on export, we break the link to the local store IDs if we import it back.
    *   *Refinement*: Users exporting their own data for backup should keep IDs as is.
    *   *Refinement*: Only the **Preset Maintainer** runs the "Canonical Export" which re-hashes IDs to ensure stability for the community. Normal users just export what they have.

---

## 5. UI Requirements

### Build Card Actions
1.  **Toggle Visibility**:
    *   **Visible (Default)**: Normal rendering.
    *   **Hidden** (Eye Off): Rendered but excluded from calculation.
    *   **Deleted**: (Trash Icon) Adds to `presetDeletedBuildIds` (if preset) or removes from `builds` (if local).

2.  **Context Menu (Modified Preset Builds)**:
    *   **Revert to Original**: Deletes the entry from `state.builds`, exposing the underlying Preset build.
    *   **See Original**: Opens a dialog showing the read-only Preset build for comparison.

3.  **Visible vs Hidden**:
    *   We currently have a `visible` boolean on the Build object.
    *   This toggles whether the build contributes to the Artifact Filter.

---

## 6. Migration Plan (v4 -> v5)

1.  **Iterate `state.builds` (Old)**:
    *   Convert `BuildGroup` structure to `Builds` + `CharacterToBuildIds` flat maps.
    *   Preserve `hidden` flags from `BuildGroup` into `state.hiddenCharacters`.
    *   Remove `kOverride` (legacy cleanup).
2.  **Preset Alignment**:
    *   If the user was using a known preset, we *could* try to "diff" and set `activePresetId`.
    *   *Safe Bet*: Migrate everything to "Custom Mode" (User Local) initially. User can manually re-apply a preset if they want the "Live Reference" feature, but that might duplicate data.
    *   *Better*: Just migrate to local data. Reset `activePresetId` to null.

---

## 7. Implementation Checklist

1.  [ ] **Data Types**: Update `types.ts` with `BuildPayloadV5` and flattened structures.
2.  [ ] **Store Logic**:
    *   Implement `BuildsState` with `activePresetId`.
    *   Implement `getResolvedBuilds`.
    *   Update `newBuild` / `setBuild` to handle the "Union List" logic (ensure ID in `characterToBuildIds`).
    *   Implement `migrate` function (v4 -> v5).
3.  [ ] **Hashing**: Implement `generateStableBuildId` utility.
4.  [ ] **Export/Import**:
    *   Update `jsonUtils.ts` for v5.
    *   Ensure `importBuilds` handles the "Preset vs Local" distinction (maybe via arg).
5.  [ ] **UI Integration**:
    *   Connect `useBuildsStore` to components using the new selectors.
    *   Add "Revert" / "See Original" context menu.
