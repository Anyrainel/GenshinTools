import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountProfileId } from "@/lib/account-data/types";
import { PersistedAchievementStoreSchema } from "./schemas";

interface AchievementStore {
  /** Earned achievement IDs keyed by local account profile. Never cloud-synced. */
  earnedIdsByProfileId: Record<AccountProfileId, number[]>;
  replaceEarnedIds: (
    profileId: AccountProfileId,
    achievementIds: readonly number[]
  ) => void;
  setSeriesAchievementStatus: (
    profileId: AccountProfileId,
    seriesIds: readonly number[],
    achievementId: number,
    finished: boolean
  ) => void;
  renameProfile: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => void;
  deleteProfile: (profileId: AccountProfileId) => void;
  clearAll: () => void;
}

function normalizeAchievementIds(ids: readonly number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id >= 0))].sort(
    (a, b) => a - b
  );
}

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set) => ({
      earnedIdsByProfileId: {},

      replaceEarnedIds: (profileId, achievementIds) =>
        set((state) => ({
          earnedIdsByProfileId: {
            ...state.earnedIdsByProfileId,
            [profileId]: normalizeAchievementIds(achievementIds),
          },
        })),

      setSeriesAchievementStatus: (
        profileId,
        seriesIds,
        achievementId,
        finished
      ) =>
        set((state) => {
          const achievementIndex = seriesIds.indexOf(achievementId);
          if (achievementIndex < 0) return state;

          const earned = new Set(state.earnedIdsByProfileId[profileId] ?? []);
          const affectedIds = finished
            ? seriesIds.slice(0, achievementIndex + 1)
            : seriesIds.slice(achievementIndex);
          for (const id of affectedIds) {
            if (finished) earned.add(id);
            else earned.delete(id);
          }

          return {
            earnedIdsByProfileId: {
              ...state.earnedIdsByProfileId,
              [profileId]: normalizeAchievementIds([...earned]),
            },
          };
        }),

      renameProfile: (sourceProfileId, targetProfileId) =>
        set((state) => {
          if (sourceProfileId === targetProfileId) return state;
          const source = state.earnedIdsByProfileId[sourceProfileId];
          if (!source) return state;
          const earnedIdsByProfileId = { ...state.earnedIdsByProfileId };
          delete earnedIdsByProfileId[sourceProfileId];
          earnedIdsByProfileId[targetProfileId] = source;
          return { earnedIdsByProfileId };
        }),

      deleteProfile: (profileId) =>
        set((state) => {
          if (!(profileId in state.earnedIdsByProfileId)) return state;
          const earnedIdsByProfileId = { ...state.earnedIdsByProfileId };
          delete earnedIdsByProfileId[profileId];
          return { earnedIdsByProfileId };
        }),

      clearAll: () => set({ earnedIdsByProfileId: {} }),
    }),
    {
      name: "genshin-achievement-storage",
      version: 1,
      partialize: (state) => ({
        earnedIdsByProfileId: state.earnedIdsByProfileId,
      }),
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedAchievementStoreSchema.safeParse(persistedState);
        return parsed.success
          ? { ...currentState, ...parsed.data }
          : currentState;
      },
    }
  )
);
