import type { CloudExportPartition } from "@/cloud/types";
import type { TierAssignment, TierCustomization } from "@/data/types";
import type { AccountProfileId } from "@/lib/account-data/types";

export type CharacterTierListSnapshot = {
  tierLists: Record<number, CharacterTierListInstanceSnapshot>;
  activeTierListId: number;
  nextId: number;
};

export type GenericTierListSnapshot = {
  tierLists: Record<number, TierListInstanceSnapshot>;
  activeTierListId: number;
  nextId: number;
};

export type TierListInstanceSnapshot = {
  id: number;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;
};

export type CharacterTierListInstanceSnapshot = TierListInstanceSnapshot & {
  linkedAccountId: AccountProfileId | null;
};

export type TierListPayload = {
  id: string;
  linkedAccountProfileId?: AccountProfileId | null;
  title?: string;
  author?: string;
  description?: string;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
};

export type TiersCloudSnapshot = {
  character: CharacterTierListSnapshot;
  weapon: GenericTierListSnapshot;
  artifact: GenericTierListSnapshot;
};

export type TiersCloudPayload = {
  character: {
    activeTierListId: number;
    nextId: number;
    lists: TierListPayload[];
  };
  weapon: {
    activeTierListId: number;
    nextId: number;
    lists: TierListPayload[];
  };
  artifact: {
    activeTierListId: number;
    nextId: number;
    lists: TierListPayload[];
  };
};

export function tiersToCloud(
  snapshot: TiersCloudSnapshot
): CloudExportPartition<TiersCloudPayload>[] {
  return [
    {
      namespace: "tiers",
      partitionKey: "all",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      payload: {
        character: characterTierPayload(snapshot.character),
        weapon: genericTierPayload(snapshot.weapon),
        artifact: genericTierPayload(snapshot.artifact),
      },
    },
  ];
}

export function tiersFromCloud(partitions: CloudExportPartition[]) {
  const current = partitions.find(
    (partition) => partition.namespace === "tiers"
  )?.payload as TiersCloudPayload | undefined;
  return {
    character: current
      ? characterSnapshotFromPayload(current.character)
      : tierSnapshot<CharacterTierListInstanceSnapshot>([]),
    weapon: current
      ? genericSnapshotFromPayload(current.weapon)
      : tierSnapshot<TierListInstanceSnapshot>([]),
    artifact: current
      ? genericSnapshotFromPayload(current.artifact)
      : tierSnapshot<TierListInstanceSnapshot>([]),
  };
}

function characterTierPayload(snapshot: CharacterTierListSnapshot) {
  return {
    activeTierListId: snapshot.activeTierListId,
    nextId: snapshot.nextId,
    lists: Object.values(snapshot.tierLists).map((list) =>
      tierListPayload(list, { linkedAccountProfileId: list.linkedAccountId })
    ),
  };
}

function genericTierPayload(snapshot: GenericTierListSnapshot) {
  return {
    activeTierListId: snapshot.activeTierListId,
    nextId: snapshot.nextId,
    lists: Object.values(snapshot.tierLists).map((list) =>
      tierListPayload(list)
    ),
  };
}

function characterSnapshotFromPayload(
  payload: TiersCloudPayload["character"]
): CharacterTierListSnapshot {
  const lists = payload.lists.map((list, index) =>
    characterTierListFromPayload(list, index + 1)
  );
  return tierSnapshot(lists, payload.activeTierListId, payload.nextId);
}

function genericSnapshotFromPayload(
  payload: TiersCloudPayload["weapon"] | TiersCloudPayload["artifact"]
): GenericTierListSnapshot {
  const lists = payload.lists.map((list, index) =>
    tierListFromPayload(list, index + 1)
  );
  return tierSnapshot(lists, payload.activeTierListId, payload.nextId);
}

function tierListPayload(
  list: TierListInstanceSnapshot,
  options: { linkedAccountProfileId?: AccountProfileId | null } = {}
): TierListPayload {
  return {
    id: listId(list.id),
    ...(options.linkedAccountProfileId !== undefined
      ? { linkedAccountProfileId: options.linkedAccountProfileId }
      : {}),
    title: list.customTitle,
    author: list.author,
    description: list.description,
    tierAssignments: list.tierAssignments,
    tierCustomization: list.tierCustomization,
  };
}

function tierListFromPayload(
  payload: TierListPayload,
  fallbackId: number
): TierListInstanceSnapshot {
  return {
    id: parseListId(payload.id) ?? fallbackId,
    tierAssignments: payload.tierAssignments,
    tierCustomization: payload.tierCustomization,
    customTitle: payload.title ?? "",
    author: payload.author ?? "",
    description: payload.description ?? "",
  };
}

function characterTierListFromPayload(
  payload: TierListPayload,
  fallbackId: number
): CharacterTierListInstanceSnapshot {
  return {
    ...tierListFromPayload(payload, fallbackId),
    linkedAccountId: payload.linkedAccountProfileId ?? null,
  };
}

function tierSnapshot<TList extends TierListInstanceSnapshot>(
  lists: TList[],
  activeId?: number,
  nextId?: number
) {
  const fallback = lists.length ? lists : [emptyList(1) as TList];
  const tierLists = Object.fromEntries(
    fallback.map((list) => [list.id, list])
  ) as Record<number, TList>;
  const ids = Object.keys(tierLists).map(Number);
  const activeTierListId =
    activeId != null && tierLists[activeId] ? activeId : Math.min(...ids);
  return {
    tierLists,
    activeTierListId,
    nextId: Math.max(nextId ?? 0, Math.max(...ids) + 1),
  };
}

function emptyList(id: number): TierListInstanceSnapshot {
  return {
    id,
    tierAssignments: {},
    tierCustomization: {},
    customTitle: "",
    author: "",
    description: "",
  };
}

function listId(id: number) {
  return `list-${id}`;
}

function parseListId(id: string) {
  const match = /^list-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}
