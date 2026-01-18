import { i18nGameData } from "@/data/i18n-game";
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  MainStat,
  Slot,
  SubStat,
  WeaponData,
} from "@/data/types";

// --- Types from GOOD (Genshin Open Object Description) ---

export interface IGOODSubstat {
  key: string;
  value: number;
}

export interface IGOODArtifact {
  setKey: string;
  slotKey: string;
  level: number;
  rarity: number;
  mainStatKey: string;
  location: string;
  lock: boolean;
  substats: IGOODSubstat[];
}

export interface IGOODWeapon {
  key: string;
  level: number;
  refinement: number;
  location: string;
  lock: boolean;
}

export interface IGOODCharacter {
  key: string;
  constellation: number;
  level?: number;
  ascension?: number;
  talent?: {
    auto: number;
    skill: number;
    burst: number;
  };
}

export interface GOODData {
  format: string;
  version: number;
  source: string;
  characters?: IGOODCharacter[];
  weapons?: IGOODWeapon[];
  artifacts?: IGOODArtifact[];
}

// --- Conversion Result ---

export interface ConversionWarning {
  type: "character" | "weapon" | "artifact";
  key: string;
}

export interface ConversionResult {
  data: AccountData;
  warnings: ConversionWarning[];
}

// --- Conversion Logic ---

// Helper to normalize strings for comparison (remove non-alphanumeric, lowercase)
const normalize = (str: string) =>
  str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

// Skip lists for intentionally ignored entities (mirrors Python logic)
// These are normalized keys that should be silently skipped without warnings
const CHARACTER_SKIP_SET = new Set(["manekina", "manekin"]);

const ARTIFACT_SKIP_SET = new Set([
  "adventurer",
  "braveheart",
  "luckydog",
  "travelingdoctor",
  "resolutionofsojourner",
  "tinymiracle",
  "berserker",
  "theexile",
  "defenderswill",
  "martialartist",
  "gambler",
  "scholar",
]);

// Build Reverse Maps
const charMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.characters)) {
  charMap.set(normalize(data.en), id);
}

const weaponMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.weapons)) {
  weaponMap.set(normalize(data.name.en), id);
}

const artifactMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.artifacts)) {
  artifactMap.set(normalize(data.name.en), id);
}

// Stat Key Mapping (GOOD -> Internal)
const statKeyMap: Record<string, string> = {
  hp: "hp",
  hp_: "hp%",
  atk: "atk",
  atk_: "atk%",
  def: "def",
  def_: "def%",
  eleMas: "em",
  enerRech_: "er",
  heal_: "heal%",
  critRate_: "cr",
  critDMG_: "cd",
  physical_dmg_: "phys%",
  anemo_dmg_: "anemo%",
  geo_dmg_: "geo%",
  electro_dmg_: "electro%",
  hydro_dmg_: "hydro%",
  pyro_dmg_: "pyro%",
  cryo_dmg_: "cryo%",
  dendro_dmg_: "dendro%",
};

const slotKeyMap: Record<string, Slot> = {
  flower: "flower",
  plume: "plume",
  sands: "sands",
  goblet: "goblet",
  circlet: "circlet",
};

