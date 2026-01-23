import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactData } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import { cn, getRarityColor } from "@/lib/utils";
import { SlotProgressIndicator } from "./SlotProgressIndicator";

interface StatDisplayProps {
  artifact: ArtifactData;
  scoreResult?: ArtifactScoreResult;
  slotSubScore?: number;
  slotMaxSubScore?: number;
  isMainStatWrong?: boolean;
}

export function StatDisplay({
  artifact,
  scoreResult,
  slotSubScore,
  slotMaxSubScore,
  isMainStatWrong,
  compact = false,
}: StatDisplayProps & { compact?: boolean }) {
  const { t } = useLanguage();

  const renderStatLine = (statKey: string, value: number, weight = 0) => {
    const isPercent =
      statKey.endsWith("%") ||
      statKey === "cr" ||
      statKey === "cd" ||
      statKey === "er";
    const displayValue = isPercent ? `${value.toFixed(1)}%` : Math.round(value);

    const statName = compact ? t.statMin(statKey) : t.statShort(statKey);

    return (
      <div
        key={statKey}
        className={cn(
          "flex justify-between items-center",
          compact ? "text-xs" : "text-sm",
          weight > 0 ? "text-gray-200" : "text-muted-foreground"
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

  const mainStatWeight =
    scoreResult?.statScores[artifact.mainStatKey]?.weight || 0;

  return (
    <div className="flex flex-col">
      {" "}
      {/* Main Stat + Level */}
      <div className="flex items-center justify-between mb-2">
        <div
          className={cn(
            "font-bold truncate flex-1",
            compact ? "text-sm" : "text-base",
            // If scoreResult is provided, dim unweighted stats. If not (inventory), show default color.
            scoreResult
              ? mainStatWeight > 0
                ? "text-amber-100"
                : "text-amber-100/50"
              : "text-amber-100"
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
      <div className="space-y-0.5">
        {Object.entries(artifact.substats).map(([key, val]) => {
          const weight = scoreResult?.statScores[key]?.weight || 0;
          // If no scoreResult (inventory), treat as weight=1 (active/visible)
          return renderStatLine(key, val, scoreResult ? weight : 1);
        })}
        {/* Add empty rows to ensure consistent height (4 substat rows) */}
        {Array.from({ length: 4 - Object.keys(artifact.substats).length }).map(
          (_, i) => (
            <div key={`empty-${i}`} className={compact ? "text-xs" : "text-sm"}>
              &nbsp;
            </div>
          )
        )}
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
