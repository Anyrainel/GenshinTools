import { encodePathSegment } from "@/cloud/payload";
import type { CloudExportPartition } from "@/cloud/types";
import type { Slot } from "@/data/enums";
import { weaponsById } from "@/data/gameResources";
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  WeaponData,
} from "@/data/types";
import type { AccountProfileId, AccountState } from "@/lib/account-data/types";
import {
  assignArtifactIdentities,
  assignWeaponIdentities,
  type CloudItemIdentity,
} from "./itemIdentity";
import { getArtifactSetGroup } from "./setGroup";

export type AccountCloudSnapshot = {
  accounts: Record<AccountProfileId, AccountState>;
  activeAccountId: AccountProfileId | null;
};

export type AccountProfilePayload = {
  accountProfileId: AccountProfileId;
  name: string;
  uid?: number;
  lastImportedAt?: number;
};

export type AccountCharactersPayload = {
  accountProfileId: AccountProfileId;
  characters: {
    key: string;
    level: number;
    constellation: number;
    talent: [number, number, number];
  }[];
};

export type AccountWeaponsPayload = {
  accountProfileId: AccountProfileId;
  weapons: {
    id: string;
    identity: CloudItemIdentity;
    key: string;
    level: number;
    refinement: number;
    lock: boolean;
  }[];
};

export type AccountArtifactsPayload = {
  accountProfileId: AccountProfileId;
  setGroup: string;
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
  }[];
};

export type AccountEquipmentPayload = {
  accountProfileId: AccountProfileId;
  equipment: {
    charId: string;
    weaponId?: string;
    artifactIds?: Partial<Record<Slot, string>>;
  }[];
};

export type AccountRestorePatch = {
  accounts: Record<AccountProfileId, AccountState>;
};

export function accountToCloud(
  snapshot: AccountCloudSnapshot
): CloudExportPartition[] {
  return Object.values(snapshot.accounts).flatMap(accountToCloudPartitions);
}

export function accountFromCloud(
  partitions: CloudExportPartition[]
): AccountRestorePatch {
  const profiles = byProfile<AccountProfilePayload>(
    partitions,
    "account.profile"
  );
  const characters = byProfile<AccountCharactersPayload>(
    partitions,
    "account.characters"
  );
  const weapons = byProfile<AccountWeaponsPayload>(
    partitions,
    "account.weapons"
  );
  const equipment = byProfile<AccountEquipmentPayload>(
    partitions,
    "account.equipment"
  );
  const artifactsByProfile = new Map<
    AccountProfileId,
    AccountArtifactsPayload[]
  >();
  for (const partition of partitions) {
    if (partition.namespace !== "account.artifacts") continue;
    const payload = partition.payload as AccountArtifactsPayload;
    const group = artifactsByProfile.get(payload.accountProfileId);
    if (group) group.push(payload);
    else artifactsByProfile.set(payload.accountProfileId, [payload]);
  }

  const profileIds = new Set<AccountProfileId>([
    ...profiles.keys(),
    ...characters.keys(),
    ...weapons.keys(),
    ...equipment.keys(),
    ...artifactsByProfile.keys(),
  ]);

  const accounts: Record<AccountProfileId, AccountState> = {};
  for (const profileId of profileIds) {
    const profile = profiles.get(profileId);
    accounts[profileId] = {
      id: profileId,
      name: profile?.name ?? `Account ${profileId}`,
      lastUpdate: profile?.lastImportedAt ?? Date.now(),
      data: restoreAccountData(
        characters.get(profileId),
        weapons.get(profileId),
        artifactsByProfile.get(profileId) ?? [],
        equipment.get(profileId)
      ),
    };
  }

  return { accounts };
}

function accountToCloudPartitions(
  account: AccountState
): CloudExportPartition[] {
  const { weaponByLocalId, weapons } = collectWeapons(account.data);
  const { artifacts } = collectArtifacts(account.data);
  const identifiedWeapons = assignWeaponIdentities(weapons);
  const identifiedArtifacts = assignArtifactIdentities(artifacts);
  const weaponIdByLocalId = new Map(
    identifiedWeapons.map((entry) => [entry.localId, entry.cloudId])
  );
  const artifactIdByLocalId = new Map(
    identifiedArtifacts.map((entry) => [entry.localId, entry.cloudId])
  );
  const artifactsByGroup = new Map<
    string,
    ReturnType<typeof toCloudArtifact>[]
  >();

  for (const entry of identifiedArtifacts) {
    const cloudArtifact = toCloudArtifact(entry);
    const group = getArtifactSetGroup(entry.item.setKey);
    const existing = artifactsByGroup.get(group);
    if (existing) existing.push(cloudArtifact);
    else artifactsByGroup.set(group, [cloudArtifact]);
  }

  return [
    cloudPartition("account.profile", String(account.id), {
      accountProfileId: account.id,
      name: account.name,
      ...(account.id !== 0 ? { uid: account.id } : {}),
      lastImportedAt: account.lastUpdate,
    } satisfies AccountProfilePayload),
    cloudPartition("account.characters", String(account.id), {
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
    } satisfies AccountCharactersPayload),
    cloudPartition("account.weapons", String(account.id), {
      accountProfileId: account.id,
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
        })),
    } satisfies AccountWeaponsPayload),
    cloudPartition("account.equipment", String(account.id), {
      accountProfileId: account.id,
      equipment: account.data.characters.map((character) => ({
        charId: character.key,
        ...(character.weapon
          ? { weaponId: weaponIdByLocalId.get(character.weapon.id) }
          : {}),
        artifactIds: Object.fromEntries(
          Object.entries(character.artifacts).flatMap(([slot, artifact]) => {
            if (!artifact) return [];
            const cloudId = artifactIdByLocalId.get(artifact.id);
            return cloudId ? [[slot, cloudId]] : [];
          })
        ) as Partial<Record<Slot, string>>,
      })),
    } satisfies AccountEquipmentPayload),
    ...[...artifactsByGroup.entries()].map(([setGroup, artifacts]) =>
      cloudPartition("account.artifacts", `${account.id}:${setGroup}`, {
        accountProfileId: account.id,
        setGroup,
        artifacts,
      } satisfies AccountArtifactsPayload)
    ),
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
    conflictPolicy: "account-import-wins",
    payload,
  };
}

