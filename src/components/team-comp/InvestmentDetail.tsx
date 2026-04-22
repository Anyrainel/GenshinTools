import { ScrollLayout } from "@/components/layout/ScrollLayout";
import type { ItemIconSize } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Element } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  fullToStored,
  reconcileConfigs,
  rereconcileConfigs,
} from "@/lib/team-comp/analyzer/analyzerConfig";
import type { AnalyzerOptions } from "@/lib/team-comp/analyzer/types";
import type {
  ComboCountOverrides,
  MinErOverrides,
} from "@/lib/team-comp/analyzer/types";
import type { AnalyzerCharConfig } from "@/lib/team-comp/analyzer/types";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { buildTeamConfigs } from "@/lib/team-comp/teamConfigUtils";
import {
  type ComboFormula,
  type ComboLine,
  type ReactionOverride,
  resolveCalcContext,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalyzerComboCard } from "./AnalyzerComboCard";
import { AnalyzerConfigCard } from "./AnalyzerConfigCard";
import { AnalyzerResultCard } from "./AnalyzerResultCard";

interface InvestmentDetailProps {
  team: Team;
  onBack: () => void;
}

export function InvestmentDetail({ team, onBack }: InvestmentDetailProps) {
  const { t } = useLanguage();
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const accountData = useActiveAccountData();
  const { ready: gameStatsReady, characterStats, weaponStats } = useGameStats();

  // 3-tier icon sizing matching TeamRosterCard
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const isNarrow = useMediaQuery("(max-width: 559px)");
  const isLg = useMediaQuery("(max-width: 1279px)");
  const charIconSize: ItemIconSize = isNarrow
    ? "xs"
    : isMobile
      ? "xl"
      : isLg
        ? "md"
        : "xl";
  const subIconSize: ItemIconSize = isNarrow
    ? "xs"
    : isMobile
      ? "lg"
      : isLg
        ? "sm"
        : "lg";

  // ── Analyzer-specific environment settings (independent from DamageView) ──
  const localEnemyAura = team.analyzer?.enemyAura;
  const localExtraBuffs = team.analyzer?.extraBuffs ?? [];

  // Ref to avoid stale closures on team.analyzer in callbacks/effects that also write to it
  const analyzerRef = useRef(team.analyzer);
  analyzerRef.current = team.analyzer;

  const setLocalEnemyAura = useCallback(
    (el: Element | undefined) => {
      updateTeam(team.id, {
        analyzer: { ...analyzerRef.current, enemyAura: el },
      });
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
          analyzer: {
            ...analyzerRef.current,
            extraBuffs: patch.extraBuffs ?? [],
          },
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

  // ── Compute templateCombo ──
  // Use the DamageView combo structure for counts, but strip reactions —
  // the analyzer manages its own reactions via analyzerReactionOverrides.
  const templateCombo = useMemo<ComboFormula>(() => {
    const sourceCombo = team.combo;
    let baseLines: ComboLine[];
    if (sourceCombo) {
      // Strip reactions from DamageView combo lines — only keep charId/formulaId/count
      baseLines = sourceCombo.lines.map(({ charId, formulaId, count }) => ({
        charId,
        formulaId,
        count,
      }));
    } else if (teamBuild) {
      baseLines = [];
      for (const charId of team.characters) {
        if (!charId) continue;
        const combo = teamBuild.catalog.getCombo(charId);
        for (const [formulaId, count] of Object.entries(combo)) {
          if (count > 0) baseLines.push({ charId, formulaId, count });
        }
      }
    } else {
      baseLines = [];
    }
    // Merge lines with the same charId+formulaId (since stripping reactions may cause duplicates)
    const merged = new Map<string, ComboLine>();
    for (const line of baseLines) {
      const key = `${line.charId}.${line.formulaId}`;
      const existing = merged.get(key);
      if (existing) {
        existing.count += line.count;
      } else {
        merged.set(key, { ...line });
      }
    }
    return {
      id: sourceCombo?.id ?? `combo-${Date.now()}`,
      label: sourceCombo?.label ?? { en: "Rotation", zh: "循环" },
      lines: Array.from(merged.values()),
    };
  }, [team.combo, teamBuild, team.characters]);

  // ── Analyzer-specific reaction overrides (persisted, independent from DamageView) ──
  const reactionOverrides = team.analyzer?.reactionOverrides ?? {};

  // Effective combo: templateCombo with analyzer reaction overrides applied.
  // Override key is `charId.formulaId` — all lines for the same formula share one override.
  const effectiveCombo = useMemo<ComboFormula>(() => {
    if (Object.keys(reactionOverrides).length === 0) return templateCombo;
    return {
      ...templateCombo,
      lines: templateCombo.lines.map((line) => {
        const override = reactionOverrides[`${line.charId}.${line.formulaId}`];
        return override ? { ...line, reaction: override } : line;
      }),
    };
  }, [templateCombo, reactionOverrides]);

  const handleReactionChange = useCallback(
    (stableKey: string, override: ReactionOverride) => {
      updateTeam(team.id, {
        analyzer: {
          ...analyzerRef.current,
          reactionOverrides: {
            ...reactionOverrides,
            [stableKey]: override,
          },
        },
      });
    },
    [team.id, updateTeam, reactionOverrides]
  );

  // ── State management ──
  const storedConfigs = team.analyzer?.configs;
  const [charConfigs, setCharConfigs] = useState<AnalyzerCharConfig[]>(() =>
    configs.length > 0
      ? reconcileConfigs(
          storedConfigs && storedConfigs.length > 0 ? storedConfigs : [],
          configs
        )
      : []
  );

  const [comboOverrides, setComboOverrides] = useState<ComboCountOverrides>(
    () => team.analyzer?.comboOverrides ?? {}
  );
  const [minErOverrides, setMinErOverrides] = useState<MinErOverrides>(
    () => team.analyzer?.minErOverrides ?? {}
  );

  const analysis = useAnalyzer(team.id);
  const { progress, result, isComputing, error, start, stop } = analysis;

  // Re-reconcile when baseConfigs change
  const baseCharIds = configs.map((b) => b.charId).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: baseCharIds is a stable string key derived from configs; using configs directly would over-fire
  useEffect(() => {
    if (configs.length > 0) {
      setCharConfigs((prev) =>
        prev.length > 0
          ? rereconcileConfigs(prev, configs)
          : reconcileConfigs(storedConfigs ?? [], configs)
      );
    }
  }, [baseCharIds]);

  // Persist charConfigs to store
  const baseConfigsRef = useRef(configs);
  baseConfigsRef.current = configs;
  // biome-ignore lint/correctness/useExhaustiveDependencies: analyzerRef avoids infinite loop from team.analyzer
  useEffect(() => {
    if (charConfigs.length === 0) return;
    const bcs = baseConfigsRef.current;
    const stored = charConfigs.map((cfg) => {
      const bc = bcs.find((b) => b.charId === cfg.charId);
      return bc ? fullToStored(cfg, bc) : fullToStored(cfg, bcs[0]);
    });
    updateTeam(team.id, {
      analyzer: { ...analyzerRef.current, configs: stored },
    });
  }, [charConfigs, team.id, updateTeam]);

  // Persist combo/minEr overrides
  // biome-ignore lint/correctness/useExhaustiveDependencies: analyzerRef avoids infinite loop from team.analyzer
  useEffect(() => {
    updateTeam(team.id, {
      analyzer: {
        ...analyzerRef.current,
        comboOverrides:
          Object.keys(comboOverrides).length > 0 ? comboOverrides : undefined,
      },
    });
  }, [comboOverrides, team.id, updateTeam]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: analyzerRef avoids infinite loop from team.analyzer
  useEffect(() => {
    updateTeam(team.id, {
      analyzer: {
        ...analyzerRef.current,
        minErOverrides:
          Object.keys(minErOverrides).length > 0 ? minErOverrides : undefined,
      },
    });
  }, [minErOverrides, team.id, updateTeam]);

  // ── Callbacks ──
  const updateWeapon = useCallback(
    (charId: string, star: "4" | "5", weaponId: string | null) => {
      setCharConfigs((prev) =>
        prev.map((c) => {
          if (c.charId !== charId) return c;
          if (star === "4") {
            if (!weaponId) {
              return {
                ...c,
                weapon4Star: undefined,
                startRefinement:
                  c.startRefinement === 0 && c.weapon5Star
                    ? 1
                    : c.startRefinement,
              };
            }
            return {
              ...c,
              weapon4Star: { id: weaponId, refinement: 5 },
              startRefinement:
                c.startRefinement === 1 && c.weapon5Star
                  ? 0
                  : c.startRefinement,
            };
          }
          if (!weaponId) {
            return {
              ...c,
              weapon5Star: undefined,
              startRefinement: 0,
              maxRefinement: 0,
            };
          }
          return {
            ...c,
            weapon5Star: { id: weaponId },
            startRefinement: c.weapon4Star ? 0 : 1,
            maxRefinement: 5,
          };
        })
      );
    },
    []
  );

  const updateStartValues = useCallback(
    (
      charId: string,
      field: "startConstellation" | "startRefinement",
      value: number
    ) => {
      setCharConfigs((prev) =>
        prev.map((c) => (c.charId === charId ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  const updateMaxValues = useCallback(
    (
      charId: string,
      field: "maxConstellation" | "maxRefinement",
      value: number
    ) => {
      setCharConfigs((prev) =>
        prev.map((c) => (c.charId === charId ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  const handleRun = useCallback(() => {
    if (!teamBuild) return;
    const opts: AnalyzerOptions = {
      configs: charConfigs,
      baseConfigs: configs,
      teamBuild,
      templateCombo: effectiveCombo,
      comboOverrides:
        Object.keys(comboOverrides).length > 0 ? comboOverrides : undefined,
      minErOverrides:
        Object.keys(minErOverrides).length > 0 ? minErOverrides : undefined,
      calcContext: resolveCalcContext(team.calcContext),
    };
    start(opts, !!result);
  }, [
    charConfigs,
    configs,
    result,
    teamBuild,
    effectiveCombo,
    comboOverrides,
    minErOverrides,
    team.calcContext,
    start,
  ]);

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
      <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/60 tracking-tight truncate flex-1">
        {team.name || t.ui("teamComp.tabInvestment")}
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
        {/* 1. Character Config Card */}
        <AnalyzerConfigCard
          charConfigs={charConfigs}
          configs={configs}
          onUpdateWeapon={updateWeapon}
          onUpdateStart={updateStartValues}
          onUpdateMax={updateMaxValues}
          charIconSize={charIconSize}
          subIconSize={subIconSize}
        />

        {/* 2. Combo Override Card (collapsible) */}
        <AnalyzerComboCard
          teamBuild={teamBuild}
          charConfigs={charConfigs}
          configs={configs}
          templateCombo={effectiveCombo}
          comboOverrides={comboOverrides}
          minErOverrides={minErOverrides}
          reactionOverrides={reactionOverrides}
          onComboOverridesChange={setComboOverrides}
          onMinErOverridesChange={setMinErOverrides}
          onReactionChange={handleReactionChange}
          envTeam={envTeam}
          updateEnvTeam={updateEnvTeam}
          localEnemyAura={localEnemyAura}
          onEnemyAuraChange={setLocalEnemyAura}
          t={t}
        />

        {/* 3. Results: settings + run button + chart + table/sequence */}
        <AnalyzerResultCard
          team={team}
          updateTeam={updateTeam}
          charConfigs={charConfigs}
          isComputing={isComputing}
          result={result}
          progress={progress}
          error={error}
          onRun={handleRun}
          onStop={stop}
        />
      </div>
    </ScrollLayout>
  );
}
