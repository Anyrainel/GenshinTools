/**
 * Character-level Branch-and-Bound optimizer.
 *
 * Extracted from optimizerV2.ts — contains the per-character B&B search
 * including set composition patterns, core DFS, and the runCharacterBnB entry point.
 */

import { artifactHalfSetsById, artifactIdToHalfSetId } from "@/data/constants";
import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import { allSlots } from "@/data/types";
import type { OptimizerContext, TeamBuild } from "../damageCalc";
import { StatSheet } from "../damageModels";
import {
  type ArtifactVarLookup,
  type CompiledTeamDamage,
  buildArtifactVarLookup,
  compileTeamDamage,
} from "../formulaCompiler";
import type {
  CalcContext,
  DamageResult,
  OptFailReason,
  PerCharConfig,
  ReactionOverride,
  StatKey,
} from "../types";
import {
  computeMarginalScore,
  computeWeightScore,
  getArtifactCr,
  getArtifactEr,
  prepareSlotData,
  withResortedSlotData,
} from "./artifactScoring";
import {
  evaluateBuild,
  evaluateBuildCompiled,
  evaluateUpperBound,
  evaluateUpperBoundCompiled,
} from "./evaluation";
import { computeMarginalWeights } from "./marginalWeights";
import { TopKCollector } from "./topKCollector";
import type {
  ArtifactTuple,
  BnBContext,
  MarginalWeights,
  PreparedSlotData,
  SuperArtifact,
} from "./types";

// ─── Set Composition Patterns ───

const SET4_PATTERNS: number[][] = [
  [0, 1, 1, 1, 1],
  [1, 0, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 0, 1],
  [1, 1, 1, 1, 0],
];

const SET22_PATTERNS: number[][] = (() => {
  const patterns: number[][] = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const rem = [0, 1, 2, 3, 4].filter((x) => x !== i && x !== j);
      for (let ri = 0; ri < rem.length; ri++) {
        for (let rj = ri + 1; rj < rem.length; rj++) {
          const p = [0, 0, 0, 0, 0];
          p[i] = 1;
          p[j] = 1;
          p[rem[ri]] = 2;
          p[rem[rj]] = 2;
          patterns.push(p);
        }
      }
    }
  }
  return patterns;
})();

// ─── Core B&B DFS ───

