import { allSlots } from "@/data/enums";
import type { Slot } from "@/data/enums";
import type { Tier } from "@/data/enums";
import type { LuckExpectation } from "@/data/enums";
/**
 * Diffs optimizer output against current equipment to produce typed recommendations.
 */
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  GlobalStatWeights,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import type { InvestmentThresholds } from "@/data/types";
import type {
  ArtifactScoreResult,
  BuildMatchResult,
} from "../artifact/scoring/artifactScore";
import {
  getTargetMainStatsForSlot,
  scoreSlotWithMainStat,
} from "../artifact/scoring/artifactScore";
import {
  type BuildOptimizerConfig,
  type BuildOptimizerResult,
  optimizeBuildWithCrCdExploration,
} from "./buildOptimizer";
import { buildCandidatePool } from "./candidatePool";
import { type CrBudgetResult, computeCrBudget } from "./crBudget";

export type ActionType = "swap" | "upgrade" | "reroll" | "farm" | "equip";

export interface ScoreUpAction {
  actionType: ActionType;
  characterId: string;
  slot: Slot;
  /** ID of the source artifact to act on (swap in, upgrade, etc.). Null for farm. */
  sourceArtifactId: string | null;
  /** ID of the currently equipped artifact in this slot. */
  currentArtifactId: string | null;
  /** Artifact set key (for display — always available, even for farm candidates). */
  setKey: string;
  slotScoreDiff: number;
  buildScoreDiff: number;
  maxPotentialScore: number;
  isSteal?: boolean;
  donorCharacterId?: string;
}

export interface CharacterActions {
  characterId: string;
  actions: ScoreUpAction[];
  optimizerResult: BuildOptimizerResult;
}

export interface AllActions {
  byActionType: Record<ActionType, ScoreUpAction[]>;
  perCharacter: Record<string, CharacterActions>;
}

// ─── Recommendation Generation ───

/** @internal — exported for testing */
export function generateScoreUpActions(
  char: CharacterData,
  buildMatch: BuildMatchResult,
  optimizerResult: BuildOptimizerResult,
  globalConfig: GlobalStatWeights,
  targetMainStats: Record<Slot, Set<string>>,
  thresholds?: InvestmentThresholds
): CharacterActions {
  const actions: ScoreUpAction[] = [];

  if (optimizerResult.builds.length === 0) {
    return { characterId: char.key, actions: actions, optimizerResult };
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
        const upgradeMin = thresholds?.upgrade ?? 1.0;
        if (diff >= upgradeMin) {
          actions.push({
            actionType: "upgrade",
            characterId: char.key,
            slot,
            sourceArtifactId: optimal.sourceArtifactId ?? null,
            currentArtifactId: current.id,
            setKey: optimal.setKey,
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

    // Skip improvements below threshold
    if (thresholds) {
      let minDiff: number;
      if (actionType === "swap" || actionType === "equip")
        minDiff = actionType === "equip" ? 0.5 : thresholds.swap;
      else if (actionType === "upgrade") minDiff = thresholds.upgrade;
      else if (actionType === "reroll") minDiff = thresholds.reroll;
      else minDiff = thresholds.farm;
      if (slotScoreDiff < minDiff) continue;
    } else if (slotScoreDiff < 0.5) continue;

    actions.push({
      actionType,
      characterId: char.key,
      slot,
      sourceArtifactId: optimal.sourceArtifactId ?? null,
      currentArtifactId: current?.id ?? null,
      setKey: optimal.setKey,
      slotScoreDiff,
      buildScoreDiff,
      maxPotentialScore: topBuild.slotScores[slot],
      isSteal: !!optimal.donorCharacterId,
      donorCharacterId: optimal.donorCharacterId,
    });
  }

  // Sort by slotScoreDiff desc
  actions.sort((a, b) => b.slotScoreDiff - a.slotScoreDiff);

  return { characterId: char.key, actions: actions, optimizerResult };
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

export function generateAllRecommendations(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult | null>,
  globalConfig: GlobalStatWeights,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {},
  investmentThresholds?: InvestmentThresholds
): AllActions {
  const byActionType: Record<ActionType, ScoreUpAction[]> = {
    swap: [],
    upgrade: [],
    reroll: [],
    farm: [],
    equip: [],
  };
  const perCharacter: Record<string, CharacterActions> = {};

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
        actions: [],
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
        actions: [],
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
    const charRecs = generateScoreUpActions(
      char,
      buildMatch,
      optimizerResult,
      globalConfig,
      targetMainStats,
      investmentThresholds
    );

    perCharacter[char.key] = charRecs;

    // Group by action type
    for (const rec of charRecs.actions) {
      byActionType[rec.actionType].push(rec);
    }
  }

  // Sort each action type group by buildScoreDiff desc
  for (const key of Object.keys(byActionType) as ActionType[]) {
    byActionType[key].sort((a, b) => b.buildScoreDiff - a.buildScoreDiff);
  }

  return { byActionType, perCharacter };
}

/** Build a flat artifact lookup map from account data (keyed by artifact ID). */
export function buildArtifactLookup(
  accountData: AccountData
): Map<string, ArtifactData> {
  const map = new Map<string, ArtifactData>();
  for (const art of accountData.extraArtifacts) {
    map.set(art.id, art);
  }
  for (const char of accountData.characters) {
    for (const art of Object.values(char.artifacts)) {
      if (art) map.set(art.id, art);
    }
  }
  return map;
}
