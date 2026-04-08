/**
 * In-memory cache for async-computed `pUpgrade` values on resource
 * suggestions. The exact P(upgrade > baseline) is expensive to compute (PMF
 * convolution over all shapes and upgrade-roll tuples), so the panel
 * schedules the work asynchronously in small chunks and stores the result
 * here keyed by `suggestionCacheKey`. The store is not persisted — the
 * cache is rebuilt on page reload, which is cheap enough to amortize.
 */

import { create } from "zustand";

interface PUpgradeCacheState {
  cache: Map<string, number>;
  /** Bumped whenever the cache mutates — components subscribe to this to
   * trigger re-renders without holding Map references in component state. */
  version: number;
  get: (key: string) => number | undefined;
  set: (key: string, value: number) => void;
  clear: () => void;
}

export const usePUpgradeCacheStore = create<PUpgradeCacheState>((set, get) => ({
  cache: new Map(),
  version: 0,
  get: (key) => get().cache.get(key),
  set: (key, value) =>
    set((state) => {
      state.cache.set(key, value);
      return { version: state.version + 1 };
    }),
  clear: () =>
    set((state) => {
      state.cache.clear();
      return { version: state.version + 1 };
    }),
}));
