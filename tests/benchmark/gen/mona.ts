/**
 * Optimizer Mona: A* (Best-First Search) Team Optimizer
 *
 * Same team-level interface as V1 (teamOptimizer.ts) and V2 (optimizerV2.ts).
 * Uses A* with super-artifact upper-bound pruning per character,
 * then top-K conflict-aware DFS for team allocation (same as V2).
 *
 * Algorithm:
 *   Phase 1: Per-character A* (priority queue) → top-K results
 *   Phase 2: Team allocation via conflict-aware DFS on top-K results
 *   Phase 3: Carry re-optimization with allocated support artifacts
 *
 * Key differences from V2's DFS B&B:
 * - Uses a max-heap priority queue ordered by upper bound
 * - Always expands the most promising partial build first
 * - Memory-bounded: trims queue when it exceeds 500K entries
 */

import { isPctStat } from "@/components/team-comp/displayFormatters";
import { detectEquippedSets } from "@/components/team-comp/teamOptUtils";
import { artifactHalfSetsById, artifactIdToHalfSetId } from "@/data/constants";
import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import {
  type BuildMatchResult,
  getMainStatValueAtLevel,
  getTargetMainStatsForSlot,
  scoreMainStat,
  scoreSlot,
} from "@/lib/account-data/artifactScore";
import { TeamBuild, evaluateCombo } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  OptimizationResult,
  OptimizerOptions,
} from "@/lib/team-comp/optimizer";
import type {
  CalcContext,
  ComboFormula,
  ComboResult,
  DamageResult,
  OptFailReason,
  PerCharConfig,
  ReactionOverride,
  StatKey,
  TeamOptComboResult,
  TeamOptPassId,
  TeamOptPassResult,
  TeamOptSingleResult,
  TeamOptYield,
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";

// ─── Constants ───

const TOP_K = 50;
const CARRY_TOP_K = 100;
const MAX_TEAM_SEARCH = 500_000;
const YIELD_INTERVAL = 300;
const MAX_QUEUE_SIZE = 500_000;
const ALLOC_TOP_N = 50;
/** Max artifacts per slot per group to consider in A* search. Reduces branching factor dramatically. */
const MAX_ARTS_PER_SLOT = 15;
/** Tighter limit for no-set-constraint characters (explore fewer artifacts per slot but more set patterns). */
const MAX_ARTS_PER_SLOT_NOSET = 10;
/** Fraction of average per-char budget allocated to "fast" (4pc set) characters. */
const FAST_CHAR_TIME_FRACTION = 0.3;

const warnedCalcErrors = new Set<string>();

// ═══════════════════════════════════════════════════════════════════════
// Section 1: A* Best-First Search (single-character optimizer)
// ═══════════════════════════════════════════════════════════════════════

// ─── Types ───

interface SuperArtifact {
  maxEr: number;
  maxCr: number;
  stats: Partial<Record<StatKey, number>>;
}

type ArtifactTuple = [
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
];

interface TopKEntry {
  damage: number;
  result: DamageResult | null;
  artifacts: ArtifactTuple;
  artifactIds: Set<string>;
}

// ─── Top-K Collector ───

class TopKCollector {
  private entries: TopKEntry[] = [];
  threshold = Number.NEGATIVE_INFINITY;

  constructor(
    private k: number,
    initialThreshold?: number
  ) {
    if (initialThreshold !== undefined && initialThreshold > this.threshold) {
      this.threshold = initialThreshold;
    }
  }

  get best(): TopKEntry | undefined {
    return this.entries[0];
  }
  get size(): number {
    return this.entries.length;
  }
  get results(): TopKEntry[] {
    return this.entries;
  }

  add(
    damage: number,
    result: DamageResult | null,
    artifacts: ArtifactTuple
  ): boolean {
    if (damage <= 0) return false;
    if (this.entries.length >= this.k && damage <= this.threshold) return false;

    const artifactIds = new Set<string>();
    for (const a of artifacts) {
      if (a) artifactIds.add(a.id);
    }

    const entry: TopKEntry = {
      damage,
      result,
      artifacts: [...artifacts] as ArtifactTuple,
      artifactIds,
    };

    let lo = 0;
    let hi = this.entries.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.entries[mid].damage > damage) lo = mid + 1;
      else hi = mid;
    }
    this.entries.splice(lo, 0, entry);

    if (this.entries.length > this.k) this.entries.length = this.k;
    if (this.entries.length >= this.k) {
      this.threshold = this.entries[this.entries.length - 1].damage;
    }
    return true;
  }
}

// ─── Max-Heap Priority Queue ───

interface AStarState {
  depth: number; // 0-5: which slot to assign next
  artifacts: ArtifactTuple; // assigned artifacts (null for unassigned)
  cumEr: number; // accumulated ER from assigned artifacts
  cumCr: number; // accumulated CR from assigned artifacts
  upperBound: number; // estimated max damage
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

