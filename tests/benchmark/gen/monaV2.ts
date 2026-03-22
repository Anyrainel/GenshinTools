/**
 * Optimizer MonaV2: Faithful reimplementation of Mona's A* V2 algorithm.
 *
 * Source: github.com/wormtql/genshin_artifact — cutoff_algo2.rs (CutoffAlgo2)
 * This is what the Mona UI labels as "A* V2".
 *
 * Algorithm: Unrolled 5-level nested loop with upper-bound pruning at every level.
 * Key features vs Mona A* (mona.ts):
 *   - Weight heuristic pre-sorts artifacts (best candidates first)
 *   - Set mask system instead of recursive set iteration
 *   - factor_a accuracy multiplier for aggressive pruning control
 *   - Explicit outer loop over sands/goblet/circlet main stats
 */

import { artifactHalfSetsById } from "@/data/constants";
import type { ArtifactData } from "@/data/types";
import { allSlots } from "@/data/types";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  OptFailReason,
  ReactionOverride,
  StatKey,
  TeamOptYield,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";
import {
  type ArtifactTuple,
  type PerCharSearchFn,
  type PerCharSearchOpts,
  type PerCharSearchResult,
  TopKCollector,
  createTeamOptimizer,
  diagnoseFailure,
  evaluateBuild,
  evaluateUpperBound,
  getArtifactStats,
  setupCharSearch,
} from "./teamSearch";

// ═══════════════════════════════════════════════════════════════════════
// Weight Heuristic (faithful to weight_heuristic.rs::NaiveWeightHeuristic)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Binary stat weight: for each stat, check if adding a large amount of it
 * increases the target function output. Weight = 1.0 if yes, 0.0 if no.
 */
function computeStatWeights(
  teamBuild: import("@/lib/team-comp/damageCalc").TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcTargetId: string,
  calcContext: CalcContext,
  reactionOverride?: ReactionOverride,
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number
): Map<StatKey, number> {
  const weights = new Map<StatKey, number>();

  // Get baseline score with empty artifacts
  const baseSheet = new StatSheet([]);
  const baseUpdated = { ...baseSheets, [swapCharId]: baseSheet };
  let baseScore: number;
  if (scoreFn) {
    baseScore = scoreFn(baseUpdated, calcTargetId);
  } else {
    const postStats = teamBuild.getTeamStats(
      baseUpdated,
      calcTargetId,
      calcContext
    );
    baseScore = teamBuild.getDamageResult(
      formulaCharId,
      formulaId,
      postStats,
      calcContext,
      reactionOverride
    ).totalDamage;
  }

  // Test each stat type with a large virtual value (10x max substat roll)
  // Mona uses 10× the max roll value per stat type
  const testStats: [StatKey, number][] = [
    ["hp%", 0.5], // ~10× max hp% roll
    ["atk%", 0.5],
    ["def%", 0.6],
    ["cr", 0.35],
    ["cd", 0.7],
    ["em", 200],
    ["er", 0.55],
    ["healB", 0.35],
    ["pyroDB", 0.5],
    ["hydroDB", 0.5],
    ["electroDB", 0.5],
    ["anemoDB", 0.5],
    ["cryoDB", 0.5],
    ["geoDB", 0.5],
    ["dendroDB", 0.5],
    ["physDB", 0.5],
  ];

  for (const [stat, testVal] of testStats) {
    const testRaw: Partial<Record<StatKey, number>> = { [stat]: testVal };
    const testSheet = baseSheet.merge(StatSheet.fromRaw(testRaw));
    const testUpdated = { ...baseSheets, [swapCharId]: testSheet };
    let testScore: number;
    if (scoreFn) {
      testScore = scoreFn(testUpdated, calcTargetId);
    } else {
      const postStats = teamBuild.getTeamStats(
        testUpdated,
        calcTargetId,
        calcContext
      );
      testScore = teamBuild.getDamageResult(
        formulaCharId,
        formulaId,
        postStats,
        calcContext,
        reactionOverride
      ).totalDamage;
    }
    weights.set(stat, testScore > baseScore ? 1.0 : 0.0);
  }

  return weights;
}

/**
 * Score an artifact by its weighted substat efficiency.
 * Used for sorting artifacts within (set, slot, mainStat) groups.
 */
