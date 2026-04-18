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

import { artifactsById } from "@/data/constants";
import type {
  AccountData,
  ArtifactData,
  GlobalStatWeights,
  MainStat,
  Slot,
  SubStat,
  Tier,
  TierAssignment,
} from "@/data/types";
import { allSlots } from "@/data/types";
import {
  type StatWeightMap,
  calculateStatScore,
  scaleFlatWeights,
  scoreMainStat,
} from "./artifactScore";
import type { BuildEvaluation, EvalBuild, SetGroup } from "./buildEvaluation";
import { getSubstatAvgRoll, getSubstatMaxRoll } from "./scoring/utils";

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

/** Per-tier minimum expected score gain for a suggestion to be shown.
 * May be negative — a negative threshold surfaces suggestions whose *expected*
 * gain is negative but which still have a meaningful upgrade chance. */
export const DEFAULT_MIN_SCORE_DIFF: TierCompletenessThresholds = {
  S: 0,
  A: 5,
  B: 10,
  C: 15,
  D: 20,
  Pool: 20,
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
  kind: "craft" | "reroll";
  characterIds: string[];
  /** Representative tier (best among the build's characters). */
  tier: Tier;
  buildKey: string;
  evalBuild: EvalBuild;
  slot: Slot;
  /** Target artifact set for craft, or existing artifact's set for reroll. */
  setId: string;
  mainStat: MainStat;
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
 * buildKey), slot, main stat, locked subs, baseline score, and a hash of
 * the global config.
 */
export function suggestionCacheKey(
  s: ResourceSuggestion,
  globalConfigHash: string
): string {
  const locked = [...s.lockedSubs].sort().join("+");
  return `${globalConfigHash}|${s.buildKey}|${s.slot}|${s.mainStat}|${locked}|${s.baselineScore.toFixed(6)}`;
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
  return pUpgradeForCandidate(
    suggestion.lockedSubs,
    suggestion.mainStat,
    suggestion.baselineScore,
    weights,
    globalConfig
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
const P_FOUR_UPGRADES = 0.75;
const ROLL_VALUE_TIERS = [0.7, 0.8, 0.9, 1.0] as const;

// Analytic expected score for a 5★ artifact with given lockedSubs + mainStat

type DrawPool = { stats: SubStat[]; weights: number[]; totalWeight: number };

function makeDrawPool(mainStat: MainStat, excluded: SubStat[]): DrawPool {
  const stats: SubStat[] = [];
  const weights: number[] = [];
  let totalWeight = 0;
  for (const s of SUBSTAT_POOL) {
    if (s === (mainStat as unknown as SubStat)) continue;
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
  globalConfig: GlobalStatWeights,
  rollCount: number
): number {
  const value = getSubstatAvgRoll(stat, 5) * rollCount;
  return calculateStatScore(stat, value, weights, globalConfig).score;
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
  globalConfig: GlobalStatWeights,
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
      perRollSum += avgRollScore(s, weights, globalConfig, 1);
    }
    expected += c.prob * EXPECTED_ROLLS_PER_SUB * perRollSum;
  }

  // Main stat contribution (same as calculateMaxSlotSubScore consumers)
  const mainContribution =
    mainStat === "hp" || mainStat === "atk"
      ? 0
      : scoreMainStat(mainStat, rarity, globalConfig);

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
    for (const [k2, p2] of b) {
      const k = k1 + k2;
      out.set(k, (out.get(k) ?? 0) + p1 * p2);
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
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights
): number {
  const pool = makeDrawPool(mainStat, lockedSubs);
  if (pool.stats.length < 2) return 0;

  const mainContribution =
    mainStat === "hp" || mainStat === "atk"
      ? 0
      : scoreMainStat(mainStat, 5, globalConfig);
  const threshold = baselineScore - mainContribution;

  // Per-sub max-roll score (coef in the convolution above). 0 = junk.
  const coefCache: Partial<Record<SubStat, number>> = {};
  const coefOf = (s: SubStat): number => {
    const cached = coefCache[s];
    if (cached !== undefined) return cached;
    const v = calculateStatScore(
      s,
      getSubstatMaxRoll(s, 5),
      weights,
      globalConfig
    ).score;
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
      const subPairs = pairs(desirableSubs).filter(
        ([a, b]) =>
          a !== (mainStat as unknown as SubStat) &&
          b !== (mainStat as unknown as SubStat)
      );

      for (const [s1, s2] of subPairs) {
        const expected = expectedCraftScore(
          [s1, s2],
          mainStat,
          weights,
          globalConfig
        );
        const gain = expected - baselineScore;
        if (bestCraft == null || gain > bestCraft.expectedScoreGain) {
          bestCraft = {
            kind: "craft",
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
      if (!isFiveStarSet(art.setKey)) continue;
      if (setIdsForBuild && !setIdsForBuild.has(art.setKey)) continue;
      if (!mains.includes(art.mainStatKey)) continue;

      const existingSubs = Object.keys(art.substats ?? {}) as SubStat[];
      const desirableExisting = existingSubs.filter((s) =>
        desirableSubs.includes(s)
      );
      if (desirableExisting.length < 2) continue;

      // Lock the 2 highest-weighted desired subs already present
      desirableExisting.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
      const lockedSubs: [SubStat, SubStat] = [
        desirableExisting[0],
        desirableExisting[1],
      ];

      const expected = expectedCraftScore(
        lockedSubs,
        art.mainStatKey,
        weights,
        globalConfig
      );
      const gain = expected - baselineScore;
      candidates.push({
        kind: "reroll",
        characterIds: [...evalBuild.characterIds],
        tier,
        buildKey: evalBuild.key,
        evalBuild,
        slot,
        setId: art.setKey,
        mainStat: art.mainStatKey,
        lockedSubs,
        sourceArtifact: art,
        expectedScoreGain: gain,
        baselineScore,
        pUpgrade: -1, // computed asynchronously
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
  minScoreDiff: TierCompletenessThresholds,
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

      const minGain = minScoreDiff[tier] ?? minScoreDiff.Pool;
      const buildSuggestions = suggestionsForBuild(
        evaluation,
        tier,
        allArtifacts,
        globalConfig
      ).filter((s) => s.expectedScoreGain >= minGain);
      out.push(...buildSuggestions);
    }
  }

  out.sort((a, b) => b.expectedScoreGain - a.expectedScoreGain);
  return out;
}
