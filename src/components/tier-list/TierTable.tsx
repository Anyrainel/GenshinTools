import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  pointerWithin,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { TierItemPreview } from './TierItemPreview';
import { TierItemData } from './TierItem';
import { TierGrid } from './TierGrid';
import { useState, useMemo, useEffect, useRef } from 'react';

interface TierTableProps<T extends TierItemData> {
  items: T[];
  itemsById: Record<string, T>;
  tierAssignments: { [itemId: string]: { tier: string; position: number } };
  tierCustomization: {
    [tier: string]: { displayName?: string; hidden?: boolean };
  };
  onTierAssignment: (
    draggedItemId: string,
    dropTargetItemId: string | null,
    tier: string,
    direction: 'left' | 'right'
  ) => void;
  onRemoveFromTiers: (itemId: string) => void;
  isValidDrop: (activeItem: T, overId: string) => boolean;
  groups: string[]; // elements or weapon types
  getItemGroup: (item: T) => string;
  getGroupCount: (group: string, itemsPerTier: { [tier: string]: T[] }) => number;
  renderHeader: (group: string, count: number) => React.ReactNode;
  renderCellContent: (item: T, isDragging: boolean) => React.ReactNode;
  renderPreview: (item: T) => React.ReactNode;
  getItemData: (item: T) => Record<string, any>;
  getTierDisplayName: (tier: string) => string; // Function to get tier display name (with translation)
  filterItem?: (item: T) => boolean; // Optional filter (e.g., showTravelers)
}

