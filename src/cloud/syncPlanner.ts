import { getCloudBackupDescriptorForNamespace } from "@/cloud/registry";
import type {
  CloudConflictPolicy,
  CloudLocalPartitionState,
  CloudNamespace,
  CloudPartitionId,
  CloudRemoteHead,
  LocalCloudPartitionMeta,
} from "@/cloud/types";

export type CloudSyncDecisionReason =
  | "excluded"
  | "empty"
  | "same-content"
  | "remote-only"
  | "local-only"
  | "local-changed"
  | "remote-changed"
  | "both-changed"
  | "first-sync-local-and-cloud"
  | "metadata-mismatch"
  | "newer-cloud-schema";

export type CloudSyncDecisionBase = {
  id: CloudPartitionId;
  namespace: CloudNamespace;
  partitionKey: string;
  conflictPolicy: CloudConflictPolicy;
  groupKey: string;
  reason: CloudSyncDecisionReason;
};

export type CloudUploadDecision = CloudSyncDecisionBase & {
  action: "upload";
  baseRev?: string;
  contentHash: string;
  schemaVersion: number;
};

export type CloudDownloadDecision = CloudSyncDecisionBase & {
  action: "download";
  remoteRev: string;
  contentHash: string;
  schemaVersion: number;
};

export type CloudConflictDecision = CloudSyncDecisionBase & {
  action: "conflict";
  localHash?: string;
  remoteHash?: string;
  localUpdatedAt?: number;
  remoteUpdatedAt?: number;
};

export type CloudNoopDecision = CloudSyncDecisionBase & {
  action: "noop";
  remoteRev?: string;
  contentHash?: string;
};

export type CloudSkippedDecision = CloudSyncDecisionBase & {
  action: "skip";
};

export type CloudUnsupportedDecision = CloudSyncDecisionBase & {
  action: "unsupported";
  remoteSchemaVersion: number;
  supportedSchemaVersion: number;
};

export type CloudSyncDecision =
  | CloudUploadDecision
  | CloudDownloadDecision
  | CloudConflictDecision
  | CloudNoopDecision
  | CloudSkippedDecision
  | CloudUnsupportedDecision;

export type CloudSyncPlanInput = {
  localPartitions: CloudLocalPartitionState[];
  localMeta: LocalCloudPartitionMeta[];
  remoteHeads: CloudRemoteHead[];
};

export type CloudSyncPlan = {
  uploads: CloudUploadDecision[];
  downloads: CloudDownloadDecision[];
  conflicts: CloudConflictDecision[];
  noops: CloudNoopDecision[];
  skipped: CloudSkippedDecision[];
  unsupported: CloudUnsupportedDecision[];
  decisions: CloudSyncDecision[];
};

export type PartitionPlanningState = {
  id: CloudPartitionId;
  namespace: CloudNamespace;
  partitionKey: string;
  local?: CloudLocalPartitionState;
  meta?: LocalCloudPartitionMeta;
  remote?: CloudRemoteHead;
};

export function getCloudPartitionId(
  namespace: CloudNamespace,
  partitionKey: string
): CloudPartitionId {
  return `${namespace}/${partitionKey}` as CloudPartitionId;
}

export function getCloudConflictGroupKey(
  namespace: CloudNamespace,
  partitionKey: string
): string {
  if (isProfileSourceNamespace(namespace)) {
    return `profile:${getProfileIdFromPartition(namespace, partitionKey)}`;
  }
  if (namespace === "teams") {
    return "teams:all";
  }
  return `${namespace}:${partitionKey}`;
}

export function planCloudSync(input: CloudSyncPlanInput): CloudSyncPlan {
  const states = collectPartitionStates(input);
  const decisions = states.map(planPartitionSync);
  return {
    uploads: decisions.filter(isUploadDecision),
    downloads: decisions.filter(isDownloadDecision),
    conflicts: decisions.filter(isConflictDecision),
    noops: decisions.filter(isNoopDecision),
    skipped: decisions.filter(isSkippedDecision),
    unsupported: decisions.filter(isUnsupportedDecision),
    decisions,
  };
}

export function planPartitionSync(
  state: PartitionPlanningState
): CloudSyncDecision {
  const descriptor = getCloudBackupDescriptorForNamespace(state.namespace);
  const conflictPolicy =
    state.local?.conflictPolicy ?? descriptor?.conflictPolicy ?? "excluded";
  const base = decisionBase(state, conflictPolicy);

  if (!descriptor?.includeInBackup || conflictPolicy === "excluded") {
    return { ...base, action: "skip", reason: "excluded" };
  }

  if (!state.local && !state.remote) {
    return { ...base, action: "skip", reason: "empty" };
  }

  const supportedSchemaVersion = descriptor.currentVersion;
  if (state.remote && state.remote.schemaVersion > supportedSchemaVersion) {
    return {
      ...base,
      action: "unsupported",
      reason: "newer-cloud-schema",
      remoteSchemaVersion: state.remote.schemaVersion,
      supportedSchemaVersion,
    };
  }

  if (!state.local && state.remote) {
    return {
      ...base,
      action: "download",
      reason: "remote-only",
      remoteRev: state.remote.rev,
      contentHash: state.remote.contentHash,
      schemaVersion: state.remote.schemaVersion,
    };
  }

  if (state.local && !state.remote) {
    return {
      ...base,
      action: "upload",
      reason: "local-only",
      contentHash: state.local.contentHash,
      schemaVersion: state.local.schemaVersion,
    };
  }

  if (!state.local || !state.remote) {
    return { ...base, action: "skip", reason: "empty" };
  }

  if (state.local.contentHash === state.remote.contentHash) {
    return {
      ...base,
      action: "noop",
      reason: "same-content",
      remoteRev: state.remote.rev,
      contentHash: state.remote.contentHash,
    };
  }

  if (!hasSyncHistory(state.meta)) {
    return conflictDecision(base, state, "first-sync-local-and-cloud");
  }

  const lastAppliedHash =
    state.meta?.lastAppliedHash ?? state.meta?.lastUploadedHash;
  const localChanged = state.local.contentHash !== lastAppliedHash;
  const cloudChanged = state.remote.rev !== state.meta?.lastSeenRev;

  if (!localChanged && cloudChanged) {
    return {
      ...base,
      action: "download",
      reason: "remote-changed",
      remoteRev: state.remote.rev,
      contentHash: state.remote.contentHash,
      schemaVersion: state.remote.schemaVersion,
    };
  }

  if (localChanged && !cloudChanged) {
    return {
      ...base,
      action: "upload",
      reason: "local-changed",
      baseRev: state.meta?.lastSeenRev,
      contentHash: state.local.contentHash,
      schemaVersion: state.local.schemaVersion,
    };
  }

  if (localChanged && cloudChanged) {
    return resolveBothChanged(base, state, conflictPolicy);
  }

  return conflictDecision(base, state, "metadata-mismatch");
}

