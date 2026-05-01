# Account System Design 2: Cloud Data Survey and Refactor Plan

Last updated: 2026-04-30.

## Scope

This document surveys what GenshinTools currently stores locally, what should go to cloud backup, what should be excluded, and what refactors make cloud sync manageable.

The key rule is: cloud sync should not blindly upload every Zustand persistence key forever. We should introduce an explicit cloud boundary with versioned adapters, then let local stores keep serving UI needs.

## Current Persistence Boundary

Current durable localStorage keys observed in `src/stores`:

| Store | Key | Current contents | Cloud decision |
| --- | --- | --- | --- |
| `useAccountStore` | `genshin-account-storage` | numeric account profiles and active account id | Upload account profile data and normalized account source data. Scores are already split out. |
| `useAccountScoreCacheStore` | `account-score-cache-storage` | account-scoped artifact score results and stale markers | Do not upload in V1. Recompute or use local cache only. |
| `useBuildsStore` | `artifact-filter-builds` | artifact build preset deltas, active preset id, compute options, character metadata, derived runtime views | Upload user-authored build config. Exclude hydrated preset payload, validation state, and derived runtime views. |
| `useTeamStore` | `team-builder-storage` | `compDeltas`, `configsByTeamId`, active preset id, metadata, derived runtime views | Upload `teams/all`. Exclude result caches and derived views. |
| `useFreezeStore` | `frozen-teams-storage` | account-scoped frozen team artifact-id loadouts, standalone frozen artifact ids, reuse mode | Upload account-scoped stable freeze intent. Do not duplicate full artifact blobs. |
| `useTierStore` | `tierlist-storage` | character tier-list instances, account links, and view settings | Upload user-authored tier lists. Preserve at most one account-linked list per account profile plus unattached lists. |
| `useWeaponTierStore` | `weapon-tierlist-storage` | multi-instance weapon tier lists | Include in backup. No account profile linkage. |
| `useArtifactTierStore` | `artifact-tierlist-storage` | multi-instance artifact tier lists | Include in backup. No account profile linkage. |
| `useArtifactScoreStore` | `artifact-score-storage` | global artifact scoring weights | Upload small settings. |
| `useTriageStore` | `triage-settings` | account-scoped triage settings | Upload as account-scoped settings. |
| `useResourceRecStore` | `resource-rec-settings` | account-scoped resource recommendation thresholds and filters | Upload as account-scoped settings. |
| `usePreferencesStore` | `preferences-storage` | UI preferences | Keep device-local in V1. Revisit after core backup is stable. |
| `useGreetingStore` | `greeting-storage` | onboarding/greeting state | Do not upload by default. |
| `useSessionNavStore` | `session-nav-storage` | session navigation state | Do not upload. |
| `useArchiveSessionStore` | `archive-session-storage` | archive session state | Do not upload. |
| `useTeamResultCacheStore` | `team-result-cache` | latest optimizer, investment, weapon choice, and artifact choice result per team | Do not upload. Long-lived local cache only. |
| `useAnalyzerCacheStore` | none | in-memory analyzer cache keyed by full analyzer options | Do not upload. Implementation cache only. |
| `useRecommendationCacheStore` | none | in-memory Map cache | Do not upload. |
| `usePUpgradeCacheStore` | none | in-memory Map cache | Do not upload. |
| `useBuffOverrideStore` | none | non-persisted buff override runtime | Do not upload. |

## Backup Domains and Partitions

Cloud backup should be organized by domain namespace and partition. A namespace is the kind of data. A partition is the smallest whole unit we upload, compare, restore, and conflict-check.

Concrete backup domains:

| Domain | Namespaces | Partition | Conflict behavior |
| --- | --- | --- | --- |
| Game profile app data | `profile.app` | profile id (`0` for default/no UID, otherwise numeric UID) | Explicit profile import/replace may overwrite; passive sync still revision-checks. |
| Game profile characters and weapons | `profile.game` | profile id | Explicit profile import/replace may overwrite; passive sync still revision-checks. |
| Game profile artifacts | `profile.artifacts` | profile id | Explicit profile import/replace may overwrite; passive sync still revision-checks. |
| Build library and artifact score settings | `builds` | `all` | Revision checked; user resolves local/cloud if edited on multiple devices. |
| Team comp/config | `teams` | `all` | Revision checked; user resolves local/cloud if edited on multiple devices. |
| Tier lists | `tiers` | `all` | Revision checked; user resolves local/cloud if edited on multiple devices. |
| Local result caches | none | none | Excluded from cloud. |
| Session/UI state | none | none | Excluded from cloud. |

