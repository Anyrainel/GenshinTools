import { BarChart3, Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  OptionButton,
  OptionButtonCell,
  OptionButtonRow,
} from "@/components/ui/option-button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { DEFAULT_CALC_CONTEXT } from "@/lib/dmgcalc/constants";
import type { CalcContext } from "@/lib/dmgcalc/types";
import type {
  AnalyzerCharConfig,
  AnalyzerResult,
} from "@/lib/team-comp/analyzer/types";
import type { Team } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { AnalyzerChart } from "./AnalyzerChart";
import { AnalyzerSequence } from "./AnalyzerSequence";
import { AnalyzerTable } from "./AnalyzerTable";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
  CONTROLS_CLS,
} from "./cardStyles";
import { EnemyInputs, RollQualityInputs } from "./GeneratorControls";

interface AnalyzerResultCardProps {
  team: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  charConfigs: AnalyzerCharConfig[];
  isComputing: boolean;
  result: AnalyzerResult | null;
  progress: { overallProgress: number; phase: string } | null;
  error: Error | null;
  onRun: () => void;
  onStop: () => void;
}

export function AnalyzerResultCard({
  team,
  updateTeam,
  charConfigs,
  isComputing,
  result,
  progress,
  error,
  onRun,
  onStop,
}: AnalyzerResultCardProps) {
  const { t } = useLanguage();
  const ctx = team.calcContext;

  type ResultTab = "table" | "sequence";
  const [resultTab, setResultTab] = useState<ResultTab>("table");

  const overallPct = progress ? Math.round(progress.overallProgress * 100) : 0;

  const patchCtx = useCallback(
    (patch: Partial<CalcContext>) => {
      updateTeam(team.id, { calcContext: { ...ctx, ...patch } });
    },
    [team.id, ctx, updateTeam]
  );

  const charIds = charConfigs.map((c) => c.charId);

  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <span className={CARD_TITLE_CLS}>
          <BarChart3 className="w-4 h-4 opacity-70" />
          {t.ui("teamComp.analyzerChart")}
        </span>
      </CardHeader>
      <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
        <div className={CONTROLS_CLS}>
          <EnemyInputs
            enemyLevel={ctx.enemyLevel ?? ""}
            onEnemyLevelChange={(raw) => {
              const num = Number(raw);
              if (!Number.isNaN(num)) patchCtx({ enemyLevel: num });
            }}
            enemyRes={
              ctx.enemyRes != null ? Math.round(ctx.enemyRes * 100) : ""
            }
            onEnemyResChange={(raw) => {
              const num = Number(raw);
              if (!Number.isNaN(num)) patchCtx({ enemyRes: num / 100 });
            }}
            t={t}
          />
          <RollQualityInputs
            rollMultiplier={
              ctx.rollMultiplier ?? DEFAULT_CALC_CONTEXT.rollMultiplier
            }
            onRollMultiplierChange={(v) => patchCtx({ rollMultiplier: v })}
            substatBudget={
              ctx.substatBudget ?? DEFAULT_CALC_CONTEXT.substatBudget
            }
            onSubstatBudgetChange={(v) => patchCtx({ substatBudget: v })}
            t={t}
          />

          <Button
            onClick={isComputing ? onStop : onRun}
            variant={isComputing ? "destructive" : "default"}
            size="sm"
            className="shrink-0"
          >
            {isComputing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                {t.ui("common.stop")}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                {t.ui("teamComp.runAnalysis")}
              </>
            )}
          </Button>
        </div>

        {isComputing && progress ? (
          <div className="space-y-1">
            <Progress value={overallPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {progress.phase === "phase1"
                ? t.ui("teamComp.analyzerPhase1")
                : progress.phase === "phase2"
                  ? t.ui("teamComp.analyzerPhase2")
                  : progress.phase === "phase3"
                    ? t.ui("teamComp.analyzerPhase3")
                    : ""}
            </p>
          </div>
        ) : null}

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {result ? (
          <>
            <AnalyzerChart result={result} charIds={charIds} />

            <OptionButtonRow className="px-0 pt-2">
              {(
                [
                  {
                    key: "table" as const,
                    label: "teamComp.analyzerTable" as const,
                    desc: "teamComp.analyzerTableDesc" as const,
                  },
                  {
                    key: "sequence" as const,
                    label: "teamComp.analyzerSequence" as const,
                    desc: "teamComp.analyzerSequenceDesc" as const,
                  },
                ] as const
              ).map(({ key, label, desc }) => (
                <OptionButtonCell key={key}>
                  <OptionButton
                    selected={resultTab === key}
                    onClick={() => setResultTab(key)}
                    title={t.ui(label)}
                    subtitle={t.ui(desc)}
                  />
                </OptionButtonCell>
              ))}
            </OptionButtonRow>

            <div className="flex justify-center">
              {resultTab === "table" ? (
                <AnalyzerTable result={result} charIds={charIds} />
              ) : (
                <AnalyzerSequence result={result} charIds={charIds} />
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t.ui("teamComp.analyzerNoResults")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
