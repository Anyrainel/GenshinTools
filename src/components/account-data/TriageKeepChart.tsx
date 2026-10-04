import { useId } from "react";
import { getTriageTierColor } from "@/components/shared/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  TriageKeepReason,
  TriageStatistics,
} from "@/lib/account-data/triage/types";
import { cn } from "@/lib/utils";

export function TriageKeepChart({
  counts,
}: {
  counts: TriageStatistics["keepReasons"];
}) {
  const { t } = useLanguage();
  const titleId = useId();
  const slices: { key: TriageKeepReason; label: string; className: string }[] =
    [
      {
        key: "prime",
        label: t.ui("triage.help.primeKeeps"),
        className: getTriageTierColor("prime", "text"),
      },
      {
        key: "solid",
        label: t.ui("triage.help.solidKeeps"),
        className: getTriageTierColor("solid", "text"),
      },
      {
        key: "filler",
        label: t.ui("triage.help.fillerKeeps"),
        className: getTriageTierColor("filler", "text"),
      },
      {
        key: "flex",
        label: t.ui("triage.help.flexKeeps"),
        className: "text-[hsl(var(--chart-2))]",
      },
      {
        key: "other",
        label: t.ui("triage.help.otherKeeps"),
        className: "text-muted-foreground",
      },
    ];
  const total = slices.reduce((sum, slice) => sum + counts[slice.key], 0);
  if (total === 0)
    return <p className="text-sm">{t.ui("triage.help.noKeeps")}</p>;
  let start = -Math.PI / 2;
  return (
    <div className="space-y-3 text-sm">
      <p>{t.ui("triage.help.keepTotal").replace("{0}", String(total))}</p>
      <p className="text-muted-foreground">
        {t.ui("triage.help.keepReasonsDetail")}
      </p>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <svg
          viewBox="0 0 220 220"
          className="h-48 w-48 shrink-0"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{t.ui("triage.help.keepsTab")}</title>
          {slices.map((slice) => {
            const count = counts[slice.key];
            if (count === 0) return null;
            const angle = (count / total) * Math.PI * 2;
            const end = start + angle;
            const path = `M 110 110 L ${110 + 100 * Math.cos(start)} ${110 + 100 * Math.sin(start)} A 100 100 0 ${angle > Math.PI ? 1 : 0} 1 ${110 + 100 * Math.cos(end)} ${110 + 100 * Math.sin(end)} Z`;
            start = end;
            return count === total ? (
              <circle
                key={slice.key}
                cx={110}
                cy={110}
                r={100}
                fill="currentColor"
                className={slice.className}
              >
                <title>
                  {slice.label}: {count}
                </title>
              </circle>
            ) : (
              <path
                key={slice.key}
                d={path}
                fill="currentColor"
                className={slice.className}
                stroke="hsl(var(--background))"
                strokeWidth={1}
              >
                <title>
                  {slice.label}: {count}
                </title>
              </path>
            );
          })}
        </svg>
        <dl className="w-full space-y-2">
          {slices.map((slice) => (
            <div
              key={slice.key}
              className="flex items-center justify-between gap-3"
            >
              <dt className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-3 w-3 shrink-0 rounded-sm bg-current",
                    slice.className
                  )}
                  aria-hidden="true"
                />
                {slice.label}
              </dt>
              <dd className="tabular-nums whitespace-nowrap">
                {counts[slice.key]} (
                {((counts[slice.key] / total) * 100).toFixed(1)}%)
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
