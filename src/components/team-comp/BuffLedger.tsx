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
  filter: DamageTagFilter | undefined,
  t: ReturnType<typeof useLanguage>["t"]
): string | null {
  if (!filter || Object.keys(filter).length === 0) return null;
  const parts: string[] = [];
  if (filter.abilities?.length) {
    parts.push(...filter.abilities);
  }
  if (filter.elements?.length) {
    parts.push(...filter.elements.map((e) => t.element(e as Element)));
  }
  if (filter.reactions?.length) {
    parts.push(...filter.reactions); // reactions usually don't have i18n in quick filter yet
  }
  return parts.join("/");
}

function getSourceIcon(source: ResolvedBuff["source"]): string | undefined {
  if (source.type === "character") return charactersById[source.id]?.imagePath;
  if (source.type === "weapon") return weaponsById[source.id]?.imagePath;
  if (source.type === "artifactSet")
    return artifactsById[source.id as string]?.imagePaths?.flower;
  if (source.type === "artifactHalfSet")
    return artifactsById[
      artifactHalfSetsById[Number(source.id)]?.setIds[0] ?? ""
    ]?.imagePaths?.flower;
  if (source.type === "teamResonance") {
    if (source.id !== "unique" && source.id !== "gleam") {
      const el = source.id.charAt(0).toUpperCase() + source.id.slice(1);
      return elementResourcesByName[el as Element]?.imagePath;
    }
  }
  return undefined;
}

function BuffChip({
  buff,
  t,
}: {
  buff: ResolvedBuff;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const { source, target, staticEntries, dynamicEntries, active } = buff;
  const icon = getSourceIcon(source);
  const filterDesc = formatFilter(target.filter, t);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg border shadow-sm transition-all bg-card/50",
        active
          ? "border-border/40 hover:border-border/60"
          : "border-border/10 opacity-60 grayscale"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon ? (
            <div className="relative shrink-0">
              <img
                src={getAssetUrl(icon)}
                className="w-7 h-7 object-contain rounded-full bg-secondary/80 outline outline-1 outline-border/50"
                alt="source"
              />
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background",
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

          <div className="flex flex-col min-w-0 leading-tight gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-sm text-foreground/90 truncate">
                {source.type === "teamResonance"
                  ? t.ui(
                      `teamBuilder.resonance_${source.id}` as Parameters<
                        typeof t.ui
                      >[0]
                    ) || t.ui("teamBuilder.teamResonance")
                  : source.origin || t.ui("teamBuilder.base")}
              </span>
              {source.triggers?.map((trig) => (
                <span
                  key={trig}
                  className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider leading-none"
                >
                  {trig}
                </span>
              ))}
            </div>
            {filterDesc && (
              <span className="text-xs text-muted-foreground/70 italic truncate">
                [{filterDesc}]
              </span>
            )}
          </div>
        </div>

        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-black/10 px-1.5 py-0.5 rounded shrink-0">
          {target.receiver}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 pt-2 mt-0.5 border-t border-border/10">
        {[...staticEntries, ...dynamicEntries].map((e, idx) => {
          const isDyn = "cap" in e || "inputKey" in e;
          const dynE = e as ResolvedStatEntry;
          return (
            <div
              key={idx}
              className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm bg-black/5 px-2 py-1.5 rounded-md"
            >
              <span className="font-semibold text-foreground/80">
                {t.statShort(e.key as StatKey)}
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-mono font-bold text-[15px]",
                    e.value > 0
                      ? "text-green-500 dark:text-green-400"
                      : "text-red-500 dark:text-red-400"
                  )}
                >
                  {fmtStat(e.key as StatKey, e.value, true)}
                </span>
                {isDyn && dynE.cap !== undefined && (
                  <span className="font-mono font-bold text-xs text-orange-500 dark:text-orange-400 opacity-90">
                    / {fmtStat(e.key as StatKey, dynE.cap)}
                  </span>
                )}
              </div>

              {isDyn && dynE.inputKey && (
                <span className="flex items-center gap-0.5 text-muted-foreground bg-black/10 px-1.5 py-0.5 rounded text-[11px] font-medium ml-auto">
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
                  {t.statShort(dynE.inputKey)}
                </span>
              )}
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
      <CollapsibleTrigger className="flex justify-between items-center w-full px-4 py-3 hover:bg-white/5 transition-colors">
        <div className="text-sm font-bold flex items-center gap-2">
          {t.ui("teamBuilder.buffsLedger")}
          <span className="bg-black/20 font-mono px-2 py-0.5 rounded text-xs text-muted-foreground">
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
        <div className="p-4 border-t border-border/10 flex flex-col gap-6 bg-black/5">
          {/* Top Actions: Show All Toggles & Team Resonance Row */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              {resonanceBuffs.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-primary/50 rounded-full" />
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    {t.ui("teamBuilder.teamResonance")}
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
                  ? t.ui("teamBuilder.hideTrivial")
                  : t.ui("teamBuilder.showAllBuffs")}
              </button>
            </div>

            {resonanceBuffs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-black/10 p-3 rounded-xl border border-border/5">
                {resonanceBuffs.map((b, i) => (
                  <BuffChip key={i} buff={b} t={t} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
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
                <div key={charId} className="flex flex-col gap-3 min-w-0">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/10">
                    <img
                      src={getAssetUrl(charactersById[charId]?.imagePath)}
                      alt={charId}
                      className="w-6 h-6 object-contain rounded-full bg-secondary/50 outline outline-1 outline-border/30"
                    />
                    <span className="text-sm font-bold text-foreground truncate">
                      {t.character(charId)}
                    </span>
                    <span className="ml-auto text-[10px] font-black text-muted-foreground bg-black/10 px-1.5 py-0.5 rounded">
                      {charBuffs.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {charBuffs.map((b, i2) => (
                      <BuffChip key={i2} buff={b} t={t} />
                    ))}
                    {charBuffs.length === 0 && (
                      <div className="text-xs text-muted-foreground opacity-50 italic text-center py-6 rounded-lg border border-dashed border-border/10 flex items-center justify-center">
                        {t.ui("teamBuilder.noBuffsOriginate")}
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
