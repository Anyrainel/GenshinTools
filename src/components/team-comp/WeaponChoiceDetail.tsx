import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAsyncWeaponChoice } from "@/hooks/useAsyncWeaponChoice";
import { useAutoDisableOwnedFilter } from "@/hooks/useAutoDisableOwnedFilter";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  buildComboLineMap,
  buildSingleFormulaSelection,
  collectAllFormulas,
  resolveActiveCombo,
  withLineCount,
  withReactionOverride,
} from "@/lib/dmgcalc/core/combo";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type {
  ComboFormula,
  ComboLine,
  ReactionOverride,
} from "@/lib/dmgcalc/types";
import { resolveCalcContext } from "@/lib/dmgcalc/utils";
import type { WeaponChoiceOptions } from "@/lib/team-comp/analyzer/weaponChoice";
import {
  buildTeamSlotConfigs,
  buildWeaponChoiceCharConfigs,
  getEffectiveCombo,
} from "@/lib/team-comp/teamConfigUtils";
import { teamCompToArrays } from "@/lib/team-comp/teamDeltas";
import type {
  ChoiceResultCache,
  TeamComp,
  TeamDamageConfig,
  TeamSetupConfig,
  WeaponChoiceResult,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/stores/useSessionNavStore";
import {
  choiceResultsFromTeamResultCache,
  type TeamResultCacheEntry,
  useTeamResultCacheStore,
} from "@/stores/useTeamResultCacheStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { FormulaSelectorCard } from "./FormulaSelectorCard";
import { TeamDetailAspectLinks } from "./TeamDetailAspectLinks";
import { TeamRosterCard } from "./TeamRosterCard";
import { WeaponChoiceResultCard } from "./WeaponChoiceResultCard";

interface WeaponChoiceDetailProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  onBack: () => void;
  viewId?: ViewId;
  resultCache?: TeamResultCacheEntry;
}

