import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_VIEW_SETTINGS,
  PersistedSessionNavStoreSchema,
} from "./schemas";

export type ViewId = "damage" | "investment" | "weaponChoice";
export type TeamSort = "default" | "tier" | "release";

interface ViewSettings {
  activeTeamId: string | null;
  ownedOnly: boolean | null; // null = use default (hasAccountData)
  teamSort: TeamSort;
  erCalcExpanded: boolean;
}

interface SessionNavState {
  viewSettings: Record<ViewId, ViewSettings>;
  setActiveTeamId: (viewId: ViewId, id: string | null) => void;
  setViewOwnedOnly: (viewId: ViewId, value: boolean) => void;
  setViewTeamSort: (viewId: ViewId, value: TeamSort) => void;
  setErCalcExpanded: (viewId: ViewId, value: boolean) => void;
}

export const useSessionNavStore = create<SessionNavState>()(
  persist(
    (set) => ({
      viewSettings: {
        damage: { ...DEFAULT_VIEW_SETTINGS },
        investment: { ...DEFAULT_VIEW_SETTINGS },
        weaponChoice: { ...DEFAULT_VIEW_SETTINGS },
      },
      setActiveTeamId: (viewId, id) =>
        set((s) => ({
          viewSettings: {
            ...s.viewSettings,
            [viewId]: { ...s.viewSettings[viewId], activeTeamId: id },
          },
        })),
      setViewOwnedOnly: (viewId, value) =>
        set((s) => ({
          viewSettings: {
            ...s.viewSettings,
            [viewId]: { ...s.viewSettings[viewId], ownedOnly: value },
          },
        })),
      setViewTeamSort: (viewId, value) =>
        set((s) => ({
          viewSettings: {
            ...s.viewSettings,
            [viewId]: { ...s.viewSettings[viewId], teamSort: value },
          },
        })),
      setErCalcExpanded: (viewId, value) =>
        set((s) => ({
          viewSettings: {
            ...s.viewSettings,
            [viewId]: { ...s.viewSettings[viewId], erCalcExpanded: value },
          },
        })),
    }),
    {
      name: "session-nav-storage",
      partialize: (state) => ({
        viewSettings: state.viewSettings,
      }),
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Migrate from old flat fields to unified viewSettings
          if (parsed?.state) {
            const s = parsed.state;
            if (!s.viewSettings) {
              s.viewSettings = {
                damage: {
                  ...DEFAULT_VIEW_SETTINGS,
                  activeTeamId: s.activeTeamId ?? null,
                },
                investment: {
                  ...DEFAULT_VIEW_SETTINGS,
                  activeTeamId: s.activeInvestmentTeamId ?? null,
                },
                weaponChoice: {
                  ...DEFAULT_VIEW_SETTINGS,
                  activeTeamId: s.activeWeaponChoiceTeamId ?? null,
                },
              };
              // Clean up old fields
              s.activeTeamId = undefined;
              s.activeInvestmentTeamId = undefined;
              s.activeWeaponChoiceTeamId = undefined;
            }
            // Ensure all views have all fields (in case new fields were added)
            for (const viewId of ["damage", "investment", "weaponChoice"]) {
              s.viewSettings[viewId] = {
                ...DEFAULT_VIEW_SETTINGS,
                ...s.viewSettings[viewId],
              };
            }
          }
          return parsed;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
      merge: (persistedState, currentState) => {
        const parsed = PersistedSessionNavStoreSchema.safeParse(persistedState);
        const persisted = parsed.success
          ? parsed.data
          : PersistedSessionNavStoreSchema.parse({});
        return {
          ...currentState,
          ...persisted,
          viewSettings: {
            ...currentState.viewSettings,
            ...persisted.viewSettings,
          },
        };
      },
    }
  )
);
