import { useLanguage } from "@/contexts/LanguageContext";
import { sortedArtifacts } from "@/data/constants";
import { type Slot, mainStatSlots } from "@/data/types";
import { fuzzyMatch } from "@/lib/search";
import { cn, getAssetUrl } from "@/lib/utils";
import { useMemo, useState } from "react";
import { ArchiveToolbar } from "./ArchiveToolbar";

const ALL_SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

export function ArtifactArchiveView() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

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
    <div className="space-y-4 pb-8">
      {/* Toolbar */}
      <div className="pb-4">
        <ArchiveToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.ui("archive.artifactSearchPlaceholder")}
        />
      </div>

      {artifacts.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {t.ui("archive.noArtifactResults")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {artifacts
            .filter((a) => t.artifactEffects(a.id).length > 1)
            .map((artifact) => {
              const name = t.artifact(artifact.id);
              const effects = t.artifactEffects(artifact.id);

              return (
                <div
                  key={artifact.id}
                  className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-border transition-colors flex flex-col group"
                >
                  {/* Header: Icons */}
                  <div className="bg-gradient-to-b from-accent/50 to-transparent px-4 pt-4 pb-1 sm:pt-8 sm:pb-1 flex gap-1 sm:gap-2 justify-center items-center">
                    {ALL_SLOTS.map((slot) => {
                      const imgPath = artifact.imagePaths[slot];
                      if (!imgPath) return null;
                      return (
                        <div
                          key={slot}
                          className="w-12 h-12 sm:w-14 sm:h-14 relative flex-shrink-0"
                        >
                          <img
                            src={getAssetUrl(imgPath)}
                            alt={slot}
                            className="w-full h-full object-contain drop-shadow-md brightness-[1.15]"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Content */}
                  <div className="px-5 pb-5 pt-0 flex-1 flex flex-col gap-3">
                    <h3 className="font-semibold text-lg leading-tight text-center">
                      {name}
                    </h3>

                    <div className="space-y-3 flex-1 text-sm bg-accent/20 rounded-lg p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-amber-400 font-semibold px-2 py-0.5 bg-amber-400/10 rounded-md w-fit text-xs self-start">
                          {t.ui("accountData.twoPiece")}
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                          {effects[0]}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-amber-400 font-semibold px-2 py-0.5 bg-amber-400/10 rounded-md w-fit text-xs self-start">
                          {t.ui("accountData.fourPiece")}
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                          {effects[1]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
