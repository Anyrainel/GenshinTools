import { artifactsById } from "@/data/constants";
import { i18nGameData } from "@/data/i18n-game";
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  MainStat,
  Rarity,
  Slot,
  SubStat,
} from "@/data/types";
import type { ConversionResult, ConversionWarning } from "./goodConversion";

// --- Types from Mona format (yas default export) ---

export interface MonaStatTag {
  name: string;
  value: number;
}

export interface MonaArtifact {
  setName: string;
  position: string;
  mainTag: MonaStatTag;
  normalTags: MonaStatTag[];
  omit: boolean;
  level: number;
  star: number;
  equip: string | null;
}

export interface MonaData {
  version: string;
  flower?: MonaArtifact[];
  feather?: MonaArtifact[];
  sand?: MonaArtifact[];
  cup?: MonaArtifact[];
  head?: MonaArtifact[];
}

// --- Helpers ---

const normalize = (str: string) =>
  str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const ARTIFACT_SKIP_SET = new Set([
  "adventurer",
  "luckydog",
  "travelingdoctor",
  "tinymiracle",
]);

// --- Character lookup (English normalized + Chinese exact) ---

const enCharMap = new Map<string, string>();
const zhCharMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.characters)) {
  enCharMap.set(normalize(data.en), id);
  zhCharMap.set(data.zh, id);
}

function lookupCharacter(name: string): string | undefined {
  if (!name) return undefined;
  // Bare Traveler names (no element suffix) -> default to Anemo
  const trimmed = name.trim();
  if (trimmed === "旅行者" || trimmed === "Traveler") {
    return enCharMap.get(normalize("Traveler (Anemo)"));
  }
  // Try exact Chinese match (normalize strips CJK characters)
  const zhMatch = zhCharMap.get(trimmed);
  if (zhMatch) return zhMatch;
  // Try normalized English
  const normalized = normalize(trimmed);
  if (normalized) return enCharMap.get(normalized);
  return undefined;
}

// --- Artifact set lookup ---

const artifactMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.artifacts)) {
  artifactMap.set(normalize(data.en), id);
}

// Mona set names that differ from English names after normalization.
// Maps normalize(monaName) -> normalize(englishName) for artifactMap lookup.
const monaSetNameOverrides: Record<string, string> = {
  gladiatorfinale: "gladiatorsfinale",
  crimsonwitch: "crimsonwitchofflames",
  thundersmoother: "thundersoother",
  wanderertroupe: "wandererstroupe",
  defenderwill: "defenderswill",
  exile: "theexile",
  shimenawareminiscence: "shimenawasreminiscence",
  // Newer sets where yas enum names derive from Chinese, not English
  spinmoonserenade: "silkenmoonsserenade",
  realmmirrornight: "nightoftheskysunveiling",
};

// --- Stat mapping ---

// Mona stat name -> { internal key, whether value is a percentage (needs *100) }
const monaStatMap: Record<string, { key: string; pct: boolean }> = {
  lifeStatic: { key: "hp", pct: false },
  lifePercentage: { key: "hp%", pct: true },
  attackStatic: { key: "atk", pct: false },
  attackPercentage: { key: "atk%", pct: true },
  defendStatic: { key: "def", pct: false },
  defendPercentage: { key: "def%", pct: true },
  elementalMastery: { key: "em", pct: false },
  recharge: { key: "er", pct: true },
  cureEffect: { key: "heal%", pct: true },
  critical: { key: "cr", pct: true },
  criticalDamage: { key: "cd", pct: true },
  physicalBonus: { key: "phys%", pct: true },
  windBonus: { key: "anemo%", pct: true },
  rockBonus: { key: "geo%", pct: true },
  thunderBonus: { key: "electro%", pct: true },
  waterBonus: { key: "hydro%", pct: true },
  fireBonus: { key: "pyro%", pct: true },
  iceBonus: { key: "cryo%", pct: true },
  dendroBonus: { key: "dendro%", pct: true },
};

function convertStatValue(value: number, pct: boolean): number {
  if (!pct) return value;
  // Mona stores 0.062 for 6.2%; our format expects 6.2
  return Math.round(value * 1000) / 10;
}

// --- Slot mapping ---

const monaSlotMap: Record<string, Slot> = {
  flower: "flower",
  feather: "plume",
  sand: "sands",
  cup: "goblet",
  head: "circlet",
};

