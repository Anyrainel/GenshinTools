import { ItemPicker } from "@/components/shared/ItemPicker";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type { ArtifactData, WeaponResource } from "@/data/types";
import { useAsyncOptimizer } from "@/hooks/useAsyncOptimizer";
import { useGameStats } from "@/hooks/useGameStats";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  type BuildMatchResult,
  matchBuild,
} from "@/lib/account-data/artifactScore";
import {
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
} from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet, getEntityOption } from "@/lib/team-comp/damageModels";
import type { CalcContext, I18nLabel } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { type Team, useTeamStore } from "@/stores/useTeamStore";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  Loader2,
  Play,
  Swords,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DamageCardBody, FormulaTabBar } from "./DamageCardBody";
import { buildTeamConfigs } from "./teamOptUtils";
import type { TeamOptDetailProps } from "./teamOptUtils";

const CARD_CLS = "bg-gradient-card border-border/50 overflow-hidden shadow-lg";
const CARD_HEADER_CLS =
  "bg-gradient-select border-b border-border/40 py-3 px-4 md:px-6";
const CARD_TITLE_CLS =
  "text-base font-bold flex items-center gap-2 tracking-tight text-primary-foreground/90";
const CARD_BODY_CLS = "p-4 md:px-6 md:py-5 bg-black/10";

