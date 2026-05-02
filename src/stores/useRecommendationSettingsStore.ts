import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LuckExpectation, Tier } from "@/data/enums";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import {
  cloneDefaultRecommendationSettings,
  normalizeRecommendationSettings,
  type RecommendationSettings,
} from "@/lib/account-data/recommendationSettings";
import type { AccountProfileId } from "@/lib/account-data/types";
import { PersistedRecommendationSettingsStoreSchema } from "./schemas";
import { useAccountStore } from "./useAccountStore";

interface RecommendationSettingsState {
  settingsByProfileId: Record<AccountProfileId, RecommendationSettings>;
  setAllowPoolArtifactSteals: (allow: boolean) => void;
  setTierLuckExpectation: (tier: Tier, luck: LuckExpectation) => void;
  renameProfileSettings: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => void;
}

const FALLBACK_RECOMMENDATION_SETTINGS = cloneDefaultRecommendationSettings();

const getActiveProfileId = () =>
  useAccountStore.getState().activeAccountId ?? DEFAULT_ACCOUNT_PROFILE_ID;

export const getRecommendationSettingsForProfile = (
  state: Pick<RecommendationSettingsState, "settingsByProfileId">,
  profileId: AccountProfileId | null
): RecommendationSettings =>
  state.settingsByProfileId[profileId ?? DEFAULT_ACCOUNT_PROFILE_ID] ??
  FALLBACK_RECOMMENDATION_SETTINGS;

export const selectActiveRecommendationSettings = (
  state: Pick<RecommendationSettingsState, "settingsByProfileId">
): RecommendationSettings =>
  getRecommendationSettingsForProfile(state, getActiveProfileId());

export const getActiveRecommendationSettings = (): RecommendationSettings =>
  selectActiveRecommendationSettings(useRecommendationSettingsStore.getState());

const settingsEqual = (
  first: RecommendationSettings,
  second: RecommendationSettings
): boolean => JSON.stringify(first) === JSON.stringify(second);

export const useRecommendationSettingsStore =
  create<RecommendationSettingsState>()(
    persist(
      (set) => ({
        settingsByProfileId: {
          [DEFAULT_ACCOUNT_PROFILE_ID]: cloneDefaultRecommendationSettings(),
        },

        setAllowPoolArtifactSteals: (allow) =>
          set((state) => {
            const current = selectActiveRecommendationSettings(state);
            return {
              settingsByProfileId: {
                ...state.settingsByProfileId,
                [getActiveProfileId()]: {
                  ...current,
                  allowPoolArtifactSteals: allow,
                },
              },
            };
          }),

        setTierLuckExpectation: (tier, luck) =>
          set((state) => {
            const current = selectActiveRecommendationSettings(state);
            return {
              settingsByProfileId: {
                ...state.settingsByProfileId,
                [getActiveProfileId()]: {
                  ...current,
                  luckExpectationByTier: {
                    ...current.luckExpectationByTier,
                    [tier]: luck,
                  },
                },
              },
            };
          }),

        renameProfileSettings: (sourceProfileId, targetProfileId) =>
          set((state) => {
            if (sourceProfileId === targetProfileId) return state;
            const sourceSettings = state.settingsByProfileId[sourceProfileId];
            if (!sourceSettings) return state;

            const settingsByProfileId = { ...state.settingsByProfileId };
            delete settingsByProfileId[sourceProfileId];

            const nextSettings =
              normalizeRecommendationSettings(sourceSettings);
            if (
              !settingsEqual(nextSettings, cloneDefaultRecommendationSettings())
            ) {
              settingsByProfileId[targetProfileId] = nextSettings;
            }

            return { settingsByProfileId };
          }),
      }),
      {
        name: "recommendation-settings",
        version: 1,
        partialize: (state) => ({
          settingsByProfileId: state.settingsByProfileId,
        }),
        merge: (persistedState, currentState) => {
          const parsed =
            PersistedRecommendationSettingsStoreSchema.safeParse(
              persistedState
            );
          if (!parsed.success) return currentState;
          const settingsByProfileId = Object.fromEntries(
            Object.entries(parsed.data.settingsByProfileId).map(
              ([profileId, settings]) => [
                profileId,
                normalizeRecommendationSettings(settings),
              ]
            )
          ) as Record<AccountProfileId, RecommendationSettings>;
          if (Object.keys(settingsByProfileId).length === 0) {
            settingsByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] =
              cloneDefaultRecommendationSettings();
          }
          return {
            ...currentState,
            settingsByProfileId,
          };
        },
      }
    )
  );

useAccountStore.subscribe((state, prevState) => {
  if (state.activeAccountId !== prevState.activeAccountId) {
    // Re-run active-settings selectors after account changes without storing a mirror.
    useRecommendationSettingsStore.setState((recommendationState) => ({
      settingsByProfileId: recommendationState.settingsByProfileId,
    }));
  }
});
