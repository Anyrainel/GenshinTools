import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById, charactersById } from "@/data/constants";
import { allSlots } from "@/data/types";
import {
  type BuildEvaluation,
  type EvalBuild,
  type SlotEvaluation,
  getArchetypeLabel,
  getBarColor,
  getTier,
} from "@/lib/account-data/buildEvaluation";
import { cn, getAssetUrl } from "@/lib/utils";
import { Clock, Crown, Wine } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

// Slot label icons for sands/goblet/circlet (compact alternative to text)
const slotIcons = {
  sands: Clock,
  goblet: Wine,
  circlet: Crown,
} as const;

/**
 * Check if a slot's artifact is "off-set" (not part of the required sets).
 * For 4pc: artifact set !== evalBuild.artifactSet
 * For 2+2: artifact set not in either half-set's IDs
 */
function isOffSetArtifact(
  slotEval: SlotEvaluation,
  evalBuild: EvalBuild
): boolean {
  if (!slotEval.artifact) return false;
  const artSet = slotEval.artifact.setKey;
  if (evalBuild.composition === "2+2") {
    const hs1 = evalBuild.halfSet1SetIds ?? [];
    const hs2 = evalBuild.halfSet2SetIds ?? [];
    return !hs1.includes(artSet) && !hs2.includes(artSet);
  }
  return artSet !== evalBuild.artifactSet;
}

interface BuildEvaluationCardProps {
  evaluation: BuildEvaluation;
}

function BuildEvaluationCardComponent({
  evaluation,
}: BuildEvaluationCardProps) {
  const { t } = useLanguage();
  const { evalBuild, slots, completeness } = evaluation;
  const tier = getTier(completeness);
  const pct = Math.round(completeness * 100);

  const archetypeLabel = getArchetypeLabel(evalBuild, t);

  const mainStatSlots = (["sands", "goblet", "circlet"] as const).filter(
    (slot) => evalBuild.mainStats[slot]?.length > 0
  );

  return (
    <div className="bg-gradient-card border border-border/50 rounded-lg overflow-hidden flex flex-col relative">
      {/* Top-edge progress bar */}
      <div className="h-1 bg-black/30">
        <div
          className={cn("h-full transition-all", getBarColor(completeness))}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Header: composition + archetype + avatars + grade */}
      <div className="flex items-center gap-1.5 2xl:gap-2 px-2.5 2xl:px-3 pt-1.5 2xl:pt-2 pb-0.5 2xl:pb-1">
        <span className="text-base 2xl:text-lg font-bold text-foreground truncate">
          {archetypeLabel}
        </span>

        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          {evalBuild.characterIds.map((charId) => {
            const charInfo = charactersById[charId];
            if (!charInfo) return null;
            return (
              <Tooltip key={charId}>
                <TooltipTrigger asChild>
                  <Link
                    to={`/artifact-filter?tab=configure&char=${charId}`}
                    className="hover:ring-1 hover:ring-white/40 rounded-full transition-shadow"
                  >
                    <img
                      src={getAssetUrl(charInfo.imagePath)}
                      alt={t.character(charId)}
                      className="w-5 h-5 2xl:w-6 2xl:h-6 rounded-full bg-black/30 object-cover"
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="text-xs bg-card/90 backdrop-blur-sm"
                >
                  {t.character(charId)}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <span
          className={cn(
            "text-lg 2xl:text-xl font-black tabular-nums leading-none shrink-0 pl-1.5",
            tier.text
          )}
        >
          {pct}%
        </span>
      </div>

      {/* Main stats row — icons instead of text labels */}
      <div className="px-2.5 2xl:px-3 flex items-center gap-2 text-[11px] 2xl:text-xs text-foreground">
        {mainStatSlots.map((slot, i) => {
          const Icon = slotIcons[slot];
          return (
            <span
              key={slot}
              className="inline-flex items-center gap-0.5 whitespace-nowrap"
            >
              {i > 0 && <span className="text-muted-foreground mr-1.5">·</span>}
              <Icon className="w-3 h-3 2xl:w-3.5 2xl:h-3.5 text-foreground/35 shrink-0" />
              {evalBuild.mainStats[slot].map((s) => t.statShort(s)).join("/")}
            </span>
          );
        })}
      </div>

      {/* Substats row */}
      <div className="px-2.5 2xl:px-3 pt-0.5 2xl:pt-1 pb-1.5 2xl:pb-2 flex flex-wrap gap-0.5 2xl:gap-1">
        {evalBuild.sortedSubstats.map(({ stat, weight }) => (
          <span
            key={stat}
            className={cn(
              "inline-flex items-center px-1 2xl:px-1.5 py-0 rounded text-[11px] 2xl:text-xs font-medium leading-relaxed",
              weight >= 100
                ? "bg-amber-500/20 text-amber-300"
                : weight >= 75
                  ? "bg-sky-500/15 text-sky-300"
                  : "bg-white/5 text-foreground/70"
            )}
          >
            {t.stat(stat)}
          </span>
        ))}
      </div>

      {/* Per-slot breakdown — big icons, tight layout */}
      <div className="flex items-end justify-evenly px-1 2xl:px-2 pb-1.5 2xl:pb-2 mt-auto">
        {allSlots.map((slot) => {
          const slotEval = slots[slot];
          const slotPct =
            slotEval.maxScore > 0 ? slotEval.score / slotEval.maxScore : 0;
          const slotPctRounded = Math.min(Math.round(slotPct * 100), 100);
          const hasArtifact = slotEval.artifact !== null;
          const isOffSet =
            hasArtifact &&
            slotEval.isFlexSlot &&
            isOffSetArtifact(slotEval, evalBuild);

          return (
            <div key={slot} className="flex flex-col items-center gap-0.5">
              {hasArtifact ? (
                <ArtifactDataHoverCard
                  artifact={slotEval.artifact!}
                  slot={slot}
                  side="top"
                >
                  <ItemIcon
                    imagePath={
                      artifactsById[slotEval.artifact!.setKey]?.imagePaths[
                        slot
                      ] || ""
                    }
                    rarity={
                      artifactsById[slotEval.artifact!.setKey]?.rarity ?? 5
                    }
                    size="sm"
                    className={cn(isOffSet && "ring-1 ring-amber-500/60")}
                  />
                </ArtifactDataHoverCard>
              ) : (
                <div className="w-12 h-12 rounded border border-dashed border-border flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">--</span>
                </div>
              )}

              {/* Mini bar */}
              <div className="w-12 h-1 bg-black/40 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    hasArtifact ? getBarColor(slotPct) : "bg-transparent"
                  )}
                  style={{ width: `${slotPctRounded}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-xs 2xl:text-sm font-mono font-semibold leading-none",
                  hasArtifact ? getTier(slotPct).text : "text-muted-foreground"
                )}
              >
                {hasArtifact ? `${slotPctRounded}%` : "--"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const BuildEvaluationCard = memo(BuildEvaluationCardComponent);