function collectPartitionStates(input: CloudSyncPlanInput) {
  const states = new Map<CloudPartitionId, PartitionPlanningState>();

  for (const local of input.localPartitions) {
    const id = getCloudPartitionId(local.namespace, local.partitionKey);
    states.set(id, {
      ...(states.get(id) ?? {
        id,
        namespace: local.namespace,
        partitionKey: local.partitionKey,
      }),
      local,
    });
  }

  for (const meta of input.localMeta) {
    const id = getCloudPartitionId(meta.namespace, meta.partitionKey);
    states.set(id, {
      ...(states.get(id) ?? {
        id,
        namespace: meta.namespace,
        partitionKey: meta.partitionKey,
      }),
      meta,
    });
  }

  for (const remote of input.remoteHeads) {
    const id = getCloudPartitionId(remote.namespace, remote.partitionKey);
    states.set(id, {
      ...(states.get(id) ?? {
        id,
        namespace: remote.namespace,
        partitionKey: remote.partitionKey,
      }),
      remote,
    });
  }

  return [...states.values()].sort((first, second) =>
    first.id.localeCompare(second.id)
  );
}

function decisionBase(
  state: PartitionPlanningState,
  conflictPolicy: CloudConflictPolicy
): CloudSyncDecisionBase {
  return {
    id: state.id,
    namespace: state.namespace,
    partitionKey: state.partitionKey,
    conflictPolicy,
    groupKey: getCloudConflictGroupKey(state.namespace, state.partitionKey),
    reason: "empty",
  };
}

function resolveBothChanged(
  base: CloudSyncDecisionBase,
  state: PartitionPlanningState,
  conflictPolicy: CloudConflictPolicy
): CloudSyncDecision {
  if (conflictPolicy === "latest-writer-wins" && state.local && state.remote) {
    const localUpdatedAt = state.local.updatedAt ?? state.meta?.updatedAt ?? 0;
    if (localUpdatedAt >= state.remote.updatedAt) {
      return {
        ...base,
        action: "upload",
        reason: "both-changed",
        baseRev: state.meta?.lastSeenRev,
        contentHash: state.local.contentHash,
        schemaVersion: state.local.schemaVersion,
      };
    }
    return {
      ...base,
      action: "download",
      reason: "both-changed",
      remoteRev: state.remote.rev,
      contentHash: state.remote.contentHash,
      schemaVersion: state.remote.schemaVersion,
    };
  }

  return conflictDecision(base, state, "both-changed");
}

function conflictDecision(
  base: CloudSyncDecisionBase,
  state: PartitionPlanningState,
  reason: CloudSyncDecisionReason
): CloudConflictDecision {
  return {
    ...base,
    action: "conflict",
    reason,
    localHash: state.local?.contentHash,
    remoteHash: state.remote?.contentHash,
    localUpdatedAt: state.local?.updatedAt ?? state.meta?.updatedAt,
    remoteUpdatedAt: state.remote?.updatedAt,
  };
}

function hasSyncHistory(meta: LocalCloudPartitionMeta | undefined) {
  return Boolean(
    meta?.lastSeenRev || meta?.lastAppliedHash || meta?.lastUploadedHash
  );
}

function isProfileSourceNamespace(namespace: CloudNamespace) {
  return (
    namespace === "profile.app" ||
    namespace === "profile.game" ||
    namespace === "profile.artifacts"
  );
}

function getProfileIdFromPartition(
  namespace: CloudNamespace,
  partitionKey: string
) {
  if (namespace === "profile.artifacts") {
    return partitionKey.split(":")[0] ?? partitionKey;
  }
  return partitionKey;
}

function isUploadDecision(
  decision: CloudSyncDecision
): decision is CloudUploadDecision {
  return decision.action === "upload";
}

function isDownloadDecision(
  decision: CloudSyncDecision
): decision is CloudDownloadDecision {
  return decision.action === "download";
}

function isConflictDecision(
  decision: CloudSyncDecision
): decision is CloudConflictDecision {
  return decision.action === "conflict";
}

function isNoopDecision(
  decision: CloudSyncDecision
): decision is CloudNoopDecision {
  return decision.action === "noop";
}

function isSkippedDecision(
  decision: CloudSyncDecision
): decision is CloudSkippedDecision {
  return decision.action === "skip";
}

function isUnsupportedDecision(
  decision: CloudSyncDecision
): decision is CloudUnsupportedDecision {
  return decision.action === "unsupported";
}
