import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactHalfSetsById, artifactsById } from "@/data/constants";
import type { ArtifactData, CharacterData, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
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
import {
  buildComboLineMap,
  buildSingleFormulaSelection,
  collectAllFormulas,
  getEffectiveCombo,
  resolveActiveCombo,
  withLineCount,
  withReactionOverride,
} from "@/lib/team-comp/calc/combo";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  buildBuffOverrides,
  buildTeamConfigs,
  calcComboResults,
  extractComboOverrides,
  getHigherTierEquippedArtifactIds,
  toStatSheets,
} from "@/lib/team-comp/teamOptUtils";
import type {
  CalcContext,
  ComboFormula,
  ComboLine,
  ReactionOverride,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import limitEnRaw from "@/presets/updatelog/limit_en.md?raw";
import limitZhRaw from "@/presets/updatelog/limit_zh.md?raw";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useBuffOverrideStore } from "@/stores/useBuffOverrideStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";
import type { Team } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
import { ArrowLeft, Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ArtifactConflict,
  detectFrozenArtifactConflicts,
  getMatchingSetIds,
} from "../../lib/artifact/inventory";
import { ArtifactSwapDialog } from "./ArtifactSwapDialog";
import { DamageCard } from "./DamageCard";
import { FormulaSelectorCard } from "./FormulaSelectorCard";
import type { ReuseEntry } from "./StatSheetPanel";
import { TeamRosterCard } from "./TeamRosterCard";

const limitMap = { en: limitEnRaw, zh: limitZhRaw };

export interface DamageDetailProps {
  team: Team;
  onBack: () => void;
}

