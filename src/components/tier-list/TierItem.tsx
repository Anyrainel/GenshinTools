import React, { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Character } from '@/data/types'; // Use shared Character type
import { getAssetUrl } from '@/lib/utils'; // Shared utility for asset URLs
import { cn } from '@/lib/utils'; // Shared utility for class names
import { useLanguage } from '@/contexts/LanguageContext'; // Shared Language context
import { useTierStore } from '@/stores/useTierStore'; // TierList store
import { weaponResourcesByName } from '@/data/constants'; // TierList specific weapon images
import { RARITY_COLORS } from '@/constants/theme'; // TierList specific rarity colors

interface TierItemProps {
  character: Character;
  id: string;
  tier: string;
  disabled?: boolean;
  onDoubleClick?: (characterId: string) => void;
}

export const TierItem: React.FC<TierItemProps> = ({
  character,
  id,
  tier,
  disabled,
  onDoubleClick,
}) => {
  const showWeapons = useTierStore((state) => state.showWeapons);
  const { t } = useLanguage();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: id, // Use the passed id for dnd-kit
    data: {
      characterId: character.id, // Pass actual character ID in data
      tier: tier,
      element: character.element,
    },
    disabled: disabled,
    animateLayoutChanges: () => false, // Disable animations completely
  });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : 'none',
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(character.id); // Pass character.id on double click
  }, [onDoubleClick, character.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'w-16 h-16 rounded-md overflow-hidden relative',
        RARITY_COLORS[character.rarity],
        'cursor-grab active:cursor-grabbing',
        'hover:scale-105',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onDoubleClick={handleDoubleClick}
      data-character-id={character.id} // Use character.id for data attribute
      title={t.character(character.id)} // Use native title attribute instead of Tooltip for simplicity
    >
      <img
        src={getAssetUrl(character.imagePath)} // Use getAssetUrl
        alt={t.character(character.id)} // Use translated name
        className="w-full h-full object-cover"
        loading="lazy"
        draggable={false}
      />
      {showWeapons && (
        <div className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center">
          <div className="relative bg-black/30 rounded-full backdrop-blur-sm">
            <img
              src={getAssetUrl(weaponResourcesByName[character.weapon].imagePath)}
              alt={t.weapon(character.weapon)} // Use translated weapon name
              className="w-5 h-5 object-contain filter brightness-125 contrast-150 drop-shadow-lg"
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// No default export as it's renamed.
// The main TierList component will import it as `TierItem`.