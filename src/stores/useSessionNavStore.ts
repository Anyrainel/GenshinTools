import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewId = "damage" | "investment" | "weaponChoice";
export type TeamSort = "default" | "tier" | "release";

interface ViewSettings {
  activeTeamId: string | null;
  ownedOnly: boolean | null; // null = use default (hasAccountData)
  teamSort: TeamSort;
}

interface SessionNavState {
  viewSettings: Record<ViewId, ViewSettings>;
  setActiveTeamId: (viewId: ViewId, id: string | null) => void;
  setViewOwnedOnly: (viewId: ViewId, value: boolean) => void;
  setViewTeamSort: (viewId: ViewId, value: TeamSort) => void;
}

const defaultViewSettings: ViewSettings = {
  activeTeamId: null,
  ownedOnly: null,
  teamSort: "default",
};

export const useSessionNavStore = create<SessionNavState>()(
  persist(
    (set) => ({
      viewSettings: {
        damage: { ...defaultViewSettings },
        investment: { ...defaultViewSettings },
        weaponChoice: { ...defaultViewSettings },
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
    }),
    {
      name: "session-nav-storage",
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
                  ...defaultViewSettings,
                  activeTeamId: s.activeTeamId ?? null,
                },
                investment: {
                  ...defaultViewSettings,
                  activeTeamId: s.activeInvestmentTeamId ?? null,
                },
                weaponChoice: {
                  ...defaultViewSettings,
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
                ...defaultViewSettings,
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
    }
  )
);
