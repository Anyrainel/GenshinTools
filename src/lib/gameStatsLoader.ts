/**
 * Lazy-loaded game stats from character_stats.json and weapon_stats.json.
 * Single in-memory copy per file; shared by all consumers.
 */

import type {
  BaseStat,
  CharacterResource,
  Element,
  MainStat,
  Rarity,
  Region,
  WeaponResource,
  WeaponType,
} from "@/data/types";
import { betaEnabled } from "@/lib/betaFlag";
import type { StatEntry } from "@/lib/team-comp/types";

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

// ─── Loader state ───

let characterStatsCache: CharacterStatsMap | null = null;
let characterStatsPromise: Promise<CharacterStatsMap> | null = null;

let weaponStatsCache: WeaponStatsMap | null = null;
let weaponStatsPromise: Promise<WeaponStatsMap> | null = null;

// ─── Async loaders (lazy, single load, shared reference) ───

export function getCharacterStats(): Promise<CharacterStatsMap> {
  if (characterStatsCache) return Promise.resolve(characterStatsCache);
  if (!characterStatsPromise) {
    const loaders: Promise<CharacterStatsMap>[] = [
      import("@/data/game/character_stats.json").then(
        (m) => m.default as CharacterStatsMap
      ),
    ];
    if (betaEnabled()) {
      loaders.push(
        import("@/data/game/character_beta_stats.json").then(
          (m) => m.default as CharacterStatsMap
        )
      );
    }
    characterStatsPromise = Promise.all(loaders).then(([base, beta]) => {
      // Released stats win over beta stats when the same id exists in both.
      characterStatsCache = beta ? { ...beta, ...base } : base;
      return characterStatsCache;
    });
  }
  return characterStatsPromise;
}

export function getWeaponStats(): Promise<WeaponStatsMap> {
  if (weaponStatsCache) return Promise.resolve(weaponStatsCache);
  if (!weaponStatsPromise) {
    const loaders: Promise<WeaponStatsMap>[] = [
      import("@/data/game/weapon_stats.json").then(
        (m) => m.default as WeaponStatsMap
      ),
    ];
    if (betaEnabled()) {
      loaders.push(
        import("@/data/game/weapon_beta_stats.json").then(
          (m) => m.default as WeaponStatsMap
        )
      );
    }
    weaponStatsPromise = Promise.all(loaders).then(([base, beta]) => {
      // Released stats win over beta stats when the same id exists in both.
      weaponStatsCache = beta ? { ...beta, ...base } : base;
      return weaponStatsCache;
    });
  }
  return weaponStatsPromise;
}

/** Load both; resolves when both are in cache. Use to preload before using sync getters. */
export function preloadGameStats(): Promise<void> {
  return Promise.all([getCharacterStats(), getWeaponStats()]).then(() => {});
}

// ─── Sync getters (return cache; null if not yet loaded) ───

export function getCharacterStatsSync(): CharacterStatsMap | null {
  return characterStatsCache;
}

export function getWeaponStatsSync(): WeaponStatsMap | null {
  return weaponStatsCache;
}

// ─── Helpers ───

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
 * Fallback metadata for unreleased characters not yet in character_stats.json.
 * Provides element/weaponType/region so they can appear in tier lists and filters.
 * Remove entries once the character's stats are added to the game data.
 */
const UNRELEASED_OVERRIDES: Record<
  string,
  Partial<Pick<CharacterStats, "element" | "weaponType" | "region">>
> = {
  linnea: { element: "Geo" },
};

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

/** Parse weapon secondary stat value string */
function parseWeaponSecondary(stat: MainStat, rawValue: string): number {
  if (rawValue.endsWith("%")) {
    return Number.parseFloat(rawValue.slice(0, -1)) / 100;
  }
  // Flat stats like EM — the stat type tells us it's flat (no %)
  return Number.parseFloat(rawValue);
}

/**
 * Build StatEntry[] from character_stats.json for a given character.
 * Level is mapped to tier (70/80/90/95/100). Includes stat baselines (5% CR, 50% CD, 100% ER).
 * Requires game stats to be preloaded (e.g. via preloadGameStats() or useGameStats).
 */
export function resolveCharacterStats(
  charId: string,
  charLevel: number
): StatEntry[] {
  const statsData = getCharacterStatsSync();
  if (!statsData)
    throw new Error(
      "Character stats not loaded; call preloadGameStats() or use useGameStats() first."
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

/** Build StatEntry[] from weapon_stats.json for a given weapon (L90). Requires game stats preloaded. */
export function resolveWeaponStats(weaponId: string): StatEntry[] {
  const statsData = getWeaponStatsSync();
  if (!statsData)
    throw new Error(
      "Weapon stats not loaded; call preloadGameStats() or use useGameStats() first."
    );
  const entry = statsData[weaponId];
  if (!entry) throw new Error(`No weapon stats for: ${weaponId}`);
  const level90 = getWeaponStatsAt90(statsData, weaponId);
  if (!level90) throw new Error(`No L90 weapon stats for: ${weaponId}`);

  const entries: StatEntry[] = [{ key: "baseAtk", value: level90.baseAtk }];
  if (entry.secondaryStat && level90.secondaryStatValue) {
    entries.push({
      key: entry.secondaryStat,
      value: parseWeaponSecondary(
        entry.secondaryStat,
        level90.secondaryStatValue
      ),
    });
  }
  return entries;
}

// ─── Talent Param Accessor ───

/** Get raw talent param value for a character. Requires game stats preloaded. */
export function getTalentParam(
  charId: string,
  skill: "A" | "E" | "Q",
  levelIndex: number,
  paramIndex: number
): number {
  const statsData = getCharacterStatsSync();
  if (!statsData)
    throw new Error(
      "Character stats not loaded; call preloadGameStats() first."
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
