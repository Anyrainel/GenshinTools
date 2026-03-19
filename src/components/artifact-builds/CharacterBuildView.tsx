import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import { characters } from "@/data/resources";
import type { CharacterFilters } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useIsOwned } from "@/hooks/useOwnership";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
} from "@/lib/characterFilters";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useTierStore } from "@/stores/useTierStore";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type BuildCardLayout, CharacterBuildCard } from "./CharacterBuildCard";

interface CharacterBuildViewProps {
  /** When set, filters will be configured to show this character */
  targetCharacterId?: string;
  /** Called when targetCharacterId has been processed, so parent can clear it */
  onTargetProcessed?: () => void;
}

export function CharacterBuildView({
  targetCharacterId,
  onTargetProcessed,
}: CharacterBuildViewProps) {
  const { t } = useLanguage();
  const { characterStats } = useGameStats();
  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const hasTierData = Object.keys(tierAssignments).length > 0;
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    ownedOnly: true,
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

  // When targetCharacterId is set, configure filters to show that character
  useEffect(() => {
    if (!targetCharacterId) return;

    const character = charactersById[targetCharacterId];
    if (!character) {
      onTargetProcessed?.();
      return;
    }
    const meta = getCharacterDisplayMeta(
      character,
      characterStats?.[targetCharacterId]
    );

    setCheckboxFilters({
      elements: meta.element != null ? [meta.element] : [],
      weaponTypes: meta.weaponType != null ? [meta.weaponType] : [],
      rarities: [meta.rarity],
      regions: meta.region != null ? [meta.region] : [],
      ownedOnly: false,
      showManekin: targetCharacterId.startsWith("manekin"),
    });

    onTargetProcessed?.();
  }, [targetCharacterId, characterStats, onTargetProcessed]);

  // Compute layout flags once and pass to all CharacterBuildCards
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isVeryNarrow = useMediaQuery("(max-width: 560px)");
  const buildCardLayout: BuildCardLayout = useMemo(
    () => ({ isMobile, isDesktop, isVeryNarrow }),
    [isMobile, isDesktop, isVeryNarrow]
  );

  // Use custom hook for scroll forwarding from margin areas to main content
  useGlobalScroll(containerRef, mainScrollRef);

  // Compute filtered characters
  const filteredAndSortedCharacters = useMemo(
    () =>
      filterAndSortCharacters(characters, filters, {
        tierAssignments,
        isOwned: isCharacterOwned,
        characterStatsMap: characterStats ?? undefined,
      }),
    [filters, tierAssignments, isCharacterOwned, characterStats]
  );

  // Defer the list to allow UI to stay responsive
  const deferredCharacters = useDeferredValue(filteredAndSortedCharacters);

  const activeFilterCount = [
    filters.elements,
    filters.weaponTypes,
    filters.regions,
    filters.rarities,
  ].flat().length;

  return (
    <div ref={containerRef} className="h-full">
      <SidebarLayout
        sidebar={
          <CharacterFilterSidebar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            hasTierData={hasTierData}
          />
        }
        triggerLabel={t.ui("filters.title")}
        activeFilterCount={activeFilterCount}
        contentScrollRef={mainScrollRef}
        contentScrollsInternally
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
            layout={buildCardLayout}
          />
        )}
      </SidebarLayout>
    </div>
  );
}

interface CharacterListProps {
  characters: typeof characters;
  scrollRef: React.RefObject<HTMLDivElement>;
  layout: BuildCardLayout;
}

function VirtualizedCharacterList({
  characters,
  scrollRef,
  layout,
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
            <div className="mb-3">
              <CharacterBuildCard
                character={characters[virtualItem.index]}
                tourStepId={
                  virtualItem.index === 0 ? "af-build-card" : undefined
                }
                layout={layout}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
