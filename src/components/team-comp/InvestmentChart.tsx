import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type {
  InvestmentResult,
  InvestmentStep,
} from "@/lib/team-comp/investmentOptimizer";
import { getAssetUrl } from "@/lib/utils";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface InvestmentChartProps {
  result: InvestmentResult;
  charIds: string[];
}

export function InvestmentChart({ result, charIds }: InvestmentChartProps) {
  const { t } = useLanguage();

  const chartData = useMemo(() => {
    return result.sequence.map((step, i) => ({
      jin: step.jin,
      pct: +(100 + step.gainVsBaselinePct).toFixed(1),
      _idx: i,
    }));
  }, [result.sequence]);

  const jinLabel = t.ui("teamComp.investJin");
  const damageLabel = t.ui("common.damage");
  const yMax = useMemo(() => {
    const maxPct = Math.max(...chartData.map((d) => d.pct));
    return Math.ceil(maxPct / 100) * 100;
  }, [chartData]);
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = 0; v <= yMax; v += 100) ticks.push(v);
    return ticks;
  }, [yMax]);
  const fmtC = (n: number) => t.format("common.constellationFormat", n);
  const fmtR = (n: number) => t.format("common.refinementFormat", n);

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 30, right: 30, bottom: 25, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="jin"
            label={{
              value: jinLabel,
              position: "insideBottomRight",
              offset: -5,
              dy: 5,
              style: { fontSize: 14 },
            }}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            width={45}
            domain={[0, yMax]}
            ticks={yTicks}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v: number) => `${v}%`}
            label={{
              value: damageLabel,
              position: "top",
              offset: 10,
              style: { fontSize: 14, textAnchor: "start" },
            }}
          />
          <Tooltip
            content={
              <CustomTooltip
                sequence={result.sequence}
                charIds={charIds}
                jinLabel={jinLabel}
                fmtC={fmtC}
                fmtR={fmtR}
                t={t}
              />
            }
            wrapperStyle={{ pointerEvents: "none", zIndex: 50 }}
          />
          <Line
            type="monotone"
            dataKey="pct"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: Recharts tooltip payload type
function CustomTooltip({
  active,
  payload,
  sequence,
  charIds,
  jinLabel,
  fmtC,
  fmtR,
  t,
}: {
  active?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: Recharts payload
  payload?: any[];
  sequence: InvestmentStep[];
  charIds: string[];
  jinLabel: string;
  fmtC: (n: number) => string;
  fmtR: (n: number) => string;
  // biome-ignore lint/suspicious/noExplicitAny: i18n context
  t: any;
}) {
  if (!active || !payload?.length) return null;
  const idx: number = payload[0]?.payload?._idx ?? 0;
  const step = sequence[idx];
  if (!step) return null;

  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md"
      style={{ minWidth: 140 }}
    >
      <div className="font-medium mb-1">
        {step.jin}
        {jinLabel} ({(100 + step.gainVsBaselinePct).toFixed(1)}%)
      </div>
      <div className="font-mono">
        {t.ui("common.damage")}: {Math.round(step.damage).toLocaleString()}
      </div>
      {idx > 0 && (
        <div className="text-emerald-400 font-mono">
          vs {sequence[idx - 1].jin}
          {jinLabel}: +{step.gainVsPrevPct.toFixed(1)}%
        </div>
      )}
      <div className="mt-1.5 space-y-0.5">
        {charIds.map((cid) => {
          const inv = step.allocation[cid];
          if (!inv) return null;
          const char = charactersById[cid];
          return (
            <div key={cid} className="flex items-center gap-1">
              {char && (
                <img
                  src={getAssetUrl(char.imagePath)}
                  alt={cid}
                  className="w-4 h-4 rounded-full"
                  style={{ imageRendering: "auto" }}
                />
              )}
              <span>{t.character(cid)}</span>
              <span className="font-mono ml-auto">
                {fmtC(inv.constellation)}
                {inv.is5StarWeapon ? fmtR(inv.refinement) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
