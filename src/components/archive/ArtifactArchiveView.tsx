import { HeaderScrollLayout } from "@/components/layout/HeaderScrollLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { sortedArtifacts } from "@/data/constants";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { fuzzyMatch } from "@/lib/search";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveToolbar } from "./ArchiveToolbar";
import { ArtifactCard } from "./ArtifactCard";

export function ArtifactArchiveView() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

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
    const query = searchQuery.trim();
    if (!query) return sortedArtifacts;

    return sortedArtifacts.filter((artifact) => {
      const name = t.artifact(artifact.id);
      const effects = t.artifactEffects(artifact.id);

      // Search by ID or Name
      if (fuzzyMatch(query, name) || fuzzyMatch(query, artifact.id)) {
        return true;
      }

      // Search by effect texts
      const q = query.toLowerCase();
      for (const effect of effects) {
        if (effect.toLowerCase().includes(q)) return true;
      }

      return false;
    });
  }, [searchQuery, t]);

  return (
    <HeaderScrollLayout
      className="h-full"
      headerClassName="py-4"
      bodyClassName="pb-8"
      header={
        <ArchiveToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.ui("archive.artifactSearchPlaceholder")}
        />
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
    </HeaderScrollLayout>
  );
}
