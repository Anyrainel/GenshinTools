import type { Rarity } from "@/data/types";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";
import { Lock } from "lucide-react";
import { forwardRef } from "react";

interface ItemIconProps extends React.ComponentPropsWithoutRef<"div"> {
  imagePath: string;
  rarity?: Rarity;
  badge?: string | number; // Top Left - Constellation/Refinement/AstralMark (e.g. "1", "⭐")
  lock?: boolean; // Top Right - Show red lock icon when true
  level?: string; // Bottom bar - e.g. "Lv. 90", "+20"
  size?: ItemIconSize; // Predefined sizes
  children?: React.ReactNode;
}

// Explicit configuration for each size
// Tuned for visual balance and to avoid mixed-shorthand warnings
export const ICON_CONFIG = {
  xs: {
    icon: 40,
    radius: 6,
    corner: {
      size: 10,
      offset: 1,
      radius: 2,
      containerRadius: 2,
      fontSize: 8,
      lockIconSize: 7,
    },
    level: { height: 7, fontSize: 8, cornerFill: 6 },
  },
  sm: {
    icon: 48,
    radius: 8,
    corner: {
      size: 12,
      offset: 1.5,
      radius: 3,
      containerRadius: 3,
      fontSize: 10,
      lockIconSize: 8.5,
    },
    level: { height: 8, fontSize: 9, cornerFill: 8 },
  },
  md: {
    icon: 56,
    radius: 8,
    corner: {
      size: 14,
      offset: 1.75,
      radius: 3.5,
      containerRadius: 3,
      fontSize: 11,
      lockIconSize: 10,
    },
    level: { height: 10, fontSize: 10, cornerFill: 8 },
  },
  lg: {
    icon: 64, // Base size
    radius: 10,
    corner: {
      size: 16,
      offset: 2,
      radius: 4,
      containerRadius: 4,
      fontSize: 12,
      lockIconSize: 11,
    },
    level: { height: 11, fontSize: 11, cornerFill: 10 },
  },
  xl: {
    icon: 80,
    radius: 10,
    corner: {
      size: 20,
      offset: 2.5,
      radius: 5,
      containerRadius: 5,
      fontSize: 15,
      lockIconSize: 14,
    },
    level: { height: 14, fontSize: 13, cornerFill: 10 },
  },
} as const;

export type ItemIconSize = keyof typeof ICON_CONFIG;

// Legacy export for backward compatibility
// eslint-disable-next-line react-refresh/only-export-components
export const SIZE_CLASSES = {
  xs: "w-10 h-10 rounded-sm",
  sm: "w-12 h-12 rounded-sm",
  md: "w-14 h-14 rounded-sm",
  lg: "w-16 h-16 rounded-md",
  xl: "w-20 h-20 rounded-md",
} as const;

export const ItemIcon = forwardRef<HTMLDivElement, ItemIconProps>(
  (
    {
      imagePath,
      rarity = 1,
      badge,
      lock,
      level,
      size = "lg",
      children,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const config = ICON_CONFIG[size];
    // Fallback to lg if size is invalid (though type check prevents this)
    const effectiveConfig = config || ICON_CONFIG.lg;

    const {
      icon: iconSize,
      radius: borderRadius,
      corner,
      level: levelConfig,
    } = effectiveConfig;

    const showBadge = badge !== undefined;
    const showLock = lock;
    const showLevel = !!level;

    // Calculate total height (icon + visible level bar portion)
    const totalHeight = showLevel ? iconSize + levelConfig.height : iconSize;

    // Wrapper style
    const wrapperStyle: React.CSSProperties = {
      ...style,
      width: iconSize,
      height: totalHeight,
    };

    // Inner container (helper for layout)
    const innerStyle: React.CSSProperties = {
      width: iconSize,
      height: totalHeight,
    };

    // Icon element
    const iconElement = (
      <div
        className={cn(
          "relative overflow-hidden flex-shrink-0 select-none",
          // showBadge && "rounded-tl-sm", // Removed: handled via explicit style
          getRarityColor(rarity, "bg")
        )}
        style={{
          width: iconSize,
          height: iconSize,
          // Use distinct properties to avoid "mixed shorthand" warning
          borderTopLeftRadius: showBadge
            ? corner.containerRadius
            : borderRadius,
          borderTopRightRadius: showLock
            ? corner.containerRadius
            : borderRadius,
          borderBottomRightRadius: borderRadius,
          borderBottomLeftRadius: borderRadius,
        }}
      >
        <img
          src={getAssetUrl(imagePath)}
          alt={imagePath}
          className="w-full h-full object-cover"
          style={{ transform: "scale(1.1)" }}
          draggable={false}
        />

        {/* Lock indicator - top right */}
        {showLock && (
          <div
            className="absolute flex items-center justify-center bg-red-900/90 shadow-sm"
            style={{
              width: corner.size,
              height: corner.size,
              top: corner.offset,
              right: corner.offset,
              borderRadius: corner.radius,
            }}
          >
            <Lock
              className="text-red-300"
              style={{
                width: corner.lockIconSize,
                height: corner.lockIconSize,
              }}
              strokeWidth={2.5}
            />
          </div>
        )}

        {/* Badge - top left */}
        {showBadge && (
          <div
            className="absolute bg-[#4a3b2a] text-[#eccf83] font-semibold text-center leading-none flex items-center justify-center"
            style={{
              width: corner.size,
              height: corner.size,
              top: corner.offset,
              left: corner.offset,
              fontSize: corner.fontSize,
              borderRadius: corner.radius,
            }}
          >
            {badge}
          </div>
        )}
        {children}
      </div>
    );

    // If no level, just return the icon
    if (!showLevel) {
      return (
        <div
          ref={ref}
          className={cn("flex-shrink-0 block", className)}
          style={wrapperStyle}
          {...props}
        >
          <div style={innerStyle}>{iconElement}</div>
        </div>
      );
    }

    // With level: flex column layout
    // Level bar overlaps behind icon's rounded corners via negative margin
    return (
      <div
        ref={ref}
        className={cn("flex-shrink-0 block", className)}
        style={wrapperStyle}
        {...props}
      >
        <div className="flex flex-col" style={innerStyle}>
          {/* Icon on top - elevated with z-index */}
          <div className="relative z-10">{iconElement}</div>
          {/* Level bar - overlaps behind icon's rounded corners */}
          <div
            className="flex items-end justify-center bg-[#f5f0e6] font-bold text-[#3d3d3d] leading-none select-none"
            style={{
              width: iconSize,
              height: levelConfig.height + levelConfig.cornerFill,
              marginTop: -levelConfig.cornerFill,
              paddingBottom: 1,
              fontSize: levelConfig.fontSize,
              borderBottomLeftRadius: borderRadius,
              borderBottomRightRadius: borderRadius,
            }}
          >
            {level}
          </div>
        </div>
      </div>
    );
  }
);

ItemIcon.displayName = "ItemIcon";
