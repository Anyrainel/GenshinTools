import type { AnalyzerResult } from "@/lib/team-comp/analyzer";
import { create } from "zustand";

interface AnalyzerCacheState {
  /** Map of cache key → result */
  cache: Record<string, AnalyzerResult>;
  /** Map of team ID → last result (survives dialog close/reopen) */
  lastByTeam: Record<string, AnalyzerResult>;

  /** Get cached result by key */
  get: (key: string) => AnalyzerResult | undefined;

  /** Store result with key */
  set: (key: string, result: AnalyzerResult) => void;

  /** Get last result for a team */
  getForTeam: (teamId: string) => AnalyzerResult | undefined;

  /** Store last result for a team */
  setForTeam: (teamId: string, result: AnalyzerResult) => void;

  /** Clear all cached results */
  clearAll: () => void;
}

export const useAnalyzerCacheStore = create<AnalyzerCacheState>((set, get) => ({
  cache: {},
  lastByTeam: {},

  get: (key) => get().cache[key],

  set: (key, result) =>
    set((state) => ({
      cache: { ...state.cache, [key]: result },
    })),

  getForTeam: (teamId) => get().lastByTeam[teamId],

  setForTeam: (teamId, result) =>
    set((state) => ({
      lastByTeam: { ...state.lastByTeam, [teamId]: result },
    })),

  clearAll: () => set({ cache: {}, lastByTeam: {} }),
}));
