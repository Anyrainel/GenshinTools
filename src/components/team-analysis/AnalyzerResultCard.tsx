import { BarChart3, ChevronDown, Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
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
} from "@/domain/combat/analyzer/types";
import { DEFAULT_CALC_CONTEXT } from "@/domain/combat/damage/constants";
import type { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import type { CalcContext } from "@/domain/combat/damage/types";
import { fmtDamage } from "@/domain/team/displayFormatter";
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
import {
  EnemyInputs,
  RollQualityInputs,
  StellarDirectCoeffInput,
} from "./GeneratorControls";
import { TeamCharacterGrid } from "./TeamCharacterGrid";

interface AnalyzerResultCardProps {
  calcContext: Partial<CalcContext>;
  onCalcContextChange: (patch: Partial<CalcContext>) => void;
  charConfigs: AnalyzerCharConfig[];
  teamMeta: TeamMeta;
  isComputing: boolean;
  result: AnalyzerResult | null;
  progress: { overallProgress: number; phase: string } | null;
  error: Error | null;
  onRun: () => void;
  onStop: () => void;
}

export function AnalyzerResultCard({
  calcContext,
  onCalcContextChange,
  charConfigs,
  teamMeta,
  isComputing,
  result,
  progress,
  error,
  onRun,
  onStop,
}: AnalyzerResultCardProps) {
  const { t } = useLanguage();
  const ctx = calcContext;

  type ResultTab = "table" | "sequence";
  const [resultTab, setResultTab] = useState<ResultTab>("table");
  const [selectedBudget, setSelectedBudget] = useState(1);
  const baseline = result?.sequence[0];
  const selectedStep =
    result?.sequence.find(
      (step) => step.jin - (baseline?.jin ?? 0) === selectedBudget
    ) ??
    result?.sequence[1] ??
    baseline;

  const overallPct = progress ? Math.round(progress.overallProgress * 100) : 0;

  const patchCtx = useCallback(
    (patch: Partial<CalcContext>) => {
      onCalcContextChange({ ...ctx, ...patch });
    },
    [ctx, onCalcContextChange]
  );

  const charIds = charConfigs.map((c) => c.charId);
  const hasStellarConduct = teamMeta.hasReaction("stellarConduct");

  return (
    <Card className={CARD_CLS}>
      <CardHeader
        className={cn(
          CARD_HEADER_CLS,
          "py-2 flex-row items-center justify-between gap-2 space-y-0"
        )}
      >
        <span className={CARD_TITLE_CLS}>
          <BarChart3 className="w-4 h-4 opacity-70" />
          {t.ui("teamComp.investmentResults")}
        </span>
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
      </CardHeader>
      <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
        <details className="group rounded-lg border border-border bg-background/30">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            {t.ui("teamComp.analysisAssumptions")}
          </summary>
          <div className="px-2 pb-2">
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
              {hasStellarConduct && (
                <StellarDirectCoeffInput
                  stellarAttachHits={ctx.stellarAttachHits}
                  stellarDirectCoeff={ctx.stellarDirectCoeff}
                  onStellarAttachHitsChange={(hits) =>
                    patchCtx({
                      stellarAttachHits: hits,
                      stellarDirectCoeff: undefined,
                    })
                  }
                  t={t}
                />
              )}
            </div>
          </div>
        </details>

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
            {baseline && selectedStep && (
              <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">
                      {t.ui("teamComp.investmentBestAtBudget")}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {t.ui("teamComp.investmentBudget")}
                      </span>
                      <LightweightSelect
                        value={String(selectedStep.jin - baseline.jin)}
                        onValueChange={(value) =>
                          setSelectedBudget(Number(value))
                        }
                      >
                        <LightweightSelectTrigger
                          className="h-8 w-20"
                          aria-label={t.ui("teamComp.investmentBudget")}
                        >
                          <LightweightSelectValue />
                        </LightweightSelectTrigger>
                        <LightweightSelectContent>
                          {result.sequence.map((step) => (
                            <LightweightSelectItem
                              key={step.jin}
                              value={String(step.jin - baseline.jin)}
                            >
                              +{step.jin - baseline.jin}
                            </LightweightSelectItem>
                          ))}
                        </LightweightSelectContent>
                      </LightweightSelect>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold tabular-nums text-primary">
                      +{selectedStep.gainVsBaselinePct.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.ui("teamComp.investmentGain")}
                    </div>
                    <div className="text-xs tabular-nums">
                      {t.ui("common.damage")}: {fmtDamage(selectedStep.damage)}
                    </div>
                  </div>
                </div>
                <TeamCharacterGrid className="gap-2">
                  {charIds.map((charId) => {
                    const allocation = selectedStep.allocation[charId];
                    if (!allocation) return null;
                    return (
                      <div
                        key={charId}
                        className="flex items-center gap-2 rounded-md border border-border bg-background/50 p-2"
                      >
                        <ItemIcon characterId={charId} size="xs" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">
                            {t.character(charId)}
                          </div>
                          <div className="text-xs">
                            {t.format(
                              "common.constellationFormat",
                              allocation.constellation
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-center">
                          <ItemIcon weaponId={allocation.weaponId} size="xs" />
                          <div className="text-xs">
                            {t.format(
                              "common.refinementFormat",
                              allocation.refinement
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </TeamCharacterGrid>
              </section>
            )}
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
