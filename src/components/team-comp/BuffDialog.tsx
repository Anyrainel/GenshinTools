/**
 * Per-buff activation dialog.
 *
 * Inverted view of PartBuffDialog: shows one buff across all formulas/parts
 * instead of one part across all buffs.  Both dialogs read/write the same
 * useBuffOverrideStore so changes are reflected immediately in either view.
 *
 * Outer shell (header → tabs → scrollable content) mirrors PartBuffDialog.
 */

import { Settings2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { getReceiverColor } from "@/components/shared/colors";
import { StatEntryRow } from "@/components/team-comp/StatEntryRow";
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
import { charactersById } from "@/data/gameResources";
import {
  useBuffFilterLabel,
  useBuffReceiverLabel,
  useBuffSourceName,
  useTemplateName,
} from "@/hooks/useBuffLabels";
import type {
  BuffActivationMap,
  DisplayPart,
  ResolvedBuff,
  ResolvedStatEntry,
} from "@/lib/dmgcalc/types";
import { getSourceIcon } from "@/lib/team-comp/buffDisplayUtils";
import { cn, getAssetUrl } from "@/lib/utils";
import { useBuffOverrideStore } from "@/stores/useBuffOverrideStore";

export type BuffLedgerFormula = {
  formulaKey: string;
  parts: DisplayPart[];
  defaultActivation?: BuffActivationMap;
  comboCount?: number;
  comboKey?: string;
  /** I18n label for the formula name (from teamBuild.getFormulaIds()). */
  formulaLabel?: Record<string, string>;
  /**
   * Per-buff part applicability resolved for THIS formula.
   * Maps buff instance keys → activePartIndices (undefined = all parts).
   * When set, FormulaBlock uses this instead of buff.activePartIndices
   * (which is only valid for the formula it was resolved against).
   */
  buffApplicability?: Record<string, number[] | undefined>;
};

type Props = {
  buff: ResolvedBuff;
  formulas: BuffLedgerFormula[];
  t: ReturnType<typeof useLanguage>["t"];
};

// ─── Per-formula block (inside a character tab) ─────────────────────────────

function FormulaBlock({
  formula,
  bKey,
  buff,
  t,
}: {
  formula: BuffLedgerFormula;
  bKey: string;
  buff: ResolvedBuff;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const templateName = useTemplateName();
  const {
    formulaKey,
    parts,
    defaultActivation,
    comboCount,
    comboKey,
    formulaLabel,
    buffApplicability,
  } = formula;
  // Route to comboOverrides whenever comboKey is provided. See PartBuffDialog
  // for the same rationale: single-mode writes must land in comboOverrides
  // (comboId="__single__") since the damage-calc path only reads from there.
  const isCombo = comboKey != null;
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

  // Per-formula applicability: if the map exists but doesn't contain this buff
  // key, the buff is not active for this formula at all (e.g. self-buff on
  // another character's formula).
  const hasApplicabilityMap = buffApplicability != null;
  const applicableIndices = hasApplicabilityMap
    ? buffApplicability[bKey]
    : buff.activePartIndices;
  // null sentinel = buff absent from map → not applicable
  const notApplicable = hasApplicabilityMap && !(bKey in buffApplicability);

  // Filter parts where this buff applies
  const applicableParts = useMemo(() => {
    if (notApplicable) return [];
    return parts
      .map((p, idx) => ({ part: p, partIndex: p.sourcePartIndex ?? idx }))
      .filter(({ partIndex }) => {
        if (applicableIndices === undefined) return true;
        return applicableIndices.includes(partIndex);
      });
  }, [parts, applicableIndices, notApplicable]);

  if (applicableParts.length === 0) return null;

  return (
    <div className="rounded-lg border border-emerald-600/50">
      {/* Formula name header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-black/10 border-b border-emerald-600/15">
        {(() => {
          const [charId] = formulaKey.split(".");
          const charData = charactersById[charId];
          return charData ? (
            <img
              src={getAssetUrl(charData.imagePath)}
              alt=""
              className="w-4 h-4 object-contain rounded-full bg-secondary/50 shrink-0"
            />
          ) : null;
        })()}
        <span className="text-xs md:text-sm font-semibold text-foreground truncate">
          {formulaLabel ? t.resolveLabel(formulaLabel) : formulaKey}
        </span>
        {comboCount != null && comboCount > 1 && (
          <span className="text-[10px] md:text-xs font-bold text-primary bg-primary/10 px-1 rounded leading-none">
            ×{comboCount}
          </span>
        )}
      </div>

      {/* Part rows */}
      {applicableParts.map(({ part, partIndex }) => {
        const hits = part.hits ?? 1;
        const sliderMax =
          isCombo && comboCount != null ? hits * comboCount : hits;
        const effectiveMax =
          buff.source.maxStacks != null
            ? Math.min(sliderMax, buff.source.maxStacks)
            : sliderMax;
        const defaultHits =
          defaultActivation?.[bKey]?.[partIndex] ?? effectiveMax;
        const currentHits = overrides?.[bKey]?.[partIndex] ?? defaultHits;
        const isDefault = overrides?.[bKey]?.[partIndex] === undefined;

        return (
          <div
            key={partIndex}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 border-b border-emerald-600/15 last:border-b-0",
              !isDefault && "bg-primary/5"
            )}
          >
            {/* Part name */}
            <span className="text-xs text-foreground/80 min-w-0 flex-1 truncate">
              {parts.length > 1
                ? `${partIndex + 1}. ${templateName(part)}`
                : templateName(part)}
            </span>

            {/* Activation control */}
            {effectiveMax === 1 ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Switch
                  checked={currentHits > 0}
                  onCheckedChange={(checked) =>
                    storeSetHits(storeKey, bKey, partIndex, checked ? 1 : 0)
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
                <span className="text-[10px] md:text-xs tabular-nums text-foreground text-right">
                  {Math.min(currentHits, effectiveMax)}/{effectiveMax}
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={isDefault}
              className="text-[10px] md:text-xs text-primary hover:text-primary/80 shrink-0 disabled:opacity-30 disabled:cursor-default disabled:hover:text-primary"
              onClick={() => storeClearHits(storeKey, bKey, partIndex)}
            >
              {t.ui("common.reset")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab content (all formulas for one character) ───────────────────────────

function CharTab({
  charFormulas,
  bKey,
  buff,
  t,
}: {
  charFormulas: BuffLedgerFormula[];
  bKey: string;
  buff: ResolvedBuff;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="flex flex-col gap-2 py-1">
      {charFormulas.map((formula) => (
        <FormulaBlock
          key={formula.formulaKey}
          formula={formula}
          bKey={bKey}
          buff={buff}
          t={t}
        />
      ))}
    </div>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function BuffDialog({ buff, formulas, t }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const bKey = buff.buffKey;
  const sourceName = useBuffSourceName();
  const receiverLabel = useBuffReceiverLabel();
  const filterLabel = useBuffFilterLabel();
  const name = sourceName(buff.source);

  // Group applicable formulas by character (using per-formula applicability)
  const groupedByChar = useMemo(() => {
    const applicable = formulas.filter((f) => {
      // If the formula has per-formula applicability but this buff isn't in it,
      // the buff doesn't apply to this formula at all.
      if (f.buffApplicability != null && !(bKey in f.buffApplicability))
        return false;
      const indices = f.buffApplicability?.[bKey] ?? buff.activePartIndices;
      return f.parts.some((p, idx) => {
        const pi = p.sourcePartIndex ?? idx;
        if (indices === undefined) return true;
        return indices.includes(pi);
      });
    });
    const groups: { charId: string; formulas: BuffLedgerFormula[] }[] = [];
    const seen = new Map<string, BuffLedgerFormula[]>();
    for (const f of applicable) {
      const [charId] = f.formulaKey.split(".");
      let group = seen.get(charId);
      if (!group) {
        group = [];
        seen.set(charId, group);
        groups.push({ charId, formulas: group });
      }
      group.push(f);
    }
    return groups;
  }, [formulas, bKey, buff.activePartIndices]);

  // Collect all applicable formula+part pairs for the toggle-all button
  const allApplicable = useMemo(() => {
    const items: {
      formula: BuffLedgerFormula;
      partIndex: number;
      effectiveMax: number;
    }[] = [];
    for (const group of groupedByChar) {
      for (const f of group.formulas) {
        const indices = f.buffApplicability?.[bKey] ?? buff.activePartIndices;
        for (let idx = 0; idx < f.parts.length; idx++) {
          const pi = f.parts[idx].sourcePartIndex ?? idx;
          if (indices !== undefined && !indices.includes(pi)) continue;
          const hits = f.parts[idx].hits ?? 1;
          const isCombo = f.comboKey != null;
          const sliderMax =
            isCombo && f.comboCount != null ? hits * f.comboCount : hits;
          const effectiveMax =
            buff.source.maxStacks != null
              ? Math.min(sliderMax, buff.source.maxStacks)
              : sliderMax;
          items.push({ formula: f, partIndex: pi, effectiveMax });
        }
      }
    }
    return items;
  }, [groupedByChar, bKey, buff.activePartIndices, buff.source.maxStacks]);

  // Read all relevant overrides to determine if any hit is activated
  const allOverrides = useBuffOverrideStore((s) => {
    for (const { formula, partIndex, effectiveMax } of allApplicable) {
      const isCombo = formula.comboKey != null;
      const storeKey = isCombo ? formula.comboKey! : formula.formulaKey;
      const map = isCombo ? s.comboOverrides[storeKey] : s.overrides[storeKey];
      const currentHits =
        map?.[bKey]?.[partIndex] ??
        formula.defaultActivation?.[bKey]?.[partIndex] ??
        effectiveMax;
      if (currentHits > 0) return true;
    }
    return false;
  });
  const anyActivated = allOverrides;

  const setHits = useBuffOverrideStore((s) => s.setHits);
  const setComboHits = useBuffOverrideStore((s) => s.setComboHits);
  const clearHits = useBuffOverrideStore((s) => s.clearHits);
  const clearComboHits = useBuffOverrideStore((s) => s.clearComboHits);

  const handleToggleAll = useCallback(() => {
    for (const { formula, partIndex } of allApplicable) {
      const isCombo = formula.comboKey != null;
      const storeKey = isCombo ? formula.comboKey! : formula.formulaKey;
      if (anyActivated) {
        // Disable all: set every part to 0
        (isCombo ? setComboHits : setHits)(storeKey, bKey, partIndex, 0);
      } else {
        // Enable all: clear overrides to restore defaults
        (isCombo ? clearComboHits : clearHits)(storeKey, bKey, partIndex);
      }
    }
  }, [
    anyActivated,
    allApplicable,
    bKey,
    setHits,
    setComboHits,
    clearHits,
    clearComboHits,
  ]);

  if (groupedByChar.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="p-0.5 rounded hover:bg-muted/50 transition-colors shrink-0"
        aria-label={t.ui("teamComp.buffActivation")}
        onClick={(e) => {
          e.stopPropagation();
          setActiveTab(0);
          setOpen(true);
        }}
      >
        <Settings2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-foreground/50 hover:text-foreground transition-colors" />
      </button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="sm:max-w-lg xl:max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t.ui("teamComp.buffActivation")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription asChild>
              <div className="flex flex-col gap-1.5 md:pt-2">
                {/* Buff identity: icon, name, origin, triggers, receiver */}
                <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1">
                  {(() => {
                    const icon = getSourceIcon(buff.source);
                    return icon ? (
                      <img
                        src={getAssetUrl(icon)}
                        className="w-5 h-5 object-contain rounded-full bg-secondary/80 outline outline-1 outline-border/50 shrink-0"
                        alt=""
                      />
                    ) : null;
                  })()}
                  <span className="text-sm font-bold text-foreground">
                    {name}
                  </span>
                  {buff.source.origin && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none">
                      {t.origin(buff.source.origin)}
                    </span>
                  )}
                  {buff.source.triggers?.map((trig) => (
                    <span
                      key={trig}
                      className="text-xs font-medium text-primary bg-primary/10 px-1 py-0.5 rounded leading-none"
                    >
                      {trig}
                    </span>
                  ))}
                  <span
                    className={cn(
                      "ml-auto text-[10px] md:text-xs font-bold uppercase px-1.5 py-0.5 rounded shrink-0",
                      getReceiverColor(
                        buff.target.receiver,
                        !!buff.target.charId
                      )
                    )}
                  >
                    {receiverLabel(buff.target)}
                  </span>
                </div>
                {/* Stat entries */}
                <div className="flex flex-wrap items-center gap-1">
                  {[
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
                  ].map((entry, i) => (
                    <StatEntryRow key={i} entry={entry} />
                  ))}
                  {buff.source.maxStacks != null && (
                    <span className="text-[11px] md:text-xs font-medium text-teal-400 bg-teal-500/15 px-1.5 py-0.5 rounded">
                      {buff.bespokeLabel
                        ? t.format("teamComp.nTimes", 1)
                        : t.format("teamComp.nStacks", buff.source.maxStacks)}
                    </span>
                  )}
                  {(() => {
                    const filterDesc = filterLabel(buff.target);
                    return filterDesc ? (
                      <span className="text-[11px] md:text-xs italic text-muted-foreground">
                        [{filterDesc}]
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* Character tabs + toggle-all */}
          <div className="flex items-center gap-1 pb-1 -mx-1 px-1">
            <div className="flex gap-1 overflow-x-auto flex-1">
              {groupedByChar.map(({ charId }, idx) => {
                const charData = charactersById[charId];
                return (
                  <button
                    key={charId}
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 text-xs md:text-sm px-2.5 py-1.5 rounded-md border whitespace-nowrap transition-colors",
                      activeTab === idx
                        ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                        : "border-border/30 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border/50"
                    )}
                    onClick={() => setActiveTab(idx)}
                  >
                    {charData && (
                      <img
                        src={getAssetUrl(charData.imagePath)}
                        alt={charId}
                        className="w-4 h-4 object-contain rounded-full bg-secondary/50"
                      />
                    )}
                    {t.character(charId)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={cn(
                "text-xs md:text-sm px-2 py-1.5 rounded-md border whitespace-nowrap transition-colors shrink-0",
                anyActivated
                  ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                  : "border-primary/40 text-primary hover:bg-primary/10"
              )}
              onClick={handleToggleAll}
            >
              {anyActivated
                ? t.ui("teamComp.disableAll")
                : t.ui("teamComp.enableAll")}
            </button>
          </div>

          {/* Active tab content */}
          <div className="max-h-[50vh] overflow-y-auto">
            {groupedByChar[activeTab] && (
              <CharTab
                charFormulas={groupedByChar[activeTab].formulas}
                bKey={bKey}
                buff={buff}
                t={t}
              />
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
