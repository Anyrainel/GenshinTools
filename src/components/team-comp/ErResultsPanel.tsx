import { ChevronDown, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CharAvatar } from "@/components/shared/CharAvatar";
import { useLanguage } from "@/contexts/LanguageContext";
import type { EnergyEvent, ERResult, TeamSlot } from "@/lib/ercalc/types";
import type { Team } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import {
  erPercentToInternal,
  findMatchingTeams,
} from "@/stores/teamStoreIntegration";
import { useTeamStore } from "@/stores/useTeamStore";

interface ErResultsPanelProps {
  results: ERResult[];
  team: TeamSlot[];
  embedded?: boolean;
  /**
   * When provided, Apply writes directly to this team's charSettings.
   * When absent, falls back to matching by character IDs.
   */
  targetTeam?: Team;
}

function getErTextColor(er: number, isInfinity: boolean) {
  if (isInfinity) return "text-destructive";
  if (er <= 100) return "text-green-400";
  if (er <= 140) return "text-emerald-400";
  if (er <= 180) return "text-foreground";
  if (er <= 220) return "text-amber-400";
  if (er <= 260) return "text-orange-400";
  return "text-red-400";
}

/** Group events by (type, source char, source action), merging duplicate procs. */
function summarizeEventsForChar(
  events: EnergyEvent[],
  charId: string
): {
  source: string;
  sourceChar: string;
  sourceAction: string;
  type: "particle" | "flat";
  energy: number;
  onField: boolean;
  count: number;
}[] {
  const grouped = new Map<
    string,
    {
      sourceChar: string;
      sourceAction: string;
      type: "particle" | "flat";
      energy: number;
      onField: boolean;
      count: number;
    }
  >();
  for (const ev of events) {
    // For flat events, only include those whose recipient is the current char
    // (flat events carry recipient in `absorberChar`).
    if (ev.type === "flat" && ev.absorberChar !== charId) continue;
    const key = `${ev.type}:${ev.sourceChar}:${ev.sourceAction}`;
    const onField = ev.absorberChar === charId;
    const existing = grouped.get(key);
    if (existing) {
      existing.energy += ev.energyAt100;
      existing.count++;
      if (onField) existing.onField = true;
    } else {
      grouped.set(key, {
        sourceChar: ev.sourceChar,
        sourceAction: ev.sourceAction,
        type: ev.type,
        energy: ev.energyAt100,
        onField,
        count: 1,
      });
    }
  }
  return Array.from(grouped.entries()).map(([key, val]) => ({
    source: key,
    ...val,
  }));
}

