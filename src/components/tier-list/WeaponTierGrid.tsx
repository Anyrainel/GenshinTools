import React, { useMemo } from 'react';
import type { Weapon, TierCustomization } from '@/data/types';
import { WeaponTierItem } from './WeaponTierItem';
import { cn } from '@/lib/utils';
import { TIER_COLORS, TIER_BG_COLORS, LAYOUT } from '@/constants/theme';
import { weaponTypes } from '@/data/types';
import { weaponResourcesByName } from '@/data/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { getAssetUrl } from '@/lib/utils';

interface WeaponTierGridProps {
  allTiers: string[];
  weaponsPerTier: { [tier: string]: Weapon[] };
  tierCustomization: TierCustomization;
  onRemoveFromTiers: (weaponId: string) => void;
  hoveredCardId: string | null;
}

const TierHeader = React.memo(() => {
  const { t } = useLanguage();
  return (
    <React.Fragment>
      {weaponTypes.map((type) => {
        return (
          <div
            key={type}
            className={cn(
              LAYOUT.CENTER_BOX,
              'bg-slate-700/80',
              LAYOUT.GRID_BORDER,
              'rounded-tl-md rounded-tr-md',
            )}
          >
            <img
              src={getAssetUrl(weaponResourcesByName[type].imagePath)}
              className='w-6 h-6 mr-2 brightness-110 contrast-125 object-contain'
              alt={t.weaponType(type)}
            />
            <span className={cn(LAYOUT.LABEL_TEXT, 'text-lg')}>
              {t.weaponType(type)}
            </span>
          </div>
        );
      })}
    </React.Fragment>
  );
});
TierHeader.displayName = 'TierHeader';

const TierTypeCell = React.memo(({ tier, type, weapons, onRemoveFromTiers }: { tier: string; type: string; weapons: Weapon[], onRemoveFromTiers: (id: string) => void }) => {
  const cellId = `${tier}-${type}`;
  const { setNodeRef } = useDroppable({
    id: cellId,
    data: { tier, type },
  });

  const itemIds = useMemo(() => weapons.map(w => w.id), [weapons]);

  return (
    <div
      ref={setNodeRef}
      key={cellId}
      className={cn(
        'p-2',
        LAYOUT.MIN_ROW_HEIGHT,
        TIER_BG_COLORS[tier as keyof typeof TIER_BG_COLORS],
        LAYOUT.GRID_BORDER,
      )}
      data-tier={tier}
      data-type={type}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <div className='flex flex-wrap justify-center gap-2'>
          {weapons.map((weapon) => (
            <WeaponTierItem
              key={weapon.id}
              weapon={weapon}
              id={weapon.id}
              tier={tier}
              onDoubleClick={onRemoveFromTiers}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}, (prev, next) => {
    if (prev.tier !== next.tier) return false;
    if (prev.type !== next.type) return false;
    // weapons passed here are now specific to this type, so strict equality check or length+id check is fine
    if (prev.weapons === next.weapons) return true;
    
    if (prev.weapons.length !== next.weapons.length) return false;
    for (let i = 0; i < prev.weapons.length; i++) {
        if (prev.weapons[i].id !== next.weapons[i].id) return false;
    }
    
    return true;
});
TierTypeCell.displayName = 'TierTypeCell';

const TierRow = React.memo(({ tier, weapons, tierCustomization, onRemoveFromTiers }: { tier: string; weapons: Weapon[], tierCustomization: TierCustomization, onRemoveFromTiers: (id: string) => void }) => {
  const { t } = useLanguage();
  const customName = tierCustomization[tier]?.displayName;
  const displayName = customName || t.ui(`tiers.${tier}`) || tier;
  const hasCustomNames = Object.values(tierCustomization).some(custom => custom?.displayName);

  // Group weapons by type to pass specific arrays to cells
  const weaponsByType = useMemo(() => {
      const groups: Record<string, Weapon[]> = {};
      weaponTypes.forEach(t => groups[t] = []);
      weapons.forEach(w => {
          if (groups[w.type]) groups[w.type].push(w);
      });
      return groups;
  }, [weapons]);

  return (
    <React.Fragment key={`${tier}-row`}>
      <div key={`${tier}`}
        className={cn(
          LAYOUT.CENTER_BOX,
          LAYOUT.MIN_ROW_HEIGHT,
          TIER_COLORS[tier as keyof typeof TIER_COLORS],
          LAYOUT.GRID_BORDER,
          'rounded-l-md',
          hasCustomNames && 'max-w-48',
        )}>
        <span className={cn(LAYOUT.LABEL_TEXT, customName ? 'text-lg' : 'text-2xl')}>
          {displayName}
        </span>
      </div>
      {weaponTypes.map((type) => (
        <TierTypeCell
          key={`${tier}-${type}`}
          tier={tier}
          type={type}
          weapons={weaponsByType[type]}
          onRemoveFromTiers={onRemoveFromTiers}
        />
      ))}
    </React.Fragment>
  );
}, (prev, next) => {
    if (prev.tier !== next.tier) return false;
    // Check if weapons content changed (IDs match)
    if (prev.weapons === next.weapons) return true; // Referential equality
    
    if (prev.weapons.length !== next.weapons.length) return false;
    
    // Assuming they are sorted by position, simple iteration is enough.
    // If position changed, the array order changes, so this will detect it.
    for (let i = 0; i < prev.weapons.length; i++) {
        if (prev.weapons[i].id !== next.weapons[i].id) return false;
    }
    
    // Check customization name change
    if (prev.tierCustomization[prev.tier]?.displayName !== next.tierCustomization[next.tier]?.displayName) return false;
    
    // Check if hasCustomNames changed (global layout shift)
    const prevHas = Object.values(prev.tierCustomization).some(c => c?.displayName);
    const nextHas = Object.values(next.tierCustomization).some(c => c?.displayName);
    if (prevHas !== nextHas) return false;

    return true;
});
TierRow.displayName = 'TierRow';

const WeaponTierGrid = ({
  allTiers,
  weaponsPerTier,
  tierCustomization,
  onRemoveFromTiers,
  hoveredCardId,
}: WeaponTierGridProps) => {
  
  // This check is fast enough
  const hasCustomNames = Object.values(tierCustomization).some(custom => custom?.displayName);

  return (
    <div className={cn(
      'grid select-none',
      hasCustomNames ? 'grid-cols-[minmax(4rem,max-content)_repeat(5,1fr)]' : 'grid-cols-[4rem_repeat(5,1fr)]'
    )}>
      <div key={'empty'} />
      <TierHeader />

      {allTiers.map(tier => (
        <TierRow
          key={tier}
          tier={tier}
          weapons={weaponsPerTier[tier] || []}
          tierCustomization={tierCustomization}
          onRemoveFromTiers={onRemoveFromTiers}
        />
      ))}
    </div>
  );
};

export default WeaponTierGrid;
