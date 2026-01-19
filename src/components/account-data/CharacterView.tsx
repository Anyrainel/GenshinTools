import { CharacterCard } from "@/components/account-data/CharacterCard";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CharacterFilters } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import {
  defaultCharacterFilters,
  filterAndSortCharacterData,
  hasActiveFilters,
} from "@/lib/characterFilters";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";
import { Filter } from "lucide-react";
import { useMemo, useState } from "react";

interface CharacterViewProps {
  scores: Record<string, ArtifactScoreResult>;
}

export function CharacterView({ scores }: CharacterViewProps) {
  const { t } = useLanguage();
  const { accountData } = useAccountStore();
  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const [filters, setFilters] = useState<CharacterFilters>(
    defaultCharacterFilters
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
  const hasTierData = Object.keys(tierAssignments).length > 0;

  if (!accountData) return null;

  return (
    <div className="flex flex-col md:flex-row h-full gap-4 pt-4">
      {/* Mobile Filter Trigger */}
      <div className="md:hidden flex items-center justify-between mb-2">
        <Button
          variant="outline"
          onClick={() => setIsFilterOpen(true)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          {t.ui("filters.title")}
          {activeFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {
                [
                  filters.elements,
                  filters.weaponTypes,
                  filters.regions,
                  filters.rarities,
                ].flat().length
              }
            </span>
          )}
        </Button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:flex-shrink-0 h-full">
        <CharacterFilterSidebar
          filters={filters}
          onFiltersChange={setFilters}
          hasTierData={hasTierData}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 h-full overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-4">
            {filteredCharacters.map((char) => (
              <div key={char.key}>
                <CharacterCard char={char} score={scores[char.key]} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent side="left" className="w-80 p-0 flex flex-col">
          <div className="flex-1 overflow-y-auto my-4">
            <CharacterFilterSidebar
              filters={filters}
              onFiltersChange={setFilters}
              isInSidePanel={false}
              hasTierData={hasTierData}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
