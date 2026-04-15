/**
 * Shared display helpers for buff cards used by BuffLedger and PartBuffDialog.
 */

import type { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  elementResourcesByName,
  weaponsById,
} from "@/data/constants";
import { envBuffsById } from "@/data/envBuffs";
import type { Element } from "@/data/types";
import { fmtStat } from "@/lib/team-comp/displayFormatters";
import type { BuffTarget, ResolvedBuff, StatKey } from "@/lib/team-comp/types";
import { VALUE_COLORS, cn, getReceiverColor, getValueColor } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

type T = ReturnType<typeof useLanguage>["t"];

// ─── Source icon ─────────────────────────────────────────────────────────────

export function getSourceIcon(
  source: ResolvedBuff["source"]
): string | undefined {
  if (source.type === "character") return charactersById[source.id]?.imagePath;
  if (source.type === "weapon") return weaponsById[source.id]?.imagePath;
  if (source.type === "artifactSet")
    return artifactsById[source.id as string]?.imagePaths?.flower;
  if (source.type === "artifactHalfSet")
    return artifactsById[artifactHalfSetsById[source.id]?.setIds[0] ?? ""]
      ?.imagePaths?.flower;
  if (source.type === "teamResonance") {
    if (source.element) {
      return elementResourcesByName[source.element]?.imagePath;
    }
    if (source.id !== "unique" && source.id !== "gleam") {
      const el = source.id.charAt(0).toUpperCase() + source.id.slice(1);
      return elementResourcesByName[el as Element]?.imagePath;
    }
  }
  if (source.type === "extra") {
    return envBuffsById[source.id]?.imagePath;
  }
  return undefined;
}

// ─── Source name ─────────────────────────────────────────────────────────────

export function getSourceName(source: ResolvedBuff["source"], t: T): string {
  switch (source.type) {
    case "character":
      return t.character(source.id);
    case "weapon":
      return t.weapon(source.id);
    case "artifactSet":
      return t.artifact(source.id);
    case "artifactHalfSet": {
      const setId = artifactHalfSetsById[source.id]?.setIds[0];
      return setId ? t.artifact(setId) : source.id;
    }
    case "teamResonance":
      return t.resonance(source.id) || t.ui("teamComp.teamResonance");
    case "extra":
      return t.envBuff(source.id);
    default:
      return source.id;
  }
}

// ─── Receiver label & badge ──────────────────────────────────────────────────

const RECEIVER_I18N: Record<string, string> = {
  self: "teamComp.receiverSelf",
  selfOnField: "teamComp.receiverSelfOnField",
  selfOffField: "teamComp.receiverSelfOffField",
  other: "teamComp.receiverOther",
  otherOnField: "teamComp.receiverOtherOnField",
  otherOffField: "teamComp.receiverOtherOffField",
  teamOnField: "teamComp.receiverTeamOnField",
  teamOffField: "teamComp.receiverTeamOffField",
  team: "teamComp.receiverTeam",
};

export function formatReceiverLabel(target: BuffTarget, t: T): string {
  if (target.charId) {
    const name = t.character(target.charId);
    const r = target.receiver;
    if (r === "teamOnField" || r === "otherOnField")
      return `${name}${t.ui("teamComp.receiverCharOnField")}`;
    if (r === "teamOffField" || r === "otherOffField")
      return `${name}${t.ui("teamComp.receiverCharOffField")}`;
    return name;
  }
  return t.ui(RECEIVER_I18N[target.receiver] ?? "teamComp.receiverSelf");
}

export function getReceiverBadgeClasses(target: BuffTarget): string {
  return getReceiverColor(target.receiver, !!target.charId);
}

// ─── Filter description ──────────────────────────────────────────────────────

export function formatFilter(target: BuffTarget, t: T): string | null {
  const filter = target.filter;
  const groups: string[] = [];
  if (filter) {
    if (filter.abilities?.length)
      groups.push(filter.abilities.map((a) => t.ability(a)).join("/"));
    if (filter.elements?.length)
      groups.push(filter.elements.map((e) => t.element(e)).join("/"));
    if (filter.reactions?.length)
      groups.push(filter.reactions.map((r) => t.reaction(r)).join("/"));
  }
  if (target.regions?.length)
    groups.push(target.regions.map((r) => t.region(r)).join("/"));
  if (target.factions?.length)
    groups.push(target.factions.map((f) => t.faction(f)).join("/"));
  return groups.length > 0 ? groups.join("|") : null;
}

// ─── Stat entry row ──────────────────────────────────────────────────────────

export type StatEntryData = {
  key: string;
  value: number;
  inputKey?: StatKey;
  cap?: number;
  /** When present, value varies across on-field contexts (combo mode). */
  minValue?: number;
  maxValue?: number;
};

/**
 * Renders a single stat entry: stat name, optional inputKey arrow, value, and
 * optional cap.  Accepts className for size overrides (default: text-xs).
 */
export function StatEntryRow({
  entry,
  t,
  className,
}: {
  entry: StatEntryData;
  t: T;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs bg-black/5 px-1 rounded",
        className
      )}
    >
      <span className="font-semibold text-foreground/80">
        {t.statShort(entry.key as StatKey)}
      </span>
      {entry.inputKey && (
        <span className="flex items-center text-muted-foreground text-[10px]">
          <ArrowUpRight className="w-3 h-3 opacity-70" />
          {t.statShort(entry.inputKey)}
        </span>
      )}
      {entry.minValue !== undefined && entry.maxValue !== undefined ? (
        <span
          className={cn("font-mono font-bold", getValueColor(entry.minValue))}
        >
          {fmtStat(entry.key as StatKey, entry.minValue, true)}~
          {fmtStat(entry.key as StatKey, entry.maxValue, true)}
        </span>
      ) : (
        <span className={cn("font-mono font-bold", getValueColor(entry.value))}>
          {fmtStat(entry.key as StatKey, entry.value, true)}
        </span>
      )}
      {entry.cap !== undefined && (
        <span
          className={cn("font-mono font-bold text-[10px]", VALUE_COLORS.cap)}
        >
          / {fmtStat(entry.key as StatKey, entry.cap)}
        </span>
      )}
    </div>
  );
}
