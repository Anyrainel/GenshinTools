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
import { type PackerCharacter, packColumnsBeam } from "./columnPacker";
import { type CrBudgetResult, getCrBudget } from "./maxCrBuff";

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

export interface TierAllocationStep {
  tier: Tier;
  allocation: AllocationResult;
  completedTierCount: number;
  totalTierCount: number;
}

export interface AllocationOptions {
  /** Columns generated per character in each pricing round. */
  topK?: number;
  /** Number of shadow-price rounds used to diversify contended columns. */
  pricingRounds?: number;
  /** Maximum accumulated columns retained per character for beam packing. */
  maxColumnsPerCharacter?: number;
  /** Beam width for production-sized cross-character packing. */
  beamWidth?: number;
  /** Local repair sweeps after beam packing. */
  repairSweeps?: number;
  /** Price update strength for contended artifacts. */
  priceStep?: number;
  /** Price decay per round; lower values forget stale contention faster. */
  priceDecay?: number;
  /** Candidate caps inside the per-character optimizer. */
  slotCaps?: BuildOptimizerConfig["slotCaps"];
  /** Order of tiers processed; default is S → A → B → C → D (Pool excluded). */
  tierOrder?: Tier[];
  /** Whether artifacts equipped by Pool characters can enter recommendation search. */
  allowPoolArtifactSteals?: boolean;
}

const DEFAULT_TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];
const DEFAULT_TOP_K = 30;
const DEFAULT_PRICING_ROUNDS = 8;
const DEFAULT_MAX_COLUMNS = 120;
const DEFAULT_BEAM_WIDTH = 1024;
const DEFAULT_REPAIR_SWEEPS = 2;
const DEFAULT_PRICE_STEP = 0.35;
const DEFAULT_PRICE_DECAY = 0.65;
const PRICE_REGRET_CAP = 25;
const PRICE_CAP = 80;

export function runTierWaterfall(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult | null>,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {},
  options: AllocationOptions = {}
): AllocationResult {
  const steps = runTierWaterfallSteps(
    accountData,
    scores,
    tierAssignments,
    tierCustomization,
    options
  );
  let next = steps.next();
  while (!next.done) {
    next = steps.next();
  }
  return next.value;
}

