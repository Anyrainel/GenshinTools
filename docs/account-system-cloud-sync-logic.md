# Account System Cloud Sync Logic

This document describes the current cloud backup transform logic and the intended first sync decision model. It is intentionally narrower than the account-system schema docs: this is about preventing mixed versions across multiple devices.

## Current Implementation State

`src/cloud/` currently implements the transform boundary only:

- `src/cloud/registry.ts` lists which local data classes participate in backup.
- `src/cloud/adapters/*Adapter.ts` convert local snapshots into cloud payload partitions and back into local-compatible restore patches.
- `src/cloud/payload.ts` canonicalizes payload JSON, computes `contentHash`, creates `CloudPayloadEnvelope`, verifies payload hashes, and gzip-compresses/decompresses JSON.
- `src/cloud/syncPlanner.ts` compares local partition hashes, local sync metadata, and remote heads to produce upload, download, no-op, conflict, skip, and unsupported-schema decisions.
- `src/stores/useCloudSyncMetadataStore.ts` persists device-local sync metadata and conflict records. It is excluded from cloud backup.
- `src/cloud/storeAdapters.ts` is the only file in `src/cloud/` that imports Zustand stores.

The sync client, server API, dirty queue, and conflict resolver UI are not implemented yet. The decision logic below is implemented as a pure planner, and the local metadata store exists, but nothing calls them from a live API or UI flow yet.

## Three Version Axes

Do not collapse these into one field.

| Axis | Field | Owner | Meaning | Used for |
| --- | --- | --- | --- | --- |
| Local store version | Zustand persist `version` and `src/stores/migration/**` | Local store | Browser-local persisted shape | Hydrating old local data before cloud transforms run |
| Cloud payload schema | `schemaVersion` on each cloud envelope/partition | `src/cloud/adapters/**` | Version of the cloud payload shape for one namespace | Migrating cloud payloads before restore |
| Cloud revision | `rev` and `baseRev` on each cloud envelope | Sync server/client | Server head for one namespace/partition | Multi-device concurrency and conflict detection |

`contentHash` is separate from all three. It verifies payload integrity and skips unchanged uploads, but it is not a conflict-control mechanism.

## Partition Identity

Every cloud object is addressed by:

```ts
namespace + "/" + partitionKey
```

Examples:

- `profile.app/0`
- `profile.game/600000001`
- `profile.artifacts/600000001`
- `builds/all`
- `teams/all`
- `tiers/all`

The sync client must compare revisions per partition, not per store. A device can be current for `teams/all` and conflicted for `builds/all` at the same time.

## Local Sync Metadata Needed

V1 needs a small local metadata record outside the domain stores:

```ts
type LocalCloudPartitionMeta = {
  namespace: CloudNamespace;
  partitionKey: string;
  lastSeenRev?: string;
  lastUploadedHash?: string;
  lastAppliedHash?: string;
  dirty: boolean;
  updatedAt: number;
};
```

This metadata is keyed by `namespace/partitionKey`.

Domain Zustand stores should not own cloud revisions. They only own local app state. The sync layer owns `lastSeenRev`, dirty state, retry state, and conflict state.

The metadata type exists in `src/cloud/types.ts`; the persisted device-local store is `src/stores/useCloudSyncMetadataStore.ts`.

## Envelope Rules

Before upload:

1. Build local partitions with `buildLocalBackupPartitions()`.
2. Canonicalize each partition payload with `canonicalJson()`.
3. Compute `contentHash` from that canonical payload.
4. Wrap it in `CloudPayloadEnvelope`.
5. Set `baseRev` to the local `lastSeenRev` for that partition, if known.
6. Gzip the envelope body before sending.

Before restore:

1. Gunzip the cloud envelope.
2. Verify `app`, `namespace`, `partitionKey`, and `schemaVersion`.
3. Verify `contentHash` against the canonical payload.
4. Migrate cloud payload schema if the app supports the older schema.
5. Build a `CloudRestorePlan`.
6. Apply through existing local store actions/import paths where possible.
7. Update local sync metadata only after local apply succeeds.

If the cloud `schemaVersion` is newer than the app supports, do not restore that partition. The user should upgrade the app or skip that partition.

## Sync Decision Matrix

For each `namespace/partitionKey`, read:

