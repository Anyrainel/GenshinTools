import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Flame,
  Link2,
  Lock,
  Snowflake,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { Slot, StatKey } from "@/data/enums";
import { charactersById } from "@/data/gameResources";
import type { ArtifactData } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AVG_SUBSTAT_ROLL } from "@/lib/artifact/scoring/constants";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { DisplayResult } from "@/lib/dmgcalc/types";
import { filterMatchesTag } from "@/lib/dmgcalc/utils";
import { fmtPercent, fmtStat } from "@/lib/team-comp/displayFormatter";
import { detectEquippedSets, setsMatch } from "@/lib/team-comp/teamConfigUtils";
import type { OptFailReason, Team } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { ArtifactSlotGrid } from "./ArtifactSlotGrid";

export type ReuseEntry = {
  mode: "shared" | "locked";
  extraIds: Set<string>;
};

type HlKey = StatKey | "charLevel";
type HighlightedStat = { key: HlKey; charId: string } | null;

type ViewMode = "idle" | "combat" | "marginal";

type Props = {
  result?: DisplayResult | null;
  team: Team;
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  targetCharId: string;
  /** Character IDs with active combo lines (combo mode only). */
  comboActiveCharIds?: Set<string>;
  highlightedStat: HighlightedStat;
  onStatHover: (stat: HighlightedStat) => void;
  t: ReturnType<typeof useLanguage>["t"];
  failReasons?: Record<string, OptFailReason>;
  /** Per-character frozen state */
  frozenCharIds?: Set<string>;
  /** When provided, artifact icons become clickable to open a swap dialog */
  onArtifactSwap?: (charId: string, slot: Slot, artifact: ArtifactData) => void;
  /** Callback to freeze a character's artifacts */
  onFreezeChar?: (charId: string) => void;
  /** Callback to unfreeze a character's artifacts */
  onUnfreezeChar?: (charId: string) => void;
  /** Characters whose artifacts are force-reused */
  forceReusedCharIds?: Set<string>;
  /** Per-character reuse info: "locked" (force-reused) or "shared" (pool expansion) */
  reuseInfo?: Map<string, ReuseEntry>;
  /** Preview mode — hides idle/combat/marginal tabs */
  preview?: boolean;
};

const LEVEL_AFFECTED_STATS: StatKey[] = ["atk", "hp", "def"];

/** Check if a stat key is highlighted, including charLevel → atk/hp/def expansion. */
function isKeyHighlighted(
  hl: HighlightedStat,
  charId: string,
  key: StatKey
): boolean {
  if (!hl || hl.charId !== charId) return false;
  if (hl.key === "charLevel") return LEVEL_AFFECTED_STATS.includes(key);
  return hl.key === key;
}

const REQUIRED_STATS: StatKey[] = ["atk", "hp", "def", "em", "er", "cr", "cd"];

const STAT_ORDER: StatKey[] = [
  ...REQUIRED_STATS,
  "reactionCr",
  "reactionCd",
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
  "dmg%",
  "reactionDmg%",
  "baseDmg%",
  "reactionBaseDmg%",
  "elevated%",
  "defReduction%",
  "defIgnore%",
  "resReduction%",
  "baseDmg",
];

/**
 * Determine which column is "primary" (highlighted) vs "secondary" (muted).
 */
function getPrimaryColumn(
  charId: string,
  targetCharId: string,
  comboActiveCharIds?: Set<string>
): "on" | "off" | "both" {
  if (comboActiveCharIds) {
    return comboActiveCharIds.has(charId) ? "on" : "off";
  }
  if (targetCharId === "") return "both";
  return charId === targetCharId ? "on" : "off";
}

// ─── Conditional View Helpers ───