Important: "cache" does not always mean "throw away on browser close". Some computations take minutes, so local long-term cache is valid. The boundary should be "excluded from cloud", not automatically "sessionStorage".

## Account Data

Current local shape:

```ts
type AccountData = {
  characters: CharacterData[];
  extraArtifacts: ArtifactData[];
  extraWeapons: WeaponData[];
};
```

`CharacterData` nests equipped weapon and artifacts. This is ergonomic for UI but poor for cloud sync because equipment links are duplicated across character and item views, while the artifact payload is large.

Cloud target:

- Keep local `AccountData` for UI and existing import flows.
- Add a cloud adapter that normalizes game profile data into coarse partitions:
  - `profile.app/{profileId}` for game profile metadata, freeze state, triage settings, and resource settings.
  - `profile.game/{profileId}` for characters and non-disposable weapons.
  - `profile.artifacts/{profileId}` for artifacts, including each artifact's equipped character id.
- Compress each partition before upload.
- Track a hash and revision per partition so imports only upload changed partitions.

Account profile ids:

- Current local profiles use numeric ids: profile id `0` for the default/no-UID profile and the actual UID for UID-bound profiles.
- UID `0` does not exist in game and should never be displayed as a player UID. It is only a profile key.
- When a default/no-UID profile is promoted to a real UID, local account-scoped stores are renamed from profile `0` to the UID before activation. Cloud sync should move all account-scoped partitions from profile `0` to the UID and soft-delete profile `0`.
- A signed-in app account can have zero or one default profile plus at most one profile for each UID.
- Backup should include all local account profiles by default, not only the active account.

## Account Item Identity

Splitting account data into character, weapon, and artifact partitions only works if item references are stable. The current local import path is not enough for this long term: GOOD conversion assigns sequential ids such as `weapon-0` and `artifact-0`, and merge paths may reassign all ids after imports while remapping known dependent stores.

Cloud sync needs account-scoped stable item ids that are independent of array order and independent of which partition uploads first.

Important limitation: upstream data generally does not expose a true immutable game item id. Two identical weapons or two identical artifacts can be semantically indistinguishable. We can make ids stable and deterministic for our data model, but cannot prove physical identity for perfectly identical items unless a source eventually provides a unique id.

Recommended identity model:

```ts
type AccountItemId = string; // account-scoped stable id

type ItemIdentitySource = {
  source: "good" | "enka" | "hoyolab" | "manual" | "scanner";
  sourceInstanceId?: string; // use if a future source exposes a true item id
  fingerprint: string;
  occurrence: number;
};
```

Rules:

- Do not use item array index as the cloud id.
- Do not include equipped character in the identity fingerprint. Equipment links belong in a small equipment partition.
- Do not include mutable UI state such as lock if we want lock toggles to preserve identity.
- Preserve existing local/cloud item ids by matching new imports against previous items before assigning ids to unmatched items.
- For unmatched first-seen items, generate a deterministic id from normalized fingerprint plus occurrence within that fingerprint group.
- If two items are truly indistinguishable under the available fields, their exact identity is not observable. The occurrence suffix is only a stable reference handle inside our account model.

Duplicate handling:

- Treat each fingerprint group as a multiset, not a single object.
- Preserve previous ids first. When a new import arrives, group previous and incoming items by normalized fingerprint, then assign previous ids to incoming items in a stable tie-break order.
- The tie-break order can use non-identity hints such as previous equipped character, new equipped character, lock state, source row order, and previous id. These hints are only for stable matching; they are not part of the identity fingerprint.
- If a group has two completely identical artifacts and neither source exposes a real item id, there is no way to know which physical copy is which. The app can preserve two separate handles, but those handles are arbitrary members of an indistinguishable set.
- If one of two previously identical artifacts later changes through upgrade/refinement and the source still has no unique id, choose the most compatible previous id by deterministic matching. If both previous candidates are equally compatible, either assignment is semantically equivalent from source data alone.
- User-facing behavior should acknowledge this quietly: freeze/lock references stay stable as long as matching evidence exists, but a truly indistinguishable duplicate pair cannot promise physical-copy continuity.

Artifact fingerprint candidates:

- `setKey`
- `slotKey`
- `rarity`
- `mainStatKey`
- solved/normalized substat keys and values
- `initialValues` when present
- `unactivatedSubstats` when present
- `totalRolls` when present
- `elixirCrafted` if it is treated as intrinsic to the artifact

Artifact identity caveat:

- Artifact level and rolled substat values can change after upgrade. Exact fingerprints will then change.
- The import path should first try exact match, then a deterministic "same artifact after upgrade" match when old and new artifacts are compatible by set, slot, rarity, main stat, and roll lineage.
- If no compatible previous item exists, assign a new id.

Weapon fingerprint candidates:

- `key`
- `level`
- `ascension` if available
- `refinement`

Weapon identity caveat:

- Weapon level/refinement can change. Preserve ids by matching against previous weapons before assigning ids from fingerprint groups.
- Lock and equipped character should not be identity fields.

Cloud partition references should use these stable ids:

- `profile.game` stores character-owned state and each backed-up weapon by stable `id`. The cloud adapter excludes disposable weapons.
- `profile.artifacts` stores each artifact by stable `id`, including `equippedCharacterId` directly on the artifact row.
- `profile.app` stores game profile metadata plus small profile-scoped app data such as freeze, triage, and resource settings.

This means character/weapon data and artifact inventory can still be compared independently, but V1 avoids a separate equipment partition because artifact equipment is stored on the artifact item itself.

Why equipment is not its own partition in V1:

- The implemented local store already represents artifact equipment on the artifact item.
- Keeping equipment on `profile.artifacts` avoids an extra correlated object that must be committed atomically with artifacts.
- Weapon equipment stays local to weapon entries in `profile.game`.
- If equip-only payloads become a measured bottleneck, a later schema can split them out intentionally.

Recommended account partitions, repeated per account profile id:

| Partition | Contents | Upload trigger |
| --- | --- | --- |
| `profile.app/{profileId}` | profile id, name, UID if present, source metadata, freeze, triage, and resource settings | account create/rename/link, freeze/settings edit |
| `profile.game/{profileId}` | characters and all non-disposable weapons with id, key, rarity, level, refinement, lock, and weapon equipment | character/weapon import/edit |
| `profile.artifacts/{profileId}` | artifacts with id, set, slot, rarity, level, main stat, lock, roll data, and equipped character id | artifact import/edit/scanner sync/equip change |

Artifact sharding note:

- Earlier planning considered `account.artifacts/{profileId}:{setGroup}`. The implemented V1 keeps one artifact partition per game profile: `profile.artifacts/{profileId}`.
- `src/cloud/adapters/setGroup.ts` remains as an editable mapping for future shard experiments and local measurement, but it is not part of the current Worker API partition key.
- If real production payloads show poor upload success for the artifact partition, split `profile.artifacts/{profileId}` into grouped partitions in a new cloud payload schema version.

Disposable weapon filter:

- The cloud adapter should exclude weapons that are all of:
  - unlocked
  - rarity 3
  - level 1
  - refinement 1
  - not equipped by any character in `profile.game`
- This filter applies only to cloud backup payloads. Local stores may keep those weapons if imports/scanners provide them.
- On restore, missing disposable weapons are intentionally not recreated. This is acceptable data loss because they are common fodder and not relied on by user-authored features.

Compression:

- Use browser `CompressionStream("gzip")` or a small library fallback.
- Server should accept already-compressed bodies and store them directly in R2.
- Store `logical_bytes`, `compressed_bytes`, and `sha256` in D1.
- Use gzip first because it is broadly supported and usually strong for repeated JSON keys and enum strings. Brotli can be considered later.
- Measure real account dumps before adding a custom artifact representation. Track both full logical JSON size and compressed size for `profile.artifacts`.

Further compacting:

- If gzip is not enough for China upload reliability, add a compact artifact representation:
  - dictionary encode repeated enum keys such as stats, slots, set ids, artifact keys
  - store artifacts as arrays instead of objects
  - omit default false fields
  - keep equipment links out of the artifact payload
- Do this at the cloud adapter boundary, not in local UI types.
- Do not build a bespoke binary format in V1. A dictionary/array JSON representation is easier to migrate, inspect, and test.

## Account Scores and Recommendation Outputs

`useAccountScoreCacheStore` now owns account-scoped score results and stale markers. Scores are derived from account data, artifact score settings, builds, and scoring logic, so they are not account source data.

Cloud decision:

- Do not upload account `scores` in the first version.
- Keep `staleScoreCharIdsByProfileId` local-only.
- Keep scores in `useAccountScoreCacheStore`, not `useAccountStore`.
- Recompute scores after restore or lazily when the relevant page opens.
- If recompute cost becomes a real problem, add a separate `cache.accountScores` cloud namespace later with a strict dependency hash:
  - account artifacts hash
  - build config hash
  - artifact score settings hash
  - app scoring engine version

## Build Store

Current `useBuildsStore` now uses the shared preset-delta model:

- `activePresetId`
- `activePresetPayload` as hydrated runtime preset data, not persisted
- `deltas: PresetDelta<Build>[]` as the persisted source of custom builds, preset tombstones, and order
- derived runtime views for UI compatibility:
  - `builds`
  - `characterToBuildIds`
  - `presetDeletedBuildIds`
  - `resolvedBuildsByCharacterId`
  - `resolvedBuildGroups`
  - `validResolvedBuildGroups`
- `characterWeapons`
- `computeOptions`
- metadata
- local `validationErrors`

Cloud decision:

- Upload `activePresetId`, `deltas`, character metadata, compute options, and metadata.
- Exclude `validationErrors`; recompute with `getBuildValidationErrors()` during hydration or import.
- Exclude `activePresetPayload` and every derived runtime view.

Cloud payload shape:

```ts
type CharacterBuildMetadata = {
  /** Character-level visibility, separate from build removal. */
  hidden?: boolean;
  /** User override for recommended weapons. */
  weaponIds?: string[];
};

type BuildsCloudPayload = {
  activePresetId: string | null;
  activePresetRevision?: string;
  deltas: PresetDelta<Build>[];
  characterMetadata?: Record<string, CharacterBuildMetadata>;
  computeOptions?: ComputeOptions;
  author?: string;
  description?: string;
};
```

Resolver rules:

1. Rehydrate one flat `PresetDelta<Build>[]`.
2. Resolve the visible universe of preset and custom builds.
3. Group resolved builds by `build.characterId`.
4. Drop preset ids with `deleted: true`.
5. Add custom items from custom deltas.
6. Sort within each character group by `displayIndex` when present.
7. Append visible items without `displayIndex`, preserving preset order for preset items and creation/id order for custom items.

CRUD mapping:

- Create custom build: add a custom item delta with `id`, `value.characterId`, and optional `displayIndex`.
- Edit preset build: fork it by setting `deleted: true` on the preset item and adding a custom item with the edited full value.
- Edit custom build: replace the custom item's full `value` in place while preserving its id.
- Remove preset build: set `deleted: true` on the preset item delta.
- Remove custom build: remove the custom item delta.
- Reorder: update only `displayIndex` on affected item deltas.
- Restore character: remove deltas whose resolved group is that character and remove character-level metadata.

The old mixed `builds` + `characterToBuildIds` + `presetDeletedBuildIds` persisted shape has been migrated into this single-source delta shape. Those old fields are now derived runtime compatibility views only.

## Generic Preset Overlay Lists

Build presets and team presets need the same conceptual operation: resolve a user overlay over a preset object list. The generic structure should separate object identity, custom object content, removal, and ordering without baking in build-specific or team-specific fields.

Runtime resolver spec:

```ts
type PresetListSpec<TObject> = {
  /**
   * Stable resolver name for migrations/debugging, for example
   * "builds.characterBuilds" or "teams.templates".
   */
  resolverKey: string;
  /**
   * Identity resolver. This can read item.id, or compute an id from the object.
   * It must be stable for preset objects and custom objects.
   */
  getId: (item: TObject) => string;
  /**
   * Grouping is derived after rehydration, not stored on delta items.
   * Builds: item.characterId.
   * Teams: always "default".
   */
  getGroupKey: (item: TObject) => string;
};
```

Persisted delta:

```ts
type PresetDelta<TItem> =
  | {
      kind: "preset";
      id: string;
      /** Display ordering within this list. */
      displayIndex?: number;
      /** Preset tombstone. Missing/false means visible. */
      deleted?: true;
    }
  | {
      kind: "custom";
      id: string;
      /** Display ordering within this list. */
      displayIndex?: number;
      /** Custom item content. Custom edits replace this full value in place. */
      value: TItem;
    };
```

Generic resolver:

