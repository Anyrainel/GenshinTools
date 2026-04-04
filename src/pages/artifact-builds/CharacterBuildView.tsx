import { BuildsEmptyState } from "@/components/artifact-builds/BuildsEmptyState";
import {
  type BuildCardLayout,
  CharacterBuildCard,
} from "@/components/artifact-builds/CharacterBuildCard";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import { characters } from "@/data/resources";
import { useCharacterFilters } from "@/hooks/useCharacterFilters";
import { useGameStats } from "@/hooks/useGameStats";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import { filterAndSortCharacters } from "@/lib/characterFilters";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
} from "react";

interface CharacterBuildViewProps {
  /** When set, filters will be configured to show this character */
  targetCharacterId?: string;
  /** Called when targetCharacterId has been processed, so parent can clear it */
  onTargetProcessed?: () => void;
  /** Opens the import dialog (provided by parent page) */
  onOpenImport?: () => void;
}

export function CharacterBuildView({
  targetCharacterId,
  onTargetProcessed,
  onOpenImport,
}: CharacterBuildViewProps) {
  const { t } = useLanguage();
  const { characterStats } = useGameStats();
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasAccountData = useAccountStore(
    (s) => getActiveAccount(s)?.data != null
  );
  const hasAnyBuilds =
    Object.keys(useBuildsStore((s) => s.characterToBuildIds)).length > 0;

  const {
    filters,
    handleFiltersChange,
    setCheckboxFilters,
    activeFilterCount,
    tierAssignments,
    hasTierData,
    isCharacterOwned,
  } = useCharacterFilters({ defaultOwnedOnly: hasAccountData });

  const activeAccount = useAccountStore(getActiveAccount);
  const scores: Record<string, ArtifactScoreResult | null> =
    activeAccount?.scores ?? {};
  const hasScoreData = Object.keys(scores).length > 0;

  const nameResolver = useCallback((id: string) => t.character(id), [t]);
  const searchableProperties = useCallback(
    (id: string) => {
      const stats = characterStats?.[id];
      const char = charactersById[id];
      if (!char) return [];
      const meta = getCharacterDisplayMeta(char, stats);
      const props: string[] = [];
      if (meta.element) props.push(t.element(meta.element));
      if (meta.region) props.push(t.region(meta.region));
      return props;
    },
    [characterStats, t]
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
      searchQuery: "",
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
        scores,
        nameResolver,
        searchableProperties,
      }),
    [
      filters,
      tierAssignments,
      isCharacterOwned,
      characterStats,
      scores,
      nameResolver,
      searchableProperties,
    ]
  );

  // Defer the list to allow UI to stay responsive
  const deferredCharacters = useDeferredValue(filteredAndSortedCharacters);

  if (!hasAnyBuilds) {
    return (
      <div ref={containerRef} className="h-full">
        <BuildsEmptyState onOpenImport={onOpenImport} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full">
      <SidebarLayout
        sidebar={
          <CharacterFilterSidebar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            hasTierData={hasTierData}
            hasScoreData={hasScoreData}
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
                {t.ui("configure.noChars")}
              </h3>
              <p className="text-muted-foreground">
                {t.ui("configure.noCharsDesc")}
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
