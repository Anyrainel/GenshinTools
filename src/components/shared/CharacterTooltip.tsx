import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { BaseStat } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import type { CharacterLevelTier } from "@/lib/gameStatsLoader";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";

const BASE_STAT_KEYS = ["baseHp", "baseAtk", "baseDef", "em"] as const;
const TOOLTIP_TIERS: CharacterLevelTier[] = ["70", "80", "90", "100"];

interface CharacterTooltipProps {
  characterId: string;
}

export function CharacterTooltip({ characterId }: CharacterTooltipProps) {
  const { t } = useLanguage();
  const { characterStats } = useGameStats();
  const character = charactersById[characterId];

  if (!character) return null;

  const entry = characterStats?.[characterId];
  const meta = getCharacterDisplayMeta(character, entry);
  const name = t.character(character.id);
  const element = meta.element != null ? t.element(meta.element) : "";
  const weapon = meta.weaponType != null ? t.weaponType(meta.weaponType) : "";
  const region = meta.region != null ? t.region(meta.region) : "";

  // Determine ascension stat (any key beyond the base 4)
  const lv90 = entry?.levels?.["90"];
  const ascensionStat = lv90
    ? (Object.keys(lv90).find(
        (k) => !BASE_STAT_KEYS.includes(k as (typeof BASE_STAT_KEYS)[number])
      ) as BaseStat | undefined)
    : undefined;

  const allStatKeys = [
    ...BASE_STAT_KEYS,
    ...(ascensionStat ? [ascensionStat] : []),
  ];

  // Filter out columns where every tier's value is "0" or missing
  const statKeys = entry?.levels
    ? allStatKeys.filter((key) =>
        TOOLTIP_TIERS.some((tier) => {
          const v = entry.levels[tier]?.[key];
          return v != null && v !== "0" && v !== "0%";
        })
      )
    : allStatKeys;

  return (
    <div className="w-80 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header */}
      <div
        className={cn(
          "p-3 border-b border-white/10 flex items-start gap-3 relative overflow-hidden",
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

      {/* Base stats table */}
      {entry?.levels && (
        <div className="p-3 bg-slate-950/95">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-[10px]">
                <th className="text-left py-1 font-medium">Lv</th>
                {statKeys.map((key) => (
                  <th key={key} className="text-right py-1 font-medium px-1">
                    {t.statShort(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOOLTIP_TIERS.map((tier) => {
                const row = entry.levels[tier];
                if (!row) return null;
                return (
                  <tr
                    key={tier}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="py-0.5 text-slate-400">{tier}</td>
                    {statKeys.map((key) => (
                      <td
                        key={key}
                        className="py-0.5 text-right tabular-nums font-medium px-1"
                      >
                        {row[key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
