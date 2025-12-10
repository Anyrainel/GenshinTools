import { useMemo, useState, useRef, useCallback, RefObject } from "react";
import { Build, ComputeOptions } from "@/data/types";
import { artifacts } from "@/data/resources";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { computeArtifactFilters } from "@/lib/computeFilters";
import { ArtifactCard } from "./ArtifactCard";
import { ComputeSidebar, ComputeSidebarMobile } from "./ComputeSidebar";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";

interface ComputeViewProps {
  onJumpToCharacter: (characterId: string) => void;
  contentRef?: RefObject<HTMLDivElement>;
}

export function ComputeView({
  onJumpToCharacter,
  contentRef,
}: ComputeViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Compute options from store
  const computeOptions = useBuildsStore((state) => state.computeOptions);
  const setComputeOptions = useBuildsStore((state) => state.setComputeOptions);

  const { t } = useLanguage();
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use custom hook for scroll forwarding from margin areas to main content
  // Using '.lg\\:block.w-64' selector to target the sidebar in ComputeView
  useGlobalScroll(containerRef, mainScrollRef, ".lg\\:block.w-64");

  // Get data from Zustand store
  const characterToBuildIds = useBuildsStore(
    (state) => state.characterToBuildIds,
  );
  const buildsMap = useBuildsStore((state) => state.builds);
  const hiddenCharacters = useBuildsStore((state) => state.hiddenCharacters);

  // Convert to the format expected by the rest of the component
  const characterBuilds = useMemo(() => {
    return Object.entries(characterToBuildIds)
      .filter(([characterId]) => !hiddenCharacters[characterId])
      .map(([characterId, buildIds]) => ({
        characterId,
        builds: buildIds
          .map((id) => buildsMap[id])
          .filter((b): b is Build => b !== undefined && b.visible),
        hidden: false,
      }));
  }, [characterToBuildIds, buildsMap, hiddenCharacters]);

  // Compute artifact filters from character builds with options
  const artifactFilters = useMemo(() => {
    return computeArtifactFilters(characterBuilds, computeOptions);
  }, [characterBuilds, computeOptions]);

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
    [setComputeOptions],
  );

  const hasActiveFilters = searchQuery.length > 0;

  return (
    <div
      ref={containerRef}
      className="flex flex-row gap-4 lg:gap-6 h-full pt-4"
    >
      {/* Desktop Sidebar - Fixed height with internal scroll */}
      <div className="hidden lg:block w-64 xl:w-72 flex-shrink-0 h-full">
        <ComputeSidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          computeOptions={computeOptions}
          onComputeOptionChange={handleComputeOptionChange}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <ComputeSidebarMobile
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isOpen={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          hasActiveFilters={hasActiveFilters}
          computeOptions={computeOptions}
          onComputeOptionChange={handleComputeOptionChange}
        />

        {/* Content Area - Scrollable */}
        <div
          ref={mainScrollRef}
          className="flex-1 overflow-y-auto"
          style={{ scrollBehavior: "auto" }}
        >
          <div ref={contentRef} className="space-y-6">
            {filteredSets.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">⚙️</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t.ui("computeFilters.noConfigurations")}
                </h3>
              </div>
            ) : (
              filteredSets.map((set) => {
                const filter = artifactFilters.find((f) => f.setId === set.id);
                if (!filter) return null;

                return (
                  <ArtifactCard
                    key={set.id}
                    setId={set.id}
                    setImagePath={set.imagePath}
                    filter={filter}
                    onJumpToCharacter={onJumpToCharacter}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