function bnbDfs(
  slotGroups: ArtifactData[][],
  slotSupers: SuperArtifact[],
  ctx: BnBContext
): void {
  const { minEr, minCr, erFloor, crFloor, collector } = ctx;
  const needEr = minEr > 0;
  const needCr = minCr > 0;

  const suffixMaxEr = new Float64Array(6);
  const suffixMaxCr = new Float64Array(6);
  for (let s = 4; s >= 0; s--) {
    suffixMaxEr[s] = suffixMaxEr[s + 1] + slotSupers[s].maxEr;
    suffixMaxCr[s] = suffixMaxCr[s + 1] + slotSupers[s].maxCr;
  }
  const superStatsBySlot = slotSupers.map((s) => s.stats);
  const pieces: ArtifactTuple = [null, null, null, null, null];
  // Pre-allocated array for upper bound remaining stats (reused to avoid allocation in hot loop)
  const ubRemaining: Partial<Record<StatKey, number>>[] = new Array(4);

  function dfs(depth: number, cumEr: number, cumCr: number): void {
    if (ctx.aborted) return;
    if (ctx.deadline && ctx.evaluations % 1000 === 0) {
      if (performance.now() > ctx.deadline) {
        ctx.aborted = true;
        return;
      }
    }
    if (depth === 5) {
      if (ctx.compiled && ctx.compiledVars && ctx.compiledLookup) {
        const { damage } = evaluateBuildCompiled(
          pieces,
          ctx.compiled,
          ctx.compiledLookup,
          ctx.compiledVars
        );
        collector.add(damage, null, pieces);
      } else {
        const { damage, result } = evaluateBuild(pieces, ctx);
        collector.add(damage, result, pieces);
      }
      ctx.evaluations++;
      ctx.sinceLastYield++;
      return;
    }
    const group = slotGroups[depth];
    if (group.length === 0) {
      pieces[depth] = null;
      dfs(depth + 1, cumEr, cumCr);
      return;
    }
    const sfxEr = suffixMaxEr[depth + 1];
    const sfxCr = suffixMaxCr[depth + 1];

    for (let gi = 0; gi < group.length; gi++) {
      const art = group[gi];
      const artEr = needEr ? getArtifactEr(art) : 0;
      const artCr = needCr ? getArtifactCr(art) : 0;
      const newCumEr = cumEr + artEr;
      const newCumCr = cumCr + artCr;

      if (needEr && erFloor + newCumEr + sfxEr < minEr) continue;
      if (needCr && crFloor + newCumCr + sfxCr < minCr) continue;

      pieces[depth] = art;
      if (collector.threshold > 0 && depth < 4) {
        let ub: number;
        if (
          ctx.compiled &&
          ctx.compiledVars &&
          ctx.compiledLookup &&
          ctx.compiledCharIdx != null
        ) {
          // Reuse pre-allocated remaining array (avoids allocation in hot loop)
          const remainingCount = 4 - depth;
          for (let r = 0; r < remainingCount; r++)
            ubRemaining[r] = superStatsBySlot[depth + 1 + r];
          ub = evaluateUpperBoundCompiled(
            pieces,
            depth + 1,
            ubRemaining,
            remainingCount,
            ctx.compiled,
            ctx.compiledLookup,
            ctx.compiledCharIdx,
            ctx.compiledVars
          );
        } else {
          const remaining: Partial<Record<StatKey, number>>[] = [];
          for (let s = depth + 1; s < 5; s++)
            remaining.push(superStatsBySlot[s]);
          ub = evaluateUpperBound(pieces.slice(0, depth + 1), remaining, ctx);
        }
        ctx.evaluations++;
        ctx.sinceLastYield++;
        if (ub <= collector.threshold) continue;
      }
      dfs(depth + 1, newCumEr, newCumCr);
    }
    pieces[depth] = null;
  }
  dfs(0, 0, 0);
}

function buildSlotGroupsForPattern(
  pattern: number[],
  slotData: PreparedSlotData[],
  set1Key: string,
  set2Key?: string
): { groups: ArtifactData[][]; supers: SuperArtifact[] } | null {
  const groups: ArtifactData[][] = [];
  const supers: SuperArtifact[] = [];
  for (let s = 0; s < 5; s++) {
    if (pattern[s] === 0) {
      groups.push(slotData[s].allArtifacts);
      supers.push(slotData[s].slotSuperArtifact);
    } else {
      const key = pattern[s] === 1 ? set1Key : set2Key!;
      const setArts = slotData[s].bySet.get(key);
      if (!setArts || setArts.length === 0) return null;
      groups.push(setArts);
      supers.push(
        slotData[s].setSuperArtifacts.get(key) ?? slotData[s].slotSuperArtifact
      );
    }
  }
  return { groups, supers };
}

// ─── Single-Character B&B Runner ───

/**
 * Run B&B for one character across all applicable set compositions.
 * Returns a TopKCollector with the top-K results.
 */
