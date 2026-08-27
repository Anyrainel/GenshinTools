import type { ChoiceResultCache } from "@/lib/team-comp/types";

type TeamResultCacheMigrationEntry = Record<string, unknown> & {
  choiceResults?: ChoiceResultCache;
};

export function migrateTeamResultCacheStore(
  persisted: unknown,
  version: number
): Record<string, unknown> {
  const state = (persisted ?? {}) as {
    resultsByTeamId?: Record<string, TeamResultCacheMigrationEntry>;
  } & Record<string, unknown>;
  if (version < 1) {
    const resultsByTeamId = state.resultsByTeamId ?? {};
    for (const entry of Object.values(resultsByTeamId)) {
      const choiceResults = entry.choiceResults;
      if (choiceResults && typeof choiceResults === "object") {
        if (
          entry.weaponChoiceResult === undefined &&
          choiceResults.weapon !== undefined
        ) {
          entry.weaponChoiceResult = choiceResults.weapon ?? null;
        }
        if (
          entry.artifactChoiceResult === undefined &&
          choiceResults.artifact !== undefined
        ) {
          entry.artifactChoiceResult = choiceResults.artifact ?? null;
        }
      }
      delete entry.choiceResults;
    }
    state.resultsByTeamId = resultsByTeamId;
  }
  if (version < 2) {
    // Formula-unit migrations can change the meaning of a saved combo without
    // changing its ID. Cached optimizer/analyzer results cannot be reconciled.
    state.resultsByTeamId = {};
  }
  return state;
}
