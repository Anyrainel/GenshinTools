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
import { computeSlotChances } from "./artifactChance";
import { bruteForcePartition } from "./bruteForcePartition";
import {
  SLOT_KEYS,
  bestKPartition,
  bestTwoPartition,
  mergeConfigGroup,
} from "./mergeUtils";

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
const SCALING_PRIORITY: readonly SubStat[] = ["atk%", "def%", "hp%", "em"];

/** Max non-CR+CD config slots (in-game loadout allows 3). */
const CONFIG_BUDGET = 3;

/**
 * Quality tolerance when comparing the archetype-based split against the
 * brute-force partition. If the two are within this much worst-slot pass
 * chance of each other, we prefer the archetype split (its group labels
 * are more meaningful to the user).
 */
const BRUTE_PREFERENCE_THRESHOLD = 0.005;

// ── Quality scoring ─────────────────────────────────────────────────────

function worstSlotPassChance(config: SetConfig): number {
  const chances = computeSlotChances(config);
  return Math.max(...SLOT_KEYS.map((s) => chances[s]));
}

/** Max worst-slot pass chance across all groups (lower = tighter filter). */
function scoreCandidate(groups: SetConfig[]): number {
  let m = 0;
  for (const g of groups) {
    const p = worstSlotPassChance(g);
    if (p > m) m = p;
  }
  return m;
}

/**
 * Pick the better of two partition candidates.
 * Primary: lower worst-slot pass chance (tighter filter) wins.
 * Within BRUTE_PREFERENCE_THRESHOLD, prefer the archetype split when it
 * also has ≤ the count of the brute-force candidate (to keep domain-aware
 * labels); otherwise prefer fewer configs.
 */
function pickBetter(smart: SetConfig[], brute: SetConfig[]): SetConfig[] {
  const smartScore = scoreCandidate(smart);
  const bruteScore = scoreCandidate(brute);

  if (smartScore < bruteScore - BRUTE_PREFERENCE_THRESHOLD) return smart;
  if (bruteScore < smartScore - BRUTE_PREFERENCE_THRESHOLD) return brute;

  // Roughly equal quality — prefer fewer configs, then smart on a tie.
  if (brute.length < smart.length) return brute;
  return smart;
}

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
 * Priority split: partition ER+scaling archetypes into up to `budget` configs.
 *
 * Primary split: by CR presence (CR archetypes share a stat, form natural group).
 * If `budget` exceeds the CR/non-CR split, further isolate highest-priority
 * scaling stats from the larger side.
 * Fallback (all-CR or no-CR): isolate top-(budget-1) by SCALING_PRIORITY, merge
 * the rest into the final slot.
 */
function prioritySplit(
  archetypes: Map<SubStat, SetConfig>,
  budget: number
): SetConfig[] {
  if (archetypes.size <= budget) {
    return [...archetypes.values()];
  }

  const byPriority = (a: SubStat, b: SubStat) =>
    SCALING_PRIORITY.indexOf(a) - SCALING_PRIORITY.indexOf(b);

  const withCr: SubStat[] = [];
  const withoutCr: SubStat[] = [];
  for (const [stat, config] of archetypes) {
    if (config.flowerPlume.substats.includes("cr")) withCr.push(stat);
    else withoutCr.push(stat);
  }
  withCr.sort(byPriority);
  withoutCr.sort(byPriority);

  // CR creates a natural split when both sides are populated.
  if (withCr.length > 0 && withoutCr.length > 0) {
    const result: SetConfig[] = [];
    // Give each side an initial slot.
    let crSlots = 1;
    let ncSlots = 1;
    // Distribute remaining budget to the larger side(s) by priority isolation.
    let remaining = budget - 2;
    while (
      remaining > 0 &&
      (crSlots < withCr.length || ncSlots < withoutCr.length)
    ) {
      // Prefer splitting the side with more archetypes left to merge.
      const crLeft = withCr.length - crSlots;
      const ncLeft = withoutCr.length - ncSlots;
      if (crLeft >= ncLeft && crLeft > 0) crSlots++;
      else if (ncLeft > 0) ncSlots++;
      else break;
      remaining--;
    }
    result.push(...isolateByPriority(withCr, crSlots, archetypes));
    result.push(...isolateByPriority(withoutCr, ncSlots, archetypes));
    return result;
  }

  // All have CR or none: pure priority ordering.
  const sorted = [...archetypes.keys()].sort(byPriority);
  return isolateByPriority(sorted, budget, archetypes);
}