function weightedArtifactScore(
  art: ArtifactData,
  statWeights: Map<StatKey, number>
): number {
  let score = 0;
  const stats = getArtifactStats(art);
  for (const [key, val] of Object.entries(stats)) {
    const w = statWeights.get(key as StatKey) ?? 0;
    score += w * val;
  }
  return score;
}

// ═══════════════════════════════════════════════════════════════════════
// V2 Data Structures
// ═══════════════════════════════════════════════════════════════════════

/** Key for artifact grouping: (setKey, slotIndex, mainStat) */
type GroupKey = string;

function makeGroupKey(
  setKey: string,
  slotIdx: number,
  mainStat: string
): GroupKey {
  return `${setKey}|${slotIdx}|${mainStat}`;
}

function makeGroupKeyNoSet(slotIdx: number, mainStat: string): GroupKey {
  return `*|${slotIdx}|${mainStat}`;
}

interface V2SlotData {
  /** Artifacts grouped by (set, mainStat), sorted by weighted efficiency */
  bySetAndMain: Map<GroupKey, ArtifactData[]>;
  /** Artifacts grouped by mainStat only (ignoring set) */
  byMainOnly: Map<GroupKey, ArtifactData[]>;
  /** Super artifacts per (set, mainStat) group */
  superBySetAndMain: Map<GroupKey, Partial<Record<StatKey, number>>>;
  /** Super artifacts per mainStat (ignoring set) */
  superByMainOnly: Map<GroupKey, Partial<Record<StatKey, number>>>;
  /** All unique main stats for this slot */
  mainStats: string[];
  /** All artifacts for this slot */
  allArtifacts: ArtifactData[];
  /** Cross-set super artifact */
  crossSetSuper: Partial<Record<StatKey, number>>;
}

