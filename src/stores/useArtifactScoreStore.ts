import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GlobalStatWeights } from "@/data/types";
import { invalidateScores } from "./useAccountStore";

const DEFAULT_GLOBAL: GlobalStatWeights = {
  flatAtk: 30,
  flatHp: 30,
  flatDef: 30,
};

type ArtifactScoreGlobalConfig = { global: GlobalStatWeights };

function migratePersisted(persisted: unknown): ArtifactScoreGlobalConfig {
  const raw = persisted as { config?: { global?: GlobalStatWeights } };
  const global = raw?.config?.global;
  return {
    global:
      global &&
      typeof global.flatAtk === "number" &&
      typeof global.flatHp === "number" &&
      typeof global.flatDef === "number"
        ? global
        : DEFAULT_GLOBAL,
  };
}

interface ArtifactScoreState {
  config: ArtifactScoreGlobalConfig;
  setGlobalWeight: (key: keyof GlobalStatWeights, value: number) => void;
  resetConfig: () => void;
  resetGlobalConfig: () => void;
}

export const useArtifactScoreStore = create<ArtifactScoreState>()(
  persist(
    (set) => ({
      config: { global: DEFAULT_GLOBAL },
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
      resetConfig: () => {
        set(() => ({ config: { global: DEFAULT_GLOBAL } }));
        invalidateScores();
      },
      resetGlobalConfig: () => {
        set((state) => ({
          config: {
            ...state.config,
            global: DEFAULT_GLOBAL,
          },
        }));
        invalidateScores();
      },
    }),
    {
      name: "artifact-score-storage",
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => ({
        config: migratePersisted(persisted),
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as object),
        config: migratePersisted(persistedState),
      }),
    }
  )
);
