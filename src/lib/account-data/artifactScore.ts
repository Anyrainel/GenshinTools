import {
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

export type BuildMatchResult = {
  build: Build;
  buildIndex: number;
  statWeights: StatWeightMap;
  setMatched: boolean;
  mainStatMatches: number; // 0-3
  mainStatMismatches: MainStatMismatch[];
};

export interface ArtifactScoreResult {
  substatScore: SubstatScoreResult;
  buildMatch: BuildMatchResult | null;
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
  let effectiveWeight = rawWeight;

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
      // Global flat effectiveness * specific weight
      score = value * 0.3995 * (globalConfig.flatAtk / 100) * w;
      effectiveWeight = rawWeight * (globalConfig.flatAtk / 100);
      break;
    case "hp":
      score = value * 0.026 * (globalConfig.flatHp / 100) * w;
      effectiveWeight = rawWeight * (globalConfig.flatHp / 100);
      break;
    case "def":
      score = value * 0.3356 * (globalConfig.flatDef / 100) * w;
      effectiveWeight = rawWeight * (globalConfig.flatDef / 100);
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
  globalConfig: GlobalStatWeights
): number {
  const value = getFixedMainStatValue(mainStat, rarity);
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

function matchMainStats(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: Build
): { match: number; mismatches: MainStatMismatch[] } {
  let match = 0;
  const mismatches: MainStatMismatch[] = [];
  for (const slot of mainStatSlots) {
    const artifact = artifacts[slot];
    if (!artifact) continue;
    if (
      build[slot].length === 0 ||
      build[slot].includes(artifact.mainStatKey)
    ) {
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
  constellation: number
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
    statWeights: buildToWeightMap(winner.build),
    setMatched: winner.setMatched,
    mainStatMatches: winner.mainStatMatches,
    mainStatMismatches: winner.mainStatMismatches,
  };
}

export function buildToWeightMap(build: Build): StatWeightMap {
  const map: StatWeightMap = {};
  for (const { stat, weight } of build.substats) {
    map[stat] = weight;
  }
  return map;
}

export function getTargetMainStatsForSlot(
  slot: Slot,
  build: Build,
  equippedForSlot?: ArtifactData | null
): Set<string> {
  if (slot === "flower") return new Set(["hp"]);
  if (slot === "plume") return new Set(["atk"]);
  const weights = buildToWeightMap(build);
  if (mainStatSlots.includes(slot as MainStatSlot)) {
    const recommended = build[slot as MainStatSlot];
    if (recommended?.length > 0) return new Set(recommended);
  }
  if (
    equippedForSlot &&
    (weights[equippedForSlot.mainStatKey as SubStat] ?? 0) > 0
  )
    return new Set([equippedForSlot.mainStatKey]);
  const fallback = new Set<string>();
  for (const [stat, w] of Object.entries(weights)) {
    if (w > 40 && !stat.includes("flat")) fallback.add(stat);
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

    for (const [key, val] of Object.entries(artifact.substats ?? {})) {
      const stat = key as SubStat;
      const { score } = calculateStatScore(stat, val, weights, globalConfig);
      slotSub += score;
      subScore += score;
      statScores[stat].subValue += val;
      statScores[stat].subScore += score;

      // Compute roll count for stats with positive weight
      if ((weights[stat] ?? 0) > 0) {
        const maxRoll =
          maxSubstatRolls[rarity as keyof typeof maxSubstatRolls]?.[stat];
        if (maxRoll) {
          const count = val / (0.85 * maxRoll);
          statScores[stat].subCount += count;
          statCount += count;
        }
      }
    }

    slotSubScores[slot] = slotSub;
    slotMaxSubScores[slot] =
      artifact.rarity === 5 || artifact.rarity === 4
        ? calculateMaxSlotSubScore(
            artifact.mainStatKey,
            weights,
            artifact.rarity
          )
        : 0;
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

export function scoreWithBuilds(
  char: CharacterData,
  builds: Build[],
  globalConfig: GlobalStatWeights
): ArtifactScoreResult {
  const buildMatch = matchBuild(char.artifacts, builds, char.constellation);
  const substatScore = scoreAllSlots(
    char,
    buildMatch?.statWeights ?? FALLBACK_WEIGHTS,
    globalConfig
  );
  return { substatScore, buildMatch };
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

/** Check if the equipped artifacts satisfy a build's artifact set requirement. */
function isSetMatched(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: Build
): boolean {
  if (build.composition === "4pc" && build.artifactSet) {
    return countSetPieces(artifacts, build.artifactSet) >= 4;
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
    return (
      (halfSetCounts.get(build.halfSet1) ?? 0) >= 2 &&
      (halfSetCounts.get(build.halfSet2) ?? 0) >= 2
    );
  }

  return false;
}
