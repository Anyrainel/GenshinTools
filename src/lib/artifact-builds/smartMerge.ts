/**
 * Archetype Merge — domain-aware merge algorithm for artifact configs.
 *
 * Unlike the generic brute-force partition, this algorithm understands
 * common Genshin build archetypes (ER+scaling, CR+CD DPS, etc.) and
 * makes deterministic grouping decisions.
 *
 * Pipeline (receives non-CR+CD configs only):
 * 1. Classify configs into ER+scaling archetypes vs "other".
 * 2. If total archetypes ≤ 2: output directly.
 * 3. If ≥3 ER+scaling archetypes:
 *    a. All ER+scaling: priority split (CR grouping, then SCALING_PRIORITY).
 *    b. Mixed: merge ER group into 1 config, remaining slot for others.
 * 4. Partition remaining "other" configs into leftover slots.
 *    Constraint: merged groups must share ≥1 substat (non-empty mustPresent).
 *    If no valid partition exists, output separately (3+ configs).
 *
 * Flat stat restore (step 5) is applied by the caller.
 */

import type { SetConfig, SubStat } from "../../data/types";
import { SLOT_KEYS, bestTwoPartition, mergeConfigGroup } from "./mergeUtils";

// ── Constants ───────────────────────────────────────────────────────────

/** Stats stripped during archetype classification (not meaningful for grouping). */
const NOISE_STATS: ReadonlySet<SubStat> = new Set([
  "cr",
  "cd",
  "atk",
  "hp",
  "def",
]);

/** Scaling stats that pair with ER to form an archetype. */
const SCALING_STATS: ReadonlySet<SubStat> = new Set([
  "atk%",
  "hp%",
  "def%",
  "em",
]);

/**
 * Priority ordering for which scaling stat gets the tight config slot.
 * ATK% first (ATK buffs are most common), DEF% (rare scaling supports),
 * HP%, EM last.
 */
export const SCALING_PRIORITY: readonly SubStat[] = [
  "atk%",
  "def%",
  "hp%",
  "em",
];

/** Max non-CR+CD config slots. */
const CONFIG_BUDGET = 2;

// ── Classification ──────────────────────────────────────────────────────

/**
 * Identify if a config is an ER+scaling archetype.
 * Strips noise stats (CR, CD, flats) from flower/plume substats,
 * checks if remaining is exactly {ER, X} where X is a scaling stat.
 * Returns the scaling stat X, or null.
 */
function classifyErArchetype(config: SetConfig): SubStat | null {
  const stripped = config.flowerPlume.substats.filter(
    (s) => !NOISE_STATS.has(s)
  );
  if (stripped.length !== 2 || !stripped.includes("er")) return null;
  const scaling = stripped.find((s) => s !== "er");
  if (!scaling || !SCALING_STATS.has(scaling)) return null;
  return scaling;
}

// ── ER group merging ────────────────────────────────────────────────────

/**
 * Merge ER+scaling configs, then promote ER back to mustPresent.
 *
 * mergeConfigGroup intersects mustPresent across configs, which can drop
 * ER when one config has ER in its substat pool but below the must-present
 * weight threshold. Since archetype classification guarantees all configs
 * share ER in their substat pools, we restore it as a structural invariant.
 */
function mergeErGroup(configs: SetConfig[]): SetConfig {
  if (configs.length === 1) return configs[0];
  const merged = mergeConfigGroup(configs);
  for (const slot of SLOT_KEYS) {
    const s = merged[slot];
    if (s.substats.includes("er") && !s.mustPresent.includes("er")) {
      s.mustPresent.push("er");
      // Ensure k >= mustPresent count after promotion
      s.minStatCount = Math.max(s.minStatCount, s.mustPresent.length);
    }
  }
  return merged;
}

/**
 * Priority split: partition ER+scaling archetypes into 2 configs.
 *
 * Primary split: by CR presence (CR archetypes share a stat, form natural group).
 * Fallback: isolate highest-priority scaling stat, merge the rest.
 */