1. Receive already-loaded `presetItems: readonly TObject[]` from the preset catalog or store orchestration layer.
2. Convert base items to preset records with `getId(item)`.
3. Apply matching preset item deltas.
4. Remove preset records whose delta has `deleted: true`.
5. Add custom item deltas with `value`.
6. Build derived groups with `getGroupKey(resolvedItem)`.
7. Within each group, sort indexed items by `displayIndex`; append unindexed visible items afterward.
8. If no item in a group has `displayIndex`, keep resolver default order for that group.

Invariants:

- `deleted` is the only removal source for preset objects.
- Preset object content is immutable and always comes from preset data.
- `value` on a custom item is the only source for custom object content.
- Custom object content is mutable by whole-value replacement under the same custom id.
- `displayIndex` is only ordering metadata. Missing `displayIndex` never means removal.
- Grouping belongs to the resolver, not persisted state. Persisted data remains one flat delta list.
- Preset deltas cannot carry `value`; custom deltas cannot carry `deleted`.
- Editing a preset item is modeled as remove preset plus create custom.
- Custom in-place edits must preserve the id returned by `getId`. If identity changes, model it as remove old custom plus create new custom and remap any external references in the same transaction.
- The resolver spec lives in code, not user data. Persisted data stores the result of user actions, not arbitrary field-path functions.
- Loading a preset by `presetId` lives outside the generic overlay helper. The helper resolves only `presetItems + delta + spec`.
- The persisted array should be normalized to at most one entry per `(kind, id)` before saving; runtime code may build a temporary index for efficient resolution.
- Duplicate `displayIndex` values are allowed. The resolver sorts within the current list and uses deterministic tie breakers such as preset base index, custom creation id, and object id.
- Duplicate `displayIndex` values across different groups are expected, for example multiple characters can each have a build at index `0`.

This generic type can back:

- character build overlays via one `PresetDelta<Build>[]` grouped by `build.characterId`
- team comp overlays via one `PresetDelta<TeamComp>[]`
- future preset-backed lists; callers can select a static or dynamic base list before invoking the generic resolver

## Team Store Refactor

Current `Team` runtime values are derived from two persisted source structures:

1. `compDeltas: PresetDelta<TeamComp>[]` for preset-eligible composition and global display order.
2. `configsByTeamId: Record<string, TeamSetupConfig>` for user-authored calculation/config state.

`Team` remains the runtime projection consumed by existing Team Comp UI, but it is no longer the durable source shape for cloud backup.

Cache fields are local-only:

- `useTeamResultCacheStore` owns optimizer, investment, weapon choice, and artifact choice latest-result caches keyed by team id.
- `useAnalyzerCacheStore` remains in-memory only for full-option-keyed investment analyzer reuse.
- Both stores are excluded from cloud backup.

Target split:

### 1. Team Comp

Preset-eligible fields:

- team id
- name
- characters
- weapons
- artifact set configs
- reactions

Cloud model:

```ts
type TeamCompCloudPayload = {
  activePresetId: string | null;
  presetRevision?: string;
  compDeltas: PresetDelta<TeamComp>[];
};
```

Team identity:

- Preset teams use stable ids from the preset payload.
- Custom teams should use opaque local ids so their full `value` can be replaced in place.
- Editing a preset team forks it: mark the preset id `deleted` and add a custom team with a full value.
- Editing a custom team replaces the custom entry's full `value` while preserving its id.
- If we intentionally use content-derived ids for an immutable preset source, changing identity fields is a remove plus create operation.

This mirrors the build store: store only the user's difference from the canonical preset.

### 2. Team Setup Config

User-specific fields that should not live in team presets:

- character level overrides
- constellation/refinement/talent overrides
- `opts`
- `calcContext`
- `enemyAura`
- `extraBuffs`
- selected formula
- single reaction / force-on-field
- formula mode
- combo
- `charSettings`
- ER timelines
- analyzer config

Cloud model:

```ts
type TeamSetupConfig = {
  combatOptions: Record<string, string>;
  charConfigs?: Record<string, TeamCharConfig>;
  damage?: TeamDamageConfig;
  energy?: TeamEnergyConfig;
  investment?: TeamInvestmentConfig;
};

type TeamConfigCloudPayload = {
  byTeamId: Record<string, TeamSetupConfig>;
};
```

Config is keyed by team id. If a composition edit creates a new id, the UI can offer to carry over config from the old id.

### 3. Team Cache

Excluded from cloud backup:

- optimizer result / historical `optimizationResult`
- weapon choice result
- artifact choice result
- investment analysis / analyzer results

