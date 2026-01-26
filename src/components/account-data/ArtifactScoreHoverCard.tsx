import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ArtifactScoreHoverCardProps {
  score: ArtifactScoreResult;
  className?: string;
  compact?: boolean;
}

/**
 * ArtifactScoreHoverCard - Displays artifact scores with detailed breakdown.
 *
 * Uses a hybrid hover + click pattern:
 * - Desktop hover: Shows temporarily, disappears on mouse leave
 * - Click/Tap: Pins open until click outside
 *
 * This makes the content accessible on mobile where hover doesn't exist.
 */
export function ArtifactScoreHoverCard({
  score,
  className,
  compact = false,
}: ArtifactScoreHoverCardProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Always controlled: open when pinned OR hovering
  const isOpen = isPinned || isHovering;

  // Click-outside detection when pinned
  useEffect(() => {
    if (!isPinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideTrigger = !triggerRef.current?.contains(target);
      const isOutsideContent = !contentRef.current?.contains(target);

      if (isOutsideTrigger && isOutsideContent) {
        setIsPinned(false);
      }
    };

    // Delay adding listener to avoid catching the pin click itself
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isPinned]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPinned((prev) => !prev);
  };

  const handleOpenChange = (open: boolean) => {
    if (isPinned) {
      // When pinned, ignore hover state changes
      return;
    }
    // Normal hover behavior
    setIsHovering(open);
  };

  const TriggerContent = (
    <>
      <span className="bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
        {score.mainScore.toFixed(0)}
      </span>
      <span
        className={cn(
          "text-amber-100/40 font-light not-italic tracking-normal",
          compact ? "mx-0.5 text-[0.8em]" : "mx-1"
        )}
      >
        /
      </span>
      <span className="bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
        {score.subScore.toFixed(0)}
      </span>
    </>
  );

  if (compact) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <button
            type="button"
            className={cn(
              "cursor-pointer flex items-center",
              "bg-transparent border-none p-0 font-inherit",
              className
            )}
          >
            {TriggerContent}
          </button>
        </DrawerTrigger>
        <DrawerContent className="bg-slate-950/95 border-t border-white/10">
          <div className="p-4 pt-0 safe-area-bottom">
            <ArtifactScoreContent artifactScore={score} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <HoverCard openDelay={200} open={isOpen} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            "cursor-pointer flex items-center",
            // Reset button styles
            "bg-transparent border-none p-0 font-inherit",
            className
          )}
          onClick={handleClick}
        >
          {TriggerContent}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        ref={contentRef}
        className="w-auto bg-black/95 border-border/50 text-gray-200 p-5 shadow-xl"
      >
        <ArtifactScoreContent artifactScore={score} />
      </HoverCardContent>
    </HoverCard>
  );
}

interface ArtifactScoreContentProps {
  artifactScore: ArtifactScoreResult;
}