function prioritySplit(
  archetypes: Map<SubStat, SetConfig>
): [SetConfig, SetConfig] {
  const withCr: SubStat[] = [];
  const withoutCr: SubStat[] = [];
  for (const [stat, config] of archetypes) {
    if (config.flowerPlume.substats.includes("cr")) {
      withCr.push(stat);
    } else {
      withoutCr.push(stat);
    }
  }

  // CR creates a natural 2-way split
  if (withCr.length > 0 && withoutCr.length > 0) {
    return [
      mergeErGroup(withCr.map((s) => archetypes.get(s)!)),
      mergeErGroup(withoutCr.map((s) => archetypes.get(s)!)),
    ];
  }

  // All have CR or none: isolate by priority ordering
  const sorted = [...archetypes.keys()].sort(
    (a, b) => SCALING_PRIORITY.indexOf(a) - SCALING_PRIORITY.indexOf(b)
  );
  const tightConfig = archetypes.get(sorted[0])!;
  const restConfigs = sorted.slice(1).map((s) => archetypes.get(s)!);
  return [tightConfig, mergeErGroup(restConfigs)];
}

// ── "Other" partition ───────────────────────────────────────────────────

/**
 * Partition "other" (non-ER+scaling) configs into the given number of slots.
 * Constraint: merged groups must have non-empty mustPresent on flower/plume.
 * Falls back to outputting each config separately if constraint can't be met.
 */
function partitionRemainder(configs: SetConfig[], slots: number): SetConfig[] {
  if (configs.length <= slots) return configs;

  if (slots === 1) {
    const merged = mergeConfigGroup(configs);
    if (merged.flowerPlume.mustPresent.length > 0) return [merged];
    return configs;
  }

  // slots === 2: try all 2-way partitions with shared stat constraint
  const best = bestTwoPartition(configs, (a, b) => {
    if (a.flowerPlume.mustPresent.length === 0) return null;
    if (b.flowerPlume.mustPresent.length === 0) return null;
    return Math.max(
      a.flowerPlume.substats.length,
      b.flowerPlume.substats.length
    );
  });

  return best ? [...best] : configs;
}

// ── Main algorithm ──────────────────────────────────────────────────────

/**
 * Archetype merge algorithm.
 * Receives non-CR+CD configs only (CR+CD handling is done by the caller).
 * Returns merged configs WITHOUT flat stat restore (caller applies step 5).
 */
export function smartMerge(configs: SetConfig[]): SetConfig[] {
  if (configs.length <= 1) return configs;

  // === Classify into ER+scaling archetypes vs other ===
  const erGroups = new Map<SubStat, SetConfig[]>();
  const otherConfigs: SetConfig[] = [];

  for (const config of configs) {
    const scalingStat = classifyErArchetype(config);
    if (scalingStat) {
      const group = erGroups.get(scalingStat);
      if (group) group.push(config);
      else erGroups.set(scalingStat, [config]);
    } else {
      otherConfigs.push(config);
    }
  }

  // Merge within each ER archetype (use mergeErGroup to preserve ER mustPresent)
  const mergedEr = new Map<SubStat, SetConfig>();
  for (const [stat, group] of erGroups) {
    mergedEr.set(stat, mergeErGroup(group));
  }

  const totalArchetypes = mergedEr.size + otherConfigs.length;

  // === Trivial: ≤ CONFIG_BUDGET archetypes → output directly ===
  if (totalArchetypes <= CONFIG_BUDGET) {
    return [...mergedEr.values(), ...otherConfigs];
  }

  // === ER+scaling ≥ 3: special handling ===
  if (mergedEr.size >= 3) {
    if (otherConfigs.length === 0) {
      // All ER+scaling → priority split into 2 configs
      return [...prioritySplit(mergedEr)];
    }
    // Mixed: merge all ER into 1 config, remaining slots for other
    const erConfig = mergeErGroup([...mergedEr.values()]);
    const slotsLeft = CONFIG_BUDGET - 1;
    return [erConfig, ...partitionRemainder(otherConfigs, slotsLeft)];
  }

  // === Fallback: ER archetypes ≤ 2 but total > budget ===
  // Combine ER and other, partition into available slots
  const erConfigs = [...mergedEr.values()];
  const allConfigs = [...erConfigs, ...otherConfigs];
  return partitionRemainder(allConfigs, CONFIG_BUDGET);
}