Current local model:

```ts
type TeamResultCacheEntry = {
  optimizationResult?: OptimizationResult | null;
  investmentResult?: SerializedAnalyzerResult | null;
  weaponChoiceResult?: WeaponChoiceResult | null;
  artifactChoiceResult?: WeaponChoiceResult | null;
};

type TeamResultCacheState = {
  resultsByTeamId: Record<string, TeamResultCacheEntry>;
};
```

- Stored in `useTeamResultCacheStore`.
- localStorage for now, not sessionStorage
- TTL optional
- excluded from cloud
- dependency hashes can be added later if stale restored results become confusing
- a broader in-memory cache keyed by full options can remain as an implementation detail if it is convenient, but it is not required for the cloud-sync refactor

## Freeze Store

Current freeze entries persist ID-only loadouts and derive the blob view from account data:

```ts
type FrozenTeamLoadout = {
  frozenCharIds: string[];
  artifactIdsByChar: Record<string, Partial<Record<Slot, string>>>;
};

type FrozenTeam = FrozenTeamLoadout & {
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
};
```

Cloud decision:

- Store freeze intent as artifact ids and character ids.
- Do not upload full artifact blobs if account data is included in the same backup.
- On restore, resolve freeze ids against restored account artifacts.
- Freeze payloads are account-scoped because artifact ids are account-scoped. Include them in `profile.app/{profileId}`, not a separate global freeze partition.
- The current nested `teamId -> FrozenTeamLoadout` shape is the local durable source. The `artifactsByChar` blob shape is a UI-friendly derived view.
- The cloud shape should be a flat list of frozen character loadouts so reuse-mode logic can be resolved from one uniform collection.
- UI code can derive the current nested view after rehydration if that remains convenient.

Target cloud model:

```ts
type FrozenLoadoutCloudEntry = {
  /** Present for current team-bound freezes; optional for future global character freezes. */
  teamId?: string;
  charId: string;
  artifactIds: Partial<Record<Slot, string>>;
  /** Optional deterministic tie breaker when multiple entries can satisfy force reuse. */
  updatedAt?: number;
};

type FreezeCloudPayload = {
  accountProfileId: AccountProfileId;
  reuseMode: "none" | "sameChar" | "forceReuse";
  standaloneArtifactIds: string[];
  loadouts: FrozenLoadoutCloudEntry[];
};
```

Normalization rules:

- Drop loadouts with no valid artifact ids after resolving against account data.
- Normalize to at most one loadout per `(teamId, charId)`; the later entry, or higher `updatedAt`, wins.
- `reuseMode: "none"` never exposes frozen loadout artifacts to another team.
- `reuseMode: "sameChar"` can use multiple loadouts for the same `charId` across different teams as per-character extra candidates.
- `reuseMode: "forceReuse"` should still store the same flat list. The resolver for a target team picks at most one force-reused loadout per `charId`, after excluding the target team's own loadout and checking the target team's artifact config. If several entries match, choose deterministically by `updatedAt` then array order.
- Do not destructively collapse all same-`charId` loadouts at save time, because whether a loadout is eligible for force reuse depends on the target team's config.

## Tier Lists

Tier stores are good cloud candidates:

- character tier lists, with account-linked and unattached instances
- weapon tier lists, no account-profile linkage
- artifact tier lists, no account-profile linkage

They are user-authored and small. Character, weapon, and artifact tier-list stores are already multi-instance locally. V1 stores them together as `tiers/all` to keep API calls and D1 rows low; a later schema can split high-churn tier data if measured conflicts justify it.

Tier cloud partition:

- Use namespace `tiers` with partition key `all`.
- Keep account-linked and unattached character tier lists in the payload.
- Keep weapon and artifact tier lists in the same payload.
- Enforce at most one linked character tier list per account profile during restore. If cloud has duplicates, keep the newest and convert the rest to unattached lists.
- Store `linkedAccountProfileId?: number` in the payload so the UI can preserve the current account-switch behavior.

## Settings Stores

Upload:

- artifact score settings, inside `builds/all`
- triage settings, inside `profile.app/{profileId}`
- resource recommendation settings, inside `profile.app/{profileId}`

Account-scoped settings recommendation:

- Move triage settings to `profile.app/{profileId}` in the cloud adapter.
- Move resource recommendation thresholds/filters to `profile.app/{profileId}` in the cloud adapter.
- The local stores already persist settings by account profile id, so the adapter does not need to guess which profile owns singleton settings.
- Keep artifact score global and include it in `builds/all` because it is used by build/recommendation logic.

