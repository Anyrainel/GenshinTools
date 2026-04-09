/**
 * Brute-force K-partition merge algorithm with pruning.
 *
 * Enumerates all ways to split N configs into up to MAX_GROUPS groups and
 * picks the partition whose max per-slot pass chance is minimised, with a
 * hierarchical tie-breaker that prefers fewer configs.
 *
 * Pruning strategies:
 * 1. Evaluate merge-all (1-config) first to establish an initial upper bound.
 * 2. K-ary canonical labelling (item 0 fixed in group 0, new group labels only
 *    after max-seen+1) eliminates group-permutation symmetries.
 * 3. Early exit as soon as any partial group exceeds the best bound so far.
 * 4. Prefer fewer groups: only accept a K-group split over a (K-1)-group split
 *    if the max pass chance improves by at least SPLIT_THRESHOLD.
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
 * Only prefer K+1 configs over K configs if the max pass chance is
 * reduced by at least this absolute amount. Prevents trivial splits.
 */
const SPLIT_THRESHOLD = 0.01;

/** Max non-CR+CD config slots supported by the in-game artifact loadout. */
const MAX_GROUPS = 3;

/** Yield to the event loop every this many partition evaluations. */
const YIELD_INTERVAL = 64;

function worstSlotPassChance(config: SetConfig): number {
  const chances = computeSlotChances(config);
  return Math.max(...SLOT_KEYS.map((s) => chances[s]));
}

interface Best {
  /** Best result per exact group count, indexed by groups-1. */
  perCount: Array<{ result: SetConfig[]; maxPass: number } | null>;
}

/**
 * Enumerate K-partitions of `configs` (canonical labelling: item 0 has
 * label 0; item i's label ∈ [0, min(maxSeen+1, maxGroups-1)]). For each
 * completed partition, merge groups and update the best-per-count tracker.
 *
 * If `onIter` is provided, it is called once per leaf; it may throw to abort.
 */
function enumerate(
  configs: SetConfig[],
  maxGroups: number,
  best: Best,
  onIter?: () => void
): void {
  const n = configs.length;
  const labels = new Array<number>(n).fill(0);
  // Canonical labelling: pin item 0 to group 0.
  labels[0] = 0;

  const recurse = (i: number, maxSeen: number): void => {
    if (i === n) {
      onIter?.();
      const groupCount = maxSeen + 1;
      if (groupCount > maxGroups) return;

      // Materialize groups and evaluate worst-slot pass chance.
      // Early-exit: as we merge groups one at a time we can stop if any single
      // group's worst pass already exceeds the best-known for this count.
      const existing = best.perCount[groupCount - 1];
      const bound = existing ? existing.maxPass : Number.POSITIVE_INFINITY;

      const groupIdx: number[][] = Array.from({ length: groupCount }, () => []);
      for (let j = 0; j < n; j++) groupIdx[labels[j]].push(j);

      const merged: SetConfig[] = [];
      let maxPass = 0;
      let aborted = false;
      for (let g = 0; g < groupCount; g++) {
        const m = mergeConfigGroup(groupIdx[g].map((ii) => configs[ii]));
        const p = worstSlotPassChance(m);
        if (p >= bound) {
          aborted = true;
          break;
        }
        if (p > maxPass) maxPass = p;
        merged.push(m);
      }
      if (aborted) return;

      best.perCount[groupCount - 1] = { result: merged, maxPass };
      return;
    }
    const hi = Math.min(maxSeen + 1, maxGroups - 1);
    for (let g = 0; g <= hi; g++) {
      labels[i] = g;
      recurse(i + 1, Math.max(maxSeen, g));
    }
  };

  recurse(1, 0);
}

/**
 * Collapse the best-per-count tracker into a final result using the
 * hierarchical SPLIT_THRESHOLD preference: fewer configs win unless the
 * next level improves max pass chance by at least SPLIT_THRESHOLD.
 */
function chooseBest(best: Best): SetConfig[] {
  let chosen = best.perCount[0]!;
  for (let k = 1; k < best.perCount.length; k++) {
    const next = best.perCount[k];
    if (!next) continue;
    if (next.maxPass < chosen.maxPass - SPLIT_THRESHOLD) {
      chosen = next;
    }
  }
  return chosen.result;
}

/**
 * Synchronous brute-force partition.
 * Used by the sync `computeArtifactFilters` wrapper (tests, export, etc.).
 */
export function bruteForcePartition(rawConfigs: SetConfig[]): SetConfig[] {
  if (rawConfigs.length <= 1) return rawConfigs;

  const configs = coalesceByFingerprint(rawConfigs);
  if (configs.length <= 1) return configs;

  const maxGroups = Math.min(MAX_GROUPS, configs.length);
  const best: Best = { perCount: new Array(maxGroups).fill(null) };

  // Seed count=1 with mergeAll (always valid).
  const mergedAll = mergeConfigGroup(configs);
  best.perCount[0] = {
    result: [mergedAll],
    maxPass: worstSlotPassChance(mergedAll),
  };

  if (maxGroups >= 2) {
    enumerate(configs, maxGroups, best);
  }

  return chooseBest(best);
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

  const maxGroups = Math.min(MAX_GROUPS, configs.length);
  const best: Best = { perCount: new Array(maxGroups).fill(null) };

  const mergedAll = mergeConfigGroup(configs);
  best.perCount[0] = {
    result: [mergedAll],
    maxPass: worstSlotPassChance(mergedAll),
  };

  if (maxGroups >= 2) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    // Enumerate synchronously; check abort every YIELD_INTERVAL leaves.
    // Datasets are small (n ≤ ~8 post-coalesce → ≤ ~3^7 ≈ 2k leaves for K=3),
    // so a single post-enumeration yield suffices for responsiveness.
    let sinceCheck = 0;
    try {
      enumerate(configs, maxGroups, best, () => {
        sinceCheck++;
        if (sinceCheck >= YIELD_INTERVAL) {
          sinceCheck = 0;
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        }
      });
    } catch (e) {
      if ((e as DOMException).name === "AbortError") throw e;
      throw e;
    }

    await new Promise<void>((r) => setTimeout(r, 0));
  }

  return chooseBest(best);
}
