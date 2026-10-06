import { ArrowRightLeft } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ArtifactDataHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { ICON_CONFIG, ItemIcon } from "@/components/shared/ItemIcon";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { cn } from "@/lib/utils";

export function ArtifactSlotGrid({
  artifactsObj,
  t,
  onSwap,
}: {
  artifactsObj: Record<string, ArtifactData>;
  t: ReturnType<typeof useLanguage>["t"];
  /** When provided, artifacts become clickable to trigger a swap */
  onSwap?: (slot: Slot, artifact: ArtifactData) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(true);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    // Five 56px icons plus four gaps; measure the actual row, including sidebars.
    const updateSize = () => {
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      const fullSizeWidth =
        allSlots.length * ICON_CONFIG.md.icon + (allSlots.length - 1) * gap;
      setCompact(grid.getBoundingClientRect().width < fullSizeWidth);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={gridRef} className="grid grid-cols-5 gap-0.5 md:gap-1 lg:gap-1.5">
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
              openDrawerOnClick={false}
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
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/50 opacity-0 group-hover/swap:opacity-100 transition-opacity rounded">
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
