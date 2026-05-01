import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CloudConflictPolicy,
  CloudNamespace,
  CloudPartitionId,
  CloudPartitionKey,
  LocalCloudPartitionMeta,
} from "@/cloud/types";
import { PersistedCloudSyncMetadataStoreSchema } from "./schemas";

export type CloudSyncPartitionMeta = LocalCloudPartitionMeta & {
  id: CloudPartitionId;
};

export type CloudSyncConflictMeta = {
  id: CloudPartitionId;
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  groupKey: string;
  conflictPolicy: CloudConflictPolicy;
  reason: string;
  detectedAt: number;
  localHash?: string;
  remoteHash?: string;
  localUpdatedAt?: number;
  remoteUpdatedAt?: number;
  remoteRev?: string;
};

export type MarkCloudPartitionSyncedInput = {
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  rev: string;
  contentHash: string;
  syncedAt?: number;
};

export type MarkCloudPartitionDirtyInput = {
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  updatedAt?: number;
};

export type CloudSyncMetadataState = {
  deviceId: string;
  partitionsById: Record<CloudPartitionId, CloudSyncPartitionMeta>;
  conflictsById: Record<CloudPartitionId, CloudSyncConflictMeta>;
  ensureDeviceId: () => string;
  getPartitionMeta: (
    namespace: CloudNamespace,
    partitionKey: CloudPartitionKey
  ) => CloudSyncPartitionMeta | undefined;
  getAllPartitionMeta: () => CloudSyncPartitionMeta[];
  markPartitionDirty: (input: MarkCloudPartitionDirtyInput) => void;
  markPartitionSyncedFromUpload: (input: MarkCloudPartitionSyncedInput) => void;
  markPartitionSyncedFromDownload: (
    input: MarkCloudPartitionSyncedInput
  ) => void;
  markPartitionSyncedWithoutTransfer: (
    input: MarkCloudPartitionSyncedInput
  ) => void;
  markConflict: (conflict: CloudSyncConflictMeta) => void;
  clearConflict: (
    namespace: CloudNamespace,
    partitionKey: CloudPartitionKey
  ) => void;
  removePartitionMeta: (
    namespace: CloudNamespace,
    partitionKey: CloudPartitionKey
  ) => void;
  clearSyncMetadata: () => void;
  resetDeviceId: (deviceId?: string) => void;
};

export const CLOUD_SYNC_METADATA_STORAGE_KEY = "cloud-sync-metadata-storage";

export function getCloudSyncPartitionId(
  namespace: CloudNamespace,
  partitionKey: CloudPartitionKey
): CloudPartitionId {
  return `${namespace}/${partitionKey}` as CloudPartitionId;
}