function buildV2SlotData(
  inventory: ArtifactData[],
  slotIdx: number,
  excludedIds: Set<string> | undefined,
  statWeights: Map<StatKey, number>
): V2SlotData {
  const slot = allSlots[slotIdx];
  const arts = inventory.filter(
    (a) => a.slotKey === slot && (!excludedIds || !excludedIds.has(a.id))
  );

  const bySetAndMain = new Map<GroupKey, ArtifactData[]>();
  const byMainOnly = new Map<GroupKey, ArtifactData[]>();

  for (const art of arts) {
    const gk = makeGroupKey(art.setKey, slotIdx, art.mainStatKey);
    const gkNoSet = makeGroupKeyNoSet(slotIdx, art.mainStatKey);

    let arr = bySetAndMain.get(gk);
    if (!arr) {
      arr = [];
      bySetAndMain.set(gk, arr);
    }
    arr.push(art);

    let arr2 = byMainOnly.get(gkNoSet);
    if (!arr2) {
      arr2 = [];
      byMainOnly.set(gkNoSet, arr2);
    }
    arr2.push(art);
  }

  // Sort each group by weighted efficiency (descending)
  for (const [, group] of bySetAndMain) {
    group.sort(
      (a, b) =>
        weightedArtifactScore(b, statWeights) -
        weightedArtifactScore(a, statWeights)
    );
  }
  for (const [, group] of byMainOnly) {
    group.sort(
      (a, b) =>
        weightedArtifactScore(b, statWeights) -
        weightedArtifactScore(a, statWeights)
    );
  }

  // Build super artifacts per group
  const superBySetAndMain = new Map<
    GroupKey,
    Partial<Record<StatKey, number>>
  >();
  for (const [gk, group] of bySetAndMain) {
    const sup: Partial<Record<StatKey, number>> = {};
    for (const art of group) {
      const s = getArtifactStats(art);
      for (const [k, v] of Object.entries(s)) {
        const sk = k as StatKey;
        sup[sk] = Math.max(sup[sk] ?? 0, v);
      }
    }
    superBySetAndMain.set(gk, sup);
  }

  const superByMainOnly = new Map<GroupKey, Partial<Record<StatKey, number>>>();
  for (const [gk, group] of byMainOnly) {
    const sup: Partial<Record<StatKey, number>> = {};
    for (const art of group) {
      const s = getArtifactStats(art);
      for (const [k, v] of Object.entries(s)) {
        const sk = k as StatKey;
        sup[sk] = Math.max(sup[sk] ?? 0, v);
      }
    }
    superByMainOnly.set(gk, sup);
  }

  // Main stats available for this slot, sorted by weight
  const mainStatSet = new Set<string>();
  for (const art of arts) mainStatSet.add(art.mainStatKey);
  const mainStats = [...mainStatSet].sort((a, b) => {
    const wa = statWeights.get(a as StatKey) ?? 0;
    const wb = statWeights.get(b as StatKey) ?? 0;
    return wb - wa;
  });

  // Cross-set super
  const crossSetSuper: Partial<Record<StatKey, number>> = {};
  for (const art of arts) {
    const s = getArtifactStats(art);
    for (const [k, v] of Object.entries(s)) {
      const sk = k as StatKey;
      crossSetSuper[sk] = Math.max(crossSetSuper[sk] ?? 0, v);
    }
  }

  return {
    bySetAndMain,
    byMainOnly,
    superBySetAndMain,
    superByMainOnly,
    mainStats,
    allArtifacts: arts,
    crossSetSuper,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Unrolled 5-Level Nested Loop (faithful to cutoff_algo2.rs::do_iter)
// ═══════════════════════════════════════════════════════════════════════

interface V2Context {
  teamBuild: TeamBuild;
  swapCharId: string;
  formulaCharId: string;
  formulaId: string;
  baseSheets: Record<string, StatSheet>;
  calcTargetId: string;
  calcContext: CalcContext;
  erCheckCharId: string;
  minEr: number;
  minCr: number;
  reactionOverride?: ReactionOverride;
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number;
  collector: TopKCollector;
  evaluations: number;
  factorA: number;
  deadline?: number;
  aborted?: boolean;
}

function evalUpperBound(
  realPieces: (ArtifactData | null)[],
  superStats: Partial<Record<StatKey, number>>[],
  ctx: V2Context
): number {
  return evaluateUpperBound(
    realPieces,
    superStats,
    ctx.teamBuild,
    ctx.swapCharId,
    ctx.formulaCharId,
    ctx.formulaId,
    ctx.baseSheets,
    ctx.calcTargetId,
    ctx.calcContext,
    ctx.reactionOverride,
    ctx.scoreFn
  );
}

/**
 * Unrolled 5-deep nested loop. At each level, replace one super artifact
 * with a real artifact and check if the upper bound beats current_least.
 */
function doIter(
  slot0Arts: ArtifactData[],
  slot1Arts: ArtifactData[],
  slot2Arts: ArtifactData[],
  slot3Arts: ArtifactData[],
  slot4Arts: ArtifactData[],
  superStats: Partial<Record<StatKey, number>>[],
  ctx: V2Context
): void {
  const { collector, factorA } = ctx;
  const threshold = () => collector.threshold;

  for (let i0 = 0; i0 < slot0Arts.length; i0++) {
    if (ctx.aborted) return;
    if (
      ctx.deadline &&
      ctx.evaluations % 2000 === 0 &&
      performance.now() > ctx.deadline
    ) {
      ctx.aborted = true;
      return;
    }

    const art0 = slot0Arts[i0];
    const art0Stats = getArtifactStats(art0);

    // Upper bound: [real0, super1, super2, super3, super4]
    ctx.evaluations++;
    const ub0 = evalUpperBound(
      [art0],
      [superStats[1], superStats[2], superStats[3], superStats[4]],
      ctx
    );
    if (threshold() > 0 && ub0 * factorA <= threshold()) continue;

    for (let i1 = 0; i1 < slot1Arts.length; i1++) {
      if (ctx.aborted) return;

      const art1 = slot1Arts[i1];

      // Upper bound: [real0, real1, super2, super3, super4]
      ctx.evaluations++;
      const ub1 = evalUpperBound(
        [art0, art1],
        [superStats[2], superStats[3], superStats[4]],
        ctx
      );
      if (threshold() > 0 && ub1 * factorA <= threshold()) continue;

      for (let i2 = 0; i2 < slot2Arts.length; i2++) {
        if (ctx.aborted) return;
        if (
          ctx.deadline &&
          ctx.evaluations % 2000 === 0 &&
          performance.now() > ctx.deadline
        ) {
          ctx.aborted = true;
          return;
        }

        const art2 = slot2Arts[i2];

        // Upper bound: [real0, real1, real2, super3, super4]
        ctx.evaluations++;
        const ub2 = evalUpperBound(
          [art0, art1, art2],
          [superStats[3], superStats[4]],
          ctx
        );
        if (threshold() > 0 && ub2 * factorA <= threshold()) continue;

        for (let i3 = 0; i3 < slot3Arts.length; i3++) {
          if (ctx.aborted) return;

          const art3 = slot3Arts[i3];

          // Upper bound: [real0, real1, real2, real3, super4]
          ctx.evaluations++;
          const ub3 = evalUpperBound(
            [art0, art1, art2, art3],
            [superStats[4]],
            ctx
          );
          if (threshold() > 0 && ub3 * factorA <= threshold()) continue;

          for (let i4 = 0; i4 < slot4Arts.length; i4++) {
            if (ctx.aborted) return;

            const art4 = slot4Arts[i4];
            const arts: ArtifactTuple = [art0, art1, art2, art3, art4];

            const { damage, result } = evaluateBuild(
              arts,
              ctx.teamBuild,
              ctx.swapCharId,
              ctx.formulaCharId,
              ctx.formulaId,
              ctx.baseSheets,
              ctx.calcTargetId,
              ctx.calcContext,
              ctx.erCheckCharId,
              ctx.minEr,
              ctx.minCr,
              ctx.reactionOverride,
              ctx.scoreFn
            );
            ctx.evaluations++;
            collector.add(damage, result, arts);
          }
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Set Mask Iteration (faithful to cutoff_algo2.rs::iter_set)
// ═══════════════════════════════════════════════════════════════════════

/**
 * For a given set mask and main-stat combination, build the artifact lists
 * and super artifacts for each slot, then run doIter.
 */
function iterSet(
  mask: number[],
  mainStats: [string, string, string, string, string],
  v2Slots: V2SlotData[],
  ctx: V2Context,
  set1Key?: string,
  set2Key?: string
): void {
  if (ctx.aborted) return;

  const slotArts: ArtifactData[][] = [];
  const slotSupers: Partial<Record<StatKey, number>>[] = [];

  for (let s = 0; s < 5; s++) {
    const sd = v2Slots[s];
    const ms = mainStats[s];

    if (mask[s] === 0) {
      // Flex: use all artifacts with this main stat (set-agnostic)
      const gk = makeGroupKeyNoSet(s, ms);
      const arts = sd.byMainOnly.get(gk) ?? [];
      const sup = sd.superByMainOnly.get(gk) ?? {};
      if (arts.length === 0) return; // no artifacts for this main stat
      slotArts.push(arts);
      slotSupers.push(sup);
    } else {
      // Constrained: must be set1 or set2
      const setKey = mask[s] === 1 ? set1Key! : set2Key!;
      const gk = makeGroupKey(setKey, s, ms);
      const arts = sd.bySetAndMain.get(gk) ?? [];
      const sup = sd.superBySetAndMain.get(gk) ?? {};
      if (arts.length === 0) return; // no matching artifacts
      slotArts.push(arts);
      slotSupers.push(sup);
    }
  }

  // Pre-check: if full super-artifact upper bound doesn't beat threshold, skip
  ctx.evaluations++;
  const fullUB = evalUpperBound([], slotSupers, ctx);
  if (
    ctx.collector.threshold > 0 &&
    fullUB * ctx.factorA <= ctx.collector.threshold
  )
    return;

  doIter(
    slotArts[0],
    slotArts[1],
    slotArts[2],
    slotArts[3],
    slotArts[4],
    slotSupers,
    ctx
  );
}

/**
 * Iterate over all main-stat combinations for slots 2/3/4 (sands/goblet/circlet).
 * Slots 0/1 (flower/plume) have fixed main stats.
 */
function iterMainStats(
  mask: number[],
  v2Slots: V2SlotData[],
  ctx: V2Context,
  set1Key?: string,
  set2Key?: string
): void {
  // Flower always has hp, Plume always has atk
  const flowerMain = "hp";
  const plumeMain = "atk";

  // Variable slots: sands (2), goblet (3), circlet (4)
  const sandsStats = v2Slots[2].mainStats;
  const gobletStats = v2Slots[3].mainStats;
  const circletStats = v2Slots[4].mainStats;

  for (const sandMs of sandsStats) {
    if (ctx.aborted) break;
    for (const gobletMs of gobletStats) {
      if (ctx.aborted) break;
      for (const circletMs of circletStats) {
        if (ctx.aborted) break;
        const mainStats: [string, string, string, string, string] = [
          flowerMain,
          plumeMain,
          sandMs,
          gobletMs,
          circletMs,
        ];
        iterSet(mask, mainStats, v2Slots, ctx, set1Key, set2Key);
      }
    }
  }
}

// ─── Set Mask Definitions ───

const V2_SET4_MASKS: number[][] = [
  [0, 1, 1, 1, 1],
  [1, 0, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 0, 1],
  [1, 1, 1, 1, 0],
];

// 30 masks for 2+2: 2 slots set1, 2 slots set2, 1 flex
const V2_SET22_MASKS: number[][] = (() => {
  const masks: number[][] = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const rem = [0, 1, 2, 3, 4].filter((x) => x !== i && x !== j);
      for (let ri = 0; ri < rem.length; ri++) {
        for (let rj = ri + 1; rj < rem.length; rj++) {
          const m = [0, 0, 0, 0, 0];
          m[i] = 1;
          m[j] = 1;
          m[rem[ri]] = 2;
          m[rem[rj]] = 2;
          masks.push(m);
        }
      }
    }
  }
  return masks;
})();

// 10 masks for 2pc: 2 slots constrained, 3 flex
const V2_SET2_MASKS: number[][] = (() => {
  const masks: number[][] = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const m = [0, 0, 0, 0, 0];
      m[i] = 1;
      m[j] = 1;
      masks.push(m);
    }
  }
  return masks;
})();

// ═══════════════════════════════════════════════════════════════════════
// Single-Character MonaV2 Runner
// ═══════════════════════════════════════════════════════════════════════

function runCharacterMonaV2(opts: PerCharSearchOpts): PerCharSearchResult {
  const {
    charId,
    charConfig,
    teamBuild,
    carryCharId,
    formulaId,
    inventory,
    calcContext,
    baseSheets,
    excludedIds,
    reactionOverride,
    scoreFn,
    topK,
    deadline,
  } = opts;

  const setupResult = setupCharSearch(opts);
  if (setupResult.failReason) {
    return {
      collector: new TopKCollector(topK),
      evaluations: 0,
      failReason: setupResult.failReason,
    };
  }
  const { slotData, erFloor, crFloor, is4pc, is2pc, collector } =
    setupResult.setup;

  // Compute stat weights via heuristic
  const statWeights = computeStatWeights(
    teamBuild,
    charId,
    carryCharId,
    formulaId,
    baseSheets,
    carryCharId,
    calcContext,
    reactionOverride,
    scoreFn
  );

  // Build V2-style slot data
  const v2Slots: V2SlotData[] = [];
  for (let s = 0; s < 5; s++) {
    v2Slots.push(buildV2SlotData(inventory, s, excludedIds, statWeights));
  }

  const ctx: V2Context = {
    teamBuild,
    swapCharId: charId,
    formulaCharId: carryCharId,
    formulaId,
    baseSheets,
    calcTargetId: carryCharId,
    calcContext,
    erCheckCharId: charId,
    minEr: charConfig.minEr,
    minCr: charConfig.minCr,
    reactionOverride,
    scoreFn,
    collector,
    evaluations: 0,
    factorA: 1.0, // exact mode (no aggressive pruning)
    deadline,
  };

  if (is4pc) {
    for (const mask of V2_SET4_MASKS) {
      if (ctx.aborted) break;
      iterMainStats(mask, v2Slots, ctx, charConfig.artifactSetId!);
    }
  } else if (is2pc) {
    const [h1, h2] = charConfig.artifactHalfSetIds as [string, string];
    const h1Keys = artifactHalfSetsById[h1]?.setIds ?? [];
    const h2Keys = artifactHalfSetsById[h2]?.setIds ?? [];

    for (const mask of V2_SET22_MASKS) {
      if (ctx.aborted) break;
      if (h1 === h2) {
        for (let i = 0; i < h1Keys.length && !ctx.aborted; i++) {
          for (let j = i + 1; j < h1Keys.length && !ctx.aborted; j++) {
            iterMainStats(mask, v2Slots, ctx, h1Keys[i], h1Keys[j]);
          }
        }
      } else {
        for (const sk1 of h1Keys) {
          if (ctx.aborted) break;
          for (const sk2 of h2Keys) {
            if (ctx.aborted) break;
            iterMainStats(mask, v2Slots, ctx, sk1, sk2);
          }
        }
        for (const sk1 of h2Keys) {
          if (ctx.aborted) break;
          for (const sk2 of h1Keys) {
            if (ctx.aborted) break;
            iterMainStats(mask, v2Slots, ctx, sk1, sk2);
          }
        }
      }
    }
  } else {
    // No set constraint: exhaustive (same as Mona A*)
    const allSetKeys = new Set<string>();
    for (const sd of v2Slots) {
      for (const [gk] of sd.bySetAndMain) {
        const setKey = gk.split("|")[0];
        allSetKeys.add(setKey);
      }
    }
    const setKeyArr = [...allSetKeys];

    // do4: try every set as 4pc
    for (const setKey of setKeyArr) {
      if (ctx.aborted) break;
      let slotsWithSet = 0;
      for (let s = 0; s < 5; s++) {
        let hasSet = false;
        for (const [gk] of v2Slots[s].bySetAndMain) {
          if (gk.startsWith(setKey + "|")) {
            hasSet = true;
            break;
          }
        }
        if (hasSet) slotsWithSet++;
      }
      if (slotsWithSet < 4) continue;
      for (const mask of V2_SET4_MASKS) {
        if (ctx.aborted) break;
        iterMainStats(mask, v2Slots, ctx, setKey);
      }
    }

    // do22: every pair of sets
    for (let i = 0; i < setKeyArr.length && !ctx.aborted; i++) {
      for (let j = i + 1; j < setKeyArr.length && !ctx.aborted; j++) {
        const s1 = setKeyArr[i];
        const s2 = setKeyArr[j];
        let slots1 = 0;
        let slots2 = 0;
        for (let s = 0; s < 5; s++) {
          let has1 = false;
          let has2 = false;
          for (const [gk] of v2Slots[s].bySetAndMain) {
            const sk = gk.split("|")[0];
            if (sk === s1) has1 = true;
            if (sk === s2) has2 = true;
          }
          if (has1) slots1++;
          if (has2) slots2++;
        }
        if (slots1 < 2 || slots2 < 2) continue;
        for (const mask of V2_SET22_MASKS) {
          if (ctx.aborted) break;
          iterMainStats(mask, v2Slots, ctx, s1, s2);
        }
      }
    }

    // do2: every set as 2pc
    for (const setKey of setKeyArr) {
      if (ctx.aborted) break;
      let slotsWithSet = 0;
      for (let s = 0; s < 5; s++) {
        let hasSet = false;
        for (const [gk] of v2Slots[s].bySetAndMain) {
          if (gk.startsWith(setKey + "|")) {
            hasSet = true;
            break;
          }
        }
        if (hasSet) slotsWithSet++;
      }
      if (slotsWithSet < 2) continue;
      for (const mask of V2_SET2_MASKS) {
        if (ctx.aborted) break;
        iterMainStats(mask, v2Slots, ctx, setKey);
      }
    }

    // do_any: rainbow
    if (!ctx.aborted) {
      iterMainStats([0, 0, 0, 0, 0], v2Slots, ctx);
    }
  }

  let failReason: OptFailReason | undefined;
  if (collector.best == null || collector.best.damage <= 0) {
    failReason = diagnoseFailure(
      charConfig,
      slotData,
      erFloor,
      crFloor,
      ctx.evaluations
    );
  }

  return { collector, evaluations: ctx.evaluations, failReason };
}

// ═══════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════

export const runTeamOptimization: (
  opts: TeamOptimizerOptions
) => AsyncGenerator<TeamOptYield> = createTeamOptimizer(
  runCharacterMonaV2 as PerCharSearchFn
);
