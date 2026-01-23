import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Tier } from "@/data/types";
import { cn, getAssetUrl, getTierColor } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { TierItem } from "./TierItem";
import type { TierGroupConfig, TierItemData } from "./tierTableTypes";

interface MobileTierRowProps<T extends TierItemData> {
  tier: Tier;
  group: string;
  items: T[];
  groupKey: keyof T;
  getItemName: (item: T) => string;
  getTooltip: (item: T) => ReactNode;
  getOverlayImage?: (item: T) => string | undefined;
  displayName: string;
}

function MobileTierRow<T extends TierItemData>({
  tier,
  group,
  items,
  groupKey,
  getItemName,
  getTooltip,
  getOverlayImage,
  displayName,
}: MobileTierRowProps<T>) {
  // MUST match TierGrid's cellId format: `${tier}-${group}`
  // TierTable logic relies on parsing "Tier-Group" from the ID.
  const cellId = `${tier}-${group}`;

  const { setNodeRef } = useDroppable({
    id: cellId,
    data: { tier, group },
  });

  const cellItems = items.filter((item) => item[groupKey] === group);
  const itemIds = cellItems.map((item) => item.id);

  return (
    <div className="mb-2">
      {/* Tier Header */}
      <div
        className={cn(
          "px-3 py-1 text-sm font-bold text-gray-100 rounded-t-md",
          getTierColor(tier, "bg")
        )}
      >
        {displayName}
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        data-tier={tier}
        data-group={group}
        className={cn(
          "min-h-[4rem] p-2 bg-slate-900/50 rounded-b-md border border-t-0 border-white/10",
          "flex flex-wrap gap-2 transition-colors"
          // Visual feedback can be added here if needed via useDroppable isOver
        )}
      >
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
              size="md" // Slightly smaller on mobile? or same? 'md' is good.
            />
          ))}
        </SortableContext>
        {cellItems.length === 0 && (
          <div className="w-full text-center text-xs text-muted-foreground py-2 opacity-50 select-none">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

interface MobileTierListProps<T extends TierItemData, K extends string> {
  allTiers: Tier[];
  groups: readonly K[];
  itemsPerTier: { [tier: string]: T[] };
  tierCustomization: {
    [tier: string]: { displayName?: string; hidden?: boolean };
  };
  groupKey: keyof T;
  groupConfig: Record<K, TierGroupConfig>;
  getGroupName: (group: K) => string;
  getItemName: (item: T) => string;
  getTooltip: (item: T) => ReactNode;
  getOverlayImage?: (item: T) => string | undefined;
}

export function MobileTierList<T extends TierItemData, K extends string>({
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
}: MobileTierListProps<T, K>) {
  const { t } = useLanguage();

  return (
    <Tabs defaultValue={groups[0]} className="w-full flex flex-col h-full">
      <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b">
        <TabsList className="w-full h-14 bg-transparent p-0 flex justify-center">
          {groups.map((group) => {
            const config = groupConfig[group];
            return (
              <TabsTrigger
                key={group}
                value={group}
                className={cn(
                  "flex-col gap-1 h-14 flex-1 min-w-0 max-w-20 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1"
                )}
              >
                <img
                  src={getAssetUrl(config.iconPath)}
                  alt={getGroupName(group)}
                  className="w-6 h-6 object-contain flex-shrink-0"
                />
                <span className="text-[10px] truncate w-full text-center">
                  {getGroupName(group)}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {groups.map((group) => (
          <TabsContent
            key={group}
            value={group}
            className="mt-0 space-y-4 pb-20"
          >
            {allTiers.map((tier) => {
              const customName = tierCustomization[tier]?.displayName;
              const displayName = customName || t.ui(`tiers.${tier}`) || tier;

              return (
                <MobileTierRow
                  key={`${tier}-${group}`}
                  tier={tier}
                  group={group}
                  items={itemsPerTier[tier] || []}
                  groupKey={groupKey}
                  getItemName={getItemName}
                  getTooltip={getTooltip}
                  getOverlayImage={getOverlayImage}
                  displayName={displayName}
                />
              );
            })}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
