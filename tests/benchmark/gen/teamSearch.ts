/**
 * Shared team-level optimizer infrastructure.
 *
 * Provides the team wrapper (phases 1–4) that each per-character search
 * algorithm plugs into:
 *   Phase 1:  Per-character search → top-K results
 *   Phase 1b: Contested artifact resolution
 *   Phase 2:  Team allocation via conflict-aware DFS
 *   Phase 3:  Carry re-optimization
 *   Phase 4:  Constraint repair
 *
 * Algorithm files (astar.ts, mona.ts, monaV2.ts) implement a PerCharSearchFn
 * and export `runTeamOptimization` by calling `createTeamOptimizer`.
 */

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
import {
  TeamBuild,
  evaluateCombo,
  hasOffFieldParts,
} from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import { isPctStat } from "@/lib/team-comp/displayFormatters";
import { detectEquippedSets } from "@/lib/team-comp/teamOptUtils";
import type {
  CalcContext,
  CharOptConfig,
  ComboResult,
  DamageResult,
  OptFailReason,
  ReactionOverride,
  StatKey,
  TeamOptPassId,
  TeamOptPassResult,
  TeamOptYield,
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";

// ─── Constants ───

export const TOP_K = 50;
export const CARRY_TOP_K = 100;
export const MAX_TEAM_SEARCH = 500_000;
export const MAX_ARTS_PER_SLOT = 15;
export const MAX_ARTS_PER_SLOT_NOSET = 10;
export const FAST_CHAR_TIME_FRACTION = 0.3;
const ALLOC_TOP_N = 50;

const warnedCalcErrors = new Set<string>();

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export type ArtifactTuple = [
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
];

export interface TopKEntry {
  damage: number;
  result: DamageResult | null;
  artifacts: ArtifactTuple;
  artifactIds: Set<string>;
}

export interface SuperArtifact {
  maxEr: number;
  maxCr: number;
  stats: Partial<Record<StatKey, number>>;
}

export interface PreparedSlotData {
  allArtifacts: ArtifactData[];
  bySet: Map<string, ArtifactData[]>;
  slotSuperArtifact: SuperArtifact;
  setSuperArtifacts: Map<string, SuperArtifact>;
}

// ─── Per-Character Search Interface ───

export interface PerCharSearchOpts {
  charId: string;
  charConfig: CharOptConfig;
  teamBuild: TeamBuild;
  carryCharId: string;
  formulaId: string;
  inventory: ArtifactData[];
  globalConfig: GlobalStatWeights;
  baseSheets: Record<string, StatSheet>;
  calcContext: CalcContext;
  excludedIds: Set<string> | undefined;
  reactionOverride: ReactionOverride | undefined;
  scoreFn:
    | ((sheets: Record<string, StatSheet>, calcTargetId: string) => number)
    | undefined;
  topK: number;
  deadline?: number;
  warmStartThreshold?: number;
  noSetArtsPerSlot?: number;
}

export interface PerCharSearchResult {
  collector: TopKCollector;
  evaluations: number;
  failReason?: OptFailReason;
}

export type PerCharSearchFn = (opts: PerCharSearchOpts) => PerCharSearchResult;

// ═══════════════════════════════════════════════════════════════════════
// Top-K Collector
// ═══════════════════════════════════════════════════════════════════════

export class TopKCollector {
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

// ═══════════════════════════════════════════════════════════════════════
// Artifact Helpers
// ═══════════════════════════════════════════════════════════════════════

export function getArtifactEr(art: ArtifactData | null): number {
  if (!art) return 0;
  let er = 0;
  if (art.mainStatKey === "er")
    er += getMainStatValueAtLevel("er", art.rarity, art.level) / 100;
  if (art.substats.er) er += art.substats.er / 100;
  return er;
}

export function getArtifactCr(art: ArtifactData | null): number {
  if (!art) return 0;
  let cr = 0;
  if (art.mainStatKey === "cr")
    cr += getMainStatValueAtLevel("cr", art.rarity, art.level) / 100;
  if (art.substats.cr) cr += art.substats.cr / 100;
  return cr;
}

export function getArtifactStats(
  art: ArtifactData
): Partial<Record<StatKey, number>> {
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

export function buildSuperArtifact(artifacts: ArtifactData[]): SuperArtifact {
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

export function computeWeightScore(
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

// ═══════════════════════════════════════════════════════════════════════
// Damage Evaluation
// ═══════════════════════════════════════════════════════════════════════

export function evaluateBuild(
  pieces: ArtifactTuple,
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcTargetId: string,
  calcContext: CalcContext,
  erCheckCharId: string,
  minEr: number,
  minCr: number,
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

  if (minEr > 0) {
    const er = postStats[erCheckCharId]?.get("er", null) ?? 0;
    if (er < minEr) return { damage: -1, result: null };
  }
  if (minCr > 0) {
    const cr = postStats[erCheckCharId]?.get("cr", null) ?? 0;
    if (cr < minCr) return { damage: -1, result: null };
  }
  if (scoreFn)
    return { damage: scoreFn(updatedSheets, calcTargetId), result: null };

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

  const dmgRes = teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride,
    offFieldStats
  );
  return { damage: dmgRes.totalDamage, result: dmgRes };
}

export function evaluateUpperBound(
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
    reactionOverride,
    offFieldStats
  ).totalDamage;
}

// ═══════════════════════════════════════════════════════════════════════
// Set Composition Patterns
// ═══════════════════════════════════════════════════════════════════════

export const SET4_PATTERNS: number[][] = [
  [0, 1, 1, 1, 1],
  [1, 0, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 0, 1],
  [1, 1, 1, 1, 0],
];

export const SET22_PATTERNS: number[][] = (() => {
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

// ═══════════════════════════════════════════════════════════════════════
// Slot Data Preparation
// ═══════════════════════════════════════════════════════════════════════

export function prepareSlotData(
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

export function buildSlotGroupsForPattern(
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
      groups.push(slotData[s].allArtifacts.slice(0, maxPerSlot));
      supers.push(slotData[s].slotSuperArtifact);
    } else {
      const key = pattern[s] === 1 ? set1Key : set2Key!;
      const setArts = slotData[s].bySet.get(key);
      if (!setArts || setArts.length === 0) return null;
      groups.push(setArts.slice(0, maxPerSlot));
      supers.push(
        slotData[s].setSuperArtifacts.get(key) ?? slotData[s].slotSuperArtifact
      );
    }
  }
  return { groups, supers };
}

// ═══════════════════════════════════════════════════════════════════════
// Common per-char search setup (CR discount, slot data, set feasibility)
// ═══════════════════════════════════════════════════════════════════════

export interface CharSearchSetup {
  slotData: PreparedSlotData[];
  erFloor: number;
  crFloor: number;
  crDiscount: number;
  is4pc: boolean;
  is2pc: boolean;
  collector: TopKCollector;
}

/**
 * Common setup logic shared by all per-character search algorithms.
 * Returns null + failReason if the search is infeasible.
 */
export function setupCharSearch(
  opts: PerCharSearchOpts
):
  | { setup: CharSearchSetup; failReason?: undefined }
  | { setup?: undefined; failReason: OptFailReason } {
  const {
    charId,
    charConfig,
    teamBuild,
    carryCharId,
    inventory,
    globalConfig,
    baseSheets,
    calcContext,
    excludedIds,
    topK,
    warmStartThreshold,
  } = opts;
  const swapCharId = charId;
  const calcTargetId = carryCharId;
  const erCheckCharId = charId;

  // CR discount
  let crDiscount = 1;
  if (swapCharId === carryCharId) {
    if (calcContext.critRateTarget != null) {
      const blSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
      const blStats = teamBuild.getTeamStats(
        blSheets,
        calcTargetId,
        calcContext
      );
      const effectiveCr = blStats[carryCharId]?.get("cr", null) ?? 0;
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
    return { failReason: { kind: "empty-pool", emptySlots } };
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
    if (charConfig.minEr > 0)
      erFloor = blStats[erCheckCharId]?.get("er", null) ?? 0;
    if (charConfig.minCr > 0)
      crFloor = blStats[erCheckCharId]?.get("cr", null) ?? 0;
  }

  const collector = new TopKCollector(topK, warmStartThreshold);

  return {
    setup: { slotData, erFloor, crFloor, crDiscount, is4pc, is2pc, collector },
  };
}

/**
 * Diagnose why a per-char search found no results.
 */
export function diagnoseFailure(
  charConfig: CharOptConfig,
  slotData: PreparedSlotData[],
  erFloor: number,
  crFloor: number,
  evaluations: number
): OptFailReason {
  if (charConfig.minEr > 0 || charConfig.minCr > 0) {
    let maxEr = 0;
    let maxCr = 0;
    for (let s = 0; s < 5; s++) {
      maxEr += slotData[s].slotSuperArtifact.maxEr;
      maxCr += slotData[s].slotSuperArtifact.maxCr;
    }
    if (charConfig.minEr > 0 && erFloor + maxEr < charConfig.minEr) {
      return {
        kind: "er-unmet",
        minEr: charConfig.minEr,
        bestEr: erFloor + maxEr,
      };
    }
    if (charConfig.minCr > 0 && crFloor + maxCr < charConfig.minCr) {
      return {
        kind: "cr-unmet",
        minCr: charConfig.minCr,
        bestCr: crFloor + maxCr,
      };
    }
  }
  return { kind: "all-filtered", combinationsTotal: evaluations };
}

// ═══════════════════════════════════════════════════════════════════════
// Team Allocation via Conflict-Aware DFS
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

  if (charIds.length <= 4) {
    const perms = generatePermutations(charIds);
    for (const perm of perms) {
      const key = perm.join(",");
      if (!orderings.some((o) => o.join(",") === key)) {
        orderings.push(perm);
      }
    }
  }

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

  for (const ordering of uniqueOrderings) {
    const orderIterLimit = iterations + iterPerOrdering;
    dfs(ordering, 0, new Set(), 0, {}, orderIterLimit);

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
// Team Optimization Entry Point
// ═══════════════════════════════════════════════════════════════════════

const emptyArtifacts: Record<Slot, ArtifactData | null> = {
  flower: null,
  plume: null,
  sands: null,
  goblet: null,
  circlet: null,
};

export function artsTupleToRecord(
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
 * Creates a team optimizer that uses the given per-character search function.
 * All algorithm files call this with their own search implementation.
 */
export function createTeamOptimizer(
  perCharSearch: PerCharSearchFn
): (opts: TeamOptimizerOptions) => AsyncGenerator<TeamOptYield> {
  return (opts: TeamOptimizerOptions) => runTeamOpt(opts, perCharSearch);
}

async function* runTeamOpt(
  opts: TeamOptimizerOptions,
  perCharSearch: PerCharSearchFn
): AsyncGenerator<TeamOptYield> {
  const {
    teamBuild,
    carryCharId,
    inventory,
    calcContext,
    globalConfig,
    baseSheets,
    perChar,
    formula,
    perCharDeadlineMs,
  } = opts;
  const { combo, reactionOverrides } = formula;

  const formulaId =
    combo.lines.find((l) => l.charId === carryCharId)?.formulaId ?? "";
  const reactionOverride = reactionOverrides?.[`${carryCharId}.${formulaId}`];

  const isComboMode =
    combo != null && combo.lines.filter((l) => l.count > 0).length > 0;

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
            console.warn("[teamSearch] comboScoreFn failed:", e);
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
    return new TeamBuild(newConfigs, teamBuild.combatOpts, teamBuild.enemyAura);
  }

  // ══════════════════════════════════════════════════════════════════
  // Phase 1: Sequential Per-character search → top-K results
  // ══════════════════════════════════════════════════════════════════

  const topKByChar: Record<string, TopKEntry[]> = {};
  const failReasons: Record<string, OptFailReason> = {};
  const passResults: TeamOptPassResult[] = [];
  const totalPhases = allCharIds.length + 1;

  const phase1Order = [
    ...allCharIds.filter((id) => carryCharIds.includes(id)),
    ...allCharIds.filter((id) => !carryCharIds.includes(id)),
  ];

  function isCharFast(charId: string): boolean {
    const cfg = effectivePerChar[charId];
    if (!cfg) return true;
    return !!cfg.artifactSetId;
  }

  const totalBudgetMs = perCharDeadlineMs
    ? perCharDeadlineMs * allCharIds.length
    : 0;
  const phase1BudgetMs = totalBudgetMs * 0.75;
  const phase1Deadline = perCharDeadlineMs
    ? performance.now() + phase1BudgetMs
    : undefined;

  const charDeadlines: Record<string, number | undefined> = {};
  if (perCharDeadlineMs) {
    const fastBudget = perCharDeadlineMs * FAST_CHAR_TIME_FRACTION;
    const fastChars = phase1Order.filter(isCharFast);
    const slowChars = phase1Order.filter((id) => !isCharFast(id));

    for (const cid of fastChars) charDeadlines[cid] = fastBudget;
    for (const cid of slowChars) charDeadlines[cid] = undefined;
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
      phase: "phase1",
      passResults: [...passResults],
      done: false,
    } satisfies TeamOptimizationProgress;
    await new Promise((r) => setTimeout(r, 0));

    const charCapMs = charDeadlines[charId];
    let charDeadline: number | undefined;
    if (phase1Deadline) {
      const remaining = phase1Deadline - performance.now();
      if (charCapMs) {
        charDeadline = performance.now() + Math.min(charCapMs, remaining);
      } else {
        charDeadline = phase1Deadline;
      }
    }
    const carryNoSetLimit = isCarry
      ? MAX_ARTS_PER_SLOT
      : MAX_ARTS_PER_SLOT_NOSET;
    let result = perCharSearch({
      charId,
      charConfig,
      teamBuild: effectiveTeamBuild,
      carryCharId,
      formulaId,
      inventory,
      globalConfig,
      baseSheets: runningBaseSheets,
      calcContext,
      excludedIds: undefined,
      reactionOverride,
      scoreFn: comboScoreFn,
      topK: charTopK,
      deadline: charDeadline,
      warmStartThreshold: undefined,
      noSetArtsPerSlot: carryNoSetLimit,
    });

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
      result = perCharSearch({
        charId,
        charConfig: effectivePerChar[charId],
        teamBuild: effectiveTeamBuild,
        carryCharId,
        formulaId,
        inventory,
        globalConfig,
        baseSheets: runningBaseSheets,
        calcContext,
        excludedIds: undefined,
        reactionOverride,
        scoreFn: comboScoreFn,
        topK: charTopK,
        deadline: charDeadline,
        noSetArtsPerSlot: carryNoSetLimit,
      });
    }

    topKByChar[charId] = result.collector.results;
    if (result.failReason) failReasons[charId] = result.failReason;

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
      phase: "phase1",
      passResults: [...passResults],
      done: false,
    } satisfies TeamOptimizationProgress;
    await new Promise((r) => setTimeout(r, 0));
  }

  // ══════════════════════════════════════════════════════════════════
  // Phase 1b: Contested Artifact Resolution
  // ══════════════════════════════════════════════════════════════════

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

        const altResult = perCharSearch({
          charId: loserId,
          charConfig: loserConfig,
          teamBuild: effectiveTeamBuild,
          carryCharId,
          formulaId,
          inventory,
          globalConfig,
          baseSheets: runningBaseSheets,
          calcContext,
          excludedIds: excludeSet,
          reactionOverride,
          scoreFn: comboScoreFn,
          topK: loserTopK,
          deadline: altDeadline,
          noSetArtsPerSlot: loserNoSetLimit,
        });

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

  // ══════════════════════════════════════════════════════════════════
  // Phase 2: Team allocation via conflict-aware DFS
  // ══════════════════════════════════════════════════════════════════

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
    phase: "phase2",
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

  // Sequential fallback
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
        const cidBudgetMs = perCharDeadlineMs
          ? Math.min(perCharDeadlineMs * FAST_CHAR_TIME_FRACTION, 2000)
          : undefined;
        const altDeadline = cidBudgetMs
          ? performance.now() + cidBudgetMs
          : undefined;
        const altResult = perCharSearch({
          charId: cid,
          charConfig,
          teamBuild: effectiveTeamBuild,
          carryCharId,
          formulaId,
          inventory,
          globalConfig,
          baseSheets: runningBaseSheets,
          calcContext,
          excludedIds: seqUsed,
          reactionOverride,
          scoreFn: comboScoreFn,
          topK: 1,
          deadline: altDeadline,
        });
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
        let offFieldStats: Record<string, StatSheet> | undefined;
        if (hasOffFieldParts(effectiveTeamBuild, carryCharId, formulaId)) {
          const otherCharId = Object.keys(effectiveTeamBuild.charBuilds).find(
            (id) => id !== carryCharId
          );
          if (otherCharId) {
            offFieldStats = effectiveTeamBuild.getTeamStats(
              sheets,
              otherCharId,
              calcContext
            );
          }
        }
        damage = effectiveTeamBuild.getDamageResult(
          carryCharId,
          formulaId,
          postStats,
          calcContext,
          reactionOverride,
          offFieldStats
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

  // ══════════════════════════════════════════════════════════════════
  // Phase 3: Carry Re-optimization
  // ══════════════════════════════════════════════════════════════════

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
      phase: "phase3",
      passResults: [...passResults],
      done: false,
    } satisfies TeamOptimizationProgress;
    await new Promise((r) => setTimeout(r, 0));

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
      carryConfig.minEr,
      carryConfig.minCr,
      reactionOverride,
      comboScoreFn
    );
    const phase2Damage = phase2Eval.damage;

    const phase3BudgetMs =
      totalBudgetMs > 0
        ? Math.max((totalBudgetMs * 0.25) / carryCharIds.length, 1000)
        : undefined;
    const refineDeadline = phase3BudgetMs
      ? performance.now() + phase3BudgetMs
      : undefined;
    const refineResult = perCharSearch({
      charId: carryId,
      charConfig: carryConfig,
      teamBuild: effectiveTeamBuild,
      carryCharId,
      formulaId,
      inventory,
      globalConfig,
      baseSheets: refinedBaseSheets,
      calcContext,
      excludedIds,
      reactionOverride,
      scoreFn: comboScoreFn,
      topK: CARRY_TOP_K,
      deadline: refineDeadline,
      warmStartThreshold: phase2Damage > 0 ? phase2Damage : undefined,
      noSetArtsPerSlot: MAX_ARTS_PER_SLOT,
    });

    if (
      refineResult.collector.best &&
      refineResult.collector.best.damage > phase2Damage
    ) {
      bestArtifactsByChar[carryId] = artsTupleToRecord(
        refineResult.collector.best.artifacts
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Phase 4: Constraint repair
  // ══════════════════════════════════════════════════════════════════

  {
    const repairSheets = buildSheetsFromArtifacts(
      baseSheets,
      bestArtifactsByChar
    );
    const repairStats = effectiveTeamBuild.getTeamStats(
      repairSheets,
      carryCharId,
      calcContext
    );

    const violatingChars: { charId: string; kind: "er" | "cr" }[] = [];
    for (const charId of allCharIds) {
      const charConfig = effectivePerChar[charId];
      if (!charConfig) continue;
      if (charConfig.minEr > 0) {
        const er = repairStats[charId]?.get("er", null) ?? 0;
        if (er < charConfig.minEr - 1e-6) {
          violatingChars.push({ charId, kind: "er" });
        }
      }
      if (charConfig.minCr > 0) {
        const cr = repairStats[charId]?.get("cr", null) ?? 0;
        if (cr < charConfig.minCr - 1e-6) {
          violatingChars.push({ charId, kind: "cr" });
        }
      }
    }

    for (const { charId } of violatingChars) {
      const charConfig = effectivePerChar[charId];
      if (!charConfig) continue;

      const repairExcluded = new Set<string>();
      for (const [cid, arts] of Object.entries(bestArtifactsByChar)) {
        if (cid !== charId) {
          for (const slot of allSlots) {
            const a = arts[slot];
            if (a) repairExcluded.add(a.id);
          }
        }
      }

      const repairBaseSheets = buildSheetsFromArtifacts(
        baseSheets,
        bestArtifactsByChar
      );

      const repairResult = perCharSearch({
        charId,
        charConfig,
        teamBuild: effectiveTeamBuild,
        carryCharId,
        formulaId,
        inventory,
        globalConfig,
        baseSheets: repairBaseSheets,
        calcContext,
        excludedIds: repairExcluded,
        reactionOverride,
        scoreFn: comboScoreFn,
        topK: TOP_K,
        deadline: perCharDeadlineMs ? performance.now() + 5000 : undefined,
        noSetArtsPerSlot: MAX_ARTS_PER_SLOT,
      });

      if (
        repairResult.collector.best &&
        repairResult.collector.best.damage > 0
      ) {
        bestArtifactsByChar[charId] = artsTupleToRecord(
          repairResult.collector.best.artifacts
        );
        passResults.push({
          passId: "carry-2",
          charId,
          bestDamage: repairResult.collector.best.damage,
          bestArtifacts: bestArtifactsByChar[charId],
        });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Final: detect accidental sets and rebuild if needed
  // ══════════════════════════════════════════════════════════════════

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
    bestDamage: comboRes.totalDamage,
    bestComboResult: comboRes,
  } satisfies TeamOptimizationResult;
}
