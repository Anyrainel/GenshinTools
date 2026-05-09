import type { AccountProfileId } from "@/lib/account-data/types";

export type CloudNamespace =
  | "profile.app"
  | "profile.game"
  | "profile.artifacts"
  | "builds"
  | "teams"
  | "tiers";

export type StoreDataClass =
  | "account"
  | "builds"
  | "teams"
  | "tiers"
  | "local-cache"
  | "session"
  | "preferences"
  | "sync-metadata";

export type CloudConflictPolicy =
  | "profile-import-wins"
  | "explicit-choice"
  | "excluded";

export type CloudPartitionKey = string;
export type CloudPartitionId = `${CloudNamespace}/${CloudPartitionKey}`;

export type CloudBackupRecordKind =
  | "characters"
  | "weapons"
  | "artifacts"
  | "frozen"
  | "settings"
  | "builds"
  | "teams"
  | "teamConfigs"
  | "tiers";

export type CloudBackupHeadMetadataRecord = {
  kind: CloudBackupRecordKind;
  count: number;
  profileId?: string;
  updatedAt?: number;
};

export type CloudBackupHeadMetadata = {
  schemaVersion: 1;
  records: CloudBackupHeadMetadataRecord[];
};

export type CloudPayloadEnvelope<TPayload> = {
  app: "GenshinTools";
  schemaVersion: number;
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  rev: string;
  baseRev?: string;
  createdAt: number;
  sourceDeviceId?: string;
  contentHash: string;
  payload: TPayload;
};

export type CloudRemoteHead = {
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  rev: string;
  schemaVersion: number;
  contentHash: string;
  updatedAt: number;
  sourceDeviceId?: string;
  deletedAt?: number;
  batchId?: string;
};

export type CloudLocalPartitionState = {
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  schemaVersion: number;
  contentHash: string;
  conflictPolicy?: CloudConflictPolicy;
  isDefaultState?: boolean;
  updatedAt?: number;
};

export type LocalCloudPartitionMeta = {
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  lastSeenRev?: string;
  lastAppliedHash?: string;
  lastUploadedHash?: string;
  lastSyncedAt?: number;
  dirty?: boolean;
  updatedAt: number;
};

export type CloudExportPartition<TPayload = unknown> = {
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  schemaVersion: number;
  conflictPolicy: CloudConflictPolicy;
  isDefaultState?: boolean;
  metadata?: CloudBackupHeadMetadata;
  payload: TPayload;
};

export type CloudBackupDescriptor = {
  id: string;
  localStorageKey?: string;
  localStorageKeys?: string[];
  class: StoreDataClass;
  includeInBackup: boolean;
  namespaces: CloudNamespace[];
  currentVersion: number;
  conflictPolicy: CloudConflictPolicy;
};

export type CloudRestorePlan = {
  accounts?: unknown;
  activeAccountId?: AccountProfileId | null;
  accountShardPresenceByProfileId?: unknown;
  builds?: unknown;
  teams?: unknown;
  freezesByProfileId?: unknown;
  characterTierLists?: unknown;
  weaponTierLists?: unknown;
  artifactTierLists?: unknown;
  artifactScore?: unknown;
  triageByProfileId?: unknown;
  resourcesByProfileId?: unknown;
  recommendationsByProfileId?: unknown;
};

export type AccountScopedPayload = {
  accountProfileId: AccountProfileId;
};

export type CloudAdapter<TSnapshot, TRestorePatch = unknown> = {
  id: string;
  toCloud: (snapshot: TSnapshot) => CloudExportPartition[];
  fromCloud: (partitions: CloudExportPartition[]) => TRestorePatch;
};
