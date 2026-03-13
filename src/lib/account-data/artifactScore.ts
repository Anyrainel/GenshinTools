import {
  AVERAGE_ROLL_MULTIPLIER,
  artifactIdToHalfSetId,
  maxSubstatRolls,
  statPools,
} from "@/data/constants";
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

// ----------------------------------------------------------------------------
// 1. Constants & Helpers
// ----------------------------------------------------------------------------

// Max CD roll value used as baseline for sub-score calculation
const MAX_CD_ROLL_5STAR = 7.77;
const MAX_CD_ROLL_4STAR = 6.22;

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

// Max level main stat values (reference)
const MAIN_STAT_VALUES_5STAR: Record<string, number> = {
  hp: 4780,
  atk: 311,
  "hp%": 46.6,
  "atk%": 46.6,
  "def%": 58.3,
  em: 186.5,
  er: 51.8,
  "pyro%": 46.6,
  "hydro%": 46.6,
  "cryo%": 46.6,
  "electro%": 46.6,
  "anemo%": 46.6,
  "geo%": 46.6,
  "dendro%": 46.6,
  "phys%": 58.3,
  cr: 31.1,
  cd: 62.2,
  "heal%": 35.9,
};

const MAIN_STAT_VALUES_4STAR: Record<string, number> = {
  hp: 3571,
  atk: 232,
  "hp%": 34.8,
  "atk%": 34.8,
  "def%": 43.5,
  em: 139.3,
  er: 38.7,
  "pyro%": 34.8,
  "hydro%": 34.8,
  "cryo%": 34.8,
  "electro%": 34.8,
  "anemo%": 34.8,
  "geo%": 34.8,
  "dendro%": 34.8,
  "phys%": 43.5,
  cr: 23.2,
  cd: 46.4,
  "heal%": 26.8,
};

export function getFixedMainStatValue(key: MainStat, rarity: number): number {
  const is4Star = rarity === 4;
  const maxValues = is4Star ? MAIN_STAT_VALUES_4STAR : MAIN_STAT_VALUES_5STAR;
  return maxValues[key] || 0;
}

// Base values at level 0 for 5★ artifacts
const MAIN_STAT_BASE_5STAR: Record<string, number> = {
  hp: 717,
  atk: 47,
  "hp%": 7.0,
  "atk%": 7.0,
  "def%": 8.7,
  em: 28.0,
  er: 7.8,
  "pyro%": 7.0,
  "hydro%": 7.0,
  "cryo%": 7.0,
  "electro%": 7.0,
  "anemo%": 7.0,
  "geo%": 7.0,
  "dendro%": 7.0,
  "phys%": 8.7,
  cr: 4.7,
  cd: 9.3,
  "heal%": 5.4,
};

// Base values at level 0 for 4★ artifacts
const MAIN_STAT_BASE_4STAR: Record<string, number> = {
  hp: 645,
  atk: 42,
  "hp%": 6.3,
  "atk%": 6.3,
  "def%": 7.9,
  em: 25.2,
  er: 7.0,
  "pyro%": 6.3,
  "hydro%": 6.3,
  "cryo%": 6.3,
  "electro%": 6.3,
  "anemo%": 6.3,
  "geo%": 6.3,
  "dendro%": 6.3,
  "phys%": 7.9,
  cr: 4.2,
  cd: 8.4,
  "heal%": 4.8,
};

/**
 * Get the main stat value at a specific level (linear interpolation between base and max).
 * Values are in display units (e.g., 46.6 for ATK%, 4780 for HP).
 */
export function getMainStatValueAtLevel(
  key: MainStat,
  rarity: number,
  level: number
): number {
  const is4Star = rarity === 4;
  const maxLevel = is4Star ? 16 : 20;
  const baseValues = is4Star ? MAIN_STAT_BASE_4STAR : MAIN_STAT_BASE_5STAR;
  const maxValues = is4Star ? MAIN_STAT_VALUES_4STAR : MAIN_STAT_VALUES_5STAR;
  const base = baseValues[key] ?? 0;
  const max = maxValues[key] ?? 0;
  const clampedLevel = Math.max(0, Math.min(level, maxLevel));
  return base + (max - base) * (clampedLevel / maxLevel);
}

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

