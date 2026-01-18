import { tiers } from "@/data/types";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";
import { TierGrid } from "./TierGrid";
import type { TierItemData } from "./TierItem";
import { TierItemPreview } from "./TierItemPreview";

interface TierTableProps<T extends TierItemData> {
  items: T[];
  itemsById: Record<string, T>;
  tierAssignments: { [itemId: string]: { tier: string; position: number } };
  tierCustomization: {
    [tier: string]: { displayName?: string; hidden?: boolean };
  };
  onAssignmentsChange: (newAssignments: {
    [itemId: string]: { tier: string; position: number };
  }) => void;
  isValidDrop: (activeItem: T, overId: string) => boolean;
  groups: string[]; // Element[] or WeaponType[]
  getItemGroup: (item: T) => string;
  getGroupCount: (
    group: string,
    itemsPerTier: { [tier: string]: T[] }
  ) => number;
  renderHeader: (group: string, count: number) => React.ReactNode;
  renderPreview: (item: T) => React.ReactNode;
  getItemData: (item: T) => Record<string, unknown>;
  getTierDisplayName: (tier: string) => string;
  filterItem?: (item: T) => boolean;
  getImagePath: (item: T) => string;
  getAlt: (item: T) => string;
  getOverlay?: (item: T) => React.ReactNode;
  getTooltip: (item: T) => React.ReactNode;
  tableRef?: React.Ref<HTMLDivElement>;
}

