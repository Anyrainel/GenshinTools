import {
  artifactIdMap,
  characterIdMap,
  statIdMap,
  weaponIdMap,
} from "@/data/enkaIdMap";
import type {
  ConversionWarning,
  GOODData,
  IGOODArtifact,
  IGOODCharacter,
  IGOODSubstat,
  IGOODWeapon,
} from "@/lib/goodConversion";

export type SlotKey = "flower" | "plume" | "sands" | "goblet" | "circlet";
export type StatKey = string;
export type SetKey = string;

// --- Enka API Types ---

export interface EnkaResponse {
  playerInfo: PlayerInfo;
  avatarInfoList?: AvatarInfo[];
  ttl?: number;
  uid?: string;
}

export interface PlayerInfo {
  nickname: string;
  level: number;
  signature?: string;
  worldLevel?: number;
  nameCardId?: number;
  finishAchievementNum?: number;
  towerFloorIndex?: number;
  towerLevelIndex?: number;
  showAvatarInfoList?: ShowAvatarInfo[];
  showNameCardIdList?: number[];
  profilePicture?: ProfilePicture;
}

export interface ShowAvatarInfo {
  avatarId: number;
  level: number;
}

export interface ProfilePicture {
  avatarId?: number;
}

export interface AvatarInfo {
  avatarId: number | string;
  propMap?: Record<string, PropMapValue>;
  talentIdList?: number[];
  skillLevelMap?: Record<string, number>;
  equipList?: Equip[];
  fetterInfo?: {
    expLevel: number;
  };
}

export interface PropMapValue {
  type?: number;
  ival?: string;
  val?: string;
}

export interface Equip {
  itemId: number;
  reliquary?: ReliquaryInfo;
  weapon?: WeaponInfo;
  flat: EquipFlat;
}

export interface ReliquaryInfo {
  level: number;
  mainPropId: number;
  appendPropIdList?: number[];
}

export interface WeaponInfo {
  level: number;
  promoteLevel?: number;
  affixMap?: Record<string, number>;
}

export interface EquipFlat {
  nameTextMapHash: string;
  setNameTextMapHash?: string;
  rankLevel: number;
  itemType: "ITEM_WEAPON" | "ITEM_RELIQUARY";
  icon: string;
  setAndKindIcon?: string;
  equipType?: string;
  reliquarySubstats?: ReliquarySubstat[];
  weaponStats?: WeaponStat[];
}

export interface ReliquarySubstat {
  appendPropId: number;
  statValue: number;
}

export interface WeaponStat {
  appendPropId: number;
  statValue: number;
}

// ----------------------

// Proxy to bypass CORS on static site
const CORS_PROXY = "https://corsproxy.io/?";
const ENKA_API_URL = "https://enka.network/api/uid/";

