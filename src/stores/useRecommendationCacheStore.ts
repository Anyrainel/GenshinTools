import { create } from "zustand";
import type { Tier } from "@/data/enums";
import type { AllActions } from "@/lib/account-data/scoreUpEngine";

interface RecommendationProgress {
  completedTierCount: number;
  totalTierCount: number;
  currentTier: Tier | null;
}

interface RecommendationCacheEntry {
  recommendations: AllActions;
  progress: RecommendationProgress;
  updatedAt: number;
}

interface RecommendationCacheState {
  cache: Map<string, RecommendationCacheEntry>;
  version: number;
  get: (key: string) => RecommendationCacheEntry | undefined;
  set: (
    key: string,
    entry: Omit<RecommendationCacheEntry, "updatedAt">
  ) => void;
  clearKey: (key: string) => void;
  clear: () => void;
}

export const useRecommendationCacheStore = create<RecommendationCacheState>(
  (set, get) => ({
    cache: new Map(),
    version: 0,
    get: (key) => get().cache.get(key),
    set: (key, entry) =>
      set((state) => {
        state.cache.set(key, { ...entry, updatedAt: Date.now() });
        return { version: state.version + 1 };
      }),
    clearKey: (key) =>
      set((state) => {
        state.cache.delete(key);
        return { version: state.version + 1 };
      }),
    clear: () =>
      set((state) => {
        state.cache.clear();
        return { version: state.version + 1 };
      }),
  })
);
