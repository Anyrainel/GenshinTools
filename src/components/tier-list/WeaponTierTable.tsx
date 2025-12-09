import type { Weapon, TierAssignment, TierCustomization } from '@/data/types';
import { tiers } from '@/data/types';
import { weapons } from "@/data/resources";
import { weaponsById } from "@/data/constants";

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
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { WeaponTierItemPreview } from "./WeaponTierItemPreview";
import { useState, useMemo, useEffect, useRef } from "react";
import WeaponTierGrid from "./WeaponTierGrid";


interface WeaponTierTableProps {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  onTierAssignment: (draggedWeaponId: string, dropTargetWeaponId: string | null, tier: string, direction: 'left' | 'right') => void;
  onRemoveFromTiers: (weaponId: string) => void;
}

const WeaponTierTable = ({
  tierAssignments,
  tierCustomization,
  onTierAssignment,
  onRemoveFromTiers,
}: WeaponTierTableProps) => {

  const [activeWeapon, setActiveWeapon] = useState<Weapon | null>(null);
  const [localAssignments, setLocalAssignments] = useState<TierAssignment>(tierAssignments);

  // Sync local state with props when not dragging
  useEffect(() => {
    if (!activeWeapon) {
      setLocalAssignments(tierAssignments);
    }
  }, [tierAssignments, activeWeapon]);
  
  // Track hover state for visual preview
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  
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
    }),
  );

  const allTiers = useMemo(() => {
    return [...tiers, 'Pool'].filter(tier => !tierCustomization[tier]?.hidden);
  }, [tierCustomization]);

  const weaponsPerTier = useMemo(() => {
    const map: { [tier: string]: Weapon[] } = {};

    allTiers.forEach(tier => {
      map[tier] = [];
    });

    weapons.forEach(weapon => {
      const assignment = localAssignments[weapon.id];
      if (assignment) {
        if (!tierCustomization[assignment.tier]?.hidden) {
          map[assignment.tier].push(weapon);
        } else {
          map['Pool'].push(weapon);
        }
      } else {
        map['Pool'].push(weapon);
      }
    });

    allTiers.forEach(tier => {
      map[tier].sort((a, b) => {
        const assignmentA = localAssignments[a.id];
        const assignmentB = localAssignments[b.id];
        const posA = assignmentA?.position ?? 0;
        const posB = assignmentB?.position ?? 0;
        return posA - posB;
      });
    });

    return map;
  }, [localAssignments, tierCustomization, allTiers]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const weapon = weaponsById[active.id as string];
    if (weapon) {
      setActiveWeapon(weapon);
    }
  };

      const isValidDrop = (activeWeap: Weapon, overId: string) => {
        if (weaponsById[overId]) {
          return weaponsById[overId].type === activeWeap.type;
        }
        if (overId.includes('-')) {
          const [, type] = overId.split('-');
          return type === activeWeap.type;
        }
        return false;
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
    
        const activeWeap = weaponsById[activeId];
        if (!activeWeap) return;
    
        // Check for valid drop target (same type)
        if (!isValidDrop(activeWeap, overId)) {
            // If invalid, reset preview to original state
            setLocalAssignments(tierAssignments);
            return;
        }
    
        // Debounce the state update to prevent jitter
        dragOverTimeoutRef.current = setTimeout(() => {
            // Helper to get tier from ID (weapon or container)
            const getTier = (id: string): string => {
              if (weaponsById[id]) {
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
                   if (weaponsById[overId]) {
                     const overIndex = targetItems.findIndex(i => i.id === overId);
                     if (overIndex !== -1) {
                        newIndex = overIndex;
                     }
                   }
    
                   // Update positions for target tier
                   // Shift items after newIndex
                   
                   // Reconstruct target list with inserted item
                   const newTargetList = [...targetItems];
                   newTargetList.splice(newIndex, 0, { id: activeId, tier: targetTier, position: 0 });
                   
                   newTargetList.forEach((item, index) => {
                     newAssignments[item.id] = { tier: targetTier, position: index };
                   });
                   
                   // Re-index source tier
                   if (sourceTier !== 'Pool') {
                      const sourceItems = Object.entries(newAssignments)
                        .filter(([id, val]) => val.tier === sourceTier && id !== activeId)
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
                    const oldIndex = targetItems.findIndex(i => i.id === activeId);
                    const newIndex = targetItems.findIndex(i => i.id === overId);
                    
                    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
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
        setActiveWeapon(null);
        setHoveredCardId(null);
    
        if (!over) return; // No drop target
    
        const activeId = active.id as string;
        const overId = over.id as string;
        const activeWeap = weaponsById[activeId];
    
        if (!activeWeap) return;
    
        // Validate drop target again
        if (!isValidDrop(activeWeap, overId)) {
            setLocalAssignments(tierAssignments);
            return;
        }
    
        const finalAssignment = localAssignments[activeId];
    
        if (!finalAssignment) {
            onRemoveFromTiers(activeId);
            return;
        }
    
        const { tier, position } = finalAssignment;
    
        if (tier === 'Pool') {
            onRemoveFromTiers(activeId);
            return;
        }
    
        const neighbor = Object.entries(localAssignments).find(
            (entry) => entry[1].tier === tier && entry[1].position === position + 1
        );
    
        if (neighbor) {
            onTierAssignment(activeId, neighbor[0], tier, 'left');
        } else {
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
          <WeaponTierGrid
            allTiers={allTiers}
            weaponsPerTier={weaponsPerTier}
            tierCustomization={tierCustomization}
            onRemoveFromTiers={onRemoveFromTiers}
            hoveredCardId={hoveredCardId}
          />
        </div>
      </div>


      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeWeapon ? <WeaponTierItemPreview weapon={activeWeapon} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default WeaponTierTable;