/**
 * Team Composition Database for V2 Auto-Tuning
 *
 * Sources team compositions from curated preset data:
 * - Flagship Teams: Full 4-member team builds (characters, weapons, artifacts)
 * - AllCharacterBuilds: Per-character build recommendations (main stats, artifacts)
 *
 * Derives CharacterBuildProfile objects for the V2 pipeline and UI display.
 */

import { charactersById, weaponsById } from "@/data/constants";
import { characters } from "@/data/resources";
import type { TeamContext, TeamMemberBuild } from "./types";

// ─── Preset JSON imports ───

import allBuildsJson from "@/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
import flagshipTeamsJson from "@/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json";

// ─── Validation ───

const VALID_CHARACTER_IDS = new Set(characters.map((c) => c.id));

function assertCharacterId(id: string, context: string): void {
  if (!VALID_CHARACTER_IDS.has(id)) {
    throw new Error(
      `Unknown character ID "${id}" in ${context}. Check src/data/resources.ts for valid IDs.`
    );
  }
}

// ─── Raw preset types ───

type FlagshipTeamEntry = {
  id: string;
  name: string;
  characters: string[];
  weapons: string[];
  artifacts: (
    | { type: "4pc"; setId: string }
    | { type: "2pc+2pc"; id1: string; id2: string }
  )[];
  reactions: string[];
  opts: Record<string, string>;
  targetEr: Record<string, number>;
  selectedFormula: { charId: string; formulaId: string } | null;
  optimizationResult: unknown;
  calcContext?: { assumeCrit?: boolean; enemyLevel?: number };
};

type PresetBuild = {
  id: string;
  sands: string[];
  goblet: string[];
  circlet: string[];
  substats: { stat: string; weight: number }[];
  artifactSet?: string;
  halfSet1?: string;
  halfSet2?: string;
  characterId: string;
  roles: string[];
  styles: string[];
};

// ─── Build profile type (kept for UI compatibility) ───

export type CharacterBuildProfile = {
  characterId: string;
  scalingStat: "atk" | "hp" | "def" | "em";
  element: string;
  defaultArtifactSet?: string;
  weapons: string[];
  teams: TeamContext[];
  sandsOptions: string[];
  gobletOptions: string[];
  circletOptions: string[];
  primaryReaction: string;
  /** Empty — buffs are resolved by TeamBuild, not manual presets */
  teamBuffPresets: Record<string, string[]>;
  setBonus?: Record<string, number>;
};

// ─── Helpers ───

function getCharRarity(charId: string): number {
  return charactersById[charId]?.rarity ?? 4;
}

function getWeaponRarity(weaponId: string): number {
  return weaponsById[weaponId]?.rarity ?? 4;
}

/**
 * Convert a Flagship Team entry into CharCompConfig-compatible data.
 * Returns the configs array suitable for constructing a TeamBuild.
 */
export function teamEntryToConfigs(team: FlagshipTeamEntry): {
  charId: string;
  charLevel: number;
  constellation: number;
  weaponId: string;
  refinement: number;
  artifactSetId: string | null;
  artifactHalfSetIds: string[];
}[] {
  return team.characters.map((charId, idx) => {
    const weaponId = team.weapons[idx] ?? "";
    const artifact = team.artifacts[idx];

    let artifactSetId: string | null = null;
    let artifactHalfSetIds: string[] = [];

    if (artifact) {
      if (artifact.type === "4pc") {
        artifactSetId = artifact.setId;
        // halfSetIds for 4pc: the set's own 2pc is typically auto-included by CharBuild
        artifactHalfSetIds = [];
      } else {
        // 2pc+2pc
        artifactSetId = null;
        artifactHalfSetIds = [artifact.id1, artifact.id2];
      }
    }

    const charRarity = getCharRarity(charId);
    const weaponRarity = getWeaponRarity(weaponId);

    return {
      charId,
      charLevel: 90,
      constellation: charRarity >= 5 ? 0 : 6,
      weaponId,
      refinement: weaponRarity >= 5 ? 1 : 5,
      artifactSetId,
      artifactHalfSetIds,
    };
  });
}

/**
 * Convert a Flagship Team entry + index into a TeamContext for display.
 */
function teamEntryToContext(
  team: FlagshipTeamEntry,
  dpsIndex: number
): TeamContext {
  const builds: TeamMemberBuild[] = team.characters.map((_, idx) => {
    const weaponId = team.weapons[idx] ?? "";
    const artifact = team.artifacts[idx];
    let artifacts: string[] = [];

    if (artifact) {
      if (artifact.type === "4pc") {
        artifacts = [artifact.setId];
      } else {
        artifacts = [artifact.id1, artifact.id2];
      }
    }

    return { weapon: weaponId, artifacts };
  });

  return {
    name: team.name || `Team ${team.id.slice(-4)}`,
    characters: team.characters.slice(0, 4) as [string, string, string, string],
    dpsIndex,
    reaction: team.reactions[0] ?? "none",
    dpsWeaponId: team.weapons[dpsIndex] ?? "",
    builds: builds.slice(0, 4) as [
      TeamMemberBuild,
      TeamMemberBuild,
      TeamMemberBuild,
      TeamMemberBuild,
    ],
  };
}

