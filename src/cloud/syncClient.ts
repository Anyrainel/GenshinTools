import {
  BackupApiClient,
  type BackupCommitObjectInput,
  type BackupHead,
  type BackupObjectDownloadResponse,
  type BackupWriteMode,
} from "@/cloud/apiClient";
import { buildBackupHeadMetadataByPartition } from "@/cloud/backupMetadata";
import {
  canonicalJson,
  createEnvelope,
  getContentHash,
  gunzipJson,
  gzipJson,
  verifyEnvelopePayload,
} from "@/cloud/payload";
import { getCloudBackupDescriptorForNamespace } from "@/cloud/registry";
import {
  applyCloudRestorePlan,
  buildCloudRestorePlan,
  buildLocalBackupPartitions,
  type CloudRestoreApplyResult,
} from "@/cloud/storeAdapters";
import {
  type CloudSyncPlan,
  getCloudConflictGroupKey,
  getCloudPartitionId,
  planCloudSync,
} from "@/cloud/syncPlanner";
import type {
  CloudBackupHeadMetadata,
  CloudExportPartition,
  CloudLocalPartitionState,
  CloudNamespace,
  CloudPartitionId,
  CloudPartitionKey,
  CloudPayloadEnvelope,
  CloudRemoteHead,
  CloudRestorePlan,
} from "@/cloud/types";
import {
  type CloudSyncConflictMeta,
  type CloudSyncMetadataState,
  useCloudSyncMetadataStore,
} from "@/stores/useCloudSyncMetadataStore";

export type CloudSyncStatus =
  | "synced"
  | "uploaded"
  | "needs-download"
  | "conflict"
  | "unsupported";

export type CloudSyncRunResult = {
  status: CloudSyncStatus;
  plan: CloudSyncPlan;
  remoteHeads: BackupHead[];
  uploaded: BackupHead[];
  headSetRev: string;
};

export type ExplicitLocalOverwriteScope = {
  partitionIds?: CloudPartitionId[];
  groupKeys?: string[];
};

export type ExplicitCloudDeleteScope = {
  partitionIds?: CloudPartitionId[];
  groupKeys?: string[];
};

export type CloudSyncClientOptions = {
  apiClient?: BackupApi;
  buildPartitions?: () => CloudExportPartition[];
  metadataStore?: Pick<
    CloudSyncMetadataState,
    | "ensureDeviceId"
    | "getAllPartitionMeta"
    | "markPartitionSyncedFromUpload"
    | "markPartitionSyncedWithoutTransfer"
    | "markConflict"
    | "removePartitionMeta"
  >;
  now?: () => number;
  createIdempotencyKey?: () => string;
  createUploadRev?: (
    partition: CloudExportPartition,
    idempotencyKey: string,
    index: number
  ) => string;
  explicitLocalOverwrite?: ExplicitLocalOverwriteScope;
  explicitCloudDelete?: ExplicitCloudDeleteScope;
};

export type CloudSyncPreviewOptions = Pick<
  CloudSyncClientOptions,
  "apiClient" | "buildPartitions" | "metadataStore"
>;

export type BackupApi = Pick<BackupApiClient, "getHead" | "commit">;
export type BackupDownloadApi = Pick<BackupApiClient, "downloadObjects">;

export type CloudDownloadedRestore = {
  heads: BackupHead[];
  partitions: CloudExportPartition[];
  restorePlan: CloudRestorePlan;
};

export type CloudRestoreDownloadOptions = {
  apiClient?: BackupDownloadApi;
  syncResult: CloudSyncRunResult;
  downloadScope?: {
    partitionIds?: CloudPartitionId[];
  };
  buildRestorePlan?: (partitions: CloudExportPartition[]) => CloudRestorePlan;
};

export type MarkCloudRestoreAppliedOptions = {
  metadataStore?: Pick<
    CloudSyncMetadataState,
    "markPartitionSyncedFromDownload"
  >;
  downloaded: CloudDownloadedRestore;
  appliedAt?: number;
};