export function TeamOptDetail({ team, onBack }: TeamOptDetailProps) {
  const { t } = useLanguage();
  const accountData = useAccountStore((state) => state.accountData);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const scoreConfig = useArtifactScoreStore((state) => state.config);
  const { characterStats, weaponStats } = useGameStats();
  const buildGroups = useAllResolvedBuilds();

  const optimizerBuildMatchByChar = useMemo(() => {
    if (!accountData) return {};
    const map: Record<string, BuildMatchResult | null> = {};
    for (const group of buildGroups) {
      const char = accountData.characters.find(
        (c) => c.key === group.characterId
      );
      if (!char) continue;
      map[group.characterId] = matchBuild(
        char.artifacts ?? {},
        group.builds,
        char.constellation
      );
    }
    return map;
  }, [accountData, buildGroups]);

  const [metricOpen, setMetricOpen] = useState(true);
  // Independent formula selection for Card 3 (optimizer)
  const [optFormulaTab, setOptFormulaTab] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [localCharacters, setLocalCharacters] = useState(team.characters);
  const [localWeapons, setLocalWeapons] = useState(team.weapons);
  const [localArtifacts, setLocalArtifacts] = useState(team.artifacts);

  // Reset when team.id changes (component also remounts on team switch)
  useEffect(() => {
    setLocalCharacters(team.characters);
    setLocalWeapons(team.weapons);
    setLocalArtifacts(team.artifacts);
  }, [team.id]);

  const effectiveTeam = useMemo(
    (): Team => ({
      ...team,
      characters: localCharacters,
      weapons: localWeapons,
      artifacts: localArtifacts,
    }),
    [team, localCharacters, localWeapons, localArtifacts]
  );

  const {
    result: optResult,
    isComputing,
    error: optError,
    start: startOpt,
    stop: stopOpt,
  } = useAsyncOptimizer();

  useEffect(() => {
    return () => stopOpt();
  }, [stopOpt]);

  const configs = useMemo(
    () => buildTeamConfigs(effectiveTeam, accountData),
    [effectiveTeam, accountData]
  );

  const { teamBuild, buildError } = useMemo(() => {
    try {
      return {
        teamBuild: new TeamBuild(configs, team.opts || {}),
        buildError: null,
      };
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
    for (const charId of effectiveTeam.characters) {
      if (!charId) continue;
      const acctChar = accountData.characters.find((c) => c.key === charId);
      if (!acctChar) continue;
      const artifacts = Object.values(acctChar.artifacts || {});
      sheets[charId] = StatSheet.fromArtifacts(artifacts);
    }
    return sheets;
  }, [accountData, effectiveTeam.characters]);

  const handleOptionChange = (entityId: string, val: string) => {
    updateTeam(team.id, { opts: { ...(team.opts || {}), [entityId]: val } });
  };

  /** Render a single combat option toggle/select. */
  const renderOption = (entityId: string, isWeapon: boolean) => {
    const schema = getEntityOption(entityId);
    if (!schema) return null;

    const value = team.opts?.[entityId] || schema.default;
    const resource = isWeapon
      ? weaponsById[entityId]
      : charactersById[entityId];
    if (!resource) return null;

    return (
      <div key={entityId} className="flex justify-center py-1.5 w-full">
        <div className="flex items-center gap-2 max-w-full">
          <div className="w-6 h-6 rounded-full bg-secondary/30 overflow-hidden shrink-0 border border-border/30">
            <img
              src={getAssetUrl(resource.imagePath)}
              alt={entityId}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-medium text-xs text-foreground/70 shrink-0 min-w-0 truncate max-w-[100px]">
            {t.resolveLabel(schema.label)}
          </span>

          {schema.choices.length === 2 ? (
            <div className="flex bg-secondary/50 rounded-md p-0.5 shrink-0">
              {schema.choices.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => handleOptionChange(entityId, c.value)}
                  className={cn(
                    "px-2.5 py-0.5 text-xs font-semibold rounded transition-all",
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
              <SelectTrigger className="w-[140px] h-7 text-xs">
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
      </div>
    );
  };

  const validCharIds = Object.keys(availableFormulas);

  const allFormulas = useMemo(() => {
    const list: { charId: string; formulaId: string; label: I18nLabel }[] = [];
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

  const activeContext = useMemo<CalcContext>(() => {
    return {
      enemyLevel: team.calcContext?.enemyLevel ?? 110,
      enemyRes: team.calcContext?.enemyRes ?? 0.1,
      assumeCrit: team.calcContext?.assumeCrit ?? false,
    };
  }, [team.calcContext]);

  const currentDamage = useMemo(() => {
    if (!teamBuild || !resolvedFormula) return null;
    try {
      const { charId, formulaId } = resolvedFormula;

      const formulas = teamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;

      const postStats = teamBuild.getTeamStats(artifactSheets, charId);

      return teamBuild.getDamageResult(
        charId,
        formulaId,
        postStats,
        activeContext
      );
    } catch (e) {
      console.error("Damage calc failed:", e);
      return null;
    }
  }, [teamBuild, resolvedFormula, artifactSheets, activeContext]);

  const currentDisplayResult = useMemo(() => {
    if (!teamBuild || !resolvedFormula) return null;
    try {
      const { charId, formulaId } = resolvedFormula;

      const formulas = teamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;

      return teamBuild.getDisplayResult(
        charId,
        formulaId,
        artifactSheets,
        activeContext
      );
    } catch (e) {
      console.error("Display calc failed:", e);
      return null;
    }
  }, [teamBuild, resolvedFormula, artifactSheets, activeContext]);

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
    (resolvedOptFormula && team.targetEr?.[resolvedOptFormula.charId]) ?? 1.0;

  const handleOptimize = () => {
    if (!teamBuild || !accountData || !resolvedOptFormula) return;

    const inventory = [
      ...accountData.extraArtifacts,
      ...accountData.characters.flatMap((c) =>
        Object.values(c.artifacts || {})
      ),
    ];

    const { charId, formulaId } = resolvedOptFormula;
    const buildMatch = optimizerBuildMatchByChar[charId];
    if (!buildMatch) return;

    // Use GOAL sets as optimizer constraints (not equipped sets)
    const charIdx = effectiveTeam.characters.indexOf(charId);
    const goalArt = charIdx >= 0 ? effectiveTeam.artifacts[charIdx] : undefined;
    let goalSetId: string | null = null;
    let goalHalfSetIds: string[] = [];
    if (goalArt?.type === "4pc") {
      goalSetId = goalArt.setId;
    } else if (goalArt?.type === "2pc+2pc") {
      goalHalfSetIds = [String(goalArt.id1), String(goalArt.id2)];
    }

    startOpt({
      teamBuild,
      targetCharId: charId,
      formulaId,
      targetEr: targetErRaw,
      inventory,
      buildMatch,
      globalConfig: scoreConfig.global,
      baseSheets: artifactSheets,
      calcContext: {
        enemyLevel: 110,
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
    for (const cid of effectiveTeam.characters) {
      if (!cid) continue;
      const acctChar = accountData?.characters.find((c) => c.key === cid);
      map[cid] = (acctChar?.artifacts || {}) as Record<string, ArtifactData>;
    }
    return map;
  }, [effectiveTeam.characters, accountData]);

  const optimizedArtifactsByChar = useMemo(() => {
    if (!optResult?.bestDamageResult) return equippedArtifactsByChar;
    const map = { ...equippedArtifactsByChar };
    const targetId = resolvedOptFormula?.charId;
    if (targetId) {
      map[targetId] = optResult.bestArtifacts as Record<string, ArtifactData>;
    }
    return map;
  }, [optResult, equippedArtifactsByChar, resolvedOptFormula]);

  const optArtifactSheets = useMemo(() => {
    const sheets: Record<string, StatSheet> = {};
    for (const charId of effectiveTeam.characters) {
      if (!charId) continue;
      const artifacts = Object.values(optimizedArtifactsByChar[charId] || {});
      sheets[charId] = StatSheet.fromArtifacts(artifacts);
    }
    return sheets;
  }, [optimizedArtifactsByChar, effectiveTeam.characters]);

  const optimizedDisplayResult = useMemo(() => {
    if (!teamBuild || !resolvedOptFormula || !optResult?.bestDamageResult)
      return null;
    try {
      const { charId, formulaId } = resolvedOptFormula;

      const formulas = teamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;

      return teamBuild.getDisplayResult(
        charId,
        formulaId,
        optArtifactSheets,
        activeContext
      );
    } catch (e) {
      console.error("Opt display calc failed:", e);
      return null;
    }
  }, [
    teamBuild,
    resolvedOptFormula,
    optArtifactSheets,
    optResult,
    activeContext,
  ]);

  const handleClearTeam = () => {
    updateTeam(team.id, {
      characters: [null, null, null, null],
      weapons: [null, null, null, null],
      artifacts: [null, null, null, null],
      opts: {},
      selectedFormula: null,
      targetEr: {},
    });
    setLocalCharacters([null, null, null, null]);
    setLocalWeapons([null, null, null, null]);
    setLocalArtifacts([null, null, null, null]);
    setRenderError(null);
  };

  if (renderError) {
    return (
      <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300 pb-12">
        <div className="flex items-center gap-3 px-1">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5 text-foreground/70" />
          </Button>
          <h2 className="text-xl font-black text-destructive">
            {t.ui("teamComp.renderError")}
          </h2>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearTeam}
            className="ml-auto text-xs h-8"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {t.ui("teamComp.clearTeamData")}
          </Button>
        </div>
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-lg font-mono text-xs whitespace-pre-wrap overflow-auto">
          {renderError}
        </div>
      </div>
    );
  }

  try {
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
          <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/60 tracking-tight truncate flex-1">
            {team.name || t.ui("teamComp.teamOptimization")}
          </h2>
        </div>

        {/* ══════════════════════════════════════════════════════════
          Card 1 — Team Roster + Combat Options (always expanded)
         ══════════════════════════════════════════════════════════ */}
        <Card className={CARD_CLS}>
          <CardHeader className={cn(CARD_HEADER_CLS, "py-2.5")}>
            <h3 className={CARD_TITLE_CLS}>
              <Swords className="w-4 h-4 opacity-70" />
              {t.ui("teamComp.teamRoster")}
            </h3>
          </CardHeader>
          <CardContent className={cn(CARD_BODY_CLS, "py-3")}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {effectiveTeam.characters.map((charId, i) => {
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
                const weaponId = localWeapons[i];
                const weapon = weaponId ? weaponsById[weaponId] : null;
                const charHasOption = getEntityOption(charId) != null;
                const weaponHasOption =
                  weaponId != null && getEntityOption(weaponId) != null;

                const acctChar = accountData?.characters.find(
                  (c) => c.key === charId
                );
                const charLevel =
                  team.opts?.[`${charId}.overrideLevel`] !== undefined
                    ? Number(team.opts[`${charId}.overrideLevel`])
                    : acctChar
                      ? acctChar.level > 90
                        ? 100
                        : 90
                      : 90;
                const charConst =
                  team.opts?.[`${charId}.overrideConstellation`] !== undefined
                    ? Number(team.opts[`${charId}.overrideConstellation`])
                    : (acctChar?.constellation ?? 0);

                let defaultRefine = 1;
                if (weaponId && accountData) {
                  const ws = accountData.extraWeapons.filter(
                    (w) => w.key === weaponId
                  );
                  if (ws.length > 0)
                    defaultRefine = Math.max(...ws.map((w) => w.refinement));
                }
                const weaponRefine =
                  team.opts?.[`${charId}.overrideRefinement`] !== undefined
                    ? Number(team.opts[`${charId}.overrideRefinement`])
                    : defaultRefine;

                return (
                  <div
                    key={i}
                    className="flex flex-col gap-2 p-3 rounded-lg bg-black/10 border border-border/10"
                  >
                    {/* Row 1: Interactive icons */}
                    <div className="flex items-end gap-1.5">
                      <ItemPicker
                        type="character"
                        value={charId}
                        triggerSize="xl"
                        onChange={(newCharId) => {
                          setLocalCharacters((prev) => {
                            const next = [...prev];
                            next[i] = newCharId;
                            return next;
                          });
                          // Clear weapon if incompatible type
                          if (localWeapons[i]) {
                            const newChar = charactersById[newCharId];
                            const curWeapon = weaponsById[localWeapons[i]!];
                            if (newChar && curWeapon) {
                              const newMeta = getCharacterDisplayMeta(
                                newChar,
                                characterStats?.[newCharId]
                              );
                              const wMeta = getWeaponDisplayMeta(
                                curWeapon,
                                weaponStats?.[localWeapons[i]!]
                              );
                              if (
                                newMeta.weaponType &&
                                wMeta.type &&
                                newMeta.weaponType !== wMeta.type
                              ) {
                                setLocalWeapons((prev) => {
                                  const next = [...prev];
                                  next[i] = null;
                                  return next;
                                });
                              }
                            }
                          }
                        }}
                      />
                      <ItemPicker
                        type="weapon"
                        value={localWeapons[i]}
                        triggerSize="lg"
                        disabled={!charId}
                        filter={(() => {
                          if (!char) return undefined;
                          const meta = getCharacterDisplayMeta(
                            char,
                            characterStats?.[charId]
                          );
                          if (!meta.weaponType) return undefined;
                          const wType = meta.weaponType;
                          return (item: unknown) => {
                            const w = item as WeaponResource;
                            const wMeta = getWeaponDisplayMeta(
                              w,
                              weaponStats?.[w.id]
                            );
                            return wMeta.type === wType;
                          };
                        })()}
                        onChange={(newWeaponId) => {
                          setLocalWeapons((prev) => {
                            const next = [...prev];
                            next[i] = newWeaponId;
                            return next;
                          });
                        }}
                      />
                      <ItemPicker
                        type="artifact"
                        value={localArtifacts[i]}
                        triggerSize="lg"
                        disabled={!charId}
                        onChange={(newArtifact) => {
                          setLocalArtifacts((prev) => {
                            const next = [...prev];
                            next[i] = newArtifact;
                            return next;
                          });
                        }}
                      />
                    </div>

                    {/* Row 2: Name + Min. ER */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold text-lg text-foreground/90 ml-2">
                        {t.character(charId)}
                      </span>
                      <div className="flex items-center gap-1.5 bg-secondary/60 rounded-md px-2.5 py-1.5 border border-border/30 shrink-0">
                        <span className="text-xs font-bold text-foreground/70">
                          {t.ui("teamComp.minEr")}
                        </span>
                        <Input
                          type="number"
                          min={100}
                          max={400}
                          step={5}
                          value={Math.round(
                            (team.targetEr[charId] ?? 1.0) * 100
                          )}
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
                        <span className="text-xs font-bold text-muted-foreground mr-2">
                          %
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Overrides */}
                    <div className="flex items-start gap-1.5 justify-between bg-black/10 px-1.5 rounded-md border border-border/10">
                      <div className="flex flex-col gap-1 w-full shrink pr-0.5">
                        <span
                          className="text-xs uppercase font-bold text-muted-foreground/70 px-1 line-clamp-1 break-all"
                          title={t.ui("teamComp.overrideLevel")}
                        >
                          {t.ui("teamComp.overrideLevel")}
                        </span>
                        <Select
                          value={String(charLevel)}
                          onValueChange={(v) =>
                            handleOptionChange(`${charId}.overrideLevel`, v)
                          }
                        >
                          <SelectTrigger className="h-6 px-1.5 text-xs w-full bg-black/20 border-border/10 focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="90">Lv. 90</SelectItem>
                            <SelectItem value="100">Lv. 100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-1 w-full shrink px-0.5 border-l border-border/10">
                        <span
                          className="text-xs uppercase font-bold text-muted-foreground/70 px-1 line-clamp-1 break-all"
                          title={t.ui("teamComp.overrideConst")}
                        >
                          {t.ui("teamComp.overrideConst")}
                        </span>
                        <Select
                          value={String(charConst)}
                          onValueChange={(v) =>
                            handleOptionChange(
                              `${charId}.overrideConstellation`,
                              v
                            )
                          }
                        >
                          <SelectTrigger className="h-6 px-1.5 text-xs w-full bg-black/20 border-border/10 focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                              <SelectItem key={c} value={String(c)}>
                                C{c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {weaponId && (
                        <div className="flex flex-col gap-1 w-full shrink pl-0.5 border-l border-border/10">
                          <span
                            className="text-xs uppercase font-bold text-muted-foreground/70 px-1 line-clamp-1 break-all"
                            title={t.ui("teamComp.overrideRefine")}
                          >
                            {t.ui("teamComp.overrideRefine")}
                          </span>
                          <Select
                            value={String(weaponRefine)}
                            onValueChange={(v) =>
                              handleOptionChange(
                                `${charId}.overrideRefinement`,
                                v
                              )
                            }
                          >
                            <SelectTrigger className="h-6 px-1.5 text-xs w-full bg-black/20 border-border/10 focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map((r) => (
                                <SelectItem key={r} value={String(r)}>
                                  R{r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Per-character combat options */}
                    {(charHasOption || weaponHasOption) && (
                      <div className="w-full border-t border-border/15 mt-1 space-y-0">
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
            {/* Global Context Setup */}
            <div className="mt-4 pt-4 border-t border-border/10 flex flex-wrap items-center gap-y-3">
              <span className="text-sm font-semibold text-foreground/80 shrink-0 w-full sm:w-auto text-center sm:text-left">
                {t.ui("teamComp.calcContextOptions")}
              </span>
              <div className="flex flex-1 justify-center items-center gap-x-8 gap-y-3 flex-wrap opacity-90">
                <div className="flex items-center gap-2 group">
                  <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors select-none">
                    {t.ui("teamComp.enemyLevel")}
                  </span>
                  <Input
                    type="number"
                    value={activeContext.enemyLevel}
                    onChange={(e) =>
                      updateTeam(team.id, {
                        calcContext: {
                          ...team.calcContext,
                          enemyLevel: Number(e.target.value) || 100,
                        },
                      })
                    }
                    className="h-7 w-20 text-xs text-center border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0"
                    min={1}
                    max={150}
                  />
                </div>
                <div className="flex items-center gap-2 group">
                  <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors select-none">
                    {t.ui("teamComp.enemyRes")}
                  </span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={Math.round(activeContext.enemyRes * 100)}
                      onChange={(e) =>
                        updateTeam(team.id, {
                          calcContext: {
                            ...team.calcContext,
                            enemyRes: (Number(e.target.value) || 0) / 100,
                          },
                        })
                      }
                      className="h-7 w-16 text-xs text-center border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs font-bold text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 cursor-pointer group select-none"
                  onClick={() =>
                    updateTeam(team.id, {
                      calcContext: {
                        ...team.calcContext,
                        assumeCrit: !activeContext.assumeCrit,
                      },
                    })
                  }
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded appearance-none border border-border/30 flex items-center justify-center transition-colors shadow-sm cursor-pointer",
                      activeContext.assumeCrit
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background/50"
                    )}
                  >
                    {activeContext.assumeCrit && <Check className="w-3 h-3" />}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {t.ui("teamComp.assumeCrit")}
                  </span>
                </div>
              </div>
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
                <span className="font-bold">{t.ui("teamComp.setupError")}</span>{" "}
                {buildError}
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
                      <Eye className="w-4 h-4 opacity-70" />
                      {t.ui("teamComp.currentEquipAndDamage")}
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
                    emptyMessage={t.ui("teamComp.emptyDamageMessage")}
                    artifactsByChar={equippedArtifactsByChar}
                    targetCharId={resolvedFormula?.charId}
                    damageValue={currentDamage?.totalDamage ?? null}
                    displayResult={currentDisplayResult}
                    t={t}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
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
            className={cn(
              CARD_CLS,
              allFormulas.length > 0 && "rounded-tl-none"
            )}
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
                  {t.ui("teamComp.optimizationResults")}
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
                  {isComputing
                    ? t.ui("teamComp.optimizing")
                    : t.ui("teamComp.runOptimization")}
                </Button>
              </div>
            </CardHeader>

            <CardContent className={CARD_BODY_CLS}>
              {/* Empty state */}
              {!isComputing && !optResult && !optError && (
                <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                  <Swords className="w-8 h-8 opacity-15" />
                  <p>{t.ui("teamComp.emptyOptMessage")}</p>
                </div>
              )}

              {/* Error state */}
              {optError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm">
                  <span className="font-bold">
                    {t.ui("teamComp.optimizerError")}
                  </span>{" "}
                  {optError.message}
                </div>
              )}

              {/* Waiting for first progress */}
              {isComputing && !optResult && (
                <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 opacity-30 animate-spin" />
                  <p>{t.ui("teamComp.preparingOptimizer")}</p>
                </div>
              )}

              {/* Progress bar */}
              {isComputing && optResult && (
                <div className="space-y-2 bg-black/15 p-3 rounded-lg border border-border/20">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-semibold">
                      {t.ui("teamComp.searchingCombinations")}
                    </span>
                    <span className="font-mono font-bold">
                      {Math.round(optResult.progress * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={optResult.progress * 100}
                    className="h-1.5 bg-black/40"
                  />
                  <div className="text-xs text-muted-foreground font-mono text-right opacity-60">
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
                  damageValue={optResult.bestDamage}
                  displayResult={optimizedDisplayResult}
                  t={t}
                />
              )}

              {/* No results found */}
              {optResult?.done && !optResult.bestDamageResult && (
                <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border/30 rounded-lg bg-black/10">
                  {t
                    .ui("teamComp.noValidCombinations")
                    .replace("{0}", String(Math.round(targetErRaw * 100)))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (e: unknown) {
    // Try-catch block specifically to catch pure render-phase crashes
    // Use queueMicrotask to avoid React "cannot update during render" warning
    queueMicrotask(() => {
      setRenderError(e instanceof Error ? e.stack || e.message : String(e));
    });
    return null;
  }
}
