import { ArrowUpRight } from "lucide-react";
import { getValueColor, VALUE_COLORS } from "@/components/shared/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StatKey } from "@/data/enums";
import { fmtStat } from "@/lib/team-comp/displayFormatter";
import { cn } from "@/lib/utils";

export type StatEntryData = {
  key: string;
  value: number;
  inputKey?: StatKey;
  cap?: number;
  /** When present, value varies across on-field contexts (combo mode). */
  minValue?: number;
  maxValue?: number;
};

/**
 * Renders a single stat entry: stat name, optional inputKey arrow, value, and
 * optional cap. Accepts className for size overrides (default: text-xs).
 */
export function StatEntryRow({
  entry,
  className,
}: {
  entry: StatEntryData;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs bg-black/5 px-1 rounded",
        className
      )}
    >
      <span className="font-semibold text-foreground/80">
        {t.statShort(entry.key as StatKey)}
      </span>
      {entry.inputKey && (
        <span className="flex items-center text-muted-foreground text-[10px]">
          <ArrowUpRight className="w-3 h-3 opacity-70" />
          {t.statShort(entry.inputKey)}
        </span>
      )}
      {entry.minValue !== undefined && entry.maxValue !== undefined ? (
        <span
          className={cn("font-mono font-bold", getValueColor(entry.minValue))}
        >
          {fmtStat(entry.key as StatKey, entry.minValue, true)}~
          {fmtStat(entry.key as StatKey, entry.maxValue, true)}
        </span>
      ) : (
        <span className={cn("font-mono font-bold", getValueColor(entry.value))}>
          {fmtStat(entry.key as StatKey, entry.value, true)}
        </span>
      )}
      {entry.cap !== undefined && (
        <span
          className={cn("font-mono font-bold text-[10px]", VALUE_COLORS.cap)}
        >
          / {fmtStat(entry.key as StatKey, entry.cap)}
        </span>
      )}
    </div>
  );
}
