import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Element } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAsyncWeaponChoice } from "@/hooks/useAsyncWeaponChoice";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { WeaponChoiceOptions } from "@/lib/team-comp/analyzer/weaponChoice";
import {
  buildComboLineMap,
  buildSingleFormulaSelection,
  collectAllFormulas,
  getEffectiveCombo,
  resolveActiveCombo,
  withLineCount,
  withReactionOverride,
} from "@/lib/team-comp/calc/combo";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  buildTeamConfigs,
  buildWeaponChoiceCharConfigs,
} from "@/lib/team-comp/teamOptUtils";
import type {
  ComboFormula,
  ComboLine,
  FormulaOverride,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import type { Team, WeaponChoiceResult } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormulaSelectorCard } from "./FormulaSelectorCard";
import { TeamRosterCard } from "./TeamRosterCard";
import { WeaponChoiceResultCard } from "./WeaponChoiceResultCard";

interface WeaponChoiceDetailProps {
  team: Team;
  onBack: () => void;
}

export function WeaponChoiceDetail({ team, onBack }: WeaponChoiceDetailProps) {
  const { t } = useLanguage();
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const accountData = useActiveAccountData();
  const { ready: gameStatsReady, characterStats, weaponStats } = useGameStats();
  const isMobile = useMediaQuery("(max-width: 1023px)");

  // ── Environment settings (unified with Damage tab) ──
  const localEnemyAura = team.enemyAura;
  const localExtraBuffs = team.extraBuffs ?? [];

  const setLocalEnemyAura = useCallback(
    (el: Element | undefined) => {
      updateTeam(team.id, { enemyAura: el });
    },
    [team.id, updateTeam]
  );

  // ── Compute baseConfigs ──
  const configs = useMemo(
    () => buildTeamConfigs(team, accountData),
    [team, accountData]
  );

  // ── Compute teamBuild ──
  // biome-ignore lint/correctness/useExhaustiveDependencies: characterStats/weaponStats are intentional invalidation triggers
  const { teamBuild, buildError } = useMemo(() => {
    if (!gameStatsReady) return { teamBuild: null, buildError: null };
    try {
      const tb = new TeamBuild(
        configs,
        team.opts || {},
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
    team.opts,
    localEnemyAura,
    localExtraBuffs,
    gameStatsReady,
    characterStats,
    weaponStats,
  ]);

  // ── Formula management (unified with Damage tab) ──
  const formulaMode = team.formulaMode ?? "single";
  const [expandedLine, setExpandedLine] = useState<{
    charId: string;
    formulaId: string;
    reaction: string;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset expanded line when team changes
  useEffect(() => setExpandedLine(null), [team.id]);

  // Derive formula lists from teamBuild
  const availableFormulas = useMemo(() => {
    return teamBuild ? teamBuild.getFormulaIds() : {};
  }, [teamBuild]);

  const displayFormulas = useMemo(() => {
    return teamBuild ? teamBuild.getAllFormulaIds() : {};
  }, [teamBuild]);

  const validCharIds = Object.keys(availableFormulas);

  const allFormulas = useMemo(
    () => collectAllFormulas(validCharIds, availableFormulas, teamBuild),
    [validCharIds, availableFormulas, teamBuild]
  );

  // ── Combo management (unified with Damage tab) ──
  const combo = useMemo<ComboFormula>(
    () =>
      team.combo ??
      resolveActiveCombo([], undefined, teamBuild, team.characters),
    [team.combo, teamBuild, team.characters]
  );

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

  const handleReactionChange = useCallback(
    (
      charId: string,
      formulaId: string,
      reaction: string,
      override: FormulaOverride
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

  const onResetCombo = useCallback(() => {
    if (!teamBuild) return;
    const lines: ComboLine[] = [];
    for (const charId of team.characters) {
      if (!charId) continue;
      const comboData = teamBuild.getCombo(charId);
      for (const [formulaId, count] of Object.entries(comboData)) {
        if (count > 0) {
          lines.push({ charId, formulaId, count });
        }
      }
    }
    updateTeam(team.id, {
      combo: { id: combo.id, label: combo.label, lines },
    });
  }, [teamBuild, team.characters, team.id, combo.id, combo.label, updateTeam]);

  // ── Effective combo (unified projection, shared with Damage tab) ──
  const displayCombo = useMemo<ComboFormula>(
    () => getEffectiveCombo(team),
    [team]
  );

  // ── Computation ──
  const {
    result: computeResult,
    isComputing,
    error,
    start,
    stop,
  } = useAsyncWeaponChoice();

  // Display result: either from computation or restored from store
  const [displayResult, setDisplayResult] = useState<WeaponChoiceResult | null>(
    () => team.weaponChoiceResult ?? null
  );

  // Clear stale results when team composition changes
  const compositionKey = `${team.characters.join(",")}|${team.weapons.join(",")}`;
  const prevCompositionKey = useRef(compositionKey);
  useEffect(() => {
    if (prevCompositionKey.current !== compositionKey) {
      prevCompositionKey.current = compositionKey;
      updateTeam(team.id, { weaponChoiceResult: null });
      setDisplayResult(null);
    }
  }, [compositionKey, team.id, updateTeam]);

  // Update displayResult when computation yields
  useEffect(() => {
    if (computeResult) {
      const storeResult: WeaponChoiceResult = {
        timestamp: computeResult.timestamp,
        perCharacter: computeResult.perCharacter,
      };
      setDisplayResult(storeResult);
      // Persist when done
      if (computeResult.done) {
        updateTeam(team.id, { weaponChoiceResult: storeResult });
      }
    }
  }, [computeResult, team.id, updateTeam]);

  // Stop computation on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const handleRun = useCallback(() => {
    if (!teamBuild || !weaponStats) return;
    const charConfigs = buildWeaponChoiceCharConfigs(team, accountData);
    const opts: WeaponChoiceOptions = {
      baseConfigs: configs,
      charConfigs,
      combo: displayCombo,
      calcContext: team.calcContext,
      weaponStats,
      opts: team.opts || {},
      enemyAura: localEnemyAura,
      extraBuffs: localExtraBuffs.length > 0 ? localExtraBuffs : undefined,
    };
    start(opts);
  }, [
    teamBuild,
    weaponStats,
    configs,
    team,
    accountData,
    displayCombo,
    localEnemyAura,
    localExtraBuffs,
    start,
  ]);

  const charIds = useMemo(
    () => team.characters.filter((id): id is string => id != null),
    [team.characters]
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
        {team.name || t.ui("teamComp.tabWeaponChoice")}
      </h2>
    </div>
  );

  // ── Loading / error states ──
  if (!gameStatsReady) {
    return (
      <ScrollLayout header={headerContent}>
        <div className="flex items-center justify-center pt-16 md:pt-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t.ui("common.loading")}
        </div>
      </ScrollLayout>
    );
  }

  if (buildError) {
    return (
      <ScrollLayout header={headerContent}>
        <div className="flex items-center justify-center pt-16 md:pt-24 text-destructive">
          {buildError}
        </div>
      </ScrollLayout>
    );
  }

  if (!teamBuild || configs.length === 0) {
    return (
      <ScrollLayout header={headerContent}>
        <div className="flex items-center justify-center pt-16 md:pt-24 text-muted-foreground">
          {t.ui("teamComp.analyzerDesc")}
        </div>
      </ScrollLayout>
    );
  }

  return (
    <ScrollLayout header={headerContent}>
      <div
        className={cn(
          "flex flex-col w-full animate-in fade-in duration-300 pb-12",
          "gap-1.5 lg:gap-2"
        )}
      >
        {/* 1. Team Roster (refinement hidden — weapons are the test variable) */}
        <TeamRosterCard
          team={team}
          updateTeam={updateTeam}
          accountData={accountData}
          characterStats={characterStats ?? {}}
          weaponStats={weaponStats ?? {}}
          isMobile={isMobile}
          t={t}
        />

        {/* 2. Formula Selection Card */}
        <FormulaSelectorCard
          team={team}
          effectiveTeam={team}
          updateTeam={updateTeam}
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
          isMobile={isMobile}
          t={t}
        />

        {/* 3. Results Card */}
        <WeaponChoiceResultCard
          team={team}
          updateTeam={updateTeam}
          charIds={charIds}
          isComputing={isComputing}
          result={displayResult}
          progress={computeResult?.progress}
          error={error}
          onRun={handleRun}
          onStop={stop}
          t={t}
        />
      </div>
    </ScrollLayout>
  );
}