export function DamageDetail({ team, onBack }: DamageDetailProps) {
  const { t } = useLanguage();
  const limitText = limitMap[t.lang];
  const [limitOpen, setLimitOpen] = useState(false);
  const [expandedLine, setExpandedLine] = useState<{
    charId: string;
    formulaId: string;
    reaction: string;
  } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset expanded line when team changes
  useEffect(() => setExpandedLine(null), [team.id]);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const accountData = useActiveAccountData();
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const scoreConfig = useArtifactScoreStore((state) => state.config);
  const tierAssignments = useTierStore((s) => s.tierAssignments);
  // Use targeted selectors — subscribing to the full store caused re-renders
  // on ANY freeze mutation (other teams, reuseMode changes, etc.).
  const frozenEntry = useFreezeStore((s) => s.frozenTeams[team.id]);
  const freezeCharacters = useFreezeStore((s) => s.freezeCharacters);
  const unfreezeCharacters = useFreezeStore((s) => s.unfreezeCharacters);
  const unfreezeTeamAction = useFreezeStore((s) => s.unfreezeTeam);
  const teamInventory = useTeamInventory(team.id);
  const isFrozen =
    frozenEntry != null && (frozenEntry.frozenCharIds?.length ?? 0) > 0;
  const frozenCharIds = frozenEntry?.frozenCharIds ?? [];
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

  const forceReusedCharIds = useMemo(
    () => new Set(Object.keys(teamInventory.forceReuseChars)),
    [teamInventory.forceReuseChars]
  );
  // Combined set of all "locked" characters (frozen + forced)
  const lockedCharIds = useMemo(
    () => new Set([...frozenCharIdSet, ...forceReusedCharIds]),
    [frozenCharIdSet, forceReusedCharIds]
  );
  // Per-character reuse info: "locked" (force-reused) or "shared" (pool expansion)
  const reuseInfo = useMemo(() => {
    const map = new Map<string, ReuseEntry>();
    for (const [cid, arts] of Object.entries(
      teamInventory.perCharExtraArtifacts
    )) {
      map.set(cid, {
        mode: forceReusedCharIds.has(cid) ? "locked" : "shared",
        extraIds: new Set(arts.map((a) => a.id)),
      });
    }
    return map;
  }, [teamInventory.perCharExtraArtifacts, forceReusedCharIds]);

  // Pending freeze action — held while the conflict/override alert dialog is open
  const [pendingFreezeAction, setPendingFreezeAction] = useState<{
    action: () => void;
    reason: "conflict" | "override";
    /** For override: existing frozen artifacts for the character */
    existingArts?: Record<Slot, ArtifactData | null>;
    /** For conflict: detailed conflict list */
    conflicts?: ArtifactConflict[];
  } | null>(null);

  // Restored artifacts from unfreeze — treated like optimizer results so
  // freeze/unfreeze/re-freeze all work without special-case state management.
  const [restoredArtifacts, setRestoredArtifacts] = useState<Record<
    string,
    Record<string, ArtifactData>
  > | null>(null);

  const { characterStats, weaponStats, ready: gameStatsReady } = useGameStats();
  const buildGroups = useAllResolvedBuilds();

  const ignoreArtifactSets = useMemo(() => {
    if (!team.charSettings) return undefined;
    const map: Record<string, boolean> = {};
    for (const [cid, s] of Object.entries(team.charSettings)) {
      if (s.ignoreArtifactSets != null) map[cid] = s.ignoreArtifactSets;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [team.charSettings]);

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

  const configs = useMemo(() => {
    const c = buildTeamConfigs(effectiveTeam, accountData);
    return c;
  }, [effectiveTeam, accountData]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: characterStats/weaponStats are intentional invalidation triggers — TeamBuild reads them indirectly via global registries
  const { teamBuild, buildError } = useMemo(() => {
    if (!gameStatsReady) {
      return { teamBuild: null, buildError: null };
    }
    try {
      const tb = new TeamBuild(
        configs,
        team.opts || {},
        team.enemyAura,
        team.extraBuffs,
        undefined,
        team.calcContext
      );
      return { teamBuild: tb, buildError: null };
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

  /** All formulas including constellation-locked ones, with minC info for UI rendering. */
  const displayFormulas = useMemo(() => {
    return teamBuild ? teamBuild.getAllFormulaIds() : {};
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

  // Value-equivalence frozen check for the current tab: a character is "frozen"
  // on the current tab only if its equipped artifacts match the stored frozen artifacts.
  const currentTabFrozenCharIds = useMemo(() => {
    if (!frozenEntry) return new Set<string>();
    const result = new Set<string>();
    for (const cid of frozenEntry.frozenCharIds) {
      const frozenArts = frozenEntry.artifactsByChar[cid];
      const equippedArts = equippedArtifactsByChar[cid];
      if (!frozenArts || !equippedArts) continue;
      // Check that every frozen artifact matches what's equipped (by ID)
      const match = Object.keys(frozenArts).every((slot) => {
        const fa = frozenArts[slot as Slot];
        const ea = equippedArts[slot];
        if (!fa && !ea) return true;
        if (!fa || !ea) return false;
        return fa.id === ea.id;
      });
      if (match) result.add(cid);
    }
    return result;
  }, [frozenEntry, equippedArtifactsByChar]);

  const validCharIds = Object.keys(availableFormulas);

  const allFormulas = useMemo(
    () => collectAllFormulas(validCharIds, availableFormulas, teamBuild),
    [validCharIds, availableFormulas, teamBuild]
  );

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
    // Build per-character CR targets from characters using "target" crMode
    let perCharCrTarget: Record<string, number> | undefined;
    if (team.charSettings) {
      for (const [cid, s] of Object.entries(team.charSettings)) {
        if (s.crMode === "target" && s.minCr != null) {
          if (!perCharCrTarget) perCharCrTarget = {};
          perCharCrTarget[cid] = Math.round(s.minCr * 100);
        }
      }
    }
    return {
      ...team.calcContext,
      perCharCrTarget,
    };
  }, [team.calcContext, team.charSettings]);

  const displayContext = useMemo<CalcContext>(
    () => ({
      ...activeContext,
      perCharCrTarget: undefined,
    }),
    [activeContext]
  );

  // ─── Buff Overrides ───
  // Damage calc always reads from comboOverrides — single mode uses a
  // synthetic combo id "__single__". The old single-mode `overrides` slot
  // has no consumers, so we no longer subscribe to it.

  const comboStoreOverrides = useBuffOverrideStore((s) => s.comboOverrides);

  // ─── Combo Management ───

  const combo = useMemo<ComboFormula>(() => {
    if (team.combo) return team.combo;
    // No combo stored yet — synthesize a default from teamBuild
    return resolveActiveCombo([], undefined, teamBuild, team.characters, true);
  }, [team.combo, teamBuild, team.characters]);

  // Persist the default combo to the store so getEffectiveCombo can find it
  useEffect(() => {
    if (!team.combo && combo.lines.length > 0) {
      updateTeam(team.id, { combo });
    }
  }, [team.combo, combo, updateTeam, team.id]);

  const comboLineMap = useMemo(
    () => buildComboLineMap(combo.lines),
    [combo.lines]
  );

  const updateCombo = useCallback(
    (updater: (c: ComboFormula) => ComboFormula) => {
      const updated = updater({ ...combo });
      updateTeam(team.id, { combo: updated });
    },
    [combo, team.id, updateTeam]
  );

  const setComboLineCount = useCallback(
    (charId: string, formulaId: string, reaction: string, count: number) => {
      updateCombo((c) =>
        withLineCount(c, comboLineMap, charId, formulaId, reaction, count)
      );
    },
    [comboLineMap, updateCombo]
  );

  const formulaMode = team.formulaMode ?? "single";

  const handleReactionChange = useCallback(
    (
      charId: string,
      formulaId: string,
      reaction: string,
      override: ReactionOverride
    ) => {
      if (formulaMode === "single") {
        updateTeam(team.id, { singleReaction: override });
        return;
      }
      updateCombo((c) =>
        withReactionOverride(
          c,
          comboLineMap,
          charId,
          formulaId,
          reaction,
          override
        )
      );
    },
    [formulaMode, comboLineMap, updateCombo, updateTeam, team.id]
  );

  const handleModeChange = useCallback(
    (mode: "single" | "combo") => {
      if (mode !== formulaMode) {
        updateTeam(team.id, { formulaMode: mode });
      }
    },
    [formulaMode, updateTeam, team.id]
  );

  const onSelectSingleFormula = useCallback(
    (charId: string, formulaId: string, reaction: string) => {
      updateTeam(team.id, {
        ...buildSingleFormulaSelection(
          charId,
          formulaId,
          reaction,
          team.selectedFormula ?? undefined,
          team.singleReaction
        ),
      });
    },
    [updateTeam, team.id, team.selectedFormula, team.singleReaction]
  );

  // ─── Display Combo ───
  // Unified projection: damage-calc consumers must read this, NEVER raw
  // `combo` or `team.singleReaction`. See src/lib/team-comp/effectiveCombo.ts.

  const displayCombo = useMemo<ComboFormula>(
    () =>
      getEffectiveCombo({
        formulaMode,
        selectedFormula: team.selectedFormula,
        singleReaction: team.singleReaction,
        singleForceOnField: team.singleForceOnField,
        combo: team.combo,
      }),
    [
      formulaMode,
      team.selectedFormula,
      team.singleReaction,
      team.singleForceOnField,
      team.combo,
    ]
  );

  // Build per-line BuffActivationMap (defaults + user overrides)
  const buffOverrides = useMemo(() => {
    if (!teamBuild) return undefined;
    const activeLines = displayCombo.lines.filter((l) => l.count > 0);
    if (activeLines.length === 0) return undefined;

    const formulaOverrides = extractComboOverrides(
      comboStoreOverrides,
      displayCombo.id
    );
    const r = buildBuffOverrides(
      activeLines,
      teamBuild,
      artifactSheets,
      displayContext,
      formulaOverrides
    );
    return r;
  }, [
    displayCombo,
    teamBuild,
    artifactSheets,
    displayContext,
    comboStoreOverrides,
  ]);

  // ─── Damage Calculations (always via combo path) ───

  const currentDisplayResult = useMemo(() => {
    return calcComboResults(
      teamBuild,
      displayCombo,
      artifactSheets,
      displayContext,
      buffOverrides
    );
  }, [teamBuild, displayCombo, artifactSheets, displayContext, buffOverrides]);

  const minErRaw =
    (resolvedFormula && team.charSettings?.[resolvedFormula.charId]?.minEr) ??
    1.0;

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

  const [timeBudgetSec, setTimeBudgetSec] = useState(30);

  const handleOptimize = () => {
    if (!teamBuild || !accountData) return;

    // Clear any ephemeral state when re-optimizing
    setSwapOverrides({});
    setRestoredArtifacts(null);

    // In combo mode, pick the first combo character as the nominal carry
    const carryCharId =
      resolvedFormula?.charId ??
      displayCombo.lines.find((l) => l.count > 0)?.charId ??
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
      // Skip frozen and force-reused characters — their artifacts are locked
      if (frozenCharIdSet.has(cid) || forceReusedCharIds.has(cid)) continue;
      const bm = optimizerBuildMatchByChar[cid];
      const { goalSetId, goalHalfSetIds } = getGoalSets(cid);
      const cs = team.charSettings?.[cid];
      perChar[cid] = {
        minEr: cs?.minEr ?? 1.0,
        minCr: cs?.crMode === "target" ? 0 : (cs?.minCr ?? 0),
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
        "[DamageDetail] TeamBuild construction failed, using original:",
        e
      );
      optTeamBuild = teamBuild;
    }

    // Use frozen/forced chars' artifact sheets as base so their buffs are accounted for
    const optBaseSheets = { ...artifactSheets };
    if (isFrozen && frozenEntry) {
      for (const cid of frozenEntry.frozenCharIds) {
        const arts = frozenEntry.artifactsByChar[cid];
        if (arts) {
          const pieces = Object.values(arts).filter(
            (a): a is ArtifactData => a != null
          );
          optBaseSheets[cid] = StatSheet.fromArtifacts(pieces);
        }
      }
    }
    // Force-reused characters' artifact sheets
    for (const [cid, arts] of Object.entries(teamInventory.forceReuseChars)) {
      const pieces = allSlots
        .map((s) => arts[s])
        .filter(Boolean) as ArtifactData[];
      optBaseSheets[cid] = StatSheet.fromArtifacts(pieces);
    }
    // Unified path: optimizer must see the same ComboFormula as the display.
    // displayCombo is already filtered (count > 0) by getEffectiveCombo.
    const optCombo: ComboFormula = displayCombo;

    // Build per-char excluded artifact IDs for tier-aware pool
    let perCharExcludedArtifactIds: Record<string, string[]> | undefined;
    if (team.charSettings && accountData) {
      for (const cid of Object.keys(perChar)) {
        if (!team.charSettings[cid]?.tierAwarePool) continue;
        const excluded = getHigherTierEquippedArtifactIds(
          cid,
          tierAssignments,
          accountData
        );
        if (excluded.size > 0) {
          if (!perCharExcludedArtifactIds) perCharExcludedArtifactIds = {};
          perCharExcludedArtifactIds[cid] = [...excluded];
        }
      }
    }

    startTeamOpt({
      teamBuild: optTeamBuild,
      carryCharId,
      combo: {
        ...optCombo,
        buffOverrides,
      },
      inventory: teamInventory.availableArtifacts,
      calcContext: activeContext,
      globalConfig: scoreConfig.global,
      baseSheets: optBaseSheets,
      perChar,
      teamDeadlineMs: performance.now() + timeBudgetSec * 1000,
      ignoreArtifactSets,
      perCharExtraArtifacts: teamInventory.perCharExtraArtifacts,
      perCharExcludedArtifactIds,
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
    const hasFrozenChars = frozenEntry
      ? frozenEntry.frozenCharIds.length > 0
      : false;

    // Layer 0: Base — use equipped artifacts, but leave non-frozen chars empty
    // when the team is partially frozen (their gear may belong to frozen chars)
    for (const [cid, arts] of Object.entries(equippedArtifactsByChar)) {
      if (hasFrozenChars && !frozenEntry?.frozenCharIds.includes(cid)) {
        map[cid] = {} as Record<string, ArtifactData>;
      } else {
        map[cid] = { ...arts };
      }
    }

    // Layer 1: Frozen chars — apply freeze store artifacts (only for frozen chars)
    if (frozenEntry) {
      for (const cid of frozenEntry.frozenCharIds) {
        const arts = frozenEntry.artifactsByChar[cid];
        if (arts) {
          map[cid] = { ...(arts as Record<string, ArtifactData>) };
        }
      }
    }

    // Layer 1.5: Force-reused chars — artifacts from other frozen teams with matching sets
    for (const [cid, arts] of Object.entries(teamInventory.forceReuseChars)) {
      map[cid] = { ...(arts as Record<string, ArtifactData>) };
    }

    // Layer 2: Non-locked chars — optimizer results, restored artifacts, or intermediate results
    const isLocked = (cid: string) =>
      frozenEntry?.frozenCharIds.includes(cid) || forceReusedCharIds.has(cid);

    if (teamResult?.done) {
      for (const [charId, arts] of Object.entries(
        teamResult.bestArtifactsByChar
      )) {
        if (isLocked(charId)) continue;
        map[charId] = { ...(arts as Record<string, ArtifactData>) };
      }
    } else if (teamProgress?.passResults) {
      // During optimization: show intermediate best artifacts from completed phases
      for (const pr of teamProgress.passResults) {
        if (isLocked(pr.charId)) continue;
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
        if (isLocked(charId)) continue;
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
    frozenEntry,
    swapOverrides,
    restoredArtifacts,
    teamInventory.forceReuseChars,
    forceReusedCharIds,
  ]);

  const optArtifactSheets = useMemo(
    () => toStatSheets(effectiveTeam.characters, optimizedArtifactsByChar),
    [optimizedArtifactsByChar, effectiveTeam.characters]
  );

  const hasFrozenResult = isFrozen && frozenEntry?.artifactsByChar != null;
  const hasPreResolved = forceReusedCharIds.size > 0;
  const hasOptResult =
    teamResult?.done ||
    hasFrozenResult ||
    !!restoredArtifacts ||
    isComputing ||
    hasPreResolved;
  const hasAnyResult = hasOptResult;

  // True when every roster character has artifacts from any source
  // (frozen, force-reused, optimizer results, restored, or equipped)
  const allCharsResolved = useMemo(() => {
    const charIds = effectiveTeam.characters.filter(
      (id): id is string => id != null
    );
    if (charIds.length === 0) return false;
    return charIds.every((cid) => {
      if (frozenCharIdSet.has(cid) || forceReusedCharIds.has(cid)) return true;
      if (teamResult?.done && teamResult.bestArtifactsByChar[cid]) return true;
      // Fall back to checking if optimizedArtifactsByChar has actual artifacts
      const arts = optimizedArtifactsByChar[cid];
      return arts != null && Object.values(arts).some(Boolean);
    });
  }, [
    effectiveTeam.characters,
    frozenCharIdSet,
    forceReusedCharIds,
    teamResult,
    optimizedArtifactsByChar,
  ]);

  // Use rebuilt TeamBuild from optimizer result if sets were adjusted
  const optTeamBuild = teamResult?.teamBuild ?? teamBuild;

  const optimizedDisplayResult = useMemo(
    () =>
      hasOptResult && allCharsResolved
        ? calcComboResults(
            optTeamBuild,
            displayCombo,
            optArtifactSheets,
            displayContext,
            buffOverrides
          )
        : null,
    [
      optTeamBuild,
      displayCombo,
      optArtifactSheets,
      hasOptResult,
      allCharsResolved,
      displayContext,
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
      displayCombo.lines.find((l) => l.count > 0)?.charId ??
      effectiveTeam.characters.find((c): c is string => c != null)!;
    const genFormulaId = resolvedFormula?.formulaId ?? "";

    // Build per-char ER/CR constraints for generator
    const genPerChar: Record<string, { minEr: number; minCr: number }> = {};
    for (const cid of effectiveTeam.characters) {
      if (!cid) continue;
      const cs = team.charSettings?.[cid];
      genPerChar[cid] = {
        minEr: cs?.minEr ?? 1.0,
        minCr: cs?.crMode === "target" ? 0 : (cs?.minCr ?? 0),
      };
    }

    // Unified path: generator sees the same ComboFormula as the display.
    // displayCombo is already filtered (count > 0) by getEffectiveCombo.
    const genCombo: ComboFormula = displayCombo;

    startGenerator({
      teamBuild,
      carryCharId,
      combo: {
        ...genCombo,
        buffOverrides: buffOverrides,
      },
      calcContext: genContext,
      setKeysByChar,
      rollMultiplier: activeContext.rollMultiplier,
      perChar: genPerChar,
      ignoreArtifactSets: ignoreArtifactSets ?? undefined,
    });
  };

  // Freeze a character's equipped artifacts from the current tab
  const handleFreezeCharFromCurrent = useCallback(
    (charId: string) => {
      const arts = equippedArtifactsByChar[charId];
      if (!arts || !Object.values(arts).some(Boolean)) return;
      const charArts: Record<string, ArtifactData | null> = {};
      for (const [slot, art] of Object.entries(arts)) {
        if (art) charArts[slot] = art as ArtifactData;
      }

      const doFreeze = () => {
        freezeCharacters(team.id, [charId], {
          [charId]: charArts as Record<Slot, ArtifactData | null>,
        });
      };

      // Check if already frozen with different artifacts → override warning
      if (frozenCharIdSet.has(charId) && !currentTabFrozenCharIds.has(charId)) {
        // Read fresh state inside event handler to avoid stale closures
        const currentFrozen = useFreezeStore.getState().frozenTeams[team.id];
        setPendingFreezeAction({
          action: doFreeze,
          reason: "override",
          existingArts: currentFrozen?.artifactsByChar[charId] as
            | Record<Slot, ArtifactData | null>
            | undefined,
        });
        return;
      }

      // Check for conflicts with other frozen teams
      const conflicts = detectFrozenArtifactConflicts(
        { [charId]: charArts },
        teamInventory.frozenArtifactIds,
        useFreezeStore.getState().frozenTeams,
        team.id
      );
      if (conflicts.length > 0) {
        setPendingFreezeAction({
          action: doFreeze,
          reason: "conflict",
          conflicts,
        });
        return;
      }
      doFreeze();
    },
    [
      equippedArtifactsByChar,
      freezeCharacters,
      team.id,
      teamInventory.frozenArtifactIds,
      frozenCharIdSet,
      currentTabFrozenCharIds,
    ]
  );

  // Unfreeze from the current tab — clears optimize-tab cache so it resets cleanly
  const handleUnfreezeCharFromCurrent = useCallback(
    (charId: string) => {
      setRestoredArtifacts(null);
      unfreezeCharacters(team.id, [charId]);
    },
    [unfreezeCharacters, team.id]
  );

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
            buffOverrides
          )
        : null,
    [
      teamBuild,
      displayCombo,
      genArtifactSheets,
      genResult?.done,
      displayContext,
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
      frozenEntry?.artifactsByChar != null ||
      restoredArtifacts != null);

  return (
    <ScrollLayout>
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

        {/* Card 1 — Team Roster (only rendered when gameStats are ready,
           so TeamMeta always has valid element/region/faction data) */}
        {gameStatsReady && (
          <TeamRosterCard
            team={team}
            updateTeam={updateTeam}
            accountData={accountData}
            characterStats={characterStats!}
            weaponStats={weaponStats!}
            isMobile={isMobile}
            t={t}
            frozenCharIds={frozenCharIdSet}
          />
        )}

        {/* Card 2 — Formula Selection */}
        <FormulaSelectorCard
          team={team}
          effectiveTeam={effectiveTeam}
          updateTeam={updateTeam}
          allFormulas={allFormulas}
          availableFormulas={availableFormulas}
          displayFormulas={displayFormulas}
          teamBuild={teamBuild}
          buildError={buildError}
          comboLineMap={comboLineMap}
          setComboLineCount={setComboLineCount}
          expandedLine={expandedLine}
          onExpandLine={(charId, formulaId, reaction) => {
            setExpandedLine((prev) =>
              prev?.charId === charId &&
              prev?.formulaId === formulaId &&
              prev?.reaction === reaction
                ? null
                : { charId, formulaId, reaction }
            );
          }}
          onReactionChange={handleReactionChange}
          formulaMode={formulaMode}
          onModeChange={handleModeChange}
          onSelectSingleFormula={onSelectSingleFormula}
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
            // Append team reaction combo entries (LCh, LCr)
            lines.push(...teamBuild.getReactionComboLines());
            updateTeam(team.id, {
              combo: { id: combo.id, label: combo.label, lines },
            });
          }}
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
          allCharsResolved={allCharsResolved}
          isFrozen={isFrozen}
          isFullyFrozen={isFullyFrozen}
          isPartiallyFrozen={isPartiallyFrozen}
          frozenCharIds={frozenCharIdSet}
          onFreezeAll={() => {
            if (
              !teamResult?.done &&
              !isFrozen &&
              !restoredArtifacts &&
              !hasPreResolved
            )
              return;
            // Freeze all chars with current view artifacts
            // Skip only chars with nothing equipped
            const byChar: Record<
              string,
              Record<Slot, ArtifactData | null>
            > = {};
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

            freezeCharacters(team.id, freezableCharIds, byChar);
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
                  unfreezeTeamAction(team.id);
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

            freezeCharacters(team.id, [charId], {
              [charId]: charArts as Record<Slot, ArtifactData | null>,
            });
          }}
          onUnfreezeChar={(charId: string) => {
            // Capture ALL current artifacts so unfrozen chars keep their display
            const snapshot: Record<string, Record<string, ArtifactData>> = {};
            for (const [cid, arts] of Object.entries(
              optimizedArtifactsByChar
            )) {
              if (Object.values(arts).some(Boolean)) {
                snapshot[cid] = { ...arts };
              }
            }
            setRestoredArtifacts(
              Object.keys(snapshot).length > 0 ? snapshot : null
            );
            unfreezeCharacters(team.id, [charId]);
          }}
          isMobile={isMobile}
          equippedArtifactsByChar={equippedArtifactsByChar}
          currentDisplayResult={currentDisplayResult}
          formulaMode={formulaMode}
          comboLines={displayCombo.lines}
          comboId={displayCombo.id}
          teamBuild={teamBuild}
          accountData={accountData}
          activeContext={activeContext}
          isComputing={isComputing}
          teamProgress={teamProgress}
          teamResult={teamResult}
          teamError={teamError}
          handleOptimize={handleOptimize}
          timeBudgetSec={timeBudgetSec}
          onTimeBudgetChange={setTimeBudgetSec}
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
          onRestoreOriginal={
            hasSwapOverrides ? handleRestoreOriginal : undefined
          }
          forceReusedCharIds={forceReusedCharIds}
          reuseInfo={reuseInfo}
          tierAssignments={tierAssignments}
          onFreezeCharFromCurrent={handleFreezeCharFromCurrent}
          onUnfreezeCharFromCurrent={handleUnfreezeCharFromCurrent}
          currentTabFrozenCharIds={currentTabFrozenCharIds}
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
                      <div
                        key={i}
                        className="flex gap-2 text-sm leading-relaxed"
                      >
                        <span className="text-muted-foreground shrink-0 font-mono">
                          {numMatch[1]}.
                        </span>
                        <span className="text-foreground/80">
                          {numMatch[2]}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <p
                      key={i}
                      className="text-sm font-semibold text-foreground"
                    >
                      {trimmed}
                    </p>
                  );
                })}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Freeze Conflict / Override Alert */}
        <AlertDialog
          open={pendingFreezeAction != null}
          onOpenChange={(open) => {
            if (!open) setPendingFreezeAction(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t.ui(
                  pendingFreezeAction?.reason === "override"
                    ? "teamComp.freezeOverrideTitle"
                    : "teamComp.freezeConflictTitle"
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t.ui(
                  pendingFreezeAction?.reason === "override"
                    ? "teamComp.freezeOverrideDesc"
                    : "teamComp.freezeConflictDesc"
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Override: show existing frozen artifacts */}
            {pendingFreezeAction?.reason === "override" &&
              pendingFreezeAction.existingArts && (
                <div className="flex items-center justify-center gap-1 md:gap-1.5 py-2">
                  {allSlots.map((slot) => {
                    const art = pendingFreezeAction.existingArts![slot];
                    if (!art) {
                      return (
                        <div key={slot} className="w-10 h-10 md:w-12 md:h-12" />
                      );
                    }
                    return (
                      <ArtifactDataHoverCard
                        key={slot}
                        artifact={art}
                        slot={slot}
                        side="bottom"
                      >
                        <div className="cursor-help">
                          <ItemIcon
                            artifactSetId={art.setKey}
                            slot={slot}
                            rarity={art.rarity}
                            level={`+${art.level}`}
                            frozen
                            size={isMobile ? "xs" : "sm"}
                          />
                        </div>
                      </ArtifactDataHoverCard>
                    );
                  })}
                </div>
              )}

            {/* Conflict: show each conflicting artifact with its owners */}
            {pendingFreezeAction?.reason === "conflict" &&
              pendingFreezeAction.conflicts &&
              pendingFreezeAction.conflicts.length > 0 && (
                <div className="flex flex-col items-center gap-1.5 md:gap-2 py-2">
                  {pendingFreezeAction.conflicts.map((c, i) => {
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1 md:gap-1.5"
                      >
                        <ItemIcon
                          characterId={c.charId}
                          size={isMobile ? "xs" : "sm"}
                        />
                        <div className="w-4 md:w-6 border-t border-dashed border-border/40" />
                        <ArtifactDataHoverCard
                          artifact={c.artifact}
                          slot={c.artifact.slotKey}
                          side="bottom"
                        >
                          <div className="cursor-help">
                            <ItemIcon
                              artifactSetId={c.artifact.setKey}
                              slot={c.artifact.slotKey}
                              rarity={c.artifact.rarity}
                              level={`+${c.artifact.level}`}
                              frozen
                              size={isMobile ? "xs" : "sm"}
                            />
                          </div>
                        </ArtifactDataHoverCard>
                        <div className="w-4 md:w-6 border-t border-border/60" />
                        <ItemIcon
                          characterId={c.frozenCharId}
                          frozen
                          size={isMobile ? "xs" : "sm"}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

            <AlertDialogFooter>
              <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  pendingFreezeAction?.action();
                  setPendingFreezeAction(null);
                }}
              >
                {t.ui("teamComp.freezeConflictConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ScrollLayout>
  );
}
