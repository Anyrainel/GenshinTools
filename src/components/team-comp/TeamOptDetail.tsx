import { ItemPicker } from "@/components/shared/ItemPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  artifactHalfSetsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import type {
  ArtifactData,
  CharacterData,
  Slot,
  WeaponResource,
} from "@/data/types";
import { useAsyncIdealGen } from "@/hooks/useAsyncIdealGen";
import { useAsyncTeamOptimizer } from "@/hooks/useAsyncTeamOptimizer";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { type Team, useTeamStore } from "@/stores/useTeamStore";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Play,
  Swords,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DamageCardBody, FormulaTabBar } from "./DamageCardBody";
import { buildTeamConfigs } from "./teamOptUtils";
import type { TeamOptDetailProps } from "./teamOptUtils";

const CARD_CLS = "bg-gradient-card border-border/50 overflow-hidden shadow-lg";
const CARD_HEADER_CLS =
  "bg-gradient-select border-b border-border/40 py-3 px-2 md:px-5";
const CARD_TITLE_CLS =
  "text-base font-bold flex items-center gap-2 tracking-tight text-primary-foreground/90";
const CARD_BODY_CLS = "p-1.5 md:p-3 bg-black/10";

export function TeamOptDetail({ team, onBack }: TeamOptDetailProps) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const scoreConfig = useArtifactScoreStore((state) => state.config);
  const { characterStats, weaponStats } = useGameStats();
  const buildGroups = useAllResolvedBuilds();

  const optimizerBuildMatchByChar = useMemo(() => {
    if (!accountData) return {};
    const map: Record<string, BuildMatchResult | null> = {};
    for (const group of buildGroups) {
      const char = accountData.characters.find(
        (c: CharacterData) => c.key === group.characterId
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

  // Independent formula selection for Card 3 (optimizer)
  const [optFormulaTab, setOptFormulaTab] = useState<string | null>(null);

  const [localCharacters, setLocalCharacters] = useState(team.characters);
  const [localWeapons, setLocalWeapons] = useState(team.weapons);
  const [localArtifacts, setLocalArtifacts] = useState(team.artifacts);

  // Reset when team changes (component also remounts on team switch)
  useEffect(() => {
    setLocalCharacters(team.characters);
    setLocalWeapons(team.weapons);
    setLocalArtifacts(team.artifacts);
  }, [team.characters, team.weapons, team.artifacts]);

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
    progress: teamProgress,
    result: teamResult,
    isComputing,
    error: teamError,
    start: startTeamOpt,
    stop: stopTeamOpt,
  } = useAsyncTeamOptimizer();

  useEffect(() => {
    return () => {
      stopTeamOpt();
    };
  }, [stopTeamOpt]);

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
      const acctChar = accountData.characters.find(
        (c: CharacterData) => c.key === charId
      );
      if (!acctChar) continue;
      const artifacts = Object.values(
        acctChar.artifacts || {}
      ) as ArtifactData[];
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
              <SelectTrigger className="w-[140px] h-7 text-xs [&>span]:text-center [&>span]:w-full">
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
      critRateTarget: team.calcContext?.critRateTarget,
    };
  }, [team.calcContext]);

  const displayContext = useMemo<CalcContext>(
    () => ({ ...activeContext, critRateTarget: undefined }),
    [activeContext]
  );

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
        displayContext
      );
    } catch (e) {
      console.error("Damage calc failed:", e);
      return null;
    }
  }, [teamBuild, resolvedFormula, artifactSheets, displayContext]);

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
        displayContext
      );
    } catch (e) {
      console.error("Display calc failed:", e);
      return null;
    }
  }, [teamBuild, resolvedFormula, artifactSheets, displayContext]);

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

  /** Get goal set constraints for a character by index */
  const getGoalSets = (charId: string) => {
    const charIdx = effectiveTeam.characters.indexOf(charId);
    const goalArt = charIdx >= 0 ? effectiveTeam.artifacts[charIdx] : undefined;
    let goalSetId: string | null = null;
    let goalHalfSetIds: string[] = [];
    if (goalArt?.type === "4pc") {
      goalSetId = goalArt.setId;
    } else if (goalArt?.type === "2pc+2pc") {
      goalHalfSetIds = [String(goalArt.id1), String(goalArt.id2)];
    }
    return { goalSetId, goalHalfSetIds };
  };

  const getInventory = () => {
    if (!accountData) return [];
    return [
      ...accountData.extraArtifacts,
      ...accountData.characters.flatMap((c: CharacterData) =>
        (
          Object.values(c.artifacts || {}) as (ArtifactData | undefined)[]
        ).filter((a): a is ArtifactData => !!a)
      ),
    ];
  };

  const handleOptimize = () => {
    if (!teamBuild || !accountData || !resolvedOptFormula) return;

    const { charId: carryCharId, formulaId } = resolvedOptFormula;

    // Build perChar config for all team members
    const perChar: Record<
      string,
      {
        targetEr: number;
        buildMatch: import("@/lib/account-data/artifactScore").BuildMatchResult;
        artifactSetId?: string | null;
        artifactHalfSetIds?: string[];
      }
    > = {};

    for (const cid of effectiveTeam.characters) {
      if (!cid) continue;
      const bm = optimizerBuildMatchByChar[cid];
      if (!bm) continue;
      const { goalSetId, goalHalfSetIds } = getGoalSets(cid);
      perChar[cid] = {
        targetEr: team.targetEr?.[cid] ?? 1.0,
        buildMatch: bm,
        artifactSetId: goalSetId,
        artifactHalfSetIds: goalHalfSetIds,
      };
    }

    // Build optimizer-specific TeamBuild with goal sets instead of detected
    // equipped sets. This ensures the optimizer evaluates damage with the
    // correct set bonuses (e.g. 4pc goal) even when the user's currently
    // equipped artifacts only form a partial set (e.g. single 2pc).
    const optimizerConfigs = configs.map((c) => {
      const { goalSetId, goalHalfSetIds } = getGoalSets(c.charId);
      if (goalSetId || goalHalfSetIds.length > 0) {
        return {
          ...c,
          artifactSetId: goalSetId,
          artifactHalfSetIds: goalHalfSetIds,
        };
      }
      return c;
    });

    let optTeamBuild: TeamBuild;
    try {
      optTeamBuild = new TeamBuild(optimizerConfigs, team.opts || {});
    } catch {
      // Fall back to shared teamBuild if goal-set construction fails
      optTeamBuild = teamBuild;
    }

    startTeamOpt({
      teamBuild: optTeamBuild,
      carryCharId,
      formulaId,
      inventory: getInventory(),
      calcContext: activeContext,
      globalConfig: scoreConfig.global,
      baseSheets: artifactSheets,
      perChar,
    });
  };

  // Build artifact maps for Card 2 (current equipped) and Card 3 (optimized)
  const equippedArtifactsByChar = useMemo(() => {
    const map: Record<string, Record<string, ArtifactData>> = {};
    for (const cid of effectiveTeam.characters) {
      if (!cid) continue;
      const acctChar = accountData?.characters.find(
        (c: CharacterData) => c.key === cid
      );
      map[cid] = (acctChar?.artifacts || {}) as Record<string, ArtifactData>;
    }
    return map;
  }, [effectiveTeam.characters, accountData]);

  const optimizedArtifactsByChar = useMemo(() => {
    if (!teamResult?.bestDamageResult) return equippedArtifactsByChar;
    const map = { ...equippedArtifactsByChar };
    for (const [charId, arts] of Object.entries(
      teamResult.bestArtifactsByChar
    )) {
      map[charId] = arts as Record<string, ArtifactData>;
    }
    return map;
  }, [teamResult, equippedArtifactsByChar]);

  const optArtifactSheets = useMemo(() => {
    const sheets: Record<string, StatSheet> = {};
    for (const charId of effectiveTeam.characters) {
      if (!charId) continue;
      const artifacts = Object.values(optimizedArtifactsByChar[charId] || {});
      sheets[charId] = StatSheet.fromArtifacts(artifacts);
    }
    return sheets;
  }, [optimizedArtifactsByChar, effectiveTeam.characters]);

  const hasOptResult = teamResult?.bestDamageResult;

  const optimizedDamage = useMemo(() => {
    if (!teamBuild || !resolvedOptFormula || !hasOptResult) return null;
    try {
      const { charId, formulaId } = resolvedOptFormula;
      const formulas = teamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;
      const postStats = teamBuild.getTeamStats(optArtifactSheets, charId);
      return teamBuild.getDamageResult(
        charId,
        formulaId,
        postStats,
        displayContext
      );
    } catch (e) {
      console.error("Opt damage calc failed:", e);
      return null;
    }
  }, [
    teamBuild,
    resolvedOptFormula,
    optArtifactSheets,
    hasOptResult,
    displayContext,
  ]);

  const optimizedDisplayResult = useMemo(() => {
    if (!teamBuild || !resolvedOptFormula || !hasOptResult) return null;
    try {
      const { charId, formulaId } = resolvedOptFormula;

      const formulas = teamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;

      return teamBuild.getDisplayResult(
        charId,
        formulaId,
        optArtifactSheets,
        displayContext
      );
    } catch (e) {
      console.error("Opt display calc failed:", e);
      return null;
    }
  }, [
    teamBuild,
    resolvedOptFormula,
    optArtifactSheets,
    hasOptResult,
    displayContext,
  ]);

  // ─── Ideal Artifact Generator (dev only) ───

  const [idealFormulaTab, setIdealFormulaTab] = useState<string | null>(null);
  const [idealCritTarget, setIdealCritTarget] = useState<number | undefined>(
    undefined
  );
  const [idealRollMult, setIdealRollMult] = useState(0.85);

  const {
    result: idealResult,
    isComputing: idealComputing,
    error: idealError,
    start: startIdealGen,
    stop: stopIdealGen,
  } = useAsyncIdealGen();

  useEffect(() => {
    return () => {
      stopIdealGen();
    };
  }, [stopIdealGen]);

  const resolvedIdealFormula = useMemo(() => {
    if (!idealFormulaTab) return allFormulas[0] ?? null;
    const match = allFormulas.find(
      (f) => `${f.charId}.${f.formulaId}` === idealFormulaTab
    );
    return match ?? allFormulas[0] ?? null;
  }, [idealFormulaTab, allFormulas]);

  const activeIdealTab = resolvedIdealFormula
    ? `${resolvedIdealFormula.charId}.${resolvedIdealFormula.formulaId}`
    : "";

  const handleGenerateIdeal = () => {
    if (!teamBuild || !resolvedIdealFormula) return;
    const idealContext: CalcContext = {
      ...activeContext,
      critRateTarget: idealCritTarget,
    };

    // Build per-char, per-slot set keys for proper artifact icon rendering
    const setKeysByChar: Record<string, Record<Slot, string>> = {};
    for (let i = 0; i < effectiveTeam.characters.length; i++) {
      const cid = effectiveTeam.characters[i];
      if (!cid) continue;
      const artConfig = effectiveTeam.artifacts[i];
      if (!artConfig) continue;

      if (artConfig.type === "4pc") {
        const sk = artConfig.setId;
        setKeysByChar[cid] = {
          flower: sk,
          plume: sk,
          sands: sk,
          goblet: sk,
          circlet: sk,
        };
      } else if (artConfig.type === "2pc+2pc") {
        const hs1 = artifactHalfSetsById[String(artConfig.id1)];
        const hs2 = artifactHalfSetsById[String(artConfig.id2)];
        const sk1 = hs1?.setIds[0] ?? "ideal";
        const sk2 = hs2?.setIds[0] ?? "ideal";
        setKeysByChar[cid] = {
          flower: sk1,
          plume: sk1,
          sands: sk1,
          goblet: sk2,
          circlet: sk2,
        };
      }
    }

    startIdealGen({
      teamBuild,
      carryCharId: resolvedIdealFormula.charId,
      formulaId: resolvedIdealFormula.formulaId,
      calcContext: idealContext,
      setKeysByChar,
      rollMultiplier: idealRollMult,
    });
  };

  const idealArtifactsByChar = useMemo(() => {
    if (!idealResult?.done || !idealResult.artifactsByChar)
      return equippedArtifactsByChar;
    const map = { ...equippedArtifactsByChar };
    for (const [charId, arts] of Object.entries(idealResult.artifactsByChar)) {
      map[charId] = arts as Record<string, ArtifactData>;
    }
    return map;
  }, [idealResult, equippedArtifactsByChar]);

  const idealArtifactSheets = useMemo(() => {
    const sheets: Record<string, StatSheet> = {};
    for (const charId of effectiveTeam.characters) {
      if (!charId) continue;
      const artifacts = Object.values(idealArtifactsByChar[charId] || {});
      sheets[charId] = StatSheet.fromArtifacts(artifacts);
    }
    return sheets;
  }, [idealArtifactsByChar, effectiveTeam.characters]);

  const idealDisplayDamage = useMemo(() => {
    if (!teamBuild || !resolvedIdealFormula || !idealResult?.done) return null;
    try {
      const { charId, formulaId } = resolvedIdealFormula;
      const formulas = teamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;
      const postStats = teamBuild.getTeamStats(idealArtifactSheets, charId);
      return teamBuild.getDamageResult(
        charId,
        formulaId,
        postStats,
        displayContext
      );
    } catch (e) {
      console.error("Ideal damage calc failed:", e);
      return null;
    }
  }, [
    teamBuild,
    resolvedIdealFormula,
    idealArtifactSheets,
    idealResult?.done,
    displayContext,
  ]);

  const idealDisplayResult = useMemo(() => {
    if (!teamBuild || !resolvedIdealFormula || !idealResult?.done) return null;
    try {
      const { charId, formulaId } = resolvedIdealFormula;
      const formulas = teamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;
      return teamBuild.getDisplayResult(
        charId,
        formulaId,
        idealArtifactSheets,
        displayContext
      );
    } catch (e) {
      console.error("Ideal display calc failed:", e);
      return null;
    }
  }, [
    teamBuild,
    resolvedIdealFormula,
    idealArtifactSheets,
    idealResult?.done,
    displayContext,
  ]);

  return (
    <div
      className={cn(
        "flex flex-col w-full animate-in fade-in duration-300 pb-12",
        isMobile ? "gap-1.5" : "gap-2"
      )}
    >
      {/* ── Page Header ── */}
      <div
        className={cn("flex items-center gap-2", isMobile ? "px-0.5" : "px-1")}
      >
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
        <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
          <h3 className={CARD_TITLE_CLS}>
            <Swords className="w-4 h-4 opacity-70" />
            {t.ui("teamComp.teamRoster")}
          </h3>
        </CardHeader>
        <CardContent className={cn(CARD_BODY_CLS, "pt-1 2xl:pt-2")}>
          <div
            className={cn(
              "grid",
              isMobile
                ? "grid-cols-2 gap-1.5"
                : "grid-cols-2 lg:grid-cols-4 gap-3"
            )}
          >
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
                (c: CharacterData) => c.key === charId
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
                const refinements: number[] = [];
                for (const c of accountData.characters) {
                  if (c.weapon?.key === weaponId)
                    refinements.push(c.weapon.refinement);
                }
                for (const w of accountData.extraWeapons) {
                  if (w.key === weaponId) refinements.push(w.refinement);
                }
                if (refinements.length > 0)
                  defaultRefine = Math.max(...refinements);
              }
              const weaponRefine =
                team.opts?.[`${charId}.overrideRefinement`] !== undefined
                  ? Number(team.opts[`${charId}.overrideRefinement`])
                  : defaultRefine;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col rounded-lg bg-black/10 border border-border/10",
                    isMobile ? "p-1.5 gap-1" : "p-3 gap-2"
                  )}
                >
                  {/* Row 1: Interactive icons */}
                  <div
                    className={cn(
                      "flex items-end",
                      isMobile ? "gap-0.5" : "gap-1.5"
                    )}
                  >
                    <ItemPicker
                      type="character"
                      value={charId}
                      triggerSize={isMobile ? "sm" : "xl"}
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
                      triggerSize={isMobile ? "xs" : "lg"}
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
                      triggerSize={isMobile ? "xs" : "lg"}
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
                  <div
                    className={cn(
                      "flex items-center justify-between",
                      isMobile ? "gap-1" : "gap-4"
                    )}
                  >
                    <span
                      className={cn(
                        "font-bold text-foreground/90",
                        isMobile ? "text-xs ml-0.5 truncate" : "text-lg ml-2"
                      )}
                    >
                      {t.character(charId)}
                    </span>
                    <div
                      className={cn(
                        "flex items-center bg-secondary/60 rounded-md border border-border/30 shrink-0",
                        isMobile
                          ? "gap-0.5 px-1 py-0.5"
                          : "gap-1.5 px-2.5 py-1.5"
                      )}
                    >
                      <span
                        className={cn(
                          "font-bold text-foreground/70",
                          isMobile ? "text-[10px]" : "text-xs"
                        )}
                      >
                        {t.ui("teamComp.minEr")}
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
                        className={cn(
                          "text-center font-bold bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          isMobile ? "w-9 h-5 text-xs" : "w-12 h-6 text-sm"
                        )}
                      />
                      <span
                        className={cn(
                          "font-bold text-muted-foreground",
                          isMobile ? "text-[10px] mr-0.5" : "text-xs mr-2"
                        )}
                      >
                        %
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Overrides */}
                  <div
                    className={cn(
                      "flex items-start justify-between bg-black/10 rounded-md border border-border/10",
                      isMobile ? "gap-1 px-1" : "gap-1.5 px-1.5"
                    )}
                  >
                    <div className="flex flex-col gap-1 w-full shrink pr-0.5">
                      <span
                        className={cn(
                          "uppercase font-bold text-muted-foreground/70 line-clamp-1 break-all",
                          isMobile ? "text-[9px] px-0.5" : "text-xs px-1"
                        )}
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
                        <SelectTrigger
                          className={cn(
                            "w-full bg-black/20 border-border/10 focus:ring-0 [&>span]:text-center [&>span]:w-full",
                            isMobile
                              ? "h-5 px-1 text-[10px]"
                              : "h-6 px-1.5 text-xs"
                          )}
                        >
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
                        className={cn(
                          "uppercase font-bold text-muted-foreground/70 line-clamp-1 break-all",
                          isMobile ? "text-[9px] px-0.5" : "text-xs px-1"
                        )}
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
                        <SelectTrigger
                          className={cn(
                            "w-full bg-black/20 border-border/10 focus:ring-0 [&>span]:text-center [&>span]:w-full",
                            isMobile
                              ? "h-5 px-1 text-[10px]"
                              : "h-6 px-1.5 text-xs"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                            <SelectItem key={c} value={String(c)}>
                              {t.format("teamComp.constellationFormat", c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {weaponId && (
                      <div className="flex flex-col gap-1 w-full shrink pl-0.5 border-l border-border/10">
                        <span
                          className={cn(
                            "uppercase font-bold text-muted-foreground/70 line-clamp-1 break-all",
                            isMobile ? "text-[9px] px-0.5" : "text-xs px-1"
                          )}
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
                          <SelectTrigger
                            className={cn(
                              "w-full bg-black/20 border-border/10 focus:ring-0 [&>span]:text-center [&>span]:w-full",
                              isMobile
                                ? "h-5 px-1 text-[10px]"
                                : "h-6 px-1.5 text-xs"
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((r) => (
                              <SelectItem key={r} value={String(r)}>
                                {t.format("teamComp.refinementFormat", r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Per-character combat options */}
                  {(charHasOption || weaponHasOption) && (
                    <div className="w-full border-t border-border/15 space-y-0">
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
          <div
            className={cn(
              "pt-3 border-t border-border/10 flex flex-wrap items-center",
              isMobile ? "gap-y-1" : "gap-y-3"
            )}
          >
            {!isMobile && (
              <span className="text-sm font-semibold text-foreground/80 shrink-0 w-full sm:w-auto text-center sm:text-left">
                {t.ui("teamComp.calcContextOptions")}
              </span>
            )}
            <div
              className={cn(
                "flex flex-1 items-center flex-wrap",
                isMobile
                  ? "justify-between gap-x-3 gap-y-1"
                  : "justify-center gap-x-8 gap-y-3"
              )}
            >
              <div
                className={cn(
                  "flex items-center group",
                  isMobile ? "gap-1" : "gap-2"
                )}
              >
                <span
                  className={cn(
                    "font-semibold text-foreground/80 select-none",
                    isMobile ? "text-[10px]" : "text-xs"
                  )}
                >
                  {t.ui("teamComp.enemyLevel")}
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={activeContext.enemyLevel}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    if (e.target.value === "" || !Number.isNaN(num))
                      updateTeam(team.id, {
                        calcContext: {
                          ...team.calcContext,
                          enemyLevel: num || 100,
                        },
                      });
                  }}
                  className={cn(
                    "text-xs text-center border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0",
                    isMobile ? "h-6 w-14" : "h-7 w-20"
                  )}
                />
              </div>
              <div
                className={cn(
                  "flex items-center group",
                  isMobile ? "gap-1" : "gap-2"
                )}
              >
                <span
                  className={cn(
                    "font-semibold text-foreground/80 select-none",
                    isMobile ? "text-[10px]" : "text-xs"
                  )}
                >
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
                    className={cn(
                      "text-xs text-center border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                      isMobile ? "h-6 w-10" : "h-7 w-16"
                    )}
                  />
                  <span className="text-xs font-bold text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center cursor-pointer group select-none",
                  isMobile ? "gap-1" : "gap-2"
                )}
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
                <span
                  className={cn(
                    "font-semibold text-foreground/80",
                    isMobile ? "text-[10px]" : "text-xs"
                  )}
                >
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

        <Card className={cn(CARD_CLS, "rounded-tl-none")}>
          <CardHeader className={CARD_HEADER_CLS}>
            <h3 className={CARD_TITLE_CLS}>
              <Eye className="w-4 h-4 opacity-70" />
              {t.ui("teamComp.currentEquipAndDamage")}
            </h3>
          </CardHeader>
          <CardContent className={CARD_BODY_CLS}>
            <DamageCardBody
              team={effectiveTeam}
              hasFormula={resolvedFormula != null}
              emptyMessage={t.ui("teamComp.emptyDamageMessage")}
              artifactsByChar={equippedArtifactsByChar}
              targetCharId={resolvedFormula?.charId}
              damageValue={currentDamage?.totalDamage ?? null}
              displayResult={currentDisplayResult}
              t={t}
            />
          </CardContent>
        </Card>
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
          className={cn(CARD_CLS, allFormulas.length > 0 && "rounded-tl-none")}
        >
          <CardHeader className={CARD_HEADER_CLS}>
            <div
              className={cn(
                "flex w-full",
                isMobile ? "flex-col gap-2" : "items-center justify-between"
              )}
            >
              <h3 className={CARD_TITLE_CLS}>
                <Loader2
                  className={cn(
                    "w-4 h-4 opacity-70",
                    isComputing && "animate-spin"
                  )}
                />
                {t.ui("teamComp.optimizationResults")}
              </h3>
              <div
                className={cn(
                  "flex items-center gap-2",
                  isMobile && "w-full justify-between"
                )}
              >
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={cn(
                      "font-semibold text-foreground/80 select-none",
                      isMobile ? "text-[10px]" : "text-xs"
                    )}
                  >
                    {t.ui("teamComp.critRateTarget")}
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={activeContext.critRateTarget ?? ""}
                    placeholder="—"
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      updateTeam(team.id, {
                        calcContext: {
                          ...team.calcContext,
                          critRateTarget:
                            raw === ""
                              ? undefined
                              : Math.max(
                                  0,
                                  Math.min(100, Math.round(Number(raw) || 0))
                                ),
                        },
                      });
                    }}
                    className={cn(
                      "text-xs text-center border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                      isMobile ? "h-6 w-10" : "h-7 w-12"
                    )}
                  />
                  <span className="text-xs font-bold text-muted-foreground">
                    %
                  </span>
                </div>
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
            </div>
          </CardHeader>

          {/* Inventory warning */}
          {accountData &&
            accountData.extraArtifacts.length === 0 &&
            accountData.characters.length > 0 && (
              <div className="flex items-center gap-2 px-4 md:px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{t.ui("teamComp.inventoryWarning")}</span>
                <Link
                  to="/account-data"
                  className="font-bold underline underline-offset-2 hover:text-amber-300 shrink-0"
                >
                  {t.ui("teamComp.inventoryWarningLink")}
                </Link>
              </div>
            )}

          <CardContent className={CARD_BODY_CLS}>
            {/* Empty state */}
            {!isComputing && !teamResult && !teamError && (
              <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                <Swords className="w-8 h-8 opacity-15" />
                <p>{t.ui("teamComp.emptyOptMessage")}</p>
              </div>
            )}

            {/* Error state */}
            {teamError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm">
                <span className="font-bold">
                  {t.ui("teamComp.optimizerError")}
                </span>{" "}
                {teamError.message}
              </div>
            )}

            {/* Progress */}
            {isComputing && (
              <div className="space-y-3 bg-black/15 p-3 rounded-lg border border-border/20">
                {/* Pass info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold">
                    {teamProgress
                      ? t
                          .ui("teamComp.passLabel")
                          .replace("{0}", String(teamProgress.passIndex + 1))
                          .replace("{1}", String(teamProgress.totalPasses))
                          .replace(
                            "{2}",
                            `${t.character(teamProgress.currentPassCharId)} — ${
                              teamProgress.currentPass === "carry-1"
                                ? t.ui("teamComp.passCarryInitial")
                                : teamProgress.currentPass === "carry-2"
                                  ? t.ui("teamComp.passCarryRefine")
                                  : t.ui("teamComp.passSupport")
                            }`
                          )
                      : t.ui("teamComp.preparingOptimizer")}
                  </span>
                  <span className="font-mono font-bold">
                    {Math.round((teamProgress?.overallProgress ?? 0) * 100)}%
                  </span>
                </div>

                {/* Overall progress bar */}
                <Progress
                  value={(teamProgress?.overallProgress ?? 0) * 100}
                  className="h-1.5 bg-black/40"
                />

                {/* Completed pass chips */}
                {teamProgress && teamProgress.passResults.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {teamProgress.passResults.map((pr, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-semibold"
                      >
                        <Check className="w-2.5 h-2.5" />
                        {t.character(pr.charId)}
                        {" — "}
                        {pr.passId === "carry-1"
                          ? t.ui("teamComp.passCarryInitial")
                          : pr.passId === "carry-2"
                            ? t.ui("teamComp.passCarryRefine")
                            : t.ui("teamComp.passSupport")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Results — identical layout to Card 2 */}
            {teamResult?.bestDamageResult && (
              <DamageCardBody
                team={effectiveTeam}
                hasFormula
                emptyMessage=""
                artifactsByChar={optimizedArtifactsByChar}
                targetCharId={resolvedOptFormula?.charId}
                damageValue={optimizedDamage?.totalDamage ?? 0}
                displayResult={optimizedDisplayResult}
                t={t}
              />
            )}

            {/* No results found */}
            {teamResult?.done && !teamResult.bestDamageResult && (
              <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border/30 rounded-lg bg-black/10">
                {t
                  .ui("teamComp.noValidCombinations")
                  .replace("{0}", String(Math.round(targetErRaw * 100)))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Card 4: Ideal Artifacts (dev only) */}
      {import.meta.env.DEV && (
        <div>
          {allFormulas.length > 0 && (
            <FormulaTabBar
              formulas={allFormulas}
              selectedTab={activeIdealTab}
              onSelect={(_charId, _formulaId) =>
                setIdealFormulaTab(`${_charId}.${_formulaId}`)
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
              <div
                className={cn(
                  "flex w-full",
                  isMobile ? "flex-col gap-2" : "items-center justify-between"
                )}
              >
                <h3 className={CARD_TITLE_CLS}>
                  <Swords className="w-4 h-4 opacity-70" />
                  {t.ui("teamComp.idealArtifacts")}
                </h3>
                <div
                  className={cn(
                    "flex items-center gap-2",
                    isMobile && "w-full justify-between"
                  )}
                >
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={cn(
                        "font-semibold text-foreground/80 select-none",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      Roll
                    </span>
                    <Select
                      value={String(idealRollMult)}
                      onValueChange={(v) => setIdealRollMult(Number(v))}
                    >
                      <SelectTrigger
                        className={cn(
                          "text-xs border-border/20 bg-background/50",
                          isMobile ? "h-6 w-14" : "h-7 w-16"
                        )}
                      >
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
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={cn(
                        "font-semibold text-foreground/80 select-none",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      {t.ui("teamComp.critRateTarget")}
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={idealCritTarget ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        setIdealCritTarget(
                          raw === ""
                            ? undefined
                            : Math.max(
                                0,
                                Math.min(100, Math.round(Number(raw) || 0))
                              )
                        );
                      }}
                      className={cn(
                        "text-xs text-center border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        isMobile ? "h-6 w-10" : "h-7 w-12"
                      )}
                    />
                    <span className="text-xs font-bold text-muted-foreground">
                      %
                    </span>
                  </div>
                  <Button
                    onClick={handleGenerateIdeal}
                    disabled={idealComputing || !resolvedIdealFormula}
                    size="sm"
                    className="gap-1.5 font-bold px-4 shadow-md text-xs"
                  >
                    {idealComputing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {idealComputing
                      ? t.ui("teamComp.generatingIdeal")
                      : t.ui("teamComp.generateIdeal")}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className={CARD_BODY_CLS}>
              {/* Empty state */}
              {!idealComputing && !idealResult?.done && !idealError && (
                <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                  <Swords className="w-8 h-8 opacity-15" />
                  <p>{t.ui("teamComp.idealEmptyMessage")}</p>
                </div>
              )}

              {/* Error state */}
              {idealError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm">
                  <span className="font-bold">
                    {t.ui("teamComp.optimizerError")}
                  </span>{" "}
                  {idealError.message}
                </div>
              )}

              {/* Progress */}
              {idealComputing && idealResult && (
                <div className="space-y-3 bg-black/15 p-3 rounded-lg border border-border/20">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold">{idealResult.phase}</span>
                    <span className="font-mono font-bold">
                      {Math.round(idealResult.progress * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={idealResult.progress * 100}
                    className="h-1.5 bg-black/40"
                  />
                </div>
              )}

              {/* Results */}
              {idealResult?.done && idealResult.damageResult && (
                <DamageCardBody
                  team={effectiveTeam}
                  hasFormula
                  emptyMessage=""
                  artifactsByChar={idealArtifactsByChar}
                  targetCharId={resolvedIdealFormula?.charId}
                  damageValue={idealDisplayDamage?.totalDamage ?? 0}
                  displayResult={idealDisplayResult}
                  t={t}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
