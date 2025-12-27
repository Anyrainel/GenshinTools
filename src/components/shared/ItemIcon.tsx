import { forwardRef } from "react";
import { cn, getAssetUrl } from "@/lib/utils";
import { THEME } from "@/lib/theme";

interface ItemIconProps extends React.ComponentPropsWithoutRef<"div"> {
  imagePath: string;
  rarity?: number;
  label?: string; // e.g. "C6", "R5"
  size?: "xs" | "sm" | "md" | "lg" | "xl" | string; // Predefined sizes or arbitrary class
  className?: string;
  alt?: string;
  shape?: "square" | "circle"; // Default square
  children?: React.ReactNode;
}

export const ItemIcon = forwardRef<HTMLDivElement, ItemIconProps>(
  (
    {
      imagePath,
      rarity = 1,
      label,
      size = "md",
      className,
      alt = "",
      shape = "square",
      children,
      ...props
    },
    ref,
  ) => {
    const sizeClass =
      size === "xs"
        ? "w-6 h-6"
        : size === "sm"
          ? "w-8 h-8"
          : size === "md"
            ? "w-12 h-12"
            : size === "lg"
              ? "w-16 h-16"
              : size === "xl"
                ? "w-20 h-20"
                : size; // If string, use as class

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden flex-shrink-0 select-none",
          sizeClass,
          shape === "circle" ? "rounded-full" : "rounded-md",
          THEME.rarity.bg[rarity as keyof typeof THEME.rarity.bg] ||
            "bg-gray-500", // Rarity BG
          className,
        )}
        {...props}
      >
        <img
          src={getAssetUrl(imagePath)}
          alt={alt}
          className={cn(
            "w-full h-full object-cover",
            shape === "square" ? "object-cover" : "object-cover scale-110",
          )} // Slightly scale up for circle to avoid borders?
          draggable={false}
        />
        {label && (
          <div className="absolute top-0 right-0 bg-black/60 text-[9px] text-white px-1 rounded-bl leading-tight font-bold">
            {label}
          </div>
        )}
        {children}
      </div>
    );
  },
);

ItemIcon.displayName = "ItemIcon";
