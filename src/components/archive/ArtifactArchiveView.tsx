import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactIdToHalfSetId, sortedArtifacts } from "@/data/constants";
import { artifactHalfSets } from "@/data/resources";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { fuzzyMatch } from "@/lib/search";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveToolbar } from "./ArchiveToolbar";
import { ArtifactCard } from "./ArtifactCard";
import { FilterChip } from "./FilterChip";

const ALL_HALF_SET_IDS = artifactHalfSets.map((hs) => hs.id);

export function ArtifactArchiveView() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [halfSetFilter, setHalfSetFilter] = useState<Set<string>>(
    () => new Set()
  );

  const sortedHalfSetIds = useMemo(
    () =>
      [...ALL_HALF_SET_IDS].sort((a, b) =>
        t.halfSetShort(a).localeCompare(t.halfSetShort(b))
      ),
    [t]
  );

  const toggleHalfSet = useCallback((id: string) => {
    setHalfSetFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    let result = sortedArtifacts;

    // Half-set filter
    if (halfSetFilter.size > 0) {
      result = result.filter((artifact) => {
        const halfSetId = artifactIdToHalfSetId[artifact.id];
        return halfSetId && halfSetFilter.has(halfSetId);
      });
    }

    // Search filter
    const query = searchQuery.trim();
    if (query) {
      result = result.filter((artifact) => {
        const name = t.artifact(artifact.id);
        const effects = t.artifactEffects(artifact.id);

        if (fuzzyMatch(query, name) || fuzzyMatch(query, artifact.id)) {
          return true;
        }

        const q = query.toLowerCase();
        for (const effect of effects) {
          if (effect.toLowerCase().includes(q)) return true;
        }

        return false;
      });
    }

    return result;
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
          {sortedHalfSetIds.map((hsId) => (
            <FilterChip
              key={hsId}
              active={halfSetFilter.size === 0 || halfSetFilter.has(hsId)}
              onClick={() => toggleHalfSet(hsId)}
            >
              {t.halfSetShort(hsId)}
            </FilterChip>
          ))}
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
