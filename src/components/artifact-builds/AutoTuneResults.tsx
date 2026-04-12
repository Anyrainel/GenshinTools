import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SubStat } from "@/data/types";
import type {
  AutoTuneOutput,
  ComboBreakdown,
  TeamBreakdown,
} from "@/lib/account-data/scoring/pipeline";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

// ── Exported sub-components for reuse (e.g., batch AutoTune view) ──

export { SubstatPills, MainStatColumn, ComboTable };

// Color mapping for stat categories
const STAT_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  cr: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  cd: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  "atk%": {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    border: "border-orange-500/30",
  },
  atk: {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    border: "border-orange-500/30",
  },
  "hp%": {
    bg: "bg-green-500/15",
    text: "text-green-400",
    border: "border-green-500/30",
  },
  hp: {
    bg: "bg-green-500/15",
    text: "text-green-400",
    border: "border-green-500/30",
  },
  "def%": {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  def: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  em: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  er: {
    bg: "bg-sky-500/15",
    text: "text-sky-400",
    border: "border-sky-500/30",
  },
};

const ELEMENTAL_STATS = new Set([
  "pyro%",
  "hydro%",
  "cryo%",
  "electro%",
  "anemo%",
  "geo%",
  "dendro%",
  "phys%",
]);

function getStatStyle(stat: string) {
  if (STAT_COLORS[stat]) return STAT_COLORS[stat];
  if (ELEMENTAL_STATS.has(stat)) {
    return {
      bg: "bg-purple-500/15",
      text: "text-purple-400",
      border: "border-purple-500/30",
    };
  }
  if (stat === "heal%") {
    return {
      bg: "bg-green-500/15",
      text: "text-green-400",
      border: "border-green-500/30",
    };
  }
  return {
    bg: "bg-muted/50",
    text: "text-foreground",
    border: "border-border/30",
  };
}

interface AutoTuneResultsProps {
  result: AutoTuneOutput;
}

export function AutoTuneResults({ result }: AutoTuneResultsProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      {/* ER Warning Banner */}
      <div className="flex items-start gap-2 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-amber-200">
          {t.ui("buildCard.autoTuneErWarning")}
        </span>
      </div>

      {/* Main Stat Weights */}
      <section>
        <h4 className="text-sm font-medium mb-2">
          {t.ui("buildCard.autoTuneMainStats")}
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <MainStatColumn
            label={t.slot("sands")}
            weights={result.sandsWeights}
          />
          <MainStatColumn
            label={t.slot("goblet")}
            weights={result.gobletWeights}
          />
          <MainStatColumn
            label={t.slot("circlet")}
            weights={result.circletWeights}
          />
        </div>
      </section>

      {/* Substat Weights */}
      <section>
        <h4 className="text-sm font-medium mb-2">
          {t.ui("buildCard.autoTuneSubstats")}
        </h4>
        <SubstatPills substats={result.substats} />
      </section>

      {/* Per-Team Breakdown */}
      {result.teamBreakdowns.length > 0 && (
        <section>
          <h4 className="text-sm font-medium mb-2">
            {t.ui("buildCard.autoTuneBreakdown")}
          </h4>
          <div className="space-y-1">
            {result.teamBreakdowns.map((tb) => (
              <TeamBreakdownSection key={tb.teamIndex} breakdown={tb} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MainStatColumn({
  label,
  weights,
}: {
  label: string;
  weights: { stat: string; weight: number }[];
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded bg-muted/30 px-2 py-1.5">
      <span className="text-xs font-medium block mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {weights.map(({ stat, weight }) => {
          const style = getStatStyle(stat);
          return (
            <span
              key={stat}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                style.bg,
                style.border
              )}
            >
              <span className="text-xs font-medium">{t.statShort(stat)}</span>
              <span className="text-xs font-mono font-bold">{weight}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SubstatPills({
  substats,
}: {
  substats: { stat: string; weight: number }[];
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-1.5">
      {substats.map(({ stat, weight }) => {
        const style = getStatStyle(stat);
        return (
          <div
            key={stat}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
              style.bg,
              style.border
            )}
          >
            <span className="text-xs font-medium">{t.statShort(stat)}</span>
            <span className="text-xs font-mono font-bold">
              {Math.round(weight)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Format roll allocation as compact text: "cr 8 · cd 12 · atk% 6" */
function formatRolls(
  allocation: Record<SubStat, number>,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  return Object.entries(allocation)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([stat, rolls]) => `${t.statShort(stat as SubStat)} ${Math.round(rolls)}`
    )
    .join(" · ");
}

/** Reusable combo table: header + qualifying combo rows */
function ComboTable({
  combos,
}: {
  combos: ComboBreakdown[];
}) {
  const { t } = useLanguage();
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground border-b border-border/20">
          <th className="text-left py-1 font-medium">
            {t.slot("sands")} / {t.slot("goblet")} / {t.slot("circlet")}
          </th>
          <th className="text-right py-1 font-medium w-16">
            {t.ui("common.damage")}
          </th>
          <th className="text-left py-1 pl-3 font-medium">
            {t.ui("buildCard.autoTuneIdealRolls")}
          </th>
        </tr>
      </thead>
      <tbody>
        {combos.map((combo, i) => (
          <ComboRow key={i} combo={combo} />
        ))}
      </tbody>
    </table>
  );
}

function TeamBreakdownSection({
  breakdown,
}: {
  breakdown: TeamBreakdown;
}) {
  const [expanded, setExpanded] = useState(false);

  // Filter to ≥96% combos
  const qualifying = breakdown.combos.filter((c) => c.damageRatio >= 0.96);
  const qualifyingCount = qualifying.length;

  return (
    <div className="border border-border/30 rounded">
      <button
        type="button"
        className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{breakdown.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {qualifyingCount}
        </span>
      </button>
      {expanded && (
        <div className="px-2 pb-2">
          <ComboTable combos={qualifying} />
        </div>
      )}
    </div>
  );
}

function ComboRow({
  combo,
}: {
  combo: ComboBreakdown;
}) {
  const { t } = useLanguage();
  return (
    <tr className="border-b border-border/10 last:border-0">
      <td className="py-1 whitespace-nowrap">
        {t.statShort(combo.mainStats.sands)} /{" "}
        {t.statShort(combo.mainStats.goblet)} /{" "}
        {t.statShort(combo.mainStats.circlet)}
      </td>
      <td
        className={cn(
          "py-1 text-right font-mono whitespace-nowrap",
          combo.damageRatio >= 0.99
            ? "text-green-600"
            : combo.damageRatio >= 0.98
              ? "text-green-500"
              : combo.damageRatio >= 0.97
                ? "text-green-400"
                : "text-green-300"
        )}
      >
        {(combo.damageRatio * 100).toFixed(1)}%
        {combo.lopsided && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-red-400 ml-0.5 cursor-help">(-2)</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              {t.ui("buildCard.autoTuneLopsided")}
            </TooltipContent>
          </Tooltip>
        )}
      </td>
      <td className="py-1 pl-3 text-muted-foreground">
        {formatRolls(combo.rollAllocation, t)}
      </td>
    </tr>
  );
}
