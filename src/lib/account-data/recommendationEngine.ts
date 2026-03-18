/**
 * Diffs optimizer output against current equipment to produce typed recommendations.
 */
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  GlobalStatWeights,
  Slot,
  Tier,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import {
  type InvestmentThresholds,
  type LuckExpectation,
  allSlots,
} from "@/data/types";
import type {
  ArtifactScoreResult,
  BuildMatchResult,
  StatWeightMap,
} from "./artifactScore";
import {
  getTargetMainStatsForSlot,
  scoreSlotWithMainStat,
} from "./artifactScore";
import {
  type BuildOptimizerConfig,
  type BuildOptimizerResult,
  type OptimizedBuild,
  optimizeBuild,
  optimizeBuildWithCrCdExploration,
} from "./buildOptimizer";
import { type CandidateArtifact, buildCandidatePool } from "./candidatePool";
import { type CrBudgetResult, computeCrBudget } from "./crBudget";

// ─── Types ───

export type ActionType = "swap" | "upgrade" | "reroll" | "farm" | "equip";

export interface Recommendation {
  actionType: ActionType;
  characterId: string;
  slot: Slot;
  optimalArtifact: CandidateArtifact;
  currentArtifact: ArtifactData | null;
  slotScoreDiff: number;
  buildScoreDiff: number;
  maxPotentialScore: number;
  isSteal?: boolean;
  donorCharacterId?: string;
}

export interface CharacterRecommendations {
  characterId: string;
  recommendations: Recommendation[];
  optimizerResult: BuildOptimizerResult;
}

export interface AllRecommendations {
  byActionType: Record<ActionType, Recommendation[]>;
  perCharacter: Record<string, CharacterRecommendations>;
}

// ─── Recommendation Generation ───

function generateRecommendations(
  char: CharacterData,
  buildMatch: BuildMatchResult,
  optimizerResult: BuildOptimizerResult,
  globalConfig: GlobalStatWeights,
  targetMainStats: Record<Slot, Set<string>>
): CharacterRecommendations {
  const recommendations: Recommendation[] = [];

  if (optimizerResult.builds.length === 0) {
    return { characterId: char.key, recommendations, optimizerResult };
  }

  const topBuild = optimizerResult.builds[0];
  const buildScoreDiff = topBuild.finalScore - optimizerResult.currentScore;

  // Check each slot's artifact in the optimal build
  for (const slot of allSlots) {
    const optimal = topBuild.artifacts[slot];
    if (!optimal) continue;

    const current = char.artifacts[slot] ?? null;

    // If source is "current", no action needed (already optimal or will be after leveling)
    if (optimal.source === "current") {
      // But if the current isn't at max level, this is an upgrade-in-place
      if (current && optimal.sourceArtifactId === current.id) {
        const currentScore = scoreSlotWithMainStat(
          current,
          buildMatch.statWeights,
          globalConfig,
          targetMainStats[slot]
        );
        const optimalScore = topBuild.slotScores[slot];
        const diff = optimalScore - currentScore;
        if (diff > 1.0) {
          recommendations.push({
            actionType: "upgrade",
            characterId: char.key,
            slot,
            optimalArtifact: optimal,
            currentArtifact: current,
            slotScoreDiff: diff,
            buildScoreDiff,
            maxPotentialScore: optimalScore,
            isSteal: false,
          });
        }
      }
      continue;
    }

    const currentScore = current
      ? scoreSlotWithMainStat(
          current,
          buildMatch.statWeights,
          globalConfig,
          targetMainStats[slot]
        )
      : 0;
    const slotScoreDiff = topBuild.slotScores[slot] - currentScore;

    let actionType: ActionType;
    switch (optimal.source) {
      case "swap":
        actionType = current ? "swap" : "equip";
        break;
      case "upgrade":
        actionType = current ? "upgrade" : "equip";
        break;
      case "reroll":
        actionType = "reroll";
        break;
      case "farm":
        actionType = "farm";
        break;
      default:
        continue;
    }

    // Skip negligible improvements
    if (slotScoreDiff < 0.5) continue;

    recommendations.push({
      actionType,
      characterId: char.key,
      slot,
      optimalArtifact: optimal,
      currentArtifact: current,
      slotScoreDiff,
      buildScoreDiff,
      maxPotentialScore: topBuild.slotScores[slot],
      isSteal: !!optimal.donorCharacterId,
      donorCharacterId: optimal.donorCharacterId,
    });
  }

  // Sort by slotScoreDiff desc
  recommendations.sort((a, b) => b.slotScoreDiff - a.slotScoreDiff);

  return { characterId: char.key, recommendations, optimizerResult };
}

// ─── Two-Pass Constrained Optimization ───

/**
 * Run optimizer, then re-run with slots locked where the improvement doesn't
 * justify the action cost. This finds the best build the user would actually
 * want to execute, respecting their investment preference.
 *
 * Pass 1: unconstrained → find optimal build
 * Pass 2: lock slots where action cost exceeds threshold → re-optimize
 */
