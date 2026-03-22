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
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import type {
  BuffActivationMap,
  BuffTarget,
  DisplayPart,
  ResolvedBuff,
  ResolvedStatEntry,
  StatKey,
} from "@/lib/team-comp/types";
import { buffSourceKey } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { useBuffOverrideStore } from "@/stores/useBuffOverrideStore";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getTemplateName } from "./FormulaBreakdown";
import { fmtOrigin, fmtStat } from "./displayFormatters";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSourceIcon(source: ResolvedBuff["source"]): string | undefined {
  if (source.type === "character") return charactersById[source.id]?.imagePath;
  if (source.type === "weapon") return weaponsById[source.id]?.imagePath;
  if (source.type === "artifactSet")
    return artifactsById[source.id]?.imagePaths?.flower;
  if (source.type === "artifactHalfSet")
    return artifactsById[artifactHalfSetsById[source.id]?.setIds[0] ?? ""]
      ?.imagePaths?.flower;
  return undefined;
}

function getSourceName(
  source: ResolvedBuff["source"],
  t: ReturnType<typeof useLanguage>["t"]
): string {
  switch (source.type) {
    case "character":
      return t.character(source.id);
    case "weapon":
      return t.weaponName(source.id);
    case "artifactSet":
      return t.artifact(source.id);
    case "artifactHalfSet": {
      const setId = artifactHalfSetsById[source.id]?.setIds[0];
      return setId ? t.artifact(setId) : source.id;
    }
    case "teamResonance":
      return t.resonance(source.id) || t.ui("teamComp.teamResonance");
    default:
      return source.id;
  }
}

const RECEIVER_I18N: Record<string, string> = {
  self: "teamComp.receiverSelf",
  selfOnField: "teamComp.receiverSelfOnField",
  selfOffField: "teamComp.receiverSelfOffField",
  other: "teamComp.receiverOther",
  otherOnField: "teamComp.receiverOtherOnField",
  onField: "teamComp.receiverOnField",
  team: "teamComp.receiverTeam",
};