function ArtifactScoreContent({ artifactScore }: ArtifactScoreContentProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-end border-b border-white/10 pb-2">
        <span className="text-lg font-bold text-amber-200 uppercase tracking-wider">
          {t.ui("accountData.artifactScore")}
        </span>
        <div className="flex gap-4 text-base text-slate-400 font-mono">
          <span className="flex gap-1">
            <span className="text-sm font-sans">
              {t.ui("computeFilters.mainStat")}:
            </span>
            <span className="text-amber-200">
              {artifactScore.mainScore.toFixed(1)}
            </span>
          </span>
          <span className="flex gap-1">
            <span className="text-sm font-sans">
              {t.ui("computeFilters.subStat")}:
            </span>
            <span className="text-amber-200">
              {artifactScore.subScore.toFixed(1)}
            </span>
          </span>
        </div>
      </div>

      {/* Breakdown by Slot */}
      <div className="grid grid-cols-[auto_repeat(5,auto)] gap-y-2 gap-x-4 text-base">
        {/* Header Row */}
        <div />
        {["flower", "plume", "sands", "goblet", "circlet"].map((slot) => (
          <div
            key={slot}
            className="text-center text-sm text-slate-400 truncate px-1"
          >
            {t.ui(`computeFilters.${slot}`)}
          </div>
        ))}

        {/* Main Stat Row */}
        <div className="text-right text-sm text-slate-400 pr-2 self-center">
          {t.ui("computeFilters.mainStat")}
        </div>
        {["flower", "plume", "sands", "goblet", "circlet"].map((slot) => {
          const mainScore = artifactScore.slotMainScores[slot];
          const subScore = artifactScore.slotSubScores[slot];
          // Warning: artifact exists (has sub score) but main stat weight is 0
          // Only applies to sands/goblet/circlet where main stat choice matters
          const hasZeroWeightMainStat =
            ["sands", "goblet", "circlet"].includes(slot) &&
            subScore !== undefined &&
            subScore > 0 &&
            mainScore === 0;

          return (
            <div
              key={slot}
              className={cn(
                "text-center font-mono bg-white/5 rounded py-1 px-2",
                hasZeroWeightMainStat ? "text-orange-400" : "text-amber-200"
              )}
            >
              {mainScore !== undefined ? mainScore.toFixed(1) : "-"}
            </div>
          );
        })}

        {/* Sub Stat Row */}
        <div className="text-right text-sm text-slate-400 pr-2 self-center">
          {t.ui("computeFilters.subStat")}
        </div>
        {["flower", "plume", "sands", "goblet", "circlet"].map((slot) => {
          const subScore = artifactScore.slotSubScores[slot];
          const maxScore = artifactScore.slotMaxSubScores[slot];
          const percent =
            maxScore && maxScore > 0 ? (subScore ?? 0) / maxScore : 0;

          // Dynamic font weight based on percentage of potential
          // <60%: normal, 60-80%: medium, 80-90%: semibold, 90-100%: bold, 100%+: extrabold
          let fontWeight = "font-normal";
          if (percent >= 1.0) fontWeight = "font-extrabold";
          else if (percent >= 0.9) fontWeight = "font-bold";
          else if (percent >= 0.8) fontWeight = "font-semibold";
          else if (percent >= 0.6) fontWeight = "font-medium";

          return (
            <div
              key={slot}
              className={cn(
                "text-center font-mono text-amber-200 bg-white/5 rounded py-1 px-2",
                fontWeight
              )}
            >
              {subScore !== undefined ? subScore.toFixed(1) : "-"}
            </div>
          );
        })}
      </div>

      {/* Breakdown by Stat */}
      <table className="w-full text-base mt-2 border-collapse">
        <thead>
          <tr className="text-sm text-slate-400 border-b border-white/5">
            <th className="text-left font-normal pb-2">
              {t.ui("accountData.breakdownByStat")}
            </th>
            <th className="text-right font-normal pb-2 pl-4">
              {t.ui("computeFilters.mainStat")}{" "}
              <span className="text-xs opacity-70">
                ({t.ui("accountData.valOverScore")})
              </span>
            </th>
            <th className="text-right font-normal pb-2 pl-4">
              {t.ui("computeFilters.subStat")}{" "}
              <span className="text-xs opacity-70">
                ({t.ui("accountData.valOverScore")})
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(artifactScore.statScores)
            .filter(
              ([, data]) =>
                (data.mainValue > 0 || data.subValue > 0) && data.weight > 0
            )
            .sort((a, b) => {
              if (b[1].weight !== a[1].weight) {
                return b[1].weight - a[1].weight;
              }
              return a[0].localeCompare(b[0]);
            })
            .map(([key, data]) => {
              const isPercent =
                key.endsWith("%") || ["cr", "cd", "er"].includes(key);

              const formatValue = (val: number) =>
                isPercent ? `${val.toFixed(1)}%` : Math.round(val);

              return (
                <tr key={key}>
                  <td className="py-1">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-gray-300">{t.statShort(key)}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground font-mono">
                        {data.weight.toFixed(1)}
                      </span>
                    </div>
                  </td>

                  {/* Main Stat Col */}
                  <td className="text-right py-1 pl-4 font-mono text-gray-400 whitespace-nowrap">
                    {data.mainValue > 0 ? (
                      <>
                        <span className="text-gray-300">
                          {formatValue(data.mainValue)}
                        </span>
                        <span className="text-muted-foreground mx-1.5">/</span>
                        <span className="text-amber-200">
                          {data.mainScore.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/30">-</span>
                    )}
                  </td>

                  {/* Sub Stat Col */}
                  <td className="text-right py-1 pl-4 font-mono text-gray-400 whitespace-nowrap">
                    {data.subValue > 0 ? (
                      <>
                        <span className="text-gray-300">
                          {formatValue(data.subValue)}
                        </span>
                        <span className="text-muted-foreground mx-1.5">/</span>
                        <span className="text-amber-200">
                          {data.subScore.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/30">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
