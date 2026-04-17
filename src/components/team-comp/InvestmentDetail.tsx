import { ScrollLayout } from "@/components/layout/ScrollLayout";
import type { ItemIconSize } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type { Element, Rarity } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { AnalyzerOptions } from "@/lib/team-comp/analyzer/types";
import type {
  ComboCountOverrides,
  MinErOverrides,
} from "@/lib/team-comp/analyzer/types";
import type {
  AnalyzerCharConfig,
  StoredAnalyzerCharConfig,
} from "@/lib/team-comp/analyzer/types";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { buildTeamConfigs } from "@/lib/team-comp/teamOptUtils";
import type { ExtraBuff } from "@/lib/team-comp/types";
import type {
  ComboFormula,
  ComboLine,
  FormulaOverride,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalyzerComboCard } from "./AnalyzerComboCard";
import { AnalyzerConfigCard } from "./AnalyzerConfigCard";
import type { AnalyzerCalcSettings } from "./AnalyzerResultCard";
import { AnalyzerResultCard } from "./AnalyzerResultCard";

// ─── Props ───

interface InvestmentDetailProps {
  team: Team;
  onBack: () => void;
}

// ─── Helpers ───

/** Re-reconcile already-expanded full configs when baseConfigs change (char added/removed/swapped). */
function rereconcileConfigs(
  prev: AnalyzerCharConfig[],
  baseConfigs: TeamSlotConfig[]
): AnalyzerCharConfig[] {
  const baseIds = new Set(baseConfigs.map((b) => b.charId));
  const kept = prev.filter((c) => baseIds.has(c.charId));
  const keptIds = new Set(kept.map((c) => c.charId));
  const added = buildDefaultCharConfigs(
    baseConfigs.filter((b) => !keptIds.has(b.charId))
  );
  const byId = new Map([...kept, ...added].map((c) => [c.charId, c]));
  return baseConfigs.map((b) => byId.get(b.charId)!);
}

/** Reconcile stored (persisted) configs into full AnalyzerCharConfigs using roster data. */
function reconcileConfigs(
  stored: StoredAnalyzerCharConfig[],
  baseConfigs: TeamSlotConfig[]
): AnalyzerCharConfig[] {
  const baseIds = new Set(baseConfigs.map((b) => b.charId));
  const kept = stored.filter((c) => baseIds.has(c.charId));
  const keptIds = new Set(kept.map((c) => c.charId));
  const fullKept = kept.map((sc) => {
    const bc = baseConfigs.find((b) => b.charId === sc.charId)!;
    return storedToFull(sc, bc);
  });
  const added = buildDefaultCharConfigs(
    baseConfigs.filter((b) => !keptIds.has(b.charId))
  );
  const byId = new Map([...fullKept, ...added].map((c) => [c.charId, c]));
  return baseConfigs.map((b) => byId.get(b.charId)!);
}

/** Expand a stored config into a full AnalyzerCharConfig using the roster weapon. */
function storedToFull(
  sc: StoredAnalyzerCharConfig,
  bc: TeamSlotConfig
): AnalyzerCharConfig {
  const charRes = charactersById[sc.charId];
  const rarity = (charRes?.rarity ?? 5) as Rarity;
  const rosterWeapon = weaponsById[bc.weaponId];
  const rosterIs5Star = rosterWeapon?.rarity === 5;

  return {
    charId: sc.charId,
    rarity,
    weapon4Star: rosterIs5Star
      ? sc.altWeapon
        ? { id: sc.altWeapon.id, refinement: sc.altWeapon.refinement ?? 5 }
        : undefined
      : { id: bc.weaponId, refinement: bc.refinement },
    weapon5Star: rosterIs5Star
      ? { id: bc.weaponId }
      : sc.altWeapon
        ? { id: sc.altWeapon.id }
        : undefined,
    startConstellation: sc.startConstellation,
    startRefinement: sc.startRefinement,
    maxConstellation: sc.maxConstellation,
    maxRefinement: sc.maxRefinement,
  };
}

/** Strip a full config down to the stored form (only alt weapon). */
function fullToStored(
  cfg: AnalyzerCharConfig,
  bc: TeamSlotConfig
): StoredAnalyzerCharConfig {
  const rosterWeapon = weaponsById[bc.weaponId];
  const rosterIs5Star = rosterWeapon?.rarity === 5;

  const altWeapon = rosterIs5Star
    ? cfg.weapon4Star
      ? { id: cfg.weapon4Star.id, refinement: cfg.weapon4Star.refinement }
      : undefined
    : cfg.weapon5Star
      ? { id: cfg.weapon5Star.id }
      : undefined;

  return {
    charId: cfg.charId,
    altWeapon,
    startConstellation: cfg.startConstellation,
    startRefinement: cfg.startRefinement,
    maxConstellation: cfg.maxConstellation,
    maxRefinement: cfg.maxRefinement,
  };
}

