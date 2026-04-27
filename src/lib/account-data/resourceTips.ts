/**
 * Resource spending recommendations.
 *
 * Given the results of `evaluateAllBuilds`, generate ranked craft/reroll
 * suggestions for builds whose completeness falls below a tier-aware
 * threshold. Each suggestion describes a concrete action (craft a new
 * piece, or reroll an existing one), an analytic expected score gain,
 * and a Monte-Carlo probability of improvement.
 *
 * v1 uses a single-slot score proxy (no cascading re-optimization). Phase-2
 * cascading via full re-optimization is intentionally deferred — see the
 * design spec for details. The score proxy is consistent with EvaluationView.
 */

import type { MainStat, Slot, SubStat, Tier } from "@/data/enums";
import { allSlots } from "@/data/enums";
import { artifactsById } from "@/data/gameResources";
import type {
  AccountData,
  ArtifactData,
  GlobalStatWeights,
  TierAssignment,
} from "@/data/types";
import {
  calculateStatScore,
  type StatWeightMap,
  scaleFlatWeights,
  scoreMainStat,
} from "../artifact/scoring/artifactScore";
import {
  getSubstatAvgRoll,
  getSubstatMaxRoll,
} from "../artifact/scoring/utils";
import type { BuildEvaluation, EvalBuild, SetGroup } from "./buildEvaluation";

// Public types

export type TierCompletenessThresholds = Record<Tier, number>;

export const DEFAULT_TIER_THRESHOLDS: TierCompletenessThresholds = {
  S: 0.9,
  A: 0.85,
  B: 0.8,
  C: 0.75,
  D: 0.7,
  Pool: 0.7,
};

export type ResourceKind = "craft" | "reroll" | "levelup";

export type ResourceActionBadge =
  | { type: "count"; value: number }
  | { type: "level"; value: number };

/** Per-tier per-kind minimum expected score gain for a suggestion to be shown. */
export type KindTierMinScore = Record<ResourceKind, TierCompletenessThresholds>;

export const DEFAULT_MIN_SCORE_DIFF: KindTierMinScore = {
  craft: { S: 0, A: 5, B: 10, C: 15, D: 20, Pool: 25 },
  reroll: { S: 5, A: 10, B: 15, C: 20, D: 25, Pool: 30 },
  levelup: { S: -5, A: 0, B: 5, C: 10, D: 15, Pool: 20 },
};

/** Whether an artifact set has a 5★ version available. Resources only work on 5★. */
function isFiveStarSet(setId: string): boolean {
  return artifactsById[setId]?.rarity === 5;
}

/** An EvalBuild is eligible if its target set(s) are available at 5★. */
function buildIsFiveStar(evalBuild: EvalBuild): boolean {
  if (evalBuild.composition === "4pc") {
    return isFiveStarSet(evalBuild.artifactSet);
  }
  const ids = [
    ...(evalBuild.halfSet1SetIds ?? []),
    ...(evalBuild.halfSet2SetIds ?? []),
  ];
  if (ids.length === 0) return false;
  return ids.some(isFiveStarSet);
}

export type ResourceSuggestion = {
  kind: "craft" | "reroll" | "levelup";
  actionBadge: ResourceActionBadge;
  characterIds: string[];
  /** Representative tier (best among the build's characters). */
  tier: Tier;
  buildKey: string;
  evalBuild: EvalBuild;
  slot: Slot;
  /** Target artifact set for craft, or existing artifact's set for reroll/levelup. */
  setId: string;
  mainStat: MainStat;
  /** Card stat line emitted by the recommendation algorithm. */
  displayStats: {
    main: MainStat;
    subs: [SubStat, SubStat];
  };
  /** Real locked substats for craft/reroll; level-up keeps this for legacy callers. */
  lockedSubs: [SubStat, SubStat];
  sourceArtifact?: ArtifactData;
  /** Analytic expected slot score after the action, minus current slot score. */
  expectedScoreGain: number;
  /** Current slot score used as the comparison baseline for pUpgrade. */
  baselineScore: number;
  /**
   * Exact P(new slot score > current slot score). `-1` means "not yet
   * computed" — the expensive PMF convolution is scheduled asynchronously
   * and cached via `usePUpgradeCacheStore`.
   */
  pUpgrade: number;
};

/**
 * Stable cache key for the pUpgrade value of a suggestion. Includes
 * everything that affects the output: the build identity (captured by
 * buildKey), slot, main stat, craft/reroll locked subs, baseline score,
 * source artifact, and a hash of the global config.
 */
export function suggestionCacheKey(
  s: ResourceSuggestion,
  globalConfigHash: string
): string {
  const locked = s.kind === "levelup" ? "" : [...s.lockedSubs].sort().join("+");
  const artId = s.sourceArtifact?.id ?? "";
  return `${globalConfigHash}|${s.kind}|${s.buildKey}|${s.slot}|${s.mainStat}|${locked}|${s.baselineScore.toFixed(6)}|${artId}`;
}

/** Short deterministic hash of the global stat weights. */
export function hashGlobalConfig(config: GlobalStatWeights): string {
  return `${config.flatAtk.toFixed(4)},${config.flatHp.toFixed(4)},${config.flatDef.toFixed(4)}`;
}

/**
 * Synchronously compute the exact pUpgrade for a single suggestion.
 * Intended to be called from an async scheduler, one suggestion at a time,
 * yielding to the event loop between calls.
 */
