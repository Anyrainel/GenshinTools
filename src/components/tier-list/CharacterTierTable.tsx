import type { Character, TierAssignment, TierCustomization } from '@/data/types';
import { Element, elements } from '@/data/types';
import { characters } from '@/data/resources';
import { charactersById } from '@/data/constants';
import { TierTable } from './TierTable';
import { TierItemData } from './TierItem';
import { cn } from '@/lib/utils';
import { RARITY_COLORS, ELEMENT_COLORS, LAYOUT } from '@/constants/theme';
import { elementResourcesByName, weaponResourcesByName } from '@/data/constants';
import { getAssetUrl } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTierStore } from '@/stores/useTierStore';
import { CharacterTooltip } from './CharacterTooltip';

interface CharacterTierTableProps {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  showTravelers: boolean;
  onAssignmentsChange: (newAssignments: TierAssignment) => void;
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
}: CharacterTierTableProps) {
  const showWeapons = useTierStore((state) => state.showWeapons);
  const { t } = useLanguage();

  const renderHeader = (element: string, count: number) => {
    return (
      <div
        key={element}
        className={cn(
          LAYOUT.CENTER_BOX,
          ELEMENT_COLORS[element as keyof typeof ELEMENT_COLORS],
          LAYOUT.GRID_BORDER,
          'rounded-tl-md rounded-tr-md'
        )}
      >
        <img
          src={getAssetUrl(elementResourcesByName[element as Element].imagePath)}
          className="w-6 h-6 mr-2 brightness-110 contrast-125 object-contain"
          alt={t.element(element)}
        />
        <span className={cn(LAYOUT.LABEL_TEXT, 'text-lg')}>
          {t.element(element)} ({count})
        </span>
      </div>
    );
  };

  const getImagePath = (character: Character) => character.imagePath;
  const getAlt = (character: Character) => t.character(character.id);
  const getOverlay = (character: Character) => {
    if (!showWeapons) return null;
    return (
      <div className={LAYOUT.WEAPON_ICON_CONTAINER}>
        <div className={LAYOUT.WEAPON_ICON_BG}>
          <img
            src={getAssetUrl(
              weaponResourcesByName[character.weaponType].imagePath
            )}
            alt={t.weaponType(character.weaponType)}
            className={LAYOUT.WEAPON_ICON}
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
      <div
        className={cn(
          LAYOUT.ITEM_CARD,
          RARITY_COLORS[character.rarity]
        )}
      >
        <img
          src={getAssetUrl(character.imagePath)}
          alt={t.character(character.id)}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {showWeapons && (
          <div className={LAYOUT.WEAPON_ICON_CONTAINER}>
            <div className={LAYOUT.WEAPON_ICON_BG}>
              <img
                src={getAssetUrl(
                  weaponResourcesByName[character.weaponType].imagePath
                )}
                alt={t.weaponType(character.weaponType)}
                className={LAYOUT.WEAPON_ICON}
                draggable={false}
              />
            </div>
          </div>
        )}
      </div>
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
    itemsPerTier: { [tier: string]: Character[] }
  ) => {
    return Object.entries(itemsPerTier)
      .filter(([tier]) => tier !== 'Pool')
      .reduce((sum, [, chars]) => {
        return sum + chars.filter((c) => c.element === element).length;
      }, 0);
  };

  const isValidDrop = (activeChar: Character, overId: string) => {
    if (charactersById[overId]) {
      return charactersById[overId].element === activeChar.element;
    }
    if (overId.includes('-')) {
      const [, element] = overId.split('-');
      return element === activeChar.element;
    }
    return false;
  };

  const filterItem = (character: Character) => {
    if (character.id.startsWith('traveler') && !showTravelers) {
      return false;
    }
    return true;
  };

  const getTierDisplayName = (tier: string) => {
    return t.ui(`tiers.${tier}`) || tier;
  };

  return (
    <TierTable<Character>
      items={characters.map(characterToTierItemData)}
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
    />
  );
}

