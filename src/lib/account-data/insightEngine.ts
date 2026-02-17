import { maxSubstatRolls, statPools } from "@/data/constants";
import {
  type AccountData,
  type ArtifactData,
  type ArtifactScoreConfig,
  type CharacterData,
  type GlobalStatWeights,
  LUCK_MULTIPLIERS,
  type MainStat,
  type Rarity,
  type Slot,
  type StatWeightMap,
  type SubStat,
  type TierAssignment,
  type TierCustomization,
} from "@/data/types";
import {
  calculateArtifactScore,
  calculateMaxSlotSubScore,
} from "./artifactScore";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type InsightType =
  | "SWAP" // Better artifact found (Inventory or Steal)
  | "UPGRADE" // Invest resources (Current or Inventory)
  | "REROLL" // Perfect base artifact (Reroll / Elixir candidate)
  | "FARM" // Weakest slot, suggest farming
  | "FIX_MAIN"; // Critical fix: wrong main stat

export interface Insight {
  type: InsightType;
  characterId: string;
  slot: Slot;

  // The artifact to use
  artifact?: ArtifactData;
  // The artifact being replaced
  compareArtifact?: ArtifactData;

  // Metrics
  scoreDiff?: number; // Gain
  maxPotentialScore?: number; // Max possible score for this slot (for efficiency calculation)
  efficiencyDiff?: number; // scoreDiff / maxPotentialScore (0-1)

  // For FIX_MAIN: suggested main stats ranked by weight
  // TODO: Improve stat selection logic (e.g., balance CR/CD, consider slot constraints)
  suggestedMainStats?: MainStat[];

  // Source identification
  isSteal?: boolean; // If true, source is from another character
  isEquipped?: boolean; // If true, artifact is currently equipped by target character
  donorCharacterId?: string; // Who we are stealing from
}

export interface CharacterInsights {
  characterId: string;
  insights: Insight[];
  totalPotentialGain: number;
}

// ----------------------------------------------------------------------------
// Constants: Thresholds and Magic Numbers
// ----------------------------------------------------------------------------

// Default expected roll value multiplier (can be overridden per tier)
const DEFAULT_LUCK_MULTIPLIER = 0.85;

// Score thresholds for each insight type
const SWAP_THRESHOLD = 1.0;
const UPGRADE_THRESHOLD = 3.0;
const REROLL_THRESHOLD = 5.0;
const FARM_THRESHOLD = 5.0;

// Max levels by rarity
const MAX_LEVEL_BY_RARITY: Record<Rarity, number> = {
  5: 20,
  4: 16,
  3: 12,
  2: 8,
  1: 4,
};

// ----------------------------------------------------------------------------
// Helper: Get Max Roll Value for a Stat
// ----------------------------------------------------------------------------

function getMaxRollValue(stat: SubStat, rarity: Rarity): number {
  const rarityRolls = maxSubstatRolls[rarity as 4 | 5];
  if (!rarityRolls)
    return maxSubstatRolls[5][stat as keyof (typeof maxSubstatRolls)[5]] ?? 0;
  return rarityRolls[stat as keyof typeof rarityRolls] ?? 0;
}

function getExpectedRollValue(
  stat: SubStat,
  rarity: Rarity,
  luckMultiplier: number = DEFAULT_LUCK_MULTIPLIER
): number {
  return getMaxRollValue(stat, rarity) * luckMultiplier;
}

// ----------------------------------------------------------------------------
// Helper: Score Calculation
// ----------------------------------------------------------------------------

function getArtifactScore(
  artifact: ArtifactData,
  weights: StatWeightMap,
  config: ArtifactScoreConfig
): number {
  const mockChar: CharacterData = {
    key: "mock",
    constellation: 0,
    level: 90,
    talent: { auto: 1, skill: 1, burst: 1 },
    artifacts: {
      [artifact.slotKey]: artifact,
    },
  };
  const mockConfig: ArtifactScoreConfig = {
    global: config.global,
    characters: { mock: weights },
  };
  const result = calculateArtifactScore(mockChar, mockConfig);
  return (
    result.slotSubScores[artifact.slotKey] +
    result.slotMainScores[artifact.slotKey]
  );
}

// ----------------------------------------------------------------------------
// Helper: Stat Score Calculation (for projection)
// Uses same formula as artifactScore.ts
// ----------------------------------------------------------------------------