export function computeSuggestionPUpgrade(
  suggestion: ResourceSuggestion,
  globalConfig: GlobalStatWeights
): number {
  const weights = scaleFlatWeights(suggestion.evalBuild.weights, globalConfig);
  if (suggestion.kind === "levelup" && suggestion.sourceArtifact) {
    return pUpgradeForLevelup(
      suggestion.sourceArtifact,
      suggestion.baselineScore,
      weights
    );
  }
  if (suggestion.kind === "reroll" && suggestion.sourceArtifact) {
    if (Object.keys(suggestion.sourceArtifact.substats ?? {}).length === 4) {
      return pUpgradeForReroll(
        suggestion.sourceArtifact,
        suggestion.lockedSubs,
        suggestion.baselineScore,
        weights
      );
    }
  }
  return pUpgradeForCandidate(
    suggestion.lockedSubs,
    suggestion.mainStat,
    suggestion.baselineScore,
    weights
  );
}

// Tier resolution

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D", "Pool"];
const tierRank = (t: Tier) => TIER_ORDER.indexOf(t);

/**
 * Pick the best (lowest-rank) tier among the characters that use this build.
 * Undrafted characters default to the worst tier ("Pool") so builds whose
 * only users are untiered don't spam suggestions.
 */
function bestTierForBuild(
  evalBuild: EvalBuild,
  tierAssignments: TierAssignment
): Tier {
  let best: Tier = "Pool";
  let bestRank = tierRank("Pool");
  for (const charId of evalBuild.characterIds) {
    const assignment = tierAssignments[charId];
    const t: Tier = assignment?.tier ?? "Pool";
    const r = tierRank(t);
    if (r < bestRank) {
      bestRank = r;
      best = t;
    }
  }
  return best;
}

// Candidate enumeration helpers

/** Substats eligible to appear on the artifact (excludes main-only stats). */
const SUBSTAT_POOL: SubStat[] = [
  "cr",
  "cd",
  "em",
  "er",
  "atk%",
  "hp%",
  "def%",
  "atk",
  "hp",
  "def",
];

/** Unnormalized draw weights used by the RNG pool — same ratios as tierMath. */
const DRAW_WEIGHTS: Record<SubStat, number> = {
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

/** Top-K weighted substats the build cares about, for candidate enumeration. */
function topDesirableSubs(evalBuild: EvalBuild, k: number): SubStat[] {
  const entries: { stat: SubStat; weight: number }[] = [];
  for (const stat of SUBSTAT_POOL) {
    const w = evalBuild.weights[stat] ?? 0;
    if (w > 0) entries.push({ stat, weight: w });
  }
  entries.sort((a, b) => b.weight - a.weight || a.stat.localeCompare(b.stat));
  return entries.slice(0, k).map((e) => e.stat);
}

/** Pair combinations of an array (unordered). */
function pairs<T>(arr: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) out.push([arr[i], arr[j]]);
  }
  return out;
}

/**
 * 5★ upgrade-roll model (matches real Genshin mechanics for this calculator):
 * - 4 substats on the final artifact (2 locked + 2 randomized)
 * - Each substat gets 1 guaranteed initial roll (4 initial rolls total)
 * - Additional upgrade rolls: 4 with 75% probability, 5 with 25% probability,
 *   each uniformly distributed among the 4 substats
 * - Each roll's value is uniform over tiers {0.7, 0.8, 0.9, 1.0} × max
 *
 * Expected rolls per sub (symmetric): 1 + (0.75*4 + 0.25*5)/4 = 2.0625
 * Expected total rolls: 8.25 — matches real 5★ artifact roll budget (8 or 9).
 */
const TOTAL_SUB_SLOTS = 4;
const EXPECTED_ROLLS_PER_SUB = 1 + (0.75 * 4 + 0.25 * 5) / 4; // 2.0625
const ROLL_VALUE_TIERS = [0.7, 0.8, 0.9, 1.0] as const;

// Analytic expected score for a 5★ artifact with given lockedSubs + mainStat

type DrawPool = { stats: SubStat[]; weights: number[]; totalWeight: number };

function makeDrawPool(mainStat: MainStat, excluded: SubStat[]): DrawPool {
  const stats: SubStat[] = [];
  const weights: number[] = [];
  let totalWeight = 0;
  const mainKey: string = mainStat;
  for (const s of SUBSTAT_POOL) {
    if (s === mainKey) continue;
    if (excluded.includes(s)) continue;
    const w = DRAW_WEIGHTS[s];
    stats.push(s);
    weights.push(w);
    totalWeight += w;
  }
  return { stats, weights, totalWeight };
}

/** Score a single substat at its average 5★ roll value, weighted by build. */
function avgRollScore(
  stat: SubStat,
  weights: StatWeightMap,
  rollCount: number
): number {
  const value = getSubstatAvgRoll(stat, 5) * rollCount;
  return calculateStatScore(stat, value, weights).score;
}

/**
 * Analytic expected slot sub-score for a crafted/rerolled 5★ artifact.
 *
 * Two substats are locked; the remaining (4 - |locked|) are drawn from the
 * weighted pool without replacement. For each resulting 4-sub composition,
 * every sub gets E[rolls] = 2.0625 in expectation (symmetric by uniform
 * upgrade distribution), and each roll's expected value = avgRoll(sub).
 *
 * Since scoring is linear in value:
 *   E[score | comp] = EXPECTED_ROLLS_PER_SUB × Σ_subs avgRollScore(sub)
 */
