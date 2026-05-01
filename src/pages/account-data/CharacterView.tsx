import { useVirtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArtifactScoreGlobalSettings } from "@/components/account-data/ArtifactScoreGlobalSettings";
import {
  type CardLayout,
  CharacterCard,
} from "@/components/account-data/CharacterCard";
import { CharacterEditDialog } from "@/components/account-data/CharacterEditDialog";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { ExportBranding } from "@/components/shared/ExportBranding";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/gameResources";
import {
  characterStatsResource,
  getCharacterDisplayMeta,
} from "@/data/gameStatsLoader";
import type { AccountData, CharacterData } from "@/data/types";
import {
  useActiveAccountData,
  useActiveAccountScores,
} from "@/hooks/useActiveAccount";
import { useCharacterFilters } from "@/hooks/useCharacterFilters";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useIsOwned } from "@/hooks/useOwnership";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { filterAndSortCharacterData } from "@/lib/characterFilters";
import { downloadElementAsImage } from "@/lib/downloadImage";
import { selectActiveTierAssignments } from "@/stores/createTierStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";
export interface CharacterViewHandle {
  downloadImage: () => void;
}

export interface CharacterViewProps {
  isEditMode?: boolean;
}

export const CharacterView = forwardRef<
  CharacterViewHandle,
  CharacterViewProps
