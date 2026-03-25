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
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { AccountData, ArtifactData, Slot } from "@/data/types";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import { fmtDamage } from "@/lib/team-comp/displayFormatters";
import type { GeneratorResult } from "@/lib/team-comp/generator";
import type { SubstatBudgetPreset } from "@/lib/team-comp/substatBudget";
import { SUBSTAT_BUDGET_DEFAULT_PRESET } from "@/lib/team-comp/substatBudget";
import {
  aggregateComboFormulaDefaults,
  toStatSheets,
} from "@/lib/team-comp/teamOptUtils";
import type {
  OptFailReason,
  TeamOptimizationProgress,
  TeamOptimizationResult,
} from "@/lib/team-comp/types";
import type {
  CalcContext,
  ComboLine,
  CritMode,
  DisplayPart,
  DisplayResult,
  ReactionOverride,
  StatKey,
} from "@/lib/team-comp/types";
import { buffSourceKey } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
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
import { type BuffLedgerFormula, buildBuffApplicability } from "./BuffDialog";
import { BuffLedger } from "./BuffLedger";
import { FormulaBreakdown, adjustPartDamage } from "./FormulaBreakdown";
import { StatSheetPanel } from "./StatSheetPanel";
import { SwapGuide } from "./SwapGuide";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

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

