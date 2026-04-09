import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/defaults";
import type { TriageSettings } from "@/lib/account-data/triage/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TriageState {
  settings: TriageSettings;
  setSettings: (settings: TriageSettings) => void;
  updateSettings: (patch: Partial<TriageSettings>) => void;
}

export const useTriageStore = create<TriageState>()(
  persist(
    (set) => ({
      settings: DEFAULT_TRIAGE_SETTINGS,

      setSettings: (settings) => set({ settings }),

      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),
    }),
    {
      name: "triage-settings",
      version: 4,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        const settings = (state.settings ?? {}) as Record<string, unknown>;
        // v0 → v1: add customFlexInputs
        if (version < 1) {
          if (!settings.customFlexInputs) {
            settings.customFlexInputs = [];
          }
        }
        // v1 → v2: add triageMode (default "strict" preserves existing behavior)
        if (version < 2) {
          if (!settings.triageMode) {
            settings.triageMode = "strict";
          }
        }
        // v2 → v3: add strategicHighLevelEvaluation (default off preserves behavior)
        if (version < 3) {
          if (settings.strategicHighLevelEvaluation == null) {
            settings.strategicHighLevelEvaluation = false;
          }
        }
        // v3 → v4: rename strategicHighLevelEvaluation → highLevelProtection
        // and flip its meaning (protection = !evaluation).
        if (version < 4) {
          const prev = settings.strategicHighLevelEvaluation;
          settings.highLevelProtection = prev == null ? true : !prev;
          settings.strategicHighLevelEvaluation = undefined;
        }
        state.settings = settings;
        return state as unknown as Partial<TriageState>;
      },
      partialize: (state) => ({
        settings: state.settings,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TriageState>;
        return {
          ...currentState,
          ...(persisted ?? {}),
          settings: {
            ...currentState.settings,
            ...(persisted?.settings ?? {}),
          },
        };
      },
    }
  )
);
