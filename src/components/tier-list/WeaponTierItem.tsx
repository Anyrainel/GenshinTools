import React, { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Weapon } from '@/data/types';
import { getAssetUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { RARITY_COLORS } from '@/constants/theme';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { WeaponTooltip } from '@/components/WeaponTooltip';

interface WeaponTierItemProps {
  weapon: Weapon;
  id: string;
  tier: string;
  disabled?: boolean;
  onDoubleClick?: (weaponId: string) => void;
}

export const WeaponTierItem = React.memo<WeaponTierItemProps>(({
  weapon,
  id,
  tier,
  disabled,
  onDoubleClick,
}) => {
  const { t } = useLanguage();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: id,
    data: {
      weaponId: weapon.id,
      tier: tier,
      type: weapon.type,
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
    onDoubleClick?.(weapon.id);
  }, [onDoubleClick, weapon.id]);

  // We are using Tooltip from shadcn/ui which uses Radix UI
  // Note: TierList page must wrap this in TooltipProvider

  return (
    <>
      {isDragging ? (
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          className={cn(
            'w-16 h-16 rounded-md overflow-hidden relative',
            RARITY_COLORS[weapon.rarity],
            'cursor-grab active:cursor-grabbing',
            'hover:scale-105 transition-transform',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onDoubleClick={handleDoubleClick}
          data-weapon-id={weapon.id}
        >
          <img
            src={getAssetUrl(weapon.imagePath)}
            alt={t.weaponName(weapon.id)}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />        </div>
      ) : (
        <Tooltip disableHoverableContent>
          <TooltipTrigger asChild>
            <div
              ref={setNodeRef}
              style={style}
              {...attributes}
              {...listeners}
              className={cn(
                'w-16 h-16 rounded-md overflow-hidden relative',
                RARITY_COLORS[weapon.rarity],
                'cursor-grab active:cursor-grabbing',
                'hover:scale-105 transition-transform',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              onDoubleClick={handleDoubleClick}
              data-weapon-id={weapon.id}
            >
              <img
                src={getAssetUrl(weapon.imagePath)}
                alt={t.weaponName(weapon.id)}
                className="w-full h-full object-cover"
                loading="lazy"
                draggable={false}
              />            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10} className="p-0 border-0 bg-transparent shadow-none">
            <WeaponTooltip weaponId={weapon.id} />
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
});

WeaponTierItem.displayName = 'WeaponTierItem';
