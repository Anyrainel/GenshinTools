import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import { useGameStats } from "@/hooks/useGameStats";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";

interface CharacterTooltipProps {
  characterId: string;
}

export function CharacterTooltip({ characterId }: CharacterTooltipProps) {
  const { t } = useLanguage();
  const { characterStats } = useGameStats();
  const character = charactersById[characterId];

  if (!character) return null;

  const meta = getCharacterDisplayMeta(
    character,
    characterStats?.[characterId]
  );
  const name = t.character(character.id);
  const element = meta.element != null ? t.element(meta.element) : "";
  const weapon = meta.weaponType != null ? t.weaponType(meta.weaponType) : "";
  const region = meta.region != null ? t.region(meta.region) : "";

  return (
    <div className="w-60 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header */}
      <div
        className={cn(
          "p-3 flex items-start gap-3 relative overflow-hidden",
          getRarityColor(meta.rarity, "bg")
        )}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1">
          <h3 className="font-bold text-lg leading-tight text-white mb-2 drop-shadow-md">
            {name}
            <span className="mx-2 text-yellow-400 text-sm">
              {"★".repeat(meta.rarity)}
            </span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-white/90 font-medium flex-wrap">
            {meta.element != null && (
              <span className="bg-black/30 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                <img
                  src={getAssetUrl(
                    `/element/${meta.element.toLowerCase()}.png`
                  )}
                  alt={meta.element}
                  className="w-4 h-4 object-contain"
                />
                {element}
              </span>
            )}
            {meta.weaponType != null && (
              <span className="bg-black/30 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                <img
                  src={getAssetUrl(
                    `/weapontype/${meta.weaponType.toLowerCase()}.png`
                  )}
                  alt={meta.weaponType}
                  className="w-4 h-4 object-contain"
                />
                {weapon}
              </span>
            )}
            {region && (
              <span className="bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                {region}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
