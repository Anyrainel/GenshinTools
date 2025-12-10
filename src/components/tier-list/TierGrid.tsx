import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { TierItem, TierItemData } from "./TierItem";

interface TierGridProps<T extends TierItemData> {
  allTiers: string[];
  groups: string[]; // elements or weapon types
  itemsPerTier: { [tier: string]: T[] };
  tierCustomization: {
    [tier: string]: { displayName?: string; hidden?: boolean };
  };
  onRemoveFromTiers: (itemId: string) => void;
  renderHeader: (group: string, count: number) => React.ReactNode;
  getItemData: (item: T) => Record<string, unknown>;
  getItemGroup: (item: T) => string;
  getGroupCount: (
    group: string,
    itemsPerTier: { [tier: string]: T[] },
  ) => number;
  getTierDisplayName: (tier: string) => string; // Function to get tier display name (with translation)
  getImagePath: (item: T) => string;
  getAlt: (item: T) => string;
  getOverlay?: (item: T) => React.ReactNode;
  getTooltip: (item: T) => React.ReactNode;
}

export function TierGrid<T extends TierItemData>({
  allTiers,
  groups,
  itemsPerTier,
  tierCustomization,
  onRemoveFromTiers,
  renderHeader,
  getItemData,
  getItemGroup,
  getGroupCount,
  getTierDisplayName,
  getImagePath,
  getAlt,
  getOverlay,
  getTooltip,
}: TierGridProps<T>) {
  // Check if any tier has custom names for flexible width
  const hasCustomNames = Object.values(tierCustomization).some(
    (custom) => custom?.displayName,
  );

  // Component for each droppable cell (tier-group combination)
  const TierGroupCell = ({
    tier,
    group,
    items,
  }: {
    tier: string;
    group: string;
    items: T[];
  }) => {
    const cellId = `${tier}-${group}`;
    const { setNodeRef } = useDroppable({
      id: cellId,
      data: { tier, group },
    });

    const cellItems = items.filter((item) => getItemGroup(item) === group);

    const itemIds = cellItems.map((item) => item.id);

    return (
      <div
        ref={setNodeRef}
        key={cellId}
        className={cn(
          "p-2",
          THEME.layout.minRowHeight,
          THEME.tier.bg[tier as keyof typeof THEME.tier.bg],
          THEME.layout.gridBorder,
        )}
        data-tier={tier}
        data-group={group}
      >
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap justify-center gap-2">
            {cellItems.map((item) => (
              <TierItem
                key={item.id}
                item={item}
                id={item.id}
                tier={tier}
                onDoubleClick={onRemoveFromTiers}
                getItemData={getItemData}
                imagePath={getImagePath(item)}
                alt={getAlt(item)}
                overlay={getOverlay?.(item)}
                tooltip={getTooltip(item)}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    );
  };

  const gridColsClass = hasCustomNames
    ? `grid-cols-[minmax(4rem,max-content)_repeat(${groups.length},1fr)]`
    : `grid-cols-[4rem_repeat(${groups.length},1fr)]`;

  const gridTemplateColumns = hasCustomNames
    ? `minmax(4rem, max-content) repeat(${groups.length}, 1fr)`
    : `4rem repeat(${groups.length}, 1fr)`;

  return (
    <div
      className={cn("grid select-none", gridColsClass)}
      style={{ gridTemplateColumns }}
    >
      <div key={"empty"} />
      {groups.map((group) => {
        const count = getGroupCount(group, itemsPerTier);
        return renderHeader(group, count);
      })}
      {allTiers.flatMap((tier) => {
        const customName = tierCustomization[tier]?.displayName;
        const displayName = customName || getTierDisplayName(tier);
        const items = itemsPerTier[tier] || [];

        return [
          <div
            key={`${tier}-label`}
            className={cn(
              THEME.layout.centerBox,
              THEME.layout.minRowHeight,
              THEME.tier.color[tier as keyof typeof THEME.tier.color],
              THEME.layout.gridBorder,
              "rounded-l-md",
              hasCustomNames && "max-w-48",
            )}
          >
            <span
              className={cn(
                THEME.layout.labelText,
                customName ? "text-lg" : "text-2xl",
              )}
            >
              {displayName}
            </span>
          </div>,
          ...groups.map((group) => (
            <TierGroupCell
              key={`${tier}-${group}`}
              tier={tier}
              group={group}
              items={items}
            />
          )),
        ];
      })}
    </div>
  );
}
