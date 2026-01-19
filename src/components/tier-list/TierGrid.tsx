import { useLanguage } from "@/contexts/LanguageContext";
import { THEME } from "@/lib/theme";
import { cn, getAssetUrl } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { TierItem } from "./TierItem";
import type { TierGroupConfig, TierItemData } from "./tierTableTypes";

/** Tier grid layout styles - used only within tier-list components */
export const TIER_GRID_STYLES = {
  gridBorder: "border-r border-b border-gray-600 bg-clip-padding",
  centerBox: "flex items-center justify-center p-2",
  labelText: "text-center break-words font-bold text-gray-100",
} as const;

// Extracted TierGroupCell component - defined outside to prevent recreation
interface TierGroupCellProps<T extends TierItemData> {
  tier: string;
  group: string;
  items: T[];
  groupKey: keyof T;
  getItemName: (item: T) => string;
  getTooltip: (item: T) => ReactNode;
  getOverlayImage?: (item: T) => string | undefined;
}

function TierGroupCell<T extends TierItemData>({
  tier,
  group,
  items,
  groupKey,
  getItemName,
  getTooltip,
  getOverlayImage,
}: TierGroupCellProps<T>) {
  const cellId = `${tier}-${group}`;
  const { setNodeRef } = useDroppable({
    id: cellId,
    data: { tier, group },
  });

  const cellItems = items.filter((item) => item[groupKey] === group);
  const itemIds = cellItems.map((item) => item.id);

  return (
    <div
      ref={setNodeRef}
      key={cellId}
      className={cn(
        "min-h-[5rem]",
        THEME.tier.bg[tier as keyof typeof THEME.tier.bg],
        TIER_GRID_STYLES.gridBorder
      )}
      data-tier={tier}
      data-group={group}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap justify-center gap-2 py-2">
          {cellItems.map((item) => (
            <TierItem
              key={item.id}
              item={item}
              tier={tier}
              groupValue={item[groupKey] as string}
              alt={getItemName(item)}
              overlayImage={getOverlayImage?.(item)}
              tooltip={getTooltip(item)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

interface TierGridProps<T extends TierItemData, K extends string> {
  allTiers: string[];
  groups: readonly K[];
  itemsPerTier: { [tier: string]: T[] };
  tierCustomization: {
    [tier: string]: { displayName?: string; hidden?: boolean };
  };

  // Grouping - key-based instead of callback-based
  groupKey: keyof T;
  groupConfig: Record<K, TierGroupConfig>;

  // Translation
  getGroupName: (group: K) => string;
  getItemName: (item: T) => string;

  // Customization
  getTooltip: (item: T) => ReactNode;
  getOverlayImage?: (item: T) => string | undefined;
}

export function TierGrid<T extends TierItemData, K extends string>({
  allTiers,
  groups,
  itemsPerTier,
  tierCustomization,
  groupKey,
  groupConfig,
  getGroupName,
  getItemName,
  getTooltip,
  getOverlayImage,
}: TierGridProps<T, K>) {
  const { t } = useLanguage();
  // Check if any tier has custom names for flexible width
  const hasCustomNames = Object.values(tierCustomization).some(
    (custom) => (custom as { displayName?: string })?.displayName
  );

  // Derive group count internally
  const getGroupCount = (group: K): number => {
    return Object.entries(itemsPerTier)
      .filter(([tier]) => tier !== "Pool")
      .reduce(
        (sum, [, items]) =>
          sum + items.filter((item) => item[groupKey] === group).length,
        0
      );
  };

  // Get tier display name - uses translation
  const getTierDisplayName = (tier: string): string => {
    return t.ui(`tiers.${tier}`) || tier;
  };

  // Render group header using config
  const renderHeader = (group: K) => {
    const config = groupConfig[group];
    const count = getGroupCount(group);

    return (
      <div
        key={group}
        className={cn(
          TIER_GRID_STYLES.centerBox,
          config.bgClass,
          TIER_GRID_STYLES.gridBorder,
          "rounded-tl-md rounded-tr-md"
        )}
      >
        <img
          src={getAssetUrl(config.iconPath)}
          className="w-6 h-6 mr-2 brightness-110 contrast-125 object-contain"
          alt={getGroupName(group)}
        />
        <span className={cn(TIER_GRID_STYLES.labelText, "text-lg")}>
          {getGroupName(group)} ({count})
        </span>
      </div>
    );
  };

  const gridColsClass = hasCustomNames
    ? `grid-cols-[minmax(5rem,max-content)_repeat(${groups.length},1fr)]`
    : `grid-cols-[5rem_repeat(${groups.length},1fr)]`;

  const gridTemplateColumns = hasCustomNames
    ? `minmax(5rem, max-content) repeat(${groups.length}, 1fr)`
    : `5rem repeat(${groups.length}, 1fr)`;

  return (
    <div
      className={cn("grid select-none", gridColsClass)}
      style={{ gridTemplateColumns }}
    >
      <div key={"empty"} />
      {groups.map((group) => renderHeader(group))}
      {allTiers.flatMap((tier) => {
        const customName = tierCustomization[tier]?.displayName;
        const displayName = customName || getTierDisplayName(tier);
        const items = itemsPerTier[tier] || [];

        return [
          <div
            key={`${tier}-label`}
            className={cn(
              TIER_GRID_STYLES.centerBox,
              "min-h-[5rem]",
              THEME.tier.color[tier as keyof typeof THEME.tier.color],
              TIER_GRID_STYLES.gridBorder,
              "rounded-l-md",
              hasCustomNames && "max-w-48"
            )}
          >
            <span
              className={cn(
                TIER_GRID_STYLES.labelText,
                customName ? "text-base" : "text-xl"
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
              groupKey={groupKey}
              getItemName={getItemName}
              getTooltip={getTooltip}
              getOverlayImage={getOverlayImage}
            />
          )),
        ];
      })}
    </div>
  );
}
