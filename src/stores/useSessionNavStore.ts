import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnalysisMode } from "@/lib/team-comp/analysisTypes";
import { migrateSessionNavStorageValue } from "./migration/sessionNav";
import {
  DEFAULT_VIEW_SETTINGS,
  PersistedSessionNavStoreSchema,
} from "./schemas";

export type ViewId = "analysis";
export type TeamSort = "default" | "tier" | "release";

interface ViewSettings {
  activeTeamId: string | null;
  ownedOnly: boolean | null; // null = use default (hasAccountData)
  teamSort: TeamSort;
  erCalcExpanded: boolean;
}

interface SessionNavState {
  viewSettings: Record<ViewId, ViewSettings>;
  analysisModes: Record<string, AnalysisMode>;
  setAnalysisMode: (teamId: string, mode: AnalysisMode) => void;
  setActiveTeamId: (viewId: ViewId, id: string | null) => void;
  setViewOwnedOnly: (viewId: ViewId, value: boolean) => void;
  setViewTeamSort: (viewId: ViewId, value: TeamSort) => void;
  setErCalcExpanded: (viewId: ViewId, value: boolean) => void;
}

export const useSessionNavStore = create<SessionNavState>()(
  persist(
    (set) => ({
      viewSettings: {
        analysis: { ...DEFAULT_VIEW_SETTINGS },
      },
      analysisModes: {},
      setAnalysisMode: (teamId, mode) =>
        set((s) => ({ analysisModes: { ...s.analysisModes, [teamId]: mode } })),
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
      version: 1,
      partialize: (state) => ({
        viewSettings: state.viewSettings,
        analysisModes: state.analysisModes,
      }),
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          if (!str) return null;
          return migrateSessionNavStorageValue(JSON.parse(str)) as {
            state: Record<string, unknown>;
            version?: number;
          };
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
