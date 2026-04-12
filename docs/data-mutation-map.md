# Data Mutation Map

Read this before modifying any store, data import path, or artifact operation.

## Entities

### Artifact

**Lives in:** `useAccountStore` — characters[].artifacts + extraArtifacts
**Mirrored in:** `useFreezeStore` — frozenTeams[].artifactsByChar + frozenArtifactIds

| Mutation | Where | Freeze store impact |
|----------|-------|---------------------|
| Create/edit/delete | CharacterEditDialog → characterEditor | Auto-validated by subscriber |
| Import (GOOD/Enka/HoYoLAB) | AccountData.tsx → importRouting → merge | IDs reassigned — must remap before save |
| Scanner sync | useArtifactManagerJob → rebuildAccountFromSnapshot | Full ID remap (all old→"") — must remap before save |
| Lock/unlock | ArtifactManagerJob → applyJobResults | None |
| Equip/unequip | ArtifactManagerJob → applyEquipResults | None |
| Inventory delete | AccountData.tsx | Auto-validated by subscriber |

**Invariant:** Every artifact ID in useFreezeStore must exist in useAccountStore.
**Enforcement:** Two mechanisms work together:
1. `remapFreezeStoreForImport(map)` — called BEFORE `addOrUpdateAccount()` on any path that reassigns IDs
2. Auto-validation subscriber on useFreezeStore — fires on every account data change, removes orphaned refs

### Character

**Lives in:** `useAccountStore` — characters[]

Mutations share artifact import paths. Deleting a character removes its artifacts, which triggers the freeze store subscriber.

### Team

**Lives in:** `useTeamStore`

No cross-store invariants. Stale freeze entries for deleted teams are harmless.

### Builds

**Lives in:** `useBuildsStore`

**Invariant:** Scores must be invalidated when builds change.
**Enforcement:** Every build mutation calls `useAccountStore.invalidateScores()`.

### Tier List

**Lives in:** `useTierStore`

**Invariant:** Active tier list should match active account's linked list.
**Enforcement:** Subscriber in `tierListAutoSwitch.ts` watches useAccountStore.

### Scores

**Lives in:** `useAccountStore` — scores + staleScoreCharIds

**Invariant:** Must be invalidated when artifacts, builds, or score weights change.
**Enforcement:** Each mutation source calls `invalidateScores()` directly. `useArtifactScoreStore` mutations also call it.

## Cross-Store Dependencies

```
useAccountStore ──subscriber──▶ useFreezeStore.validateFrozenArtifacts()
useAccountStore ──subscriber──▶ useTierStore (tierListAutoSwitch.ts)
useBuildsStore ───calls──────▶ useAccountStore.invalidateScores()
useArtifactScoreStore ─calls─▶ useAccountStore.invalidateScores()
```

## When to update this file

- New store with cross-store invariants → add entity section
- New mutation path for an existing entity → add row
- New cross-store subscriber → add to dependency graph