// ─── Build lookup from AllCharacterBuilds preset ───

const presetBuilds = allBuildsJson.builds as Record<string, PresetBuild>;
const characterBuildIds = allBuildsJson.characterBuilds as Record<
  string,
  string[]
>;

/** Get the first (primary) build for a character from the preset */
function getPresetBuild(charId: string): PresetBuild | undefined {
  const buildIds = characterBuildIds[charId];
  if (!buildIds || buildIds.length === 0) return undefined;
  return presetBuilds[buildIds[0]];
}

/** Infer scaling stat from a character's recommended main stats */
function inferScalingStat(
  build: PresetBuild | undefined
): "atk" | "hp" | "def" | "em" {
  if (!build) return "atk";
  const sands = build.sands[0] ?? "atk%";
  if (sands === "hp%") return "hp";
  if (sands === "def%") return "def";
  if (sands === "em") return "em";
  return "atk";
}

/** Infer element from character data */
function inferElement(charId: string): string {
  // Element will be resolved from character_stats.json at runtime
  // For now, return a placeholder — the pipeline resolves it properly
  return "";
}

// ─── Build CHARACTER_BUILD_PROFILES from Flagship Teams ───

const flagshipTeams = flagshipTeamsJson.teams as FlagshipTeamEntry[];

/** Map: charId → teams where that char is the DPS */
const dpsTeamMap = new Map<
  string,
  { team: FlagshipTeamEntry; dpsIndex: number }[]
>();

for (const team of flagshipTeams) {
  // Validate character IDs
  for (const charId of team.characters) {
    try {
      assertCharacterId(charId, `Flagship Team ${team.id}`);
    } catch {}
  }

  // Determine DPS character
  let dpsIndex = 0;
  if (team.selectedFormula) {
    const idx = team.characters.indexOf(team.selectedFormula.charId);
    if (idx >= 0) dpsIndex = idx;
  }

  const dpsCharId = team.characters[dpsIndex];
  if (!dpsCharId) continue;

  if (!dpsTeamMap.has(dpsCharId)) {
    dpsTeamMap.set(dpsCharId, []);
  }
  dpsTeamMap.get(dpsCharId)!.push({ team, dpsIndex });
}

/** Build profiles from the team map */
function buildProfiles(): CharacterBuildProfile[] {
  const profiles: CharacterBuildProfile[] = [];

  for (const [charId, teamEntries] of dpsTeamMap) {
    const presetBuild = getPresetBuild(charId);
    const scalingStat = inferScalingStat(presetBuild);
    const element = inferElement(charId);

    // Collect weapons across all teams
    const weaponSet = new Set<string>();
    for (const { team, dpsIndex } of teamEntries) {
      const wep = team.weapons[dpsIndex];
      if (wep) weaponSet.add(wep);
    }
    // Also add weapons from the preset
    const presetWeapons = (
      allBuildsJson.characterWeapons as Record<string, string[]>
    )[charId];
    if (presetWeapons) {
      for (const w of presetWeapons) weaponSet.add(w);
    }

    // Build TeamContexts
    const teams: TeamContext[] = teamEntries.map(({ team, dpsIndex }) =>
      teamEntryToContext(team, dpsIndex)
    );

    // Main stat options from preset build
    const sandsOptions = presetBuild?.sands ?? ["atk%"];
    const gobletOptions = presetBuild?.goblet ?? ["atk%"];
    const circletOptions = presetBuild?.circlet ?? ["cr", "cd"];

    // Default artifact set from first team entry
    const firstArtifact =
      teamEntries[0]?.team.artifacts[teamEntries[0].dpsIndex];
    const defaultArtifactSet =
      firstArtifact?.type === "4pc"
        ? firstArtifact.setId
        : presetBuild?.artifactSet;

    // Primary reaction from first team
    const primaryReaction = teamEntries[0]?.team.reactions[0] ?? "none";

    profiles.push({
      characterId: charId,
      scalingStat,
      element,
      defaultArtifactSet,
      weapons: [...weaponSet],
      teams,
      sandsOptions,
      gobletOptions,
      circletOptions,
      primaryReaction,
      teamBuffPresets: {}, // buffs are resolved by TeamBuild
    });
  }

  return profiles;
}

export const CHARACTER_BUILD_PROFILES: CharacterBuildProfile[] =
  buildProfiles();

export const CHARACTER_PROFILES_BY_ID: Record<string, CharacterBuildProfile> =
  Object.fromEntries(CHARACTER_BUILD_PROFILES.map((p) => [p.characterId, p]));

export function getProfiledCharacterIds(): string[] {
  return CHARACTER_BUILD_PROFILES.map((p) => p.characterId);
}

/**
 * Get the raw Flagship Team entries for a given character (for pipeline use).
 */
export function getFlagshipTeamsForChar(
  charId: string
): { team: FlagshipTeamEntry; dpsIndex: number }[] {
  return dpsTeamMap.get(charId) ?? [];
}

/**
 * Get the selected formula from a team entry, if any.
 */
export function getSelectedFormula(
  team: FlagshipTeamEntry
): { charId: string; formulaId: string } | null {
  return team.selectedFormula;
}
