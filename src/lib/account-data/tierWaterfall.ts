/**
 * Tier-waterfall allocation: process tiers in priority order (S → A → B → C → D),
 * solving each tier's joint character-artifact assignment against the pool of
 * artifacts not yet claimed by higher-priority tiers.
 *
 * Pool tier is not allocated — characters in Pool deliberately receive no
 * recommendation.
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
  getTargetMainStatsForSlot,
} from "../artifact/scoring/artifactScore";
import { buildAllocationPool } from "./allocationPool";
import {
  type BuildOptimizerConfig,
  enumerateBuilds,
  type OptimizedBuild,
} from "./buildOptimizer";
import { type PackerCharacter, packColumns } from "./columnPacker";
import { type CrBudgetResult, computeCrBudget } from "./crBudget";

/**
 * Per-character allocation result. Includes the cached per-char solver config
 * so the downstream upgrade pass doesn't have to re-derive weights/budget/etc.
 */
export interface AllocatedBuild {
  characterId: string;
  tier: Tier;
  /** Chosen build, or null if no allocation (no buildMatch, infeasible, or Pool tier). */
  build: OptimizedBuild | null;
  /** Per-char context cached for downstream consumers. Null when build is null. */
  context: AllocationContext | null;
  /** Currently equipped artifacts at allocation time. */
  equipped: Partial<Record<Slot, ArtifactData>>;
  /** Luck expectation chosen for this character's tier (used by the upgrade pass). */
  luckExpectation: LuckExpectation;
}

export interface AllocationContext {
  config: BuildOptimizerConfig;
  crBudget: CrBudgetResult;
  scoreResult: ArtifactScoreResult;
}

export interface AllocationResult {
  perCharacter: Record<string, AllocatedBuild>;
  unclaimedAfterWaterfall: ArtifactData[];
  totalNodesExplored: number;
}

export interface AllocationOptions {
  /** Top-K columns per character. Higher = closer to ground truth, slower. */
  topK?: number;
  /** Order of tiers processed; default is S → A → B → C → D (Pool excluded). */
  tierOrder?: Tier[];
}

const DEFAULT_TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

