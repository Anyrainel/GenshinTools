import { useMemo, useState } from "react";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Rarity } from "@/data/enums";
import { allHalfSetIds, artifactIdToHalfSetId } from "@/data/gameResources";
import type { AccountData, ArtifactData } from "@/data/types";
import { useToggleSet } from "@/hooks/useToggleSet";
import {
  InventoryArtifactGrid,
  type TaggedArtifact,
} from "./InventoryArtifactGrid";
import { type InventoryChipOption, InventoryChipRow } from "./InventoryChipRow";
import { rarityColor } from "./InventoryWeaponGrid";

const ARTIFACT_RARITIES: Rarity[] = [5, 4];

const isMaxArtifact = (a: ArtifactData) =>
  (a.rarity === 5 && a.level === 20) || (a.rarity === 4 && a.level === 16);

interface InventoryArtifactSectionProps {
  data: AccountData;
  iconSize: "lg" | "xl";
  isEditMode: boolean;
  onArtifactClick: (a: TaggedArtifact) => void;
}

export function InventoryArtifactSection({
  data,
  iconSize,
  isEditMode,
  onArtifactClick,
}: InventoryArtifactSectionProps) {
  const { t } = useLanguage();
  const [showEquipped, setShowEquipped] = useState(false);
  const [showUnequipped, setShowUnequipped] = useState(true);
  const [showMaxLevel, setShowMaxLevel] = useState(true);
  const [showOther, setShowOther] = useState(false);
  const [rarities, toggleRarity] = useToggleSet<Rarity>(ARTIFACT_RARITIES);
  const [halfSetFilter, setHalfSetFilter] = useState<Set<string>>(
    () => new Set()
  );

  const equippedArtifacts: TaggedArtifact[] = useMemo(
    () =>
      data.characters.flatMap((c) =>
        Object.values(c.artifacts).map((a) => ({ ...a, equipped: true }))
      ),
    [data.characters]
  );

  const unequippedArtifacts: TaggedArtifact[] = useMemo(
    () => (data.extraArtifacts || []).map((a) => ({ ...a, equipped: false })),
    [data.extraArtifacts]
  );

  const filteredArtifacts = useMemo(() => {
    const combined = [...equippedArtifacts, ...unequippedArtifacts];

    return combined
      .filter((a) => {
        const eqMatch = a.equipped ? showEquipped : showUnequipped;
        const levelMatch = isMaxArtifact(a) ? showMaxLevel : showOther;
        if (!eqMatch || !levelMatch) return false;

        if (!rarities.has(a.rarity)) return false;

        if (halfSetFilter.size > 0) {
          const halfSetId = artifactIdToHalfSetId[a.setKey];
          if (halfSetId && !halfSetFilter.has(halfSetId)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.setKey !== b.setKey) return a.setKey.localeCompare(b.setKey);
        const slotOrder: Record<string, number> = {
          flower: 0,
          plume: 1,
          sands: 2,
          goblet: 3,
          circlet: 4,
        };
        return (slotOrder[a.slotKey] ?? 5) - (slotOrder[b.slotKey] ?? 5);
      });
  }, [
    equippedArtifacts,
    unequippedArtifacts,
    showEquipped,
    showUnequipped,
    showMaxLevel,
    showOther,
    rarities,
    halfSetFilter,
  ]);

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
    ...ARTIFACT_RARITIES.map((rarity, index) => ({
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
      <FilterChipGroup
        label={t.ui("triage.filterByHalfSet")}
        options={allHalfSetIds}
        selectedValues={halfSetFilter}
        onSelectedValuesChange={setHalfSetFilter}
        getKey={(halfSetId) => halfSetId}
        getLabel={(halfSetId) => t.halfSetShort(halfSetId)}
        collapsible
      />
      <InventoryArtifactGrid
        artifacts={filteredArtifacts}
        iconSize={iconSize}
        isEditMode={isEditMode}
        onArtifactClick={onArtifactClick}
      />
    </>
  );
}

export function getInventoryArtifactTotalCount(data: AccountData): number {
  return (
    data.characters.reduce(
      (count, c) => count + Object.values(c.artifacts).length,
      0
    ) + (data.extraArtifacts || []).length
  );
}
