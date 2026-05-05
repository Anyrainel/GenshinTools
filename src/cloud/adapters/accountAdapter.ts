import { encodePathSegment } from "@/cloud/payload";
import type { CloudExportPartition } from "@/cloud/types";
import { allSlots, type Slot } from "@/data/enums";
import { weaponsById } from "@/data/gameResources";
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  WeaponData,
} from "@/data/types";
import { createLocatedCharacterPlaceholder } from "@/lib/account-data/import/locationCharacters";
import type { AccountProfileId, AccountState } from "@/lib/account-data/types";
import {
  assignArtifactIdentities,
  assignWeaponIdentities,
  type CloudItemIdentity,
} from "./itemIdentity";

export type ArtifactReuseMode = "none" | "sameChar" | "forceReuse";

export type FrozenArtifactIdsByChar = Record<
  string,
  Partial<Record<Slot, string>>
>;

export type FrozenTeamLoadout = {
  frozenCharIds: string[];
  artifactIdsByChar: FrozenArtifactIdsByChar;
};

export type FrozenProfileStateSnapshot = {
  frozenTeamLoadouts: Record<string, FrozenTeamLoadout>;
  reuseMode: ArtifactReuseMode;
  frozenArtifactIds: string[];
};

export type AccountCloudSnapshot = {
  accounts: Record<AccountProfileId, AccountState>;
  activeAccountId: AccountProfileId | null;
  freezesByProfileId?: Record<AccountProfileId, FrozenProfileStateSnapshot>;
  triageByProfileId?: Record<AccountProfileId, unknown>;
  resourcesByProfileId?: Record<AccountProfileId, unknown>;
  recommendationsByProfileId?: Record<AccountProfileId, unknown>;
};

export type AccountAppPayload = {
  accountProfileId: AccountProfileId;
  name: string;
  uid?: number;
  isActive?: boolean;
  lastImportedAt?: number;
  freeze?: FrozenProfileStateSnapshot;
  triageSettings?: unknown;
  resourceSettings?: unknown;
  recommendationSettings?: unknown;
};

export type AccountRosterPayload = {
  accountProfileId: AccountProfileId;
  characters: {
    key: string;
    level: number;
    constellation: number;
    talent: [number, number, number];
  }[];
  weapons: {
    id: string;
    identity: CloudItemIdentity;
    key: string;
    level: number;
    refinement: number;
    lock: boolean;
    equippedCharacterId?: string;
  }[];
};

export type AccountArtifactsPayload = {
  accountProfileId: AccountProfileId;
  artifacts: {
    id: string;
    identity: CloudItemIdentity;
    setKey: string;
    slotKey: Slot;
    level: number;
    rarity: ArtifactData["rarity"];
    mainStatKey: ArtifactData["mainStatKey"];
    lock: boolean;
    substats: ArtifactData["substats"];
    totalRolls?: number;
    astralMark?: boolean;
    elixirCrafted?: boolean;
    unactivatedSubstats?: ArtifactData["unactivatedSubstats"];
    initialValues?: ArtifactData["initialValues"];
    equippedCharacterId?: string;
  }[];
};

export type AccountRestorePatch = {
  accounts: Record<AccountProfileId, AccountState>;
  activeAccountId: AccountProfileId | null;
  shardPresenceByProfileId: Record<
    AccountProfileId,
    {
      app?: boolean;
      game?: boolean;
      artifacts?: boolean;
    }
  >;
  freezesByProfileId: Record<AccountProfileId, FrozenProfileStateSnapshot>;
  triageByProfileId: Record<AccountProfileId, unknown>;
  resourcesByProfileId: Record<AccountProfileId, unknown>;
  recommendationsByProfileId: Record<AccountProfileId, unknown>;
};

export function accountToCloud(
  snapshot: AccountCloudSnapshot
): CloudExportPartition[] {
  return Object.values(snapshot.accounts).flatMap((account) =>
    accountToCloudPartitions(account, snapshot)
  );
}

