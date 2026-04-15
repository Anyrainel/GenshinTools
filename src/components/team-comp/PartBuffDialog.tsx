/**
 * Per-part buff activation dialog.
 *
 * Multi-tab ResponsiveDialog where each tab corresponds to a formula part.
 * Shows buff name (full i18n), origin, conditions, stat entries, and a
 * slider (hits > 1) or toggle (hits === 1) for activation control.
 */

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { useLanguage } from "@/contexts/LanguageContext";
import {
  type StatEntryData,
  StatEntryRow,
  formatFilter,
  formatReceiverLabel,
  getReceiverBadgeClasses,
  getSourceIcon,
  getSourceName,
} from "@/lib/team-comp/buffDisplayUtils";
import type {
  BuffActivationMap,
  DisplayPart,
  ResolvedBuff,
  ResolvedStatEntry,
  StatKey,
} from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { useBuffOverrideStore } from "@/stores/useBuffOverrideStore";
import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getTemplateName } from "./FormulaBreakdown";

type Props = {
  parts: DisplayPart[];
  formulaKey: string;
  buffs: ResolvedBuff[];
  defaultActivation?: BuffActivationMap;
  t: ReturnType<typeof useLanguage>["t"];
  /** Which tab to open by default (part index). */
  initialTab?: number;
  /**
   * Combo mode: total repetitions of this formula across all combo lines.
   * When set, slider max = partHits × comboCount instead of partHits.
   * Store key uses comboKey instead of formulaKey.
   */
  comboCount?: number;
  /** Combo store key (e.g. "combo:myCombo:ganyu.charged"). Required when comboCount is set. */
  comboKey?: string;
};

// ─── Tab Content (per part) ──────────────────────────────────────────────────

