import {
  artifactNameMap,
  charNameMap,
  normalizeEntityName as normalize,
  weaponNameMap,
} from "./entityMaps";
import type {
  ConversionWarning,
  GOODData,
  IGOODArtifact,
  IGOODCharacter,
  IGOODSubstat,
  IGOODWeapon,
} from "./goodConversion";
import {
  MULTI_ELEMENT_CHARACTER_NAMES,
  normalizeElementName,
  resolveMultiElementCharacterKey,
} from "./multiElementCharacters";

// HoYoLAB / 米游社 Battle Chronicle import.
//
// Unlike the Enka path (which reads the in-game profile showcase), this calls
// the Battle Chronicle `/character/list` + `/character/detail` endpoints on
// either hoyolab.com (overseas) or miyoushe.com (CN). The signed proxy lives
// at /api/hoyolab/<os|cn>/<subpath> — see worker/index.ts.
// Endpoint and DS behavior were refreshed against Womsxd/MihoyoBBSTools
// `setting.py`, seriaati/genshin.py `constants.py` + `utility/ds.py`, and live
// unauthenticated endpoint probes on 2026-05-29.
//
// The shape of the response is completely different from Enka's, so we map
// directly to the internal GOODData format rather than reusing any of the
// Enka-specific decoding helpers.

export type HoyolabRegion = "os" | "cn";

export function uidToRegion(uid: string): HoyolabRegion | null {
  const prefix = uid[0];
  if (prefix === "1" || prefix === "2" || prefix === "3" || prefix === "5") {
    return "cn";
  }
  if (prefix === "6" || prefix === "7" || prefix === "8" || prefix === "9") {
    return "os";
  }
  return null;
}

export function uidToServer(uid: string): string | null {
  switch (uid[0]) {
    case "1":
    case "2":
    case "3":
      return "cn_gf01";
    case "5":
      return "cn_qd01";
    case "6":
      return "os_usa";
    case "7":
      return "os_euro";
    case "8":
      return "os_asia";
    case "9":
      return "os_cht";
    default:
      return null;
  }
}

// Response types (only the fields we consume)

interface HoyolabEnvelope<T> {
  retcode: number;
  message: string;
  data: T | null;
}

interface CharacterListData {
  list: CharacterListEntry[];
}

interface CharacterListEntry {
  id: number;
  name: string;
  element: string;
  level: number;
  rarity: number;
  actived_constellation_num: number;
}

interface CharacterDetailData {
  list: CharacterDetailEntry[];
}

interface CharacterDetailEntry {
  base: {
    id: number;
    name: string;
    element: string;
    level: number;
    rarity: number;
    actived_constellation_num: number;
  };
  weapon: {
    id: number;
    name: string;
    type: number;
    rarity: number;
    level: number;
    promote_level: number;
    affix_level: number;
  };
  relics: Relic[];
  skills: Skill[];
}

interface Relic {
  id: number;
  name: string;
  pos: number; // 1 flower, 2 plume, 3 sands, 4 goblet, 5 circlet
  rarity: number;
  level: number;
  set: { id: number; name: string };
  main_property: { property_type: number; value: string; times: number };
  sub_property_list: {
    property_type: number;
    value: string;
    times: number;
  }[];
}

interface Skill {
  name: string;
  level: number;
  skill_type: number; // 1 active, 2 passive
}

// Property type → GOOD stat key
// Empirically verified from real response samples (see tmp_ysh/map-props.mjs).
// This is the FightProp enum used by the mihoyo calc/chronicle APIs.

const PROPERTY_TYPE_TO_GOOD_KEY: Record<number, string> = {
  2: "hp",
  3: "hp_",
  5: "atk",
  6: "atk_",
  8: "def",
  9: "def_",
  20: "critRate_",
  22: "critDMG_",
  23: "enerRech_",
  26: "heal_",
  28: "eleMas",
  30: "physical_dmg_",
  40: "pyro_dmg_",
  41: "electro_dmg_",
  42: "hydro_dmg_",
  43: "dendro_dmg_",
  44: "anemo_dmg_",
  45: "geo_dmg_",
  46: "cryo_dmg_",
};

