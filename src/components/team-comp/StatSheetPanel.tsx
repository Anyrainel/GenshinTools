import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type { DisplayResult, StatKey } from "@/lib/team-comp/types";
import { filterMatchesTag } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import React, { useMemo, useState } from "react";
import { fmtPercent, fmtStat } from "./displayFormatters";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ArtifactData } from "@/data/types";
import { AVG_SUBSTAT_ROLL } from "@/lib/team-comp/inspection";
import type { OptFailReason } from "@/lib/team-comp/optimizer";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { ArtifactSlotGrid } from "./ArtifactSlotGrid";
import { detectEquippedSets, setsMatch } from "./teamOptUtils";

type HlKey = StatKey | "charLevel";
type HighlightedStat = { key: HlKey; charId: string } | null;

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
  isFrozen?: boolean;
  /** When provided, artifact icons become clickable to open a swap dialog */
  onArtifactSwap?: (
    charId: string,
    slot: import("@/data/types").Slot,
    artifact: ArtifactData
  ) => void;
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
 * - isTarget (calc target): on-field is primary
 * - teammate: off-field is primary (they're usually off-field)
 * - no target (combo overview, targetCharId=""): both equal, no muting
 * Returns: "on" | "off" | "both" — which column(s) to highlight.
 */
function getPrimaryColumn(
  charId: string,
  targetCharId: string,
  comboActiveCharIds?: Set<string>
): "on" | "off" | "both" {
  // Combo mode: on-field for chars with active lines, off-field for others
  if (comboActiveCharIds) {
    return comboActiveCharIds.has(charId) ? "on" : "off";
  }
  // Single mode
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

    // Collect keys from both sheets
    for (const { key } of onField.dump()) allKeys.add(key);
    for (const { key } of offField.dump()) allKeys.add(key);

    const rows: { key: StatKey; offValue: number; onValue: number }[] = [];
    for (const key of getSortedKeys(allKeys)) {
      // Skip intermediate % keys for scaled stats
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

    // Collect all (key, filterKey) pairs from both sheets
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

    // Sort by stat order, then universal first, then by condition
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
  isFrozen,
  onArtifactSwap,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"max" | "conditional">("max");

  // Check if new stat sheets are available (migration: fall back to old view)
  const hasStatSheets = result?.statSheets != null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2 md:gap-3">
      {team.characters.map((charId, i) => {
        if (!charId) return <div key={i} />;

        const isTarget = charId === targetCharId;
        const char = charactersById[charId];
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
        const levelUpGain = result?.levelUpGains[charId];

        const artifactsObj = artifactsByChar[charId] || {};
        const hasArtifacts = Object.values(artifactsObj).some(Boolean);
        const goalConfig = team.artifacts[i];
        const equippedSets = detectEquippedSets(Object.values(artifactsObj));
        const hasMismatch =
          hasArtifacts && goalConfig && !setsMatch(goalConfig, equippedSets);

        return (
          <Collapsible
            key={charId}
            open={isExpanded}
            onOpenChange={setIsExpanded}
            className={cn(
              "flex flex-col bg-black/15 border rounded-lg overflow-hidden group/card",
              isTarget
                ? "border-primary/40 shadow-inner"
                : "border-border/10 text-foreground/80"
            )}
          >
            {/* Context Header */}
            <CollapsibleTrigger className="flex items-center gap-2 p-2 bg-black/20 border-b border-border/10 w-full hover:bg-white/5 transition-colors group">
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

              {result && (
                <div className="flex items-center gap-2 group-hover:text-foreground transition-all">
                  {/* View mode toggle */}
                  {/* biome-ignore lint/a11y/useSemanticElements: cannot nest button inside button */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewMode((m) => (m === "max" ? "conditional" : "max"));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        setViewMode((m) =>
                          m === "max" ? "conditional" : "max"
                        );
                      }
                    }}
                    className="flex items-center gap-0.5 bg-black/40 border border-border/10 rounded-full p-1 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "text-xs font-bold px-3 py-0.5 rounded-full transition-all leading-relaxed",
                        viewMode === "conditional"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground opacity-60 hover:opacity-100"
                      )}
                    >
                      {t.ui("teamComp.conditional")}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold px-3 py-0.5 rounded-full transition-all leading-relaxed",
                        viewMode === "max"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground opacity-60 hover:opacity-100"
                      )}
                    >
                      {t.ui("teamComp.max")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground/70 ml-2">
                    <span className="hidden sm:inline-block">
                      {t.ui("teamComp.stats")}
                    </span>
                    <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                  </div>
                </div>
              )}
            </CollapsibleTrigger>

            {/* Content area — frozen overlay applied here */}
            <div className={cn(isFrozen && "frozen-card")}>
              {/* Artifacts Grid or Fail Reason */}
              <div className="p-2 border-b border-border/10">
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
                      onArtifactSwap
                        ? (slot, art) => onArtifactSwap(charId, slot, art)
                        : undefined
                    }
                  />
                )}
              </div>

              {/* Collapsible Stats */}
              {result && (
                <CollapsibleContent>
                  {/* Set Mismatch Warning */}
                  {hasMismatch && (
                    <div className="flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{t.ui("teamComp.equippedSetDiffers")}</span>
                    </div>
                  )}

                  {hasStatSheets && viewMode === "max" ? (
                    <MaxView
                      charId={charId}
                      result={result}
                      primary={primary}
                      highlightedStat={highlightedStat}
                      onStatHover={onStatHover}
                      t={t}
                    />
                  ) : hasStatSheets && viewMode === "conditional" ? (
                    <ConditionalView
                      charId={charId}
                      result={result}
                      primary={primary}
                      highlightedStat={highlightedStat}
                      onStatHover={onStatHover}
                      t={t}
                    />
                  ) : (
                    <LegacyStatView
                      charId={charId}
                      result={result}
                      highlightedStat={highlightedStat}
                      onStatHover={onStatHover}
                      t={t}
                    />
                  )}

                  {/* Marginal Gains Section */}
                  {(marginalKeys.length > 0 || levelUpGain != null) && (
                    <div className="flex flex-col space-y-[1px] p-2 bg-black/20 pt-1 border-t border-border/10">
                      <div className="text-xs font-bold text-muted-foreground uppercase opacity-80 mb-1 tracking-widest px-1.5">
                        {t.ui("teamComp.marginalGains")}
                      </div>
                      {marginalKeys.map((k) => {
                        const rollVal = AVG_SUBSTAT_ROLL[k] || 0;
                        const gain = marginal[k] as number;
                        // Map percent keys to their base stat for cross-highlighting
                        // with the stats table (e.g. "atk%" → "atk")
                        const hlKey: StatKey =
                          k === "atk%"
                            ? "atk"
                            : k === "hp%"
                              ? "hp"
                              : k === "def%"
                                ? "def"
                                : k;
                        const isHl =
                          highlightedStat?.charId === charId &&
                          highlightedStat?.key === hlKey;
                        return (
                          <div
                            key={k}
                            onMouseEnter={() =>
                              onStatHover({ key: hlKey, charId })
                            }
                            onMouseLeave={() => onStatHover(null)}
                            onClick={() =>
                              onStatHover(isHl ? null : { key: hlKey, charId })
                            }
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
                              <span className="text-muted-foreground opacity-60">
                                )
                              </span>
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
                      {levelUpGain != null &&
                        (() => {
                          const lvHl =
                            highlightedStat?.charId === charId &&
                            highlightedStat?.key === "charLevel";
                          return (
                            <div
                              onMouseEnter={() =>
                                onStatHover({ key: "charLevel", charId })
                              }
                              onMouseLeave={() => onStatHover(null)}
                              onClick={() =>
                                onStatHover(
                                  lvHl ? null : { key: "charLevel", charId }
                                )
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
                        })()}
                    </div>
                  )}
                </CollapsibleContent>
              )}
            </div>
          </Collapsible>
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
            <th className="text-left font-bold py-1 pr-2">
              {t.ui("teamComp.stats")}
            </th>
            <th className="text-right font-bold py-1 px-1">
              {t.ui("teamComp.offField")}
            </th>
            <th className="text-right font-bold py-1 pl-1">
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
                      "py-1 pr-2 opacity-80",
                      isHl && "text-[color:hsl(var(--primary))] opacity-100"
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
            <th className="text-left font-bold py-1 pr-2">
              {t.ui("teamComp.stats")}
            </th>
            <th className="text-left font-bold py-1 px-1 tracking-tight">
              {t.ui("teamComp.conditional")}
            </th>
            <th className="text-right font-bold py-1 px-1">
              {t.ui("teamComp.offField")}
            </th>
            <th className="text-right font-bold py-1 pl-1">
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
                      "py-1 pr-2 opacity-80",
                      !showKey && "opacity-0",
                      isHl && "text-[color:hsl(var(--primary))] opacity-100"
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
