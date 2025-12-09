import React from 'react';
import { TierItemData } from './TierItem';

interface TierItemPreviewProps<T extends TierItemData> {
  item: T;
  renderContent: (item: T) => React.ReactNode;
}

/**
 * Presentational component for drag overlay preview.
 * Does NOT use any dnd-kit hooks (useDraggable/useSortable).
 */
export function TierItemPreview<T extends TierItemData>({
  item,
  renderContent,
}: TierItemPreviewProps<T>) {
  return (
    <div
      style={{
        opacity: 0.8,
        transform: 'scale(1.05)',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        cursor: 'grabbing',
      }}
    >
      {renderContent(item)}
    </div>
  );
}