function expectedCraftScore(
  lockedSubs: SubStat[],
  mainStat: MainStat,
  weights: StatWeightMap,
  rarity = 5
): number {
  const needed = TOTAL_SUB_SLOTS - lockedSubs.length;
  if (needed < 0) return 0;

  const pool = makeDrawPool(mainStat, lockedSubs);
  if (pool.stats.length < needed) return 0;

  const completions = enumerateCompletions(pool, needed);

  let expected = 0;
  for (const c of completions) {
    const subs = [...lockedSubs, ...c.stats];
    let perRollSum = 0;
    for (const s of subs) {
      perRollSum += avgRollScore(s, weights, 1);
    }
    expected += c.prob * EXPECTED_ROLLS_PER_SUB * perRollSum;
  }

  // Main stat contribution (same as calculateMaxSlotSubScore consumers)
  const mainContribution =
    mainStat === "hp" || mainStat === "atk"
      ? 0
      : scoreMainStat(mainStat, rarity);

  return expected + mainContribution;
}

/** Enumerate all length-k ordered completions from a DrawPool with
 * weighted sampling without replacement, returning each with probability. */
function enumerateCompletions(
  pool: DrawPool,
  k: number
): { stats: SubStat[]; prob: number }[] {
  const out: { stats: SubStat[]; prob: number }[] = [];
  const usedIdx = new Set<number>();
  const stack: { idx: number; prob: number }[] = [];

  function recurse(depth: number, probSoFar: number, remainingWeight: number) {
    if (depth === k) {
      out.push({
        stats: stack.map((s) => pool.stats[s.idx]),
        prob: probSoFar,
      });
      return;
    }
    for (let i = 0; i < pool.stats.length; i++) {
      if (usedIdx.has(i)) continue;
      const w = pool.weights[i];
      const p = w / remainingWeight;
      usedIdx.add(i);
      stack.push({ idx: i, prob: p });
      recurse(depth + 1, probSoFar * p, remainingWeight - w);
      stack.pop();
      usedIdx.delete(i);
    }
  }
  recurse(0, 1, pool.totalWeight);
  return out;
}

// Exact P(upgrade) via PMF convolution
//
// Two-step model:
//   (1) SHAPE enumeration: determine which of the 2 randomized substats land
//       on "useful" stats (weight > 0). Each shape has a known probability
//       from weighted-without-replacement draw over the pool.
//   (2) PER-SHAPE distribution: given k useful subs (2 locked + 0-2 useful
//       randoms), each with score coefficient c_i = max-roll-score, compute
//       the exact distribution of the final artifact score and take the tail
//       above the baseline.
//
// Within a shape, score = Σ_i c_i × (sum of r_i tier draws), where
//   r_i = 1 (initial) + u_i (upgrades routed to sub i),
// and (u_1,...,u_k, junk) follows Multinomial(N, 1/4,...,1/4, (4-k)/4) with
// N = 4 (p=0.75) or 5 (p=0.25). Each tier draw is uniform on {0.7,0.8,0.9,1}.
//
// We represent score PMFs with integer keys (score × SCORE_SCALE) and an
// LRU-ish cache of per-sub r-roll PMFs within a single call.

const SCORE_SCALE = 10000;

type PMF = Map<number, number>;

function convolvePmf(a: PMF, b: PMF): PMF {
  const out: PMF = new Map();
  for (const [k1, p1] of a) {
    if (p1 < 1e-12) continue;
    for (const [k2, p2] of b) {
      const p = p1 * p2;
      if (p < 1e-14) continue;
      const k = k1 + k2;
      out.set(k, (out.get(k) ?? 0) + p);
    }
  }
  return out;
}

/** PMF of (sum of r tier draws) × coef. Integer keys = value × SCORE_SCALE. */
function coefRollSumPmf(coef: number, r: number): PMF {
  if (r === 0) return new Map([[0, 1]]);
  const single: PMF = new Map();
  for (const tier of ROLL_VALUE_TIERS) {
    const key = Math.round(coef * tier * SCORE_SCALE);
    single.set(key, (single.get(key) ?? 0) + 0.25);
  }
  let acc = single;
  for (let i = 1; i < r; i++) acc = convolvePmf(acc, single);
  return acc;
}

const FACTORIALS = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

/**
 * Exact P(score > thresholdScore) for an artifact with k useful substats
 * whose per-max-roll score contributions are given by `coefs`. The remaining
 * 4-k substats contribute 0 (junk).
 */
function pUpgradeExact(coefs: number[], thresholdScore: number): number {
  const k = coefs.length;
  const thresholdKey = Math.round(thresholdScore * SCORE_SCALE);

  // If there are no useful subs, score ≡ 0 — tail is 0 unless threshold < 0.
  if (k === 0) return thresholdScore < 0 ? 1 : 0;

  // Per-sub r-roll PMF cache (by sub index and roll count).
  const subPmfCache: PMF[][] = coefs.map(() => []);
  const getSubPmf = (i: number, r: number): PMF => {
    let pmf = subPmfCache[i][r];
    if (!pmf) {
      pmf = coefRollSumPmf(coefs[i], r);
      subPmfCache[i][r] = pmf;
    }
    return pmf;
  };

  const usefulShare = 0.25;
  const junkShare = (4 - k) / 4;
  const tuple: number[] = new Array(k).fill(0);

  let totalP = 0;

  const enumerateTuples = (
    depth: number,
    remaining: number,
    N: number,
    pN: number
  ): void => {
    if (depth === k) {
      const junkUpgrades = remaining;
      const sumUseful = N - junkUpgrades;
      // Multinomial joint marginal over (u_1..u_k, junk-upgrades).
      let jointProb = FACTORIALS[N] / FACTORIALS[junkUpgrades];
      for (const u of tuple) jointProb /= FACTORIALS[u];
      jointProb *= usefulShare ** sumUseful;
      jointProb *= junkShare ** junkUpgrades;
      if (jointProb < 1e-14) return;

      // Convolve the k useful-sub PMFs for this (u_1..u_k) tuple.
      let scorePmf: PMF = new Map([[0, 1]]);
      for (let i = 0; i < k; i++) {
        scorePmf = convolvePmf(scorePmf, getSubPmf(i, 1 + tuple[i]));
      }
      let tailP = 0;
      for (const [key, p] of scorePmf) {
        if (key > thresholdKey) tailP += p;
      }
      totalP += pN * jointProb * tailP;
      return;
    }
    for (let u = 0; u <= remaining; u++) {
      tuple[depth] = u;
      enumerateTuples(depth + 1, remaining - u, N, pN);
    }
  };

  enumerateTuples(0, 4, 4, 0.75);
  enumerateTuples(0, 5, 5, 0.25);
  return totalP;
}

