import { useLanguage } from "@/contexts/LanguageContext";
import type { BaseStat } from "@/data/enums";
import {
  CHARACTER_LEVEL_TIERS,
  type CharacterLevelStats,
  type CharacterLevelTier,
  characterStatsResource,
} from "@/data/gameStatsLoader";

const BASE_STAT_KEYS = ["baseHp", "baseAtk", "baseDef", "em"] as const;

const TIER_LABEL_KEYS = {
  "70": "archive.lv70",
  "80": "archive.lv80",
  "90": "archive.lv90",
  "95": "archive.lv95",
  "100": "archive.lv100",
} as const satisfies Record<CharacterLevelTier, string>;

/** Treat a string stat value like "0", "0%", "0.0" as zero for display purposes. */
function isZeroStat(raw: string | undefined): boolean {
  if (raw == null) return true;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n === 0;
}

export function BaseStatsTable({ characterId }: { characterId: string }) {
  const { t } = useLanguage();
  const characterStats = characterStatsResource.use();
  const ready = characterStats !== null;
  const entry = ready && characterStats ? characterStats[characterId] : null;
  if (!entry) return null;

  // Collect every tier that actually has data for this character. Keeps the
  // canonical order (70, 80, 90, 95, 100) from CHARACTER_LEVEL_TIERS.
  const tierRows: {
    key: CharacterLevelTier;
    label: string;
    stats: CharacterLevelStats;
  }[] = [];
  for (const tier of CHARACTER_LEVEL_TIERS) {
    if (tier === "95") continue; // Skip Lv95 — redundant with Lv90/Lv100.
    const lvStats = entry.levels[tier];
    if (lvStats && Object.keys(lvStats).length > 0) {
      tierRows.push({
        key: tier,
        label: t.ui(TIER_LABEL_KEYS[tier]),
        stats: lvStats,
      });
    }
  }
  if (tierRows.length === 0) return null;

  // Ascension stat: any key that isn't one of the four core base stats.
  const ascensionStat = tierRows
    .flatMap((row) => Object.keys(row.stats))
    .find(
      (k) => !BASE_STAT_KEYS.includes(k as (typeof BASE_STAT_KEYS)[number])
    ) as BaseStat | undefined;

  // Drop "em" from the display when it's zero across every tier — some
  // characters simply don't gain EM from leveling and the column is noise.
  const includeEm = tierRows.some((row) => !isZeroStat(row.stats.em));

  const allKeys: BaseStat[] = [
    "baseHp",
    "baseAtk",
    "baseDef",
    ...(includeEm ? (["em"] as const) : []),
    ...(ascensionStat ? [ascensionStat] : []),
  ];

  const levels = tierRows;

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
                    {lv.stats[key] ?? "—"}
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
                    {lv.stats[key] ?? "—"}
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
