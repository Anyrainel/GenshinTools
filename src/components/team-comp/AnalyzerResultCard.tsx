import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  OptionButton,
  OptionButtonCell,
  OptionButtonRow,
} from "@/components/ui/option-button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AnalyzerCharConfig } from "@/lib/team-comp/analyzer";
import type { SubstatBudgetPreset } from "@/lib/team-comp/substatBudget";
import type { CalcContext } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { AnalyzerChart } from "./AnalyzerChart";
import { AnalyzerSequence } from "./AnalyzerSequence";
import { AnalyzerTable } from "./AnalyzerTable";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

// ─── Shared style constants (matching DamageCard) ───

const LABEL_CLS =
  "font-semibold text-foreground/80 select-none whitespace-nowrap text-[10px] md:text-sm";

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
  result: unknown;
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
        <span className={CARD_TITLE_CLS}>{t.ui("teamComp.analyzerChart")}</span>
      </CardHeader>
      <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
        {/* Settings row (matching DamageCard generate tab) */}
        <div className={CONTROLS_CLS}>
          {/* Enemy Level */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className={LABEL_CLS}>{t.ui("teamComp.enemyLevel")}</span>
            <Input
              type="text"
              inputMode="numeric"
              value={enemyLevel}
              placeholder="110"
              onChange={(e) => {
                const num = Number(e.target.value);
                if (!Number.isNaN(num)) setEnemyLevel(num);
              }}
              className="text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1"
            />
          </div>

          {/* Enemy Res */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className={LABEL_CLS}>{t.ui("teamComp.enemyRes")}</span>
            <div className="flex items-center gap-0">
              <Input
                type="number"
                value={enemyRes}
                placeholder="10"
                onChange={(e) => {
                  const num = Number(e.target.value);
                  if (!Number.isNaN(num)) setEnemyRes(num);
                }}
                className="text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1"
              />
              <span className="font-bold text-muted-foreground text-[10px] md:text-xs">
                %
              </span>
            </div>
          </div>

          {/* Roll Multiplier */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className={LABEL_CLS}>{t.ui("teamComp.rollMultiplier")}</span>
            <Select
              value={String(rollMultiplier)}
              onValueChange={(v) => setRollMultiplier(Number(v))}
            >
              <SelectTrigger className="font-bold border-border/20 bg-background/50 text-xs h-6 w-14 px-1 py-0 md:text-sm md:h-7 md:w-16 md:px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.7, 0.8, 0.85, 0.9, 1.0].map((v) => (
                  <SelectItem key={v} value={String(v)}>
                    {v}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Substat Budget */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className={LABEL_CLS}>{t.ui("teamComp.substatBudget")}</span>
            <Select
              value={substatBudget}
              onValueChange={(v) => setSubstatBudget(v as SubstatBudgetPreset)}
            >
              <SelectTrigger className="font-bold border-border/20 bg-background/50 min-w-0 max-w-[9rem] text-xs h-6 px-1 py-0 md:text-sm md:h-7 md:max-w-[10rem] md:px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8_6">8/6 (5/4★)</SelectItem>
                <SelectItem value="8_7">8/7 (5/4★)</SelectItem>
                <SelectItem value="9_7">9/7 (5/4★)</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