function calcStatScore(
  value: number,
  stat: SubStat,
  weights: StatWeightMap,
  globalConfig: GlobalStatWeights
): number {
  const w = (weights[stat] || 0) / 100;
  if (w === 0) return 0;

  switch (stat) {
    case "cr":
      return value * 2 * w;
    case "cd":
      return value * w;
    case "em":
      return value * 0.3333 * w;
    case "er":
      return value * 1.1991 * w;
    case "atk%":
    case "hp%":
      return value * 1.3328 * w;
    case "def%":
      return value * 1.0658 * w;
    case "atk":
      return value * 0.3995 * (globalConfig.flatAtk / 100) * w;
    case "hp":
      return value * 0.026 * (globalConfig.flatHp / 100) * w;
    case "def":
      return value * 0.3356 * (globalConfig.flatDef / 100) * w;
    default:
      return 0;
  }
}

// ----------------------------------------------------------------------------
// Helper: Get All Substats (including unactivated)
// ----------------------------------------------------------------------------

function getAllSubstats(artifact: ArtifactData): SubStat[] {
  const substats = Object.keys(artifact.substats || {}) as SubStat[];
  const unactivated = Object.keys(
    artifact.unactivatedSubstats || {}
  ) as SubStat[];

  // Combine, avoiding duplicates
  const all = new Set([...substats, ...unactivated]);
  return Array.from(all);
}

// ----------------------------------------------------------------------------
// Helper: Potential / Projection
// ----------------------------------------------------------------------------

function getProjectedScore(
  artifact: ArtifactData,
  weights: StatWeightMap,
  config: ArtifactScoreConfig,
  luckMultiplier: number = DEFAULT_LUCK_MULTIPLIER
): number {
  const currentScore = getArtifactScore(artifact, weights, config);
  const maxLevel = MAX_LEVEL_BY_RARITY[artifact.rarity] || 20;

  if (artifact.level >= maxLevel) return currentScore;

  // Get current activated substats and unactivated (4th stat for 3-liners)
  const activatedSubstats = Object.keys(artifact.substats || {}) as SubStat[];
  const unactivatedSubstats = Object.keys(
    artifact.unactivatedSubstats || {}
  ) as SubStat[];

  const has3Lines =
    activatedSubstats.length === 3 && unactivatedSubstats.length > 0;

  // Count remaining rolls (every 4 levels starting from current level)
  // Remaining rolls = total possible rolls - rolls already received
  // Rolls occur at levels 4, 8, 12, 16, 20 (every 4 levels)
  // Total possible rolls = maxLevel / 4
  // Rolls already received = floor(currentLevel / 4)
  const totalPossibleRolls = maxLevel / 4;
  const rollsReceived = Math.floor(artifact.level / 4);

  // For 3-line artifacts below Lv.4, the first "roll" at Lv.4 unlocks the 4th stat
  const has4thStatUnlock = has3Lines && artifact.level < 4;
  const remainingRolls =
    totalPossibleRolls - rollsReceived - (has4thStatUnlock ? 1 : 0);

  if (remainingRolls === 0 && !has4thStatUnlock) return currentScore;

  // Build list of all 4 stats
  const allSubstats = getAllSubstats(artifact);

  // Calculate weights for each stat
  const weightedStats = allSubstats.map((stat) => ({
    stat,
    weight: (weights[stat] || 0) / 100,
    isUnactivated: unactivatedSubstats.includes(stat),
  }));

  // If less than 4 stats known, treat unknown as weight 0
  while (weightedStats.length < 4) {
    weightedStats.push({
      stat: "hp" as SubStat,
      weight: 0,
      isUnactivated: true,
    });
  }

  // Sort by weight to identify top stats
  weightedStats.sort((a, b) => b.weight - a.weight);

  let expectedGain = 0;

  // If 4th stat is being unlocked, add its initial value contribution
  if (has4thStatUnlock) {
    const unactivatedStat = weightedStats.find((s) => s.isUnactivated);
    if (unactivatedStat) {
      const expectedValue = getExpectedRollValue(
        unactivatedStat.stat,
        artifact.rarity,
        luckMultiplier
      );
      expectedGain += calcStatScore(
        expectedValue,
        unactivatedStat.stat,
        weights,
        config.global
      );
    }
  }

  // Calculate expected gain from remaining rolls (distributed among all 4 stats)
  // For 5+ rolls, use favorable distribution: 1.5 to top 2, 1 to bottom 2
  // For 4 or less rolls, use average distribution
  if (remainingRolls > 0) {
    if (remainingRolls >= 5) {
      // Favorable distribution: top 2 get 1.5 rolls each, bottom 2 get 1 roll each
      // This totals to 5 rolls, then remaining rolls are distributed evenly
      const baseRolls = [1.5, 1.5, 1, 1];
      const extraRolls = remainingRolls - 5;
      const extraPerStat = extraRolls / 4;

      for (let i = 0; i < 4; i++) {
        const rollCount = baseRolls[i] + extraPerStat;
        const stat = weightedStats[i].stat;
        const expectedValue = getExpectedRollValue(
          stat,
          artifact.rarity,
          luckMultiplier
        );
        expectedGain += calcStatScore(
          rollCount * expectedValue,
          stat,
          weights,
          config.global
        );
      }
    } else {
      // Even distribution
      const rollsPerStat = remainingRolls / 4;
      for (let i = 0; i < 4; i++) {
        const stat = weightedStats[i].stat;
        const expectedValue = getExpectedRollValue(
          stat,
          artifact.rarity,
          luckMultiplier
        );
        expectedGain += calcStatScore(
          rollsPerStat * expectedValue,
          stat,
          weights,
          config.global
        );
      }
    }
  }

  return currentScore + expectedGain;
}