export function* runTierWaterfallSteps(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult | null>,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {},
  options: AllocationOptions = {}
): Generator<TierAllocationStep, AllocationResult> {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const tierOrder = options.tierOrder ?? DEFAULT_TIER_ORDER;

  const allArtifacts = collectEligibleArtifacts(
    accountData,
    tierAssignments,
    options.allowPoolArtifactSteals ?? true
  );

  const charsByTier = new Map<Tier, AccountData["characters"]>();
  for (const char of accountData.characters) {
    const tier: Tier = tierAssignments[char.key]?.tier || "Pool";
    if (!charsByTier.has(tier)) charsByTier.set(tier, []);
    charsByTier.get(tier)!.push(char);
  }
  const totalTierCount = tierOrder.filter(
    (tier) => (charsByTier.get(tier)?.length ?? 0) > 0
  ).length;
  let completedTierCount = 0;

  const perCharacter: Record<string, AllocatedBuild> = {};
  const unclaimedById = new Map<string, ArtifactData>();
  for (const a of allArtifacts) unclaimedById.set(a.id, a);

  let totalNodesExplored = 0;

  for (const tier of tierOrder) {
    const chars = charsByTier.get(tier) ?? [];
    if (chars.length === 0) continue;

    const luckExpectation: LuckExpectation =
      tierCustomization[tier]?.luckExpectation || "balanced";

    const preparedChars: PreparedTierCharacter[] = [];
    const ctxByChar = new Map<string, AllocationContext>();
    const unclaimedSnapshot = Array.from(unclaimedById.values());

    for (const char of chars) {
      const scoreResult = scores[char.key];
      const buildMatch = scoreResult?.buildMatch;
      if (!scoreResult || !buildMatch) continue;

      const crBudget = safeGetCrBudget(char, buildMatch);

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
        slotCaps: options.slotCaps,
        setConstraint: {
          composition: buildMatch.build.composition,
          artifactSet: buildMatch.build.artifactSet,
          halfSet1: buildMatch.build.halfSet1,
          halfSet2: buildMatch.build.halfSet2,
        },
      };

      ctxByChar.set(char.key, { config, crBudget, scoreResult });
      preparedChars.push({ characterId: char.key, config });
    }

    if (preparedChars.length === 0) {
      // Still record the no-build characters for this tier
      for (const char of chars) {
        if (perCharacter[char.key]) continue;
        perCharacter[char.key] = makeUnallocated(char, tier, luckExpectation);
      }
      completedTierCount += 1;
      yield {
        tier,
        allocation: snapshotAllocation(
          perCharacter,
          unclaimedById,
          totalNodesExplored
        ),
        completedTierCount,
        totalTierCount,
      };
      continue;
    }

    const assignment = allocatePreparedTier(preparedChars, {
      topK,
      pricingRounds: options.pricingRounds ?? DEFAULT_PRICING_ROUNDS,
      maxColumnsPerCharacter:
        options.maxColumnsPerCharacter ?? DEFAULT_MAX_COLUMNS,
      beamWidth: options.beamWidth ?? DEFAULT_BEAM_WIDTH,
      repairSweeps: options.repairSweeps ?? DEFAULT_REPAIR_SWEEPS,
      priceStep: options.priceStep ?? DEFAULT_PRICE_STEP,
      priceDecay: options.priceDecay ?? DEFAULT_PRICE_DECAY,
    });
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
      const subPreparedChars: PreparedTierCharacter[] = [];
      const subConfigByChar = new Map<string, BuildOptimizerConfig>();
      for (const char of skippedAfterMain) {
        const ctx = ctxByChar.get(char.key)!;
        const candidates = buildAllocationPool(char, leftoverPool);
        const subConfig: BuildOptimizerConfig = {
          ...ctx.config,
          candidates,
        };
        subConfigByChar.set(char.key, subConfig);
        subPreparedChars.push({ characterId: char.key, config: subConfig });
      }

      const subAssignment = allocatePreparedTier(subPreparedChars, {
        topK,
        pricingRounds: Math.max(
          2,
          Math.ceil((options.pricingRounds ?? DEFAULT_PRICING_ROUNDS) / 2)
        ),
        maxColumnsPerCharacter:
          options.maxColumnsPerCharacter ?? DEFAULT_MAX_COLUMNS,
        beamWidth: options.beamWidth ?? DEFAULT_BEAM_WIDTH,
        repairSweeps: options.repairSweeps ?? DEFAULT_REPAIR_SWEEPS,
        priceStep: options.priceStep ?? DEFAULT_PRICE_STEP,
        priceDecay: options.priceDecay ?? DEFAULT_PRICE_DECAY,
      });
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

    // Pass 3: sequential greedy rescue. After the sub-packer, any character
    // still without a build gets one via per-char B&B against whatever
    // artifacts remain unclaimed, in priority order. Equipped artifacts are
    // not reintroduced once another character has claimed them, so a character
    // can still remain empty if the leftover pool cannot satisfy its set.
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

    completedTierCount += 1;
    yield {
      tier,
      allocation: snapshotAllocation(
        perCharacter,
        unclaimedById,
        totalNodesExplored
      ),
      completedTierCount,
      totalTierCount,
    };
  }

  // Pool (and any tier not in tierOrder) characters: record unallocated
  for (const char of accountData.characters) {
    if (perCharacter[char.key]) continue;
    const tier: Tier = tierAssignments[char.key]?.tier || "Pool";
    const luckExpectation: LuckExpectation =
      tierCustomization[tier]?.luckExpectation || "balanced";
    perCharacter[char.key] = makeUnallocated(char, tier, luckExpectation);
  }

  return snapshotAllocation(perCharacter, unclaimedById, totalNodesExplored);
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

function snapshotAllocation(
  perCharacter: Record<string, AllocatedBuild>,
  unclaimedById: Map<string, ArtifactData>,
  totalNodesExplored: number
): AllocationResult {
  return {
    perCharacter: { ...perCharacter },
    unclaimedAfterWaterfall: Array.from(unclaimedById.values()),
    totalNodesExplored,
  };
}

function collectEligibleArtifacts(
  accountData: AccountData,
  tierAssignments: TierAssignment,
  allowPoolArtifactSteals: boolean
): ArtifactData[] {
  return [
    ...accountData.extraArtifacts,
    ...accountData.characters.flatMap((character) => {
      const ownerTier: Tier = tierAssignments[character.key]?.tier || "Pool";
      if (!allowPoolArtifactSteals && ownerTier === "Pool") return [];
      return Object.values(character.artifacts).filter(
        (artifact): artifact is ArtifactData => !!artifact
      );
    }),
  ];
}

function safeGetCrBudget(
  char: AccountData["characters"][number],
  buildMatch: ArtifactScoreResult["buildMatch"]
): CrBudgetResult {
  try {
    return getCrBudget({
      characterId: char.key,
      characterLevel: char.level,
      constellation: char.constellation,
      weaponId: char.weapon?.key,
      weaponRefinement: char.weapon?.refinement,
      artifact: buildMatch.build,
    });
  } catch {
    return {
      baseCr: 0.05,
      ascensionCr: 0,
      characterBuffCr: 0,
      weaponSecondaryCr: 0,
      weaponPassiveCr: 0,
      artifactSetCr: 0,
      totalNonArtifactCr: 0.05,
    };
  }
}

