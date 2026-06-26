import { ItemIcon } from "@/components/shared/ItemIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ResourceSetSummary } from "@/lib/account-data/resourceTips";
import { cn } from "@/lib/utils";

function formatGain(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function ResourceSetSummarySection({
  summaries,
}: {
  summaries: ResourceSetSummary[];
}) {
  const { t } = useLanguage();
  if (summaries.length === 0) return null;

  return (
    <section className="border border-border/50 rounded-lg bg-gradient-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">
          {t.ui("evaluation.setSummaryTitle")}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t.ui("evaluation.setSummaryDesc")}
        </p>
      </div>
      <div className="divide-y divide-border/30">
        {summaries.map((summary) => (
          <div
            key={summary.setId}
            className="flex items-center gap-2.5 px-3 py-2 min-w-0"
          >
            <ItemIcon
              artifactSetId={summary.setId}
              slot="flower"
              size="sm"
              className="shrink-0"
            />
            <span className="flex-1 min-w-0 text-sm text-foreground truncate">
              {t.artifact(summary.setId)}
            </span>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {t
                .ui("evaluation.setSummaryCount")
                .replace("{0}", String(summary.count))}
            </span>
            <span
              className={cn(
                "text-sm font-mono font-semibold shrink-0 tabular-nums",
                summary.avgExpectedScoreGain >= 0
                  ? "text-green-400"
                  : "text-muted-foreground"
              )}
            >
              {formatGain(summary.avgExpectedScoreGain)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
