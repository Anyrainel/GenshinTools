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
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        // v0 → v1: add customFlexInputs
        if (version < 1) {
          const settings = (state.settings ?? {}) as Record<string, unknown>;
          if (!settings.customFlexInputs) {
            settings.customFlexInputs = [];
          }
        }
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
