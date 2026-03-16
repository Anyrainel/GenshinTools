import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type { DisplayResult, StatKey } from "@/lib/team-comp/types";
import { filterMatchesTag } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import React, { useMemo, useState } from "react";
import { fmtPercent, fmtStat } from "./displayFormatters";

import type { ArtifactData } from "@/data/types";
import { AVG_SUBSTAT_ROLL } from "@/lib/account-data/scoring/utils";
import type { OptFailReason } from "@/lib/team-comp/optimizer";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Flame,
  Snowflake,
} from "lucide-react";
import { ArtifactSlotGrid } from "./ArtifactSlotGrid";
import { detectEquippedSets, setsMatch } from "./teamOptUtils";

type HlKey = StatKey | "charLevel";
type HighlightedStat = { key: HlKey; charId: string } | null;

type ViewMode = "conditional" | "max" | "marginal";

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
  onArtifactSwap?: (
    charId: string,
    slot: import("@/data/types").Slot,
    artifact: ArtifactData
  ) => void;
  /** Callback to freeze a character's artifacts */
  onFreezeChar?: (charId: string) => void;
  /** Callback to unfreeze a character's artifacts */
  onUnfreezeChar?: (charId: string) => void;
  /** Characters detected as intrinsically saturated by the optimizer. */
  saturatedCharIds?: string[];
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

const REQUIRED_STATS: StatKey[] = ["atk", "hp", "def", "em", "cr", "cd", "er"];

const STAT_ORDER: StatKey[] = [
  ...REQUIRED_STATS,
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
  "baseDmg",
  "baseDmg%",
  "reactionBaseDmg%",
  "elevated%",
  "reactionDmg%",
  "reactionCr",
  "reactionCd",
  "defReduction%",
  "defIgnore%",
  "resReduction%",
];

function getSortedKeys(keys: Set<StatKey>): StatKey[] {
  const arr = Array.from(keys);
  arr.sort((a, b) => {
    let ia = STAT_ORDER.indexOf(a);
    let ib = STAT_ORDER.indexOf(b);
    if (ia === -1) ia = 999;
    if (ib === -1) ib = 999;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
  return arr;
}

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
        .replace("{0}", String(Math.round(reason.targetEr * 100)))
        .replace("{1}", String(Math.round(reason.bestEr * 100)));
    case "cr-unmet":
      return t
        .ui("teamComp.failCrUnmet")
        .replace("{0}", String(Math.round(reason.targetCr * 100)))
        .replace("{1}", String(Math.round(reason.bestCr * 100)));
    case "set-impossible": {
      const name = reason.setId
        ? t.artifact(reason.setId) || reason.setId
        : (reason.halfSetIds
            ?.map((id) => t.halfSetShort(id) || id)
            .join(" + ") ?? "?");
      return t.ui("teamComp.failSetImpossible").replace("{0}", name);
    }
    case "all-filtered":
      return t
        .ui("teamComp.failAllFiltered")
        .replace("{0}", String(reason.combinationsTotal));
  }
}

// ─── Max View Data Hook ───

function useMaxViewData(
  charId: string,
  result: DisplayResult | null | undefined
) {
  return useMemo(() => {
    if (!result?.statSheets?.[charId]) return null;

    const allTags = result.charFormulaTags?.[charId] ?? [];
    const { onField, offField } = result.statSheets[charId];

    const allKeys = new Set<StatKey>(REQUIRED_STATS);

    for (const { key } of onField.dump()) allKeys.add(key);
    for (const { key } of offField.dump()) allKeys.add(key);

    const rows: { key: StatKey; offValue: number; onValue: number }[] = [];
    for (const key of getSortedKeys(allKeys)) {
      if (key === "atk%" || key === "hp%" || key === "def%") continue;
      if (key === "baseAtk" || key === "baseHp" || key === "baseDef") continue;

      let maxOn: number;
      let maxOff: number;

      try {
        maxOn = onField.get(key);
        maxOff = offField.get(key);
      } catch {
        continue;
      }

      for (const tag of allTags) {
        try {
          maxOn = Math.max(maxOn, onField.get(key, tag));
          maxOff = Math.max(maxOff, offField.get(key, tag));
        } catch {
          // ignore keys that can't be queried with tag
        }
      }

      if (key === "atk" || key === "hp" || key === "def" || key === "em") {
        maxOn = Math.round(maxOn);
        maxOff = Math.round(maxOff);
      }

      if (maxOn !== 0 || maxOff !== 0 || REQUIRED_STATS.includes(key)) {
        rows.push({ key, offValue: maxOff, onValue: maxOn });
      }
    }

    return rows;
  }, [charId, result]);
}

