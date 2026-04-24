import { ChevronDown, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CharAvatar } from "@/components/shared/CharAvatar";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  EnergyEvent,
  ERResult,
  QWindow,
  TeamSlot,
} from "@/lib/ercalc/types";
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

interface SummaryItem {
  key: string;
  sourceChar: string;
  sourceAction: string;
  /** Energy at 100% ER (sum across procs in this group). */
  energy: number;
  /** Number of procs merged into this group. */
  count: number;
  /** True when at least one proc was absorbed on-field. */
  onField: boolean;
}

/** Group events of one bucket (flat OR scalable+particle) for one absorber by
 *  (sourceChar, sourceAction), summing energy. Drops events that didn't reach
 *  this character. */
function summarizeBucket(
  events: EnergyEvent[],
  charId: string,
  bucket: "flat" | "scalable"
): SummaryItem[] {
  const grouped = new Map<string, SummaryItem>();
  for (const ev of events) {
    // Bucket assignment: particles + scalable both ER-scale → "scalable" row.
    const evBucket: "flat" | "scalable" =
      ev.type === "flat" ? "flat" : "scalable";
    if (evBucket !== bucket) continue;
    // Flat / scalable events carry their recipient in absorberChar.
    if (
      (ev.type === "flat" || ev.type === "scalable") &&
      ev.absorberChar !== charId
    )
      continue;
    // Particles use absorberChar = on-field char; we still want them attributed
    // to the current char (calculator already filters distribution to this
    // char's accumulator before pushing into the binding events). We accept
    // every particle event in the array.
    const key = `${ev.type}:${ev.sourceChar}:${ev.sourceAction}`;
    const onField = ev.absorberChar === charId;
    const existing = grouped.get(key);
    if (existing) {
      existing.energy += ev.energyAt100;
      existing.count++;
      if (onField) existing.onField = true;
    } else {
      grouped.set(key, {
        key,
        sourceChar: ev.sourceChar,
        sourceAction: ev.sourceAction,
        energy: ev.energyAt100,
        count: 1,
        onField,
      });
    }
  }
  return Array.from(grouped.values()).sort((a, b) => b.energy - a.energy);
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
          const hasData = !!result?.hasQ;
          const erNeeded = hasData ? result.erNeeded : 100;
          const isInfinity = erNeeded === Number.POSITIVE_INFINITY;
          const erDisplay = isInfinity ? "∞" : `${Math.ceil(erNeeded)}%`;
          const erNormalized = isInfinity
            ? 100
            : Math.min(100, ((erNeeded - 100) / 200) * 100);
          const erTextColor = getErTextColor(erNeeded, isInfinity);
          const particle = hasData ? result.energyBreakdown.particleEnergy : 0;
          const scalable = hasData ? result.energyBreakdown.scalableEnergy : 0;
          const flat = hasData ? result.energyBreakdown.flatEnergy : 0;
          // Particles + scalable both ER-scale together (they share the same
          // linear coefficient against ER%). The denominator in the formula
          // is their sum; flat is subtracted from burst cost.
          const burstCost = slot.burstCost;

          // Per-Q windows for the expanded breakdown. Sort by ER desc so the
          // worst-case (binding) window is on top — it's the one that
          // determines the displayed character ER.
          const qWindows: QWindow[] = hasData ? (result.qWindows ?? []) : [];
          const sortedWindows = [...qWindows].sort((a, b) => {
            // Push Infinity to the top.
            if (a.erNeeded === Number.POSITIVE_INFINITY) return -1;
            if (b.erNeeded === Number.POSITIVE_INFINITY) return 1;
            return b.erNeeded - a.erNeeded;
          });

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

                {/* Energy math: particle + scalable + flat / cost */}
                <div className="mt-1 flex items-center gap-1 text-xs md:text-sm tabular-nums">
                  <span
                    className="text-primary/90 font-medium"
                    title={t.ui("erCalc.particleEnergyTitle")}
                  >
                    {particle.toFixed(1)}
                  </span>
                  {scalable > 0 && (
                    <>
                      <span>+</span>
                      <span
                        className="text-cyan-400 font-medium"
                        title={t.ui("erCalc.scalableEnergyTitle")}
                      >
                        {scalable.toFixed(1)}
                      </span>
                    </>
                  )}
                  {flat > 0 && (
                    <>
                      <span>+</span>
                      <span
                        className="text-blue-400 font-medium"
                        title={t.ui("erCalc.flatEnergyTitle")}
                      >
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

              {/* Expanded breakdown — one block per Q window, sorted by ER desc. */}
              {allExpanded && hasData && sortedWindows.length > 0 && (
                <div className="px-2 pb-2 pt-0 space-y-1.5">
                  {sortedWindows.map((w, idx) => (
                    <QWindowBlock
                      key={`${w.qIndex}-${idx}`}
                      window={w}
                      charId={slot.charId}
                      tCharacter={t.character}
                      tErAction={t.erAction}
                      tUi={t.ui}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** One Q-window breakdown block:
 *    – Header line  : Q label, the window's ER %, "binding" tag if applicable
 *    – Flat row     : per-source numbers (hover for action label) + sum
 *    – Scalable row : per-source numbers (hover for action label) + sum
 *    – Formula line : (cost − flat) / scalable × 100 = ER%
 */
function QWindowBlock({
  window: w,
  charId,
  tCharacter,
  tErAction,
  tUi,
  language,
}: {
  window: QWindow;
  charId: string;
  tCharacter: (id: string) => string;
  tErAction: (action: string) => string;
  tUi: (key: string) => string;
  language: "en" | "zh";
}) {
  const isInfinity = w.erNeeded === Number.POSITIVE_INFINITY;
  const erColor = getErTextColor(w.erNeeded, isInfinity);
  const erDisplay = isInfinity ? "∞" : `${Math.ceil(w.erNeeded)}%`;
  const flatItems = summarizeBucket(w.events, charId, "flat");
  const scalableItems = summarizeBucket(w.events, charId, "scalable");
  const flatTotal = flatItems.reduce((a, b) => a + b.energy, 0);
  const scalableTotal = scalableItems.reduce((a, b) => a + b.energy, 0);
  const qLabel = tErAction(w.qAction);

  return (
    <div
      className={cn(
        "rounded-md border bg-background/30 p-1.5 text-foreground space-y-0.5",
        w.isBinding ? "border-primary/50" : "border-border/30"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold flex-1 truncate min-w-0">
          {qLabel} <span className="text-foreground/50">@{w.qIndex}</span>
          {w.isBinding && (
            <span className="ml-1.5 px-1 rounded bg-primary/20 text-primary text-[10px] uppercase tracking-wide">
              {tUi("erCalc.qWindowBinding")}
            </span>
          )}
        </span>
        <span className={cn("font-bold tabular-nums", erColor)}>
          {erDisplay}
        </span>
      </div>

      <BreakdownRow
        label={tUi("erCalc.grantFlat")}
        items={flatItems}
        total={flatTotal}
        toneClass="text-blue-400"
        tCharacter={tCharacter}
        tErAction={tErAction}
        empty={tUi("erCalc.qWindowEmpty")}
      />
      <BreakdownRow
        label={tUi("erCalc.qWindowScalableRow")}
        items={scalableItems}
        total={scalableTotal}
        toneClass="text-cyan-400"
        tCharacter={tCharacter}
        tErAction={tErAction}
        empty={tUi("erCalc.qWindowEmpty")}
      />

      {!isInfinity && (
        <div className="text-[11px] md:text-xs tabular-nums pt-0.5 mt-0.5 border-t border-border/30 text-foreground/80">
          ({w.burstCost}
          {flatTotal > 0 ? ` − ${flatTotal.toFixed(1)}` : ""}) /{" "}
          {scalableTotal.toFixed(1)} × 100 ={" "}
          <span className={cn(erColor, "font-semibold")}>{erDisplay}</span>
          <span className="ml-1 text-foreground/50">
            {language === "zh" ? "" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

/** A single energy-bucket row: label · per-source numbers (with action-label
 *  tooltips) · sum. */
function BreakdownRow({
  label,
  items,
  total,
  toneClass,
  tCharacter,
  tErAction,
  empty,
}: {
  label: string;
  items: SummaryItem[];
  total: number;
  toneClass: string;
  tCharacter: (id: string) => string;
  tErAction: (action: string) => string;
  empty: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5 text-[11px] md:text-xs flex-wrap">
      <span className="text-foreground/60 shrink-0 w-14">{label}</span>
      <div className="flex items-baseline gap-1 flex-wrap flex-1 min-w-0">
        {items.length === 0 ? (
          <span className="text-foreground/40">{empty}</span>
        ) : (
          items.map((it, i) => {
            const charLabel = tCharacter(it.sourceChar).split(/[\s_]/)[0];
            const actionLabel = tErAction(it.sourceAction);
            const tooltip = `${charLabel} ${actionLabel}${it.count > 1 ? ` ×${it.count}` : ""}`;
            return (
              <span key={it.key} className="inline-flex items-baseline gap-0.5">
                {i > 0 && <span className="text-foreground/40">+</span>}
                <span
                  className={cn("tabular-nums cursor-help", toneClass)}
                  title={tooltip}
                >
                  {it.energy.toFixed(1)}
                </span>
              </span>
            );
          })
        )}
      </div>
      <span className={cn("font-semibold tabular-nums shrink-0", toneClass)}>
        = {total.toFixed(1)}
      </span>
    </div>
  );
}
