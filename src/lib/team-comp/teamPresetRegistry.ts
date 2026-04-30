import type { TeamCompData } from "@/lib/team-comp/types";

const loadedPresets: Record<string, TeamCompData> = {};

export function cacheTeamPreset(idOrPath: string, payload: TeamCompData): void {
  loadedPresets[idOrPath] = payload;
}

export function getCachedTeamPreset(
  idOrPath: string | null
): TeamCompData | null {
  if (!idOrPath) return null;
  return loadedPresets[idOrPath] ?? null;
}