export function accountFromCloud(
  partitions: CloudExportPartition[]
): AccountRestorePatch {
  const apps = byProfile<AccountAppPayload>(partitions, "profile.app");
  const rosters = byProfile<AccountRosterPayload>(partitions, "profile.game");
  const artifactsByProfile = new Map<
    AccountProfileId,
    AccountArtifactsPayload
  >();
  for (const partition of partitions) {
    if (partition.namespace !== "profile.artifacts") continue;
    const payload = partition.payload as AccountArtifactsPayload;
    artifactsByProfile.set(payload.accountProfileId, payload);
  }

  const profileIds = new Set<AccountProfileId>([
    ...apps.keys(),
    ...rosters.keys(),
    ...artifactsByProfile.keys(),
  ]);

  const accounts: Record<AccountProfileId, AccountState> = {};
  const freezesByProfileId: Record<
    AccountProfileId,
    FrozenProfileStateSnapshot
  > = {};
  const triageByProfileId: Record<AccountProfileId, unknown> = {};
  const resourcesByProfileId: Record<AccountProfileId, unknown> = {};
  const recommendationsByProfileId: Record<AccountProfileId, unknown> = {};
  const shardPresenceByProfileId: AccountRestorePatch["shardPresenceByProfileId"] =
    {};
  let activeAccountId: AccountProfileId | null = null;
  for (const profileId of profileIds) {
    const app = apps.get(profileId);
    shardPresenceByProfileId[profileId] = {
      ...(app ? { app: true } : {}),
      ...(rosters.has(profileId) ? { game: true } : {}),
      ...(artifactsByProfile.has(profileId) ? { artifacts: true } : {}),
    };
    if (app?.isActive) activeAccountId = profileId;
    if (app?.freeze) freezesByProfileId[profileId] = app.freeze;
    if (app && "triageSettings" in app) {
      triageByProfileId[profileId] = app.triageSettings;
    }
    if (app && "resourceSettings" in app) {
      resourcesByProfileId[profileId] = app.resourceSettings;
    }
    if (app && "recommendationSettings" in app) {
      recommendationsByProfileId[profileId] = app.recommendationSettings;
    }
    accounts[profileId] = {
      id: profileId,
      name: app?.name ?? `Account ${profileId}`,
      lastUpdate: app?.lastImportedAt ?? Date.now(),
      data: restoreAccountData(
        rosters.get(profileId),
        artifactsByProfile.get(profileId)
      ),
    };
  }

  return {
    accounts,
    activeAccountId,
    shardPresenceByProfileId,
    freezesByProfileId,
    triageByProfileId,
    resourcesByProfileId,
    recommendationsByProfileId,
  };
}

