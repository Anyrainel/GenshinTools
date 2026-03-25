/**
 * Optimizer Mona: Faithful reimplementation of Mona's A* algorithm.
 *
 * Source: github.com/wormtql/genshin_artifact — cutoff_a_star.rs (AStarCutoff)
 * This is what the Mona UI labels as "A*" (confusingly, internally called "Naive").
 *
 * Algorithm: Recursive depth-first branch-and-bound over 5 artifact slots.
 * Key features vs our A* (astar.ts):
 *   - Recursive DFS (not best-first priority queue)
 *   - Two-level pruning: set-group level, then individual artifact level
 *   - Slots sorted by group size (ascending) for tighter early pruning
 *   - No per-slot artifact cap (searches all artifacts in each group)
 *   - Exhaustive set combination iteration (no heuristic subset)
 */

import { artifactHalfSetsById } from "@/data/constants";
import type { ArtifactData } from "@/data/types";
import { type TeamBuild, hasOffFieldParts } from "@/lib/team-comp/damageCalc";
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
// Super Artifact Construction (per set group)
// ═══════════════════════════════════════════════════════════════════════

interface SlotSetGroup {
  setKey: string;
  artifacts: ArtifactData[];
  superStats: Partial<Record<StatKey, number>>;
}

interface MonaSlotData {
  /** All set groups for this slot. */
  groups: SlotSetGroup[];
  /** Cross-set super artifact (upper bound ignoring set). */
  crossSetSuperStats: Partial<Record<StatKey, number>>;
  /** Total artifact count across all groups. */
  totalCount: number;
}

function buildMonaSlotData(
  inventory: ArtifactData[],
  slot: string,
  excludedIds: Set<string> | undefined
): MonaSlotData {
  const arts = inventory.filter(
    (a) => a.slotKey === slot && (!excludedIds || !excludedIds.has(a.id))
  );

  const bySet = new Map<string, ArtifactData[]>();
  for (const art of arts) {
    const arr = bySet.get(art.setKey);
    if (arr) arr.push(art);
    else bySet.set(art.setKey, [art]);
  }

  const groups: SlotSetGroup[] = [];
  for (const [setKey, setArts] of bySet) {
    // Build super artifact: component-wise max of all stats
    const superStats: Partial<Record<StatKey, number>> = {};
    for (const art of setArts) {
      const s = getArtifactStats(art);
      for (const [key, val] of Object.entries(s)) {
        const sk = key as StatKey;
        superStats[sk] = Math.max(superStats[sk] ?? 0, val);
      }
    }
    groups.push({ setKey, artifacts: setArts, superStats });
  }

  // Cross-set super: max across ALL artifacts regardless of set
  const crossSetSuperStats: Partial<Record<StatKey, number>> = {};
  for (const art of arts) {
    const s = getArtifactStats(art);
    for (const [key, val] of Object.entries(s)) {
      const sk = key as StatKey;
      crossSetSuperStats[sk] = Math.max(crossSetSuperStats[sk] ?? 0, val);
    }
  }

  return { groups, crossSetSuperStats, totalCount: arts.length };
}

// ═══════════════════════════════════════════════════════════════════════
// Recursive DFS Branch-and-Bound
// ═══════════════════════════════════════════════════════════════════════

interface MonaContext {
  teamBuild: TeamBuild;
  swapCharId: string;
  formulaCharId: string;
  formulaId: string;
  baseSheets: Record<string, StatSheet>;
  onFieldCharId: string;
  calcContext: CalcContext;
  erCheckCharId: string;
  minEr: number;
  minCr: number;
  reactionOverride?: ReactionOverride;
  scoreFn?: (
    sheets: Record<string, StatSheet>,
    onFieldCharId: string
  ) => number;
  collector: TopKCollector;
  evaluations: number;
  deadline?: number;
  aborted?: boolean;
}

/**
 * check_hope: Full evaluation using a mix of real artifacts (for decided slots)
 * and super-artifact stats (for undecided slots). Returns the optimistic score.
 *
 * upperArts[i] contains either:
 *   - A real artifact's stats (for slots already decided)
 *   - A super artifact's stats (for slots not yet decided)
 */
