import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import { THEME } from "@/lib/styles";
import { cn, getAssetUrl } from "@/lib/utils";

interface CharacterTooltipProps {
  characterId: string;
}

export function CharacterTooltip({ characterId }: CharacterTooltipProps) {
  const { t } = useLanguage();
  const character = charactersById[characterId];

  if (!character) return null;

  const name = t.character(character.id);
  const element = t.element(character.element);
  const weapon = t.weaponType(character.weaponType);
  const region = t.region(character.region);

  return (
    <div className="w-[240px] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header */}
      <div
        className={cn(
          "p-3 flex items-start gap-3 relative overflow-hidden",
          THEME.rarity.bg[character.rarity as keyof typeof THEME.rarity.bg]
        )}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1">
          <h3 className="font-bold text-lg leading-tight text-white mb-2 drop-shadow-md">
            {name}
            <span className="mx-2 text-yellow-400 text-sm">
              {"★".repeat(character.rarity)}
            </span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-white/90 font-medium flex-wrap">
            <span className="bg-black/30 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
              <img
                src={getAssetUrl(
                  `/element/${character.element.toLowerCase()}.png`
                )}
                alt={character.element}
                className="w-4 h-4 object-contain"
              />
              {element}
            </span>
            <span className="bg-black/30 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
              <img
                src={getAssetUrl(
                  `/weapontype/${character.weaponType.toLowerCase()}.png`
                )}
                alt={character.weaponType}
                className="w-4 h-4 object-contain"
              />
              {weapon}
            </span>
            <span className="bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
              {region}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
