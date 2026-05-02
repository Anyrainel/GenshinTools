import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GlobalStatWeights } from "@/data/types";
import {
  type ArtifactScoreGlobalConfig,
  migrateArtifactScorePersisted,
} from "./migration/artifactScore";
import { DEFAULT_GLOBAL_STAT_WEIGHTS } from "./schemas";
import { invalidateScores } from "./useAccountScoreCacheStore";

interface ArtifactScoreState {
  config: ArtifactScoreGlobalConfig;
  setGlobalWeight: (key: keyof GlobalStatWeights, value: number) => void;
  replaceConfig: (config: ArtifactScoreGlobalConfig) => void;
  resetConfig: () => void;
  resetGlobalConfig: () => void;
}

export const useArtifactScoreStore = create<ArtifactScoreState>()(
  persist(
    (set) => ({
      config: { global: DEFAULT_GLOBAL_STAT_WEIGHTS },
      setGlobalWeight: (key, value) => {
        set((state) => ({
          config: {
            ...state.config,
            global: {
              ...state.config.global,
              [key]: value,
            },
          },
        }));
        invalidateScores();
      },
      replaceConfig: (config) => {
        set(() => ({ config }));
        invalidateScores();
      },
      resetConfig: () => {
        set(() => ({ config: { global: DEFAULT_GLOBAL_STAT_WEIGHTS } }));
        invalidateScores();
      },
      resetGlobalConfig: () => {
        set((state) => ({
          config: {
            ...state.config,
            global: DEFAULT_GLOBAL_STAT_WEIGHTS,
          },
        }));
        invalidateScores();
      },
    }),
    {
      name: "artifact-score-storage",
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => ({
        config: migrateArtifactScorePersisted(persisted),
      }),
      partialize: (state) => ({
        config: state.config,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as object),
        config: migrateArtifactScorePersisted(persistedState),
      }),
    }
  )
);
