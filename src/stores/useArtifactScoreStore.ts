import type { GlobalStatWeights } from "@/data/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAccountStore } from "./useAccountStore";

const DEFAULT_GLOBAL: GlobalStatWeights = {
  flatAtk: 30,
  flatHp: 30,
  flatDef: 30,
};

export type ArtifactScoreGlobalConfig = { global: GlobalStatWeights };

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
        useAccountStore.getState().invalidateScores();
      },
      resetConfig: () => {
        set(() => ({ config: { global: DEFAULT_GLOBAL } }));
        useAccountStore.getState().invalidateScores();
      },
      resetGlobalConfig: () => {
        set((state) => ({
          config: {
            ...state.config,
            global: DEFAULT_GLOBAL,
          },
        }));
        useAccountStore.getState().invalidateScores();
      },
    }),
    {
      name: "artifact-score-storage",
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => ({
        config: migratePersisted(persisted),
      }),
    }
  )
);
