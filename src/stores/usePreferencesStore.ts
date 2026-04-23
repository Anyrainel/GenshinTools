import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SortDirection } from "@/data/enums";

interface CharacterSortPreferences {
  tierSort: SortDirection;
  releaseSort: SortDirection;
  scoreSort: SortDirection;
}

interface PreferencesState {
  characterSort: CharacterSortPreferences;

  // Actions
  setCharacterSort: (sort: Partial<CharacterSortPreferences>) => void;
}

const defaultCharacterSort: CharacterSortPreferences = {
  tierSort: "desc",
  releaseSort: "desc",
  scoreSort: "off",
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      characterSort: defaultCharacterSort,

      setCharacterSort: (sort) =>
        set((state) => ({
          characterSort: { ...state.characterSort, ...sort },
        })),
    }),
    {
      name: "preferences-storage",
      partialize: (state) => ({
        characterSort: state.characterSort,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as object),
        characterSort: {
          ...defaultCharacterSort,
          ...((persistedState as Partial<PreferencesState>)?.characterSort ??
            {}),
        },
      }),
    }
  )
);
