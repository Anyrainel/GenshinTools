import { STAT_WEIGHTS } from "@/data/statWeights";
import type { ArtifactScoreConfig } from "@/data/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAccountStore } from "./useAccountStore";

function generateDefaultArtifactScoreConfig(): ArtifactScoreConfig {
  return {
    global: {
      flatAtk: 30,
      flatHp: 30,
      flatDef: 30,
    },
    characters: STAT_WEIGHTS,
  };
}

interface ArtifactScoreState {
  config: ArtifactScoreConfig;
  setGlobalWeight: (
    key: keyof ArtifactScoreConfig["global"],
    value: number
  ) => void;
  setCharacterWeight: (charId: string, stat: string, value: number) => void;
  resetConfig: () => void;
  resetGlobalConfig: () => void;
  resetCharacterWeights: () => void;
}

export const useArtifactScoreStore = create<ArtifactScoreState>()(
  persist(
    (set) => ({
      config: generateDefaultArtifactScoreConfig(),
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
      setCharacterWeight: (charId, stat, value) => {
        set((state) => ({
          config: {
            ...state.config,
            characters: {
              ...state.config.characters,
              [charId]: {
                ...state.config.characters[charId],
                [stat]: value,
              },
            },
          },
        }));
        useAccountStore.getState().invalidateScores();
      },
      resetConfig: () => {
        set(() => ({
          config: generateDefaultArtifactScoreConfig(),
        }));
        useAccountStore.getState().invalidateScores();
      },
      resetGlobalConfig: () => {
        set((state) => ({
          config: {
            ...state.config,
            global: generateDefaultArtifactScoreConfig().global,
          },
        }));
        useAccountStore.getState().invalidateScores();
      },
      resetCharacterWeights: () => {
        set((state) => ({
          config: {
            ...state.config,
            characters: generateDefaultArtifactScoreConfig().characters,
          },
        }));
        useAccountStore.getState().invalidateScores();
      },
    }),
    {
      name: "artifact-score-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
