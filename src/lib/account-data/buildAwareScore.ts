import { artifactIdToHalfSetId } from "@/data/constants";
import type {
  ArtifactData,
  Build,
  CharacterData,
  GlobalStatWeights,
  MainStat,
  MainStatSlot,
  Slot,
  StatWeightMap,
  SubStat,
} from "@/data/types";
import {
  type ArtifactScoreResult,
  calculateAttributeScore,
  calculateMaxSlotSubScore,
  getFixedMainStatValue,
} from "./artifactScore";

// ----------------------------------------------------------------------------
// Types
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

// ----------------------------------------------------------------------------
// Build Matching
// ----------------------------------------------------------------------------

const MAIN_STAT_SLOTS: MainStatSlot[] = ["sands", "goblet", "circlet"];
const ALL_SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

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

type ScoredBuild = {
  build: Build;
  index: number;
  setMatched: boolean;
  mainStatScore: number;
  mainStatMismatches: MainStatMismatch[];
  consSatisfied: number; // effective minCons (0 if not specified), -1 if unsatisfied
};

/**
 * Score and rank a list of builds against equipped artifacts and constellation.
 *
 * Priority: set match > main stat score > highest satisfied constellation.
 * Ties at all levels are broken by build order (lower index = higher priority).
 */
function rankCandidates(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  candidates: Build[],
  constellation: number
): ScoredBuild | null {
  if (candidates.length === 0) return null;

  const scored: ScoredBuild[] = candidates.map((build, index) => {
    const setMatched = isSetMatched(artifacts, build);
    const { score, mismatches } = scoreMainStats(artifacts, build);
    const minCons = build.minCons ?? 0;
    return {
      build,
      index,
      setMatched,
      mainStatScore: score,
      mainStatMismatches: mismatches,
      consSatisfied: minCons <= constellation ? minCons : -1,
    };
  });

  // Stable sort: setMatched desc → mainStatScore desc → consSatisfied desc
  // Since sort is stable, original order is preserved for ties.
  scored.sort((a, b) => {
    const setDiff = Number(b.setMatched) - Number(a.setMatched);
    if (setDiff !== 0) return setDiff;
    const mainDiff = b.mainStatScore - a.mainStatScore;
    if (mainDiff !== 0) return mainDiff;
    return b.consSatisfied - a.consSatisfied;
  });

  return scored[0];
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
  // Prioritize builds based on match quality:
  // 1. Set Match (desc)
  // 2. Main Stat Match Count (desc)
  // 3. Visibility (Visible > Hidden) (desc)
  // 4. Constellation Satisfied (Satisfied > Unsatisfied) (desc)
  // 5. Original Index (asc)

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
// Weight Derivation
// ----------------------------------------------------------------------------

/** Convert a Build's WeightedSubStat[] to the StatWeightMap used by scoring. */
export function buildToWeightMap(build: Build): StatWeightMap {
  const map: StatWeightMap = {};
  for (const { stat, weight } of build.substats) {
    map[stat] = weight;
  }
  return map;
}

// ----------------------------------------------------------------------------
// Scoring
// ----------------------------------------------------------------------------

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

  // Pre-populate statScores for all potential stats
  const allStats: (MainStat | SubStat)[] = [
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

  for (const key of allStats) {
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

  const slots: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];
  let equippedCount = 0;

  for (const slot of slots) {
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

    // Main stat uses max value based on rarity (same as original)
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
  return result;
}