// ----------------------------------------------------------------------------
// Helper: Set Analysis (Safe Swap Check)
// ----------------------------------------------------------------------------

function checkSafeSwap(
  char: CharacterData,
  slot: Slot,
  newArtifact: ArtifactData
): boolean {
  const current = char.artifacts[slot];
  // If no artifact currently, swap is always safe (or rather, filling a hole)
  if (!current) return true;

  // 1. Same Set? Safe.
  if (current.setKey === newArtifact.setKey) return true;

  // 2. Off-piece swap?
  // Check if current is contributing to a set bonus.
  const counts: Record<string, number> = {};
  for (const a of Object.values(char.artifacts)) {
    if (a) counts[a.setKey] = (counts[a.setKey] || 0) + 1;
  }
  const currentSetCount = counts[current.setKey] || 0;

  // If current is "Off-piece" (count 1, or count > 4/2... e.g. 5pc -> 4pc is safe)
  // 5pc -> 4pc: Safe.
  // 3pc -> 2pc: Safe (user might only care about 2pc).
  // But usually:
  // 4pc -> 3pc: UNSAFE.
  // 2pc -> 1pc: UNSAFE.

  if (currentSetCount === 5 || currentSetCount === 3) return true;
  if (currentSetCount === 1) return true; // Was already off-piece

  return false; // Breaks 4pc or 2pc
}

// ----------------------------------------------------------------------------
// Helper: Calculate FARM Expected Score
// ----------------------------------------------------------------------------

function calculateFarmExpectedScore(
  slot: Slot,
  mainStat: MainStat,
  weights: StatWeightMap,
  config: ArtifactScoreConfig,
  rarity: Rarity = 5,
  luckMultiplier: number = DEFAULT_LUCK_MULTIPLIER
): number {
  // Assume artifact starts with 4 lines (best case scenario for farming)
  // Top 4 weighted substats (excluding main stat if it overlaps)
  const pool = statPools.substat.filter((s) => s !== mainStat) as SubStat[];

  // Get weights for each stat
  const weightedStats = pool
    .map((stat) => ({
      stat,
      weight: (weights[stat] || 0) / 100,
    }))
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  // If not enough weighted stats, pad with zeros
  while (weightedStats.length < 4) {
    weightedStats.push({ stat: "hp" as SubStat, weight: 0 });
  }

  // Calculate expected score:
  // - 4 initial rolls (one per stat)
  // - 5 upgrade rolls distributed: 1.5 to top 2, 1 to bottom 2
  // Each roll at 0.85x max value

  let expectedScore = 0;

  // Initial rolls (1 per stat) + upgrade distribution
  const rollDistribution = [
    1 + 1.5, // top stat: 1 initial + 1.5 upgrades = 2.5
    1 + 1.5, // 2nd stat: 1 initial + 1.5 upgrades = 2.5
    1 + 1, // 3rd stat: 1 initial + 1 upgrade = 2
    1 + 1, // 4th stat: 1 initial + 1 upgrade = 2
  ];

  for (let i = 0; i < 4; i++) {
    const { stat } = weightedStats[i];
    const expectedValue = getExpectedRollValue(stat, rarity, luckMultiplier);
    const totalValue = rollDistribution[i] * expectedValue;
    expectedScore += calcStatScore(totalValue, stat, weights, config.global);
  }

  return expectedScore;
}

