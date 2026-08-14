/**
 * Lazy-loaded game stats from character_stats.json and weapon_stats.json.
 * Single in-memory copy per file; shared by all consumers.
 *
 * Both files are dynamically imported (not statically) so they ship as
 * separate JS chunks rather than inflating the entry bundle. App boot
 * preloads them in the background; tooltip / table consumers render
 * skeletons until ``ready``.
 */

import { betaEnabled } from "@/data/betaState";
import { makeResource, withBetaOverlay } from "@/data/gameDataUtil";
import type {
  CharacterResource,
  StatEntry,
  WeaponResource,
} from "@/data/types";
import { fetchGzipJson } from "@/data/utils";
import type {
  BaseStat,
  Element,
  MainStat,
  Rarity,
  Region,
  WeaponType,
} from "./enums";
import type { Resource } from "./types";

// ─── JSON shapes (match character_stats.json / weapon_stats.json) ───

export const CHARACTER_LEVEL_TIERS = ["70", "80", "90", "95", "100"] as const;
export type CharacterLevelTier = (typeof CHARACTER_LEVEL_TIERS)[number];

/** One level row in character_stats.json (baseHp, baseAtk, baseDef, em + optional ascension stat). */
export type CharacterLevelStats = Partial<Record<BaseStat, string>>;

export type CharacterStats = {
  rarity: number;
  element: Element;
  weaponType: WeaponType;
  region: Region;
  releaseDate: string;
  levels: Partial<Record<CharacterLevelTier, CharacterLevelStats>>;
  /** Talent param arrays: [level_index][param_index]. 15 levels (Lv1–Lv15). */
  talent?: Partial<Record<"A" | "E" | "S" | "Q", number[][]>>;
};

export type CharacterStatsMap = Record<string, CharacterStats>;

/** One level row in weapon_stats.json (only "90" in current data). */
export type WeaponLevelStats = {
  baseAtk: number;
  secondaryStatValue: string;
};

export type WeaponStats = {
  rarity: number;
  type: WeaponType;
  secondaryStat: MainStat;
  levels: Record<string, WeaponLevelStats>;
};

export type WeaponStatsMap = Record<string, WeaponStats>;

// ─── Resources (singleton, dedup, beta-merged when enabled) ───

export const characterStatsResource: Resource<CharacterStatsMap> = makeResource(
  withBetaOverlay<CharacterStatsMap>(
    () =>
      import("@/data/game/character_stats.json").then(
        (m) => m.default as CharacterStatsMap
      ),
    () =>
      import("@/data/game/character_beta_stats.json.gz?url").then((m) =>
        fetchGzipJson<CharacterStatsMap>(m.default)
      ),
    betaEnabled
  )
);

export const weaponStatsResource: Resource<WeaponStatsMap> = makeResource(
  withBetaOverlay<WeaponStatsMap>(
    () =>
      import("@/data/game/weapon_stats.json").then(
        (m) => m.default as WeaponStatsMap
      ),
    () =>
      import("@/data/game/weapon_beta_stats.json.gz?url").then((m) =>
        fetchGzipJson<WeaponStatsMap>(m.default)
      ),
    betaEnabled
  )
);

/** Map character level to tier key used in character_stats.json. */
export function getCharacterLevelTier(level: number): CharacterLevelTier {
  if (level <= 70) return "70";
  if (level <= 80) return "80";
  if (level <= 90) return "90";
  if (level <= 95) return "95";
  return "100";
}

/** Get the next level tier above the given level, or null if at max. */
export function getNextLevelTier(level: number): number | null {
  const currentTier = Number(getCharacterLevelTier(level));
  if (currentTier >= 100) return null;
  const tiers = CHARACTER_LEVEL_TIERS.map(Number);
  const idx = tiers.indexOf(currentTier);
  return idx >= 0 && idx < tiers.length - 1 ? tiers[idx + 1] : null;
}

/** Get level stats for a character at the given tier. */
export function getCharacterLevelStats(
  data: CharacterStatsMap,
  charId: string,
  tier: CharacterLevelTier
): CharacterLevelStats | undefined {
  const entry = data[charId];
  return entry?.levels?.[tier];
}

/** Get weapon stats at level 90 (only tier in weapon_stats.json). */
export function getWeaponStatsAt90(
  data: WeaponStatsMap,
  weaponId: string
): WeaponLevelStats | undefined {
  const entry = data[weaponId];
  return entry?.levels?.["90"];
}

// ─── Display meta (merge stats + resource; use stats when present, resource.rarity as fallback) ───

/**
 * Fallback metadata for characters listed in resources.ts whose stats aren't
 * loaded yet — either the offline stats pipeline hasn't caught up with the
 * release, or beta is disabled so beta stats never load. Provides
 * element/weaponType/region so they can appear in tier lists and filters.
 * Add an entry when a character ships ahead of its stats; remove it once the
 * stats land in character_stats.json (real stats always take precedence).
 */
