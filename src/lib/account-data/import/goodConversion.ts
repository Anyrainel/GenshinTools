import type { MainStat, Slot, SubStat } from "@/data/enums";
import { artifactsById } from "@/data/gameResources";
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  WeaponData,
} from "@/data/types";
import { repairArtifact } from "@/lib/storeValidation";
import { solveArtifact } from "../../artifact/solver";
import {
  artifactNameMap as artifactMap,
  charNameMap as charMap,
  normalizeEntityName as normalize,
  weaponNameMap as weaponMap,
} from "./entityMaps";
import { ensureLocatedCharacter } from "./locationCharacters";
import { resolveMultiElementCharacterKey } from "./multiElementCharacters";

// --- Types from GOOD v3 (Genshin Open Object Description) ---

export interface IGOODSubstat {
  key: string;
  value: number;
  initialValue?: number;
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
  totalRolls?: number;
  astralMark?: boolean;
  elixirCrafted?: boolean;
  unactivatedSubstats?: IGOODSubstat[];
}

export interface IGOODWeapon {
  key: string;
  level: number; // 1-90 inclusive
  refinement: number; // 1-5 inclusive
  ascension: number; // 0-6 inclusive, disambiguates 80/90 vs 80/80
  location: string;
  lock: boolean;
}

export interface IGOODCharacter {
  key: string;
  level: number; // 1-90 inclusive
  constellation: number; // 0-6 inclusive
  ascension: number; // 0-6 inclusive, disambiguates 80/90 vs 80/80
  element?: string; // e.g. "Anemo", "Pyro" — used to disambiguate multi-element characters
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
  /** GenshinTools extension: dense list of earned in-game achievement IDs. */
  achievements?: number[];
  // materials are ignored
}

// --- Conversion Result ---

export interface ConversionWarning {
  type: "character" | "weapon" | "artifact";
  key: string;
}

export interface PresentSections {
  characters: boolean;
  weapons: boolean;
  artifacts: boolean;
}

export interface ConversionResult {
  data: AccountData;
  warnings: ConversionWarning[];
  /** Which sections had non-empty data in the GOOD import. */
  presentSections: PresentSections;
  /** Undefined when the GOOD file omitted achievements; an empty array is a replacement. */
  earnedAchievementIds?: number[];
}

// --- Conversion Logic ---

// Skip lists for intentionally ignored entities (mirrors Python logic)
// These are normalized keys that should be silently skipped without warning

const ARTIFACT_SKIP_SET = new Set([
  "adventurer",
  "luckydog",
  "travelingdoctor",
  "tinymiracle",
  // 1-piece prayer sets (circlet-only, no useful 2pc effect)
  "prayersfordestiny",
  "prayersforillumination",
  "prayersforwisdom",
  "prayerstospringtime",
  "prayerstothefirmament",
]);

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

/**
 * Convert a single IGOODArtifact to internal ArtifactData.
 * Shared conversion logic used by both full GOOD import and snapshot sync.
 * Returns null if the artifact has an unknown set, main stat, or slot.
 */
export function convertSingleArtifact(
  art: IGOODArtifact,
  id: string
): ArtifactData | null {
  const setKey = artifactMap.get(normalize(art.setKey));
  if (!setKey) return null;
  const mainStatKey = statKeyMap[art.mainStatKey] as MainStat | undefined;
  const slotKey = slotKeyMap[art.slotKey];
  if (!mainStatKey || !slotKey) return null;

  const substats: Partial<Record<SubStat, number>> = {};
  const initialValues: Partial<Record<SubStat, number>> = {};
  let hasInitialValues = false;
  for (const sub of art.substats ?? []) {
    const key = statKeyMap[sub.key] as SubStat;
    if (key) {
      substats[key] = sub.value;
      if (sub.initialValue !== undefined && sub.initialValue > 0) {
        initialValues[key] = sub.initialValue;
        hasInitialValues = true;
      }
    }
  }

  let unactivatedSubstats: Partial<Record<SubStat, number>> | undefined;
  if (art.unactivatedSubstats && art.unactivatedSubstats.length > 0) {
    unactivatedSubstats = {};
    for (const sub of art.unactivatedSubstats) {
      const key = statKeyMap[sub.key] as SubStat;
      if (key) unactivatedSubstats[key] = sub.value;
    }
  }

  const solved = solveArtifact({
    rarity: art.rarity as 4 | 5,
    level: art.level,
    substats,
    totalRolls: art.totalRolls,
  });
  if (solved) {
    for (const [k, v] of Object.entries(solved)) {
      if (v !== undefined) substats[k as SubStat] = v;
    }
  }

  const result: ArtifactData = {
    id,
    setKey,
    slotKey,
    level: art.level,
    rarity: art.rarity as 4 | 5,
    mainStatKey,
    lock: art.lock,
    substats,
    ...(art.totalRolls !== undefined && { totalRolls: art.totalRolls }),
    ...(art.astralMark !== undefined && { astralMark: art.astralMark }),
    ...(art.elixirCrafted !== undefined && {
      elixirCrafted: art.elixirCrafted,
    }),
    ...(unactivatedSubstats && { unactivatedSubstats }),
    ...(hasInitialValues && { initialValues }),
  };
  repairArtifact(result);
  return result;
}

