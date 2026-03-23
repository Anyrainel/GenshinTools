import { StatBuff } from "./damageModels";
import type { BuffSource, BuffTarget, StatEntry, StatKey } from "./types";

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

/**
 * Convert ExtraBuff[] into StatBuff[] for integration with the buff system.
 * Each ExtraBuff becomes one StatBuff with source.type = "extra".
 */
/** Strip category prefix (e.g. "food:gateau_debord" → "gateau_debord") from presetId. */
function stripCategoryPrefix(presetId: string): string {
  const idx = presetId.indexOf(":");
  return idx >= 0 ? presetId.slice(idx + 1) : presetId;
}

export function createExtraStatBuffs(extraBuffs: ExtraBuff[]): StatBuff[] {
  return extraBuffs.map((buff) => {
    const source: BuffSource = {
      type: "extra",
      id: buff.presetId ? stripCategoryPrefix(buff.presetId) : buff.id,
    };
    const target: BuffTarget =
      buff.target === "team"
        ? { receiver: "team" }
        : { receiver: "team", charId: buff.target };
    return new StatBuff(source, target, buff.stats);
  });
}
