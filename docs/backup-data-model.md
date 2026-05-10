# Backup Data Model

Last updated: 2026-05-10.

This document is the source of truth for cloud backup data schemas, browser storage scope, partition modeling, and restore boundaries. Auth, API behavior, and operational setup live in `docs/account-system.md`.

## Model Summary

Cloud backup is a per-user, domain-agnostic, latest-only key-value backup service:

- D1 stores users, provider identities, entitlements, current backup heads, device rows, and latest commit retry metadata.
- R2 stores compressed backup object bodies referenced by current heads.
- Browser-local Zustand stores remain the source of truth for app data.
- Cloud adapters convert selected local state into stable backup partitions.
- The Worker does not parse backup payload bodies.

Important terms:

| Term | Meaning |
| --- | --- |
| `namespace` | Logical cloud domain such as `profile.game`, `builds`, or `teams`. |
| `partitionKey` | Opaque logical backup key within a namespace, such as `600000001` or `all`. |
| `CloudPartitionId` | `${namespace}/${partitionKey}`. |
| `head` | Current published object pointer for one partition. |
| `objectId` | Server-generated id for one immutable R2 object. |
| `rev` | Server-generated per-partition concurrency token. |
| `headSetRev` | Server-generated token for the authenticated user's full current head set. |
| `contentHash` | SHA-256 hash of canonical uncompressed payload JSON. |
| `compressedHash` | SHA-256 hash of compressed object bytes. |
| `idempotencyKey` | Client-generated retry key for one commit. |

## Version Axes

Do not collapse these fields.

| Axis | Field | Owner | Purpose |
| --- | --- | --- | --- |
| Local store version | Zustand `persist.version` and `src/stores/migration/**` | Local store | Hydrates old browser-local shapes before cloud export. |
| Cloud payload schema | `schemaVersion` on `CloudExportPartition` and envelope | Cloud adapter | Migrates backed-up payloads during restore. |
| Cloud revision | Worker `rev`, `headSetRev`, and commit `writeMode` | Worker/sync client | Controls multi-device concurrency. |

`contentHash` verifies payload identity and skips unchanged uploads. It is not a concurrency token.

## Browser Storage Scope

Backup scope is defined by `src/cloud/registry.ts` plus the snapshots assembled in `src/cloud/storeAdapters.ts`.

### Included Source Data

| Cloud descriptor | Browser storage keys | Cloud namespaces | Contents |
| --- | --- | --- | --- |
| `account` | `genshin-account-storage`, `frozen-teams-storage`, `triage-settings`, `resource-rec-settings`, `recommendation-settings` | `profile.app`, `profile.game`, `profile.artifacts` | Account profiles, imported characters/weapons/artifacts, active profile, freeze state, triage/resource/recommendation settings by profile. |
| `builds` | `artifact-filter-builds`, `artifact-score-storage` | `builds` | Artifact build deltas, active preset selection, character weapon filters, compute options, artifact score global settings, author/description. |
| `teams` | `team-builder-storage` | `teams` | Team comp deltas, team configs, active preset selection, author/description. |
| `tiers` | `tierlist-storage`, `weapon-tierlist-storage`, `artifact-tierlist-storage` | `tiers` | Character, weapon, and artifact tier-list instances. |

The adapters are not raw localStorage dumps. They export normalized cloud payloads and restore through store-owned APIs where possible.

### Excluded Local Storage

These localStorage values are intentionally not backed up:

| Key or class | Reason |
| --- | --- |
| `account-score-cache-storage` | Derived recommendation score cache; recomputable from account/build data. |
| `team-result-cache` | Derived team calculation result cache; recomputable from team source data. |
| `preferences-storage` | Device/browser UI preferences, not account backup data. |
| `cloud-sync-metadata-storage` | Device-local sync state: device id, last seen revisions, accepted hashes. Backing this up would corrupt multi-device conflict semantics. |
| `greeting-storage` | One-browser onboarding/session state. |
| `app_theme` | Device/browser display preference. |
| `app_language` | Device/browser display preference. |
| `enable-beta` | Local beta-content toggle. |
| `score-v1-300-announced` | Local announcement dismissal flag. |
| `gg_last_local_uid` | Import form convenience value. |
| `gg_hoyolab_region` | Import form convenience value. |
| `gg_hoyolab_os_ltuid`, `gg_hoyolab_os_ltoken`, `gg_hoyolab_cn_account_id`, `gg_hoyolab_cn_cookie_token` | HoYoLAB credential/cookie inputs. These must not be copied into cloud backup. |
| analyzer/recommendation/pupgrade caches | In-memory or derived local caches; recomputable. |
| buff overrides | Session-only calculator state. |

