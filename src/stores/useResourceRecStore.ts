/**
 * Settings for resource spending recommendations.
 * Holds per-tier completeness thresholds and per-kind per-tier minimum
 * expected score gain filters.
 */

import type { Tier } from "@/data/types";
import {
  DEFAULT_MIN_SCORE_DIFF,
  DEFAULT_TIER_THRESHOLDS,
  type KindTierMinScore,
  type ResourceKind,
  type TierCompletenessThresholds,
} from "@/lib/account-data/resourceTips";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        // v2 → v3: add showCraft / showReroll (default on)
        if (version < 3) {
          if (state.showCraft === undefined) state.showCraft = true;
          if (state.showReroll === undefined) state.showReroll = true;
        }
        // v3 → v4: add showLevelup (default on)
        if (version < 4) {
          if (state.showLevelup === undefined) state.showLevelup = true;
        }
        // v<6 → v6: minScoreDiff changed from flat TierCompletenessThresholds
        // to Record<ResourceKind, TierCompletenessThresholds>.
        // Old shape: { S: 0, A: 5, ... }
        // New shape: { craft: { S: 0, ... }, reroll: { S: 5, ... }, ... }
        if (version < 6) {
          const old = state.minScoreDiff as
            | TierCompletenessThresholds
            | undefined;
          if (old && typeof old === "object" && "S" in old) {
            // Migrate: use old values for craft/levelup, bump reroll higher
            state.minScoreDiff = {
              craft: { ...old },
              reroll: {
                S: (old.S ?? 0) + 5,
                A: (old.A ?? 5) + 5,
                B: (old.B ?? 10) + 5,
                C: (old.C ?? 15) + 5,
                D: (old.D ?? 20) + 5,
                Pool: (old.Pool ?? 20) + 5,
              },
              levelup: { ...old },
            };
          } else {
            state.minScoreDiff = structuredClone(DEFAULT_MIN_SCORE_DIFF);
          }
          // Remove obsolete kindMinScore field from v5
          state.kindMinScore = undefined;
        }
        return state as unknown as Partial<ResourceRecState>;
      },
      partialize: (state) => ({
        thresholds: state.thresholds,
        minScoreDiff: state.minScoreDiff,
        panelOpen: state.panelOpen,
        showCraft: state.showCraft,
        showReroll: state.showReroll,
        showLevelup: state.showLevelup,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ResourceRecState>;
        return {
          ...currentState,
          ...(persisted ?? {}),
          thresholds: {
            ...currentState.thresholds,
            ...(persisted?.thresholds ?? {}),
          },
          minScoreDiff: {
            craft: {
              ...currentState.minScoreDiff.craft,
              ...(persisted?.minScoreDiff?.craft ?? {}),
            },
            reroll: {
              ...currentState.minScoreDiff.reroll,
              ...(persisted?.minScoreDiff?.reroll ?? {}),
            },
            levelup: {
              ...currentState.minScoreDiff.levelup,
              ...(persisted?.minScoreDiff?.levelup ?? {}),
            },
          },
        };
      },
    }
  )
);