function collectWeapons(data: AccountData) {
  const weaponByLocalId = new Map<string, WeaponData>();
  for (const character of data.characters) {
    if (character.weapon)
      weaponByLocalId.set(character.weapon.id, character.weapon);
  }
  for (const weapon of data.extraWeapons)
    weaponByLocalId.set(weapon.id, weapon);
  return {
    weaponByLocalId,
    weapons: [...weaponByLocalId.values()],
  };
}

function collectArtifacts(data: AccountData) {
  const artifactByLocalId = new Map<string, ArtifactData>();
  for (const character of data.characters) {
    for (const artifact of Object.values(character.artifacts)) {
      if (artifact) artifactByLocalId.set(artifact.id, artifact);
    }
  }
  for (const artifact of data.extraArtifacts) {
    artifactByLocalId.set(artifact.id, artifact);
  }
  return {
    artifactByLocalId,
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
  entry: ReturnType<typeof assignArtifactIdentities>[number]
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
  charactersPayload: AccountCharactersPayload | undefined,
  weaponsPayload: AccountWeaponsPayload | undefined,
  artifactPayloads: AccountArtifactsPayload[],
  equipmentPayload: AccountEquipmentPayload | undefined
): AccountData {
  const weaponById = new Map(
    (weaponsPayload?.weapons ?? []).map((weapon) => [
      weapon.id,
      {
        id: weapon.id,
        key: weapon.key,
        level: weapon.level,
        refinement: weapon.refinement,
        lock: weapon.lock,
      } satisfies WeaponData,
    ])
  );
  const artifactById = new Map(
    artifactPayloads
      .flatMap((payload) => payload.artifacts)
      .map((artifact) => [
        artifact.id,
        {
          id: artifact.id,
          setKey: artifact.setKey,
          slotKey: artifact.slotKey,
          level: artifact.level,
          rarity: artifact.rarity,
          mainStatKey: artifact.mainStatKey,
          lock: artifact.lock,
          substats: artifact.substats,
          ...(artifact.totalRolls != null
            ? { totalRolls: artifact.totalRolls }
            : {}),
          ...(artifact.astralMark != null
            ? { astralMark: artifact.astralMark }
            : {}),
          ...(artifact.elixirCrafted != null
            ? { elixirCrafted: artifact.elixirCrafted }
            : {}),
          ...(artifact.unactivatedSubstats
            ? { unactivatedSubstats: artifact.unactivatedSubstats }
            : {}),
          ...(artifact.initialValues
            ? { initialValues: artifact.initialValues }
            : {}),
        } satisfies ArtifactData,
      ])
  );
  const equipmentByChar = new Map(
    (equipmentPayload?.equipment ?? []).map((entry) => [entry.charId, entry])
  );
  const equippedWeaponIds = new Set<string>();
  const equippedArtifactIds = new Set<string>();

  const characters: CharacterData[] = (charactersPayload?.characters ?? []).map(
    (character) => {
      const equipment = equipmentByChar.get(character.key);
      const weapon = equipment?.weaponId
        ? weaponById.get(equipment.weaponId)
        : undefined;
      if (weapon) equippedWeaponIds.add(weapon.id);
      const artifacts = Object.fromEntries(
        Object.entries(equipment?.artifactIds ?? {}).flatMap(([slot, id]) => {
          const artifact = artifactById.get(id);
          if (!artifact) return [];
          equippedArtifactIds.add(artifact.id);
          return [[slot, artifact]];
        })
      ) as Partial<Record<Slot, ArtifactData>>;
      return {
        key: character.key,
        level: character.level,
        constellation: character.constellation,
        talent: {
          auto: character.talent[0],
          skill: character.talent[1],
          burst: character.talent[2],
        },
        ...(weapon ? { weapon } : {}),
        artifacts,
      };
    }
  );

  return {
    characters,
    extraWeapons: [...weaponById.values()].filter(
      (weapon) => !equippedWeaponIds.has(weapon.id)
    ),
    extraArtifacts: [...artifactById.values()].filter(
      (artifact) => !equippedArtifactIds.has(artifact.id)
    ),
  };
}
