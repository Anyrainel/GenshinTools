import { statIdMap } from "@/data/enkaIdMap";
import artifactStatData from "@/data/game/artifact_stat.json";
import type {
  ConversionWarning,
  GOODData,
  IGOODArtifact,
  IGOODCharacter,
  IGOODSubstat,
  IGOODWeapon,
} from "./goodConversion";

// --- Precise substat decoding from appendPropIdList ---

const FLAT_STATS = new Set(["hp", "atk", "def", "eleMas"]);

const goodToJsonKey: Record<string, string> = {
  hp: "hp",
  hp_: "hp%",
  atk: "atk",
  atk_: "atk%",
  def: "def",
  def_: "def%",
  critRate_: "cr",
  critDMG_: "cd",
  enerRech_: "er",
  eleMas: "em",
};

function toDisplay(goodKey: string, rawValue: number): number {
  if (FLAT_STATS.has(goodKey)) return rawValue;
  return Math.round(rawValue * 1e6) / 1e4;
}

/**
 * Decode a single appendPropId into { statKey, tierValue } or null.
 * The ID encodes: first digit = rarity (1-5), last digit = tier (1-4),
 * middle digits = stat group.
 */
function decodeAppendPropId(
  id: number
): { statKey: string; displayValue: number } | null {
  const statKey = statIdMap[String(id)];
  if (!statKey) return null;

  const tierIndex = (id % 10) - 1; // last digit 1-4 → index 0-3
  if (tierIndex < 0 || tierIndex > 3) return null;

  // Determine rarity from first digit
  const idStr = String(id);
  const firstDigit = Number(idStr[0]);
  const rarityKey =
    firstDigit === 5
      ? "rarity5"
      : firstDigit === 4
        ? "rarity4"
        : firstDigit === 3
          ? "rarity4"
          : null; // 3-star uses rarity4 tiers but with fewer; fall back
  if (!rarityKey) return null;

  const jsonKey = goodToJsonKey[statKey];
  if (!jsonKey) return null;

  const tiers = (
    artifactStatData.subStats as Record<string, Record<string, number[]>>
  )[rarityKey]?.[jsonKey];
  if (!tiers || tierIndex >= tiers.length) return null;

  return { statKey, displayValue: toDisplay(statKey, tiers[tierIndex]) };
}

/**
 * Compute precise substat display values by summing decoded tier values
 * from the appendPropIdList.
 * Returns a Map<statKey, displayValue> or null if decoding fails.
 */
function computePreciseSubstats(
  appendPropIdList: number[]
): Map<string, number> | null {
  const sums = new Map<string, number>();

  for (const id of appendPropIdList) {
    const decoded = decodeAppendPropId(id);
    if (!decoded) return null; // If any ID fails, fall back entirely
    const prev = sums.get(decoded.statKey) ?? 0;
    sums.set(
      decoded.statKey,
      Math.round((prev + decoded.displayValue) * 100) / 100
    );
  }

  return sums;
}

// --- Reverse ID maps (built lazily from game JSON data) ---

type IdEntry = { id: string };

function buildReverseMap(
  data: Record<string, IdEntry>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(data)) {
    map[entry.id] = key;
  }
  return map;
}

let charIdToKey: Record<string, string> | null = null;
let weaponIdToKey: Record<string, string> | null = null;
let artifactIdToKey: Record<string, string> | null = null;

async function ensureReverseMaps(): Promise<void> {
  if (charIdToKey) return;

  const [char4Mod, char5Mod, weaponMod, artifactMod] = await Promise.all([
    import("@/data/game/character_4_en.json"),
    import("@/data/game/character_5_en.json"),
    import("@/data/game/weapon_en.json"),
    import("@/data/game/artifact_en.json"),
  ]);

  charIdToKey = {
    ...buildReverseMap(char4Mod.default as Record<string, IdEntry>),
    ...buildReverseMap(char5Mod.default as Record<string, IdEntry>),
  };

  // Female Traveler (10000007) shares the same internal keys as male (10000005).
  // Her depot IDs are offset by +200 (e.g. male 504 → female 704).
  for (const [id, key] of Object.entries({ ...charIdToKey })) {
    if (id.startsWith("10000005-")) {
      const depotId = Number.parseInt(id.split("-")[1]);
      charIdToKey[`10000007-${depotId + 200}`] = key;
    }
  }

  weaponIdToKey = buildReverseMap(weaponMod.default as Record<string, IdEntry>);
  artifactIdToKey = buildReverseMap(
    artifactMod.default as Record<string, IdEntry>
  );
}

