/**
 * Settings for resource spending recommendations in EvaluationView.
 * Holds per-tier completeness thresholds (builds at/above their tier
 * threshold receive no suggestions) and per-tier minimum expected score
 * gain (suggestions below the min gain are filtered out).
 */

import {
  DEFAULT_MIN_SCORE_DIFF,
  DEFAULT_TIER_THRESHOLDS,
  type TierCompletenessThresholds,
} from "@/lib/account-data/resourceRecommendations";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ResourceRecState {
  thresholds: TierCompletenessThresholds;
  minScoreDiff: TierCompletenessThresholds;
  panelOpen: boolean;
  showCraft: boolean;
  showReroll: boolean;
  setThreshold: (tier: keyof TierCompletenessThresholds, value: number) => void;
  setMinScoreDiff: (
    tier: keyof TierCompletenessThresholds,
    value: number
  ) => void;
  resetThresholds: () => void;
  resetMinScoreDiff: () => void;
  setPanelOpen: (open: boolean) => void;
  setShowCraft: (v: boolean) => void;
  setShowReroll: (v: boolean) => void;
}

export const useResourceRecStore = create<ResourceRecState>()(
  persist(
    (set) => ({
      thresholds: { ...DEFAULT_TIER_THRESHOLDS },
      minScoreDiff: { ...DEFAULT_MIN_SCORE_DIFF },
      panelOpen: false,
      showCraft: true,
      showReroll: true,

      setThreshold: (tier, value) =>
        set((state) => ({
          thresholds: { ...state.thresholds, [tier]: value },
        })),

      setMinScoreDiff: (tier, value) =>
        set((state) => ({
          minScoreDiff: { ...state.minScoreDiff, [tier]: value },
        })),

      resetThresholds: () =>
        set({ thresholds: { ...DEFAULT_TIER_THRESHOLDS } }),
      resetMinScoreDiff: () =>
        set({ minScoreDiff: { ...DEFAULT_MIN_SCORE_DIFF } }),

      setPanelOpen: (open) => set({ panelOpen: open }),
      setShowCraft: (v) => set({ showCraft: v }),
      setShowReroll: (v) => set({ showReroll: v }),
    }),
    {
      name: "resource-rec-settings",
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        // v1 → v2: add minScoreDiff
        if (version < 2 && !state.minScoreDiff) {
          state.minScoreDiff = { ...DEFAULT_MIN_SCORE_DIFF };
        }
        // v2 → v3: add showCraft / showReroll (default on)
        if (version < 3) {
          if (state.showCraft === undefined) state.showCraft = true;
          if (state.showReroll === undefined) state.showReroll = true;
        }
        return state as unknown as Partial<ResourceRecState>;
      },
      partialize: (state) => ({
        thresholds: state.thresholds,
        minScoreDiff: state.minScoreDiff,
        panelOpen: state.panelOpen,
        showCraft: state.showCraft,
        showReroll: state.showReroll,
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
            ...currentState.minScoreDiff,
            ...(persisted?.minScoreDiff ?? {}),
          },
        };
      },
    }
  )
);