function PartTab({
  part,
  partIndex,
  formulaKey,
  buffs,
  defaultActivation,
  t,
  comboCount,
  comboKey,
}: {
  part: DisplayPart;
  partIndex: number;
  formulaKey: string;
  buffs: ResolvedBuff[];
  defaultActivation?: BuffActivationMap;
  t: ReturnType<typeof useLanguage>["t"];
  comboCount?: number;
  comboKey?: string;
}) {
  const hits = part.hits ?? 1;
  const isCombo = comboCount != null && comboCount > 1 && comboKey;
  const sliderMax = isCombo ? hits * comboCount : hits;
  const overrides = useBuffOverrideStore((s) =>
    isCombo ? s.comboOverrides[comboKey] : s.overrides[formulaKey]
  );
  const storeSetHits = useBuffOverrideStore((s) =>
    isCombo ? s.setComboHits : s.setHits
  );
  const storeClearHits = useBuffOverrideStore((s) =>
    isCombo ? s.clearComboHits : s.clearHits
  );
  const storeKey = isCombo ? comboKey : formulaKey;

  // Filter to buffs active for THIS part (per-part tag resolution)
  const applicableBuffs = useMemo(() => {
    const pi = part.sourcePartIndex ?? partIndex;
    return buffs.filter(
      (b) =>
        b.active &&
        !b.bespokeLabel &&
        (b.activePartIndices === undefined || b.activePartIndices.includes(pi))
    );
  }, [buffs, part.sourcePartIndex, partIndex]);

  // Group buffs by provider character (resonance buffs grouped separately)
  const groupedBuffs = useMemo(() => {
    const groups: { key: string; buffs: ResolvedBuff[] }[] = [];
    const seen = new Map<string, ResolvedBuff[]>();
    for (const b of applicableBuffs) {
      const gKey = b.providerCharId ?? "resonance";
      let group = seen.get(gKey);
      if (!group) {
        group = [];
        seen.set(gKey, group);
        groups.push({ key: gKey, buffs: group });
      }
      group.push(b);
    }
    return groups;
  }, [applicableBuffs]);

  if (applicableBuffs.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        {t.ui("teamComp.emptyBuffMsg")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-1">
      {groupedBuffs.map((group) => (
        <div
          key={group.key}
          className="rounded-lg border border-emerald-600/50 xl:grid xl:grid-cols-2 xl:gap-x-2"
        >
          {group.buffs.map((buff, bi) => {
            const bKey = buff.buffKey;
            // Cap slider range for stack-limited buffs
            const effectiveMax =
              buff.source.maxStacks != null
                ? Math.min(sliderMax, buff.source.maxStacks)
                : sliderMax;
            const defaultHits =
              defaultActivation?.[bKey]?.[partIndex] ?? effectiveMax;
            const currentHits = overrides?.[bKey]?.[partIndex] ?? defaultHits;
            const isDefault = overrides?.[bKey]?.[partIndex] === undefined;

            const icon = getSourceIcon(buff.source);
            const name = getSourceName(buff.source, t);
            const filterDesc = formatFilter(buff.target, t);
            const allEntries: StatEntryData[] = [
              ...buff.staticEntries.map((e) => ({
                key: e.key,
                value: e.value,
              })),
              ...buff.dynamicEntries.map((e: ResolvedStatEntry) => ({
                key: e.key,
                value: e.value,
                inputKey: e.inputKey,
                cap: e.cap,
                minValue: e.minValue,
                maxValue: e.maxValue,
              })),
            ];

            const receiverLabel = formatReceiverLabel(buff.target, t);

            return (
              <div
                key={`${bKey}:${bi}`}
                className={cn(
                  "py-2.5 px-2 space-y-1.5 border-b border-emerald-600/15 last:border-b-0",
                  !isDefault && "bg-primary/5"
                )}
              >
                {/* Row 1: icon, name, origin, receiver */}
                <div className="flex items-center flex-wrap gap-x-1 gap-y-1">
                  {icon && (
                    <img
                      src={getAssetUrl(icon)}
                      className="w-5 h-5 object-contain rounded-full bg-secondary/80 outline outline-1 outline-border/50 shrink-0"
                      alt=""
                    />
                  )}
                  <span className="text-sm font-bold text-foreground truncate">
                    {name}
                  </span>
                  {buff.source.origin && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none shrink-0">
                      {t.origin(buff.source.origin)}
                    </span>
                  )}
                  {buff.source.triggers?.map((trig) => (
                    <span
                      key={trig}
                      className="text-xs font-medium text-primary bg-primary/10 px-1 py-0.5 rounded leading-none shrink-0"
                    >
                      {trig}
                    </span>
                  ))}
                  <span
                    className={cn(
                      "ml-auto text-xs font-bold uppercase px-1.5 py-0.5 rounded shrink-0",
                      getReceiverBadgeClasses(buff.target)
                    )}
                  >
                    {receiverLabel}
                  </span>
                </div>

                {/* Row 2: tag filters (smaller, italic) */}
                {filterDesc && (
                  <div className="text-[11px] italic text-muted-foreground pl-2">
                    [{filterDesc}]
                  </div>
                )}

                {/* Row 3: stat entries + activation control */}
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 pl-2">
                  {/* Stat entries */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 flex-1">
                    {allEntries.map((entry, i) => (
                      <StatEntryRow
                        key={`${entry.key}-${i}`}
                        entry={entry}
                        t={t}
                      />
                    ))}
                  </div>

                  {/* Activation control */}
                  {effectiveMax === 1 ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={currentHits > 0}
                        onCheckedChange={(checked) =>
                          storeSetHits(
                            storeKey,
                            bKey,
                            partIndex,
                            checked ? 1 : 0
                          )
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0 w-28">
                      <Slider
                        min={0}
                        max={effectiveMax}
                        step={1}
                        value={[Math.min(currentHits, effectiveMax)]}
                        onValueChange={([v]) =>
                          storeSetHits(storeKey, bKey, partIndex, v!)
                        }
                        className="flex-1"
                      />
                      <span className="text-[10px] tabular-nums text-foreground text-right">
                        {Math.min(currentHits, effectiveMax)}/{effectiveMax}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={isDefault}
                    className="text-[10px] text-primary hover:text-primary/80 shrink-0 disabled:opacity-30 disabled:cursor-default disabled:hover:text-primary"
                    onClick={() => storeClearHits(storeKey, bKey, partIndex)}
                  >
                    {t.ui("common.reset")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function PartBuffDialog({
  parts,
  formulaKey,
  buffs,
  defaultActivation,
  t,
  initialTab = 0,
  comboCount,
  comboKey,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const isCombo = comboCount != null && comboCount > 1 && comboKey;
  const overrides = useBuffOverrideStore((s) =>
    isCombo ? s.comboOverrides[comboKey] : s.overrides[formulaKey]
  );

  // Check if THIS part has any applicable buffs (per-part filter)
  const thisPart = parts[initialTab ?? 0];
  const thisPartIdx = thisPart?.sourcePartIndex ?? initialTab ?? 0;
  const applicableBuffs = useMemo(
    () =>
      buffs.filter(
        (b) =>
          b.active &&
          !b.bespokeLabel &&
          (b.activePartIndices === undefined ||
            b.activePartIndices.includes(thisPartIdx))
      ),
    [buffs, thisPartIdx]
  );

  if (applicableBuffs.length === 0) return null;

  // Show dot when THIS part has a buff not at full activation
  const hasOverrides =
    thisPart?.partialBuffs != null && thisPart.partialBuffs.length > 0;

  return (
    <>
      <button
        type="button"
        className="relative p-0.5 rounded hover:bg-muted/50 transition-colors"
        aria-label={t.ui("teamComp.buffActivation")}
        onClick={() => {
          setActiveTab(initialTab);
          setOpen(true);
        }}
      >
        <Settings2 className="w-4 h-4 text-foreground/60 hover:text-foreground transition-colors" />
        {hasOverrides && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
        )}
      </button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="sm:max-w-lg xl:max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t.ui("teamComp.buffActivation")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription asChild>
              <span className="text-xs text-muted-foreground">
                {t.ui("teamComp.buffActivationDesc")}
              </span>
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* Part tabs */}
          {parts.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
              {parts.map((p, idx) => {
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cn(
                      "text-xs px-2.5 py-1.5 rounded-md border whitespace-nowrap transition-colors",
                      activeTab === idx
                        ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                        : "border-border/30 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border/50"
                    )}
                    onClick={() => setActiveTab(idx)}
                  >
                    {idx + 1}. {getTemplateName(p, t)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Active tab content */}
          <div className="max-h-[50vh] overflow-y-auto">
            {parts[activeTab] && (
              <PartTab
                part={parts[activeTab]}
                partIndex={parts[activeTab].sourcePartIndex ?? activeTab}
                formulaKey={formulaKey}
                buffs={buffs}
                defaultActivation={defaultActivation}
                t={t}
                comboCount={comboCount}
                comboKey={comboKey}
              />
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
