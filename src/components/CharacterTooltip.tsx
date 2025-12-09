import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { charactersById } from '@/data/constants';
import { cn } from '@/lib/utils';
import { RARITY_COLORS } from '@/constants/theme';

interface CharacterTooltipProps {
  characterId: string;
}

export const CharacterTooltip: React.FC<CharacterTooltipProps> = ({ characterId }) => {
  const { t } = useLanguage();
  const character = charactersById[characterId];

  if (!character) return null;

  const name = t.character(character.id);
  const element = t.element(character.element);
  const weapon = t.weaponType(character.weaponType);
  const region = t.region(character.region);

  return (
    <div className="w-[200px] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header */}
      <div className={cn(
        "p-3 flex items-start gap-3 relative overflow-hidden",
        RARITY_COLORS[character.rarity]
      )}>
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1">
          <h3 className="font-bold text-lg leading-tight text-white mb-1 drop-shadow-md">
            {name}
            <span className="ml-1 text-yellow-400 text-sm">{'★'.repeat(character.rarity)}</span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-white/90 font-medium flex-wrap">
            <span className="bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
              {element}
            </span>
            <span className="bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
              {weapon}
            </span>
            <span className="bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
              {region}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
