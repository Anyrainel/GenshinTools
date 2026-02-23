/**
 * Shared utilities for merge algorithms (greedy, brute-force, smart).
 *
 * This module consolidates types, clone helpers, set operations,
 * fingerprinting, and the core merge-group function used across all
 * three artifact config merge strategies.
 */

import type {
  CharacterMergeInfo,
  MainStatPlus,
  SetConfig,
  SlotConfig,
  SubStat,
} from "../../data/types";

export type SlotKey = "flowerPlume" | "sands" | "goblet" | "circlet";
export const SLOT_KEYS: SlotKey[] = [
  "flowerPlume",
  "sands",
  "goblet",
  "circlet",
];

export function cloneSlot(slot: SlotConfig): SlotConfig {
  return {
    mainStats: [...slot.mainStats],
    substats: [...slot.substats],
    mustPresent: [...slot.mustPresent],
    minStatCount: slot.minStatCount,
  };
}

export function cloneConfig(config: SetConfig): SetConfig {
  return {
    flowerPlume: cloneSlot(config.flowerPlume),
    sands: cloneSlot(config.sands),
    goblet: cloneSlot(config.goblet),
    circlet: cloneSlot(config.circlet),
    servedCharacters: config.servedCharacters.map((c) => ({ ...c })),
  };
}

// ── Set Operations ──────────────────────────────────────────────────────

/** Ordered union preserving first-occurrence order. */
export function orderedUnion<T>(first: T[], second: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const value of first) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  for (const value of second) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

/** Intersection preserving first-array order, deduplicated. */
export function intersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  const result: T[] = [];
  for (const item of a) {
    if (setB.has(item) && !result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

/** Deduplicate preserving first-occurrence order. */
export function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/** Multiset equality (order-independent). */
export function areArraysEqualIgnoreOrder<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;

  const counted = new Map<T, number>();
  for (const item of a) {
    counted.set(item, (counted.get(item) ?? 0) + 1);
  }

  for (const item of b) {
    const existing = counted.get(item);
    if (!existing) {
      return false;
    }
    if (existing === 1) {
      counted.delete(item);
    } else {
      counted.set(item, existing - 1);
    }
  }

  return counted.size === 0;
}

// ── Slot Comparisons & Fingerprinting ───────────────────────────────────

/** Structural equality: same substats, mustPresent, and minStatCount (ignores mainStats). */
export function areSlotsStructurallyEqual(
  slotA: SlotConfig,
  slotB: SlotConfig
): boolean {
  return (
    slotA.minStatCount === slotB.minStatCount &&
    areArraysEqualIgnoreOrder(slotA.mustPresent, slotB.mustPresent) &&
    areArraysEqualIgnoreOrder(slotA.substats, slotB.substats)
  );
}

/** Stable fingerprint string for a single slot (substats, mustPresent, k). */
export function slotFingerprint(slot: SlotConfig): string {
  const subs = [...slot.substats].sort().join(",");
  const must = [...slot.mustPresent].sort().join(",");
  return `${slot.minStatCount}:${must}:${subs}`;
}

/** Full config fingerprint across all slots (ignores mainStats and servedCharacters). */
export function configFingerprint(config: SetConfig): string {
  return SLOT_KEYS.map((key) => slotFingerprint(config[key])).join("|");
}

/**
 * Group configs by substat fingerprint, merging metadata (main stats +
 * servedCharacters) within each group. Reduces N before expensive operations.
 */
export function coalesceByFingerprint(configs: SetConfig[]): SetConfig[] {
  const groups = new Map<string, SetConfig>();

  for (const config of configs) {
    const key = configFingerprint(config);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, cloneConfig(config));
    } else {
      mergeConfigMetadata(existing, config);
    }
  }

  return [...groups.values()];
}

// ── 2-Partition Enumeration ─────────────────────────────────────────────