function checkHope(
  upperStats: Partial<Record<StatKey, number>>[],
  ctx: MonaContext
): number {
  // Build a merged stat sheet from the 5 stat entries
  // Some are real artifact stats, some are super artifact stats
  const realArts: ArtifactData[] = []; // none — we pass stats directly
  let sheet = StatSheet.fromArtifacts(realArts);
  for (const ss of upperStats) {
    if (Object.keys(ss).length > 0) {
      sheet = sheet.merge(StatSheet.fromRaw(ss));
    }
  }
  const updatedSheets = { ...ctx.baseSheets, [ctx.swapCharId]: sheet };
  if (ctx.scoreFn) return ctx.scoreFn(updatedSheets, ctx.onFieldCharId);

  const { teamBuild, formulaCharId, formulaId, onFieldCharId, calcContext } =
    ctx;
  const postStats = teamBuild.getTeamStats(
    updatedSheets,
    onFieldCharId,
    calcContext
  );

  let offFieldStats: Record<string, StatSheet> | undefined;
  if (hasOffFieldParts(teamBuild, formulaCharId, formulaId)) {
    const otherCharId = Object.keys(teamBuild.charBuilds).find(
      (id) => id !== formulaCharId
    );
    if (otherCharId) {
      offFieldStats = teamBuild.getTeamStats(
        updatedSheets,
        otherCharId,
        calcContext
      );
    }
  }

  return teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext,
    ctx.reactionOverride,
    offFieldStats
  ).totalDamage;
}

/**
 * Core recursive search. Faithful to cutoff_a_star.rs::do_enumerate_recursive.
 *
 * @param slotOrder - Indices into slotData, sorted by group size (ascending)
 * @param slotData  - Per-slot groups (set-constrained or flex)
 * @param upperStats - Current upper-bound stats array (5 entries, mix of real/super)
 * @param depth     - Current recursion depth (0..5)
 */
function enumerateRecursive(
  slotOrder: number[],
  slotGroups: SlotSetGroup[][],
  slotFlexSuperStats: Partial<Record<StatKey, number>>[],
  upperStats: Partial<Record<StatKey, number>>[],
  realArts: ArtifactTuple,
  depth: number,
  ctx: MonaContext
): void {
  if (ctx.aborted) return;
  if (ctx.deadline && ctx.evaluations % 2000 === 0) {
    if (performance.now() > ctx.deadline) {
      ctx.aborted = true;
      return;
    }
  }

  if (depth === 5) {
    // All 5 slots assigned — evaluate actual damage
    const { damage, result } = evaluateBuild(
      realArts,
      ctx.teamBuild,
      ctx.swapCharId,
      ctx.formulaCharId,
      ctx.formulaId,
      ctx.baseSheets,
      ctx.onFieldCharId,
      ctx.calcContext,
      ctx.erCheckCharId,
      ctx.minEr,
      ctx.minCr,
      ctx.reactionOverride,
      ctx.scoreFn
    );
    ctx.collector.add(damage, result, realArts);
    ctx.evaluations++;
    return;
  }

  const slotIdx = slotOrder[depth];
  const groups = slotGroups[slotIdx];
  const savedStats = upperStats[slotIdx];

  for (const group of groups) {
    if (ctx.aborted) return;

    // SET-LEVEL PRUNE: replace slot's stats with set's super artifact
    upperStats[slotIdx] = group.superStats;
    ctx.evaluations++;
    const setUB = checkHope(upperStats, ctx);
    if (ctx.collector.threshold > 0 && setUB <= ctx.collector.threshold) {
      continue; // skip entire set group
    }

    // Iterate individual artifacts in this set group
    for (const art of group.artifacts) {
      if (ctx.aborted) return;

      // ARTIFACT-LEVEL PRUNE: replace with real artifact stats
      const artStats = getArtifactStats(art);
      upperStats[slotIdx] = artStats;
      ctx.evaluations++;
      const artUB = checkHope(upperStats, ctx);
      if (ctx.collector.threshold > 0 && artUB <= ctx.collector.threshold) {
        continue;
      }

      // Assign this artifact
      realArts[slotIdx] = art;

      if (depth === 4) {
        // Last slot — record result directly (already evaluated via artUB check above,
        // but we need the constrained evaluation)
        const { damage, result } = evaluateBuild(
          realArts,
          ctx.teamBuild,
          ctx.swapCharId,
          ctx.formulaCharId,
          ctx.formulaId,
          ctx.baseSheets,
          ctx.onFieldCharId,
          ctx.calcContext,
          ctx.erCheckCharId,
          ctx.minEr,
          ctx.minCr,
          ctx.reactionOverride,
          ctx.scoreFn
        );
        ctx.collector.add(damage, result, [...realArts] as ArtifactTuple);
        ctx.evaluations++;
      } else {
        enumerateRecursive(
          slotOrder,
          slotGroups,
          slotFlexSuperStats,
          upperStats,
          realArts,
          depth + 1,
          ctx
        );
      }

      realArts[slotIdx] = null;
    }
  }

  // Restore
  upperStats[slotIdx] = savedStats;
}

