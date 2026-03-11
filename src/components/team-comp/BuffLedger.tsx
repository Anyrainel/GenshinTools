import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import { elementResourcesByName } from "@/data/constants";
import type { Element } from "@/data/types";
import { isTrivialBuff } from "@/lib/team-comp/inspection";
import type {
  BuffTarget,
  DamageTagFilter,
  ResolvedBuff,
  ResolvedStatEntry,
  StatKey,
} from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { fmtStat } from "./displayFormatters";

type Props = {
  buffs: ResolvedBuff[];
  team: Team;
  t: ReturnType<typeof useLanguage>["t"];
};

function formatFilter(
  target: BuffTarget,
  t: ReturnType<typeof useLanguage>["t"]
): string | null {
  const filter = target.filter;
  const parts: string[] = [];
  if (filter) {
    if (filter.abilities?.length) {
      parts.push(...filter.abilities.map((a) => t.ability(a)));
    }
    if (filter.elements?.length) {
      parts.push(...filter.elements.map((e) => t.element(e)));
    }
    if (filter.reactions?.length) {
      parts.push(...filter.reactions.map((r) => t.reaction(r)));
    }
  }
  if (target.regions?.length) {
    parts.push(...target.regions.map((r) => t.region(r)));
  }
  if (target.factions?.length) {
    parts.push(...target.factions.map((f) => t.faction(f)));
  }
  return parts.length > 0 ? parts.join("/") : null;
}

function getSourceIcon(source: ResolvedBuff["source"]): string | undefined {
  if (source.type === "character") return charactersById[source.id]?.imagePath;
  if (source.type === "weapon") return weaponsById[source.id]?.imagePath;
  if (source.type === "artifactSet")
    return artifactsById[source.id as string]?.imagePaths?.flower;
  if (source.type === "artifactHalfSet")
    return artifactsById[artifactHalfSetsById[source.id]?.setIds[0] ?? ""]
      ?.imagePaths?.flower;
  if (source.type === "teamResonance") {
    if (source.id !== "unique" && source.id !== "gleam") {
      const el = source.id.charAt(0).toUpperCase() + source.id.slice(1);
      return elementResourcesByName[el as Element]?.imagePath;
    }
  }
  return undefined;
}

const RECEIVER_I18N: Record<string, string> = {
  self: "teamComp.receiverSelf",
  selfOnField: "teamComp.receiverSelfOnField",
  selfOffField: "teamComp.receiverSelfOffField",
  otherOnField: "teamComp.receiverOtherOnField",
  onField: "teamComp.receiverOnField",
  team: "teamComp.receiverTeam",
};

