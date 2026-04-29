import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import type { TriageSettings } from "@/lib/account-data/triage/types";
import { migrateTriageStore } from "./migration/triage";
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
      migrate: migrateTriageStore,
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