// --- Conversion ---

export const convertMonaToAccountData = (data: MonaData): ConversionResult => {
  const charactersMap = new Map<string, CharacterData>();
  const extraArtifacts: ArtifactData[] = [];

  const seenArtifactKeys = new Set<string>();
  const warnings: ConversionWarning[] = [];

  // Flatten slot-grouped arrays into a single list
  const allArtifacts: MonaArtifact[] = [
    ...(data.flower || []),
    ...(data.feather || []),
    ...(data.sand || []),
    ...(data.cup || []),
    ...(data.head || []),
  ];

  let artifactIndex = 0;
  for (const art of allArtifacts) {
    const normalizedSetName = normalize(art.setName);

    if (ARTIFACT_SKIP_SET.has(normalizedSetName)) {
      artifactIndex++;
      continue;
    }

    const lookupKey =
      monaSetNameOverrides[normalizedSetName] || normalizedSetName;
    const setKey = artifactMap.get(lookupKey);

    if (setKey) {
      // Skip unequipped artifacts with lower rarity than the set's max rarity
      const setData = artifactsById[setKey];
      if (!art.equip && setData && art.star < setData.rarity) {
        artifactIndex++;
        continue;
      }

      const slotKey = monaSlotMap[art.position];
      const mainStatInfo = monaStatMap[art.mainTag.name];

      if (slotKey && mainStatInfo) {
        const mainStatKey = mainStatInfo.key as MainStat;

        const substats: Partial<Record<SubStat, number>> = {};
        for (const tag of art.normalTags) {
          const statInfo = monaStatMap[tag.name];
          if (statInfo) {
            substats[statInfo.key as SubStat] = convertStatValue(
              tag.value,
              statInfo.pct
            );
          }
        }

        const artifactData: ArtifactData = {
          id: `artifact-${artifactIndex}`,
          setKey,
          slotKey,
          level: art.level,
          rarity: art.star as Rarity,
          mainStatKey,
          lock: false,
          substats,
        };

        let assigned = false;
        if (art.equip) {
          const locationId = lookupCharacter(art.equip);

          if (locationId) {
            if (!charactersMap.has(locationId)) {
              charactersMap.set(locationId, {
                key: locationId,
                constellation: 0,
                level: 90,
                talent: { auto: 10, skill: 10, burst: 10 },
                artifacts: {},
              });
            }
            const char = charactersMap.get(locationId)!;
            char.artifacts[slotKey] = artifactData;
            assigned = true;
          }
        }

        if (!assigned) {
          extraArtifacts.push(artifactData);
        }
      }
    } else if (!seenArtifactKeys.has(art.setName)) {
      seenArtifactKeys.add(art.setName);
      console.warn(`Artifact Set not found: ${art.setName}`);
      warnings.push({ type: "artifact", key: art.setName });
    }
    artifactIndex++;
  }

  return {
    data: {
      characters: Array.from(charactersMap.values()),
      extraArtifacts,
      extraWeapons: [],
    },
    warnings,
  };
};

/**
 * Merge Mona import data with existing account data.
 *
 * - Characters/weapons: keep existing details (level, constellation, talent, weapon)
 * - Artifacts: completely replaced by Mona's scan (equipped + extra)
 * - Characters only in existing (no Mona artifacts): keep details, clear artifacts
 * - Characters only in Mona: use Mona's placeholder data
 */
export function mergeMonaWithExisting(
  existing: AccountData,
  monaData: AccountData
): AccountData {
  const monaCharMap = new Map(monaData.characters.map((c) => [c.key, c]));
  const mergedCharacters: CharacterData[] = [];

  // Existing characters: keep details + weapon, replace artifacts from Mona
  for (const existingChar of existing.characters) {
    const monaChar = monaCharMap.get(existingChar.key);
    mergedCharacters.push({
      ...existingChar,
      artifacts: monaChar?.artifacts ?? {},
    });
    monaCharMap.delete(existingChar.key);
  }

  // Characters only in Mona (not in existing): add with placeholder details
  for (const [, monaChar] of monaCharMap) {
    mergedCharacters.push(monaChar);
  }

  return {
    characters: mergedCharacters,
    extraArtifacts: monaData.extraArtifacts,
    extraWeapons: existing.extraWeapons,
  };
}
