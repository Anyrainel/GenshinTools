import { useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { getNextPullBranches } from "@/domain/combat/analyzer/nextPulls";
import type {
  AnalyzerCharConfig,
  AnalyzerResult,
  TeamInvestment,
} from "@/domain/combat/analyzer/types";
import { fmtDamage } from "@/domain/team/displayFormatter";
import { AnalyzerChart } from "./AnalyzerChart";
import { AnalyzerSequence } from "./AnalyzerSequence";
import { AnalyzerTable } from "./AnalyzerTable";

interface AnalyzerResultCardProps {
  charConfigs: AnalyzerCharConfig[];
  isComputing: boolean;
  result: AnalyzerResult | null;
  progress: { overallProgress: number; phase: string } | null;
  error: Error | null;
}

export function AnalyzerResultCard({
  charConfigs,
  isComputing,
  result,
  progress,
  error,
}: AnalyzerResultCardProps) {
  const { t } = useLanguage();
  const [view, setView] = useState("path");
  const [budget, setBudget] = useState(3);
  const [pathView, setPathView] = useState("table");
  const branches = useMemo(
    () => (result ? getNextPullBranches(result, charConfigs, budget) : []),
    [result, charConfigs, budget]
  );
  const baseline = result?.sequence[0];
  if (!isComputing && !result && !error) return null;
  const describe = (before: TeamInvestment, after: TeamInvestment) =>
    Object.keys(after)
      .flatMap((id) => {
        const from = before[id],
          to = after[id];
        if (!from) return [];
        if (from.constellation !== to.constellation)
          return [
            `${t.character(id)} ${t.format("common.constellationFormat", to.constellation)}`,
          ];
        if (from.weaponId !== to.weaponId || from.refinement !== to.refinement)
          return [
            `${t.character(id)} · ${t.weapon(to.weaponId)} ${t.format("common.refinementFormat", to.refinement)}`,
          ];
        return [];
      })
      .join(" / ");
  return (
    <div className="space-y-3">
      {isComputing && progress && (
        <Progress
          value={Math.round(progress.overallProgress * 100)}
          className="h-2"
        />
      )}
      {error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {error.message}
        </p>
      )}
      {result && baseline ? (
        <>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="path">
                {t.ui("teamComp.investmentFullPath")}
              </TabsTrigger>
              <TabsTrigger value="next">
                {t.ui("teamComp.investmentNextPulls")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "path" ? (
            <>
              <AnalyzerChart
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
              <Tabs value={pathView} onValueChange={setPathView}>
                <TabsList>
                  <TabsTrigger value="table">
                    {t.ui("teamComp.analyzerTable")}
                  </TabsTrigger>
                  <TabsTrigger value="sequence">
                    {t.ui("teamComp.analyzerSequence")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="min-w-0 overflow-x-auto">
                {pathView === "table" ? (
                  <AnalyzerTable
                    result={result}
                    charIds={charConfigs.map((c) => c.charId)}
                  />
                ) : (
                  <AnalyzerSequence
                    result={result}
                    charIds={charConfigs.map((c) => c.charId)}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  {t.ui("teamComp.investmentBudget")}
                </span>
                <Select
                  value={String(budget)}
                  onValueChange={(value) => setBudget(Number(value))}
                >
                  <SelectTrigger
                    className="h-8 w-24"
                    aria-label={t.ui("teamComp.investmentBudget")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      {
                        length: Math.max(3, result.dag.maxJin - baseline.jin),
                      },
                      (_, i) => i + 1
                    ).map((copies) => (
                      <SelectItem key={copies} value={String(copies)}>
                        {copies}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ol className="space-y-2">
                {branches.map((branch, index) => {
                  const last = branch.steps[branch.steps.length - 1];
                  return (
                    <li
                      key={branch.steps[0].id}
                      className="space-y-2 rounded-md border border-border p-3"
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span className="font-semibold">
                          #{index + 1}{" "}
                          {describe(
                            baseline.allocation,
                            branch.steps[0].allocation
                          )}
                        </span>
                        <span className="font-semibold tabular-nums text-primary">
                          {branch.gainPct >= 0 ? "+" : ""}
                          {branch.gainPct.toFixed(1)}% ·{" "}
                          {fmtDamage(last.damage)}
                        </span>
                      </div>
                      <ol className="list-inside list-decimal space-y-1 text-xs">
                        {branch.steps.map((step, i) => (
                          <li key={step.id}>
                            {describe(
                              i
                                ? branch.steps[i - 1].allocation
                                : baseline.allocation,
                              step.allocation
                            )}
                          </li>
                        ))}
                      </ol>
                      {branch.steps.length < budget && (
                        <p className="text-xs text-muted-foreground">
                          {t.format(
                            "teamComp.investmentAvailablePulls",
                            branch.steps.length,
                            budget
                          )}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
              {!branches.length && (
                <p className="text-sm text-muted-foreground">
                  {t.ui("teamComp.analyzerNoSteps")}
                </p>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