interface PreparedTierCharacter {
  characterId: string;
  config: BuildOptimizerConfig;
}

interface PreparedTierOptions {
  topK: number;
  pricingRounds: number;
  maxColumnsPerCharacter: number;
  beamWidth: number;
  repairSweeps: number;
  priceStep: number;
  priceDecay: number;
}

function allocatePreparedTier(
  chars: PreparedTierCharacter[],
  options: PreparedTierOptions
) {
  const prices = new Map<string, number>();
  const columnsByChar = new Map<string, PackerCharacter["columns"]>();
  const seenByChar = new Map<string, Set<string>>();

  for (const char of chars) {
    columnsByChar.set(char.characterId, []);
    seenByChar.set(char.characterId, new Set());
  }

  const rounds = Math.max(1, options.pricingRounds);
  for (let round = 0; round < rounds; round++) {
    for (const char of chars) {
      const result = enumerateBuilds(
        { ...char.config, artifactPrices: prices },
        options.topK
      );
      const columns = columnsByChar.get(char.characterId)!;
      const seen = seenByChar.get(char.characterId)!;
      for (const build of result.builds) {
        const artifactIds = allSlots.map((s) => build.artifacts[s].id);
        const signature = artifactIds.slice().sort().join("|");
        if (seen.has(signature)) continue;
        seen.add(signature);
        columns.push({
          artifactIds,
          score: build.finalScore,
          payload: build,
        });
      }
      columns.sort((a, b) => b.score - a.score);
      if (columns.length > options.maxColumnsPerCharacter) {
        columns.length = options.maxColumnsPerCharacter;
      }
    }
    updateArtifactPrices(columnsByChar, prices, options);
  }

  const packerChars: PackerCharacter[] = chars.map((char) => ({
    characterId: char.characterId,
    columns: columnsByChar.get(char.characterId) ?? [],
  }));

  return packColumnsBeam(packerChars, {
    beamWidth: options.beamWidth,
    repairSweeps: options.repairSweeps,
  });
}

function updateArtifactPrices(
  columnsByChar: Map<string, PackerCharacter["columns"]>,
  prices: Map<string, number>,
  options: PreparedTierOptions
): void {
  const regretsByArtifact = new Map<string, number[]>();

  for (const columns of columnsByChar.values()) {
    if (columns.length === 0) continue;
    const considered = columns.slice(0, Math.min(columns.length, 48));
    const artifactIds = new Set<string>();
    for (const col of considered) {
      for (const id of col.artifactIds) artifactIds.add(id);
    }

    for (const id of artifactIds) {
      let bestWith = Number.NEGATIVE_INFINITY;
      let bestWithout = Number.NEGATIVE_INFINITY;
      for (const col of considered) {
        if (col.artifactIds.includes(id)) {
          bestWith = Math.max(bestWith, col.score);
        } else {
          bestWithout = Math.max(bestWithout, col.score);
        }
      }
      if (bestWith === Number.NEGATIVE_INFINITY) continue;
      if (bestWithout === Number.NEGATIVE_INFINITY) {
        bestWithout = bestWith - PRICE_REGRET_CAP;
      }
      const regret = Math.min(
        PRICE_REGRET_CAP,
        Math.max(0, bestWith - bestWithout)
      );
      if (regret <= 0) continue;
      const regrets = regretsByArtifact.get(id) ?? [];
      regrets.push(regret);
      regretsByArtifact.set(id, regrets);
    }
  }

  for (const [id, oldPrice] of prices) {
    if (!regretsByArtifact.has(id)) {
      const decayed = oldPrice * options.priceDecay;
      if (decayed < 0.01) prices.delete(id);
      else prices.set(id, decayed);
    }
  }

  for (const [id, regrets] of regretsByArtifact) {
    if (regrets.length <= 1) {
      const decayed = (prices.get(id) ?? 0) * options.priceDecay;
      if (decayed < 0.01) prices.delete(id);
      else prices.set(id, decayed);
      continue;
    }
    regrets.sort((a, b) => b - a);
    const losingDemand = regrets.slice(1).reduce((sum, r) => sum + r, 0);
    const next =
      (prices.get(id) ?? 0) * options.priceDecay +
      losingDemand * options.priceStep;
    prices.set(id, Math.min(PRICE_CAP, next));
  }
}