function formatFilter(
  filterKey: string,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  if (filterKey === "") return t.ui("teamComp.universal");
  const parts: string[] = [];
  for (const segment of filterKey.split("|")) {
    const [dim, vals] = segment.split(":") as [string, string];
    if (!vals) continue;
    const items = vals.split(",");
    if (dim === "a") parts.push(items.map((v) => t.ability(v)).join(" / "));
    if (dim === "e") parts.push(items.map((v) => t.element(v)).join(" / "));
    if (dim === "r") parts.push(items.map((v) => t.reaction(v)).join(" / "));
  }
  return parts.join(", ");
}

type ConditionalRow = {
  key: StatKey;
  condition: string;
  offValue: number;
  onValue: number;
};

/** Styling helper for off/on field value cells. */
function valueCls(primary: "on" | "off" | "both", which: "off" | "on"): string {
  return cn(
    "text-right font-mono font-medium whitespace-nowrap",
    primary === "both" && "text-foreground",
    primary === which && "text-foreground",
    primary !== which &&
      primary !== "both" &&
      "text-muted-foreground opacity-60"
  );
}

/** Format an OptFailReason into a short user-facing string. */
function formatFailReason(
  reason: OptFailReason,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  switch (reason.kind) {
    case "empty-pool":
      return t
        .ui("teamComp.failEmptyPool")
        .replace("{0}", reason.emptySlots.map((s) => t.slot(s)).join(", "));
    case "no-seeds":
      return t.ui("teamComp.failNoSeeds");
    case "er-unmet":
      return t
        .ui("teamComp.failErUnmet")
        .replace("{0}", String(Math.round(reason.minEr * 100)))
        .replace("{1}", String(Math.round(reason.bestEr * 100)));
    case "cr-unmet":
      return t
        .ui("teamComp.failCrUnmet")
        .replace("{0}", String(Math.round(reason.minCr * 100)))
        .replace("{1}", String(Math.round(reason.bestCr * 100)));
    case "set-impossible": {
      const name =
        reason.artifactSet?.type === "4pc"
          ? t.artifact(reason.artifactSet.setId) || reason.artifactSet.setId
          : reason.artifactSet?.type === "2pc+2pc"
            ? reason.artifactSet.halfSetIds
                .map((id) => t.halfSetShort(id) || id)
                .join(" + ")
            : "?";
      return t.ui("teamComp.failSetImpossible").replace("{0}", name);
    }
    case "all-filtered":
      return t
        .ui("teamComp.failAllFiltered")
        .replace("{0}", String(reason.combinationsTotal));
    case "timeout":
      return t.ui("teamComp.failTimeout");
    case "worker-error":
      return t.ui("teamComp.failWorkerError").replace("{0}", reason.message);
  }
}

// ─── Conditional (Combat) View Data Hook ───

function useConditionalViewData(
  charId: string,
  result: DisplayResult | null | undefined
) {
  return useMemo(() => {
    if (!result?.statSheets?.[charId]) return null;

    const { onField, offField } = result.statSheets[charId];
    const allTags = result.charFormulaTags?.[charId] ?? [];

    const pairMap = new Map<
      string,
      { key: StatKey; filterKey: string; offValue: number; onValue: number }
    >();

    const addFromSheet = (
      sheet: typeof onField,
      field: "offValue" | "onValue"
    ) => {
      for (const { key, filterKey, value } of sheet.dumpResolved()) {
        if (filterKey !== "") {
          const filter = StatSheet.parseFilterKey(filterKey);
          if (
            allTags.length > 0 &&
            !allTags.some((tag) => filterMatchesTag(filter, tag))
          )
            continue;
        }

        const pairKey = `${key}\0${filterKey}`;
        let entry = pairMap.get(pairKey);
        if (!entry) {
          entry = { key, filterKey, offValue: 0, onValue: 0 };
          pairMap.set(pairKey, entry);
        }
        entry[field] = value;
      }
    };

    addFromSheet(offField, "offValue");
    addFromSheet(onField, "onValue");

    const rows: ConditionalRow[] = [];
    for (const entry of pairMap.values()) {
      rows.push({
        key: entry.key,
        condition: entry.filterKey,
        offValue: entry.offValue,
        onValue: entry.onValue,
      });
    }

    rows.sort((a, b) => {
      let ia = STAT_ORDER.indexOf(a.key);
      let ib = STAT_ORDER.indexOf(b.key);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      if (ia !== ib) return ia - ib;
      if (a.condition === "" && b.condition !== "") return -1;
      if (a.condition !== "" && b.condition === "") return 1;
      return a.condition.localeCompare(b.condition);
    });

    return rows;
  }, [charId, result]);
}

