import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { useAsyncGenerator } from "@/hooks/useAsyncGenerator";
import { useAsyncOptimizer } from "@/hooks/useAsyncOptimizer";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import { useTeamInventory } from "@/hooks/useTeamInventory";
import {
  type BuildMatchResult,
  matchBuild,
} from "@/lib/account-data/artifactScore";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import {
  buildBuffOverrides,
  buildTeamConfigs,
  calcComboResults,
  toStatSheets,
} from "@/lib/team-comp/teamOptUtils";
import type { TeamOptDetailProps } from "@/lib/team-comp/teamOptUtils";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  ComboLine,
  I18nLabel,
  ReactionOverride,
} from "@/lib/team-comp/types";
import { singleFormulaCombo } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import limitEnRaw from "@/presets/updatelog/limit_en.md?raw";
import limitZhRaw from "@/presets/updatelog/limit_zh.md?raw";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useBuffOverrideStore } from "@/stores/useBuffOverrideStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { type Team, useTeamStore } from "@/stores/useTeamStore";
import { ArrowLeft, Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnalyzerDialog } from "./AnalyzerDialog";
import { ArtifactSwapDialog, getMatchingSetIds } from "./ArtifactSwapDialog";
import { DamageCard } from "./DamageCard";
import { FormulaSelectorCard } from "./FormulaSelectorCard";
import { TeamRosterCard } from "./TeamRosterCard";

/** Get the reaction override key for a charId + formulaId pair */
const getReactionKey = (charId: string, formulaId: string) =>
  `${charId}.${formulaId}`;

const limitMap = { en: limitEnRaw, zh: limitZhRaw };