/**
 * Enumerate all 2-way splits of `configs` (item 0 always in group A).
 * For each split, merge both groups and call `evaluate(a, b)`.
 * `evaluate` returns a numeric score (lower = better) or null to skip.
 * Returns the best-scoring pair, or null if all partitions were skipped.
 */
export function bestTwoPartition(
  configs: SetConfig[],
  evaluate: (a: SetConfig, b: SetConfig) => number | null
): [SetConfig, SetConfig] | null {
  const n = configs.length;
  let best: [SetConfig, SetConfig] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  const limit = 1 << (n - 1);
  for (let mask = 1; mask < limit; mask++) {
    const aIdx: number[] = [0];
    const bIdx: number[] = [];
    for (let i = 1; i < n; i++) {
      if (mask & (1 << (i - 1))) bIdx.push(i);
      else aIdx.push(i);
    }

    const a = mergeConfigGroup(aIdx.map((i) => configs[i]));
    const b = mergeConfigGroup(bIdx.map((i) => configs[i]));
    const score = evaluate(a, b);
    if (score !== null && score < bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }

  return best;
}

// ── Substat Normalization ───────────────────────────────────────────────

/** Reorder substats so mustPresent items come first (deduplicated), remainder after. */
export function reorderSubstats(
  allSubstats: SubStat[],
  mustPresent: SubStat[]
): SubStat[] {
  const must = dedupe(mustPresent);
  const mustSet = new Set(must);
  const remainder = allSubstats.filter((stat) => !mustSet.has(stat));
  return [...must, ...remainder];
}

// ── Config Merging ──────────────────────────────────────────────────────

/**
 * Merge N configs into one: union main stats, union substats,
 * intersect mustPresent, min of minStatCount (clamped).
 */
export function mergeConfigGroup(configs: SetConfig[]): SetConfig {
  if (configs.length === 0) throw new Error("Cannot merge empty config group");
  if (configs.length === 1) return cloneConfig(configs[0]);

  const merged = cloneConfig(configs[0]);

  for (let i = 1; i < configs.length; i++) {
    const b = configs[i];
    for (const slot of SLOT_KEYS) {
      const ms = merged[slot];
      const bs = b[slot];
      for (const m of bs.mainStats)
        if (!ms.mainStats.includes(m)) ms.mainStats.push(m);
      for (const s of bs.substats)
        if (!ms.substats.includes(s)) ms.substats.push(s);
      ms.mustPresent = ms.mustPresent.filter((s: SubStat) =>
        bs.mustPresent.includes(s)
      );
      // Clamp k to [mustPresent.length, substats.length]
      ms.minStatCount = Math.max(
        Math.min(ms.minStatCount, bs.minStatCount, ms.substats.length),
        ms.mustPresent.length
      );
    }
    const existing = new Set(
      merged.servedCharacters.map((c: CharacterMergeInfo) => c.characterId)
    );
    for (const c of b.servedCharacters) {
      if (!existing.has(c.characterId)) merged.servedCharacters.push({ ...c });
    }
  }
  return merged;
}

/**
 * Merge metadata (main stats + servedCharacters) from source into target.
 * - Main stats: ordered union per slot
 * - servedCharacters: merge by characterId (AND hasPerfectMerge, OR has4pcBuild)
 */
export function mergeConfigMetadata(
  target: SetConfig,
  source: SetConfig
): void {
  for (const key of SLOT_KEYS) {
    target[key].mainStats = orderedUnion(
      target[key].mainStats,
      source[key].mainStats
    );
  }

  const existing = new Map<string, CharacterMergeInfo>();
  for (const info of target.servedCharacters) {
    existing.set(info.characterId, info);
  }

  for (const info of source.servedCharacters) {
    const current = existing.get(info.characterId);
    if (current) {
      current.hasPerfectMerge = current.hasPerfectMerge && info.hasPerfectMerge;
      current.has4pcBuild = current.has4pcBuild || info.has4pcBuild;
    } else {
      target.servedCharacters.push({ ...info });
    }
  }
}