/** CD-equivalent value of a correct main stat (5★ Lv.20) */
const MAIN_STAT_CD_EQUIV_5STAR = 62.1;
/** CD-equivalent value of a correct main stat (4★ Lv.16) */
const MAIN_STAT_CD_EQUIV_4STAR = 46.4;
/** Average CD-equiv per roll (7.77 × 0.85) */
const AVG_ROLL_CD_EQUIV = 7.77 * 0.85;
/** Ideal roll distribution across top-4 weighted substats for a perfect set */
const IDEAL_ROLL_DISTRIBUTION = [22, 10, 5, 5];

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
  let score = 0;
  // Weight is 0-100, so we divide by 100
  const rawWeight = weights[stat] ?? 0;
  const w = rawWeight / 100;
  const effectiveWeight = rawWeight;

  // stats that can appear on sub stat are converted based on sub stat scaling.
  // main-only stats are converted based on main stat scaling.
  // The ratio is calculated to be equivalent of crit damage if it had the same roll.
  switch (stat) {
    case "cr":
      score = value * 2 * w;
      break;
    case "cd":
      score = value * w;
      break;
    case "em":
      score = value * 0.3333 * w;
      break;
    case "er":
      score = value * 1.1991 * w;
      break;
    case "atk%":
      score = value * 1.3328 * w;
      break;
    case "hp%":
      score = value * 1.3328 * w;
      break;
    case "def%":
      score = value * 1.0658 * w;
      break;
    case "atk":
      // Flat stat weight is pre-scaled by globalConfig in buildToWeightMap
      score = value * 0.3995 * w;
      break;
    case "hp":
      score = value * 0.026 * w;
      break;
    case "def":
      score = value * 0.3356 * w;
      break;
    default:
      score = 0;
  }

  return { score, weight: effectiveWeight };
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
function getEffectiveMainStats(slot: MainStatSlot, build: Build): MainStat[] {
  const stats = build[slot];
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
  // Flat stats inherit weight from their % counterpart, pre-scaled by
  // globalConfig effectiveness so the scoring formula doesn't need special
  // flat-stat handling. Without globalConfig, inherits at full weight
  // (suitable for non-scoring uses like fingerprinting).
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
  globalConfig: GlobalStatWeights
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

      // Compute roll count for stats with positive weight (average roll = 0.85 × max)
      if ((weights[stat] ?? 0) > 0) {
        const maxRoll =
          maxSubstatRolls[rarity as keyof typeof maxSubstatRolls]?.[stat];
        if (maxRoll) {
          const count = val / (AVERAGE_ROLL_MULTIPLIER * maxRoll);
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
 * Compute ideal score for V1 normalization.
 * Main stats: 3 slots × CD-equiv at 100% weight (simplified — V2 will add per-stat weights).
 * Substats: [22, 10, 5, 5] ideal rolls across top 4 weighted stats.
 */
function computeIdealScoreV1(weights: StatWeightMap): number {
  // Main stat ideal: all 3 main stat slots contribute at full weight
  const mainStatIdeal = 3 * MAIN_STAT_CD_EQUIV_5STAR;

  // Substat ideal: top 4 weights get ideal roll distribution
  const sortedWeights = Object.entries(weights)
    .filter(([, w]) => (w ?? 0) > 0)
    .map(([, w]) => w ?? 0)
    .sort((a, b) => b - a)
    .slice(0, 4);

  let substatIdeal = 0;
  for (let i = 0; i < Math.min(sortedWeights.length, 4); i++) {
    substatIdeal +=
      IDEAL_ROLL_DISTRIBUTION[i] * AVG_ROLL_CD_EQUIV * (sortedWeights[i] / 100);
  }

  return mainStatIdeal + substatIdeal;
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
  globalConfig: GlobalStatWeights
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
    globalConfig
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