function BuffChip({
  buff,
  t,
}: {
  buff: ResolvedBuff;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const { source, target, staticEntries, dynamicEntries, active } = buff;
  const icon = getSourceIcon(source);
  const filterDesc = formatFilter(target, t);

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border shadow-sm transition-all bg-card/50",
        "gap-1 p-1 md:gap-1.5 md:p-2",
        active
          ? "border-border/40 hover:border-border/60"
          : "border-border/10 opacity-60 grayscale"
      )}
    >
      <div className="flex items-start justify-between gap-1 md:gap-2">
        <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
          {icon ? (
            <div className="relative shrink-0">
              <img
                src={getAssetUrl(icon)}
                className="w-5 h-5 md:w-7 md:h-7 object-contain rounded-full bg-secondary/80 outline outline-1 outline-border/50"
                alt="source"
              />
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full border border-background",
                  active ? "bg-green-500" : "bg-muted-foreground"
                )}
              />
            </div>
          ) : (
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                active ? "bg-green-500" : "bg-muted-foreground"
              )}
            />
          )}

          <div className="flex flex-col min-w-0 leading-tight gap-0.5 md:gap-1">
            <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
              <span className="font-bold text-xs md:text-sm text-foreground/90 truncate">
                {source.type === "teamResonance"
                  ? t.resonance(source.id) || t.ui("teamComp.teamResonance")
                  : source.origin || t.ui("teamComp.base")}
              </span>
              {source.triggers?.map((trig) => (
                <span
                  key={trig}
                  className="bg-primary/10 text-primary text-xs px-1 md:px-1.5 py-0.5 rounded font-black uppercase tracking-wider leading-none"
                >
                  {trig}
                </span>
              ))}
            </div>
          </div>
        </div>

        <span
          className={cn(
            "text-xs md:text-sm font-bold uppercase tracking-widest px-1 md:px-1.5 py-0.5 rounded shrink-0",
            target.charId
              ? "text-sky-300 bg-sky-500/15"
              : target.receiver === "team"
                ? "text-rose-300 bg-rose-500/15"
                : target.receiver === "onField"
                  ? "text-orange-300 bg-orange-500/15"
                  : target.receiver === "otherOnField"
                    ? "text-yellow-300 bg-yellow-500/15"
                    : target.receiver === "self"
                      ? "text-zinc-400 bg-zinc-500/15"
                      : target.receiver === "selfOnField"
                        ? "text-slate-400 bg-slate-500/10"
                        : target.receiver === "selfOffField"
                          ? "text-stone-400 bg-stone-500/10"
                          : "text-muted-foreground bg-black/10"
          )}
        >
          {target.charId
            ? t.character(target.charId)
            : t.ui(RECEIVER_I18N[target.receiver] ?? "teamComp.receiverSelf")}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 md:gap-1 pt-0.5 md:pt-1 mt-0.5 border-t border-border/10">
        {filterDesc && (
          <span className="text-[10px] md:text-xs text-foreground italic truncate">
            [{filterDesc}]
          </span>
        )}
        {[...staticEntries, ...dynamicEntries].map((e, idx) => {
          const isDyn = "cap" in e || "inputKey" in e;
          const dynE = e as ResolvedStatEntry;
          return (
            <div
              key={idx}
              className="flex items-center flex-wrap gap-x-1.5 md:gap-x-2 gap-y-0.5 md:gap-y-1 text-xs md:text-sm bg-black/5 px-1.5 md:px-2 py-1 md:py-1.5 rounded-md"
            >
              <span className="font-semibold text-foreground/80">
                {t.statShort(e.key as StatKey)}
              </span>
              {isDyn && dynE.inputKey && (
                <span className="flex items-center gap-0.5 text-muted-foreground text-[10px] md:text-[11px] font-medium">
                  <ArrowUpRight className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-70" />
                  {t.statShort(dynE.inputKey)}
                </span>
              )}
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-mono font-bold text-xs md:text-base",
                    e.value > 0
                      ? "text-green-500 dark:text-green-400"
                      : "text-red-500 dark:text-red-400"
                  )}
                >
                  {fmtStat(e.key as StatKey, e.value, true)}
                </span>
                {isDyn && dynE.cap !== undefined && (
                  <span className="font-mono font-bold text-[10px] md:text-xs text-orange-500 dark:text-orange-400 opacity-90">
                    / {fmtStat(e.key as StatKey, dynE.cap)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BuffLedger({ buffs, team, t }: Props) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const activeCount = buffs.filter((b) => b.active).length;
  const visibleBuffs = buffs.filter(
    (b) => showAll || (b.active && !isTrivialBuff(b))
  );

  const resonanceBuffs = visibleBuffs.filter((b) => !b.providerCharId);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="bg-black/15 border border-border/20 rounded-lg overflow-hidden"
    >
      <CollapsibleTrigger className="flex justify-between items-center w-full px-2 py-2 md:px-4 md:py-3 hover:bg-white/5 transition-colors">
        <div className="text-xs md:text-sm font-bold flex items-center gap-1.5 md:gap-2">
          {t.ui("teamComp.buffsLedger")}
          <span className="bg-black/20 font-mono px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs text-muted-foreground">
            {activeCount} / {buffs.length}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-1 md:p-2 border-t border-border/10 flex flex-col gap-2 md:gap-3 bg-black/5">
          {/* Top Actions: Show All Toggles & Team Resonance Row */}
          <div className="flex flex-col gap-2 md:gap-4">
            <div className="flex justify-between items-center">
              {resonanceBuffs.length > 0 ? (
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="w-1.5 h-4 bg-primary/50 rounded-full" />
                  <span className="text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    {t.ui("teamComp.teamResonance")}
                  </span>
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                {showAll
                  ? t.ui("teamComp.hideTrivial")
                  : t.ui("teamComp.showAllBuffs")}
              </button>
            </div>

            {resonanceBuffs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-1.5 md:gap-3 bg-black/10 p-1.5 md:p-3 rounded-xl border border-border/5">
                {resonanceBuffs.map((b, i) => (
                  <BuffChip key={i} buff={b} t={t} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 md:gap-4 xl:gap-6">
            {team.characters.map((charId, i) => {
              if (!charId)
                return (
                  <div
                    key={i}
                    className="hidden xl:block border border-dashed border-border/10 rounded-xl bg-black/5"
                  />
                );
              const charBuffs = visibleBuffs.filter(
                (b) => b.providerCharId === charId
              );

              return (
                <div
                  key={charId}
                  className="flex flex-col gap-1.5 md:gap-3 min-w-0"
                >
                  <div className="flex items-center gap-1.5 md:gap-2 pb-1 md:pb-2 border-b border-border/10">
                    <img
                      src={getAssetUrl(charactersById[charId]?.imagePath)}
                      alt={charId}
                      className="w-5 h-5 md:w-6 md:h-6 object-contain rounded-full bg-secondary/50 outline outline-1 outline-border/30"
                    />
                    <span className="text-xs md:text-sm font-bold text-foreground truncate">
                      {t.character(charId)}
                    </span>
                    <span className="ml-auto text-xs font-black text-muted-foreground bg-black/10 px-1 md:px-1.5 py-0.5 rounded">
                      {charBuffs.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 md:gap-2">
                    {charBuffs.map((b, i2) => (
                      <BuffChip key={i2} buff={b} t={t} />
                    ))}
                    {charBuffs.length === 0 && (
                      <div className="text-xs text-muted-foreground opacity-50 italic text-center py-6 rounded-lg border border-dashed border-border/10 flex items-center justify-center">
                        {t.ui("teamComp.noBuffsOriginate")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