function buildDefaultCharConfigs(
  baseConfigs: TeamSlotConfig[]
): AnalyzerCharConfig[] {
  return baseConfigs.map((bc) => {
    const charRes = charactersById[bc.charId];
    const rarity: Rarity = (charRes?.rarity ?? 5) as Rarity;
    const weaponRes = weaponsById[bc.weaponId];
    const is5StarWeapon = weaponRes?.rarity === 5;

    return {
      charId: bc.charId,
      rarity,
      weapon4Star: !is5StarWeapon
        ? { id: bc.weaponId, refinement: bc.refinement }
        : undefined,
      weapon5Star: is5StarWeapon ? { id: bc.weaponId } : undefined,
      startConstellation: rarity >= 5 ? 0 : bc.constellation,
      startRefinement: is5StarWeapon ? 1 : 0,
      maxConstellation: rarity >= 5 ? 6 : bc.constellation,
      maxRefinement: is5StarWeapon ? 5 : 0,
    };
  });
}

// ─── Main Component ───

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
  const localEnemyAura = team.analyzerEnemyAura;
  const localExtraBuffs = team.analyzerExtraBuffs ?? [];

  const setLocalEnemyAura = useCallback(
    (el: Element | undefined) => {
      updateTeam(team.id, { analyzerEnemyAura: el });
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
        updateTeam(team.id, { analyzerExtraBuffs: patch.extraBuffs ?? [] });
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
    const sourceCombo =
      team.combos.find((c) => c.id === team.selectedCombo) ?? team.combos[0];
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
        const combo = teamBuild.getCombo(charId);
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
  }, [team.combos, team.selectedCombo, teamBuild, team.characters]);

  // ── Analyzer-specific reaction overrides (persisted, independent from DamageView) ──
  const reactionOverrides = team.analyzerReactionOverrides ?? {};

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
    (stableKey: string, override: FormulaOverride) => {
      updateTeam(team.id, {
        analyzerReactionOverrides: {
          ...reactionOverrides,
          [stableKey]: override,
        },
      });
    },
    [team.id, updateTeam, reactionOverrides]
  );

  // ── State management ──
  const storedConfigs = team.analyzerConfigs;
  const [charConfigs, setCharConfigs] = useState<AnalyzerCharConfig[]>(() =>
    configs.length > 0
      ? reconcileConfigs(
          storedConfigs && storedConfigs.length > 0 ? storedConfigs : [],
          configs
        )
      : []
  );

  const [comboOverrides, setComboOverrides] = useState<ComboCountOverrides>(
    () => team.analyzerComboOverrides ?? {}
  );
  const [minErOverrides, setMinErOverrides] = useState<MinErOverrides>(
    () => team.analyzerMinErOverrides ?? {}
  );

  const analysis = useAnalyzer(team.id);
  const { progress, result, isComputing, error, start, stop } = analysis;

  // Re-reconcile when baseConfigs change
  const baseCharIds = configs.map((b) => b.charId).join(",");
  useEffect(() => {
    if (configs.length > 0) {
      setCharConfigs((prev) =>
        prev.length > 0
          ? rereconcileConfigs(prev, configs)
          : reconcileConfigs(storedConfigs ?? [], configs)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    updateTeam(team.id, { analyzerConfigs: stored });
  }, [charConfigs, team.id, updateTeam]);

  // Persist combo/minEr overrides
  useEffect(() => {
    updateTeam(team.id, {
      analyzerComboOverrides:
        Object.keys(comboOverrides).length > 0 ? comboOverrides : undefined,
    });
  }, [comboOverrides, team.id, updateTeam]);

  useEffect(() => {
    updateTeam(team.id, {
      analyzerMinErOverrides:
        Object.keys(minErOverrides).length > 0 ? minErOverrides : undefined,
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

  const handleRun = useCallback(
    (settings: AnalyzerCalcSettings) => {
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
        calcContext: settings.calcContext,
        rollMultiplier: settings.rollMultiplier,
        substatBudget: settings.substatBudget,
      };
      start(opts, !!result);
    },
    [
      charConfigs,
      configs,
      result,
      teamBuild,
      effectiveCombo,
      comboOverrides,
      minErOverrides,
      start,
    ]
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
