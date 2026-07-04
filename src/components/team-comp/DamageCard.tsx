import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  Flame,
  Loader2,
  Play,
  Snowflake,
  Swords,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  OptionButton,
  OptionButtonCell,
  OptionButtonRow,
} from "@/components/ui/option-button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MainStat, MainStatSlot, Slot } from "@/data/enums";
import { charactersById } from "@/data/gameResources";
import type {
  AccountData,
  ArtifactData,
  ArtifactSetConfig,
  TierAssignment,
} from "@/data/types";
import { aggregateComboFormulaDefaults } from "@/lib/dmgcalc/core/comboBuffOverrides";
import {
  adjustPartDamage,
  formulaCritRatio,
} from "@/lib/dmgcalc/core/formulaDisplay";
import { buildBuffApplicability } from "@/lib/dmgcalc/core/statBuff";
import type { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type {
  CalcContext,
  ComboLine,
  CritMode,
  DisplayPart,
  DisplayResult,
} from "@/lib/dmgcalc/types";
import { fmtDamage } from "@/lib/team-comp/displayFormatter";
import type { GeneratorResult } from "@/lib/team-comp/generator/generator";
import { toStatSheets } from "@/lib/team-comp/teamConfigUtils";
import type {
  OptFailReason,
  TeamComp,
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamSetupConfig,
} from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { BuffLedgerFormula } from "./BuffDialog";
import { BuffLedger } from "./BuffLedger";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
  CONTROLS_CLS,
} from "./cardStyles";
import { FormulaBreakdown } from "./FormulaBreakdown";
import {
  CharCrErSettings,
  EnemyInputs,
  RollQualityInputs,
  StellarDirectCoeffInput,
} from "./GeneratorControls";
import { type ReuseEntry, StatSheetPanel } from "./StatSheetPanel";
import { SwapGuide } from "./SwapGuide";

const SESSION_PREFIX = "dmgCard.";

/** useState that persists to sessionStorage (survives HMR and page refresh). */
function useSessionState<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const fullKey = SESSION_PREFIX + key;
  const [value, _setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(fullKey);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const setValue = useCallback(
    (v: T) => {
      try {
        sessionStorage.setItem(fullKey, JSON.stringify(v));
      } catch {
        /* quota exceeded — ignore */
      }
      _setValue(v);
    },
    [fullKey]
  );
  return [value, setValue];
}

/** Check if a combo line's reaction has partial part settings. */
function hasPartialReaction(line: ComboLine): boolean {
  const ov = line.reaction;
  if (!ov) return false;
  return (
    (ov.rxnParts != null && Object.keys(ov.rxnParts).length > 0) ||
    (ov.rxnPartHits != null && Object.keys(ov.rxnPartHits).length > 0)
  );
}

