import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { DoubleItemIcon } from "@/components/shared/DoubleItemIcon";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import type { ArtifactData } from "@/data/types";
import { useAsyncOptimizer } from "@/hooks/useAsyncOptimizer";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet, getEntityOption } from "@/lib/team-comp/damageModels";
import type { CalcContext } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { ArrowLeft, ChevronDown, Loader2, Play, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DamageCardBody, FormulaTabBar } from "./DamageCardBody";
import { buildTeamConfigs } from "./teamOptUtils";
import type { TeamOptDetailProps } from "./teamOptUtils";

// ─── Shared card style constants ──────────────────────────────────
const CARD_CLS = "bg-gradient-card border-border/50 overflow-hidden shadow-lg";
const CARD_HEADER_CLS =
  "bg-gradient-select border-b border-border/40 py-3 px-4 md:px-6";
const CARD_TITLE_CLS =
  "text-base font-bold flex items-center gap-2 tracking-tight text-primary-foreground/90";
const CARD_BODY_CLS = "p-4 md:px-6 md:py-5 bg-black/10";

// ─── Component ────────────────────────────────────────────────────
export function TeamOptDetail({ team, onBack }: TeamOptDetailProps) {
  const { t } = useLanguage();
  const accountData = useAccountStore((state) => state.accountData);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const scoreConfig = useArtifactScoreStore((state) => state.config);

  const [metricOpen, setMetricOpen] = useState(true);
  // Independent formula selection for Card 3 (optimizer)
  const [optFormulaTab, setOptFormulaTab] = useState<string | null>(null);

  const {
    result: optResult,
    isComputing,
    start: startOpt,
    stop: stopOpt,
  } = useAsyncOptimizer();

  useEffect(() => {
    return () => stopOpt();
  }, [stopOpt]);

  const configs = useMemo(
    () => buildTeamConfigs(team, accountData),
    [team, accountData]
  );

  const { teamBuild, buildError } = useMemo(() => {
    try {
      return { teamBuild: new TeamBuild(configs, team.opts), buildError: null };
    } catch (e: unknown) {
      console.error("Failed to construct TeamBuild:", e);
      return {
        teamBuild: null,
        buildError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [configs, team.opts]);

  const availableFormulas = useMemo(() => {
    return teamBuild ? teamBuild.getFormulaIds() : {};
  }, [teamBuild]);

  const artifactSheets = useMemo(() => {
    if (!accountData) return {};
    const sheets: Record<string, StatSheet> = {};
    for (const charId of team.characters) {
      if (!charId) continue;
      const acctChar = accountData.characters.find((c) => c.key === charId);
      if (!acctChar) continue;
      const artifacts = Object.values(acctChar.artifacts || {});
      sheets[charId] = StatSheet.fromArtifacts(artifacts);
    }
    return sheets;
  }, [accountData, team.characters]);

  const handleOptionChange = (entityId: string, val: string) => {
    updateTeam(team.id, { opts: { ...team.opts, [entityId]: val } });
  };

  /** Render a single combat option toggle/select. */
  const renderOption = (entityId: string, isWeapon: boolean) => {
    const schema = getEntityOption(entityId);
    if (!schema) return null;

    const value = team.opts[entityId] || schema.default;
    const resource = isWeapon
      ? weaponsById[entityId]
      : charactersById[entityId];
    if (!resource) return null;

    return (
      <div key={entityId} className="flex items-center gap-2 py-1.5">
        <div className="w-6 h-6 rounded-full bg-secondary/30 overflow-hidden shrink-0 border border-border/30">
          <img
            src={getAssetUrl(resource.imagePath)}
            alt={entityId}
            className="w-full h-full object-contain"
          />
        </div>
        <span className="font-medium text-[11px] text-foreground/70 shrink-0 min-w-0 truncate max-w-[100px]">
          {t.resolveLabel(schema.label)}
        </span>

        {schema.choices.length === 2 ? (
          <div className="flex bg-secondary/50 rounded-md p-0.5 shrink-0 ml-auto">
            {schema.choices.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => handleOptionChange(entityId, c.value)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all",
                  value === c.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.resolveLabel(c.label)}
              </button>
            ))}
          </div>
        ) : (
          <Select
            value={value}
            onValueChange={(v) => handleOptionChange(entityId, v)}
          >
            <SelectTrigger className="w-[140px] h-7 text-[11px] ml-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schema.choices.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {t.resolveLabel(c.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  };

  const validCharIds = Object.keys(availableFormulas);

  const allFormulas = useMemo(() => {
    const list = [];
    for (const charId of validCharIds) {
      const charFormulas = availableFormulas[charId];
      if (charFormulas) {
        for (const [formulaId, label] of Object.entries(charFormulas)) {
          list.push({ charId, formulaId, label });
        }
      }
    }
    return list;
  }, [validCharIds, availableFormulas]);

  const resolvedFormula = useMemo(() => {
    if (!team.selectedFormula) return allFormulas[0] || null;
    const isValid = allFormulas.some(
      (f) =>
        f.charId === team.selectedFormula!.charId &&
        f.formulaId === team.selectedFormula!.formulaId
    );
    return isValid ? team.selectedFormula : allFormulas[0] || null;
  }, [team.selectedFormula, allFormulas]);

  const currentDamage = useMemo(() => {
    if (!teamBuild || !resolvedFormula) return null;
    try {
      const { charId, formulaId } = resolvedFormula;

      const formulas = teamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;

      const postStats = teamBuild.getTeamStats(artifactSheets, charId);

      const ctx: CalcContext = {
        enemyLevel: 100,
        enemyRes: 0.1,
        assumeCrit: false,
      };
      return teamBuild.getDamageResult(charId, formulaId, postStats, ctx);
    } catch (e) {
      console.error("Damage calc failed:", e);
      return null;
    }
  }, [teamBuild, resolvedFormula, artifactSheets]);

  const activeTab = resolvedFormula
    ? `${resolvedFormula.charId}.${resolvedFormula.formulaId}`
    : "";

  // Resolve the optimizer's formula (fully independent from Card 2)
  const resolvedOptFormula = useMemo(() => {
    if (!optFormulaTab) return allFormulas[0] ?? null;
    const match = allFormulas.find(
      (f) => `${f.charId}.${f.formulaId}` === optFormulaTab
    );
    return match ?? allFormulas[0] ?? null;
  }, [optFormulaTab, allFormulas]);

  const activeOptTab = resolvedOptFormula
    ? `${resolvedOptFormula.charId}.${resolvedOptFormula.formulaId}`
    : "";

  const targetErRaw =
    (resolvedOptFormula && team.targetEr[resolvedOptFormula.charId]) ?? 1.0;

  const handleOptimize = () => {
    if (!teamBuild || !accountData || !resolvedOptFormula) return;

    const inventory = [
      ...accountData.extraArtifacts,
      ...accountData.characters.flatMap((c) =>
        Object.values(c.artifacts || {})
      ),
    ];

    const { charId, formulaId } = resolvedOptFormula;
    const weights = scoreConfig.characters[charId] || {};

    // Use GOAL sets as optimizer constraints (not equipped sets)
    const charIdx = team.characters.indexOf(charId);
    const goalArt = charIdx >= 0 ? team.artifacts[charIdx] : undefined;
    let goalSetId: string | null = null;
    let goalHalfSetIds: string[] = [];
    if (goalArt?.type === "4pc") {
      goalSetId = goalArt.setId;
    } else if (goalArt?.type === "2pc+2pc") {
      goalHalfSetIds = [goalArt.id1.toString(), goalArt.id2.toString()];
    }

    startOpt({
      teamBuild,
      targetCharId: charId,
      formulaId,
      targetEr: targetErRaw,
      inventory,
      weights,
      globalConfig: scoreConfig.global,
      baseSheets: artifactSheets,
      calcContext: {
        enemyLevel: 100,
        enemyRes: 0.1,
        assumeCrit: false,
      },
      topN: 50,
      artifactSetId: goalSetId,
      artifactHalfSetIds: goalHalfSetIds,
    });
  };

  // Build artifact maps for Card 2 (current equipped) and Card 3 (optimized)
  const equippedArtifactsByChar = useMemo(() => {
    const map: Record<string, Record<string, ArtifactData>> = {};
    for (const cid of team.characters) {
      if (!cid) continue;
      const acctChar = accountData?.characters.find((c) => c.key === cid);
      map[cid] = (acctChar?.artifacts || {}) as Record<string, ArtifactData>;
    }
    return map;
  }, [team.characters, accountData]);

  const optimizedArtifactsByChar = useMemo(() => {
    if (!optResult?.bestDamageResult) return equippedArtifactsByChar;
    const map = { ...equippedArtifactsByChar };
    const targetId = resolvedOptFormula?.charId;
    if (targetId) {
      map[targetId] = optResult.bestArtifacts as Record<string, ArtifactData>;
    }
    return map;
  }, [optResult, equippedArtifactsByChar, resolvedOptFormula]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300 pb-12">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 px-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 h-9 w-9 hover:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5 text-foreground/70" />
        </Button>
        <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/60 tracking-tight truncate">
          {team.name || "Team Optimization"}
        </h2>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Card 1 — Team Roster + Combat Options (always expanded)
         ══════════════════════════════════════════════════════════ */}
      <Card className={CARD_CLS}>
        <CardHeader className={cn(CARD_HEADER_CLS, "py-2.5")}>
          <h3 className={CARD_TITLE_CLS}>
            <Swords className="w-4 h-4 opacity-70" />
            Team Roster
          </h3>
        </CardHeader>
        <CardContent className={cn(CARD_BODY_CLS, "py-3")}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {team.characters.map((charId, i) => {
              if (!charId)
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center opacity-20 py-4"
                  >
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-border/50" />
                  </div>
                );

              const char = charactersById[charId];
              const weaponId = team.weapons[i];
              const weapon = weaponId ? weaponsById[weaponId] : null;
              const charHasOption = getEntityOption(charId) != null;
              const weaponHasOption =
                weaponId != null && getEntityOption(weaponId) != null;

              return (
                <div
                  key={i}
                  className="flex flex-col gap-2 p-3 rounded-lg bg-black/10 border border-border/10"
                >
                  {/* Row 1: All icons in same row, bottom-aligned */}
                  <div className="flex items-end gap-1.5">
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div className="cursor-help shrink-0">
                          <ItemIcon
                            imagePath={char?.imagePath || ""}
                            rarity={char?.rarity || 5}
                            size="xl"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="p-0 border-0 shadow-xl pointer-events-none"
                      >
                        <CharacterTooltip characterId={charId} />
                      </TooltipContent>
                    </Tooltip>

                    {weapon && (
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <div className="cursor-help shrink-0">
                            <ItemIcon
                              imagePath={weapon.imagePath}
                              rarity={weapon.rarity}
                              size="lg"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="p-0 border-0 shadow-xl pointer-events-none"
                        >
                          <WeaponTooltip weaponId={weaponId!} />
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {team.artifacts[i]?.type === "4pc" && (
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <div className="cursor-help shrink-0">
                            <ItemIcon
                              imagePath={
                                artifactsById[team.artifacts[i]!.setId]
                                  ?.imagePaths?.flower || ""
                              }
                              rarity={
                                artifactsById[team.artifacts[i]!.setId]
                                  ?.rarity || 5
                              }
                              size="lg"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="p-0 border-0 shadow-xl pointer-events-none"
                        >
                          <ArtifactTooltip setId={team.artifacts[i]!.setId} />
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {team.artifacts[i]?.type === "2pc+2pc" && (
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <div className="cursor-help shrink-0">
                            <DoubleItemIcon
                              imagePath1={
                                artifactsById[
                                  artifactHalfSetsById[team.artifacts[i]!.id1]
                                    ?.setIds[0]
                                ]?.imagePaths?.flower || ""
                              }
                              imagePath2={
                                artifactsById[
                                  artifactHalfSetsById[team.artifacts[i]!.id2]
                                    ?.setIds[0]
                                ]?.imagePaths?.flower || ""
                              }
                              size="lg"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="p-0 border-0 shadow-xl pointer-events-none"
                        >
                          <MixedSetTooltip
                            id1={team.artifacts[i]!.id1}
                            id2={team.artifacts[i]!.id2}
                          />
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Row 2: Name + Min. ER */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-base text-foreground/90 truncate">
                      {t.character(charId)}
                    </span>
                    <div className="flex items-center gap-1.5 bg-secondary/60 rounded-md px-2.5 py-1.5 border border-border/30 shrink-0">
                      <span className="text-xs font-bold text-foreground/70">
                        Min. ER
                      </span>
                      <Input
                        type="number"
                        min={100}
                        max={400}
                        step={5}
                        value={Math.round((team.targetEr[charId] ?? 1.0) * 100)}
                        onChange={(e) => {
                          const val = Number(e.target.value) / 100;
                          if (!Number.isNaN(val)) {
                            updateTeam(team.id, {
                              targetEr: {
                                ...team.targetEr,
                                [charId]: val,
                              },
                            });
                          }
                        }}
                        className="w-12 h-6 text-center text-sm font-bold bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs font-bold text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Per-character combat options */}
                  {(charHasOption || weaponHasOption) && (
                    <div className="w-full border-t border-border/15 pt-2 mt-1 space-y-0">
                      {charHasOption && renderOption(charId, false)}
                      {weaponHasOption &&
                        weaponId &&
                        renderOption(weaponId, true)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════
          Tabs + Card 2 — Current Equipment & Damage (collapsible)
         ══════════════════════════════════════════════════════════ */}
      <div>
        {allFormulas.length > 0 ? (
          <FormulaTabBar
            formulas={allFormulas}
            selectedTab={activeTab}
            onSelect={(charId, formulaId) =>
              updateTeam(team.id, {
                selectedFormula: { charId, formulaId },
              })
            }
            t={t}
          />
        ) : (
          buildError && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-lg text-sm mx-1">
              <span className="font-bold">Setup Error:</span> {buildError}
            </div>
          )
        )}

        <Collapsible open={metricOpen} onOpenChange={setMetricOpen}>
          <Card className={cn(CARD_CLS, "rounded-tl-none")}>
            <CollapsibleTrigger asChild>
              <CardHeader
                className={cn(CARD_HEADER_CLS, "cursor-pointer select-none")}
              >
                <div className="flex items-center justify-between w-full">
                  <h3 className={CARD_TITLE_CLS}>
                    <Play className="w-4 h-4 opacity-70" />
                    Current Equipment & Damage
                  </h3>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-primary-foreground/50 transition-transform",
                      metricOpen && "rotate-180"
                    )}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className={CARD_BODY_CLS}>
                <DamageCardBody
                  team={team}
                  hasFormula={resolvedFormula != null}
                  emptyMessage="Configure characters and weapons to see damage metrics."
                  artifactsByChar={equippedArtifactsByChar}
                  damageLabel="Current Equipped Damage"
                  damageValue={currentDamage?.totalDamage ?? null}
                  damageColorCls="text-primary"
                  t={t}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Tabs + Card 3 — Optimization Results (independent tabs)
         ══════════════════════════════════════════════════════════ */}
      <div>
        {allFormulas.length > 0 && (
          <FormulaTabBar
            formulas={allFormulas}
            selectedTab={activeOptTab}
            onSelect={(_charId, _formulaId) =>
              setOptFormulaTab(`${_charId}.${_formulaId}`)
            }
            t={t}
          />
        )}

        <Card
          className={cn(CARD_CLS, allFormulas.length > 0 && "rounded-tl-none")}
        >
          <CardHeader className={CARD_HEADER_CLS}>
            <div className="flex items-center justify-between w-full">
              <h3 className={CARD_TITLE_CLS}>
                <Loader2
                  className={cn(
                    "w-4 h-4 opacity-70",
                    isComputing && "animate-spin"
                  )}
                />
                Optimization Results
              </h3>
              <Button
                onClick={handleOptimize}
                disabled={isComputing || !resolvedOptFormula}
                size="sm"
                className="gap-1.5 font-bold px-4 shadow-md text-xs"
              >
                {isComputing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {isComputing ? "Optimizing…" : "Run Optimization"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className={CARD_BODY_CLS}>
            {/* Empty state */}
            {!isComputing && !optResult && (
              <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                <Swords className="w-8 h-8 opacity-15" />
                <p>
                  Press{" "}
                  <strong className="text-foreground/70">
                    Run Optimization
                  </strong>{" "}
                  to find the best artifact loadout.
                </p>
              </div>
            )}

            {/* Progress bar */}
            {isComputing && optResult && (
              <div className="space-y-2 bg-black/15 p-3 rounded-lg border border-border/20">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="font-semibold">Searching combinations…</span>
                  <span className="font-mono font-bold">
                    {Math.round(optResult.progress * 100)}%
                  </span>
                </div>
                <Progress
                  value={optResult.progress * 100}
                  className="h-1.5 bg-black/40"
                />
                <div className="text-[10px] text-muted-foreground font-mono text-right opacity-60">
                  {optResult.combinationsEvaluated.toLocaleString()} /{" "}
                  {optResult.combinationsTotal.toLocaleString()}
                </div>
              </div>
            )}

            {/* Results — identical layout to Card 2 */}
            {optResult?.bestDamageResult && (
              <DamageCardBody
                team={team}
                hasFormula
                emptyMessage=""
                artifactsByChar={optimizedArtifactsByChar}
                targetCharId={resolvedOptFormula?.charId}
                damageLabel="Maximized Damage"
                damageValue={optResult.bestDamage}
                damageColorCls="text-green-400"
                t={t}
              />
            )}

            {/* No results found */}
            {optResult?.done && !optResult.bestDamageResult && (
              <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border/30 rounded-lg bg-black/10">
                No valid combinations found for ER{" "}
                {Math.round(targetErRaw * 100)}%.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
