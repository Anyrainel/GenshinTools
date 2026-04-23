import { ArrowRightLeft } from "lucide-react";
import { ArtifactDataHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { cn } from "@/lib/utils";

export function ArtifactSlotGrid({
  artifactsObj,
  t,
  onSwap,
  compact,
}: {
  artifactsObj: Record<string, ArtifactData>;
  t: ReturnType<typeof useLanguage>["t"];
  /** When provided, artifacts become clickable to trigger a swap */
  onSwap?: (slot: Slot, artifact: ArtifactData) => void;
  /** When true, use smaller icon size */
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-5 gap-0.5 md:gap-1 lg:gap-1.5">
      {allSlots.map((slot) => {
        const art = artifactsObj[slot];
        if (!art)
          return (
            <div
              key={slot}
              className="aspect-square rounded border border-dashed border-border/30 flex items-center justify-center bg-card/10 p-0.5"
            >
              <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">
                {t.ui("accountData.unequipped")}
              </span>
            </div>
          );

        if (onSwap) {
          return (
            <ArtifactDataHoverCard
              key={slot}
              artifact={art}
              slot={slot}
              side="bottom"
            >
              <button
                type="button"
                onClick={() => onSwap(slot, art)}
                className={cn(
                  "relative group/swap rounded transition-all cursor-pointer w-fit",
                  "hover:bg-primary/10"
                )}
              >
                <ItemIcon
                  artifactSetId={art.setKey}
                  slot={slot}
                  rarity={art.rarity}
                  lock={art.lock}
                  level={`+${art.level}`}
                  badge={art.astralMark ? "⭐" : undefined}
                  size={compact ? "xs" : "md"}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/swap:opacity-100 transition-opacity rounded">
                  <ArrowRightLeft className="w-4 h-4 text-primary" />
                </div>
              </button>
            </ArtifactDataHoverCard>
          );
        }

        return (
          <ArtifactDataHoverCard
            key={slot}
            artifact={art}
            slot={slot}
            side="bottom"
          >
            <div className="cursor-help">
              <ItemIcon
                artifactSetId={art.setKey}
                slot={slot}
                rarity={art.rarity}
                lock={art.lock}
                level={`+${art.level}`}
                badge={art.astralMark ? "⭐" : undefined}
                size={compact ? "xs" : "md"}
              />
            </div>
          </ArtifactDataHoverCard>
        );
      })}
    </div>
  );
}