function optimizeWithInvestmentConstraints(
  baseConfig: BuildOptimizerConfig,
  char: { key: string; artifacts: Partial<Record<Slot, ArtifactData>> },
  buildMatch: BuildMatchResult,
  globalConfig: GlobalStatWeights,
  thresholds: { swap: number; upgrade: number; reroll: number; farm: number }
): BuildOptimizerResult {
  // Pass 1: unconstrained (with CR/CD exploration)
  const pass1 = optimizeBuildWithCrCdExploration(baseConfig);
  if (pass1.builds.length === 0) return pass1;

  const topBuild = pass1.builds[0];

  // Identify slots that need locking
  const slotsToLock: Slot[] = [];
  for (const slot of allSlots) {
    const optimal = topBuild.artifacts[slot];
    if (!optimal || optimal.source === "current") continue;

    const current = char.artifacts[slot];
    const currentScore = current
      ? scoreSlotWithMainStat(
          current,
          buildMatch.statWeights,
          globalConfig,
          baseConfig.targetMainStats[slot]
        )
      : 0;
    const slotDiff = topBuild.slotScores[slot] - currentScore;

    // Map source to action type for threshold lookup
    const source = optimal.source;
    let threshold: number;
    if (source === "swap") {
      // Check if it's actually equip (no current) — equip is always free
      if (!current) continue;
      threshold = thresholds.swap;
    } else if (source === "upgrade") {
      // Upgrade-in-place (same artifact) uses upgrade threshold
      // Upgrade from another artifact uses swap threshold (it's effectively a swap + upgrade)
      threshold =
        optimal.sourceArtifactId === current?.id
          ? thresholds.upgrade
          : thresholds.swap;
    } else if (source === "reroll") {
      threshold = thresholds.reroll;
    } else if (source === "farm") {
      threshold = thresholds.farm;
    } else {
      continue;
    }

    if (slotDiff < threshold) {
      slotsToLock.push(slot);
    }
  }

  // If no slots need locking, pass 1 result is already correct
  if (slotsToLock.length === 0) return pass1;

  // Pass 2: lock below-threshold slots to current-only candidates
  const constrainedCandidates = { ...baseConfig.candidates };
  for (const slot of slotsToLock) {
    const currentOnly = constrainedCandidates[slot].filter(
      (c) => c.source === "current"
    );
    // If no current candidate (empty slot), keep all candidates
    if (currentOnly.length > 0) {
      constrainedCandidates[slot] = currentOnly;
    }
  }

  return optimizeBuildWithCrCdExploration({
    ...baseConfig,
    candidates: constrainedCandidates,
  });
}

// ─── Public API ───

export function generateAllRecommendations(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult | null>,
  globalConfig: GlobalStatWeights,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {},
  investmentThresholds?: InvestmentThresholds
): AllRecommendations {
  const byActionType: Record<ActionType, Recommendation[]> = {
    swap: [],
    upgrade: [],
    reroll: [],
    farm: [],
    equip: [],
  };
  const perCharacter: Record<string, CharacterRecommendations> = {};

  // Collect all artifacts for candidate pool
  const allArtifacts: (ArtifactData & { location?: string })[] = [
    ...accountData.extraArtifacts.map((a) => ({ ...a, location: undefined })),
    ...accountData.characters.flatMap((c) =>
      Object.values(c.artifacts)
        .filter((a): a is ArtifactData => !!a)
        .map((a) => ({ ...a, location: c.key }))
    ),
  ];

  for (const char of accountData.characters) {
    const tier: Tier = tierAssignments[char.key]?.tier || "Pool";
    if (tier === "Pool") {
      perCharacter[char.key] = {
        characterId: char.key,
        recommendations: [],
        optimizerResult: {
          builds: [],
          currentScore: 0,
          combinationsEvaluated: 0,
        },
      };
      continue;
    }

    const scoreResult = scores[char.key];
    const buildMatch = scoreResult?.buildMatch;
    if (!buildMatch) {
      perCharacter[char.key] = {
        characterId: char.key,
        recommendations: [],
        optimizerResult: {
          builds: [],
          currentScore: 0,
          combinationsEvaluated: 0,
        },
      };
      continue;
    }

    const luckExpectation: LuckExpectation =
      tierCustomization[tier]?.luckExpectation || "balanced";

    // Phase 1: CR Budget
    let crBudget: CrBudgetResult;
    try {
      crBudget = computeCrBudget(char, buildMatch);
    } catch {
      crBudget = {
        baseCr: 0.05,
        ascensionCr: 0,
        weaponSecondaryCr: 0,
        weaponPassiveCr: 0,
        artifactSetCr: 0,
        totalNonArtifactCr: 0.05,
      };
    }

    // Phase 2: Candidate Pool
    const candidates = buildCandidatePool(
      char,
      buildMatch,
      allArtifacts,
      tierAssignments,
      luckExpectation,
      tier
    );

    // Phase 3: Optimize (two-pass with investment constraints)
    const build = buildMatch.build;

    // Build target main stats per slot for main stat scoring
    const targetMainStats = {} as Record<Slot, Set<string>>;
    for (const slot of allSlots) {
      targetMainStats[slot] = getTargetMainStatsForSlot(
        slot,
        build,
        char.artifacts[slot] ?? undefined
      );
    }

    const baseConfig: BuildOptimizerConfig = {
      weights: buildMatch.statWeights,
      globalConfig,
      candidates,
      crBudget,
      targetMainStats,
      setConstraint: {
        composition: build.composition,
        artifactSet: build.artifactSet,
        halfSet1: build.halfSet1,
        halfSet2: build.halfSet2,
      },
    };

    const optimizerResult = investmentThresholds
      ? optimizeWithInvestmentConstraints(
          baseConfig,
          char,
          buildMatch,
          globalConfig,
          investmentThresholds
        )
      : optimizeBuildWithCrCdExploration(baseConfig);

    // Phase 4: Generate Recommendations
    const charRecs = generateRecommendations(
      char,
      buildMatch,
      optimizerResult,
      globalConfig,
      targetMainStats
    );

    perCharacter[char.key] = charRecs;

    // Group by action type
    for (const rec of charRecs.recommendations) {
      byActionType[rec.actionType].push(rec);
    }
  }

  // Sort each action type group by buildScoreDiff desc
  for (const key of Object.keys(byActionType) as ActionType[]) {
    byActionType[key].sort((a, b) => b.buildScoreDiff - a.buildScoreDiff);
  }

  return { byActionType, perCharacter };
}
