import React, { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

export interface TierItemData {
  id: string;
  rarity: number;
  [key: string]: any; // Allow additional properties
}

interface TierItemProps<T extends TierItemData> {
  item: T;
  id: string;
  tier: string;
  disabled?: boolean;
  onDoubleClick?: (itemId: string) => void;
  renderContent: (item: T, isDragging: boolean) => React.ReactNode;
  getItemData: (item: T) => Record<string, any>;
}

export function TierItem<T extends TierItemData>({
  item,
  id,
  tier,
  disabled,
  onDoubleClick,
  renderContent,
  getItemData,
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
    transform: isDragging ? CSS.Transform.toString(transform) : 'none',
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(item.id);
  }, [onDoubleClick, item.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        'hover:scale-105',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onDoubleClick={handleDoubleClick}
      data-item-id={item.id}
    >
      {renderContent(item, isDragging)}
    </div>
  );
}
