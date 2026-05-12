import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CharAvatar } from "@/components/shared/CharAvatar";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CLEAR_PARTICLE,
  DIFF_ELEMENT_PARTICLE,
  OFF_FIELD_MULTIPLIER,
  SAME_ELEMENT_PARTICLE,
} from "@/lib/ercalc/constants";
import type {
  EnergyEvent,
  ERResult,
  QWindow,
  TeamSlot,
} from "@/lib/ercalc/types";
import type { TeamComp } from "@/lib/team-comp/types";
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
  actionControls?: ReactNode;
  /**
   * When provided, Apply writes directly to this team's character config.
   * When absent, falls back to matching by character IDs.
   */
  targetTeam?: TeamComp;
}

function getErTextColor(er: number, isInfinity: boolean) {
  if (isInfinity) return "text-destructive";
  if (er <= 100) return "text-muted-foreground";
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
    if (ev.type === "particle") continue;
    const evBucket: "flat" | "scalable" =
      ev.type === "scalable" ? "scalable" : "flat";
    if (evBucket !== bucket) continue;
    // Flat / scalable events carry their recipient in absorberChar.
    if (
      (ev.type === "flat" || ev.type === "scalable") &&
      ev.absorberChar !== charId
    )
      continue;
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

interface ParticleCalcItem {
  key: string;
  particleElement: string;
  particleCount: number;
  elementValue: number;
  fieldMultiplier: number;
  energy: number;
  count: number;
}

function particleElementValue(
  recipientElement: string,
  particleElement: string
): number {
  if (particleElement === "Clear") return CLEAR_PARTICLE;
  return recipientElement === particleElement
    ? SAME_ELEMENT_PARTICLE
    : DIFF_ELEMENT_PARTICLE;
}

function summarizeParticleCalcs(
  events: EnergyEvent[],
  recipientElement: string,
  partySize: number
): ParticleCalcItem[] {
  const offFieldMult =
    OFF_FIELD_MULTIPLIER[partySize] ?? OFF_FIELD_MULTIPLIER[4];
  const grouped = new Map<string, ParticleCalcItem>();
  for (const ev of events) {
    if (ev.type !== "particle" || ev.particleCount <= 0) continue;
    const elementValue = particleElementValue(
      recipientElement,
      ev.particleElement
    );
    const fieldMultiplier = ev.onField ? 1 : offFieldMult;
    const key = [
      ev.sourceChar,
      ev.sourceAction,
      ev.particleElement,
      ev.particleCount,
      elementValue,
      fieldMultiplier,
    ].join(":");
    const existing = grouped.get(key);
    if (existing) {
      existing.energy += ev.energyAt100;
      existing.count += 1;
    } else {
      grouped.set(key, {
        key,
        particleElement: ev.particleElement,
        particleCount: ev.particleCount,
        elementValue,
        fieldMultiplier,
        energy: ev.energyAt100,
        count: 1,
      });
    }
  }
  return Array.from(grouped.values());
}

function fmtEnergy(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function fmtFactor(n: number): string {
  return n % 1 === 0
    ? String(n)
    : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function ErResultsPanel({
  results,
  team,
  actionControls,
  targetTeam,
}: ErResultsPanelProps) {
  const { t, language } = useLanguage();
  const teamComps = useTeamStore((s) => s.teamComps);
  const getTeamSetupConfigById = useTeamStore((s) => s.getTeamSetupConfigById);
  const updateTeamSetupConfig = useTeamStore((s) => s.updateTeamSetupConfig);
  const [allExpanded, setAllExpanded] = useState(false);

  const handleApplyMinER = useCallback(() => {
    let target = targetTeam;
    if (!target) {
      const charIds = team.map((s) => s.charId);
      const matching = findMatchingTeams(teamComps, charIds);
      if (matching.length === 0) {
        toast.info(t.ui("erCalc.noMatchingTeamFound"));
        return;
      }
      target = matching[0];
    }
    const setupConfig = getTeamSetupConfigById(target.id);
    const charConfigs = {
      ...(setupConfig.charConfigs ?? {}),
    };
    for (const r of results) {
      if (r.erNeeded !== Number.POSITIVE_INFINITY && r.erNeeded > 100) {
        charConfigs[r.characterId] = {
          ...charConfigs[r.characterId],
          minEr: erPercentToInternal(r.erNeeded),
        };
      }
    }
    updateTeamSetupConfig(target.id, { charConfigs });
    toast.success(
      language === "zh"
        ? `已应用到「${target.name || "队伍"}」的最低ER`
        : `Applied to "${target.name || "team"}" min ER`
    );
  }, [
    team,
    teamComps,
    results,
    getTeamSetupConfigById,
    updateTeamSetupConfig,
    language,
    targetTeam,
    t,
  ]);

  return (
    <section className={cn("overflow-hidden border-t border-border/40")}>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/10">
        <div className="flex items-center gap-2">
          <h3 className="text-sm md:text-base font-semibold">
            {t.ui("erCalc.erRequirements")}
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actionControls}
          <button
            type="button"
            onClick={handleApplyMinER}
            className="text-xs md:text-sm font-semibold px-2.5 py-1 rounded-md bg-primary/80 hover:bg-primary/70 text-primary-foreground transition-colors"
            title={t.ui("erCalc.applyToTeamMinER")}
          >
            {t.ui("erCalc.applyToTeamMinER")}
          </button>
        </div>
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

          // Per-Q windows are already in authored sequence order: startup(s),
          // loop first pass, then loop subsequent pass when enabled.
          const qWindows: QWindow[] = hasData ? (result.qWindows ?? []) : [];

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

              {/* Expanded breakdown — one block per Q window in sequence order. */}
              {allExpanded && hasData && qWindows.length > 0 && (
                <div className="px-2 pb-2 pt-0 space-y-1.5">
                  {qWindows.map((w, idx) => (
                    <QWindowBlock
                      key={`${w.qIndex}-${idx}`}
                      window={w}
                      charId={slot.charId}
                      tCharacter={t.character}
                      tErAction={t.erAction}
                      tUi={t.ui}
                      language={language}
                      recipientElement={slot.element}
                      partySize={team.length}
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
  recipientElement,
  partySize,
}: {
  window: QWindow;
  charId: string;
  tCharacter: (id: string) => string;
  tErAction: (action: string) => string;
  tUi: (key: string) => string;
  language: "en" | "zh";
  recipientElement: string;
  partySize: number;
}) {
  const isInfinity = w.erNeeded === Number.POSITIVE_INFINITY;
  const erColor = getErTextColor(w.erNeeded, isInfinity);
  const erDisplay = isInfinity ? "∞" : `${Math.ceil(w.erNeeded)}%`;
  const flatItems = summarizeBucket(w.events, charId, "flat");
  const scalableItems = summarizeBucket(w.events, charId, "scalable");
  const particleItems = summarizeParticleCalcs(
    w.events,
    recipientElement,
    partySize
  );
  const flatTotal = flatItems.reduce((a, b) => a + b.energy, 0);
  const scalableTotal = scalableItems.reduce((a, b) => a + b.energy, 0);
  const particleTotal = particleItems.reduce((a, b) => a + b.energy, 0);
  const erScaledTotal = particleTotal + scalableTotal;
  const totalAtBaseER = flatTotal + erScaledTotal;
  const qLabel = tErAction(w.qAction);
  const sourceLabel = formatQWindowSource(w, tUi);

  return (
    <div
      className={cn(
        "rounded-md border bg-background/30 p-1.5 text-foreground space-y-0.5",
        w.isBinding ? "border-primary/50" : "border-border/30"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold flex-1 truncate min-w-0">
          {qLabel}{" "}
          <span className="text-foreground/70">
            {sourceLabel ?? `@${w.qIndex}`}
          </span>
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
      <ParticleCalcRow
        label={tUi("erCalc.particlesLabel")}
        items={particleItems}
        total={particleTotal}
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
          {totalAtBaseER >= w.burstCost ? (
            <>
              {fmtEnergy(totalAtBaseER)} ≥ {w.burstCost} →{" "}
              <span className={cn(erColor, "font-semibold")}>{erDisplay}</span>
            </>
          ) : (
            <>
              ({w.burstCost}
              {flatTotal > 0 ? ` − ${flatTotal.toFixed(1)}` : ""}) /{" "}
              {erScaledTotal.toFixed(1)} × 100 ={" "}
              <span className={cn(erColor, "font-semibold")}>{erDisplay}</span>
            </>
          )}
          <span className="ml-1 text-foreground/50">
            {language === "zh" ? "" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function formatQWindowSource(
  w: QWindow,
  tUi: (key: string) => string
): string | null {
  if (!w.source) return null;
  if (w.source.kind === "startup") {
    return `${tUi("erCalc.startupLabel")} ${w.source.timelineNumber} @${w.source.actionIndex}`;
  }
  const loopLabel =
    w.source.iteration === "first"
      ? tUi("erCalc.qWindowLoopFirst")
      : tUi("erCalc.qWindowLoopSubsequent");
  return `${loopLabel} @${w.source.actionIndex}`;
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

function ParticleCalcRow({
  label,
  items,
  total,
  empty,
}: {
  label: string;
  items: ParticleCalcItem[];
  total: number;
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
            const expression =
              it.count > 1
                ? `${it.count}×(${fmtFactor(it.particleCount)}×${fmtFactor(
                    it.elementValue
                  )}×${fmtFactor(it.fieldMultiplier)})`
                : `${fmtFactor(it.particleCount)}×${fmtFactor(
                    it.elementValue
                  )}×${fmtFactor(it.fieldMultiplier)}`;
            return (
              <span key={it.key} className="inline-flex items-baseline gap-0.5">
                {i > 0 && <span className="text-foreground/40">+</span>}
                <span className="tabular-nums cursor-help text-primary/90">
                  {it.particleElement} {expression}={fmtEnergy(it.energy)}
                </span>
              </span>
            );
          })
        )}
      </div>
      <span className="font-semibold tabular-nums shrink-0 text-primary/90">
        = {fmtEnergy(total)}
      </span>
    </div>
  );
}
