import {
  CharacterData,
  MainStat,
  SubStat,
  Slot,
  ArtifactScoreConfig,
  StatWeightMap,
  GlobalStatWeights,
} from "@/data/types";

// ----------------------------------------------------------------------------
// 1. Constants & Helpers
// ----------------------------------------------------------------------------

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

function getFixedMainStatValue(key: MainStat, rarity: number): number {
  const is4Star = rarity === 4;
  const maxValues = is4Star ? MAIN_STAT_VALUES_4STAR : MAIN_STAT_VALUES_5STAR;
  return maxValues[key] || 0;
}

// ----------------------------------------------------------------------------
// 2. Calculation
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
  statScores: Record<string, StatScoreBreakdown>;
  isComplete: boolean;
}

/**
 * Calculates the score for a single attribute.
 * Returns { score, weight }
 */
function calculateAttributeScore(
  stat: MainStat | SubStat,
  value: number,
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights,
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

export function calculateArtifactScore(
  char: CharacterData,
  config: ArtifactScoreConfig,
): ArtifactScoreResult {
  const weights = config.characters[char.key] || {};
  const globalConfig = config.global;

  const result: ArtifactScoreResult = {
    mainScore: 0,
    subScore: 0,
    slotMainScores: {},
    slotSubScores: {},
    statScores: {},
    isComplete: false,
  };

  // Pre-populate statScores with all potential substats (and main stats for weights)
  const potentialSubstats: (MainStat | SubStat)[] = [
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

  potentialSubstats.forEach((key) => {
    const { weight } = calculateAttributeScore(
      key as SubStat,
      0,
      weights,
      globalConfig,
    );
    result.statScores[key] = {
      mainValue: 0,
      subValue: 0,
      mainScore: 0,
      subScore: 0,
      weight,
    };
  });

  const slots: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];
  let equippedCount = 0;

  slots.forEach((slot) => {
    const artifact = char.artifacts?.[slot];
    if (!artifact) {
      result.slotMainScores[slot] = 0;
      result.slotSubScores[slot] = 0;
      return;
    }

    equippedCount++;
    let slotMain = 0;
    let slotSub = 0;

    // Helper to accumulate stat scores
    const accumulate = (key: string, val: number, isMain: boolean) => {
      const { score, weight } = calculateAttributeScore(
        key as MainStat | SubStat,
        val,
        weights,
        globalConfig,
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

      if (isMain) {
        result.statScores[key].mainValue += val;
        result.statScores[key].mainScore += score;
      } else {
        result.statScores[key].subValue += val;
        result.statScores[key].subScore += score;
      }

      // Weight is constant per stat key for a character, just set it
      result.statScores[key].weight = weight;
      return score;
    };

    // 1. Main Stat - Use MAX Value based on rarity
    const mainStatVal = getFixedMainStatValue(
      artifact.mainStatKey,
      artifact.rarity,
    );
    accumulate(artifact.mainStatKey, mainStatVal, true);

    // 2. Substats
    if (artifact.substats) {
      Object.entries(artifact.substats).forEach(([key, val]) => {
        accumulate(key, val, false);
      });
    }

    result.slotMainScores[slot] = slotMain;
    result.slotSubScores[slot] = slotSub;
  });

  result.isComplete = equippedCount === 5;
  return result;
}