/**
 * Aggregate exact P(upgrade) over all shapes for a craft/reroll candidate.
 *
 * Enumerates ordered 2-sub draws from the pool, groups by the canonical set
 * of useful-sub coefficients (the "shape"), and sums `P(shape) × pUpgradeExact`
 * over shapes.
 */
function pUpgradeForCandidate(
  lockedSubs: SubStat[],
  mainStat: MainStat,
  baselineScore: number,
  weights: StatWeightMap
): number {
  const pool = makeDrawPool(mainStat, lockedSubs);
  if (pool.stats.length < 2) return 0;

  const mainContribution =
    mainStat === "hp" || mainStat === "atk" ? 0 : scoreMainStat(mainStat, 5);
  const threshold = baselineScore - mainContribution;

  // Per-sub max-roll score (coef in the convolution above). 0 = junk.
  const coefCache: Partial<Record<SubStat, number>> = {};
  const coefOf = (s: SubStat): number => {
    const cached = coefCache[s];
    if (cached !== undefined) return cached;
    const v = calculateStatScore(s, getSubstatMaxRoll(s, 5), weights).score;
    coefCache[s] = v;
    return v;
  };

  const cL = lockedSubs.map(coefOf);

  // Shape = canonical (sorted) array of useful coefs. Grouped across pairs.
  const shapes = new Map<string, { coefs: number[]; prob: number }>();

  for (let i = 0; i < pool.stats.length; i++) {
    const ci = coefOf(pool.stats[i]);
    const wi = pool.weights[i];
    const pFirst = wi / pool.totalWeight;
    const remaining1 = pool.totalWeight - wi;
    for (let j = 0; j < pool.stats.length; j++) {
      if (i === j) continue;
      const cj = coefOf(pool.stats[j]);
      const wj = pool.weights[j];
      const pairProb = pFirst * (wj / remaining1);

      const shapeCoefs = [...cL];
      if (ci > 0) shapeCoefs.push(ci);
      if (cj > 0) shapeCoefs.push(cj);
      shapeCoefs.sort((a, b) => a - b);
      const key = shapeCoefs.map((c) => c.toFixed(6)).join("|");

      const existing = shapes.get(key);
      if (existing) existing.prob += pairProb;
      else shapes.set(key, { coefs: shapeCoefs, prob: pairProb });
    }
  }

  let totalP = 0;
  for (const { coefs, prob } of shapes.values()) {
    if (prob < 1e-14) continue;
    totalP += prob * pUpgradeExact(coefs, threshold);
  }
  return totalP;
}

// Reroll expected score and P(upgrade)
//
// Reroll mechanic: keep all 4 existing substats with their initial values,
// select 2 substats ("locked"). 2 guaranteed upgrades are distributed among
// the 2 locked subs (each roll independently 1/2 chance per locked sub,
// giving splits (2,0)=25%, (1,1)=50%, (0,2)=25%). Remaining upgrades
// distributed uniformly among all 4 subs (1/4 each).
// Total upgrade count is deterministic from `art.totalRolls`:
//   totalRolls=8 (3-starter) → 4 upgrades, totalRolls=9 (4-starter) → 5.
//
// N=4: 2 guaranteed among locked, 2 random among all 4
// N=5: 2 guaranteed among locked, 3 random among all 4

/** Check if an initial value is plausible (within a single roll range). */
function isValidInitialValue(
  stat: SubStat,
  value: number,
  rarity: number
): boolean {
  const maxRoll = getSubstatMaxRoll(stat, rarity as 4 | 5);
  const minRoll = maxRoll * 0.7;
  // Allow small tolerance for floating point
  return value >= minRoll * 0.95 && value <= maxRoll * 1.05;
}

/**
 * Analytic expected slot score for a rerolled 5★ artifact.
 *
 * For each sub: if `initialValues` is known and valid, use the exact value.
 * Otherwise, use the average initial roll value (E[random initial]).
 * Upgrade rolls are distributed per the reroll guarantee mechanic.
 */
function expectedRerollScore(
  art: ArtifactData,
  lockedSubs: [SubStat, SubStat],
  weights: StatWeightMap
): number {
  const allSubs = Object.keys(art.substats ?? {}) as SubStat[];
  const upgradeCount = (art.totalRolls ?? 8) - 4;
  const randomUpgrades = Math.max(0, upgradeCount - 2); // beyond 1+1 guaranteed

  let score = 0;
  for (const s of allSubs) {
    // Initial roll: fixed if known and valid, avg if unknown/corrupted
    const rawInit = art.initialValues?.[s];
    const validInit =
      rawInit != null && isValidInitialValue(s, rawInit, art.rarity)
        ? rawInit
        : null;
    if (validInit != null) {
      score += calculateStatScore(s, validInit, weights).score;
    } else {
      score += avgRollScore(s, weights, 1);
    }
    // Upgrade rolls: E[guaranteed] = 1 per locked sub + share of random upgrades
    const isLocked = lockedSubs.includes(s);
    const expectedUpgrades = (isLocked ? 1 : 0) + randomUpgrades / 4;
    score += avgRollScore(s, weights, expectedUpgrades);
  }

  const mainContribution =
    art.mainStatKey === "hp" || art.mainStatKey === "atk"
      ? 0
      : scoreMainStat(art.mainStatKey, art.rarity);

  return score + mainContribution;
}

