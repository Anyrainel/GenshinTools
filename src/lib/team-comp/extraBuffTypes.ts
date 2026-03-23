import type { StatEntry, StatKey } from "./types";

/**
 * An extra buff applied by the user (food, environment, status, or custom).
 * Stored on Team.extraBuffs, consumed by TeamBuild when constructing stat sheets.
 */
export type ExtraBuff = {
  /** Unique instance ID for removal. */
  id: string;
  /** Links to an EnvBuff id for display; undefined for custom buffs. */
  presetId?: string;
  /** 'team' from team-wide, or a charId for per-character. */
  target: "team" | string;
  /** Stat contributions. Uses engine format: flat for hp/atk/def/em, fractional for %. */
  stats: { key: StatKey; value: number }[];
  /** Optional max stacks (for engine integration). */
  maxStacks?: number;
};

/**
 * Resolve ExtraBuff[] into StatEntry[] for a specific character.
 * Filters buffs targeting "team" or the given charId, then sums duplicate keys.
 */
export function resolveExtraBuffEntries(
  extraBuffs: ExtraBuff[],
  charId: string
): StatEntry[] {
  const sums = new Map<StatKey, number>();
  for (const buff of extraBuffs) {
    if (buff.target !== "team" && buff.target !== charId) continue;
    for (const { key, value } of buff.stats) {
      sums.set(key, (sums.get(key) ?? 0) + value);
    }
  }
  const entries: StatEntry[] = [];
  for (const [key, value] of sums) {
    entries.push({ key, value });
  }
  return entries;
}
