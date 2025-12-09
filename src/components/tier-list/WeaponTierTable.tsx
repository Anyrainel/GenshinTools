import type { Weapon, WeaponType, TierAssignment, TierCustomization } from '@/data/types';
import { weaponTypes } from '@/data/types';
import { weapons } from '@/data/resources';
import { weaponsById, weaponResourcesByName } from '@/data/constants';
import { TierTable } from './TierTable';
import { TierItemData } from './TierItem';
import { cn } from '@/lib/utils';
import { RARITY_COLORS, LAYOUT } from '@/constants/theme';
import { getAssetUrl } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { WeaponTooltip } from './WeaponTooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface WeaponTierTableProps {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  onTierAssignment: (
    draggedWeaponId: string,
    dropTargetWeaponId: string | null,
    tier: string,
    direction: 'left' | 'right'
  ) => void;
  onRemoveFromTiers: (weaponId: string) => void;
}

// Weapon implements TierItemData
const weaponToTierItemData = (weapon: Weapon): Weapon & TierItemData => {
  return weapon as Weapon & TierItemData;
};

export default function WeaponTierTable({
  tierAssignments,
  tierCustomization,
  onTierAssignment,
  onRemoveFromTiers,
}: WeaponTierTableProps) {
  const { t } = useLanguage();

  const renderHeader = (type: string, count: number) => {
    return (
      <div
        key={type}
        className={cn(
          LAYOUT.CENTER_BOX,
          'bg-slate-700/80',
          LAYOUT.GRID_BORDER,
          'rounded-tl-md rounded-tr-md'
        )}
      >
        <img
          src={getAssetUrl(weaponResourcesByName[type as WeaponType].imagePath)}
          className="w-6 h-6 mr-2 brightness-110 contrast-125 object-contain"
          alt={t.weaponType(type)}
        />
        <span className={cn(LAYOUT.LABEL_TEXT, 'text-lg')}>
          {t.weaponType(type)}
        </span>
      </div>
    );
  };

  const renderCellContent = (weapon: Weapon, isDragging: boolean) => {
    const content = (
      <div
        className={cn(
          'w-16 h-16 rounded-md overflow-hidden relative',
          RARITY_COLORS[weapon.rarity]
        )}
      >
        <img
          src={getAssetUrl(weapon.imagePath)}
          alt={t.weaponName(weapon.id)}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
      </div>
    );

    if (isDragging) {
      return content;
    }

    return (
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={10}
          className="p-0 border-0 bg-transparent shadow-none"
        >
          <WeaponTooltip weaponId={weapon.id} />
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderPreview = (weapon: Weapon) => {
    return (
      <div
        className={`w-16 h-16 rounded-md overflow-hidden relative ${RARITY_COLORS[weapon.rarity]}`}
      >
        <img
          src={getAssetUrl(weapon.imagePath)}
          alt={t.weaponName(weapon.id)}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
    );
  };

  const getItemData = (weapon: Weapon) => {
    return {
      type: weapon.type,
    };
  };

  const getItemGroup = (weapon: Weapon) => {
    return weapon.type;
  };

  const getGroupCount = (
    type: string,
    itemsPerTier: { [tier: string]: Weapon[] }
  ) => {
    // For weapons, we don't show counts in header (original implementation doesn't)
    return 0;
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

  const getTierDisplayName = (tier: string) => {
    return t.ui(`tiers.${tier}`) || tier;
  };

  return (
    <TierTable<Weapon>
      items={weapons.map(weaponToTierItemData)}
      itemsById={weaponsById}
      tierAssignments={tierAssignments}
      tierCustomization={tierCustomization}
      onTierAssignment={onTierAssignment}
      onRemoveFromTiers={onRemoveFromTiers}
      isValidDrop={isValidDrop}
      groups={weaponTypes}
      getItemGroup={getItemGroup}
      getGroupCount={getGroupCount}
      renderHeader={renderHeader}
      renderCellContent={renderCellContent}
      renderPreview={renderPreview}
      getItemData={getItemData}
      getTierDisplayName={getTierDisplayName}
    />
  );
}