export type CloudRestoreApplyOptions = MarkCloudRestoreAppliedOptions & {
  applyRestorePlan?: (plan: CloudRestorePlan) => CloudRestoreApplyResult;
};

type PreparedCloudPartition = {
  id: CloudPartitionId;
  partition: CloudExportPartition;
  local: CloudLocalPartitionState;
  metadata: CloudBackupHeadMetadata;
};

export async function runCloudSyncOnce(
  options: CloudSyncClientOptions = {}
): Promise<CloudSyncRunResult> {
  const apiClient = options.apiClient ?? new BackupApiClient();
  const metadataStore =
    options.metadataStore ?? useCloudSyncMetadataStore.getState();
  const now = options.now ?? Date.now;
  const head = await apiClient.getHead();
  const prepared = await prepareLocalPartitions(
    options.buildPartitions?.() ?? buildLocalBackupPartitions()
  );
  const remoteHeadById = buildRemoteHeadByPartitionId(head.heads);
  const plan = planCloudSync({
    localPartitions: prepared.map(({ local }) => local),
    localMeta: metadataStore.getAllPartitionMeta(),
    remoteHeads: head.heads.flatMap(toCloudRemoteHead),
  });
  const syncedAt = now();

  for (const noop of plan.noops) {
    if (!noop.remoteRev || !noop.contentHash) continue;
    const remoteUpdatedAt = remoteHeadById.get(noop.id)?.updatedAt;
    metadataStore.markPartitionSyncedWithoutTransfer({
      namespace: noop.namespace,
      partitionKey: noop.partitionKey,
      rev: noop.remoteRev,
      contentHash: noop.contentHash,
      syncedAt,
      ...(remoteUpdatedAt != null ? { updatedAt: remoteUpdatedAt } : {}),
    });
  }

  const unresolvedConflicts = plan.conflicts.filter(
    (conflict) =>
      !shouldExplicitlyOverwrite(conflict, options.explicitLocalOverwrite)
  );

  for (const conflict of unresolvedConflicts) {
    metadataStore.markConflict({
      id: conflict.id,
      namespace: conflict.namespace,
      partitionKey: conflict.partitionKey,
      groupKey: conflict.groupKey,
      conflictPolicy: conflict.conflictPolicy,
      reason: conflict.reason,
      detectedAt: syncedAt,
      ...(conflict.localHash ? { localHash: conflict.localHash } : {}),
      ...(conflict.remoteHash ? { remoteHash: conflict.remoteHash } : {}),
      ...(conflict.remoteRev ? { remoteRev: conflict.remoteRev } : {}),
      ...(conflict.localUpdatedAt != null
        ? { localUpdatedAt: conflict.localUpdatedAt }
        : {}),
      ...(conflict.remoteUpdatedAt != null
        ? { remoteUpdatedAt: conflict.remoteUpdatedAt }
        : {}),
    } satisfies CloudSyncConflictMeta);
  }

  const uploads = collectUploadWork(
    plan,
    prepared,
    options.explicitLocalOverwrite,
    remoteHeadById
  );
  const deletes = collectDeleteWork(plan, options.explicitCloudDelete);
  if (uploads.length === 0 && deletes.length === 0) {
    return {
      status: getPlanStatus(plan, [], unresolvedConflicts.length),
      plan,
      remoteHeads: head.heads,
      uploaded: [],
      headSetRev: head.headSetRev,
    };
  }

  const idempotencyKey =
    options.createIdempotencyKey?.() ?? createIdempotencyKey();
  const deviceId = metadataStore.ensureDeviceId();
  const puts = await createCommitPuts(uploads, prepared, {
    idempotencyKey,
    deviceId,
    createUploadRev: options.createUploadRev ?? createUploadRev,
  });
  const commit = await apiClient.commit({
    idempotencyKey,
    deviceId,
    puts,
    deletes,
  });

  for (const uploaded of commit.heads) {
    const parsed = toCloudRemoteHead(uploaded)[0];
    if (!parsed) continue;
    if (uploaded.deletedAt != null) {
      metadataStore.removePartitionMeta(parsed.namespace, parsed.partitionKey);
      continue;
    }
    metadataStore.markPartitionSyncedFromUpload({
      namespace: parsed.namespace,
      partitionKey: parsed.partitionKey,
      rev: uploaded.rev,
      contentHash: uploaded.contentHash,
      syncedAt: commit.committedAt,
      updatedAt: uploaded.updatedAt,
    });
  }

  return {
    status: getPlanStatus(plan, commit.heads, unresolvedConflicts.length),
    plan,
    remoteHeads: head.heads,
    uploaded: commit.heads,
    headSetRev: commit.headSetRev,
  };
}

