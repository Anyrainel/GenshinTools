import { artifactIdToHalfSetId, statPools } from "@/data/constants";
import type {
  ArtifactData,
  ArtifactScoreConfig,
  Build,
  CharacterData,
  GlobalStatWeights,
  MainStat,
  MainStatSlot,
  Slot,
  StatWeightMap,
  SubStat,
} from "@/data/types";

// ----------------------------------------------------------------------------
// 1. Constants & Helpers
// ----------------------------------------------------------------------------

const ALL_SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];
const MAIN_STAT_SLOTS: MainStatSlot[] = ["sands", "goblet", "circlet"];

// All stat keys that can appear as main or sub stats
const ALL_STATS: (MainStat | SubStat)[] = [
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
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
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

// ----------------------------------------------------------------------------
// 2. Attribute Scoring
// ----------------------------------------------------------------------------

export interface StatScoreBreakdown {
  mainValue: number;
  subValue: number;
  mainScore: number;
  subScore: number;
  weight: number;
}

export interface ArtifactScoreResult {
  mainScore: number;
  subScore: number;
  slotMainScores: Record<string, number>;
  slotSubScores: Record<string, number>;
  slotMaxSubScores: Record<string, number>;
  statScores: Record<string, StatScoreBreakdown>;
  isComplete: boolean;
}

/**
 * Calculates the score for a single attribute.
 * Returns { score, weight }
 */
export function calculateAttributeScore(
  stat: MainStat | SubStat,
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
    case "pyro%":
    case "hydro%":
    case "anemo%":
    case "electro%":
    case "dendro%":
    case "cryo%":
    case "geo%":
      score = value * 1.3348 * w;
      break;
    case "phys%":
      score = value * 1.0669 * w;
      break;
    case "heal%":
      score = value * 1.7326 * w;
      break;
    default:
      score = 0;
  }

  return { score, weight: effectiveWeight };
}

// Max CD roll value used as baseline for sub-score calculation
// 5-star: 7.77 (max CD roll), 4-star: 6.22 (max CD roll)
const MAX_CD_ROLL_5STAR = 7.77;
const MAX_CD_ROLL_4STAR = 6.22;

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

  // 5-star: 5-1-1-1 (8 rolls), 4-star: 3-1-1-1 (6 rolls)
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
// 3. Shared Scoring Loop
// ----------------------------------------------------------------------------

/**
 * Core scoring loop shared by both calculateArtifactScore and calculateBuildAwareScore.
 * Iterates over all artifact slots, accumulates main/sub stat scores, and populates
 * the result object.
 */
function scoreArtifactSlots(
  char: CharacterData,
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights,
  result: ArtifactScoreResult
): void {
  // Pre-populate statScores with zero-value entries for weight lookup
  for (const key of ALL_STATS) {
    const { weight } = calculateAttributeScore(
      key as SubStat,
      0,
      weights,
      globalConfig
    );
    result.statScores[key] = {
      mainValue: 0,
      subValue: 0,
      mainScore: 0,
      subScore: 0,
      weight,
    };
  }

  let equippedCount = 0;

  for (const slot of ALL_SLOTS) {
    const artifact = char.artifacts?.[slot];
    if (!artifact) {
      result.slotMainScores[slot] = 0;
      result.slotSubScores[slot] = 0;
      continue;
    }

    equippedCount++;
    let slotMain = 0;
    let slotSub = 0;

    const accumulate = (key: string, val: number, isMain: boolean) => {
      const { score, weight } = calculateAttributeScore(
        key as MainStat | SubStat,
        val,
        weights,
        globalConfig
      );

      if (isMain) {
        slotMain += score;
        result.mainScore += score;
      } else {
        slotSub += score;
        result.subScore += score;
      }

      if (!result.statScores[key]) {
        result.statScores[key] = {
          mainValue: 0,
          subValue: 0,
          mainScore: 0,
          subScore: 0,
          weight: 0,
        };
      }

      const entry = result.statScores[key];
      if (isMain) {
        entry.mainValue += val;
        entry.mainScore += score;
      } else {
        entry.subValue += val;
        entry.subScore += score;
      }
      entry.weight = weight;
    };

    // Main stat uses max value based on rarity
    const mainStatVal = getFixedMainStatValue(
      artifact.mainStatKey,
      artifact.rarity
    );
    accumulate(artifact.mainStatKey, mainStatVal, true);

    // Substats
    if (artifact.substats) {
      for (const [key, val] of Object.entries(artifact.substats)) {
        accumulate(key, val, false);
      }
    }

    result.slotMainScores[slot] = slotMain;
    result.slotSubScores[slot] = slotSub;

    if (artifact.rarity === 5 || artifact.rarity === 4) {
      result.slotMaxSubScores[slot] = calculateMaxSlotSubScore(
        artifact.mainStatKey,
        weights,
        artifact.rarity
      );
    } else {
      result.slotMaxSubScores[slot] = 0;
    }
  }

  result.isComplete = equippedCount === 5;
}

