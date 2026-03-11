import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import type {
  ArtifactData,
  CharacterData,
  ReactionType,
  Slot,
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
  TeamBuild,
  evaluateCombo,
  getComboDisplayResult,
} from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  ComboFormula,
  ComboLine,
  I18nLabel,
  ReactionOverride,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { type Team, useTeamStore } from "@/stores/useTeamStore";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArtifactSwapDialog, getMatchingSetIds } from "./ArtifactSwapDialog";
import { DamageCard } from "./DamageCard";
import { FormulaSelectorCard } from "./FormulaSelectorCard";
import { TeamRosterCard } from "./TeamRosterCard";
import { buildTeamConfigs } from "./teamOptUtils";
import type { TeamOptDetailProps } from "./teamOptUtils";

/** Get the reaction override key for a charId + formulaId pair */
const getReactionKey = (charId: string, formulaId: string) =>
  `${charId}.${formulaId}`;

export function TeamOptDetail({ team, onBack }: TeamOptDetailProps) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const scoreConfig = useArtifactScoreStore((state) => state.config);
  const freezeStore = useFreezeStore();
  const isFrozen = freezeStore.isFrozen(team.id);
  const { characterStats, weaponStats } = useGameStats();
  const buildGroups = useAllResolvedBuilds();

  const [ignoreArtifactSets, setIgnoreArtifactSets] = useState<
    Record<string, boolean>
  >({});

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
        char.constellation,
        scoreConfig.global
      );
    }
    return map;
  }, [accountData, buildGroups, scoreConfig.global]);

  const effectiveTeam = team;

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
        teamBuild: new TeamBuild(
          configs,
          team.opts || {},
          team.enemyElementAura
        ),
        buildError: null,
      };
    } catch (e: unknown) {
      console.error("Failed to construct TeamBuild:", e);
      return {
        teamBuild: null,
        buildError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [configs, team.opts, team.enemyElementAura]);

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
      rollMultiplier: team.calcContext?.rollMultiplier,
    };
  }, [team.calcContext]);

  const displayContext = useMemo<CalcContext>(
    () => ({ ...activeContext, critRateTarget: undefined }),
    [activeContext]
  );

  // ─── Reaction Override ───

  const currentReactionOverride = useMemo<ReactionOverride>(() => {
    if (!resolvedFormula) return {};
    const key = getReactionKey(
      resolvedFormula.charId,
      resolvedFormula.formulaId
    );
    return team.reactionOverrides?.[key] ?? {};
  }, [resolvedFormula, team.reactionOverrides]);

  const handleReactionChange = (override: ReactionOverride) => {
    if (!resolvedFormula) return;
    const key = getReactionKey(
      resolvedFormula.charId,
      resolvedFormula.formulaId
    );
    updateTeam(team.id, {
      reactionOverrides: {
        ...team.reactionOverrides,
        [key]: override,
      },
    });
  };

  // ─── Combo Management ───

  const formulaMode = team.formulaMode ?? "single";

  const combo = useMemo<ComboFormula>(() => {
    if (team.combos.length > 0) return team.combos[0];
    return {
      id: `combo-${Date.now()}`,
      label: { en: "Rotation", zh: "循环" },
      lines: [],
    };
  }, [team.combos]);

  const comboLineMap = useMemo(() => {
    const map = new Map<string, { lineIndex: number; line: ComboLine }>();
    for (let i = 0; i < combo.lines.length; i++) {
      const line = combo.lines[i];
      const rxn = line.reaction?.reaction ?? "none";
      map.set(`${line.charId}.${line.formulaId}.${rxn}`, {
        lineIndex: i,
        line,
      });
    }
    return map;
  }, [combo.lines]);

  const updateCombo = useCallback(
    (updater: (c: ComboFormula) => ComboFormula) => {
      const updated = updater({ ...combo });
      const newCombos =
        team.combos.length > 0
          ? team.combos.map((c) => (c.id === combo.id ? updated : c))
          : [updated];
      updateTeam(team.id, { combos: newCombos });
    },
    [combo, team.combos, team.id, updateTeam]
  );

  const setComboLineCount = useCallback(
    (charId: string, formulaId: string, reaction: string, count: number) => {
      const key = `${charId}.${formulaId}.${reaction}`;
      const existing = comboLineMap.get(key);
      if (existing) {
        updateCombo((c) => ({
          ...c,
          lines: c.lines.map((l, i) =>
            i === existing.lineIndex ? { ...l, count } : l
          ),
        }));
      } else if (count > 0) {
        updateCombo((c) => ({
          ...c,
          lines: [
            ...c.lines,
            {
              charId,
              formulaId,
              count,
              reaction:
                reaction === "none"
                  ? undefined
                  : { reaction: reaction as ReactionType },
            },
          ],
        }));
      }
    },
    [comboLineMap, updateCombo]
  );

  const comboResult = useMemo(() => {
    if (formulaMode !== "combo" || !teamBuild) return null;
    const activeLines = combo.lines.filter((l) => l.count > 0);
    if (activeLines.length === 0) return null;
    try {
      return evaluateCombo(
        teamBuild,
        { ...combo, lines: activeLines },
        artifactSheets,
        displayContext,
        team.reactionOverrides
      );
    } catch {
      return null;
    }
  }, [
    formulaMode,
    combo,
    teamBuild,
    artifactSheets,
    displayContext,
    team.reactionOverrides,
  ]);

  const comboDisplayResult = useMemo(() => {
    if (formulaMode !== "combo" || !teamBuild) return null;
    const activeLines = combo.lines.filter((l) => l.count > 0);
    if (activeLines.length === 0) return null;
    try {
      return getComboDisplayResult(
        teamBuild,
        { ...combo, lines: activeLines },
        artifactSheets,
        displayContext,
        team.reactionOverrides
      );
    } catch (e) {
      console.error("getComboDisplayResult failed:", e);
      return null;
    }
  }, [
    formulaMode,
    combo,
    teamBuild,
    artifactSheets,
    displayContext,
    team.reactionOverrides,
  ]);

  // ─── Damage Calculations ───

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
        displayContext,
        currentReactionOverride
      );
    } catch (e) {
      console.error("Damage calc failed:", e);
      return null;
    }
  }, [
    teamBuild,
    resolvedFormula,
    artifactSheets,
    displayContext,
    currentReactionOverride,
  ]);

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
        displayContext,
        currentReactionOverride
      );
    } catch (e) {
      console.error("Display calc failed:", e);
      return null;
    }
  }, [
    teamBuild,
    resolvedFormula,
    artifactSheets,
    displayContext,
    currentReactionOverride,
  ]);

  const targetErRaw =
    (resolvedFormula && team.targetEr?.[resolvedFormula.charId]) ?? 1.0;

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
    const frozenIds = freezeStore.getFrozenArtifactIds(team.id);
    return [
      ...accountData.extraArtifacts,
      ...accountData.characters.flatMap((c: CharacterData) =>
        (
          Object.values(c.artifacts || {}) as (ArtifactData | undefined)[]
        ).filter((a): a is ArtifactData => !!a)
      ),
    ].filter((a) => !frozenIds.has(a.id));
  };

  const handleOptimize = () => {
    if (!teamBuild || !accountData) return;
    if (!resolvedFormula && formulaMode !== "combo") return;

    // Clear any ephemeral swap overrides when re-optimizing
    setSwapOverrides({});

    // In combo mode, pick the first combo character as the nominal carry
    const carryCharId =
      resolvedFormula?.charId ??
      combo.lines.find((l) => l.count > 0)?.charId ??
      effectiveTeam.characters.find((c): c is string => c != null)!;
    const formulaId = resolvedFormula?.formulaId ?? "";

    const perChar: Record<
      string,
      {
        targetEr: number;
        targetCr: number;
        buildMatch?:
          | import("@/lib/account-data/artifactScore").BuildMatchResult
          | null;
        artifactSetId?: string | null;
        artifactHalfSetIds?: string[];
      }
    > = {};

    for (let ci = 0; ci < effectiveTeam.characters.length; ci++) {
      const cid = effectiveTeam.characters[ci];
      if (!cid) continue;
      const bm = optimizerBuildMatchByChar[cid];
      const { goalSetId, goalHalfSetIds } = getGoalSets(cid);
      const hasFavonius = team.weapons[ci]?.startsWith("favonius_") ?? false;
      perChar[cid] = {
        targetEr: team.targetEr?.[cid] ?? 1.0,
        targetCr: hasFavonius ? (team.targetCr?.[cid] ?? 0.05) : 0,
        buildMatch: bm ?? undefined,
        artifactSetId: goalSetId,
        artifactHalfSetIds: goalHalfSetIds,
      };
    }

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
      optTeamBuild = new TeamBuild(
        optimizerConfigs,
        team.opts || {},
        team.enemyElementAura
      );
    } catch {
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
      reactionOverride: currentReactionOverride,
      altCount: isMobile ? 5 : 7,
      ...(formulaMode === "combo" && {
        combo: { ...combo, lines: combo.lines.filter((l) => l.count > 0) },
        reactionOverrides: team.reactionOverrides,
      }),
      ignoreArtifactSets,
    });
  };

  // ─── Artifact Maps ───

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

  /** Local swap overrides: charId → slot → replacement artifact. Ephemeral — not persisted. */
  const [swapOverrides, setSwapOverrides] = useState<
    Record<string, Partial<Record<Slot, ArtifactData>>>
  >({});
  const hasSwapOverrides = Object.keys(swapOverrides).length > 0;

  const optimizedArtifactsByChar = useMemo(() => {
    // Prefer freeze store when frozen
    const frozenData = isFrozen
      ? freezeStore.getFrozenTeam(team.id)?.artifactsByChar
      : null;
    const source =
      frozenData ?? (teamResult?.done ? teamResult.bestArtifactsByChar : null);
    if (!source) return equippedArtifactsByChar;
    const map = { ...equippedArtifactsByChar };
    for (const [charId, arts] of Object.entries(source)) {
      map[charId] = { ...(arts as Record<string, ArtifactData>) };
    }
    // Apply ephemeral swap overrides on top
    for (const [charId, overrides] of Object.entries(swapOverrides)) {
      if (!map[charId]) continue;
      for (const [slot, art] of Object.entries(overrides)) {
        map[charId] = { ...map[charId], [slot]: art };
      }
    }
    return map;
  }, [
    teamResult,
    equippedArtifactsByChar,
    isFrozen,
    freezeStore,
    team.id,
    swapOverrides,
  ]);

  const optArtifactSheets = useMemo(() => {
    const sheets: Record<string, StatSheet> = {};
    for (const charId of effectiveTeam.characters) {
      if (!charId) continue;
      const artifacts = Object.values(optimizedArtifactsByChar[charId] || {});
      sheets[charId] = StatSheet.fromArtifacts(artifacts);
    }
    return sheets;
  }, [optimizedArtifactsByChar, effectiveTeam.characters]);

  const hasFrozenResult =
    isFrozen && freezeStore.getFrozenTeam(team.id)?.artifactsByChar != null;
  const hasOptResult = teamResult?.done || hasFrozenResult;

  // Use rebuilt TeamBuild from optimizer result if sets were adjusted
  const optTeamBuild = teamResult?.teamBuild ?? teamBuild;

  const optimizedDamage = useMemo(() => {
    if (!optTeamBuild || !resolvedFormula || !hasOptResult) return null;
    try {
      const { charId, formulaId } = resolvedFormula;
      const formulas = optTeamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;
      const postStats = optTeamBuild.getTeamStats(optArtifactSheets, charId);
      return optTeamBuild.getDamageResult(
        charId,
        formulaId,
        postStats,
        displayContext,
        currentReactionOverride
      );
    } catch (e) {
      console.error("Opt damage calc failed:", e);
      return null;
    }
  }, [
    optTeamBuild,
    resolvedFormula,
    optArtifactSheets,
    hasOptResult,
    displayContext,
    currentReactionOverride,
  ]);

  const optimizedDisplayResult = useMemo(() => {
    if (!optTeamBuild || !resolvedFormula || !hasOptResult) return null;
    try {
      const { charId, formulaId } = resolvedFormula;
      const formulas = optTeamBuild.getFormulaIds()[charId];
      if (!formulas || !formulas[formulaId]) return null;
      return optTeamBuild.getDisplayResult(
        charId,
        formulaId,
        optArtifactSheets,
        displayContext,
        currentReactionOverride
      );
    } catch (e) {
      console.error("Opt display calc failed:", e);
      return null;
    }
  }, [
    optTeamBuild,
    resolvedFormula,
    optArtifactSheets,
    hasOptResult,
    displayContext,
    currentReactionOverride,
  ]);

  const optimizedComboDisplayResult = useMemo(() => {
    if (formulaMode !== "combo" || !optTeamBuild || !hasOptResult) return null;
    const activeLines = combo.lines.filter((l) => l.count > 0);
    if (activeLines.length === 0) return null;
    try {
      return getComboDisplayResult(
        optTeamBuild,
        { ...combo, lines: activeLines },
        optArtifactSheets,
        displayContext,
        team.reactionOverrides
      );
    } catch {
      return null;
    }
  }, [
    formulaMode,
    combo,
    optTeamBuild,
    optArtifactSheets,
    hasOptResult,
    displayContext,
    team.reactionOverrides,
  ]);

  // ─── Ideal Artifact Generator (dev only) ───

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

  const handleGenerateIdeal = () => {
    if (!teamBuild) return;
    if (!resolvedFormula && formulaMode !== "combo") return;
    const idealContext: CalcContext = { ...activeContext };

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
        // Pick a 5-star set from each half-set (4-star sets have fewer stats)
        const sk1 =
          hs1?.setIds.find((id) => artifactsById[id]?.rarity === 5) ??
          hs1?.setIds[0] ??
          "ideal";
        const sk2 =
          hs2?.setIds.find((id) => artifactsById[id]?.rarity === 5) ??
          hs2?.setIds[0] ??
          "ideal";
        setKeysByChar[cid] = {
          flower: sk1,
          plume: sk1,
          sands: sk1,
          goblet: sk2,
          circlet: sk2,
        };
      }
    }

    // In combo mode, pick the first combo character as the nominal carry
    const carryCharId =
      resolvedFormula?.charId ??
      combo.lines.find((l) => l.count > 0)?.charId ??
      effectiveTeam.characters.find((c): c is string => c != null)!;
    const idealFormulaId = resolvedFormula?.formulaId ?? "";

    const idealReactionOverride = resolvedFormula
      ? (team.reactionOverrides?.[
          getReactionKey(resolvedFormula.charId, resolvedFormula.formulaId)
        ] ?? {})
      : {};

    startIdealGen({
      teamBuild,
      carryCharId,
      formulaId: idealFormulaId,
      calcContext: idealContext,
      setKeysByChar,
      rollMultiplier: activeContext.rollMultiplier,
      reactionOverride: idealReactionOverride,
      ...(formulaMode === "combo" && {
        combo: { ...combo, lines: combo.lines.filter((l) => l.count > 0) },
        reactionOverrides: team.reactionOverrides,
      }),
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
    if (!teamBuild || !resolvedFormula || !idealResult?.done) return null;
    try {
      const { charId, formulaId } = resolvedFormula;
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
    resolvedFormula,
    idealArtifactSheets,
    idealResult?.done,
    displayContext,
  ]);

  const idealDisplayResult = useMemo(() => {
    if (!teamBuild || !resolvedFormula || !idealResult?.done) return null;
    try {
      const { charId, formulaId } = resolvedFormula;
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
    resolvedFormula,
    idealArtifactSheets,
    idealResult?.done,
    displayContext,
  ]);

  const idealComboDisplayResult = useMemo(() => {
    if (formulaMode !== "combo" || !teamBuild || !idealResult?.done)
      return null;
    const activeLines = combo.lines.filter((l) => l.count > 0);
    if (activeLines.length === 0) return null;
    try {
      return getComboDisplayResult(
        teamBuild,
        { ...combo, lines: activeLines },
        idealArtifactSheets,
        displayContext,
        team.reactionOverrides
      );
    } catch {
      return null;
    }
  }, [
    formulaMode,
    combo,
    teamBuild,
    idealArtifactSheets,
    idealResult?.done,
    displayContext,
    team.reactionOverrides,
  ]);

  // ─── Artifact Swap (ephemeral local overrides) ───

  const [swapTarget, setSwapTarget] = useState<{
    charId: string;
    slot: Slot;
    artifact: ArtifactData;
  } | null>(null);

  const fullInventory = useMemo(() => {
    if (!accountData) return [];
    return [
      ...accountData.extraArtifacts,
      ...accountData.characters.flatMap((c: CharacterData) =>
        (
          Object.values(c.artifacts || {}) as (ArtifactData | undefined)[]
        ).filter((a): a is ArtifactData => !!a)
      ),
    ];
  }, [accountData]);

  // Artifact IDs used by the current result (excluding the slot being swapped)
  const usedArtifactIds = useMemo(() => {
    const ids = new Set<string>();
    const otherFrozen = freezeStore.getFrozenArtifactIds(team.id);
    for (const id of otherFrozen) ids.add(id);
    for (const arts of Object.values(optimizedArtifactsByChar)) {
      for (const art of Object.values(arts)) {
        if (art && swapTarget && art.id === swapTarget.artifact.id) continue;
        if (art) ids.add(art.id);
      }
    }
    return ids;
  }, [optimizedArtifactsByChar, freezeStore, team.id, swapTarget]);

  const swapMatchingSetIds = useMemo(() => {
    if (!swapTarget) return new Set<string>();
    const charIdx = effectiveTeam.characters.indexOf(swapTarget.charId);
    const adapted = {
      artifacts: effectiveTeam.artifacts.map((a) => a ?? undefined),
    };
    return getMatchingSetIds(adapted, charIdx);
  }, [swapTarget, effectiveTeam]);

  const handleArtifactSwap = useCallback(
    (charId: string, slot: Slot, artifact: ArtifactData) => {
      setSwapTarget({ charId, slot, artifact });
    },
    []
  );

  const handleSwapConfirm = useCallback(
    (newArtifact: ArtifactData) => {
      if (!swapTarget) return;
      const { charId, slot } = swapTarget;
      setSwapOverrides((prev) => ({
        ...prev,
        [charId]: { ...(prev[charId] || {}), [slot]: newArtifact },
      }));
      setSwapTarget(null);
    },
    [swapTarget]
  );

  const handleRestoreOriginal = useCallback(() => {
    setSwapOverrides({});
  }, []);

  // Only allow swapping when there's a non-frozen result to edit
  const canSwap =
    !isFrozen && teamResult?.done === true && teamResult.bestDamage > 0;

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
        <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/60 tracking-tight truncate">
          {team.name || t.ui("teamComp.teamOptimization")}
        </h2>
      </div>

      {/* Card 1 — Team Roster */}
      <TeamRosterCard
        team={team}
        updateTeam={updateTeam}
        accountData={accountData}
        characterStats={characterStats}
        weaponStats={weaponStats}
        isMobile={isMobile}
        t={t}
        isFrozen={isFrozen}
        onUnfreeze={
          isFrozen ? () => freezeStore.unfreezeTeam(team.id) : undefined
        }
        ignoreArtifactSets={ignoreArtifactSets}
        onIgnoreArtifactSetsChange={setIgnoreArtifactSets}
      />

      {/* Card 2 — Formula Selection */}
      <FormulaSelectorCard
        team={team}
        effectiveTeam={effectiveTeam}
        updateTeam={updateTeam}
        formulaMode={formulaMode}
        allFormulas={allFormulas}
        availableFormulas={availableFormulas}
        resolvedFormula={resolvedFormula}
        teamBuild={teamBuild}
        buildError={buildError}
        currentReactionOverride={currentReactionOverride}
        handleReactionChange={handleReactionChange}
        comboLineMap={comboLineMap}
        setComboLineCount={setComboLineCount}
        isMobile={isMobile}
        t={t}
      />

      {/* Card 3 — Equipment & Damage */}
      <DamageCard
        team={team}
        effectiveTeam={effectiveTeam}
        updateTeam={updateTeam}
        resolvedFormula={resolvedFormula}
        isFrozen={isFrozen}
        onFreeze={() => {
          if (!teamResult?.done) return;
          // Freeze the current view (includes any swap overrides)
          const allIds: string[] = [];
          const byChar: Record<string, Record<Slot, ArtifactData | null>> = {};
          for (const [charId, arts] of Object.entries(
            optimizedArtifactsByChar
          )) {
            const charArts: Record<string, ArtifactData | null> = {};
            for (const [slot, art] of Object.entries(arts)) {
              if (art) {
                allIds.push((art as ArtifactData).id);
                charArts[slot] = art as ArtifactData;
              }
            }
            byChar[charId] = charArts as Record<Slot, ArtifactData | null>;
          }
          freezeStore.freezeTeam(team.id, allIds, byChar);
          setSwapOverrides({});
        }}
        onUnfreeze={
          isFrozen ? () => freezeStore.unfreezeTeam(team.id) : undefined
        }
        isMobile={isMobile}
        t={t}
        equippedArtifactsByChar={equippedArtifactsByChar}
        currentDamageValue={
          formulaMode === "combo"
            ? (comboResult?.totalDamage ?? null)
            : (currentDamage?.totalDamage ?? null)
        }
        currentDisplayResult={
          formulaMode === "combo" ? comboDisplayResult : currentDisplayResult
        }
        comboResult={formulaMode === "combo" ? comboResult : null}
        comboLines={formulaMode === "combo" ? combo.lines : null}
        teamBuild={teamBuild}
        formulaMode={formulaMode}
        accountData={accountData}
        activeContext={activeContext}
        isComputing={isComputing}
        teamProgress={teamProgress}
        teamResult={teamResult}
        teamError={teamError}
        handleOptimize={handleOptimize}
        optimizedArtifactsByChar={optimizedArtifactsByChar}
        optimizedDamageValue={
          teamResult?.mode === "combo"
            ? teamResult.bestComboResult.totalDamage
            : (optimizedDamage?.totalDamage ?? null)
        }
        optimizedComboResult={
          teamResult?.mode === "combo" ? teamResult.bestComboResult : null
        }
        optimizedDisplayResult={
          formulaMode === "combo"
            ? optimizedComboDisplayResult
            : optimizedDisplayResult
        }
        targetErRaw={targetErRaw}
        idealComputing={idealComputing}
        idealResult={idealResult}
        idealError={idealError}
        handleGenerateIdeal={handleGenerateIdeal}
        idealArtifactsByChar={idealArtifactsByChar}
        idealDamageValue={
          formulaMode === "combo"
            ? (idealResult?.comboResult?.totalDamage ?? null)
            : (idealDisplayDamage?.totalDamage ?? null)
        }
        idealDisplayResult={
          formulaMode === "combo" ? idealComboDisplayResult : idealDisplayResult
        }
        idealComboResult={
          formulaMode === "combo" ? (idealResult?.comboResult ?? null) : null
        }
        onArtifactSwap={canSwap ? handleArtifactSwap : undefined}
        hasSwapOverrides={hasSwapOverrides}
        onRestoreOriginal={hasSwapOverrides ? handleRestoreOriginal : undefined}
      />

      {/* Artifact Swap Dialog */}
      {swapTarget && (
        <ArtifactSwapDialog
          open={!!swapTarget}
          onOpenChange={(open) => {
            if (!open) setSwapTarget(null);
          }}
          currentArtifact={swapTarget.artifact}
          slot={swapTarget.slot}
          inventory={fullInventory}
          usedArtifactIds={usedArtifactIds}
          matchingSetIds={swapMatchingSetIds}
          onSwap={handleSwapConfirm}
          t={t}
        />
      )}
    </div>
  );
}
