# Account System Cloud Sync Logic

This document describes the current cloud backup transform logic and the intended first sync decision model. It is intentionally narrower than the account-system schema docs: this is about preventing mixed versions across multiple devices.

## Current Implementation State

`src/cloud/` currently implements the local transform and planning boundary:

- `src/cloud/registry.ts` lists which local data classes participate in backup.
- `src/cloud/adapters/*Adapter.ts` convert local snapshots into cloud payload partitions and back into local-compatible restore patches.
- `src/cloud/payload.ts` canonicalizes payload JSON, computes `contentHash`, creates `CloudPayloadEnvelope`, verifies payload hashes, and gzip-compresses/decompresses JSON.
- `src/cloud/syncPlanner.ts` compares local partition hashes, local sync metadata, and remote heads to produce upload, download, no-op, conflict, skip, and unsupported-schema decisions.
- `src/stores/useCloudSyncMetadataStore.ts` persists device-local sync metadata and conflict records. It is excluded from cloud backup.
- `src/cloud/storeAdapters.ts` is the only file in `src/cloud/` that imports Zustand stores.
- `src/cloud/apiClient.ts` is a typed frontend client for `/api/backup/v1`.
- `src/cloud/syncClient.ts` is a headless, dev-gated coordinator that reads Worker heads, builds local partitions, runs `planCloudSync()`, commits safe uploads, marks no-op/upload metadata, records conflicts, downloads selected backup objects, verifies downloaded envelopes, builds restore plans, applies downloaded restore plans, and marks download metadata only after local apply succeeds. It also supports `explicitLocalOverwrite` for already-confirmed local-wins actions such as replacing cloud profile partitions after an import.
- `src/cloud/storeAdapters.ts` applies restore-plan sections through store-owned APIs so build/team derived runtime views and score caches refresh correctly.
- `tests/cloud/syncClientFlows.test.ts` covers stateful multi-device flows: unchanged second-device sync, independent manual-edit conflict, explicit imported-profile overwrite, grouped profile downloads, verified download restore planning, post-apply metadata marking, and corrupt downloaded object rejection.

The dev-gated Worker backup API is implemented under `/api/backup/v1` and covered by worker tests plus the local `npm run smoke:backup-worker` path. `worker/auth.ts` owns the `requireUser()` and entitlement boundary, but its current implementation is still dev-only and resolves users from `BACKUP_DEV_AUTH_SECRET` plus `x-backup-dev-user-id`.

In local dev builds, the avatar account menu is wired in `src/components/layout/AppBar.tsx`. It links to `/account` for backup test credentials and `/account/cloud-backup` for the manual cloud backup surface. Production builds keep the generic overflow menu and do not expose account or cloud backup entry points until production auth is ready. No passive background sync is wired.

## Three Version Axes

Do not collapse these into one field.

| Axis | Field | Owner | Meaning | Used for |
| --- | --- | --- | --- | --- |
| Local store version | Zustand persist `version` and `src/stores/migration/**` | Local store | Browser-local persisted shape | Hydrating old local data before cloud transforms run |
| Cloud payload schema | `schemaVersion` on each cloud envelope/partition | `src/cloud/adapters/**` | Version of the cloud payload shape for one namespace | Migrating cloud payloads before restore |
| Cloud revision | Server head `rev`, commit `writeMode`, and local `lastSeenRev` | Sync server/client | Server head for one namespace/partition | Multi-device concurrency and conflict detection |

`contentHash` is separate from all three. It verifies payload integrity and skips unchanged uploads, but it is not a conflict-control mechanism.

The R2 payload envelope may include upload-time self-description such as `rev` and `baseRev`, but D1/Worker head metadata is authoritative for concurrency. The server generates the published head `rev` during commit; restore verification must compare namespace, partition key, schema version, `contentHash`, and compressed object hash, not require the envelope's upload-time `rev` to equal the server head `rev`.

Fresh devices still initialize app stores with default local data. Export partitions can mark that default state as `isEmpty`; if a first sync sees remote cloud data and only default local state, the planner downloads cloud data instead of reporting a first-sync conflict. Real divergent local data without sync history still reports `first-sync-local-and-cloud`.

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

These are not implemented yet:

- Dirty queue and retry state.
- Full conflict resolver UI for choosing cloud per conflict.
- Cloud payload migrations beyond V1.
- Production SSO/session auth behind `worker/auth.ts`.
- Durable entitlement storage and public backup access.

The server-side head/commit/object API and optimistic concurrency checks exist in the Worker. The manual cloud backup page calls the frontend coordinator for safe upload, explicit local overwrite, no-op, and download/apply decisions. Use `applyCloudRestoreAndMarkSynced()` for any restore UI code so sync metadata advances only after the local store apply step succeeds.