export function createCloudDeviceId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `device-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function emptyPersistedState() {
  return {
    deviceId: createCloudDeviceId(),
    partitionsById: {},
    conflictsById: {},
  };
}

function normalizePartitionMeta(
  id: string,
  meta: {
    namespace: string;
    partitionKey: string;
    lastSeenRev?: string;
    lastAppliedHash?: string;
    lastUploadedHash?: string;
    lastSyncedAt?: number;
    dirty?: boolean;
    updatedAt: number;
  }
): CloudSyncPartitionMeta {
  return {
    id: id as CloudPartitionId,
    namespace: meta.namespace as CloudNamespace,
    partitionKey: meta.partitionKey,
    ...(meta.lastSeenRev ? { lastSeenRev: meta.lastSeenRev } : {}),
    ...(meta.lastAppliedHash ? { lastAppliedHash: meta.lastAppliedHash } : {}),
    ...(meta.lastUploadedHash
      ? { lastUploadedHash: meta.lastUploadedHash }
      : {}),
    ...(meta.lastSyncedAt != null ? { lastSyncedAt: meta.lastSyncedAt } : {}),
    ...(meta.dirty != null ? { dirty: meta.dirty } : {}),
    updatedAt: meta.updatedAt,
  };
}

function upsertPartitionMeta(
  partitionsById: Record<CloudPartitionId, CloudSyncPartitionMeta>,
  meta: CloudSyncPartitionMeta
) {
  return {
    ...partitionsById,
    [meta.id]: meta,
  };
}

function removeConflict(
  conflictsById: Record<CloudPartitionId, CloudSyncConflictMeta>,
  id: CloudPartitionId
) {
  const next = { ...conflictsById };
  delete next[id];
  return next;
}

function markSynced(
  state: CloudSyncMetadataState,
  input: MarkCloudPartitionSyncedInput,
  source: "upload" | "download" | "none"
) {
  const id = getCloudSyncPartitionId(input.namespace, input.partitionKey);
  const previous = state.partitionsById[id];
  const syncedAt = input.syncedAt ?? Date.now();
  const meta: CloudSyncPartitionMeta = {
    id,
    namespace: input.namespace,
    partitionKey: input.partitionKey,
    lastSeenRev: input.rev,
    lastAppliedHash: input.contentHash,
    ...(source === "upload"
      ? { lastUploadedHash: input.contentHash }
      : previous?.lastUploadedHash
        ? { lastUploadedHash: previous.lastUploadedHash }
        : {}),
    lastSyncedAt: syncedAt,
    dirty: false,
    updatedAt: syncedAt,
  };
  return {
    partitionsById: upsertPartitionMeta(state.partitionsById, meta),
    conflictsById: removeConflict(state.conflictsById, id),
  };
}

export const useCloudSyncMetadataStore = create<CloudSyncMetadataState>()(
  persist(
    (set, get) => ({
      ...emptyPersistedState(),

      ensureDeviceId: () => {
        const current = get().deviceId;
        if (current) return current;
        const deviceId = createCloudDeviceId();
        set({ deviceId });
        return deviceId;
      },

      getPartitionMeta: (namespace, partitionKey) =>
        get().partitionsById[getCloudSyncPartitionId(namespace, partitionKey)],

      getAllPartitionMeta: () => Object.values(get().partitionsById),

      markPartitionDirty: ({ namespace, partitionKey, updatedAt }) =>
        set((state) => {
          const id = getCloudSyncPartitionId(namespace, partitionKey);
          const previous = state.partitionsById[id];
          const timestamp = updatedAt ?? Date.now();
          return {
            partitionsById: upsertPartitionMeta(state.partitionsById, {
              id,
              namespace,
              partitionKey,
              ...(previous?.lastSeenRev
                ? { lastSeenRev: previous.lastSeenRev }
                : {}),
              ...(previous?.lastAppliedHash
                ? { lastAppliedHash: previous.lastAppliedHash }
                : {}),
              ...(previous?.lastUploadedHash
                ? { lastUploadedHash: previous.lastUploadedHash }
                : {}),
              ...(previous?.lastSyncedAt != null
                ? { lastSyncedAt: previous.lastSyncedAt }
                : {}),
              dirty: true,
              updatedAt: timestamp,
            }),
          };
        }),

      markPartitionSyncedFromUpload: (input) =>
        set((state) => markSynced(state, input, "upload")),

      markPartitionSyncedFromDownload: (input) =>
        set((state) => markSynced(state, input, "download")),

      markPartitionSyncedWithoutTransfer: (input) =>
        set((state) => markSynced(state, input, "none")),

      markConflict: (conflict) =>
        set((state) => ({
          conflictsById: {
            ...state.conflictsById,
            [conflict.id]: conflict,
          },
        })),

      clearConflict: (namespace, partitionKey) =>
        set((state) => ({
          conflictsById: removeConflict(
            state.conflictsById,
            getCloudSyncPartitionId(namespace, partitionKey)
          ),
        })),

      removePartitionMeta: (namespace, partitionKey) =>
        set((state) => {
          const id = getCloudSyncPartitionId(namespace, partitionKey);
          const partitionsById = { ...state.partitionsById };
          delete partitionsById[id];
          return {
            partitionsById,
            conflictsById: removeConflict(state.conflictsById, id),
          };
        }),

      clearSyncMetadata: () =>
        set({
          partitionsById: {},
          conflictsById: {},
        }),

      resetDeviceId: (deviceId) =>
        set({
          deviceId: deviceId ?? createCloudDeviceId(),
        }),
    }),
    {
      name: CLOUD_SYNC_METADATA_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        deviceId: state.deviceId,
        partitionsById: state.partitionsById,
        conflictsById: state.conflictsById,
      }),
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedCloudSyncMetadataStoreSchema.safeParse(persistedState);
        const persisted = parsed.success
          ? parsed.data
          : PersistedCloudSyncMetadataStoreSchema.parse({});
        return {
          ...currentState,
          deviceId: persisted.deviceId || createCloudDeviceId(),
          partitionsById: Object.fromEntries(
            Object.entries(persisted.partitionsById).map(([id, meta]) => [
              id,
              normalizePartitionMeta(id, meta),
            ])
          ) as Record<CloudPartitionId, CloudSyncPartitionMeta>,
          conflictsById: persisted.conflictsById as Record<
            CloudPartitionId,
            CloudSyncConflictMeta
          >,
        };
      },
    }
  )
);
