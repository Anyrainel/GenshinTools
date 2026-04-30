# Account System Design 4: Store Migration Implementation Plan

Last updated: 2026-04-30.

## Scope

This document plans the local Zustand store migrations needed before implementing the Cloudflare account, backup, entitlement, feedback, and telemetry backend.

The goal of this phase is to make local persisted data easier to reason about and easier to encode for cloud backup. It does not implement Workers, D1, R2, auth, payments, or the sync endpoints.

The main migration rule is:

- Store files should define the current runtime store.
- `src/stores/schemas.ts` should define current valid persisted shapes and hydration healing.
- `src/stores/migration/<domain>.ts` should own legacy persisted shapes and versioned migration code.
- Cloud backup codecs should be added after local store boundaries are clean.

## Implementation Status

The local store migrations needed before cloud backup work are complete on `master` through `b668a54f`. The remaining work before Cloudflare implementation is the cloud backup codec/namespace layer.

| Phase | Status | Commit |
| --- | --- | --- |
| Phase 0: migration modules | Done | `a469415a` |
| Phase 1: numeric account profile ids | Done for profile ids and account score cache split. | `ee07e6e5` |
| Phase 2: account-scoped settings | Done for triage/resource settings, clone-from-last-active import behavior, promotion remapping, and import messaging. | `b19c078d`, `b668a54f` |
| Phase 3: tier list migrations | Done for character account links and weapon/artifact multi-list stores. | `41c3be21` |
| Phase 4: freeze account scoping | Done. Freeze state is account-scoped, durable state is ID-only loadouts, and profile promotion remaps freeze data before activation. | `b68b2c47`, `b668a54f` |
| Phase 5: team cache persistence split | Done. Team source/config stays in `useTeamStore`; optimizer, investment, weapon choice, and artifact choice latest results route through local-only `useTeamResultCacheStore`. Analyzer cache is in-memory keyed cache only. | `ca14fca1`, `c6cc7dc2` |
| Phase 6: build preset delta | Done. Build store persists `PresetDelta<Build>[]` and derives runtime views from the active hydrated preset. | `5a0a1967`, `d6ffb28c` |
| Phase 7: team preset delta | Done. Team store persists `PresetDelta<TeamComp>[]` plus `configsByTeamId`, with active preset hydration and dedupe. | `98e3eb62`, `5a0a1967` |
| Phase 8: cloud codecs | Deferred until the cloud sync implementation starts. | pending |

## Current Migration Inventory

Current persisted stores with migration or hydration behavior:

| Store | Current key | Current version | Current migration module |
| --- | --- | ---: | --- |
| `useAccountStore` | `genshin-account-storage` | 6 | `src/stores/migration/account.ts` |
| `useBuildsStore` | `artifact-filter-builds` | 6 | `src/stores/migration/builds.ts` |
| `useTeamStore` | `team-builder-storage` | 17 | `src/stores/migration/team.ts` |
| `useFreezeStore` | `frozen-teams-storage` | 7 | `src/stores/migration/freeze.ts` |
| `useTierStore` | `tierlist-storage` | 3 | `src/stores/migration/tier.ts` |
| `useWeaponTierStore` | `weapon-tierlist-storage` | 1 | `src/stores/migration/tier.ts` |
| `useArtifactTierStore` | `artifact-tierlist-storage` | 1 | `src/stores/migration/tier.ts` |
| `useResourceRecStore` | `resource-rec-settings` | 8 | `src/stores/migration/resource.ts` |
| `useTriageStore` | `triage-settings` | 6 | `src/stores/migration/triage.ts` |
| `useAccountScoreCacheStore` | `account-score-cache-storage` | 1 | none; current-shape schema healing only |
| `useArtifactScoreStore` | `artifact-score-storage` | none | `src/stores/migration/artifactScore.ts` |

Stores that are persisted but do not need account-system migration work in V1:

| Store | Reason |
| --- | --- |
| `usePreferencesStore` | Device-local in cloud backup V1. |
| `useGreetingStore` | Onboarding state; do not upload. |
| `useSessionNavStore` | Session navigation state; do not upload. |
| `useArchiveSessionStore` | Session archive UI state; do not upload. |

Runtime cache stores should stay outside cloud sync:

| Store | Decision |
| --- | --- |
| `useAnalyzerCacheStore` | Keep in-memory only for full-option-keyed investment analyzer reuse. |
| `useTeamResultCacheStore` | Keep local only for the latest Team Comp optimizer, investment, weapon choice, and artifact choice result per team. |
| `useRecommendationCacheStore` | Keep in memory only. |
| `usePUpgradeCacheStore` | Keep in memory only. |
| `useBuffOverrideStore` | Runtime only. |

