import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { WeaponTierItem } from './WeaponTierItem';
import { weaponsById } from '@/data/constants';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface WeaponTierRowProps {
  tier: string;
  items: { id: string; position: number }[]; // weaponId, position
  onRemoveFromTiers?: (weaponId: string) => void;
  tierColor?: string;
  tierLabel?: string;
}

export const WeaponTierRow: React.FC<WeaponTierRowProps> = ({
  tier,
  items,
  tierColor = 'bg-slate-700',
  tierLabel,
}) => {
  const { t } = useLanguage();
  
  const { setNodeRef } = useDroppable({
    id: `tier-${tier}`,
    data: { tier },
  });

  // Create unique IDs for SortableContext (dnd-kit requires string IDs)
  // We use "tier-weaponId" pattern or just pass the weapon ID if they are unique in the context
  // Since a weapon appears only once in the tier list (usually), weapon ID is fine.
  // BUT the sortable strategy expects the IDs passed to it to match the `id` prop of the items.
  // In WeaponTierItem, we passed `id`.
  
  // Construct the items array for SortableContext. 
  // We need a unique ID for each item instance.
  // Let's use `tier-weaponId` to be safe, but TierItem uses `id` passed to it.
  const sortableItems = items.map(item => `${tier}-${item.id}`);

  return (
    <div className="flex w-full min-h-[5rem] mb-2 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700/50">
        {/* Tier Label Header */}
        <div className={cn(
            "w-24 md:w-32 flex-shrink-0 flex items-center justify-center p-2 text-center",
            tierColor
        )}>
            <span className="text-xl md:text-2xl font-bold text-white drop-shadow-md break-words w-full">
                {tierLabel || tier}
            </span>
        </div>

        {/* Droppable Area */}
        <div 
            ref={setNodeRef}
            className="flex-1 p-2 flex flex-wrap gap-2 items-start content-start min-h-[5rem]"
        >
            <SortableContext 
                items={sortableItems} 
                strategy={horizontalListSortingStrategy}
            >
                {items.map((item) => {
                    const weapon = weaponsById[item.id];
                    if (!weapon) return null;
                    
                    return (
                        <WeaponTierItem
                            key={`${tier}-${item.id}`}
                            id={`${tier}-${item.id}`} // Unique ID for dnd-kit
                            tier={tier}
                            weapon={weapon}
                            onDoubleClick={onRemoveFromTiers}
                        />
                    );
                })}
            </SortableContext>
        </div>
    </div>
  );
};
