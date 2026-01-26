import { CharacterCard } from "@/components/account-data/CharacterCard";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CharacterFilters } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import {
  defaultCharacterFilters,
  filterAndSortCharacterData,
  hasActiveFilters,
} from "@/lib/characterFilters";
import { useAccountStore } from "@/stores/useAccountStore";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useTierStore } from "@/stores/useTierStore";
import { useCallback, useMemo, useState } from "react";

interface CharacterViewProps {
  scores: Record<string, ArtifactScoreResult>;
}

export function CharacterView({ scores }: CharacterViewProps) {
  const { t } = useLanguage();
  const { accountData } = useAccountStore();
  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const hasTierData = Object.keys(tierAssignments).length > 0;

  // 640px is a safe breakpoint where 35rem (560px) fits comfortably with margins
  const isSmallScreen = useMediaQuery("(max-width: 640px)");

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
  });

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

  // Filter and sort account characters using shared utility
  const filteredCharacters = useMemo(() => {
    if (!accountData) return [];
    return filterAndSortCharacterData(
      accountData.characters,
      filters,
      tierAssignments
    );
  }, [accountData, filters, tierAssignments]);

  const activeFilters = hasActiveFilters(filters);

  // Tier data exists if there are any tier assignments
  const activeFilterCount = activeFilters
    ? [
        filters.elements,
        filters.weaponTypes,
        filters.regions,
        filters.rarities,
      ].flat().length
    : 0;

  const triggerLabel =
    activeFilterCount > 0
      ? `${t.ui("filters.title")} (${activeFilterCount})`
      : t.ui("filters.title");

  if (!accountData) return null;

  return (
    <SidebarLayout
      sidebar={
        <CharacterFilterSidebar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          hasTierData={hasTierData}
        />
      }
      triggerLabel={triggerLabel}
      className="pt-4"
    >
      <div className="h-full overflow-y-auto">
        {filteredCharacters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t.ui("accountData.noCharactersMatchFilters")}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              {t.ui("accountData.noCharactersMatchFiltersDescription")}
            </p>
            {activeFilters && (
              <button
                type="button"
                onClick={() =>
                  setCheckboxFilters({
                    elements: [],
                    weaponTypes: [],
                    regions: [],
                    rarities: [],
                  })
                }
                className="text-primary hover:underline underline-offset-4 font-medium"
              >
                {t.ui("filters.clearAll")}
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid gap-4 pb-4"
            style={{
              gridTemplateColumns: isSmallScreen
                ? "1fr"
                : "repeat(auto-fit, minmax(35rem, 1fr))",
            }}
          >
            {filteredCharacters.map((char) => (
              <div key={char.key}>
                <CharacterCard char={char} score={scores[char.key]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
