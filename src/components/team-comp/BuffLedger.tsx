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
        "flex flex-col gap-1.5 p-2 rounded-md border bg-black/5 text-xs leading-tight transition-all",
        active ? "border-border/30" : "border-border/10 opacity-60 grayscale"
      )}
    >
      <div className="flex justify-between items-center border-b border-border/10 pb-1.5">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              active ? "bg-green-400" : "bg-muted-foreground"
            )}
          />
          {icon && (
            <img
              src={getAssetUrl(icon)}
              className="w-4 h-4 rounded-full bg-secondary"
              alt="source"
            />
          )}
          <span className="font-bold bg-primary/20 text-xs text-primary px-1.5 py-0.5 rounded-[3px] tracking-wide">
            {source.origin || "Base"}
          </span>
          {source.triggers?.map((trig) => (
            <span
              key={trig}
              className="bg-black/20 text-xs px-1.5 py-0.5 rounded-[3px] border border-border/10 text-muted-foreground opacity-90"
            >
              {trig}
            </span>
          ))}
        </div>
        <span className="text-muted-foreground uppercase tracking-widest text-[10px] whitespace-nowrap overflow-hidden text-ellipsis ml-2 shrink-0">
          {target.receiver}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 px-0.5">
        {[...staticEntries, ...dynamicEntries].map((e, idx) => {
          const isDyn = "cap" in e || "inputKey" in e;
          const dynE = e as ResolvedStatEntry;
          return (
            <div key={idx} className="flex flex-col">
              {filterDesc && (
                <span className="text-[10px] text-muted-foreground italic mb-0.5 opacity-80">
                  [{filterDesc}]
                </span>
              )}
              <div className="flex items-center flex-wrap gap-x-1.5">
                <span className="font-bold text-foreground/90">
                  {t.statShort(e.key as StatKey)}
                </span>
                <span
                  className={cn(
                    "font-mono font-medium",
                    e.value > 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {fmtStat(e.key as StatKey, e.value, true)}
                </span>
                {isDyn && dynE.inputKey && (
                  <span className="flex items-center gap-0.5 text-muted-foreground ml-1 bg-black/10 px-1 py-0.5 rounded-sm text-xs">
                    <ArrowUpRight className="w-3 h-3 opacity-70" />
                    {t.statShort(dynE.inputKey)}
                  </span>
                )}
                {isDyn && dynE.cap !== undefined && (
                  <span className="text-muted-foreground opacity-80 text-xs ml-auto">
                    Max {fmtStat(e.key as StatKey, dynE.cap)}
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
      <CollapsibleTrigger className="flex justify-between items-center w-full px-4 py-2 hover:bg-white/5 transition-colors">
        <div className="text-xs font-bold flex items-center gap-2">
          Buffs & Effects Ledger
          <span className="bg-black/20 font-mono px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
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
        <div className="p-3 border-t border-border/10 flex flex-col gap-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              {showAll ? "Hide trivial/inactive" : "Show all buffs"}
            </button>
          </div>

          {resonanceBuffs.length > 0 && (
            <div className="flex flex-col gap-2 p-2.5 rounded-md border border-border/10 bg-black/10">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Team Resonance
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                {resonanceBuffs.map((b, i) => (
                  <BuffChip key={i} buff={b} t={t} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {team.characters.map((charId, i) => {
              if (!charId) return <div key={i} />;
              const charBuffs = visibleBuffs.filter(
                (b) => b.providerCharId === charId
              );

              return (
                <div
                  key={charId}
                  className="flex flex-col gap-2 relative border border-border/10 rounded-md p-3 pt-5"
                >
                  <div className="absolute -top-2.5 left-3 bg-black text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">
                    {t.character(charId)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2">
                    {charBuffs.map((b, i2) => (
                      <div key={i2} className="w-full">
                        <BuffChip buff={b} t={t} />
                      </div>
                    ))}
                  </div>
                  {charBuffs.length === 0 && (
                    <span className="text-xs text-muted-foreground opacity-50 italic text-center py-4 rounded-md">
                      No buffs originating
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
