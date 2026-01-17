import { forwardRef } from "react";
import { cn, getAssetUrl } from "@/lib/utils";
import { THEME } from "@/lib/theme";

interface ItemIconProps extends React.ComponentPropsWithoutRef<"div"> {
  imagePath: string;
  rarity?: number;
  label?: string; // e.g. "C6", "R5"
  size?: ItemIconSize; // Predefined sizes
  className?: string;
  alt?: string;
  children?: React.ReactNode;
}

// Size token definitions - change these to adjust all icons globally
// eslint-disable-next-line react-refresh/only-export-components
export const SIZE_CLASSES = {
  xs: "w-10 h-10",
  sm: "w-12 h-12",
  md: "w-14 h-14 rounded-md",
  lg: "w-16 h-16 rounded-lg",
  xl: "w-20 h-20 rounded-xl",
  "2xl": "w-24 h-24 rounded-2xl",
  full: "w-full h-full",
} as const;

export type ItemIconSize = keyof typeof SIZE_CLASSES;

export const ItemIcon = forwardRef<HTMLDivElement, ItemIconProps>(
  (
    {
      imagePath,
      rarity = 1,
      label,
      size = "lg",
      className,
      alt = "",
      children,
      ...props
    },
    ref,
  ) => {
    const sizeClass = SIZE_CLASSES[size] ?? size;

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden flex-shrink-0 select-none",
          sizeClass,
          "rounded-md",
          THEME.rarity.bg[rarity as keyof typeof THEME.rarity.bg] ||
            "bg-gray-500", // Rarity BG
          className,
        )}
        {...props}
      >
        <img
          src={getAssetUrl(imagePath)}
          alt={alt}
          className={cn("w-full h-full object-cover scale-110")}
          draggable={false}
        />
        {label && (
          <div className="absolute top-0 right-0 bg-black/60 text-xs text-white px-1 rounded-bl leading-tight font-bold">
            {label}
          </div>
        )}
        {children}
      </div>
    );
  },
);

ItemIcon.displayName = "ItemIcon";