export async function previewCloudSync(
  options: CloudSyncPreviewOptions = {}
): Promise<CloudSyncRunResult> {
  const apiClient = options.apiClient ?? new BackupApiClient();
  const metadataStore =
    options.metadataStore ?? useCloudSyncMetadataStore.getState();
  const head = await apiClient.getHead();
  const prepared = await prepareLocalPartitions(
    options.buildPartitions?.() ?? buildLocalBackupPartitions()
  );
  const plan = planCloudSync({
    localPartitions: prepared.map(({ local }) => local),
    localMeta: metadataStore.getAllPartitionMeta(),
    remoteHeads: head.heads.flatMap(toCloudRemoteHead),
  });

  return {
    status: getPlanStatus(plan, [], plan.conflicts.length),
    plan,
    remoteHeads: head.heads,
    uploaded: [],
    headSetRev: head.headSetRev,
  };
}

export async function downloadCloudSyncRestorePlan(
  options: CloudRestoreDownloadOptions
): Promise<CloudDownloadedRestore> {
  const heads = getCloudSyncDownloadHeads(
    options.syncResult,
    options.downloadScope
  );
  if (heads.length === 0) {
    return {
      heads: [],
      partitions: [],
      restorePlan: options.buildRestorePlan?.([]) ?? buildCloudRestorePlan([]),
    };
  }

  const apiClient = options.apiClient ?? new BackupApiClient();
  const response = await apiClient.downloadObjects(
    heads.map((head) => head.objectId)
  );
  const partitions = await readDownloadedPartitions(heads, response);
  return {
    heads,
    partitions,
    restorePlan:
      options.buildRestorePlan?.(partitions) ??
      buildCloudRestorePlan(partitions),
  };
}

export function getCloudSyncDownloadHeads(
  syncResult: CloudSyncRunResult,
  scope?: { partitionIds?: CloudPartitionId[] }
): BackupHead[] {
  if (scope?.partitionIds) {
    const scopedIds = new Set(scope.partitionIds);
    return syncResult.remoteHeads.filter((head) =>
      scopedIds.has(head.partitionKey)
    );
  }

  const downloadIds = new Set(
    syncResult.plan.downloads.map((download) => download.id)
  );
  const downloadGroups = new Set(
    syncResult.plan.downloads.map((download) => download.groupKey)
  );
  return syncResult.remoteHeads.filter((head) => {
    const groupKey = headGroupKey(head);
    return (
      downloadIds.has(head.partitionKey) ||
      (groupKey !== undefined && downloadGroups.has(groupKey))
    );
  });
}

export function markCloudRestoreApplied(
  options: MarkCloudRestoreAppliedOptions
): void {
  const metadataStore =
    options.metadataStore ?? useCloudSyncMetadataStore.getState();
  for (const head of options.downloaded.heads) {
    const parsed = toCloudRemoteHead(head)[0];
    if (!parsed) continue;
    metadataStore.markPartitionSyncedFromDownload({
      namespace: parsed.namespace,
      partitionKey: parsed.partitionKey,
      rev: head.rev,
      contentHash: head.contentHash,
      syncedAt: options.appliedAt,
      updatedAt: head.updatedAt,
    });
  }
}

export function applyCloudRestoreAndMarkSynced(
  options: CloudRestoreApplyOptions
): CloudRestoreApplyResult {
  const result = (options.applyRestorePlan ?? applyCloudRestorePlan)(
    options.downloaded.restorePlan
  );
  markCloudRestoreApplied(options);
  return result;
}

