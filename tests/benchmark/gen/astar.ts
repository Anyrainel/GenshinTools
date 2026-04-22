/**
 * Optimizer A*: Best-First Search Team Optimizer
 *
 * Uses a max-heap priority queue ordered by upper bound, always expanding the
 * most promising partial build first. Memory-bounded: trims queue at 500K.
 *
 * This is our custom algorithm, NOT a replica of any external optimizer.
 * Previously named "mona" — renamed to "astar" for clarity.
 */

import { artifactHalfSetsById, artifactIdToHalfSetId } from "@/data/constants";
import type { ArtifactData } from "@/data/types";
import type { StatSheet } from "@/lib/team-comp/calc/statSheet";
import type { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  type CalcContext,
  type OptFailReason,
  type ReactionOverride,
  type StatKey,
  type TeamOptYield,
  type TeamOptimizerOptions,
  getHalfSetIds,
  getSetId,
} from "@/lib/team-comp/types";
import {
  type ArtifactTuple,
  MAX_ARTS_PER_SLOT_NOSET,
  type PerCharSearchFn,
  type PerCharSearchOpts,
  type PerCharSearchResult,
  SET4_PATTERNS,
  SET22_PATTERNS,
  type SuperArtifact,
  TopKCollector,
  buildSlotGroupsForPattern,
  createTeamOptimizer,
  diagnoseFailure,
  evaluateBuild,
  evaluateUpperBound,
  getArtifactCr,
  getArtifactEr,
  setupCharSearch,
} from "./teamSearch";

const MAX_QUEUE_SIZE = 500_000;

// Max-Heap Priority Queue

interface AStarState {
  depth: number;
  artifacts: ArtifactTuple;
  cumEr: number;
  cumCr: number;
  upperBound: number;
}

class MaxHeap {
  private data: AStarState[] = [];

  get size(): number {
    return this.data.length;
  }

  push(state: AStarState): void {
    this.data.push(state);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): AStarState | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  trim(): void {
    if (this.data.length <= 1) return;
    this.data.sort((a, b) => b.upperBound - a.upperBound);
    const keepCount = Math.ceil(this.data.length / 2);
    this.data.length = keepCount;
    for (let i = Math.floor(keepCount / 2) - 1; i >= 0; i--) {
      this.sinkDown(i);
    }
  }

  private bubbleUp(idx: number): void {
    let i = idx;
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (this.data[parent].upperBound >= this.data[i].upperBound) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private sinkDown(idx: number): void {
    let i = idx;
    const n = this.data.length;
    while (true) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (
        left < n &&
        this.data[left].upperBound > this.data[largest].upperBound
      )
        largest = left;
      if (
        right < n &&
        this.data[right].upperBound > this.data[largest].upperBound
      )
        largest = right;
      if (largest === i) break;
      [this.data[i], this.data[largest]] = [this.data[largest], this.data[i]];
      i = largest;
    }
  }
}

// Core A* Search

interface AStarContext {
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
  erFloor: number;
  crFloor: number;
  reactionOverride?: ReactionOverride;
  scoreFn?: (
    sheets: Record<string, StatSheet>,
    onFieldCharId: string
  ) => number;
  collector: TopKCollector;
  evaluations: number;
  sinceLastYield: number;
  deadline?: number;
  aborted?: boolean;
}

