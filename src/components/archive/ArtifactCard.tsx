import { ChevronDown } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { allSlots } from "@/data/enums";
import type { ArtifactSetResource } from "@/data/types";
import { cn, getAssetUrl } from "@/lib/utils";

/** Height threshold (px) for the inner effect container before collapsing kicks in */
const COLLAPSE_THRESHOLD = 180;

export const ArtifactCard = memo(
  ({
    artifact,
    expanded,
    onToggleExpanded,
  }: {
    artifact: ArtifactSetResource;
    expanded: boolean;
    onToggleExpanded: () => void;
  }) => {
    const { t } = useLanguage();
    const name = t.artifact(artifact.id);
    const effects = t.artifactEffects(artifact.id);

    const contentRef = useRef<HTMLDivElement>(null);
    const [overflows, setOverflows] = useState(false);

    useEffect(() => {
      const el = contentRef.current;
      if (!el) return;
      setOverflows(el.scrollHeight > COLLAPSE_THRESHOLD);
    });

    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col group">
        {/* Header: Icons */}
        <div className="bg-gradient-to-b from-accent/50 to-transparent px-4 pt-3 pb-1 sm:pt-4 sm:pb-1 flex gap-1 sm:gap-2 justify-center items-center">
          {allSlots.map((slot) => {
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
        <div
          className={cn(
            "px-3 pt-0 flex-1 flex flex-col gap-3",
            !expanded && "pb-3"
          )}
        >
          {/* Inner effect container — collapsible */}
          <div className="relative flex-1 flex flex-col min-h-0">
            <div
              ref={contentRef}
              className={cn(
                "space-y-2 text-sm bg-accent/20 rounded-lg p-3 overflow-hidden",
                overflows && !expanded && "max-h-[180px]",
                (!overflows || expanded) && "flex-1"
              )}
            >
              <h3 className="font-semibold text-lg leading-tight text-center">
                {name}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                <span className="text-amber-400 font-semibold px-1.5 py-0.5 bg-amber-400/10 rounded text-xs leading-none align-middle mr-1.5">
                  {t.ui("accountData.twoPiece")}
                </span>
                <span
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Artifact effect HTML from game data pipeline
                  dangerouslySetInnerHTML={{ __html: effects[0] ?? "" }}
                />
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <span className="text-amber-400 font-semibold px-1.5 py-0.5 bg-amber-400/10 rounded text-xs leading-none align-middle mr-1.5">
                  {t.ui("accountData.fourPiece")}
                </span>
                <span
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Artifact effect HTML from game data pipeline
                  dangerouslySetInnerHTML={{ __html: effects[1] ?? "" }}
                />
              </p>
            </div>

            {/* Fade overlay + expand/collapse toggle */}
            {overflows && (
              <button
                type="button"
                onClick={onToggleExpanded}
                className={cn(
                  "w-full flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground pb-1",
                  !expanded &&
                    "absolute bottom-0 left-0 right-0 pt-8 pb-1 bg-gradient-to-t from-accent/50 via-accent/30 to-transparent rounded-b-lg"
                )}
              >
                <ChevronDown
                  className={cn("h-3.5 w-3.5", expanded && "rotate-180")}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);
ArtifactCard.displayName = "ArtifactCard";
