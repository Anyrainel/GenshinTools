import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { ArtifactCard } from "@/components/archive/ArtifactCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  allHalfSetIds,
  artifactIdToHalfSetId,
  sortedArtifacts,
} from "@/data/gameResources";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { filterArchiveItems } from "@/lib/archiveFilters";
import { fuzzyMatch } from "@/lib/search";
import { useArchiveSessionStore } from "@/stores/useArchiveSessionStore";

export function ArtifactArchiveView() {
  const { t } = useLanguage();
  const searchQuery = useArchiveSessionStore((s) => s.artifactSearch);
  const setSearchQuery = useArchiveSessionStore((s) => s.setArtifactSearch);
  const [halfSetFilter, setHalfSetFilter] = useState<Set<string>>(
    () => new Set()
  );

  // Determine grid column count to match CSS breakpoints
  const isXl = useMediaQuery("(min-width: 1280px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const cols = isXl ? 3 : isLg ? 2 : 1;

  // Track which rows are expanded; reset when column count changes
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const prevColsRef = useRef(cols);
  useEffect(() => {
    if (prevColsRef.current !== cols) {
      prevColsRef.current = cols;
      setExpandedRows(new Set());
    }
  }, [cols]);

  const toggleRow = useCallback((row: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }, []);

  const artifacts = useMemo(() => {
    return filterArchiveItems(
      sortedArtifacts,
      searchQuery,
      (item, normalizedSearch) => {
        const name = t.artifact(item.id);
        const effects = t.artifactEffects(item.id);

        if (
          fuzzyMatch(normalizedSearch, name) ||
          fuzzyMatch(normalizedSearch, item.id)
        ) {
          return true;
        }

        const lowerQuery = normalizedSearch.toLowerCase();
        return effects.some((effect) =>
          effect.toLowerCase().includes(lowerQuery)
        );
      },
      (item) => {
        if (halfSetFilter.size === 0) return true;
        const halfSetId = artifactIdToHalfSetId[item.id];
        return Boolean(halfSetId && halfSetFilter.has(halfSetId));
      }
    );
  }, [searchQuery, halfSetFilter, t]);

  return (
    <ScrollLayout
      className="h-full"
      header={
        <ArchiveToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.ui("archive.searchItemPlaceholder")}
        >
          <FilterChipGroup
            options={allHalfSetIds}
            selectedValues={halfSetFilter}
            onSelectedValuesChange={setHalfSetFilter}
            getKey={(halfSetId) => halfSetId}
            getLabel={(halfSetId) => t.halfSetShort(halfSetId)}
            className="contents"
          />
        </ArchiveToolbar>
      }
    >
      {artifacts.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {t.ui("archive.noArtifactResults")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {artifacts
            .filter((a) => t.artifactEffects(a.id).length > 1)
            .map((artifact, index) => {
              const row = Math.floor(index / cols);
              return (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  expanded={expandedRows.has(row)}
                  onToggleExpanded={() => toggleRow(row)}
                />
              );
            })}
        </div>
      )}
    </ScrollLayout>
  );
}
