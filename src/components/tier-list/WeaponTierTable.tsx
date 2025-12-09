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

interface WeaponTierTableProps {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  onAssignmentsChange: (newAssignments: TierAssignment) => void;
  showRarity5: boolean;
  showRarity4: boolean;
  showRarity3: boolean;
}

// Weapon implements TierItemData
const weaponToTierItemData = (weapon: Weapon): Weapon & TierItemData => {
  return weapon as Weapon & TierItemData;
};

export default function WeaponTierTable({
  tierAssignments,
  tierCustomization,
  onAssignmentsChange,
  showRarity5,
  showRarity4,
  showRarity3,
}: WeaponTierTableProps) {
  const { t } = useLanguage();

  const filterItem = (weapon: Weapon) => {
    if (weapon.rarity === 5 && !showRarity5) return false;
    if (weapon.rarity === 4 && !showRarity4) return false;
    if (weapon.rarity === 3 && !showRarity3) return false;
    return true;
  };

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

  const getImagePath = (weapon: Weapon) => weapon.imagePath;
  const getAlt = (weapon: Weapon) => t.weaponName(weapon.id);
  const getTooltip = (weapon: Weapon) => <WeaponTooltip weaponId={weapon.id} />;

  const renderPreview = (weapon: Weapon) => {
    return (
      <div
        className={cn(
          LAYOUT.ITEM_CARD,
          RARITY_COLORS[weapon.rarity]
        )}
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
      onAssignmentsChange={onAssignmentsChange}
      isValidDrop={isValidDrop}
      groups={weaponTypes}
      getItemGroup={getItemGroup}
      getGroupCount={getGroupCount}
      renderHeader={renderHeader}
      renderPreview={renderPreview}
      getItemData={getItemData}
      getTierDisplayName={getTierDisplayName}
      getImagePath={getImagePath}
      getAlt={getAlt}
      getTooltip={getTooltip}
      filterItem={filterItem}
    />
  );
}
