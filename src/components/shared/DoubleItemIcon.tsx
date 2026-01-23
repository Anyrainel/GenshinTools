import { type ItemIconSize, SIZE_CLASSES } from "@/components/shared/ItemIcon";
import { cn, getAssetUrl } from "@/lib/utils";
import { forwardRef } from "react";

interface DoubleItemIconProps extends React.ComponentPropsWithoutRef<"div"> {
  imagePath1: string;
  imagePath2: string;
  size?: ItemIconSize;
  className?: string;
  alt1?: string;
  alt2?: string;
}

export const DoubleItemIcon = forwardRef<HTMLDivElement, DoubleItemIconProps>(
  (
    { imagePath1, imagePath2, size = "lg", className, alt1, alt2, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          SIZE_CLASSES[size],
          "rounded-md overflow-hidden relative shadow-md border-2 border-[#b27330] bg-[#3a2d13]",
          className
        )}
        {...props}
      >
        {/* Background - Rarity 5 style */}
        <div className="absolute inset-0 bg-[#b27330]" />

        {/* Top Left Half - Shifted towards corner */}
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] z-10">
          <img
            src={getAssetUrl(imagePath1)}
            className="w-full h-full object-cover"
            alt={alt1}
            draggable={false}
          />
        </div>
        {/* Bottom Right Half - Shifted towards corner */}
        <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] z-20">
          <img
            src={getAssetUrl(imagePath2)}
            className="w-full h-full object-cover"
            alt={alt2}
            draggable={false}
          />
        </div>
        {/* Divider Line (BL to TR slash) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-5">
          <div className="w-[1px] h-[200%] bg-black/20 rotate-45" />
        </div>
      </div>
    );
  }
);

DoubleItemIcon.displayName = "DoubleItemIcon";
