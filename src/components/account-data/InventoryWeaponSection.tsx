import { useMemo, useState } from "react";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MainStat, Rarity } from "@/data/enums";
import { weaponsById } from "@/data/gameResources";
import {
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { AccountData, WeaponData } from "@/data/types";
import { useToggleSet } from "@/hooks/useToggleSet";
import { type InventoryChipOption, InventoryChipRow } from "./InventoryChipRow";
import {
  groupWeapons,
  InventoryWeaponGrid,
  rarityColor,
  type TaggedWeapon,
} from "./InventoryWeaponGrid";

const WEAPON_RARITIES: Rarity[] = [5, 4, 3];

const isMaxWeapon = (w: WeaponData) => w.level === 90;

interface InventoryWeaponSectionProps {
  data: AccountData;
  iconSize: "lg" | "xl";
  isEditMode: boolean;
  onWeaponClick: (w: TaggedWeapon) => void;
}

export function InventoryWeaponSection({
  data,
  iconSize,
  isEditMode,
  onWeaponClick,
}: InventoryWeaponSectionProps) {
  const { t } = useLanguage();
  const weaponStats = weaponStatsResource.use();
  const [showEquipped, setShowEquipped] = useState(false);
  const [showUnequipped, setShowUnequipped] = useState(true);
  const [showMaxLevel, setShowMaxLevel] = useState(true);
  const [showOther, setShowOther] = useState(false);
  const [rarities, toggleRarity] = useToggleSet<Rarity>(WEAPON_RARITIES);
  const [selectedSubstats, setSelectedSubstats] = useState<Set<MainStat>>(
    () => new Set()
  );

  const allSecondaryStats = useMemo(() => {
    if (!weaponStats) return [];
    return [
      ...new Set(
        Object.values(weaponStats)
          .map((s) => s.secondaryStat)
          .filter(Boolean)
      ),
    ];
  }, [weaponStats]);

  const equippedWeapons: TaggedWeapon[] = useMemo(
    () =>
      data.characters
        .filter((c) => c.weapon)
        .map((c) => ({ ...c.weapon!, equipped: true })),
    [data.characters]
  );

  const unequippedWeapons: TaggedWeapon[] = useMemo(
    () => (data.extraWeapons || []).map((w) => ({ ...w, equipped: false })),
    [data.extraWeapons]
  );

  const filteredWeapons = useMemo(() => {
    const combined = [...equippedWeapons, ...unequippedWeapons];

    return combined.filter((w) => {
      const eqMatch = w.equipped ? showEquipped : showUnequipped;
      const levelMatch = isMaxWeapon(w) ? showMaxLevel : showOther;
      if (!eqMatch || !levelMatch) return false;

      const info = weaponsById[w.key];
      const meta = info
        ? getWeaponDisplayMeta(info, weaponStats?.[w.key])
        : null;
      const rarity = meta?.rarity ?? info?.rarity ?? 1;
      if (!rarities.has(rarity as Rarity)) return false;

      if (selectedSubstats.size > 0 && meta?.secondaryStat) {
        if (!selectedSubstats.has(meta.secondaryStat)) return false;
      }

      return true;
    });
  }, [
    equippedWeapons,
    unequippedWeapons,
    showEquipped,
    showUnequipped,
    showMaxLevel,
    showOther,
    rarities,
    selectedSubstats,
    weaponStats,
  ]);

  const groupedWeapons = useMemo(() => {
    const sorted = filteredWeapons.slice().sort((a, b) => {
      const infoA = weaponsById[a.key];
      const infoB = weaponsById[b.key];
      const metaA = infoA
        ? getWeaponDisplayMeta(infoA, weaponStats?.[a.key])
        : null;
      const metaB = infoB
        ? getWeaponDisplayMeta(infoB, weaponStats?.[b.key])
        : null;
      if (metaA && metaB && metaA.rarity !== metaB.rarity)
        return metaB.rarity - metaA.rarity;
      if (
        metaA?.type != null &&
        metaB?.type != null &&
        metaA.type !== metaB.type
      )
        return metaA.type.localeCompare(metaB.type);
      return a.key.localeCompare(b.key);
    });
    return groupWeapons(sorted);
  }, [filteredWeapons, weaponStats]);

  const sortedWeaponSubstats = useMemo(
    () =>
      [...allSecondaryStats].sort((a, b) => t.stat(a).localeCompare(t.stat(b))),
    [allSecondaryStats, t]
  );

  const categoryChips: InventoryChipOption[] = [
    {
      key: "unequipped",
      label: t.ui("accountData.unequipped"),
      color: "lime",
      active: showUnequipped,
      onClick: () => setShowUnequipped((p) => !p),
    },
    {
      key: "equipped",
      label: t.ui("accountData.equipped"),
      color: "lime",
      active: showEquipped,
      onClick: () => setShowEquipped((p) => !p),
    },
    {
      key: "max-level",
      label: t.ui("accountData.maxLevel"),
      color: "lime",
      active: showMaxLevel,
      onClick: () => setShowMaxLevel((p) => !p),
    },
    {
      key: "other-level",
      label: t.ui("accountData.other"),
      color: "lime",
      active: showOther,
      onClick: () => setShowOther((p) => !p),
    },
    ...WEAPON_RARITIES.map((rarity, index) => ({
      key: `rarity-${rarity}`,
      label: `${rarity}★`,
      color: rarityColor[rarity] ?? "sky",
      active: rarities.has(rarity),
      separatorBefore: index === 0,
      onClick: () => toggleRarity(rarity),
    })),
  ];

  return (
    <>
      <InventoryChipRow chips={categoryChips} className="gap-1.5" />
      {allSecondaryStats.length > 0 && (
        <FilterChipGroup
          label={t.ui("accountData.filterBySubstat")}
          options={sortedWeaponSubstats}
          selectedValues={selectedSubstats}
          onSelectedValuesChange={setSelectedSubstats}
          getKey={(stat) => stat}
          getLabel={(stat) => t.stat(stat)}
          collapsible
        />
      )}
      <InventoryWeaponGrid
        weapons={groupedWeapons}
        iconSize={iconSize}
        t={t}
        isEditMode={isEditMode}
        onWeaponClick={onWeaponClick}
      />
    </>
  );
}

export function getInventoryWeaponTotalCount(data: AccountData): number {
  return (
    data.characters.filter((c) => c.weapon).length +
    (data.extraWeapons || []).length
  );
}
