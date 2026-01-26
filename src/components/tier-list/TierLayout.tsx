import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Tier } from "@/data/types";
import { cn, getAssetUrl, getTierColor } from "@/lib/utils";
import { type ReactNode, forwardRef } from "react";
import { TierCell } from "./TierCell";
import type { TierGroupConfig, TierItemData } from "./tierTableTypes";

/** Layout mode determines responsive rendering strategy */
export type LayoutMode = "compact" | "tablet" | "desktop";

/** Shared styles for tier layout */
const LAYOUT_STYLES = {
  gridBorder: "border-r border-b border-gray-600 bg-clip-padding",
  centerBox: "flex items-center justify-center p-2",
  labelText: "text-center break-words font-bold text-gray-100",
} as const;

interface TierLayoutProps<T extends TierItemData, K extends string> {
  mode: LayoutMode;
  iconSize: "sm" | "md" | "lg" | "xl";
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

/**
 * Unified layout component for tier lists.
 * Handles three responsive modes: compact, tablet, and desktop.
 */
export const TierLayout = forwardRef<
  HTMLDivElement,
  TierLayoutProps<TierItemData, string>
>(function TierLayoutInner(
  {
    mode,
    iconSize,
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
  },
  ref
) {
  const { t } = useLanguage();

  // Check if any tier has custom names for flexible width
  const hasCustomNames = Object.values(tierCustomization).some(
    (custom) => (custom as { displayName?: string })?.displayName
  );

  // Get tier display name
  const getTierDisplayName = (tier: string): string => {
    const customName = tierCustomization[tier]?.displayName;
    return customName || t.ui(`tiers.${tier}`) || tier;
  };

  // Get group count (for desktop headers)
  const getGroupCount = (group: string): number => {
    return Object.entries(itemsPerTier)
      .filter(([tier]) => tier !== "Pool")
      .reduce(
        (sum, [, items]) =>
          sum + items.filter((item) => item[groupKey] === group).length,
        0
      );
  };

  // Render desktop group header
  const renderDesktopHeader = (group: string) => {
    const config = groupConfig[group as keyof typeof groupConfig];
    const count = getGroupCount(group);

    return (
      <div
        key={group}
        className={cn(
          LAYOUT_STYLES.centerBox,
          config.bgClass,
          LAYOUT_STYLES.gridBorder,
          "rounded-tl-md rounded-tr-md"
        )}
      >
        <img
          src={getAssetUrl(config.iconPath)}
          className="w-6 h-6 mr-2 brightness-110 contrast-125 object-contain"
          alt={getGroupName(group as keyof typeof groupConfig)}
        />
        <span className={cn(LAYOUT_STYLES.labelText, "text-lg")}>
          {getGroupName(group as keyof typeof groupConfig)} ({count})
        </span>
      </div>
    );
  };

  // Desktop mode: N+1 column grid with all groups visible
  if (mode === "desktop") {
    // Smart label width: min-content up to 15% of available width
    const gridTemplateColumns = hasCustomNames
      ? `minmax(5rem, max-content) repeat(${groups.length}, 1fr)`
      : `5rem repeat(${groups.length}, 1fr)`;

    return (
      <div
        ref={ref}
        className="grid select-none min-[2000px]:px-8"
        style={{ gridTemplateColumns }}
      >
        {/* Empty corner cell */}
        <div key="empty" />

        {/* Group headers */}
        {groups.map((group) => renderDesktopHeader(group))}

        {/* Tier rows */}
        {allTiers.flatMap((tier, tierIndex) => {
          const displayName = getTierDisplayName(tier);
          const items = itemsPerTier[tier] || [];

          // Tour step IDs for onboarding
          const tourStepId =
            tier === "Pool"
              ? "tl-unassigned"
              : tierIndex === 1
                ? "tl-tier-row"
                : undefined;

          return [
            // Tier label
            <div
              key={`${tier}-label`}
              className={cn(
                LAYOUT_STYLES.centerBox,
                "min-h-[5rem]",
                getTierColor(tier, "header"),
                LAYOUT_STYLES.gridBorder,
                "rounded-l-md",
                hasCustomNames && "max-w-48"
              )}
              data-tour-step-id={tourStepId}
            >
              <span
                className={cn(
                  LAYOUT_STYLES.labelText,
                  tierCustomization[tier]?.displayName ? "text-base" : "text-xl"
                )}
              >
                {displayName}
              </span>
            </div>,

            // Group cells
            ...groups.map((group) => (
              <TierCell
                key={`${tier}-${group}`}
                tier={tier}
                group={group}
                items={items}
                groupKey={groupKey}
                iconSize={iconSize}
                variant="grid"
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

  // Compact and Tablet modes: Tab-based with single group visible
  const cellVariant = mode === "compact" ? "card" : "card";

  // For tablet mode: 2-column grid (label + items)
  const tabletGridStyle =
    mode === "tablet"
      ? {
          display: "grid" as const,
          gridTemplateColumns: "fit-content(25%) 1fr",
          gap: "0",
        }
      : undefined;

  return (
    <Tabs defaultValue={groups[0]} className="w-full flex flex-col h-full">
      {/* Group tabs header */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex justify-center">
        <TabsList
          className={cn(
            "h-14 bg-transparent p-0 flex border-b",
            mode === "compact" ? "w-full" : "w-auto"
          )}
        >
          {groups.map((group) => {
            const config = groupConfig[group as keyof typeof groupConfig];
            return (
              <TabsTrigger
                key={group}
                value={group}
                className={cn(
                  "flex-col gap-1 h-14 rounded-none border-b-2 border-transparent",
                  "data-[state=active]:border-primary data-[state=active]:bg-transparent px-1",
                  mode === "compact" ? "flex-1" : "w-16"
                )}
              >
                <img
                  src={getAssetUrl(config.iconPath)}
                  alt={getGroupName(group as keyof typeof groupConfig)}
                  className="w-6 h-6 object-contain flex-shrink-0"
                />
                <span className="text-[10px] truncate w-full text-center">
                  {getGroupName(group as keyof typeof groupConfig)}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4" ref={ref}>
        {groups.map((group) => (
          <TabsContent
            key={group}
            value={group}
            className={cn(
              "mt-0 pb-20",
              mode === "compact" ? "space-y-2" : "space-y-4"
            )}
          >
            {mode === "tablet" ? (
              // Tablet: 2-column grid layout
              <div style={tabletGridStyle} className="select-none">
                {allTiers.flatMap((tier, tierIndex) => {
                  const displayName = getTierDisplayName(tier);
                  const items = itemsPerTier[tier] || [];

                  // Tour step IDs for onboarding
                  const tourStepId =
                    tier === "Pool"
                      ? "tl-unassigned"
                      : tierIndex === 1
                        ? "tl-tier-row"
                        : undefined;

                  return [
                    // Tier label column
                    <div
                      key={`${tier}-label`}
                      className={cn(
                        LAYOUT_STYLES.centerBox,
                        "min-h-[4rem]",
                        getTierColor(tier, "header"),
                        LAYOUT_STYLES.gridBorder,
                        "rounded-l-md"
                      )}
                      data-tour-step-id={tourStepId}
                    >
                      <span
                        className={cn(
                          LAYOUT_STYLES.labelText,
                          tierCustomization[tier]?.displayName
                            ? "text-sm"
                            : "text-lg"
                        )}
                      >
                        {displayName}
                      </span>
                    </div>,

                    // Items cell
                    <TierCell
                      key={`${tier}-${group}`}
                      tier={tier}
                      group={group}
                      items={items}
                      groupKey={groupKey}
                      iconSize={iconSize}
                      variant="grid"
                      getItemName={getItemName}
                      getTooltip={getTooltip}
                      getOverlayImage={getOverlayImage}
                    />,
                  ];
                })}
              </div>
            ) : (
              // Compact: Stacked card layout
              allTiers.map((tier, tierIndex) => {
                const displayName = getTierDisplayName(tier);
                const items = itemsPerTier[tier] || [];
                const tourStepId =
                  tier === "Pool"
                    ? "tl-unassigned"
                    : tierIndex === 1
                      ? "tl-tier-row"
                      : undefined;

                return (
                  <TierCell
                    key={`${tier}-${group}`}
                    tier={tier}
                    group={group}
                    items={items}
                    groupKey={groupKey}
                    iconSize={iconSize}
                    variant={cellVariant}
                    displayName={displayName}
                    getItemName={getItemName}
                    getTooltip={getTooltip}
                    getOverlayImage={getOverlayImage}
                    tourStepId={tourStepId}
                  />
                );
              })
            )}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}) as <T extends TierItemData, K extends string>(
  props: TierLayoutProps<T, K> & { ref?: React.Ref<HTMLDivElement> }
) => React.ReactElement;
