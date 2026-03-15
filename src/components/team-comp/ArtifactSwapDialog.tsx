import { ArtifactDataContent } from "@/components/account-data/ArtifactDataHoverCard";
import { ArtifactIcon } from "@/components/shared/ArtifactIcon";
import { fmtStat } from "@/components/team-comp/displayFormatters";
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
import type { useLanguage } from "@/contexts/LanguageContext";
import { artifactHalfSetsById, artifactsById } from "@/data/constants";
import type { ArtifactData, MainStat, Slot, SubStat } from "@/data/types";
import { cn, getRarityColor } from "@/lib/utils";
import { ArrowRightLeft, Check } from "lucide-react";
import { useMemo, useState } from "react";

/** All stat keys that can appear on artifacts (main + sub, deduplicated) */
const SORTABLE_STATS: (MainStat | SubStat)[] = [
  "hp",
  "atk",
  "def",
  "hp%",
  "atk%",
  "def%",
  "em",
  "er",
  "cr",
  "cd",
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
];

interface ArtifactSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentArtifact: ArtifactData;
  slot: Slot;
  inventory: ArtifactData[];
  usedArtifactIds: Set<string>;
  matchingSetIds: Set<string>;
  onSwap: (newArtifact: ArtifactData) => void;
  t: ReturnType<typeof useLanguage>["t"];
}

/**
 * Get the value of a stat on an artifact (checks main stat then substats).
 * Returns 0 if the artifact doesn't have that stat.
 */
function getStatValue(art: ArtifactData, stat: string): number {
  if (art.mainStatKey === stat) {
    // Main stat value isn't stored numerically in ArtifactData,
    // but we can use level as a proxy (higher level = higher main stat).
    // For sorting purposes, having the stat at all is the key signal,
    // so we return a large number to ensure main-stat matches rank high.
    return 10000 + art.level;
  }
  return (art.substats as Record<string, number | undefined>)?.[stat] ?? 0;
}

/**
 * Sort artifacts mimicking in-game sorting:
 * 1. Number of selected stats matched (more matches first)
 * 2. First stat's value (descending)
 * 3. Second stat's value as tiebreaker (descending)
 * 4. Third, fourth stat values (descending)
 */
function sortByStats(
  items: ArtifactData[],
  sortStats: (string | null)[]
): ArtifactData[] {
  const activeStats = sortStats.filter((s): s is string => s != null);
  if (activeStats.length === 0) return items;

  return [...items].sort((a, b) => {
    // Count how many of the selected stats each artifact has
    const countA = activeStats.filter((s) => getStatValue(a, s) > 0).length;
    const countB = activeStats.filter((s) => getStatValue(b, s) > 0).length;
    if (countB !== countA) return countB - countA;

    // Tiebreak by stat values in priority order
    for (const stat of activeStats) {
      const valA = getStatValue(a, stat);
      const valB = getStatValue(b, stat);
      if (valB !== valA) return valB - valA;
    }
    return 0;
  });
}

