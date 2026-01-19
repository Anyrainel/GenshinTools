import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, getAssetUrl } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import type { TierItemData } from "./tierTableTypes";

interface TierItemProps<T extends TierItemData> {
  item: T;
  tier: string;
  /** The group value for this item (e.g., "Pyro" for element, "Sword" for weapon type) */
  groupValue: string;
  disabled?: boolean;
  alt: string;
  /** Optional image path for overlay badge (e.g., weapon type icon) */
  overlayImage?: string;
  tooltip?: React.ReactNode;
  /** Icon size variant */
  size?: "sm" | "md" | "lg" | "xl";
}

function TierItemComponent<T extends TierItemData>({
  item,
  tier,
  groupValue,
  disabled,
  alt,
  overlayImage,
  tooltip,
  size = "lg",
}: TierItemProps<T>) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: item.id,
      data: {
        itemId: item.id,
        tier: tier,
        group: groupValue,
      },
      disabled: disabled,
      animateLayoutChanges: () => false,
    });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : "none",
    zIndex: isDragging ? 1000 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  const overlay = overlayImage ? (
    <div className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center">
      <div className="relative bg-black/30 rounded-full backdrop-blur-sm">
        <img
          src={getAssetUrl(overlayImage)}
          alt={overlayImage}
          className="w-5 h-5 object-contain filter brightness-125 contrast-150 drop-shadow-lg"
          draggable={false}
        />
      </div>
    </div>
  ) : null;

  const content = (
    <ItemIcon
      imagePath={item.imagePath}
      rarity={item.rarity}
      alt={alt}
      size={size}
    >
      {overlay}
    </ItemIcon>
  );

  const renderItemContent = () => {
    // If dragging, return content without tooltip
    if (isDragging) {
      return content;
    }

    // Wrap with tooltip if provided
    if (tooltip) {
      return (
        <Tooltip disableHoverableContent>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="p-0 border-0 bg-transparent shadow-none"
          >
            {tooltip}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        "hover:scale-105",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      data-item-id={item.id}
    >
      {renderItemContent()}
    </div>
  );
}

// Memoize to prevent re-renders - TierItem is rendered 100+ times in the grid
export const TierItem = memo(TierItemComponent) as typeof TierItemComponent;