function accountToCloudPartitions(
  account: AccountState,
  snapshot: AccountCloudSnapshot
): CloudExportPartition[] {
  const { weaponByLocalId, weapons, weaponEquippedCharacterByLocalId } =
    collectWeapons(account.data);
  const { artifacts, artifactEquippedCharacterByLocalId } = collectArtifacts(
    account.data
  );
  const identifiedWeapons = assignWeaponIdentities(weapons);
  const identifiedArtifacts = assignArtifactIdentities(artifacts);
  const artifactIdByLocalId = new Map(
    identifiedArtifacts.map((entry) => [entry.localId, entry.cloudId])
  );

  return [
    cloudPartition("profile.app", String(account.id), {
      accountProfileId: account.id,
      name: account.name,
      ...(account.id !== 0 ? { uid: account.id } : {}),
      ...(account.id === snapshot.activeAccountId ? { isActive: true } : {}),
      lastImportedAt: account.lastUpdate,
      ...(snapshot.freezesByProfileId?.[account.id]
        ? {
            freeze: toCloudFreezeProfile(
              snapshot.freezesByProfileId[account.id],
              artifactIdByLocalId
            ),
          }
        : {}),
      ...(account.id in (snapshot.triageByProfileId ?? {})
        ? { triageSettings: snapshot.triageByProfileId?.[account.id] }
        : {}),
      ...(account.id in (snapshot.resourcesByProfileId ?? {})
        ? { resourceSettings: snapshot.resourcesByProfileId?.[account.id] }
        : {}),
      ...(account.id in (snapshot.recommendationsByProfileId ?? {})
        ? {
            recommendationSettings:
              snapshot.recommendationsByProfileId?.[account.id],
          }
        : {}),
    } satisfies AccountAppPayload),
    cloudPartition("profile.game", String(account.id), {
      accountProfileId: account.id,
      characters: account.data.characters.map((character) => ({
        key: character.key,
        level: character.level,
        constellation: character.constellation,
        talent: [
          character.talent.auto,
          character.talent.skill,
          character.talent.burst,
        ],
      })),
      weapons: identifiedWeapons
        .filter(
          (entry) =>
            !shouldSkipWeaponForCloud(
              entry.item,
              isWeaponEquipped(entry.localId, weaponByLocalId, account.data)
            )
        )
        .map((entry) => ({
          id: entry.cloudId,
          identity: entry.identity,
          key: entry.item.key,
          level: entry.item.level,
          refinement: entry.item.refinement,
          lock: entry.item.lock,
          ...(weaponEquippedCharacterByLocalId.get(entry.localId)
            ? {
                equippedCharacterId: weaponEquippedCharacterByLocalId.get(
                  entry.localId
                ),
              }
            : {}),
        })),
    } satisfies AccountRosterPayload),
    cloudPartition("profile.artifacts", String(account.id), {
      accountProfileId: account.id,
      artifacts: identifiedArtifacts.map((entry) =>
        toCloudArtifact(entry, artifactEquippedCharacterByLocalId)
      ),
    } satisfies AccountArtifactsPayload),
  ];
}

function cloudPartition<TPayload>(
  namespace: CloudExportPartition<TPayload>["namespace"],
  partitionKey: string,
  payload: TPayload
): CloudExportPartition<TPayload> {
  return {
    namespace,
    partitionKey: encodePathSegment(partitionKey),
    schemaVersion: 1,
    conflictPolicy: "profile-import-wins",
    payload,
  };
}

function collectWeapons(data: AccountData) {
  const weaponByLocalId = new Map<string, WeaponData>();
  const weaponEquippedCharacterByLocalId = new Map<string, string>();
  for (const character of data.characters) {
    if (character.weapon) {
      weaponByLocalId.set(character.weapon.id, character.weapon);
      weaponEquippedCharacterByLocalId.set(character.weapon.id, character.key);
    }
  }
  for (const weapon of data.extraWeapons)
    weaponByLocalId.set(weapon.id, weapon);
  return {
    weaponByLocalId,
    weaponEquippedCharacterByLocalId,
    weapons: [...weaponByLocalId.values()],
  };
}

function collectArtifacts(data: AccountData) {
  const artifactByLocalId = new Map<string, ArtifactData>();
  const artifactEquippedCharacterByLocalId = new Map<string, string>();
  for (const character of data.characters) {
    for (const artifact of Object.values(character.artifacts)) {
      if (artifact) {
        artifactByLocalId.set(artifact.id, artifact);
        artifactEquippedCharacterByLocalId.set(artifact.id, character.key);
      }
    }
  }
  for (const artifact of data.extraArtifacts) {
    artifactByLocalId.set(artifact.id, artifact);
  }
  return {
    artifactByLocalId,
    artifactEquippedCharacterByLocalId,
    artifacts: [...artifactByLocalId.values()],
  };
}

function isWeaponEquipped(
  localWeaponId: string,
  weaponByLocalId: Map<string, WeaponData>,
  data: AccountData
) {
  const weapon = weaponByLocalId.get(localWeaponId);
  return (
    !!weapon && data.characters.some((character) => character.weapon === weapon)
  );
}

