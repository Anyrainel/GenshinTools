import type { AnalyzerResult } from "@/lib/team-comp/analyzer";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Map serialization helpers ───

type SerializedResult = Omit<AnalyzerResult, "bestAtTier" | "nodesByJin"> & {
  bestAtTier: [
    number,
    AnalyzerResult["bestAtTier"] extends Map<number, infer V> ? V : never,
  ][];
  nodesByJin: [
    number,
    AnalyzerResult["nodesByJin"] extends Map<number, infer V> ? V : never,
  ][];
};

function serialize(r: AnalyzerResult): SerializedResult {
  return {
    ...r,
    bestAtTier: [...r.bestAtTier.entries()],
    nodesByJin: [...r.nodesByJin.entries()],
  };
}

function deserialize(s: SerializedResult): AnalyzerResult {
  return {
    ...s,
    bestAtTier: new Map(s.bestAtTier),
    nodesByJin: new Map(s.nodesByJin),
  };
}

// ─── Store ───

interface AnalyzerCacheState {
  /** Map of cache key → result (in-memory only, not persisted) */
  cache: Record<string, AnalyzerResult>;
  /** Map of team ID → last result (persisted to localStorage) */
  lastByTeam: Record<string, SerializedResult>;

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

export const useAnalyzerCacheStore = create<AnalyzerCacheState>()(
  persist(
    (set, get) => ({
      cache: {},
      lastByTeam: {},

      get: (key) => get().cache[key],

      set: (key, result) =>
        set((state) => ({
          cache: { ...state.cache, [key]: result },
        })),

      getForTeam: (teamId) => {
        const s = get().lastByTeam[teamId];
        return s ? deserialize(s) : undefined;
      },

      setForTeam: (teamId, result) =>
        set((state) => ({
          lastByTeam: { ...state.lastByTeam, [teamId]: serialize(result) },
        })),

      clearAll: () => set({ cache: {}, lastByTeam: {} }),
    }),
    {
      name: "analyzer-cache",
      // Only persist lastByTeam, not the in-memory cache
      partialize: (state) => ({ lastByTeam: state.lastByTeam }),
    }
  )
);
