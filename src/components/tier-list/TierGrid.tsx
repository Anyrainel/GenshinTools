import React from 'react';
import type { Character, TierCustomization } from '@/data/types'; // Use shared Character type
import { TierItem } from './TierItem'; // Renamed component
import { cn } from '@/lib/utils';
import { TIER_COLORS, TIER_BG_COLORS, ELEMENT_COLORS, LAYOUT } from '@/constants/theme'; // Local constants
import { elements } from '@/data/types'; // Use shared types for elements list
import { elementResourcesByName } from '@/data/constants'; // Use shared element resources from constants
import { useLanguage } from '@/contexts/LanguageContext'; // Shared Language context
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { getAssetUrl } from '@/lib/utils'; // For element images

interface TierGridProps {
  allTiers: string[];
  charactersPerTier: { [tier: string]: Character[] };
  tierCustomization: TierCustomization;
  onRemoveFromTiers: (characterId: string) => void;
  hoveredCardId: string | null; // Changed to characterId
}

const TierGrid = ({
  allTiers,
  charactersPerTier,
  tierCustomization,
  onRemoveFromTiers,
  hoveredCardId, // Changed to characterId
}: TierGridProps) => {
  const { t } = useLanguage();

  // Check if any tier has custom names for flexible width
  const hasCustomNames = Object.values(tierCustomization).some(custom => custom?.displayName);

  const TierHeader = () => {
    return (
      <React.Fragment>
        {elements.map((element) => {
          // Calculate count of characters for this element not in 'Pool'
          const count = Object.entries(charactersPerTier)
            .filter(([tier]) => tier !== 'Pool')
            .reduce((sum, [_, chars]) => {
              return sum + chars.filter(c => c.element === element).length;
            }, 0);

          return (
            <div
              key={element}
              className={cn(
                LAYOUT.CENTER_BOX,
                ELEMENT_COLORS[element],
                LAYOUT.GRID_BORDER,
                'rounded-tl-md rounded-tr-md',
              )}
            >
              <img
                src={getAssetUrl(elementResourcesByName[element].imagePath)} // Use getAssetUrl and shared resources
                className='w-6 h-6 mr-2 brightness-110 contrast-125 object-contain'
                alt={t.element(element)}
              />
              <span className={cn(LAYOUT.LABEL_TEXT, 'text-lg')}>
                {t.element(element)} ({count})
              </span>
            </div>
          );
        })}
      </React.Fragment>
    );
  };

  // Component for each droppable cell (tier-element combination)
  const TierElementCell = ({ tier, element, characters }: { tier: string; element: string; characters: Character[] }) => {
    const cellId = `${tier}-${element}`;
    const { setNodeRef } = useDroppable({
      id: cellId,
      data: { tier, element },
    });

    // Filter characters for this element
    const cellCharacters = characters.filter((char) => char.element === element);

    // Create sorted array of IDs for this cell
    const itemIds = cellCharacters.map(char => char.id); // Use char.id

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
        data-element={element}
      >
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          <div className='flex flex-wrap justify-center gap-2'>
            {cellCharacters.map((character) => (
              <TierItem // Use TierItem
                key={character.id} // Use char.id
                character={character}
                id={character.id} // Pass char.id as draggable id
                tier={tier} // Pass tier prop
                onDoubleClick={() => onRemoveFromTiers(character.id)} // Use char.id
              />
            ))}
          </div>
        </SortableContext>
      </div>
    );
  };

  const TierRow = ({ tier, characters }: { tier: string; characters: Character[] }) => {
    const customName = tierCustomization[tier]?.displayName;
    const displayName = customName || t.ui(`tiers.${tier}`) || tier;

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
        {elements.map((element) => (
          <TierElementCell
            key={`${tier}-${element}`}
            tier={tier}
            element={element}
            characters={characters}
          />
        ))}
      </React.Fragment>
    );
  };

  return (
    <div className={cn(
      'grid select-none',
      hasCustomNames ? 'grid-cols-[minmax(4rem,max-content)_repeat(7,1fr)]' : 'grid-cols-[4rem_repeat(7,1fr)]'
    )}>
      <div key={'empty'} />
      <TierHeader />

      {allTiers.map(tier => (
        <TierRow
          key={tier}
          tier={tier}
          characters={charactersPerTier[tier] || []}
        />
      ))}
    </div>
  );
};


export default TierGrid;
