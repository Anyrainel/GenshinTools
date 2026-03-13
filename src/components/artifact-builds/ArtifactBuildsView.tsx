import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifacts } from "@/data/resources";
import type { Build, ComputeOptions } from "@/data/types";
import { useAsyncCompute } from "@/hooks/useAsyncCompute";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { ArrowRight, Download, Loader2, SlidersHorizontal } from "lucide-react";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { ArtifactCard } from "./ArtifactCard";
import { ComputeSidebar } from "./ComputeSidebar";

interface ArtifactBuildsViewProps {
  onJumpToCharacter: (characterId: string) => void;
  onGoToConfigure?: () => void;
  onOpenImport?: () => void;
  contentRef?: RefObject<HTMLDivElement>;
}

export function ArtifactBuildsView({
  onJumpToCharacter,
  onGoToConfigure,
  onOpenImport,
  contentRef,
}: ArtifactBuildsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Compute options from store
  const computeOptions = useBuildsStore((state) => state.computeOptions);
  const setComputeOptions = useBuildsStore((state) => state.setComputeOptions);

  const { t } = useLanguage();
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Get data from resolved builds hook
  // This automatically handles union of Local and Preset builds
  const characterBuilds = useAllResolvedBuilds();

  // Async compute with caching and cancellation
  const { results: artifactFilters, isComputing } = useAsyncCompute(
    characterBuilds,
    computeOptions
  );

  const filteredSets = useMemo(() => {
    return artifacts.filter((set) => {
      if (
        searchQuery &&
        !t.artifact(set.id).toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;

      // Only show sets that have computed filters
      return artifactFilters.some((filter) => filter.setId === set.id);
    });
  }, [searchQuery, artifactFilters, t]);

  const handleComputeOptionChange = useCallback(
    <K extends keyof ComputeOptions>(key: K, value: ComputeOptions[K]) => {
      setComputeOptions({ [key]: value });
    },
    [setComputeOptions]
  );

  return (
    <SidebarLayout
      sidebar={
        <ComputeSidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          computeOptions={computeOptions}
          onComputeOptionChange={handleComputeOptionChange}
        />
      }
      triggerLabel={t.ui("computeFilters.title")}
    >
      {/* Content Area - Scrollable */}
      <div
        ref={mainScrollRef}
        className="flex-1 overflow-y-auto h-full"
        style={{ scrollBehavior: "auto" }}
      >
        <div ref={contentRef} className="space-y-4">
          {/* Sticky computing indicator */}
          {isComputing && (
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary backdrop-blur-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t.ui("computeFilters.computing")}</span>
            </div>
          )}

          {filteredSets.length === 0 && !isComputing ? (
            <div className="flex flex-col items-center text-center py-16 px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
                  <SlidersHorizontal className="w-10 h-10 text-primary opacity-80" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {t.ui("computeFilters.noConfigurations")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {t.ui("computeFilters.noConfigurationsDesc")}
              </p>
              <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                {onGoToConfigure && (
                  <Button
                    onClick={onGoToConfigure}
                    className="w-full gap-2 shadow-lg shadow-primary/10"
                  >
                    <ArrowRight className="w-4 h-4" />
                    {t.ui("computeFilters.noConfigurationsCta")}
                  </Button>
                )}
                {onOpenImport && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t.ui("computeFilters.noConfigurationsOrPreset")}
                    </p>
                    <Button
                      variant="outline"
                      onClick={onOpenImport}
                      className="w-full gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {t.ui("computeFilters.noConfigurationsImportPreset")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            filteredSets.map((set) => {
              const filter = artifactFilters.find((f) => f.setId === set.id);
              if (!filter) return null;

              return (
                <ArtifactCard
                  key={set.id}
                  setId={set.id}
                  setImagePath={set.imagePaths.flower}
                  filter={filter}
                  onJumpToCharacter={onJumpToCharacter}
                />
              );
            })
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
