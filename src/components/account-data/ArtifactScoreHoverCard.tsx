import { ArrowUpRight, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { fmtStat } from "@/lib/team-comp/displayFormatter";
import { cn } from "@/lib/utils";

interface ArtifactScoreHoverCardProps {
  score: ArtifactScoreResult | null;
  characterId: string;
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
  characterId,
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

  const { t } = useLanguage();

  const noBuild = score == null;

  // Show warning icon when scored using a genuinely different artifact set
  const hasSetMismatch = score?.buildMatch?.setDifferent;

  const labelCn = cn(
    "text-muted-foreground font-bold leading-none not-italic",
    compact ? "text-xs" : "text-sm"
  );

  const TriggerContent = noBuild ? (
    <CircleAlert
      className={cn("text-amber-400/70", compact ? "w-5 h-5" : "w-6 h-6")}
    />
  ) : (
    <div className="flex flex-col items-end gap-0 relative">
      {hasSetMismatch && (
        <Info
          className={cn(
            "shrink-0 text-amber-400 absolute -left-5 top-1/2 -translate-y-1/2",
            compact ? "w-3 h-3" : "w-3.5 h-3.5"
          )}
        />
      )}
      <div className="flex items-baseline gap-1">
        <span className={labelCn}>{t.ui("accountData.statCount")}</span>
        <span
          className={cn(
            "italic text-sky-300 tracking-tighter leading-none font-extrabold pr-[2px]",
            compact ? "text-xl" : "text-2xl"
          )}
        >
          {score.substatScore.statCount.toFixed(1)}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={labelCn}>{t.ui("accountData.score")}</span>
        <span
          className={cn(
            "italic bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent tracking-tighter leading-none font-black pr-[2px]",
            compact ? "text-xl" : "text-2xl"
          )}
        >
          {score.normalized.normalizedScore.toFixed(0)}
        </span>
      </div>
    </div>
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
          <DrawerTitle className="sr-only">Artifact Score</DrawerTitle>
          <DrawerDescription className="sr-only">
            Artifact score breakdown by stat
          </DrawerDescription>
          <div className="p-3 pt-0 safe-area-bottom">
            {score ? (
              <ArtifactScoreContent
                artifactScore={score}
                characterId={characterId}
              />
            ) : (
              <NoBuildContent characterId={characterId} />
            )}
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
        className="w-auto bg-black/95 border-2 border-amber-500/50 text-gray-200 p-3"
      >
        {score ? (
          <ArtifactScoreContent
            artifactScore={score}
            characterId={characterId}
          />
        ) : (
          <NoBuildContent characterId={characterId} />
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

interface ArtifactScoreContentProps {
  artifactScore: ArtifactScoreResult;
  characterId: string;
}

/** Format the build's artifact set name for display */
function useBuildSetLabel(score: ArtifactScoreResult): string | null {
  const { t } = useLanguage();
  const build = score.buildMatch?.build;
  if (!build) return null;

  if (build.composition === "4pc" && build.artifactSet) {
    return t.artifact(build.artifactSet);
  }
  if (
    build.composition === "2pc+2pc" &&
    build.halfSet1 != null &&
    build.halfSet2 != null
  ) {
    return `${t.artifactHalfSet(build.halfSet1)} + ${t.artifactHalfSet(build.halfSet2)}`;
  }
  return build.name;
}

function NoBuildContent({ characterId }: { characterId: string }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3">
      {/* Warning banner */}
      <div className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm bg-amber-500/10 border-amber-500/20 text-amber-300">
        <CircleAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <span className="flex-1">{t.ui("accountData.noBuildConfigured")}</span>
      </div>

      {/* Link to builds page */}
      <Link
        to={`/artifact-filter/configure?char=${characterId}`}
        className="text-amber-400 hover:text-amber-300 underline text-sm"
      >
        {t.ui("accountData.viewBuilds")}
      </Link>
    </div>
  );
}

function ArtifactScoreContent({
  artifactScore,
  characterId,
}: ArtifactScoreContentProps) {
  const { t } = useLanguage();
  const buildSetLabel = useBuildSetLabel(artifactScore);
  const hasSetMismatch = artifactScore.buildMatch?.setDifferent;
  const norm = artifactScore.normalized;
  const normalizer = norm.normalizer;

  // Compute normalized main/sub totals for the summary bar
  const normMainTotal = norm.rawMainStatScore * normalizer;
  const normSubTotal = artifactScore.substatScore.subScore * normalizer;

  return (
    <div className="flex flex-col gap-3">
      {/* Set build banner - Only show if there is a mismatch */}
      {buildSetLabel && hasSetMismatch && (
        <div className="flex items-center gap-2 rounded-md border px-3 py-1 text-sm bg-amber-500/10 border-amber-500/20 text-amber-300">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span className="flex-1">
            {t.ui("accountData.scoredUsing").replace("{0}", buildSetLabel)}
          </span>
          <Link
            to={`/artifact-filter/configure?char=${characterId}`}
            className="text-amber-400 hover:text-amber-300 underline text-xs whitespace-nowrap ml-2"
          >
            {t.ui("accountData.viewBuilds")}
          </Link>
        </div>
      )}

      {/* Header: title + link + score summary */}
      <div className="flex justify-between items-end">
        <span className="text-lg font-bold text-amber-200 uppercase tracking-wider flex items-center gap-2">
          {t.ui("accountData.artifactScore")}
          <Link
            to={`/artifact-filter/configure?char=${characterId}`}
            className="text-xs font-normal normal-case tracking-normal text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
          >
            {t.ui("accountData.viewBuilds")}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </span>
        <div className="flex items-baseline gap-1 font-mono">
          <span className="text-2xl font-black text-amber-200">
            {norm.normalizedScore.toFixed(1)}
          </span>
          <span className="text-sm text-slate-400">
            {t.ui("accountData.outOf300")}
          </span>
        </div>
      </div>
      <div className="-mx-3 border-t border-amber-500/50" />

      {/* Main + Sub score summary bar */}
      <div className="flex items-center gap-3 text-sm font-mono">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-400 font-sans">
            {t.ui("accountData.mainStatContrib")}:
          </span>
          <span className="text-emerald-300">{normMainTotal.toFixed(1)}</span>
        </span>
        <span className="text-slate-600">+</span>
        <span className="flex items-center gap-1.5">
          <span className="text-slate-400 font-sans">
            {t.ui("accountData.subStatContrib")}:
          </span>
          <span className="text-amber-200">{normSubTotal.toFixed(1)}</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-slate-400 font-sans">
            {t.ui("accountData.statCount")}:
          </span>
          <span className="text-sky-300">
            {artifactScore.substatScore.statCount.toFixed(1)}
          </span>
        </span>
      </div>

      {/* Breakdown by Slot */}
      <div className="grid grid-cols-[auto_repeat(5,auto)] gap-y-1 gap-x-2 text-base">
        {/* Header Row */}
        <div />
        {allSlots.map((slot) => (
          <div
            key={slot}
            className="text-center text-sm text-slate-400 truncate px-1"
          >
            {t.slot(slot)}
          </div>
        ))}

        {/* Main Stat Row */}
        <div className="text-right text-sm text-slate-400 pr-2 self-center">
          {t.ui("accountData.mainStatContrib")}
        </div>
        {allSlots.map((slot) => {
          const isMainStat = ["sands", "goblet", "circlet"].includes(slot);
          const isEquipped =
            artifactScore.substatScore.slotMaxSubScores[slot as Slot] > 0;

          if (!isMainStat || !isEquipped) {
            return (
              <div key={slot} className="text-center text-slate-600">
                -
              </div>
            );
          }

          const hasMismatch =
            artifactScore.buildMatch?.mainStatMismatches?.some(
              (m) => m.slot === slot
            );
          const mainScore = norm.slotMainStatScores[slot as Slot] ?? 0;
          const normMainSlot = mainScore * normalizer;

          if (hasMismatch) {
            return (
              <div
                key={slot}
                className="flex items-center justify-center gap-1"
              >
                <TriangleAlert className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-mono text-amber-500">0</span>
              </div>
            );
          }

          return (
            <div
              key={slot}
              className="text-center font-mono text-emerald-300 bg-emerald-500/10 rounded py-1 px-2"
            >
              {normMainSlot > 0 ? `+${normMainSlot.toFixed(0)}` : "-"}
            </div>
          );
        })}

        {/* Sub Stat Row */}
        <div className="text-right text-sm text-slate-400 pr-2 self-center">
          {t.ui("accountData.subStatContrib")}
        </div>
        {allSlots.map((slot) => {
          const subScore = artifactScore.substatScore.slotSubScores[slot];
          const maxScore = artifactScore.substatScore.slotMaxSubScores[slot];
          const percent =
            maxScore && maxScore > 0 ? (subScore ?? 0) / maxScore : 0;

          let fontWeight = "font-normal";
          if (percent >= 1.0) fontWeight = "font-extrabold";
          else if (percent >= 0.9) fontWeight = "font-bold";
          else if (percent >= 0.8) fontWeight = "font-semibold";
          else if (percent >= 0.6) fontWeight = "font-medium";

          const displayScore = (subScore ?? 0) * normalizer;

          return (
            <div
              key={slot}
              className={cn(
                "text-center font-mono text-amber-200 bg-white/5 rounded py-1 px-2",
                fontWeight
              )}
            >
              {displayScore !== undefined ? displayScore.toFixed(1) : "-"}
            </div>
          );
        })}
      </div>

      {/* Divider between slot and stat breakdowns */}
      <div className="-my-1 -mx-3 border-t border-amber-500/50" />

      {/* Breakdown by Stat */}
      <table className="w-full text-base border-collapse">
        <thead>
          <tr className="text-sm text-slate-400 border-b border-white/5">
            <th className="text-left font-normal pb-2 w-0">
              {t.ui("accountData.breakdownByStat")}
            </th>
            <th className="text-right font-normal pb-2 w-1/2">
              {t.ui("accountData.valOverScore")}
            </th>
            <th className="text-right font-normal pb-2 w-1/2">
              {t.ui("accountData.score")}
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(artifactScore.substatScore.statScores)
            .filter(([, data]) => data.subValue > 0 && data.weight > 0)
            .sort((a, b) => {
              if (b[1].weight !== a[1].weight) {
                return b[1].weight - a[1].weight;
              }
              return a[0].localeCompare(b[0]);
            })
            .map(([key, data]) => {
              const formatValue = (val: number) =>
                fmtStat(key, val, false, true);

              return (
                <tr key={key}>
                  <td className="py-1 text-gray-300 whitespace-nowrap">
                    {t.statShort(key)}
                  </td>

                  {/* Val / Count Col */}
                  <td className="text-right py-1 font-mono text-gray-400 whitespace-nowrap">
                    {data.subValue > 0 ? (
                      <>
                        <span className="text-gray-300">
                          {formatValue(data.subValue)}
                        </span>
                        <span className="text-muted-foreground mx-1.5">/</span>
                        <span className="text-sky-300">
                          {data.subCount.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>

                  {/* Score + Weight Col */}
                  <td className="text-right py-1 font-mono whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">
                        {data.weight.toFixed(0)}
                      </span>
                      {data.subScore > 0 ? (
                        <span className="text-amber-200">
                          {(data.subScore * normalizer).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
