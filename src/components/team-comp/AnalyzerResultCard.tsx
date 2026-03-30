import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  OptionButton,
  OptionButtonCell,
  OptionButtonRow,
} from "@/components/ui/option-button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  AnalyzerCharConfig,
  AnalyzerResult,
} from "@/lib/team-comp/analyzer";
import type { SubstatBudgetPreset } from "@/lib/team-comp/substatBudget";
import type { CalcContext } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { BarChart3, Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { AnalyzerChart } from "./AnalyzerChart";
import { AnalyzerSequence } from "./AnalyzerSequence";
import { AnalyzerTable } from "./AnalyzerTable";
import { EnemyInputs, RollQualityInputs } from "./GeneratorControls";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

const CONTROLS_CLS =
  "flex flex-wrap items-center justify-center mb-3 gap-x-2 gap-y-1 md:gap-x-5 md:gap-y-2";

// ─── Types ───

export interface AnalyzerCalcSettings {
  calcContext: CalcContext;
  rollMultiplier: number;
  substatBudget: SubstatBudgetPreset;
}

interface AnalyzerResultCardProps {
  charConfigs: AnalyzerCharConfig[];
  isComputing: boolean;
  result: AnalyzerResult | null;
  progress: { overallProgress: number; phase: string } | null;
  error: Error | null;
  onRun: (settings: AnalyzerCalcSettings) => void;
  onStop: () => void;
}

// ─── Main Card ───

export function AnalyzerResultCard({
  charConfigs,
  isComputing,
  result,
  progress,
  error,
  onRun,
  onStop,
}: AnalyzerResultCardProps) {
  const { t } = useLanguage();

  // Local settings state (not persisted to any store)
  const [enemyLevel, setEnemyLevel] = useState(110);
  const [enemyRes, setEnemyRes] = useState(10); // displayed as %, stored as integer
  const [rollMultiplier, setRollMultiplier] = useState(0.85);
  const [substatBudget, setSubstatBudget] =
    useState<SubstatBudgetPreset>("8_6");

  type ResultTab = "table" | "sequence";
  const [resultTab, setResultTab] = useState<ResultTab>("table");

  const overallPct = progress ? Math.round(progress.overallProgress * 100) : 0;

  const handleRun = useCallback(() => {
    onRun({
      calcContext: {
        enemyLevel,
        enemyRes: enemyRes / 100,
        rollMultiplier,
        substatBudget,
      },
      rollMultiplier,
      substatBudget,
    });
  }, [onRun, enemyLevel, enemyRes, rollMultiplier, substatBudget]);

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
        {/* Settings row (matching DamageCard generate tab) */}
        <div className={CONTROLS_CLS}>
          <EnemyInputs
            enemyLevel={enemyLevel}
            onEnemyLevelChange={(raw) => {
              const num = Number(raw);
              if (!Number.isNaN(num)) setEnemyLevel(num);
            }}
            enemyRes={enemyRes}
            onEnemyResChange={(raw) => {
              const num = Number(raw);
              if (!Number.isNaN(num)) setEnemyRes(num);
            }}
            t={t}
          />
          <RollQualityInputs
            rollMultiplier={rollMultiplier}
            onRollMultiplierChange={setRollMultiplier}
            substatBudget={substatBudget}
            onSubstatBudgetChange={setSubstatBudget}
            t={t}
          />

          {/* Run / Stop button */}
          <Button
            onClick={isComputing ? onStop : handleRun}
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

        {/* Progress bar */}
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
            {/* Chart */}
            <AnalyzerChart result={result} charIds={charIds} />

            {/* Table / Sequence toggle */}
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
