import { i18nGameData } from "@/data/i18n-game";
import {
  AccountData,
  ArtifactData,
  CharacterData,
  WeaponData,
  MainStat,
  SubStat,
  Slot,
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

// --- Conversion Logic ---

// Helper to normalize strings for comparison (remove non-alphanumeric, lowercase)
const normalize = (str: string) =>
  str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

// Build Reverse Maps
const charMap = new Map<string, string>();
Object.entries(i18nGameData.characters).forEach(([id, data]) => {
  charMap.set(normalize(data.en), id);
});

const weaponMap = new Map<string, string>();
Object.entries(i18nGameData.weapons).forEach(([id, data]) => {
  weaponMap.set(normalize(data.name.en), id);
});

const artifactMap = new Map<string, string>();
Object.entries(i18nGameData.artifacts).forEach(([id, data]) => {
  artifactMap.set(normalize(data.name.en), id);
});

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

export const convertGOODToAccountData = (data: GOODData): AccountData => {
  const charactersMap = new Map<string, CharacterData>();
  const extraWeapons: WeaponData[] = [];
  const extraArtifacts: ArtifactData[] = [];

  // 1. Process Characters
  if (Array.isArray(data.characters)) {
    data.characters.forEach((char) => {
      let key = char.key;
      // Special handling for Traveler
      if (key === "Traveler") {
        key = "Traveler (Anemo)";
      }

      const internalId = charMap.get(normalize(key));
      if (internalId) {
        charactersMap.set(internalId, {
          key: internalId,
          constellation: char.constellation,
          level: char.level || 1, // Default to 1 if missing
          talent: char.talent || { auto: 1, skill: 1, burst: 1 },
          artifacts: {},
        });
      } else {
        console.warn(`Character not found: ${key}`);
      }
    });
  }

  // 2. Process Weapons
  if (Array.isArray(data.weapons)) {
    data.weapons.forEach((wp, index: number) => {
      const internalId = weaponMap.get(normalize(wp.key));
      if (internalId) {
        const weaponData: WeaponData = {
          id: `weapon-${index}`,
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
      } else {
        console.warn(`Weapon not found: ${wp.key}`);
      }
    });
  }

  // 3. Process Artifacts
  if (Array.isArray(data.artifacts)) {
    data.artifacts.forEach((art, index: number) => {
      const setKey = artifactMap.get(normalize(art.setKey));
      if (setKey) {
        const mainStatKey = statKeyMap[art.mainStatKey] as MainStat;
        const slotKey = slotKeyMap[art.slotKey];

        // Convert substats array to Record (Map)
        const substats: Partial<Record<SubStat, number>> = {};
        art.substats.forEach((sub: IGOODSubstat) => {
          const key = statKeyMap[sub.key] as SubStat;
          if (key) {
            substats[key] = sub.value;
          }
        });

        if (mainStatKey && slotKey) {
          const artifactData: ArtifactData = {
            id: `artifact-${index}`,
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
      } else {
        console.warn(`Artifact Set not found: ${art.setKey}`);
      }
    });
  }

  return {
    characters: Array.from(charactersMap.values()),
    extraArtifacts,
    extraWeapons,
  };
};
