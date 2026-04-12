import type { CharacterFilters } from "@/data/types";
import { defaultCharacterFilters } from "@/lib/characterFilters";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useCallback, useMemo, useState } from "react";

interface UseCharacterFiltersOptions {
  /** Default value for ownedOnly filter. CharacterView uses false, CharacterBuildView uses true. */
  defaultOwnedOnly?: boolean;
  /** Whether tier data is available — gates the tierSort filter. */
  hasTierData?: boolean;
}

export function useCharacterFilters({
  defaultOwnedOnly = false,
  hasTierData = false,
}: UseCharacterFiltersOptions = {}) {
  // Get persisted sort preferences
  const characterSort = usePreferencesStore((state) => state.characterSort);
  const setCharacterSort = usePreferencesStore(
    (state) => state.setCharacterSort
  );

  // Local state for ephemeral filter checkboxes only
  const [checkboxFilters, setCheckboxFilters] = useState({
    elements: defaultCharacterFilters.elements,
    weaponTypes: defaultCharacterFilters.weaponTypes,
    regions: defaultCharacterFilters.regions,
    rarities: defaultCharacterFilters.rarities,
    ownedOnly: defaultOwnedOnly,
    showManekin: defaultCharacterFilters.showManekin,
    searchQuery: defaultCharacterFilters.searchQuery,
  });

  // Combine local checkbox state with persisted sort preferences
  const filters: CharacterFilters = useMemo(
    () => ({
      ...checkboxFilters,
      tierSort: hasTierData ? characterSort.tierSort : "off",
      releaseSort: characterSort.releaseSort,
      scoreSort: characterSort.scoreSort,
    }),
    [checkboxFilters, characterSort, hasTierData]
  );

  // Handler that routes updates to the appropriate store
  const handleFiltersChange = useCallback(
    (newFilters: CharacterFilters) => {
      // Update checkbox filters (local state)
      setCheckboxFilters({
        elements: newFilters.elements,
        weaponTypes: newFilters.weaponTypes,
        regions: newFilters.regions,
        rarities: newFilters.rarities,
        ownedOnly: newFilters.ownedOnly,
        showManekin: newFilters.showManekin,
        searchQuery: newFilters.searchQuery,
      });

      // Update sort preferences (persisted state)
      const newTierSort =
        newFilters.tierSort !== filters.tierSort
          ? newFilters.tierSort
          : undefined;
      const newReleaseSort =
        newFilters.releaseSort !== filters.releaseSort
          ? newFilters.releaseSort
          : undefined;
      const newScoreSort =
        newFilters.scoreSort !== filters.scoreSort
          ? newFilters.scoreSort
          : undefined;

      if (
        newTierSort !== undefined ||
        newReleaseSort !== undefined ||
        newScoreSort !== undefined
      ) {
        setCharacterSort({
          ...(newTierSort !== undefined && { tierSort: newTierSort }),
          ...(newReleaseSort !== undefined && { releaseSort: newReleaseSort }),
          ...(newScoreSort !== undefined && { scoreSort: newScoreSort }),
        });
      }
    },
    [filters.tierSort, filters.releaseSort, filters.scoreSort, setCharacterSort]
  );

  const activeFilterCount = [
    filters.elements,
    filters.weaponTypes,
    filters.regions,
    filters.rarities,
  ].flat().length;

  return {
    filters,
    handleFiltersChange,
    setCheckboxFilters,
    activeFilterCount,
  };
}