export function TeamOptDetail({ team, onBack }: TeamOptDetailProps) {
  const { t } = useLanguage();
  const limitText = limitMap[t.lang];
  const [limitOpen, setLimitOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const scoreConfig = useArtifactScoreStore((state) => state.config);
  const freezeStore = useFreezeStore();
  const teamInventory = useTeamInventory(team.id);
  const isFrozen = freezeStore.isFrozen(team.id);
  const frozenCharIds = freezeStore.getFrozenCharIds(team.id);
  const frozenCharIdSet = useMemo(
    () => new Set(frozenCharIds),
    [frozenCharIds]
  );
  const teamCharIds = useMemo(
    () => team.characters.filter((id): id is string => id != null),
    [team.characters]
  );
  const isFullyFrozen =
    isFrozen &&
    teamCharIds.length > 0 &&
    teamCharIds.every((id) => frozenCharIdSet.has(id));
  const isPartiallyFrozen = isFrozen && !isFullyFrozen;

  // Restored artifacts from unfreeze — treated like optimizer results so
  // freeze/unfreeze/re-freeze all work without special-case state management.
  const [restoredArtifacts, setRestoredArtifacts] = useState<Record<
    string,
    Record<string, ArtifactData>
  > | null>(null);

  const { characterStats, weaponStats, ready: gameStatsReady } = useGameStats();
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
  } = useAsyncOptimizer();

  useEffect(() => {
    return () => {
      stopTeamOpt();
    };
  }, [stopTeamOpt]);

  const configs = useMemo(
    () => buildTeamConfigs(effectiveTeam, accountData),
    [effectiveTeam, accountData]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: characterStats/weaponStats are intentional invalidation triggers — TeamBuild reads them indirectly via global registries
  const { teamBuild, buildError } = useMemo(() => {
    if (!gameStatsReady) return { teamBuild: null, buildError: null };
    try {
      return {
        teamBuild: new TeamBuild(
          configs,
          team.opts || {},
          team.enemyAura,
          team.extraBuffs
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
  }, [
    configs,
    team.opts,
    team.enemyAura,
    team.extraBuffs,
    gameStatsReady,
    characterStats,
    weaponStats,
  ]);

  const availableFormulas = useMemo(() => {
    return teamBuild ? teamBuild.getFormulaIds() : {};
  }, [teamBuild]);

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

  const artifactSheets = useMemo(
    () => toStatSheets(effectiveTeam.characters, equippedArtifactsByChar),
    [effectiveTeam.characters, equippedArtifactsByChar]
  );

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
    // Include team reaction formulas so rx- selections validate
    if (teamBuild) {
      const rxFormulas = teamBuild.getReactionFormulaIds();
      for (const [formulaId, label] of Object.entries(rxFormulas)) {
        const eligible =
          teamBuild.reactionProvider.getEligibleCharacters(formulaId);
        for (const charId of eligible) {
          list.push({ charId, formulaId, label });
        }
      }
    }
    return list;
  }, [validCharIds, availableFormulas, teamBuild]);

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
      critRateTarget: team.calcContext?.critRateTarget,
      rollMultiplier: team.calcContext?.rollMultiplier,
      substatBudget: team.calcContext?.substatBudget,
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

  // ─── Buff Overrides ───

  const formulaKey = resolvedFormula
    ? `${resolvedFormula.charId}.${resolvedFormula.formulaId}`
    : undefined;
  const userBuffOverrides = useBuffOverrideStore((s) =>
    formulaKey ? s.overrides[formulaKey] : undefined
  );
  const comboStoreOverrides = useBuffOverrideStore((s) => s.comboOverrides);

  // ─── Combo Management ───

  const formulaMode = team.formulaMode ?? "single";

  const combo = useMemo<ComboFormula>(() => {
    if (team.combos.length > 0) return team.combos[0];
    // Initialize from default combo data when no user combo exists
    const lines: ComboLine[] = [];
    if (teamBuild) {
      for (const charId of team.characters) {
        if (!charId) continue;
        const combo = teamBuild.getCombo(charId);
        for (const [formulaId, count] of Object.entries(combo)) {
          if (count > 0) {
            lines.push({ charId, formulaId, count });
          }
        }
      }
    }
    return {
      id: `combo-${Date.now()}`,
      label: { en: "Rotation", zh: "循环" },
      lines,
    };
  }, [team.combos, teamBuild, team.characters]);

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

  // ─── Display Combo (always a ComboFormula, even in single mode) ───

  const displayCombo = useMemo<ComboFormula>(() => {
    if (formulaMode === "combo") {
      const activeLines = combo.lines.filter((l) => l.count > 0);
      return activeLines.length > 0 ? { ...combo, lines: activeLines } : combo;
    }
    if (!resolvedFormula)
      return { id: "__single__", label: { en: "", zh: "" }, lines: [] };
    return singleFormulaCombo(
      resolvedFormula.charId,
      resolvedFormula.formulaId,
      currentReactionOverride
    );
  }, [formulaMode, combo, resolvedFormula, currentReactionOverride]);

  const displayReactionOverrides =
    formulaMode === "combo" ? team.reactionOverrides : undefined;

  // Build per-line PartialBuffInfo[] (defaults + user overrides) — works for both modes
  const buffOverrides = useMemo(() => {
    if (!teamBuild) return undefined;
    const activeLines = displayCombo.lines.filter((l) => l.count > 0);
    if (activeLines.length === 0) return undefined;

    if (formulaMode === "combo") {
      // Gather user overrides from store keyed by "combo:{comboId}:{charId}.{formulaId}"
      const formulaOverrides: Record<string, BuffActivationMap> = {};
      for (const key of Object.keys(comboStoreOverrides)) {
        const prefix = `combo:${combo.id}:`;
        if (key.startsWith(prefix)) {
          const formulaKey = key.slice(prefix.length);
          formulaOverrides[formulaKey] = comboStoreOverrides[key];
        }
      }
      return buildBuffOverrides(
        activeLines,
        teamBuild,
        artifactSheets,
        displayContext,
        team.reactionOverrides,
        Object.keys(formulaOverrides).length > 0 ? formulaOverrides : undefined
      );
    }
    // Single mode: convert userBuffOverrides to combo format
    const formulaOverrides: Record<string, BuffActivationMap> = {};
    if (
      resolvedFormula &&
      userBuffOverrides &&
      Object.keys(userBuffOverrides).length > 0
    ) {
      const fKey = `${resolvedFormula.charId}.${resolvedFormula.formulaId}`;
      formulaOverrides[fKey] = userBuffOverrides;
    }
    return buildBuffOverrides(
      activeLines,
      teamBuild,
      artifactSheets,
      displayContext,
      undefined,
      Object.keys(formulaOverrides).length > 0 ? formulaOverrides : undefined
    );
  }, [
    formulaMode,
    displayCombo,
    combo.id,
    teamBuild,
    artifactSheets,
    displayContext,
    team.reactionOverrides,
    comboStoreOverrides,
    resolvedFormula,
    userBuffOverrides,
  ]);

  // ─── Damage Calculations (always via combo path) ───

  const currentDisplayResult = useMemo(
    () =>
      calcComboResults(
        teamBuild,
        displayCombo,
        artifactSheets,
        displayContext,
        displayReactionOverrides,
        buffOverrides
      ),
    [
      teamBuild,
      displayCombo,
      artifactSheets,
      displayContext,
      displayReactionOverrides,
      buffOverrides,
    ]
  );

  const minErRaw =
    (resolvedFormula && team.minEr?.[resolvedFormula.charId]) ?? 1.0;

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

  // Artifact inventory is provided by useTeamInventory — see teamInventory above

  const handleOptimize = () => {
    if (!teamBuild || !accountData) return;
    if (!resolvedFormula && formulaMode !== "combo") return;

    // Clear any ephemeral state when re-optimizing
    setSwapOverrides({});
    setRestoredArtifacts(null);

    // In combo mode, pick the first combo character as the nominal carry
    const carryCharId =
      resolvedFormula?.charId ??
      combo.lines.find((l) => l.count > 0)?.charId ??
      effectiveTeam.characters.find((c): c is string => c != null)!;
    const formulaId = resolvedFormula?.formulaId ?? "";

    const perChar: Record<
      string,
      {
        minEr: number;
        minCr: number;
        buildMatch?: BuildMatchResult | null;
        artifactSetId?: string | null;
        artifactHalfSetIds?: string[];
      }
    > = {};

    for (let ci = 0; ci < effectiveTeam.characters.length; ci++) {
      const cid = effectiveTeam.characters[ci];
      if (!cid) continue;
      // Skip frozen characters — their artifacts are locked
      if (frozenCharIdSet.has(cid)) continue;
      const bm = optimizerBuildMatchByChar[cid];
      const { goalSetId, goalHalfSetIds } = getGoalSets(cid);
      perChar[cid] = {
        minEr: team.minEr?.[cid] ?? 1.0,
        minCr: team.minCr?.[cid] ?? 0,
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
        team.enemyAura,
        team.extraBuffs
      );
    } catch (e) {
      console.warn(
        "[TeamOptDetail] TeamBuild construction failed, using original:",
        e
      );
      optTeamBuild = teamBuild;
    }

    // Use frozen chars' artifact sheets as base so their buffs are accounted for
    const optBaseSheets = { ...artifactSheets };
    if (isFrozen) {
      const frozenData = freezeStore.getFrozenTeam(team.id);
      if (frozenData) {
        for (const cid of frozenData.frozenCharIds) {
          const arts = frozenData.artifactsByChar[cid];
          if (arts) {
            const pieces = Object.values(arts).filter(
              (a): a is ArtifactData => a != null
            );
            optBaseSheets[cid] = StatSheet.fromArtifacts(pieces);
          }
        }
      }
    }

    // Always use combo: in single-formula mode, wrap as a 1-line combo
    const optCombo: ComboFormula =
      formulaMode === "combo"
        ? { ...combo, lines: combo.lines.filter((l) => l.count > 0) }
        : singleFormulaCombo(carryCharId, formulaId, currentReactionOverride);

    const optReactionOverrides =
      formulaMode === "combo" ? team.reactionOverrides : undefined;

    // Compute partial buff specs from user overrides for the optimizer
    const optPartialBuffs =
      userBuffOverrides && Object.keys(userBuffOverrides).length > 0
        ? optTeamBuild.computePartialBuffSpecs(
            carryCharId,
            formulaId,
            optBaseSheets,
            activeContext,
            currentReactionOverride,
            userBuffOverrides
          )
        : undefined;
    const optBuffOverrides =
      formulaMode === "combo"
        ? buffOverrides
        : optPartialBuffs && optPartialBuffs.length > 0
          ? { 0: optPartialBuffs }
          : undefined;

    startTeamOpt({
      teamBuild: optTeamBuild,
      carryCharId,
      formula: {
        combo: optCombo,
        reactionOverrides: optReactionOverrides,
        buffOverrides: optBuffOverrides,
      },
      inventory: teamInventory.availableArtifacts,
      calcContext: activeContext,
      globalConfig: scoreConfig.global,
      baseSheets: optBaseSheets,
      perChar,
      teamDeadlineMs: performance.now() + 30_000,
      ignoreArtifactSets,
      perCharExtraArtifacts: teamInventory.perCharExtraArtifacts,
    });
  };

  // ─── Artifact Maps ───

  /** Local swap overrides: charId → slot → replacement artifact. Ephemeral — not persisted. */
  const [swapOverrides, setSwapOverrides] = useState<
    Record<string, Partial<Record<Slot, ArtifactData>>>
  >({});
  const hasSwapOverrides = Object.keys(swapOverrides).length > 0;

  const optimizedArtifactsByChar = useMemo(() => {
    const map: Record<string, Record<string, ArtifactData>> = {};
    const frozenData = freezeStore.getFrozenTeam(team.id);
    const hasFrozenChars = frozenData
      ? frozenData.frozenCharIds.length > 0
      : false;

    // Layer 0: Base — use equipped artifacts, but leave non-frozen chars empty
    // when the team is partially frozen (their gear may belong to frozen chars)
    for (const [cid, arts] of Object.entries(equippedArtifactsByChar)) {
      if (hasFrozenChars && !frozenData?.frozenCharIds.includes(cid)) {
        map[cid] = {} as Record<string, ArtifactData>;
      } else {
        map[cid] = { ...arts };
      }
    }

    // Layer 1: Frozen chars — apply freeze store artifacts (only for frozen chars)
    if (frozenData) {
      for (const cid of frozenData.frozenCharIds) {
        const arts = frozenData.artifactsByChar[cid];
        if (arts) {
          map[cid] = { ...(arts as Record<string, ArtifactData>) };
        }
      }
    }

    // Layer 2: Non-frozen chars — optimizer results, restored artifacts, or intermediate results
    if (teamResult?.done) {
      for (const [charId, arts] of Object.entries(
        teamResult.bestArtifactsByChar
      )) {
        if (frozenData?.frozenCharIds.includes(charId)) continue;
        map[charId] = { ...(arts as Record<string, ArtifactData>) };
      }
    } else if (teamProgress?.passResults) {
      // During optimization: show intermediate best artifacts from completed phases
      for (const pr of teamProgress.passResults) {
        if (frozenData?.frozenCharIds.includes(pr.charId)) continue;
        if (pr.bestDamage <= 0) continue;
        const arts: Record<string, ArtifactData> = {};
        for (const [slot, art] of Object.entries(pr.bestArtifacts)) {
          if (art) arts[slot] = art;
        }
        if (Object.keys(arts).length > 0) map[pr.charId] = arts;
      }
    } else if (restoredArtifacts) {
      // After unfreeze: restored artifacts fill in for non-frozen chars
      for (const [charId, arts] of Object.entries(restoredArtifacts)) {
        if (frozenData?.frozenCharIds.includes(charId)) continue;
        if (arts && Object.values(arts).some(Boolean)) {
          map[charId] = { ...arts };
        }
      }
    }

    // Layer 3: Apply ephemeral swap overrides on top
    for (const [charId, overrides] of Object.entries(swapOverrides)) {
      if (!map[charId]) continue;
      for (const [slot, art] of Object.entries(overrides)) {
        map[charId] = { ...map[charId], [slot]: art };
      }
    }
    return map;
  }, [
    teamResult,
    teamProgress,
    equippedArtifactsByChar,
    freezeStore,
    team.id,
    swapOverrides,
    restoredArtifacts,
  ]);

  const optArtifactSheets = useMemo(
    () => toStatSheets(effectiveTeam.characters, optimizedArtifactsByChar),
    [optimizedArtifactsByChar, effectiveTeam.characters]
  );

  const hasFrozenResult =
    isFrozen && freezeStore.getFrozenTeam(team.id)?.artifactsByChar != null;
  const hasOptResult =
    teamResult?.done || hasFrozenResult || !!restoredArtifacts || isComputing;
  const hasAnyResult = hasOptResult;

  // Use rebuilt TeamBuild from optimizer result if sets were adjusted
  const optTeamBuild = teamResult?.teamBuild ?? teamBuild;

  const optimizedDisplayResult = useMemo(
    () =>
      hasOptResult
        ? calcComboResults(
            optTeamBuild,
            displayCombo,
            optArtifactSheets,
            displayContext,
            displayReactionOverrides,
            buffOverrides
          )
        : null,
    [
      optTeamBuild,
      displayCombo,
      optArtifactSheets,
      hasOptResult,
      displayContext,
      displayReactionOverrides,
      buffOverrides,
    ]
  );

  // ─── Artifact Generator (dev only) ───

  const {
    result: genResult,
    isComputing: genComputing,
    error: genError,
    start: startGenerator,
    stop: stopGenerator,
  } = useAsyncGenerator();

  useEffect(() => {
    return () => {
      stopGenerator();
    };
  }, [stopGenerator]);

  const handleGenerate = () => {
    if (!teamBuild) return;
    if (!resolvedFormula && formulaMode !== "combo") return;
    const genContext: CalcContext = { ...activeContext };

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
          "generated";
        // For sk2, skip sk1 so both half-sets use distinct concrete sets
        const sk2 =
          hs2?.setIds.find(
            (id) => artifactsById[id]?.rarity === 5 && id !== sk1
          ) ??
          hs2?.setIds.find((id) => id !== sk1) ??
          hs2?.setIds[0] ??
          "generated";
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
    const genFormulaId = resolvedFormula?.formulaId ?? "";

    // Build per-char ER/CR constraints for generator
    const genPerChar: Record<string, { minEr: number; minCr: number }> = {};
    for (const cid of effectiveTeam.characters) {
      if (!cid) continue;
      genPerChar[cid] = {
        minEr: team.minEr?.[cid] ?? 1.0,
        minCr: team.minCr?.[cid] ?? 0,
      };
    }

    // Always use combo: in single-formula mode, wrap as a 1-line combo
    const genCombo: ComboFormula =
      formulaMode === "combo"
        ? { ...combo, lines: combo.lines.filter((l) => l.count > 0) }
        : singleFormulaCombo(
            carryCharId,
            genFormulaId,
            team.reactionOverrides?.[
              getReactionKey(
                resolvedFormula!.charId,
                resolvedFormula!.formulaId
              )
            ]
          );

    const genReactionOverrides =
      formulaMode === "combo" ? team.reactionOverrides : undefined;

    startGenerator({
      teamBuild,
      carryCharId,
      formula: {
        combo: genCombo,
        reactionOverrides: genReactionOverrides,
        buffOverrides: buffOverrides,
      },
      calcContext: genContext,
      setKeysByChar,
      rollMultiplier: activeContext.rollMultiplier,
      perChar: genPerChar,
      ignoreArtifactSets: ignoreArtifactSets ?? undefined,
    });
  };

  const genArtifactsByChar = useMemo(() => {
    if (!genResult?.done || !genResult.artifactsByChar)
      return equippedArtifactsByChar;
    const map = { ...equippedArtifactsByChar };
    for (const [charId, arts] of Object.entries(genResult.artifactsByChar)) {
      map[charId] = arts as Record<string, ArtifactData>;
    }
    return map;
  }, [genResult, equippedArtifactsByChar]);

  const genArtifactSheets = useMemo(
    () => toStatSheets(effectiveTeam.characters, genArtifactsByChar),
    [genArtifactsByChar, effectiveTeam.characters]
  );

  const genDisplayResult = useMemo(
    () =>
      genResult?.done
        ? calcComboResults(
            teamBuild,
            displayCombo,
            genArtifactSheets,
            displayContext,
            displayReactionOverrides,
            buffOverrides
          )
        : null,
    [
      teamBuild,
      displayCombo,
      genArtifactSheets,
      genResult?.done,
      displayContext,
      displayReactionOverrides,
      buffOverrides,
    ]
  );

  // ─── Artifact Swap (ephemeral local overrides) ───

  const [swapTarget, setSwapTarget] = useState<{
    charId: string;
    slot: Slot;
    artifact: ArtifactData;
  } | null>(null);

  // Full inventory is provided by useTeamInventory — see teamInventory above

  // Artifact IDs used by the current team result (excluding frozen — those are shown labeled in the dialog)
  const usedArtifactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const arts of Object.values(optimizedArtifactsByChar)) {
      for (const art of Object.values(arts)) {
        if (art && swapTarget && art.id === swapTarget.artifact.id) continue;
        // Frozen artifacts are handled separately via frozenArtifactIds
        if (art && !teamInventory.frozenArtifactIds.has(art.id))
          ids.add(art.id);
      }
    }
    return ids;
  }, [optimizedArtifactsByChar, teamInventory.frozenArtifactIds, swapTarget]);

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

  // Only allow swapping when there's a non-fully-frozen result to edit
  const canSwap =
    !isFullyFrozen &&
    ((teamResult?.done === true && teamResult.bestDamage > 0) ||
      freezeStore.getFrozenTeam(team.id)?.artifactsByChar != null ||
      restoredArtifacts != null);

  // ─── Analyzer Dialog ───
  const [analyzerOpen, setAnalyzerOpen] = useState(false);
  const analyzerState = useAnalyzer(team.id);

  return (
    <div
      className={cn(
        "flex flex-col w-full animate-in fade-in duration-300 pb-12",
        "gap-1.5 lg:gap-2"
      )}
    >
      {/* ── Page Header ── */}
      <div className="flex items-center gap-2 px-0.5 lg:px-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 h-10 w-10 -ml-2 hover:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5 text-foreground/70" />
        </Button>
        <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/60 tracking-tight truncate flex-1">
          {team.name || t.ui("teamComp.teamOptimization")}
          <span
            className="inline-block ml-1.5 align-baseline cursor-pointer"
            onClick={() => setLimitOpen(true)}
            title={t.ui("calcLimitations.title")}
          >
            <Info className="w-5 h-5 text-primary" />
          </span>
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
        frozenCharIds={frozenCharIdSet}
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
        onResetCombo={() => {
          if (!teamBuild) return;
          const lines: ComboLine[] = [];
          for (const charId of team.characters) {
            if (!charId) continue;
            const combo = teamBuild.getCombo(charId);
            for (const [formulaId, count] of Object.entries(combo)) {
              if (count > 0) {
                lines.push({ charId, formulaId, count });
              }
            }
          }
          updateTeam(team.id, {
            combos: [{ id: combo.id, label: combo.label, lines }],
          });
        }}
        onInvestmentClick={
          teamBuild && formulaMode === "combo"
            ? () => setAnalyzerOpen(true)
            : undefined
        }
        isMobile={isMobile}
        t={t}
      />

      {/* Card 3 — Equipment & Damage */}
      <DamageCard
        team={team}
        effectiveTeam={effectiveTeam}
        updateTeam={updateTeam}
        resolvedFormula={resolvedFormula}
        hasOptResult={hasOptResult}
        isFrozen={isFrozen}
        isFullyFrozen={isFullyFrozen}
        isPartiallyFrozen={isPartiallyFrozen}
        frozenCharIds={frozenCharIdSet}
        onFreezeAll={() => {
          if (!teamResult?.done && !isFrozen && !restoredArtifacts) return;
          // Freeze all chars with current view artifacts
          // Skip only chars with nothing equipped
          const byChar: Record<string, Record<Slot, ArtifactData | null>> = {};
          const freezableCharIds: string[] = [];
          for (const [charId, arts] of Object.entries(
            optimizedArtifactsByChar
          )) {
            if (!Object.values(arts).some(Boolean)) continue;
            const charArts: Record<string, ArtifactData | null> = {};
            for (const [slot, art] of Object.entries(arts)) {
              if (art) {
                charArts[slot] = art as ArtifactData;
              }
            }
            byChar[charId] = charArts as Record<Slot, ArtifactData | null>;
            freezableCharIds.push(charId);
          }
          if (freezableCharIds.length === 0) return;
          freezeStore.freezeCharacters(team.id, freezableCharIds, byChar);
          setSwapOverrides({});
        }}
        onUnfreezeAll={
          isFrozen
            ? () => {
                // Snapshot current artifacts as restored before clearing freeze
                const snapshot: Record<
                  string,
                  Record<string, ArtifactData>
                > = {};
                for (const [charId, arts] of Object.entries(
                  optimizedArtifactsByChar
                )) {
                  if (Object.values(arts).some(Boolean)) {
                    snapshot[charId] = { ...arts };
                  }
                }
                setRestoredArtifacts(
                  Object.keys(snapshot).length > 0 ? snapshot : null
                );
                freezeStore.unfreezeTeam(team.id);
              }
            : undefined
        }
        onFreezeChar={(charId: string) => {
          // Freeze a single character using current view artifacts
          const arts = optimizedArtifactsByChar[charId];
          if (!arts || !Object.values(arts).some(Boolean)) return;
          const charArts: Record<string, ArtifactData | null> = {};
          for (const [slot, art] of Object.entries(arts)) {
            if (art) charArts[slot] = art as ArtifactData;
          }
          freezeStore.freezeCharacters(team.id, [charId], {
            [charId]: charArts as Record<Slot, ArtifactData | null>,
          });
        }}
        onUnfreezeChar={(charId: string) => {
          // Capture ALL current artifacts so unfrozen chars keep their display
          const snapshot: Record<string, Record<string, ArtifactData>> = {};
          for (const [cid, arts] of Object.entries(optimizedArtifactsByChar)) {
            if (Object.values(arts).some(Boolean)) {
              snapshot[cid] = { ...arts };
            }
          }
          setRestoredArtifacts(
            Object.keys(snapshot).length > 0 ? snapshot : null
          );
          freezeStore.unfreezeCharacters(team.id, [charId]);
        }}
        isMobile={isMobile}
        t={t}
        equippedArtifactsByChar={equippedArtifactsByChar}
        currentDisplayResult={currentDisplayResult}
        comboLines={displayCombo.lines}
        comboId={displayCombo.id}
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
        optimizedDisplayResult={optimizedDisplayResult}
        minErRaw={minErRaw}
        genComputing={genComputing}
        genResult={genResult}
        genError={genError}
        handleGenerate={handleGenerate}
        genArtifactsByChar={genArtifactsByChar}
        genDisplayResult={genDisplayResult}
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
          inventory={teamInventory.allArtifacts}
          usedArtifactIds={usedArtifactIds}
          frozenArtifactIds={teamInventory.frozenArtifactIds}
          matchingSetIds={swapMatchingSetIds}
          onSwap={handleSwapConfirm}
          t={t}
        />
      )}

      {/* Analyzer Dialog */}
      {teamBuild && (
        <AnalyzerDialog
          open={analyzerOpen}
          onOpenChange={setAnalyzerOpen}
          teamId={team.id}
          teamBuild={teamBuild}
          baseConfigs={configs}
          formula={{
            combo,
            reactionOverrides: team.reactionOverrides,
            buffOverrides,
          }}
          analysis={analyzerState}
          perChar={Object.fromEntries(
            effectiveTeam.characters
              .filter((c): c is string => c != null)
              .map((cid) => [
                cid,
                {
                  minEr: team.minEr?.[cid] ?? 1.0,
                  minCr: team.minCr?.[cid] ?? 0,
                },
              ])
          )}
        />
      )}

      {/* Calculation Limitations Sheet */}
      <Sheet open={limitOpen} onOpenChange={setLimitOpen}>
        <SheetContent
          side="right"
          className="w-[min(85vw,400px)] md:w-[min(85vw,520px)] xl:w-[min(85vw,640px)] sm:max-w-none p-0 flex flex-col"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              {t.ui("calcLimitations.title")}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="px-5 py-4 space-y-3">
              {limitText.split("\n").map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
                if (numMatch) {
                  return (
                    <div key={i} className="flex gap-2 text-sm leading-relaxed">
                      <span className="text-muted-foreground shrink-0 font-mono">
                        {numMatch[1]}.
                      </span>
                      <span className="text-foreground/80">{numMatch[2]}</span>
                    </div>
                  );
                }
                return (
                  <p key={i} className="text-sm font-semibold text-foreground">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
