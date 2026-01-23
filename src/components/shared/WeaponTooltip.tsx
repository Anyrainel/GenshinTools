import { useLanguage } from "@/contexts/LanguageContext";
import { weaponsById } from "@/data/constants";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";

interface WeaponTooltipProps {
  weaponId: string;
}

export function WeaponTooltip({ weaponId }: WeaponTooltipProps) {
  const { t } = useLanguage();
  const weapon = weaponsById[weaponId];

  if (!weapon) return null;

  const name = t.weaponName(weapon.id);
  const effect = t.weaponEffect(weapon.id);

  const statName = t.stat(weapon.secondaryStat);
  const weaponType = t.weaponType(weapon.type);

  return (
    <div className="w-96 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header */}
      <div
        className={cn(
          "p-3 border-b border-white/10 flex items-start gap-3 relative overflow-hidden",
          getRarityColor(weapon.rarity, "bg")
        )}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1">
          <h3 className="font-bold text-lg leading-tight text-white mb-2 drop-shadow-md">
            {name}
            <span className="mx-2 text-yellow-400 text-base align-middle">
              {"★".repeat(weapon.rarity)}
            </span>
          </h3>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white/95 font-medium">
            {/* Weapon Type */}
            <span className="bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/10 flex items-center gap-1">
              <img
                src={getAssetUrl(
                  `/weapontype/${weapon.type.toLowerCase()}.png`
                )}
                alt={weapon.type}
                className="w-4 h-4 object-contain"
              />
              {weaponType}
            </span>

            {/* Base ATK */}
            {weapon.baseAtk && (
              <span className="bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/10 flex items-center gap-1">
                <span className="text-gray-300">{t.stat("atk")}:</span>
                <span className="font-bold text-white">{weapon.baseAtk}</span>
              </span>
            )}

            {/* Secondary Stat */}
            {statName && (
              <span className="bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/10 flex items-center gap-1">
                <span className="text-white/90">{statName}:</span>
                {weapon.secondaryStatValue && (
                  <span className="font-bold text-white ml-0.5">
                    {weapon.secondaryStatValue}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 bg-slate-950/95">
        {effect && (
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {effect}
          </div>
        )}
      </div>
    </div>
  );
}
