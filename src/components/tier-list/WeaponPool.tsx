import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { WeaponTierItem } from './WeaponTierItem';
import { weapons } from '@/data/resources';
import { TierAssignment } from '@/data/types';

interface WeaponPoolProps {
  tierAssignments: TierAssignment;
  onRemoveFromTiers?: (weaponId: string) => void;
}

export const WeaponPool = React.memo<WeaponPoolProps>(({ tierAssignments, onRemoveFromTiers }) => {
  const { setNodeRef } = useDroppable({
    id: 'pool-area',
    data: { tier: 'Pool' },
  });

  const poolWeapons = useMemo(() => {
    return weapons.filter(weapon => {
      const assignment = tierAssignments[weapon.id];
      return !assignment || assignment.tier === 'Pool';
    });
  }, [tierAssignments]);

  const itemIds = useMemo(() => poolWeapons.map(w => w.id), [poolWeapons]);

  return (
    <div ref={setNodeRef} className="flex flex-wrap gap-2 content-start min-h-[100px]">
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        {poolWeapons.map((weapon) => (
          <WeaponTierItem
            key={weapon.id}
            id={weapon.id}
            tier="Pool"
            weapon={weapon}
            // onDoubleClick={/* maybe add functionality to move to S tier on double click? */}
          />
        ))}
      </SortableContext>
    </div>
  );
}, (prev, next) => {
    // Custom comparator to avoid re-renders when assignments change but Pool content remains same?
    // Actually, if an assignment changes (drag from S to A), the Pool shouldn't change.
    // But `tierAssignments` object reference changes.
    
    // Check if the set of IDs in pool changed.
    // This is O(N) but N is total weapons. might be slightly heavy but better than render.
    
    // Optimization: Check only if any weapon changed status from/to Pool?
    // We can just iterate weapons and check if their pool status matches.
    
    // Simple check:
    if (prev.tierAssignments === next.tierAssignments) return true;
    
    // Deep check
    // We can't easily know WHICH changed without iterating.
    
    // Let's rely on useMemo inside the component for `poolWeapons`. 
    // React.memo on the component basically does what useMemo does but prevents VDOM diffing.
    // Let's implement a comparator that checks if the list of pool IDs has changed.
    
    const isPool = (assignments: TierAssignment, id: string) => {
        const a = assignments[id];
        return !a || a.tier === 'Pool';
    };

    // We can iterate over all weapons (200+) to check stability.
    // Compared to rendering, it's cheap.
    for (const weapon of weapons) {
        if (isPool(prev.tierAssignments, weapon.id) !== isPool(next.tierAssignments, weapon.id)) {
            return false;
        }
    }
    
    return true;
});

WeaponPool.displayName = 'WeaponPool';