- `localHash`: hash of the current local cloud payload.
- `lastAppliedHash`: hash last downloaded or uploaded successfully on this device.
- `lastSeenRev`: cloud rev this device last accepted for the partition.
- `cloudRev`: current server head rev.
- `cloudHash`: current server head content hash.

| Condition | Meaning | Action |
| --- | --- | --- |
| No local payload, cloud exists | New device or empty local partition | Download cloud if schema is supported |
| Local exists, no cloud head | First upload for this partition | Upload local with no `baseRev` |
| `localHash === cloudHash` | Same content, maybe different device metadata | Mark synced; update `lastSeenRev` |
| `localHash === lastAppliedHash` and `cloudRev !== lastSeenRev` | Local unchanged, cloud changed elsewhere | Download cloud |
| `localHash !== lastAppliedHash` and `cloudRev === lastSeenRev` | Local changed, cloud unchanged since last seen | Upload local with `baseRev = lastSeenRev` |
| `localHash !== lastAppliedHash` and `cloudRev !== lastSeenRev` | Local and cloud both changed independently | Conflict; apply policy below |

The upload request should use optimistic concurrency. If the client sends `baseRev` and the server head is no longer that rev, the server rejects the write and the client re-enters the decision matrix with fresh cloud metadata.

## Conflict Policies

The registry sets the default policy by data class:

| Policy | Current namespaces | Default behavior |
| --- | --- | --- |
| `profile-import-wins` | `profile.app`, `profile.game`, `profile.artifacts` | Only an explicit game profile import/replace action may overwrite cloud for that profile. Passive background sync should still stop on conflict. |
| `explicit-choice` | builds, team, tiers | Ask the user to choose local or cloud for each conflicted partition or domain group. |
| `excluded` | caches, session state, preferences, greeting state, in-memory stores | Never upload or restore. |

Important: `profile-import-wins` is not a blanket background overwrite rule. It means "the user intentionally imported or replaced this game profile, so that import can become the new cloud head after a revision check." If another device changed the same profile meanwhile, the UI should show what will be overwritten before proceeding.

## When To Download From Cloud

Download is safe when:

- The local partition is missing.
- The local partition has not changed since `lastAppliedHash`.
- The cloud payload hash matches local and only metadata differs.
- The user explicitly chooses cloud during conflict resolution.

Download should be blocked or require confirmation when:

- The cloud schema is newer than the app supports.
- The local partition changed since `lastAppliedHash`.
- Applying the restore plan would delete or replace local source data outside the selected partition/domain.

## When To Upload To Cloud

Upload is safe when:

- The local partition changed.
- The cloud head rev still equals `lastSeenRev`.
- The payload schema is current for this app.
- The server accepts the write under optimistic concurrency.

Upload should be skipped when:

- `localHash` equals `lastUploadedHash` or `cloudHash`.
- The descriptor is excluded from backup.
- The payload is derived cache/session state.

Upload should require user intent when:

- The partition is profile source data and the change comes from an explicit import replacing a profile.
- The server rejects the upload because cloud head moved.
- The partition has an `explicit-choice` conflict.

## User Choice Granularity

Conflicts should be grouped for review but applied per partition.

Recommended grouping:

- Profile app data: `profile.app/{profileId}` contains game profile metadata, profile-scoped app settings, freeze state, and other small profile-scoped app data.
- Profile game data: `profile.game/{profileId}` contains character data plus weapon inventory.
- Profile artifact data: `profile.artifacts/{profileId}` contains artifact inventory; equipped character id is local to each artifact item.
- Group `profile.app`, `profile.game`, and `profile.artifacts` by profile id in conflict UI because they are related.
- Builds: `builds/all`, including artifact score global settings.
- Team data: `teams/all`.
- Tier data: `tiers/all`.

This keeps the UI understandable while preserving per-partition revision checks.

## Open Implementation Gaps

These are not implemented in `src/cloud/` yet:

- Server-side partition index/head API.
- Optimistic concurrency checks.
- Dirty queue and retry state.
- Conflict resolver UI.
- Cloud payload migrations beyond V1.
- Apply step that commits `CloudRestorePlan` through store actions.

Until those exist, `src/cloud/` can plan conflict-safe sync actions, but it does not yet execute them against the cloud or apply restore patches into live stores.
