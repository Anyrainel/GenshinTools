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

interface ResourceRecSettings {
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

interface ResourceRecState {
  thresholds: TierCompletenessThresholds;
  minScoreDiff: KindTierMinScore;
  panelOpen: boolean;
  showCraft: boolean;
  showReroll: boolean;
  showLevelup: boolean;
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
  setActiveProfile: (profileId: AccountProfileId | null) => void;
}

const cloneDefaultSettings = (): ResourceRecSettings => ({
  thresholds: { ...DEFAULT_TIER_THRESHOLDS },
  minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
  panelOpen: false,
  showCraft: true,
  showReroll: true,
  showLevelup: true,
});

const applySettings = (settings: ResourceRecSettings) => ({
  thresholds: settings.thresholds,
  minScoreDiff: settings.minScoreDiff,
  panelOpen: settings.panelOpen,
  showCraft: settings.showCraft,
  showReroll: settings.showReroll,
  showLevelup: settings.showLevelup,
});

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

const getSettingsForProfile = (
  state: Pick<ResourceRecState, "settingsByProfileId">,
  profileId: AccountProfileId | null
) =>
  state.settingsByProfileId[profileId ?? DEFAULT_ACCOUNT_PROFILE_ID] ??
  cloneDefaultSettings();

const currentSettings = (state: ResourceRecState): ResourceRecSettings => ({
  thresholds: state.thresholds,
  minScoreDiff: state.minScoreDiff,
  panelOpen: state.panelOpen,
  showCraft: state.showCraft,
  showReroll: state.showReroll,
  showLevelup: state.showLevelup,
});

const cloneSettings = (settings: ResourceRecSettings): ResourceRecSettings =>
  structuredClone(settings);

const settingsEqual = (
  first: ResourceRecSettings,
  second: ResourceRecSettings
): boolean => JSON.stringify(first) === JSON.stringify(second);

export const useResourceRecStore = create<ResourceRecState>()(
  persist(
    (set) => ({
      thresholds: { ...DEFAULT_TIER_THRESHOLDS },
      minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
      panelOpen: false,
      showCraft: true,
      showReroll: true,
      showLevelup: true,
      settingsByProfileId: {
        [DEFAULT_ACCOUNT_PROFILE_ID]: cloneDefaultSettings(),
      },

      setThreshold: (tier, value) =>
        set((state) => {
          const next = {
            ...currentSettings(state),
            thresholds: { ...state.thresholds, [tier]: value },
          };
          return {
            ...applySettings(next),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),

      setMinScoreDiff: (kind, tier, value) =>
        set((state) => {
          const next = {
            ...currentSettings(state),
            minScoreDiff: {
              ...state.minScoreDiff,
              [kind]: { ...state.minScoreDiff[kind], [tier]: value },
            },
          };
          return {
            ...applySettings(next),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),

      resetThresholds: () =>
        set((state) => {
          const next = {
            ...currentSettings(state),
            thresholds: { ...DEFAULT_TIER_THRESHOLDS },
          };
          return {
            ...applySettings(next),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),
      resetMinScoreDiff: () =>
        set((state) => {
          const next = {
            ...currentSettings(state),
            minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
          };
          return {
            ...applySettings(next),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),

      setPanelOpen: (open) =>
        set((state) => {
          const next = { ...currentSettings(state), panelOpen: open };
          return {
            ...applySettings(next),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),
      setShowCraft: (v) =>
        set((state) => {
          const next = { ...currentSettings(state), showCraft: v };
          return {
            ...applySettings(next),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),
      setShowReroll: (v) =>
        set((state) => {
          const next = { ...currentSettings(state), showReroll: v };
          return {
            ...applySettings(next),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),
      setShowLevelup: (v) =>
        set((state) => {
          const next = { ...currentSettings(state), showLevelup: v };
          return {
            ...applySettings(next),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [getActiveProfileId()]: next,
            },
          };
        }),

      cloneSettingsForProfile: (sourceProfileId, targetProfileId) => {
        let didClone = false;
        set((state) => {
          const sourceSettings = getSettingsForProfile(state, sourceProfileId);
          if (settingsEqual(sourceSettings, cloneDefaultSettings())) return {};

          didClone = true;
          const cloned = cloneSettings(sourceSettings);
          return {
            ...(getActiveProfileId() === targetProfileId
              ? applySettings(cloned)
              : {}),
            settingsByProfileId: {
              ...state.settingsByProfileId,
              [targetProfileId]: cloned,
            },
          };
        });
        return didClone;
      },

      setActiveProfile: (profileId) =>
        set((state) => applySettings(getSettingsForProfile(state, profileId))),
    }),
    {
      name: "resource-rec-settings",
      version: 8,
      migrate: migrateResourceRecStore,
      partialize: (state) => ({
        settingsByProfileId: {
          ...state.settingsByProfileId,
          [getActiveProfileId()]: normalizeSettings(currentSettings(state)),
        },
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
        const activeSettings =
          normalizedSettingsByProfileId[getActiveProfileId()] ??
          normalizedSettingsByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] ??
          cloneDefaultSettings();
        return {
          ...currentState,
          ...applySettings(normalizeSettings(activeSettings)),
          settingsByProfileId: normalizedSettingsByProfileId,
        };
      },
    }
  )
);

useAccountStore.subscribe((state, prevState) => {
  if (state.activeAccountId !== prevState.activeAccountId) {
    useResourceRecStore.getState().setActiveProfile(state.activeAccountId);
  }
});
