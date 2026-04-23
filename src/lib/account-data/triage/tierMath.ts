/**
 * Probability math for tier-based triage.
 * Ported from docs/triage-tier-table.js.
 */

import type { Slot, SubStat } from "@/data/enums";
import type { QualityTier } from "./types";

// Substat weights (unnormalized shares, same ratios as statPoolWithWeights)

export const SUB_WEIGHTS: Record<SubStat, number> = {
  hp: 6,
  atk: 6,
  def: 6,
  "hp%": 4,
  "atk%": 4,
  "def%": 4,
  em: 4,
  er: 4,
  cr: 3,
  cd: 3,
};

export const P4L = 0.3; // Inflated from true 20% to prevent 4L cheaply jumping tiers

export type TriageMode = "strict" | "loose";

/**
 * Strict mode: existing (historical) thresholds.
 * Loose mode: 2x each threshold as a starting point — keeps roughly twice as
 * many artifacts. Values are hardcoded and can be tuned independently per
 * tier and per slot class.
 */
const TIER_THRESHOLDS = {
  strict: {
    flowerFeather: { premium: 0.01, quality: 0.04, neutral: 0.15 },
    sandsGobletCirclet: { premium: 0.005, quality: 0.02, neutral: 0.1 },
  },
  loose: {
    flowerFeather: { premium: 0.02, quality: 0.08, neutral: 0.25 },
    sandsGobletCirclet: { premium: 0.01, quality: 0.04, neutral: 0.2 },
  },
} as const;

// Combinatorics helpers

export function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map((c) => [first, ...c]),
    ...combinations(rest, k),
  ];
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [[...arr]];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

// Core probability functions

/**
 * P(drawing exactly this ordered set) via weighted sampling without replacement.
 */
export function pDrawSet(
  pool: Record<string, number>,
  stats: string[]
): number {
  const W = Object.values(pool).reduce((a, b) => a + b, 0);
  let p = 0;
  for (const perm of permutations(stats)) {
    let q = 1;
    let rem = W;
    for (const s of perm) {
      q *= pool[s] / rem;
      rem -= pool[s];
    }
    p += q;
  }
  return p;
}

/**
 * P(at least minStrict from strictStats AND at least minFill from fillStats
 *   among m draws from pool, without replacement).
 * Optional requiredStrict: specific stats that MUST be present.
 */
export function pJoint(
  pool: Record<string, number>,
  strictStats: string[],
  fillStats: string[],
  minStrict: number,
  minFill: number,
  m: number,
  requiredStrict: string[] = []
): number {
  const optStrict = strictStats.filter((s) => !requiredStrict.includes(s));
  const others = Object.keys(pool).filter(
    (s) => !strictStats.includes(s) && !fillStats.includes(s)
  );
  const nReq = requiredStrict.length;
  if (nReq > m) return 0;

  const minOpt = Math.max(0, minStrict - nReq);
  let total = 0;
  const maxOpt = Math.min(optStrict.length, m - nReq);
  for (let j = minOpt; j <= maxOpt; j++) {
    const maxF = Math.min(fillStats.length, m - nReq - j);
    for (let f = minFill; f <= maxF; f++) {
      const nOther = m - nReq - j - f;
      if (nOther < 0 || nOther > others.length) continue;
      for (const oc of combinations(optStrict, j)) {
        for (const fc of combinations(fillStats, f)) {
          for (const xc of combinations(others, nOther)) {
            total += pDrawSet(pool, [...requiredStrict, ...oc, ...fc, ...xc]);
          }
        }
      }
    }
  }
  return total;
}

// Tier assignment

function getThresholds(slot: Slot, mode: TriageMode) {
  const set = TIER_THRESHOLDS[mode];
  return slot === "flower" || slot === "plume"
    ? set.flowerFeather
    : set.sandsGobletCirclet;
}

export function getTier(
  rarity: number,
  slot: Slot,
  mode: TriageMode = "strict"
): QualityTier {
  const t = getThresholds(slot, mode);
  if (rarity <= t.premium) return "P";
  if (rarity <= t.quality) return "Q";
  if (rarity <= t.neutral) return "N";
  return "T";
}
