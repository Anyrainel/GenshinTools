import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SortDirection } from "@/data/enums";
import {
  DEFAULT_CHARACTER_SORT,
  PersistedPreferencesStoreSchema,
} from "./schemas";

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

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      characterSort: DEFAULT_CHARACTER_SORT,

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
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedPreferencesStoreSchema.safeParse(persistedState);
        const persisted = parsed.success
          ? parsed.data
          : PersistedPreferencesStoreSchema.parse({});
        return {
          ...currentState,
          ...persisted,
          characterSort: {
            ...DEFAULT_CHARACTER_SORT,
            ...persisted.characterSort,
          },
        };
      },
    }
  )
);