const UNRELEASED_OVERRIDES: Record<
  string,
  Partial<Pick<CharacterStats, "element" | "weaponType" | "region">>
> = {};

export type CharacterDisplayMeta = {
  element: Element | undefined;
  weaponType: WeaponType | undefined;
  region: Region | undefined;
  releaseDate: string | undefined;
  rarity: Rarity;
};

export function getCharacterDisplayMeta(
  character: CharacterResource,
  stats: CharacterStats | undefined
): CharacterDisplayMeta {
  const overrides = UNRELEASED_OVERRIDES[character.id];
  return {
    element: stats?.element ?? overrides?.element,
    weaponType: stats?.weaponType ?? overrides?.weaponType,
    region: stats?.region ?? overrides?.region,
    releaseDate: stats?.releaseDate,
    rarity: (stats?.rarity ?? character.rarity) as Rarity,
  };
}

export type WeaponDisplayMeta = {
  type: WeaponType | undefined;
  secondaryStat: MainStat | undefined;
  rarity: Rarity;
};

export function getWeaponDisplayMeta(
  weapon: WeaponResource,
  stats: WeaponStats | undefined
): WeaponDisplayMeta {
  return {
    type: stats?.type,
    secondaryStat: stats?.secondaryStat,
    rarity: (stats?.rarity ?? weapon.rarity) as Rarity,
  };
}

// ─── Stat Resolution (moved from damageModels.ts for reuse) ───

/** Parse a charStats string value: strip '%' and divide by 100 for percentages */
function parseStatValue(raw: string): number {
  if (raw.endsWith("%")) {
    return Number.parseFloat(raw.slice(0, -1)) / 100;
  }
  return Number.parseFloat(raw);
}

/** Parse weapon secondary stat value string (flat or %). */
function parseWeaponSecondary(rawValue: string): number {
  if (rawValue.endsWith("%")) {
    return Number.parseFloat(rawValue.slice(0, -1)) / 100;
  }
  return Number.parseFloat(rawValue);
}

/**
 * Build StatEntry[] from character_stats.json for a given character.
 * Level is mapped to tier (70/80/90/95/100). Includes stat baselines (5% CR, 50% CD, 100% ER).
 * Requires character stats to be preloaded (call ``characterStatsResource.preload()`` first).
 */
export function resolveCharacterStats(
  charId: string,
  charLevel: number
): StatEntry[] {
  const statsData = characterStatsResource.peek();
  if (!statsData)
    throw new Error(
      "Character stats not loaded; await characterStatsResource.preload() first."
    );
  const tier = getCharacterLevelTier(charLevel);
  const levelStats = getCharacterLevelStats(statsData, charId, tier);
  if (!levelStats)
    throw new Error(`No character stats for: ${charId} at tier ${tier}`);

  const entries: StatEntry[] = [];
  for (const [key, raw] of Object.entries(levelStats)) {
    if (raw === undefined) continue;
    const value = parseStatValue(raw);
    if (value !== 0) {
      entries.push({ key: key as BaseStat, value });
    }
  }
  entries.push({ key: "cr", value: 0.05 });
  entries.push({ key: "cd", value: 0.5 });
  entries.push({ key: "er", value: 1.0 });

  return entries;
}

/** Build StatEntry[] from weapon_stats.json for a given weapon (L90). Requires weapon stats preloaded. */
export function resolveWeaponStats(weaponId: string): StatEntry[] {
  const statsData = weaponStatsResource.peek();
  if (!statsData)
    throw new Error(
      "Weapon stats not loaded; await weaponStatsResource.preload() first."
    );
  const entry = statsData[weaponId];
  if (!entry) throw new Error(`No weapon stats for: ${weaponId}`);
  const level90 = getWeaponStatsAt90(statsData, weaponId);
  if (!level90) throw new Error(`No L90 weapon stats for: ${weaponId}`);

  const entries: StatEntry[] = [{ key: "baseAtk", value: level90.baseAtk }];
  if (entry.secondaryStat && level90.secondaryStatValue) {
    entries.push({
      key: entry.secondaryStat,
      value: parseWeaponSecondary(level90.secondaryStatValue),
    });
  }
  return entries;
}

// ─── Talent Param Accessor ───

/** Get raw talent param value for a character. Requires character stats preloaded. */
export function getTalentParam(
  charId: string,
  skill: "A" | "E" | "Q",
  levelIndex: number,
  paramIndex: number
): number {
  const statsData = characterStatsResource.peek();
  if (!statsData)
    throw new Error(
      "Character stats not loaded; await characterStatsResource.preload() first."
    );
  const entry = statsData[charId];
  if (!entry) throw new Error(`No character stats for: ${charId}`);
  const talentData = entry.talent?.[skill];
  if (!talentData) throw new Error(`No talent data for ${charId}.${skill}`);
  const levelRow = talentData[levelIndex];
  if (!levelRow)
    throw new Error(`No talent level ${levelIndex} for ${charId}.${skill}`);
  return levelRow[paramIndex] ?? 0;
}