## Phase 0: Move Migration Code Out of Store Files

This phase should be behavior-preserving. It should not change persisted shapes and should not bump store versions.

Create:

```text
src/stores/migration/account.ts
src/stores/migration/builds.ts
src/stores/migration/team.ts
src/stores/migration/freeze.ts
src/stores/migration/tier.ts
src/stores/migration/resource.ts
src/stores/migration/triage.ts
src/stores/migration/artifactScore.ts
```

Move existing exported migration helpers:

| Existing helper | New location |
| --- | --- |
| `migrateAccountStore` | `migration/account.ts` |
| build store inline `migrate` body | `migration/builds.ts` as `migrateBuildsStore` |
| `migrateTeamStore` | `migration/team.ts` |
| `mergeTeamStore` | `migration/team.ts` |
| `migrateFreezeStore` | `migration/freeze.ts` |
| `migrateTierStore` | `migration/tier.ts` |
| resource recommendation inline `migrate` body | `migration/resource.ts` as `migrateResourceRecStore` |
| triage inline `migrate` body | `migration/triage.ts` as `migrateTriageStore` |
| artifact score `migratePersisted` helper | `migration/artifactScore.ts` |

Rules for the extraction:

- Old persisted shapes and old helper types move with the migration functions.
- Store files import migration helpers and keep only current state/actions/defaults.
- Tests should import migration helpers from `src/stores/migration/*`.
- Do not add compatibility re-exports from store files unless a non-test caller needs them.
- Do not use this phase to rewrite migrations semantically.

Validation:

```bash
npm run type-check
npx vitest run tests/stores
```

## Phase 1: Account Profile ID Migration

This phase changes account profile IDs to numeric IDs.

Target:

```ts
type AccountProfileId = number;
```

Conventions:

- Profile `0` is the default no-UID profile.
- UID-backed profiles use the UID as a number.
- Profile `0` should not be displayed as a game UID.
- If profile `0` is later promoted to a real UID, cloud delete should be soft delete. Local UI should stop showing profile `0` after promotion unless it is intentionally recreated.

Migration:

| Old value | New value |
| --- | --- |
| `"default"` | `0` |
| UID string such as `"123456789"` | `123456789` |
| `activeAccountId: string | null` | `activeAccountId: AccountProfileId | null` |
| `AccountState.id: string` | `AccountState.id: AccountProfileId` |

Implementation notes:

- JavaScript object keys are strings at runtime, but app-facing APIs should use `AccountProfileId`.
- If `accounts` remains an object map, define helpers for converting profile ids at the object boundary.
- Avoid repeated `"default"` to `0` conversions outside the migration boundary.

Also split cache-like score data out of account source data:

- `scores` and score stale markers should not be cloud source data.
- Move them to a local cache store or local-only persisted cache if preserving them improves UX.
- If the migration drops score cache, mark account scores stale so recomputation is explicit.

Tests:

- Migrates `"default"` profile to `0`.
- Migrates UID string profile IDs to numbers.
- Migrates `activeAccountId`.
- Preserves account payloads.
- Does not preserve account scores as cloud source data.

## Phase 2: Account-Scoped Settings

Migrate settings that belong to account data from singleton stores to account-scoped stores.

Stores:

- `useTriageStore`
- `useResourceRecStore`

Target pattern:

```ts
type AccountScopedSettings<TSettings> = {
  settingsByProfileId: Record<AccountProfileId, TSettings>;
};
```

The active profile should come from `useAccountStore`, not be duplicated as a separate source of truth unless the UI needs an explicit draft state.

Migration:

- Existing singleton triage settings become settings for profile `0`, or the active account profile if available.
- Existing singleton resource recommendation settings become settings for profile `0`, or the active account profile if available.
- New account profile import should clone settings from the last active profile if those settings differ from defaults.
- The import flow should tell the user when cloned settings were applied.
- If profile `0` is promoted to a UID during import, remap triage/resource settings, freeze state, and character tier-list account links before setting the UID as active.

Cloud result:

- `account.triage:{profileId}`
- `account.resources:{profileId}`

Tests:

- Old singleton settings migrate into account-scoped maps.
- Active profile lookup returns migrated settings.
- Missing profile settings fall back to defaults without forcing a migration.

## Phase 3: Tier List Migrations

Character tier lists, weapon tier lists, and artifact tier lists should all use stable list instances.