/**
 * Exact P(upgrade) for a rerolled artifact via multinomial enumeration.
 *
 * Two-phase upgrade model:
 *   Phase 1 (guaranteed): 2 upgrades distributed among the 2 locked subs.
 *     Each roll goes to locked sub 0 or 1 with equal probability (1/2).
 *     Splits: (g, 2-g) for g=0,1,2 with Binomial(2, 0.5) probabilities.
 *   Phase 2 (random): R = upgradeCount - 2 upgrades among all 4 subs (1/4 each).
 *
 * Total tuples: 3 guaranteed splits × C(R+3, 3) random splits ≤ 60. Fast.
 */
function pUpgradeForReroll(
  art: ArtifactData,
  lockedSubs: [SubStat, SubStat],
  baselineScore: number,
  weights: StatWeightMap
): number {
  const allSubs = Object.keys(art.substats ?? {}) as SubStat[];
  const n = allSubs.length;
  const upgradeCount = (art.totalRolls ?? 8) - 4;
  const R = Math.max(0, upgradeCount - 2);

  const mainContribution =
    art.mainStatKey === "hp" || art.mainStatKey === "atk"
      ? 0
      : scoreMainStat(art.mainStatKey, art.rarity);

  // Fixed score from known initial values; unknown/corrupted initials are random
  let fixedScore = 0;
  const hasKnownInit: boolean[] = [];
  for (const s of allSubs) {
    const rawInit = art.initialValues?.[s];
    const validInit =
      rawInit != null && isValidInitialValue(s, rawInit, art.rarity)
        ? rawInit
        : null;
    if (validInit != null) {
      fixedScore += calculateStatScore(s, validInit, weights).score;
      hasKnownInit.push(true);
    } else {
      hasKnownInit.push(false);
    }
  }

  const thresholdKey = Math.round(
    (baselineScore - mainContribution - fixedScore) * SCORE_SCALE
  );

  // Per-sub max-roll score coefficient
  const subCoefs = allSubs.map(
    (s) =>
      calculateStatScore(s, getSubstatMaxRoll(s, art.rarity as 4 | 5), weights)
        .score
  );

  // Locked sub indices (exactly 2)
  const lockedIdx: [number, number] = [-1, -1];
  let li = 0;
  for (let i = 0; i < n; i++) {
    if (lockedSubs.includes(allSubs[i])) {
      lockedIdx[li++] = i;
    }
  }

  // Cache coefRollSumPmf results: pmfCache[subIdx][rollCount]
  const pmfCache: PMF[][] = Array.from({ length: n }, () => []);
  const getSubPmf = (i: number, rolls: number): PMF => {
    if (rolls === 0) return new Map([[0, 1]]);
    let cached = pmfCache[i][rolls];
    if (!cached) {
      cached = coefRollSumPmf(subCoefs[i], rolls);
      pmfCache[i][rolls] = cached;
    }
    return cached;
  };

  // Guaranteed split probabilities: Binomial(2, 0.5)
  // g = upgrades to locked sub 0, (2-g) to locked sub 1
  const guaranteedSplits: [number, number, number][] = [
    [0, 2, 0.25], // (0, 2)
    [1, 1, 0.5], // (1, 1)
    [2, 0, 0.25], // (2, 0)
  ];

  let totalP = 0;

  for (const [g0, g1, gProb] of guaranteedSplits) {
    // Build guaranteed-upgrade counts per sub
    const guaranteed = new Array(n).fill(0);
    guaranteed[lockedIdx[0]] = g0;
    guaranteed[lockedIdx[1]] = g1;

    // Enumerate random-upgrade multinomial: R upgrades among 4 subs
    const rTuple: number[] = [];

    const enumerate = (depth: number, remaining: number): void => {
      if (depth === n - 1) {
        rTuple[depth] = remaining;

        // Multinomial probability for random phase
        let rProb = FACTORIALS[R];
        for (let i = 0; i < n; i++) rProb /= FACTORIALS[rTuple[i]];
        rProb /= 4 ** R;

        const jointProb = gProb * rProb;
        if (jointProb < 1e-14) return;

        // Convolve per-sub PMFs
        let pmf: PMF = new Map([[0, 1]]);
        for (let i = 0; i < n; i++) {
          const rolls = (hasKnownInit[i] ? 0 : 1) + guaranteed[i] + rTuple[i];
          pmf = convolvePmf(pmf, getSubPmf(i, rolls));
        }

        let tailP = 0;
        for (const [key, p] of pmf) {
          if (key > thresholdKey) tailP += p;
        }
        totalP += jointProb * tailP;
        return;
      }

      for (let u = 0; u <= remaining; u++) {
        rTuple[depth] = u;
        enumerate(depth + 1, remaining - u);
      }
    };

    enumerate(0, R);
  }

  return totalP;
}

// Level-up expected score and P(upgrade)

/**
 * Number of remaining upgrade rolls for an artifact at the given level.
 * 5★ artifacts get upgrades at +4, +8, +12, +16, +20 = 5 total.
 */
function remainingUpgradeRolls(level: number): number {
  const consumed = Math.floor(level / 4);
  return 5 - consumed;
}