  /** Trim the bottom half of the heap to manage memory. */
  trim(): void {
    if (this.data.length <= 1) return;
    // Sort by upperBound descending and keep top half
    this.data.sort((a, b) => b.upperBound - a.upperBound);
    const keepCount = Math.ceil(this.data.length / 2);
    this.data.length = keepCount;
    // Rebuild heap
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

// ─── Artifact Helpers ───

function getArtifactEr(art: ArtifactData | null): number {
  if (!art) return 0;
  let er = 0;
  if (art.mainStatKey === "er")
    er += getMainStatValueAtLevel("er", art.rarity, art.level) / 100;
  if (art.substats.er) er += art.substats.er / 100;
  return er;
}

function getArtifactCr(art: ArtifactData | null): number {
  if (!art) return 0;
  let cr = 0;
  if (art.mainStatKey === "cr")
    cr += getMainStatValueAtLevel("cr", art.rarity, art.level) / 100;
  if (art.substats.cr) cr += art.substats.cr / 100;
  return cr;
}

function getArtifactStats(art: ArtifactData): Partial<Record<StatKey, number>> {
  const stats: Partial<Record<StatKey, number>> = {};
  let mainVal = getMainStatValueAtLevel(art.mainStatKey, art.rarity, art.level);
  if (isPctStat(art.mainStatKey)) mainVal /= 100;
  stats[art.mainStatKey as StatKey] = mainVal;
  for (const [key, val] of Object.entries(art.substats)) {
    if (!val) continue;
    let v = val as number;
    if (isPctStat(key)) v /= 100;
    const sk = key as StatKey;
    stats[sk] = (stats[sk] ?? 0) + v;
  }
  return stats;
}

function buildSuperArtifact(artifacts: ArtifactData[]): SuperArtifact {
  const stats: Partial<Record<StatKey, number>> = {};
  let maxEr = 0;
  let maxCr = 0;
  for (const art of artifacts) {
    const s = getArtifactStats(art);
    for (const [key, val] of Object.entries(s)) {
      const sk = key as StatKey;
      stats[sk] = Math.max(stats[sk] ?? 0, val);
    }
    maxEr = Math.max(maxEr, getArtifactEr(art));
    maxCr = Math.max(maxCr, getArtifactCr(art));
  }
  return { maxEr, maxCr, stats };
}

function computeWeightScore(
  art: ArtifactData,
  buildMatch: BuildMatchResult | null | undefined,
  globalConfig: GlobalStatWeights,
  crDiscount: number
): number {
  const baseWeights = buildMatch?.statWeights ?? { cr: 100, cd: 100 };
  const weights =
    crDiscount < 1
      ? { ...baseWeights, cr: (baseWeights.cr ?? 0) * crDiscount }
      : baseWeights;
  let score = scoreSlot(art, weights, globalConfig);
  if (buildMatch) {
    const rec = getTargetMainStatsForSlot(art.slotKey, buildMatch.build);
    if (rec.has(art.mainStatKey)) {
      let ms = scoreMainStat(
        art.mainStatKey,
        art.rarity,
        globalConfig,
        art.level
      );
      if (crDiscount < 1 && art.mainStatKey === "cr") ms *= crDiscount;
      score += ms;
    }
  }
  return score;
}

// ─── Damage Evaluation ───

function evaluateBuild(
  pieces: ArtifactTuple,
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcTargetId: string,
  calcContext: CalcContext,
  erCheckCharId: string,
  targetEr: number,
  targetCr: number,
  reactionOverride?: ReactionOverride,
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number
): { damage: number; result: DamageResult | null } {
  const charSheet = StatSheet.fromArtifacts(pieces);
  const updatedSheets = { ...baseSheets, [swapCharId]: charSheet };
  const postStats = teamBuild.getTeamStats(
    updatedSheets,
    calcTargetId,
    calcContext
  );

  if (targetEr > 0) {
    const er = postStats[erCheckCharId]?.get("er") ?? 0;
    if (er < targetEr) return { damage: -1, result: null };
  }
  if (targetCr > 0) {
    const cr = postStats[erCheckCharId]?.get("cr") ?? 0;
    if (cr < targetCr) return { damage: -1, result: null };
  }
  if (scoreFn)
    return { damage: scoreFn(updatedSheets, calcTargetId), result: null };

  const dmgRes = teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride
  );
  return { damage: dmgRes.totalDamage, result: dmgRes };
}

function evaluateUpperBound(
  realPieces: (ArtifactData | null)[],
  superStatsRemaining: Partial<Record<StatKey, number>>[],
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcTargetId: string,
  calcContext: CalcContext,
  reactionOverride?: ReactionOverride,
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number
): number {
  const realArts = realPieces.filter((a): a is ArtifactData => a != null);
  let sheet = StatSheet.fromArtifacts(realArts);
  for (const ss of superStatsRemaining) {
    if (Object.keys(ss).length > 0) sheet = sheet.merge(StatSheet.fromRaw(ss));
  }
  const updatedSheets = { ...baseSheets, [swapCharId]: sheet };
  if (scoreFn) return scoreFn(updatedSheets, calcTargetId);
  const postStats = teamBuild.getTeamStats(
    updatedSheets,
    calcTargetId,
    calcContext
  );
  return teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride
  ).totalDamage;
}

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

// ─── Slot Data Preparation ───

interface PreparedSlotData {
  allArtifacts: ArtifactData[];
  bySet: Map<string, ArtifactData[]>;
  slotSuperArtifact: SuperArtifact;
  setSuperArtifacts: Map<string, SuperArtifact>;
}

function prepareSlotData(
  inventory: ArtifactData[],
  excludedIds: Set<string> | undefined,
  buildMatch: BuildMatchResult | null | undefined,
  globalConfig: GlobalStatWeights,
  crDiscount: number
): PreparedSlotData[] {
  const result: PreparedSlotData[] = [];
  for (let si = 0; si < 5; si++) {
    const slot = allSlots[si];
    const arts = inventory
      .filter(
        (a) => a.slotKey === slot && (!excludedIds || !excludedIds.has(a.id))
      )
      .sort(
        (a, b) =>
          computeWeightScore(b, buildMatch, globalConfig, crDiscount) -
          computeWeightScore(a, buildMatch, globalConfig, crDiscount)
      );
    const bySet = new Map<string, ArtifactData[]>();
    for (const art of arts) {
      const arr = bySet.get(art.setKey);
      if (arr) arr.push(art);
      else bySet.set(art.setKey, [art]);
    }
    const slotSA =
      arts.length > 0
        ? buildSuperArtifact(arts)
        : { maxEr: 0, maxCr: 0, stats: {} };
    const setSA = new Map<string, SuperArtifact>();
    for (const [sk, sa] of bySet) setSA.set(sk, buildSuperArtifact(sa));
    result.push({
      allArtifacts: arts,
      bySet,
      slotSuperArtifact: slotSA,
      setSuperArtifacts: setSA,
    });
  }
  return result;
}

// ─── A* Context ───

interface AStarContext {
  teamBuild: TeamBuild;
  swapCharId: string;
  formulaCharId: string;
  formulaId: string;
  baseSheets: Record<string, StatSheet>;
  calcTargetId: string;
  calcContext: CalcContext;
  erCheckCharId: string;
  targetEr: number;
  targetCr: number;
  erFloor: number;
  crFloor: number;
  reactionOverride?: ReactionOverride;
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number;
  collector: TopKCollector;
  evaluations: number;
  sinceLastYield: number;
  deadline?: number;
  aborted?: boolean;
}

