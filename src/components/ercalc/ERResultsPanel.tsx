import { useLanguage } from "@/contexts/LanguageContext";
import type { Element } from "@/data/types";
import type { ERResult, EnergyEvent } from "@/lib/ercalc/erCalculator";
import {
  erPercentToInternal,
  findMatchingTeams,
} from "@/lib/ercalc/teamStoreIntegration";
import { getElementColor } from "@/lib/utils";
import { useTeamStore } from "@/stores/useTeamStore";
import { ChevronDown, Copy, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CharAvatar } from "./CharAvatar";
import type { TeamSlot } from "./ERCalcView";

interface ERResultsPanelProps {
  results: ERResult[];
  team: TeamSlot[];
}

function getERTextColor(er: number, isInfinity: boolean) {
  if (isInfinity) return "text-destructive";
  if (er <= 100) return "text-green-400";
  if (er <= 140) return "text-emerald-400";
  if (er <= 180) return "text-foreground";
  if (er <= 220) return "text-amber-400";
  if (er <= 260) return "text-orange-400";
  return "text-red-400";
}

/** Group events by source char+action, merging duplicate procs. */
function summarizeEventsForChar(
  events: EnergyEvent[],
  charId: string
): {
  source: string;
  sourceChar: string;
  energy: number;
  onField: boolean;
  count: number;
}[] {
  const grouped = new Map<
    string,
    {
      sourceChar: string;
      energy: number;
      onField: boolean;
      count: number;
    }
  >();
  for (const ev of events) {
    if (ev.type !== "particle") continue;
    // Group by char+action (merge multiple procs of same action type)
    const key = `${ev.sourceChar}:${ev.sourceAction}`;
    const onField = ev.absorberChar === charId;
    const existing = grouped.get(key);
    if (existing) {
      existing.energy += ev.energyAt100;
      existing.count++;
      // If any proc is on-field, mark as on-field
      if (onField) existing.onField = true;
    } else {
      grouped.set(key, {
        sourceChar: ev.sourceChar,
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

const ACTION_LABELS_SHORT: Record<string, { en: string; zh: string }> = {
  E: { en: "E", zh: "E" },
  holdE: { en: "Hold E", zh: "长按E" },
  periodicE: { en: "Tick", zh: "持续E" },
  Q: { en: "Q", zh: "Q" },
  specialQ: { en: "Alt Q", zh: "特殊Q" },
};

export function ERResultsPanel({ results, team }: ERResultsPanelProps) {
  const { t, language } = useLanguage();
  const teams = useTeamStore((s) => s.teams);
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleApplyMinER = useCallback(() => {
    const charIds = team.map((s) => s.charId);
    const matching = findMatchingTeams(teams, charIds);
    if (matching.length === 0) {
      toast.info(t.ui("erCalc.noMatchingTeamFound"));
      return;
    }
    // Apply to the first matching team
    const target = matching[0];
    const minEr: Record<string, number> = {};
    for (const r of results) {
      if (r.erNeeded !== Number.POSITIVE_INFINITY && r.erNeeded > 100) {
        minEr[r.characterId] = erPercentToInternal(r.erNeeded);
      }
    }
    updateTeam(target.id, { minEr });
    toast.success(
      language === "zh"
        ? `已应用到「${target.name || "队伍"}」的最低ER`
        : `Applied to "${target.name || "team"}" min ER`
    );
  }, [team, teams, results, updateTeam, language]);

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
    <section className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
      <div className="px-4 py-2.5 bg-gradient-select border-b border-border/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {t.ui("erCalc.erRequirements")}
          </h3>
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground"
            title={t.ui("erCalc.copyResults")}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleApplyMinER}
            className="text-muted-foreground hover:text-foreground"
            title={t.ui("erCalc.applyToTeamMinER")}
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          {copied && (
            <span className="text-xs text-green-400">
              {t.ui("erCalc.copied")}
            </span>
          )}
        </div>
        {(() => {
          const maxER = Math.max(...results.map((r) => r.erNeeded));
          const maxChar = results.find((r) => r.erNeeded === maxER);
          if (!maxChar || maxER === Number.POSITIVE_INFINITY) return null;
          return (
            <span className="text-xs text-muted-foreground">
              {t.ui("erCalc.teamBottleneck")}:{" "}
              <span className="text-amber-400 font-medium">
                {t.character(maxChar.characterId).split(/[\s_]/)[0]}{" "}
                {Math.ceil(maxER)}%
              </span>
            </span>
          );
        })()}
      </div>

      <div className="divide-y divide-border/50">
        {results.map((result, i) => {
          const slot = team[i];
          if (!slot) return null;

          const isInfinity = result.erNeeded === Number.POSITIVE_INFINITY;
          const erDisplay = isInfinity
            ? "∞"
            : !result.hasQ
              ? `~${Math.ceil(result.erNeeded)}%`
              : `${Math.ceil(result.erNeeded)}%`;
          const erNormalized = isInfinity
            ? 100
            : Math.min(100, ((result.erNeeded - 100) / 200) * 100);
          const erTextColor = getERTextColor(result.erNeeded, isInfinity);
          const textColor = getElementColor(slot.element as Element, "text");
          const barColor = getElementColor(slot.element as Element, "bg");
          const isExpanded = expanded === result.characterId;

          // Get per-char events from binding window
          const charEvents =
            result.bindingEvents && isExpanded
              ? summarizeEventsForChar(result.bindingEvents, result.characterId)
              : [];

          return (
            <div key={result.characterId}>
              {/* Main result row */}
              <button
                type="button"
                className="w-full px-4 py-3 hover:bg-muted/20 text-left"
                onClick={() =>
                  setExpanded(isExpanded ? null : result.characterId)
                }
              >
                <div className="flex items-center gap-3">
                  {/* Character avatar + name */}
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <CharAvatar charId={result.characterId} size={24} />
                    <span
                      className={`${textColor} text-sm font-medium truncate`}
                    >
                      {t.character(result.characterId)}
                    </span>
                  </div>

                  {/* Energy bar */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-6 bg-background/30 rounded-md overflow-hidden relative">
                      <div
                        className={`h-full rounded-md ${barColor}`}
                        style={{
                          width: `${Math.max(3, erNormalized)}%`,
                        }}
                      />
                      <span className="absolute inset-0 flex items-center px-2.5 text-xs tabular-nums">
                        {result.energyBreakdown.particleEnergy.toFixed(1)}
                        {result.energyBreakdown.flatEnergy > 0
                          ? ` + ${result.energyBreakdown.flatEnergy.toFixed(1)}`
                          : ""}{" "}
                        / {slot.burstCost}
                      </span>
                    </div>

                    {/* ER percentage + binding mode */}
                    <div className="flex flex-col items-end shrink-0 w-16">
                      <span
                        className={`${erTextColor} text-base font-bold tabular-nums`}
                      >
                        {erDisplay}
                      </span>
                      {result.bindingMode && (
                        <span className="text-xs text-muted-foreground leading-none">
                          {result.bindingMode === "zero-energy-start"
                            ? t.ui("erCalc.bindingModeStart")
                            : t.ui("erCalc.bindingModeRepeat")}
                        </span>
                      )}
                    </div>

                    {/* Expand indicator */}
                    {result.bindingEvents && (
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded breakdown */}
              {isExpanded && result.bindingEvents && (
                <div className="px-4 pb-3 pt-0">
                  <div className="rounded-lg bg-background/20 p-3 space-y-1.5">
                    <div className="text-xs text-muted-foreground mb-2">
                      {t.ui("erCalc.energyWindowBreakdown")}
                    </div>
                    {charEvents.map((ev) => {
                      const parts = ev.source.split(":");
                      const sourceChar = parts[0];
                      const sourceAction = parts[1];
                      const actionLabel =
                        ACTION_LABELS_SHORT[sourceAction]?.[
                          language === "zh" ? "zh" : "en"
                        ] ?? sourceAction;

                      return (
                        <div
                          key={ev.source}
                          className="flex items-center gap-2 text-xs"
                        >
                          <CharAvatar charId={sourceChar} size={16} />
                          <span className="text-muted-foreground w-24 shrink-0">
                            {t.character(sourceChar).split(/[\s_]/)[0]}{" "}
                            {actionLabel}
                            {ev.count > 1 && (
                              <span className="text-muted-foreground">
                                {" "}
                                ×{ev.count}
                              </span>
                            )}
                          </span>
                          <span
                            className={`tabular-nums ${
                              ev.onField
                                ? "text-green-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {ev.onField
                              ? t.ui("erCalc.onFieldLabel")
                              : t.ui("erCalc.offFieldLabel")}
                          </span>
                          <span className="ml-auto tabular-nums font-medium">
                            +{ev.energy.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                    {result.energyBreakdown.flatEnergy > 0 && (
                      <div className="flex items-center gap-2 text-xs border-t border-border/30 pt-1.5 mt-1.5">
                        <span className="text-muted-foreground">
                          {t.ui("erCalc.flatEnergy")}
                        </span>
                        <span className="ml-auto tabular-nums font-medium text-blue-400">
                          +{result.energyBreakdown.flatEnergy.toFixed(1)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs border-t border-border/30 pt-1.5 mt-1.5 font-medium">
                      <span>{t.ui("erCalc.totalCost")}</span>
                      <span className="ml-auto tabular-nums">
                        {(
                          result.energyBreakdown.particleEnergy +
                          result.energyBreakdown.flatEnergy
                        ).toFixed(1)}{" "}
                        / {slot.burstCost}
                      </span>
                    </div>
                    {/* ER derivation */}
                    {!isInfinity && (
                      <div className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                        ER = ({slot.burstCost}
                        {result.energyBreakdown.flatEnergy > 0
                          ? ` - ${result.energyBreakdown.flatEnergy.toFixed(1)}`
                          : ""}
                        ) / {result.energyBreakdown.particleEnergy.toFixed(1)} ×
                        100 ={" "}
                        <span className={erTextColor}>
                          {Math.ceil(result.erNeeded)}%
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
