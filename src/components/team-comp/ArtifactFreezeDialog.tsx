import { ArtifactDataContent } from "@/components/account-data/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
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

const SLOT_FILTERS = ["all", ...allSlots] as const;
type SlotFilter = (typeof SLOT_FILTERS)[number];

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

  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // All frozen artifact IDs (team-based + standalone)
  const allFrozenIds = useMemo(
    () => getFrozenArtifactIds(),
    [getFrozenArtifactIds, frozenArtifactIds]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // Build and sort full inventory
  const inventory = useMemo(() => {
    if (!accountData) return [];
    const all = getAllArtifacts(accountData);
    // Sort: rarity desc → level desc → set name
    all.sort((a, b) => {
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
      if (b.level !== a.level) return b.level - a.level;
      return a.setKey.localeCompare(b.setKey);
    });
    return all;
  }, [accountData]);

  // Filtered by slot
  const filtered = useMemo(() => {
    if (slotFilter === "all") return inventory;
    return inventory.filter((a) => a.slotKey === slotFilter);
  }, [inventory, slotFilter]);

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

        {/* Slot filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {SLOT_FILTERS.map((sf) => (
            <button
              key={sf}
              type="button"
              onClick={() => setSlotFilter(sf)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer",
                slotFilter === sf
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-black/20 text-muted-foreground border border-border/30 hover:bg-white/5 hover:text-foreground"
              )}
            >
              {sf === "all" ? t.ui("teamComp.freezeAllSlots") : t.slot(sf)}
            </button>
          ))}
        </div>

        {/* Freeze action bar */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <span className="text-sm text-cyan-300 font-medium">
              {selectedCount} selected
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

        {/* Artifact list */}
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              {t.ui("teamComp.freezeNoArtifacts")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {filtered.map((art) => {
                const isFrozen = allFrozenIds.has(art.id);
                const isSelected = selectedIds.has(art.id);
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
                    {!isFrozen && (
                      <div
                        className={cn(
                          "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-cyan-500 border-cyan-400"
                            : "border-border bg-black/20"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    )}

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
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.slot(art.slotKey as Slot)} ·{" "}
                        {t.statShort(art.mainStatKey)} · +{art.level}
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
                        {Object.entries(art.substats ?? {}).map(
                          ([key, val]) => {
                            if (val == null) return null;
                            return (
                              <span
                                key={key}
                                className={cn(
                                  "text-xs font-mono",
                                  isFrozen
                                    ? "text-muted-foreground"
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
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