/**
 * Expected score of a not-maxed artifact at level 20.
 * Current substats score + expected gain from remaining upgrade rolls.
 * For 3-sub artifacts: if `unactivatedSubstats` is present, the 4th sub
 * and its initial value are known (deterministic first roll).
 */
function expectedLevelupScore(
  art: ArtifactData,
  weights: StatWeightMap
): number {
  // Current substat score
  let currentSubScore = 0;
  const subs = Object.keys(art.substats ?? {}) as SubStat[];
  for (const s of subs) {
    const val = art.substats[s];
    if (val == null) continue;
    currentSubScore += calculateStatScore(s, val, weights).score;
  }

  const remaining = remainingUpgradeRolls(art.level);
  if (remaining <= 0 || subs.length === 0) return currentSubScore;

  // For 3-sub artifacts, the first remaining "roll" adds a 4th substat.
  let extraFromNewSub = 0;
  let newSubForRolls: SubStat | null = null;
  let upgradeRolls = remaining;

  if (subs.length < 4) {
    const unact = art.unactivatedSubstats;
    if (unact && Object.keys(unact).length > 0) {
      // Known 4th sub from unactivatedSubstats — deterministic
      const [newSub, newVal] = Object.entries(unact)[0] as [SubStat, number];
      extraFromNewSub = calculateStatScore(newSub, newVal, weights).score;
      newSubForRolls = newSub;
    } else {
      // Unknown — expected draw from pool
      const pool = makeDrawPool(art.mainStatKey, subs);
      if (pool.stats.length > 0) {
        for (let i = 0; i < pool.stats.length; i++) {
          const prob = pool.weights[i] / pool.totalWeight;
          extraFromNewSub += prob * avgRollScore(pool.stats[i], weights, 1);
        }
      }
    }
    upgradeRolls = remaining - 1;
  }

  // Remaining upgrade rolls: each lands uniformly on one of the 4 subs.
  let perRollExpected = 0;
  for (const s of subs) {
    perRollExpected += avgRollScore(s, weights, 1);
  }
  // Include the 4th sub's contribution to future upgrade rolls
  if (subs.length < 4) {
    if (newSubForRolls) {
      // Known 4th sub participates in future rolls
      perRollExpected += avgRollScore(newSubForRolls, weights, 1);
    } else {
      // Expected draw for the 4th sub's participation
      const pool = makeDrawPool(art.mainStatKey, subs);
      if (pool.stats.length > 0) {
        for (let i = 0; i < pool.stats.length; i++) {
          const prob = pool.weights[i] / pool.totalWeight;
          perRollExpected += prob * avgRollScore(pool.stats[i], weights, 1);
        }
      }
    }
  }
  perRollExpected /= 4; // uniform distribution among 4 subs

  const expectedGain = extraFromNewSub + upgradeRolls * perRollExpected;

  const mainContribution =
    art.mainStatKey === "hp" || art.mainStatKey === "atk"
      ? 0
      : scoreMainStat(art.mainStatKey, art.rarity);

  return currentSubScore + expectedGain + mainContribution;
}

/**
 * Exact P(upgrade) for leveling up a not-maxed artifact.
 * Uses PMF convolution over the remaining upgrade rolls.
 * For 3-sub artifacts with `unactivatedSubstats`, the 4th sub addition is
 * deterministic (known sub + initial value), enabling exact PMF.
 */
function pUpgradeForLevelup(
  art: ArtifactData,
  baselineScore: number,
  weights: StatWeightMap
): number {
  const subs = Object.keys(art.substats ?? {}) as SubStat[];
  const unact = art.unactivatedSubstats;
  const hasKnown4th = subs.length < 4 && unact && Object.keys(unact).length > 0;

  if (subs.length < 4 && !hasKnown4th) {
    // Unknown 4th sub — fall back to heuristic estimate
    const expected = expectedLevelupScore(art, weights);
    return expected > baselineScore ? 0.6 : 0.3;
  }

  const remaining = remainingUpgradeRolls(art.level);
  if (remaining <= 0) return 0;

  // Current substat score (fixed)
  let currentSubScore = 0;
  for (const s of subs) {
    const val = art.substats[s];
    if (val == null) continue;
    currentSubScore += calculateStatScore(s, val, weights).score;
  }

  // For 3-sub artifacts with known 4th sub: add its initial value score
  // and treat it as part of the fixed base (first "roll" is deterministic)
  let allSubsFor4 = subs;
  let upgradeRolls = remaining;
  if (hasKnown4th) {
    const [newSub, newVal] = Object.entries(unact)[0] as [SubStat, number];
    currentSubScore += calculateStatScore(newSub, newVal, weights).score;
    allSubsFor4 = [...subs, newSub];
    upgradeRolls = remaining - 1; // first roll consumed by the 4th sub
  }

  if (upgradeRolls <= 0) {
    // Only the 4th sub addition, no further rolls
    const mainContribution =
      art.mainStatKey === "hp" || art.mainStatKey === "atk"
        ? 0
        : scoreMainStat(art.mainStatKey, art.rarity);
    return currentSubScore + mainContribution > baselineScore ? 1 : 0;
  }

  const mainContribution =
    art.mainStatKey === "hp" || art.mainStatKey === "atk"
      ? 0
      : scoreMainStat(art.mainStatKey, art.rarity);

  // Threshold for the upgrade rolls alone
  const threshold = baselineScore - currentSubScore - mainContribution;

  // Single roll PMF: each roll lands on one of 4 subs uniformly,
  // with tier value uniform over {0.7, 0.8, 0.9, 1.0} × max
  const singleRollPmf: PMF = new Map();
  for (const s of allSubsFor4) {
    const coef = calculateStatScore(
      s,
      getSubstatMaxRoll(s, art.rarity as 4 | 5),
      weights
    ).score;
    for (const tier of ROLL_VALUE_TIERS) {
      const key = Math.round(coef * tier * SCORE_SCALE);
      singleRollPmf.set(key, (singleRollPmf.get(key) ?? 0) + 0.25 * 0.25);
    }
  }

  // Convolve for `upgradeRolls` rolls
  let pmf: PMF = singleRollPmf;
  for (let i = 1; i < upgradeRolls; i++) {
    pmf = convolvePmf(pmf, singleRollPmf);
  }

  const thresholdKey = Math.round(threshold * SCORE_SCALE);
  let tailP = 0;
  for (const [key, p] of pmf) {
    if (key > thresholdKey) tailP += p;
  }
  return tailP;
}

