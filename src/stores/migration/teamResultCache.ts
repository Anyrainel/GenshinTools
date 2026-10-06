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
  if (version < 3) {
    // Formula-unit migrations can change the meaning of a saved combo without
    // changing its ID. v3 also removes Skirk's mutually exclusive C6 Normal
    // branch when the Burst branch spends the shared stack pool. Cached
    // optimizer/analyzer results cannot be reconciled.
    state.resultsByTeamId = {};
  }
  if (version < 4) {
    // Released 7.1 weapon IDs/passives changed; saved rankings and damage
    // calculated with beta weapon IDs cannot be reconciled safely.
    state.resultsByTeamId = {};
  }
  if (version < 5) {
    // v4 cached optimizer/analyzer results use Vesna's old P1 ramp and
    // C6 pinion counts. The result shape is unchanged, but damage and rankings
    // cannot be reconciled without recomputing them.
    state.resultsByTeamId = {};
  }
  return state;
}
