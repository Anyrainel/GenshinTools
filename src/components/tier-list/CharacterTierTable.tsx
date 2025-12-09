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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CharacterTierTableProps {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  showTravelers: boolean;
  onTierAssignment: (
    draggedCharacterId: string,
    dropTargetCharacterId: string | null,
    tier: string,
    direction: 'left' | 'right'
  ) => void;
  onRemoveFromTiers: (characterId: string) => void;
}

// Character implements TierItemData
const characterToTierItemData = (char: Character): Character & TierItemData => {
  return char as Character & TierItemData;
};

export default function CharacterTierTable({
  tierAssignments,
  tierCustomization,
  showTravelers,
  onTierAssignment,
  onRemoveFromTiers,
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

  const renderCellContent = (character: Character, isDragging: boolean) => {
    const content = (
      <div
        className={cn(
          'w-16 h-16 rounded-md overflow-hidden relative',
          RARITY_COLORS[character.rarity]
        )}
      >
        <img
          src={getAssetUrl(character.imagePath)}
          alt={t.character(character.id)}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
        {showWeapons && (
          <div className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center">
            <div className="relative bg-black/30 rounded-full backdrop-blur-sm">
              <img
                src={getAssetUrl(
                  weaponResourcesByName[character.weaponType].imagePath
                )}
                alt={t.weaponType(character.weaponType)}
                className="w-5 h-5 object-contain filter brightness-125 contrast-150 drop-shadow-lg"
                draggable={false}
              />
            </div>
          </div>
        )}
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
          <CharacterTooltip characterId={character.id} />
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderPreview = (character: Character) => {
    return (
      <div
        className={`w-16 h-16 rounded-md overflow-hidden relative ${RARITY_COLORS[character.rarity]}`}
      >
        <img
          src={getAssetUrl(character.imagePath)}
          alt={t.character(character.id)}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {showWeapons && (
          <div className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center">
            <div className="relative bg-black/30 rounded-full backdrop-blur-sm">
              <img
                src={getAssetUrl(
                  weaponResourcesByName[character.weaponType].imagePath
                )}
                alt={t.weaponType(character.weaponType)}
                className="w-5 h-5 object-contain filter brightness-125 contrast-150 drop-shadow-lg"
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
      onTierAssignment={onTierAssignment}
      onRemoveFromTiers={onRemoveFromTiers}
      isValidDrop={isValidDrop}
      groups={elements}
      getItemGroup={getItemGroup}
      getGroupCount={getGroupCount}
      renderHeader={renderHeader}
      renderCellContent={renderCellContent}
      renderPreview={renderPreview}
      getItemData={getItemData}
      getTierDisplayName={getTierDisplayName}
      filterItem={filterItem}
    />
  );
}