const SLOT_BY_POS: Record<number, string> = {
  1: "flower",
  2: "plume",
  3: "sands",
  4: "goblet",
  5: "circlet",
};

function resolveHoyolabCharacterKey(
  name: string,
  element: string | undefined
): string | undefined {
  const directKey = charNameMap.get(normalize(name));
  if (directKey) return directKey;

  return resolveMultiElementCharacterKey(name, element);
}

// Low-level fetch through the signed proxy

const PROXY_BASE = "/api/hoyolab";

export interface HoyolabCredentials {
  ltuidV2: string;
  ltmidV2: string;
  ltokenV2: string;
}

async function callProxy<T>(
  region: HoyolabRegion,
  path: string,
  body: unknown,
  credentials: HoyolabCredentials
): Promise<T> {
  const res = await fetch(`${PROXY_BASE}/${region}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hoyolab-ltuid-v2": credentials.ltuidV2,
      "x-hoyolab-ltmid-v2": credentials.ltmidV2,
      "x-hoyolab-ltoken-v2": credentials.ltokenV2,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const label = region === "cn" ? "米游社" : "HoYoLAB";
    throw new Error(
      `Could not reach ${label} right now. Please try again later. (HTTP ${res.status})`
    );
  }
  const envelope = (await res.json()) as HoyolabEnvelope<T>;
  if (envelope.retcode !== 0 || !envelope.data) {
    const label = region === "cn" ? "米游社" : "HoYoLAB";
    // 5003 is returned for DS rejection and some miHoYo security challenges.
    // Surface a helpful hint so users can report the upstream failure context.
    const hint =
      envelope.retcode === 5003
        ? " This import path may need an app update or may have triggered a miHoYo security check; please report this issue."
        : "";
    throw new Error(
      `${label} returned an error (${envelope.retcode}): ${envelope.message || "unknown"}${hint}`
    );
  }
  return envelope.data;
}

// Public fetcher: returns the raw list + detail payloads

export interface HoyolabFetchResult {
  uid: string;
  region: HoyolabRegion;
  server: string;
  characters: CharacterDetailEntry[];
}

const DETAIL_BATCH_SIZE = 30;

export async function fetchHoyolabData(
  uid: string,
  credentials: HoyolabCredentials
): Promise<HoyolabFetchResult> {
  if (!/^\d{9,10}$/.test(uid)) {
    throw new Error("Invalid UID format");
  }
  const region = uidToRegion(uid);
  const server = uidToServer(uid);
  if (!region || !server) {
    throw new Error(`Unknown UID prefix: ${uid[0]}`);
  }
  if (
    !credentials.ltuidV2.trim() ||
    !credentials.ltmidV2.trim() ||
    !credentials.ltokenV2.trim()
  ) {
    throw new Error("Missing cookie");
  }

  const list = await callProxy<CharacterListData>(
    region,
    "character/list",
    { role_id: uid, server },
    credentials
  );

  const ids = list.list.map((c) => c.id);
  const listEntryById = new Map(list.list.map((entry) => [entry.id, entry]));
  const details: CharacterDetailEntry[] = [];
  for (let i = 0; i < ids.length; i += DETAIL_BATCH_SIZE) {
    const batch = ids.slice(i, i + DETAIL_BATCH_SIZE);
    const detail = await callProxy<CharacterDetailData>(
      region,
      "character/detail",
      { character_ids: batch, role_id: uid, server },
      credentials
    );
    for (const entry of detail.list) {
      const listEntry = listEntryById.get(entry.base.id);
      const element = entry.base.element || listEntry?.element || "";
      details.push(
        element === entry.base.element
          ? entry
          : { ...entry, base: { ...entry.base, element } }
      );
    }
  }

  return { uid, region, server, characters: details };
}

// Conversion: HoyolabFetchResult → GOODData

export interface HoyolabConversionResult {
  data: GOODData;
  warnings: ConversionWarning[];
}

/**
 * Derive character ascension from level. HoYoLAB doesn't expose ascension
 * directly, so we assume the character is at (or above) each ascension cap.
 */
function levelToAscension(level: number): number {
  if (level > 80) return 6;
  if (level > 70) return 5;
  if (level > 60) return 4;
  if (level > 50) return 3;
  if (level > 40) return 2;
  if (level > 20) return 1;
  return 0;
}

/** "13.2%" → 13.2, "42" → 42 */
function parseStatValue(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    return Number.parseFloat(trimmed.slice(0, -1));
  }
  return Number.parseFloat(trimmed);
}

export function convertHoyolabToGOOD(
  fetched: HoyolabFetchResult
): HoyolabConversionResult {
  const characters: IGOODCharacter[] = [];
  const weapons: IGOODWeapon[] = [];
  const artifacts: IGOODArtifact[] = [];
  const warnings: ConversionWarning[] = [];
  const warnedKeys = new Set<string>();

  const warn = (type: ConversionWarning["type"], key: string) => {
    const tag = `${type}:${key}`;
    if (warnedKeys.has(tag)) return;
    warnedKeys.add(tag);
    warnings.push({ type, key });
  };

  for (const entry of fetched.characters) {
    const charName = entry.base.name;
    const charKey = resolveHoyolabCharacterKey(
      charName,
      entry.base.element || undefined
    );
    if (!charKey) {
      warn("character", charName);
      continue;
    }
    const isMultiElementCharacter =
      MULTI_ELEMENT_CHARACTER_NAMES.has(charName) &&
      Boolean(entry.base.element);

    const level = entry.base.level;
    const actives = entry.skills.filter((s) => s.skill_type === 1);
    const talent =
      actives.length >= 3
        ? {
            auto: actives[0].level,
            skill: actives[1].level,
            burst: actives[2].level,
          }
        : undefined;

    characters.push({
      key: charKey,
      level,
      constellation: entry.base.actived_constellation_num,
      ascension: levelToAscension(level),
      ...(isMultiElementCharacter && {
        element: normalizeElementName(entry.base.element),
      }),
      ...(talent && { talent }),
    });

    // Weapon
    const weaponKey = weaponNameMap.get(normalize(entry.weapon.name));
    if (weaponKey) {
      weapons.push({
        key: weaponKey,
        level: entry.weapon.level,
        ascension: entry.weapon.promote_level,
        refinement: entry.weapon.affix_level,
        location: charKey,
        lock: false,
      });
    } else {
      warn("weapon", entry.weapon.name);
    }

    // Artifacts
    for (const relic of entry.relics) {
      const slotKey = SLOT_BY_POS[relic.pos];
      if (!slotKey) continue;
      const setKey = artifactNameMap.get(normalize(relic.set.name));
      if (!setKey) {
        warn("artifact", relic.set.name);
        continue;
      }
      const mainStatKey =
        PROPERTY_TYPE_TO_GOOD_KEY[relic.main_property.property_type];
      if (!mainStatKey) continue;

      const substats: IGOODSubstat[] = [];
      let extraRolls = 0;
      for (const sub of relic.sub_property_list) {
        const statKey = PROPERTY_TYPE_TO_GOOD_KEY[sub.property_type];
        if (!statKey) continue;
        substats.push({ key: statKey, value: parseStatValue(sub.value) });
        extraRolls += sub.times;
      }

      // `times` is the bonus-roll count per sub (not counting the initial
      // unlock), so totalRolls = subs + sum(times).
      const totalRolls = substats.length + extraRolls;

      artifacts.push({
        setKey,
        slotKey,
        level: relic.level,
        rarity: relic.rarity,
        mainStatKey,
        location: charKey,
        lock: false,
        substats,
        totalRolls,
      });
    }
  }

  return {
    data: {
      format: "GOOD",
      version: 3,
      source: "hoyolab",
      characters,
      weapons,
      artifacts,
    },
    warnings,
  };
}
