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
import { useTierStore } from "@/stores/useTierStore";
import { useMemo, useState } from "react";

interface CharacterViewProps {
  scores: Record<string, ArtifactScoreResult>;
}

export function CharacterView({ scores }: CharacterViewProps) {
  const { t } = useLanguage();
  const { accountData } = useAccountStore();
  const tierAssignments = useTierStore((state) => state.tierAssignments);

  // 640px is a safe breakpoint where 35rem (560px) fits comfortably with margins
  const isSmallScreen = useMediaQuery("(max-width: 640px)");

  const [filters, setFilters] = useState<CharacterFilters>(
    defaultCharacterFilters
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

  const hasTierData = Object.keys(tierAssignments).length > 0;

  if (!accountData) return null;

  return (
    <SidebarLayout
      sidebar={
        <CharacterFilterSidebar
          filters={filters}
          onFiltersChange={setFilters}
          hasTierData={hasTierData}
        />
      }
      triggerLabel={triggerLabel}
      className="pt-4"
    >
      <div className="h-full overflow-y-auto">
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
      </div>
    </SidebarLayout>
  );
}
