import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactData, SubStat } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import { fmtStat } from "@/lib/team-comp/displayFormatters";
import { cn, getRarityColor } from "@/lib/utils";
import { SlotProgressIndicator } from "./SlotProgressIndicator";

interface StatDisplayProps {
  artifact: ArtifactData;
  scoreResult?: ArtifactScoreResult;
  slotSubScore?: number;
  slotMaxSubScore?: number;
  isMainStatWrong?: boolean;
  watermarkSrc?: string;
}

export function StatDisplay({
  artifact,
  scoreResult,
  slotSubScore,
  slotMaxSubScore,
  isMainStatWrong,
  watermarkSrc,
  compact = false,
}: StatDisplayProps & { compact?: boolean }) {
  const { t } = useLanguage();

  const renderStatLine = (
    statKey: string,
    value: number | undefined,
    weight = 0
  ) => {
    if (value == null) return null;
    const displayValue = fmtStat(statKey, value, false, true);

    const statName = compact ? t.statMin(statKey) : t.statShort(statKey);

    return (
      <div
        key={statKey}
        className={cn(
          "relative z-10 flex justify-between items-center",
          compact ? "text-xs" : "text-sm",
          weight > 0 ? "text-foreground" : "text-gray-400"
        )}
      >
        <span className="flex-1 whitespace-nowrap overflow-hidden">
          {statName}
        </span>
        <span className={cn("flex-shrink-0", compact && "text-xs")}>
          {displayValue}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {" "}
      {/* Main Stat + Level */}
      <div className="flex items-center justify-between mb-2">
        <div
          className={cn(
            "font-bold flex-1",
            isMainStatWrong ? "text-amber-100/70" : "text-amber-100",
            compact ? "text-xs" : "text-base"
          )}
        >
          {compact
            ? t.statMin(artifact.mainStatKey)
            : t.statShort(artifact.mainStatKey)}
        </div>
        <div
          className={cn(
            "rounded bg-black/40 font-mono",
            compact ? "text-[10px]" : "text-xs px-1",
            getRarityColor(artifact.rarity, "text")
          )}
        >
          +{artifact.level}
        </div>
      </div>
      {/* Substats */}
      <div className="relative overflow-hidden space-y-0.5">
        {watermarkSrc && (
          <img
            src={watermarkSrc}
            alt=""
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 m-auto select-none brightness-[0.3] blur-[1px]",
              compact ? "w-16 h-16" : "w-20 h-20"
            )}
          />
        )}
        {Object.entries(artifact.substats ?? {}).map(([key, val]) => {
          const weight =
            scoreResult?.substatScore.statScores[key as SubStat]?.weight || 0;
          // If no scoreResult (inventory), treat as weight=1 (active/visible)
          return renderStatLine(key, val, scoreResult ? weight : 1);
        })}
        {/* Unactivated substats */}
        {Object.entries(artifact.unactivatedSubstats ?? {}).map(([key, val]) =>
          val != null ? renderStatLine(key, val, 0) : null
        )}
        {/* Add empty rows to ensure consistent height (4 substat rows) */}
        {Array.from({
          length:
            4 -
            Object.keys(artifact.substats ?? {}).length -
            Object.keys(artifact.unactivatedSubstats ?? {}).length,
        }).map((_, i) => (
          <div key={`empty-${i}`} className={compact ? "text-xs" : "text-sm"}>
            &nbsp;
          </div>
        ))}
      </div>
      {/* Progress Indicator */}
      {scoreResult && slotMaxSubScore !== undefined && slotMaxSubScore > 0 && (
        <SlotProgressIndicator
          slot={artifact.slotKey}
          actualScore={slotSubScore ?? 0}
          maxScore={slotMaxSubScore}
          isMainStatWrong={isMainStatWrong ?? false}
        />
      )}
    </div>
  );
}