Optional:

- preferences store if users expect cross-device sort/view behavior.

Do not upload:

- greeting/onboarding state
- session navigation
- archive session state

## Cloud Backup Registry

Add an explicit registry rather than scattering backup logic across stores. The
registry classifies every durable local store, but only source data and selected
settings participate in cloud backup.

```ts
type StoreDataClass =
  | "account"
  | "builds"
  | "teams"
  | "tiers"
  | "local-cache"
  | "session";

type CloudBackupDescriptor<TLocal, TCloud> = {
  id: string;
  localStorageKey?: string;
  class: StoreDataClass;
  /**
   * True only for source data and settings that should appear in the backup
   * cloud backup set. Local caches and session state must stay false.
   */
  includeInBackup: boolean;
  namespace?: string;
  currentVersion: number;
  getLocalState: () => TLocal;
  toCloud: (local: TLocal) => TCloud;
  fromCloud: (cloud: TCloud) => TLocal;
  /**
   * Hash of the canonical cloud payload, used to skip unchanged uploads and
   * verify restore integrity. This is not a conflict-control mechanism.
   */
  getContentHash: (cloud: TCloud) => string;
};
```

Suggested location:

- `src/cloud/registry.ts`
- `src/cloud/adapters/accountAdapter.ts`
- `src/cloud/adapters/buildsAdapter.ts`
- `src/cloud/adapters/teamAdapter.ts`
- `src/cloud/adapters/tierAdapter.ts`
- `src/cloud/storeAdapters.ts` as the only cloud file that imports Zustand stores

The registry should be the only frontend code that decides whether a store participates in cloud backup. Local-cache and session descriptors are still useful because tests can assert they are excluded from the default backup set.

Use dependency hashes only for derived results:

- Source/settings payloads use `contentHash` plus `baseRev` for sync.
- Local caches may store a `dependencyHash` such as account hash + build hash + scoring-engine version to know when to ignore stale cache.
- `dependencyHash` is not a substitute for optimistic concurrency, and should not decide whether a source payload can overwrite cloud.
- `baseRev` lives in local sync metadata keyed by namespace/partition, not inside each Zustand store. Store code stays focused on local state; cloud adapters and the sync client own revisions.
- The domain class controls default conflict behavior. Game profile imports can use an explicit profile-import-wins upload path for that profile; builds, teams, and tiers use conservative revision checks.

## Upload Triggers

Avoid uploading on every store mutation. Instead:

- Account data: upload after import, scanner sync, manual account edit save, artifact manager apply.
- Builds: debounce after build edit or preset subscribe changes.
- Teams: debounce after team comp/config changes.
- Profile app settings: debounce with the `profile.app/{profileId}` payload.
- Tier lists: debounce after edit.

Use a dirty queue:

```ts
type PendingCloudUpload = {
  namespace: string;
  partition: string;
  reason: "import" | "manual-edit" | "settings" | "restore" | "debounced";
  dirtyAt: number;
  nextAttemptAt?: number;
  attemptCount?: number;
  lastError?: string;
};
```

Flush rules:

- Manual "Sync now" flushes immediately.
- Background flush waits for idle or 10-30 seconds after the last edit.
- Large account imports should upload once after the import completes.
- Upload dirty partitions separately in V1, but start from coarse partitions to keep API calls and D1 rows low. A game profile import can enqueue `profile.app/{profileId}`, `profile.game/{profileId}`, and `profile.artifacts/{profileId}`.
- Offline or failed uploads stay queued with exponential backoff.
- Do not rely on `sendBeacon` or `fetch(..., { keepalive: true })` for cloud backup payloads. Those are appropriate for telemetry, not multi-MB compressed backup bodies.
- Same-browser concurrent editing is not a primary concern. A lightweight localStorage/BroadcastChannel signal is enough to avoid duplicate background flushes; do not build a heavy local leader-election system for v1.
- Before a flush, read the cloud index/head metadata and compare it with local sync metadata. If both local and cloud changed, apply the domain policy: an explicit game profile import can overwrite that profile, while builds/teams/tiers should mark the partition conflicted.
- Avoid repeated conflict prompts. Passive detection should update sync status; user-facing choices should appear only from explicit sync/restore actions or before a destructive overwrite.
- Surface conflicts under the account icon dropdown as a persistent sync status. Clicking it opens a resolver where the user picks local or cloud per affected domain/partition.
- The top-right account icon replaces the current overflow icon and becomes the stable home for login state, sync state, pending errors, conflict resolution, restore/download, and cloud-data deletion.

