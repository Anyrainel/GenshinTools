import { ItemIcon } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
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
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import type { Rarity, WeaponResource } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import type { UseInvestmentAnalysisState } from "@/hooks/useInvestmentAnalysis";
import {
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
} from "@/lib/gameStatsLoader";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import type {
  InvestmentCharConfig,
  InvestmentOptions,
} from "@/lib/team-comp/investmentOptimizer";
import type {
  CalcContext,
  ComboFormula,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { getAssetUrl } from "@/lib/utils";
import { useTeamStore } from "@/stores/useTeamStore";
import { AlertTriangle, Loader2, Play, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InvestmentChart } from "./InvestmentChart";
import { InvestmentSequence } from "./InvestmentSequence";
import { InvestmentTable } from "./InvestmentTable";

interface InvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamBuild: TeamBuild;
  baseConfigs: TeamSlotConfig[];
  combo: ComboFormula;
  calcContext: CalcContext;
  analysis: UseInvestmentAnalysisState;
  reactionOverrides?: Record<string, ReactionOverride>;
  perChar?: Record<string, { minEr: number; minCr: number }>;
}

type ViewTab = "chart" | "table" | "sequence";

export function InvestmentDialog({
  open,
  onOpenChange,
  teamId,
  teamBuild,
  baseConfigs,
  combo,
  calcContext,
  analysis,
  reactionOverrides,
  perChar,
}: InvestmentDialogProps) {
  const { t } = useLanguage();
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const storedConfigs = useTeamStore(
    (s) => s.teams.find((t) => t.id === teamId)?.investmentConfigs
  );
  const { progress, result, isComputing, error, start, stop } = analysis;

  const [activeTab, setActiveTab] = useState<ViewTab>("sequence");

  // Per-character investment configs — initialize from store or defaults,
  // then reconcile with current baseConfigs (team roster may have changed)
  const [charConfigs, setCharConfigs] = useState<InvestmentCharConfig[]>(() =>
    reconcileConfigs(
      storedConfigs && storedConfigs.length > 0 ? storedConfigs : [],
      baseConfigs
    )
  );

  // Re-reconcile when baseConfigs change (character added/removed/swapped)
  const baseCharIds = baseConfigs.map((b) => b.charId).join(",");
  useEffect(() => {
    setCharConfigs((prev) => reconcileConfigs(prev, baseConfigs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCharIds]);

  // Persist to store whenever charConfigs change
  useEffect(() => {
    updateTeam(teamId, { investmentConfigs: charConfigs });
  }, [charConfigs, teamId, updateTeam]);

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
    const opts: InvestmentOptions = {
      configs: charConfigs,
      baseConfigs,
      teamBuild,
      combo,
      calcContext,
      reactionOverrides,
      perChar,
    };
    start(opts, !!result);
  }, [
    charConfigs,
    baseConfigs,
    result,
    teamBuild,
    combo,
    calcContext,
    reactionOverrides,
    perChar,
    start,
  ]);

  const overallPct = progress ? Math.round(progress.overallProgress * 100) : 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t.ui("teamComp.investment")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription asChild>
            <span className="text-sm text-muted-foreground">
              {t.ui("teamComp.investDesc")}
            </span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Buff stack warning */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {t.ui("teamComp.investBuffWarn")}
        </div>

        {/* Combo formula summary + Team config */}
        <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap py-1">
          {combo.lines
            .filter((l) => l.count > 0)
            .map((l) => {
              const entry = teamBuild.charBuilds[
                l.charId
              ]?.charBase.getFormulaEntry(l.formulaId);
              const label = entry ? t.resolveLabel(entry.label) : l.formulaId;
              const char = charactersById[l.charId];
              return (
                <div
                  key={`${l.charId}.${l.formulaId}`}
                  className="flex items-center gap-1 text-xs"
                >
                  {char && (
                    <img
                      src={getAssetUrl(char.imagePath)}
                      alt={l.charId}
                      className="w-4 h-4 rounded-full"
                    />
                  )}
                  <span>{label}</span>
                  <span className="font-mono text-muted-foreground">
                    ×{l.count}
                  </span>
                </div>
              );
            })}
        </div>

        <div className="flex items-start justify-center gap-4 py-2 flex-wrap">
          {charConfigs.map((cfg) => {
            const bc = baseConfigs.find((b) => b.charId === cfg.charId);
            if (!bc) return null;
            return (
              <div
                key={cfg.charId}
                className="flex flex-col items-center gap-1.5"
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
                {progress.message}
              </p>
            </div>
          ) : result ? (
            <div className="absolute inset-0 flex items-center justify-center gap-1 pointer-events-none">
              <div className="flex gap-1 pointer-events-auto">
                {(["chart", "table", "sequence"] as const).map((tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab(tab)}
                    className="text-sm h-8 px-3"
                  >
                    {tab === "chart"
                      ? t.ui("teamComp.investChart")
                      : tab === "table"
                        ? t.ui("teamComp.investTable")
                        : t.ui("teamComp.investSequence")}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {error && (
            <p className="text-sm text-destructive z-10">{error.message}</p>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-3">
            {activeTab === "chart" && (
              <InvestmentChart
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
            )}
            {activeTab === "table" && (
              <InvestmentTable
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
            )}
            {activeTab === "sequence" && (
              <InvestmentSequence
                result={result}
                charIds={charConfigs.map((c) => c.charId)}
              />
            )}
          </div>
        )}
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
  config: InvestmentCharConfig;
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
      return (item: unknown) => {
        const w = item as WeaponResource;
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
    return (item: unknown) => {
      const w = item as WeaponResource;
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

  return (
    <div className="flex items-end gap-1">
      {/* Character */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-medium whitespace-nowrap">
          {t.character(config.charId)}
        </span>
        {char && (
          <ItemIcon
            imagePath={char.imagePath}
            rarity={config.rarity}
            size="md"
            characterId={config.charId}
          />
        )}
      </div>
      {/* Artifact */}
      <ItemIcon
        imagePath={artifactIcon.imagePath}
        imagePath2={artifactIcon.imagePath2}
        rarity={artifactIcon.rarity}
        size="sm"
      />
      {/* 3/4★ weapon */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm">3/4★</span>
        <ItemPicker
          type="weapon"
          value={config.weapon4Star?.id ?? null}
          onChange={(id) => onUpdateWeapon(config.charId, "4", id as string)}
          onClear={() => onUpdateWeapon(config.charId, "4", null)}
          filter={filterLowStar}
          triggerSize="sm"
          menuSize="sm"
        />
      </div>
      {/* 5★ weapon */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm">5★</span>
        <ItemPicker
          type="weapon"
          value={config.weapon5Star?.id ?? null}
          onChange={(id) => onUpdateWeapon(config.charId, "5", id as string)}
          onClear={() => onUpdateWeapon(config.charId, "5", null)}
          filter={filter5Star}
          triggerSize="sm"
          menuSize="sm"
        />
      </div>
    </div>
  );
}

// ─── Per-character start C/R selectors ───

function CharStartSelectors({
  config,
  onUpdateStart,
}: {
  config: InvestmentCharConfig;
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
      opts.push({ value: "0", label: t.ui("teamComp.investWeapon4StarR0") });
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
        {t.ui("teamComp.investMinConfig")}
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
  config: InvestmentCharConfig;
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
        {t.ui("teamComp.investMaxConfig")}
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
  imagePath: string;
  imagePath2?: string;
  rarity: Rarity;
} {
  if (bc.artifactSetId) {
    const art = artifactsById[bc.artifactSetId];
    return {
      imagePath: art?.imagePaths.flower ?? "",
      rarity: art?.rarity ?? 5,
    };
  }
  if (bc.artifactHalfSetIds.length >= 2) {
    const half1 = artifactHalfSetsById[bc.artifactHalfSetIds[0]];
    const half2 = artifactHalfSetsById[bc.artifactHalfSetIds[1]];
    const art1 = half1?.setIds
      .map((id) => artifactsById[id])
      .find((a) => a?.rarity === 5);
    const art2 = half2?.setIds
      .map((id) => artifactsById[id])
      .find((a) => a?.rarity === 5);
    return {
      imagePath: art1?.imagePaths.flower ?? "",
      imagePath2: art2?.imagePaths.flower ?? "",
      rarity: 5,
    };
  }
  return { imagePath: "", rarity: 5 };
}

// ─── Reconcile stored configs with current team roster ───

function reconcileConfigs(
  stored: InvestmentCharConfig[],
  baseConfigs: TeamSlotConfig[]
): InvestmentCharConfig[] {
  const baseIds = new Set(baseConfigs.map((b) => b.charId));
  // Keep stored configs that still exist in the team
  const kept = stored.filter((c) => baseIds.has(c.charId));
  const keptIds = new Set(kept.map((c) => c.charId));
  // Add defaults for new team members
  const added = buildDefaultCharConfigs(
    baseConfigs.filter((b) => !keptIds.has(b.charId))
  );
  // Return in baseConfigs order
  const byId = new Map([...kept, ...added].map((c) => [c.charId, c]));
  return baseConfigs.map((b) => byId.get(b.charId)!);
}

// ─── Default config builder ───

function buildDefaultCharConfigs(
  baseConfigs: TeamSlotConfig[]
): InvestmentCharConfig[] {
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