async function prepareLocalPartitions(
  partitions: CloudExportPartition[]
): Promise<PreparedCloudPartition[]> {
  const metadataById = buildBackupHeadMetadataByPartition(partitions);
  return Promise.all(
    partitions.map(async (partition) => {
      const id = getCloudPartitionId(
        partition.namespace,
        partition.partitionKey
      );
      return {
        id,
        partition,
        local: {
          namespace: partition.namespace,
          partitionKey: partition.partitionKey,
          schemaVersion: partition.schemaVersion,
          conflictPolicy: partition.conflictPolicy,
          contentHash: await getContentHash(partition.payload),
          ...(partition.isEmpty ? { isEmpty: true } : {}),
        },
        metadata: metadataById.get(id)!,
      };
    })
  );
}

export async function readDownloadedPartitions(
  expectedHeads: BackupHead[],
  response: BackupObjectDownloadResponse
): Promise<CloudExportPartition[]> {
  const manifestHeadsByObjectId = new Map(
    response.manifest.objects.map((head) => [head.objectId, head])
  );
  const partitions: CloudExportPartition[] = [];
  for (const expectedHead of expectedHeads) {
    const manifestHead = manifestHeadsByObjectId.get(expectedHead.objectId);
    if (!manifestHead) {
      throw new Error(
        `Downloaded backup missed manifest for ${expectedHead.objectId}`
      );
    }
    assertSameHead(expectedHead, manifestHead);
    const blob = response.objects.get(expectedHead.objectId);
    if (!blob) {
      throw new Error(
        `Downloaded backup missed object ${expectedHead.objectId}`
      );
    }
    const compressedBytes = await blobBytes(blob);
    const compressedHash = await sha256Bytes(compressedBytes);
    if (compressedHash !== expectedHead.compressedHash) {
      throw new Error(
        `Downloaded backup object hash mismatch for ${expectedHead.objectId}`
      );
    }
    const envelope =
      await gunzipJson<CloudPayloadEnvelope<unknown>>(compressedBytes);
    await validateEnvelope(expectedHead, envelope);
    const descriptor = getCloudBackupDescriptorForNamespace(envelope.namespace);
    if (!descriptor?.includeInBackup) {
      throw new Error(
        `Downloaded backup has unknown namespace ${envelope.namespace}`
      );
    }
    partitions.push({
      namespace: envelope.namespace,
      partitionKey: envelope.partitionKey,
      schemaVersion: envelope.schemaVersion,
      conflictPolicy: descriptor.conflictPolicy,
      metadata: expectedHead.metadata,
      payload: envelope.payload,
    });
  }
  return partitions;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(
          new Error("Downloaded backup object could not be read as bytes")
        );
      }
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Downloaded backup object read failed"))
    );
    reader.readAsArrayBuffer(blob);
  });
}

async function validateEnvelope(
  head: BackupHead,
  envelope: CloudPayloadEnvelope<unknown>
): Promise<void> {
  const [namespace, partitionKey] = splitPartitionId(head.partitionKey);
  if (
    envelope.app !== "GenshinTools" ||
    envelope.namespace !== namespace ||
    envelope.partitionKey !== partitionKey ||
    envelope.schemaVersion !== head.schemaVersion ||
    envelope.contentHash !== head.contentHash
  ) {
    throw new Error(`Downloaded backup envelope mismatch for ${head.objectId}`);
  }
  const descriptor = getCloudBackupDescriptorForNamespace(envelope.namespace);
  if (!descriptor || envelope.schemaVersion > descriptor.currentVersion) {
    throw new Error(
      `Downloaded backup schema is not supported for ${head.partitionKey}`
    );
  }
  if (!(await verifyEnvelopePayload(envelope))) {
    throw new Error(
      `Downloaded backup payload hash mismatch for ${head.objectId}`
    );
  }
}

function assertSameHead(expected: BackupHead, actual: BackupHead): void {
  if (
    expected.partitionKey !== actual.partitionKey ||
    expected.rev !== actual.rev ||
    expected.schemaVersion !== actual.schemaVersion ||
    expected.contentHash !== actual.contentHash ||
    expected.compressedHash !== actual.compressedHash
  ) {
    throw new Error(
      `Downloaded backup manifest mismatch for ${expected.objectId}`
    );
  }
}

