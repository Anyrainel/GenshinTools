import React, { useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Rarity } from "@/data/types";
import { ItemIcon } from "@/components/shared/ItemIcon";

export interface TierItemData {
  id: string;
  rarity: Rarity;
  [key: string]: unknown;
}

interface TierItemProps<T extends TierItemData> {
  item: T;
  id: string;
  tier: string;
  disabled?: boolean;
  onDoubleClick?: (itemId: string) => void;
  getItemData: (item: T) => Record<string, unknown>;
  imagePath: string;
  alt: string;
  overlay?: React.ReactNode;
  tooltip?: React.ReactNode;
}

export function TierItem<T extends TierItemData>({
  item,
  id,
  tier,
  disabled,
  onDoubleClick,
  getItemData,
  imagePath,
  alt,
  overlay,
  tooltip,
}: TierItemProps<T>) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: id,
      data: {
        itemId: item.id,
        tier: tier,
        ...getItemData(item),
      },
      disabled: disabled,
      animateLayoutChanges: () => false,
    });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : "none",
    zIndex: isDragging ? 1000 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(item.id);
  }, [onDoubleClick, item.id]);

  const content = (
    <ItemIcon
      imagePath={imagePath}
      rarity={item.rarity}
      alt={alt}
      size="lg"
      className={THEME.layout.itemCard.replace("w-16 h-16 ", "")} // Preserve other layout styles but let size="lg" handle dims
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
        disabled && "opacity-50 cursor-not-allowed",
      )}
      onDoubleClick={handleDoubleClick}
      data-item-id={item.id}
    >
      {renderItemContent()}
    </div>
  );
}