export function runCharacterBnB(
  charId: string,
  charConfig: PerCharConfig,
  teamBuild: TeamBuild,
  carryCharId: string,
  formulaId: string,
  inventory: ArtifactData[],
  globalConfig: GlobalStatWeights,
  baseSheets: Record<string, StatSheet>,
  calcContext: CalcContext,
  excludedIds: Set<string> | undefined,
  reactionOverride: ReactionOverride | undefined,
  scoreFn:
    | ((sheets: Record<string, StatSheet>, calcTargetId: string) => number)
    | undefined,
  topK: number,
  deadline?: number,
  warmStartThreshold?: number,
  maxArtsPerSlot = 0,
  /** @internal For benchmarking only — disable AST compilation */
  _noCompile = false
): {
  collector: TopKCollector;
  evaluations: number;
  failReason?: OptFailReason;
} {
  const swapCharId = charId;
  const calcTargetId = carryCharId;
  const formulaCharId = carryCharId;
  const erCheckCharId = charId;

  // CR discount: reduce CR weight in artifact ranking when the character
  // already has high base CR (from character stats, weapon, team buffs).
  // The damage formula caps CR at 100%, so additional CR substats have
  // diminishing value as total CR approaches the cap.
  let crDiscount = 1;
  if (swapCharId === formulaCharId) {
    if (calcContext.assumeCrit) {
      crDiscount = 0;
    } else {
      const blSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
      const blStats = teamBuild.getTeamStats(
        blSheets,
        calcTargetId,
        calcContext
      );
      const effectiveCr = blStats[formulaCharId]?.get("cr") ?? 0;
      crDiscount = effectiveCr >= 1.0 ? 0 : Math.max(0, 1 - effectiveCr);
    }
  }

  // Compute midpoint marginal-gain weights for carry characters (costs ~20 damage evals).
  // Used for initial artifact ranking (hill-climb warm-start). After the warm-start
  // finds a good solution, we recompute marginals at that solution's operating point
  // and re-sort artifacts before the full DFS — this gives more accurate diminishing
  // returns (e.g., ER on high-ER Raiden) than the synthetic midpoint.
  let marginals: MarginalWeights | null = null;
  if (swapCharId === formulaCharId && !scoreFn) {
    marginals = computeMarginalWeights(
      teamBuild,
      swapCharId,
      formulaId,
      baseSheets,
      calcContext,
      charConfig.buildMatch,
      reactionOverride
    );
  }

  const isCarry = swapCharId === carryCharId;
  const slotData = prepareSlotData(
    inventory,
    excludedIds,
    charConfig.buildMatch,
    globalConfig,
    crDiscount,
    maxArtsPerSlot,
    marginals,
    isCarry
  );

  // Empty pool check
  const emptySlots = allSlots.filter(
    (_, i) => slotData[i].allArtifacts.length === 0
  );
  if (emptySlots.length > 0) {
    return {
      collector: new TopKCollector(topK),
      evaluations: 0,
      failReason: { kind: "empty-pool", emptySlots },
    };
  }

  const is4pc = !!charConfig.artifactSetId;
  const is2pc =
    !charConfig.artifactSetId &&
    !!charConfig.artifactHalfSetIds &&
    charConfig.artifactHalfSetIds.length === 2;

  // Set feasibility
  if (is4pc) {
    let slotsWithPiece = 0;
    for (let s = 0; s < 5; s++) {
      if (slotData[s].bySet.has(charConfig.artifactSetId!)) slotsWithPiece++;
    }
    if (slotsWithPiece < 4) {
      const slotCounts: Record<string, number> = {};
      for (let s = 0; s < 5; s++) {
        slotCounts[allSlots[s]] =
          slotData[s].bySet.get(charConfig.artifactSetId!)?.length ?? 0;
      }
      return {
        collector: new TopKCollector(topK),
        evaluations: 0,
        failReason: {
          kind: "set-impossible",
          setId: charConfig.artifactSetId,
          slotCounts,
        },
      };
    }
  } else if (is2pc) {
    const [h1, h2] = charConfig.artifactHalfSetIds!;
    const slotsForHalf = (hId: string): number => {
      let count = 0;
      for (let s = 0; s < 5; s++) {
        for (const [setKey] of slotData[s].bySet) {
          if (artifactIdToHalfSetId[setKey] === hId) {
            count++;
            break;
          }
        }
      }
      return count;
    };
    if (slotsForHalf(h1) < 2 || slotsForHalf(h2) < 2) {
      const slotCounts: Record<string, number> = {};
      for (let s = 0; s < 5; s++)
        slotCounts[allSlots[s]] = slotData[s].allArtifacts.length;
      return {
        collector: new TopKCollector(topK),
        evaluations: 0,
        failReason: {
          kind: "set-impossible",
          halfSetIds: charConfig.artifactHalfSetIds,
          slotCounts,
        },
      };
    }
  }

  // Baseline ER/CR
  let erFloor = 0;
  let crFloor = 0;
  if (charConfig.minEr > 0 || charConfig.minCr > 0) {
    const blSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
    const blStats = teamBuild.getTeamStats(blSheets, calcTargetId, calcContext);
    if (charConfig.minEr > 0) erFloor = blStats[erCheckCharId]?.get("er") ?? 0;
    if (charConfig.minCr > 0) crFloor = blStats[erCheckCharId]?.get("cr") ?? 0;
  }

  // Precompute optimizer context for fast getTeamStats (caches support preStats)
  const optCtx = scoreFn
    ? undefined
    : teamBuild.createOptimizerContext(
        baseSheets,
        swapCharId,
        calcTargetId,
        calcContext
      );

  // Try to compile the damage formula for fast evaluation in DFS
  let compiled: CompiledTeamDamage | undefined;
  let compiledVars: Float64Array | undefined;
  let compiledCharIdx: number | undefined;
  let compiledLookup: ArtifactVarLookup | undefined;
  if (optCtx && swapCharId === formulaCharId && !scoreFn && !_noCompile) {
    try {
      compiled = compileTeamDamage(
        teamBuild,
        formulaCharId,
        formulaId,
        calcContext,
        optCtx,
        reactionOverride,
        charConfig.minEr > 0 || charConfig.minCr > 0
          ? erCheckCharId
          : undefined,
        charConfig.minEr,
        charConfig.minCr
      );
      compiledVars = new Float64Array(compiled.numVars);
      compiledCharIdx = Object.keys(teamBuild.charBuilds).indexOf(swapCharId);
      compiledLookup = buildArtifactVarLookup(
        compiled.varMapping,
        compiledCharIdx
      );
    } catch {
      // Compilation failed — fall back to standard evaluation
      compiled = undefined;
    }
  }

  const collector = new TopKCollector(topK, warmStartThreshold);
  const ctx: BnBContext = {
    teamBuild,
    swapCharId,
    formulaCharId,
    formulaId,
    baseSheets,
    calcTargetId,
    calcContext,
    erCheckCharId,
    minEr: charConfig.minEr,
    minCr: charConfig.minCr,
    erFloor,
    crFloor,
    reactionOverride,
    scoreFn,
    collector,
    evaluations: 0,
    sinceLastYield: 0,
    optCtx,
    compiled,
    compiledVars,
    compiledCharIdx,
    compiledLookup,
    deadline,
  };

  // ── Helper: Collect pattern tasks, sort by upper bound, run B&B with pruning ──
  interface PatternTask {
    groups: ArtifactData[][];
    supers: SuperArtifact[];
    upperBound: number;
  }

  /**
   * Hill-climbing warm-start: greedy seed + iterative single-slot improvement.
   *
   * For each pattern task, starts from the top weight-scored artifact per slot,
   * then iteratively swaps single slots to improve damage. Tries the top
   * HC_ALT_COUNT artifacts per slot per iteration.
   *
   * Additionally, for multi-main-stat slots (sands/goblet/circlet), generates
   * extra seeds starting from each distinct main stat type's best artifact.
   * This prevents the HC from being trapped in a local optimum when the weight
   * scoring heavily favors one main stat (e.g. ER for Raiden) that isn't
   * actually optimal in context.
   */
  function hillClimbWarmStart(
    tasks: PatternTask[],
    diverseSeedBudget = 0
  ): void {
    for (let ti = 0; ti < tasks.length; ti++) {
      const task = tasks[ti];
      const useDiverseSeeds = ti < diverseSeedBudget;
      let valid = true;
      for (let s = 0; s < 5; s++) {
        if (task.groups[s].length === 0) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      // Collect seeds: primary greedy + optionally diverse main stat seeds
      const baseSeed: ArtifactTuple = [
        task.groups[0][0],
        task.groups[1][0],
        task.groups[2][0],
        task.groups[3][0],
        task.groups[4][0],
      ];
      const seeds: ArtifactTuple[] = [baseSeed];

      if (useDiverseSeeds) {
        // For sands/goblet/circlet, seed from each distinct main stat's best
        for (let s = 2; s < 5 && seeds.length <= 7; s++) {
          const group = task.groups[s];
          const topMain = group[0].mainStatKey;
          const seenMains = new Set<string>([topMain]);
          for (const art of group) {
            if (seeds.length > 7) break;
            if (seenMains.size >= 3) break; // max 2 alt main stats per slot
            if (seenMains.has(art.mainStatKey)) continue;
            seenMains.add(art.mainStatKey);
            const altSeed: ArtifactTuple = [...baseSeed] as ArtifactTuple;
            altSeed[s] = art;
            seeds.push(altSeed);
          }
        }
      }

      // Run HC from each seed
      for (const seed of seeds) {
        if (ctx.aborted) break;
        const pieces: ArtifactTuple = [...seed] as ArtifactTuple;
        let bestDamage = evaluateBuild(pieces, ctx).damage;
        collector.add(bestDamage, null, pieces);
        ctx.evaluations++;

        let improved = true;
        while (improved) {
          if (ctx.deadline && performance.now() > ctx.deadline) {
            ctx.aborted = true;
            break;
          }
          improved = false;
          for (let s = 0; s < 5; s++) {
            const group = task.groups[s];
            const hcLimit = Math.min(group.length, 50);
            for (let gi = 0; gi < hcLimit; gi++) {
              if (group[gi] === pieces[s]) continue;
              const saved = pieces[s];
              pieces[s] = group[gi];
              const { damage } = evaluateBuild(pieces, ctx);
              ctx.evaluations++;
              if (damage > bestDamage) {
                bestDamage = damage;
                collector.add(damage, null, pieces);
                improved = true;
              } else {
                pieces[s] = saved;
              }
            }
          }
        }
      }
    }
  }

  function collectAndRunPatternTasks(tasks: PatternTask[]): void {
    // Hill-climbing warm-start to seed a good threshold before DFS.
    // Sort by upper bound and run diverse seeds on top 10 patterns
    // to avoid getting stuck in local optima from bad initial ranking.
    const sortedForSeeds = [...tasks].sort(
      (a, b) => b.upperBound - a.upperBound
    );
    hillClimbWarmStart(sortedForSeeds, 10);

    // Second HC pass: re-sort artifacts using marginal weights computed at the
    // warm-start solution (not the synthetic midpoint), then run HC again to
    // find solutions the initial ordering missed. Uses a SEPARATE collector
    // to avoid raising the DFS threshold (which can cause false pruning when
    // upper bounds underestimate due to missing set bonuses in super-artifacts).
    const HC2_MAX_PATTERNS = 5;
    let hc2Collector: TopKCollector | null = null;
    if (
      isCarry &&
      !scoreFn &&
      !ctx.aborted &&
      collector.best &&
      collector.best.damage > 0
    ) {
      const warmArts = collector.best.artifacts.filter(
        (a): a is ArtifactData => a != null
      );
      const warmMarginals = computeMarginalWeights(
        teamBuild,
        swapCharId,
        formulaId,
        baseSheets,
        calcContext,
        charConfig.buildMatch,
        reactionOverride,
        StatSheet.fromArtifacts(warmArts)
      );
      if (warmMarginals) {
        // Force full marginal substat weights for the re-sort
        const fullMarginals: MarginalWeights = {
          ...warmMarginals,
          hasMainStatDisagreement: true,
        };
        const marginalSortFn = (a: ArtifactData, b: ArtifactData) =>
          computeMarginalScore(
            b,
            charConfig.buildMatch,
            globalConfig,
            crDiscount,
            fullMarginals
          ) -
          computeMarginalScore(
            a,
            charConfig.buildMatch,
            globalConfig,
            crDiscount,
            fullMarginals
          );

        // Re-sort → run HC2 into separate collector → restore original order
        hc2Collector = new TopKCollector(topK);
        const savedCollector = ctx.collector;
        ctx.collector = hc2Collector;
        const topTasks = [...tasks]
          .sort((a, b) => b.upperBound - a.upperBound)
          .slice(0, HC2_MAX_PATTERNS);
        withResortedSlotData(slotData, marginalSortFn, () => {
          hillClimbWarmStart(topTasks, HC2_MAX_PATTERNS);
        });
        ctx.collector = savedCollector;
      }
    }

    // Sort by upper bound descending — explore most promising patterns first
    tasks.sort((a, b) => b.upperBound - a.upperBound);
    for (const task of tasks) {
      if (ctx.aborted) break;
      if (
        ctx.collector.threshold > 0 &&
        task.upperBound <= ctx.collector.threshold
      ) {
        continue;
      }
      bnbDfs(task.groups, task.supers, ctx);
    }

    // Merge HC2 results into main collector after DFS
    if (hc2Collector) {
      for (const entry of hc2Collector.results) {
        collector.add(entry.damage, entry.result, entry.artifacts);
      }
    }
  }

  function computePatternUpperBound(supers: SuperArtifact[]): number {
    if (
      ctx.compiled &&
      ctx.compiledVars &&
      ctx.compiledLookup &&
      ctx.compiledCharIdx != null
    ) {
      const superStats = supers.map((s) => s.stats);
      return evaluateUpperBoundCompiled(
        [],
        0,
        superStats,
        superStats.length,
        ctx.compiled,
        ctx.compiledLookup,
        ctx.compiledCharIdx,
        ctx.compiledVars
      );
    }
    return evaluateUpperBound(
      [],
      supers.map((s) => s.stats),
      ctx
    );
  }

  function buildTask(
    built: { groups: ArtifactData[][]; supers: SuperArtifact[] } | null
  ): PatternTask | null {
    if (!built) return null;
    return {
      groups: built.groups,
      supers: built.supers,
      upperBound: computePatternUpperBound(built.supers),
    };
  }

  // Build and run tasks
  if (is4pc) {
    const tasks: PatternTask[] = [];
    for (const pattern of SET4_PATTERNS) {
      const t = buildTask(
        buildSlotGroupsForPattern(pattern, slotData, charConfig.artifactSetId!)
      );
      if (t) tasks.push(t);
    }
    collectAndRunPatternTasks(tasks);
  } else if (is2pc) {
    const tasks: PatternTask[] = [];
    const [h1, h2] = charConfig.artifactHalfSetIds as [string, string];
    const h1Keys = artifactHalfSetsById[h1]?.setIds ?? [];
    const h2Keys = artifactHalfSetsById[h2]?.setIds ?? [];
    for (const pattern of SET22_PATTERNS) {
      for (const sk1 of h1Keys) {
        for (const sk2 of h2Keys) {
          if (h1 === h2 && sk1 === sk2) continue;
          const t = buildTask(
            buildSlotGroupsForPattern(pattern, slotData, sk1, sk2)
          );
          if (t) tasks.push(t);
        }
      }
      if (h1 !== h2) {
        for (const sk1 of h2Keys) {
          for (const sk2 of h1Keys) {
            const t = buildTask(
              buildSlotGroupsForPattern(pattern, slotData, sk1, sk2)
            );
            if (t) tasks.push(t);
          }
        }
      }
    }
    collectAndRunPatternTasks(tasks);
  } else {
    // No set constraint → try all viable 4pc, 2+2, and rainbow
    const allTasks: PatternTask[] = [];

    const setCounts = new Map<string, number>();
    for (let s = 0; s < 5; s++) {
      const seen = new Set<string>();
      for (const [setKey] of slotData[s].bySet) {
        if (!seen.has(setKey)) {
          seen.add(setKey);
          setCounts.set(setKey, (setCounts.get(setKey) ?? 0) + 1);
        }
      }
    }
    for (const [setKey, count] of setCounts) {
      if (count >= 4) {
        for (const pattern of SET4_PATTERNS) {
          const t = buildTask(
            buildSlotGroupsForPattern(pattern, slotData, setKey)
          );
          if (t) allTasks.push(t);
        }
      }
    }

    const halfSetSlots = new Map<string, number>();
    for (let s = 0; s < 5; s++) {
      const seen = new Set<string>();
      for (const [setKey] of slotData[s].bySet) {
        const hsId = artifactIdToHalfSetId[setKey];
        if (hsId && !seen.has(hsId)) {
          seen.add(hsId);
          halfSetSlots.set(hsId, (halfSetSlots.get(hsId) ?? 0) + 1);
        }
      }
    }
    const viableHS = [...halfSetSlots.entries()]
      .filter(([, c]) => c >= 2)
      .map(([id]) => id);
    for (let i = 0; i < viableHS.length; i++) {
      for (let j = i; j < viableHS.length; j++) {
        const [h1, h2] = [viableHS[i], viableHS[j]];
        const h1Keys = artifactHalfSetsById[h1]?.setIds ?? [];
        const h2Keys = artifactHalfSetsById[h2]?.setIds ?? [];
        for (const pattern of SET22_PATTERNS) {
          for (const sk1 of h1Keys) {
            for (const sk2 of h2Keys) {
              if (h1 === h2 && sk1 === sk2) continue;
              const t = buildTask(
                buildSlotGroupsForPattern(pattern, slotData, sk1, sk2)
              );
              if (t) allTasks.push(t);
            }
          }
          if (h1 !== h2) {
            for (const sk1 of h2Keys) {
              for (const sk2 of h1Keys) {
                const t = buildTask(
                  buildSlotGroupsForPattern(pattern, slotData, sk1, sk2)
                );
                if (t) allTasks.push(t);
              }
            }
          }
        }
      }
    }

    // Rainbow
    {
      const rainbowGroups = slotData.map((sd) => sd.allArtifacts);
      const rainbowSupers = slotData.map((sd) => sd.slotSuperArtifact);
      allTasks.push({
        groups: rainbowGroups,
        supers: rainbowSupers,
        upperBound: computePatternUpperBound(rainbowSupers),
      });
    }

    collectAndRunPatternTasks(allTasks);
  }

  // Diagnose failure
  let failReason: OptFailReason | undefined;
  if (collector.best == null || collector.best.damage <= 0) {
    if (charConfig.minEr > 0 || charConfig.minCr > 0) {
      let maxEr = 0;
      let maxCr = 0;
      for (let s = 0; s < 5; s++) {
        maxEr += slotData[s].slotSuperArtifact.maxEr;
        maxCr += slotData[s].slotSuperArtifact.maxCr;
      }
      if (charConfig.minEr > 0 && erFloor + maxEr < charConfig.minEr) {
        failReason = {
          kind: "er-unmet",
          minEr: charConfig.minEr,
          bestEr: erFloor + maxEr,
        };
      } else if (charConfig.minCr > 0 && crFloor + maxCr < charConfig.minCr) {
        failReason = {
          kind: "cr-unmet",
          minCr: charConfig.minCr,
          bestCr: crFloor + maxCr,
        };
      } else {
        failReason = {
          kind: "all-filtered",
          combinationsTotal: ctx.evaluations,
        };
      }
    } else {
      failReason = { kind: "all-filtered", combinationsTotal: ctx.evaluations };
    }
  }

  return { collector, evaluations: ctx.evaluations, failReason };
}
