import { Loader2, Play } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  fullToStored,
  reconcileConfigs,
} from "@/domain/combat/analyzer/analyzerConfig";
import {
  deriveAbsoluteInvestmentCombo,
  getFutureInvestmentChanges,
  getInvestmentFormulaCount,
} from "@/domain/combat/analyzer/investmentCounts";
import { setInvestmentErPoint } from "@/domain/combat/analyzer/investmentEr";
import type {
  AnalyzerOptions,
  TeamInvestment,
} from "@/domain/combat/analyzer/types";
import type { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type {
  ComboFormula,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import { resolveCalcContext } from "@/domain/combat/damage/utils";
import { formatBuffStats } from "@/domain/team/displayFormatter";
import type {
  TeamComp,
  TeamInvestmentConfig,
  TeamSetupConfig,
} from "@/domain/team/types";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { useTeamStore } from "@/stores/useTeamStore";
import { AnalyzerConfigCard } from "./AnalyzerConfigCard";
import { AnalyzerResultCard } from "./AnalyzerResultCard";

interface InvestmentPanelProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  teamBuild: TeamBuild;
  configs: TeamSlotConfig[];
  objectiveCombo: ComboFormula;
  singleObjective: boolean;
  ignoredCharIds?: ReadonlySet<string>;
}

export function InvestmentPanel({
  teamComp,
  setupConfig,
  teamBuild,
  configs,
  objectiveCombo,
  singleObjective,
  ignoredCharIds,
}: InvestmentPanelProps) {
  const { t } = useLanguage();
  const updateSetup = useTeamStore((s) => s.updateTeamSetupConfig);
  const investment = setupConfig.investment ?? {};
  const charConfigs = useMemo(
    () => reconcileConfigs(investment.configs ?? [], configs),
    [investment.configs, configs]
  );
  const starts = Object.fromEntries(
    configs.map((c) => [c.charId, c.constellation])
  );
  const allocation: TeamInvestment = Object.fromEntries(
    configs.map((c) => [
      c.charId,
      {
        constellation: c.constellation,
        weaponId: c.weaponId,
        refinement: c.refinement,
        is5StarWeapon:
          charConfigs.find((x) => x.charId === c.charId)!.startRefinement > 0,
      },
    ])
  );
  const options: AnalyzerOptions = {
    configs: charConfigs,
    baseConfigs: configs,
    teamBuild,
    templateCombo: objectiveCombo,
    comboOverrides: investment.legacyCountOverrides,
    minErOverrides: investment.minErOverrides,
    calcContext: resolveCalcContext(setupConfig.damage?.calcContext),
    baselineConstellations: starts,
    futureCountChanges: investment.futureCountChanges,
    absoluteCountTargets: investment.absoluteCountTargets,
    singleObjective,
    ignoredContributorIds: ignoredCharIds ? [...ignoredCharIds] : [],
    perChar: Object.fromEntries(
      configs.map((c) => [
        c.charId,
        {
          minEr: setupConfig.charConfigs?.[c.charId]?.minEr ?? 1,
          minCr: setupConfig.charConfigs?.[c.charId]?.minCr ?? 0,
        },
      ])
    ),
  };
  const inputKey = JSON.stringify({
    ...options,
    teamBuild: {
      configs: teamBuild.configs,
      opts: teamBuild.combatOpts,
      aura: teamBuild.enemyAura,
      buffs: teamBuild.extraBuffs,
    },
  });
  const analysis = useAnalyzer(teamComp.id, inputKey);
  const patch = (next: Partial<TeamInvestmentConfig>) =>
    updateSetup(teamComp.id, (config) => ({
      ...config,
      investment: { ...config.investment, ...next },
    }));
  const saveConfigs = (next: typeof charConfigs) =>
    patch({
      configs: next.map((c) =>
        fullToStored(c, configs.find((base) => base.charId === c.charId)!)
      ),
    });
  const countAt = (charId: string, c: number, id: string) =>
    getInvestmentFormulaCount(
      deriveAbsoluteInvestmentCombo(
        {
          ...allocation,
          [charId]: { ...allocation[charId], constellation: c },
        },
        objectiveCombo,
        teamBuild,
        starts,
        investment.futureCountChanges,
        investment.legacyCountOverrides,
        investment.absoluteCountTargets
      ),
      charId,
      id
    );
  const label = (id: string) => {
    const value =
      teamBuild.catalog.formulaIndex.get(id)?.label ??
      teamBuild.catalog.getReactionComboGrid().find((row) => row.baseId === id)
        ?.label;
    return value ? t.resolveLabel(value) : id;
  };
  const renderChanges = (charId: string) => {
    const start = starts[charId];
    const points = new Map<
      string,
      { constellation: number; formulaId: string }
    >();
    for (const point of [
      ...getFutureInvestmentChanges(
        teamBuild,
        starts,
        investment.futureCountChanges
      ),
      ...(investment.absoluteCountTargets ?? []),
    ]) {
      if (point.charId === charId && point.constellation > start)
        points.set(`${point.constellation}|${point.formulaId}`, point);
    }
    for (const key of Object.keys(investment.legacyCountOverrides ?? {})) {
      const [owner, c, formula] = key.split("|");
      if (owner === charId && Number(c) > start && formula)
        points.set(`${c}|${formula.split(":")[0]}`, {
          constellation: Number(c),
          formulaId: formula.split(":")[0],
        });
    }
    const formulas = [
      ...new Set([
        ...Object.keys(teamBuild.catalog.getFormulaIds()[charId] ?? {}).filter(
          (id) => !id.startsWith("rx-")
        ),
        ...teamBuild.catalog.getReactionComboGrid().map((row) => row.baseId),
        ...[...points.values()].map((point) => point.formulaId),
      ]),
    ];
    let previousEr = setupConfig.charConfigs?.[charId]?.minEr ?? 1;
    const erPoints: { constellation: number; value: number }[] = [];
    for (let c = start + 1; c <= 6; c++) {
      const value =
        investment.minErOverrides?.[`${charId}|${c}`] ??
        setupConfig.charConfigs?.[charId]?.minEr ??
        1;
      if (value !== previousEr) erPoints.push({ constellation: c, value });
      previousEr = value;
    }
    return (
      <div className="space-y-2 text-xs">
        {!singleObjective &&
          [...points.values()]
            .sort(
              (a, b) =>
                a.constellation - b.constellation ||
                a.formulaId.localeCompare(b.formulaId)
            )
            .map((point) => (
              <div
                key={`${point.constellation}|${point.formulaId}`}
                className="flex items-start justify-between gap-1"
              >
                <span className="min-w-0 break-words">
                  {t.format(
                    "teamComp.investmentCountAt",
                    t.format("common.constellationFormat", point.constellation),
                    label(point.formulaId),
                    Number(
                      countAt(
                        charId,
                        point.constellation,
                        point.formulaId
                      ).toFixed(2)
                    )
                  )}
                </span>
                {(investment.absoluteCountTargets?.some(
                  (target) =>
                    target.charId === charId &&
                    target.constellation === point.constellation &&
                    target.formulaId === point.formulaId
                ) ||
                  investment.futureCountChanges?.some(
                    (change) =>
                      change.charId === charId &&
                      change.constellation === point.constellation &&
                      change.formulaId === point.formulaId
                  )) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 shrink-0 px-1 text-xs"
                    aria-label={t.ui("teamComp.investmentRemoveChange")}
                    onClick={() =>
                      patch({
                        absoluteCountTargets:
                          investment.absoluteCountTargets?.filter(
                            (p) =>
                              !(
                                p.charId === charId &&
                                p.constellation === point.constellation &&
                                p.formulaId === point.formulaId
                              )
                          ),
                        futureCountChanges:
                          investment.futureCountChanges?.filter(
                            (p) =>
                              !(
                                p.charId === charId &&
                                p.constellation === point.constellation &&
                                p.formulaId === point.formulaId
                              )
                          ),
                      })
                    }
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
        {erPoints.map((point) => (
          <div
            key={`er${point.constellation}`}
            className="flex items-start justify-between gap-1"
          >
            <span className="min-w-0 break-words">
              {t.format(
                "teamComp.investmentErAt",
                t.format("common.constellationFormat", point.constellation),
                Math.round(point.value * 100)
              )}
            </span>
            {investment.minErOverrides?.[`${charId}|${point.constellation}`] !==
              undefined && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 shrink-0 px-1 text-xs"
                aria-label={t.ui("teamComp.investmentRemoveChange")}
                onClick={() =>
                  patch({
                    minErOverrides: setInvestmentErPoint(
                      investment.minErOverrides ?? {},
                      charId,
                      point.constellation,
                      setupConfig.charConfigs?.[charId]?.minEr ?? 1,
                      undefined
                    ),
                  })
                }
              >
                ×
              </Button>
            )}
          </div>
        ))}
        {start < 6 && (
          <InvestmentChangePopover
            charId={charId}
            start={start}
            formulas={formulas}
            label={label}
            countAt={countAt}
            single={singleObjective}
            baseEr={setupConfig.charConfigs?.[charId]?.minEr ?? 1}
            overrides={investment.minErOverrides ?? {}}
            onSave={(c, id, value) => {
              if (id === "er") {
                patch({
                  minErOverrides: setInvestmentErPoint(
                    investment.minErOverrides ?? {},
                    charId,
                    c,
                    setupConfig.charConfigs?.[charId]?.minEr ?? 1,
                    value / 100
                  ),
                });
              } else
                patch({
                  absoluteCountTargets: [
                    ...(investment.absoluteCountTargets ?? []).filter(
                      (p) =>
                        !(
                          p.charId === charId &&
                          p.constellation === c &&
                          p.formulaId === id
                        )
                    ),
                    { charId, constellation: c, formulaId: id, count: value },
                  ],
                });
            }}
          />
        )}
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <AnalyzerConfigCard
        configs={configs}
        charConfigs={charConfigs}
        renderChanges={renderChanges}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                patch({
                  futureCountChanges: undefined,
                  absoluteCountTargets: undefined,
                  minErOverrides: undefined,
                  legacyCountOverrides: undefined,
                })
              }
            >
              {t.ui("teamComp.analyzerResetDefaults")}
            </Button>
            {investment.legacyInputs && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {t.ui("teamComp.investmentRetainedSettings")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] space-y-3">
                  <div className="max-h-56 space-y-2 overflow-auto text-sm">
                    {investment.legacyInputs.enemyAura && (
                      <div>
                        {t.ui("teamComp.enemyAura")}{" "}
                        {t.element(investment.legacyInputs.enemyAura)}
                      </div>
                    )}
                    {investment.legacyInputs.extraBuffs?.map((buff) => (
                      <div key={buff.id}>
                        {buff.target === "team"
                          ? t.ui("teamComp.extraBuffs")
                          : t.character(buff.target)}
                        : {formatBuffStats(buff.stats, t)}
                      </div>
                    ))}
                    {Object.entries(
                      investment.legacyInputs.reactionOverrides ?? {}
                    ).map(([key, reaction]) => (
                      <div key={key}>
                        {t.character(key.split(".")[0])} ·{" "}
                        {label(key.split(".").slice(1).join("."))}:{" "}
                        {reaction.reaction
                          ? t.reaction(reaction.reaction)
                          : "—"}
                      </div>
                    ))}
                    {Object.entries(
                      investment.legacyInputs.startingValues ?? {}
                    ).map(([id, ranks]) => (
                      <div key={id}>
                        {t.character(id)}:{" "}
                        {t.format(
                          "common.constellationFormat",
                          ranks.constellation
                        )}{" "}
                        /{" "}
                        {ranks.refinement
                          ? t.format(
                              "common.refinementFormat",
                              ranks.refinement
                            )
                          : "3/4★"}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="h-auto w-full whitespace-normal"
                    onClick={() =>
                      updateSetup(teamComp.id, (config) => {
                        const saved = config.investment?.legacyInputs;
                        const combo = config.damage?.combo;
                        const selected = config.damage?.selectedFormula;
                        return {
                          ...config,
                          damage: {
                            ...config.damage,
                            ...(saved?.enemyAura
                              ? { enemyAura: saved.enemyAura }
                              : {}),
                            ...(saved?.extraBuffs
                              ? { extraBuffs: saved.extraBuffs }
                              : {}),
                            ...(selected &&
                            saved?.reactionOverrides?.[
                              `${selected.charId}.${selected.formulaId}`
                            ]
                              ? {
                                  singleReaction:
                                    saved.reactionOverrides[
                                      `${selected.charId}.${selected.formulaId}`
                                    ],
                                }
                              : {}),
                            ...(combo && saved?.reactionOverrides
                              ? {
                                  combo: {
                                    ...combo,
                                    lines: combo.lines.map((line) => ({
                                      ...line,
                                      reaction:
                                        saved.reactionOverrides?.[
                                          `${line.charId}.${line.formulaId}`
                                        ] ?? line.reaction,
                                    })),
                                  },
                                }
                              : {}),
                          },
                        };
                      })
                    }
                  >
                    {t.ui("teamComp.investmentAdoptSettings")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => patch({ legacyInputs: undefined })}
                  >
                    {t.ui("teamComp.investmentDiscardSettings")}
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </>
        }
        onUpdateMax={(id, field, value) =>
          saveConfigs(
            charConfigs.map((c) =>
              c.charId === id ? { ...c, [field]: value } : c
            )
          )
        }
        onUpdateWeapon={(id, star, weaponId) =>
          saveConfigs(
            charConfigs.map((c) =>
              c.charId !== id
                ? c
                : star === "5"
                  ? {
                      ...c,
                      weapon5Star: weaponId ? { id: weaponId } : undefined,
                      maxRefinement: weaponId
                        ? Math.max(1, c.maxRefinement)
                        : c.startRefinement,
                    }
                  : {
                      ...c,
                      weapon4Star: weaponId
                        ? { id: weaponId, refinement: 5 }
                        : undefined,
                    }
            )
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={
              analysis.isComputing
                ? analysis.stop
                : () => analysis.start(options, !!analysis.result)
            }
            variant={analysis.isComputing ? "destructive" : "default"}
          >
            {analysis.isComputing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {analysis.isComputing
              ? t.ui("common.stop")
              : t.ui("teamComp.runAnalysis")}
          </Button>
        </div>
        <AnalyzerResultCard
          charConfigs={charConfigs}
          isComputing={analysis.isComputing}
          result={analysis.result}
          progress={analysis.progress}
          error={analysis.error}
        />
      </AnalyzerConfigCard>
    </div>
  );
}

function InvestmentChangePopover({
  charId,
  start,
  formulas,
  label,
  countAt,
  single,
  baseEr,
  overrides,
  onSave,
}: {
  charId: string;
  start: number;
  formulas: string[];
  label: (id: string) => string;
  countAt: (charId: string, c: number, id: string) => number;
  single: boolean;
  baseEr: number;
  overrides: Record<string, number>;
  onSave: (c: number, id: string, value: number) => void;
}) {
  const { t } = useLanguage();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState(start + 1);
  const [formula, setFormula] = useState(single ? "er" : (formulas[0] ?? "er"));
  const [value, setValue] = useState(0);
  const read = (at: number, id: string) =>
    id === "er"
      ? (overrides[`${charId}|${at}`] ?? baseEr) * 100
      : countAt(charId, at, id);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setC(start + 1);
          const nextFormula = single
            ? "er"
            : formulas.includes(formula) || formula === "er"
              ? formula
              : (formulas[0] ?? "er");
          setFormula(nextFormula);
          setValue(read(start + 1, nextFormula));
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-7 px-0 text-xs">
          {t.ui("teamComp.investmentAddChange")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 max-w-[calc(100vw-2rem)] space-y-3"
        align="start"
      >
        <Select
          value={String(c)}
          onValueChange={(raw) => {
            const next = Number(raw);
            setC(next);
            setValue(read(next, formula));
          }}
        >
          <SelectTrigger aria-label={t.ui("charEdit.constellation")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 6 - start }, (_, i) => start + i + 1).map(
              (point) => (
                <SelectItem key={point} value={String(point)}>
                  {t.format("common.constellationFormat", point)}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Select
          value={formula}
          onValueChange={(id) => {
            setFormula(id);
            setValue(read(c, id));
          }}
        >
          <SelectTrigger aria-label={t.ui("teamComp.formulaSelect")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!single &&
              formulas.map((id) => (
                <SelectItem key={id} value={id}>
                  {label(id)}
                </SelectItem>
              ))}
            <SelectItem value="er">{t.ui("teamComp.analyzerMinEr")}</SelectItem>
          </SelectContent>
        </Select>
        <label htmlFor={inputId} className="text-sm">
          {formula === "er"
            ? t.ui("teamComp.analyzerMinEr")
            : t.ui("teamComp.investmentAbsoluteCount")}
        </label>
        <Input
          id={inputId}
          aria-label={
            formula === "er"
              ? t.ui("teamComp.analyzerMinEr")
              : t.ui("teamComp.investmentAbsoluteCount")
          }
          type="number"
          min={0}
          value={Number(value.toFixed(2))}
          onChange={(event) =>
            setValue(Math.max(0, Number(event.target.value)))
          }
        />
        <Button
          className="w-full"
          onClick={() => {
            onSave(c, formula, value);
            setOpen(false);
          }}
        >
          {t.ui("teamComp.investmentSaveChange")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