/**
 * Resolve a bare multi-element character key (e.g. "Traveler", "Manekin")
 * to its internal variant key using the element field if available.
 */
const resolveCharacterKey = (
  key: string,
  element?: string
): string | undefined => {
  return (
    charMap.get(normalize(key)) ?? resolveMultiElementCharacterKey(key, element)
  );
};

/**
 * Convert GOOD data to AccountData.
 *
 * @param existingCharacters - When provided and the GOOD characters array is
 *   empty/missing, seeds the internal character map from these entries so that
 *   weapon/artifact location resolution still works for partial imports.
 */
export const convertGOODToAccountData = (
  data: GOODData,
  existingCharacters?: CharacterData[]
): ConversionResult => {
  const charactersMap = new Map<string, CharacterData>();
  const extraWeapons: WeaponData[] = [];
  const extraArtifacts: ArtifactData[] = [];
  const earnedAchievementIds = Array.isArray(data.achievements)
    ? [
        ...new Set(
          data.achievements.filter((id) => Number.isInteger(id) && id >= 0)
        ),
      ].sort((a, b) => a - b)
    : undefined;

  // Track unique warning keys to avoid duplicates
  const seenCharacterKeys = new Set<string>();
  const seenWeaponKeys = new Set<string>();
  const seenArtifactKeys = new Set<string>();
  const warnings: ConversionWarning[] = [];

  const hasCharacters =
    Array.isArray(data.characters) && data.characters.length > 0;
  const hasWeapons = Array.isArray(data.weapons) && data.weapons.length > 0;
  const hasArtifacts =
    Array.isArray(data.artifacts) && data.artifacts.length > 0;

  // Seed from existing characters when the characters section is absent.
  // This lets weapon/artifact location resolution work for partial imports.
  if (!hasCharacters && existingCharacters) {
    for (const char of existingCharacters) {
      charactersMap.set(char.key, {
        key: char.key,
        constellation: char.constellation,
        level: char.level,
        talent: char.talent ?? { auto: 1, skill: 1, burst: 1 },
        // Empty — will be populated from GOOD weapon/artifact sections if present
        artifacts: {},
      });
    }
  }

  // Map from bare character key -> element (from character data)
  // Used to resolve weapon/artifact locations for multi-element characters
  const charElementMap = new Map<string, string>();

  // 1. Process Characters
  if (hasCharacters) {
    for (const char of data.characters!) {
      // Store element info for location resolution in weapons/artifacts
      if (char.element && resolveMultiElementCharacterKey(char.key)) {
        charElementMap.set(char.key, char.element);
      }

      const internalId = resolveCharacterKey(char.key, char.element);
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
        console.warn(`Character not found: ${char.key}`);
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
          const locationId = resolveCharacterKey(
            wp.location,
            charElementMap.get(wp.location)
          );

          if (locationId) {
            const char = ensureLocatedCharacter(charactersMap, locationId);
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
        // Skip unequipped artifacts with lower rarity than the set's max rarity
        const setData = artifactsById[setKey];
        if (!art.location && setData && art.rarity < setData.rarity) {
          artifactIndex++;
          continue;
        }

        const artifactData = convertSingleArtifact(
          art,
          `artifact-${artifactIndex}`
        );

        if (artifactData) {
          let assigned = false;
          if (art.location) {
            const locationId = resolveCharacterKey(
              art.location,
              charElementMap.get(art.location)
            );

            if (locationId) {
              const char = ensureLocatedCharacter(charactersMap, locationId);
              char.artifacts[artifactData.slotKey] = artifactData;
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
    presentSections: {
      characters: hasCharacters,
      weapons: hasWeapons,
      artifacts: hasArtifacts,
    },
    earnedAchievementIds,
  };
};
