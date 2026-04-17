import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import {
  formatFilter,
  formatReceiverLabel,
  getReceiverBadgeClasses,
  getSourceIcon,
  getSourceName,
} from "@/lib/team-comp/buffDisplayUtils";
import { fmtStat } from "@/lib/team-comp/displayFormatter";
import type {
  ResolvedBuff,
  ResolvedStatEntry,
  StatKey,
} from "@/lib/team-comp/types";
import { VALUE_COLORS, cn, getAssetUrl, getValueColor } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { BuffDialog, type BuffLedgerFormula } from "./BuffDialog";

type Props = {
  buffs: ResolvedBuff[];
  team: Team;
  t: ReturnType<typeof useLanguage>["t"];
  formulas?: BuffLedgerFormula[];
};

function BuffChip({
  buff,
  t,
  formulas,
}: {
  buff: ResolvedBuff;
  t: ReturnType<typeof useLanguage>["t"];
  formulas?: BuffLedgerFormula[];
}) {
  const { source, target, staticEntries, dynamicEntries, active } = buff;
  const icon = getSourceIcon(source);
  const filterDesc = formatFilter(target, t);

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card/50",
        "gap-1 p-1 lg:p-2",
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
                {source.type === "extra"
                  ? getSourceName(source, t)
                  : source.type === "teamResonance"
                    ? t.resonance(source.id) || t.ui("teamComp.teamResonance")
                    : source.origin
                      ? t.origin(source.origin)
                      : t.ui("teamComp.base")}
              </span>
              {source.triggers?.map((trig) => (
                <span
                  key={trig}
                  className="bg-primary/10 text-primary text-xs p-1 rounded font-medium tracking-tight leading-none"
                >
                  {trig}
                </span>
              ))}
            </div>
          </div>
        </div>

        <span
          className={cn(
            "text-[10px] lg:text-xs font-bold uppercase px-1 md:px-1.5 py-0.5 rounded shrink-0",
            getReceiverBadgeClasses(target)
          )}
        >
          {formatReceiverLabel(target, t)}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 md:gap-1 pt-1">
        {filterDesc && (
          <span className="text-[10px] md:text-xs text-foreground italic pl-1">
            [{filterDesc}]
          </span>
        )}
        {[...staticEntries, ...dynamicEntries].map((e, idx, arr) => {
          const isDyn = "cap" in e || "inputKey" in e;
          const dynE = e as ResolvedStatEntry;
          const isLast = idx === arr.length - 1;
          return (
            <div
              key={idx}
              className="flex items-center flex-wrap gap-x-1 lg:gap-x-2 text-xs md:text-sm bg-black/5 pl-1"
            >
              {buff.bespokeLabel && (
                <span className="bg-violet-500/15 text-violet-300 text-[10px] md:text-xs px-1 rounded font-medium leading-none">
                  {t.resolveLabel(buff.bespokeLabel)}
                </span>
              )}
              <span className="font-semibold text-foreground/80">
                {t.statShort(e.key as StatKey)}
              </span>
              {isDyn && dynE.inputKey && (
                <span className="flex items-center text-muted-foreground text-[10px] lg:text-xs font-medium">
                  <ArrowUpRight className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-70" />
                  {t.statShort(dynE.inputKey)}
                </span>
              )}
              <div className="flex items-baseline gap-1">
                {isDyn &&
                dynE.minValue !== undefined &&
                dynE.maxValue !== undefined ? (
                  <span
                    className={cn(
                      "font-mono font-bold text-xs md:text-sm",
                      getValueColor(dynE.minValue)
                    )}
                  >
                    {fmtStat(e.key as StatKey, dynE.minValue, true)}~
                    {fmtStat(e.key as StatKey, dynE.maxValue, true)}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "font-mono font-bold text-xs md:text-sm",
                      getValueColor(e.value)
                    )}
                  >
                    {fmtStat(e.key as StatKey, e.value, true)}
                  </span>
                )}
                {isDyn && dynE.cap !== undefined && (
                  <span
                    className={cn(
                      "font-mono font-bold text-[10px] lg:text-xs opacity-90",
                      VALUE_COLORS.cap
                    )}
                  >
                    /{fmtStat(e.key as StatKey, dynE.cap)}
                  </span>
                )}
              </div>
              {isLast && (
                <span className="ml-auto flex items-center gap-1">
                  {source.maxStacks != null && (
                    <span className="text-[11px] lg:text-xs font-medium text-teal-400 bg-teal-500/15 px-1.5 py-0.5 rounded">
                      {buff.bespokeLabel
                        ? t.format("teamComp.nTimes", 1)
                        : t.format("teamComp.nStacks", source.maxStacks)}
                    </span>
                  )}
                  {active &&
                    !buff.bespokeLabel &&
                    formulas &&
                    formulas.length > 0 && (
                      <BuffDialog buff={buff} formulas={formulas} t={t} />
                    )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BuffLedger({ buffs, team, t, formulas }: Props) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const activeCount = buffs.filter((b) => b.active).length;
  const visibleBuffs = buffs.filter((b) => showAll || b.active);

  const resonanceBuffs = visibleBuffs.filter(
    (b) => !b.providerCharId || b.source.type === "extra"
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="bg-black/15 border border-border/20 rounded-lg overflow-hidden"
    >
      {/* biome-ignore lint/a11y/useSemanticElements: div needed because nested Switch prevents using button */}
      <div
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
        className="flex items-center w-full px-2 py-2 md:px-4 md:py-3 hover:bg-white/5 transition-colors cursor-pointer select-none"
      >
        <div className="flex flex-1 items-center gap-1.5 md:gap-2">
          <span className="text-xs md:text-sm font-bold">
            {t.ui("teamComp.buffsLedger")}
          </span>
          <span className="bg-black/20 font-mono px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs text-muted-foreground">
            {activeCount} / {buffs.length}
          </span>
          <div
            className="flex items-center gap-1.5 cursor-pointer select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={showAll}
              onCheckedChange={setShowAll}
              className="h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
            />
            <span
              className="text-[10px] md:text-xs text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {t.ui("teamComp.showAllBuffs")}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-muted-foreground", open && "rotate-180")}
        />
      </div>

      <CollapsibleContent>
        <div className="p-1 md:p-2 border-t border-border/10 flex flex-col gap-1 lg:gap-2 bg-black/5">
          {resonanceBuffs.length > 0 && (
            <div className="flex flex-col gap-1 lg:gap-2">
              <div className="flex items-center gap-1.5 md:gap-2 border-b border-border/10">
                <div className="w-1.5 h-4 bg-primary/50 rounded-full" />
                <span className="text-xs md:text-sm font-bold text-foreground uppercase tracking-widest">
                  {t.ui("teamComp.teamResonance")}
                </span>
                <span className="text-xs font-black text-muted-foreground bg-black/10 px-1 md:px-1.5 py-0.5 rounded">
                  {resonanceBuffs.filter((b) => b.active).length}/
                  {
                    buffs.filter(
                      (b) => !b.providerCharId || b.source.type === "extra"
                    ).length
                  }
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-2">
                {resonanceBuffs.map((b, i) => (
                  <BuffChip key={i} buff={b} t={t} formulas={formulas} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-2">
            {team.characters.map((charId, i) => {
              if (!charId)
                return (
                  <div
                    key={i}
                    className="hidden lg:block border border-dashed border-border/10 rounded-xl bg-black/5"
                  />
                );
              const charBuffs = visibleBuffs.filter(
                (b) => b.providerCharId === charId
              );

              return (
                <div
                  key={charId}
                  className="flex flex-col gap-1 lg:gap-2 min-w-0"
                >
                  <div className="flex items-center gap-1.5 md:gap-2 border-b border-border/10">
                    <img
                      src={getAssetUrl(charactersById[charId]?.imagePath)}
                      alt={charId}
                      className="w-5 h-5 md:w-6 md:h-6 object-contain rounded-full bg-secondary/50 outline outline-1 outline-border/30"
                    />
                    <span className="text-xs md:text-sm font-bold text-foreground truncate">
                      {t.character(charId)}
                    </span>
                    <span className="text-xs font-black text-muted-foreground bg-black/10 px-1 md:px-1.5 py-0.5 rounded">
                      {charBuffs.filter((b) => b.active).length}/
                      {buffs.filter((b) => b.providerCharId === charId).length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 lg:gap-1.5">
                    {charBuffs.map((b, i2) => (
                      <BuffChip key={i2} buff={b} t={t} formulas={formulas} />
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