// ═══════════════════════════════════════════════════════════════════════
// Set Pattern Execution
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build slot groups for a given set mask pattern.
 * mask[i] = 0: flex (all sets), 1: must be set1, 2: must be set2
 *
 * Returns null if any constrained slot has no artifacts for its required set.
 */
function buildMonaSlotGroups(
  mask: number[],
  allSlotData: MonaSlotData[],
  set1Key?: string,
  set2Key?: string
): {
  groups: SlotSetGroup[][];
  flexSupers: Partial<Record<StatKey, number>>[];
} | null {
  const groups: SlotSetGroup[][] = [];
  const flexSupers: Partial<Record<StatKey, number>>[] = [];

  for (let s = 0; s < 5; s++) {
    const sd = allSlotData[s];
    if (mask[s] === 0) {
      // Flex: all set groups
      groups.push(sd.groups);
      flexSupers.push(sd.crossSetSuperStats);
    } else {
      const requiredSet = mask[s] === 1 ? set1Key! : set2Key!;
      const matching = sd.groups.filter((g) => g.setKey === requiredSet);
      if (matching.length === 0) return null; // infeasible
      groups.push(matching);
      // For constrained slots, super is just the matching set's super
      const setSuper: Partial<Record<StatKey, number>> = {};
      for (const g of matching) {
        for (const [k, v] of Object.entries(g.superStats)) {
          const sk = k as StatKey;
          setSuper[sk] = Math.max(setSuper[sk] ?? 0, v);
        }
      }
      flexSupers.push(setSuper);
    }
  }

  return { groups, flexSupers };
}

function runMonaSearch(
  mask: number[],
  allSlotData: MonaSlotData[],
  ctx: MonaContext,
  set1Key?: string,
  set2Key?: string
): void {
  if (ctx.aborted) return;

  const built = buildMonaSlotGroups(mask, allSlotData, set1Key, set2Key);
  if (!built) return;

  const { groups, flexSupers } = built;

  // Sort slots by total artifact count (ascending) — Mona's key optimization
  const slotOrder = [0, 1, 2, 3, 4].sort((a, b) => {
    let countA = 0;
    let countB = 0;
    for (const g of groups[a]) countA += g.artifacts.length;
    for (const g of groups[b]) countB += g.artifacts.length;
    return countA - countB;
  });

  // Initial upper stats: all super artifacts
  const upperStats = flexSupers.map((s) => ({ ...s }));

  // Check if this pattern is worth searching at all
  ctx.evaluations++;
  const patternUB = checkHope(upperStats, ctx);
  if (ctx.collector.threshold > 0 && patternUB <= ctx.collector.threshold) {
    return;
  }

  const realArts: ArtifactTuple = [null, null, null, null, null];

  enumerateRecursive(
    slotOrder,
    groups,
    flexSupers,
    upperStats,
    realArts,
    0,
    ctx
  );
}

// ─── 4pc Masks ───
const MONA_SET4_MASKS: number[][] = [
  [0, 1, 1, 1, 1],
  [1, 0, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 0, 1],
  [1, 1, 1, 1, 0],
];

