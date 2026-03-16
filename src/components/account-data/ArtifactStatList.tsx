import { fmtStat } from "@/components/team-comp/displayFormatters";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactData, Rarity, SubStat } from "@/data/types";
import {
  getMainStatValueAtLevel,
  getSubstatAvgRoll,
} from "@/lib/account-data/scoring/utils";
import { cn, getRarityColor } from "@/lib/utils";

function getRollCount(statKey: SubStat, value: number, rarity: Rarity): number {
  const r = rarity === 4 || rarity === 5 ? rarity : 5;
  const avgRollValue = getSubstatAvgRoll(statKey, r as 4 | 5);
  if (!avgRollValue) return 0;
  return value / avgRollValue;
}

interface ArtifactStatListProps {
  artifact: ArtifactData;
  compact?: boolean;
}

/**
 * Displays main stat + substats with roll count badges.
 * Extracted from ArtifactDataHoverCard for reuse without the full card chrome.
 */
export function ArtifactStatList({
  artifact,
  compact = false,
}: ArtifactStatListProps) {
  const { t } = useLanguage();

  const renderStatLine = (statKey: SubStat, value: number | undefined) => {
    if (value == null) return null;
    const displayValue = fmtStat(statKey, value, false, true);
    const rollCount = getRollCount(statKey, value, artifact.rarity);
    return (
      <div
        key={statKey}
        className="flex justify-between items-center gap-2 text-sm text-gray-200"
      >
        <span className="flex items-center gap-1.5 flex-1 whitespace-nowrap overflow-hidden">
          <span>{compact ? t.statMin(statKey) : t.statShort(statKey)}</span>
          <span className="text-xs px-1 py-0.5 rounded bg-white/10 text-amber-200/80 font-mono tabular-nums">
            {rollCount.toFixed(1)}
          </span>
        </span>
        <span className="flex-shrink-0 font-mono">{displayValue}</span>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            className={cn(
              "font-bold truncate text-amber-100",
              compact ? "text-sm" : "text-base"
            )}
          >
            {compact
              ? t.statMin(artifact.mainStatKey)
              : t.statShort(artifact.mainStatKey)}
          </span>
          <span
            className={cn(
              "text-xs px-1 py-0.5 rounded bg-black/40 font-mono tabular-nums shrink-0",
              getRarityColor(artifact.rarity, "text")
            )}
          >
            +{artifact.level}
          </span>
        </div>
        <span
          className={cn(
            "font-bold font-mono text-amber-100 shrink-0",
            compact ? "text-sm" : "text-base"
          )}
        >
          {fmtStat(
            artifact.mainStatKey,
            getMainStatValueAtLevel(
              artifact.mainStatKey,
              artifact.rarity,
              artifact.level
            ),
            false,
            true
          )}
        </span>
      </div>
      <div className="space-y-0.5">
        {Object.entries(artifact.substats ?? {}).map(([key, val]) =>
          renderStatLine(key as SubStat, val)
        )}
        {Object.entries(artifact.unactivatedSubstats ?? {}).map(([key, val]) =>
          val != null ? (
            <div
              key={key}
              className="flex justify-between items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5 flex-1 whitespace-nowrap overflow-hidden">
                {compact
                  ? t.statMin(key as SubStat)
                  : t.statShort(key as SubStat)}
              </span>
              <span className="flex-shrink-0 font-mono">
                {fmtStat(key as SubStat, val, false, true)}
              </span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