/** Shared body for current / optimized / generated tabs. */
function DamageBody({
  team,
  hasFormula,
  emptyMessage,
  artifactsByChar,
  targetCharId,
  displayResult,
  formulaKey,
  formulaLabel,
  critMode,
  setCritMode,
  isMobile,
  t,
  failReasons,
  frozenCharIds,
  onArtifactSwap,
  onFreezeChar,
  onUnfreezeChar,
}: {
  team: Team;
  hasFormula: boolean;
  emptyMessage: string;
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  targetCharId?: string;
  displayResult?: DisplayResult | null;
  /** Formula key for scoping buff overrides (e.g. "ganyu.charged"). */
  formulaKey?: string;
  /** I18n label for the active formula. */
  formulaLabel?: Record<string, string>;
  critMode: CritMode;
  setCritMode: (mode: CritMode) => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  failReasons?: Record<string, OptFailReason>;
  frozenCharIds?: Set<string>;
  onArtifactSwap?: (charId: string, slot: Slot, artifact: ArtifactData) => void;
  onFreezeChar?: (charId: string) => void;
  onUnfreezeChar?: (charId: string) => void;
}) {
  const [highlightedStat, setHighlightedStat] = useState<{
    key: StatKey | "charLevel";
    charId: string;
  } | null>(null);
  const [formulaExpanded, setFormulaExpanded] = useSessionState(
    "formulaExpanded",
    true
  );

  return (
    <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
      {!hasFormula && (
        <div className="text-muted-foreground p-4 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10">
          {emptyMessage}
        </div>
      )}

      {hasFormula && (
        <StatSheetPanel
          result={displayResult}
          team={team}
          artifactsByChar={artifactsByChar}
          targetCharId={targetCharId || ""}
          highlightedStat={highlightedStat}
          onStatHover={setHighlightedStat}
          t={t}
          failReasons={failReasons}
          frozenCharIds={frozenCharIds}
          onArtifactSwap={onArtifactSwap}
          onFreezeChar={onFreezeChar}
          onUnfreezeChar={onUnfreezeChar}
        />
      )}

      {hasFormula && (
        <Collapsible open={formulaExpanded} onOpenChange={setFormulaExpanded}>
          <div
            className={cn(
              "border border-dashed border-border/20 rounded-lg bg-black/5 text-sm",
              isMobile ? "p-1.5" : "p-2"
            )}
          >
            <div className="flex flex-col items-center justify-center">
              {displayResult ? (
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-xl transition-colors cursor-pointer select-none",
                      isMobile ? "gap-1.5 px-2 py-1.5" : "gap-2.5 px-4 py-2",
                      "bg-card/70 border border-primary/30 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.12)]",
                      "hover:bg-primary/15"
                    )}
                  >
                    <div className="flex items-center gap-0">
                      <CritModeDropdown
                        critMode={critMode}
                        setCritMode={setCritMode}
                        isMobile={isMobile}
                        {...getCritDisableFlags(
                          formulaKey
                            ? displayResult?.partsByFormula[formulaKey]
                            : undefined
                        )}
                        t={t}
                      />
                      <div
                        className={cn(
                          "text-primary font-semibold tracking-wide whitespace-nowrap leading-none",
                          isMobile ? "text-xs" : "text-sm"
                        )}
                      >
                        {t.ui("teamComp.totalDamage")}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-foreground font-[math] font-black drop-shadow-sm",
                        isMobile ? "text-2xl" : "text-3xl md:text-4xl"
                      )}
                    >
                      {fmtDamage(
                        (formulaKey
                          ? (displayResult.partsByFormula[formulaKey] ?? [])
                          : []
                        ).reduce(
                          (sum, p) =>
                            sum + adjustPartDamage(p, critMode) * (p.hits ?? 1),
                          0
                        )
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-muted-foreground whitespace-nowrap",
                        isMobile ? "text-[10px] ml-0.5" : "text-xs ml-1.5"
                      )}
                    >
                      {formulaExpanded
                        ? t.ui("teamComp.collapseFormula")
                        : t.ui("teamComp.expandFormula")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                        formulaExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </CollapsibleTrigger>
              ) : (
                <div className="text-sm uppercase tracking-widest bg-primary/20 text-primary px-3 py-1 rounded font-mono font-bold">
                  {t.ui("teamComp.pending")}
                </div>
              )}
            </div>
            <CollapsibleContent>
              {displayResult && targetCharId && (
                <FormulaBreakdown
                  parts={
                    (formulaKey
                      ? displayResult.partsByFormula[formulaKey]
                      : undefined) ?? []
                  }
                  highlightedStat={
                    highlightedStat?.charId === targetCharId
                      ? highlightedStat?.key
                      : null
                  }
                  critMode={critMode}
                  t={t}
                  buffs={displayResult.buffs}
                  defaultActivation={displayResult.buffActivation}
                  formulaKey={formulaKey}
                />
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {hasFormula && displayResult && (
        <BuffLedger
          buffs={displayResult.buffs}
          team={team}
          t={t}
          formulas={
            formulaKey
              ? [
                  {
                    formulaKey,
                    parts: displayResult.partsByFormula[formulaKey] ?? [],
                    defaultActivation: displayResult.buffActivation,
                    formulaLabel,
                    buffApplicability: buildBuffApplicability(
                      displayResult.buffs
                    ),
                  },
                ]
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Check if a combo line's effective reaction has partial part settings. */
function hasPartialReaction(
  line: ComboLine,
  singleOverrides: Record<string, ReactionOverride>
): boolean {
  const key = `${line.charId}.${line.formulaId}`;
  const singleOv = singleOverrides[key];
  const lineOv = line.reaction;

  // Merge same as combo eval: single-mode as defaults, line overrides on top
  let partReactions: Record<number, string> | undefined;
  let partHits: Record<number, number> | undefined;

  if (singleOv && lineOv) {
    partReactions = { ...singleOv.partReactions, ...lineOv.partReactions };
    partHits = { ...singleOv.partHits, ...lineOv.partHits };
  } else if (singleOv) {
    partReactions = singleOv.partReactions;
    partHits = singleOv.partHits;
  } else if (lineOv) {
    partReactions = lineOv.partReactions;
    partHits = lineOv.partHits;
  }

  return (
    (partReactions != null && Object.keys(partReactions).length > 0) ||
    (partHits != null && Object.keys(partHits).length > 0)
  );
}

/** Combo mode breakdown: 4-column grid grouped by character, with drill-down. */
function ComboBreakdown({
  team,
  lineDamages,
  comboLines,
  comboId,
  teamBuild,
  damageValue,
  displayResult,
  critMode,
  setCritMode,
  disableCrit,
  disableNoCrit,
  reactionOverrides,
  isMobile,
  t,
  artifactsByChar,
  calcContext,
}: {
  team: Team;
  lineDamages: { perHit: number; total: number }[];
  comboLines: ComboLine[];
  comboId?: string;
  teamBuild: TeamBuild;
  damageValue: number;
  displayResult: DisplayResult | null | undefined;
  critMode: CritMode;
  setCritMode: (mode: CritMode) => void;
  disableCrit?: boolean;
  disableNoCrit?: boolean;
  reactionOverrides: Record<string, ReactionOverride>;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  calcContext: CalcContext;
}) {
  const allFormulaIds = useMemo(() => teamBuild.getFormulaIds(), [teamBuild]);
  const rxFormulaIds = useMemo(
    () => teamBuild.getReactionFormulaIds(),
    [teamBuild]
  );
  // Filter to active lines whose formula still exists (matches combo eval filtering)
  const activeLines = comboLines.filter(
    (l) =>
      l.count > 0 &&
      (allFormulaIds[l.charId]?.[l.formulaId] !== undefined ||
        (l.formulaId.startsWith("rx-") &&
          rxFormulaIds[l.formulaId] !== undefined))
  );

  // Group active lines by character
  type LineWithDamage = {
    line: ComboLine;
    perHit: number;
    total: number;
    isPartial: boolean;
  };
  const byChar = useMemo(() => {
    const map = new Map<string, LineWithDamage[]>();
    for (let i = 0; i < activeLines.length; i++) {
      const line = activeLines[i];
      const dmg = lineDamages[i];
      if (!dmg) continue;
      const arr = map.get(line.charId) ?? [];
      arr.push({
        line,
        perHit: dmg.perHit,
        total: dmg.total,
        isPartial: hasPartialReaction(line, reactionOverrides),
      });
      map.set(line.charId, arr);
    }
    return map;
  }, [activeLines, lineDamages, reactionOverrides]);

  // Per-character damage totals and max line proportion for color scaling
  const { charDamageMap, totalLineDamage, maxLineProportion } = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    let maxProp = 0;
    for (const [charId, lines] of byChar) {
      const charTotal = lines.reduce((sum, l) => sum + l.total, 0);
      map[charId] = charTotal;
      total += charTotal;
    }
    if (total > 0) {
      for (const lines of byChar.values()) {
        for (const l of lines) {
          const prop = l.total / total;
          if (prop > maxProp) maxProp = prop;
        }
      }
    }
    return {
      charDamageMap: map,
      totalLineDamage: total,
      maxLineProportion: maxProp,
    };
  }, [byChar]);

  // Whether any visible line has partial reaction settings
  const anyPartial = useMemo(
    () =>
      Array.from(byChar.values()).some((arr) => arr.some((l) => l.isPartial)),
    [byChar]
  );

  // Maintain team character order
  const teamCharIds = team.characters.filter((id): id is string => id != null);

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
        <div className="border border-dashed border-border/20 rounded-lg bg-black/5 text-xs md:text-sm p-1.5 md:p-2">
          {/* Total damage — clickable to toggle breakdown */}
          <div className="flex flex-col items-center justify-center">
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl transition-colors cursor-pointer select-none",
                  "gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2",
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
                <div className="text-foreground font-[math] font-black drop-shadow-sm text-2xl md:text-3xl xl:text-4xl">
                  {fmtDamage(damageValue)}
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
                          ] ??
                          (focusedLine.formulaId.startsWith("rx-")
                            ? rxFormulaIds[focusedLine.formulaId]
                            : undefined);
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
                  t={t}
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
                                const label =
                                  charFormulas?.[line.formulaId] ??
                                  (line.formulaId.startsWith("rx-")
                                    ? rxFormulaIds[line.formulaId]
                                    : undefined);
                                const rxn = line.reaction?.reaction;
                                return (
                                  <div
                                    key={idx}
                                    className="flex flex-col gap-0.5 px-1 py-0.5 md:py-1"
                                  >
                                    <div className="flex items-center gap-1 min-w-0">
                                      <button
                                        type="button"
                                        className="flex items-center gap-0.5 text-sm md:text-base font-semibold text-foreground hover:text-primary transition-colors truncate cursor-pointer border-b border-dotted border-current"
                                        onClick={() =>
                                          setFocusedLine({
                                            charId: line.charId,
                                            formulaId: line.formulaId,
                                          })
                                        }
                                      >
                                        <span className="truncate">
                                          {label
                                            ? t.resolveLabel(label)
                                            : line.formulaId}
                                        </span>
                                        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                      </button>
                                      {isPartial && (
                                        <span
                                          className="text-amber-400 text-xl font-bold leading-none"
                                          title={t.ui(
                                            "teamComp.partialReactionNote"
                                          )}
                                        >
                                          *
                                        </span>
                                      )}
                                      {rxn && rxn !== "none" && (
                                        <span className="text-sm md:text-base text-primary font-semibold shrink-0">
                                          [{t.reaction(rxn)}]
                                        </span>
                                      )}
                                    </div>
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

/** Combo-mode result view: StatSheetPanel + ComboBreakdown + BuffLedger. */
function ComboResultView({
  displayResult,
  comboLines,
  comboId,
  teamBuild,
  team,
  artifactsByChar,
  calcContext,
  critMode,
  setCritMode,
  isMobile,
  t,
  reactionOverrides,
  failReasons,
  frozenCharIds,
  onArtifactSwap,
  onFreezeChar,
  onUnfreezeChar,
}: {
  displayResult: DisplayResult;
  comboLines: ComboLine[];
  comboId?: string;
  teamBuild: TeamBuild;
  team: Team;
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  calcContext: CalcContext;
  critMode: CritMode;
  setCritMode: (mode: CritMode) => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  reactionOverrides: Record<string, ReactionOverride>;
  failReasons?: Record<string, OptFailReason>;
  frozenCharIds?: Set<string>;
  onArtifactSwap?: (charId: string, slot: Slot, artifact: ArtifactData) => void;
  onFreezeChar?: (charId: string) => void;
  onUnfreezeChar?: (charId: string) => void;
}) {
  const allFormulaIds = useMemo(() => teamBuild.getFormulaIds(), [teamBuild]);
  const rxFormulaIds = useMemo(
    () => teamBuild.getReactionFormulaIds(),
    [teamBuild]
  );
  const activeLines = useMemo(
    () =>
      comboLines.filter(
        (l) =>
          l.count > 0 &&
          (allFormulaIds[l.charId]?.[l.formulaId] !== undefined ||
            (l.formulaId.startsWith("rx-") &&
              rxFormulaIds[l.formulaId] !== undefined))
      ),
    [comboLines, allFormulaIds, rxFormulaIds]
  );
  const teamCharIds = useMemo(
    () => team.characters.filter((id): id is string => id != null),
    [team.characters]
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
      // Per-formula buff resolution for correct part applicability
      let buffApplicability: Record<string, number[] | undefined> | undefined;
      try {
        const dr = teamBuild.getDisplayResult(
          charId,
          formulaId,
          sheets,
          calcContext
        );
        buffApplicability = buildBuffApplicability(dr.buffs);
      } catch {
        // Ignore — fall back to buff-level activePartIndices
      }
      return {
        formulaKey: fKey,
        parts,
        defaultActivation: activation,
        comboCount: count,
        comboKey: comboId ? `combo:${comboId}:${fKey}` : undefined,
        formulaLabel:
          allFormulaIds[charId]?.[formulaId] ?? rxFormulaIds[formulaId],
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
    rxFormulaIds,
  ]);

  return (
    <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
      {displayResult && (
        <StatSheetPanel
          result={displayResult}
          team={team}
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
        />
      )}
      <ComboBreakdown
        team={team}
        lineDamages={displayResult.lineDamages ?? []}
        comboLines={comboLines}
        comboId={comboId}
        teamBuild={teamBuild}
        damageValue={displayResult.totalDamage}
        displayResult={displayResult}
        critMode={critMode}
        setCritMode={setCritMode}
        {...getCritDisableFlags(
          displayResult?.partsByFormula
            ? Object.values(displayResult.partsByFormula).flat()
            : undefined
        )}
        reactionOverrides={reactionOverrides}
        isMobile={isMobile}
        t={t}
        artifactsByChar={artifactsByChar}
        calcContext={calcContext}
      />
      {displayResult && (
        <BuffLedger
          buffs={displayResult.buffs}
          team={team}
          t={t}
          formulas={comboFormulas}
        />
      )}
    </div>
  );
}

interface DamageCardProps {
  team: Team;
  effectiveTeam: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  resolvedFormula: { charId: string; formulaId: string } | null;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
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
  // Combo mode
  comboLines?: ComboLine[] | null;
  comboId?: string;
  teamBuild?: TeamBuild | null;
  formulaMode?: "single" | "combo";
  // Freeze
  hasOptResult?: boolean;
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
}

// ─── Shared inline control helpers ───

type CtxProps = {
  team: Team;
  activeContext: CalcContext;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
};

const LABEL_CLS =
  "font-semibold text-foreground/80 select-none whitespace-nowrap text-[10px] md:text-sm";

function EnemyLevelInput({
  team,
  activeContext,
  updateTeam,
  isMobile,
  t,
}: CtxProps) {
  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      <span className={LABEL_CLS}>{t.ui("teamComp.enemyLevel")}</span>
      <Input
        type="text"
        inputMode="numeric"
        value={team.calcContext?.enemyLevel ?? ""}
        placeholder="110"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            const { enemyLevel: _, ...rest } = team.calcContext ?? {};
            updateTeam(team.id, { calcContext: rest });
            return;
          }
          const num = Number(raw);
          if (!Number.isNaN(num))
            updateTeam(team.id, {
              calcContext: { ...team.calcContext, enemyLevel: num },
            });
        }}
        className="text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1"
      />
    </div>
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
    <Select value={critMode} onValueChange={(v) => setCritMode(v as CritMode)}>
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

function EnemyResInput({
  team,
  activeContext,
  updateTeam,
  isMobile,
  t,
}: CtxProps) {
  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      <span className={LABEL_CLS}>{t.ui("teamComp.enemyRes")}</span>
      <div className="flex items-center gap-0">
        <Input
          type="number"
          value={
            team.calcContext?.enemyRes != null
              ? Math.round(team.calcContext.enemyRes * 100)
              : ""
          }
          placeholder="10"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              const { enemyRes: _, ...rest } = team.calcContext ?? {};
              updateTeam(team.id, { calcContext: rest });
              return;
            }
            updateTeam(team.id, {
              calcContext: {
                ...team.calcContext,
                enemyRes: (Number(raw) || 0) / 100,
              },
            });
          }}
          className="text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1"
        />
        <span className="font-bold text-muted-foreground text-[10px] md:text-xs">
          %
        </span>
      </div>
    </div>
  );
}

