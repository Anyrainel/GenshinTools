import type { StatSheet } from "./damageModels";
import type { BuffSource, BuffTarget, StatEntry, StatKey } from "./types";

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
  ) {}

  /**
   * Stat contributions that depend on resolved stats.
   * Override in subclasses for stat-scaling buffs.
   */
  dynamicBuffs(_selfStats: StatSheet, _teamStats: StatSheet[]): StatEntry[] {
    return [];
  }
}

/**
 * Static buff whose entries vary by constellation level.
 * Handles patterns like "C0: +15% CR; C2: +20% CR" or "C6 adds +15% Pyro DMG".
 */
export class StaticSkillBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    constellation: number,
    resolve: (c: number) => StatEntry[]
  ) {
    super(source, target, resolve(constellation));
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
 * Scaling buff whose coefficient and cap vary by constellation level.
 * Covers patterns like "E conversion: Lv10 = 6.26%, Lv13 = 7.15% of HP as ATK".
 */
export class ScalingSkillBuff extends StatBuff {
  private readonly scale: number;
  readonly cap?: number;

  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    readonly inputKey: StatKey,
    readonly outputKey: StatKey,
    constellation: number,
    resolve: (c: number) => { scale: number; cap?: number }
  ) {
    super(source, target, staticBuffs);
    const resolved = resolve(constellation);
    this.scale = resolved.scale;
    this.cap = resolved.cap;
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const raw = selfStats.get(this.inputKey) * this.scale;
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
 * Scaling buff where one input stat scales into multiple output stat keys.
 * Covers patterns like "DEF × scale → all 7 elemental DMG% keys".
 */
export class ScalingMultiBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    readonly inputKey: StatKey,
    private readonly outputKeys: StatKey[],
    private readonly scale: number,
    readonly cap?: number
  ) {
    super(source, target, staticBuffs);
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const raw = selfStats.get(this.inputKey) * this.scale;
    const value = this.cap !== undefined ? Math.min(raw, this.cap) : raw;
    return this.outputKeys.map((key) => ({ key, value }));
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
