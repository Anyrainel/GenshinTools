import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { DisplayResult, StatKey } from "@/lib/team-comp/types";
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
import { AlertTriangle, ChevronDown } from "lucide-react";
import { ArtifactSlotGrid } from "./ArtifactSlotGrid";
import { detectEquippedSets, setsMatch } from "./teamOptUtils";

type Props = {
  result?: DisplayResult | null;
  team: Team;
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  targetCharId: string;
  highlightedStat: { key: StatKey; charId: string } | null;
  onStatHover: (stat: { key: StatKey; charId: string } | null) => void;
  t: ReturnType<typeof useLanguage>["t"];
};

export const REQUIRED_STATS: StatKey[] = [
  "atk",
  "hp",
  "def",
  "em",
  "cr",
  "cd",
  "er",
];

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

function StatRow({
  statKey,
  idleValue,
  combatValue,
  isHl,
  showIdle,
  onEnter,
  onLeave,
  t,
}: {
  statKey: StatKey;
  idleValue: number;
  combatValue: number;
  isHl: boolean;
  showIdle: boolean;
  onEnter: () => void;
  onLeave: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const iVal = idleValue || 0;
  const cVal = combatValue || 0;

  // Do not render row if everything is zero, unless it is a required stat
  if (iVal === 0 && cVal === 0 && !REQUIRED_STATS.includes(statKey))
    return null;

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={cn(
        "flex items-center justify-between px-1.5 py-1 rounded-sm hover:bg-white/5 transition-colors cursor-default text-xs",
        isHl ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20" : ""
      )}
    >
      <span
        className={cn(
          "flex-1 min-w-0 truncate pr-2 opacity-80",
          isHl && "text-[color:hsl(var(--primary))] font-bold opacity-100"
        )}
      >
        {t.statShort(statKey)}
      </span>

      <div className="shrink-0 text-right font-mono font-medium">
        {fmtStat(statKey, showIdle ? iVal : cVal)}
      </div>
    </div>
  );
}

export function StatSheetPanel({
  result,
  team,
  artifactsByChar,
  targetCharId,
  highlightedStat,
  onStatHover,
  t,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showIdle, setShowIdle] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2 md:gap-3">
      {team.characters.map((charId, i) => {
        if (!charId) return <div key={i} />;

        const isTarget = charId === targetCharId;
        const char = charactersById[charId];

        // Stats
        const idle = result?.idleStats[charId] || {};
        const combat = result?.combatStats[charId] || {};
        const marginal = result?.marginalGains[charId] || {};

        const allKeys = new Set([
          ...REQUIRED_STATS,
          ...(Object.keys(idle) as StatKey[]),
          ...(Object.keys(combat) as StatKey[]),
        ]);

        const sortedKeys = getSortedKeys(allKeys);

        const marginalKeys = (Object.keys(marginal) as StatKey[]).filter(
          (k) => (marginal[k] as number) > 0
        );
        marginalKeys.sort(
          (a, b) => (marginal[b] as number) - (marginal[a] as number)
        );

        const artifactsObj = artifactsByChar[charId] || {};
        const goalConfig = team.artifacts[i];
        const equippedSets = detectEquippedSets(Object.values(artifactsObj));
        const hasMismatch = goalConfig && !setsMatch(goalConfig, equippedSets);

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
                  {/* biome-ignore lint/a11y/useSemanticElements: cannot nest button inside button */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowIdle((s) => !s);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowIdle((s) => !s);
                      }
                    }}
                    className="flex items-center gap-0.5 bg-black/40 border border-border/10 rounded-full p-1 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "text-xs font-bold px-3 py-0.5 rounded-full transition-all leading-relaxed",
                        showIdle
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground opacity-60 hover:opacity-100"
                      )}
                    >
                      {t.ui("teamComp.idle")}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold px-3 py-0.5 rounded-full transition-all leading-relaxed",
                        !showIdle
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground opacity-60 hover:opacity-100"
                      )}
                    >
                      {t.ui("teamComp.combat")}
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

            {/* Artifacts Grid */}
            <div className="p-2 border-b border-border/10">
              <ArtifactSlotGrid
                charId={charId}
                artifactsObj={artifactsObj}
                t={t}
              />
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
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-x-2 gap-y-[1px] p-2 bg-black/20 pt-1">
                  {sortedKeys.map((k) => (
                    <StatRow
                      key={k}
                      statKey={k}
                      idleValue={idle[k] as number}
                      combatValue={combat[k] as number}
                      isHl={
                        highlightedStat?.charId === charId &&
                        highlightedStat?.key === k
                      }
                      showIdle={showIdle}
                      onEnter={() => onStatHover({ key: k, charId })}
                      onLeave={() => onStatHover(null)}
                      t={t}
                    />
                  ))}
                  {sortedKeys.length === 0 && (
                    <span className="text-xs text-muted-foreground opacity-50 px-1 py-4 italic text-center col-span-2">
                      {t.ui("teamComp.noStatsResolved")}
                    </span>
                  )}
                </div>

                {/* Marginal Gains Section */}
                {marginalKeys.length > 0 && (
                  <div className="flex flex-col space-y-[1px] p-2 bg-black/20 pt-1 border-t border-border/10">
                    <div className="text-xs font-bold text-muted-foreground uppercase opacity-80 mb-1 tracking-widest px-1.5">
                      {t.ui("teamComp.marginalGains")}
                    </div>
                    {marginalKeys.map((k) => {
                      const rollVal = AVG_SUBSTAT_ROLL[k] || 0;
                      const gain = marginal[k] as number;
                      const isHl =
                        highlightedStat?.charId === charId &&
                        highlightedStat?.key === k;
                      return (
                        <div
                          key={k}
                          onMouseEnter={() => onStatHover({ key: k, charId })}
                          onMouseLeave={() => onStatHover(null)}
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
                                : "text-primary/80"
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
                  </div>
                )}
              </CollapsibleContent>
            )}
          </Collapsible>
        );
      })}
    </div>
  );
}