export const convertGOODToAccountData = (data: GOODData): ConversionResult => {
  const charactersMap = new Map<string, CharacterData>();
  const extraWeapons: WeaponData[] = [];
  const extraArtifacts: ArtifactData[] = [];

  // Track unique warning keys to avoid duplicates
  const seenCharacterKeys = new Set<string>();
  const seenWeaponKeys = new Set<string>();
  const seenArtifactKeys = new Set<string>();
  const warnings: ConversionWarning[] = [];

  // 1. Process Characters
  if (Array.isArray(data.characters)) {
    for (const char of data.characters) {
      let key = char.key;
      // Special handling for Traveler
      if (key === "Traveler") {
        key = "Traveler (Anemo)";
      }

      const normalizedKey = normalize(key);

      // Skip intentionally ignored characters silently
      if (CHARACTER_SKIP_SET.has(normalizedKey)) {
        continue;
      }

      const internalId = charMap.get(normalizedKey);
      if (internalId) {
        charactersMap.set(internalId, {
          key: internalId,
          constellation: char.constellation,
          level: char.level || 1, // Default to 1 if missing
          talent: char.talent || { auto: 1, skill: 1, burst: 1 },
          artifacts: {},
        });
      } else if (!seenCharacterKeys.has(char.key)) {
        // Only add warning if not already seen (deduplicate)
        seenCharacterKeys.add(char.key);
        console.warn(`Character not found: ${key}`);
        warnings.push({ type: "character", key: char.key });
      }
    }
  }

  // 2. Process Weapons
  if (Array.isArray(data.weapons)) {
    let weaponIndex = 0;
    for (const wp of data.weapons) {
      const internalId = weaponMap.get(normalize(wp.key));
      if (internalId) {
        const weaponData: WeaponData = {
          id: `weapon-${weaponIndex}`,
          key: internalId,
          level: wp.level,
          refinement: wp.refinement,
          lock: wp.lock,
        };

        let assigned = false;
        if (wp.location) {
          let charKey = wp.location;
          if (charKey === "Traveler") charKey = "Traveler (Anemo)";
          const locationId = charMap.get(normalize(charKey));

          if (locationId && charactersMap.has(locationId)) {
            const char = charactersMap.get(locationId)!;
            char.weapon = weaponData;
            assigned = true;
          }
        }

        if (!assigned) {
          extraWeapons.push(weaponData);
        }
      } else if (!seenWeaponKeys.has(wp.key)) {
        // Only add warning if not already seen (deduplicate)
        seenWeaponKeys.add(wp.key);
        console.warn(`Weapon not found: ${wp.key}`);
        warnings.push({ type: "weapon", key: wp.key });
      }
      weaponIndex++;
    }
  }

  // 3. Process Artifacts
  if (Array.isArray(data.artifacts)) {
    let artifactIndex = 0;
    for (const art of data.artifacts) {
      const normalizedSetKey = normalize(art.setKey);

      // Skip intentionally ignored artifact sets silently
      if (ARTIFACT_SKIP_SET.has(normalizedSetKey)) {
        artifactIndex++;
        continue;
      }

      const setKey = artifactMap.get(normalizedSetKey);
      if (setKey) {
        const mainStatKey = statKeyMap[art.mainStatKey] as MainStat;
        const slotKey = slotKeyMap[art.slotKey];

        // Convert substats array to Record (Map)
        const substats: Partial<Record<SubStat, number>> = {};
        for (const sub of art.substats) {
          const key = statKeyMap[sub.key] as SubStat;
          if (key) {
            substats[key] = sub.value;
          }
        }

        if (mainStatKey && slotKey) {
          const artifactData: ArtifactData = {
            id: `artifact-${artifactIndex}`,
            setKey,
            slotKey,
            level: art.level,
            rarity: art.rarity,
            mainStatKey,
            lock: art.lock,
            substats,
          };

          let assigned = false;
          if (art.location) {
            let charKey = art.location;
            if (charKey === "Traveler") charKey = "Traveler (Anemo)";
            const locationId = charMap.get(normalize(charKey));

            if (locationId && charactersMap.has(locationId)) {
              const char = charactersMap.get(locationId)!;
              char.artifacts[slotKey] = artifactData;
              assigned = true;
            }
          }

          if (!assigned) {
            extraArtifacts.push(artifactData);
          }
        }
      } else if (!seenArtifactKeys.has(art.setKey)) {
        // Only add warning if not already seen (deduplicate)
        seenArtifactKeys.add(art.setKey);
        console.warn(`Artifact Set not found: ${art.setKey}`);
        warnings.push({ type: "artifact", key: art.setKey });
      }
      artifactIndex++;
    }
  }

  return {
    data: {
      characters: Array.from(charactersMap.values()),
      extraArtifacts,
      extraWeapons,
    },
    warnings,
  };
};