// ----------------------------------------------------------------------------
// Helper: Calculate REROLL Expected Score
// ----------------------------------------------------------------------------

function calculateRerollExpectedScore(
  artifact: ArtifactData,
  weights: StatWeightMap,
  config: ArtifactScoreConfig,
  luckMultiplier: number = DEFAULT_LUCK_MULTIPLIER
): number {
  const allSubstats = getAllSubstats(artifact);
  if (allSubstats.length < 4) return 0;

  // Get weights and sort
  const weightedStats = allSubstats.map((stat) => ({
    stat,
    weight: (weights[stat] || 0) / 100,
    initialValue: artifact.initialValues?.[stat],
  }));
  weightedStats.sort((a, b) => b.weight - a.weight);

  const totalRolls = artifact.totalRolls ?? 8;
  const rarity = artifact.rarity;

  let expectedScore = 0;

  // Get initial value or fallback to expected
  const getInitialValue = (stat: SubStat): number => {
    if (artifact.initialValues?.[stat]) {
      return artifact.initialValues[stat];
    }
    return getExpectedRollValue(stat, rarity, luckMultiplier);
  };

  if (totalRolls === 8) {
    // Started with 3 lines (4th unlocked at +4)
    // Each of 4 stats gets: initialValue + 1 upgrade roll
    for (const { stat } of weightedStats.slice(0, 4)) {
      const initial = getInitialValue(stat);
      const upgrade = getExpectedRollValue(stat, rarity, luckMultiplier);
      expectedScore += calcStatScore(
        initial + upgrade,
        stat,
        weights,
        config.global
      );
    }
  } else {
    // Started with 4 lines (totalRolls = 9)
    // Top 2: initialValue + 1.5 upgrades
    // Bottom 2: initialValue + 1 upgrade
    for (let i = 0; i < 2; i++) {
      const { stat } = weightedStats[i];
      const initial = getInitialValue(stat);
      const upgrade = 1.5 * getExpectedRollValue(stat, rarity, luckMultiplier);
      expectedScore += calcStatScore(
        initial + upgrade,
        stat,
        weights,
        config.global
      );
    }
    for (let i = 2; i < 4; i++) {
      const { stat } = weightedStats[i];
      const initial = getInitialValue(stat);
      const upgrade = getExpectedRollValue(stat, rarity, luckMultiplier);
      expectedScore += calcStatScore(
        initial + upgrade,
        stat,
        weights,
        config.global
      );
    }
  }

  return expectedScore;
}

// ----------------------------------------------------------------------------
// Strategy Implementations
// ----------------------------------------------------------------------------

