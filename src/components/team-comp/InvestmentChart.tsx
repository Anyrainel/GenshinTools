import { useLanguage } from "@/contexts/LanguageContext";
import type { InvestmentResult } from "@/lib/team-comp/investmentOptimizer";
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
  valueMode: "abs" | "pct";
}

export function InvestmentChart({ result, valueMode }: InvestmentChartProps) {
  const { t } = useLanguage();

  const chartData = useMemo(() => {
    return result.sequence.map((step) => ({
      jin: step.jin,
      damage: Math.round(step.damage),
      pct: +(100 + step.gainVsBaselinePct).toFixed(1),
    }));
  }, [result.sequence]);

  const dataKey = valueMode === "abs" ? "damage" : "pct";
  const yLabel =
    valueMode === "abs"
      ? t.ui("buildCard.autoTuneDamageRatio")
      : t.ui("teamComp.investPctGain");
  const jinLabel = t.ui("teamComp.investJin");

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="jin"
            label={{
              value: jinLabel,
              position: "insideBottomRight",
              offset: -5,
            }}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11 },
            }}
            tickFormatter={(v: number) =>
              valueMode === "abs"
                ? v >= 1000
                  ? `${(v / 1000).toFixed(0)}K`
                  : String(v)
                : `${v}%`
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              valueMode === "abs" ? value.toLocaleString() : `${value}%`,
              yLabel,
            ]}
            labelFormatter={(label: number) => `${jinLabel} ${label}`}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
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
