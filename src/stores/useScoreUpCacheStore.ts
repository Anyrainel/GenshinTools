import { create } from "zustand";
import type { Tier } from "@/data/enums";
import type { AllActions } from "@/lib/account-data/scoreUpEngine";

interface ScoreUpProgress {
  completedTierCount: number;
  totalTierCount: number;
  currentTier: Tier | null;
}

interface ScoreUpCacheEntry {
  recommendations: AllActions;
  progress: ScoreUpProgress;
  updatedAt: number;
}

interface ScoreUpCacheState {
  cache: Map<string, ScoreUpCacheEntry>;
  version: number;
  get: (key: string) => ScoreUpCacheEntry | undefined;
  set: (key: string, entry: Omit<ScoreUpCacheEntry, "updatedAt">) => void;
  clearKey: (key: string) => void;
  clear: () => void;
}

export const useScoreUpCacheStore = create<ScoreUpCacheState>((set, get) => ({
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
}));