function CritRateTargetInput({
  team,
  activeContext,
  updateTeam,
  isMobile,
  t,
}: CtxProps) {
  return (
    <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
      <span className={LABEL_CLS} title={t.ui("teamComp.critRateTargetTip")}>
        {t.ui("teamComp.critRateTarget")}
      </span>
      <Input
        type="text"
        inputMode="numeric"
        value={activeContext.critRateTarget ?? ""}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value.trim();
          updateTeam(team.id, {
            calcContext: {
              ...team.calcContext,
              critRateTarget:
                raw === ""
                  ? undefined
                  : Math.max(1, Math.min(100, Math.round(Number(raw) || 0))),
            },
          });
        }}
        className="text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1"
      />
      <span className="font-bold text-muted-foreground text-[10px] md:text-xs -ml-0.5 md:-ml-1">
        %
      </span>
    </div>
  );
}

function RollMultSelect({
  team,
  activeContext,
  updateTeam,
  isMobile,
  t,
}: CtxProps) {
  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      <span className={LABEL_CLS}>{t.ui("teamComp.rollMultiplier")}</span>
      <Select
        value={String(activeContext.rollMultiplier ?? 0.85)}
        onValueChange={(v) =>
          updateTeam(team.id, {
            calcContext: { ...team.calcContext, rollMultiplier: Number(v) },
          })
        }
      >
        <SelectTrigger className="font-bold border-border/20 bg-background/50 text-xs h-6 w-14 px-1 py-0 md:text-sm md:h-7 md:w-16 md:px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[0.7, 0.8, 0.85, 0.9, 1.0].map((v) => (
            <SelectItem key={v} value={String(v)}>
              {v}x
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SubstatBudgetSelect({
  team,
  activeContext,
  updateTeam,
  isMobile,
  t,
}: CtxProps) {
  const value = activeContext.substatBudget ?? SUBSTAT_BUDGET_DEFAULT_PRESET;
  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      <span className={LABEL_CLS}>{t.ui("teamComp.substatBudget")}</span>
      <Select
        value={value}
        onValueChange={(v) =>
          updateTeam(team.id, {
            calcContext: {
              ...team.calcContext,
              substatBudget: v as SubstatBudgetPreset,
            },
          })
        }
      >
        <SelectTrigger className="font-bold border-border/20 bg-background/50 min-w-0 max-w-[9rem] text-xs h-6 px-1 py-0 md:text-sm md:h-7 md:max-w-[10rem] md:px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="8_6">8/6 (5/4★)</SelectItem>
          <SelectItem value="8_7">8/7 (5/4★)</SelectItem>
          <SelectItem value="9_7">9/7 (5/4★)</SelectItem>
        </SelectContent>
      </Select>
    </div>
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

const CONTROLS_CLS =
  "flex flex-wrap items-center justify-center mb-3 gap-x-2 gap-y-1 md:gap-x-5 md:gap-y-2";

export function DamageCard({
  team,
  effectiveTeam,
  updateTeam,
  resolvedFormula,
  isMobile,
  t,
  equippedArtifactsByChar,
  currentDisplayResult,
  accountData,
  activeContext,
  isComputing,
  teamProgress,
  teamResult,
  teamError,
  handleOptimize,
  optimizedArtifactsByChar,
  optimizedDisplayResult,
  minErRaw,
  genComputing,
  genResult,
  genError,
  handleGenerate,
  genArtifactsByChar,
  genDisplayResult,
  comboLines,
  comboId,
  teamBuild,
  formulaMode = "single",
  hasOptResult,
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
}: DamageCardProps) {
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

  const ctxProps: CtxProps = { team, activeContext, updateTeam, isMobile, t };

  // Formula label for the active single-formula selection
  const activeFormulaLabel = useMemo(() => {
    if (!resolvedFormula || !teamBuild) return undefined;
    return (
      teamBuild.getFormulaIds()[resolvedFormula.charId]?.[
        resolvedFormula.formulaId
      ] ?? teamBuild.getReactionFormulaIds()[resolvedFormula.formulaId]
    );
  }, [resolvedFormula, teamBuild]);

  const hasActiveFormula =
    formulaMode === "combo"
      ? comboLines?.some((l) => l.count > 0)
      : resolvedFormula != null;

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
            <EnemyLevelInput {...ctxProps} />
            <EnemyResInput {...ctxProps} />
          </div>
          {formulaMode === "combo" &&
          currentDisplayResult &&
          comboLines &&
          teamBuild ? (
            <ComboResultView
              displayResult={currentDisplayResult}
              comboLines={comboLines}
              comboId={comboId}
              teamBuild={teamBuild}
              team={effectiveTeam}
              artifactsByChar={equippedArtifactsByChar}
              calcContext={activeContext}
              critMode={critMode}
              setCritMode={setCritMode}
              isMobile={isMobile}
              t={t}
              reactionOverrides={team.reactionOverrides}
            />
          ) : formulaMode === "combo" && comboLines && !currentDisplayResult ? (
            <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
              <Swords className="w-8 h-8 opacity-15" />
              <p>{t.ui("teamComp.emptyComboMsg")}</p>
            </div>
          ) : (
            <DamageBody
              team={effectiveTeam}
              hasFormula={resolvedFormula != null}
              emptyMessage={t.ui("teamComp.emptyDamageMsg")}
              artifactsByChar={equippedArtifactsByChar}
              targetCharId={resolvedFormula?.charId}
              displayResult={currentDisplayResult}
              formulaKey={
                resolvedFormula
                  ? `${resolvedFormula.charId}.${resolvedFormula.formulaId}`
                  : undefined
              }
              formulaLabel={activeFormulaLabel}
              critMode={critMode}
              setCritMode={setCritMode}
              isMobile={isMobile}
              t={t}
            />
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
                  to="/account-data"
                  className="font-bold underline underline-offset-2 hover:text-amber-300 shrink-0"
                >
                  {t.ui("teamComp.inventoryWarningLink")}
                </Link>
              </div>
            )}

          <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
            <div className={CONTROLS_CLS}>
              <EnemyLevelInput {...ctxProps} />
              <EnemyResInput {...ctxProps} />
              <CritRateTargetInput {...ctxProps} />
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

            {/* Empty state */}
            {!isComputing && !hasOptResult && !teamError && (
              <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                <Swords className="w-8 h-8 opacity-15" />
                <p>{t.ui("teamComp.emptyOptMsg")}</p>
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
                        {effectiveTeam.characters
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

            {/* Results */}
            {/* Combo mode with no active lines — show hint */}
            {formulaMode === "combo" &&
              comboLines &&
              !optimizedDisplayResult &&
              isFrozen &&
              !teamResult && (
                <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                  <Swords className="w-8 h-8 opacity-15" />
                  <p>{t.ui("teamComp.emptyComboMsg")}</p>
                </div>
              )}

            {!hasActiveFormula ? null : formulaMode === "combo" &&
              optimizedDisplayResult &&
              comboLines &&
              teamBuild ? (
              <ComboResultView
                displayResult={optimizedDisplayResult}
                comboLines={comboLines}
                comboId={comboId}
                teamBuild={teamBuild}
                team={effectiveTeam}
                artifactsByChar={optimizedArtifactsByChar}
                calcContext={activeContext}
                critMode={critMode}
                setCritMode={setCritMode}
                isMobile={isMobile}
                t={t}
                reactionOverrides={team.reactionOverrides}
                failReasons={
                  teamResult?.done ? teamResult.failReasons : undefined
                }
                frozenCharIds={frozenCharIds}
                onArtifactSwap={onArtifactSwap}
                onFreezeChar={onFreezeChar}
                onUnfreezeChar={onUnfreezeChar}
              />
            ) : hasOptResult && optimizedDisplayResult ? (
              <DamageBody
                team={effectiveTeam}
                hasFormula
                emptyMessage=""
                artifactsByChar={optimizedArtifactsByChar}
                targetCharId={resolvedFormula?.charId}
                displayResult={optimizedDisplayResult}
                formulaKey={
                  resolvedFormula
                    ? `${resolvedFormula.charId}.${resolvedFormula.formulaId}`
                    : undefined
                }
                formulaLabel={activeFormulaLabel}
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
              />
            ) : null}

            {/* No results found */}
            {hasActiveFormula &&
              teamResult?.done &&
              teamResult.bestDamage === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border/30 rounded-lg bg-black/10">
                  {t
                    .ui("teamComp.noValidCombos")
                    .replace("{0}", String(Math.round(minErRaw * 100)))}
                </div>
              )}

            {/* Swap Guide — diff view of optimized vs equipped */}
            {hasActiveFormula &&
              (teamResult?.done || hasOptResult) &&
              teamResult?.bestDamage !== 0 && (
                <SwapGuide
                  team={effectiveTeam}
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
          <div className={CONTROLS_CLS}>
            <EnemyLevelInput {...ctxProps} />
            <EnemyResInput {...ctxProps} />
            <CritRateTargetInput {...ctxProps} />
            <RollMultSelect {...ctxProps} />
            <SubstatBudgetSelect {...ctxProps} />
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
          {formulaMode === "combo" &&
          genDisplayResult &&
          comboLines &&
          teamBuild ? (
            <ComboResultView
              displayResult={genDisplayResult}
              comboLines={comboLines}
              comboId={comboId}
              teamBuild={teamBuild}
              team={effectiveTeam}
              artifactsByChar={genArtifactsByChar}
              calcContext={activeContext}
              critMode={critMode}
              setCritMode={setCritMode}
              isMobile={isMobile}
              t={t}
              reactionOverrides={team.reactionOverrides}
            />
          ) : genResult?.done && genDisplayResult ? (
            <DamageBody
              team={effectiveTeam}
              hasFormula
              emptyMessage=""
              artifactsByChar={genArtifactsByChar}
              targetCharId={resolvedFormula?.charId}
              displayResult={genDisplayResult}
              formulaKey={
                resolvedFormula
                  ? `${resolvedFormula.charId}.${resolvedFormula.formulaId}`
                  : undefined
              }
              formulaLabel={activeFormulaLabel}
              critMode={critMode}
              setCritMode={setCritMode}
              isMobile={isMobile}
              t={t}
            />
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