function aStarSearch(
  slotGroups: ArtifactData[][],
  slotSupers: SuperArtifact[],
  ctx: AStarContext
): void {
  const {
    teamBuild,
    swapCharId,
    formulaCharId,
    formulaId,
    baseSheets,
    onFieldCharId,
    calcContext,
    erCheckCharId,
    minEr,
    minCr,
    erFloor,
    crFloor,
    reactionOverride,
    scoreFn,
    collector,
  } = ctx;
  const needEr = minEr > 0;
  const needCr = minCr > 0;

  const suffixMaxEr = new Float64Array(6);
  const suffixMaxCr = new Float64Array(6);
  for (let s = 4; s >= 0; s--) {
    suffixMaxEr[s] = suffixMaxEr[s + 1] + slotSupers[s].maxEr;
    suffixMaxCr[s] = suffixMaxCr[s + 1] + slotSupers[s].maxCr;
  }
  const superStatsBySlot = slotSupers.map((s) => s.stats);

  const initialUB = evaluateUpperBound(
    [],
    superStatsBySlot,
    teamBuild,
    swapCharId,
    formulaCharId,
    formulaId,
    baseSheets,
    onFieldCharId,
    calcContext,
    reactionOverride,
    scoreFn
  );
  ctx.evaluations++;
  ctx.sinceLastYield++;

  if (initialUB <= 0) return;

  const heap = new MaxHeap();

  const initState: AStarState = {
    depth: 0,
    artifacts: [null, null, null, null, null],
    cumEr: 0,
    cumCr: 0,
    upperBound: initialUB,
  };
  heap.push(initState);

  while (heap.size > 0) {
    if (ctx.aborted) return;
    if (ctx.deadline && ctx.evaluations % 1000 === 0) {
      if (performance.now() > ctx.deadline) {
        ctx.aborted = true;
        return;
      }
    }

    const state = heap.pop()!;

    if (collector.threshold > 0 && state.upperBound <= collector.threshold)
      continue;

    if (state.depth === 5) {
      const { damage, result } = evaluateBuild(
        state.artifacts,
        teamBuild,
        swapCharId,
        formulaCharId,
        formulaId,
        baseSheets,
        onFieldCharId,
        calcContext,
        erCheckCharId,
        minEr,
        minCr,
        reactionOverride,
        scoreFn
      );
      collector.add(damage, result, state.artifacts);
      ctx.evaluations++;
      ctx.sinceLastYield++;
      continue;
    }

    const group = slotGroups[state.depth];
    if (group.length === 0) {
      const childArts = [...state.artifacts] as ArtifactTuple;
      const childState: AStarState = {
        depth: state.depth + 1,
        artifacts: childArts,
        cumEr: state.cumEr,
        cumCr: state.cumCr,
        upperBound: state.upperBound,
      };
      heap.push(childState);
      continue;
    }

    const sfxEr = suffixMaxEr[state.depth + 1];
    const sfxCr = suffixMaxCr[state.depth + 1];

    for (let gi = 0; gi < group.length; gi++) {
      const art = group[gi];
      const artEr = needEr ? getArtifactEr(art) : 0;
      const artCr = needCr ? getArtifactCr(art) : 0;
      const newCumEr = state.cumEr + artEr;
      const newCumCr = state.cumCr + artCr;

      if (needEr && erFloor + newCumEr + sfxEr < minEr) continue;
      if (needCr && crFloor + newCumCr + sfxCr < minCr) continue;

      const childArts = [...state.artifacts] as ArtifactTuple;
      childArts[state.depth] = art;

      let childUB: number;
      if (state.depth >= 1 && state.depth < 4) {
        const remaining: Partial<Record<StatKey, number>>[] = [];
        for (let s = state.depth + 1; s < 5; s++)
          remaining.push(superStatsBySlot[s]);
        childUB = evaluateUpperBound(
          childArts.slice(0, state.depth + 1),
          remaining,
          teamBuild,
          swapCharId,
          formulaCharId,
          formulaId,
          baseSheets,
          onFieldCharId,
          calcContext,
          reactionOverride,
          scoreFn
        );
        ctx.evaluations++;
        ctx.sinceLastYield++;
      } else {
        childUB = state.upperBound;
      }

      if (collector.threshold > 0 && childUB <= collector.threshold) continue;

      heap.push({
        depth: state.depth + 1,
        artifacts: childArts,
        cumEr: newCumEr,
        cumCr: newCumCr,
        upperBound: childUB,
      });
    }

    if (heap.size > MAX_QUEUE_SIZE) {
      heap.trim();
    }
  }
}

// Single-Character A* Runner