// ─── Core A* Search ───

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
    calcTargetId,
    calcContext,
    erCheckCharId,
    targetEr,
    targetCr,
    erFloor,
    crFloor,
    reactionOverride,
    scoreFn,
    collector,
  } = ctx;
  const needEr = targetEr > 0;
  const needCr = targetCr > 0;

  // Precompute suffix max ER/CR for pruning
  const suffixMaxEr = new Float64Array(6);
  const suffixMaxCr = new Float64Array(6);
  for (let s = 4; s >= 0; s--) {
    suffixMaxEr[s] = suffixMaxEr[s + 1] + slotSupers[s].maxEr;
    suffixMaxCr[s] = suffixMaxCr[s + 1] + slotSupers[s].maxCr;
  }
  const superStatsBySlot = slotSupers.map((s) => s.stats);

  // Compute initial upper bound (all super-artifacts)
  const initialUB = evaluateUpperBound(
    [],
    superStatsBySlot,
    teamBuild,
    swapCharId,
    formulaCharId,
    formulaId,
    baseSheets,
    calcTargetId,
    calcContext,
    reactionOverride,
    scoreFn
  );
  ctx.evaluations++;
  ctx.sinceLastYield++;

  if (initialUB <= 0) return;

  const heap = new MaxHeap();

  // Push initial state
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

    // Prune if upper bound can't beat current best
    if (collector.threshold > 0 && state.upperBound <= collector.threshold)
      continue;

    if (state.depth === 5) {
      // Complete build — evaluate actual damage with ER/CR constraints
      const { damage, result } = evaluateBuild(
        state.artifacts,
        teamBuild,
        swapCharId,
        formulaCharId,
        formulaId,
        baseSheets,
        calcTargetId,
        calcContext,
        erCheckCharId,
        targetEr,
        targetCr,
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
      // Empty slot — pass through with null
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

      // ER prefix-sum pruning
      if (needEr && erFloor + newCumEr + sfxEr < targetEr) continue;
      // CR prefix-sum pruning
      if (needCr && crFloor + newCumCr + sfxCr < targetCr) continue;

      const childArts = [...state.artifacts] as ArtifactTuple;
      childArts[state.depth] = art;

      // Compute upper bound for child state
      // UB at depth 1-3: depth 1+ provides useful pruning.
      // Depth 0: parent UB is already loose, skip.
      // Depth 4: next is complete build, skip.
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
          calcTargetId,
          calcContext,
          reactionOverride,
          scoreFn
        );
        ctx.evaluations++;
        ctx.sinceLastYield++;
      } else {
        // depth 0-1 or 4: use parent's bound
        childUB = state.upperBound;
      }

      // Only push if upper bound can beat current best
      if (collector.threshold > 0 && childUB <= collector.threshold) continue;

      heap.push({
        depth: state.depth + 1,
        artifacts: childArts,
        cumEr: newCumEr,
        cumCr: newCumCr,
        upperBound: childUB,
      });
    }

    // Memory management: trim queue if too large
    if (heap.size > MAX_QUEUE_SIZE) {
      heap.trim();
    }
  }
}

function buildSlotGroupsForPattern(
  pattern: number[],
  slotData: PreparedSlotData[],
  set1Key: string,
  set2Key?: string,
  maxPerSlot: number = MAX_ARTS_PER_SLOT
): { groups: ArtifactData[][]; supers: SuperArtifact[] } | null {
  const groups: ArtifactData[][] = [];
  const supers: SuperArtifact[] = [];
  for (let s = 0; s < 5; s++) {
    if (pattern[s] === 0) {
      // Flex slot: pre-filter to top N (already sorted by weight score)
      groups.push(slotData[s].allArtifacts.slice(0, maxPerSlot));
      supers.push(slotData[s].slotSuperArtifact);
    } else {
      const key = pattern[s] === 1 ? set1Key : set2Key!;
      const setArts = slotData[s].bySet.get(key);
      if (!setArts || setArts.length === 0) return null;
      // Set-constrained slots: also limit to top pieces
      groups.push(setArts.slice(0, maxPerSlot));
      supers.push(
        slotData[s].setSuperArtifacts.get(key) ?? slotData[s].slotSuperArtifact
      );
    }
  }
  return { groups, supers };
}

// ─── Single-Character A* Runner ───