function shouldSkipWeaponForCloud(weapon: WeaponData, equipped: boolean) {
  const rarity = weaponsById[weapon.key]?.rarity;
  return (
    !weapon.lock &&
    rarity === 3 &&
    weapon.level === 1 &&
    weapon.refinement === 1 &&
    !equipped
  );
}

function toCloudArtifact(
  entry: ReturnType<typeof assignArtifactIdentities>[number],
  artifactEquippedCharacterByLocalId: Map<string, string>
): AccountArtifactsPayload["artifacts"][number] {
  return {
    id: entry.cloudId,
    identity: entry.identity,
    setKey: entry.item.setKey,
    slotKey: entry.item.slotKey,
    level: entry.item.level,
    rarity: entry.item.rarity,
    mainStatKey: entry.item.mainStatKey,
    lock: entry.item.lock,
    substats: entry.item.substats,
    ...(entry.item.totalRolls != null
      ? { totalRolls: entry.item.totalRolls }
      : {}),
    ...(entry.item.astralMark != null
      ? { astralMark: entry.item.astralMark }
      : {}),
    ...(entry.item.elixirCrafted != null
      ? { elixirCrafted: entry.item.elixirCrafted }
      : {}),
    ...(entry.item.unactivatedSubstats
      ? { unactivatedSubstats: entry.item.unactivatedSubstats }
      : {}),
    ...(entry.item.initialValues
      ? { initialValues: entry.item.initialValues }
      : {}),
    ...(artifactEquippedCharacterByLocalId.get(entry.localId)
      ? {
          equippedCharacterId: artifactEquippedCharacterByLocalId.get(
            entry.localId
          ),
        }
      : {}),
  };
}

function toCloudFreezeProfile(
  profile: FrozenProfileStateSnapshot,
  artifactIdByLocalId: Map<string, string>
): FrozenProfileStateSnapshot {
  const mapArtifactId = (id: string) => artifactIdByLocalId.get(id) ?? id;
  const frozenTeamLoadouts: FrozenProfileStateSnapshot["frozenTeamLoadouts"] =
    {};
  for (const [teamId, loadout] of Object.entries(profile.frozenTeamLoadouts)) {
    frozenTeamLoadouts[teamId] = {
      frozenCharIds: [...loadout.frozenCharIds],
      artifactIdsByChar: Object.fromEntries(
        Object.entries(loadout.artifactIdsByChar).map(([charId, ids]) => [
          charId,
          Object.fromEntries(
            allSlots.flatMap((slot) => {
              const id = ids[slot];
              return id ? [[slot, mapArtifactId(id)]] : [];
            })
          ) as Partial<Record<Slot, string>>,
        ])
      ),
    };
  }
  return {
    reuseMode: profile.reuseMode,
    frozenArtifactIds: profile.frozenArtifactIds.map(mapArtifactId),
    frozenTeamLoadouts,
  };
}

function byProfile<TPayload extends { accountProfileId: AccountProfileId }>(
  partitions: CloudExportPartition[],
  namespace: CloudExportPartition["namespace"]
): Map<AccountProfileId, TPayload> {
  const map = new Map<AccountProfileId, TPayload>();
  for (const partition of partitions) {
    if (partition.namespace !== namespace) continue;
    const payload = partition.payload as TPayload;
    map.set(payload.accountProfileId, payload);
  }
  return map;
}