/**
 * Isolate the top-(slots-1) priority archetypes into their own configs and
 * merge the rest into a single tail config. If `stats.length <= slots`, each
 * archetype gets its own config.
 */
function isolateByPriority(
  stats: SubStat[],
  slots: number,
  archetypes: Map<SubStat, SetConfig>
): SetConfig[] {
  if (stats.length === 0 || slots <= 0) return [];
  if (stats.length <= slots) {
    return stats.map((s) => archetypes.get(s)!);
  }
  const isolated = stats.slice(0, slots - 1).map((s) => archetypes.get(s)!);
  const tail = stats.slice(slots - 1).map((s) => archetypes.get(s)!);
  return [...isolated, mergeErGroup(tail)];
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

  // slots ≥ 2: enumerate K-partitions with the shared-stat constraint.
  // Score: minimise the max flower/plume substat pool size across groups
  // (tighter pool = better filter). Reject any partition where a group
  // lost its mustPresent anchor.
  const evaluator = (groups: SetConfig[]): number | null => {
    let maxPool = 0;
    for (const g of groups) {
      if (g.flowerPlume.mustPresent.length === 0) return null;
      if (g.flowerPlume.substats.length > maxPool) {
        maxPool = g.flowerPlume.substats.length;
      }
    }
    return maxPool;
  };

  if (slots === 2) {
    const best = bestTwoPartition(configs, (a, b) => evaluator([a, b]));
    return best ? [...best] : configs;
  }

  const best = bestKPartition(configs, slots, evaluator);
  return best ?? configs;
}

// ── Main algorithm ──────────────────────────────────────────────────────

/**
 * Archetype merge algorithm.
 * Receives non-CR+CD configs only (CR+CD handling is done by the caller).
 * Returns merged configs WITHOUT flat stat restore (caller applies step 5).
 */
export function smartMerge(configs: SetConfig[]): SetConfig[] {
  if (configs.length <= 1) return configs;

  const archetypeResult = smartMergeArchetypeOnly(configs);
  // Always compute the brute-force-optimal candidate and pick whichever
  // gives a tighter filter. Preset inputs are small (n ≤ 7), so this is
  // cheap. The archetype split wins on ties because its groupings carry
  // domain-meaningful labels for the user.
  const bruteResult = bruteForcePartition(configs);
  return pickBetter(archetypeResult, bruteResult);
}

function smartMergeArchetypeOnly(configs: SetConfig[]): SetConfig[] {
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

  // === ER+scaling archetypes exceed (or fill) the budget ===
  // Decide how to split budget between ER slots and "other" slots.
  //
  // Strategy:
  // - If otherConfigs is empty, give all CONFIG_BUDGET slots to ER via
  //   prioritySplit.
  // - Otherwise, reserve at least 1 slot for "other" (collapsed via
  //   partitionRemainder) and give the remainder to ER. If ER fits in
  //   fewer slots than available, hand the leftover budget back to
  //   "other" so distinct non-ER archetypes can each breathe.
  if (mergedEr.size >= CONFIG_BUDGET && otherConfigs.length === 0) {
    return prioritySplit(mergedEr, CONFIG_BUDGET);
  }

  if (mergedEr.size >= 1 && otherConfigs.length >= 1) {
    // Balance: ER gets at most (BUDGET - 1) slots if it needs them;
    // "other" gets the rest (minimum 1).
    const erNeeded = Math.min(mergedEr.size, CONFIG_BUDGET - 1);
    const otherSlots = CONFIG_BUDGET - erNeeded;
    const erConfigs = prioritySplit(mergedEr, erNeeded);
    return [...erConfigs, ...partitionRemainder(otherConfigs, otherSlots)];
  }

  // === Fallback: all "other" (no ER archetypes) but total > budget ===
  return partitionRemainder(otherConfigs, CONFIG_BUDGET);
}
