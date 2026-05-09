import type {
  TierListPayload,
  TiersCloudPayload,
} from "@/cloud/adapters/tierAdapter";
import type {
  BackupApiClient,
  BackupHead,
  BackupUploadQuota,
} from "@/cloud/apiClient";
import type {
  CloudBackupHeadMetadata,
  CloudBackupRecordKind,
  CloudExportPartition,
  CloudNamespace,
  CloudPartitionId,
  LocalCloudPartitionMeta,
} from "@/cloud/types";

export type BackupMetadataRowId = string;

export type BackupMetadataSide = {
  hasRecord: boolean;
  count: number;
  updatedAt?: number;
  partitionCount: number;
};

export type BackupMetadataRow = {
  id: BackupMetadataRowId;
  kind: CloudBackupRecordKind;
  profileId?: string;
  local: BackupMetadataSide;
  cloud: BackupMetadataSide;
};

export type CloudBackupMetadataSnapshot = {
  schemaVersion: 5;
  checkedAt: number;
  headSetRev: string;
  quota: BackupUploadQuota;
  rows: BackupMetadataRow[];
};

export type BackupMetadataApi = Pick<BackupApiClient, "getHead">;

type MutableSide = {
  count: number;
  updatedAt?: number;
  partitionIds: Set<string>;
};

const BACKUP_METADATA_KIND_ORDER: CloudBackupRecordKind[] = [
  "characters",
  "weapons",
  "artifacts",
  "frozen",
  "settings",
  "builds",
  "teams",
  "teamConfigs",
  "tiers",
];

const PROFILE_SCOPED_KINDS = new Set<CloudBackupRecordKind>([
  "characters",
  "weapons",
  "artifacts",
  "frozen",
  "settings",
]);

export async function fetchCloudBackupMetadata(
  apiClient: BackupMetadataApi
): Promise<CloudBackupMetadataSnapshot> {
  const head = await apiClient.getHead();
  return {
    schemaVersion: 5,
    checkedAt: Date.now(),
    headSetRev: head.headSetRev,
    quota: head.quota,
    rows: mergeBackupMetadataRows(
      emptyBackupMetadataRows(),
      buildCloudBackupMetadataRows(head.heads)
    ),
  };
}

export function buildBackupHeadMetadataByPartition(
  partitions: CloudExportPartition[]
): Map<CloudPartitionId, CloudBackupHeadMetadata> {
  const profileUpdatedAt = collectProfileUpdatedAt(partitions);
  return new Map(
    partitions.map((partition) => [
      partitionId(partition.namespace, partition.partitionKey),
      buildPartitionMetadata(partition, profileUpdatedAt),
    ])
  );
}

export function buildLocalBackupMetadataRows(
  partitions: CloudExportPartition[],
  _localMeta: LocalCloudPartitionMeta[]
): BackupMetadataRow[] {
  const metadataById = buildBackupHeadMetadataByPartition(partitions);
  return mergeBackupMetadataRows(
    buildMetadataRows(
      partitions.map((partition) => {
        const id = partitionId(partition.namespace, partition.partitionKey);
        return {
          id,
          metadata: metadataById.get(id)!,
        };
      }),
      "local"
    ),
    emptyBackupMetadataRows()
  );
}

export function mergeBackupMetadataRows(
  localRows: BackupMetadataRow[],
  cloudRows: BackupMetadataRow[]
): BackupMetadataRow[] {
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const cloudById = new Map(cloudRows.map((row) => [row.id, row]));
  return sortMetadataRows(
    [...new Set([...localById.keys(), ...cloudById.keys()])].map((id) => {
      const local = localById.get(id);
      const cloud = cloudById.get(id);
      const parsed = parseBackupMetadataRowId(id);
      return {
        id,
        kind: (local ?? cloud)?.kind ?? parsed.kind,
        ...(((local ?? cloud)?.profileId ?? parsed.profileId)
          ? { profileId: ((local ?? cloud)?.profileId ?? parsed.profileId)! }
          : {}),
        local: local?.local ?? emptySide(),
        cloud: cloud?.cloud ?? emptySide(),
      };
    })
  );
}

export function getBackupRowIdForPartition(
  namespace: CloudNamespace
): CloudBackupRecordKind {
  if (namespace === "profile.game") return "characters";
  if (namespace === "profile.artifacts") return "artifacts";
  if (namespace === "builds") return "builds";
  if (namespace === "teams") return "teams";
  if (namespace === "tiers") return "tiers";
  return "settings";
}

function buildCloudBackupMetadataRows(
  heads: BackupHead[]
): BackupMetadataRow[] {
  return buildMetadataRows(
    heads
      .filter((head) => head.deletedAt == null)
      .map((head) => ({
        id: head.partitionKey,
        metadata: head.metadata,
      })),
    "cloud"
  );
}

