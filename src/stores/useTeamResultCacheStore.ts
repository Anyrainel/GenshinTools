import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChoiceResultCache,
  OptimizationResult,
  Team,
  WeaponChoiceResult,
} from "@/lib/team-comp/types";
import { PersistedTeamResultCacheStoreSchema } from "./schemas";

export interface TeamResultCacheEntry {
  optimizationResult?: OptimizationResult | null;
  choiceResults?: ChoiceResultCache;
  /** @deprecated use choiceResults.weapon */
  weaponChoiceResult?: WeaponChoiceResult | null;
}

export type TeamResultCachePatch = Partial<TeamResultCacheEntry>;

interface TeamResultCacheState {
  resultsByTeamId: Record<string, TeamResultCacheEntry>;
  getForTeam: (teamId: string) => TeamResultCacheEntry | undefined;
  patchForTeam: (teamId: string, patch: TeamResultCachePatch) => void;
  clearForTeam: (teamId: string) => void;
  clearAll: () => void;
}

export function pickTeamResultCachePatch(
  patch: Partial<Team>
): TeamResultCachePatch | null {
  const result: TeamResultCachePatch = {};
  let hasPatch = false;

  if ("optimizationResult" in patch) {
    result.optimizationResult = patch.optimizationResult ?? null;
    hasPatch = true;
  }
  if ("choiceResults" in patch) {
    result.choiceResults = patch.choiceResults;
    hasPatch = true;
  }
  if ("weaponChoiceResult" in patch) {
    result.weaponChoiceResult = patch.weaponChoiceResult ?? null;
    hasPatch = true;
  }

  return hasPatch ? result : null;
}

export const useTeamResultCacheStore = create<TeamResultCacheState>()(
  persist(
    (set, get) => ({
      resultsByTeamId: {},

      getForTeam: (teamId) => get().resultsByTeamId[teamId],

      patchForTeam: (teamId, patch) =>
        set((state) => ({
          resultsByTeamId: {
            ...state.resultsByTeamId,
            [teamId]: {
              ...(state.resultsByTeamId[teamId] ?? {}),
              ...patch,
            },
          },
        })),

      clearForTeam: (teamId) =>
        set((state) => {
          const next = { ...state.resultsByTeamId };
          delete next[teamId];
          return { resultsByTeamId: next };
        }),

      clearAll: () => set({ resultsByTeamId: {} }),
    }),
    {
      name: "team-result-cache",
      partialize: (state) => ({ resultsByTeamId: state.resultsByTeamId }),
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedTeamResultCacheStoreSchema.safeParse(persistedState);
        const persisted = parsed.success
          ? parsed.data
          : PersistedTeamResultCacheStoreSchema.parse({});
        return {
          ...currentState,
          resultsByTeamId: persisted.resultsByTeamId as Record<
            string,
            TeamResultCacheEntry
          >,
        };
      },
    }
  )
);
