import { create } from "zustand";
import type { AnalyzerResult } from "@/lib/team-comp/analyzer/types";

interface AnalyzerCacheState {
  /** Map of cache key → result (in-memory only, not persisted) */
  cache: Record<string, AnalyzerResult>;

  /** Get cached result by key */
  get: (key: string) => AnalyzerResult | undefined;

  /** Store result with key */
  set: (key: string, result: AnalyzerResult) => void;

  /** Clear all cached results */
  clearAll: () => void;
}

export const useAnalyzerCacheStore = create<AnalyzerCacheState>()(
  (set, get) => ({
    cache: {},

    get: (key) => get().cache[key],

    set: (key, result) =>
      set((state) => ({
        cache: { ...state.cache, [key]: result },
      })),

    clearAll: () => set({ cache: {} }),
  })
);
