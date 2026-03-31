import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Element, ReactionType } from "@/data/types";
import { useAsyncWeaponChoice } from "@/hooks/useAsyncWeaponChoice";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import type { ExtraBuff } from "@/lib/team-comp/extraBuffTypes";
import {
  buildTeamConfigs,
  buildWeaponChoiceCharConfigs,
} from "@/lib/team-comp/teamOptUtils";
import type {
  ComboFormula,
  ComboLine,
  I18nLabel,
  ReactionOverride,
} from "@/lib/team-comp/types";
import type { WeaponChoiceOptions } from "@/lib/team-comp/weaponChoice";
import { cn } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import type { Team, WeaponChoiceResult } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormulaSelectorCard } from "./FormulaSelectorCard";
import { TeamRosterCard } from "./TeamRosterCard";
import type { WeaponChoiceCalcSettings } from "./WeaponChoiceResultCard";
import { WeaponChoiceResultCard } from "./WeaponChoiceResultCard";

// ─── Props ───

interface WeaponChoiceDetailProps {
  team: Team;
  onBack: () => void;
}

// ─── Main Component ───

export function WeaponChoiceDetail({ team, onBack }: WeaponChoiceDetailProps) {
  const { t } = useLanguage();
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const { ready: gameStatsReady, characterStats, weaponStats } = useGameStats();
  const isMobile = useMediaQuery("(max-width: 1023px)");

  // ── Weapon-choice-specific environment settings ──
  const localEnemyAura = team.weaponChoiceEnemyAura;
  const localExtraBuffs = team.weaponChoiceExtraBuffs ?? [];

  const setLocalEnemyAura = useCallback(
    (el: Element | undefined) => {
      updateTeam(team.id, { weaponChoiceEnemyAura: el });
    },
    [team.id, updateTeam]
  );

  // Fake team-like object for ExtraBuffsPanel (it reads team.extraBuffs)
  const envTeam = useMemo(
    () => ({ ...team, extraBuffs: localExtraBuffs }),
    [team, localExtraBuffs]
  );
  const updateEnvTeam = useCallback(
    (_id: string, patch: Partial<Team>) => {
      if (patch.extraBuffs !== undefined) {
        updateTeam(team.id, {
          weaponChoiceExtraBuffs: patch.extraBuffs ?? [],
        });
      }
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

  // ── Formula management (weapon-choice-specific) ──
  const formulaMode =
    team.weaponChoiceFormulaMode ?? team.formulaMode ?? "combo";
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
    // Include team reaction formulas
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

  // ── Combo management (weapon-choice-specific) ──
  const wcCombos = team.weaponChoiceCombos ?? team.combos;
  const wcSelectedCombo = team.weaponChoiceSelectedCombo ?? team.selectedCombo;

  const combo = useMemo<ComboFormula>(() => {
    const selected =
      wcCombos.find((c) => c.id === wcSelectedCombo) ?? wcCombos[0];
    if (selected) return selected;
    // Initialize from default combo data
    const lines: ComboLine[] = [];
    if (teamBuild) {
      for (const charId of team.characters) {
        if (!charId) continue;
        const comboData = teamBuild.getCombo(charId);
        for (const [formulaId, count] of Object.entries(comboData)) {
          if (count > 0) {
            lines.push({ charId, formulaId, count });
          }
        }
      }
    }
    return {
      id: `wc-combo-${Date.now()}`,
      label: { en: "Rotation", zh: "循环" },
      lines,
    };
  }, [wcCombos, wcSelectedCombo, teamBuild, team.characters]);

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
        wcCombos.length > 0
          ? wcCombos.map((c) => (c.id === combo.id ? updated : c))
          : [updated];
      updateTeam(team.id, { weaponChoiceCombos: newCombos });
    },
    [combo, wcCombos, team.id, updateTeam]
  );

  const setComboLineCount = useCallback(
    (charId: string, formulaId: string, reaction: string, count: number) => {
      const key = `${charId}.${formulaId}.${reaction}`;
      const existing = comboLineMap.get(key);
      if (existing) {
        if (count <= 0) {
          updateCombo((c) => ({
            ...c,
            lines: c.lines.filter((_, i) => i !== existing.lineIndex),
          }));
        } else {
          updateCombo((c) => ({
            ...c,
            lines: c.lines.map((l, i) =>
              i === existing.lineIndex ? { ...l, count } : l
            ),
          }));
        }
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

  const handleReactionChange = useCallback(
    (
      charId: string,
      formulaId: string,
      reaction: string,
      override: ReactionOverride
    ) => {
      if (formulaMode === "single") {
        updateTeam(team.id, { weaponChoiceSingleReaction: override });
        return;
      }
      const key = `${charId}.${formulaId}.${reaction}`;
      const existing = comboLineMap.get(key);
      if (existing) {
        updateCombo((c) => ({
          ...c,
          lines: c.lines.map((l, i) =>
            i === existing.lineIndex ? { ...l, reaction: override } : l
          ),
        }));
      }
    },
    [formulaMode, comboLineMap, updateCombo, updateTeam, team.id]
  );

  const handleModeChange = useCallback(
    (mode: "single" | "combo") => {
      if (mode !== formulaMode) {
        updateTeam(team.id, { weaponChoiceFormulaMode: mode });
      }
    },
    [formulaMode, updateTeam, team.id]
  );

  const onSelectSingleFormula = useCallback(
    (charId: string, formulaId: string, reaction: string) => {
      const prev = team.weaponChoiceSingleFormula;
      const sameFormula =
        prev?.charId === charId && prev?.formulaId === formulaId;
      const prevReaction = sameFormula
        ? team.weaponChoiceSingleReaction
        : undefined;
      const newReaction: ReactionOverride | undefined =
        reaction === "none"
          ? undefined
          : {
              ...prevReaction,
              reaction: reaction as ReactionType,
            };
      updateTeam(team.id, {
        weaponChoiceSingleFormula: { charId, formulaId },
        weaponChoiceSingleReaction: newReaction,
      });
    },
    [
      updateTeam,
      team.id,
      team.weaponChoiceSingleFormula,
      team.weaponChoiceSingleReaction,
    ]
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
      weaponChoiceCombos: [{ id: combo.id, label: combo.label, lines }],
    });
  }, [teamBuild, team.characters, team.id, combo.id, combo.label, updateTeam]);

  // ── Build displayCombo for FormulaSelectorCard ──
  const displayCombo = useMemo<ComboFormula>(() => {
    if (formulaMode === "single") {
      const sel = team.weaponChoiceSingleFormula;
      if (!sel) return combo; // No single formula selected yet — use full rotation
      return {
        ...combo,
        lines: [
          {
            charId: sel.charId,
            formulaId: sel.formulaId,
            count: 1,
            reaction: team.weaponChoiceSingleReaction,
          },
        ],
      };
    }
    const activeLines = combo.lines.filter((l) => l.count > 0);
    return activeLines.length > 0 ? { ...combo, lines: activeLines } : combo;
  }, [
    formulaMode,
    combo,
    team.weaponChoiceSingleFormula,
    team.weaponChoiceSingleReaction,
  ]);

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

  const handleRun = useCallback(
    (settings: WeaponChoiceCalcSettings) => {
      if (!teamBuild || !weaponStats) return;
      // Derive charConfigs from team opts/minEr/minCr at computation time
      const charConfigs = buildWeaponChoiceCharConfigs(team, accountData);
      const opts: WeaponChoiceOptions = {
        baseConfigs: configs,
        charConfigs,
        combo: displayCombo,
        calcContext: settings.calcContext,
        rollMultiplier: settings.rollMultiplier,
        substatBudget: settings.substatBudget,
        weaponStats,
        opts: team.opts || {},
        enemyAura: localEnemyAura,
        extraBuffs: localExtraBuffs.length > 0 ? localExtraBuffs : undefined,
      };
      start(opts);
    },
    [
      teamBuild,
      weaponStats,
      configs,
      team,
      accountData,
      displayCombo,
      localEnemyAura,
      localExtraBuffs,
      start,
    ]
  );

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
        <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t.ui("common.loading")}
        </div>
      </ScrollLayout>
    );
  }

  if (buildError) {
    return (
      <ScrollLayout header={headerContent}>
        <div className="flex items-center justify-center min-h-[40vh] text-destructive">
          {buildError}
        </div>
      </ScrollLayout>
    );
  }

  if (!teamBuild || configs.length === 0) {
    return (
      <ScrollLayout header={headerContent}>
        <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
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
          effectiveTeam={envTeam}
          updateTeam={updateEnvTeam}
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
