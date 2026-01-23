import type { Rarity } from "@/data/types";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";
import { forwardRef } from "react";

interface ItemIconProps extends React.ComponentPropsWithoutRef<"div"> {
  imagePath: string;
  rarity?: Rarity;
  label?: string; // e.g. "C6", "R5" - Top Right
  badge?: string | number; // e.g. "1" - Top Left (Constellation/Refinement)
  size?: ItemIconSize; // Predefined sizes
  children?: React.ReactNode;
}

// Size token definitions - change these to adjust all icons globally
// eslint-disable-next-line react-refresh/only-export-components
export const SIZE_CLASSES = {
  xs: "w-10 h-10",
  sm: "w-12 h-12",
  md: "w-14 h-14 rounded-sm",
  lg: "w-16 h-16 rounded",
  xl: "w-20 h-20 rounded-md",
  "2xl": "w-24 h-24 rounded-lg",
  full: "w-full h-full rounded",
} as const;

const BADGE_CLASSES: Record<string, string> = {
  md: "text-[10px] w-[14px] h-[14px] top-[1px] left-[1px] rounded",
  lg: "text-xs w-4 h-4 top-[2px] left-[2px] rounded-sm",
  xl: "text-sm w-5 h-5 top-[3px] left-[3px] rounded",
  "2xl": "text-base w-6 h-6 top-1 left-1 rounded-lg",
  full: "text-[10px] w-4 h-4 top-0 left-0 rounded", // Fallback for full
};

export type ItemIconSize = keyof typeof SIZE_CLASSES;

export const ItemIcon = forwardRef<HTMLDivElement, ItemIconProps>(
  (
    { imagePath, rarity = 1, label, badge, size = "lg", children, ...props },
    ref
  ) => {
    const sizeClass = SIZE_CLASSES[size] ?? size;
    const badgeClass = BADGE_CLASSES[size] ?? BADGE_CLASSES.md;
    const showBadge = badge !== undefined && !["xs", "sm"].includes(size);

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden flex-shrink-0 select-none",
          sizeClass,
          "rounded-md",
          showBadge && "rounded-tl-sm",
          getRarityColor(rarity, "bg")
        )}
        {...props}
      >
        <img
          src={getAssetUrl(imagePath)}
          alt={imagePath}
          className={cn("w-full h-full object-cover scale-110")}
          draggable={false}
        />
        {label && (
          <div className="absolute top-0 right-0 bg-black/60 text-xs text-white px-1 rounded-bl leading-tight font-bold">
            {label}
          </div>
        )}
        {showBadge && (
          <div
            className={cn(
              "absolute bg-[#4a3b2a] text-[#eccf83] font-semibold text-center leading-none",
              badgeClass
            )}
          >
            {badge}
          </div>
        )}
        {children}
      </div>
    );
  }
);

ItemIcon.displayName = "ItemIcon";
