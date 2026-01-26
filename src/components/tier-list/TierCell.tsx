import type { Tier } from "@/data/types";
import { cn, getTierColor } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { TierItem } from "./TierItem";
import type { TierItemData } from "./tierTableTypes";

/**
 * Styling variants for TierCell
 * - grid: Desktop style with borders and tier background colors
 * - card: Compact/tablet style with rounded corners and spacing
 */
type CellVariant = "grid" | "card";

interface TierCellProps<T extends TierItemData> {
  tier: Tier;
  group: string;
  items: T[];
  groupKey: keyof T;
  iconSize: "sm" | "md" | "lg" | "xl";
  variant: CellVariant;
  getItemName: (item: T) => string;
  getTooltip: (item: T) => ReactNode;
  getOverlayImage?: (item: T) => string | undefined;
  /** Optional tier display name for card variant header */
  displayName?: string;
  /** Additional className for the cell container */
  className?: string;
  /** Tour step ID for onboarding spotlight */
  tourStepId?: string;
}

/** Shared styles for tier cells */
const CELL_STYLES = {
  grid: {
    container: "min-h-[5rem] border-r border-b border-gray-600 bg-clip-padding",
    content: "flex flex-wrap items-end justify-center gap-2 p-2",
  },
  card: {
    container: "mb-2",
    header: "px-3 py-1 text-sm font-bold text-gray-100 rounded-t-md",
    content: cn(
      "min-h-[4rem] p-2 bg-slate-900/50 rounded-b-md border border-t-0 border-white/10",
      "flex flex-wrap gap-2 transition-colors"
    ),
  },
} as const;

/**
 * Unified drop zone component for tier list cells.
 * Handles both desktop grid cells and compact/tablet card cells.
 */
export function TierCell<T extends TierItemData>({
  tier,
  group,
  items,
  groupKey,
  iconSize,
  variant,
  getItemName,
  getTooltip,
  getOverlayImage,
  displayName,
  className,
  tourStepId,
}: TierCellProps<T>) {
  // MUST match format expected by TierTable: `${tier}-${group}`
  const cellId = `${tier}-${group}`;

  const { setNodeRef } = useDroppable({
    id: cellId,
    data: { tier, group },
  });

  const cellItems = items.filter((item) => item[groupKey] === group);
  const itemIds = cellItems.map((item) => item.id);

  const renderItems = () => (
    <SortableContext items={itemIds} strategy={rectSortingStrategy}>
      {cellItems.map((item) => (
        <TierItem
          key={item.id}
          item={item}
          tier={tier}
          groupValue={item[groupKey] as string}
          alt={getItemName(item)}
          overlayImage={getOverlayImage?.(item)}
          tooltip={getTooltip(item)}
          size={iconSize}
        />
      ))}
    </SortableContext>
  );

  if (variant === "card") {
    return (
      <div className={cn(CELL_STYLES.card.container, className)}>
        {/* Tier Header */}
        <div
          className={cn(CELL_STYLES.card.header, getTierColor(tier, "header"))}
          data-tour-step-id={tourStepId}
        >
          {displayName || tier}
        </div>

        {/* Drop Zone */}
        <div
          ref={setNodeRef}
          data-tier={tier}
          data-group={group}
          className={CELL_STYLES.card.content}
        >
          {renderItems()}
          {cellItems.length === 0 && (
            <div className="w-full text-center text-xs text-muted-foreground py-2 opacity-50 select-none">
              Drop here
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid variant (desktop)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        CELL_STYLES.grid.container,
        getTierColor(tier, "bg"),
        className
      )}
      data-tier={tier}
      data-group={group}
    >
      <div className={CELL_STYLES.grid.content}>{renderItems()}</div>
    </div>
  );
}
