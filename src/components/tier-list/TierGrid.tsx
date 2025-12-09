import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { TIER_COLORS, TIER_BG_COLORS, LAYOUT } from '@/constants/theme';
import { TierItem, TierItemData } from './TierItem';

interface TierGridProps<T extends TierItemData> {
  allTiers: string[];
  groups: string[]; // elements or weapon types
  itemsPerTier: { [tier: string]: T[] };
  tierCustomization: { [tier: string]: { displayName?: string; hidden?: boolean } };
  onRemoveFromTiers: (itemId: string) => void;
  renderHeader: (group: string, count: number) => React.ReactNode;
  renderCellContent: (item: T, isDragging: boolean) => React.ReactNode;
  getItemData: (item: T) => Record<string, any>;
  getItemGroup: (item: T) => string;
  getGroupCount: (group: string, itemsPerTier: { [tier: string]: T[] }) => number;
  getTierDisplayName: (tier: string) => string; // Function to get tier display name (with translation)
}

export function TierGrid<T extends TierItemData>({
  allTiers,
  groups,
  itemsPerTier,
  tierCustomization,
  onRemoveFromTiers,
  renderHeader,
  renderCellContent,
  getItemData,
  getItemGroup,
  getGroupCount,
  getTierDisplayName,
}: TierGridProps<T>) {
  // Check if any tier has custom names for flexible width
  const hasCustomNames = Object.values(tierCustomization).some(
    (custom) => custom?.displayName
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

    // Filter items for this group
    const cellItems = items.filter((item) => getItemGroup(item) === group);

    // Create sorted array of IDs for this cell
    const itemIds = cellItems.map((item) => item.id);

    return (
      <div
        ref={setNodeRef}
        key={cellId}
        className={cn(
          'p-2',
          LAYOUT.MIN_ROW_HEIGHT,
          TIER_BG_COLORS[tier as keyof typeof TIER_BG_COLORS],
          LAYOUT.GRID_BORDER
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
                renderContent={renderCellContent}
                getItemData={getItemData}
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
      className={cn('grid select-none', gridColsClass)}
      style={{ gridTemplateColumns }}
    >
      <div key={'empty'} />
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
              LAYOUT.CENTER_BOX,
              LAYOUT.MIN_ROW_HEIGHT,
              TIER_COLORS[tier as keyof typeof TIER_COLORS],
              LAYOUT.GRID_BORDER,
              'rounded-l-md',
              hasCustomNames && 'max-w-48'
            )}
          >
            <span
              className={cn(
                LAYOUT.LABEL_TEXT,
                customName ? 'text-lg' : 'text-2xl'
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
          ))
        ];
      })}
    </div>
  );
}
