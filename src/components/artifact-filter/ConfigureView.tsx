import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { characters } from "@/data/resources";
import type { Character, CharacterFilters } from "@/data/types";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
  hasActiveFilters,
} from "@/lib/characterFilters";
import { useTierStore } from "@/stores/useTierStore";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Filter } from "lucide-react";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { CharacterBuildCard } from "./CharacterBuildCard";

export interface ConfigureViewRef {
  scrollToCharacter: (characterId: string) => void;
}

export const ConfigureView = forwardRef<ConfigureViewRef>((props, ref) => {
  const { t } = useLanguage();
  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const hasTierData = Object.keys(tierAssignments).length > 0;
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<CharacterFilters>(
    defaultCharacterFilters
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Use custom hook for scroll forwarding from margin areas to main content
  useGlobalScroll(containerRef, mainScrollRef);

  // Use shared filter and sort utility (no tier sort in artifact filter - no tier context)
  const filteredAndSortedCharacters = useMemo(
    () => filterAndSortCharacters(characters, filters),
    [filters]
  );

  const activeFilters = hasActiveFilters(filters);

  return (
    <>
      <div
        ref={containerRef}
        className="flex flex-col gap-4 lg:flex-row lg:gap-6 h-full pt-4"
      >
        {/* Desktop Sidebar - Fixed height with internal scroll */}
        <aside className="hidden lg:block lg:flex-shrink-0 h-full">
          <CharacterFilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            hasTierData={hasTierData}
          />
        </aside>

        {/* Main Column - Scrollable */}
        <section className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          {/* Mobile Filter Trigger */}
          <div className="lg:hidden flex items-center justify-between mb-4">
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

          {/* Scrollable Content */}
          {filteredAndSortedCharacters.length === 0 ? (
            <div
              ref={mainScrollRef}
              className="flex-1 overflow-y-auto overflow-hidden"
              style={{ scrollBehavior: "auto" }}
            >
              <div className="text-center py-12">
                <div className="text-6xl mb-4">??</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t.ui("configure.noCharactersFound")}
                </h3>
                <p className="text-muted-foreground">
                  {t.ui("configure.noCharactersDescription")}
                </p>
              </div>
            </div>
          ) : (
            <VirtualizedCharacterList
              characters={filteredAndSortedCharacters}
              scrollRef={mainScrollRef}
              ref={ref}
            />
          )}
        </section>
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
    </>
  );
});

interface CharacterListProps {
  characters: Character[];
  scrollRef: React.RefObject<HTMLDivElement>;
}

const VirtualizedCharacterList = forwardRef<
  ConfigureViewRef,
  CharacterListProps
>(({ characters, scrollRef }, ref) => {
  const virtualizer = useVirtualizer({
    count: characters.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 520,
    overscan: 6,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollToCharacter: (characterId: string) => {
        const index = characters.findIndex((c) => c.id === characterId);
        if (index !== -1) {
          virtualizer.scrollToIndex(index, { align: "start" });
        }
      },
    }),
    [characters, virtualizer]
  );

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-hidden"
      style={{ scrollBehavior: "auto" }}
    >
      <div
        className="relative"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <div className="mb-6">
              <CharacterBuildCard character={characters[virtualItem.index]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
