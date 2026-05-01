import { encodePathSegment } from "@/cloud/payload";
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

export function characterTiersToCloud(
  snapshot: CharacterTierListSnapshot
): CloudExportPartition<TierListPayload>[] {
  return Object.values(snapshot.tierLists).map((list) => {
    const linked = list.linkedAccountId != null;
    return {
      namespace: linked ? "tier.character.account" : "tier.character.custom",
      partitionKey: encodePathSegment(
        linked ? (list.linkedAccountId ?? "") : listId(list.id)
      ),
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      payload: tierListPayload(list, {
        linkedAccountProfileId: list.linkedAccountId,
      }),
    };
  });
}

export function genericTiersToCloud(
  snapshot: GenericTierListSnapshot,
  namespace: "tier.weapon" | "tier.artifact"
): CloudExportPartition<TierListPayload>[] {
  return Object.values(snapshot.tierLists).map((list) => ({
    namespace,
    partitionKey: listId(list.id),
    schemaVersion: 1,
    conflictPolicy: "explicit-choice",
    payload: tierListPayload(list),
  }));
}

export function characterTiersFromCloud(
  partitions: CloudExportPartition[]
): CharacterTierListSnapshot {
  const lists = partitions
    .filter(
      (partition) =>
        partition.namespace === "tier.character.account" ||
        partition.namespace === "tier.character.custom"
    )
    .map((partition) => partition.payload as TierListPayload)
    .map((payload, index) => characterTierListFromPayload(payload, index + 1));
  return tierSnapshot(lists);
}

export function genericTiersFromCloud(
  partitions: CloudExportPartition[],
  namespace: "tier.weapon" | "tier.artifact"
): GenericTierListSnapshot {
  const lists = partitions
    .filter((partition) => partition.namespace === namespace)
    .map((partition) => partition.payload as TierListPayload)
    .map((payload, index) => tierListFromPayload(payload, index + 1));
  return tierSnapshot(lists);
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

function tierSnapshot<TList extends TierListInstanceSnapshot>(lists: TList[]) {
  const fallback = lists.length ? lists : [emptyList(1) as TList];
  const tierLists = Object.fromEntries(
    fallback.map((list) => [list.id, list])
  ) as Record<number, TList>;
  const ids = Object.keys(tierLists).map(Number);
  const activeTierListId = Math.min(...ids);
  return {
    tierLists,
    activeTierListId,
    nextId: Math.max(...ids) + 1,
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