function restoreAccountData(
  rosterPayload: AccountRosterPayload | undefined,
  artifactPayload: AccountArtifactsPayload | undefined
): AccountData {
  const weaponByCharId = new Map(
    (rosterPayload?.weapons ?? []).flatMap((weapon) => {
      if (!weapon.equippedCharacterId) return [];
      return [
        [
          weapon.equippedCharacterId,
          {
            id: weapon.id,
            key: weapon.key,
            level: weapon.level,
            refinement: weapon.refinement,
            lock: weapon.lock,
          } satisfies WeaponData,
        ],
      ];
    })
  );
  const equippedWeaponIds = new Set(
    (rosterPayload?.weapons ?? [])
      .filter((weapon) => weapon.equippedCharacterId)
      .map((weapon) => weapon.id)
  );
  const artifactsByCharId = new Map<
    string,
    Partial<Record<Slot, ArtifactData>>
  >();
  const equippedArtifactIds = new Set<string>();
  const artifactById = new Map(
    (artifactPayload?.artifacts ?? []).map((artifact) => [
      artifact.id,
      artifactFromPayload(artifact),
    ])
  );

  for (const artifact of artifactPayload?.artifacts ?? []) {
    if (!artifact.equippedCharacterId) continue;
    const bySlot = artifactsByCharId.get(artifact.equippedCharacterId) ?? {};
    const restored = artifactById.get(artifact.id);
    if (restored) {
      bySlot[artifact.slotKey] = restored;
      equippedArtifactIds.add(artifact.id);
    }
    artifactsByCharId.set(artifact.equippedCharacterId, bySlot);
  }

  const rosterCharacters = rosterPayload?.characters ?? [];
  const rosterCharacterIds = new Set(
    rosterCharacters.map((character) => character.key)
  );
  const locationOnlyCharacterIds = [
    ...new Set(
      [
        ...(rosterPayload?.weapons ?? []),
        ...(artifactPayload?.artifacts ?? []),
      ].flatMap((item) =>
        item.equippedCharacterId &&
        !rosterCharacterIds.has(item.equippedCharacterId)
          ? [item.equippedCharacterId]
          : []
      )
    ),
  ];
  const characters: CharacterData[] = [
    ...rosterCharacters.map((character) => ({
      key: character.key,
      level: character.level,
      constellation: character.constellation,
      talent: {
        auto: character.talent[0],
        skill: character.talent[1],
        burst: character.talent[2],
      },
      ...(weaponByCharId.get(character.key)
        ? { weapon: weaponByCharId.get(character.key) }
        : {}),
      artifacts: artifactsByCharId.get(character.key) ?? {},
    })),
    ...locationOnlyCharacterIds.map((characterId) => ({
      ...createLocatedCharacterPlaceholder(characterId),
      ...(weaponByCharId.get(characterId)
        ? { weapon: weaponByCharId.get(characterId) }
        : {}),
      artifacts: artifactsByCharId.get(characterId) ?? {},
    })),
  ];

  return {
    characters,
    extraWeapons: (rosterPayload?.weapons ?? [])
      .filter((weapon) => !equippedWeaponIds.has(weapon.id))
      .map(
        (weapon) =>
          ({
            id: weapon.id,
            key: weapon.key,
            level: weapon.level,
            refinement: weapon.refinement,
            lock: weapon.lock,
          }) satisfies WeaponData
      ),
    extraArtifacts: [...artifactById.values()].filter(
      (artifact) => !equippedArtifactIds.has(artifact.id)
    ),
  };
}

function artifactFromPayload(
  artifact: AccountArtifactsPayload["artifacts"][number]
): ArtifactData {
  return {
    id: artifact.id,
    setKey: artifact.setKey,
    slotKey: artifact.slotKey,
    level: artifact.level,
    rarity: artifact.rarity,
    mainStatKey: artifact.mainStatKey,
    lock: artifact.lock,
    substats: artifact.substats,
    ...(artifact.totalRolls != null ? { totalRolls: artifact.totalRolls } : {}),
    ...(artifact.astralMark != null ? { astralMark: artifact.astralMark } : {}),
    ...(artifact.elixirCrafted != null
      ? { elixirCrafted: artifact.elixirCrafted }
      : {}),
    ...(artifact.unactivatedSubstats
      ? { unactivatedSubstats: artifact.unactivatedSubstats }
      : {}),
    ...(artifact.initialValues
      ? { initialValues: artifact.initialValues }
      : {}),
  };
}
