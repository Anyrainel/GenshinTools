import { ArtifactData } from "@/data/types";
import { ArtifactScoreResult } from "@/lib/artifactScore";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";

interface StatDisplayProps {
  artifact: ArtifactData;
  scoreResult?: ArtifactScoreResult;
}

export const StatDisplay = ({ artifact, scoreResult }: StatDisplayProps) => {
  const { t } = useLanguage();

  const renderStatLine = (
    statKey: string,
    value: number,
    weight: number = 0,
  ) => {
    const isPercent =
      statKey.endsWith("%") ||
      statKey === "cr" ||
      statKey === "cd" ||
      statKey === "er";
    const displayValue = isPercent ? `${value.toFixed(1)}%` : Math.round(value);

    return (
      <div
        key={statKey}
        className={cn(
          "flex justify-between items-center text-[11px]",
          weight > 0 ? "text-gray-200" : "text-muted-foreground",
        )}
      >
        <span>{t.statShort(statKey)}</span>
        <span>{displayValue}</span>
      </div>
    );
  };

  const mainStatWeight =
    scoreResult?.statScores[artifact.mainStatKey]?.weight || 0;

  return (
    <div className={cn("flex flex-col")}>
      {/* Main Stat + Level */}
      <div className="flex items-center justify-between mb-2">
        <div
          className={cn(
            "text-xs font-bold truncate flex-1",
            // If scoreResult is provided, dim unweighted stats. If not (inventory), show default color.
            scoreResult
              ? mainStatWeight > 0
                ? "text-amber-100"
                : "text-amber-100/50"
              : "text-amber-100",
          )}
          title={t.stat(artifact.mainStatKey)}
        >
          {t.statShort(artifact.mainStatKey)}
        </div>
        <div
          className={cn(
            "text-[10px] px-1 rounded bg-black/40 font-mono",
            THEME.rarity.text[
              artifact.rarity as keyof typeof THEME.rarity.text
            ],
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
      </div>
    </div>
  );
};