export function generateCharacterInsights(
  char: CharacterData,
  allArtifacts: (ArtifactData & { location?: string })[],
  scoreConfig: ArtifactScoreConfig,
  tierAssignments: TierAssignment,
  luckMultiplier: number = DEFAULT_LUCK_MULTIPLIER
): CharacterInsights {
  const insights: Insight[] = [];
  const weights = scoreConfig.characters[char.key];
  if (!weights)
    return { characterId: char.key, insights: [], totalPotentialGain: 0 };

  const slots: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

  for (const slot of slots) {
    const equipped = char.artifacts[slot];
    const currentScore = equipped
      ? getArtifactScore(equipped, weights, scoreConfig)
      : 0;

    const maxLevel = equipped ? MAX_LEVEL_BY_RARITY[equipped.rarity] || 20 : 20;

    const isMaxLevel = equipped?.level === maxLevel;

    // Calculate max potential score for efficiency % calculation
    // Uses the equipped artifact's main stat, or a default for the slot
    const mainStatForCalc: MainStat =
      equipped?.mainStatKey ??
      (slot === "flower" ? "hp" : slot === "plume" ? "atk" : "atk%");
    const rarityForCalc = equipped?.rarity ?? 5;
    const maxPotentialScore = calculateMaxSlotSubScore(
      mainStatForCalc,
      weights,
      rarityForCalc
    );

    // Track best insights per type
    let bestSwap: Insight | null = null;
    let bestUpgrade: Insight | null = null;
    let rerollInsight: Insight | null = null;
    let farmInsight: Insight | null = null;

    // Record best score diff found so far (for cascading priority)
    let bestScoreSoFar = 0;

    // --- Target Main Stats ---
    const targetMainStats = new Set<string>();
    if (equipped && weights[equipped.mainStatKey] > 0) {
      targetMainStats.add(equipped.mainStatKey);
    } else {
      if (slot === "flower") targetMainStats.add("hp");
      else if (slot === "plume") targetMainStats.add("atk");
      else {
        for (const [s, w] of Object.entries(weights)) {
          if (w > 40 && !s.includes("flat")) targetMainStats.add(s);
        }
      }
    }

    // --- 1. SWAP Strategy ---
    // First check safe swaps, then unsafe swaps
    // Performance optimization: filter by safety first

    const candidates = allArtifacts.filter((a) => {
      if (a.slotKey !== slot) return false;
      if (!targetMainStats.has(a.mainStatKey)) return false;
      if (a.id === equipped?.id) return false;

      // Location Check
      if (!a.location) return true; // Inventory

      // Steal Check - only from Pool tier
      const ownerTier = tierAssignments[a.location]?.tier;
      return ownerTier === "Pool";
    });

    for (const cand of candidates) {
      const isSafe = checkSafeSwap(char, slot, cand);

      // Skip unsafe swaps if current artifact is contributing to set bonus
      if (!isSafe && equipped) {
        // Only consider same-set candidates for unsafe scenarios
        if (cand.setKey !== equipped.setKey) continue;
      }

      const candScore = getArtifactScore(cand, weights, scoreConfig);
      const candMaxLevel = MAX_LEVEL_BY_RARITY[cand.rarity] || 20;
      const isCandMaxLevel = cand.level === candMaxLevel;

      // SWAP: Compare max-level artifacts
      if (isCandMaxLevel && candScore > currentScore + SWAP_THRESHOLD) {
        const diff = candScore - currentScore;
        if (!bestSwap || diff > (bestSwap.scoreDiff || 0)) {
          bestSwap = {
            type: "SWAP",
            characterId: char.key,
            slot,
            artifact: cand,
            compareArtifact: equipped,
            scoreDiff: diff,
            maxPotentialScore,
            efficiencyDiff:
              maxPotentialScore > 0 ? diff / maxPotentialScore : 0,
            isSteal: !!cand.location,
            donorCharacterId: cand.location,
          };
        }
      }

      // UPGRADE: Compare projected scores for non-max-level artifacts
      if (!isCandMaxLevel && isSafe) {
        const candProjected = getProjectedScore(
          cand,
          weights,
          scoreConfig,
          luckMultiplier
        );
        const currentProjected = equipped
          ? getProjectedScore(equipped, weights, scoreConfig, luckMultiplier)
          : 0;

        if (candProjected > currentProjected + UPGRADE_THRESHOLD) {
          const gain = candProjected - currentScore;
          if (!bestUpgrade || gain > (bestUpgrade.scoreDiff || 0)) {
            bestUpgrade = {
              type: "UPGRADE",
              characterId: char.key,
              slot,
              artifact: cand,
              compareArtifact: equipped,
              scoreDiff: gain,
              maxPotentialScore,
              efficiencyDiff:
                maxPotentialScore > 0 ? gain / maxPotentialScore : 0,
              isSteal: !!cand.location,
              isEquipped: false,
              donorCharacterId: cand.location,
            };
          }
        }
      }
    }

    // Also check equipped artifact for UPGRADE
    if (equipped && !isMaxLevel) {
      const currentProjected = getProjectedScore(
        equipped,
        weights,
        scoreConfig,
        luckMultiplier
      );
      const gain = currentProjected - currentScore;

      if (gain > UPGRADE_THRESHOLD) {
        if (!bestUpgrade || gain > (bestUpgrade.scoreDiff || 0)) {
          bestUpgrade = {
            type: "UPGRADE",
            characterId: char.key,
            slot,
            artifact: equipped,
            compareArtifact: equipped,
            scoreDiff: gain,
            maxPotentialScore,
            efficiencyDiff:
              maxPotentialScore > 0 ? gain / maxPotentialScore : 0,
            isEquipped: true,
          };
        }
      }
    }

    // --- 2. REROLL Strategy ---
    // Only for 5★ max-level artifacts with at least one bad substat
    if (equipped && isMaxLevel && equipped.rarity === 5) {
      const allSubs = getAllSubstats(equipped);

      if (allSubs.length >= 4) {
        const hasBadSubstat = allSubs.some((s) => (weights[s] || 0) === 0);

        if (hasBadSubstat) {
          const expectedScore = calculateRerollExpectedScore(
            equipped,
            weights,
            scoreConfig,
            luckMultiplier
          );

          // Calculate current substat score
          let currentSubScore = 0;
          for (const stat of allSubs) {
            const value = (equipped.substats?.[stat] || 0) as number;
            currentSubScore += calcStatScore(
              value,
              stat,
              weights,
              scoreConfig.global
            );
          }

          const scoreDiff = expectedScore - currentSubScore;

          if (scoreDiff > REROLL_THRESHOLD) {
            rerollInsight = {
              type: "REROLL",
              characterId: char.key,
              slot,
              artifact: equipped,
              isEquipped: true,
              scoreDiff,
              maxPotentialScore,
              efficiencyDiff:
                maxPotentialScore > 0 ? scoreDiff / maxPotentialScore : 0,
            };
          }
        }
      }
    }

    // --- 3. FARM Strategy ---
    // Calculate expected score from farming
    if (equipped) {
      const farmExpected = calculateFarmExpectedScore(
        slot,
        equipped.mainStatKey,
        weights,
        scoreConfig,
        equipped.rarity,
        luckMultiplier
      );

      const scoreDiff = farmExpected - currentScore;

      if (scoreDiff > FARM_THRESHOLD) {
        farmInsight = {
          type: "FARM",
          characterId: char.key,
          slot,
          artifact: equipped,
          scoreDiff,
          maxPotentialScore,
          efficiencyDiff:
            maxPotentialScore > 0 ? scoreDiff / maxPotentialScore : 0,
        };
      }
    }

    // --- Priority Selection ---
    // Order: SWAP > UPGRADE > REROLL > FARM
    // Only show lower priority if it provides higher score gain

    if (bestSwap) {
      insights.push(bestSwap);
      bestScoreSoFar = bestSwap.scoreDiff || 0;
    }

    if (bestUpgrade && (bestUpgrade.scoreDiff || 0) > bestScoreSoFar) {
      insights.push(bestUpgrade);
      bestScoreSoFar = bestUpgrade.scoreDiff || 0;
    }

    if (rerollInsight && (rerollInsight.scoreDiff || 0) > bestScoreSoFar) {
      insights.push(rerollInsight);
      bestScoreSoFar = rerollInsight.scoreDiff || 0;
    }

    if (farmInsight && (farmInsight.scoreDiff || 0) > bestScoreSoFar) {
      insights.push(farmInsight);
    }
  }

  return {
    characterId: char.key,
    insights: insights.sort((a, b) => (b.scoreDiff || 0) - (a.scoreDiff || 0)),
    totalPotentialGain: 0,
  };
}

export function generateAllInsights(
  accountData: AccountData,
  scoreConfig: ArtifactScoreConfig,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {}
): CharacterInsights[] {
  // Master list with location
  const allArtifacts: (ArtifactData & { location?: string })[] = [
    ...accountData.extraArtifacts.map((a) => ({ ...a, location: undefined })),
    ...accountData.characters.flatMap((c) =>
      Object.values(c.artifacts)
        .filter((a): a is ArtifactData => !!a)
        .map((a) => ({ ...a, location: c.key }))
    ),
  ];

  return accountData.characters.map((char) => {
    // Skip Pool characters
    const tier = tierAssignments[char.key]?.tier || "Pool";
    if (tier === "Pool") {
      return { characterId: char.key, insights: [], totalPotentialGain: 0 };
    }

    // Get luck multiplier from tier customization
    const luckExpectation =
      tierCustomization[tier]?.luckExpectation || "balanced";
    const luckMultiplier = LUCK_MULTIPLIERS[luckExpectation];

    return generateCharacterInsights(
      char,
      allArtifacts,
      scoreConfig,
      tierAssignments,
      luckMultiplier
    );
  });
}
