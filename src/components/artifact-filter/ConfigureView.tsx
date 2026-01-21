import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import { characters } from "@/data/resources";
import type { CharacterFilters } from "@/data/types";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
  hasActiveFilters,
} from "@/lib/characterFilters";
import { useTierStore } from "@/stores/useTierStore";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CharacterBuildCard } from "./CharacterBuildCard";

interface ConfigureViewProps {
  /** When set, filters will be configured to show this character */
  targetCharacterId?: string;
  /** Called when targetCharacterId has been processed, so parent can clear it */
  onTargetProcessed?: () => void;
}

export function ConfigureView({
  targetCharacterId,
  onTargetProcessed,
}: ConfigureViewProps) {
  const { t } = useLanguage();
  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const hasTierData = Object.keys(tierAssignments).length > 0;
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<CharacterFilters>(
    defaultCharacterFilters
  );

  // When targetCharacterId is set, configure filters to show that character
  useEffect(() => {
    if (!targetCharacterId) return;

    const character = charactersById[targetCharacterId];
    if (!character) {
      onTargetProcessed?.();
      return;
    }

    // Set filters to match this character's properties
    setFilters({
      ...defaultCharacterFilters,
      elements: [character.element],
      weaponTypes: [character.weaponType],
      rarities: [character.rarity],
      regions: [character.region],
    });

    onTargetProcessed?.();
  }, [targetCharacterId, onTargetProcessed]);

  // Use custom hook for scroll forwarding from margin areas to main content
  useGlobalScroll(containerRef, mainScrollRef);

  // Compute filtered characters
  const filteredAndSortedCharacters = useMemo(
    () => filterAndSortCharacters(characters, filters, tierAssignments),
    [filters, tierAssignments]
  );

  // Defer the list to allow UI to stay responsive
  const deferredCharacters = useDeferredValue(filteredAndSortedCharacters);

  const activeFilters = hasActiveFilters(filters);

  // Build trigger label with filter count
  const triggerLabel = activeFilters
    ? `${t.ui("filters.title")} (${
        [
          filters.elements,
          filters.weaponTypes,
          filters.regions,
          filters.rarities,
        ].flat().length
      })`
    : t.ui("filters.title");

  return (
    <div ref={containerRef} className="h-full">
      <SidebarLayout
        sidebar={
          <CharacterFilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            hasTierData={hasTierData}
          />
        }
        triggerLabel={triggerLabel}
        contentScrollRef={mainScrollRef}
        contentScrollsInternally
        className="pt-4"
      >
        {deferredCharacters.length === 0 ? (
          <div
            ref={mainScrollRef}
            className="flex-1 overflow-y-auto overflow-hidden"
            style={{ scrollBehavior: "auto" }}
          >
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
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
            characters={deferredCharacters}
            scrollRef={mainScrollRef}
          />
        )}
      </SidebarLayout>
    </div>
  );
}

interface CharacterListProps {
  characters: typeof characters;
  scrollRef: React.RefObject<HTMLDivElement>;
}

function VirtualizedCharacterList({
  characters,
  scrollRef,
}: CharacterListProps) {
  const virtualizer = useVirtualizer({
    count: characters.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 520,
    overscan: 6,
  });

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
            <div className="mb-4">
              <CharacterBuildCard character={characters[virtualItem.index]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