>(function CharacterView({ isEditMode = false }, ref) {
  const { t } = useLanguage();
  const characterStats = characterStatsResource.use();
  const accountData = useActiveAccountData();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const addOrUpdateAccount = useAccountStore((s) => s.addOrUpdateAccount);

  const scores = useActiveAccountScores();

  const tierAssignments = useTierStore(selectActiveTierAssignments);
  const hasTierData = Object.keys(tierAssignments).length > 0;

  const isOwned = useIsOwned();
  const isCharacterOwned = useCallback(
    (id: string) => isOwned("character", id),
    [isOwned]
  );

  const {
    filters,
    handleFiltersChange,
    setCheckboxFilters,
    activeFilterCount,
  } = useCharacterFilters({ defaultOwnedOnly: false, hasTierData });

  // 640px is a safe breakpoint where 35rem (560px) fits comfortably with margins
  const isSmallScreen = useMediaQuery("(max-width: 640px)");

  // Compute layout flags once and pass to all CharacterCards (avoids 3× useMediaQuery per card)
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const isVeryNarrow = useMediaQuery("(max-width: 560px)");
  const is2xlCompact = useMediaQuery(
    "(min-width: 1536px) and (max-width: 2047px)"
  );
  const cardLayout: CardLayout = useMemo(
    () => ({
      isMobile,
      isVeryNarrow,
      isArtifactCompact: isVeryNarrow || is2xlCompact,
    }),
    [isMobile, isVeryNarrow, is2xlCompact]
  );

  // Edit mode
  const [editingChar, setEditingChar] = useState<CharacterData | null>(null);

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

  const hasScoreData = Object.keys(scores).length > 0;

  // Filter and sort account characters using shared utility
  const filteredCharacters = useMemo(() => {
    if (!accountData) return [];
    return filterAndSortCharacterData(accountData.characters, filters, {
      tierAssignments,
      isOwned: isCharacterOwned,
      characterStatsMap: characterStats ?? undefined,
      scores,
      nameResolver,
      searchableProperties,
    });
  }, [
    accountData,
    filters,
    tierAssignments,
    isCharacterOwned,
    characterStats,
    scores,
    nameResolver,
    searchableProperties,
  ]);

  const handleSaveEdit = useCallback(
    (newData: AccountData) => {
      if (activeAccountId === null) return;
      addOrUpdateAccount(activeAccountId, { data: newData });
    },
    [activeAccountId, addOrUpdateAccount]
  );

  const mainScrollRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [showExport, setShowExport] = useState(false);

  // Characters eligible for export: has artifacts, sorted by score desc
  const exportCharacters = useMemo(
    () =>
      filteredCharacters
        .filter((char) => Object.keys(char.artifacts).length > 0)
        .sort(
          (a, b) =>
            (scores[b.key]?.normalized.normalizedScore ?? 0) -
            (scores[a.key]?.normalized.normalizedScore ?? 0)
        ),
    [filteredCharacters, scores]
  );

  const handleDownloadImage = useCallback(() => {
    setShowExport(true);
  }, []);

  useImperativeHandle(ref, () => ({ downloadImage: handleDownloadImage }), [
    handleDownloadImage,
  ]);

  // Once showExport is true and ref is attached, capture and unmount
  useEffect(() => {
    if (!showExport || !exportRef.current) return;
    // Wait for next frame to let all cards render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!exportRef.current) return;
        const filename = t
          .ui("teamComp.characterScoreExportFilename")
          .replace("{0}", String(exportCharacters.length));
        downloadElementAsImage(exportRef.current, filename, t).finally(() =>
          setShowExport(false)
        );
      });
    });
  }, [showExport, t, exportCharacters.length]);

  /** Fixed layout for export (no responsive, desktop-style) */
  const exportLayout: CardLayout = useMemo(
    () => ({ isMobile: false, isVeryNarrow: false, isArtifactCompact: false }),
    []
  );

  if (!accountData) return null;

  return (
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
      {filteredCharacters.length === 0 ? (
        <div ref={mainScrollRef} className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t.ui("accountData.noFilterMatch")}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              {t.ui("accountData.noFilterMatchDesc")}
            </p>
            {activeFilterCount > 0 && (
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
                    searchQuery: "",
                  })
                }
                className="text-primary hover:underline underline-offset-4 font-medium"
              >
                {t.ui("filters.clearAll")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <VirtualizedCharacterGrid
          characters={filteredCharacters}
          scores={scores}
          isEditMode={isEditMode}
          cardLayout={cardLayout}
          isSmallScreen={isSmallScreen}
          onEdit={setEditingChar}
          scrollRef={mainScrollRef}
        />
      )}

      {/* Hidden export container — mounted only during capture */}
      {showExport && (
        <div
          style={{ position: "fixed", left: -9999, top: 0 }}
          aria-hidden="true"
        >
          <div
            ref={exportRef}
            className="p-1"
            style={{ width: isMobile ? 1224 : 2460 }}
          >
            <ExportBranding />
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: isMobile
                  ? "repeat(2, 600px)"
                  : "repeat(4, 600px)",
              }}
            >
              {exportCharacters.map((char) => (
                <div key={char.key} className="[&>*]:max-w-none [&>*]:mx-0">
                  <CharacterCard
                    char={char}
                    score={scores[char.key]}
                    layout={exportLayout}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
});

// ─── Virtualized grid ────────────────────────────────────────────

interface VirtualGridProps {
  characters: CharacterData[];
  scores: Record<string, ArtifactScoreResult | null>;
  isEditMode: boolean;
  cardLayout: CardLayout;
  isSmallScreen: boolean;
  onEdit: (char: CharacterData) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

/** Card min-width in px — matches CSS minmax(32rem, 1fr) = 512px */
const CARD_MIN_WIDTH = 512;
/** Grid gap in px — matches gap-3 = 0.75rem = 12px */
const GRID_GAP = 12;

function VirtualizedCharacterGrid({
  characters,
  scores,
  isEditMode,
  cardLayout,
  isSmallScreen,
  onEdit,
  scrollRef,
}: VirtualGridProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [numColumns, setNumColumns] = useState(() => {
    if (isSmallScreen) return 1;
    // Best-guess from window width (sidebar ~240px, gap ~12px)
    const approxWidth = window.innerWidth - 280;
    return Math.max(
      1,
      Math.floor((approxWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP))
    );
  });
  const [headerHeight, setHeaderHeight] = useState(0);

  // Observe container width → derive column count
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollRef.current is a ref and should not be a dependency
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isSmallScreen) {
      setNumColumns(1);
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      // Match CSS auto-fit: n columns fit when (width - (n-1)*gap) / n >= minWidth
      // Solving: n <= (width + gap) / (minWidth + gap)
      const w = entry.contentRect.width;
      setNumColumns(
        Math.max(1, Math.floor((w + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)))
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSmallScreen]);

  // Observe header height for virtualizer scrollMargin
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeaderHeight(Math.ceil(entry.borderBoxSize[0].blockSize));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Chunk characters into rows based on column count
  const rows = useMemo(() => {
    const result: CharacterData[][] = [];
    for (let i = 0; i < characters.length; i += numColumns) {
      result.push(characters.slice(i, i + numColumns));
    }
    return result;
  }, [characters, numColumns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 280,
    overscan: 3,
    scrollMargin: headerHeight,
  });

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      style={{ scrollBehavior: "auto" }}
    >
      {/* Non-virtual header — scrolls with the list, mb-3 matches old space-y-3 */}
      <div ref={headerRef} className="space-y-3 mb-3">
        <ArtifactScoreGlobalSettings />
      </div>

      {/* Virtual rows */}
      <div
        className="relative w-full pb-1"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            <div
              className="grid gap-3 pb-3"
              style={{ gridTemplateColumns: `repeat(${numColumns}, 1fr)` }}
            >
              {rows[virtualRow.index].map((char) => (
                <div key={char.key}>
                  <CharacterCard
                    char={char}
                    score={scores[char.key]}
                    onEdit={isEditMode ? () => onEdit(char) : undefined}
                    layout={cardLayout}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
