import type { Character, TierAssignment, TierCustomization } from '@/data/types';
import { tiers } from '@/data/types';
import { characters } from "@/data/resources";
import { charactersById } from "@/data/constants";

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
import { TierItemPreview } from "./TierItemPreview";
import { useState, useMemo, useEffect, useRef } from "react";
import TierGrid from "./TierGrid";


interface TierTableProps {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  showTravelers: boolean;
  onTierAssignment: (draggedCharacterId: string, dropTargetCharacterId: string | null, tier: string, direction: 'left' | 'right') => void;
  onRemoveFromTiers: (characterId: string) => void;
}

const TierTable = ({
  tierAssignments,
  tierCustomization,
  showTravelers,
  onTierAssignment,
  onRemoveFromTiers,
}: TierTableProps) => {

  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [localAssignments, setLocalAssignments] = useState<TierAssignment>(tierAssignments);

  // Sync local state with props when not dragging
  useEffect(() => {
    if (!activeCharacter) {
      setLocalAssignments(tierAssignments);
    }
  }, [tierAssignments, activeCharacter]);
  
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

  const charactersPerTier = useMemo(() => {
    const map: { [tier: string]: Character[] } = {};

    allTiers.forEach(tier => {
      map[tier] = [];
    });

    characters.forEach(character => {
      if (character.id.startsWith("traveler") && !showTravelers) {
        return;
      }
      const assignment = localAssignments[character.id];
      if (assignment) {
        if (!tierCustomization[assignment.tier]?.hidden) {
          map[assignment.tier].push(character);
        } else {
          map['Pool'].push(character);
        }
      } else {
        map['Pool'].push(character);
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
  }, [localAssignments, tierCustomization, allTiers, showTravelers]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const character = charactersById[active.id as string];
    if (character) {
      setActiveCharacter(character);
    }
  };

      const isValidDrop = (activeChar: Character, overId: string) => {
        if (charactersById[overId]) {
          return charactersById[overId].element === activeChar.element;
        }
        if (overId.includes('-')) {
          const [, element] = overId.split('-');
          return element === activeChar.element;
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
    
        const activeChar = charactersById[activeId];
        if (!activeChar) return;
    
        // Check for valid drop target (same element)
        if (!isValidDrop(activeChar, overId)) {
            // If invalid, reset preview to original state
            setLocalAssignments(tierAssignments);
            return;
        }
    
        // Debounce the state update to prevent jitter
        dragOverTimeoutRef.current = setTimeout(() => {
            // Helper to get tier from ID (character or container)
            const getTier = (id: string): string => {
              if (charactersById[id]) {
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
                   // Remove from old tier logic is handled by just overwriting the assignment
                   // But we need to re-index the OLD tier? 
                   // Ideally yes, but visually it might not matter until drop.
                   // For simplicity, let's just focus on the target tier insertion.
                   
                   // If over a character, insert before/after based on direction?
                   // dnd-kit provides index.
                   // Let's rely on simple "insert at end" if container, or "swap" if character for now?
                   // No, "iOS style" means insert at specific index.
                   
                   // Find insertion index
                   let newIndex = targetItems.length;
                   if (charactersById[overId]) {
                     const overIndex = targetItems.findIndex(i => i.id === overId);
                     if (overIndex !== -1) {
                        // Determine relative position?
                        // Simple approach: Insert at overIndex. 
                        newIndex = overIndex;
                        // If moving downwards in same list, it's different, but here it's different lists.
                     }
                   }
    
                   // Insert activeId at newIndex in targetItems
                   // But wait, we need to update the `position` of ALL items in targetTier.
                   
                   // Remove activeId if it was already in targetItems (shouldn't happen if source!=target)
                   
                   // Create new list for target Tier
                   const newTargetList = [...targetItems];
                   newTargetList.splice(newIndex, 0, { id: activeId, tier: targetTier, position: 0 });
                   
                   // Update positions
                   newTargetList.forEach((item, index) => {
                     newAssignments[item.id] = { tier: targetTier, position: index };
                   });
                   
                   // We should also re-index source tier to avoid gaps? 
                   // Yes, otherwise jumping back might be weird.
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
        setActiveCharacter(null);
        setHoveredCardId(null);
    
        if (!over) return; // No drop target
    
        const activeId = active.id as string;
        const overId = over.id as string;
        const activeChar = charactersById[activeId];
    
        if (!activeChar) return;
    
        // Validate drop target again
        if (!isValidDrop(activeChar, overId)) {
            // Invalid drop, do nothing (assignments revert to initial state on next render/effect)
            // Or we can force reset local to trigger re-render
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
        // We want to tell the parent: "Insert activeId BEFORE neighbor"
        const neighbor = Object.entries(localAssignments).find(
            (entry) => entry[1].tier === tier && entry[1].position === position + 1
        );
    
        if (neighbor) {
            onTierAssignment(activeId, neighbor[0], tier, 'left');
        } else {
            // No neighbor after, so we are at the end (or alone).
            // We can pass null as target to insert at end.
            onTierAssignment(activeId, null, tier, 'right');
        }
      };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver} // Add this
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4">
          <TierGrid
            allTiers={allTiers}
            charactersPerTier={charactersPerTier}
            tierCustomization={tierCustomization}
            onRemoveFromTiers={onRemoveFromTiers}
            hoveredCardId={hoveredCardId}
          />
        </div>
      </div>


      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeCharacter ? <TierItemPreview character={activeCharacter} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default TierTable;