### Character Tier Lists

Target:

```ts
type CharacterTierListInstance = {
  id: number;
  linkedAccountId: AccountProfileId | null;
  // current list data
};
```

Migration:

- `linkedAccountId: "default"` migrates to `0`.
- UID string account links migrate to numeric UID.
- Unattached lists keep `linkedAccountId: null`.
- Legacy singleton data migrates into `tierLists: Record<number, TierListInstance>` with `activeTierListId` and `nextId`.
- Local list ids are numeric. Cloud codecs can encode them as path-safe partition strings later, but the current local source of truth stays numeric.

### Weapon and Artifact Tier Lists

Current weapon and artifact tier stores are singleton-like. Migrate both to multi-instance stores.

Target:

```ts
type TierListStore<TList> = {
  tierLists: Record<number, TList>;
  activeTierListId: number;
  nextId: number;
};
```

Default migrated ids:

- `1` for the initial weapon list
- `1` for the initial artifact list

No account link is required for weapon or artifact tier lists.

Implementation notes:

- Prefer a shared multi-tier-list store helper instead of bespoke character, weapon, and artifact implementations.
- Keep account linking optional and character-only.
- Cloud namespaces should be:
  - `tier.character:{listId}` for unattached character lists
  - `tier.character.account:{profileId}` or equivalent for account-linked character lists
  - `tier.weapon:{listId}`
  - `tier.artifact:{listId}`

Tests:

- Character list id migration is deterministic.
- Account links migrate to numeric profile ids.
- Existing weapon tier data becomes one active weapon list.
- Existing artifact tier data becomes one active artifact list.

## Phase 4: Freeze Store Migration

Freeze should be account-scoped and ID-only.

Target:

```ts
type FrozenLoadout = {
  charId: string;
  teamId?: string;
  artifactIds: Partial<Record<Slot, string>>;
};

type FreezeAccountState = {
  loadouts: FrozenLoadout[];
  standaloneArtifactIds: string[];
  reuseMode: FreezeReuseMode;
};

type FreezeStoreState = {
  byProfileId: Record<AccountProfileId, FreezeAccountState>;
};
```

Migration:

- Existing full artifact blobs in frozen team records are reduced to artifact ids.
- Existing `frozenArtifactIds` becomes `standaloneArtifactIds`.
- Existing global freeze data moves under the active account profile, or profile `0` if unknown.
- Switching active account switches the visible freeze state.

Cloud result:

- `account.freeze:{profileId}`

Tests:

- Full artifact freeze records migrate to ID-only loadouts.
- Reuse mode is preserved.
- Global old data is assigned to the expected account profile.
- Account switching changes visible freeze state.

## Phase 5: Team Store Cache Split

Team source data should not persist optimizer, investment, or weapon-choice result caches.

Target:

- `useTeamStore` persists `compDeltas`, `configsByTeamId`, author, and description only.
- Derived result caches move to a local-only team result cache store.
- One latest result per team and mode is enough for V1.

Migration:

- Remove persisted result fields from team records.
- Do not attempt to migrate old result caches into the new cache store unless it is trivial.
- Dropping old cached results is acceptable because they are derivable.

Implementation notes:

- Keep `useAnalyzerCacheStore` in-memory only for full-option-keyed analyzer reuse.
- `useTeamResultCacheStore` owns the latest optimizer, investment, weapon choice, and artifact choice result per team.
- Cache data should not appear in any cloud codec.

Tests:

- Old team records with cached result fields hydrate without those fields in source data.
- Team source/config data is preserved.
- Cache dropping does not break selected-team UI.

## Phase 6: Build Preset Delta Migration

Build storage should move toward a generic preset-delta list so there is one source of truth for local add/remove/order behavior on top of preset data.

Target:

```ts
type PresetDelta<TItem> =
  | {
      kind: "preset";
      id: string;
      deleted?: true;
      displayIndex?: number;
    }
  | {
      kind: "custom";
      id: string;
      value: TItem;
      displayIndex?: number;
    };
```

Store shape:

```ts
type BuildStoreState = {
  activePresetId: string | null;
  deltas: PresetDelta<Build>[];
  // current compute/config fields
};
```

Resolution rules:

- Preset data is loaded by `activePresetId`.
- The store contains only local deltas.
- Per-character build mapping is reconstructed after hydration.
- `displayIndex` is sorted within each character, so duplicate display indexes across characters are valid.
- `presetDeletedBuildIds` should not remain as a separate source of truth.

Migration:

- Existing custom builds become `kind: "custom"` entries.
- Existing deleted preset ids become `kind: "preset", deleted: true` entries.
- Existing order data becomes `displayIndex`.
- Existing validation cache should remain excluded or be recomputed.

Tests:

- Deleted preset builds stay deleted after preset update.
- Custom builds survive migration.
- Per-character order is preserved.
- New preset builds can appear when not explicitly deleted.

## Phase 7: Team Preset Delta Migration

Apply the same generic `PresetDelta<TItem>[]` model to teams.

Difference from builds:

- Team order is global.
- `displayIndex` sorts the resolved team list globally.
- Team config is user-owned unless intentionally included in preset data.
- Derived optimizer or analyzer results are still cache data and must stay outside the source store.

Target:

```ts
type TeamStoreState = {
  activePresetId: string | null;
  compDeltas: PresetDelta<TeamComp>[];
  configsByTeamId: Record<string, TeamSetupConfig>;
  author?: string;
  description?: string;
};
```

Migration:

- Existing custom teams become `kind: "custom"` entries.
- Existing deleted preset teams become deleted preset entries if the current store can infer that state.
- Existing order becomes global `displayIndex`.

Tests:

- Global team order survives migration.
- Preset team deletion survives preset updates.
- Custom teams survive migration.
- Cache fields are not present in the source store.

## Phase 8: Cloud Codec Preparation

After the local store migrations are complete, add cloud backup codec scaffolding.

This should still be local-only work. It prepares the app boundary before server work starts.

Planned namespaces:

| Namespace | Partition |
| --- | --- |
| `account.profile` | profile id |
| `account.characters` | profile id |
| `account.weapons` | profile id |
| `account.artifacts` | profile id plus stable `setGroup` |
| `account.equipment` | profile id |
| `account.freeze` | profile id |
| `tier.character` | list id |
| `tier.character.account` | profile id |
| `tier.weapon` | list id |
| `tier.artifact` | list id |
| `builds` | default |
| `team.comp` | default |
| `team.config` | default |
| `account.triage` | profile id |
| `account.resources` | profile id |
| `settings.artifactScore` | default |

Codec rules:

- Artifacts are sharded by stable `setGroup`.
- The `setGroup` mapping is an implementation detail, but should be stable across app versions when possible.
- Weapons exclude disposable weapons from cloud backup: unlocked, rarity 3, level 1, refinement 1, and not equipped.
- Equipment owns equipped weapon and artifact references.
- Cache stores are never encoded for cloud backup.
- Payload codecs have independent versions from local Zustand store versions.

Tests:

- Round-trip every namespace.
- Verify disposable weapon filtering.
- Verify artifact shard selection.
- Verify equipment references survive character, weapon, and artifact partitioning.
- Verify cache data is absent from every cloud payload.

## Versioning Strategy

Use one version bump per store per semantic migration phase.

Recommended order:

1. Migration module extraction, no version bumps.
2. Account profile numeric IDs.
3. Account-scoped triage, resource, and freeze.
4. Character, weapon, and artifact tier-list migrations.
5. Team cache split.
6. Build preset-delta migration.
7. Team preset-delta migration.
8. Cloud codec scaffolding.

Rules:

- Migrate from the current origin version.
- If another branch has already bumped a store version, merge the migration paths instead of stacking local bump noise.
- Do not bump persisted versions only to change defaults.
- Put comments describing old persisted shapes in the migration module, not in the latest store file.
- Keep `partialize`, `migrate`, and `merge` responsibilities separate:
  - `partialize` decides what is written now.
  - `migrate` upgrades old persisted versions.
  - `merge` heals current-version persisted data during hydration.

## Validation Plan

Run the narrow tests while developing each phase:

```bash
npx vitest run tests/stores/useAccountStore.test.ts
npx vitest run tests/stores/useFreezeStore.test.ts
npx vitest run tests/stores/useTeamStore.test.ts
npx vitest run tests/stores/useTierStore.test.ts
npx vitest run tests/stores/useBuildsStore.test.ts
```

Run the broader store suite before merging:

```bash
npm run type-check
npx vitest run tests/stores
```

Run `npm run lint` after the final phase or after any broad import movement.

## Main Risks

The riskiest migrations are build and team preset delta migration because they change how preset data, local custom data, deletion, and order interact.

Mitigation:

- Implement account/profile/settings/cache migrations first.
- Keep preset-delta helper logic generic and tested independently.
- Add fixture tests for preset update behavior before changing the UI code path.
- Do not start cloud sync until local migration round-trips are stable.