Account menu status model:

```ts
type CloudSyncStatus =
  | { state: "signed-out" }
  | { state: "disabled"; reason: "no-entitlement" | "not-configured" }
  | { state: "idle"; lastSyncedAt?: number }
  | { state: "queued"; count: number }
  | { state: "syncing"; count: number }
  | { state: "retrying"; count: number; nextAttemptAt: number; lastError: string }
  | { state: "conflict"; count: number }
  | { state: "offline"; count: number }
  | { state: "error"; count: number; lastError: string };
```

Only `conflict`, `disabled`, and repeated `error` states should require user action. `queued`, `syncing`, `retrying`, and `offline` are background states.

## Restore Semantics

Initial restore should be conservative:

1. Download cloud index metadata.
2. Show local versus cloud timestamps and data classes.
3. User selects "replace local data".
4. Apply local store hydration/import paths.
5. Recompute excluded derived data.

Do not implement automatic multi-device merge in the first release. It creates hard conflicts for account inventory, team edits, and build edits. Use optimistic revision checks and ask the user to choose local or cloud when a conflict occurs.

For a better default user experience, use a backup-style conflict model rather than a collaborative-editor model:

- Same browser, multiple tabs: assume normal user flow edits one tab; only prevent duplicate automatic flushes.
- Same device, offline edits: keep the local dirty payload and retry later.
- Different devices edited independently: detect by `lastSeenRev` versus cloud head and pause sync for affected partitions.
- Partitions are replaced as whole units in v1; do not try field-level merges except for future narrow append-only domains.
- Game profile data imported from GOOD/Scanner/manual import is usually a full current snapshot, so the upload path can intentionally override older cloud data after showing a lightweight "new import will replace cloud backup" status.
- UID imports can remain local merge flows, but cloud backup V1 can upload the resulting full account profile snapshot as an override. We do not need server-side account partition merging in V1.
- Builds, teams, and tiers are hand-authored state, so conflicts should be explicit keep-local/use-cloud decisions.
- Profile app settings live in `profile.app`; artifact score settings live in `builds/all`.

## Refactor Plan

Phase 1: Define boundaries

- Add cloud backup registry and classify all current stores.
- Add tests that excluded stores are not in the default backup set.
- Add a dev tool to print estimated uncompressed/compressed sizes per namespace.

Completed local store migration phase

- Triage and resource recommendation settings are per-account-profile.
- New account profiles clone triage/resource settings from the last active account profile when those settings differ from defaults, and the import flow tells the user.
- Freeze state is account-scoped and ID-only at the durable boundary.
- Local account profile ids use `0` for the default/no-UID profile and UID numbers for UID profiles.
- Profile `0` promotion remaps triage/resource settings, freeze state, character tier-list links, and score cache before activating the UID.
- Account switching updates visible freeze state; backup still includes all account profiles.
- `TeamComp`, `TeamSetupConfig`, and local-only team result cache concepts are separated.
- Optimizer, investment, weapon choice, and artifact choice results are outside `useTeamStore` source data.
- `useAnalyzerCacheStore` is an in-memory full-options analyzer cache only.
- Character, weapon, and artifact tier-list stores are multi-instance.
- Old-store hydration and migration tests cover the changed store shapes.

Phase 3: Cloud adapters

- Convert local `AccountData` to normalized cloud partitions.
- Preserve current import/store code.
- Add round-trip tests: local -> cloud -> local.
- Measure gzip ratio with real account dumps.
- Include freeze, triage, and resource settings in `profile.app`.
- Include artifact score settings in `builds/all`.
- Include character, weapon, and artifact tier lists in `tiers/all`.

Phase 4: Backup Set and UI

- Build local backup-set generation, dirty queue, conflict status, and account-menu resolver.
- Gate upload/restore UI with `cloud_sync`.

Phase 5: Server API

- Add Cloudflare D1 migrations and R2 bucket bindings.
- Build cloud index and upload/restore endpoints.
- Gate upload/restore with `cloud_sync`.
- Keep delete/download available even after entitlement expiry.

## Open Questions

None before V1 implementation. Deferred choices are tracked as V2 notes in the schema/tech-stack docs.
