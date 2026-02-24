import { useLanguage } from "@/contexts/LanguageContext";
import { weaponsById } from "@/data/constants";
import {
  getWeaponDisplayMeta,
  getWeaponStatsAt90,
} from "@/data/gameStatsLoader";
import { useGameStats } from "@/hooks/useGameStats";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";

interface WeaponTooltipProps {
  weaponId: string;
}

export function WeaponTooltip({ weaponId }: WeaponTooltipProps) {
  const { t } = useLanguage();
  const { weaponStats } = useGameStats();
  const weapon = weaponsById[weaponId];

  if (!weapon) return null;

  const stats = weaponStats?.[weaponId];
  const meta = getWeaponDisplayMeta(weapon, stats);
  const level90 = weaponStats
    ? getWeaponStatsAt90(weaponStats, weaponId)
    : null;

  const name = t.weaponName(weapon.id);
  const effectHtml = t.weaponEffectHtml(weapon.id);
  const statName = meta.secondaryStat != null ? t.stat(meta.secondaryStat) : "";
  const weaponType = meta.type != null ? t.weaponType(meta.type) : "";

  return (
    <div className="w-96 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header */}
      <div
        className={cn(
          "p-3 border-b border-white/10 flex items-start gap-3 relative overflow-hidden",
          getRarityColor(meta.rarity, "bg")
        )}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1">
          <h3 className="font-bold text-lg leading-tight text-white mb-2 drop-shadow-md">
            {name}
            <span className="mx-2 text-yellow-400 text-base align-middle">
              {"★".repeat(meta.rarity)}
            </span>
          </h3>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white/95 font-medium">
            {meta.type != null && (
              <span className="bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/10 flex items-center gap-1">
                <img
                  src={getAssetUrl(
                    `/weapontype/${meta.type.toLowerCase()}.png`
                  )}
                  alt={meta.type}
                  className="w-4 h-4 object-contain"
                />
                {weaponType}
              </span>
            )}

            {level90 != null && (
              <span className="bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/10 flex items-center gap-1">
                <span className="text-gray-300">{t.stat("atk")}:</span>
                <span className="font-bold text-white">{level90.baseAtk}</span>
              </span>
            )}

            {statName && meta.secondaryStat != null && level90 != null && (
              <span className="bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/10 flex items-center gap-1">
                <span className="text-white/90">{statName}:</span>
                <span className="font-bold text-white ml-0.5">
                  {level90.secondaryStatValue}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 bg-slate-950/95">
        {effectHtml && (
          <div
            className="text-sm text-slate-300 leading-relaxed"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Weapon effect HTML from game data pipeline
            dangerouslySetInnerHTML={{ __html: effectHtml }}
          />
        )}
      </div>
    </div>
  );
}