async function createCommitPuts(
  uploads: CloudUploadWork[],
  prepared: PreparedCloudPartition[],
  options: {
    idempotencyKey: string;
    deviceId: string;
    createUploadRev: (
      partition: CloudExportPartition,
      idempotencyKey: string,
      index: number
    ) => string;
  }
): Promise<BackupCommitObjectInput[]> {
  const byId = new Map(prepared.map((entry) => [entry.id, entry]));
  return Promise.all(
    uploads.map(async (upload, index) => {
      const entry = byId.get(upload.id);
      if (!entry) {
        throw new Error(`Missing local cloud partition ${upload.id}`);
      }
      const envelope = await createEnvelope(entry.partition, {
        rev: options.createUploadRev(
          entry.partition,
          options.idempotencyKey,
          index
        ),
        ...(upload.baseRev ? { baseRev: upload.baseRev } : {}),
        sourceDeviceId: options.deviceId,
      });
      const bytes = await gzipJson(envelope);
      const blob = new Blob([bytes], { type: "application/gzip" });
      return {
        commitObjectKey: `upload_${index}`,
        partitionKey: upload.id,
        schemaVersion: upload.schemaVersion,
        contentHash: upload.contentHash,
        compressedHash: await sha256Bytes(bytes),
        logicalBytes: utf8Bytes(canonicalJson(envelope)),
        compressedBytes: bytes.byteLength,
        metadata: entry.metadata,
        writeMode: upload.baseRev
          ? { kind: "ifMatch", expectedRev: upload.baseRev }
          : upload.writeMode,
        bytes: blob,
      };
    })
  );
}

type CloudUploadWork = {
  id: CloudPartitionId;
  namespace: CloudNamespace;
  partitionKey: CloudPartitionKey;
  schemaVersion: number;
  contentHash: string;
  baseRev?: string;
  writeMode: BackupWriteMode;
};

type CloudDeleteWork = {
  partitionKey: CloudPartitionId;
  writeMode: { kind: "ifMatch"; expectedRev: string };
};

function collectUploadWork(
  plan: CloudSyncPlan,
  prepared: PreparedCloudPartition[],
  overwriteScope: ExplicitLocalOverwriteScope | undefined,
  remoteHeadById: Map<CloudPartitionId, BackupHead>
): CloudUploadWork[] {
  const byId = new Map(prepared.map((entry) => [entry.id, entry]));
  const safeUploads: CloudUploadWork[] = plan.uploads.map((upload) => ({
    id: upload.id,
    namespace: upload.namespace,
    partitionKey: upload.partitionKey,
    schemaVersion: upload.schemaVersion,
    contentHash: upload.contentHash,
    ...(upload.baseRev ? { baseRev: upload.baseRev } : {}),
    writeMode: upload.baseRev
      ? { kind: "ifMatch", expectedRev: upload.baseRev }
      : { kind: "ifAbsent" },
  }));
  const overwriteUploads: CloudUploadWork[] = plan.conflicts.flatMap(
    (conflict) => {
      if (!shouldExplicitlyOverwrite(conflict, overwriteScope)) return [];
      const local = byId.get(conflict.id)?.local;
      if (!local) return [];
      return [
        {
          id: conflict.id,
          namespace: conflict.namespace,
          partitionKey: conflict.partitionKey,
          schemaVersion: local.schemaVersion,
          contentHash: local.contentHash,
          writeMode: { kind: "overwrite" },
        },
      ];
    }
  );
  const metadataRefreshUploads: CloudUploadWork[] = plan.noops.flatMap(
    (noop) => {
      const entry = byId.get(noop.id);
      const remote = remoteHeadById.get(noop.id);
      if (
        !entry ||
        !remote ||
        isSameBackupMetadata(entry.metadata, remote.metadata)
      ) {
        return [];
      }
      return [
        {
          id: noop.id,
          namespace: noop.namespace,
          partitionKey: noop.partitionKey,
          schemaVersion: entry.local.schemaVersion,
          contentHash: entry.local.contentHash,
          baseRev: remote.rev,
          writeMode: { kind: "ifMatch", expectedRev: remote.rev },
        },
      ];
    }
  );
  return [...safeUploads, ...overwriteUploads, ...metadataRefreshUploads];
}

