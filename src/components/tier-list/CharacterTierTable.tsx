import type {
  Character,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import { Element, elements } from "@/data/types";
import { sortedCharacters, charactersById } from "@/data/constants";
import { TierTable } from "./TierTable";
import { TierItemData } from "./TierItem";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import {
  elementResourcesByName,
  weaponResourcesByName,
} from "@/data/constants";
import { getAssetUrl } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTierStore } from "@/stores/useTierStore";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";

interface CharacterTierTableProps {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  showTravelers: boolean;
  onAssignmentsChange: (newAssignments: TierAssignment) => void;
  tableRef?: React.Ref<HTMLDivElement>;
}

// Character implements TierItemData
const characterToTierItemData = (char: Character): Character & TierItemData => {
  return char as Character & TierItemData;
};

export default function CharacterTierTable({
  tierAssignments,
  tierCustomization,
  showTravelers,
  onAssignmentsChange,
  tableRef,
}: CharacterTierTableProps) {
  const showWeapons = useTierStore((state) => state.showWeapons);
  const { t } = useLanguage();

  const renderHeader = (group: string, count: number) => {
    return (
      <div
        key={group}
        className={cn(
          THEME.layout.centerBox,
          THEME.element.bg[group as Element],
          THEME.layout.gridBorder,
          "rounded-tl-md rounded-tr-md",
        )}
      >
        <img
          src={getAssetUrl(elementResourcesByName[group as Element].imagePath)}
          className="w-6 h-6 mr-2 brightness-110 contrast-125 object-contain"
          alt={t.element(group)}
        />
        <span className={cn(THEME.layout.labelText, "text-lg")}>
          {t.element(group)} ({count})
        </span>
      </div>
    );
  };

  const getImagePath = (character: Character) => character.imagePath;
  const getAlt = (character: Character) => t.character(character.id);
  const getOverlay = (character: Character) => {
    if (!showWeapons) return null;
    return (
      <div className={THEME.layout.weaponIconContainer}>
        <div className={THEME.layout.weaponIconBg}>
          <img
            src={getAssetUrl(
              weaponResourcesByName[character.weaponType].imagePath,
            )}
            alt={t.weaponType(character.weaponType)}
            className={THEME.layout.weaponIcon}
            draggable={false}
          />
        </div>
      </div>
    );
  };
  const getTooltip = (character: Character) => (
    <CharacterTooltip characterId={character.id} />
  );

  const renderPreview = (character: Character) => {
    return (
      <ItemIcon
        imagePath={character.imagePath}
        rarity={character.rarity}
        alt={t.character(character.id)}
        size="lg"
        className={THEME.layout.itemCard.replace("w-16 h-16 ", "")}
      >
        {showWeapons && (
          <div className={THEME.layout.weaponIconContainer}>
            <div className={THEME.layout.weaponIconBg}>
              <img
                src={getAssetUrl(
                  weaponResourcesByName[character.weaponType].imagePath,
                )}
                alt={t.weaponType(character.weaponType)}
                className={THEME.layout.weaponIcon}
                draggable={false}
              />
            </div>
          </div>
        )}
      </ItemIcon>
    );
  };

  const getItemData = (character: Character) => {
    return {
      element: character.element,
    };
  };

  const getItemGroup = (character: Character) => {
    return character.element;
  };

  const getGroupCount = (
    element: string,
    itemsPerTier: { [tier: string]: Character[] },
  ) => {
    return Object.entries(itemsPerTier)
      .filter(([tier]) => tier !== "Pool")
      .reduce((sum, [, chars]) => {
        return sum + chars.filter((c) => c.element === element).length;
      }, 0);
  };

  const isValidDrop = (activeChar: Character, overId: string) => {
    if (charactersById[overId]) {
      return charactersById[overId].element === activeChar.element;
    }
    if (overId.includes("-")) {
      const [, element] = overId.split("-");
      return element === activeChar.element;
    }
    return false;
  };

  const filterItem = (character: Character) => {
    if (character.id.startsWith("traveler") && !showTravelers) {
      return false;
    }
    return true;
  };

  const getTierDisplayName = (tier: string) => {
    return t.ui(`tiers.${tier}`) || tier;
  };

  return (
    <TierTable<Character>
      items={sortedCharacters.map(characterToTierItemData)}
      itemsById={charactersById}
      tierAssignments={tierAssignments}
      tierCustomization={tierCustomization}
      onAssignmentsChange={onAssignmentsChange}
      isValidDrop={isValidDrop}
      groups={elements}
      getItemGroup={getItemGroup}
      getGroupCount={getGroupCount}
      renderHeader={renderHeader}
      renderPreview={renderPreview}
      getItemData={getItemData}
      getTierDisplayName={getTierDisplayName}
      filterItem={filterItem}
      getImagePath={getImagePath}
      getAlt={getAlt}
      getOverlay={getOverlay}
      getTooltip={getTooltip}
      tableRef={tableRef}
    />
  );
}
