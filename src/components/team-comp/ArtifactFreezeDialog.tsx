import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSortableStatsForSlot } from "@/data/constants";
import type { AccountData, ArtifactData, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { fmtStat } from "@/lib/team-comp/displayFormatters";
import { cn, getRarityColor } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { Check, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";

interface ArtifactFreezeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Collect every artifact from account data (equipped + inventory). */
function getAllArtifacts(accountData: AccountData): ArtifactData[] {
  const artifacts: ArtifactData[] = [];
  for (const char of accountData.characters) {
    for (const slot of allSlots) {
      const art = char.artifacts[slot];
      if (art) artifacts.push(art);
    }
  }
  for (const art of accountData.extraArtifacts) {
    artifacts.push(art);
  }
  return artifacts;
}

function getStatValue(art: ArtifactData, stat: string): number {
  if (art.mainStatKey === stat) return 10000 + art.level;
  return (art.substats as Record<string, number | undefined>)?.[stat] ?? 0;
}

function sortByStats(
  items: ArtifactData[],
  sortStats: (string | null)[]
): ArtifactData[] {
  const activeStats = sortStats.filter((s): s is string => s != null);
  if (activeStats.length === 0) return items;

  return [...items].sort((a, b) => {
    const countA = activeStats.filter((s) => getStatValue(a, s) > 0).length;
    const countB = activeStats.filter((s) => getStatValue(b, s) > 0).length;
    if (countB !== countA) return countB - countA;

    for (const stat of activeStats) {
      const valA = getStatValue(a, stat);
      const valB = getStatValue(b, stat);
      if (valB !== valA) return valB - valA;
    }
    return 0;
  });
}

export function ArtifactFreezeDialog({
  open,
  onOpenChange,
}: ArtifactFreezeDialogProps) {
  const { t } = useLanguage();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const frozenArtifactIds = useFreezeStore((s) => s.frozenArtifactIds);
  const getFrozenArtifactIds = useFreezeStore((s) => s.getFrozenArtifactIds);
  const freezeArtifact = useFreezeStore((s) => s.freezeArtifact);

  const [activeSlot, setActiveSlot] = useState<Slot>(allSlots[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortStats, setSortStats] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  // Stats available for sorting, scoped to the active slot
  const sortableStats = useMemo(
    () => getSortableStatsForSlot(activeSlot),
    [activeSlot]
  );

  const handleSlotChange = (slot: Slot) => {
    setActiveSlot(slot);
    // Keep sort selections that are still valid for the new slot, drop invalid ones
    const newPool = new Set(getSortableStatsForSlot(slot));
    setSortStats((prev) => {
      const next: (string | null)[] = [];
      for (const s of prev) {
        if (s != null && newPool.has(s)) next.push(s);
      }
      while (next.length < 4) next.push(null);
      return next;
    });
  };

  // All frozen artifact IDs (team-based + standalone).
  // frozenArtifactIds is not used in the callback but is listed to trigger
  // recomputation when standalone freezes change.
  const allFrozenIds = useMemo(
    () => getFrozenArtifactIds(),
    // biome-ignore lint/correctness/useExhaustiveDependencies: frozenArtifactIds triggers recompute
    [getFrozenArtifactIds, frozenArtifactIds]
  );

  // Build full inventory, grouped by slot
  const inventoryBySlot = useMemo(() => {
    if (!accountData) return {} as Record<Slot, ArtifactData[]>;
    const all = getAllArtifacts(accountData);
    const bySlot: Record<string, ArtifactData[]> = {};
    for (const slot of allSlots) bySlot[slot] = [];
    for (const art of all) {
      const slot = art.slotKey as Slot;
      if (bySlot[slot]) bySlot[slot].push(art);
    }
    // Default sort per slot: rarity desc → level desc → set name
    for (const slot of allSlots) {
      bySlot[slot].sort((a, b) => {
        if (b.rarity !== a.rarity) return b.rarity - a.rarity;
        if (b.level !== a.level) return b.level - a.level;
        return a.setKey.localeCompare(b.setKey);
      });
    }
    return bySlot as Record<Slot, ArtifactData[]>;
  }, [accountData]);

  // Apply stat-based sorting
  const hasActiveSorts = sortStats.some((s) => s != null);
  const displayArtifacts = useMemo(() => {
    const base = inventoryBySlot[activeSlot] ?? [];
    return hasActiveSorts ? sortByStats(base, sortStats) : base;
  }, [inventoryBySlot, activeSlot, hasActiveSorts, sortStats]);

  const activeStats = useMemo(
    () => sortStats.filter((s): s is string => s != null),
    [sortStats]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFreezeSelected = () => {
    for (const id of selectedIds) {
      freezeArtifact(id);
    }
    setSelectedIds(new Set());
  };

  const updateSort = (index: number, value: string | null) => {
    setSortStats((prev) => {
      const next = [...prev];
      next[index] = value;
      for (let i = index + 1; i < next.length; i++) next[i] = null;
      return next;
    });
  };

  const usedStats = new Set(sortStats.filter((s): s is string => s != null));
  const SORT_LABELS = ["1st", "2nd", "3rd", "4th"];

  const selectedCount = selectedIds.size;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-cyan-400" />
            {t.ui("teamComp.freezeArtifact")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription asChild>
            <span>{t.ui("teamComp.freezeArtifactDesc")}</span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Sort controls */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {t.ui("teamComp.swapSortBy")}
          </span>
          {sortStats.map((currentVal, idx) => {
            const isEnabled = idx === 0 || sortStats[idx - 1] != null;
            const availableStats = sortableStats.filter(
              (s) => s === currentVal || !usedStats.has(s)
            );
            return (
              <div key={idx} className="flex items-center gap-1">
                <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 text-right">
                  {SORT_LABELS[idx]}
                </span>
                <LightweightSelect
                  value={currentVal ?? "__none__"}
                  onValueChange={(v) =>
                    updateSort(idx, v === "__none__" ? null : v)
                  }
                  disabled={!isEnabled}
                >
                  <LightweightSelectTrigger
                    className={cn(
                      "w-24 font-medium",
                      !currentVal && "text-muted-foreground"
                    )}
                  >
                    <LightweightSelectValue
                      placeholder={t.ui("teamComp.swapSortPlaceholder")}
                    />
                  </LightweightSelectTrigger>
                  <LightweightSelectContent>
                    <LightweightSelectItem value="__none__">
                      {t.ui("teamComp.swapSortPlaceholder")}
                    </LightweightSelectItem>
                    {availableStats.map((s) => (
                      <LightweightSelectItem key={s} value={s}>
                        {t.statShort(s)}
                      </LightweightSelectItem>
                    ))}
                  </LightweightSelectContent>
                </LightweightSelect>
              </div>
            );
          })}
        </div>

        {/* Freeze action bar */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <span className="text-sm text-cyan-300 font-medium">
              {t.format("teamComp.freezeNSelected", selectedCount)}
            </span>
            <button
              type="button"
              onClick={handleFreezeSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-600 text-white hover:bg-cyan-500 transition-colors text-xs font-bold cursor-pointer"
            >
              <Snowflake className="w-3.5 h-3.5" />
              {t.ui("teamComp.freezeSelected")}
            </button>
          </div>
        )}

        {/* 5 slot tabs */}
        <Tabs
          value={activeSlot}
          onValueChange={(v) => handleSlotChange(v as Slot)}
        >
          <TabsList className="w-full">
            {allSlots.map((slot) => (
              <TabsTrigger key={slot} value={slot} className="flex-1 text-xs">
                {t.slot(slot)}
              </TabsTrigger>
            ))}
          </TabsList>

          {allSlots.map((slot) => (
            <TabsContent
              key={slot}
              value={slot}
              className="max-h-[50vh] overflow-y-auto mt-2 pr-1"
            >
              {slot === activeSlot &&
                (displayArtifacts.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    {t.ui("teamComp.freezeNoArtifacts")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {displayArtifacts.map((art) => {
                      const isFrozen = allFrozenIds.has(art.id);
                      const isSelected = selectedIds.has(art.id);
                      const matchCount =
                        activeStats.length > 0
                          ? activeStats.filter((s) => getStatValue(art, s) > 0)
                              .length
                          : 0;
                      return (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => !isFrozen && toggleSelect(art.id)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg border-2 text-left transition-all",
                            isFrozen
                              ? "opacity-50 cursor-not-allowed border-sky-800/30 bg-sky-950/10"
                              : "hover:bg-white/5 cursor-pointer",
                            isSelected && !isFrozen
                              ? "border-cyan-400 bg-cyan-500/10 shadow-sm"
                              : !isFrozen && "border-border/20 bg-black/10"
                          )}
                        >
                          {/* Selection indicator */}
                          <div
                            className={cn(
                              "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                              isFrozen
                                ? "bg-sky-800/50 border-sky-700/50"
                                : isSelected
                                  ? "bg-cyan-500 border-cyan-400"
                                  : "border-border bg-black/20"
                            )}
                          >
                            {(isFrozen || isSelected) && (
                              <Check
                                className={cn(
                                  "w-3 h-3",
                                  isFrozen ? "text-sky-400/60" : "text-white"
                                )}
                              />
                            )}
                          </div>

                          <ItemIcon
                            artifactSetId={art.setKey}
                            slot={art.slotKey as Slot}
                            rarity={art.rarity}
                            lock={art.lock}
                            level={`+${art.level}`}
                            badge={art.astralMark ? "⭐" : undefined}
                            size="md"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-bold text-sm truncate",
                                  isFrozen
                                    ? "text-muted-foreground"
                                    : getRarityColor(art.rarity, "text")
                                )}
                              >
                                {t.artifact(art.setKey)}
                              </span>
                              {isFrozen && (
                                <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded-full">
                                  <Snowflake className="w-3 h-3" />
                                  {t.ui("teamComp.frozenBadge")}
                                </span>
                              )}
                              {!isFrozen && matchCount > 0 && (
                                <span className="shrink-0 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-full">
                                  {matchCount}/{activeStats.length}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t.statShort(art.mainStatKey)} · +{art.level}
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
                              {Object.entries(art.substats ?? {}).map(
                                ([key, val]) => {
                                  if (val == null) return null;
                                  const isHighlighted =
                                    !isFrozen && activeStats.includes(key);
                                  return (
                                    <span
                                      key={key}
                                      className={cn(
                                        "text-xs font-mono",
                                        isFrozen
                                          ? "text-muted-foreground"
                                          : isHighlighted
                                            ? "text-cyan-300 font-bold"
                                            : "text-foreground/70"
                                      )}
                                    >
                                      {t.statMin(key)}{" "}
                                      {fmtStat(key, val, false, true)}
                                    </span>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
            </TabsContent>
          ))}
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
