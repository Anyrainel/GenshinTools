import { memo, useMemo, useCallback } from 'react';
import { Character } from '@/data/types';
import { elementResourcesByName, weaponResourcesByName } from '@/data/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Plus, Trash2, Copy } from 'lucide-react';
import { useBuildsStore } from '@/stores/useBuildsStore';
import { getAssetUrl } from '@/lib/utils';
import { RARITY_COLORS, TEXT_RARITY_COLORS } from '@/constants/theme';

interface TitleCardProps {
  character: Character;
}

function TitleCardComponent({ character }: TitleCardProps) {
  const { t } = useLanguage();
  const isHidden = useBuildsStore((state) => !!state.hiddenCharacters[character.id]);
  const toggleHidden = useBuildsStore((state) => state.toggleCharacterHidden);

  // Memoize all computed display values
  const displayName = useMemo(() => t.character(character.id), [t, character.id]);

  const elementImagePath = useMemo(() => {
    return elementResourcesByName[character.element]?.imagePath || '';
  }, [character.element]);

  const weaponImagePath = useMemo(() => {
    return weaponResourcesByName[character.weapon]?.imagePath || '';
  }, [character.weapon]);

  const rarityColor = useMemo(() => {
    return RARITY_COLORS[character.rarity];
  }, [character.rarity]);

  const rarityTextColor = useMemo(() => {
    return TEXT_RARITY_COLORS[character.rarity];
  }, [character.rarity]);

  const elementTextColor = useMemo(() => {
    const colors = {
      'Anemo': 'text-teal-500',
      'Geo': 'text-yellow-500',
      'Electro': 'text-purple-500',
      'Dendro': 'text-green-500',
      'Hydro': 'text-blue-500',
      'Pyro': 'text-red-500',
      'Cryo': 'text-sky-500'
    };
    return colors[character.element as keyof typeof colors] || 'text-muted-foreground';
  }, [character.element]);

  const elementName = useMemo(() => t.element(character.element), [t, character.element]);
  const weaponName = useMemo(() => t.weaponType(character.weapon), [t, character.weapon]);
  const regionName = useMemo(() => t.region(character.region), [t, character.region]);
  const formattedDate = useMemo(() => t.formatDate(character.releaseDate), [t, character.releaseDate]);


  const handleToggle = useCallback(() => {
    toggleHidden(character.id);
  }, [toggleHidden, character.id]);

  return (
    <div className="flex items-center gap-4">
      <div className={`relative w-16 h-16 rounded-lg ${rarityColor} overflow-hidden select-none`}>
        <img
          src={getAssetUrl(character.imagePath)}
          alt={displayName}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h3 className={`text-xl font-bold ${isHidden ? 'text-muted-foreground' : 'text-foreground'}`}>{displayName}</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            aria-label={isHidden ? t.ui('characterCard.showBuilds') : t.ui('characterCard.hideBuilds')}
            title={isHidden ? t.ui('characterCard.showBuilds') : t.ui('characterCard.hideBuilds')}
          >
            {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge variant="outline" className={`${elementTextColor} border-current border-2 font-medium flex items-center gap-1`}>
            <img
              src={getAssetUrl(elementImagePath)}
              alt={character.element}
              loading="lazy"
              className="w-4 h-4"
            />
            {elementName}
          </Badge>
          <Badge variant="outline" className={`${rarityTextColor} border-current border-2 font-semibold`}>
            ★ {character.rarity}
          </Badge>
          <Badge variant="outline" className="text-slate-500 border-slate-500 border-2 font-medium capitalize flex items-center gap-1">
            <img
              src={getAssetUrl(weaponImagePath)}
              alt={character.weapon}
              loading="lazy"
              className="w-4 h-4"
            />
            {weaponName}
          </Badge>
          <Badge variant="outline" className="text-slate-500 border-slate-500 border-2 font-medium capitalize">
            {regionName}
          </Badge>
          <span className="text-sm text-muted-foreground pl-2">
            {formattedDate}
          </span>
        </div>
      </div>
    </div>
  );
}

export const TitleCard = memo(TitleCardComponent, (prev, next) => {
  // Only re-render if character ID changes (character object should be stable)
  return prev.character.id === next.character.id;
});

