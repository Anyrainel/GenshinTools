import type {
  CloudBackupRecordKind,
  CloudNamespace,
  CloudPartitionId,
} from "@/cloud/types";
import type {
  CloudConflictDecision,
  CloudDeleteDecision,
  CloudDownloadDecision,
  CloudSyncDecisionReason,
  CloudSyncPlan,
  CloudUploadDecision,
} from "./syncPlanner";

export type ManualBackupDirection = "upload" | "download";

export type ManualBackupAutomaticKind = "upload-local" | "download-cloud";

export type ManualBackupChoiceKind =
  | "upload-overwrite-cloud"
  | "upload-delete-cloud"
  | "download-overwrite-local";

export type ManualBackupActionItemBase = {
  id: CloudPartitionId;
  namespace: CloudNamespace;
  partitionKey: string;
  groupKey: string;
  reason: CloudSyncDecisionReason;
  recordKinds: CloudBackupRecordKind[];
};

export type ManualBackupAutomaticItem = ManualBackupActionItemBase & {
  kind: ManualBackupAutomaticKind;
};

export type ManualBackupChoice = ManualBackupActionItemBase & {
  kind: ManualBackupChoiceKind;
};

export type ManualBackupActionPlan = {
  direction: ManualBackupDirection;
  automaticPartitionIds: CloudPartitionId[];
  automaticItems: ManualBackupAutomaticItem[];
  choices: ManualBackupChoice[];
};

export function planManualBackupAction(
  plan: CloudSyncPlan,
  direction: ManualBackupDirection
): ManualBackupActionPlan {
  if (direction === "upload") {
    return {
      direction,
      automaticPartitionIds: plan.uploads.map((decision) => decision.id),
      automaticItems: plan.uploads.map((decision) =>
        automaticFromUpload(decision)
      ),
      choices: [
        ...plan.conflicts.flatMap((decision) =>
          decision.localHash ? [choiceFromConflict(decision, direction)] : []
        ),
        ...plan.deletes.map(choiceFromDelete),
      ],
    };
  }

  return {
    direction,
    automaticPartitionIds: plan.downloads.map((decision) => decision.id),
    automaticItems: plan.downloads.map((decision) =>
      automaticFromDownload(decision)
    ),
    choices: plan.conflicts.flatMap((decision) =>
      decision.remoteRev ? [choiceFromConflict(decision, direction)] : []
    ),
  };
}

function automaticFromUpload(
  decision: CloudUploadDecision
): ManualBackupAutomaticItem {
  return {
    id: decision.id,
    namespace: decision.namespace,
    partitionKey: decision.partitionKey,
    groupKey: decision.groupKey,
    reason: decision.reason,
    kind: "upload-local",
    recordKinds: getRecordKindsForShard(decision.namespace),
  };
}

function automaticFromDownload(
  decision: CloudDownloadDecision
): ManualBackupAutomaticItem {
  return {
    id: decision.id,
    namespace: decision.namespace,
    partitionKey: decision.partitionKey,
    groupKey: decision.groupKey,
    reason: decision.reason,
    kind: "download-cloud",
    recordKinds: getRecordKindsForShard(decision.namespace),
  };
}

export function getRecordKindsForShard(
  namespace: CloudNamespace
): CloudBackupRecordKind[] {
  if (namespace === "profile.app") return ["frozen", "settings"];
  if (namespace === "profile.game") return ["characters", "weapons"];
  if (namespace === "profile.artifacts") return ["artifacts"];
  if (namespace === "teams") return ["teams", "teamConfigs"];
  if (namespace === "builds") return ["builds"];
  return ["tiers"];
}

function choiceFromConflict(
  decision: CloudConflictDecision,
  direction: ManualBackupDirection
): ManualBackupChoice {
  return {
    id: decision.id,
    namespace: decision.namespace,
    partitionKey: decision.partitionKey,
    groupKey: decision.groupKey,
    reason: decision.reason,
    kind:
      direction === "upload"
        ? "upload-overwrite-cloud"
        : "download-overwrite-local",
    recordKinds: getRecordKindsForShard(decision.namespace),
  };
}

function choiceFromDelete(decision: CloudDeleteDecision): ManualBackupChoice {
  return {
    id: decision.id,
    namespace: decision.namespace,
    partitionKey: decision.partitionKey,
    groupKey: decision.groupKey,
    reason: decision.reason,
    kind: "upload-delete-cloud",
    recordKinds: getRecordKindsForShard(decision.namespace),
  };
}
