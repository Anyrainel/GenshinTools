import type { AccountProfileId } from "@/lib/account-data/types";

export type CloudNamespace =
  | "account.profile"
  | "account.characters"
  | "account.weapons"
  | "account.artifacts"
  | "account.equipment"
  | "builds"
  | "team.comp"
  | "team.config"
  | "account.freeze"
  | "tier.character.account"
  | "tier.character.custom"
  | "tier.weapon"
  | "tier.artifact"
  | "settings.artifactScore"
  | "account.triage"
  | "account.resources";

export type StoreDataClass =
  | "account"
  | "builds"
  | "teams"
  | "freeze"
  | "tiers"
  | "settings"
  | "local-cache"
  | "session"
  | "preferences";

export type CloudConflictPolicy =
  | "account-import-wins"
  | "explicit-choice"
  | "latest-writer-wins"
  | "excluded";

export type CloudPartitionKey = string;
export type CloudPartitionId = `${CloudNamespace}/${CloudPartitionKey}`;

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
  payload: TPayload;
};

export type CloudBackupDescriptor = {
  id: string;
  localStorageKey?: string;
  class: StoreDataClass;
  includeInBackup: boolean;
  namespaces: CloudNamespace[];
  currentVersion: number;
  conflictPolicy: CloudConflictPolicy;
};

export type CloudRestorePlan = {
  accounts?: unknown;
  builds?: unknown;
  teams?: unknown;
  freezesByProfileId?: unknown;
  characterTierLists?: unknown;
  weaponTierLists?: unknown;
  artifactTierLists?: unknown;
  artifactScore?: unknown;
  triageByProfileId?: unknown;
  resourcesByProfileId?: unknown;
};

export type AccountScopedPayload = {
  accountProfileId: AccountProfileId;
};

export type CloudAdapter<TSnapshot, TRestorePatch = unknown> = {
  id: string;
  toCloud: (snapshot: TSnapshot) => CloudExportPartition[];
  fromCloud: (partitions: CloudExportPartition[]) => TRestorePatch;
};
