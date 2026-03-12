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
    characterStatsPromise = import("@/data/game/character_stats.json").then(
      (m) => {
        characterStatsCache = m.default as CharacterStatsMap;
        return characterStatsCache;
      }
    );
  }
  return characterStatsPromise;
}

export function getWeaponStats(): Promise<WeaponStatsMap> {
  if (weaponStatsCache) return Promise.resolve(weaponStatsCache);
  if (!weaponStatsPromise) {
    weaponStatsPromise = import("@/data/game/weapon_stats.json").then((m) => {
      weaponStatsCache = m.default as WeaponStatsMap;
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
  return {
    element: stats?.element,
    weaponType: stats?.weaponType,
    region: stats?.region,
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