// ─── Conditional View Data Hook ───

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
      for (const { key, filterKey, value } of sheet.dump()) {
        if (key === "atk%" || key === "hp%" || key === "def%") continue;
        if (key === "baseAtk" || key === "baseHp" || key === "baseDef")
          continue;

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

// ─── Main Component ───

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
  saturatedCharIds,
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

  const hasStatSheets = result?.statSheets != null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2 md:gap-3">
      {team.characters.map((charId, i) => {
        if (!charId) return <div key={i} />;

        const isTarget = charId === targetCharId;
        const char = charactersById[charId];
        const isFrozen = frozenCharIds?.has(charId) ?? false;
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
                "ring-1 ring-cyan-400/30 shadow-[0_0_12px_rgba(34,211,238,0.06)]"
            )}
          >
            {/* Header: avatar + name + freeze toggle */}
            <div className="flex items-center gap-2 p-2 bg-black/20 border-b border-border/10 w-full">
              <img
                src={getAssetUrl(char?.imagePath)}
                className="w-7 h-7 rounded-full bg-black/20 shrink-0"
                alt={charId}
              />
              <span
                className={cn(
                  "font-bold text-sm truncate",
                  isTarget ? "text-primary/90" : "text-foreground/70"
                )}
              >
                {t.character(charId)}
              </span>
              {result && !isTarget && marginalKeys.length === 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 text-xs font-bold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full cursor-help">
                      {t.ui("teamComp.saturated")}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64 text-xs">
                    <p>{t.ui("teamComp.saturatedTooltip")}</p>
                    {saturatedCharIds?.includes(charId) && (
                      <p className="mt-1.5 text-amber-400/80">
                        {t.ui("teamComp.saturatedIntrinsicHint")}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              <span className="flex-1" />

              {/* Freeze/unfreeze toggle */}
              {isFrozen && onUnfreezeChar ? (
                <button
                  type="button"
                  onClick={() => onUnfreezeChar(charId)}
                  className="flex items-center gap-1 h-6 px-2.5 rounded-md text-xs font-bold border border-red-400/40 bg-red-500/10 text-red-300 ring-1 ring-red-400/20 hover:bg-red-500/15 hover:text-red-200 hover:ring-red-400/40 transition-colors"
                >
                  <Flame className="w-3 h-3" />
                  {t.ui("teamComp.unfreezeChar")}
                </button>
              ) : onFreezeChar && result && hasArtifacts ? (
                <button
                  type="button"
                  onClick={() => onFreezeChar(charId)}
                  className="flex items-center gap-1 h-6 px-2.5 rounded-md text-xs font-bold border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20 hover:bg-cyan-500/15 hover:text-cyan-200 hover:ring-cyan-400/40 transition-colors"
                >
                  <Snowflake className="w-3 h-3" />
                  {t.ui("teamComp.freezeChar")}
                </button>
              ) : null}
            </div>

            {/* Artifacts Grid or Fail Reason — frozen overlay only here */}
            <div
              className={cn(
                "p-2 border-b border-border/10",
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
                  charId={charId}
                  artifactsObj={artifactsObj}
                  t={t}
                  onSwap={
                    onArtifactSwap && !isFrozen
                      ? (slot, art) => onArtifactSwap(charId, slot, art)
                      : undefined
                  }
                />
              )}
            </div>

            {/* Thin view-mode bar */}
            {result && (
              <div className="flex items-stretch gap-1 px-2 py-1.5 bg-black/10 border-b border-border/10">
                {(
                  [
                    {
                      mode: "conditional" as const,
                      label: "teamComp.conditional" as const,
                    },
                    { mode: "max" as const, label: "teamComp.max" as const },
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
                      "flex-1 flex items-center justify-center gap-0.5 text-[10px] xl:text-xs font-bold px-2.5 py-1 rounded-full transition-all leading-relaxed",
                      activeView === mode
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80 hover:bg-white/5"
                    )}
                  >
                    {t.ui(label)}
                    {activeView === mode ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Set Mismatch Warning */}
            {hasMismatch && activeView != null && (
              <div className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{t.ui("teamComp.equippedSetDiffers")}</span>
              </div>
            )}

            {/* View content */}
            {result && activeView === "max" && hasStatSheets && (
              <MaxView
                charId={charId}
                result={result}
                primary={primary}
                highlightedStat={highlightedStat}
                onStatHover={onStatHover}
                t={t}
              />
            )}
            {result && activeView === "conditional" && hasStatSheets && (
              <ConditionalView
                charId={charId}
                result={result}
                primary={primary}
                highlightedStat={highlightedStat}
                onStatHover={onStatHover}
                t={t}
              />
            )}
            {result && activeView === "conditional" && !hasStatSheets && (
              <LegacyStatView
                charId={charId}
                result={result}
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
              "flex flex-wrap items-center gap-[6px] px-1.5 py-1.5 rounded-sm hover:bg-white/5 transition-colors text-sm font-mono leading-none",
              isHl
                ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                : ""
            )}
          >
            <span className="text-xs font-bold bg-black/20 text-muted-foreground px-1 py-0.5 rounded border border-border/10 opacity-70">
              +1
            </span>
            <span
              className={cn(
                "font-bold text-base",
                isHl
                  ? "text-[color:hsl(var(--primary))] opacity-100"
                  : "text-primary"
              )}
            >
              {t.statShort(k)}
            </span>
            <span className="text-xs whitespace-nowrap">
              <span className="text-muted-foreground opacity-60">
                ({t.ui("teamComp.avgVal")}
              </span>
              <span className="font-bold text-foreground opacity-90">
                +{fmtStat(k, rollVal)}
              </span>
              <span className="text-muted-foreground opacity-60">)</span>
            </span>
            <span className="text-xs text-muted-foreground opacity-50 px-0.5">
              ➔
            </span>
            <span className="text-green-400 font-bold bg-green-500/10 px-1 py-0.5 rounded-sm text-sm">
              {fmtPercent(gain, true)}
            </span>
            <span className="text-foreground opacity-60">
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
              "flex flex-wrap items-center gap-[6px] px-1.5 py-1.5 rounded-sm hover:bg-white/5 transition-colors text-sm font-mono leading-none",
              lvHl
                ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                : ""
            )}
          >
            <span className="text-xs font-bold bg-black/20 text-muted-foreground px-1 py-0.5 rounded border border-border/10 opacity-70">
              Lv
            </span>
            <span
              className={cn(
                "font-bold text-base",
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
            <span className="text-xs text-muted-foreground opacity-50 px-0.5">
              ➔
            </span>
            <span className="text-green-400 font-bold bg-green-500/10 px-1 py-0.5 rounded-sm text-sm">
              {fmtPercent(levelUpGain.gain, true)}
            </span>
            <span className="text-foreground opacity-60">
              {t.ui("teamComp.gain")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Max View ───

function MaxView({
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
  const rows = useMaxViewData(charId, result);

  return (
    <div className="bg-black/20 pt-1 px-2 pb-2">
      <table className="w-full border-collapse text-xs xl:text-sm">
        <thead>
          <tr className="text-[10px] xl:text-xs font-bold text-muted-foreground uppercase tracking-wider opacity-70">
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
          {rows && rows.length > 0 ? (
            rows.map((row) => {
              const off = row.offValue || 0;
              const on = row.onValue || 0;
              if (off === 0 && on === 0 && !REQUIRED_STATS.includes(row.key))
                return null;
              const isHl = isKeyHighlighted(highlightedStat, charId, row.key);
              return (
                <tr
                  key={row.key}
                  onMouseEnter={() => onStatHover({ key: row.key, charId })}
                  onMouseLeave={() => onStatHover(null)}
                  onClick={() =>
                    onStatHover(isHl ? null : { key: row.key, charId })
                  }
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
                    {t.statShort(row.key)}
                  </td>
                  <td className={cn("py-1 px-1", valueCls(primary, "off"))}>
                    {fmtStat(row.key, off)}
                  </td>
                  <td className={cn("py-1 pl-1", valueCls(primary, "on"))}>
                    {fmtStat(row.key, on)}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={3}
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

// ─── Conditional View ───

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
      <table className="w-full border-collapse text-xs xl:text-sm">
        <thead>
          <tr className="text-[10px] xl:text-xs font-bold text-muted-foreground uppercase tracking-wider opacity-70">
            <th className="text-left font-bold py-1 pr-2 whitespace-nowrap">
              {t.ui("teamComp.stats")}
            </th>
            <th className="text-left font-bold py-1 px-1 tracking-tight w-full">
              {t.ui("teamComp.conditional")}
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
                  <td className="py-1 px-1 text-muted-foreground text-[10px] xl:text-xs tracking-tight">
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

// ─── Legacy View (fallback during migration) ───

function LegacyStatView({
  charId,
  result,
  highlightedStat,
  onStatHover,
  t,
}: {
  charId: string;
  result: DisplayResult;
  highlightedStat: HighlightedStat;
  onStatHover: (stat: HighlightedStat) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const idle = result.idleStats[charId] || {};
  const combat = result.combatStats[charId] || {};

  const allKeys = new Set([
    ...REQUIRED_STATS,
    ...(Object.keys(idle) as StatKey[]),
    ...(Object.keys(combat) as StatKey[]),
  ]);
  const sortedKeys = getSortedKeys(allKeys);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-x-2 gap-y-[1px] p-2 bg-black/20 pt-1">
      {sortedKeys.map((k) => {
        const cVal = (combat[k] as number) || 0;
        if (cVal === 0 && !REQUIRED_STATS.includes(k)) return null;
        return (
          <div
            key={k}
            onMouseEnter={() => onStatHover({ key: k, charId })}
            onMouseLeave={() => onStatHover(null)}
            onClick={() =>
              onStatHover(
                isKeyHighlighted(highlightedStat, charId, k)
                  ? null
                  : { key: k, charId }
              )
            }
            className={cn(
              "flex items-center justify-between px-1.5 py-1 rounded-sm hover:bg-white/5 transition-colors cursor-default text-xs",
              isKeyHighlighted(highlightedStat, charId, k)
                ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                : ""
            )}
          >
            <span className="flex-1 min-w-0 truncate pr-2 opacity-80">
              {t.statShort(k)}
            </span>
            <div className="shrink-0 text-right font-mono font-medium">
              {fmtStat(k, cVal)}
            </div>
          </div>
        );
      })}
      {sortedKeys.length === 0 && (
        <span className="text-xs text-muted-foreground opacity-50 px-1 py-4 italic text-center col-span-2">
          {t.ui("teamComp.noStatsResolved")}
        </span>
      )}
    </div>
  );
}
