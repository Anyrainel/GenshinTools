import { useLanguage } from "@/contexts/LanguageContext";
import type { BaseStat } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";

const BASE_STAT_KEYS = ["baseHp", "baseAtk", "baseDef", "em"] as const;

export function BaseStatsTable({ characterId }: { characterId: string }) {
  const { t } = useLanguage();
  const { characterStats, ready } = useGameStats();
  const entry = ready && characterStats ? characterStats[characterId] : null;
  const stats = entry
    ? { Lv90: entry.levels["90"] ?? {}, Lv100: entry.levels["100"] ?? {} }
    : null;
  if (!stats) return null;

  const ascensionStat = Object.keys(stats.Lv90).find(
    (k) => !BASE_STAT_KEYS.includes(k as (typeof BASE_STAT_KEYS)[number])
  ) as BaseStat | undefined;

  const allKeys = [
    ...BASE_STAT_KEYS,
    ...(ascensionStat ? [ascensionStat] : []),
  ];

  const levels = [
    { key: "Lv90" as const, label: t.ui("archive.lv90") },
    { key: "Lv100" as const, label: t.ui("archive.lv100") },
  ];

  return (
    <>
      {/* Narrow screens: stats as rows, levels as columns (no horizontal scroll) */}
      <div className="md:hidden rounded-lg bg-card/50 border border-border/30 p-3 max-w-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-xs text-muted-foreground">
              <th className="text-left py-1 font-semibold">
                {t.ui("archive.baseStats")}
              </th>
              {levels.map((lv) => (
                <th key={lv.key} className="text-right py-1 font-medium w-16">
                  {lv.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allKeys.map((key) => (
              <tr key={key} className="border-b border-border/10 last:border-0">
                <td className="py-0.5 text-muted-foreground">{t.stat(key)}</td>
                {levels.map((lv) => (
                  <td
                    key={lv.key}
                    className="py-0.5 text-right tabular-nums font-medium w-16"
                  >
                    {stats[lv.key][key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Wide screens: stats as columns, levels as rows (uses horizontal space) */}
      <div className="hidden md:block rounded-lg bg-card/50 border border-border/30 p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-xs text-muted-foreground">
              <th className="text-left py-1 font-semibold whitespace-nowrap">
                {t.ui("archive.baseStats")}
              </th>
              {allKeys.map((key) => (
                <th
                  key={key}
                  className="text-right py-1 font-medium whitespace-nowrap px-2"
                >
                  {t.stat(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((lv) => (
              <tr
                key={lv.key}
                className="border-b border-border/10 last:border-0"
              >
                <td className="py-0.5 text-muted-foreground whitespace-nowrap">
                  {lv.label}
                </td>
                {allKeys.map((key) => (
                  <td
                    key={key}
                    className="py-0.5 text-right tabular-nums font-medium px-2 whitespace-nowrap"
                  >
                    {stats[lv.key][key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
