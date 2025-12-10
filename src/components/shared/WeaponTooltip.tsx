import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { weaponsById } from "@/data/constants";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";

interface WeaponTooltipProps {
  weaponId: string;
}

export const WeaponTooltip: React.FC<WeaponTooltipProps> = ({ weaponId }) => {
  const { t } = useLanguage();
  const weapon = weaponsById[weaponId];

  if (!weapon) return null;

  const name = t.weaponName(weapon.id);
  const effect = t.weaponEffect(weapon.id);

  const statName = t.stat(weapon.secondaryStat);
  const weaponType = t.weaponType(weapon.type);

  return (
    <div className="w-[320px] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header */}
      <div
        className={cn(
          "p-3 border-b border-white/10 flex items-start gap-3 relative overflow-hidden",
          THEME.rarity.bg[weapon.rarity as keyof typeof THEME.rarity.bg],
        )}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1">
          <h3 className="font-bold text-lg leading-tight text-white mb-1 drop-shadow-md">
            {name}
            <span className="mx-3 text-yellow-400">
              {"★".repeat(weapon.rarity)}
            </span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-white/90 font-medium">
            <span className="bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
              {weaponType}
            </span>
            {statName && (
              <span className="bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
                {statName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 bg-slate-900/95">
        {effect && (
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {effect}
          </div>
        )}
      </div>
    </div>
  );
};
