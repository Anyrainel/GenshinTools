/**
 * Settings for resource spending recommendations.
 * Holds per-tier completeness thresholds and per-kind per-tier minimum
 * expected score gain filters.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tier } from "@/data/enums";
import {
  DEFAULT_MIN_SCORE_DIFF,
  DEFAULT_TIER_THRESHOLDS,
  type KindTierMinScore,
  type ResourceKind,
  type TierCompletenessThresholds,
} from "@/lib/account-data/resourceTips";
import { migrateResourceRecStore } from "./migration/resource";
import { PersistedResourceRecStoreSchema } from "./schemas";

interface ResourceRecState {
  thresholds: TierCompletenessThresholds;
  minScoreDiff: KindTierMinScore;
  panelOpen: boolean;
  showCraft: boolean;
  showReroll: boolean;
  showLevelup: boolean;
  setThreshold: (tier: Tier, value: number) => void;
  setMinScoreDiff: (kind: ResourceKind, tier: Tier, value: number) => void;
  resetThresholds: () => void;
  resetMinScoreDiff: () => void;
  setPanelOpen: (open: boolean) => void;
  setShowCraft: (v: boolean) => void;
  setShowReroll: (v: boolean) => void;
  setShowLevelup: (v: boolean) => void;
}

export const useResourceRecStore = create<ResourceRecState>()(
  persist(
    (set) => ({
      thresholds: { ...DEFAULT_TIER_THRESHOLDS },
      minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
      panelOpen: false,
      showCraft: true,
      showReroll: true,
      showLevelup: true,

      setThreshold: (tier, value) =>
        set((state) => ({
          thresholds: { ...state.thresholds, [tier]: value },
        })),

      setMinScoreDiff: (kind, tier, value) =>
        set((state) => ({
          minScoreDiff: {
            ...state.minScoreDiff,
            [kind]: { ...state.minScoreDiff[kind], [tier]: value },
          },
        })),

      resetThresholds: () =>
        set({ thresholds: { ...DEFAULT_TIER_THRESHOLDS } }),
      resetMinScoreDiff: () =>
        set({ minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF) }),

      setPanelOpen: (open) => set({ panelOpen: open }),
      setShowCraft: (v) => set({ showCraft: v }),
      setShowReroll: (v) => set({ showReroll: v }),
      setShowLevelup: (v) => set({ showLevelup: v }),
    }),
    {
      name: "resource-rec-settings",
      version: 6,
      migrate: migrateResourceRecStore,
      partialize: (state) => ({
        thresholds: state.thresholds,
        minScoreDiff: state.minScoreDiff,
        panelOpen: state.panelOpen,
        showCraft: state.showCraft,
        showReroll: state.showReroll,
        showLevelup: state.showLevelup,
      }),
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedResourceRecStoreSchema.safeParse(persistedState);
        if (!parsed.success) return currentState;
        const persisted = parsed.data;
        return {
          ...currentState,
          ...persisted,
          showCraft: persisted.showCraft ?? currentState.showCraft,
          showReroll: persisted.showReroll ?? currentState.showReroll,
          showLevelup: persisted.showLevelup ?? currentState.showLevelup,
          thresholds: {
            ...currentState.thresholds,
            ...persisted.thresholds,
          },
          minScoreDiff: {
            craft: {
              ...currentState.minScoreDiff.craft,
              ...persisted.minScoreDiff.craft,
            },
            reroll: {
              ...currentState.minScoreDiff.reroll,
              ...persisted.minScoreDiff.reroll,
            },
            levelup: {
              ...currentState.minScoreDiff.levelup,
              ...persisted.minScoreDiff.levelup,
            },
          },
        };
      },
    }
  )
);