function knownLevelupSubstats(art: ArtifactData): SubStat[] {
  const seen = new Set<SubStat>();
  const out: SubStat[] = [];
  const add = (stat: string) => {
    const substat = stat as SubStat;
    if (substat === (art.mainStatKey as string)) return;
    if (seen.has(substat)) return;
    seen.add(substat);
    out.push(substat);
  };

  for (const stat of Object.keys(art.substats ?? {})) add(stat);
  for (const stat of Object.keys(art.unactivatedSubstats ?? {})) add(stat);

  return out;
}

function getLevelupDisplaySubs(
  art: ArtifactData,
  weights: StatWeightMap
): [SubStat, SubStat] | null {
  const knownSubs = knownLevelupSubstats(art);
  if (knownSubs.length < 2) return null;

  const originalIndex = new Map<SubStat, number>();
  knownSubs.forEach((stat, index) => {
    originalIndex.set(stat, index);
  });

  const weightedSubs = knownSubs
    .filter((stat) => (weights[stat] ?? 0) > 0)
    .sort(
      (a, b) =>
        (weights[b] ?? 0) - (weights[a] ?? 0) ||
        (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0)
    );

  const displaySubs: SubStat[] = [];
  for (const stat of weightedSubs) displaySubs.push(stat);
  for (const stat of knownSubs) {
    if (displaySubs.includes(stat)) continue;
    displaySubs.push(stat);
  }

  return [displaySubs[0], displaySubs[1]];
}

function actionBadgeForSuggestion(
  kind: ResourceKind,
  slot: Slot,
  sourceArtifact?: ArtifactData
): ResourceActionBadge {
  if (kind === "levelup") {
    return { type: "level", value: sourceArtifact?.level ?? 0 };
  }
  if (kind === "reroll") return { type: "count", value: 2 };
  if (slot === "flower" || slot === "plume") return { type: "count", value: 1 };
  if (slot === "sands") return { type: "count", value: 2 };
  if (slot === "circlet") return { type: "count", value: 3 };
  if (slot === "goblet") return { type: "count", value: 4 };
  return { type: "count", value: 1 };
}

// Per-build suggestion generator

const CANDIDATE_POOL_SIZE = 6;
const TOP_K_PER_BUILD = 5;

