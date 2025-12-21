import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface StatDisplayProps {
  statKey: string;
  value: number;
  isMain?: boolean;
}

export const StatDisplay = ({
  statKey,
  value,
  isMain = false,
}: StatDisplayProps) => {
  const { t } = useLanguage();
  const isPercent =
    statKey.endsWith("%") ||
    statKey === "cr" ||
    statKey === "cd" ||
    statKey === "er";
  const displayValue = isPercent ? `${value.toFixed(1)}%` : Math.round(value);

  return (
    <div
      className={cn(
        "flex justify-between items-center text-[11px]",
        isMain ? "font-bold text-amber-200" : "text-muted-foreground",
      )}
    >
      <span>{t.statShort(statKey)}</span>
      <span>{displayValue}</span>
    </div>
  );
};