export function WeaponChoiceDetail({
  teamComp,
  setupConfig,
  onBack,
  viewId = "weaponChoice",
  resultCache,
}: WeaponChoiceDetailProps) {
  const { t } = useLanguage();
  const storeUpdateTeamComp = useTeamStore((s) => s.updateTeamComp);
  const updateTeamSetupConfig = useTeamStore((s) => s.updateTeamSetupConfig);
  const setChoiceResult = useTeamResultCacheStore((s) => s.setChoiceResult);
  const clearChoiceResults = useTeamResultCacheStore(
    (s) => s.clearChoiceResults
  );
  const checkAutoDisableOwned = useAutoDisableOwnedFilter(viewId);
  const updateTeamComp = useCallback(
    (id: string, nextComp: TeamComp) => {
      storeUpdateTeamComp(id, nextComp);
      checkAutoDisableOwned(teamCompToArrays(nextComp).characters);
    },
    [storeUpdateTeamComp, checkAutoDisableOwned]
  );
  const updateSetupConfig = useCallback(
    (
      updater:
        | Partial<TeamSetupConfig>
        | ((config: TeamSetupConfig) => TeamSetupConfig)
    ) => {
      updateTeamSetupConfig(teamComp.id, updater);
    },
    [teamComp.id, updateTeamSetupConfig]
  );
  const updateDamageConfig = useCallback(
    (
      updater:
        | Partial<TeamDamageConfig>
        | ((config: TeamDamageConfig) => TeamDamageConfig)
    ) => {
      updateSetupConfig((config) => {
        const current = config.damage ?? {};
        return {
          ...config,
          damage:
            typeof updater === "function"
              ? updater(current)
              : { ...current, ...updater },
        };
      });
    },
    [updateSetupConfig]
  );
  const accountData = useActiveAccountData();
  const characterStats = characterStatsResource.use();
  const weaponStats = weaponStatsResource.use();
  const gameStatsReady = characterStats !== null && weaponStats !== null;
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [choiceMode, setChoiceMode] = useState<"weapon" | "artifact">("weapon");
  const { characters, weapons, artifacts } = useMemo(
    () => teamCompToArrays(teamComp),
    [teamComp]
  );
  const damageConfig = setupConfig.damage ?? {};
  const combatOptions = setupConfig.combatOptions ?? {};

  const localEnemyAura = damageConfig.enemyAura;
  const localExtraBuffs = damageConfig.extraBuffs ?? [];

  const configs = useMemo(
    () => buildTeamSlotConfigs(teamComp, setupConfig, accountData),
    [teamComp, setupConfig, accountData]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: characterStats/weaponStats are intentional invalidation triggers
  const { teamBuild, buildError } = useMemo(() => {
    if (!gameStatsReady) return { teamBuild: null, buildError: null };
    try {
      const tb = new TeamBuild(
        configs,
        combatOptions,
        localEnemyAura,
        localExtraBuffs
      );
      return { teamBuild: tb, buildError: null };
    } catch (e) {
      return {
        teamBuild: null,
        buildError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [
    configs,
    combatOptions,
    localEnemyAura,
    localExtraBuffs,
    gameStatsReady,
    characterStats,
    weaponStats,
  ]);

  // ── Formula management (unified with Damage tab) ──
  const formulaMode = damageConfig.formulaMode ?? "single";
  const [expandedLine, setExpandedLine] = useState<{
    charId: string;
    formulaId: string;
    reaction: string;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset expanded line when team changes
  useEffect(() => setExpandedLine(null), [teamComp.id]);

  // Derive formula lists from teamBuild
  const availableFormulas = useMemo(() => {
    return teamBuild ? teamBuild.catalog.getFormulaIds() : {};
  }, [teamBuild]);

  const displayFormulas = useMemo(() => {
    return teamBuild ? teamBuild.catalog.getAllFormulaIds() : {};
  }, [teamBuild]);

  const validCharIds = Object.keys(availableFormulas);

  const allFormulas = useMemo(
    () => collectAllFormulas(validCharIds, availableFormulas),
    [validCharIds, availableFormulas]
  );

  // ── Combo management (unified with Damage tab) ──
  const combo = useMemo<ComboFormula>(
    () =>
      damageConfig.combo ??
      resolveActiveCombo([], undefined, teamBuild, characters),
    [damageConfig.combo, teamBuild, characters]
  );

  const comboLineMap = useMemo(
    () => buildComboLineMap(combo.lines),
    [combo.lines]
  );

  const updateCombo = useCallback(
    (updater: (c: ComboFormula) => ComboFormula) => {
      const updated = updater({ ...combo });
      updateDamageConfig({ combo: updated });
    },
    [combo, updateDamageConfig]
  );

  const setComboLineCount = useCallback(
    (charId: string, formulaId: string, reaction: string, count: number) => {
      updateCombo((c) =>
        withLineCount(c, comboLineMap, charId, formulaId, reaction, count)
      );
    },
    [comboLineMap, updateCombo]
  );

  const handleReactionChange = useCallback(
    (
      charId: string,
      formulaId: string,
      reaction: string,
      override: ReactionOverride
    ) => {
      if (formulaMode === "single") {
        updateDamageConfig({ singleReaction: override });
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
    [formulaMode, comboLineMap, updateCombo, updateDamageConfig]
  );

  const handleModeChange = useCallback(
    (mode: "single" | "combo") => {
      if (mode !== formulaMode) {
        updateDamageConfig({ formulaMode: mode });
      }
    },
    [formulaMode, updateDamageConfig]
  );

  const onSelectSingleFormula = useCallback(
    (charId: string, formulaId: string, reaction: string) => {
      updateDamageConfig({
        ...buildSingleFormulaSelection(
          charId,
          formulaId,
          reaction,
          damageConfig.selectedFormula ?? undefined,
          damageConfig.singleReaction
        ),
      });
    },
    [
      updateDamageConfig,
      damageConfig.selectedFormula,
      damageConfig.singleReaction,
    ]
  );

  const onResetCombo = useCallback(() => {
    if (!teamBuild) return;
    const lines: ComboLine[] = [];
    for (const charId of characters) {
      if (!charId) continue;
      const comboData = teamBuild.catalog.getCombo(charId);
      for (const [formulaId, count] of Object.entries(comboData)) {
        if (count > 0) {
          lines.push({ charId, formulaId, count });
        }
      }
    }
    updateDamageConfig({
      combo: { id: combo.id, label: combo.label, lines },
    });
  }, [teamBuild, characters, combo.id, combo.label, updateDamageConfig]);

  // ── Effective combo (unified projection, shared with Damage tab) ──
  const displayComboBase = useMemo<ComboFormula>(
    () =>
      getEffectiveCombo({
        formulaMode,
        selectedFormula: damageConfig.selectedFormula,
        singleReaction: damageConfig.singleReaction,
        singleForceOnField: damageConfig.singleForceOnField,
        combo: damageConfig.combo,
      }),
    [
      formulaMode,
      damageConfig.selectedFormula,
      damageConfig.singleReaction,
      damageConfig.singleForceOnField,
      damageConfig.combo,
    ]
  );

  // Ephemeral "ignore character damage" toggles (combo mode only).
  // See DamageDetail for rationale — zero out lines owned by or sourced
  // from an ignored character before damage is computed.
  const [ignoredCharIds, setIgnoredCharIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const toggleIgnoreChar = useCallback((charId: string) => {
    setIgnoredCharIds((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId);
      else next.add(charId);
      return next;
    });
  }, []);

  const displayCombo = useMemo<ComboFormula>(() => {
    if (ignoredCharIds.size === 0) return displayComboBase;
    const lines = displayComboBase.lines.map((line) => {
      if (ignoredCharIds.has(line.charId)) return { ...line, count: 0 };
      const entry = teamBuild?.catalog.formulaIndex.get(line.formulaId);
      const sourcedFromIgnored = entry?.parts.some(
        (p) => p.statsCharId && ignoredCharIds.has(p.statsCharId)
      );
      return sourcedFromIgnored ? { ...line, count: 0 } : line;
    });
    return { ...displayComboBase, lines };
  }, [displayComboBase, ignoredCharIds, teamBuild]);

  // ── Computation ──
  const {
    result: computeResult,
    isComputing,
    error,
    start,
    stop,
  } = useAsyncWeaponChoice();

  // Display result: either from computation or restored from store
  const [displayResults, setDisplayResults] = useState<ChoiceResultCache>(() =>
    choiceResultsFromTeamResultCache(resultCache)
  );
  const displayResultsRef = useRef(displayResults);
  const handledComputeResultKeyRef = useRef<string | null>(null);
  const activeDisplayResult = displayResults[choiceMode] ?? null;
  const persistChoiceResult = useCallback(
    (mode: "weapon" | "artifact", result: WeaponChoiceResult | null) => {
      setChoiceResult(teamComp.id, mode, result);
    },
    [setChoiceResult, teamComp.id]
  );

  // Clear stale results when team composition changes
  const compositionKey = `${characters.join(",")}|${weapons.join(",")}`;
  const prevCompositionKey = useRef(compositionKey);
  useEffect(() => {
    if (prevCompositionKey.current !== compositionKey) {
      prevCompositionKey.current = compositionKey;
      clearChoiceResults(teamComp.id);
      displayResultsRef.current = {};
      setDisplayResults({});
    }
  }, [clearChoiceResults, compositionKey, teamComp.id]);

  useEffect(() => {
    const cached = choiceResultsFromTeamResultCache(resultCache);
    displayResultsRef.current = cached;
    setDisplayResults(cached);
  }, [resultCache]);

  // Update displayResult when computation yields
  useEffect(() => {
    if (!computeResult) return;
    const resultKey = [
      computeResult.mode,
      computeResult.timestamp,
      computeResult.done,
      computeResult.progress.phase,
      Object.keys(computeResult.perCharacter).length,
      computeResult.artifactAssignmentSuggestion?.bestDamage ?? "",
    ].join(":");
    if (handledComputeResultKeyRef.current === resultKey) return;
    handledComputeResultKeyRef.current = resultKey;

    const mode = computeResult.mode;
    const storeResult: WeaponChoiceResult = {
      mode,
      timestamp: computeResult.timestamp,
      perCharacter: computeResult.perCharacter,
      artifactAssignmentSuggestion: computeResult.artifactAssignmentSuggestion,
    };
    setDisplayResults((prev) => {
      const next = { ...prev, [mode]: storeResult };
      displayResultsRef.current = next;
      return next;
    });
    // Persist when done
    if (computeResult.done) {
      setChoiceResult(teamComp.id, mode, storeResult);
    }
  }, [computeResult, setChoiceResult, teamComp.id]);

  // Stop computation on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const handleRun = useCallback(() => {
    if (!teamBuild || !weaponStats) return;
    const charConfigs = buildWeaponChoiceCharConfigs(
      teamComp,
      setupConfig,
      accountData
    );
    const opts: WeaponChoiceOptions = {
      mode: choiceMode,
      baseConfigs: configs,
      charConfigs,
      combo: displayCombo,
      calcContext: resolveCalcContext(damageConfig.calcContext),
      weaponStats,
      opts: combatOptions,
      enemyAura: localEnemyAura,
      extraBuffs: localExtraBuffs.length > 0 ? localExtraBuffs : undefined,
    };
    start(opts);
  }, [
    teamBuild,
    weaponStats,
    configs,
    teamComp,
    setupConfig,
    accountData,
    displayCombo,
    choiceMode,
    damageConfig.calcContext,
    combatOptions,
    localEnemyAura,
    localExtraBuffs,
    start,
  ]);

  const charIds = useMemo(
    () => characters.filter((id): id is string => id != null),
    [characters]
  );

  // ── Header with back button + team name ──
  const headerContent = (
    <div className="flex items-center gap-2 px-0.5 lg:px-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="shrink-0 h-10 w-10 -ml-2 hover:bg-white/10"
      >
        <ArrowLeft className="w-5 h-5 text-foreground/70" />
      </Button>
      <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-sky-500/90 to-sky-600/60 tracking-tight truncate flex-1">
        {teamComp.name || t.ui("teamComp.tabWeaponChoice")}
      </h2>
    </div>
  );

  // ── Loading / error states ──
  if (!gameStatsReady) {
    return (
      <ScrollLayout>
        <div
          className={cn(
            "flex flex-col w-full animate-in fade-in duration-300 pb-12",
            "gap-1.5 lg:gap-2"
          )}
        >
          {headerContent}
          <div className="flex items-center justify-center pt-16 md:pt-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t.ui("common.loading")}
          </div>
        </div>
      </ScrollLayout>
    );
  }

  if (buildError) {
    return (
      <ScrollLayout>
        <div
          className={cn(
            "flex flex-col w-full animate-in fade-in duration-300 pb-12",
            "gap-1.5 lg:gap-2"
          )}
        >
          {headerContent}
          <div className="flex items-center justify-center pt-16 md:pt-24 text-destructive">
            {buildError}
          </div>
        </div>
      </ScrollLayout>
    );
  }

  if (!teamBuild || configs.length === 0) {
    return (
      <ScrollLayout>
        <div
          className={cn(
            "flex flex-col w-full animate-in fade-in duration-300 pb-12",
            "gap-1.5 lg:gap-2"
          )}
        >
          {headerContent}
          <div className="flex items-center justify-center pt-16 md:pt-24 text-muted-foreground">
            {t.ui("teamComp.analyzerDesc")}
          </div>
        </div>
      </ScrollLayout>
    );
  }

  return (
    <ScrollLayout>
      <div
        className={cn(
          "flex flex-col w-full animate-in fade-in duration-300 pb-12",
          "gap-1.5 lg:gap-2"
        )}
      >
        {headerContent}

        {/* 1. Team Roster (refinement hidden — weapons are the test variable) */}
        <TeamRosterCard
          teamComp={teamComp}
          setupConfig={setupConfig}
          updateTeamComp={updateTeamComp}
          updateTeamSetupConfig={updateTeamSetupConfig}
          accountData={accountData}
          characterStats={characterStats ?? {}}
          weaponStats={weaponStats ?? {}}
          isMobile={isMobile}
          t={t}
        />

        {/* 2. Formula Selection Card */}
        <FormulaSelectorCard
          characters={characters}
          damageConfig={damageConfig}
          onDamageConfigChange={updateDamageConfig}
          allFormulas={allFormulas}
          availableFormulas={availableFormulas}
          displayFormulas={displayFormulas}
          teamBuild={teamBuild}
          buildError={buildError}
          comboLineMap={comboLineMap}
          setComboLineCount={setComboLineCount}
          onResetCombo={onResetCombo}
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
          ignoredCharIds={ignoredCharIds}
          onToggleIgnoreChar={toggleIgnoreChar}
          t={t}
        />

        {/* 3. Results Card */}
        <WeaponChoiceResultCard
          teamComp={teamComp}
          setupConfig={setupConfig}
          characters={characters}
          weapons={weapons}
          artifacts={artifacts}
          onTeamCompChange={(comp) => updateTeamComp(comp.id, comp)}
          onSetupConfigChange={updateSetupConfig}
          setChoiceResult={persistChoiceResult}
          charIds={charIds}
          isComputing={isComputing}
          choiceMode={choiceMode}
          onChoiceModeChange={setChoiceMode}
          result={activeDisplayResult}
          progress={computeResult?.progress}
          error={error}
          onRun={handleRun}
          onStop={stop}
          t={t}
        />

        <TeamDetailAspectLinks teamId={teamComp.id} currentAspect="weapon" />
      </div>
    </ScrollLayout>
  );
}
