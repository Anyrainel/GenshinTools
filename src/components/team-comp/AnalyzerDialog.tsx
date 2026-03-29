import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Button } from "@/components/ui/button";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type { Rarity, WeaponResource } from "@/data/types";
import type { UseAnalyzerState } from "@/hooks/useAnalyzer";
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
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import type { ComboFormula, TeamSlotConfig } from "@/lib/team-comp/types";
import { getAssetUrl } from "@/lib/utils";
import { useTeamStore } from "@/stores/useTeamStore";
import { Loader2, Play, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalyzerChart } from "./AnalyzerChart";
import { AnalyzerComboTab } from "./AnalyzerComboTab";
import { AnalyzerSequence } from "./AnalyzerSequence";
import { AnalyzerTable } from "./AnalyzerTable";

interface AnalyzerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamBuild: TeamBuild;
  baseConfigs: TeamSlotConfig[];
  templateCombo: ComboFormula;
  analysis: UseAnalyzerState;
  perChar?: Record<string, { minEr: number; minCr: number }>;
}

type ViewTab = "combo" | "chart" | "table" | "sequence";

export function AnalyzerDialog({
  open,
  onOpenChange,
  teamId,
  teamBuild,
  baseConfigs,
  templateCombo,
  analysis,
  perChar,
}: AnalyzerDialogProps) {
  const { t } = useLanguage();
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const storedConfigs = team?.analyzerConfigs;
  const { progress, result, isComputing, error, start, stop } = analysis;

  const [activeTab, setActiveTab] = useState<ViewTab>("combo");
  const [comboOverrides, setComboOverrides] = useState<ComboCountOverrides>(
    () => team?.analyzerComboOverrides ?? {}
  );
  const [minErOverrides, setMinErOverrides] = useState<MinErOverrides>(
    () => team?.analyzerMinErOverrides ?? {}
  );

  // Auto-switch to chart tab when analysis completes
  const prevIsComputing = useRef(isComputing);
  useEffect(() => {
    if (prevIsComputing.current && !isComputing && result) {
      setActiveTab("chart");
    }
    prevIsComputing.current = isComputing;
  }, [isComputing, result]);

  // Per-character analyzer configs — initialize from store or defaults,
  // then reconcile with current baseConfigs (team roster may have changed)
  const [charConfigs, setCharConfigs] = useState<AnalyzerCharConfig[]>(() =>
    reconcileConfigs(
      storedConfigs && storedConfigs.length > 0 ? storedConfigs : [],
      baseConfigs
    )
  );

  // Re-reconcile when baseConfigs change (character added/removed/swapped)
  const baseCharIds = baseConfigs.map((b) => b.charId).join(",");
  useEffect(() => {
    setCharConfigs((prev) => rereconcileConfigs(prev, baseConfigs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCharIds]);

  // Persist to store whenever charConfigs change (store only the alt weapon).
  // baseConfigs is intentionally omitted — when it changes, reconcileConfigs
  // produces new charConfigs, which already triggers this effect.
  const baseConfigsRef = useRef(baseConfigs);
  baseConfigsRef.current = baseConfigs;
  useEffect(() => {
    const bcs = baseConfigsRef.current;
    const stored = charConfigs.map((cfg) => {
      const bc = bcs.find((b) => b.charId === cfg.charId);
      return bc ? fullToStored(cfg, bc) : fullToStored(cfg, bcs[0]);
    });
    updateTeam(teamId, { analyzerConfigs: stored });
  }, [charConfigs, teamId, updateTeam]);

  // Persist combo/minEr overrides
  useEffect(() => {
    updateTeam(teamId, {
      analyzerComboOverrides:
        Object.keys(comboOverrides).length > 0 ? comboOverrides : undefined,
    });
  }, [comboOverrides, teamId, updateTeam]);

  useEffect(() => {
    updateTeam(teamId, {
      analyzerMinErOverrides:
        Object.keys(minErOverrides).length > 0 ? minErOverrides : undefined,
    });
  }, [minErOverrides, teamId, updateTeam]);

  const updateWeapon = useCallback(
    (charId: string, star: "4" | "5", weaponId: string | null) => {
      setCharConfigs((prev) =>
        prev.map((c) => {
          if (c.charId !== charId) return c;
          if (star === "4") {
            if (!weaponId) {
              // 4★ cleared — if startRefinement was 0 (="use 4★"), bump to R1
              return {
                ...c,
                weapon4Star: undefined,
                startRefinement:
                  c.startRefinement === 0 && c.weapon5Star
                    ? 1
                    : c.startRefinement,
              };
            }
            // 4★ set — if startRefinement was R1 (default for 5★-only), switch to 0 (="4★ R5")
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
            // 5★ weapon cleared — reset to 0
            return {
              ...c,
              weapon5Star: undefined,
              startRefinement: 0,
              maxRefinement: 0,
            };
          }
          // 5★ weapon set — default to lowest: 0 if has 4★ (="4★ R0"), 1 if no 4★ (=R1)
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
    const opts: AnalyzerOptions = {
      configs: charConfigs,
      baseConfigs,
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
    baseConfigs,
    result,
    teamBuild,
    templateCombo,
    comboOverrides,
    minErOverrides,
    perChar,
    start,
  ]);

  const overallPct = progress ? Math.round(progress.overallProgress * 100) : 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t.ui("teamComp.analyzer")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription asChild>
            <span className="text-xs md:text-sm text-muted-foreground">
              {t.ui("teamComp.analyzerDesc")}
            </span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Team config */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4 py-2">
          {charConfigs.map((cfg) => {
            const bc = baseConfigs.find((b) => b.charId === cfg.charId);
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
                <CharMaxSelectors config={cfg} onUpdateMax={updateMaxValues} />
              </div>
            );
          })}
        </div>

        {/* Toolbar: analyze button | tabs */}
        <div className="relative flex items-center py-0.5">
          <Button
            onClick={isComputing ? stop : handleRun}
            variant={isComputing ? "destructive" : "default"}
            size="sm"
            className="shrink-0 z-10"
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
            <div className="flex-1 ml-2 space-y-1">
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
          ) : (
            <div className="absolute inset-0 flex items-center justify-center gap-1 pointer-events-none">
              <div className="flex gap-1 pointer-events-auto">
                {(["combo", "chart", "table", "sequence"] as const).map(
                  (tab) => (
                    <Button
                      key={tab}
                      variant={activeTab === tab ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab(tab)}
                      className="text-xs md:text-sm h-7 md:h-8 px-2 md:px-3"
                    >
                      {tab === "combo"
                        ? t.ui("teamComp.analyzerCombo")
                        : tab === "chart"
                          ? t.ui("teamComp.analyzerChart")
                          : tab === "table"
                            ? t.ui("teamComp.analyzerTable")
                            : t.ui("teamComp.analyzerSequence")}
                    </Button>
                  )
                )}
              </div>
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive z-10">{error.message}</p>
          )}
        </div>

        {/* Tab content */}
        <div className="space-y-3">
          {activeTab === "combo" && (
            <AnalyzerComboTab
              teamBuild={teamBuild}
              charConfigs={charConfigs}
              baseConfigs={baseConfigs}
              templateCombo={templateCombo}
              comboOverrides={comboOverrides}
              minErOverrides={minErOverrides}
              perChar={perChar}
              onComboOverridesChange={setComboOverrides}
              onMinErOverridesChange={setMinErOverrides}
            />
          )}
          {activeTab === "chart" &&
            (result ? (
              <AnalyzerChart
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.ui("teamComp.analyzerNoResults")}
              </p>
            ))}
          {activeTab === "table" &&
            (result ? (
              <AnalyzerTable
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.ui("teamComp.analyzerNoResults")}
              </p>
            ))}
          {activeTab === "sequence" &&
            (result ? (
              <AnalyzerSequence
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.ui("teamComp.analyzerNoResults")}
              </p>
            ))}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
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

  // Determine which slot is fixed from the roster
  const rosterWeapon = weaponsById[baseConfig.weaponId];
  const rosterIs5Star = rosterWeapon?.rarity === 5;

  // Build artifact tooltip element based on set configuration
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
      {/* 3/4★ weapon — fixed if roster weapon is 3/4★, picker otherwise */}
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
      {/* 5★ weapon — fixed if roster weapon is 5★, picker otherwise */}
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

  // Build weapon refinement options:
  // If both 4★ and 5★ selected: "4★ (R0)" option + R1-R5
  // If only 5★: R1-R5
  // If no 5★: nothing
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

// ─── Artifact icon helper ───

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

// ─── Reconcile stored configs with current team roster ───

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
  // Keep stored configs that still exist in the team
  const kept = stored.filter((c) => baseIds.has(c.charId));
  const keptIds = new Set(kept.map((c) => c.charId));
  // Expand stored → full using roster data
  const fullKept = kept.map((sc) => {
    const bc = baseConfigs.find((b) => b.charId === sc.charId)!;
    return storedToFull(sc, bc);
  });
  // Add defaults for new team members
  const added = buildDefaultCharConfigs(
    baseConfigs.filter((b) => !keptIds.has(b.charId))
  );
  // Return in baseConfigs order
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

  // The alt weapon is the one NOT from the roster
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

// ─── Default config builder ───

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
      // If the base weapon is 3★ or 4★, use it as the low-star weapon
      weapon4Star: !is5StarWeapon
        ? { id: bc.weaponId, refinement: bc.refinement }
        : undefined,
      // If the base weapon is 5★, use it as the 5★ weapon
      weapon5Star: is5StarWeapon ? { id: bc.weaponId } : undefined,
      startConstellation: rarity >= 5 ? 0 : bc.constellation,
      // Default to lowest: 0 (= "4★") if no 5★ weapon, 1 (= R1) if only 5★
      startRefinement: is5StarWeapon ? 1 : 0,
      maxConstellation: rarity >= 5 ? 6 : bc.constellation,
      maxRefinement: is5StarWeapon ? 5 : 0,
    };
  });
}
