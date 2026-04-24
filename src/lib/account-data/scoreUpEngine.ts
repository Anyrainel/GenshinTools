/**
 * Recommendation engine: produces typed actions ("swap", "equip", "upgrade")
 * from the tier-waterfall allocation + per-character upgrade pass.
 *
 * Pipeline:
 *   1. tierWaterfall  → per-character allocated build (S→A→B→C→D, artifact-disjoint within tier).
 *   2. allocationDiff → ScoreUpAction[] for slots whose allocated artifact differs from equipped.
 *   3. upgradePass    → ScoreUpAction[] for upgrade recommendations (in-place + flex-swap variants).
 *   4. filter & sort  → drop actions below the user's score-diff threshold.
 */

import type { Slot, Tier } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type {
  AccountData,
  ArtifactData,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import {
  type ArtifactScoreResult,
  scoreSlotWithMainStat,
} from "../artifact/scoring/artifactScore";
import type { OptimizedBuild } from "./buildOptimizer";
import {
  type AllocatedBuild,
  type AllocationOptions,
  runTierWaterfall,
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
}

export interface CharacterActions {
  characterId: string;
  /** Sorted by slotScoreDiff desc. Includes both allocation diffs and upgrades. */
  actions: ScoreUpAction[];
  /** Tier this character is recommended under. */
  tier: Tier;
  /** Allocated build (post-waterfall). Null when no allocation could be made. */
  allocatedBuild: OptimizedBuild | null;
}

export interface AllActions {
  byActionType: Record<ActionType, ScoreUpAction[]>;
  perCharacter: Record<string, CharacterActions>;
}

export interface RecommendationPrefs {
  /** Hide actions whose slot score diff falls below this. */
  scoreDiffThreshold: number;
  /** When false, allocation actions are still produced; upgrade actions are skipped. */
  includeUpgrades: boolean;
}

export const DEFAULT_RECOMMENDATION_PREFS: RecommendationPrefs = {
  scoreDiffThreshold: 1.0,
  includeUpgrades: true,
};

// ─── Main entry ───

export function generateAllRecommendations(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult | null>,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {},
  prefs: RecommendationPrefs = DEFAULT_RECOMMENDATION_PREFS,
  options: AllocationOptions = {}
): AllActions {
  const allocation = runTierWaterfall(
    accountData,
    scores,
    tierAssignments,
    tierCustomization,
    options
  );

  const ownerByArtifactId = new Map<string, string>();
  for (const char of accountData.characters) {
    for (const a of Object.values(char.artifacts)) {
      if (a) ownerByArtifactId.set(a.id, char.key);
    }
  }

  const allArtifacts: ArtifactData[] = [
    ...accountData.extraArtifacts,
    ...accountData.characters.flatMap((c) =>
      Object.values(c.artifacts).filter((a): a is ArtifactData => !!a)
    ),
  ];

  const byActionType: Record<ActionType, ScoreUpAction[]> = {
    swap: [],
    equip: [],
    upgrade: [],
  };
  const perCharacter: Record<string, CharacterActions> = {};

  for (const char of accountData.characters) {
    const alloc = allocation.perCharacter[char.key];
    if (!alloc) {
      perCharacter[char.key] = {
        characterId: char.key,
        actions: [],
        tier: tierAssignments[char.key]?.tier || "Pool",
        allocatedBuild: null,
      };
      continue;
    }

    const actions: ScoreUpAction[] = [];
    const buildScoreDiff =
      alloc.build && alloc.context
        ? alloc.build.finalScore - currentBuildScore(alloc, char)
        : 0;

    // 1. Allocation diff actions
    if (alloc.build && alloc.context) {
      for (const slot of allSlots) {
        const allocated = alloc.build.artifacts[slot];
        if (!allocated) continue;
        const equipped = char.artifacts[slot];

        if (equipped && equipped.id === allocated.id) continue;

        const slotScore = alloc.build.slotScores[slot] ?? 0;
        const currentSlotScore = equipped
          ? scoreSlotWithMainStat(
              equipped,
              alloc.context.config.weights,
              alloc.context.config.targetMainStats[slot]
            )
          : 0;
        const slotScoreDiff = slotScore - currentSlotScore;
        if (slotScoreDiff < prefs.scoreDiffThreshold) continue;

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
    if (prefs.includeUpgrades && alloc.build && alloc.context) {
      const upgrades: CharacterUpgrades = runUpgradePassForCharacter(
        alloc,
        allArtifacts,
        { minScoreDiff: prefs.scoreDiffThreshold }
      );
      for (const up of upgrades.recommendations) {
        const allocatedInSlot = alloc.build.artifacts[up.upgradeSlot];
        actions.push({
          actionType: "upgrade",
          characterId: char.key,
          slot: up.upgradeSlot,
          sourceArtifactId: up.upgradeArtifactId,
          currentArtifactId: allocatedInSlot?.id ?? null,
          setKey: allocatedInSlot?.setKey ?? "",
          slotScoreDiff: up.scoreDiff,
          buildScoreDiff: buildScoreDiff + up.scoreDiff,
          maxPotentialScore: up.finalScore,
          upgradeStrategy: up.strategy,
          swapSlot: up.swapSlot,
          swapArtifactId: up.swapArtifactId,
        });
      }
    }

    actions.sort((a, b) => b.slotScoreDiff - a.slotScoreDiff);

    perCharacter[char.key] = {
      characterId: char.key,
      actions,
      tier: alloc.tier,
      allocatedBuild: alloc.build,
    };

    for (const a of actions) byActionType[a.actionType].push(a);
  }

  for (const k of Object.keys(byActionType) as ActionType[]) {
    byActionType[k].sort((a, b) => b.buildScoreDiff - a.buildScoreDiff);
  }

  return { byActionType, perCharacter };
}

// ─── Helpers ───

function currentBuildScore(
  alloc: AllocatedBuild,
  char: AccountData["characters"][number]
): number {
  if (!alloc.context) return 0;
  const { config } = alloc.context;
  let total = 0;
  for (const slot of allSlots) {
    const eq = char.artifacts[slot];
    if (!eq) continue;
    total += scoreSlotWithMainStat(
      eq,
      config.weights,
      config.targetMainStats[slot]
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
