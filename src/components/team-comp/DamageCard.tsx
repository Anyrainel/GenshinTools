import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
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
import type { AccountData, ArtifactData } from "@/data/types";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import type { IdealGenResult } from "@/lib/team-comp/idealArtifactGen";
import type {
  TeamOptimizationProgress,
  TeamOptimizationResult,
} from "@/lib/team-comp/teamOptimizer";
import type {
  CalcContext,
  ComboLine,
  ComboResult,
  DisplayResult,
  ReactionOverride,
  StatKey,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  Flame,
  Loader2,
  Play,
  Snowflake,
  Swords,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BuffLedger } from "./BuffLedger";
import { FormulaBreakdown } from "./FormulaBreakdown";
import { StatSheetPanel } from "./StatSheetPanel";
import { fmtDamage } from "./displayFormatters";

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

const CARD_CLS = "bg-gradient-card border-border/50 overflow-hidden shadow-lg";
const CARD_HEADER_CLS =
  "bg-gradient-select border-b border-border/40 py-3 px-2 md:px-5";
const CARD_TITLE_CLS =
  "text-base font-bold flex items-center gap-2 tracking-tight text-primary-foreground/90";
const CARD_BODY_CLS = "p-1.5 md:p-3 bg-black/10";

/** Shared body for current / optimized / ideal tabs. */
function DamageBody({
  team,
  hasFormula,
  emptyMessage,
  artifactsByChar,
  targetCharId,
  damageValue,
  displayResult,
  isMobile,
  t,
  failReasons,
  isFrozen,
}: {
  team: Team;
  hasFormula: boolean;
  emptyMessage: string;
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  targetCharId?: string;
  damageValue: number | null;
  displayResult?: DisplayResult | null;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  failReasons?: Record<
    string,
    import("@/lib/team-comp/optimizer").OptFailReason
  >;
  isFrozen?: boolean;
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
          isFrozen={isFrozen}
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
              {damageValue != null ? (
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-xl transition-colors cursor-pointer select-none",
                      isMobile ? "gap-1.5 px-2 py-1.5" : "gap-2.5 px-4 py-2",
                      "bg-primary/10 border border-primary/30 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.12)]",
                      "hover:bg-primary/15"
                    )}
                  >
                    <div
                      className={cn(
                        "text-primary/80 font-semibold tracking-wide whitespace-nowrap",
                        isMobile ? "text-xs" : "text-sm md:text-base"
                      )}
                    >
                      {t.ui("teamComp.totalExpectedDamage")}
                    </div>
                    <div
                      className={cn(
                        "text-foreground font-[math] font-black drop-shadow-sm",
                        isMobile ? "text-2xl" : "text-3xl md:text-4xl"
                      )}
                    >
                      {Math.round(damageValue).toLocaleString()}
                    </div>
                    <span
                      className={cn(
                        "text-muted-foreground/70 whitespace-nowrap",
                        isMobile ? "text-[10px] ml-0.5" : "text-xs ml-1.5"
                      )}
                    >
                      {formulaExpanded
                        ? t.ui("teamComp.collapseFormula")
                        : t.ui("teamComp.expandFormula")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground/70 transition-transform shrink-0",
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
                  parts={displayResult.parts}
                  highlightedStat={
                    highlightedStat?.charId === targetCharId
                      ? highlightedStat?.key
                      : null
                  }
                  t={t}
                />
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {hasFormula && displayResult && (
        <BuffLedger buffs={displayResult.buffs} team={team} t={t} />
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

  // Merge same as evaluateCombo: single-mode as defaults, line overrides on top
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

/** Combo mode breakdown: 4-column grid grouped by character. */
function ComboBreakdown({
  team,
  comboResult,
  comboLines,
  teamBuild,
  damageValue,
  reactionOverrides,
  isMobile,
  t,
}: {
  team: Team;
  comboResult: ComboResult;
  comboLines: ComboLine[];
  teamBuild: TeamBuild;
  damageValue: number;
  reactionOverrides: Record<string, ReactionOverride>;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const allFormulaIds = useMemo(() => teamBuild.getFormulaIds(), [teamBuild]);
  const activeLines = comboLines.filter((l) => l.count > 0);

  // Build per-line damage lookup (matches evaluateCombo's activeLines order)
  const lineDamages = comboResult.lineDamages;

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

  // Whether any visible line has partial reaction settings
  const anyPartial = useMemo(
    () =>
      Array.from(byChar.values()).some((arr) => arr.some((l) => l.isPartial)),
    [byChar]
  );

  // Maintain team character order
  const teamCharIds = team.characters.filter((id): id is string => id != null);

  const [expanded, setExpanded] = useSessionState("comboExpanded", true);

  return (
    <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div
          className={cn(
            "border border-dashed border-border/20 rounded-lg bg-black/5 text-sm",
            isMobile ? "p-1.5" : "p-2"
          )}
        >
          {/* Total damage — clickable to toggle breakdown */}
          <div className="flex flex-col items-center justify-center">
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl transition-colors cursor-pointer select-none",
                  isMobile ? "gap-1.5 px-2 py-1.5" : "gap-2.5 px-4 py-2",
                  "bg-primary/10 border border-primary/30 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.12)]",
                  "hover:bg-primary/15"
                )}
              >
                <div
                  className={cn(
                    "text-primary/80 font-semibold tracking-wide whitespace-nowrap",
                    isMobile ? "text-xs" : "text-sm md:text-base"
                  )}
                >
                  {t.ui("teamComp.totalExpectedDamage")}
                </div>
                <div
                  className={cn(
                    "text-foreground font-[math] font-black drop-shadow-sm",
                    isMobile ? "text-2xl" : "text-3xl md:text-4xl"
                  )}
                >
                  {Math.round(damageValue).toLocaleString()}
                </div>
                <span
                  className={cn(
                    "text-muted-foreground/70 whitespace-nowrap",
                    isMobile ? "text-[10px] ml-0.5" : "text-xs ml-1.5"
                  )}
                >
                  {expanded
                    ? t.ui("teamComp.collapseFormula")
                    : t.ui("teamComp.expandFormula")}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground/70 transition-transform shrink-0",
                    expanded && "rotate-180"
                  )}
                />
              </div>
            </CollapsibleTrigger>
          </div>

          {/* Per-character breakdown grid */}
          <CollapsibleContent>
            <div
              className={cn(
                "grid gap-2 mt-3",
                isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
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
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/20 bg-black/10">
                      {charRes && (
                        <img
                          src={getAssetUrl(charRes.imagePath)}
                          alt={charId}
                          className="w-7 h-7 object-contain rounded-full bg-secondary/40 shrink-0"
                        />
                      )}
                      <span className="text-base font-bold text-foreground truncate">
                        {t.character(charId)}
                      </span>
                    </div>

                    {/* Formula lines */}
                    <div className="p-3 flex flex-col gap-2">
                      {lines && lines.length > 0 ? (
                        lines.map(({ line, perHit, total, isPartial }, idx) => {
                          const label = charFormulas?.[line.formulaId];
                          const rxn = line.reaction?.reaction;
                          return (
                            <div
                              key={idx}
                              className="flex flex-col gap-0.5 px-1 py-1"
                            >
                              <div className="flex items-baseline gap-1 min-w-0">
                                <span className="text-base font-semibold text-foreground truncate">
                                  {label
                                    ? t.resolveLabel(label)
                                    : line.formulaId}
                                  {isPartial && (
                                    <span
                                      className="text-amber-400 text-xl font-bold leading-none ml-0.5"
                                      title={t.ui(
                                        "teamComp.partialReactionNote"
                                      )}
                                    >
                                      *
                                    </span>
                                  )}
                                </span>
                                {rxn && rxn !== "none" && (
                                  <span className="text-base text-primary font-semibold shrink-0">
                                    [{t.reaction(rxn)}]
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-1 text-lg font-mono tabular-nums">
                                <span className="text-foreground font-bold">
                                  {fmtDamage(perHit)}
                                </span>
                                {line.count > 1 && (
                                  <>
                                    <span className="text-muted-foreground/40">
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
                        })
                      ) : (
                        <span className="text-sm text-muted-foreground/40 px-1 py-1">
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
          </CollapsibleContent>
        </div>
      </Collapsible>
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
  currentDamageValue: number | null;
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
  optimizedDamageValue: number | null;
  optimizedDisplayResult: DisplayResult | null | undefined;
  targetErRaw: number;
  // Ideal gen (dev only)
  idealComputing: boolean;
  idealResult: IdealGenResult | null;
  idealError: Error | null;
  handleGenerateIdeal: () => void;
  idealArtifactsByChar: Record<string, Record<string, ArtifactData>>;
  idealDamageValue: number | null;
  idealDisplayResult: DisplayResult | null | undefined;
  // Combo mode
  comboResult?: ComboResult | null;
  comboLines?: ComboLine[] | null;
  teamBuild?: TeamBuild | null;
  formulaMode?: "single" | "combo";
  optimizedComboResult?: ComboResult | null;
  idealComboResult?: ComboResult | null;
  // Freeze
  isFrozen?: boolean;
  onFreeze?: () => void;
  onUnfreeze?: () => void;
}

// ─── Shared inline control helpers ───

type CtxProps = {
  team: Team;
  activeContext: CalcContext;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
};

const LABEL_CLS = (mobile: boolean) =>
  cn(
    "font-semibold text-foreground/80 select-none",
    mobile ? "text-xs" : "text-sm"
  );

function EnemyLevelInput({
  team,
  activeContext,
  updateTeam,
  isMobile,
  t,
}: CtxProps) {
  return (
    <div className={cn("flex items-center", isMobile ? "gap-1" : "gap-2")}>
      <span className={LABEL_CLS(isMobile)}>{t.ui("teamComp.enemyLevel")}</span>
      <Input
        type="text"
        inputMode="numeric"
        value={activeContext.enemyLevel}
        onChange={(e) => {
          const num = Number(e.target.value);
          if (e.target.value === "" || !Number.isNaN(num))
            updateTeam(team.id, {
              calcContext: { ...team.calcContext, enemyLevel: num || 100 },
            });
        }}
        className={cn(
          "text-sm text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0",
          isMobile ? "h-7 w-14" : "h-8 w-16"
        )}
      />
    </div>
  );
}

function EnemyResInput({
  team,
  activeContext,
  updateTeam,
  isMobile,
  t,
}: CtxProps) {
  return (
    <div className={cn("flex items-center", isMobile ? "gap-1" : "gap-2")}>
      <span className={LABEL_CLS(isMobile)}>{t.ui("teamComp.enemyRes")}</span>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={Math.round(activeContext.enemyRes * 100)}
          onChange={(e) =>
            updateTeam(team.id, {
              calcContext: {
                ...team.calcContext,
                enemyRes: (Number(e.target.value) || 0) / 100,
              },
            })
          }
          className={cn(
            "text-sm text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            isMobile ? "h-7 w-14" : "h-8 w-16"
          )}
        />
        <span className="text-xs font-bold text-muted-foreground">%</span>
      </div>
    </div>
  );
}

function AssumeCritToggle({
  team,
  activeContext,
  updateTeam,
  isMobile,
  t,
}: CtxProps) {
  return (
    <div
      className={cn(
        "flex items-center cursor-pointer select-none",
        isMobile ? "gap-1" : "gap-2"
      )}
      onClick={() =>
        updateTeam(team.id, {
          calcContext: {
            ...team.calcContext,
            assumeCrit: !activeContext.assumeCrit,
          },
        })
      }
    >
      <div
        className={cn(
          "w-4 h-4 rounded border border-border/30 flex items-center justify-center transition-colors shadow-sm cursor-pointer",
          activeContext.assumeCrit
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-background/50"
        )}
      >
        {activeContext.assumeCrit && <Check className="w-3 h-3" />}
      </div>
      <span
        className={cn(
          "font-semibold text-foreground/80",
          isMobile ? "text-xs" : "text-sm"
        )}
      >
        {t.ui("teamComp.assumeCrit")}
      </span>
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
    <div className="flex items-center gap-1 shrink-0">
      <span className={LABEL_CLS(isMobile)}>
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
        className={cn(
          "text-sm text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          isMobile ? "h-7 w-14" : "h-8 w-16"
        )}
      />
      <span className="text-xs font-bold text-muted-foreground">%</span>
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
    <div className={cn("flex items-center", isMobile ? "gap-1" : "gap-2")}>
      <span className={LABEL_CLS(isMobile)}>
        {t.ui("teamComp.rollMultiplier")}
      </span>
      <Select
        value={String(activeContext.rollMultiplier ?? 0.85)}
        onValueChange={(v) =>
          updateTeam(team.id, {
            calcContext: { ...team.calcContext, rollMultiplier: Number(v) },
          })
        }
      >
        <SelectTrigger
          className={cn(
            "text-sm font-bold border-border/20 bg-background/50",
            isMobile ? "h-7 w-18" : "h-8 w-20"
          )}
        >
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
      className="gap-1.5 font-bold px-4 shadow-md text-xs"
    >
      {computing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Play className="w-3.5 h-3.5" />
      )}
      <span>{computing ? labelBusy : labelIdle}</span>
    </Button>
  );
}

const CONTROLS_CLS = (mobile: boolean) =>
  cn(
    "flex flex-wrap items-center justify-center mb-3",
    mobile ? "gap-x-3 gap-y-1.5" : "gap-x-5 gap-y-2"
  );

export function DamageCard({
  team,
  effectiveTeam,
  updateTeam,
  resolvedFormula,
  isMobile,
  t,
  equippedArtifactsByChar,
  currentDamageValue,
  currentDisplayResult,
  accountData,
  activeContext,
  isComputing,
  teamProgress,
  teamResult,
  teamError,
  handleOptimize,
  optimizedArtifactsByChar,
  optimizedDamageValue,
  optimizedDisplayResult,
  targetErRaw,
  idealComputing,
  idealResult,
  idealError,
  handleGenerateIdeal,
  idealArtifactsByChar,
  idealDamageValue,
  idealDisplayResult,
  comboResult,
  comboLines,
  teamBuild,
  formulaMode = "single",
  optimizedComboResult,
  idealComboResult,
  isFrozen,
  onFreeze,
  onUnfreeze,
}: DamageCardProps) {
  const [resultsTab, setResultsTab] = useSessionState<
    "current" | "optimize" | "generate"
  >("resultsTab", "current");

  const ctxProps: CtxProps = { team, activeContext, updateTeam, isMobile, t };

  const hasActiveFormula =
    formulaMode === "combo"
      ? comboLines?.some((l) => l.count > 0)
      : resolvedFormula != null;

  return (
    <Card
      className={cn(
        CARD_CLS,
        isFrozen &&
          "ring-1 ring-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.08)]"
      )}
    >
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
      <div className="flex gap-2 px-2 md:px-4 py-2 border-b border-border/20">
        {(
          [
            {
              key: "current" as const,
              label: "teamComp.tabCurrentEquipped" as const,
              desc: "teamComp.tabCurrentEquippedDesc" as const,
            },
            {
              key: "optimize" as const,
              label: "teamComp.tabOptimize" as const,
              desc: "teamComp.tabOptimizeDesc" as const,
            },
            {
              key: "generate" as const,
              label: "teamComp.tabGenerateIdeal" as const,
              desc: "teamComp.tabGenerateIdealDesc" as const,
            },
          ] as const
        ).map(({ key, label, desc }) => {
          const selected = resultsTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setResultsTab(key)}
              className={cn(
                "flex-1 flex items-start gap-2.5 rounded-lg border-2 px-3 py-2.5 text-left transition-all",
                selected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/30 bg-black/5 hover:border-border/50 hover:bg-black/10"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                  selected ? "border-primary" : "border-muted-foreground/40"
                )}
              >
                {selected && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
                <span
                  className={cn(
                    "text-base md:text-lg font-bold",
                    selected ? "text-foreground" : "text-foreground/70"
                  )}
                >
                  {t.ui(label)}
                </span>
                <span
                  className={cn(
                    "text-xs leading-snug",
                    selected
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                  )}
                >
                  {t.ui(desc)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Content: Current Equipped ── */}
      {resultsTab === "current" && (
        <CardContent className={CARD_BODY_CLS}>
          <div className={CONTROLS_CLS(isMobile)}>
            <EnemyLevelInput {...ctxProps} />
            <EnemyResInput {...ctxProps} />
            <AssumeCritToggle {...ctxProps} />
          </div>
          {formulaMode === "combo" && comboResult && comboLines && teamBuild ? (
            <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
              {currentDisplayResult && (
                <StatSheetPanel
                  result={currentDisplayResult}
                  team={effectiveTeam}
                  artifactsByChar={equippedArtifactsByChar}
                  targetCharId={""}
                  comboActiveCharIds={
                    new Set(
                      comboLines.filter((l) => l.count > 0).map((l) => l.charId)
                    )
                  }
                  highlightedStat={null}
                  onStatHover={() => {}}
                  t={t}
                />
              )}
              <ComboBreakdown
                team={effectiveTeam}
                comboResult={comboResult}
                comboLines={comboLines}
                teamBuild={teamBuild}
                damageValue={comboResult.totalDamage}
                reactionOverrides={team.reactionOverrides}
                isMobile={isMobile}
                t={t}
              />
              {currentDisplayResult && (
                <BuffLedger
                  buffs={currentDisplayResult.buffs}
                  team={effectiveTeam}
                  t={t}
                />
              )}
            </div>
          ) : formulaMode === "combo" && comboLines && !comboResult ? (
            <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
              <Swords className="w-8 h-8 opacity-15" />
              <p>{t.ui("teamComp.emptyComboMessage")}</p>
            </div>
          ) : (
            <DamageBody
              team={effectiveTeam}
              hasFormula={resolvedFormula != null}
              emptyMessage={t.ui("teamComp.emptyDamageMessage")}
              artifactsByChar={equippedArtifactsByChar}
              targetCharId={resolvedFormula?.charId}
              damageValue={currentDamageValue}
              displayResult={currentDisplayResult}
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

          <CardContent className={CARD_BODY_CLS}>
            <div className={CONTROLS_CLS(isMobile)}>
              <EnemyLevelInput {...ctxProps} />
              <EnemyResInput {...ctxProps} />
              <CritRateTargetInput {...ctxProps} />
              <span
                title={isFrozen ? t.ui("teamComp.frozenTooltip") : undefined}
              >
                <ActionButton
                  onClick={handleOptimize}
                  disabled={isFrozen || isComputing || !hasActiveFormula}
                  computing={isComputing}
                  labelIdle={
                    isFrozen
                      ? t.ui("teamComp.frozenBadge")
                      : t.ui("teamComp.runOptimization")
                  }
                  labelBusy={t.ui("teamComp.optimizing")}
                />
              </span>
              {onFreeze && !isFrozen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onFreeze}
                  disabled={
                    !teamResult?.done ||
                    teamResult.bestDamage <= 0 ||
                    !hasActiveFormula
                  }
                  className="gap-1.5 font-bold px-4 text-xs shadow-md border-cyan-400/40 bg-cyan-500/10 text-cyan-300 ring-2 ring-cyan-400/20 hover:!bg-cyan-500/15 hover:!text-cyan-200 hover:ring-cyan-400/40 disabled:opacity-40 disabled:text-cyan-300/50 disabled:ring-0"
                >
                  <Snowflake className="w-3.5 h-3.5" />
                  {t.ui("teamComp.freezeTeam")}
                </Button>
              )}
              {isFrozen && onUnfreeze && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnfreeze}
                  className="gap-1.5 font-bold px-4 text-xs shadow-md border-red-400/40 bg-red-500/10 text-red-300 ring-2 ring-red-400/20 hover:!bg-red-500/15 hover:!text-red-200 hover:ring-red-400/40"
                >
                  <Flame className="w-3.5 h-3.5" />
                  {t.ui("teamComp.unfreezeTeam")}
                </Button>
              )}
            </div>

            {/* Empty state */}
            {!isComputing && !teamResult && !teamError && !isFrozen && (
              <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                <Swords className="w-8 h-8 opacity-15" />
                <p>{t.ui("teamComp.emptyOptMessage")}</p>
              </div>
            )}

            {/* Error state */}
            {teamError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm">
                <span className="font-bold">
                  {t.ui("teamComp.optimizerError")}
                </span>{" "}
                {teamError.message}
              </div>
            )}

            {/* Progress */}
            {isComputing && (
              <div className="space-y-3 bg-black/15 p-3 rounded-lg border border-border/20">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold">
                    {teamProgress
                      ? t
                          .ui("teamComp.passLabel")
                          .replace("{0}", String(teamProgress.passIndex + 1))
                          .replace("{1}", String(teamProgress.totalPasses))
                          .replace(
                            "{2}",
                            `${t.character(teamProgress.currentPassCharId)} — ${
                              teamProgress.currentPass === "carry-1"
                                ? t.ui("teamComp.passCarryInitial")
                                : teamProgress.currentPass === "carry-2"
                                  ? t.ui("teamComp.passCarryRefine")
                                  : t.ui("teamComp.passSupport")
                            }`
                          )
                      : t.ui("teamComp.preparingOptimizer")}
                  </span>
                  <span className="font-mono font-bold">
                    {Math.round((teamProgress?.overallProgress ?? 0) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(teamProgress?.overallProgress ?? 0) * 100}
                  className="h-1.5 bg-black/40"
                />
                {teamProgress && teamProgress.passResults.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {teamProgress.passResults.map((pr, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-semibold"
                      >
                        <Check className="w-2.5 h-2.5" />
                        {t.character(pr.charId)}
                        {" — "}
                        {pr.passId === "carry-1"
                          ? t.ui("teamComp.passCarryInitial")
                          : pr.passId === "carry-2"
                            ? t.ui("teamComp.passCarryRefine")
                            : t.ui("teamComp.passSupport")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {/* Combo mode with no active lines — show hint */}
            {formulaMode === "combo" &&
              comboLines &&
              !optimizedComboResult &&
              isFrozen &&
              !teamResult && (
                <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
                  <Swords className="w-8 h-8 opacity-15" />
                  <p>{t.ui("teamComp.emptyComboMessage")}</p>
                </div>
              )}

            {!hasActiveFormula ? null : formulaMode === "combo" &&
              optimizedComboResult &&
              comboLines &&
              teamBuild ? (
              <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
                {optimizedDisplayResult && (
                  <StatSheetPanel
                    result={optimizedDisplayResult}
                    team={effectiveTeam}
                    artifactsByChar={optimizedArtifactsByChar}
                    targetCharId={""}
                    comboActiveCharIds={
                      new Set(
                        comboLines
                          .filter((l) => l.count > 0)
                          .map((l) => l.charId)
                      )
                    }
                    highlightedStat={null}
                    onStatHover={() => {}}
                    t={t}
                    failReasons={
                      teamResult?.done ? teamResult.failReasons : undefined
                    }
                    isFrozen={isFrozen}
                  />
                )}
                <ComboBreakdown
                  team={effectiveTeam}
                  comboResult={optimizedComboResult}
                  comboLines={comboLines}
                  teamBuild={teamBuild}
                  damageValue={optimizedComboResult.totalDamage}
                  reactionOverrides={team.reactionOverrides}
                  isMobile={isMobile}
                  t={t}
                />
                {optimizedDisplayResult && (
                  <BuffLedger
                    buffs={optimizedDisplayResult.buffs}
                    team={effectiveTeam}
                    t={t}
                  />
                )}
              </div>
            ) : teamResult?.mode === "single" ||
              (isFrozen && optimizedDisplayResult) ? (
              <DamageBody
                team={effectiveTeam}
                hasFormula
                emptyMessage=""
                artifactsByChar={optimizedArtifactsByChar}
                targetCharId={resolvedFormula?.charId}
                damageValue={optimizedDamageValue ?? 0}
                displayResult={optimizedDisplayResult}
                isMobile={isMobile}
                t={t}
                failReasons={
                  teamResult?.done ? teamResult.failReasons : undefined
                }
                isFrozen={isFrozen}
              />
            ) : null}

            {/* No results found */}
            {hasActiveFormula &&
              teamResult?.done &&
              teamResult.bestDamage === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border/30 rounded-lg bg-black/10">
                  {t
                    .ui("teamComp.noValidCombinations")
                    .replace("{0}", String(Math.round(targetErRaw * 100)))}
                </div>
              )}
          </CardContent>
        </>
      )}

      {/* ── Content: Generate Ideal (dev only) ── */}
      {resultsTab === "generate" && (
        <CardContent className={CARD_BODY_CLS}>
          <div className={CONTROLS_CLS(isMobile)}>
            <EnemyLevelInput {...ctxProps} />
            <EnemyResInput {...ctxProps} />
            <CritRateTargetInput {...ctxProps} />
            <RollMultSelect {...ctxProps} />
            <ActionButton
              onClick={handleGenerateIdeal}
              disabled={idealComputing || !hasActiveFormula}
              computing={idealComputing}
              labelIdle={t.ui("teamComp.generateIdeal")}
              labelBusy={t.ui("teamComp.generatingIdeal")}
            />
          </div>

          {/* Empty state */}
          {!idealComputing && !idealResult?.done && !idealError && (
            <div className="text-muted-foreground py-10 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10 flex flex-col items-center gap-3">
              <Swords className="w-8 h-8 opacity-15" />
              <p>{t.ui("teamComp.idealEmptyMessage")}</p>
            </div>
          )}

          {/* Error state */}
          {idealError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-sm">
              <span className="font-bold">
                {t.ui("teamComp.optimizerError")}
              </span>{" "}
              {idealError.message}
            </div>
          )}

          {/* Progress */}
          {idealComputing && idealResult && (
            <div className="space-y-3 bg-black/15 p-3 rounded-lg border border-border/20">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold">{idealResult.phase}</span>
                <span className="font-mono font-bold">
                  {Math.round(idealResult.progress * 100)}%
                </span>
              </div>
              <Progress
                value={idealResult.progress * 100}
                className="h-1.5 bg-black/40"
              />
            </div>
          )}

          {/* Results */}
          {formulaMode === "combo" &&
          idealComboResult &&
          comboLines &&
          teamBuild ? (
            <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
              {idealDisplayResult && (
                <StatSheetPanel
                  result={idealDisplayResult}
                  team={effectiveTeam}
                  artifactsByChar={idealArtifactsByChar}
                  targetCharId={""}
                  comboActiveCharIds={
                    new Set(
                      comboLines.filter((l) => l.count > 0).map((l) => l.charId)
                    )
                  }
                  highlightedStat={null}
                  onStatHover={() => {}}
                  t={t}
                />
              )}
              <ComboBreakdown
                team={effectiveTeam}
                comboResult={idealComboResult}
                comboLines={comboLines}
                teamBuild={teamBuild}
                damageValue={idealComboResult.totalDamage}
                reactionOverrides={team.reactionOverrides}
                isMobile={isMobile}
                t={t}
              />
              {idealDisplayResult && (
                <BuffLedger
                  buffs={idealDisplayResult.buffs}
                  team={effectiveTeam}
                  t={t}
                />
              )}
            </div>
          ) : idealResult?.done && idealResult.damageResult ? (
            <DamageBody
              team={effectiveTeam}
              hasFormula
              emptyMessage=""
              artifactsByChar={idealArtifactsByChar}
              targetCharId={resolvedFormula?.charId}
              damageValue={idealDamageValue ?? 0}
              displayResult={idealDisplayResult}
              isMobile={isMobile}
              t={t}
            />
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