type SlotKey = "flower" | "plume" | "sands" | "goblet" | "circlet";
type StatKey = string;
type SetKey = string;

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
  skillDepotId?: number;
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

// Enka API endpoints with fallback strategy
// Primary: Self-hosted Cloudflare Pages Function (works on ggartifact.com)
// Fallback: corsproxy.io (for GitHub Pages or other deployments)
const ENKA_DIRECT_API = "/api/enka/uid/";
const CORS_PROXY_FALLBACK = "https://corsproxy.io/?";
const ENKA_EXTERNAL_API = "https://enka.network/api/uid/";

/**
 * Determines if we're running on a deployment that has our Cloudflare Function.
 * Returns true for Cloudflare Pages (ggartifact.com, *.pages.dev) and localhost
 * when running via Wrangler (port 8788).
 */
function hasCloudflareProxy(): boolean {
  const { hostname, port } = window.location;

  // Production: Cloudflare Pages deployments
  if (
    hostname.endsWith(".pages.dev") ||
    hostname === "ggartifact.com" ||
    hostname.endsWith(".ggartifact.com")
  ) {
    return true;
  }

  // Development: Only when running through Wrangler (port 8788)
  // If accessing via Vite directly (port 5173), Functions aren't available
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return port === "8788";
  }

  return false;
}