/** Combo mode breakdown: 4-column grid grouped by character, with drill-down. */
function ComboBreakdown({
  characters,
  lineDamages,
  comboLines,
  comboId,
  teamBuild,
  displayResult,
  critMode,
  setCritMode,
  disableCrit,
  disableNoCrit,
  isMobile,
  t,
  artifactsByChar,
  calcContext,
  currentTotal,
  currentCaveats,
  dpsSeconds,
  setDpsSeconds,
}: {
  characters: (string | null)[];
  lineDamages: { perHit: number; total: number }[];
  comboLines: ComboLine[];
  comboId?: string;
  teamBuild: TeamBuild;
  displayResult: DisplayResult | null | undefined;
  critMode: CritMode;
  setCritMode: (mode: CritMode) => void;
  disableCrit?: boolean;
  disableNoCrit?: boolean;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  calcContext: CalcContext;
  currentTotal?: number;
  currentCaveats?: string[];
  dpsSeconds?: string;
  setDpsSeconds?: (v: string) => void;
}) {
  const allFormulaIds = useMemo(
    () => teamBuild.catalog.getFormulaIds(),
    [teamBuild]
  );
  // Filter to active lines whose formula still exists (matches combo eval filtering)
  const activeLines = comboLines.filter(
    (l) => l.count > 0 && allFormulaIds[l.charId]?.[l.formulaId] !== undefined
  );

  // Group active lines by character, applying critMode adjustment
  type LineWithDamage = {
    line: ComboLine;
    perHit: number;
    total: number;
    isPartial: boolean;
  };
  const { byChar, teamReactionLines } = useMemo(() => {
    // Cache per-formula crit ratio so each formula is only computed once
    const ratioCache = new Map<string, number>();
    const getRatio = (fKey: string): number => {
      let r = ratioCache.get(fKey);
      if (r !== undefined) return r;
      r = formulaCritRatio(displayResult?.partsByFormula[fKey] ?? [], critMode);
      ratioCache.set(fKey, r);
      return r;
    };

    const map = new Map<string, LineWithDamage[]>();
    const rxLines: LineWithDamage[] = [];
    for (let i = 0; i < activeLines.length; i++) {
      const line = activeLines[i];
      const dmg = lineDamages[i];
      if (!dmg) continue;
      const ratio = getRatio(`${line.charId}.${line.formulaId}`);
      const entry: LineWithDamage = {
        line,
        perHit: dmg.perHit * ratio,
        total: dmg.total * ratio,
        isPartial: hasPartialReaction(line),
      };
      if (line.formulaId.startsWith("rx-")) {
        rxLines.push(entry);
      } else {
        const arr = map.get(line.charId) ?? [];
        arr.push(entry);
        map.set(line.charId, arr);
      }
    }
    return { byChar: map, teamReactionLines: rxLines };
  }, [activeLines, lineDamages, critMode, displayResult?.partsByFormula]);

  // Per-character damage totals and max line proportion for color scaling
  const { charDamageMap, totalLineDamage, maxLineProportion, teamRxTotal } =
    useMemo(() => {
      const map: Record<string, number> = {};
      let total = 0;
      let maxProp = 0;
      for (const [charId, lines] of byChar) {
        const charTotal = lines.reduce((sum, l) => sum + l.total, 0);
        map[charId] = charTotal;
        total += charTotal;
      }
      const rxTotal = teamReactionLines.reduce((sum, l) => sum + l.total, 0);
      total += rxTotal;
      if (total > 0) {
        for (const lines of byChar.values()) {
          for (const l of lines) {
            const prop = l.total / total;
            if (prop > maxProp) maxProp = prop;
          }
        }
        for (const l of teamReactionLines) {
          const prop = l.total / total;
          if (prop > maxProp) maxProp = prop;
        }
      }
      return {
        charDamageMap: map,
        totalLineDamage: total,
        maxLineProportion: maxProp,
        teamRxTotal: rxTotal,
      };
    }, [byChar, teamReactionLines]);

  // Whether any visible line has partial reaction settings
  const anyPartial = useMemo(
    () =>
      Array.from(byChar.values()).some((arr) => arr.some((l) => l.isPartial)) ||
      teamReactionLines.some((l) => l.isPartial),
    [byChar, teamReactionLines]
  );

  // Maintain team character order
  const teamCharIds = characters.filter((id): id is string => id != null);

  const [expanded, setExpanded] = useSessionState("comboExpanded", true);

  // Drill-down: when a formula name is clicked, show its FormulaBreakdown
  const [focusedLine, setFocusedLine] = useState<{
    charId: string;
    formulaId: string;
  } | null>(null);

  // Look up pre-computed per-formula parts from the combo DisplayResult
  const focusedFormulaParts = useMemo(() => {
    if (!focusedLine) return undefined;
    return displayResult?.partsByFormula[
      `${focusedLine.charId}.${focusedLine.formulaId}`
    ];
  }, [focusedLine, displayResult]);

  // Combo count for focused formula (total repetitions across all combo lines)
  const focusedComboInfo = useMemo(() => {
    if (!focusedLine || !comboId) return undefined;
    const formulaKey = `${focusedLine.charId}.${focusedLine.formulaId}`;
    const count = activeLines
      .filter(
        (l) =>
          l.charId === focusedLine.charId &&
          l.formulaId === focusedLine.formulaId
      )
      .reduce((sum, l) => sum + l.count, 0);
    return {
      comboCount: count,
      comboKey: `combo:${comboId}:${formulaKey}`,
    };
  }, [focusedLine, comboId, activeLines]);

  // Aggregate combo defaults for the focused formula's drill-down (buff override dialog)
  const comboDefaults = useMemo(() => {
    if (activeLines.length === 0) return undefined;
    const sheets = toStatSheets(teamCharIds, artifactsByChar);
    return teamBuild.getComboFormulaDefaults(activeLines, sheets, calcContext);
  }, [teamBuild, activeLines, teamCharIds, artifactsByChar, calcContext]);

  const focusedComboActivation = useMemo(() => {
    if (!focusedLine || !comboDefaults) return undefined;
    return aggregateComboFormulaDefaults(
      activeLines,
      comboDefaults.perLine,
      focusedLine.charId,
      focusedLine.formulaId
    );
  }, [focusedLine, comboDefaults, activeLines]);

  return (
    <div className="space-y-1 md:space-y-2">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="border border-dashed border-border/20 rounded-lg bg-black/5 text-xs md:text-sm p-1">
          {/* Total damage row: comparison | card | DPS */}
          <div className="flex items-center justify-center">
            {/* Left wing — comparison */}
            <div className="flex-1 flex justify-end items-center">
              {currentTotal != null && currentTotal > 0 && (
                <ComparisonLabel
                  currentTotal={currentTotal}
                  optimizedTotal={totalLineDamage}
                  isMobile={isMobile}
                  t={t}
                  caveats={currentCaveats}
                />
              )}
            </div>

            {/* Total damage card — clickable to toggle breakdown */}
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-center flex-wrap rounded-xl transition-colors cursor-pointer select-none",
                  "gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2 mx-2 md:mx-3",
                  "bg-card/70 border border-primary/30 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.12)]",
                  "hover:bg-primary/15"
                )}
              >
                <div className="flex items-center gap-0">
                  <CritModeDropdown
                    critMode={critMode}
                    setCritMode={setCritMode}
                    isMobile={isMobile}
                    disableCrit={disableCrit}
                    disableNoCrit={disableNoCrit}
                    t={t}
                  />
                  <div className="text-primary font-semibold tracking-wide whitespace-nowrap leading-none text-xs md:text-sm">
                    {t.ui("teamComp.totalDamage")}
                  </div>
                </div>
                <div
                  className="text-foreground font-[math] font-black drop-shadow-sm text-2xl md:text-3xl xl:text-4xl select-text cursor-text"
                  onClick={(e) => e.stopPropagation()}
                >
                  {fmtDamage(totalLineDamage)}
                </div>
                <span className="text-muted-foreground whitespace-nowrap text-[10px] md:text-xs ml-0.5 md:ml-1.5">
                  {expanded
                    ? t.ui("teamComp.collapseFormula")
                    : t.ui("teamComp.expandFormula")}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                    expanded && "rotate-180"
                  )}
                />
              </div>
            </CollapsibleTrigger>

            {/* Right wing — DPS calculator */}
            <div className="flex-1 flex justify-start items-center">
              {dpsSeconds != null && setDpsSeconds && (
                <DpsDisplay
                  totalDamage={totalLineDamage}
                  dpsSeconds={dpsSeconds}
                  setDpsSeconds={setDpsSeconds}
                  isMobile={isMobile}
                  t={t}
                />
              )}
            </div>
          </div>

          {/* Below total: either combo grid or focused formula breakdown */}
          <CollapsibleContent>
            {focusedLine && displayResult && focusedFormulaParts ? (
              /* ── Focused formula drill-down ── */
              <div className="mt-3">
                <div className="flex items-center mx-auto w-fit border-b border-border pb-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs md:text-base text-primary hover:text-primary/80 transition-colors cursor-pointer px-1"
                    onClick={() => setFocusedLine(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t.ui("teamComp.backToCombo")}
                  </button>
                  <div className="flex items-center gap-2 ml-4">
                    {charactersById[focusedLine.charId] && (
                      <img
                        src={getAssetUrl(
                          charactersById[focusedLine.charId]!.imagePath
                        )}
                        alt={focusedLine.charId}
                        className="w-5 h-5 md:w-6 md:h-6 object-contain rounded-full bg-secondary/40 shrink-0"
                      />
                    )}
                    <span className="text-xs md:text-base font-semibold text-foreground/80">
                      {t.character(focusedLine.charId)}
                      {" — "}
                      {(() => {
                        const label =
                          allFormulaIds[focusedLine.charId]?.[
                            focusedLine.formulaId
                          ];
                        return label
                          ? t.resolveLabel(label)
                          : focusedLine.formulaId;
                      })()}
                    </span>
                    <span className="font-[math] text-sm md:text-base font-bold text-foreground ml-2">
                      {fmtDamage(
                        focusedFormulaParts.reduce(
                          (sum, p) =>
                            sum + adjustPartDamage(p, critMode) * (p.hits ?? 1),
                          0
                        )
                      )}
                    </span>
                    {focusedComboInfo && focusedComboInfo.comboCount > 1 && (
                      <span className="text-primary bg-primary/10 rounded-sm px-1 text-xs md:text-sm font-bold">
                        × {focusedComboInfo.comboCount}
                      </span>
                    )}
                  </div>
                </div>
                <FormulaBreakdown
                  parts={focusedFormulaParts}
                  highlightedStat={null}
                  critMode={critMode}
                  buffs={displayResult.buffs}
                  defaultActivation={
                    focusedComboActivation ?? displayResult.buffActivation
                  }
                  formulaKey={`${focusedLine.charId}.${focusedLine.formulaId}`}
                  comboCount={focusedComboInfo?.comboCount}
                  comboKey={focusedComboInfo?.comboKey}
                />
              </div>
            ) : (
              /* ── Per-character combo grid ── */
              <>
                <div
                  className={cn(
                    "grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-2 mt-3"
                  )}
                >
                  {teamCharIds.map((charId) => {
                    const charRes = charactersById[charId];
                    const lines = byChar.get(charId);
                    const charFormulas = allFormulaIds[charId];

                    return (
                      <div
                        key={charId}
                        className="rounded-lg border border-border/30 bg-black/5 overflow-hidden"
                      >
                        {/* Character header */}
                        <div className="flex items-center gap-2 px-3 py-1 md:py-2 border-b border-border/20 bg-black/10">
                          {charRes && (
                            <img
                              src={getAssetUrl(charRes.imagePath)}
                              alt={charId}
                              className="w-5 h-5 md:w-7 md:h-7 object-contain rounded-full bg-secondary/40 shrink-0"
                            />
                          )}
                          <span className="text-xs md:text-sm font-bold text-foreground/80 truncate">
                            {t.character(charId)}
                            {totalLineDamage > 0 &&
                              (charDamageMap[charId] ?? 0) > 0 && (
                                <span
                                  className={cn(
                                    "text-xs md:text-sm font-mono ml-1",
                                    (() => {
                                      const pct =
                                        ((charDamageMap[charId] ?? 0) /
                                          totalLineDamage) *
                                        100;
                                      if (pct >= 50)
                                        return "font-bold text-foreground";
                                      if (pct >= 20)
                                        return "font-semibold text-foreground/80";
                                      return "font-normal text-foreground/60";
                                    })()
                                  )}
                                >
                                  (
                                  {(
                                    ((charDamageMap[charId] ?? 0) /
                                      totalLineDamage) *
                                    100
                                  ).toFixed(0)}
                                  %)
                                </span>
                              )}
                          </span>
                        </div>

                        {/* Formula lines — name is clickable to drill down */}
                        <div className="p-1 flex flex-col md:grid md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-0 lg:gap-1">
                          {lines && lines.length > 0 ? (
                            lines.map(
                              ({ line, perHit, total, isPartial }, idx) => {
                                const label = charFormulas?.[line.formulaId];
                                const rxn = line.reaction?.reaction;
                                return (
                                  <div
                                    key={idx}
                                    className="flex flex-col gap-0.5 px-1 py-0.5 md:py-1"
                                  >
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 min-w-0 text-xs md:text-sm lg:text-xs xl:text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                                      onClick={() =>
                                        setFocusedLine({
                                          charId: line.charId,
                                          formulaId: line.formulaId,
                                        })
                                      }
                                    >
                                      <span className="border-b border-current truncate">
                                        <span className="truncate">
                                          {label
                                            ? t.resolveLabel(label)
                                            : line.formulaId}
                                        </span>
                                        {rxn && rxn !== "none" && (
                                          <span className="text-primary font-semibold">
                                            {" "}
                                            [{t.reaction(rxn)}]
                                          </span>
                                        )}
                                      </span>
                                      {isPartial && (
                                        <span
                                          className="text-amber-400 text-xl font-bold leading-none shrink-0"
                                          title={t.ui(
                                            "teamComp.partialReactionNote"
                                          )}
                                        >
                                          *
                                        </span>
                                      )}
                                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                    </button>
                                    <div className="flex items-baseline gap-1 text-sm md:text-base font-mono tabular-nums">
                                      <span
                                        className="text-foreground/80"
                                        style={{
                                          color: (() => {
                                            if (
                                              totalLineDamage <= 0 ||
                                              maxLineProportion <= 0
                                            )
                                              return undefined;
                                            const pct =
                                              (total / totalLineDamage) * 100;
                                            // <5% contribution: no color (falls back to class)
                                            if (pct < 5) return undefined;
                                            // Normalize within [5%, max%] to t ∈ [0, 1]
                                            const maxPct =
                                              maxLineProportion * 100;
                                            const t = Math.min(
                                              1,
                                              (pct - 5) /
                                                Math.max(1, maxPct - 5)
                                            );
                                            // Low → warm gold, high → vivid orange
                                            const hue = 45 - 20 * t;
                                            const sat = 60 + 35 * t;
                                            const lum = 75 - 12 * t;
                                            return `hsl(${hue}, ${sat}%, ${lum}%)`;
                                          })(),
                                        }}
                                      >
                                        {fmtDamage(perHit)}
                                      </span>
                                      {line.count > 1 && (
                                        <>
                                          <span className="text-muted-foreground">
                                            ×
                                          </span>
                                          <span className="text-muted-foreground">
                                            {line.count}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                            )
                          ) : (
                            <span className="text-sm text-muted-foreground px-1 py-1">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Team Reactions section */}
                {teamReactionLines.length > 0 && (
                  <div className="rounded-lg border border-border/30 bg-black/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1 md:py-2 border-b border-border/20 bg-black/10">
                      <span className="text-xs md:text-sm font-bold text-foreground/80">
                        {t.ui("teamComp.teamReactions")}
                        {totalLineDamage > 0 && teamRxTotal > 0 && (
                          <span
                            className={cn(
                              "text-xs md:text-sm font-mono ml-1",
                              (() => {
                                const pct =
                                  (teamRxTotal / totalLineDamage) * 100;
                                if (pct >= 50)
                                  return "font-bold text-foreground";
                                if (pct >= 20)
                                  return "font-semibold text-foreground/80";
                                return "font-normal text-foreground/60";
                              })()
                            )}
                          >
                            (
                            {((teamRxTotal / totalLineDamage) * 100).toFixed(0)}
                            %)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="p-1 flex flex-wrap gap-x-4 lg:gap-x-6 gap-y-0">
                      {teamReactionLines.map(
                        ({ line, perHit, total, isPartial }, idx) => {
                          const label =
                            allFormulaIds[line.charId]?.[line.formulaId];
                          return (
                            <div
                              key={idx}
                              className="flex flex-col gap-0.5 px-1 py-0.5 md:py-1"
                            >
                              <button
                                type="button"
                                className="flex items-center gap-1 min-w-0 text-xs md:text-sm lg:text-xs xl:text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                                onClick={() =>
                                  setFocusedLine({
                                    charId: line.charId,
                                    formulaId: line.formulaId,
                                  })
                                }
                              >
                                {charactersById[line.charId] && (
                                  <img
                                    src={getAssetUrl(
                                      charactersById[line.charId]!.imagePath
                                    )}
                                    alt={line.charId}
                                    className="w-4 h-4 md:w-5 md:h-5 object-contain rounded-full bg-secondary/40 shrink-0"
                                  />
                                )}
                                <span className="border-b border-current truncate">
                                  {label
                                    ? t.resolveLabel(label)
                                    : line.formulaId}
                                </span>
                                {isPartial && (
                                  <span
                                    className="text-amber-400 text-xl font-bold leading-none shrink-0"
                                    title={t.ui("teamComp.partialReactionNote")}
                                  >
                                    *
                                  </span>
                                )}
                                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                              </button>
                              <div className="flex items-baseline gap-1 text-sm md:text-base font-mono tabular-nums">
                                <span
                                  className="text-foreground/80"
                                  style={{
                                    color: (() => {
                                      if (
                                        totalLineDamage <= 0 ||
                                        maxLineProportion <= 0
                                      )
                                        return undefined;
                                      const pct =
                                        (total / totalLineDamage) * 100;
                                      if (pct < 5) return undefined;
                                      const maxPct = maxLineProportion * 100;
                                      const ratio = Math.min(
                                        1,
                                        (pct - 5) / Math.max(1, maxPct - 5)
                                      );
                                      const hue = 45 - 20 * ratio;
                                      const sat = 60 + 35 * ratio;
                                      const lum = 75 - 12 * ratio;
                                      return `hsl(${hue}, ${sat}%, ${lum}%)`;
                                    })(),
                                  }}
                                >
                                  {fmtDamage(perHit)}
                                </span>
                                {line.count > 1 && (
                                  <>
                                    <span className="text-muted-foreground">
                                      ×
                                    </span>
                                    <span className="text-muted-foreground">
                                      {line.count}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                {/* Partial reaction footnote */}
                {anyPartial && (
                  <p className="text-xs text-amber-400/80 px-1">
                    <span className="text-xl font-bold leading-none">*</span>{" "}
                    {t.ui("teamComp.partialReactionNote")}
                  </p>
                )}
              </>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

/** Single-mode result view: StatSheetPanel + FormulaBreakdown + BuffLedger. */
function SingleResultView({
  displayResult,
  resolvedFormula,
  teamBuild,
  characters,
  artifacts,
  artifactsByChar,
  critMode,
  setCritMode,
  isMobile,
  t,
  failReasons,
  frozenCharIds,
  onArtifactSwap,
  onFreezeChar,
  onUnfreezeChar,
  forceReusedCharIds,
  reuseInfo,
  currentTotal,
  currentCaveats,
  dpsSeconds,
  setDpsSeconds,
  comboId,
  preferredMainStats,
  onPreferredMainStatsChange,
  preferredMainStatsDisabled,
}: {
  displayResult: DisplayResult;
  resolvedFormula: { charId: string; formulaId: string };
  teamBuild: TeamBuild;
  characters: (string | null)[];
  artifacts: (ArtifactSetConfig | null)[];
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  critMode: CritMode;
  setCritMode: (mode: CritMode) => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  failReasons?: Record<string, OptFailReason>;
  frozenCharIds?: Set<string>;
  onArtifactSwap?: (charId: string, slot: Slot, artifact: ArtifactData) => void;
  onFreezeChar?: (charId: string) => void;
  onUnfreezeChar?: (charId: string) => void;
  forceReusedCharIds?: Set<string>;
  reuseInfo?: Map<string, ReuseEntry>;
  currentTotal?: number;
  currentCaveats?: string[];
  dpsSeconds?: string;
  setDpsSeconds?: (v: string) => void;
  /**
   * Synthetic combo id (e.g. "__single__") used to route buff-override writes
   * to the same `comboOverrides` store slot that the damage-calc pipeline
   * reads via `extractComboOverrides`. Without this, dialog writes land in a
   * dead store slot and the UI toggle has no effect.
   */
  comboId?: string;
  preferredMainStats?: Record<string, Partial<Record<MainStatSlot, MainStat>>>;
  onPreferredMainStatsChange?: (
    charId: string,
    slot: MainStatSlot,
    stat: MainStat | null
  ) => void;
  preferredMainStatsDisabled?: boolean;
}) {
  const formulaKey = `${resolvedFormula.charId}.${resolvedFormula.formulaId}`;
  const comboKey = comboId ? `combo:${comboId}:${formulaKey}` : undefined;
  const parts = displayResult.partsByFormula[formulaKey];

  const allFormulaIds = useMemo(
    () => teamBuild.catalog.getFormulaIds(),
    [teamBuild]
  );

  const totalDamage = parts
    ? parts.reduce(
        (sum, p) => sum + adjustPartDamage(p, critMode) * (p.hits ?? 1),
        0
      )
    : 0;

  const [expanded, setExpanded] = useSessionState("singleExpanded", true);

  return (
    <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
      {displayResult && (
        <StatSheetPanel
          result={displayResult}
          characters={characters}
          artifacts={artifacts}
          artifactsByChar={artifactsByChar}
          targetCharId={resolvedFormula.charId}
          highlightedStat={null}
          onStatHover={() => {}}
          t={t}
          failReasons={failReasons}
          frozenCharIds={frozenCharIds}
          onArtifactSwap={onArtifactSwap}
          onFreezeChar={onFreezeChar}
          onUnfreezeChar={onUnfreezeChar}
          forceReusedCharIds={forceReusedCharIds}
          reuseInfo={reuseInfo}
          preferredMainStats={preferredMainStats}
          onPreferredMainStatsChange={onPreferredMainStatsChange}
          preferredMainStatsDisabled={preferredMainStatsDisabled}
        />
      )}

      {parts && parts.length > 0 ? (
        <div className="space-y-1 md:space-y-2">
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <div className="border border-dashed border-border/20 rounded-lg bg-black/5 text-xs md:text-sm p-1">
              {/* Total damage row: comparison | card | DPS */}
              <div className="flex items-center justify-center">
                {/* Left wing — comparison */}
                <div className="flex-1 flex justify-end items-center">
                  {currentTotal != null && currentTotal > 0 && (
                    <ComparisonLabel
                      currentTotal={currentTotal}
                      optimizedTotal={totalDamage}
                      isMobile={isMobile}
                      t={t}
                      caveats={currentCaveats}
                    />
                  )}
                </div>

                {/* Total damage card — clickable to toggle breakdown */}
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-center flex-wrap rounded-xl transition-colors cursor-pointer select-none",
                      "gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2 mx-2 md:mx-3",
                      "bg-card/70 border border-primary/30 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.12)]",
                      "hover:bg-primary/15"
                    )}
                  >
                    <div className="flex items-center gap-0">
                      <CritModeDropdown
                        critMode={critMode}
                        setCritMode={setCritMode}
                        isMobile={isMobile}
                        {...getCritDisableFlags(parts)}
                        t={t}
                      />
                      <div className="text-primary font-semibold tracking-wide whitespace-nowrap leading-none text-xs md:text-sm">
                        {t.ui("teamComp.totalDamage")}
                      </div>
                    </div>
                    <div
                      className="text-foreground font-[math] font-black drop-shadow-sm text-2xl md:text-3xl xl:text-4xl select-text cursor-text"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {fmtDamage(totalDamage)}
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap text-[10px] md:text-xs ml-0.5 md:ml-1.5">
                      {expanded
                        ? t.ui("teamComp.collapseFormula")
                        : t.ui("teamComp.expandFormula")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                        expanded && "rotate-180"
                      )}
                    />
                  </div>
                </CollapsibleTrigger>

                {/* Right wing — DPS calculator */}
                <div className="flex-1 flex justify-start items-center">
                  {dpsSeconds != null && setDpsSeconds && (
                    <DpsDisplay
                      totalDamage={totalDamage}
                      dpsSeconds={dpsSeconds}
                      setDpsSeconds={setDpsSeconds}
                      isMobile={isMobile}
                      t={t}
                    />
                  )}
                </div>
              </div>

              <CollapsibleContent>
                <FormulaBreakdown
                  parts={parts}
                  highlightedStat={null}
                  critMode={critMode}
                  buffs={displayResult.buffs}
                  defaultActivation={displayResult.buffActivation}
                  formulaKey={formulaKey}
                  comboKey={comboKey}
                  comboCount={1}
                />
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      ) : (
        <div className="text-muted-foreground py-6 text-center text-sm">
          {t.ui("teamComp.emptyDamageMsg")}
        </div>
      )}

      {displayResult && (
        <BuffLedger
          buffs={displayResult.buffs}
          characters={characters}
          t={t}
          formulas={
            parts
              ? [
                  {
                    formulaKey,
                    parts,
                    defaultActivation: displayResult.buffActivation,
                    comboKey,
                    comboCount: 1,
                    formulaLabel:
                      allFormulaIds[resolvedFormula.charId]?.[
                        resolvedFormula.formulaId
                      ],
                  },
                ]
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Combo-mode result view: StatSheetPanel + ComboBreakdown + BuffLedger. */
function ComboResultView({
  displayResult,
  comboLines,
  comboId,
  teamBuild,
  characters,
  artifacts,
  artifactsByChar,
  calcContext,
  critMode,
  setCritMode,
  isMobile,
  t,
  failReasons,
  frozenCharIds,
  onArtifactSwap,
  onFreezeChar,
  onUnfreezeChar,
  forceReusedCharIds,
  reuseInfo,
  currentTotal,
  currentCaveats,
  dpsSeconds,
  setDpsSeconds,
  preferredMainStats,
  onPreferredMainStatsChange,
  preferredMainStatsDisabled,
}: {
  displayResult: DisplayResult;
  comboLines: ComboLine[];
  comboId?: string;
  teamBuild: TeamBuild;
  characters: (string | null)[];
  artifacts: (ArtifactSetConfig | null)[];
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  calcContext: CalcContext;
  critMode: CritMode;
  setCritMode: (mode: CritMode) => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  failReasons?: Record<string, OptFailReason>;
  frozenCharIds?: Set<string>;
  onArtifactSwap?: (charId: string, slot: Slot, artifact: ArtifactData) => void;
  onFreezeChar?: (charId: string) => void;
  onUnfreezeChar?: (charId: string) => void;
  forceReusedCharIds?: Set<string>;
  reuseInfo?: Map<string, ReuseEntry>;
  currentTotal?: number;
  currentCaveats?: string[];
  dpsSeconds?: string;
  setDpsSeconds?: (v: string) => void;
  preferredMainStats?: Record<string, Partial<Record<MainStatSlot, MainStat>>>;
  onPreferredMainStatsChange?: (
    charId: string,
    slot: MainStatSlot,
    stat: MainStat | null
  ) => void;
  preferredMainStatsDisabled?: boolean;
}) {
  const allFormulaIds = useMemo(
    () => teamBuild.catalog.getFormulaIds(),
    [teamBuild]
  );
  const activeLines = useMemo(
    () =>
      comboLines.filter(
        (l) =>
          l.count > 0 && allFormulaIds[l.charId]?.[l.formulaId] !== undefined
      ),
    [comboLines, allFormulaIds]
  );
  const teamCharIds = useMemo(
    () => characters.filter((id): id is string => id != null),
    [characters]
  );

  // Build per-formula contexts for BuffLedger's override dialog
  const comboFormulas = useMemo((): BuffLedgerFormula[] | undefined => {
    if (!displayResult) return undefined;
    const sheets = toStatSheets(teamCharIds, artifactsByChar);
    const defaults = teamBuild.getComboFormulaDefaults(
      activeLines,
      sheets,
      calcContext
    );
    return Object.entries(displayResult.partsByFormula).map(([fKey, parts]) => {
      const [charId, formulaId] = fKey.split(".");
      const count = activeLines
        .filter((l) => l.charId === charId && l.formulaId === formulaId)
        .reduce((sum, l) => sum + l.count, 0);
      const activation = aggregateComboFormulaDefaults(
        activeLines,
        defaults.perLine,
        charId,
        formulaId
      );
      // Per-formula buff resolution for correct part applicability.
      // Pass through the combo line's forceOnField so it is reflected in
      // the buff applicability chips (otherwise on-field-only buffs appear
      // "inactive" for a forced-on-field off-field part).
      const matchingLine = activeLines.find(
        (l) => l.charId === charId && l.formulaId === formulaId
      );
      let buffApplicability: Record<string, number[] | undefined> | undefined;
      try {
        const resolvedBuffs = teamBuild.resolveFormulaBuffs(
          charId,
          formulaId,
          sheets,
          calcContext,
          matchingLine?.reaction,
          matchingLine?.forceOnField
        );
        buffApplicability = buildBuffApplicability(resolvedBuffs);
      } catch {
        // Ignore — fall back to buff-level activePartIndices
      }
      return {
        formulaKey: fKey,
        parts,
        defaultActivation: activation,
        comboCount: count,
        comboKey: comboId ? `combo:${comboId}:${fKey}` : undefined,
        formulaLabel: allFormulaIds[charId]?.[formulaId],
        buffApplicability,
      };
    });
  }, [
    displayResult,
    activeLines,
    teamCharIds,
    artifactsByChar,
    teamBuild,
    calcContext,
    comboId,
    allFormulaIds,
  ]);

  return (
    <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
      {displayResult && (
        <StatSheetPanel
          result={displayResult}
          characters={characters}
          artifacts={artifacts}
          artifactsByChar={artifactsByChar}
          targetCharId={""}
          comboActiveCharIds={
            new Set(comboLines.filter((l) => l.count > 0).map((l) => l.charId))
          }
          highlightedStat={null}
          onStatHover={() => {}}
          t={t}
          failReasons={failReasons}
          frozenCharIds={frozenCharIds}
          onArtifactSwap={onArtifactSwap}
          onFreezeChar={onFreezeChar}
          onUnfreezeChar={onUnfreezeChar}
          forceReusedCharIds={forceReusedCharIds}
          reuseInfo={reuseInfo}
          preferredMainStats={preferredMainStats}
          onPreferredMainStatsChange={onPreferredMainStatsChange}
          preferredMainStatsDisabled={preferredMainStatsDisabled}
        />
      )}
      <ComboBreakdown
        characters={characters}
        lineDamages={displayResult.lineDamages ?? []}
        comboLines={comboLines}
        comboId={comboId}
        teamBuild={teamBuild}
        displayResult={displayResult}
        critMode={critMode}
        setCritMode={setCritMode}
        {...getCritDisableFlags(
          displayResult?.partsByFormula
            ? Object.values(displayResult.partsByFormula).flat()
            : undefined
        )}
        isMobile={isMobile}
        t={t}
        currentTotal={currentTotal}
        currentCaveats={currentCaveats}
        dpsSeconds={dpsSeconds}
        setDpsSeconds={setDpsSeconds}
        artifactsByChar={artifactsByChar}
        calcContext={calcContext}
      />
      {displayResult && (
        <BuffLedger
          buffs={displayResult.buffs}
          characters={characters}
          t={t}
          formulas={comboFormulas}
        />
      )}
    </div>
  );
}

interface DamageCardProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  characters: (string | null)[];
  artifacts: (ArtifactSetConfig | null)[];
  onSetupConfigChange: (
    updater:
      | Partial<TeamSetupConfig>
      | ((config: TeamSetupConfig) => TeamSetupConfig)
  ) => void;
  resolvedFormula: { charId: string; formulaId: string } | null;
  isMobile: boolean;
  // Current equipped
  equippedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
  currentDisplayResult: DisplayResult | null | undefined;
  // Optimizer
  accountData: AccountData | null;
  activeContext: CalcContext;
  isComputing: boolean;
  teamProgress: TeamOptimizationProgress | null;
  teamResult: TeamOptimizationResult | null;
  teamError: Error | null;
  handleOptimize: () => void;
  timeBudgetSec: number;
  onTimeBudgetChange: (sec: number) => void;
  optimizedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
  optimizedDisplayResult: DisplayResult | null | undefined;
  minErRaw: number;
  // Generator (dev only)
  genComputing: boolean;
  genResult: GeneratorResult | null;
  genError: Error | null;
  handleGenerate: () => void;
  genArtifactsByChar: Record<string, Record<string, ArtifactData>>;
  genDisplayResult: DisplayResult | null | undefined;
  // Combo/single mode
  formulaMode?: "single" | "combo";
  comboLines?: ComboLine[] | null;
  comboId?: string;
  teamBuild?: TeamBuild | null;
  // Freeze
  hasOptResult?: boolean;
  /** True when every roster character has artifacts (frozen/force-reused/optimized) */
  allCharsResolved?: boolean;
  isFrozen?: boolean;
  isFullyFrozen?: boolean;
  isPartiallyFrozen?: boolean;
  frozenCharIds?: Set<string>;
  onFreezeAll?: () => void;
  onUnfreezeAll?: () => void;
  onFreezeChar?: (charId: string) => void;
  onUnfreezeChar?: (charId: string) => void;
  // Artifact swap (ephemeral editing of optimizer results)
  onArtifactSwap?: (charId: string, slot: Slot, artifact: ArtifactData) => void;
  hasSwapOverrides?: boolean;
  onRestoreOriginal?: () => void;
  // Force reuse
  forceReusedCharIds?: Set<string>;
  /** Per-character reuse info: "locked" (force-reused) or "shared" (pool expansion) */
  reuseInfo?: Map<string, ReuseEntry>;
  /** Freeze a character's equipped artifacts from the current tab */
  onFreezeCharFromCurrent?: (charId: string) => void;
  /** Unfreeze from the current tab — clears optimize-tab cache */
  onUnfreezeCharFromCurrent?: (charId: string) => void;
  /** Frozen char IDs for the current tab (value-equivalence: only chars whose equipped arts match frozen) */
  currentTabFrozenCharIds?: Set<string>;
  // Tier-aware pool
  tierAssignments?: TierAssignment;
  // Optimizer main-stat filter (sands/goblet/circlet preference per char)
  preferredMainStats?: Record<string, Partial<Record<MainStatSlot, MainStat>>>;
  onPreferredMainStatsChange?: (
    charId: string,
    slot: MainStatSlot,
    stat: MainStat | null
  ) => void;
  preferredMainStatsDisabled?: boolean;
}

// ─── Shared inline control helpers ───

type CtxProps = {
  calcContext: Partial<CalcContext> | undefined;
  activeContext: CalcContext;
  onCalcContextChange: (patch: Partial<CalcContext>) => void;
  t: ReturnType<typeof useLanguage>["t"];
};

const LABEL_CLS =
  "font-semibold text-foreground/80 select-none whitespace-nowrap text-[10px] md:text-sm";

function EnemyFields({
  calcContext,
  onCalcContextChange,
  t,
}: Omit<CtxProps, "activeContext">) {
  return (
    <EnemyInputs
      enemyLevel={calcContext?.enemyLevel ?? ""}
      onEnemyLevelChange={(raw) => {
        const num = Number(raw);
        if (!Number.isNaN(num)) onCalcContextChange({ enemyLevel: num });
      }}
      enemyRes={
        calcContext?.enemyRes != null
          ? Math.round(calcContext.enemyRes * 100)
          : ""
      }
      onEnemyResChange={(raw) => {
        const num = Number(raw);
        if (!Number.isNaN(num)) onCalcContextChange({ enemyRes: num / 100 });
      }}
      t={t}
    />
  );
}

function CritModeDropdown({
  critMode,
  setCritMode,
  isMobile,
  disableCrit,
  disableNoCrit,
  t,
}: {
  critMode: CritMode;
  setCritMode: (mode: CritMode) => void;
  isMobile: boolean;
  disableCrit?: boolean;
  disableNoCrit?: boolean;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <Select<CritMode> value={critMode} onValueChange={(v) => setCritMode(v)}>
      <SelectTrigger
        className={cn(
          "w-auto font-semibold border-none bg-transparent shadow-none focus:ring-0 text-amber-400 px-1 py-0 gap-0.5 shrink-0 [&>svg:last-child]:hidden",
          isMobile ? "h-5 text-xs" : "h-6 text-sm"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
        <ChevronsUpDown
          className={cn(
            "opacity-60 shrink-0",
            isMobile ? "w-3 h-3" : "w-3.5 h-3.5"
          )}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="expected">
          {t.ui("teamComp.critModeExpected")}
        </SelectItem>
        <SelectItem value="crit" disabled={disableCrit}>
          {t.ui("teamComp.critModeCrit")}
        </SelectItem>
        <SelectItem value="noCrit" disabled={disableNoCrit}>
          {t.ui("teamComp.critModeNoCrit")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Derive crit-mode disable flags from display parts. */
function getCritDisableFlags(parts?: DisplayPart[]): {
  disableCrit: boolean;
  disableNoCrit: boolean;
} {
  if (!parts || parts.length === 0)
    return { disableCrit: false, disableNoCrit: false };
  const crs = parts.map((p) =>
    p.template === "transform"
      ? p.statValues.reactionCr || 0
      : p.statValues.cr || 0
  );
  // Disable CRIT if all parts have cr <= 0 (never crits)
  const disableCrit = crs.every((cr) => cr <= 0);
  // Disable Non-CRIT if all parts have cr >= 1 (always crits)
  const disableNoCrit = crs.every((cr) => cr >= 1);
  return { disableCrit, disableNoCrit };
}

/** Inline DPS calculator: seconds input + dmg/s display. */
function DpsDisplay({
  totalDamage,
  dpsSeconds,
  setDpsSeconds,
  isMobile,
  t,
}: {
  totalDamage: number;
  dpsSeconds: string;
  setDpsSeconds: (v: string) => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const sec = Number(dpsSeconds);
  const hasDps = dpsSeconds !== "" && sec > 0 && totalDamage > 0;
  const textCls = isMobile ? "text-xs" : "text-sm";
  return (
    <div
      className={cn("flex items-baseline gap-1 shrink-0", textCls)}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="font-bold text-muted-foreground">DPS</span>
      <Input
        type="text"
        inputMode="numeric"
        value={dpsSeconds}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "" || /^\d*\.?\d*$/.test(raw)) setDpsSeconds(raw);
        }}
        className={cn(
          "text-center font-bold border-border/30 bg-white/5 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          isMobile
            ? "text-xs h-5 w-7 px-0.5 py-0"
            : "text-sm h-7 w-10 px-0.5 py-0"
        )}
      />
      <span className="text-muted-foreground">
        {t.ui("teamComp.dpsSeconds")}
      </span>
      {hasDps && (
        <>
          <span className="text-muted-foreground">=</span>
          <span
            className={cn(
              "font-[math] font-bold text-foreground whitespace-nowrap",
              isMobile ? "text-sm" : "text-base"
            )}
          >
            {fmtDamage(totalDamage / sec)}
          </span>
          <span className="text-muted-foreground">
            /{t.ui("teamComp.dpsSeconds")}
          </span>
        </>
      )}
    </div>
  );
}

/** Comparison label showing % improvement from current to optimized. */
function ComparisonLabel({
  currentTotal,
  optimizedTotal,
  isMobile,
  t,
  caveats,
}: {
  currentTotal: number;
  optimizedTotal: number;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  caveats?: string[];
}) {
  if (currentTotal <= 0 || optimizedTotal <= 0) return null;
  const pct = ((optimizedTotal - currentTotal) / currentTotal) * 100;
  const sign = pct >= 0 ? "+" : "";
  const hasCaveats = caveats && caveats.length > 0;
  return (
    <div className="flex flex-col items-end shrink-0">
      <span
        className={cn(
          "whitespace-nowrap text-right",
          isMobile ? "text-xs" : "text-sm"
        )}
      >
        <span className="text-muted-foreground">
          {t.ui("teamComp.vsEquipped")}
          {hasCaveats ? "*" : ""}
        </span>
        <span className="text-muted-foreground">: </span>
        <span
          className={cn(
            "font-bold",
            pct >= 0 ? "text-green-400" : "text-red-400"
          )}
        >
          {sign}
          {pct.toFixed(1)}%
        </span>
      </span>
      {hasCaveats && (
        <span
          className={cn(
            "text-muted-foreground text-right whitespace-nowrap",
            isMobile ? "text-[10px]" : "text-xs"
          )}
        >
          {t.ui("teamComp.vsEquippedCaveat")}
          {caveats.join("，")}
        </span>
      )}
    </div>
  );
}

function RollQualityFields({
  activeContext,
  onCalcContextChange,
  t,
}: CtxProps) {
  return (
    <RollQualityInputs
      rollMultiplier={activeContext.rollMultiplier}
      onRollMultiplierChange={(v) => onCalcContextChange({ rollMultiplier: v })}
      substatBudget={activeContext.substatBudget}
      onSubstatBudgetChange={(v) => onCalcContextChange({ substatBudget: v })}
      t={t}
    />
  );
}

function StellarDirectCoeffFields({
  activeContext,
  onCalcContextChange,
  t,
}: CtxProps) {
  return (
    <StellarDirectCoeffInput
      stellarAttachHits={activeContext.stellarAttachHits}
      stellarDirectCoeff={activeContext.stellarDirectCoeff}
      onStellarAttachHitsChange={(hits) =>
        onCalcContextChange({
          stellarAttachHits: hits,
          stellarDirectCoeff: undefined,
        })
      }
      t={t}
    />
  );
}

function ActionButton({
  onClick,
  disabled,
  computing,
  labelIdle,
  labelBusy,
}: {
  onClick: () => void;
  disabled: boolean;
  computing: boolean;
  labelIdle: string;
  labelBusy: string;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="sm"
      className="gap-1 md:gap-1.5 font-bold text-[10px] px-2 py-0.5 h-6 md:text-xs md:px-4 md:py-1 md:h-8"
    >
      {computing ? (
        <Loader2 className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin" />
      ) : (
        <Play className="w-3 h-3 md:w-3.5 md:h-3.5" />
      )}
      <span>{computing ? labelBusy : labelIdle}</span>
    </Button>
  );
}

export function DamageCard({
  teamComp,
  setupConfig,
  characters,
  artifacts,
  onSetupConfigChange,
  resolvedFormula,
  isMobile,
  equippedArtifactsByChar,
  currentDisplayResult,
  accountData,
  activeContext,
  isComputing,
  teamProgress,
  teamResult,
  teamError,
  handleOptimize,
  timeBudgetSec,
  onTimeBudgetChange,
  optimizedArtifactsByChar,
  optimizedDisplayResult,
  minErRaw,
  genComputing,
  genResult,
  genError,
  handleGenerate,
  genArtifactsByChar,
  genDisplayResult,
  formulaMode,
  comboLines,
  comboId,
  teamBuild,
  hasOptResult,
  allCharsResolved,
  isFrozen,
  isFullyFrozen,
  isPartiallyFrozen,
  frozenCharIds,
  onFreezeAll,
  onUnfreezeAll,
  onFreezeChar,
  onUnfreezeChar,
  onArtifactSwap,
  hasSwapOverrides,
  onRestoreOriginal,
  forceReusedCharIds,
  reuseInfo,
  onFreezeCharFromCurrent,
  onUnfreezeCharFromCurrent,
  currentTabFrozenCharIds,
  tierAssignments,
  preferredMainStats,
  onPreferredMainStatsChange,
  preferredMainStatsDisabled,
}: DamageCardProps) {
  const { t } = useLanguage();
  const damageConfig = setupConfig.damage ?? {};
  const charConfigs = setupConfig.charConfigs ?? {};
  const updateDamageConfig = useCallback(
    (patch: Partial<NonNullable<TeamSetupConfig["damage"]>>) => {
      onSetupConfigChange((config) => ({
        ...config,
        damage: {
          ...(config.damage ?? {}),
          ...patch,
        },
      }));
    },
    [onSetupConfigChange]
  );
  const updateCharConfigs = useCallback(
    (nextCharConfigs: NonNullable<TeamSetupConfig["charConfigs"]>) => {
      onSetupConfigChange({ charConfigs: nextCharConfigs });
    },
    [onSetupConfigChange]
  );
  const updateCalcContext = useCallback(
    (patch: Partial<CalcContext>) => {
      updateDamageConfig({
        calcContext: {
          ...(damageConfig.calcContext ?? {}),
          ...patch,
        },
      });
    },
    [damageConfig.calcContext, updateDamageConfig]
  );
  const [resultsTab, setResultsTab] = useSessionState<
    "current" | "optimize" | "generate"
  >("resultsTab", "current");
  const [critMode, setCritMode] = useSessionState<CritMode>(
    "critMode",
    "expected"
  );

  // Keep progress bar visible after optimization completes, then fade + collapse
  const [showProgress, setShowProgress] = useState(false);
  const [progressFading, setProgressFading] = useState(false);
  const [progressCollapsing, setProgressCollapsing] = useState(false);
  const fadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const wasComputing = useRef(false);
  useEffect(() => {
    if (isComputing) {
      wasComputing.current = true;
      for (const t of fadeTimersRef.current) clearTimeout(t);
      fadeTimersRef.current = [];
      setShowProgress(true);
      setProgressFading(false);
      setProgressCollapsing(false);
    } else if (wasComputing.current) {
      wasComputing.current = false;
      // Phase 1: 1.5s opacity fade
      setProgressFading(true);
      fadeTimersRef.current.push(
        setTimeout(() => {
          // Phase 2: 0.5s height collapse
          setProgressCollapsing(true);
        }, 1500),
        setTimeout(() => {
          // Unmount
          setShowProgress(false);
          setProgressFading(false);
          setProgressCollapsing(false);
          fadeTimersRef.current = [];
        }, 2000)
      );
    }
    return () => {
      for (const t of fadeTimersRef.current) clearTimeout(t);
      fadeTimersRef.current = [];
    };
  }, [isComputing]);

  const ctxProps: CtxProps = {
    calcContext: damageConfig.calcContext,
    activeContext,
    onCalcContextChange: updateCalcContext,
    t,
  };

  const hasActiveFormula = comboLines?.some((l) => l.count > 0);
  const hasSandrone = characters.includes("sandrone");

  // DPS calculator state (per-session)
  const [dpsSeconds, setDpsSeconds] = useSessionState("dpsSeconds", "");

  // Current tab's total damage for comparison in optimize tab
  const currentTotal = useMemo(() => {
    return currentDisplayResult?.totalDamage ?? 0;
  }, [currentDisplayResult]);

  // Caveats: which optimizer constraints the current equipment violates
  const currentCaveats = useMemo(() => {
    if (!currentDisplayResult) return [];
    const caveats: string[] = [];
    let setMismatch = false;
    let erUnmet = false;
    let crUnmet = false;
    for (let i = 0; i < characters.length; i++) {
      const charId = characters[i];
      if (!charId) continue;
      // Set check
      const reqSet = artifacts[i];
      if (reqSet && !setMismatch) {
        const equipped = equippedArtifactsByChar[charId];
        if (equipped) {
          const setCounts = new Map<string, number>();
          for (const art of Object.values(equipped)) {
            if (art?.setKey)
              setCounts.set(art.setKey, (setCounts.get(art.setKey) ?? 0) + 1);
          }
          if (reqSet.type === "4pc") {
            if ((setCounts.get(reqSet.setId) ?? 0) < 4) setMismatch = true;
          } else {
            const id1 = String(reqSet.halfSetIds[0]);
            const id2 = String(reqSet.halfSetIds[1]);
            if (id1 === id2) {
              if ((setCounts.get(id1) ?? 0) < 4) setMismatch = true;
            } else {
              if (
                (setCounts.get(id1) ?? 0) < 2 ||
                (setCounts.get(id2) ?? 0) < 2
              )
                setMismatch = true;
            }
          }
        }
      }
      // ER check
      const minEr = charConfigs[charId]?.minEr;
      if (minEr && minEr > 1) {
        const sheets = currentDisplayResult.statSheets[charId];
        const currentEr = sheets?.onField.get("er", null) ?? 1;
        if (currentEr < minEr) erUnmet = true;
      }
      // CR check
      const minCr = charConfigs[charId]?.minCr;
      if (minCr && minCr > 0) {
        const sheets = currentDisplayResult.statSheets[charId];
        const currentCr = sheets?.onField.get("cr", null) ?? 0;
        if (currentCr < minCr) crUnmet = true;
      }
    }
    if (setMismatch) caveats.push(t.ui("teamComp.caveatDiffSet"));
    if (crUnmet) caveats.push(t.ui("teamComp.caveatCrUnmet"));
    if (erUnmet) caveats.push(t.ui("teamComp.caveatErUnmet"));
    return caveats;
  }, [
    currentDisplayResult,
    characters,
    artifacts,
    charConfigs,
    equippedArtifactsByChar,
    t,
  ]);

  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <h3 className={CARD_TITLE_CLS}>
          <span
            data-tour-step-id="tod-damage"
            className="inline-flex items-center gap-2"
          >
            <Eye className="w-4 h-4 opacity-70" />
            <span>{t.ui("teamComp.equipAndDamage")}</span>
          </span>
        </h3>
      </CardHeader>

      {/* Radio-button selector */}
      <OptionButtonRow>
        {(
          [
            {
              key: "current" as const,
              label: "teamComp.tabCurrent" as const,
              desc: "teamComp.tabCurrentDesc" as const,
            },
            {
              key: "optimize" as const,
              label: "teamComp.tabOptimize" as const,
              desc: "teamComp.tabOptimizeDesc" as const,
            },
            {
              key: "generate" as const,
              label: "teamComp.tabGenerate" as const,
              desc: "teamComp.tabGenerateDesc" as const,
            },
          ] as const
        ).map(({ key, label, desc }) => (
          <OptionButtonCell key={key}>
            <OptionButton
              selected={resultsTab === key}
              onClick={() => setResultsTab(key)}
              title={t.ui(label)}
              subtitle={t.ui(desc)}
            />
          </OptionButtonCell>
        ))}
      </OptionButtonRow>

      {/* ── Content: Current Equipped ── */}
      {resultsTab === "current" && (
        <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
          <div className={CONTROLS_CLS}>
            <EnemyFields {...ctxProps} />
            {hasSandrone && <StellarDirectCoeffFields {...ctxProps} />}
          </div>
          {currentDisplayResult && teamBuild ? (
            formulaMode === "single" && resolvedFormula ? (
              <SingleResultView
                displayResult={currentDisplayResult}
                resolvedFormula={resolvedFormula}
                teamBuild={teamBuild}
                characters={characters}
                artifacts={artifacts}
                artifactsByChar={equippedArtifactsByChar}
                critMode={critMode}
                setCritMode={setCritMode}
                isMobile={isMobile}
                t={t}
                frozenCharIds={currentTabFrozenCharIds}
                onFreezeChar={onFreezeCharFromCurrent}
                onUnfreezeChar={onUnfreezeCharFromCurrent}
                dpsSeconds={dpsSeconds}
                setDpsSeconds={setDpsSeconds}
                comboId={comboId}
              />
            ) : comboLines ? (
              <ComboResultView
                displayResult={currentDisplayResult}
                comboLines={comboLines}
                comboId={comboId}
                teamBuild={teamBuild}
                characters={characters}
                artifacts={artifacts}
                artifactsByChar={equippedArtifactsByChar}
                calcContext={activeContext}
                critMode={critMode}
                setCritMode={setCritMode}
                isMobile={isMobile}
                t={t}
                frozenCharIds={currentTabFrozenCharIds}
                onFreezeChar={onFreezeCharFromCurrent}
                onUnfreezeChar={onUnfreezeCharFromCurrent}
                dpsSeconds={dpsSeconds}
                setDpsSeconds={setDpsSeconds}
              />
            ) : null
          ) : (
            <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
              <Swords className="w-8 h-8 opacity-15" />
              <p>
                {t.ui(
                  formulaMode === "single"
                    ? "teamComp.emptyDamageMsg"
                    : "teamComp.emptyComboMsg"
                )}
              </p>
            </div>
          )}
        </CardContent>
      )}

      {/* ── Content: Optimize ── */}
      {resultsTab === "optimize" && (
        <>
          {/* Inventory warning */}
          {accountData &&
            accountData.extraArtifacts.length === 0 &&
            accountData.characters.length > 0 && (
              <div className="flex items-center gap-2 px-4 md:px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{t.ui("teamComp.inventoryWarning")}</span>
                <Link
                  to="/account-data/inventory"
                  className="font-bold underline underline-offset-2 hover:text-amber-300 shrink-0"
                >
                  {t.ui("teamComp.inventoryWarningLink")}
                </Link>
              </div>
            )}

          <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
            {/* Per-character optimizer settings (CR/ER/Tier) */}
            <CharCrErSettings
              characters={characters}
              charConfigs={charConfigs}
              onCharConfigsChange={updateCharConfigs}
              tierAssignments={tierAssignments}
              t={t}
            />

            <div className={CONTROLS_CLS}>
              <EnemyFields {...ctxProps} />
              {hasSandrone && <StellarDirectCoeffFields {...ctxProps} />}
              <div className="flex items-center gap-0.5 md:gap-1">
                <span className={LABEL_CLS}>{t.ui("teamComp.timeBudget")}</span>
                <Select
                  value={String(timeBudgetSec)}
                  onValueChange={(v) => onTimeBudgetChange(Number(v))}
                  disabled={isComputing}
                >
                  <SelectTrigger className="font-bold border-border/20 bg-white/5 text-xs h-6 w-[52px] px-1 py-0 md:text-sm md:h-7 md:w-[60px] md:px-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30s</SelectItem>
                    <SelectItem value="60">60s</SelectItem>
                    <SelectItem value="120">120s</SelectItem>
                    <SelectItem value="240">240s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span
                title={
                  isFullyFrozen
                    ? t.ui("teamComp.frozenTooltip")
                    : isPartiallyFrozen
                      ? t.ui("teamComp.partialFrozenTip")
                      : undefined
                }
              >
                <ActionButton
                  onClick={handleOptimize}
                  disabled={isFullyFrozen || isComputing || !hasActiveFormula}
                  computing={isComputing}
                  labelIdle={
                    isFullyFrozen
                      ? t.ui("teamComp.frozenBadge")
                      : isPartiallyFrozen
                        ? t.ui("teamComp.optimizeRest")
                        : t.ui("teamComp.tabOptimize")
                  }
                  labelBusy={t.ui("teamComp.optimizing")}
                />
              </span>
              {hasSwapOverrides && onRestoreOriginal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRestoreOriginal}
                  className="gap-1 md:gap-1.5 font-bold text-[10px] px-2 py-0.5 h-6 md:text-xs md:px-4 md:py-1 md:h-8 shadow-md border-amber-400/40 bg-amber-500/10 text-amber-300 ring-2 ring-amber-400/20 hover:!bg-amber-500/15 hover:!text-amber-200 hover:ring-amber-400/40"
                >
                  <Undo2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  {t.ui("teamComp.swapRestore")}
                </Button>
              )}
              {onFreezeAll && !isFullyFrozen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onFreezeAll}
                  disabled={
                    (!hasOptResult && !isPartiallyFrozen) ||
                    (teamResult?.done && teamResult.bestDamage <= 0) ||
                    !hasActiveFormula
                  }
                  className="gap-1 md:gap-1.5 font-bold text-[10px] px-2 py-0.5 h-6 md:text-xs md:px-4 md:py-1 md:h-8 shadow-md border-cyan-400/40 bg-cyan-500/10 text-cyan-300 ring-2 ring-cyan-400/20 hover:!bg-cyan-500/15 hover:!text-cyan-200 hover:ring-cyan-400/40 disabled:opacity-40 disabled:text-cyan-300/50 disabled:ring-0"
                >
                  <Snowflake className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  {t.ui("teamComp.freezeTeam")}
                </Button>
              )}
              {isFrozen && onUnfreezeAll && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnfreezeAll}
                  className="gap-1 md:gap-1.5 font-bold text-[10px] px-2 py-0.5 h-6 md:text-xs md:px-4 md:py-1 md:h-8 shadow-md border-red-400/40 bg-red-500/10 text-red-300 ring-2 ring-red-400/20 hover:!bg-red-500/15 hover:!text-red-200 hover:ring-red-400/40"
                >
                  <Flame className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  {t.ui("teamComp.unfreezeAll")}
                </Button>
              )}
            </div>

            {/* Empty state + preview (shown when not all chars resolved) */}
            {!isComputing && !allCharsResolved && !teamError && (
              <div className="space-y-2">
                {/* Original empty state box */}
                {!hasOptResult && (
                  <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                    <Swords className="w-8 h-8 opacity-15" />
                    <p>{t.ui("teamComp.emptyOptMsg")}</p>
                  </div>
                )}

                {/* Partial StatSheetPanel — preview mode, artifacts only */}
                {hasOptResult && (
                  <StatSheetPanel
                    characters={characters}
                    artifacts={artifacts}
                    artifactsByChar={optimizedArtifactsByChar}
                    targetCharId=""
                    highlightedStat={null}
                    onStatHover={() => {}}
                    t={t}
                    frozenCharIds={frozenCharIds}
                    forceReusedCharIds={forceReusedCharIds}
                    reuseInfo={reuseInfo}
                    onFreezeChar={onFreezeChar}
                    onUnfreezeChar={onUnfreezeChar}
                    preview
                    preferredMainStats={preferredMainStats}
                    onPreferredMainStatsChange={onPreferredMainStatsChange}
                    preferredMainStatsDisabled={preferredMainStatsDisabled}
                  />
                )}
              </div>
            )}

            {/* Error state */}
            {teamError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm">
                <span className="font-bold">{t.ui("teamComp.optError")}</span>{" "}
                {teamError.message}
              </div>
            )}

            {/* Progress */}
            {showProgress &&
              (() => {
                // When done (lingering), snap to 100%
                const progressPct = !isComputing
                  ? 100
                  : Math.round((teamProgress?.overallProgress ?? 0) * 100);
                return (
                  <div
                    className="overflow-hidden"
                    style={{
                      maxHeight: progressCollapsing ? 0 : 500,
                      marginTop: progressCollapsing ? 0 : undefined,
                      marginBottom: progressCollapsing ? 0 : undefined,
                      transition: progressCollapsing
                        ? "max-height 0.5s ease, margin 0.5s ease"
                        : undefined,
                    }}
                  >
                    <div
                      className="space-y-3 bg-black/15 p-3 rounded-lg border border-border/20"
                      style={{
                        opacity: progressFading ? 0 : 1,
                        transition: "opacity 1.5s ease",
                      }}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold">
                          {!isComputing
                            ? `✓ ${t.ui("teamComp.optComplete")}`
                            : teamProgress?.phase
                              ? {
                                  init: t.ui("teamComp.phaseInit"),
                                  phase1: t.ui("teamComp.phasePerChar"),
                                  phase2: t.ui("teamComp.phaseTeamAlloc"),
                                  phase3: `${t.ui("teamComp.phaseTeamRefine")} — ${t.character(teamProgress.currentPassCharId)}`,
                                }[teamProgress.phase]
                              : t.ui("teamComp.preparingOpt")}
                        </span>
                        <span className="font-mono font-bold">
                          {progressPct}%
                        </span>
                      </div>
                      <Progress
                        value={progressPct}
                        className="h-1.5 bg-black/40"
                      />
                      {/* Per-character substat weights (debug) */}
                      {teamProgress?.passResults?.some(
                        (pr) => pr.substatWeights
                      ) && (
                        <div className="space-y-1">
                          {teamProgress.passResults
                            .filter(
                              (pr) =>
                                pr.substatWeights &&
                                Object.keys(pr.substatWeights).length > 0
                            )
                            .map((pr) => (
                              <div
                                key={pr.charId}
                                className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground"
                              >
                                <span className="font-semibold text-foreground/70 w-16 shrink-0 truncate">
                                  {t.character(pr.charId)}
                                </span>
                                <span className="truncate">
                                  {Object.entries(pr.substatWeights!)
                                    .filter(([, v]) => Math.abs(v) > 0.01)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(
                                      ([k, v]) =>
                                        `${t.statShort(k)}:${v.toFixed(1)}`
                                    )
                                    .join("  ")}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                      {/* Per-character status badges — always visible during optimization */}
                      <div className="flex flex-wrap gap-1.5">
                        {characters
                          .filter((id): id is string => id != null)
                          .map((charId) => {
                            const pr = teamProgress?.passResults.find(
                              (r) => r.charId === charId
                            );
                            const liveDmg =
                              teamProgress?.workerBestDamage?.[charId];
                            if (pr) {
                              // Completed
                              return (
                                <span
                                  key={charId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  {t.character(charId)}
                                  {pr.bestDamage > 0 && (
                                    <span className="font-mono">
                                      {Math.round(
                                        pr.bestDamage
                                      ).toLocaleString()}
                                    </span>
                                  )}
                                </span>
                              );
                            }
                            if (liveDmg != null) {
                              // In progress (worker running)
                              return (
                                <span
                                  key={charId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold"
                                >
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  {t.character(charId)}
                                  {liveDmg > 0 && (
                                    <span className="font-mono">
                                      {Math.round(liveDmg).toLocaleString()}
                                    </span>
                                  )}
                                </span>
                              );
                            }
                            // Pending (not yet started)
                            return (
                              <span
                                key={charId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold"
                              >
                                {t.character(charId)}
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Results — only when all characters are resolved */}
            {!hasActiveFormula ? null : allCharsResolved &&
              optimizedDisplayResult &&
              teamBuild ? (
              formulaMode === "single" && resolvedFormula ? (
                <SingleResultView
                  displayResult={optimizedDisplayResult}
                  resolvedFormula={resolvedFormula}
                  teamBuild={teamBuild}
                  characters={characters}
                  artifacts={artifacts}
                  artifactsByChar={optimizedArtifactsByChar}
                  critMode={critMode}
                  setCritMode={setCritMode}
                  isMobile={isMobile}
                  t={t}
                  failReasons={
                    teamResult?.done ? teamResult.failReasons : undefined
                  }
                  frozenCharIds={frozenCharIds}
                  onArtifactSwap={onArtifactSwap}
                  onFreezeChar={onFreezeChar}
                  onUnfreezeChar={onUnfreezeChar}
                  forceReusedCharIds={forceReusedCharIds}
                  reuseInfo={reuseInfo}
                  currentTotal={currentTotal}
                  currentCaveats={currentCaveats}
                  dpsSeconds={dpsSeconds}
                  setDpsSeconds={setDpsSeconds}
                  comboId={comboId}
                  preferredMainStats={preferredMainStats}
                  onPreferredMainStatsChange={onPreferredMainStatsChange}
                  preferredMainStatsDisabled={preferredMainStatsDisabled}
                />
              ) : comboLines ? (
                <ComboResultView
                  displayResult={optimizedDisplayResult}
                  comboLines={comboLines}
                  comboId={comboId}
                  teamBuild={teamBuild}
                  characters={characters}
                  artifacts={artifacts}
                  artifactsByChar={optimizedArtifactsByChar}
                  calcContext={activeContext}
                  critMode={critMode}
                  setCritMode={setCritMode}
                  isMobile={isMobile}
                  t={t}
                  failReasons={
                    teamResult?.done ? teamResult.failReasons : undefined
                  }
                  frozenCharIds={frozenCharIds}
                  onArtifactSwap={onArtifactSwap}
                  onFreezeChar={onFreezeChar}
                  onUnfreezeChar={onUnfreezeChar}
                  forceReusedCharIds={forceReusedCharIds}
                  reuseInfo={reuseInfo}
                  currentTotal={currentTotal}
                  currentCaveats={currentCaveats}
                  dpsSeconds={dpsSeconds}
                  setDpsSeconds={setDpsSeconds}
                  preferredMainStats={preferredMainStats}
                  onPreferredMainStatsChange={onPreferredMainStatsChange}
                  preferredMainStatsDisabled={preferredMainStatsDisabled}
                />
              ) : null
            ) : allCharsResolved && !isComputing ? (
              <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                <Swords className="w-8 h-8 opacity-15" />
                <p>{t.ui("teamComp.emptyOptMsg")}</p>
              </div>
            ) : null}

            {/* No results found */}
            {hasActiveFormula &&
              allCharsResolved &&
              teamResult?.done &&
              teamResult.bestDamage === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border/30 rounded-lg bg-black/10">
                  {t
                    .ui("teamComp.noValidCombos")
                    .replace("{0}", String(Math.round(minErRaw * 100)))}
                </div>
              )}

            {/* Swap Guide — diff view of optimized vs equipped (hidden while optimizer is running) */}
            {hasActiveFormula &&
              allCharsResolved &&
              !isComputing &&
              (teamResult?.done || hasOptResult) &&
              teamResult?.bestDamage !== 0 && (
                <SwapGuide
                  comp={teamComp}
                  setupConfig={setupConfig}
                  characters={characters}
                  equippedArtifactsByChar={equippedArtifactsByChar}
                  optimizedArtifactsByChar={optimizedArtifactsByChar}
                  accountData={accountData}
                  t={t}
                />
              )}
          </CardContent>
        </>
      )}

      {/* ── Content: Generate (dev only) ── */}
      {resultsTab === "generate" && (
        <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
          <CharCrErSettings
            characters={characters}
            charConfigs={charConfigs}
            onCharConfigsChange={updateCharConfigs}
            t={t}
          />
          <div className={CONTROLS_CLS}>
            <EnemyFields {...ctxProps} />
            {hasSandrone && <StellarDirectCoeffFields {...ctxProps} />}
            <RollQualityFields {...ctxProps} />
            <ActionButton
              onClick={handleGenerate}
              disabled={genComputing || !hasActiveFormula}
              computing={genComputing}
              labelIdle={t.ui("teamComp.tabGenerate")}
              labelBusy={t.ui("teamComp.generatingIdeal")}
            />
          </div>

          {/* Empty state */}
          {!genComputing && !genResult?.done && !genError && (
            <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
              <Swords className="w-8 h-8 opacity-15" />
              <p>{t.ui("teamComp.idealEmptyMessage")}</p>
            </div>
          )}

          {/* Error state */}
          {genError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm">
              <span className="font-bold">{t.ui("teamComp.optError")}</span>{" "}
              {genError.message}
            </div>
          )}

          {/* Progress */}
          {genComputing && genResult && (
            <div className="space-y-3 bg-black/15 p-3 rounded-lg border border-border/20">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold">{genResult.phase}</span>
                <span className="font-mono font-bold">
                  {Math.round(genResult.progress * 100)}%
                </span>
              </div>
              <Progress
                value={genResult.progress * 100}
                className="h-1.5 bg-black/40"
              />
            </div>
          )}

          {/* Results */}
          {genDisplayResult && teamBuild ? (
            formulaMode === "single" && resolvedFormula ? (
              <SingleResultView
                displayResult={genDisplayResult}
                resolvedFormula={resolvedFormula}
                teamBuild={teamBuild}
                characters={characters}
                artifacts={artifacts}
                artifactsByChar={genArtifactsByChar}
                critMode={critMode}
                setCritMode={setCritMode}
                isMobile={isMobile}
                t={t}
                currentTotal={currentTotal}
                currentCaveats={currentCaveats}
                dpsSeconds={dpsSeconds}
                setDpsSeconds={setDpsSeconds}
                comboId={comboId}
              />
            ) : comboLines ? (
              <ComboResultView
                displayResult={genDisplayResult}
                comboLines={comboLines}
                comboId={comboId}
                teamBuild={teamBuild}
                characters={characters}
                artifacts={artifacts}
                artifactsByChar={genArtifactsByChar}
                calcContext={activeContext}
                critMode={critMode}
                setCritMode={setCritMode}
                isMobile={isMobile}
                t={t}
                currentTotal={currentTotal}
                currentCaveats={currentCaveats}
                dpsSeconds={dpsSeconds}
                setDpsSeconds={setDpsSeconds}
              />
            ) : null
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

/** @internal — exported for unit tests only */
export { ComparisonLabel, DpsDisplay };
