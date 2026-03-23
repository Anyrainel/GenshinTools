import type { InvestmentResult } from "@/lib/team-comp/investmentOptimizer";
import { create } from "zustand";

interface InvestmentCacheState {
  /** Map of cache key → result */
  cache: Record<string, InvestmentResult>;

  /** Get cached result by key */
  get: (key: string) => InvestmentResult | undefined;

  /** Store result with key */
  set: (key: string, result: InvestmentResult) => void;

  /** Clear all cached results */
  clearAll: () => void;
}

export const useInvestmentCacheStore = create<InvestmentCacheState>(
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
