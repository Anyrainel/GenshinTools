import path from "node:path";
import {
  artifactHalfSets,
  artifacts,
  characters,
  weapons,
} from "@/data/resources";
import { betaArtifacts, betaCharacters, betaWeapons } from "@/data/resources_beta";
import { readJson } from "./io";
import { REPOSITORY_ROOT } from "./paths";

type CharacterStatsEntry = {
  weaponType?: string;
};

type WeaponStatsEntry = {
  type?: string;
};

export interface GameCatalogs {
  characterIds: ReadonlySet<string>;
  weaponIds: ReadonlySet<string>;
  artifactSetIds: ReadonlySet<string>;
  artifactHalfSetIds: ReadonlySet<string>;
  artifactSetToHalfSetId: ReadonlyMap<string, string>;
  betaCharacterIds: ReadonlySet<string>;
  betaWeaponIds: ReadonlySet<string>;
  betaArtifactSetIds: ReadonlySet<string>;
  characterWeaponTypes: ReadonlyMap<string, string>;
  weaponTypes: ReadonlyMap<string, string>;
  reactionIds: ReadonlySet<string>;
  mainStatsBySlot: Readonly<
    Record<"sands" | "goblet" | "circlet", ReadonlySet<string>>
  >;
  substatIds: ReadonlySet<string>;
}

const TEAM_REACTION_IDS = [
  "melt",
  "vaporize",
  "spread",
  "aggravate",
  "overloaded",
  "electroCharged",
  "superconduct",
  "swirl",
  "frozen",
  "bloom",
  "hyperbloom",
  "burgeon",
  "burning",
  "lunarCharged",
  "lunarBloom",
  "lunarCrystallize",
  "stellarConduct",
  "stellarSwirl",
] as const;

const MAIN_STATS_BY_SLOT = {
  sands: new Set(["atk%", "hp%", "def%", "em", "er"]),
  goblet: new Set([
    "atk%",
    "hp%",
    "def%",
    "em",
    "pyro%",
    "hydro%",
    "anemo%",
    "electro%",
    "dendro%",
    "cryo%",
    "geo%",
    "phys%",
    "elemental%",
  ]),
  circlet: new Set([
    "atk%",
    "hp%",
    "def%",
    "em",
    "cr",
    "cd",
    "heal%",
    "cr/cd",
  ]),
} as const;

const SUBSTAT_IDS = new Set([
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "er",
  "em",
  "atk",
  "hp",
  "def",
]);

export async function loadGameCatalogs(): Promise<GameCatalogs> {
  const [characterStatsInput, weaponStatsInput] = await Promise.all([
    readJson(
      path.join(
        REPOSITORY_ROOT,
        "src",
        "data",
        "game",
        "character_stats.json"
      )
    ),
    readJson(
      path.join(
        REPOSITORY_ROOT,
        "src",
        "data",
        "game",
        "weapon_stats.json"
      )
    ),
  ]);

  const characterStats = characterStatsInput as Record<
    string,
    CharacterStatsEntry
  >;
  const weaponStats = weaponStatsInput as Record<string, WeaponStatsEntry>;

  return {
    characterIds: new Set([
      ...characters.map(({ id }) => id),
      ...betaCharacters.map(({ id }) => id),
    ]),
    weaponIds: new Set([
      ...weapons.map(({ id }) => id),
      ...betaWeapons.map(({ id }) => id),
    ]),
    artifactSetIds: new Set([
      ...artifacts.map(({ id }) => id),
      ...betaArtifacts.map(({ id }) => id),
    ]),
    artifactHalfSetIds: new Set(artifactHalfSets.map(({ id }) => id)),
    artifactSetToHalfSetId: new Map(
      artifactHalfSets.flatMap(({ id, setIds }) =>
        setIds.map((setId) => [setId, id] as const)
      )
    ),
    betaCharacterIds: new Set(betaCharacters.map(({ id }) => id)),
    betaWeaponIds: new Set(betaWeapons.map(({ id }) => id)),
    betaArtifactSetIds: new Set(betaArtifacts.map(({ id }) => id)),
    characterWeaponTypes: new Map(
      Object.entries(characterStats).flatMap(([id, stats]) =>
        stats.weaponType ? [[id, stats.weaponType] as const] : []
      )
    ),
    weaponTypes: new Map(
      Object.entries(weaponStats).flatMap(([id, stats]) =>
        stats.type ? [[id, stats.type] as const] : []
      )
    ),
    reactionIds: new Set(TEAM_REACTION_IDS),
    mainStatsBySlot: MAIN_STATS_BY_SLOT,
    substatIds: SUBSTAT_IDS,
  };
}