export async function fetchEnkaData(uid: string): Promise<EnkaResponse> {
  if (!uid || !uid.match(/^\d{9}$/)) {
    throw new Error("Invalid UID format");
  }

  const url = `${CORS_PROXY}${ENKA_API_URL}${uid}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("UID not found or player has not enabled details.");
    }
    throw new Error(`Enka API Error: ${response.statusText}`);
  }

  const data = (await response.json()) as EnkaResponse;
  if (!data.playerInfo) {
    throw new Error("Invalid Enka response");
  }

  return data;
}

// Helper to normalize keys (PascalCase) from English Names
// EnkaIdMap returns "English Name" (e.g. "Gladiator's Finale").
// GOOD expects "GladiatorsFinale".
function toPascalKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "");
}

// Stat mapping is handled by statIdMap (ID -> StatKey)

const SLOT_MAP: Record<string, SlotKey> = {
  EQUIP_BRACER: "flower",
  EQUIP_NECKLACE: "plume",
  EQUIP_SHOES: "sands",
  EQUIP_RING: "goblet",
  EQUIP_DRESS: "circlet",
};

export interface EnkaConversionResult {
  data: GOODData;
  warnings: ConversionWarning[];
}

export function convertEnkaToGOOD(
  enkaData: EnkaResponse
): EnkaConversionResult {
  const characters: IGOODCharacter[] = [];
  const artifacts: IGOODArtifact[] = [];
  const weapons: IGOODWeapon[] = [];
  const warnings: ConversionWarning[] = [];
  const seenIds = new Set<string>();

  if (enkaData.avatarInfoList) {
    for (const avatar of enkaData.avatarInfoList) {
      const charId = String(avatar.avatarId);
      const charName = characterIdMap[charId];

      if (!charName) {
        if (!seenIds.has(charId)) {
          console.warn(`Unknown character ID: ${charId}`);
          warnings.push({ type: "character", key: `ID:${charId}` });
          seenIds.add(charId);
        }
        continue;
      }

      const charKey = toPascalKey(charName);

      // Character
      characters.push({
        key: charKey,
        level: Number(avatar.propMap?.["4001"]?.ival) || 1,
        constellation: avatar.talentIdList ? avatar.talentIdList.length : 0,
        ascension: Number(avatar.propMap?.["1002"]?.ival) || 0,
        talent: {
          auto:
            avatar.skillLevelMap?.[Object.keys(avatar.skillLevelMap)[0]] || 1, // Rough guess, Enka skill map is messy
          skill:
            avatar.skillLevelMap?.[Object.keys(avatar.skillLevelMap)[1]] || 1,
          burst:
            avatar.skillLevelMap?.[Object.keys(avatar.skillLevelMap)[2]] || 1,
        },
      });

      // Equips
      if (avatar.equipList) {
        for (const equip of avatar.equipList) {
          const flat = equip.flat;

          if (flat.itemType === "ITEM_WEAPON") {
            const weaponId = String(equip.itemId);
            const weaponName = weaponIdMap[weaponId];
            if (weaponName && equip.weapon) {
              weapons.push({
                key: toPascalKey(weaponName),
                level: equip.weapon.level,
                refinement:
                  (equip.weapon.affixMap?.[
                    Object.keys(equip.weapon.affixMap)[0]
                  ] || 0) + 1,
                location: charKey,
                lock: false,
              });
            } else if (!weaponName) {
              if (!seenIds.has(weaponId)) {
                warnings.push({ type: "weapon", key: `ID:${weaponId}` });
                seenIds.add(weaponId);
              }
            }
          } else if (flat.itemType === "ITEM_RELIQUARY" && equip.reliquary) {
            let foundSetId = "";
            if (flat.icon) {
              const match = flat.icon.match(/RelicIcon_(\d+)_/);
              if (match) foundSetId = match[1];
            }

            if (!foundSetId && flat.setAndKindIcon) {
              const match = flat.setAndKindIcon.match(/RelicIcon_(\d+)_/);
              if (match) foundSetId = match[1];
            }

            const setName = artifactIdMap[foundSetId];
            if (setName) {
              const slotKey = SLOT_MAP[flat.equipType || ""];
              const mainStatId = equip.reliquary.mainPropId;
              const mainStatKey = statIdMap[String(mainStatId)];

              const substats: IGOODSubstat[] = [];

              // Use flat.reliquarySubstats
              if (flat.reliquarySubstats) {
                for (const sub of flat.reliquarySubstats) {
                  const statKey = statIdMap[String(sub.appendPropId)];
                  if (statKey) {
                    substats.push({
                      key: statKey as StatKey,
                      value: sub.statValue,
                    });
                  }
                }
              }

              if (slotKey && mainStatKey) {
                artifacts.push({
                  setKey: toPascalKey(setName),
                  slotKey,
                  level: equip.reliquary.level - 1,
                  rarity: flat.rankLevel,
                  mainStatKey: mainStatKey as StatKey,
                  location: charKey,
                  lock: false,
                  substats,
                });
              }
            } else if (foundSetId) {
              if (!seenIds.has(foundSetId)) {
                warnings.push({ type: "artifact", key: `ID:${foundSetId}` });
                seenIds.add(foundSetId);
              }
            }
          }
        }
      }
    }
  }

  return {
    data: {
      format: "GOOD",
      version: 3,
      source: "enka",
      characters,
      artifacts,
      weapons,
    },
    warnings,
  };
}