export function TierTable<T extends TierItemData>({
  items,
  itemsById,
  tierAssignments,
  tierCustomization,
  onAssignmentsChange,
  isValidDrop,
  groups,
  getItemGroup,
  getGroupCount,
  renderHeader,
  renderPreview,
  getItemData,
  getTierDisplayName,
  filterItem,
  getImagePath,
  getAlt,
  getOverlay,
  getTooltip,
  tableRef,
}: TierTableProps<T>) {
  const [activeItem, setActiveItem] = useState<T | null>(null);
  const [localAssignments, setLocalAssignments] =
    useState<typeof tierAssignments>(tierAssignments);

  // Sync local state with props when not dragging
  useEffect(() => {
    if (!activeItem) {
      setLocalAssignments(tierAssignments);
    }
  }, [tierAssignments, activeItem]);

  // Debounce ref for drag over updates
  const dragOverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return tiers.filter((tier) => !tierCustomization[tier]?.hidden);
  }, [tierCustomization]);

  const itemsPerTier = useMemo(() => {
    const map: { [tier: string]: T[] } = {};

    for (const tier of allTiers) {
      map[tier] = [];
    }

    for (const item of items) {
      if (filterItem && !filterItem(item)) {
        continue;
      }
      const assignment = localAssignments[item.id];
      if (assignment) {
        if (!tierCustomization[assignment.tier]?.hidden) {
          map[assignment.tier].push(item);
        } else {
          map.Pool.push(item);
        }
      } else {
        map.Pool.push(item);
      }
    }

    for (const tier of allTiers) {
      map[tier].sort((a, b) => {
        const assignmentA = localAssignments[a.id];
        const assignmentB = localAssignments[b.id];
        const posA = assignmentA?.position ?? 0;
        const posB = assignmentB?.position ?? 0;
        return posA - posB;
      });
    }

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
          return localAssignments[id]?.tier || "Pool";
        }
        if (id.includes("-")) {
          return id.split("-")[0];
        }
        return "Pool";
      };

      const sourceTier = localAssignments[activeId]?.tier || "Pool";
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
          let targetIndex = 0;
          for (const item of newTargetList) {
            newAssignments[item.id] = {
              tier: targetTier,
              position: targetIndex,
            };
            targetIndex++;
          }

          // Re-index source tier
          if (sourceTier !== "Pool") {
            const sourceItems = Object.entries(newAssignments)
              .filter(([id, val]) => val.tier === sourceTier && id !== activeId)
              .map(([id, val]) => ({ id, ...val }))
              .sort((a, b) => a.position - b.position);
            let sourceIndex = 0;
            for (const item of sourceItems) {
              newAssignments[item.id] = {
                tier: sourceTier,
                position: sourceIndex,
              };
              sourceIndex++;
            }
          }

          return newAssignments;
        }

        // Same tier reordering
        if (sourceTier === targetTier && sourceTier !== "Pool") {
          const oldIndex = targetItems.findIndex((i) => i.id === activeId);
          const newIndex = targetItems.findIndex((i) => i.id === overId);

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            // Move item
            const [moved] = targetItems.splice(oldIndex, 1);
            targetItems.splice(newIndex, 0, moved);

            // Update positions
            let reorderIndex = 0;
            for (const item of targetItems) {
              newAssignments[item.id] = {
                tier: targetTier,
                position: reorderIndex,
              };
              reorderIndex++;
            }
            return newAssignments;
          }
        }

        return prev;
      });
    }, 20); // 20ms debounce
  };

  // Internal handler for tier assignment - computes new assignments and calls onAssignmentsChange
  const handleTierAssignmentInternal = (
    draggedItemId: string,
    dropTargetItemId: string | null,
    tier: string,
    direction: "left" | "right"
  ) => {
    const newAssignments = { ...tierAssignments };

    // 1. Get all items currently in the target tier (excluding the dragged one)
    const targetTierItems = Object.entries(tierAssignments)
      .filter(
        ([id, assignment]) => assignment.tier === tier && id !== draggedItemId
      )
      .map(([id, assignment]) => ({ id, ...assignment }))
      .sort((a, b) => a.position - b.position);

    // 2. Determine insertion index
    let insertIndex = targetTierItems.length; // Default to end

    if (dropTargetItemId) {
      const targetIndex = targetTierItems.findIndex(
        (item) => item.id === dropTargetItemId
      );
      if (targetIndex !== -1) {
        if (direction === "left") {
          insertIndex = targetIndex;
        } else {
          insertIndex = targetIndex + 1;
        }
      }
    } else {
      // If dropping on empty container or specifically requesting end
      if (direction === "left") insertIndex = 0;
    }

    // 3. Insert dragged item
    targetTierItems.splice(insertIndex, 0, {
      id: draggedItemId,
      tier: tier,
      position: 0, // Placeholder, will be updated
    });

    // 4. Re-assign positions for the entire tier
    let positionIndex = 0;
    for (const item of targetTierItems) {
      newAssignments[item.id] = { tier, position: positionIndex };
      positionIndex++;
    }

    onAssignmentsChange(newAssignments);
  };

  // Internal handler for removing from tiers - computes new assignments and calls onAssignmentsChange
  const handleRemoveFromTiersInternal = (itemId: string) => {
    const newAssignments = { ...tierAssignments };
    const oldAssignment = tierAssignments[itemId];
    const item = itemsById[itemId];
    if (!item) return;

    if (oldAssignment) {
      const itemGroup = getItemGroup(item);
      const groupItems = Object.entries(tierAssignments)
        .filter(([id, assignment]) => {
          const otherItem = itemsById[id];
          return (
            otherItem &&
            getItemGroup(otherItem) === itemGroup &&
            assignment.tier === oldAssignment.tier
          );
        })
        .map(([id, assignment]) => ({
          id,
          position: assignment.position,
        }))
        .sort((a, b) => a.position - b.position);

      delete newAssignments[item.id];

      // Re-position remaining items in the tier
      let newPosition = 0;
      for (const groupItem of groupItems) {
        if (groupItem.id !== item.id) {
          newAssignments[groupItem.id] = {
            tier: oldAssignment.tier,
            position: newPosition,
          };
          newPosition++;
        }
      }
    } else {
      delete newAssignments[itemId];
    }

    onAssignmentsChange(newAssignments);
  };

  // Use legacy callbacks if provided, otherwise use internal handlers
  const onTierAssignment = handleTierAssignmentInternal;
  const onRemoveFromTiers = handleRemoveFromTiersInternal;

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

    if (tier === "Pool") {
      onRemoveFromTiers(activeId);
      return;
    }

    // Find the neighbor to anchor the drop
    const neighbor = Object.entries(localAssignments).find(
      (entry) => entry[1].tier === tier && entry[1].position === position + 1
    );

    if (neighbor) {
      onTierAssignment(activeId, neighbor[0], tier, "left");
    } else {
      // No neighbor after, so we are at the end
      onTierAssignment(activeId, null, tier, "right");
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
        <div ref={tableRef} className="flex-1 p-4 overflow-y-auto">
          <TierGrid
            allTiers={allTiers}
            groups={groups}
            itemsPerTier={itemsPerTier}
            tierCustomization={tierCustomization}
            onRemoveFromTiers={onRemoveFromTiers}
            renderHeader={renderHeader}
            getItemData={getItemData}
            getItemGroup={getItemGroup}
            getGroupCount={getGroupCount}
            getTierDisplayName={getTierDisplayName}
            getImagePath={getImagePath}
            getAlt={getAlt}
            getOverlay={getOverlay}
            getTooltip={getTooltip}
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