export function TierTable<T extends TierItemData>({
  items,
  itemsById,
  tierAssignments,
  tierCustomization,
  onTierAssignment,
  onRemoveFromTiers,
  isValidDrop,
  groups,
  getItemGroup,
  getGroupCount,
  renderHeader,
  renderCellContent,
  renderPreview,
  getItemData,
  getTierDisplayName,
  filterItem,
}: TierTableProps<T>) {
  const [activeItem, setActiveItem] = useState<T | null>(null);
  const [localAssignments, setLocalAssignments] = useState<
    typeof tierAssignments
  >(tierAssignments);

  // Sync local state with props when not dragging
  useEffect(() => {
    if (!activeItem) {
      setLocalAssignments(tierAssignments);
    }
  }, [tierAssignments, activeItem]);


  // Debounce ref for drag over updates
  const dragOverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const allTiers = useMemo(() => {
    const defaultTiers = ['S', 'A', 'B', 'C', 'D'];
    return [...defaultTiers, 'Pool'].filter(
      (tier) => !tierCustomization[tier]?.hidden
    );
  }, [tierCustomization]);

  const itemsPerTier = useMemo(() => {
    const map: { [tier: string]: T[] } = {};

    allTiers.forEach((tier) => {
      map[tier] = [];
    });

    items.forEach((item) => {
      if (filterItem && !filterItem(item)) {
        return;
      }
      const assignment = localAssignments[item.id];
      if (assignment) {
        if (!tierCustomization[assignment.tier]?.hidden) {
          map[assignment.tier].push(item);
        } else {
          map['Pool'].push(item);
        }
      } else {
        map['Pool'].push(item);
      }
    });

    allTiers.forEach((tier) => {
      map[tier].sort((a, b) => {
        const assignmentA = localAssignments[a.id];
        const assignmentB = localAssignments[b.id];
        const posA = assignmentA?.position ?? 0;
        const posB = assignmentB?.position ?? 0;
        return posA - posB;
      });
    });

    return map;
  }, [localAssignments, tierCustomization, allTiers, items, filterItem]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = itemsById[active.id as string];
    if (item) {
      setActiveItem(item);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    // Clear any pending update
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
      dragOverTimeoutRef.current = null;
    }

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeItem = itemsById[activeId];
    if (!activeItem) return;

    // Check for valid drop target
    if (!isValidDrop(activeItem, overId)) {
      // If invalid, reset preview to original state
      setLocalAssignments(tierAssignments);
      return;
    }

    // Debounce the state update to prevent jitter
    dragOverTimeoutRef.current = setTimeout(() => {
      // Helper to get tier from ID (item or container)
      const getTier = (id: string): string => {
        if (itemsById[id]) {
          return localAssignments[id]?.tier || 'Pool';
        }
        if (id.includes('-')) {
          return id.split('-')[0];
        }
        return 'Pool';
      };

      const sourceTier = localAssignments[activeId]?.tier || 'Pool';
      const targetTier = getTier(overId);

      setLocalAssignments((prev) => {
        const newAssignments = { ...prev };

        // Get all items in target tier, sorted
        const targetItems = Object.entries(newAssignments)
          .filter(([, val]) => val.tier === targetTier)
          .map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => a.position - b.position);

        // If moving to a new tier
        if (sourceTier !== targetTier) {
          // Find insertion index
          let newIndex = targetItems.length;
          if (itemsById[overId]) {
            const overIndex = targetItems.findIndex((i) => i.id === overId);
            if (overIndex !== -1) {
              newIndex = overIndex;
            }
          }

          // Create new list for target Tier
          const newTargetList = [...targetItems];
          newTargetList.splice(newIndex, 0, {
            id: activeId,
            tier: targetTier,
            position: 0,
          });

          // Update positions
          newTargetList.forEach((item, index) => {
            newAssignments[item.id] = { tier: targetTier, position: index };
          });

          // Re-index source tier
          if (sourceTier !== 'Pool') {
            const sourceItems = Object.entries(newAssignments)
              .filter(
                ([id, val]) => val.tier === sourceTier && id !== activeId
              )
              .map(([id, val]) => ({ id, ...val }))
              .sort((a, b) => a.position - b.position);
            sourceItems.forEach((item, index) => {
              newAssignments[item.id] = { tier: sourceTier, position: index };
            });
          }

          return newAssignments;
        }

        // Same tier reordering
        if (sourceTier === targetTier && sourceTier !== 'Pool') {
          const oldIndex = targetItems.findIndex((i) => i.id === activeId);
          const newIndex = targetItems.findIndex((i) => i.id === overId);

          if (
            oldIndex !== -1 &&
            newIndex !== -1 &&
            oldIndex !== newIndex
          ) {
            // Move item
            const [moved] = targetItems.splice(oldIndex, 1);
            targetItems.splice(newIndex, 0, moved);

            // Update positions
            targetItems.forEach((item, index) => {
              newAssignments[item.id] = { tier: targetTier, position: index };
            });
            return newAssignments;
          }
        }

        return prev;
      });
    }, 20); // 20ms debounce
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Clear any pending update
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
      dragOverTimeoutRef.current = null;
    }

    const { active, over } = event;
    setActiveItem(null);

    if (!over) return; // No drop target

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeItem = itemsById[activeId];

    if (!activeItem) return;

    // Validate drop target again
    if (!isValidDrop(activeItem, overId)) {
      // Invalid drop, do nothing
      setLocalAssignments(tierAssignments);
      return;
    }

    const finalAssignment = localAssignments[activeId];

    if (!finalAssignment) {
      // Should be in pool or not assigned
      onRemoveFromTiers(activeId);
      return;
    }

    const { tier, position } = finalAssignment;

    if (tier === 'Pool') {
      onRemoveFromTiers(activeId);
      return;
    }

    // Find the neighbor to anchor the drop
    const neighbor = Object.entries(localAssignments).find(
      (entry) => entry[1].tier === tier && entry[1].position === position + 1
    );

    if (neighbor) {
      onTierAssignment(activeId, neighbor[0], tier, 'left');
    } else {
      // No neighbor after, so we are at the end
      onTierAssignment(activeId, null, tier, 'right');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4 overflow-y-auto">
          <TierGrid
            allTiers={allTiers}
            groups={groups}
            itemsPerTier={itemsPerTier}
            tierCustomization={tierCustomization}
            onRemoveFromTiers={onRemoveFromTiers}
            renderHeader={renderHeader}
            renderCellContent={renderCellContent}
            getItemData={getItemData}
            getItemGroup={getItemGroup}
            getGroupCount={getGroupCount}
            getTierDisplayName={getTierDisplayName}
          />
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeItem ? (
          <TierItemPreview item={activeItem} renderContent={renderPreview} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
