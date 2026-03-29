import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type { Rarity, WeaponResource } from "@/data/types";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { useGameStats } from "@/hooks/useGameStats";
import {
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
} from "@/lib/gameStatsLoader";
import type {
  AnalyzerCharConfig,
  AnalyzerOptions,
  ComboCountOverrides,
  MinErOverrides,
  StoredAnalyzerCharConfig,
} from "@/lib/team-comp/analyzer";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { buildTeamConfigs } from "@/lib/team-comp/teamOptUtils";
import type {
  ComboFormula,
  ComboLine,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { getAssetUrl } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import type { Team } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Play,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalyzerChart } from "./AnalyzerChart";
import { AnalyzerComboTab } from "./AnalyzerComboTab";
import { AnalyzerSequence } from "./AnalyzerSequence";
import { AnalyzerTable } from "./AnalyzerTable";

// ─── Props ───

interface InvestmentDetailProps {
  team: Team;
  onBack: () => void;
}

// ─── Helpers ───

function getArtifactIconProps(bc: TeamSlotConfig): {
  artifactSetId?: string;
  halfSetIds?: [string | number, string | number];
  imagePath?: string;
} {
  if (bc.artifactSetId) {
    return { artifactSetId: bc.artifactSetId };
  }
  if (bc.artifactHalfSetIds.length >= 2) {
    return {
      halfSetIds: [bc.artifactHalfSetIds[0], bc.artifactHalfSetIds[1]],
    };
  }
  return { imagePath: "" };
}

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
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const { ready: gameStatsReady, characterStats, weaponStats } = useGameStats();

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
        team.enemyAura,
        team.extraBuffs
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
    team.enemyAura,
    team.extraBuffs,
    gameStatsReady,
    characterStats,
    weaponStats,
  ]);

  // ── Compute templateCombo ──
  const templateCombo = useMemo<ComboFormula>(() => {
    if (team.combos.length > 0) return team.combos[0];
    const lines: ComboLine[] = [];
    if (teamBuild) {
      for (const charId of team.characters) {
        if (!charId) continue;
        const combo = teamBuild.getCombo(charId);
        for (const [formulaId, count] of Object.entries(combo)) {
          if (count > 0) lines.push({ charId, formulaId, count });
        }
      }
    }
    return {
      id: `combo-${Date.now()}`,
      label: { en: "Rotation", zh: "循环" },
      lines,
    };
  }, [team.combos, teamBuild, team.characters]);

  // ── Compute perChar ──
  const perChar = useMemo(() => {
    return Object.fromEntries(
      team.characters
        .filter((c): c is string => c != null)
        .map((cid) => [
          cid,
          { minEr: team.minEr?.[cid] ?? 1.0, minCr: team.minCr?.[cid] ?? 0 },
        ])
    );
  }, [team.characters, team.minEr, team.minCr]);

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

  const handleRun = useCallback(() => {
    if (!teamBuild) return;
    const opts: AnalyzerOptions = {
      configs: charConfigs,
      baseConfigs: configs,
      teamBuild,
      templateCombo,
      comboOverrides:
        Object.keys(comboOverrides).length > 0 ? comboOverrides : undefined,
      perChar,
      minErOverrides:
        Object.keys(minErOverrides).length > 0 ? minErOverrides : undefined,
    };
    start(opts, !!result);
  }, [
    charConfigs,
    configs,
    result,
    teamBuild,
    templateCombo,
    comboOverrides,
    minErOverrides,
    perChar,
    start,
  ]);

  // ── Result tab toggle ──
  type ResultTab = "table" | "sequence";
  const [resultTab, setResultTab] = useState<ResultTab>("table");
  const [comboOpen, setComboOpen] = useState(true);

  // Auto-scroll to chart on completion
  const prevIsComputing = useRef(isComputing);
  useEffect(() => {
    if (prevIsComputing.current && !isComputing && result) {
      // results just appeared — no tab switch needed since chart is always visible
    }
    prevIsComputing.current = isComputing;
  }, [isComputing, result]);

  const overallPct = progress ? Math.round(progress.overallProgress * 100) : 0;

  // ── Header with back button + team name + character icons ──
  const headerContent = (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <TrendingUp className="w-5 h-5 text-primary" />
      <h2 className="text-lg font-semibold">
        {team.name || t.ui("teamComp.tabInvestment")}
      </h2>
      <div className="flex items-center gap-1 ml-1">
        {team.characters.map(
          (charId, i) =>
            charId && (
              <ItemIcon key={`${charId}-${i}`} characterId={charId} size="xs" />
            )
        )}
      </div>
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
      <div className="flex flex-col gap-4 py-3 px-1">
        {/* 1. Character Config Card */}
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">
            {t.ui("teamComp.analyzer")}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
            {charConfigs.map((cfg) => {
              const bc = configs.find((b) => b.charId === cfg.charId);
              if (!bc) return null;
              return (
                <div
                  key={cfg.charId}
                  className="flex flex-col items-center gap-1 md:gap-1.5"
                >
                  <CharConfigGroup
                    config={cfg}
                    baseConfig={bc}
                    onUpdateWeapon={updateWeapon}
                  />
                  <CharStartSelectors
                    config={cfg}
                    onUpdateStart={updateStartValues}
                  />
                  <CharMaxSelectors
                    config={cfg}
                    onUpdateMax={updateMaxValues}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Combo Override Card (collapsible) */}
        <Collapsible open={comboOpen} onOpenChange={setComboOpen}>
          <div className="rounded-lg border border-border bg-card">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 w-full p-3 text-left hover:bg-muted/30 rounded-t-lg transition-colors"
              >
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${comboOpen ? "" : "-rotate-90"}`}
                />
                <span className="text-sm font-medium">
                  {t.ui("teamComp.analyzerCombo")}
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3">
                <AnalyzerComboTab
                  teamBuild={teamBuild}
                  charConfigs={charConfigs}
                  baseConfigs={configs}
                  templateCombo={templateCombo}
                  comboOverrides={comboOverrides}
                  minErOverrides={minErOverrides}
                  perChar={perChar}
                  onComboOverridesChange={setComboOverrides}
                  onMinErOverridesChange={setMinErOverrides}
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* 3. Run Controls */}
        <div className="flex items-center gap-2">
          <Button
            onClick={isComputing ? stop : handleRun}
            variant={isComputing ? "destructive" : "default"}
            size="sm"
            className="shrink-0"
          >
            {isComputing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                {t.ui("common.stop")}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                {t.ui("teamComp.runAnalysis")}
              </>
            )}
          </Button>

          {isComputing && progress ? (
            <div className="flex-1 space-y-1">
              <Progress value={overallPct} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {progress.phase === "phase1"
                  ? t.ui("teamComp.analyzerPhase1")
                  : progress.phase === "phase2"
                    ? t.ui("teamComp.analyzerPhase2")
                    : progress.phase === "phase3"
                      ? t.ui("teamComp.analyzerPhase3")
                      : ""}
              </p>
            </div>
          ) : null}

          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </div>

        {/* 4. Chart (always visible) */}
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-medium mb-2">
            {t.ui("teamComp.analyzerChart")}
          </h3>
          {result ? (
            <AnalyzerChart
              result={result}
              charIds={charConfigs.map((c) => c.charId)}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t.ui("teamComp.analyzerNoResults")}
            </p>
          )}
        </div>

        {/* 5. Table / Sequence Toggle */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1 mb-2">
            <Button
              variant={resultTab === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setResultTab("table")}
              className="text-xs h-7 px-2"
            >
              {t.ui("teamComp.analyzerTable")}
            </Button>
            <Button
              variant={resultTab === "sequence" ? "default" : "ghost"}
              size="sm"
              onClick={() => setResultTab("sequence")}
              className="text-xs h-7 px-2"
            >
              {t.ui("teamComp.analyzerSequence")}
            </Button>
          </div>

          {result ? (
            resultTab === "table" ? (
              <AnalyzerTable
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
            ) : (
              <AnalyzerSequence
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t.ui("teamComp.analyzerNoResults")}
            </p>
          )}
        </div>
      </div>
    </ScrollLayout>
  );
}

// ─── Per-character group: [char] [artifact] [4★wep] [5★wep] ───

function CharConfigGroup({
  config,
  baseConfig,
  onUpdateWeapon,
}: {
  config: AnalyzerCharConfig;
  baseConfig: TeamSlotConfig;
  onUpdateWeapon: (
    charId: string,
    star: "4" | "5",
    weaponId: string | null
  ) => void;
}) {
  const { t } = useLanguage();
  const { characterStats, weaponStats } = useGameStats();
  const char = charactersById[config.charId];

  const charWeaponType = useMemo(() => {
    if (!char || !characterStats) return undefined;
    return getCharacterDisplayMeta(char, characterStats[config.charId])
      .weaponType;
  }, [char, characterStats, config.charId]);

  const makeFilter = useCallback(
    (targetRarity: number) => {
      return (w: WeaponResource) => {
        if (!weaponStats) return w.rarity === targetRarity;
        const meta = getWeaponDisplayMeta(w, weaponStats[w.id]);
        if (meta.rarity !== targetRarity) return false;
        if (charWeaponType && meta.type && meta.type !== charWeaponType)
          return false;
        return true;
      };
    },
    [weaponStats, charWeaponType]
  );

  const filterLowStar = useMemo(() => {
    return (w: WeaponResource) => {
      if (!weaponStats) return w.rarity === 3 || w.rarity === 4;
      const meta = getWeaponDisplayMeta(w, weaponStats[w.id]);
      if (meta.rarity !== 3 && meta.rarity !== 4) return false;
      if (charWeaponType && meta.type && meta.type !== charWeaponType)
        return false;
      return true;
    };
  }, [weaponStats, charWeaponType]);
  const filter5Star = useMemo(() => makeFilter(5), [makeFilter]);
  const artifactIcon = useMemo(
    () => getArtifactIconProps(baseConfig),
    [baseConfig]
  );

  const rosterWeapon = weaponsById[baseConfig.weaponId];
  const rosterIs5Star = rosterWeapon?.rarity === 5;

  const artifactTooltip = useMemo(() => {
    if (baseConfig.artifactSetId) {
      return <ArtifactTooltip setId={baseConfig.artifactSetId} />;
    }
    if (baseConfig.artifactHalfSetIds.length >= 2) {
      return (
        <MixedSetTooltip
          id1={baseConfig.artifactHalfSetIds[0]}
          id2={baseConfig.artifactHalfSetIds[1]}
        />
      );
    }
    return null;
  }, [baseConfig.artifactSetId, baseConfig.artifactHalfSetIds]);

  return (
    <div className="flex items-end gap-0.5 md:gap-1">
      {/* Character */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs md:text-sm font-medium whitespace-nowrap">
          {t.character(config.charId)}
        </span>
        {char && (
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <ItemIcon characterId={config.charId} size="sm" />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="p-0 border-none bg-transparent shadow-none"
            >
              <CharacterTooltip characterId={config.charId} />
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Artifact */}
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            <ItemIcon {...artifactIcon} size="xs" />
          </span>
        </TooltipTrigger>
        {artifactTooltip && (
          <TooltipContent
            side="bottom"
            className="p-0 border-none bg-transparent shadow-none"
          >
            {artifactTooltip}
          </TooltipContent>
        )}
      </Tooltip>
      {/* 3/4★ weapon */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs md:text-sm">3/4★</span>
        {!rosterIs5Star && rosterWeapon ? (
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <ItemIcon weaponId={baseConfig.weaponId} size="xs" />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="p-0 border-none bg-transparent shadow-none"
            >
              <WeaponTooltip weaponId={baseConfig.weaponId} />
            </TooltipContent>
          </Tooltip>
        ) : (
          <ItemPicker
            type="weapon"
            value={config.weapon4Star?.id ?? null}
            onChange={(id) => onUpdateWeapon(config.charId, "4", id as string)}
            onClear={() => onUpdateWeapon(config.charId, "4", null)}
            filter={filterLowStar}
            triggerSize="xs"
            menuSize="sm"
          />
        )}
      </div>
      {/* 5★ weapon */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs md:text-sm">5★</span>
        {rosterIs5Star && rosterWeapon ? (
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <ItemIcon weaponId={baseConfig.weaponId} size="xs" />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="p-0 border-none bg-transparent shadow-none"
            >
              <WeaponTooltip weaponId={baseConfig.weaponId} />
            </TooltipContent>
          </Tooltip>
        ) : (
          <ItemPicker
            type="weapon"
            value={config.weapon5Star?.id ?? null}
            onChange={(id) => onUpdateWeapon(config.charId, "5", id as string)}
            onClear={() => onUpdateWeapon(config.charId, "5", null)}
            filter={filter5Star}
            triggerSize="xs"
            menuSize="sm"
          />
        )}
      </div>
    </div>
  );
}

// ─── Per-character start C/R selectors ───

function CharStartSelectors({
  config,
  onUpdateStart,
}: {
  config: AnalyzerCharConfig;
  onUpdateStart: (
    charId: string,
    field: "startConstellation" | "startRefinement",
    value: number
  ) => void;
}) {
  const { t } = useLanguage();
  const is5Star = config.rarity >= 5;
  const has5Wep = !!config.weapon5Star;
  const hasBothWeps = !!config.weapon4Star && has5Wep;
  const hasAnySelector = is5Star || has5Wep;

  const weaponOptions = useMemo(() => {
    if (!has5Wep) return null;
    const opts: { value: string; label: string }[] = [];
    if (hasBothWeps) {
      opts.push({ value: "0", label: t.ui("teamComp.analyzerWeapon4StarR0") });
    }
    for (let r = 1; r <= 5; r++) {
      opts.push({
        value: String(r),
        label: t.format("common.refinementFormat", r),
      });
    }
    return opts;
  }, [has5Wep, hasBothWeps, t]);

  if (!hasAnySelector) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {t.ui("teamComp.analyzerMinConfig")}
      </span>
      {is5Star && (
        <LightweightSelect
          value={String(config.startConstellation)}
          onValueChange={(v) =>
            onUpdateStart(config.charId, "startConstellation", Number(v))
          }
        >
          <LightweightSelectTrigger className="h-6 w-[3.5rem] text-xs font-mono px-1.5">
            <LightweightSelectValue />
          </LightweightSelectTrigger>
          <LightweightSelectContent>
            {Array.from({ length: 7 }, (_, i) => (
              <LightweightSelectItem
                key={i}
                value={String(i)}
                className="text-xs font-mono"
              >
                {t.format("common.constellationFormat", i)}
              </LightweightSelectItem>
            ))}
          </LightweightSelectContent>
        </LightweightSelect>
      )}
      {weaponOptions && (
        <LightweightSelect
          value={String(config.startRefinement)}
          onValueChange={(v) =>
            onUpdateStart(config.charId, "startRefinement", Number(v))
          }
        >
          <LightweightSelectTrigger className="h-6 w-[5rem] text-xs font-mono px-1.5">
            <LightweightSelectValue />
          </LightweightSelectTrigger>
          <LightweightSelectContent>
            {weaponOptions.map((opt) => (
              <LightweightSelectItem
                key={opt.value}
                value={opt.value}
                className="text-xs font-mono"
              >
                {opt.label}
              </LightweightSelectItem>
            ))}
          </LightweightSelectContent>
        </LightweightSelect>
      )}
    </div>
  );
}

// ─── Per-character max C/R selectors ───

function CharMaxSelectors({
  config,
  onUpdateMax,
}: {
  config: AnalyzerCharConfig;
  onUpdateMax: (
    charId: string,
    field: "maxConstellation" | "maxRefinement",
    value: number
  ) => void;
}) {
  const { t } = useLanguage();
  const is5Star = config.rarity >= 5;
  const has5Wep = !!config.weapon5Star;
  const hasAnySelector = is5Star || has5Wep;

  if (!hasAnySelector) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {t.ui("teamComp.analyzerMaxConfig")}
      </span>
      {is5Star && (
        <LightweightSelect
          value={String(config.maxConstellation)}
          onValueChange={(v) =>
            onUpdateMax(config.charId, "maxConstellation", Number(v))
          }
        >
          <LightweightSelectTrigger className="h-6 w-[3.5rem] text-xs font-mono px-1.5">
            <LightweightSelectValue />
          </LightweightSelectTrigger>
          <LightweightSelectContent>
            {Array.from({ length: 7 }, (_, i) => (
              <LightweightSelectItem
                key={i}
                value={String(i)}
                className="text-xs font-mono"
              >
                {t.format("common.constellationFormat", i)}
              </LightweightSelectItem>
            ))}
          </LightweightSelectContent>
        </LightweightSelect>
      )}
      {has5Wep && (
        <LightweightSelect
          value={String(config.maxRefinement)}
          onValueChange={(v) =>
            onUpdateMax(config.charId, "maxRefinement", Number(v))
          }
        >
          <LightweightSelectTrigger className="h-6 w-[5rem] text-xs font-mono px-1.5">
            <LightweightSelectValue />
          </LightweightSelectTrigger>
          <LightweightSelectContent>
            {Array.from({ length: 6 }, (_, i) => (
              <LightweightSelectItem
                key={i}
                value={String(i)}
                className="text-xs font-mono"
              >
                {i === 0
                  ? t.ui("teamComp.noWeapon5Star")
                  : t.format("common.refinementFormat", i)}
              </LightweightSelectItem>
            ))}
          </LightweightSelectContent>
        </LightweightSelect>
      )}
    </div>
  );
}
