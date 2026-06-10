/**
 * Recommendation engine: produces typed actions ("swap", "equip", "upgrade")
 * from the tier-waterfall allocation + per-character upgrade pass.
 *
 * Pipeline:
 *   1. tierWaterfall  → per-character allocated build (S→A→B→C→D, artifact-disjoint within tier).
 *   2. allocationDiff → ScoreUpAction[] for slots whose allocated artifact differs from equipped.
 *   3. upgradePass    → ScoreUpAction[] for upgrade recommendations (in-place + flex-swap variants).
 *   4. filter & sort  → drop negative-delta actions and sort by impact.
 */

import type { LuckExpectation, Slot, Tier } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type {
  AccountData,
  ArtifactData,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import {
  type ArtifactScoreResult,
  scoreSlotWithMainStatWeights,
} from "../artifact/scoring/artifactScore";
import { collectEligibleArtifacts } from "./allocationPool";
import { type OptimizedBuild, scoreFullBuild } from "./buildOptimizer";
import {
  type AllocatedBuild,
  type AllocationOptions,
  type AllocationResult,
  runTierWaterfall,
  runTierWaterfallSteps,
} from "./tierWaterfall";
import {
  type CharacterUpgrades,
  runUpgradePassForCharacter,
  type UpgradeStrategy,
} from "./upgradePass";

export type ActionType = "swap" | "equip" | "upgrade";

export interface ScoreUpAction {
  actionType: ActionType;
  characterId: string;
  slot: Slot;
  /** Artifact this action installs (allocation pick or upgrade target). Null when nothing to install. */
  sourceArtifactId: string | null;
  /** Artifact currently in this slot before applying the action. */
  currentArtifactId: string | null;
  /** Artifact set key of the source artifact (for display). */
  setKey: string;
  /** Score delta for this single slot — used as the surface threshold. */
  slotScoreDiff: number;
  /** Score delta for the whole build, applying all actions for this character. */
  buildScoreDiff: number;
  /** Score this slot would contribute after the action. */
  maxPotentialScore: number;
  /** True when the source artifact currently lives on a different character. */
  isSteal?: boolean;
  donorCharacterId?: string;
  /** Upgrade strategy label (1/2/3). Only set on upgrade actions. */
  upgradeStrategy?: UpgradeStrategy;
  /** For compound upgrades (strategies 2/3): the additional swap-partner slot. */
  swapSlot?: Slot;
  swapArtifactId?: string;
  swapCurrentArtifactId?: string | null;
}

export interface CharacterActions {
  characterId: string;
  /** Sorted by slotScoreDiff desc. Includes both allocation diffs and upgrades. */
  actions: ScoreUpAction[];
  /** Tier this character is recommended under. */
  tier: Tier;
  /** Allocated build (post-waterfall). Null when no allocation could be made. */
  allocatedBuild: OptimizedBuild | null;
  /**
   * Score of the currently equipped artifacts under the same formula as
   * allocatedBuild.finalScore — the only valid baseline for displaying a
   * score gain. Null when no allocation context exists.
   */
  currentScore: number | null;
  /** Allocation context used to refresh upgrade-only recommendations without rerunning the waterfall. */
  allocation: AllocatedBuild | null;
}

export interface AllActions {
  byActionType: Record<ActionType, ScoreUpAction[]>;
  perCharacter: Record<string, CharacterActions>;
}

export interface ScoreUpTierUpdate {
  tier: Tier;
  recommendations: AllActions;
  completedTierCount: number;
  totalTierCount: number;
}

const MIN_RECOMMENDATION_SCORE_DIFF = 0;

const DEFAULT_TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

// ─── Main entry ───

export function generateAllScoreActions(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult | null>,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {},
  options: AllocationOptions = {}
): AllActions {
  const allocation = runTierWaterfall(
    accountData,
    scores,
    tierAssignments,
    tierCustomization,
    options
  );

  return buildScoreActionsFromAllocation(
    accountData,
    tierAssignments,
    options,
    allocation
  );
}

export function recomputeTierUpgrades(
  recommendations: AllActions,
  accountData: AccountData,
  tierAssignments: TierAssignment,
  tier: Tier,
  luckExpectation: LuckExpectation,
  options: AllocationOptions = {}
): AllActions {
  const allArtifacts = collectEligibleArtifacts(
    accountData,
    tierAssignments,
    options.allowPoolArtifactSteals ?? true
  );
  const artifactById = new Map(allArtifacts.map((a) => [a.id, a]));
  const allocationByCharacter: Record<string, AllocatedBuild> = {};
  for (const [characterId, entry] of Object.entries(
    recommendations.perCharacter
  )) {
    if (!entry.allocation) continue;
    allocationByCharacter[characterId] =
      entry.tier === tier
        ? { ...entry.allocation, luckExpectation }
        : entry.allocation;
  }

  const tierOrder = options.tierOrder ?? DEFAULT_TIER_ORDER;
  const tierRank = new Map<Tier, number>(
    tierOrder.map((orderedTier, index) => [orderedTier, index])
  );
  const blockedArtifactIdsByTier = buildBlockedArtifactIdsByTier(
    allocationByCharacter,
    tierOrder,
    tierRank
  );
  const characterById = new Map(
    accountData.characters.map((char) => [char.key, char])
  );

  const perCharacter: Record<string, CharacterActions> = {};
  for (const [characterId, entry] of Object.entries(
    recommendations.perCharacter
  )) {
    if (entry.tier !== tier) {
      perCharacter[characterId] = entry;
      continue;
    }

    const char = characterById.get(characterId);
    const allocation = allocationByCharacter[characterId];
    const nonUpgradeActions = entry.actions.filter(
      (action) => action.actionType !== "upgrade"
    );

    let upgradeActions: ScoreUpAction[] = [];
    if (char && allocation) {
      const buildScoreDiff =
        allocation.build && allocation.context
          ? allocation.build.finalScore - currentBuildScore(allocation, char)
          : 0;
      upgradeActions = buildUpgradeActions(
        allocation,
        allArtifacts,
        artifactById,
        mergeBlockedArtifactIds(
          blockedArtifactIdsByTier.get(allocation.tier),
          options.protectedArtifactIds
        ),
        MIN_RECOMMENDATION_SCORE_DIFF,
        buildScoreDiff
      );
    }

    const actions = [...nonUpgradeActions, ...upgradeActions].sort(
      (a, b) => b.slotScoreDiff - a.slotScoreDiff
    );
    perCharacter[characterId] = {
      ...entry,
      actions,
      allocation,
    };
  }

  return {
    byActionType: indexActionsByType(perCharacter),
    perCharacter,
  };
}

export async function* generateScoreActionsByTier(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult | null>,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {},
  options: AllocationOptions = {}
): AsyncGenerator<ScoreUpTierUpdate, void> {
  const processedCharacterIds = new Set<string>();
  let latestActions = emptyActions();

  for (const step of runTierWaterfallSteps(
    accountData,
    scores,
    tierAssignments,
    tierCustomization,
    options
  )) {
    for (const char of accountData.characters) {
      const tier: Tier = tierAssignments[char.key]?.tier || "Pool";
      if (tier === step.tier) processedCharacterIds.add(char.key);
    }

    latestActions = buildScoreActionsFromAllocation(
      accountData,
      tierAssignments,
      options,
      step.allocation,
      processedCharacterIds
    );

    yield {
      tier: step.tier,
      recommendations: latestActions,
      completedTierCount: step.completedTierCount,
      totalTierCount: step.totalTierCount,
    };

    await yieldToBrowser();
  }
}

function buildScoreActionsFromAllocation(
  accountData: AccountData,
  tierAssignments: TierAssignment,
  options: AllocationOptions,
  allocation: AllocationResult,
  includedCharacterIds?: ReadonlySet<string>
): AllActions {
  const ownerByArtifactId = new Map<string, string>();
  for (const char of accountData.characters) {
    for (const a of Object.values(char.artifacts)) {
      if (a) ownerByArtifactId.set(a.id, char.key);
    }
  }

  const allArtifacts = collectEligibleArtifacts(
    accountData,
    tierAssignments,
    options.allowPoolArtifactSteals ?? true
  );
  const artifactById = new Map(allArtifacts.map((a) => [a.id, a]));
  const tierOrder = options.tierOrder ?? DEFAULT_TIER_ORDER;
  const tierRank = new Map<Tier, number>(
    tierOrder.map((tier, index) => [tier, index])
  );
  const blockedArtifactIdsByTier = buildBlockedArtifactIdsByTier(
    allocation.perCharacter,
    tierOrder,
    tierRank
  );

  const byActionType: Record<ActionType, ScoreUpAction[]> = {
    swap: [],
    equip: [],
    upgrade: [],
  };
  const perCharacter: Record<string, CharacterActions> = {};

  for (const char of accountData.characters) {
    if (includedCharacterIds && !includedCharacterIds.has(char.key)) continue;

    const alloc = allocation.perCharacter[char.key];
    if (!alloc) {
      perCharacter[char.key] = {
        characterId: char.key,
        actions: [],
        tier: tierAssignments[char.key]?.tier || "Pool",
        allocatedBuild: null,
        currentScore: null,
        allocation: null,
      };
      continue;
    }

    const actions: ScoreUpAction[] = [];
    const currentScore =
      alloc.build && alloc.context ? currentBuildScore(alloc, char) : null;
    const buildScoreDiff =
      alloc.build && currentScore != null
        ? alloc.build.finalScore - currentScore
        : 0;

    // 1. Allocation diff actions. Every changed slot is surfaced — including
    // negative per-slot diffs. The allocation is one atomic unit: a slot can
    // lose raw score yet be required for the set composition or CR-budget
    // relief, and dropping it would leave actions that no longer reproduce
    // the allocated build.
    if (alloc.build && alloc.context) {
      for (const slot of allSlots) {
        const allocated = alloc.build.artifacts[slot];
        if (!allocated) continue;
        const equipped = char.artifacts[slot];

        if (equipped && equipped.id === allocated.id) continue;

        const slotScore = alloc.build.slotScores[slot] ?? 0;
        const currentSlotScore = equipped
          ? scoreSlotWithMainStatWeights(
              equipped,
              alloc.context.config.weights,
              alloc.context.config.targetMainStatWeights[slot]
            )
          : 0;
        const slotScoreDiff = slotScore - currentSlotScore;

        const donor = ownerByArtifactId.get(allocated.id);
        const isSteal = !!donor && donor !== char.key;

        actions.push({
          actionType: equipped ? "swap" : "equip",
          characterId: char.key,
          slot,
          sourceArtifactId: allocated.id,
          currentArtifactId: equipped?.id ?? null,
          setKey: allocated.setKey,
          slotScoreDiff,
          buildScoreDiff,
          maxPotentialScore: slotScore,
          isSteal,
          donorCharacterId: isSteal ? donor : undefined,
        });
      }
    }

    // 2. Upgrade actions (post-allocation)
    if (alloc.build && alloc.context) {
      const upgrades = buildUpgradeActions(
        alloc,
        allArtifacts,
        artifactById,
        mergeBlockedArtifactIds(
          blockedArtifactIdsByTier.get(alloc.tier),
          options.protectedArtifactIds
        ),
        MIN_RECOMMENDATION_SCORE_DIFF,
        buildScoreDiff
      );
      actions.push(...upgrades);
    }

    actions.sort((a, b) => b.slotScoreDiff - a.slotScoreDiff);

    perCharacter[char.key] = {
      characterId: char.key,
      actions,
      tier: alloc.tier,
      allocatedBuild: alloc.build,
      currentScore,
      allocation: alloc,
    };

    for (const a of actions) byActionType[a.actionType].push(a);
  }

  for (const k of Object.keys(byActionType) as ActionType[]) {
    byActionType[k].sort((a, b) => b.buildScoreDiff - a.buildScoreDiff);
  }

  return { byActionType, perCharacter };
}

// ─── Helpers ───

function emptyActions(): AllActions {
  return {
    byActionType: { swap: [], equip: [], upgrade: [] },
    perCharacter: {},
  };
}

function buildUpgradeActions(
  alloc: AllocatedBuild,
  allArtifacts: ArtifactData[],
  artifactById: ReadonlyMap<string, ArtifactData>,
  blockedArtifactIds: ReadonlySet<string> | undefined,
  minScoreDiff: number,
  buildScoreDiff: number
): ScoreUpAction[] {
  const actions: ScoreUpAction[] = [];
  const upgrades: CharacterUpgrades = runUpgradePassForCharacter(
    alloc,
    allArtifacts,
    {
      minScoreDiff,
      blockedArtifactIds,
    }
  );
  for (const up of upgrades.recommendations) {
    const allocatedInSlot = alloc.build?.artifacts[up.upgradeSlot];
    const swapCurrentArtifact = up.swapSlot
      ? alloc.build?.artifacts[up.swapSlot]
      : undefined;
    const upgradeArtifact = artifactById.get(up.upgradeArtifactId);
    actions.push({
      actionType: "upgrade",
      characterId: alloc.characterId,
      slot: up.upgradeSlot,
      sourceArtifactId: up.upgradeArtifactId,
      currentArtifactId: allocatedInSlot?.id ?? null,
      setKey: upgradeArtifact?.setKey ?? allocatedInSlot?.setKey ?? "",
      slotScoreDiff: up.scoreDiff,
      buildScoreDiff: buildScoreDiff + up.scoreDiff,
      maxPotentialScore: up.finalScore,
      upgradeStrategy: up.strategy,
      swapSlot: up.swapSlot,
      swapArtifactId: up.swapArtifactId,
      swapCurrentArtifactId: swapCurrentArtifact?.id ?? null,
    });
  }
  return actions;
}

function indexActionsByType(
  perCharacter: Record<string, CharacterActions>
): Record<ActionType, ScoreUpAction[]> {
  const byActionType: Record<ActionType, ScoreUpAction[]> = {
    swap: [],
    equip: [],
    upgrade: [],
  };
  for (const entry of Object.values(perCharacter)) {
    for (const action of entry.actions) {
      byActionType[action.actionType].push(action);
    }
  }
  for (const k of Object.keys(byActionType) as ActionType[]) {
    byActionType[k].sort((a, b) => b.buildScoreDiff - a.buildScoreDiff);
  }
  return byActionType;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildBlockedArtifactIdsByTier(
  perCharacter: Record<string, AllocatedBuild>,
  tierOrder: Tier[],
  tierRank: Map<Tier, number>
): Map<Tier, Set<string>> {
  const idsByTier = new Map<Tier, Set<string>>();
  for (const tier of tierOrder) idsByTier.set(tier, new Set());

  for (const alloc of Object.values(perCharacter)) {
    if (!alloc.build) continue;
    const ids = idsByTier.get(alloc.tier);
    if (!ids) continue;
    for (const slot of allSlots) {
      const artifact = alloc.build.artifacts[slot];
      if (artifact) ids.add(artifact.id);
    }
  }

  const blockedByTier = new Map<Tier, Set<string>>();
  for (const tier of tierOrder) {
    const rank = tierRank.get(tier);
    if (rank == null) continue;
    const blocked = new Set<string>();
    for (const [otherTier, ids] of idsByTier) {
      const otherRank = tierRank.get(otherTier);
      if (otherRank == null || otherRank > rank) continue;
      for (const id of ids) blocked.add(id);
    }
    blockedByTier.set(tier, blocked);
  }

  return blockedByTier;
}

function mergeBlockedArtifactIds(
  blockedArtifactIds: ReadonlySet<string> | undefined,
  protectedArtifactIds: readonly string[] | undefined
): ReadonlySet<string> | undefined {
  if (!protectedArtifactIds?.length) return blockedArtifactIds;
  const merged = new Set(blockedArtifactIds ?? []);
  for (const artifactId of protectedArtifactIds) {
    merged.add(artifactId);
  }
  return merged;
}

function currentBuildScore(
  alloc: AllocatedBuild,
  char: AccountData["characters"][number]
): number {
  if (!alloc.context) return 0;
  const { config } = alloc.context;
  const completeArtifacts = {} as OptimizedBuild["artifacts"];
  let isComplete = true;
  for (const slot of allSlots) {
    const eq = char.artifacts[slot];
    if (!eq) {
      isComplete = false;
      break;
    }
    completeArtifacts[slot] = {
      ...eq,
      source: "current",
      sourceArtifactId: eq.id,
    };
  }
  if (isComplete) {
    return scoreFullBuild(
      completeArtifacts,
      config.weights,
      config.targetMainStatWeights,
      config.crBudget
    ).finalScore;
  }

  let total = 0;
  for (const slot of allSlots) {
    const eq = char.artifacts[slot];
    if (!eq) continue;
    total += scoreSlotWithMainStatWeights(
      eq,
      config.weights,
      config.targetMainStatWeights[slot]
    );
  }
  return total;
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