export function runTierWaterfall(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult | null>,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {},
  options: AllocationOptions = {}
): AllocationResult {
  const topK = options.topK ?? 20;
  const tierOrder = options.tierOrder ?? DEFAULT_TIER_ORDER;

  const allArtifacts: ArtifactData[] = [
    ...accountData.extraArtifacts,
    ...accountData.characters.flatMap((c) =>
      Object.values(c.artifacts).filter((a): a is ArtifactData => !!a)
    ),
  ];

  const charsByTier = new Map<Tier, AccountData["characters"]>();
  for (const char of accountData.characters) {
    const tier: Tier = tierAssignments[char.key]?.tier || "Pool";
    if (!charsByTier.has(tier)) charsByTier.set(tier, []);
    charsByTier.get(tier)!.push(char);
  }

  const perCharacter: Record<string, AllocatedBuild> = {};
  const unclaimedById = new Map<string, ArtifactData>();
  for (const a of allArtifacts) unclaimedById.set(a.id, a);

  let totalNodesExplored = 0;

  for (const tier of tierOrder) {
    const chars = charsByTier.get(tier) ?? [];
    if (chars.length === 0) continue;

    const luckExpectation: LuckExpectation =
      tierCustomization[tier]?.luckExpectation || "balanced";

    const packerChars: PackerCharacter[] = [];
    const ctxByChar = new Map<string, AllocationContext>();
    const unclaimedSnapshot = Array.from(unclaimedById.values());

    for (const char of chars) {
      const scoreResult = scores[char.key];
      const buildMatch = scoreResult?.buildMatch;
      if (!scoreResult || !buildMatch) continue;

      const crBudget = safeComputeCrBudget(char, buildMatch);

      const targetMainStats = {} as Record<Slot, Set<string>>;
      for (const slot of allSlots) {
        targetMainStats[slot] = getTargetMainStatsForSlot(
          slot,
          buildMatch.build,
          char.artifacts[slot] ?? undefined
        );
      }

      const candidates = buildAllocationPool(char, unclaimedSnapshot);
      const config: BuildOptimizerConfig = {
        weights: buildMatch.statWeights,
        candidates,
        crBudget,
        targetMainStats,
        setConstraint: {
          composition: buildMatch.build.composition,
          artifactSet: buildMatch.build.artifactSet,
          halfSet1: buildMatch.build.halfSet1,
          halfSet2: buildMatch.build.halfSet2,
        },
      };

      const result = enumerateBuilds(config, topK);
      const columns = result.builds.map((b) => ({
        artifactIds: allSlots.map((s) => b.artifacts[s].id),
        score: b.finalScore,
        payload: b,
      }));

      ctxByChar.set(char.key, { config, crBudget, scoreResult });
      packerChars.push({ characterId: char.key, columns });
    }

    if (packerChars.length === 0) {
      // Still record the no-build characters for this tier
      for (const char of chars) {
        if (perCharacter[char.key]) continue;
        perCharacter[char.key] = makeUnallocated(char, tier, luckExpectation);
      }
      continue;
    }

    const assignment = packColumns(packerChars);
    totalNodesExplored += assignment.nodesExplored;

    // Pass 1: record packer assignments and remove their claimed artifacts.
    for (const char of chars) {
      const ctx = ctxByChar.get(char.key);
      if (!ctx) {
        perCharacter[char.key] = makeUnallocated(char, tier, luckExpectation);
        continue;
      }
      const col = assignment.byCharacter[char.key];
      const build = (col?.payload ?? null) as OptimizedBuild | null;

      perCharacter[char.key] = {
        characterId: char.key,
        tier,
        build,
        context: ctx,
        equipped: char.artifacts,
        luckExpectation,
      };

      if (build) {
        for (const slot of allSlots) {
          const a = build.artifacts[slot];
          if (a) unclaimedById.delete(a.id);
        }
      }
    }

    // Pass 2: skipped-character sub-packer. The main packer can leave a char
    // unassigned when every column it saw conflicts with a higher-priority
    // char's pick. We re-enumerate columns for each skipped char against the
    // post-packer unclaimed pool (guaranteed disjoint from main-round picks
    // by construction) and run a second packer over that sub-problem.
    const skippedAfterMain = chars.filter((c) => {
      const a = perCharacter[c.key];
      return a && a.build === null && ctxByChar.has(c.key);
    });
    if (skippedAfterMain.length > 0) {
      const leftoverPool = Array.from(unclaimedById.values());
      const subPackerChars: PackerCharacter[] = [];
      const subConfigByChar = new Map<string, BuildOptimizerConfig>();
      for (const char of skippedAfterMain) {
        const ctx = ctxByChar.get(char.key)!;
        const candidates = buildAllocationPool(char, leftoverPool);
        const subConfig: BuildOptimizerConfig = {
          ...ctx.config,
          candidates,
        };
        const result = enumerateBuilds(subConfig, topK);
        const columns = result.builds.map((b) => ({
          artifactIds: allSlots.map((s) => b.artifacts[s].id),
          score: b.finalScore,
          payload: b,
        }));
        subConfigByChar.set(char.key, subConfig);
        subPackerChars.push({ characterId: char.key, columns });
      }

      const subAssignment = packColumns(subPackerChars);
      totalNodesExplored += subAssignment.nodesExplored;

      for (const char of skippedAfterMain) {
        const allocated = perCharacter[char.key];
        const ctx = ctxByChar.get(char.key);
        const subConfig = subConfigByChar.get(char.key);
        if (!allocated || !ctx || !subConfig) continue;
        const col = subAssignment.byCharacter[char.key];
        const build = (col?.payload ?? null) as OptimizedBuild | null;
        if (!build) continue;

        perCharacter[char.key] = {
          ...allocated,
          build,
          context: { ...ctx, config: subConfig },
        };
        for (const slot of allSlots) {
          const a = build.artifacts[slot];
          if (a) unclaimedById.delete(a.id);
        }
      }
    }

    // Pass 3: guaranteed-assignment sequential greedy. After the sub-packer,
    // any character still without a build gets one via per-char B&B against
    // whatever artifacts remain unclaimed, in priority order. The
    // `buildAllocationPool` always includes each char's currently-equipped
    // artifacts as candidates, so a feasible build is virtually always
    // findable — this guarantee lets the caller trust that every character
    // with valid `scoreResult` ends up with an allocated build.
    for (const char of chars) {
      const allocated = perCharacter[char.key];
      if (!allocated || allocated.build !== null) continue;
      const ctx = ctxByChar.get(char.key);
      if (!ctx) continue;

      const candidates = buildAllocationPool(
        char,
        Array.from(unclaimedById.values())
      );
      const greedyConfig: BuildOptimizerConfig = {
        ...ctx.config,
        candidates,
      };
      const greedyResult = enumerateBuilds(greedyConfig, 1);
      const greedyBuild = greedyResult.builds[0] ?? null;
      if (!greedyBuild) continue;

      perCharacter[char.key] = {
        ...allocated,
        build: greedyBuild,
        context: { ...ctx, config: greedyConfig },
      };
      for (const slot of allSlots) {
        const a = greedyBuild.artifacts[slot];
        if (a) unclaimedById.delete(a.id);
      }
    }
  }

  // Pool (and any tier not in tierOrder) characters: record unallocated
  for (const char of accountData.characters) {
    if (perCharacter[char.key]) continue;
    const tier: Tier = tierAssignments[char.key]?.tier || "Pool";
    const luckExpectation: LuckExpectation =
      tierCustomization[tier]?.luckExpectation || "balanced";
    perCharacter[char.key] = makeUnallocated(char, tier, luckExpectation);
  }

  return {
    perCharacter,
    unclaimedAfterWaterfall: Array.from(unclaimedById.values()),
    totalNodesExplored,
  };
}

// ─── Helpers ───

function makeUnallocated(
  char: AccountData["characters"][number],
  tier: Tier,
  luckExpectation: LuckExpectation
): AllocatedBuild {
  return {
    characterId: char.key,
    tier,
    build: null,
    context: null,
    equipped: char.artifacts,
    luckExpectation,
  };
}

function safeComputeCrBudget(
  char: Parameters<typeof computeCrBudget>[0],
  buildMatch: Parameters<typeof computeCrBudget>[1]
): CrBudgetResult {
  try {
    return computeCrBudget(char, buildMatch);
  } catch {
    return {
      baseCr: 0.05,
      ascensionCr: 0,
      weaponSecondaryCr: 0,
      weaponPassiveCr: 0,
      artifactSetCr: 0,
      totalNonArtifactCr: 0.05,
    };
  }
}
