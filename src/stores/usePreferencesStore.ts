import type { SortDirection } from "@/data/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CharacterSortPreferences {
  tierSort: SortDirection;
  releaseSort: SortDirection;
}

interface PreferencesState {
  characterSort: CharacterSortPreferences;

  // Actions
  setCharacterSort: (sort: Partial<CharacterSortPreferences>) => void;
}

const defaultCharacterSort: CharacterSortPreferences = {
  tierSort: "desc",
  releaseSort: "desc",
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
    }
  )
);