export function ArtifactSwapDialog({
  open,
  onOpenChange,
  currentArtifact,
  slot,
  inventory,
  usedArtifactIds,
  matchingSetIds,
  onSwap,
  t,
}: ArtifactSwapDialogProps) {
  const [activeTab, setActiveTab] = useState<"matching" | "other">("matching");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortStats, setSortStats] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  // Filter inventory to this slot, exclude current and already-used
  const { matchingRaw, otherRaw } = useMemo(() => {
    const forSlot = inventory.filter(
      (a) =>
        a.slotKey === slot &&
        a.id !== currentArtifact.id &&
        !usedArtifactIds.has(a.id)
    );

    const matchList: ArtifactData[] = [];
    const otherList: ArtifactData[] = [];

    for (const art of forSlot) {
      if (matchingSetIds.has(art.setKey)) {
        matchList.push(art);
      } else {
        otherList.push(art);
      }
    }

    // Default sort: rarity → level → set
    const defaultSort = (a: ArtifactData, b: ArtifactData) => {
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
      if (b.level !== a.level) return b.level - a.level;
      return a.setKey.localeCompare(b.setKey);
    };
    matchList.sort(defaultSort);
    otherList.sort(defaultSort);

    return { matchingRaw: matchList, otherRaw: otherList };
  }, [inventory, slot, currentArtifact.id, usedArtifactIds, matchingSetIds]);

  // Apply stat-based sorting on top of the filtered lists
  const hasActiveSorts = sortStats.some((s) => s != null);
  const matching = hasActiveSorts
    ? sortByStats(matchingRaw, sortStats)
    : matchingRaw;
  const other = hasActiveSorts ? sortByStats(otherRaw, sortStats) : otherRaw;

  const handleSelect = (art: ArtifactData) => {
    setSelectedId(art.id === selectedId ? null : art.id);
  };

  const handleConfirm = () => {
    const art =
      matching.find((a) => a.id === selectedId) ??
      other.find((a) => a.id === selectedId);
    if (art) {
      onSwap(art);
      onOpenChange(false);
      setSelectedId(null);
    }
  };

  const updateSort = (index: number, value: string | null) => {
    setSortStats((prev) => {
      const next = [...prev];
      next[index] = value;
      // Clear downstream selects when a higher one changes
      for (let i = index + 1; i < next.length; i++) {
        next[i] = null;
      }
      return next;
    });
  };

  // Stats already selected in other slots (to avoid duplicates in selects)
  const usedStats = new Set(sortStats.filter((s): s is string => s != null));

  const SORT_LABELS = ["1st", "2nd", "3rd", "4th"];

  const renderSortSelects = () => (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {t.ui("teamComp.swapSortBy")}
      </div>
      {sortStats.map((currentVal, idx) => {
        const isEnabled = idx === 0 || sortStats[idx - 1] != null;
        const availableStats = SORTABLE_STATS.filter(
          (s) => s === currentVal || !usedStats.has(s)
        );
        return (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-right">
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
                  "w-28 font-medium",
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
  );

  const renderList = (items: ArtifactData[]) => {
    if (items.length === 0) {
      return (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          {t.ui("teamComp.swapEmpty")}
        </div>
      );
    }

    const activeStats = sortStats.filter((s): s is string => s != null);

    return (
      <div className="grid grid-cols-1 gap-1.5">
        {items.map((art) => {
          const artInfo = artifactsById[art.setKey];
          const isSelected = selectedId === art.id;
          // Count matched sort stats for badge
          const matchCount =
            activeStats.length > 0
              ? activeStats.filter((s) => getStatValue(art, s) > 0).length
              : 0;
          return (
            <button
              key={art.id}
              type="button"
              onClick={() => handleSelect(art)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg border-2 text-left transition-all",
                "hover:bg-white/5",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/20 bg-black/10"
              )}
            >
              <ArtifactIcon
                artifact={art}
                artInfo={artInfo}
                slot={slot}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-bold text-sm truncate",
                      getRarityColor(art.rarity, "text")
                    )}
                  >
                    {t.artifact(art.setKey)}
                  </span>
                  {matchCount > 0 && (
                    <span className="shrink-0 text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                      {matchCount}/{activeStats.length}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.statShort(art.mainStatKey)} · +{art.level}
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
                  {Object.entries(art.substats ?? {}).map(([key, val]) => {
                    if (val == null) return null;
                    const isHighlighted = activeStats.includes(key);
                    return (
                      <span
                        key={key}
                        className={cn(
                          "text-xs font-mono",
                          isHighlighted
                            ? "text-primary font-bold"
                            : "text-foreground/70"
                        )}
                      >
                        {t.statMin(key)} {fmtStat(key, val, false, true)}
                      </span>
                    );
                  })}
                  {Object.entries(art.unactivatedSubstats ?? {}).map(
                    ([key, val]) =>
                      val != null && (
                        <span
                          key={key}
                          className="text-xs font-mono text-muted-foreground"
                        >
                          {t.statMin(key)} {fmtStat(key, val, false, true)}
                        </span>
                      )
                  )}
                </div>
              </div>
              {isSelected && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfirm();
                  }}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">
                    {t.ui("teamComp.swapArtifact")}
                  </span>
                </button>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            {t.ui("teamComp.swapArtifact")} — {t.slot(slot)}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription asChild>
            <span>{t.ui("teamComp.swapArtifactDesc")}</span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Top section: current artifact (left half) + sort controls (right half) */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="flex flex-col items-center">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              {t.ui("teamComp.tabCurrentEquipped")}
            </div>
            <ArtifactDataContent
              artifact={currentArtifact}
              slot={slot}
              showIcon
              compact
            />
          </div>
          <div className="flex flex-col items-center justify-center">
            {renderSortSelects()}
          </div>
        </div>

        {/* Tabs for matching vs other */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "matching" | "other")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="matching" className="flex-1 gap-1.5 text-sm">
              {t.ui("teamComp.swapTabMatching")}
              <span className="text-xs text-muted-foreground font-mono">
                ({matching.length})
              </span>
            </TabsTrigger>
            <TabsTrigger value="other" className="flex-1 gap-1.5 text-sm">
              {t.ui("teamComp.swapTabOther")}
              <span className="text-xs text-muted-foreground font-mono">
                ({other.length})
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="matching"
            className="max-h-[45vh] overflow-y-auto mt-2 pr-1"
          >
            {renderList(matching)}
          </TabsContent>
          <TabsContent
            value="other"
            className="max-h-[45vh] overflow-y-auto mt-2 pr-1"
          >
            {renderList(other)}
          </TabsContent>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/**
 * Compute the set of artifact set IDs that match the team roster's
 * configured sets for a given character index.
 */
export function getMatchingSetIds(
  team: {
    artifacts: (
      | {
          type: string;
          setId?: string;
          id1?: string | number;
          id2?: string | number;
        }
      | undefined
    )[];
  },
  charIndex: number
): Set<string> {
  const ids = new Set<string>();
  const artConfig = team.artifacts[charIndex];
  if (!artConfig) return ids;

  if (artConfig.type === "4pc" && artConfig.setId) {
    ids.add(artConfig.setId);
  } else if (artConfig.type === "2pc+2pc") {
    for (const hsId of [String(artConfig.id1), String(artConfig.id2)]) {
      const hs = artifactHalfSetsById[hsId];
      if (hs) {
        for (const setId of hs.setIds) ids.add(setId);
      }
    }
  }
  return ids;
}
