import React from "react";
import {
  Weapon,
  TierAssignment,
  TierCustomization,
  WeaponType,
  weaponTypes,
  MainStat,
} from "@/data/types";
import { sortedWeapons } from "@/data/constants";
import { cn, getAssetUrl } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { TierTable } from "./TierTable";
import { TierItemData } from "./TierItem";
import { weaponsById, weaponResourcesByName } from "@/data/constants";
import { useLanguage } from "@/contexts/LanguageContext";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";

// Weapon implements TierItemData
const weaponToTierItemData = (weapon: Weapon): Weapon & TierItemData => {
  return weapon as Weapon & TierItemData;
};

interface WeaponTierTableProps {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  onAssignmentsChange: (newAssignments: TierAssignment) => void;
  showRarity5: boolean;
  showRarity4: boolean;
  showRarity3: boolean;
  allowedSecondaryStats: MainStat[];
  tableRef?: React.Ref<HTMLDivElement>;
}

export default function WeaponTierTable({
  tierAssignments,
  tierCustomization,
  onAssignmentsChange,
  showRarity5,
  showRarity4,
  showRarity3,
  allowedSecondaryStats,
  tableRef,
}: WeaponTierTableProps) {
  const { t } = useLanguage();

  const renderHeader = (weaponType: string, count: number) => {
    const resource = weaponResourcesByName[weaponType as WeaponType];
    return (
      <div
        key={weaponType}
        className={cn(
          THEME.layout.centerBox,
          THEME.layout.gridBorder,
          "bg-cyan-900/70 backdrop-blur-sm rounded-tl-md rounded-tr-md",
        )}
      >
        <img
          src={getAssetUrl(resource?.imagePath)}
          alt={weaponType}
          className="w-6 h-6 mr-2 object-contain drop-shadow-md brightness-150"
        />
        <span className={cn(THEME.layout.labelText, "text-lg text-shadow-sm")}>
          {t.weaponType(weaponType)} ({count})
        </span>
      </div>
    );
  };

  const getImagePath = (weapon: Weapon) => weapon.imagePath;
  const getAlt = (weapon: Weapon) => t.weaponName(weapon.id);
  const getTooltip = (weapon: Weapon) => <WeaponTooltip weaponId={weapon.id} />;

  const renderPreview = (weapon: Weapon) => {
    return (
      <ItemIcon
        imagePath={weapon.imagePath}
        rarity={weapon.rarity}
        alt={t.weaponName(weapon.id)}
        size="lg"
        className={THEME.layout.itemCard.replace("w-16 h-16 ", "")}
      />
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
    group: string,
    itemsPerTier: { [tier: string]: Weapon[] },
  ) => {
    return Object.entries(itemsPerTier)
      .filter(([tier]) => tier !== "Pool")
      .reduce((sum, [, weapons]) => {
        return sum + weapons.filter((w) => w.type === group).length;
      }, 0);
  };

  const isValidDrop = (activeWeapon: Weapon, overId: string) => {
    if (weaponsById[overId]) {
      return weaponsById[overId].type === activeWeapon.type;
    }
    if (overId.includes("-")) {
      const [, type] = overId.split("-");
      // Check if type matches weapon type
      return type === activeWeapon.type;
    }
    return false;
  };

  const filterItem = (weapon: Weapon) => {
    if (weapon.rarity === 5 && !showRarity5) return false;
    if (weapon.rarity === 4 && !showRarity4) return false;
    if (weapon.rarity === 3 && !showRarity3) return false;
    if (!allowedSecondaryStats.includes(weapon.secondaryStat)) return false;
    return true;
  };

  const getTierDisplayName = (tier: string) => {
    return t.ui(`tiers.${tier}`) || tier;
  };

  return (
    <TierTable<Weapon>
      items={sortedWeapons.map(weaponToTierItemData)}
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
      filterItem={filterItem}
      getImagePath={getImagePath}
      getAlt={getAlt}
      getTooltip={getTooltip}
      tableRef={tableRef}
    />
  );
}