export function ErResultsPanel({
  results,
  team,
  targetTeam,
}: ErResultsPanelProps) {
  const { t, language } = useLanguage();
  const teams = useTeamStore((s) => s.teams);
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const [allExpanded, setAllExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: t is stable per language, which is already a dependency
  const handleApplyMinER = useCallback(() => {
    let target = targetTeam;
    if (!target) {
      const charIds = team.map((s) => s.charId);
      const matching = findMatchingTeams(teams, charIds);
      if (matching.length === 0) {
        toast.info(t.ui("erCalc.noMatchingTeamFound"));
        return;
      }
      target = matching[0];
    }
    const charSettings: Record<string, { minEr?: number }> = {
      ...target.charSettings,
    };
    for (const r of results) {
      if (r.erNeeded !== Number.POSITIVE_INFINITY && r.erNeeded > 100) {
        charSettings[r.characterId] = {
          ...charSettings[r.characterId],
          minEr: erPercentToInternal(r.erNeeded),
        };
      }
    }
    updateTeam(target.id, { charSettings });
    toast.success(
      language === "zh"
        ? `已应用到「${target.name || "队伍"}」的最低ER`
        : `Applied to "${target.name || "team"}" min ER`
    );
  }, [team, teams, results, updateTeam, language, targetTeam]);

  const handleCopy = useCallback(() => {
    const teamNames = team.map((s) => t.character(s.charId)).join(" / ");
    const lines = results
      .map((r, i) => {
        const slot = team[i];
        if (!slot) return "";
        const er =
          r.erNeeded === Number.POSITIVE_INFINITY
            ? "∞"
            : `${Math.ceil(r.erNeeded)}%`;
        const weapon = slot.weaponId ? ` (${t.weapon(slot.weaponId)})` : "";
        return `  ${t.character(r.characterId)}${weapon}: ${er}`;
      })
      .filter(Boolean)
      .join("\n");
    const text = `ER Requirements — ${teamNames}\n${lines}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [results, team, t]);

  return (
    <section className={cn("overflow-hidden border-t border-border/40")}>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/10">
        <div className="flex items-center gap-2">
          <h3 className="text-sm md:text-base font-semibold">
            {t.ui("erCalc.erRequirements")}
          </h3>
          <button
            type="button"
            onClick={handleCopy}
            className="hover:text-primary"
            title={t.ui("erCalc.copyResults")}
          >
            <Copy className="w-4 h-4" />
          </button>
          {copied && (
            <span className="text-xs md:text-sm text-green-400">
              {t.ui("erCalc.copied")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleApplyMinER}
          className="text-xs md:text-sm font-semibold px-2.5 py-1 rounded-md bg-primary/80 hover:bg-primary text-primary-foreground transition-colors"
          title={t.ui("erCalc.applyToTeamMinER")}
        >
          {t.ui("erCalc.applyToTeamMinER")}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 p-2">
        {team.map((slot) => {
          const result = results.find((r) => r.characterId === slot.charId);
          const hasData = !!(result && result.hasQ);
          const erNeeded = hasData ? result.erNeeded : 100;
          const isInfinity = erNeeded === Number.POSITIVE_INFINITY;
          const erDisplay = isInfinity ? "∞" : `${Math.ceil(erNeeded)}%`;
          const erNormalized = isInfinity
            ? 100
            : Math.min(100, ((erNeeded - 100) / 200) * 100);
          const erTextColor = getErTextColor(erNeeded, isInfinity);
          const particle = hasData ? result.energyBreakdown.particleEnergy : 0;
          const flat = hasData ? result.energyBreakdown.flatEnergy : 0;
          const burstCost = slot.burstCost;

          const charEvents =
            allExpanded && hasData && result.bindingEvents
              ? summarizeEventsForChar(result.bindingEvents, slot.charId)
              : [];

          const toggleExpand = () => {
            if (hasData) setAllExpanded((p) => !p);
          };

          return (
            <div
              key={slot.charId}
              className="rounded-md border border-border/40 bg-background/20 overflow-hidden"
            >
              <button
                type="button"
                className={cn(
                  "w-full px-2 py-1.5 text-left text-foreground",
                  hasData && "hover:bg-muted/20 cursor-pointer"
                )}
                onClick={toggleExpand}
                disabled={!hasData}
              >
                <div className="flex items-center gap-1.5">
                  <CharAvatar charId={slot.charId} size={22} />
                  <span className="text-xs md:text-sm font-semibold truncate flex-1 min-w-0">
                    {t.character(slot.charId)}
                  </span>
                  <span
                    className={cn(
                      erTextColor,
                      "text-sm md:text-base font-bold tabular-nums"
                    )}
                  >
                    {erDisplay}
                  </span>
                  {hasData && (
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-transform",
                        allExpanded && "rotate-180"
                      )}
                    />
                  )}
                </div>

                {/* Energy math: scalable + flat / cost */}
                <div className="mt-1 flex items-center gap-1 text-xs md:text-sm tabular-nums">
                  <span className="text-primary/90 font-medium">
                    {particle.toFixed(1)}
                  </span>
                  {flat > 0 && (
                    <>
                      <span>+</span>
                      <span className="text-blue-400 font-medium">
                        {flat.toFixed(1)}
                      </span>
                    </>
                  )}
                  <span>/</span>
                  <span className="font-semibold">{burstCost}</span>
                  {result?.bindingMode && (
                    <span className="ml-auto text-[11px] md:text-xs leading-none shrink-0">
                      {result.bindingMode === "zero-energy-start"
                        ? t.ui("erCalc.bindingModeStart")
                        : t.ui("erCalc.bindingModeRepeat")}
                    </span>
                  )}
                </div>

                {/* ER bar */}
                <div className="mt-1 h-1.5 bg-background/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/50"
                    style={{ width: `${Math.max(3, erNormalized)}%` }}
                  />
                </div>
              </button>

              {/* Expanded breakdown — stays in grid cell */}
              {allExpanded && hasData && result.bindingEvents && (
                <div className="px-2 pb-2 pt-0">
                  <div className="rounded-md bg-background/30 p-1.5 space-y-1 text-foreground">
                    {charEvents.map((ev) => {
                      const actionLabel = t.erAction(ev.sourceAction);
                      const isFlat = ev.type === "flat";

                      return (
                        <div
                          key={ev.source}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <CharAvatar charId={ev.sourceChar} size={16} />
                          <span className="truncate min-w-0 flex-1">
                            {t.character(ev.sourceChar).split(/[\s_]/)[0]}{" "}
                            {actionLabel}
                            {ev.count > 1 && ` ×${ev.count}`}
                          </span>
                          {!isFlat && (
                            <span
                              className={cn(
                                "tabular-nums shrink-0",
                                ev.onField
                                  ? "text-green-400"
                                  : "text-amber-300/90"
                              )}
                            >
                              {ev.onField
                                ? t.ui("erCalc.onFieldLabel")
                                : t.ui("erCalc.offFieldLabel")}
                            </span>
                          )}
                          <span
                            className={cn(
                              "tabular-nums font-medium shrink-0",
                              isFlat ? "text-blue-400" : undefined
                            )}
                          >
                            +{ev.energy.toFixed(1)}
                            {isFlat
                              ? language === "zh"
                                ? " 固定"
                                : " flat"
                              : ""}
                          </span>
                        </div>
                      );
                    })}
                    {!isInfinity && (
                      <div className="text-xs tabular-nums border-t border-border/40 pt-1 mt-1">
                        ({burstCost}
                        {flat > 0 ? ` - ${flat.toFixed(1)}` : ""}) /{" "}
                        {particle.toFixed(1)} × 100 ={" "}
                        <span className={cn(erTextColor, "font-semibold")}>
                          {Math.ceil(erNeeded)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
