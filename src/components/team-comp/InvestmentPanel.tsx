import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import type { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { ComboFormula, TeamSlotConfig } from "@/lib/dmgcalc/types";
import { resolveCalcContext } from "@/lib/dmgcalc/utils";
import {
  fullToStored,
  reconcileConfigs,
} from "@/lib/team-comp/analyzer/analyzerConfig";
import { getFutureInvestmentChanges } from "@/lib/team-comp/analyzer/investmentCounts";
import type {
  AnalyzerOptions,
  InvestmentCountChange,
} from "@/lib/team-comp/analyzer/types";
import type {
  TeamComp,
  TeamInvestmentConfig,
  TeamSetupConfig,
} from "@/lib/team-comp/types";
import { useTeamStore } from "@/stores/useTeamStore";
import { AccountInvestmentCard } from "./AccountInvestmentCard";
import { AnalyzerConfigCard } from "./AnalyzerConfigCard";
import { AnalyzerResultCard } from "./AnalyzerResultCard";
import { CARD_CLS, CARD_HEADER_CLS, CARD_TITLE_CLS } from "./cardStyles";

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
  const account = useActiveAccountData();
  const updateSetup = useTeamStore((s) => s.updateTeamSetupConfig);
  const investment = setupConfig.investment ?? {};
  const charConfigs = useMemo(
    () => reconcileConfigs(investment.configs ?? [], configs),
    [investment.configs, configs]
  );
  const starts = Object.fromEntries(
    configs.map((c) => [c.charId, c.constellation])
  );
  const changes = getFutureInvestmentChanges(
    teamBuild,
    starts,
    investment.futureCountChanges
  );
  const [draft, setDraft] = useState({
    charId: "",
    constellation: 1,
    formulaId: "",
    delta: 0,
  });
  const draftChar =
    configs.find((c) => c.charId === draft.charId) ??
    configs.find((c) => c.constellation < 6);
  const draftFormulas = draftChar
    ? [
        ...new Set([
          ...Object.keys(
            teamBuild.catalog.getFormulaIds()[draftChar.charId] ?? {}
          ).filter((id) => !id.startsWith("rx-")),
          ...teamBuild.catalog.getReactionComboGrid().map((row) => row.baseId),
          ...changes
            .filter((change) => change.charId === draftChar.charId)
            .map((change) => change.formulaId),
        ]),
      ]
    : [];
  const draftFormula = draftFormulas.includes(draft.formulaId)
    ? draft.formulaId
    : draftFormulas[0];
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
  const customize = (change: InvestmentCountChange, delta: number) =>
    patch({
      futureCountChanges: [
        ...(investment.futureCountChanges ?? []).filter(
          (c) =>
            !(
              c.charId === change.charId &&
              c.constellation === change.constellation &&
              c.formulaId === change.formulaId
            )
        ),
        { ...change, delta },
      ],
    });
  return (
    <div className="space-y-2">
      <AnalyzerConfigCard
        configs={configs}
        charConfigs={charConfigs}
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
                      maxRefinement: weaponId ? 5 : c.startRefinement,
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
      />
      <Card className={CARD_CLS}>
        <CardHeader className={CARD_HEADER_CLS}>
          <h3 className={CARD_TITLE_CLS}>
            {t.ui("teamComp.investmentFutureCounts")}
          </h3>
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          <p className="text-sm text-muted-foreground">
            {t.ui("teamComp.investmentFutureCountsDesc")}
          </p>
          {singleObjective && (
            <p className="text-sm text-muted-foreground">
              {t.ui("teamComp.investmentSingleObjective")}
            </p>
          )}
          <Button
            variant="outline"
            onClick={() =>
              patch({
                futureCountChanges: undefined,
                minErOverrides: undefined,
                legacyCountOverrides: undefined,
              })
            }
          >
            {t.ui("teamComp.analyzerResetDefaults")}
          </Button>
          {!singleObjective &&
            changes.map((change) => (
              <div
                key={`${change.charId}:${change.constellation}:${change.formulaId}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"
              >
                <span className="min-w-0 flex-1 break-words text-sm">
                  {t.character(change.charId)}{" "}
                  {t.format("common.constellationFormat", change.constellation)}{" "}
                  ·{" "}
                  {teamBuild.catalog.formulaIndex.get(change.formulaId)?.label
                    ? t.resolveLabel(
                        teamBuild.catalog.formulaIndex.get(change.formulaId)!
                          .label
                      )
                    : change.formulaId}
                </span>
                <label
                  htmlFor={`investment-${teamComp.id}-delta-${change.charId}-${change.constellation}-${change.formulaId}`}
                  className="flex items-center gap-2 text-sm"
                >
                  {t.ui("teamComp.investmentCountDelta")}
                  <Input
                    id={`investment-${teamComp.id}-delta-${change.charId}-${change.constellation}-${change.formulaId}`}
                    aria-label={`${t.character(change.charId)} ${change.formulaId} ${t.format("common.constellationFormat", change.constellation)}`}
                    className="w-20"
                    type="number"
                    value={change.delta}
                    onChange={(event) =>
                      customize(change, Number(event.target.value))
                    }
                  />
                </label>
              </div>
            ))}
          {!singleObjective && draftChar && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
              <select
                aria-label={t.ui("teamComp.investmentAddChange")}
                className="max-w-full rounded-md border border-border bg-background p-2 text-sm"
                value={draftChar.charId}
                onChange={(event) =>
                  setDraft({ ...draft, charId: event.target.value })
                }
              >
                {configs
                  .filter((c) => c.constellation < 6)
                  .map((c) => (
                    <option key={c.charId} value={c.charId}>
                      {t.character(c.charId)}
                    </option>
                  ))}
              </select>
              <select
                aria-label={t.ui("charEdit.constellation")}
                className="rounded-md border border-border bg-background p-2 text-sm"
                value={Math.max(
                  draftChar.constellation + 1,
                  draft.constellation
                )}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    constellation: Number(event.target.value),
                  })
                }
              >
                {Array.from(
                  { length: 6 - draftChar.constellation },
                  (_, i) => draftChar.constellation + i + 1
                ).map((c) => (
                  <option key={c} value={c}>
                    {t.format("common.constellationFormat", c)}
                  </option>
                ))}
              </select>
              <select
                aria-label={t.ui("teamComp.formulaSelect")}
                className="min-w-0 max-w-full flex-1 rounded-md border border-border bg-background p-2 text-sm"
                value={draftFormula}
                onChange={(event) =>
                  setDraft({ ...draft, formulaId: event.target.value })
                }
              >
                {draftFormulas.map((id) => (
                  <option key={id} value={id}>
                    {teamBuild.catalog.formulaIndex.get(id)?.label
                      ? t.resolveLabel(
                          teamBuild.catalog.formulaIndex.get(id)!.label
                        )
                      : teamBuild.catalog
                            .getReactionComboGrid()
                            .find((row) => row.baseId === id)?.label
                        ? t.resolveLabel(
                            teamBuild.catalog
                              .getReactionComboGrid()
                              .find((row) => row.baseId === id)!.label
                          )
                        : id}
                  </option>
                ))}
              </select>
              <Input
                aria-label={t.ui("teamComp.investmentCountDelta")}
                className="w-20"
                type="number"
                value={draft.delta}
                onChange={(event) =>
                  setDraft({ ...draft, delta: Number(event.target.value) })
                }
              />
              <Button
                variant="outline"
                disabled={!draftFormula}
                onClick={() =>
                  customize(
                    {
                      charId: draftChar.charId,
                      constellation: Math.max(
                        draftChar.constellation + 1,
                        draft.constellation
                      ),
                      formulaId: draftFormula,
                      delta: draft.delta,
                    },
                    draft.delta
                  )
                }
              >
                {t.ui("teamComp.investmentAddChange")}
              </Button>
            </div>
          )}
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {t.ui("teamComp.analyzerMinEr")}
            </summary>
            <div className="mt-2 flex flex-wrap gap-3">
              {configs.flatMap((config) =>
                Array.from(
                  { length: 6 - config.constellation },
                  (_, i) => config.constellation + i + 1
                ).map((c) => (
                  <label
                    key={`${config.charId}-${c}`}
                    htmlFor={`investment-${teamComp.id}-er-${config.charId}-${c}`}
                    className="text-sm"
                  >
                    {t.character(config.charId)}{" "}
                    {t.format("common.constellationFormat", c)}
                    <Input
                      id={`investment-${teamComp.id}-er-${config.charId}-${c}`}
                      className="w-24"
                      type="number"
                      min={0}
                      value={Math.round(
                        (investment.minErOverrides?.[`${config.charId}|${c}`] ??
                          setupConfig.charConfigs?.[config.charId]?.minEr ??
                          1) * 100
                      )}
                      onChange={(event) =>
                        patch({
                          minErOverrides: {
                            ...investment.minErOverrides,
                            [`${config.charId}|${c}`]:
                              Number(event.target.value) / 100,
                          },
                        })
                      }
                    />
                    %
                  </label>
                ))
              )}
            </div>
          </details>
          {(investment.legacyInputs || investment.legacyCountOverrides) && (
            <details className="space-y-2 rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t.ui("teamComp.investmentRetainedSettings")}
              </summary>
              <p className="text-sm text-muted-foreground">
                {t.ui("teamComp.investmentRetainedSettingsDesc")}
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
                {JSON.stringify(
                  {
                    inputs: investment.legacyInputs,
                    exactCounts: investment.legacyCountOverrides,
                  },
                  null,
                  2
                )}
              </pre>
              <Button
                variant="outline"
                onClick={() =>
                  updateSetup(teamComp.id, (config) => {
                    const saved = config.investment?.legacyInputs;
                    const combo = config.damage?.combo;
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
            </details>
          )}
        </CardContent>
      </Card>
      <AccountInvestmentCard
        account={account}
        charConfigs={charConfigs}
        options={options}
      />
      <AnalyzerResultCard
        calcContext={setupConfig.damage?.calcContext ?? {}}
        onCalcContextChange={(calcContext) =>
          updateSetup(teamComp.id, (config) => ({
            ...config,
            damage: { ...config.damage, calcContext },
          }))
        }
        charConfigs={charConfigs}
        teamMeta={teamBuild.teamMeta}
        isComputing={analysis.isComputing}
        result={analysis.result}
        progress={analysis.progress}
        error={analysis.error}
        onRun={() => analysis.start(options, !!analysis.result)}
        onStop={analysis.stop}
      />
    </div>
  );
}
