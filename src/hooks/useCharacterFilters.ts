import type { CharacterFilters } from "@/data/types";
import { useIsOwned } from "@/hooks/useOwnership";
import { defaultCharacterFilters } from "@/lib/characterFilters";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useTierStore } from "@/stores/useTierStore";
import { useCallback, useMemo, useState } from "react";

interface UseCharacterFiltersOptions {
  /** Default value for ownedOnly filter. CharacterView uses false, CharacterBuildView uses true. */
  defaultOwnedOnly?: boolean;
}

export function useCharacterFilters({
  defaultOwnedOnly = false,
}: UseCharacterFiltersOptions = {}) {
  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const hasTierData = Object.keys(tierAssignments).length > 0;

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
  });

  // Ownership check callback
  const isOwned = useIsOwned();
  const isCharacterOwned = useCallback(
    (id: string) => isOwned("character", id),
    [isOwned]
  );

  // Combine local checkbox state with persisted sort preferences
  const filters: CharacterFilters = useMemo(
    () => ({
      ...checkboxFilters,
      tierSort: hasTierData ? characterSort.tierSort : "off",
      releaseSort: characterSort.releaseSort,
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

      if (newTierSort !== undefined || newReleaseSort !== undefined) {
        setCharacterSort({
          ...(newTierSort !== undefined && { tierSort: newTierSort }),
          ...(newReleaseSort !== undefined && { releaseSort: newReleaseSort }),
        });
      }
    },
    [filters.tierSort, filters.releaseSort, setCharacterSort]
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
    tierAssignments,
    hasTierData,
    isCharacterOwned,
  };
}
