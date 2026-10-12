import { BUILTIN_TEAM_PRESET_ID } from "@/config/presets/ids";
import type { TeamCompData } from "@/domain/team/types";
import { loadPresetPayload } from "@/lib/resources/presets";

const modules = import.meta.glob<{ default: TeamCompData }>(
  "@/config/presets/teams/*.json"
);
export const teamPresetModules: Record<
  string,
  () => Promise<{ default: TeamCompData }>
> = {
  [BUILTIN_TEAM_PRESET_ID]:
    modules[
      "/src/config/presets/teams/[GGArtifact] 战舰队伍 Flagship Teams.json"
    ],
};

const loadedPresets: Record<string, TeamCompData> = {};

export function validateTeamPreset(
  payload: TeamCompData,
  presetId = "team preset"
): void {
  if (!Array.isArray(payload?.teams)) {
    throw new Error(
      `Invalid team preset "${presetId}": teams must be an array.`
    );
  }

  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();

  payload.teams.forEach((team, index) => {
    if (typeof team.id !== "string" || team.id.trim().length === 0) {
      throw new Error(
        `Invalid team preset "${presetId}": team at index ${index} has no valid ID.`
      );
    }
    if (seenIds.has(team.id)) duplicateIds.add(team.id);
    seenIds.add(team.id);
  });

  if (duplicateIds.size > 0) {
    throw new Error(
      `Invalid team preset "${presetId}": duplicate team IDs: ${[...duplicateIds].join(", ")}.`
    );
  }
}

export async function loadTeamPreset(path: string): Promise<TeamCompData> {
  if (loadedPresets[path]) return loadedPresets[path];
  const payload = await loadPresetPayload(teamPresetModules, path);
  cacheTeamPreset(path, payload);
  return payload;
}

export function cacheTeamPreset(idOrPath: string, payload: TeamCompData): void {
  validateTeamPreset(payload, idOrPath);
  loadedPresets[idOrPath] = payload;
}

export function getCachedTeamPreset(
  idOrPath: string | null
): TeamCompData | null {
  if (!idOrPath) return null;
  return loadedPresets[idOrPath] ?? null;
}
