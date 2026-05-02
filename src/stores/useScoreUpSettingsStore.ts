import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LuckExpectation, Tier } from "@/data/enums";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import {
  cloneDefaultScoreUpSettings,
  normalizeScoreUpSettings,
  type ScoreUpSettings,
} from "@/lib/account-data/scoreUpSettings";
import type { AccountProfileId } from "@/lib/account-data/types";
import { PersistedScoreUpSettingsStoreSchema } from "./schemas";
import { useAccountStore } from "./useAccountStore";

export interface ScoreUpSettingsState {
  settingsByProfileId: Record<AccountProfileId, ScoreUpSettings>;
  setAllowPoolArtifactSteals: (allow: boolean) => void;
  setTierLuckExpectation: (tier: Tier, luck: LuckExpectation) => void;
  renameProfileSettings: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => void;
}

const FALLBACK_SCORE_UP_SETTINGS = cloneDefaultScoreUpSettings();

const getActiveProfileId = () =>
  useAccountStore.getState().activeAccountId ?? DEFAULT_ACCOUNT_PROFILE_ID;

export const getScoreUpSettingsForProfile = (
  state: Pick<ScoreUpSettingsState, "settingsByProfileId">,
  profileId: AccountProfileId | null
): ScoreUpSettings =>
  state.settingsByProfileId[profileId ?? DEFAULT_ACCOUNT_PROFILE_ID] ??
  FALLBACK_SCORE_UP_SETTINGS;

export const selectActiveScoreUpSettings = (
  state: Pick<ScoreUpSettingsState, "settingsByProfileId">
): ScoreUpSettings => getScoreUpSettingsForProfile(state, getActiveProfileId());

export const getActiveScoreUpSettings = (): ScoreUpSettings =>
  selectActiveScoreUpSettings(useScoreUpSettingsStore.getState());

const settingsEqual = (
  first: ScoreUpSettings,
  second: ScoreUpSettings
): boolean => JSON.stringify(first) === JSON.stringify(second);

export const useScoreUpSettingsStore = create<ScoreUpSettingsState>()(
  persist(
    (set) => ({
      settingsByProfileId: {
        [DEFAULT_ACCOUNT_PROFILE_ID]: cloneDefaultScoreUpSettings(),
      },

      setAllowPoolArtifactSteals: (allow) =>
        set((state) => {
          const current = selectActiveScoreUpSettings(state);
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
          const current = selectActiveScoreUpSettings(state);
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

          const nextSettings = normalizeScoreUpSettings(sourceSettings);
          if (!settingsEqual(nextSettings, cloneDefaultScoreUpSettings())) {
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
          PersistedScoreUpSettingsStoreSchema.safeParse(persistedState);
        if (!parsed.success) return currentState;
        const settingsByProfileId = Object.fromEntries(
          Object.entries(parsed.data.settingsByProfileId).map(
            ([profileId, settings]) => [
              profileId,
              normalizeScoreUpSettings(settings),
            ]
          )
        ) as Record<AccountProfileId, ScoreUpSettings>;
        if (Object.keys(settingsByProfileId).length === 0) {
          settingsByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] =
            cloneDefaultScoreUpSettings();
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
    useScoreUpSettingsStore.setState((scoreUpState) => ({
      settingsByProfileId: scoreUpState.settingsByProfileId,
    }));
  }
});
