import {
  getCharacterStatsSync,
  getWeaponStatsSync,
  preloadGameStats,
} from "@/lib/gameStatsLoader";
import { useEffect, useState } from "react";

export interface GameStatsState {
  /** Character stats from character_stats.json; null until loaded. */
  characterStats: ReturnType<typeof getCharacterStatsSync>;
  /** Weapon stats from weapon_stats.json; null until loaded. */
  weaponStats: ReturnType<typeof getWeaponStatsSync>;
  /** True once both JSON files have been loaded and cached. */
  ready: boolean;
}

/**
 * Lazy-loads character_stats.json and weapon_stats.json on first use.
 * Returns the same cached reference for all callers. Use when rendering
 * team-comp or archive content that needs base stats.
 */
export function useGameStats(): GameStatsState {
  // Start ready if data is already cached (e.g. navigating back to this page)
  const [ready, setReady] = useState(
    () => getCharacterStatsSync() != null && getWeaponStatsSync() != null
  );

  useEffect(() => {
    let cancelled = false;
    preloadGameStats().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    characterStats: ready ? getCharacterStatsSync() : null,
    weaponStats: ready ? getWeaponStatsSync() : null,
    ready,
  };
}