export async function fetchEnkaData(uid: string): Promise<EnkaResponse> {
  if (!uid || !uid.match(/^\d{9}$/)) {
    throw new Error("Invalid UID format");
  }

  // Try primary endpoint first (Cloudflare Pages Function)
  const useCfProxy = hasCloudflareProxy();
  const primaryUrl = useCfProxy
    ? `${ENKA_DIRECT_API}${uid}`
    : `${CORS_PROXY_FALLBACK}${ENKA_EXTERNAL_API}${uid}`;

  let response: Response;
  let usedFallback = false;

  try {
    response = await fetch(primaryUrl);

    // If primary fails with network error or 5xx, try fallback (only if we used CF proxy)
    if (useCfProxy && !response.ok && response.status >= 500) {
      console.warn("Cloudflare proxy failed, trying fallback...");
      response = await fetch(
        `${CORS_PROXY_FALLBACK}${ENKA_EXTERNAL_API}${uid}`
      );
      usedFallback = true;
    }
  } catch (error) {
    // Network error on primary, try fallback if we used CF proxy
    if (useCfProxy) {
      console.warn("Cloudflare proxy network error, trying fallback...", error);
      response = await fetch(
        `${CORS_PROXY_FALLBACK}${ENKA_EXTERNAL_API}${uid}`
      );
      usedFallback = true;
    } else {
      throw error;
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("UID not found or player has not enabled details.");
    }
    // HTTP/2 omits statusText; read the body for a useful message
    let detail = response.statusText;
    try {
      const body = await response.text();
      if (body) {
        const json = JSON.parse(body);
        if (json.message) detail = json.message;
        else detail = body.slice(0, 200);
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(
      `Enka API Error (${response.status}): ${detail || "unknown error"}`
    );
  }

  const data = (await response.json()) as EnkaResponse;
  if (!data.playerInfo) {
    throw new Error("Invalid Enka response");
  }

  if (usedFallback) {
    console.info("Successfully fetched via fallback proxy");
  }

  return data;
}

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

/**
 * Resolve an Enka avatar to an internal character key.
 * Tries compound key (avatarId-skillDepotId) first for multi-element characters
 * (Traveler, Manekin, Manekina), then falls back to bare avatarId.
 */
function resolveCharacterKey(avatar: AvatarInfo): string | undefined {
  const avatarId = String(avatar.avatarId);

  // If avatarId already contains a dash (compound key from Enka), try direct lookup
  if (avatarId.includes("-")) {
    return charIdToKey![avatarId];
  }

  // Try compound key with skillDepotId (for multi-element characters)
  if (avatar.skillDepotId) {
    const compoundKey = `${avatarId}-${avatar.skillDepotId}`;
    const key = charIdToKey![compoundKey];
    if (key) return key;
  }

  // Fall back to bare avatarId (works for regular single-element characters)
  return charIdToKey![avatarId];
}

export async function convertEnkaToGOOD(
  enkaData: EnkaResponse
): Promise<EnkaConversionResult> {
  await ensureReverseMaps();

  const characters: IGOODCharacter[] = [];
  const artifacts: IGOODArtifact[] = [];
  const weapons: IGOODWeapon[] = [];
  const warnings: ConversionWarning[] = [];
  const seenIds = new Set<string>();

  if (enkaData.avatarInfoList) {
    for (const avatar of enkaData.avatarInfoList) {
      const charKey = resolveCharacterKey(avatar);

      if (!charKey) {
        const charId = String(avatar.avatarId);
        if (!seenIds.has(charId)) {
          console.warn(`Unknown character ID: ${charId}`);
          warnings.push({ type: "character", key: `ID:${charId}` });
          seenIds.add(charId);
        }
        continue;
      }

      // Character — preserve element for multi-element characters in GOOD output
      const elementMatch = charKey.match(
        /^(?:traveler|manekin|manekina)_(\w+)$/
      );
      characters.push({
        key: charKey,
        level: Number(avatar.propMap?.["4001"]?.ival ?? 1),
        constellation: avatar.talentIdList?.length ?? 0,
        ascension: Number(avatar.propMap?.["1002"]?.ival ?? 0),
        ...(elementMatch && {
          element:
            elementMatch[1].charAt(0).toUpperCase() + elementMatch[1].slice(1),
        }),
        talent: {
          auto:
            avatar.skillLevelMap?.[
              Object.keys(avatar.skillLevelMap ?? {})[0]
            ] ?? 1,
          skill:
            avatar.skillLevelMap?.[
              Object.keys(avatar.skillLevelMap ?? {})[1]
            ] ?? 1,
          burst:
            avatar.skillLevelMap?.[
              Object.keys(avatar.skillLevelMap ?? {})[2]
            ] ?? 1,
        },
      });

      // Equips
      if (avatar.equipList) {
        for (const equip of avatar.equipList) {
          const flat = equip.flat;

          if (flat.itemType === "ITEM_WEAPON") {
            const weaponId = String(equip.itemId);
            const weaponKey = weaponIdToKey![weaponId];
            if (weaponKey && equip.weapon) {
              weapons.push({
                key: weaponKey,
                level: equip.weapon.level ?? 1,
                ascension: equip.weapon.promoteLevel ?? 0,
                refinement:
                  (equip.weapon.affixMap?.[
                    Object.keys(equip.weapon.affixMap)[0]
                  ] ?? 0) + 1,
                location: charKey,
                lock: false,
              });
            } else if (!weaponKey) {
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

            const setKey = artifactIdToKey![foundSetId];
            if (setKey) {
              const slotKey = SLOT_MAP[flat.equipType || ""];
              const mainStatId = equip.reliquary.mainPropId;
              const mainStatKey = statIdMap[String(mainStatId)];

              const substats: IGOODSubstat[] = [];

              // Try precise values from appendPropIdList first
              const preciseMap = equip.reliquary.appendPropIdList
                ? computePreciseSubstats(equip.reliquary.appendPropIdList)
                : null;

              if (preciseMap && flat.reliquarySubstats) {
                // Use precise values, but preserve the stat order from flat
                for (const sub of flat.reliquarySubstats) {
                  const statKey = statIdMap[String(sub.appendPropId)];
                  if (statKey) {
                    substats.push({
                      key: statKey as StatKey,
                      value: preciseMap.get(statKey) ?? sub.statValue,
                    });
                  }
                }
              } else if (flat.reliquarySubstats) {
                // Fallback: use rounded display values
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
                const totalRolls = equip.reliquary.appendPropIdList?.length;

                artifacts.push({
                  setKey,
                  slotKey,
                  level: (equip.reliquary.level ?? 1) - 1,
                  rarity: flat.rankLevel ?? 5,
                  mainStatKey: mainStatKey as StatKey,
                  location: charKey,
                  lock: false,
                  substats,
                  ...(totalRolls !== undefined && { totalRolls }),
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