function formatFilter(
  target: BuffTarget,
  t: ReturnType<typeof useLanguage>["t"]
): string | null {
  const filter = target.filter;
  const parts: string[] = [];
  if (filter) {
    if (filter.abilities?.length)
      parts.push(...filter.abilities.map((a) => t.ability(a)));
    if (filter.elements?.length)
      parts.push(...filter.elements.map((e) => t.element(e)));
    if (filter.reactions?.length)
      parts.push(...filter.reactions.map((r) => t.reaction(r)));
  }
  if (target.regions?.length)
    parts.push(...target.regions.map((r) => t.region(r)));
  if (target.factions?.length)
    parts.push(...target.factions.map((f) => t.faction(f)));
  return parts.length > 0 ? parts.join(" / ") : null;
}

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

  const applicableBuffs = useMemo(
    () => buffs.filter((b) => b.active && !b.bespokeLabel),
    [buffs]
  );

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
        {t.ui("teamComp.emptyBuffMessage")}
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
            const bKey = buffSourceKey(buff.source);
            const defaultHits =
              defaultActivation?.[bKey]?.[partIndex] ?? sliderMax;
            const currentHits = overrides?.[bKey]?.[partIndex] ?? defaultHits;
            const isDefault = overrides?.[bKey]?.[partIndex] === undefined;

            const icon = getSourceIcon(buff.source);
            const name = getSourceName(buff.source, t);
            const filterDesc = formatFilter(buff.target, t);
            const allEntries: {
              key: string;
              value: number;
              inputKey?: StatKey;
              cap?: number;
            }[] = [
              ...buff.staticEntries.map((e) => ({
                key: e.key,
                value: e.value,
              })),
              ...buff.dynamicEntries.map((e: ResolvedStatEntry) => ({
                key: e.key,
                value: e.value,
                inputKey: e.inputKey,
                cap: e.cap,
              })),
            ];

            const receiverLabel = buff.target.charId
              ? t.character(buff.target.charId)
              : t.ui(
                  RECEIVER_I18N[buff.target.receiver] ?? "teamComp.receiverSelf"
                );

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
                      {fmtOrigin(buff.source.origin, t.lang)}
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
                      buff.target.charId
                        ? "text-sky-300 bg-sky-500/15"
                        : buff.target.receiver === "team"
                          ? "text-rose-300 bg-rose-500/15"
                          : buff.target.receiver === "onField"
                            ? "text-orange-300 bg-orange-500/15"
                            : buff.target.receiver === "other"
                              ? "text-amber-300 bg-amber-500/15"
                              : buff.target.receiver === "otherOnField"
                                ? "text-yellow-300 bg-yellow-500/15"
                                : buff.target.receiver === "self"
                                  ? "text-zinc-400 bg-zinc-500/15"
                                  : buff.target.receiver === "selfOnField"
                                    ? "text-slate-400 bg-slate-500/10"
                                    : buff.target.receiver === "selfOffField"
                                      ? "text-stone-400 bg-stone-500/10"
                                      : "text-muted-foreground bg-black/10"
                    )}
                  >
                    {receiverLabel}
                  </span>
                </div>

                {/* Row 2: tag filters (smaller, italic) */}
                {filterDesc && (
                  <div className="text-[11px] italic text-muted-foreground pl-7">
                    [{filterDesc}]
                  </div>
                )}

                {/* Row 3: stat entries + activation control */}
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 pl-7">
                  {/* Stat entries */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 flex-1">
                    {allEntries.map((entry, i) => (
                      <div
                        key={`${entry.key}-${i}`}
                        className="flex items-center gap-1 text-xs bg-black/5 px-1 rounded"
                      >
                        <span className="font-semibold text-foreground/80">
                          {t.statShort(entry.key as StatKey)}
                        </span>
                        {entry.inputKey && (
                          <span className="flex items-center text-muted-foreground text-[10px]">
                            <ArrowUpRight className="w-3 h-3 opacity-70" />
                            {t.statShort(entry.inputKey as StatKey)}
                          </span>
                        )}
                        <span
                          className={cn(
                            "font-mono font-bold tabular-nums",
                            entry.value > 0
                              ? "text-green-500 dark:text-green-400"
                              : "text-red-500 dark:text-red-400"
                          )}
                        >
                          {fmtStat(entry.key, entry.value, true)}
                        </span>
                        {entry.cap !== undefined && (
                          <span className="font-mono font-bold text-[10px] text-orange-500 dark:text-orange-400">
                            / {fmtStat(entry.key, entry.cap)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Activation control */}
                  {sliderMax === 1 ? (
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
                        max={sliderMax}
                        step={1}
                        value={[currentHits]}
                        onValueChange={([v]) =>
                          storeSetHits(storeKey, bKey, partIndex, v!)
                        }
                        className="flex-1"
                      />
                      <span className="text-[10px] tabular-nums text-muted-foreground min-w-[2.5rem] text-right">
                        {currentHits}/{sliderMax}
                      </span>
                    </div>
                  )}
                  {!isDefault && (
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:text-primary/80 shrink-0"
                      onClick={() => storeClearHits(storeKey, bKey, partIndex)}
                    >
                      {t.ui("common.reset")}
                    </button>
                  )}
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

  const applicableBuffs = useMemo(
    () => buffs.filter((b) => b.active && !b.bespokeLabel),
    [buffs]
  );

  if (applicableBuffs.length === 0) return null;

  // Check if any overrides exist (indicator dot)
  const hasOverrides = applicableBuffs.some((b) => {
    const bKey = buffSourceKey(b.source);
    const partOverrides = overrides?.[bKey];
    return partOverrides && Object.keys(partOverrides).length > 0;
  });

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
        <Settings2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
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
                const partOverrides = applicableBuffs.some((b) => {
                  const bKey = buffSourceKey(b.source);
                  return (
                    overrides?.[bKey]?.[p.sourcePartIndex ?? idx] !== undefined
                  );
                });
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cn(
                      "text-xs px-2.5 py-1.5 rounded-md border whitespace-nowrap transition-colors relative",
                      activeTab === idx
                        ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                        : "border-border/30 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border/50"
                    )}
                    onClick={() => setActiveTab(idx)}
                  >
                    {idx + 1}. {getTemplateName(p, t)}
                    {partOverrides && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
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
                buffs={applicableBuffs}
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
