import type { Team } from "@/stores/useTeamStore";

/**
 * Find teams in the store that match the given character IDs.
 * Returns teams where ALL given character IDs are present (order-independent).
 */
export function findMatchingTeams(teams: Team[], charIds: string[]): Team[] {
  const idSet = new Set(charIds);
  return teams.filter((team) => {
    const teamCharIds = team.characters.filter(Boolean) as string[];
    if (teamCharIds.length !== charIds.length) return false;
    return teamCharIds.every((id) => idSet.has(id));
  });
}

/**
 * Convert ER percentages (183, 199, etc.) to the store's internal format (1.83, 1.99).
 */
export function erPercentToInternal(erPercent: number): number {
  return Math.ceil(erPercent) / 100;
}