export function StatSheetPanel({
  result,
  team,
  artifactsByChar,
  targetCharId,
  comboActiveCharIds,
  highlightedStat,
  onStatHover,
  t,
  failReasons,
  frozenCharIds,
  onArtifactSwap,
  onFreezeChar,
  onUnfreezeChar,
  forceReusedCharIds,
  reuseInfo,
  preview,
}: Props) {
  // Per-character open view: null = collapsed
  const [openViews, setOpenViews] = useState<Record<string, ViewMode | null>>(
    {}
  );

  const toggleView = (charId: string, mode: ViewMode) => {
    setOpenViews((prev) => ({
      ...prev,
      [charId]: prev[charId] === mode ? null : mode,
    }));
  };

  // Compact mode: shrink artifact icons when cards are narrow
  // Activates below 650px (2x2 cramped) and between 1024-1279px (4x1 cramped)
  const isNarrow = useMediaQuery("(max-width: 649px)");
  const isMidCramped = useMediaQuery(
    "(min-width: 1024px) and (max-width: 1279px)"
  );
  const compact = isNarrow || isMidCramped;

  // Hide chevrons on view-mode bar when below desktop width
  const showChevrons = useMediaQuery("(min-width: 1280px)");

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 xl:gap-2">
      {team.characters.map((charId, i) => {
        if (!charId) return <div key={i} />;

        const isTarget = charId === targetCharId;
        const char = charactersById[charId];
        const isFrozen = frozenCharIds?.has(charId) ?? false;
        const isForceReused = forceReusedCharIds?.has(charId) ?? false;
        const marginal = result?.marginalGains[charId] || {};
        const primary = getPrimaryColumn(
          charId,
          targetCharId,
          comboActiveCharIds
        );

        const marginalKeys = (Object.keys(marginal) as StatKey[]).filter(
          (k) => (marginal[k] as number) > 0
        );
        marginalKeys.sort(
          (a, b) => (marginal[b] as number) - (marginal[a] as number)
        );
        const levelUpGains = result?.levelUpGains[charId] ?? [];
        const hasMarginal = marginalKeys.length > 0 || levelUpGains.length > 0;

        const artifactsObj = artifactsByChar[charId] || {};
        const hasArtifacts = Object.values(artifactsObj).some(Boolean);
        const goalConfig = team.artifacts[i];
        const equippedSets = detectEquippedSets(Object.values(artifactsObj));
        const hasMismatch =
          hasArtifacts && goalConfig && !setsMatch(goalConfig, equippedSets);

        const activeView = openViews[charId] ?? null;

        return (
          <div
            key={charId}
            className={cn(
              "flex flex-col bg-black/15 border rounded-lg overflow-hidden",
              isTarget
                ? "border-primary/40 shadow-inner"
                : "border-border/10 text-foreground/80",
              isFrozen &&
                "ring-1 ring-cyan-400/30 shadow-[0_0_12px_rgba(34,211,238,0.06)]",
              !isFrozen &&
                isForceReused &&
                "ring-1 ring-cyan-400/20 shadow-[0_0_8px_rgba(34,211,238,0.04)]"
            )}
          >
            {/* Header: avatar + name + freeze toggle */}
            <div className="flex items-center gap-2 p-2 bg-black/20 border-b border-border/10 w-full">
              <img
                src={getAssetUrl(char?.imagePath)}
                className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-black/20 shrink-0"
                alt={charId}
              />
              <span className="font-bold text-xs md:text-sm truncate text-foreground/70">
                {t.character(charId)}
              </span>
              {result && !isTarget && marginalKeys.length === 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 text-[10px] md:text-xs font-bold bg-amber-500/15 text-amber-400 px-1 md:px-1.5 py-0.5 rounded-full cursor-help">
                      {t.ui("teamComp.saturated")}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64 text-xs">
                    <p>{t.ui("teamComp.saturatedTooltip")}</p>
                    {result.intrinsicSaturatedCharIds?.includes(charId) && (
                      <p className="mt-1.5 text-amber-400/80">
                        {t.ui("teamComp.saturatedIntrinsicHint")}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              <span className="flex-1" />

              {/* Reuse mode badge (separate from freeze/thaw) */}
              {(() => {
                const reuseEntry = reuseInfo?.get(charId);
                if (!reuseEntry) return null;
                const totalSlots = 5;
                const reusedCount =
                  reuseEntry.mode === "locked"
                    ? totalSlots
                    : Object.values(artifactsObj).filter(
                        (a) => a && reuseEntry.extraIds.has(a.id)
                      ).length;
                const label = t
                  .ui(
                    reuseEntry.mode === "locked"
                      ? "teamComp.reuseBadgeLocked"
                      : "teamComp.reuseBadgeShared"
                  )
                  .replace("{0}", String(reusedCount))
                  .replace("{1}", String(totalSlots));
                return reuseEntry.mode === "locked" ? (
                  <span className="flex items-center gap-0.5 h-5 md:h-6 px-1 md:px-1.5 rounded-md text-[10px] md:text-xs font-bold border border-amber-400/30 bg-amber-500/8 text-amber-400 whitespace-nowrap select-none">
                    <Lock className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
                    {label}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 h-5 md:h-6 px-1 md:px-1.5 rounded-md text-[10px] md:text-xs font-bold border border-cyan-400/30 bg-cyan-500/8 text-cyan-400 whitespace-nowrap select-none">
                    <Link2 className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
                    {label}
                  </span>
                );
              })()}

              {/* Freeze / thaw button — always shown */}
              {isFrozen && onUnfreezeChar ? (
                <button
                  type="button"
                  onClick={() => onUnfreezeChar(charId)}
                  className="flex items-center gap-0.5 md:gap-1 h-5 md:h-6 px-1.5 md:px-2.5 rounded-md text-[10px] md:text-xs font-bold border border-red-400/40 bg-red-500/10 text-red-300 ring-1 ring-red-400/20 hover:bg-red-500/15 hover:text-red-200 hover:ring-red-400/40 transition-colors whitespace-nowrap"
                >
                  <Flame className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
                  {t.ui("teamComp.unfreezeChar")}
                </button>
              ) : onFreezeChar && hasArtifacts ? (
                <button
                  type="button"
                  onClick={() => onFreezeChar(charId)}
                  className="flex items-center gap-0.5 md:gap-1 h-5 md:h-6 px-1.5 md:px-2.5 rounded-md text-[10px] md:text-xs font-bold border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20 hover:bg-cyan-500/15 hover:text-cyan-200 hover:ring-cyan-400/40 transition-colors whitespace-nowrap"
                >
                  <Snowflake className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
                  {t.ui("teamComp.freezeChar")}
                </button>
              ) : null}
            </div>

            {/* Artifacts Grid or Fail Reason — frozen overlay only here */}
            <div
              className={cn(
                "p-0 md:p-1 lg:p-2 border-b border-border/10",
                isFrozen && "frozen-card"
              )}
            >
              {failReasons?.[charId] ? (
                <div className="flex items-center gap-2 px-2 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formatFailReason(failReasons[charId], t)}</span>
                </div>
              ) : (
                <ArtifactSlotGrid
                  artifactsObj={artifactsObj}
                  t={t}
                  compact={compact}
                  onSwap={
                    onArtifactSwap && !isFrozen
                      ? (slot, art) => onArtifactSwap(charId, slot, art)
                      : undefined
                  }
                />
              )}
            </div>

            {/* Thin view-mode bar */}
            {result && !preview && (
              <div className="flex items-stretch gap-1 px-2 py-1.5 bg-black/10 border-b border-border/10">
                {(
                  [
                    {
                      mode: "idle" as const,
                      label: "teamComp.idle" as const,
                    },
                    {
                      mode: "combat" as const,
                      label: "teamComp.combat" as const,
                    },
                    {
                      mode: "marginal" as const,
                      label: "teamComp.marginalGains" as const,
                    },
                  ] as const
                ).map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => toggleView(charId, mode)}
                    className={cn(
                      "flex-1 flex items-center justify-center text-[9px] md:text-[11px] xl:text-xs font-semibold px-1 md:px-1.5 py-0.5 md:py-1 rounded-full transition-all",
                      showChevrons && "gap-0.5",
                      activeView === mode
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80 hover:bg-white/5"
                    )}
                  >
                    {t.ui(label)}
                    {showChevrons &&
                      (activeView === mode ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      ))}
                  </button>
                ))}
              </div>
            )}

            {/* Set Mismatch Warning */}
            {hasMismatch && activeView != null && (
              <div className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{t.ui("teamComp.setMismatch")}</span>
              </div>
            )}

            {/* View content */}
            {result && activeView === "idle" && (
              <IdleView
                charId={charId}
                result={result}
                primary={primary}
                highlightedStat={highlightedStat}
                onStatHover={onStatHover}
                t={t}
              />
            )}
            {result && activeView === "combat" && (
              <ConditionalView
                charId={charId}
                result={result}
                primary={primary}
                highlightedStat={highlightedStat}
                onStatHover={onStatHover}
                t={t}
              />
            )}
            {result &&
              activeView === "marginal" &&
              (hasMarginal ? (
                <MarginalView
                  charId={charId}
                  marginal={marginal}
                  marginalKeys={marginalKeys}
                  levelUpGains={levelUpGains}
                  highlightedStat={highlightedStat}
                  onStatHover={onStatHover}
                  t={t}
                />
              ) : (
                <div className="p-4 text-xs text-muted-foreground text-center italic">
                  {t.ui("teamComp.saturatedMarginalHint")}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Marginal View ───

function MarginalView({
  charId,
  marginal,
  marginalKeys,
  levelUpGains,
  highlightedStat,
  onStatHover,
  t,
}: {
  charId: string;
  marginal: Record<string, number>;
  marginalKeys: StatKey[];
  levelUpGains: { from: number; to: number; gain: number }[];
  highlightedStat: HighlightedStat;
  onStatHover: (stat: HighlightedStat) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="flex flex-col space-y-[1px] p-2 bg-black/20 pt-1">
      {marginalKeys.map((k) => {
        const rollVal = (AVG_SUBSTAT_ROLL as Record<string, number>)[k] || 0;
        const gain = marginal[k] as number;
        const hlKey: StatKey =
          k === "atk%" ? "atk" : k === "hp%" ? "hp" : k === "def%" ? "def" : k;
        const isHl =
          highlightedStat?.charId === charId && highlightedStat?.key === hlKey;
        return (
          <div
            key={k}
            onMouseEnter={() => onStatHover({ key: hlKey, charId })}
            onMouseLeave={() => onStatHover(null)}
            onClick={() => onStatHover(isHl ? null : { key: hlKey, charId })}
            className={cn(
              "flex flex-wrap items-center gap-[6px] px-1.5 py-1.5 rounded-sm hover:bg-white/5 transition-colors text-xs md:text-sm font-mono leading-none",
              isHl
                ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                : ""
            )}
          >
            <span className="text-[10px] md:text-xs font-bold bg-black/20 text-muted-foreground px-1 py-0.5 rounded border border-border/10 opacity-70">
              +1
            </span>
            <span
              className={cn(
                "font-bold text-xs md:text-sm",
                isHl
                  ? "text-[color:hsl(var(--primary))] opacity-100"
                  : "text-primary"
              )}
            >
              {t.statShort(k)}
            </span>
            <span className="hidden md:inline text-[10px] md:text-xs whitespace-nowrap">
              <span className="text-muted-foreground opacity-60">
                ({t.ui("teamComp.avgVal")}
              </span>
              <span className="font-bold text-foreground opacity-90">
                +{fmtStat(k, rollVal)}
              </span>
              <span className="text-muted-foreground opacity-60">)</span>
            </span>
            <span className="text-[10px] md:text-xs text-muted-foreground opacity-50 px-0.5">
              ➔
            </span>
            <span className="text-green-400 font-bold bg-green-500/10 px-1 py-0.5 rounded-sm text-xs md:text-sm">
              {fmtPercent(gain, true)}
            </span>
            <span className="hidden md:inline text-foreground opacity-60">
              {t.ui("teamComp.gain")}
            </span>
          </div>
        );
      })}
      {levelUpGains.map((levelUpGain) => {
        const lvHl =
          highlightedStat?.charId === charId &&
          highlightedStat?.key === "charLevel";
        return (
          <div
            key={`${levelUpGain.from}-${levelUpGain.to}`}
            onMouseEnter={() => onStatHover({ key: "charLevel", charId })}
            onMouseLeave={() => onStatHover(null)}
            onClick={() =>
              onStatHover(lvHl ? null : { key: "charLevel", charId })
            }
            className={cn(
              "flex flex-wrap items-center gap-[6px] px-1.5 py-1.5 rounded-sm hover:bg-white/5 transition-colors text-xs md:text-sm font-mono leading-none",
              lvHl
                ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                : ""
            )}
          >
            <span className="text-[10px] md:text-xs font-bold bg-black/20 text-muted-foreground px-1 py-0.5 rounded border border-border/10 opacity-70">
              Lv
            </span>
            <span
              className={cn(
                "font-bold text-xs md:text-sm",
                lvHl
                  ? "text-[color:hsl(var(--primary))] opacity-100"
                  : "text-primary"
              )}
            >
              {t.format(
                "teamComp.levelUpGain",
                levelUpGain.from,
                levelUpGain.to
              )}
            </span>
            <span className="text-[10px] md:text-xs text-muted-foreground opacity-50 px-0.5">
              ➔
            </span>
            <span className="text-green-400 font-bold bg-green-500/10 px-1 py-0.5 rounded-sm text-xs md:text-sm">
              {fmtPercent(levelUpGain.gain, true)}
            </span>
            <span className="hidden md:inline text-foreground opacity-60">
              {t.ui("teamComp.gain")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Idle View ───

/** Stats shown in the idle panel (matches game's character attribute screen). */
const IDLE_STATS: StatKey[] = [
  "baseAtk",
  "atk",
  "baseHp",
  "hp",
  "baseDef",
  "def",
  "em",
  "er",
  "cr",
  "cd",
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
];

function IdleView({
  charId,
  result,
  primary,
  highlightedStat,
  onStatHover,
  t,
}: {
  charId: string;
  result: DisplayResult;
  primary: "on" | "off" | "both";
  highlightedStat: HighlightedStat;
  onStatHover: (stat: { key: StatKey; charId: string } | null) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const rec = result.idleStatRecords?.[charId];
  const off = rec?.offField ?? {};
  const on = rec?.onField ?? {};

  return (
    <div className="bg-black/20 pt-1 px-2 pb-2">
      <table className="w-full border-collapse text-[10px] md:text-xs xl:text-sm">
        <thead>
          <tr className="text-[8px] md:text-[10px] xl:text-xs font-bold text-muted-foreground uppercase tracking-wider opacity-70">
            <th className="text-left font-bold py-1 pr-2 whitespace-nowrap">
              {t.ui("teamComp.stats")}
            </th>
            <th className="text-right font-bold py-1 px-1 whitespace-nowrap">
              {t.ui("teamComp.offField")}
            </th>
            <th className="text-right font-bold py-1 pl-1 whitespace-nowrap">
              {t.ui("teamComp.onField")}
            </th>
          </tr>
        </thead>
        <tbody>
          {IDLE_STATS.map((key) => {
            const offVal = (off[key] as number) ?? 0;
            const onVal = (on[key] as number) ?? 0;
            if (offVal === 0 && onVal === 0 && !REQUIRED_STATS.includes(key))
              return null;
            const isHl = isKeyHighlighted(highlightedStat, charId, key);
            return (
              <tr
                key={key}
                onMouseEnter={() => onStatHover({ key, charId })}
                onMouseLeave={() => onStatHover(null)}
                onClick={() => onStatHover(isHl ? null : { key, charId })}
                className={cn(
                  "cursor-default hover:bg-white/5 transition-colors",
                  isHl && "bg-primary/10 ring-1 ring-primary/20"
                )}
              >
                <td
                  className={cn(
                    "py-1 pr-2 whitespace-nowrap",
                    isHl && "text-[color:hsl(var(--primary))]"
                  )}
                >
                  {t.stat(key)}
                </td>
                <td className={cn("py-1 px-1", valueCls(primary, "off"))}>
                  {fmtStat(key, offVal)}
                </td>
                <td className={cn("py-1 pl-1", valueCls(primary, "on"))}>
                  {fmtStat(key, onVal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Combat (Conditional) View ───

function ConditionalView({
  charId,
  result,
  primary,
  highlightedStat,
  onStatHover,
  t,
}: {
  charId: string;
  result: DisplayResult;
  primary: "on" | "off" | "both";
  highlightedStat: HighlightedStat;
  onStatHover: (stat: { key: StatKey; charId: string } | null) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const rows = useConditionalViewData(charId, result);

  return (
    <div className="bg-black/20 pt-1 px-2 pb-2">
      <table className="w-full border-collapse text-[10px] md:text-xs xl:text-sm">
        <thead>
          <tr className="text-[8px] md:text-[10px] xl:text-xs font-bold text-muted-foreground uppercase tracking-wider opacity-70">
            <th className="text-left font-bold py-1 pr-2 whitespace-nowrap">
              {t.ui("teamComp.stats")}
            </th>
            <th className="text-left font-bold py-1 px-1 tracking-tight w-full">
              {t.ui("teamComp.condition")}
            </th>
            <th className="text-right font-bold py-1 px-1 whitespace-nowrap">
              {t.ui("teamComp.offField")}
            </th>
            <th className="text-right font-bold py-1 pl-1 whitespace-nowrap">
              {t.ui("teamComp.onField")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows && rows.length > 0 ? (
            rows.map((row, idx) => {
              const showKey = idx === 0 || rows[idx - 1].key !== row.key;
              const isHl = isKeyHighlighted(highlightedStat, charId, row.key);
              return (
                <tr
                  key={`${row.key}-${row.condition}`}
                  onMouseEnter={() => onStatHover({ key: row.key, charId })}
                  onMouseLeave={() => onStatHover(null)}
                  onClick={() =>
                    onStatHover(isHl ? null : { key: row.key, charId })
                  }
                  className={cn(
                    "cursor-default transition-colors",
                    isHl && "bg-primary/10"
                  )}
                >
                  <td
                    className={cn(
                      "py-1 pr-2 whitespace-nowrap",
                      !showKey && "opacity-0",
                      isHl && "text-[color:hsl(var(--primary))]"
                    )}
                  >
                    {showKey ? t.statShort(row.key) : "\u00A0"}
                  </td>
                  <td className="py-1 px-1 text-muted-foreground text-[8px] md:text-[10px] xl:text-xs tracking-tight">
                    {formatFilter(row.condition, t)}
                  </td>
                  <td className={cn("py-1 px-1", valueCls(primary, "off"))}>
                    {fmtStat(row.key, row.offValue)}
                  </td>
                  <td className={cn("py-1 pl-1", valueCls(primary, "on"))}>
                    {fmtStat(row.key, row.onValue)}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={4}
                className="text-xs text-muted-foreground opacity-50 px-1 py-4 italic text-center"
              >
                {t.ui("teamComp.noStatsResolved")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
