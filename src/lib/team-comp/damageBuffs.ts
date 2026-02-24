import type { StatSheet } from "./damageModels";
import type { BuffSource, BuffTarget, StatEntry, StatKey } from "./types";

/**
 * Throws if any StatKey appears more than once in the given entry list.
 * Call this whenever a list of StatEntries is produced (static or dynamic),
 * since duplicate keys silently overwrite each other in the StatSheet map.
 */
export function assertNoDuplicateStatKeys(
  entries: StatEntry[],
  label: string
): void {
  const seen = new Set<StatKey>();
  for (const { key } of entries) {
    if (seen.has(key)) {
      throw new Error(`Duplicate StatKey "${key}" in ${label}`);
    }
    seen.add(key);
  }
}

// The classes below cover the most common buff patterns in Genshin.
// New reusable buff types should be added here so that all
// character/weapon/artifact implementations can share them.

/**
 * Core buff abstraction. Each buff has static entries (known at build time)
 * and optional dynamic entries (computed from resolved stats).
 */
export class StatBuff {
  constructor(
    readonly source: BuffSource,
    readonly target: BuffTarget,
    readonly staticBuffs: StatEntry[]
  ) {
    if (
      (source.type === "character" || source.type === "weapon") &&
      !source.origin
    ) {
      throw new Error(
        `BuffSource origin must not be empty for type ${source.type} (id: ${source.id})`
      );
    }
    if (
      (source.type === "artifactSet" || source.type === "artifactHalfSet") &&
      source.origin
    ) {
      throw new Error(
        `BuffSource origin must be empty for artifact related types (id: ${source.id})`
      );
    }
    assertNoDuplicateStatKeys(
      staticBuffs,
      `staticBuffs (id: ${source.id}). Use a single entry or separate buffs with different targets`
    );
    for (const { key } of staticBuffs) {
      if (
        (key === "resReduction%" || key === "defReduction%") &&
        target.receiver !== "team"
      ) {
        throw new Error(
          `${key} must use receiver "team" — it is an enemy debuff that affects all party members equally (id: ${source.id})`
        );
      }
      if (key === "defIgnore%" && target.receiver === "team") {
        throw new Error(
          `${key} is not expected to use receiver "team" — ask for review for this case. (id: ${source.id})`
        );
      }
    }
    const filter = target.filter;
    if (filter) {
      for (const dim of ["elements", "abilities", "reactions"] as const) {
        const arr = filter[dim];
        if (arr !== undefined && arr.length === 0) {
          throw new Error(
            `DamageTagFilter.${dim} must not be an empty array — omit the key to mean "any" (id: ${source.id})`
          );
        }
        if (arr) {
          const seen = new Set<string>();
          for (const val of arr) {
            if (seen.has(val)) {
              throw new Error(
                `Duplicate "${val}" in DamageTagFilter.${dim} (id: ${source.id})`
              );
            }
            seen.add(val);
          }
        }
      }
    }
  }

  /**
   * Stat contributions that depend on resolved stats.
   * Override in subclasses for stat-scaling buffs.
   */
  dynamicBuffs(_selfStats: StatSheet, _teamStats: StatSheet[]): StatEntry[] {
    return [];
  }
}

/**
 * Buff that scales a single output stat from a single input stat (self).
 * Covers patterns like "X% of Max HP as ATK" or "EM × 0.04% as Elemental DMG".
 */
export class ScalingBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    readonly inputKey: StatKey,
    readonly outputKey: StatKey,
    private readonly scale: number,
    readonly cap?: number,
    /** Subtract this from input before scaling (e.g. "HP above 30000") */
    private readonly threshold?: number
  ) {
    super(source, target, staticBuffs);
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const input = this.threshold
      ? Math.max(0, selfStats.get(this.inputKey) - this.threshold)
      : selfStats.get(this.inputKey);
    const raw = input * this.scale;
    const value = this.cap !== undefined ? Math.min(raw, this.cap) : raw;
    return [{ key: this.outputKey, value }];
  }
}

/**
 * ER-over-base scaling: scales ATK% from ER exceeding the base 100%.
 * Engulfing Lightning: (ER - 1.0) × scale → atk%, capped.
 */
export class ErScalingBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    private readonly scale: number,
    private readonly cap: number
  ) {
    super(source, target, staticBuffs);
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const erOver = Math.max(0, selfStats.getRaw("er") - 1.0);
    const value = Math.min(erOver * this.scale, this.cap);
    return [{ key: "atk%", value }];
  }
}

/**
 * Filter a list of buffs such that only one buff per noStackId is kept.
 * Ties are broken by the maximum sum of the returned StatEntry values.
 */
export function deduplicateBuffs<T extends { source: BuffSource }>(
  buffs: T[],
  evaluator: (b: T) => StatEntry[]
): T[] {
  const result: T[] = [];
  const groups = new Map<string, T[]>();

  for (const b of buffs) {
    if (!b.source.noStackId) {
      result.push(b);
    } else {
      let g = groups.get(b.source.noStackId);
      if (!g) {
        g = [];
        groups.set(b.source.noStackId, g);
      }
      g.push(b);
    }
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]!);
    } else {
      let bestBuff = group[0]!;
      let maxSum = Number.NEGATIVE_INFINITY;
      for (const b of group) {
        let sum = 0;
        for (const e of evaluator(b)) sum += e.value;
        if (sum > maxSum) {
          maxSum = sum;
          bestBuff = b;
        }
      }
      result.push(bestBuff);
    }
  }

  return result;
}