function buildMetadataRows(
  entries: {
    id: CloudPartitionId;
    metadata: CloudBackupHeadMetadata;
  }[],
  sideName: "local" | "cloud"
): BackupMetadataRow[] {
  const sides = new Map<BackupMetadataRowId, MutableSide>();
  for (const entry of entries) {
    for (const record of entry.metadata.records) {
      const profileId = PROFILE_SCOPED_KINDS.has(record.kind)
        ? (record.profileId ?? profileIdFromPartitionId(entry.id))
        : undefined;
      const rowId = makeBackupMetadataRowId(record.kind, profileId);
      addCount(
        sides.get(rowId) ?? createMutableSide(sides, rowId),
        record.count,
        entry.id,
        record.updatedAt
      );
    }
  }

  return sortMetadataRows([
    ...emptyBackupMetadataRows(),
    ...[...sides.entries()].map(([id, side]) => {
      const parsed = parseBackupMetadataRowId(id);
      const row = {
        id,
        kind: parsed.kind,
        ...(parsed.profileId != null ? { profileId: parsed.profileId } : {}),
        local: emptySide(),
        cloud: emptySide(),
      };
      return {
        ...row,
        [sideName]: freezeSide(side),
      };
    }),
  ]);
}

function buildPartitionMetadata(
  partition: CloudExportPartition,
  profileUpdatedAt: Map<string, number>
): CloudBackupHeadMetadata {
  if (partition.namespace === "profile.app") {
    const payload = partition.payload as {
      accountProfileId?: number | string;
      lastImportedAt?: number;
      freeze?: { frozenTeamLoadouts?: Record<string, unknown> };
      triageSettings?: unknown;
      resourceSettings?: unknown;
      recommendationSettings?: unknown;
    };
    const profileId = String(
      payload.accountProfileId ?? partition.partitionKey
    );
    const updatedAt = payload.lastImportedAt;
    return {
      schemaVersion: 1,
      records: [
        {
          kind: "frozen",
          count: Object.keys(payload.freeze?.frozenTeamLoadouts ?? {}).length,
          profileId,
          ...(updatedAt != null ? { updatedAt } : {}),
        },
        {
          kind: "settings",
          count: countPresentSettings(payload),
          profileId,
          ...(updatedAt != null ? { updatedAt } : {}),
        },
      ],
    };
  }

  if (partition.namespace === "profile.game") {
    const payload = partition.payload as {
      accountProfileId?: number | string;
      characters?: unknown[];
      weapons?: unknown[];
    };
    const profileId = String(
      payload.accountProfileId ?? partition.partitionKey
    );
    const updatedAt = profileUpdatedAt.get(profileId);
    return {
      schemaVersion: 1,
      records: [
        {
          kind: "characters",
          count: payload.characters?.length ?? 0,
          profileId,
          ...(updatedAt != null ? { updatedAt } : {}),
        },
        {
          kind: "weapons",
          count: payload.weapons?.length ?? 0,
          profileId,
          ...(updatedAt != null ? { updatedAt } : {}),
        },
      ],
    };
  }

  if (partition.namespace === "profile.artifacts") {
    const payload = partition.payload as {
      accountProfileId?: number | string;
      artifacts?: unknown[];
    };
    const profileId = String(
      payload.accountProfileId ?? partition.partitionKey
    );
    return {
      schemaVersion: 1,
      records: [
        {
          kind: "artifacts",
          count: payload.artifacts?.length ?? 0,
          profileId,
          ...(profileUpdatedAt.get(profileId) != null
            ? { updatedAt: profileUpdatedAt.get(profileId) }
            : {}),
        },
      ],
    };
  }

  if (partition.namespace === "builds") {
    const payload = partition.payload as {
      deltas?: BackupMetadataDelta[];
      updatedAt?: number;
    };
    const updatedAt = finiteTimestamp(payload.updatedAt);
    return {
      schemaVersion: 1,
      records: [
        {
          kind: "builds",
          count: payload.deltas?.filter(isUserVisibleBuildDelta).length ?? 0,
          ...(updatedAt != null ? { updatedAt } : {}),
        },
      ],
    };
  }

  if (partition.namespace === "teams") {
    const payload = partition.payload as {
      compDeltas?: BackupMetadataDelta[];
      configsByTeamId?: Record<string, unknown>;
      updatedAt?: number;
    };
    const updatedAt = finiteTimestamp(payload.updatedAt);
    return {
      schemaVersion: 1,
      records: [
        {
          kind: "teams",
          count:
            payload.compDeltas?.filter(isUserVisiblePresetDelta).length ?? 0,
          ...(updatedAt != null ? { updatedAt } : {}),
        },
        {
          kind: "teamConfigs",
          count: Object.keys(payload.configsByTeamId ?? {}).length,
          ...(updatedAt != null ? { updatedAt } : {}),
        },
      ],
    };
  }

  if (partition.namespace === "tiers") {
    const payload = partition.payload as TiersCloudPayload;
    const updatedAt = finiteTimestamp(payload.updatedAt);
    return {
      schemaVersion: 1,
      records: [
        {
          kind: "tiers",
          count: countUserVisibleTierLists(payload),
          ...(updatedAt != null ? { updatedAt } : {}),
        },
      ],
    };
  }

  return { schemaVersion: 1, records: [] };
}

function finiteTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function countPresentSettings(payload: {
  triageSettings?: unknown;
  resourceSettings?: unknown;
  recommendationSettings?: unknown;
}) {
  return [
    "triageSettings" in payload,
    "resourceSettings" in payload,
    "recommendationSettings" in payload,
  ].filter(Boolean).length;
}

type BackupMetadataDelta = {
  kind?: string;
  deleted?: true;
  displayIndex?: number;
};

function isUserVisibleBuildDelta(delta: BackupMetadataDelta): boolean {
  return (
    delta.kind === "custom" ||
    delta.deleted === true ||
    delta.displayIndex != null
  );
}

function isUserVisiblePresetDelta(delta: BackupMetadataDelta): boolean {
  return (
    delta.kind === "custom" ||
    delta.deleted === true ||
    delta.displayIndex != null
  );
}

function countUserVisibleTierLists(payload: TiersCloudPayload): number {
  return (
    payload.character.lists.filter(isUserVisibleCharacterTierList).length +
    payload.weapon.lists.filter(isUserVisibleGenericTierList).length +
    payload.artifact.lists.filter(isUserVisibleGenericTierList).length
  );
}

function isUserVisibleGenericTierList(list: TierListPayload): boolean {
  return (
    Object.keys(list.tierAssignments).length > 0 ||
    Object.keys(list.tierCustomization).length > 0 ||
    (list.title ?? "") !== "" ||
    (list.author ?? "") !== "" ||
    (list.description ?? "") !== ""
  );
}

function isUserVisibleCharacterTierList(list: TierListPayload): boolean {
  return (
    isUserVisibleGenericTierList(list) || list.linkedAccountProfileId != null
  );
}

function collectProfileUpdatedAt(partitions: CloudExportPartition[]) {
  const profileUpdatedAt = new Map<string, number>();
  for (const partition of partitions) {
    if (partition.namespace !== "profile.app") continue;
    const payload = partition.payload as {
      accountProfileId?: number | string;
      lastImportedAt?: number;
    };
    if (payload.lastImportedAt == null) continue;
    profileUpdatedAt.set(
      String(payload.accountProfileId ?? partition.partitionKey),
      payload.lastImportedAt
    );
  }
  return profileUpdatedAt;
}

function createMutableSide(
  sides: Map<BackupMetadataRowId, MutableSide>,
  rowId: BackupMetadataRowId
): MutableSide {
  const side = {
    count: 0,
    partitionIds: new Set<string>(),
  };
  sides.set(rowId, side);
  return side;
}

function addCount(
  side: MutableSide,
  count: number,
  partitionIdValue: CloudPartitionId,
  updatedAt: number | undefined
) {
  side.count += count;
  side.partitionIds.add(partitionIdValue);
  if (updatedAt != null) {
    side.updatedAt = Math.max(side.updatedAt ?? 0, updatedAt);
  }
}

function freezeSide(side: MutableSide): BackupMetadataSide {
  return {
    hasRecord: side.partitionIds.size > 0,
    count: side.count,
    ...(side.updatedAt != null ? { updatedAt: side.updatedAt } : {}),
    partitionCount: side.partitionIds.size,
  };
}

function emptyBackupMetadataRows(): BackupMetadataRow[] {
  return BACKUP_METADATA_KIND_ORDER.filter(
    (kind) => !PROFILE_SCOPED_KINDS.has(kind)
  ).map((kind) => ({
    id: makeBackupMetadataRowId(kind),
    kind,
    local: emptySide(),
    cloud: emptySide(),
  }));
}

function emptySide(): BackupMetadataSide {
  return { hasRecord: false, count: 0, partitionCount: 0 };
}

function partitionId(
  namespace: CloudNamespace,
  partitionKey: string
): CloudPartitionId {
  return `${namespace}/${partitionKey}` as CloudPartitionId;
}

function makeBackupMetadataRowId(
  kind: CloudBackupRecordKind,
  profileId?: string
): BackupMetadataRowId {
  return profileId ? `${kind}/${profileId}` : kind;
}

function parseBackupMetadataRowId(id: BackupMetadataRowId): {
  kind: CloudBackupRecordKind;
  profileId?: string;
} {
  const [kind, profileId] = id.split("/", 2);
  return {
    kind: kind as CloudBackupRecordKind,
    ...(profileId != null ? { profileId } : {}),
  };
}

function profileIdFromPartitionId(id: CloudPartitionId): string | undefined {
  const [namespace, partitionKey] = id.split("/", 2);
  return namespace.startsWith("profile.") ? partitionKey : undefined;
}

function sortMetadataRows(rows: BackupMetadataRow[]): BackupMetadataRow[] {
  const kindOrder = new Map(
    BACKUP_METADATA_KIND_ORDER.map((kind, index) => [kind, index])
  );
  return rows.sort((a, b) => {
    const kindDiff =
      (kindOrder.get(a.kind) ?? 999) - (kindOrder.get(b.kind) ?? 999);
    if (kindDiff !== 0) return kindDiff;
    return (a.profileId ?? "").localeCompare(b.profileId ?? "");
  });
}
