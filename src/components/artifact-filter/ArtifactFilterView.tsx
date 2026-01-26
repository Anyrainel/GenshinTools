import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifacts } from "@/data/resources";
import type { Build, ComputeOptions } from "@/data/types";
import { computeArtifactFilters } from "@/lib/computeFilters";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { ArtifactCard } from "./ArtifactCard";
import { ComputeSidebar } from "./ComputeSidebar";

interface ArtifactFilterViewProps {
  onJumpToCharacter: (characterId: string) => void;
  contentRef?: RefObject<HTMLDivElement>;
}

export function ArtifactFilterView({
  onJumpToCharacter,
  contentRef,
}: ArtifactFilterViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Compute options from store
  const computeOptions = useBuildsStore((state) => state.computeOptions);
  const setComputeOptions = useBuildsStore((state) => state.setComputeOptions);

  const { t } = useLanguage();
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Get data from Zustand store
  const characterToBuildIds = useBuildsStore(
    (state) => state.characterToBuildIds
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
          .filter((b): b is Build => b?.visible),
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
      className="pt-4"
    >
      {/* Content Area - Scrollable */}
      <div
        ref={mainScrollRef}
        className="flex-1 overflow-y-auto h-full"
        style={{ scrollBehavior: "auto" }}
      >
        <div ref={contentRef} className="space-y-4">
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
