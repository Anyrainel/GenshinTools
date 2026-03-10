import { CharacterCard } from "@/components/account-data/CharacterCard";
import { CharacterEditDialog } from "@/components/account-data/CharacterEditDialog";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  AccountData,
  CharacterData,
  CharacterFilters,
} from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useIsOwned } from "@/hooks/useOwnership";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import {
  defaultCharacterFilters,
  filterAndSortCharacterData,
  hasActiveFilters,
} from "@/lib/characterFilters";
import { cn } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useTierStore } from "@/stores/useTierStore";
import { Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface CharacterViewProps {
  scores: Record<string, ArtifactScoreResult>;
  isEditMode?: boolean;
}

export function CharacterView({
  scores,
  isEditMode = false,
}: CharacterViewProps) {
  const { t } = useLanguage();
  const { characterStats } = useGameStats();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const addOrUpdateAccount = useAccountStore((s) => s.addOrUpdateAccount);
  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const hasTierData = Object.keys(tierAssignments).length > 0;

  // 640px is a safe breakpoint where 35rem (560px) fits comfortably with margins
  const isSmallScreen = useMediaQuery("(max-width: 640px)");

  // Edit mode
  const [editingChar, setEditingChar] = useState<CharacterData | null>(null);

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
    ownedOnly: false,
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

  // Filter and sort account characters using shared utility
  const filteredCharacters = useMemo(() => {
    if (!accountData) return [];
    return filterAndSortCharacterData(accountData.characters, filters, {
      tierAssignments,
      isOwned: isCharacterOwned,
      characterStatsMap: characterStats ?? undefined,
    });
  }, [accountData, filters, tierAssignments, isCharacterOwned, characterStats]);

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

  const handleSaveEdit = useCallback(
    (newData: AccountData) => {
      if (!activeAccountId) return;
      addOrUpdateAccount(activeAccountId, { data: newData });
    },
    [activeAccountId, addOrUpdateAccount]
  );

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
                    ownedOnly: false,
                    showManekin: false,
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
            className="grid gap-3 pb-4"
            style={{
              gridTemplateColumns: isSmallScreen
                ? "1fr"
                : "repeat(auto-fit, minmax(32rem, 1fr))",
            }}
          >
            {filteredCharacters.map((char) => (
              <div key={char.key}>
                <CharacterCard
                  char={char}
                  score={scores[char.key]}
                  onEdit={isEditMode ? () => setEditingChar(char) : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      {editingChar && accountData && (
        <CharacterEditDialog
          open={!!editingChar}
          onOpenChange={(open) => {
            if (!open) setEditingChar(null);
          }}
          char={editingChar}
          accountData={accountData}
          onSave={handleSaveEdit}
        />
      )}
    </SidebarLayout>
  );
}