// ─── 2+2 Masks ───
const MONA_SET22_MASKS: number[][] = (() => {
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

// ─── 2pc Masks ───
const MONA_SET2_MASKS: number[][] = (() => {
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
// Single-Character Mona A* Runner
// ═══════════════════════════════════════════════════════════════════════

function runCharacterMona(opts: PerCharSearchOpts): PerCharSearchResult {
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

  // Build Mona-style slot data (grouped by set, with per-set super artifacts)
  const monaSlotData: MonaSlotData[] = [];
  for (let s = 0; s < 5; s++) {
    const sd = slotData[s];
    const groups: SlotSetGroup[] = [];
    for (const [setKey, setArts] of sd.bySet) {
      const superStats: Partial<Record<StatKey, number>> = {};
      for (const art of setArts) {
        const st = getArtifactStats(art);
        for (const [key, val] of Object.entries(st)) {
          const sk = key as StatKey;
          superStats[sk] = Math.max(superStats[sk] ?? 0, val);
        }
      }
      groups.push({ setKey, artifacts: setArts, superStats });
    }
    const crossSetSuperStats: Partial<Record<StatKey, number>> = {};
    for (const art of sd.allArtifacts) {
      const st = getArtifactStats(art);
      for (const [key, val] of Object.entries(st)) {
        const sk = key as StatKey;
        crossSetSuperStats[sk] = Math.max(crossSetSuperStats[sk] ?? 0, val);
      }
    }
    monaSlotData.push({
      groups,
      crossSetSuperStats,
      totalCount: sd.allArtifacts.length,
    });
  }

  const ctx: MonaContext = {
    teamBuild,
    swapCharId: charId,
    formulaCharId: carryCharId,
    formulaId,
    baseSheets,
    onFieldCharId: carryCharId,
    calcContext,
    erCheckCharId: charId,
    minEr: charConfig.minEr,
    minCr: charConfig.minCr,
    reactionOverride,
    scoreFn,
    collector,
    evaluations: 0,
    deadline,
  };

  if (is4pc) {
    // 4-piece set: 5 masks (one flex slot)
    for (const mask of MONA_SET4_MASKS) {
      if (ctx.aborted) break;
      runMonaSearch(mask, monaSlotData, ctx, charConfig.artifactSetId!);
    }
  } else if (is2pc) {
    // 2+2: iterate all set-key combinations for both half-sets
    const [h1, h2] = charConfig.artifactHalfSetIds as [string, string];
    const h1Keys = artifactHalfSetsById[h1]?.setIds ?? [];
    const h2Keys = artifactHalfSetsById[h2]?.setIds ?? [];

    for (const mask of MONA_SET22_MASKS) {
      if (ctx.aborted) break;
      if (h1 === h2) {
        // Same half-set: upper triangle to avoid duplicates
        for (let i = 0; i < h1Keys.length && !ctx.aborted; i++) {
          for (let j = i + 1; j < h1Keys.length && !ctx.aborted; j++) {
            runMonaSearch(mask, monaSlotData, ctx, h1Keys[i], h1Keys[j]);
          }
        }
      } else {
        for (const sk1 of h1Keys) {
          if (ctx.aborted) break;
          for (const sk2 of h2Keys) {
            if (ctx.aborted) break;
            runMonaSearch(mask, monaSlotData, ctx, sk1, sk2);
          }
        }
        for (const sk1 of h2Keys) {
          if (ctx.aborted) break;
          for (const sk2 of h1Keys) {
            if (ctx.aborted) break;
            runMonaSearch(mask, monaSlotData, ctx, sk1, sk2);
          }
        }
      }
    }
  } else {
    // No set constraint: exhaustive iteration over all possible set combos
    // (faithful to Mona: tries all 4pc, all 2+2, all 2pc, and rainbow)
    const allSetKeys = new Set<string>();
    for (const sd of monaSlotData) {
      for (const g of sd.groups) allSetKeys.add(g.setKey);
    }
    const setKeyArr = [...allSetKeys];

    // do4: try every set as 4pc
    for (const setKey of setKeyArr) {
      if (ctx.aborted) break;
      // Check feasibility: need at least 4 slots with this set
      let slotsWithSet = 0;
      for (const sd of monaSlotData) {
        if (sd.groups.some((g) => g.setKey === setKey)) slotsWithSet++;
      }
      if (slotsWithSet < 4) continue;
      for (const mask of MONA_SET4_MASKS) {
        if (ctx.aborted) break;
        runMonaSearch(mask, monaSlotData, ctx, setKey);
      }
    }

    // do22: try every pair of sets as 2+2
    for (let i = 0; i < setKeyArr.length && !ctx.aborted; i++) {
      for (let j = i + 1; j < setKeyArr.length && !ctx.aborted; j++) {
        const s1 = setKeyArr[i];
        const s2 = setKeyArr[j];
        // Check feasibility
        let slots1 = 0;
        let slots2 = 0;
        for (const sd of monaSlotData) {
          if (sd.groups.some((g) => g.setKey === s1)) slots1++;
          if (sd.groups.some((g) => g.setKey === s2)) slots2++;
        }
        if (slots1 < 2 || slots2 < 2) continue;
        for (const mask of MONA_SET22_MASKS) {
          if (ctx.aborted) break;
          runMonaSearch(mask, monaSlotData, ctx, s1, s2);
        }
      }
    }

    // do2: try every set as 2pc (3 flex slots)
    for (const setKey of setKeyArr) {
      if (ctx.aborted) break;
      let slotsWithSet = 0;
      for (const sd of monaSlotData) {
        if (sd.groups.some((g) => g.setKey === setKey)) slotsWithSet++;
      }
      if (slotsWithSet < 2) continue;
      for (const mask of MONA_SET2_MASKS) {
        if (ctx.aborted) break;
        runMonaSearch(mask, monaSlotData, ctx, setKey);
      }
    }

    // do_any: rainbow (no set constraint at all)
    if (!ctx.aborted) {
      runMonaSearch([0, 0, 0, 0, 0], monaSlotData, ctx);
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
  runCharacterMona as PerCharSearchFn
);