function runCharacterAStar(
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
  noSetArtsPerSlot: number = MAX_ARTS_PER_SLOT_NOSET
): {
  collector: TopKCollector;
  evaluations: number;
  failReason?: OptFailReason;
} {
  const swapCharId = charId;
  const calcTargetId = carryCharId;
  const formulaCharId = carryCharId;
  const erCheckCharId = charId;

  // CR discount
  let crDiscount = 1;
  if (swapCharId === formulaCharId) {
    if (calcContext.assumeCrit) {
      crDiscount = 0;
    } else if (calcContext.critRateTarget != null) {
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

  const slotData = prepareSlotData(
    inventory,
    excludedIds,
    charConfig.buildMatch,
    globalConfig,
    crDiscount
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
  if (charConfig.targetEr > 0 || charConfig.targetCr > 0) {
    const blSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
    const blStats = teamBuild.getTeamStats(blSheets, calcTargetId, calcContext);
    if (charConfig.targetEr > 0)
      erFloor = blStats[erCheckCharId]?.get("er") ?? 0;
    if (charConfig.targetCr > 0)
      crFloor = blStats[erCheckCharId]?.get("cr") ?? 0;
  }

  const collector = new TopKCollector(topK, warmStartThreshold);
  const ctx: AStarContext = {
    teamBuild,
    swapCharId,
    formulaCharId,
    formulaId,
    baseSheets,
    calcTargetId,
    calcContext,
    erCheckCharId,
    targetEr: charConfig.targetEr,
    targetCr: charConfig.targetCr,
    erFloor,
    crFloor,
    reactionOverride,
    scoreFn,
    collector,
    evaluations: 0,
    sinceLastYield: 0,
    deadline,
  };

  // Build and run tasks (same set composition logic as V2)
  if (is4pc) {
    for (const pattern of SET4_PATTERNS) {
      const built = buildSlotGroupsForPattern(
        pattern,
        slotData,
        charConfig.artifactSetId!
      );
      if (built) aStarSearch(built.groups, built.supers, ctx);
    }
  } else if (is2pc) {
    const [h1, h2] = charConfig.artifactHalfSetIds as [string, string];
    const h1Keys = artifactHalfSetsById[h1]?.setIds ?? [];
    const h2Keys = artifactHalfSetsById[h2]?.setIds ?? [];

    if (h1 === h2) {
      // Same half-set: (sk1,sk2,pattern) ≡ (sk2,sk1,mirroredPattern)
      // Only iterate upper triangle (sk1 < sk2) to avoid redundant searches
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
    // No set constraint — try viable 4pc (top 5 by piece count), top 2+2 combos, and rainbow
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

    // Only try top 5 4pc sets by total piece count (most likely to have good substats)
    const viable4pc = [...setCounts.entries()]
      .filter(([, count]) => count >= 4)
      .sort((a, b) => {
        // Prefer sets with more total artifacts across slots (better substat variety)
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

    // 2+2 combos: limit to top 8 half-sets by slot coverage
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

    // Rainbow (pre-filtered to top artifacts per slot)
    if (!ctx.aborted) {
      aStarSearch(
        slotData.map((sd) => sd.allArtifacts.slice(0, noSetArtsPerSlot)),
        slotData.map((sd) => sd.slotSuperArtifact),
        ctx
      );
    }
  }

  // Diagnose failure
  let failReason: OptFailReason | undefined;
  if (collector.best == null || collector.best.damage <= 0) {
    if (charConfig.targetEr > 0 || charConfig.targetCr > 0) {
      let maxEr = 0;
      let maxCr = 0;
      for (let s = 0; s < 5; s++) {
        maxEr += slotData[s].slotSuperArtifact.maxEr;
        maxCr += slotData[s].slotSuperArtifact.maxCr;
      }
      if (charConfig.targetEr > 0 && erFloor + maxEr < charConfig.targetEr) {
        failReason = {
          kind: "er-unmet",
          targetEr: charConfig.targetEr,
          bestEr: erFloor + maxEr,
        };
      } else if (
        charConfig.targetCr > 0 &&
        crFloor + maxCr < charConfig.targetCr
      ) {
        failReason = {
          kind: "cr-unmet",
          targetCr: charConfig.targetCr,
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

// ═══════════════════════════════════════════════════════════════════════
// Section 2: Team Allocation via Conflict-Aware DFS
// ═══════════════════════════════════════════════════════════════════════

function generatePermutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of generatePermutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

function findBestTeamAllocation(
  charIds: string[],
  topKByChar: Record<string, TopKEntry[]>,
  maxIterations: number,
  carryCharIds?: string[]
): {
  candidates: { assignment: Record<string, TopKEntry>; score: number }[];
  iterations: number;
} {
  if (charIds.length === 0) return { candidates: [], iterations: 0 };

  // Build multiple orderings to try (like V1's permutation loop)
  const rank1Damage: Record<string, number> = {};
  for (const cid of charIds) {
    rank1Damage[cid] = topKByChar[cid]?.[0]?.damage ?? 0;
  }

  const byFlexibility = [...charIds].sort((a, b) => {
    const aIsCarry = carryCharIds?.includes(a) ? 1 : 0;
    const bIsCarry = carryCharIds?.includes(b) ? 1 : 0;
    if (aIsCarry !== bIsCarry) return bIsCarry - aIsCarry;
    const aEntries = topKByChar[a] ?? [];
    const bEntries = topKByChar[b] ?? [];
    const aFlex =
      aEntries.length >= 2
        ? aEntries[0].damage - aEntries[aEntries.length - 1].damage
        : 0;
    const bFlex =
      bEntries.length >= 2
        ? bEntries[0].damage - bEntries[bEntries.length - 1].damage
        : 0;
    return aFlex - bFlex;
  });

  // Generate orderings: flexibility (default), supports-first, by-damage, reverse-damage
  const orderings: string[][] = [byFlexibility];

  const supportsFirst = [
    ...charIds.filter((id) => !carryCharIds?.includes(id)),
    ...charIds.filter((id) => carryCharIds?.includes(id) ?? false),
  ];
  orderings.push(supportsFirst);

  const byDmg = [...charIds].sort(
    (a, b) => (rank1Damage[b] ?? 0) - (rank1Damage[a] ?? 0)
  );
  orderings.push(byDmg);
  orderings.push([...byDmg].reverse());

  // For 4 chars, also add all permutations (24 total, fast with top-K)
  if (charIds.length <= 4) {
    const perms = generatePermutations(charIds);
    for (const perm of perms) {
      const key = perm.join(",");
      if (!orderings.some((o) => o.join(",") === key)) {
        orderings.push(perm);
      }
    }
  }

  // Deduplicate orderings
  const seen = new Set<string>();
  const uniqueOrderings = orderings.filter((o) => {
    const key = o.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const iterPerOrdering = Math.max(
    10_000,
    Math.floor(maxIterations / uniqueOrderings.length)
  );

  const topCandidates: {
    assignment: Record<string, TopKEntry>;
    score: number;
  }[] = [];
  let worstTopScore = Number.NEGATIVE_INFINITY;
  let iterations = 0;

  function insertCandidate(
    assignment: Record<string, TopKEntry>,
    score: number
  ): void {
    if (topCandidates.length >= ALLOC_TOP_N && score <= worstTopScore) return;
    let lo = 0;
    let hi = topCandidates.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (topCandidates[mid].score > score) lo = mid + 1;
      else hi = mid;
    }
    topCandidates.splice(lo, 0, { assignment: { ...assignment }, score });
    if (topCandidates.length > ALLOC_TOP_N) topCandidates.length = ALLOC_TOP_N;
    if (topCandidates.length >= ALLOC_TOP_N) {
      worstTopScore = topCandidates[topCandidates.length - 1].score;
    }
  }

  function getPruneThreshold(): number {
    return topCandidates.length >= ALLOC_TOP_N
      ? worstTopScore
      : Number.NEGATIVE_INFINITY;
  }

  function dfs(
    ordering: string[],
    level: number,
    usedArtifacts: Set<string>,
    currentScore: number,
    assignment: Record<string, TopKEntry>,
    iterLimit: number
  ): void {
    if (iterations >= iterLimit) return;

    if (level === ordering.length) {
      insertCandidate(assignment, currentScore);
      return;
    }

    const charId = ordering[level];
    const entries = topKByChar[charId] ?? [];
    const pruneThreshold = getPruneThreshold();

    let ubRemaining = 0;
    for (let r = level; r < ordering.length; r++) {
      ubRemaining += rank1Damage[ordering[r]];
    }
    if (currentScore + ubRemaining <= pruneThreshold) return;

    for (const entry of entries) {
      iterations++;
      if (iterations >= iterLimit) return;

      let conflict = false;
      for (const artId of entry.artifactIds) {
        if (usedArtifacts.has(artId)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      let ubWithEntry = currentScore + entry.damage;
      for (let r = level + 1; r < ordering.length; r++) {
        ubWithEntry += rank1Damage[ordering[r]];
      }
      if (ubWithEntry <= getPruneThreshold()) continue;

      for (const artId of entry.artifactIds) usedArtifacts.add(artId);
      assignment[charId] = entry;

      dfs(
        ordering,
        level + 1,
        usedArtifacts,
        currentScore + entry.damage,
        assignment,
        iterLimit
      );

      for (const artId of entry.artifactIds) usedArtifacts.delete(artId);
      delete assignment[charId];
    }
  }

  // Run DFS with multiple orderings (like V1's permutation loop)
  for (const ordering of uniqueOrderings) {
    const orderIterLimit = iterations + iterPerOrdering;
    dfs(ordering, 0, new Set(), 0, {}, orderIterLimit);

    // Also do a greedy pass for this ordering (cheap, handles edge cases)
    const greedyUsed = new Set<string>();
    const greedyAssignment: Record<string, TopKEntry> = {};
    let greedyScore = 0;
    for (const cid of ordering) {
      const entries = topKByChar[cid] ?? [];
      for (const entry of entries) {
        let conflict = false;
        for (const artId of entry.artifactIds) {
          if (greedyUsed.has(artId)) {
            conflict = true;
            break;
          }
        }
        if (!conflict) {
          greedyAssignment[cid] = entry;
          greedyScore += entry.damage;
          for (const artId of entry.artifactIds) greedyUsed.add(artId);
          break;
        }
      }
    }
    if (Object.keys(greedyAssignment).length === ordering.length) {
      insertCandidate(greedyAssignment, greedyScore);
    }
  }

  return { candidates: topCandidates, iterations };
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: Team Optimization Entry Point
// ═══════════════════════════════════════════════════════════════════════

const emptyArtifacts: Record<Slot, ArtifactData | null> = {
  flower: null,
  plume: null,
  sands: null,
  goblet: null,
  circlet: null,
};

function artsTupleToRecord(
  tuple: ArtifactTuple
): Record<Slot, ArtifactData | null> {
  return {
    flower: tuple[0],
    plume: tuple[1],
    sands: tuple[2],
    goblet: tuple[3],
    circlet: tuple[4],
  };
}

function buildSheetsFromArtifacts(
  baseSheets: Record<string, StatSheet>,
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>
): Record<string, StatSheet> {
  const sheets = { ...baseSheets };
  for (const [charId, arts] of Object.entries(artifactsByChar)) {
    const pieces = allSlots
      .map((s) => arts[s])
      .filter((a): a is ArtifactData => a != null);
    sheets[charId] = StatSheet.fromArtifacts(pieces);
  }
  return sheets;
}

/**
 * Mona Team Optimizer: A* per character → top-K → conflict-aware DFS.
 * Same interface as V1's and V2's `runTeamOptimization`.
 */
export async function* runTeamOptimization(
  opts: TeamOptimizerOptions
): AsyncGenerator<TeamOptYield> {
  const {
    teamBuild,
    carryCharId,
    formulaId,
    inventory,
    calcContext,
    globalConfig,
    baseSheets,
    perChar,
    reactionOverride,
    combo,
    reactionOverrides,
    perCharDeadlineMs,
  } = opts;

  const isComboMode =
    combo != null && combo.lines.filter((l) => l.count > 0).length > 0;

  // Combo scoring function
  const comboScoreFn = isComboMode
    ? (sheets: Record<string, StatSheet>, _calcTargetId: string): number => {
        try {
          return evaluateCombo(
            teamBuild,
            combo,
            sheets,
            calcContext,
            reactionOverrides
          ).totalDamage;
        } catch (e) {
          const key = `comboScoreFn:${_calcTargetId}`;
          if (!warnedCalcErrors.has(key)) {
            warnedCalcErrors.add(key);
            console.warn("[optimizerMona] comboScoreFn failed:", e);
          }
          return 0;
        }
      }
    : undefined;

  const allCharIds = Object.keys(perChar);
  const carryCharIds = isComboMode
    ? allCharIds.filter((id) =>
        combo.lines.some((l) => l.count > 0 && l.charId === id)
      )
    : [carryCharId];

  // Mutable effective state
  let effectiveTeamBuild = teamBuild;
  const effectivePerChar = { ...perChar };

  function rebuildTeamBuild(): TeamBuild {
    const newConfigs = teamBuild.configs.map((c) => {
      const epc = effectivePerChar[c.charId];
      if (epc) {
        return {
          ...c,
          artifactSetId: epc.artifactSetId ?? null,
          artifactHalfSetIds: epc.artifactHalfSetIds ?? [],
        };
      }
      return c;
    });
    return new TeamBuild(
      newConfigs,
      teamBuild.combatOpts,
      teamBuild.enemyElementAura
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 1: Sequential Per-character A* → top-K results
  // ════════════════════════════════════════════════════════════════════

  const topKByChar: Record<string, TopKEntry[]> = {};
  const failReasons: Record<string, OptFailReason> = {};
  const passResults: TeamOptPassResult[] = [];
  const totalPhases = allCharIds.length + 1;

  const phase1Order = [
    ...allCharIds.filter((id) => carryCharIds.includes(id)),
    ...allCharIds.filter((id) => !carryCharIds.includes(id)),
  ];

  // ── Dynamic time allocation with pooled deadline ──
  // Characters with 4pc sets are "fast" (small search space, finish quickly).
  // Characters with 2pc+2pc or no set are "slow" (huge search space, need time).
  // We use a pooled Phase 1 deadline: fast characters finish early, and their
  // unused time automatically flows to subsequent (slow) characters.
  // Fast characters get a capped budget to prevent them from consuming pool time.
  function isCharFast(charId: string): boolean {
    const cfg = effectivePerChar[charId];
    if (!cfg) return true;
    return !!cfg.artifactSetId; // 4pc set → fast
  }

  // Phase 1 gets 75% of total budget, Phase 3 (carry re-opt) gets the rest
  const totalBudgetMs = perCharDeadlineMs
    ? perCharDeadlineMs * allCharIds.length
    : 0;
  const phase1BudgetMs = totalBudgetMs * 0.75;
  const phase1Deadline = perCharDeadlineMs
    ? performance.now() + phase1BudgetMs
    : undefined;

  // Per-char caps (fast chars get a small cap, slow chars get the remaining pool)
  const charDeadlines: Record<string, number | undefined> = {};
  if (perCharDeadlineMs) {
    const fastBudget = perCharDeadlineMs * FAST_CHAR_TIME_FRACTION;
    const fastChars = phase1Order.filter(isCharFast);
    const slowChars = phase1Order.filter((id) => !isCharFast(id));

    for (const cid of fastChars) charDeadlines[cid] = fastBudget;
    // Slow chars: no individual cap — they use remaining pool time
    for (const cid of slowChars) charDeadlines[cid] = undefined; // use pool

    // biome-ignore lint/suspicious/noExplicitAny: debug flag
    if ((globalThis as any).__MONA_DEBUG__) {
      const slowBudget =
        slowChars.length > 0
          ? (phase1BudgetMs - fastBudget * fastChars.length) / slowChars.length
          : phase1BudgetMs;
      console.log(
        `    [time-alloc] phase1=${(phase1BudgetMs / 1000).toFixed(1)}s fast=${fastChars.length}×${(fastBudget / 1000).toFixed(1)}s slow=${slowChars.length}×~${(slowBudget / 1000).toFixed(1)}s`
      );
    }
  }

  let runningBaseSheets = { ...baseSheets };

  for (let ci = 0; ci < phase1Order.length; ci++) {
    const charId = phase1Order[ci];
    const charConfig = effectivePerChar[charId];
    if (!charConfig) continue;
    const charStartTime = performance.now();

    const isCarry = carryCharIds.includes(charId);
    const passId: TeamOptPassId = isCarry ? "carry-1" : "support";
    const charTopK = isCarry ? CARRY_TOP_K : TOP_K;

    yield {
      currentPass: passId,
      currentPassCharId: charId,
      passIndex: ci,
      totalPasses: totalPhases,
      passPhase: "pruning",
      passProgress: 0,
      overallProgress: ci / totalPhases,
      passResults: [...passResults],
      done: false,
    } satisfies TeamOptimizationProgress;
    await new Promise((r) => setTimeout(r, 0));

    // Dynamic deadline: use per-char cap if set, else use remaining pool time
    const charCapMs = charDeadlines[charId];
    let charDeadline: number | undefined;
    if (phase1Deadline) {
      const remaining = phase1Deadline - performance.now();
      if (charCapMs) {
        // Fast char: use the smaller of cap or remaining pool
        charDeadline = performance.now() + Math.min(charCapMs, remaining);
      } else {
        // Slow char: use remaining pool time
        charDeadline = phase1Deadline;
      }
    }
    const carryNoSetLimit = isCarry
      ? MAX_ARTS_PER_SLOT
      : MAX_ARTS_PER_SLOT_NOSET;
    let result = runCharacterAStar(
      charId,
      charConfig,
      effectiveTeamBuild,
      carryCharId,
      formulaId,
      inventory,
      globalConfig,
      runningBaseSheets,
      calcContext,
      undefined,
      reactionOverride,
      comboScoreFn,
      charTopK,
      charDeadline,
      undefined,
      carryNoSetLimit
    );

    // ignoreArtifactSets fallback
    if (
      result.failReason &&
      opts.ignoreArtifactSets?.[charId] &&
      (charConfig.artifactSetId ||
        (charConfig.artifactHalfSetIds?.length ?? 0) > 0)
    ) {
      effectivePerChar[charId] = {
        ...charConfig,
        artifactSetId: null,
        artifactHalfSetIds: [],
      };
      effectiveTeamBuild = rebuildTeamBuild();
      result = runCharacterAStar(
        charId,
        effectivePerChar[charId],
        effectiveTeamBuild,
        carryCharId,
        formulaId,
        inventory,
        globalConfig,
        runningBaseSheets,
        calcContext,
        undefined,
        reactionOverride,
        comboScoreFn,
        charTopK,
        charDeadline,
        undefined,
        carryNoSetLimit
      );
    }

    topKByChar[charId] = result.collector.results;
    if (result.failReason) failReasons[charId] = result.failReason;

    // biome-ignore lint/suspicious/noExplicitAny: debug flag
    if ((globalThis as any).__MONA_DEBUG__) {
      const elapsed = ((performance.now() - charStartTime) / 1000).toFixed(1);
      const hasSet =
        !!charConfig.artifactSetId ||
        (charConfig.artifactHalfSetIds?.length ?? 0) > 0;
      console.log(
        `    [char] ${charId} ${elapsed}s evals=${result.evaluations} set=${hasSet} topK=${result.collector.size} best=${Math.round(result.collector.best?.damage ?? 0)}`
      );
    }

    const best = result.collector.best;
    passResults.push({
      passId,
      charId,
      bestDamage: best?.damage ?? -1,
      bestArtifacts: best
        ? artsTupleToRecord(best.artifacts)
        : { ...emptyArtifacts },
      failReason: result.failReason,
    });

    // Update running base sheets with this character's top-1 artifacts
    if (best) {
      const pieces = best.artifacts.filter((a): a is ArtifactData => a != null);
      if (pieces.length > 0) {
        runningBaseSheets = {
          ...runningBaseSheets,
          [charId]: StatSheet.fromArtifacts(pieces),
        };
      }
    }

    yield {
      currentPass: passId,
      currentPassCharId: charId,
      passIndex: ci,
      totalPasses: totalPhases,
      passPhase: "evaluating",
      passProgress: 1,
      overallProgress: (ci + 1) / totalPhases,
      passResults: [...passResults],
      done: false,
    } satisfies TeamOptimizationProgress;
    await new Promise((r) => setTimeout(r, 0));
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 1b: Contested Artifact Resolution (same as V2)
  // ════════════════════════════════════════════════════════════════════

  {
    const artUsage: Map<string, { charId: string; count: number }[]> =
      new Map();
    for (const charId of allCharIds) {
      const entries = topKByChar[charId] ?? [];
      if (entries.length === 0) continue;
      const artCounts = new Map<string, number>();
      for (const entry of entries) {
        for (const artId of entry.artifactIds) {
          artCounts.set(artId, (artCounts.get(artId) ?? 0) + 1);
        }
      }
      for (const [artId, count] of artCounts) {
        if (count / entries.length >= 0.8) {
          if (!artUsage.has(artId)) artUsage.set(artId, []);
          artUsage.get(artId)!.push({ charId, count });
        }
      }
    }

    const contested: {
      artId: string;
      chars: { charId: string; count: number }[];
    }[] = [];
    for (const [artId, chars] of artUsage) {
      if (chars.length >= 2) {
        contested.push({ artId, chars });
      }
    }

    if (contested.length > 0) {
      const excludeByChar = new Map<string, Set<string>>();

      for (const { artId, chars } of contested) {
        const sorted = [...chars].sort((a, b) => {
          const aIsCarry = carryCharIds.includes(a.charId) ? 1 : 0;
          const bIsCarry = carryCharIds.includes(b.charId) ? 1 : 0;
          if (aIsCarry !== bIsCarry) return bIsCarry - aIsCarry;
          const aDmg = topKByChar[a.charId]?.[0]?.damage ?? 0;
          const bDmg = topKByChar[b.charId]?.[0]?.damage ?? 0;
          return bDmg - aDmg;
        });

        for (let i = 1; i < sorted.length; i++) {
          const loserId = sorted[i].charId;
          if (!excludeByChar.has(loserId))
            excludeByChar.set(loserId, new Set());
          excludeByChar.get(loserId)!.add(artId);
        }
      }

      for (const [loserId, excludeSet] of excludeByChar) {
        const loserConfig = effectivePerChar[loserId];
        if (!loserConfig) continue;

        const loserIsCarry = carryCharIds.includes(loserId);
        // Phase 1b re-runs get a short budget (supports are fast, carries are already searched)
        const altBudgetMs = perCharDeadlineMs
          ? Math.min(perCharDeadlineMs * FAST_CHAR_TIME_FRACTION, 2000)
          : undefined;
        const altDeadline = altBudgetMs
          ? performance.now() + altBudgetMs
          : undefined;
        const loserTopK = loserIsCarry ? CARRY_TOP_K : TOP_K;
        const loserNoSetLimit = loserIsCarry
          ? MAX_ARTS_PER_SLOT
          : MAX_ARTS_PER_SLOT_NOSET;

        const altResult = runCharacterAStar(
          loserId,
          loserConfig,
          effectiveTeamBuild,
          carryCharId,
          formulaId,
          inventory,
          globalConfig,
          runningBaseSheets,
          calcContext,
          excludeSet,
          reactionOverride,
          comboScoreFn,
          loserTopK,
          altDeadline,
          undefined,
          loserNoSetLimit
        );

        const existing = topKByChar[loserId] ?? [];
        const alternatives = altResult.collector.results;
        const merged = [...existing];
        for (const alt of alternatives) {
          let usesExcluded = false;
          for (const artId of excludeSet) {
            if (alt.artifactIds.has(artId)) {
              usesExcluded = true;
              break;
            }
          }
          if (!usesExcluded) merged.push(alt);
        }
        merged.sort((a, b) => b.damage - a.damage);
        topKByChar[loserId] = merged.slice(0, loserTopK * 2);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 2: Team allocation via conflict-aware DFS
  // ════════════════════════════════════════════════════════════════════

  const allocatableChars = allCharIds.filter(
    (id) => (topKByChar[id]?.length ?? 0) > 0
  );

  yield {
    currentPass: "carry-2",
    currentPassCharId: carryCharId,
    passIndex: allCharIds.length,
    totalPasses: totalPhases,
    passPhase: "evaluating",
    passProgress: 0,
    overallProgress: allCharIds.length / totalPhases,
    passResults: [...passResults],
    done: false,
  } satisfies TeamOptimizationProgress;
  await new Promise((r) => setTimeout(r, 0));

  let { candidates } = findBestTeamAllocation(
    allocatableChars,
    topKByChar,
    MAX_TEAM_SEARCH,
    carryCharIds
  );

  // Sequential B&B fallback if DFS + greedy both failed
  if (candidates.length === 0 && allocatableChars.length > 1) {
    const seqOrder = [
      ...allocatableChars.filter((id) => carryCharIds.includes(id)),
      ...allocatableChars.filter((id) => !carryCharIds.includes(id)),
    ];
    const seqUsed = new Set<string>();
    const seqAssignment: Record<string, TopKEntry> = {};
    let seqScore = 0;

    for (const cid of seqOrder) {
      const entries = topKByChar[cid] ?? [];
      let found = false;
      for (const entry of entries) {
        let conflict = false;
        for (const artId of entry.artifactIds) {
          if (seqUsed.has(artId)) {
            conflict = true;
            break;
          }
        }
        if (!conflict) {
          seqAssignment[cid] = entry;
          seqScore += entry.damage;
          for (const artId of entry.artifactIds) seqUsed.add(artId);
          found = true;
          break;
        }
      }

      if (!found) {
        const charConfig = effectivePerChar[cid];
        if (!charConfig) continue;
        // Sequential fallback: short budget
        const cidBudgetMs = perCharDeadlineMs
          ? Math.min(perCharDeadlineMs * FAST_CHAR_TIME_FRACTION, 2000)
          : undefined;
        const altDeadline = cidBudgetMs
          ? performance.now() + cidBudgetMs
          : undefined;
        const altResult = runCharacterAStar(
          cid,
          charConfig,
          effectiveTeamBuild,
          carryCharId,
          formulaId,
          inventory,
          globalConfig,
          runningBaseSheets,
          calcContext,
          seqUsed,
          reactionOverride,
          comboScoreFn,
          1,
          altDeadline
        );
        const best = altResult.collector.best;
        if (best) {
          seqAssignment[cid] = best;
          seqScore += best.damage;
          for (const artId of best.artifactIds) seqUsed.add(artId);
        }
      }
    }

    if (Object.keys(seqAssignment).length === seqOrder.length) {
      candidates = [{ assignment: { ...seqAssignment }, score: seqScore }];
    }
  }

  // Re-evaluate top candidates with full team damage
  let bestAllocation: Record<string, TopKEntry> | null = null;
  let bestFullDamage = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const candidateArts: Record<string, Record<Slot, ArtifactData | null>> = {};
    for (const charId of allCharIds) {
      if (candidate.assignment[charId]) {
        candidateArts[charId] = artsTupleToRecord(
          candidate.assignment[charId].artifacts
        );
      } else {
        const best = topKByChar[charId]?.[0];
        candidateArts[charId] = best
          ? artsTupleToRecord(best.artifacts)
          : { ...emptyArtifacts };
      }
    }

    const sheets = buildSheetsFromArtifacts(baseSheets, candidateArts);
    let damage: number;
    if (comboScoreFn) {
      damage = comboScoreFn(sheets, carryCharId);
    } else {
      try {
        const postStats = effectiveTeamBuild.getTeamStats(
          sheets,
          carryCharId,
          calcContext
        );
        damage = effectiveTeamBuild.getDamageResult(
          carryCharId,
          formulaId,
          postStats,
          calcContext,
          reactionOverride
        ).totalDamage;
      } catch {
        damage = 0;
      }
    }

    if (damage > bestFullDamage) {
      bestFullDamage = damage;
      bestAllocation = candidate.assignment;
    }
  }

  // Build final artifact assignment from best allocation
  const bestArtifactsByChar: Record<
    string,
    Record<Slot, ArtifactData | null>
  > = {};
  for (const charId of allCharIds) {
    if (bestAllocation?.[charId]) {
      bestArtifactsByChar[charId] = artsTupleToRecord(
        bestAllocation[charId].artifacts
      );
    } else {
      const best = topKByChar[charId]?.[0];
      bestArtifactsByChar[charId] = best
        ? artsTupleToRecord(best.artifacts)
        : { ...emptyArtifacts };
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 3: Carry Re-optimization
  // ════════════════════════════════════════════════════════════════════

  for (const carryId of carryCharIds) {
    const carryConfig = effectivePerChar[carryId];
    if (!carryConfig) continue;

    const refinedBaseSheets: Record<string, StatSheet> = { ...baseSheets };
    const excludedIds = new Set<string>();

    for (const otherId of allCharIds) {
      if (otherId === carryId) continue;
      const otherArts = bestArtifactsByChar[otherId];
      if (!otherArts) continue;
      const pieces = allSlots
        .map((s) => otherArts[s])
        .filter((a): a is ArtifactData => a != null);
      if (pieces.length > 0) {
        refinedBaseSheets[otherId] = StatSheet.fromArtifacts(pieces);
      }
      for (const art of pieces) excludedIds.add(art.id);
    }

    yield {
      currentPass: "carry-2",
      currentPassCharId: carryId,
      passIndex: allCharIds.length + 1,
      totalPasses: totalPhases + 1,
      passPhase: "evaluating",
      passProgress: 0,
      overallProgress: (allCharIds.length + 1) / (totalPhases + 1),
      passResults: [...passResults],
      done: false,
    } satisfies TeamOptimizationProgress;
    await new Promise((r) => setTimeout(r, 0));

    // Warm-start: evaluate Phase 2 carry build in refined context
    const phase2Pieces = allSlots.map(
      (s) => bestArtifactsByChar[carryId]?.[s] ?? null
    ) as ArtifactTuple;
    const phase2Eval = evaluateBuild(
      phase2Pieces,
      effectiveTeamBuild,
      carryId,
      carryCharId,
      formulaId,
      refinedBaseSheets,
      carryCharId,
      calcContext,
      carryId,
      carryConfig.targetEr,
      carryConfig.targetCr,
      reactionOverride,
      comboScoreFn
    );
    const phase2Damage = phase2Eval.damage;

    // Phase 3: carry re-opt gets remaining 25% of total budget / number of carries
    const phase3BudgetMs =
      totalBudgetMs > 0
        ? Math.max((totalBudgetMs * 0.25) / carryCharIds.length, 1000)
        : undefined;
    const refineDeadline = phase3BudgetMs
      ? performance.now() + phase3BudgetMs
      : undefined;
    const refineResult = runCharacterAStar(
      carryId,
      carryConfig,
      effectiveTeamBuild,
      carryCharId,
      formulaId,
      inventory,
      globalConfig,
      refinedBaseSheets,
      calcContext,
      excludedIds,
      reactionOverride,
      comboScoreFn,
      CARRY_TOP_K,
      refineDeadline,
      phase2Damage > 0 ? phase2Damage : undefined,
      MAX_ARTS_PER_SLOT
    );

    if (
      refineResult.collector.best &&
      refineResult.collector.best.damage > phase2Damage
    ) {
      bestArtifactsByChar[carryId] = artsTupleToRecord(
        refineResult.collector.best.artifacts
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Final: detect accidental sets and rebuild if needed
  // ════════════════════════════════════════════════════════════════════

  let setsChanged = effectiveTeamBuild !== teamBuild;
  for (const charId of allCharIds) {
    const arts = bestArtifactsByChar[charId];
    if (!arts) continue;
    const pieces = allSlots
      .map((s) => arts[s])
      .filter(Boolean) as ArtifactData[];
    const detected = detectEquippedSets(pieces);
    const epc = effectivePerChar[charId];
    if (!epc) continue;

    const currentSetId = epc.artifactSetId ?? null;
    const currentHalfIds = epc.artifactHalfSetIds ?? [];
    const detectedSetId = detected.artifactSetId;
    const detectedHalfIds = detected.artifactHalfSetIds;

    const setIdChanged = detectedSetId !== currentSetId;
    const halfIdsChanged =
      detectedHalfIds.length !== currentHalfIds.length ||
      [...detectedHalfIds].sort().join(",") !==
        [...currentHalfIds].sort().join(",");

    if (setIdChanged || halfIdsChanged) {
      effectivePerChar[charId] = {
        ...epc,
        artifactSetId: detectedSetId,
        artifactHalfSetIds: detectedHalfIds,
      };
      setsChanged = true;
    }
  }

  if (setsChanged) effectiveTeamBuild = rebuildTeamBuild();

  const finalSheets = buildSheetsFromArtifacts(baseSheets, bestArtifactsByChar);

  const resultBase = {
    bestArtifactsByChar,
    passResults,
    failReasons,
    saturatedCharIds: [] as string[],
    ...(setsChanged ? { teamBuild: effectiveTeamBuild } : {}),
    done: true as const,
  };

  if (isComboMode) {
    let comboRes: ComboResult;
    try {
      comboRes = evaluateCombo(
        effectiveTeamBuild,
        combo,
        finalSheets,
        calcContext,
        reactionOverrides
      );
    } catch {
      comboRes = { lineDamages: [], totalDamage: 0 };
    }
    yield {
      ...resultBase,
      mode: "combo",
      bestDamage: comboRes.totalDamage,
      bestComboResult: comboRes,
    } satisfies TeamOptComboResult;
  } else {
    const finalPostStats = effectiveTeamBuild.getTeamStats(
      finalSheets,
      carryCharId,
      calcContext
    );
    const finalDmg = effectiveTeamBuild.getDamageResult(
      carryCharId,
      formulaId,
      finalPostStats,
      calcContext,
      reactionOverride
    );
    yield {
      ...resultBase,
      mode: "single",
      bestDamage: finalDmg.totalDamage,
      bestDamageResult: finalDmg,
    } satisfies TeamOptSingleResult;
  }
}