function collectDeleteWork(
  plan: CloudSyncPlan,
  deleteScope?: ExplicitCloudDeleteScope
): CloudDeleteWork[] {
  return plan.deletes
    .filter((entry) =>
      deleteScope ? shouldExplicitlyDelete(entry, deleteScope) : true
    )
    .map((entry) => ({
      partitionKey: entry.id,
      writeMode: { kind: "ifMatch", expectedRev: entry.baseRev },
    }));
}

function shouldExplicitlyOverwrite(
  decision: CloudSyncPlan["conflicts"][number],
  scope: ExplicitLocalOverwriteScope | undefined
): boolean {
  if (!scope) return false;
  return Boolean(
    scope.partitionIds?.includes(decision.id) ||
      scope.groupKeys?.includes(decision.groupKey)
  );
}

function shouldExplicitlyDelete(
  decision: CloudSyncPlan["deletes"][number],
  scope: ExplicitCloudDeleteScope
): boolean {
  return Boolean(
    scope.partitionIds?.includes(decision.id) ||
      scope.groupKeys?.includes(decision.groupKey)
  );
}

function toCloudRemoteHead(head: BackupHead): CloudRemoteHead[] {
  const [namespace, partitionKey] = splitPartitionId(head.partitionKey);
  if (!namespace || !partitionKey) return [];
  return [
    {
      namespace,
      partitionKey,
      rev: head.rev,
      schemaVersion: head.schemaVersion,
      contentHash: head.contentHash,
      updatedAt: head.updatedAt,
      ...(head.sourceDeviceId ? { sourceDeviceId: head.sourceDeviceId } : {}),
      ...(head.deletedAt != null ? { deletedAt: head.deletedAt } : {}),
    },
  ];
}

function buildRemoteHeadByPartitionId(
  heads: BackupHead[]
): Map<CloudPartitionId, BackupHead> {
  return new Map(heads.map((head) => [head.partitionKey, head]));
}

function isSameBackupMetadata(
  local: CloudBackupHeadMetadata,
  remote: CloudBackupHeadMetadata
): boolean {
  return canonicalJson(local) === canonicalJson(remote);
}

function headGroupKey(head: BackupHead): string | undefined {
  const parsed = toCloudRemoteHead(head)[0];
  return parsed
    ? getCloudConflictGroupKey(parsed.namespace, parsed.partitionKey)
    : undefined;
}

function splitPartitionId(
  id: string
): [CloudNamespace | undefined, string | undefined] {
  const separatorIndex = id.indexOf("/");
  if (separatorIndex < 1) return [undefined, undefined];
  const namespace = id.slice(0, separatorIndex);
  if (!isCloudNamespace(namespace)) return [undefined, undefined];
  return [namespace, id.slice(separatorIndex + 1)];
}

function isCloudNamespace(value: string): value is CloudNamespace {
  return (
    value === "profile.app" ||
    value === "profile.game" ||
    value === "profile.artifacts" ||
    value === "builds" ||
    value === "teams" ||
    value === "tiers"
  );
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${hex(new Uint8Array(digest))}`;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createIdempotencyKey(): string {
  return `sync_${crypto.randomUUID()}`;
}

function createUploadRev(
  _partition: CloudExportPartition,
  idempotencyKey: string,
  index: number
): string {
  return `${idempotencyKey}_${index}`;
}

function getPlanStatus(
  plan: CloudSyncPlan,
  uploaded: BackupHead[],
  unresolvedConflictCount: number
): CloudSyncStatus {
  if (unresolvedConflictCount > 0) return "conflict";
  if (plan.unsupported.length > 0) return "unsupported";
  if (plan.downloads.length > 0) return "needs-download";
  if (uploaded.length > 0) return "uploaded";
  return "synced";
}