function runCharacterAStar(opts: PerCharSearchOpts): PerCharSearchResult {
  const {
    charId,
    charConfig,
    teamBuild,
    carryCharId,
    formulaId,
    inventory,
    globalConfig,
    baseSheets,
    calcContext,
    excludedIds,
    reactionOverride,
    scoreFn,
    topK,
    deadline,
    noSetArtsPerSlot = MAX_ARTS_PER_SLOT_NOSET,
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

  const ctx: AStarContext = {
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
    erFloor,
    crFloor,
    reactionOverride,
    scoreFn,
    collector,
    evaluations: 0,
    sinceLastYield: 0,
    deadline,
  };

  if (is4pc) {
    for (const pattern of SET4_PATTERNS) {
      const built = buildSlotGroupsForPattern(
        pattern,
        slotData,
        getSetId(charConfig.artifactSet)!
      );
      if (built) aStarSearch(built.groups, built.supers, ctx);
    }
  } else if (is2pc) {
    const [h1, h2] = getHalfSetIds(charConfig.artifactSet) as [string, string];
    const h1Keys = artifactHalfSetsById[h1]?.setIds ?? [];
    const h2Keys = artifactHalfSetsById[h2]?.setIds ?? [];

    if (h1 === h2) {
      for (const pattern of SET22_PATTERNS) {
        if (ctx.aborted) break;
        for (let i = 0; i < h1Keys.length && !ctx.aborted; i++) {
          for (let j = i + 1; j < h1Keys.length && !ctx.aborted; j++) {
            const built = buildSlotGroupsForPattern(
              pattern,
              slotData,
              h1Keys[i],
              h1Keys[j]
            );
            if (built) aStarSearch(built.groups, built.supers, ctx);
          }
        }
      }
    } else {
      for (const pattern of SET22_PATTERNS) {
        if (ctx.aborted) break;
        for (const sk1 of h1Keys) {
          if (ctx.aborted) break;
          for (const sk2 of h2Keys) {
            if (ctx.aborted) break;
            const built = buildSlotGroupsForPattern(
              pattern,
              slotData,
              sk1,
              sk2
            );
            if (built) aStarSearch(built.groups, built.supers, ctx);
          }
        }
        if (!ctx.aborted) {
          for (const sk1 of h2Keys) {
            if (ctx.aborted) break;
            for (const sk2 of h1Keys) {
              if (ctx.aborted) break;
              const built = buildSlotGroupsForPattern(
                pattern,
                slotData,
                sk1,
                sk2
              );
              if (built) aStarSearch(built.groups, built.supers, ctx);
            }
          }
        }
      }
    }
  } else {
    // No set constraint
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

    const viable4pc = [...setCounts.entries()]
      .filter(([, count]) => count >= 4)
      .sort((a, b) => {
        let totalA = 0;
        let totalB = 0;
        for (let s = 0; s < 5; s++) {
          totalA += slotData[s].bySet.get(a[0])?.length ?? 0;
          totalB += slotData[s].bySet.get(b[0])?.length ?? 0;
        }
        return totalB - totalA;
      })
      .slice(0, 5)
      .map(([k]) => k);

    for (const setKey of viable4pc) {
      if (ctx.aborted) break;
      for (const pattern of SET4_PATTERNS) {
        const built = buildSlotGroupsForPattern(
          pattern,
          slotData,
          setKey,
          undefined,
          noSetArtsPerSlot
        );
        if (built) aStarSearch(built.groups, built.supers, ctx);
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
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);

    for (let i = 0; i < viableHS.length && !ctx.aborted; i++) {
      for (let j = i; j < viableHS.length && !ctx.aborted; j++) {
        const [h1, h2] = [viableHS[i], viableHS[j]];
        const h1Keys = artifactHalfSetsById[h1]?.setIds ?? [];
        const h2Keys = artifactHalfSetsById[h2]?.setIds ?? [];
        for (const pattern of SET22_PATTERNS) {
          if (ctx.aborted) break;
          for (const sk1 of h1Keys) {
            for (const sk2 of h2Keys) {
              if (h1 === h2 && sk1 === sk2) continue;
              const built = buildSlotGroupsForPattern(
                pattern,
                slotData,
                sk1,
                sk2,
                noSetArtsPerSlot
              );
              if (built) aStarSearch(built.groups, built.supers, ctx);
            }
          }
          if (h1 !== h2) {
            for (const sk1 of h2Keys) {
              for (const sk2 of h1Keys) {
                const built = buildSlotGroupsForPattern(
                  pattern,
                  slotData,
                  sk1,
                  sk2,
                  noSetArtsPerSlot
                );
                if (built) aStarSearch(built.groups, built.supers, ctx);
              }
            }
          }
        }
      }
    }

    // Rainbow
    if (!ctx.aborted) {
      aStarSearch(
        slotData.map((sd) => sd.allArtifacts.slice(0, noSetArtsPerSlot)),
        slotData.map((sd) => sd.slotSuperArtifact),
        ctx
      );
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

// Export

export const runTeamOptimization: (
  opts: TeamOptimizerOptions
) => AsyncGenerator<TeamOptYield> = createTeamOptimizer(
  runCharacterAStar as PerCharSearchFn
);
