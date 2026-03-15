import { artifactIdToHalfSetId, statPools } from "@/data/constants";
import type {
  ArtifactData,
  Build,
  CharacterData,
  GlobalStatWeights,
  MainStat,
  MainStatSlot,
  Slot,
  SubStat,
} from "@/data/types";
import { allSlots, mainStatSlots } from "@/data/types";
import {
  MAIN_STAT_CD_EQUIV_4STAR,
  MAIN_STAT_CD_EQUIV_5STAR,
  SUBSTAT_COEFFICIENTS,
  computeCrDeduction,
  computeIdealScore as computeIdealScoreShared,
  getMainStatValue,
  getMainStatValueAtLevel,
  getSubstatAvgRoll,
  getSubstatMaxRoll,
} from "./scoring/utils";

// ----------------------------------------------------------------------------
// 1. Constants & Helpers
// ----------------------------------------------------------------------------

// Max CD roll value used as baseline for sub-score calculation
const MAX_CD_ROLL_5STAR = getSubstatMaxRoll("cd", 5);
const MAX_CD_ROLL_4STAR = getSubstatMaxRoll("cd", 4);

// All stat keys that can appear as main or sub stats
const SUB_STATS: SubStat[] = [
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

/** @deprecated Use getMainStatValue from scoring/utils instead */
export const getFixedMainStatValue = getMainStatValue;

export { getMainStatValueAtLevel };

/** Per-stat breakdown for UI (value and weighted sub-score only; main score not exposed). */
export interface StatScoreBreakdown {
  subValue: number;
  subScore: number;
  subCount: number;
  weight: number;
}

/** Result of substat scoring only. Slot maps use Record<Slot, number> with 0 for unequipped. */
export interface SubstatScoreResult {
  subScore: number;
  statCount: number;
  slotSubScores: Record<Slot, number>;
  slotMaxSubScores: Record<Slot, number>;
  statScores: Record<SubStat, StatScoreBreakdown>;
  isComplete: boolean;
}

export type MainStatMismatch = {
  slot: MainStatSlot;
  equipped: MainStat;
};

export type StatWeightMap = Partial<Record<SubStat, number>>;

/** Scale flat stat weights (hp, atk, def) by their globalConfig effectiveness. */
export function scaleFlatWeights(
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights
): StatWeightMap {
  const out = { ...weights };
  if (out.hp != null) out.hp = out.hp * (globalConfig.flatHp / 100);
  if (out.atk != null) out.atk = out.atk * (globalConfig.flatAtk / 100);
  if (out.def != null) out.def = out.def * (globalConfig.flatDef / 100);
  return out;
}

export type BuildMatchResult = {
  build: Build;
  buildIndex: number;
  statWeights: StatWeightMap;
  setMatched: boolean;
  /** True when the build's artifact set is genuinely different from the equipped set (not just incomplete). */
  setDifferent: boolean;
  mainStatMatches: number; // 0-3
  mainStatMismatches: MainStatMismatch[];
};

/** Normalized score info (main stat scoring + 300-point scale) */
export interface NormalizedScoreInfo {
  /** Total normalized score out of 300 */
  normalizedScore: number;
  /** Raw main stat CD-equiv score (before normalization) */
  rawMainStatScore: number;
  /** Per-slot main stat CD-equiv (0 for flower/plume or wrong main stat) */
  slotMainStatScores: Record<Slot, number>;
  /** Ideal score for a perfect build with these weights (main + sub) */
  idealScore: number;
  /** 300 / idealScore */
  normalizer: number;
}

export interface ArtifactScoreResult {
  substatScore: SubstatScoreResult;
  buildMatch: BuildMatchResult | null;
  /** Normalized scoring (main stat + 300-scale). Null when no build is matched. */
  normalized: NormalizedScoreInfo | null;
}

// ----------------------------------------------------------------------------
// 2. Stat Scoring
// ----------------------------------------------------------------------------

/**
 * Calculates the score for a single attribute.
 * Returns { score, weight }
 */
export function calculateStatScore(
  stat: SubStat,
  value: number,
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights
): { score: number; weight: number } {
  const rawWeight = weights[stat] ?? 0;
  const coeff = SUBSTAT_COEFFICIENTS[stat] ?? 0;
  const score = value * coeff * (rawWeight / 100);

  return { score, weight: rawWeight };
}

/**
 * Scores a main stat as-if fully recommended (weight = 1.0).
 *
 * SubStat-typed main stats (atk%, cr, cd, em, er, hp%, def%) are routed through
 * calculateStatScore so they use the same normalization. Main-only stats
 * (elemental dmg%, phys%, heal%) use their own conversion factors.
 *
 * Used for heuristic ranking (e.g., optimizer pre-filtering) where the build
 * already determines which main stats are recommended — callers should only
 * invoke this for recommended main stats.
 */
export function scoreMainStat(
  mainStat: MainStat,
  rarity: number,
  globalConfig: GlobalStatWeights,
  level?: number
): number {
  const value =
    level != null
      ? getMainStatValueAtLevel(mainStat, rarity, level)
      : getFixedMainStatValue(mainStat, rarity);
  if (!value) return 0;

  // SubStat-typed mains: reroute through the substat formula at weight 100.
  // calculateStatScore returns 0 for unknown stat keys, so a non-zero result
  // confirms this stat is handled as a substat.
  const { score: subScore } = calculateStatScore(
    mainStat as SubStat,
    value,
    { [mainStat]: 100 },
    globalConfig
  );
  if (subScore > 0) return subScore;

  // Main-only stats: fixed conversion factors (same normalization as substat formula)
  switch (mainStat) {
    case "pyro%":
    case "hydro%":
    case "anemo%":
    case "electro%":
    case "dendro%":
    case "cryo%":
    case "geo%":
      return value * 1.3348;
    case "phys%":
      return value * 1.0669;
    case "heal%":
      return value * 1.7326;
    default:
      return 0;
  }
}

/**
 * Calculate the max potential sub-score for a slot based on:
 * - Available substat pool (all substats minus main stat type)
 * - Character's stat weights
 * - 5-star: 8 rolls distributed as 5-1-1-1 to top 4 weighted stats
 * - 4-star: 6 rolls distributed as 3-1-1-1 to top 4 weighted stats
 */
export function calculateMaxSlotSubScore(
  mainStat: MainStat,
  weights: StatWeightMap,
  rarity: number
): number {
  // Get substat pool excluding main stat (if it's a substat type)
  const pool = statPools.substat.filter((s) => s !== mainStat) as SubStat[];

  // Get weights for each stat, normalized to 0-1
  const statWeights = pool
    .map((stat) => (weights[stat] ?? 0) / 100)
    .filter((w) => w > 0)
    .sort((a, b) => b - a);

  // Need at least 1 stat with weight to calculate potential
  if (statWeights.length === 0) return 0;

  const is5Star = rarity === 5;
  const rolls = is5Star ? [5, 1, 1, 1] : [3, 1, 1, 1];
  const maxCdRoll = is5Star ? MAX_CD_ROLL_5STAR : MAX_CD_ROLL_4STAR;

  let weightSum = 0;
  for (let i = 0; i < Math.min(4, statWeights.length); i++) {
    weightSum += rolls[i] * statWeights[i];
  }

  return weightSum * maxCdRoll;
}

// ----------------------------------------------------------------------------
// 3. Scoring Loop
// ----------------------------------------------------------------------------

/**
 * For DPS builds whose circlet recommends only one of CR/CD,
 * treat both CR and CD as correct main stats.
 */
const SLOT_TO_WEIGHTS_KEY: Record<
  MainStatSlot,
  "sandsWeights" | "gobletWeights" | "circletWeights"
> = {
  sands: "sandsWeights",
  goblet: "gobletWeights",
  circlet: "circletWeights",
};

function getMainStats(build: Build, slot: MainStatSlot): MainStat[] {
  return build[SLOT_TO_WEIGHTS_KEY[slot]].map((w) => w.stat);
}

function getEffectiveMainStats(slot: MainStatSlot, build: Build): MainStat[] {
  const stats = getMainStats(build, slot);
  if (
    slot === "circlet" &&
    build.roles?.includes("dps") &&
    (stats.includes("cr") || stats.includes("cd")) &&
    !(stats.includes("cr") && stats.includes("cd"))
  ) {
    const expanded = new Set(stats);
    expanded.add("cr");
    expanded.add("cd");
    return [...expanded];
  }
  return stats;
}

function matchMainStats(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: Build
): { match: number; mismatches: MainStatMismatch[] } {
  let match = 0;
  const mismatches: MainStatMismatch[] = [];
  for (const slot of mainStatSlots) {
    const artifact = artifacts[slot];
    if (!artifact) continue;
    const accepted = getEffectiveMainStats(slot, build);
    if (accepted.length === 0 || accepted.includes(artifact.mainStatKey)) {
      match++;
    } else {
      mismatches.push({
        slot,
        equipped: artifact.mainStatKey,
      });
    }
  }
  return { match: match, mismatches };
}

/**
 * Match the character's equipped artifacts to their best-fitting build.
 *
 * Matching priority:
 * 1. Artifact set — does the equipped set match the build's 4pc or 2pc+2pc?
 * 2. Main stats — how many sands/goblet/circlet main stats are recommended?
 * 3. Constellation — pick the build with the highest minCons the character satisfies.
 *
 * Visible builds are preferred; hidden builds are used as secondary candidates
 * only when visible builds have no set match.
 * Returns null when no builds are provided.
 */
export function matchBuild(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  builds: Build[],
  constellation: number,
  globalConfig?: GlobalStatWeights
): BuildMatchResult | null {
  const scored = builds.map((build, index) => {
    const setMatched = isSetMatched(artifacts, build);
    const { match: mainStatMatches, mismatches: mainStatMismatches } =
      matchMainStats(artifacts, build);
    const minCons = build.minCons ?? 0;
    // Numeric: actual minCons when satisfied, -1 when not.
    // Allows sorting to prefer the highest satisfied constellation.
    const consSatisfied = constellation >= minCons ? minCons : -1;

    return {
      build,
      index,
      setMatched,
      mainStatMatches,
      mainStatMismatches,
      consSatisfied,
    };
  });

  scored.sort((a, b) => {
    if (a.setMatched !== b.setMatched) {
      return Number(b.setMatched) - Number(a.setMatched);
    }
    if (a.mainStatMatches !== b.mainStatMatches) {
      return b.mainStatMatches - a.mainStatMatches;
    }
    if (a.build.visible !== b.build.visible) {
      return Number(b.build.visible) - Number(a.build.visible);
    }
    if (a.consSatisfied !== b.consSatisfied) {
      return b.consSatisfied - a.consSatisfied;
    }
    return a.index - b.index;
  });

  const winner = scored[0];
  if (!winner) return null;

  return {
    build: winner.build,
    buildIndex: winner.index,
    statWeights: buildToWeightMap(winner.build, globalConfig),
    setMatched: winner.setMatched,
    setDifferent: isSetDifferent(artifacts, winner.build),
    mainStatMatches: winner.mainStatMatches,
    mainStatMismatches: winner.mainStatMismatches,
  };
}

export function buildToWeightMap(
  build: Build,
  globalConfig?: GlobalStatWeights
): StatWeightMap {
  const map: StatWeightMap = {};
  for (const { stat, weight } of build.substats) {
    map[stat] = weight;
  }
  // Flat stats: if explicitly set in the build, honor that weight directly.
  // Otherwise, inherit from the % counterpart scaled by globalConfig
  // effectiveness (punishment factor).
  const flatHp = (globalConfig?.flatHp ?? 100) / 100;
  const flatAtk = (globalConfig?.flatAtk ?? 100) / 100;
  const flatDef = (globalConfig?.flatDef ?? 100) / 100;
  if (map.hp == null && map["hp%"] != null) map.hp = map["hp%"] * flatHp;
  if (map.atk == null && map["atk%"] != null) map.atk = map["atk%"] * flatAtk;
  if (map.def == null && map["def%"] != null) map.def = map["def%"] * flatDef;
  return map;
}

export function getTargetMainStatsForSlot(
  slot: Slot,
  build: Build,
  equippedForSlot?: ArtifactData | null
): Set<MainStat> {
  if (slot === "flower") return new Set(["hp"]);
  if (slot === "plume") return new Set(["atk"]);
  const weights = buildToWeightMap(build);
  if (mainStatSlots.includes(slot as MainStatSlot)) {
    const recommended = getEffectiveMainStats(slot as MainStatSlot, build);
    if (recommended?.length > 0) return new Set(recommended);
  }
  if (
    equippedForSlot &&
    (weights[equippedForSlot.mainStatKey as SubStat] ?? 0) > 0
  )
    return new Set([equippedForSlot.mainStatKey]);
  const fallback = new Set<MainStat>();
  for (const [stat, w] of Object.entries(weights)) {
    if (w > 40 && !stat.includes("flat")) fallback.add(stat as MainStat);
  }
  return fallback.size > 0 ? fallback : new Set();
}

const FALLBACK_WEIGHTS: StatWeightMap = { cr: 100, cd: 100 };

export function scoreSlot(
  artifact: ArtifactData,
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights
): number {
  let score = 0;
  if (artifact.substats) {
    for (const [key, val] of Object.entries(artifact.substats)) {
      if (val == null) continue;
      score += calculateStatScore(
        key as SubStat,
        val,
        weights,
        globalConfig
      ).score;
    }
  }
  return score;
}

/**
 * Score a slot including both substats and main stat contribution.
 * Used by the optimizer to correctly compare artifacts with different main stats.
 * Main stat score uses the build's actual weights, so a wrong main stat (weight=0)
 * contributes nothing while a correct one adds significant value.
 */
export function scoreSlotWithMainStat(
  artifact: ArtifactData,
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights,
  targetMainStats: Set<string>
): number {
  let score = scoreSlot(artifact, weights, globalConfig);

  // Add main stat contribution for sands/goblet/circlet
  // Flower (hp) and plume (atk) are fixed so main stat doesn't differentiate candidates
  const mainStat = artifact.mainStatKey;
  if (mainStat === "hp" || mainStat === "atk") return score;

  if (!targetMainStats.has(mainStat)) {
    // Wrong main stat — no main stat contribution
    return score;
  }

  // Score the main stat value using the same system
  score += scoreMainStat(
    mainStat,
    artifact.rarity,
    globalConfig,
    artifact.level
  );
  return score;
}

export function scoreAllSlots(
  char: CharacterData,
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights,
  nonArtifactCr?: number
): SubstatScoreResult {
  const statScores = Object.fromEntries(
    SUB_STATS.map((key) => {
      const { weight } = calculateStatScore(key, 0, weights, globalConfig);
      return [key, { subValue: 0, subScore: 0, subCount: 0, weight }];
    })
  ) as Record<SubStat, StatScoreBreakdown>;

  const slotSubScores = Object.fromEntries(
    allSlots.map((s) => [s, 0])
  ) as Record<Slot, number>;
  const slotMaxSubScores = Object.fromEntries(
    allSlots.map((s) => [s, 0])
  ) as Record<Slot, number>;
  let subScore = 0;
  let statCount = 0;
  let equippedCount = 0;

  for (const slot of allSlots) {
    const artifact = char.artifacts?.[slot];
    if (!artifact) continue;

    equippedCount++;
    let slotSub = 0;
    const rarity = artifact.rarity === 4 ? 4 : 5;

    for (const [key, rawVal] of Object.entries(artifact.substats ?? {})) {
      const val = rawVal ?? 0;
      const stat = key as SubStat;
      const { score } = calculateStatScore(stat, val, weights, globalConfig);
      slotSub += score;
      subScore += score;
      statScores[stat].subValue += val;
      statScores[stat].subScore += score;

      // Compute roll count for stats with positive weight
      if ((weights[stat] ?? 0) > 0) {
        const r = rarity === 4 || rarity === 5 ? rarity : 5;
        const avgRoll = getSubstatAvgRoll(stat, r as 4 | 5);
        if (avgRoll) {
          const count = val / avgRoll;
          statScores[stat].subCount += count;
          statCount += count;
        }
      }
    }

    slotSubScores[slot] = slotSub;
    if (artifact.rarity === 5 || artifact.rarity === 4) {
      let maxScore = calculateMaxSlotSubScore(
        artifact.mainStatKey,
        weights,
        artifact.rarity
      );
      // If the build's weights produce 0 (e.g. no weighted substats in pool),
      // fall back to cr/cd weights so the progress bar still renders.
      if (maxScore === 0) {
        maxScore = calculateMaxSlotSubScore(
          artifact.mainStatKey,
          FALLBACK_WEIGHTS,
          artifact.rarity
        );
      }
      slotMaxSubScores[slot] = maxScore;
    }
  }

  // CR clamp: deduct score contribution of CR exceeding the budget
  if (nonArtifactCr != null) {
    const crWeight = weights.cr ?? 0;
    if (crWeight > 0) {
      let totalArtifactCr = statScores.cr.subValue / 100;
      for (const slot of mainStatSlots) {
        const artifact = char.artifacts?.[slot];
        if (artifact?.mainStatKey === "cr") {
          const rarity = artifact.rarity === 4 ? 4 : 5;
          totalArtifactCr += getFixedMainStatValue("cr", rarity) / 100;
        }
      }
      subScore -= computeCrDeduction(totalArtifactCr, nonArtifactCr, crWeight);
    }
  }

  return {
    subScore,
    statCount,
    slotSubScores,
    slotMaxSubScores,
    statScores,
    isComplete: equippedCount === 5,
  };
}

/**
 * Compute ideal score for normalization (delegates to shared computeIdealScore).
 * V1 legacy: all 3 main stat slots at 100% weight.
 */
function computeIdealScoreV1(weights: StatWeightMap): number {
  const fullWeights = {} as Record<SubStat, number>;
  for (const stat of SUB_STATS) {
    fullWeights[stat] = weights[stat] ?? 0;
  }
  return computeIdealScoreShared(fullWeights, 100, 100, 100).idealScore;
}

/**
 * Compute main stat scores and normalize the total to a 300-point scale.
 * Every recommended main stat is treated as 100% effective (weight = 1.0).
 */
function computeNormalizedScore(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  buildMatch: BuildMatchResult,
  substatRawScore: number
): NormalizedScoreInfo {
  const slotMainStatScores = Object.fromEntries(
    allSlots.map((s) => [s, 0])
  ) as Record<Slot, number>;

  let rawMainStatScore = 0;

  for (const slot of mainStatSlots) {
    const artifact = artifacts[slot];
    if (!artifact) continue;

    const hasMismatch = buildMatch.mainStatMismatches.some(
      (m) => m.slot === slot
    );
    if (hasMismatch) continue;

    // Correct main stat → full CD-equiv
    const cdEquiv =
      artifact.rarity === 4
        ? MAIN_STAT_CD_EQUIV_4STAR
        : MAIN_STAT_CD_EQUIV_5STAR;
    slotMainStatScores[slot] = cdEquiv;
    rawMainStatScore += cdEquiv;
  }

  const idealScore = computeIdealScoreV1(buildMatch.statWeights);
  const normalizer = idealScore > 0 ? 300 / idealScore : 1;
  const normalizedScore = (rawMainStatScore + substatRawScore) * normalizer;

  return {
    normalizedScore,
    rawMainStatScore,
    slotMainStatScores,
    idealScore,
    normalizer,
  };
}

export function scoreWithBuilds(
  char: CharacterData,
  builds: Build[],
  globalConfig: GlobalStatWeights,
  nonArtifactCr?: number
): ArtifactScoreResult {
  const buildMatch = matchBuild(
    char.artifacts,
    builds,
    char.constellation,
    globalConfig
  );
  const substatScore = scoreAllSlots(
    char,
    buildMatch?.statWeights ?? FALLBACK_WEIGHTS,
    globalConfig,
    nonArtifactCr
  );
  const normalized =
    buildMatch != null
      ? computeNormalizedScore(
          char.artifacts,
          buildMatch,
          substatScore.subScore
        )
      : null;
  return { substatScore, buildMatch, normalized };
}

// ----------------------------------------------------------------------------
// 4. Build Matching
// ----------------------------------------------------------------------------

/** Count how many equipped artifacts belong to a given artifact set (string ID). */
function countSetPieces(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  setId: string
): number {
  let count = 0;
  for (const slot of allSlots) {
    if (artifacts[slot]?.setKey === setId) count++;
  }
  return count;
}

/** Count how many slots have an equipped artifact. */
function countEquipped(artifacts: Partial<Record<Slot, ArtifactData>>): number {
  let count = 0;
  for (const slot of allSlots) {
    if (artifacts[slot] != null) count++;
  }
  return count;
}

/** Check if the equipped artifacts satisfy a build's artifact set requirement.
 *  When slots are missing, give the benefit of the doubt: the unequipped slot
 *  could have been the right set piece. Requires at least 3 confirmed pieces. */
function isSetMatched(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: Build
): boolean {
  if (build.composition === "4pc" && build.artifactSet) {
    const missing = 5 - countEquipped(artifacts);
    const threshold = Math.max(3, 4 - missing);
    return countSetPieces(artifacts, build.artifactSet) >= threshold;
  }

  if (
    build.composition === "2pc+2pc" &&
    build.halfSet1 != null &&
    build.halfSet2 != null
  ) {
    // Map equipped set IDs to half set IDs, then check both halves are present
    const halfSetCounts = new Map<string | number, number>();
    for (const slot of allSlots) {
      const setKey = artifacts[slot]?.setKey;
      if (!setKey) continue;
      const halfSetId = artifactIdToHalfSetId[setKey];
      if (halfSetId != null) {
        halfSetCounts.set(halfSetId, (halfSetCounts.get(halfSetId) ?? 0) + 1);
      }
    }
    const missing = 5 - countEquipped(artifacts);
    const half1 = halfSetCounts.get(build.halfSet1) ?? 0;
    const half2 = halfSetCounts.get(build.halfSet2) ?? 0;
    // With missing slots, allow one half-set to be short by 1 (but need at least 1 piece)
    const shortfall = 2 - half1 + (2 - half2);
    return half1 >= 1 && half2 >= 1 && shortfall <= missing;
  }

  return false;
}

/**
 * Check if the build's artifact set is genuinely different from the equipped set.
 *
 * Unlike isSetMatched (which checks if the set bonus is fully active), this checks
 * whether the equipped artifacts belong to a fundamentally different set.
 * For 4pc: the build's set must not be the primary (most common) equipped set.
 * For 2pc+2pc: delegates to isSetMatched (same threshold applies).
 */
function isSetDifferent(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: Build
): boolean {
  if (build.composition === "4pc" && build.artifactSet) {
    const buildSetCount = countSetPieces(artifacts, build.artifactSet);
    // Find the max count of any single set among equipped artifacts
    const counts = new Map<string, number>();
    for (const slot of allSlots) {
      const setKey = artifacts[slot]?.setKey;
      if (setKey) counts.set(setKey, (counts.get(setKey) ?? 0) + 1);
    }
    let maxCount = 0;
    for (const count of counts.values()) {
      if (count > maxCount) maxCount = count;
    }
    // The build's set is "different" only if another set has strictly more pieces
    return buildSetCount < maxCount;
  }

  if (
    build.composition === "2pc+2pc" &&
    build.halfSet1 != null &&
    build.halfSet2 != null
  ) {
    return !isSetMatched(artifacts, build);
  }

  return false;
}
