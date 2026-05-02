/**
 * Settings for resource spending recommendations.
 * Holds per-tier completeness thresholds and per-kind per-tier minimum
 * expected score gain filters.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tier } from "@/data/enums";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import {
  DEFAULT_MIN_SCORE_DIFF,
  DEFAULT_TIER_THRESHOLDS,
  type KindTierMinScore,
  type ResourceKind,
  type TierCompletenessThresholds,
} from "@/lib/account-data/resourceTips";
import type { AccountProfileId } from "@/lib/account-data/types";
import { migrateResourceRecStore } from "./migration/resource";
import { PersistedResourceRecStoreSchema } from "./schemas";
import { useAccountStore } from "./useAccountStore";

export interface ResourceRecSettings {
  thresholds: TierCompletenessThresholds;
  minScoreDiff: KindTierMinScore;
  panelOpen: boolean;
  showCraft: boolean;
  showReroll: boolean;
  showLevelup: boolean;
}

interface ResourceRecSettingsInput {
  thresholds: Partial<TierCompletenessThresholds>;
  minScoreDiff: Record<ResourceKind, Partial<TierCompletenessThresholds>>;
  panelOpen: boolean;
  showCraft: boolean;
  showReroll: boolean;
  showLevelup: boolean;
}

export interface ResourceRecState {
  settingsByProfileId: Record<AccountProfileId, ResourceRecSettings>;
  setThreshold: (tier: Tier, value: number) => void;
  setMinScoreDiff: (kind: ResourceKind, tier: Tier, value: number) => void;
  resetThresholds: () => void;
  resetMinScoreDiff: () => void;
  setPanelOpen: (open: boolean) => void;
  setShowCraft: (v: boolean) => void;
  setShowReroll: (v: boolean) => void;
  setShowLevelup: (v: boolean) => void;
  cloneSettingsForProfile: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => boolean;
  renameProfileSettings: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => void;
}

const cloneDefaultSettings = (): ResourceRecSettings => ({
  thresholds: { ...DEFAULT_TIER_THRESHOLDS },
  minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
  panelOpen: false,
  showCraft: true,
  showReroll: true,
  showLevelup: true,
});

const FALLBACK_RESOURCE_REC_SETTINGS = cloneDefaultSettings();

const normalizeSettings = (
  settings: ResourceRecSettingsInput
): ResourceRecSettings => ({
  thresholds: {
    ...DEFAULT_TIER_THRESHOLDS,
    ...settings.thresholds,
  },
  minScoreDiff: {
    craft: {
      ...DEFAULT_MIN_SCORE_DIFF.craft,
      ...settings.minScoreDiff.craft,
    },
    reroll: {
      ...DEFAULT_MIN_SCORE_DIFF.reroll,
      ...settings.minScoreDiff.reroll,
    },
    levelup: {
      ...DEFAULT_MIN_SCORE_DIFF.levelup,
      ...settings.minScoreDiff.levelup,
    },
  },
  panelOpen: settings.panelOpen,
  showCraft: settings.showCraft,
  showReroll: settings.showReroll,
  showLevelup: settings.showLevelup,
});

const getActiveProfileId = () =>
  useAccountStore.getState().activeAccountId ?? DEFAULT_ACCOUNT_PROFILE_ID;

export const getResourceRecSettingsForProfile = (
  state: Pick<ResourceRecState, "settingsByProfileId">,
  profileId: AccountProfileId | null
) =>
  state.settingsByProfileId[profileId ?? DEFAULT_ACCOUNT_PROFILE_ID] ??
  FALLBACK_RESOURCE_REC_SETTINGS;

export const selectActiveResourceRecSettings = (
  state: Pick<ResourceRecState, "settingsByProfileId">
): ResourceRecSettings =>
  getResourceRecSettingsForProfile(state, getActiveProfileId());

export const getActiveResourceRecSettings = (): ResourceRecSettings =>
  selectActiveResourceRecSettings(useResourceRecStore.getState());

export const selectActiveResourceRecThresholds = (
  state: Pick<ResourceRecState, "settingsByProfileId">
): TierCompletenessThresholds =>
  selectActiveResourceRecSettings(state).thresholds;

export const selectActiveResourceRecMinScoreDiff = (
  state: Pick<ResourceRecState, "settingsByProfileId">
): KindTierMinScore => selectActiveResourceRecSettings(state).minScoreDiff;

export const selectActiveResourceRecPanelOpen = (
  state: Pick<ResourceRecState, "settingsByProfileId">
): boolean => selectActiveResourceRecSettings(state).panelOpen;

export const selectActiveResourceRecShowCraft = (
  state: Pick<ResourceRecState, "settingsByProfileId">
): boolean => selectActiveResourceRecSettings(state).showCraft;

export const selectActiveResourceRecShowReroll = (
  state: Pick<ResourceRecState, "settingsByProfileId">
): boolean => selectActiveResourceRecSettings(state).showReroll;

export const selectActiveResourceRecShowLevelup = (
  state: Pick<ResourceRecState, "settingsByProfileId">
): boolean => selectActiveResourceRecSettings(state).showLevelup;

const cloneSettings = (settings: ResourceRecSettings): ResourceRecSettings =>
  structuredClone(settings);

const settingsEqual = (
  first: ResourceRecSettings,
  second: ResourceRecSettings
): boolean => JSON.stringify(first) === JSON.stringify(second);

export const useResourceRecStore = create<ResourceRecState>()(
  persist(
    (set) => ({
      settingsByProfileId: {
        [DEFAULT_ACCOUNT_PROFILE_ID]: cloneDefaultSettings(),
      },

      setThreshold: (tier, value) =>
        set((state) => {
          const current = selectActiveResourceRecSettings(state);
          const next = {
            ...current,
            thresholds: { ...current.thresholds, [tier]: value },
          };
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),

      setMinScoreDiff: (kind, tier, value) =>
        set((state) => {
          const current = selectActiveResourceRecSettings(state);
          const next = {
            ...current,
            minScoreDiff: {
              ...current.minScoreDiff,
              [kind]: { ...current.minScoreDiff[kind], [tier]: value },
            },
          };
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),

      resetThresholds: () =>
        set((state) => {
          const next = {
            ...selectActiveResourceRecSettings(state),
            thresholds: { ...DEFAULT_TIER_THRESHOLDS },
          };
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),
      resetMinScoreDiff: () =>
        set((state) => {
          const next = {
            ...selectActiveResourceRecSettings(state),
            minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
          };
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),

      setPanelOpen: (open) =>
        set((state) => {
          const next = {
            ...selectActiveResourceRecSettings(state),
            panelOpen: open,
          };
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),
      setShowCraft: (v) =>
        set((state) => {
          const next = {
            ...selectActiveResourceRecSettings(state),
            showCraft: v,
          };
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),
      setShowReroll: (v) =>
        set((state) => {
          const next = {
            ...selectActiveResourceRecSettings(state),
            showReroll: v,
          };
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),
      setShowLevelup: (v) =>
        set((state) => {
          const next = {
            ...selectActiveResourceRecSettings(state),
            showLevelup: v,
          };
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),

      cloneSettingsForProfile: (sourceProfileId, targetProfileId) => {
        let didClone = false;
        set((state) => {
          const sourceSettings = getResourceRecSettingsForProfile(
            state,
            sourceProfileId
          );
          if (settingsEqual(sourceSettings, cloneDefaultSettings())) return {};

          didClone = true;
          const cloned = cloneSettings(sourceSettings);
          return {
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [targetProfileId]: cloned,
            },
          };
        });
        return didClone;
      },

      renameProfileSettings: (sourceProfileId, targetProfileId) =>
        set((state) => {
          if (sourceProfileId === targetProfileId) return state;
          const sourceSettings = state.settingsByProfileId[sourceProfileId];
          if (!sourceSettings) return state;

          const settingsByProfileId = { ...state.settingsByProfileId };
          delete settingsByProfileId[sourceProfileId];

          const nextSettings = settingsEqual(
            sourceSettings,
            cloneDefaultSettings()
          )
            ? cloneDefaultSettings()
            : cloneSettings(sourceSettings);
          if (!settingsEqual(nextSettings, cloneDefaultSettings())) {
            settingsByProfileId[targetProfileId] = nextSettings;
          }

          return {
            settingsByProfileId,
          };
        }),
    }),
    {
      name: "resource-rec-settings",
      version: 8,
      migrate: migrateResourceRecStore,
      partialize: (state) => ({
        settingsByProfileId: state.settingsByProfileId,
      }),
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedResourceRecStoreSchema.safeParse(persistedState);
        if (!parsed.success) return currentState;
        const normalizedSettingsByProfileId = Object.fromEntries(
          Object.entries(parsed.data.settingsByProfileId).map(
            ([profileId, settings]) => [profileId, normalizeSettings(settings)]
          )
        ) as Record<AccountProfileId, ResourceRecSettings>;
        if (Object.keys(normalizedSettingsByProfileId).length === 0) {
          normalizedSettingsByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] =
            cloneDefaultSettings();
        }
        return {
          ...currentState,
          settingsByProfileId: normalizedSettingsByProfileId,
        };
      },
    }
  )
);

useAccountStore.subscribe((state, prevState) => {
  if (state.activeAccountId !== prevState.activeAccountId) {
    // Re-run active-settings selectors after account changes without storing a mirror.
    useResourceRecStore.setState((resourceState) => ({
      settingsByProfileId: resourceState.settingsByProfileId,
    }));
  }
});