// ----------------------------------------------------------------------------
// 4. Config-Based Scoring (legacy / insight engine)
// ----------------------------------------------------------------------------

export function calculateArtifactScore(
  char: CharacterData,
  config: ArtifactScoreConfig
): ArtifactScoreResult {
  const weights = config.characters[char.key] || {};
  const globalConfig = config.global;

  const result: ArtifactScoreResult = {
    mainScore: 0,
    subScore: 0,
    slotMainScores: {},
    slotSubScores: {},
    slotMaxSubScores: {},
    statScores: {},
    isComplete: false,
  };

  scoreArtifactSlots(char, weights, globalConfig, result);
  return result;
}

// ----------------------------------------------------------------------------
// 5. Build Matching
// ----------------------------------------------------------------------------

export type MainStatMismatch = {
  slot: MainStatSlot;
  equipped: MainStat;
  recommended: MainStat[];
};

export type BuildMatchResult = {
  build: Build;
  buildIndex: number;
  setMatched: boolean;
  mainStatMatches: number; // 0-3
  mainStatMismatches: MainStatMismatch[];
};

export type BuildAwareScoreResult = ArtifactScoreResult & {
  matchedBuild: BuildMatchResult | null;
};

/** Count how many equipped artifacts belong to a given artifact set (string ID). */
function countSetPieces(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  setId: string
): number {
  let count = 0;
  for (const slot of ALL_SLOTS) {
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
    const halfSetCounts = new Map<number, number>();
    for (const slot of ALL_SLOTS) {
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

/** Score a build's main stat alignment with equipped artifacts (0-3). */
function scoreMainStats(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: Build
): { score: number; mismatches: MainStatMismatch[] } {
  let score = 0;
  const mismatches: MainStatMismatch[] = [];
  for (const slot of MAIN_STAT_SLOTS) {
    const artifact = artifacts[slot];
    if (!artifact) continue;
    if (build[slot].includes(artifact.mainStatKey)) {
      score++;
    } else {
      mismatches.push({
        slot,
        equipped: artifact.mainStatKey,
        recommended: build[slot],
      });
    }
  }
  return { score, mismatches };
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
    const { score: mainStatMatches, mismatches: mainStatMismatches } =
      scoreMainStats(artifacts, build);
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
    setMatched: winner.setMatched,
    mainStatMatches: winner.mainStatMatches,
    mainStatMismatches: winner.mainStatMismatches,
  };
}

// ----------------------------------------------------------------------------
// 6. Build-Aware Scoring
// ----------------------------------------------------------------------------

/** Convert a Build's WeightedSubStat[] to the StatWeightMap used by scoring. */
export function buildToWeightMap(build: Build): StatWeightMap {
  const map: StatWeightMap = {};
  for (const { stat, weight } of build.substats) {
    map[stat] = weight;
  }
  return map;
}

/**
 * Calculate artifact score using build data instead of static config.
 *
 * - Matches the character's artifacts to the best-fitting build (set → main stat → constellation)
 * - Derives stat weights from that build
 * - Flags main stat mismatches
 * - Falls back gracefully when no builds exist
 */
export function calculateBuildAwareScore(
  char: CharacterData,
  builds: Build[],
  globalConfig: GlobalStatWeights
): BuildAwareScoreResult {
  const matchResult = matchBuild(char.artifacts, builds, char.constellation);

  const weights = matchResult ? buildToWeightMap(matchResult.build) : {};

  const result: BuildAwareScoreResult = {
    mainScore: 0,
    subScore: 0,
    slotMainScores: {},
    slotSubScores: {},
    slotMaxSubScores: {},
    statScores: {},
    isComplete: false,
    matchedBuild: matchResult,
  };

  scoreArtifactSlots(char, weights, globalConfig, result);
  return result;
}
