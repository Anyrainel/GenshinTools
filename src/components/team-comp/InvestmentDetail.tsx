import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import type { ItemIconSize } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Element } from "@/data/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type {
  ComboFormula,
  ComboLine,
  ReactionOverride,
} from "@/lib/dmgcalc/types";
import { resolveCalcContext } from "@/lib/dmgcalc/utils";
import {
  fullToStored,
  reconcileConfigs,
  rereconcileConfigs,
} from "@/lib/team-comp/analyzer/analyzerConfig";
import type {
  AnalyzerCharConfig,
  AnalyzerOptions,
  ComboCountOverrides,
  MinErOverrides,
} from "@/lib/team-comp/analyzer/types";
import { buildTeamSlotConfigs } from "@/lib/team-comp/teamConfigUtils";
import { teamCompToArrays } from "@/lib/team-comp/teamDeltas";
import type { TeamComp, TeamSetupConfig } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/stores/useTeamStore";
import { AnalyzerComboCard } from "./AnalyzerComboCard";
import { AnalyzerConfigCard } from "./AnalyzerConfigCard";
import { AnalyzerResultCard } from "./AnalyzerResultCard";
import { TeamDetailAspectLinks } from "./TeamDetailAspectLinks";

interface InvestmentDetailProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  onBack: () => void;
}

export function InvestmentDetail({
  teamComp,
  setupConfig,
  onBack,
}: InvestmentDetailProps) {
  const { t } = useLanguage();
  const updateTeamSetupConfig = useTeamStore((s) => s.updateTeamSetupConfig);
  const accountData = useActiveAccountData();
  const characterStats = characterStatsResource.use();
  const weaponStats = weaponStatsResource.use();
  const gameStatsReady = characterStats !== null && weaponStats !== null;

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
  const teamId = teamComp.id;
  const { characters } = useMemo(() => teamCompToArrays(teamComp), [teamComp]);
  const characterIds = useMemo(
    () => characters.filter((charId): charId is string => charId != null),
    [characters]
  );
  const damageConfig = setupConfig.damage ?? {};
  const investmentConfig = setupConfig.investment;
  const combatOptions = setupConfig.combatOptions;

  // ── Analyzer-specific environment settings (independent from DamageView) ──
  const localEnemyAura = investmentConfig?.enemyAura;
  const localExtraBuffs = investmentConfig?.extraBuffs ?? [];

  // Ref to avoid stale closures on team.analyzer in callbacks/effects that also write to it
  const analyzerRef = useRef(investmentConfig);
  analyzerRef.current = investmentConfig;

  const setLocalEnemyAura = useCallback(
    (el: Element | undefined) => {
      updateTeamSetupConfig(teamId, (config) => ({
        ...config,
        investment: { ...analyzerRef.current, enemyAura: el },
      }));
    },
    [teamId, updateTeamSetupConfig]
  );

  const setLocalExtraBuffs = useCallback(
    (extraBuffs: typeof localExtraBuffs) => {
      updateTeamSetupConfig(teamId, (config) => ({
        ...config,
        investment: {
          ...analyzerRef.current,
          extraBuffs,
        },
      }));
    },
    [teamId, updateTeamSetupConfig]
  );

  // ── Compute baseConfigs ──
  const configs = useMemo(
    () => buildTeamSlotConfigs(teamComp, setupConfig, accountData),
    [teamComp, setupConfig, accountData]
  );

  // ── Compute teamBuild ──
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

  // ── Compute templateCombo ──
  // Use the DamageView combo structure for counts, but strip reactions —
  // the analyzer manages its own reactions via analyzerReactionOverrides.
  const templateCombo = useMemo<ComboFormula>(() => {
    const sourceCombo = damageConfig.combo;
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
      for (const charId of characters) {
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
  }, [damageConfig.combo, teamBuild, characters]);

  // ── Analyzer-specific reaction overrides (persisted, independent from DamageView) ──
  const reactionOverrides = investmentConfig?.reactionOverrides ?? {};

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
      updateTeamSetupConfig(teamId, (config) => ({
        ...config,
        investment: {
          ...analyzerRef.current,
          reactionOverrides: {
            ...reactionOverrides,
            [stableKey]: override,
          },
        },
      }));
    },
    [teamId, updateTeamSetupConfig, reactionOverrides]
  );

  // ── State management ──
  const storedConfigs = investmentConfig?.configs;
  const [charConfigs, setCharConfigs] = useState<AnalyzerCharConfig[]>(() =>
    configs.length > 0
      ? reconcileConfigs(
          storedConfigs && storedConfigs.length > 0 ? storedConfigs : [],
          configs
        )
      : []
  );

  const [comboOverrides, setComboOverrides] = useState<ComboCountOverrides>(
    () => investmentConfig?.comboOverrides ?? {}
  );
  const [minErOverrides, setMinErOverrides] = useState<MinErOverrides>(
    () => investmentConfig?.minErOverrides ?? {}
  );

  const analysis = useAnalyzer(teamId);
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
  useEffect(() => {
    if (charConfigs.length === 0) return;
    const bcs = baseConfigsRef.current;
    const stored = charConfigs.map((cfg) => {
      const bc = bcs.find((b) => b.charId === cfg.charId);
      return bc ? fullToStored(cfg, bc) : fullToStored(cfg, bcs[0]);
    });
    updateTeamSetupConfig(teamId, (config) => ({
      ...config,
      investment: { ...analyzerRef.current, configs: stored },
    }));
  }, [charConfigs, teamId, updateTeamSetupConfig]);

  // Persist combo/minEr overrides
  useEffect(() => {
    updateTeamSetupConfig(teamId, (config) => ({
      ...config,
      investment: {
        ...analyzerRef.current,
        comboOverrides:
          Object.keys(comboOverrides).length > 0 ? comboOverrides : undefined,
      },
    }));
  }, [comboOverrides, teamId, updateTeamSetupConfig]);

  useEffect(() => {
    updateTeamSetupConfig(teamId, (config) => ({
      ...config,
      investment: {
        ...analyzerRef.current,
        minErOverrides:
          Object.keys(minErOverrides).length > 0 ? minErOverrides : undefined,
      },
    }));
  }, [minErOverrides, teamId, updateTeamSetupConfig]);

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
      calcContext: resolveCalcContext(damageConfig.calcContext),
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
    damageConfig.calcContext,
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
        {teamComp.name || t.ui("teamComp.tabInvestment")}
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
          envCharacters={characterIds}
          extraBuffs={localExtraBuffs}
          onExtraBuffsChange={setLocalExtraBuffs}
          localEnemyAura={localEnemyAura}
          onEnemyAuraChange={setLocalEnemyAura}
          t={t}
        />

        {/* 3. Results: settings + run button + chart + table/sequence */}
        <AnalyzerResultCard
          calcContext={damageConfig.calcContext ?? {}}
          onCalcContextChange={(calcContext) => {
            updateTeamSetupConfig(teamId, (config) => ({
              ...config,
              damage: { ...(config.damage ?? {}), calcContext },
            }));
          }}
          charConfigs={charConfigs}
          isComputing={isComputing}
          result={result}
          progress={progress}
          error={error}
          onRun={handleRun}
          onStop={stop}
        />

        <TeamDetailAspectLinks teamId={teamId} currentAspect="investment" />
      </div>
    </ScrollLayout>
  );
}
