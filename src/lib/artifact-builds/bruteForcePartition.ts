/**
 * Brute-force 2-partition merge algorithm with pruning.
 *
 * Enumerates all ways to split N configs into ≤2 groups and picks the
 * partition whose max per-slot pass chance is minimised.
 *
 * Pruning strategies:
 * 1. Evaluate merge-all (1-config) first to establish an initial upper bound.
 * 2. Skip any 2-partition where group A alone exceeds the best bound.
 * 3. Prefer fewer configs: only split if improvement exceeds SPLIT_THRESHOLD.
 *
 * Yields to the event loop every YIELD_INTERVAL iterations so the browser
 * stays responsive even for sets with many configs.
 */

import type { SetConfig } from "../../data/types";
import { computeSlotChances } from "./artifactChance";
import {
  SLOT_KEYS,
  coalesceByFingerprint,
  mergeConfigGroup,
} from "./mergeUtils";

/**
 * Only prefer 2 configs over 1 config if the max pass chance is
 * reduced by at least this absolute amount. Prevents trivial splits.
 */
const SPLIT_THRESHOLD = 0.01;

/** Yield to the event loop every this many partition evaluations. */
const YIELD_INTERVAL = 64;

function worstSlotPassChance(config: SetConfig): number {
  const chances = computeSlotChances(config);
  return Math.max(...SLOT_KEYS.map((s) => chances[s]));
}

/**
 * Synchronous brute-force partition.
 * Used by the sync `computeArtifactFilters` wrapper (tests, export, etc.).
 */
export function bruteForcePartition(rawConfigs: SetConfig[]): SetConfig[] {
  if (rawConfigs.length <= 1) return rawConfigs;

  const configs = coalesceByFingerprint(rawConfigs);
  if (configs.length <= 1) return configs;

  const n = configs.length;
  const mergedAll = mergeConfigGroup(configs);
  const mergedAllPass = worstSlotPassChance(mergedAll);

  const bestSingleResult: SetConfig[] = [mergedAll];
  const bestSingleMax = mergedAllPass;

  let bestSplitResult: SetConfig[] | null = null;
  let bestSplitMax = Number.POSITIVE_INFINITY;

  const limit = 1 << (n - 1);
  for (let mask = 1; mask < limit; mask++) {
    const aIdx: number[] = [0];
    const bIdx: number[] = [];
    for (let i = 1; i < n; i++) {
      if (mask & (1 << (i - 1))) bIdx.push(i);
      else aIdx.push(i);
    }

    const a = mergeConfigGroup(aIdx.map((i) => configs[i]));
    const passA = worstSlotPassChance(a);
    if (passA >= bestSplitMax) continue;

    const b = mergeConfigGroup(bIdx.map((i) => configs[i]));
    const maxP = Math.max(passA, worstSlotPassChance(b));

    if (maxP < bestSplitMax) {
      bestSplitMax = maxP;
      bestSplitResult = [a, b];
    }
  }

  if (bestSplitResult && bestSplitMax < bestSingleMax - SPLIT_THRESHOLD) {
    return bestSplitResult;
  }
  return bestSingleResult;
}

/**
 * Async brute-force partition that yields to the event loop periodically.
 * Supports cancellation via AbortSignal.
 */
export async function bruteForcePartitionAsync(
  rawConfigs: SetConfig[],
  signal: AbortSignal
): Promise<SetConfig[]> {
  if (rawConfigs.length <= 1) return rawConfigs;

  const configs = coalesceByFingerprint(rawConfigs);
  if (configs.length <= 1) return configs;

  const n = configs.length;
  const mergedAll = mergeConfigGroup(configs);
  const mergedAllPass = worstSlotPassChance(mergedAll);

  const bestSingleResult: SetConfig[] = [mergedAll];
  const bestSingleMax = mergedAllPass;

  let bestSplitResult: SetConfig[] | null = null;
  let bestSplitMax = Number.POSITIVE_INFINITY;

  const limit = 1 << (n - 1);
  let iterCount = 0;

  for (let mask = 1; mask < limit; mask++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const aIdx: number[] = [0];
    const bIdx: number[] = [];
    for (let i = 1; i < n; i++) {
      if (mask & (1 << (i - 1))) bIdx.push(i);
      else aIdx.push(i);
    }

    const a = mergeConfigGroup(aIdx.map((i) => configs[i]));
    const passA = worstSlotPassChance(a);
    if (passA >= bestSplitMax) continue;

    const b = mergeConfigGroup(bIdx.map((i) => configs[i]));
    const maxP = Math.max(passA, worstSlotPassChance(b));

    if (maxP < bestSplitMax) {
      bestSplitMax = maxP;
      bestSplitResult = [a, b];
    }

    // Yield to keep the browser responsive
    iterCount++;
    if (iterCount % YIELD_INTERVAL === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (bestSplitResult && bestSplitMax < bestSingleMax - SPLIT_THRESHOLD) {
    return bestSplitResult;
  }
  return bestSingleResult;
}
