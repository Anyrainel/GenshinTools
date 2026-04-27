import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/defaults";
import type { TriageSettings } from "@/lib/account-data/triage/types";
import { PersistedTriageStoreSchema } from "./schemas";

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
        // v3 → v4: rename strategicHighLevelEvaluation → highLevelProtection
        // and flip its meaning (protection = !evaluation).
        if (version < 4) {
          const prev = settings.strategicHighLevelEvaluation;
          settings.highLevelProtection = prev == null ? true : !prev;
          settings.strategicHighLevelEvaluation = undefined;
        }
        state.settings = settings;
        return state as Partial<TriageState>;
      },
      partialize: (state) => ({
        settings: state.settings,
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedTriageStoreSchema.safeParse(persistedState);
        if (!parsed.success) return currentState;
        return {
          ...currentState,
          settings: {
            ...currentState.settings,
            ...(parsed.data.settings as Partial<TriageSettings>),
          },
        };
      },
    }
  )
);
