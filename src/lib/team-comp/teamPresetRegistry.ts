import { loadPresetPayload } from "@/lib/presetLoader";
import type { TeamCompData } from "@/lib/team-comp/types";

const teamPresetModules = import.meta.glob<{ default: TeamCompData }>(
  "@/presets/team-comp/*.json",
  { eager: false }
);

const loadedPresets: Record<string, TeamCompData> = {};

export async function loadTeamPreset(path: string): Promise<TeamCompData> {
  if (loadedPresets[path]) return loadedPresets[path];
  const payload = await loadPresetPayload(teamPresetModules, path);
  cacheTeamPreset(path, payload);
  return payload;
}

export function cacheTeamPreset(idOrPath: string, payload: TeamCompData): void {
  loadedPresets[idOrPath] = payload;
}

export function getCachedTeamPreset(
  idOrPath: string | null
): TeamCompData | null {
  if (!idOrPath) return null;
  return loadedPresets[idOrPath] ?? null;
}
