import type { Character } from '@/data/types'; // Use shared Character type
import { getAssetUrl } from '@/lib/utils'; // Shared utility for asset URLs
import { useLanguage } from '@/contexts/LanguageContext'; // Shared Language context
import { useTierStore } from '@/stores/useTierStore'; // TierList store
import { weaponResourcesByName } from '@/data/constants'; // TierList specific weapon images
import { RARITY_COLORS } from '@/constants/theme'; // TierList specific rarity colors

interface TierItemPreviewProps {
  character: Character;
}

/**
 * Presentational component for drag overlay preview.
 * Does NOT use any dnd-kit hooks (useDraggable/useSortable).
 */
export const TierItemPreview = ({ character }: TierItemPreviewProps) => { // Renamed component and removed default export
  const showWeapons = useTierStore((state) => state.showWeapons);
  const { t } = useLanguage(); // Using `t` for translations

  return (
    <div
      className={`w-16 h-16 rounded-md overflow-hidden relative ${RARITY_COLORS[character.rarity]}`}
      style={{
        opacity: 0.8,
        transform: 'scale(1.05)',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        cursor: 'grabbing',
      }}
    >
      <img
        src={getAssetUrl(character.imagePath)} // Use getAssetUrl
        alt={t.character(character.id)} // Use translated name
        title={t.character(character.id)} // Use translated name
        className="w-full h-full object-cover"
        draggable={false}
      />
      {showWeapons && (
        <div className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center">
          <div className="relative bg-black/30 rounded-full backdrop-blur-sm">
            <img
              src={getAssetUrl(weaponResourcesByName[character.weapon].imagePath)}
              alt={t.weaponType(character.weapon)} // Use translated weapon name
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
// Components will import it as `TierItemPreview`.