function suggestionsForBuild(
  evaluation: BuildEvaluation,
  tier: Tier,
  allArtifacts: ArtifactData[],
  globalConfig: GlobalStatWeights
): ResourceSuggestion[] {
  const { evalBuild, slots } = evaluation;
  const weights = scaleFlatWeights(evalBuild.weights, globalConfig);
  const desirableSubs = topDesirableSubs(evalBuild, CANDIDATE_POOL_SIZE);
  if (desirableSubs.length < 2) return [];

  const candidates: ResourceSuggestion[] = [];

  // For each slot, generate craft + reroll candidates
  for (const slot of allSlots) {
    const slotEval = slots[slot];
    const baselineScore = slotEval.score;

    // --- Craft candidates: only keep the single best-gain combo per slot.
    // If the user spends an elixir, they'll pick the most worthy stat combo,
    // so showing multiple craft variants for the same slot is noise.
    let bestCraft: ResourceSuggestion | null = null;
    const mains = getCandidateMainStats(slot, evalBuild);
    for (const mainStat of mains) {
      const mainKey: string = mainStat;
      const subPairs = pairs(desirableSubs).filter(
        ([a, b]) => a !== mainKey && b !== mainKey
      );

      for (const [s1, s2] of subPairs) {
        const expected = expectedCraftScore([s1, s2], mainStat, weights);
        const gain = expected - baselineScore;
        if (bestCraft == null || gain > bestCraft.expectedScoreGain) {
          bestCraft = {
            kind: "craft",
            actionBadge: actionBadgeForSuggestion("craft", slot),
            characterIds: [...evalBuild.characterIds],
            tier,
            buildKey: evalBuild.key,
            evalBuild,
            slot,
            setId:
              evalBuild.composition === "4pc"
                ? evalBuild.artifactSet
                : (evalBuild.halfSet1SetIds?.[0] ?? evalBuild.artifactSet),
            mainStat,
            displayStats: { main: mainStat, subs: [s1, s2] },
            lockedSubs: [s1, s2],
            expectedScoreGain: gain,
            baselineScore,
            pUpgrade: -1, // computed asynchronously
          };
        }
      }
    }
    if (bestCraft) candidates.push(bestCraft);

    // --- Reroll candidates ---
    const setIdsForBuild = getBuildSetIds(evalBuild);
    for (const art of allArtifacts) {
      if (art.slotKey !== slot) continue;
      if (art.rarity !== 5) continue;
      if (art.level !== 20) continue;
      if (!isFiveStarSet(art.setKey)) continue;
      if (setIdsForBuild && !setIdsForBuild.has(art.setKey)) continue;
      if (!mains.includes(art.mainStatKey)) continue;

      const existingSubs = Object.keys(art.substats ?? {}) as SubStat[];

      let lockedSubs: [SubStat, SubStat];
      if (art.elixirCrafted) {
        // Already rerolled once — locked subs must be the first two lines
        lockedSubs = [existingSubs[0], existingSubs[1]];
        const bothDesirable =
          desirableSubs.includes(lockedSubs[0]) &&
          desirableSubs.includes(lockedSubs[1]);
        if (!bothDesirable) continue;
      } else {
        const desirableExisting = existingSubs.filter((s) =>
          desirableSubs.includes(s)
        );
        if (desirableExisting.length < 2) continue;
        // Lock the 2 highest-weighted desired subs already present
        desirableExisting.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
        lockedSubs = [desirableExisting[0], desirableExisting[1]];
      }

      if (Object.keys(art.substats ?? {}).length !== 4) continue;

      const expected = expectedRerollScore(art, lockedSubs, weights);
      const gain = expected - baselineScore;
      candidates.push({
        kind: "reroll",
        actionBadge: actionBadgeForSuggestion("reroll", slot, art),
        characterIds: [...evalBuild.characterIds],
        tier,
        buildKey: evalBuild.key,
        evalBuild,
        slot,
        setId: art.setKey,
        mainStat: art.mainStatKey,
        displayStats: { main: art.mainStatKey, subs: lockedSubs },
        lockedSubs,
        sourceArtifact: art,
        expectedScoreGain: gain,
        baselineScore,
        pUpgrade: -1, // computed asynchronously
      });
    }

    // --- Level-up candidates: not-maxed artifacts that could improve this slot ---
    for (const art of allArtifacts) {
      if (art.slotKey !== slot) continue;
      if (art.rarity !== 5) continue;
      if (art.level >= 20) continue;
      if (!isFiveStarSet(art.setKey)) continue;
      if (setIdsForBuild && !setIdsForBuild.has(art.setKey)) continue;
      if (!mains.includes(art.mainStatKey)) continue;

      const displaySubs = getLevelupDisplaySubs(art, weights);
      if (!displaySubs) continue;

      const expected = expectedLevelupScore(art, weights);
      const gain = expected - baselineScore;

      candidates.push({
        kind: "levelup",
        actionBadge: actionBadgeForSuggestion("levelup", slot, art),
        characterIds: [...evalBuild.characterIds],
        tier,
        buildKey: evalBuild.key,
        evalBuild,
        slot,
        setId: art.setKey,
        mainStat: art.mainStatKey,
        displayStats: { main: art.mainStatKey, subs: displaySubs },
        lockedSubs: displaySubs,
        sourceArtifact: art,
        expectedScoreGain: gain,
        baselineScore,
        pUpgrade: -1,
      });
    }
  }

  // Keep top K by analytic score gain. pUpgrade is left as -1 and filled
  // asynchronously by the UI layer via `computeSuggestionPUpgrade`, with
  // results cached in `usePUpgradeCacheStore`.
  candidates.sort((a, b) => b.expectedScoreGain - a.expectedScoreGain);
  return candidates.slice(0, TOP_K_PER_BUILD);
}

function getCandidateMainStats(slot: Slot, evalBuild: EvalBuild): MainStat[] {
  if (slot === "flower") return ["hp"];
  if (slot === "plume") return ["atk"];
  const rec = evalBuild.mainStats[slot as "sands" | "goblet" | "circlet"];
  return rec && rec.length > 0 ? [...rec] : [];
}

function getBuildSetIds(evalBuild: EvalBuild): Set<string> | null {
  if (evalBuild.composition === "4pc") return new Set([evalBuild.artifactSet]);
  const ids = [
    ...(evalBuild.halfSet1SetIds ?? []),
    ...(evalBuild.halfSet2SetIds ?? []),
  ];
  return ids.length > 0 ? new Set(ids) : null;
}

// Public entry point

export function generateResourceSuggestions(
  setGroups: SetGroup[],
  accountData: AccountData,
  tierAssignments: TierAssignment,
  thresholds: TierCompletenessThresholds,
  minScoreDiff: KindTierMinScore,
  globalConfig: GlobalStatWeights
): ResourceSuggestion[] {
  // Flatten artifacts from the account for reroll candidate scanning
  const allArtifacts: ArtifactData[] = [];
  for (const char of accountData.characters) {
    for (const slot of allSlots) {
      const a = char.artifacts[slot];
      if (a) allArtifacts.push(a);
    }
  }
  for (const a of accountData.extraArtifacts) allArtifacts.push(a);

  const out: ResourceSuggestion[] = [];
  for (const group of setGroups) {
    for (const evaluation of group.evaluations) {
      // Resources (Sanctifying Elixir/Essence) only work on 5★ sets.
      if (!buildIsFiveStar(evaluation.evalBuild)) continue;

      const tier = bestTierForBuild(evaluation.evalBuild, tierAssignments);
      const threshold = thresholds[tier] ?? thresholds.Pool;
      if (evaluation.completeness >= threshold) continue;

      const buildSuggestions = suggestionsForBuild(
        evaluation,
        tier,
        allArtifacts,
        globalConfig
      ).filter((s) => {
        const kindThresholds = minScoreDiff[s.kind];
        const minGain = kindThresholds[tier] ?? kindThresholds.Pool;
        return s.expectedScoreGain >= minGain;
      });
      out.push(...buildSuggestions);
    }
  }

  out.sort((a, b) => b.expectedScoreGain - a.expectedScoreGain);
  return out;
}
