import { CharacterCard } from "@/components/account-data/CharacterCard";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { CharacterFilters } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import { useAccountStore } from "@/stores/useAccountStore";
import { Filter } from "lucide-react";
import { useMemo, useState } from "react";

interface CharacterViewProps {
  scores: Record<string, ArtifactScoreResult>;
}

export const CharacterView = ({ scores }: CharacterViewProps) => {
  const { t } = useLanguage();
  const { accountData } = useAccountStore();
  const [filters, setFilters] = useState<CharacterFilters>({
    elements: [],
    weaponTypes: [],
    regions: [],
    rarities: [],
    sortOrder: "desc",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter Logic
  const filteredCharacters = useMemo(() => {
    if (!accountData) return [];
    let chars = [...accountData.characters];

    // Filter by Element
    if (filters.elements.length > 0) {
      chars = chars.filter((c) => {
        const info = charactersById[c.key];
        return info && filters.elements.includes(info.element);
      });
    }

    // Filter by Weapon Type
    if (filters.weaponTypes.length > 0) {
      chars = chars.filter((c) => {
        const info = charactersById[c.key];
        return info && filters.weaponTypes.includes(info.weaponType);
      });
    }

    // Filter by Region
    if (filters.regions.length > 0) {
      chars = chars.filter((c) => {
        const info = charactersById[c.key];
        return info && filters.regions.includes(info.region);
      });
    }

    // Filter by Rarity
    if (filters.rarities.length > 0) {
      chars = chars.filter((c) => {
        const info = charactersById[c.key];
        return info && filters.rarities.includes(info.rarity);
      });
    }

    // Sort
    chars.sort((a, b) => {
      const infoA = charactersById[a.key];
      const infoB = charactersById[b.key];
      if (!infoA || !infoB) return 0;

      const dateA = new Date(infoA.releaseDate).getTime();
      const dateB = new Date(infoB.releaseDate).getTime();

      return filters.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return chars;
  }, [accountData, filters]);

  const hasActiveFilters =
    filters.elements.length > 0 ||
    filters.weaponTypes.length > 0 ||
    filters.regions.length > 0 ||
    filters.rarities.length > 0;

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
          {hasActiveFilters && (
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
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