If a future setting should follow the user across devices, add it to an included domain store and adapter explicitly. Do not add broad localStorage mirroring.

### Excluded Session Storage

These sessionStorage values are intentionally not backed up:

| Key or class | Reason |
| --- | --- |
| `session-nav-storage` | Per-tab Team Comp active row, filters, sort, and expanded state. |
| `archive-session-storage` | Per-tab Archive search and selected entity state. |
| `dmgCard.*` | Per-tab Damage card UI state. |
| `cloud_backup_metadata:<user>` | Manual backup display cache for cloud head metadata. It is refreshed from the Worker and is not a source of truth. |

Session storage resets with browser tab/session lifetime by design.

## Cloud Partitions

V1 partition keys are coarse to reduce D1 writes and Worker request count.

| Namespace/key | Contents | Conflict policy |
| --- | --- | --- |
| `profile.app/{profileId}` | Profile name, UID, active profile marker, last import time, freeze state, triage settings, resource settings, recommendation settings. | `profile-import-wins` |
| `profile.game/{profileId}` | Characters and weapons for one account profile. Weapon equipment is local to weapon entries. | `profile-import-wins` |
| `profile.artifacts/{profileId}` | Artifacts for one account profile. Artifact equipment is local to artifact entries. | `profile-import-wins` |
| `builds/all` | Artifact build source data and artifact score settings. | `explicit-choice` |
| `teams/all` | Team source data and team configs. | `explicit-choice` |
| `tiers/all` | Character, weapon, and artifact tier-list instances. | `explicit-choice` |

`profile-import-wins` does not mean silent background overwrite. It means an explicit profile import/replace action may overwrite cloud after the user chooses it. Manual backup still shows conflicts when local and cloud both changed.

## Payload Envelope

Before upload, each adapter produces a `CloudExportPartition`:

```ts
type CloudExportPartition<TPayload = unknown> = {
  namespace: CloudNamespace;
  partitionKey: string;
  schemaVersion: number;
  conflictPolicy: CloudConflictPolicy;
  isDefaultState?: boolean;
  metadata?: CloudBackupHeadMetadata;
  payload: TPayload;
};
```

The sync client wraps it before compression:

```ts
type CloudPayloadEnvelope<TPayload> = {
  app: "GenshinTools";
  schemaVersion: number;
  namespace: CloudNamespace;
  partitionKey: string;
  rev: string;
  baseRev?: string;
  createdAt: number;
  sourceDeviceId?: string;
  contentHash: string;
  payload: TPayload;
};
```

Upload verification:

1. Canonicalize payload JSON.
2. Compute `contentHash`.
3. Wrap in `CloudPayloadEnvelope`.
4. Gzip the envelope.
5. Send compressed bytes and hashes to the Worker.

Restore verification:

1. Download current object by `objectId`.
2. Gunzip the envelope.
3. Verify app, namespace, partition key, schema version, and `contentHash`.
4. Reject newer unsupported schemas.
5. Build a `CloudRestorePlan`.
6. Apply through `src/cloud/storeAdapters.ts`.
7. Mark local sync metadata only after local apply succeeds.

## Head Metadata

Each current head stores small user-visible metadata so the backup page can show counts and timestamps without downloading R2 objects:

```ts
type CloudBackupHeadMetadata = {
  schemaVersion: 1;
  records: {
    kind:
      | "characters"
      | "weapons"
      | "artifacts"
      | "frozen"
      | "settings"
      | "builds"
      | "teams"
      | "teamConfigs"
      | "tiers";
    count: number;
    profileId?: string;
    updatedAt?: number;
  }[];
};
```

Profile-owned rows keep `profileId` so the UI can display rows such as `Characters (600000001)` and `Weapons (default account)`. A present zero-count partition is different from no known cloud/local record: `hasRecord: true, count: 0` means the partition was backed up and currently has no user-visible entries, while `hasRecord: false` means there is no current local/cloud record.

## D1 Auth Tables

Current auth/account migration:

```sql
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  disabled_at INTEGER
);

CREATE TABLE IF NOT EXISTS auth_identities (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS user_entitlements (
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  source TEXT,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,
  PRIMARY KEY(user_id, code)
);
```

V1 grants `cloud_sync` in code to every authenticated Logto user. The entitlement table remains available for a future paid/limited access policy.

## D1 Backup Tables

Current backup migration:

```sql
CREATE TABLE IF NOT EXISTS backup_user_state (
  user_id TEXT PRIMARY KEY,
  head_set_rev TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  key_count INTEGER NOT NULL DEFAULT 0,
  total_compressed_bytes INTEGER NOT NULL DEFAULT 0,
  upload_period_utc TEXT,
  monthly_upload_count INTEGER NOT NULL DEFAULT 0,
  monthly_put_object_count INTEGER NOT NULL DEFAULT 0,
  monthly_uploaded_compressed_bytes INTEGER NOT NULL DEFAULT 0,
  last_upload_at INTEGER
);

CREATE TABLE IF NOT EXISTS backup_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_backup_at INTEGER,
  UNIQUE(user_id, device_id)
);

CREATE TABLE IF NOT EXISTS backup_heads (
  user_id TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  object_id TEXT NOT NULL,
  rev TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  compressed_hash TEXT NOT NULL,
  compressed_bytes INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  source_device_row_id TEXT REFERENCES backup_devices(id) ON DELETE SET NULL,
  soft_deleted_at INTEGER,
  PRIMARY KEY(user_id, partition_key)
);

CREATE TABLE IF NOT EXISTS backup_commits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_row_id TEXT REFERENCES backup_devices(id) ON DELETE SET NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(user_id, idempotency_key)
);
```

`backup_user_state` is the per-user aggregate row. It stores the current `headSetRev`, current live backup size/count totals, and the current upload quota period. When `upload_period_utc` differs from the current UTC month, the Worker treats the monthly counters as zero and resets them on the next successful commit.

`backup_heads` is current-state metadata, not backup history. Normal delete commits remove the row for the deleted partition; `soft_deleted_at` remains in the schema only for legacy rows and is pruned by Worker cleanup.

`backup_commits` is a short retry ledger, not a staging table or history table. The Worker keeps only the latest successful commit response per user. If the client retries that same latest `idempotencyKey`, the Worker returns the original result. Older commit rows are pruned by commit handling and scheduled cleanup.

## R2 Object Layout

R2 stores compressed immutable backup bodies:

```text
users/{encodeURIComponent(userId)}/backup/objects/{objectId}.json.gz
```

`userId` is the internal app user id, for example:

```text
usr_logto_<32 hex chars>
```

The Worker authorizes object downloads through current `backup_heads` rows. A stale object id that is no longer a current head is rejected after the client refreshes `/head`.

R2 is latest-only. Successful commits delete superseded objects immediately when possible, and the scheduled Worker cleanup lists backup object keys and deletes any object id that is not referenced by an active `backup_heads` row. The scheduled path keeps a short age grace for unreferenced objects to avoid racing an in-flight commit between its R2 write and D1 batch. R2 is not an undo log or progression-history store.

## Sync Metadata

Device-local sync metadata is persisted in `cloud-sync-metadata-storage` but excluded from cloud backup:

```ts
type LocalCloudPartitionMeta = {
  namespace: CloudNamespace;
  partitionKey: string;
  lastSeenRev?: string;
  lastAppliedHash?: string;
  lastUploadedHash?: string;
  lastSyncedAt?: number;
  dirty?: boolean;
  updatedAt: number;
};
```

This data is per browser profile/device. It must not roam through cloud backup because it describes what this browser last accepted from the server.

Conflict details are transient run output. The persisted sync metadata store deliberately partializes only `deviceId` and `partitionsById`.

## Decision Model

For each partition, the sync planner compares:

- local payload hash
- local `lastAppliedHash`
- local `lastSeenRev`
- remote head `rev`
- remote head `contentHash`

Default decisions:

| Condition | Action |
| --- | --- |
| Local payload missing, cloud exists | Download cloud if schema is supported. |
| Local exists, no cloud head | Upload local with `ifAbsent`. |
| Local hash equals cloud hash | Mark synced/no-op. |
| Local unchanged since last apply and cloud changed | Download cloud. |
| Local changed and cloud rev still equals last seen rev | Upload local with `ifMatch`. |
| Local changed and cloud also changed | Report conflict; require explicit choice. |

Fresh devices initialize local stores with defaults. Partitions can mark default state as `isDefaultState`; if cloud exists and local is only default state, the planner should download instead of reporting a first-sync conflict. Default-state partitions are still uploaded when cloud has no head, so a brand-new backup publishes empty heads consistently and metadata can show `0` instead of "No record".

## Adding A Backed-Up Domain

To add a new backup domain:

1. Add or update a descriptor in `src/cloud/registry.ts`.
2. Add a cloud adapter in `src/cloud/adapters/**`.
3. Include it in `src/cloud/storeAdapters.ts`.
4. Keep partition keys stable and path-safe.
5. Add round-trip tests and sync-planner/restore tests for the new partition.
6. Update this document with included/excluded storage scope.

Do not make cloud payloads depend on raw persisted localStorage JSON. Use adapter-owned payloads and store-owned restore paths.
