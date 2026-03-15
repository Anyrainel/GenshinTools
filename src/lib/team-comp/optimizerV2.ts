/**
 * Optimizer V2: Branch-and-Bound Team Optimizer
 *
 * Complete replacement for teamOptimizer.ts.
 * Uses B&B with super-artifact upper-bound pruning per character,
 * then top-K conflict-aware DFS for team allocation.
 *
 * Algorithm:
 *   Phase 1: Per-character B&B → top-K results (guaranteed optimal per character)
 *   Phase 2: Team allocation via conflict-aware DFS on top-K results
 *            (finds best artifact assignment where no artifact is shared)
 *
 * Key advantages over V1:
 * - No hill-climbing blindspots (exhaustive with pruning)
 * - No N! permutation loop for conflict resolution
 * - Top-K provides natural alternatives for team allocation
 */

import { detectEquippedSets } from "@/components/team-comp/teamOptUtils";
import { artifactHalfSetsById, artifactIdToHalfSetId } from "@/data/constants";
import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { toInternal } from "@/lib/account-data/scoring/utils";
import {
  type BuildMatchResult,
  getMainStatValueAtLevel,
  getTargetMainStatsForSlot,
  scoreMainStat,
  scoreSlot,
} from "../account-data/artifactScore";
import { type OptimizerContext, TeamBuild, evaluateCombo } from "./damageCalc";
import { StatSheet } from "./damageModels";
import type {
  OptFailReason,
  OptimizationResult,
  OptimizerOptions,
} from "./optimizer";
import type {
  PerCharConfig,
  TeamOptComboResult,
  TeamOptPassId,
  TeamOptPassResult,
  TeamOptSingleResult,
  TeamOptYield,
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptimizerOptions,
} from "./teamOptimizer";
import type {
  CalcContext,
  ComboFormula,
  ComboResult,
  DamageResult,
  ReactionOverride,
  StatKey,
} from "./types";

// Re-export types so consumers can import from this module
export type {
  TeamOptPassResult,
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptSingleResult,
  TeamOptComboResult,
  TeamOptYield,
  TeamOptimizerOptions,
  PerCharConfig,
  TeamOptPassId,
};

// ─── Constants & Dynamic Hyperparameters ───

/** How many evaluations between cooperative yields. */
const YIELD_INTERVAL = 300;

/**
 * Compute dynamic hyperparameters based on inventory size.
 *
 * With small inventories (<500 artifacts), B&B completes quickly and smaller
 * top-K is sufficient. With large inventories (>1500), we need more top-K
 * alternatives for team allocation (more conflicts) but can afford it since
 * the DFS prunes effectively with a well-seeded threshold.
 *
 * Game limit: 2400 artifacts max. Typical: 1000-2000.
 * Per-set max observed: ~300 pieces. Per-set-slot max: ~60.
 */
function computeHyperparams(inventorySize: number): {
  topK: number;
  maxTeamSearch: number;
} {
  // topK: scale linearly from 100 (at 500 arts) to 300 (at 2400 arts)
  // More artifacts → more potential conflicts → need more alternatives
  const topK = Math.max(
    100,
    Math.min(300, Math.round(100 + (inventorySize - 500) * (200 / 1900)))
  );

  // maxTeamSearch: scale with topK^2 (DFS complexity grows with K)
  // At topK=100: 200K is plenty. At topK=300: need ~1M.
  const maxTeamSearch = Math.max(
    200_000,
    Math.min(2_000_000, Math.round(topK * topK * 20))
  );

  return { topK, maxTeamSearch };
}

const warnedCalcErrors = new Set<string>();

// ═══════════════════════════════════════════════════════════════════════
// Section 1: Super-Artifact B&B (single-character optimizer)
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
  /** Set of artifact IDs in this build (for conflict detection). */
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

    // Binary search for insert position (descending order)
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

// ─── Artifact Helpers ───

function getArtifactEr(art: ArtifactData | null): number {
  if (!art) return 0;
  let er = 0;
  if (art.mainStatKey === "er")
    er += toInternal(
      "er",
      getMainStatValueAtLevel("er", art.rarity, art.level)
    );
  if (art.substats.er) er += toInternal("er", art.substats.er);
  return er;
}

function getArtifactCr(art: ArtifactData | null): number {
  if (!art) return 0;
  let cr = 0;
  if (art.mainStatKey === "cr")
    cr += toInternal(
      "cr",
      getMainStatValueAtLevel("cr", art.rarity, art.level)
    );
  if (art.substats.cr) cr += toInternal("cr", art.substats.cr);
  return cr;
}

function getArtifactStats(art: ArtifactData): Partial<Record<StatKey, number>> {
  const stats: Partial<Record<StatKey, number>> = {};
  const mainVal = toInternal(
    art.mainStatKey,
    getMainStatValueAtLevel(art.mainStatKey, art.rarity, art.level)
  );
  stats[art.mainStatKey as StatKey] = mainVal;
  for (const [key, val] of Object.entries(art.substats)) {
    if (!val) continue;
    const sk = key as StatKey;
    stats[sk] = (stats[sk] ?? 0) + toInternal(key, val as number);
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
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number,
  optCtx?: OptimizerContext
): { damage: number; result: DamageResult | null } {
  const charSheet = StatSheet.fromArtifacts(pieces);

  // scoreFn needs updatedSheets (artifact-level), can't use fast path
  if (scoreFn) {
    const updatedSheets = { ...baseSheets, [swapCharId]: charSheet };
    return { damage: scoreFn(updatedSheets, calcTargetId), result: null };
  }

  const postStats = optCtx
    ? teamBuild.getTeamStatsFast(charSheet, optCtx)
    : teamBuild.getTeamStats(
        { ...baseSheets, [swapCharId]: charSheet },
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
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number,
  optCtx?: OptimizerContext
): number {
  const realArts = realPieces.filter((a): a is ArtifactData => a != null);
  let sheet = StatSheet.fromArtifacts(realArts);
  for (const ss of superStatsRemaining) {
    if (Object.keys(ss).length > 0) sheet = sheet.merge(StatSheet.fromRaw(ss));
  }

  if (scoreFn) {
    const updatedSheets = { ...baseSheets, [swapCharId]: sheet };
    return scoreFn(updatedSheets, calcTargetId);
  }

  const postStats = optCtx
    ? teamBuild.getTeamStatsFast(sheet, optCtx)
    : teamBuild.getTeamStats(
        { ...baseSheets, [swapCharId]: sheet },
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
  crDiscount: number,
  maxArtsPerSlot = 0
): PreparedSlotData[] {
  const result: PreparedSlotData[] = [];
  for (let si = 0; si < 5; si++) {
    const slot = allSlots[si];
    let arts = inventory
      .filter(
        (a) => a.slotKey === slot && (!excludedIds || !excludedIds.has(a.id))
      )
      .sort(
        (a, b) =>
          computeWeightScore(b, buildMatch, globalConfig, crDiscount) -
          computeWeightScore(a, buildMatch, globalConfig, crDiscount)
      );
    if (maxArtsPerSlot > 0 && arts.length > maxArtsPerSlot) {
      arts = arts.slice(0, maxArtsPerSlot);
    }
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

// ─── B&B Context ───

interface BnBContext {
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
  /** Precomputed optimizer context for fast getTeamStats. */
  optCtx?: OptimizerContext;
  /** Optional deadline (performance.now timestamp). DFS aborts if exceeded. */
  deadline?: number;
  /** Set to true if the DFS was aborted early due to deadline. */
  aborted?: boolean;
}

// ─── Core B&B DFS ───

function bnbDfs(
  slotGroups: ArtifactData[][],
  slotSupers: SuperArtifact[],
  ctx: BnBContext
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
    optCtx,
  } = ctx;
  const needEr = targetEr > 0;
  const needCr = targetCr > 0;

  const suffixMaxEr = new Float64Array(6);
  const suffixMaxCr = new Float64Array(6);
  for (let s = 4; s >= 0; s--) {
    suffixMaxEr[s] = suffixMaxEr[s + 1] + slotSupers[s].maxEr;
    suffixMaxCr[s] = suffixMaxCr[s + 1] + slotSupers[s].maxCr;
  }
  const superStatsBySlot = slotSupers.map((s) => s.stats);
  const pieces: ArtifactTuple = [null, null, null, null, null];

  function dfs(depth: number, cumEr: number, cumCr: number): void {
    if (ctx.aborted) return;
    // Check deadline every 1000 evaluations to avoid perf.now() overhead
    if (ctx.deadline && ctx.evaluations % 1000 === 0) {
      if (performance.now() > ctx.deadline) {
        ctx.aborted = true;
        return;
      }
    }
    if (depth === 5) {
      const { damage, result } = evaluateBuild(
        pieces,
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
        scoreFn,
        optCtx
      );
      collector.add(damage, result, pieces);
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

      if (needEr && erFloor + newCumEr + sfxEr < targetEr) continue;
      if (needCr && crFloor + newCumCr + sfxCr < targetCr) continue;

      pieces[depth] = art;
      if (collector.threshold > 0 && depth < 4) {
        const remaining: Partial<Record<StatKey, number>>[] = [];
        for (let s = depth + 1; s < 5; s++) remaining.push(superStatsBySlot[s]);
        const ub = evaluateUpperBound(
          pieces.slice(0, depth + 1),
          remaining,
          teamBuild,
          swapCharId,
          formulaCharId,
          formulaId,
          baseSheets,
          calcTargetId,
          calcContext,
          reactionOverride,
          scoreFn,
          optCtx
        );
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
function runCharacterBnB(
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
  maxArtsPerSlot = 0
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
    crDiscount,
    maxArtsPerSlot
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

  // Precompute optimizer context for fast getTeamStats (caches support preStats)
  const optCtx = scoreFn
    ? undefined
    : teamBuild.createOptimizerContext(
        baseSheets,
        swapCharId,
        calcTargetId,
        calcContext
      );

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
    targetEr: charConfig.targetEr,
    targetCr: charConfig.targetCr,
    erFloor,
    crFloor,
    reactionOverride,
    scoreFn,
    collector,
    evaluations: 0,
    sinceLastYield: 0,
    optCtx,
    deadline,
  };

  // ── Helper: Collect pattern tasks, sort by upper bound, run B&B with pruning ──
  interface PatternTask {
    groups: ArtifactData[][];
    supers: SuperArtifact[];
    upperBound: number;
  }

  /**
   * Hill-climbing warm-start: greedy build → iterative improvement per slot.
   * Seeds the threshold with a high-quality solution so B&B can prune effectively.
   */
  function hillClimbWarmStart(tasks: PatternTask[]): void {
    for (const task of tasks) {
      const pieces: ArtifactTuple = [null, null, null, null, null];
      let valid = true;
      for (let s = 0; s < 5; s++) {
        if (task.groups[s].length === 0) {
          valid = false;
          break;
        }
        pieces[s] = task.groups[s][0]; // start with top weight-scored
      }
      if (!valid) continue;

      // Evaluate initial greedy build
      let bestDamage = evaluateBuild(
        pieces,
        teamBuild,
        swapCharId,
        formulaCharId,
        formulaId,
        baseSheets,
        calcTargetId,
        calcContext,
        erCheckCharId,
        charConfig.targetEr,
        charConfig.targetCr,
        reactionOverride,
        scoreFn,
        optCtx
      ).damage;
      collector.add(bestDamage, null, pieces);
      ctx.evaluations++;

      // Hill-climb: iteratively try alternatives per slot (up to top-15 per slot)
      const HC_ALT_COUNT = 15;
      let improved = true;
      while (improved) {
        improved = false;
        for (let s = 0; s < 5; s++) {
          const group = task.groups[s];
          const limit = Math.min(group.length, HC_ALT_COUNT);
          for (let gi = 0; gi < limit; gi++) {
            if (group[gi] === pieces[s]) continue;
            const saved = pieces[s];
            pieces[s] = group[gi];
            const { damage } = evaluateBuild(
              pieces,
              teamBuild,
              swapCharId,
              formulaCharId,
              formulaId,
              baseSheets,
              calcTargetId,
              calcContext,
              erCheckCharId,
              charConfig.targetEr,
              charConfig.targetCr,
              reactionOverride,
              scoreFn,
              optCtx
            );
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

  function collectAndRunPatternTasks(tasks: PatternTask[]): void {
    // Hill-climbing warm-start to seed a good threshold before DFS
    hillClimbWarmStart(tasks);
    // Sort by upper bound descending — explore most promising patterns first
    tasks.sort((a, b) => b.upperBound - a.upperBound);
    for (const task of tasks) {
      if (ctx.aborted) break;
      // Pattern-level pruning: skip entire pattern if upper bound can't beat threshold
      if (
        ctx.collector.threshold > 0 &&
        task.upperBound <= ctx.collector.threshold
      )
        continue;
      bnbDfs(task.groups, task.supers, ctx);
    }
  }

  function computePatternUpperBound(supers: SuperArtifact[]): number {
    return evaluateUpperBound(
      [], // no real pieces
      supers.map((s) => s.stats),
      teamBuild,
      swapCharId,
      formulaCharId,
      formulaId,
      baseSheets,
      calcTargetId,
      calcContext,
      reactionOverride,
      scoreFn,
      optCtx
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

/**
 * Given top-K results per character, find the best team assignment where
 * no artifact is shared between characters.
 *
 * Uses DFS with:
 * - Characters ordered by "flexibility" (least flexible first)
 * - Upper-bound pruning (remaining chars use rank-1 damage)
 * - Artifact intersection skipping
 */
/** Number of top candidate allocations to collect for full-team re-evaluation. */
const ALLOC_TOP_N = 50;

function findBestTeamAllocation(
  charIds: string[],
  topKByChar: Record<string, TopKEntry[]>,
  maxIterations: number,
  carryCharIds?: string[]
): {
  /** Top-N candidate assignments sorted by proxy score (descending). */
  candidates: { assignment: Record<string, TopKEntry>; score: number }[];
  iterations: number;
} {
  if (charIds.length === 0) return { candidates: [], iterations: 0 };

  // Order characters: carries first (to give them priority for best artifacts),
  // then by flexibility (least flexible first → most to lose from not getting their best)
  const ordered = [...charIds].sort((a, b) => {
    const aIsCarry = carryCharIds?.includes(a) ? 1 : 0;
    const bIsCarry = carryCharIds?.includes(b) ? 1 : 0;
    if (aIsCarry !== bIsCarry) return bIsCarry - aIsCarry; // carries first
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
    return aFlex - bFlex; // least flexible first
  });

  // Pre-compute rank-1 damage per char for upper-bound pruning
  const rank1Damage: Record<string, number> = {};
  for (const cid of ordered) {
    rank1Damage[cid] = topKByChar[cid]?.[0]?.damage ?? 0;
  }

  // Collect top-N candidates (sorted descending by proxy score)
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
    // Binary search insert (descending)
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

  // Use the N-th best score for pruning (allows collecting N candidates)
  function getPruneThreshold(): number {
    return topCandidates.length >= ALLOC_TOP_N
      ? worstTopScore
      : Number.NEGATIVE_INFINITY;
  }

  // DFS: at each level, assign one character's result
  function dfs(
    level: number,
    usedArtifacts: Set<string>,
    currentScore: number,
    assignment: Record<string, TopKEntry>
  ): void {
    if (iterations >= maxIterations) return;

    if (level === ordered.length) {
      insertCandidate(assignment, currentScore);
      return;
    }

    const charId = ordered[level];
    const entries = topKByChar[charId] ?? [];
    const pruneThreshold = getPruneThreshold();

    // Upper-bound: current score + rank-1 damage for all remaining characters
    let ubRemaining = 0;
    for (let r = level; r < ordered.length; r++) {
      ubRemaining += rank1Damage[ordered[r]];
    }
    if (currentScore + ubRemaining <= pruneThreshold) return;

    for (const entry of entries) {
      iterations++;
      if (iterations >= maxIterations) return;

      // Check for artifact conflicts
      let conflict = false;
      for (const artId of entry.artifactIds) {
        if (usedArtifacts.has(artId)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      // Upper-bound with this entry's actual damage + rank-1 for rest
      let ubWithEntry = currentScore + entry.damage;
      for (let r = level + 1; r < ordered.length; r++) {
        ubWithEntry += rank1Damage[ordered[r]];
      }
      if (ubWithEntry <= getPruneThreshold()) continue;

      // Add artifacts to used set
      for (const artId of entry.artifactIds) usedArtifacts.add(artId);
      assignment[charId] = entry;

      dfs(level + 1, usedArtifacts, currentScore + entry.damage, assignment);

      // Remove artifacts
      for (const artId of entry.artifactIds) usedArtifacts.delete(artId);
      delete assignment[charId];
    }
  }

  dfs(0, new Set(), 0, {});

  // Greedy fallback: if DFS found no conflict-free allocation (common when
  // all top-K entries for multiple characters share a dominant artifact),
  // try greedy assignment with multiple orderings and keep the best.
  if (topCandidates.length === 0) {
    // Try multiple orderings: carry-first, least-flexible-first, most-damage-first
    const orderings: string[][] = [ordered];

    // Carry-first ordering
    if (carryCharIds && carryCharIds.length > 0) {
      const carryFirst = [
        ...charIds.filter((id) => carryCharIds.includes(id)),
        ...charIds.filter((id) => !carryCharIds.includes(id)),
      ];
      orderings.push(carryFirst);
    }

    // Most-damage-first ordering (give top artifacts to highest-damage chars)
    const byDamage = [...charIds].sort(
      (a, b) => (rank1Damage[b] ?? 0) - (rank1Damage[a] ?? 0)
    );
    orderings.push(byDamage);

    for (const ordering of orderings) {
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
 * V2 Team Optimizer: B&B per character → top-K → conflict-aware DFS.
 * Same interface as V1's `runTeamOptimization`.
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
    perCharDeadlineMs: rawPerCharDeadlineMs,
    teamDeadlineMs,
    maxArtsPerSlot,
  } = opts;

  // ── Dynamic hyperparameters based on inventory size ──
  const { topK: TOP_K, maxTeamSearch: MAX_TEAM_SEARCH } = computeHyperparams(
    inventory.length
  );

  // ── Time budget management ──
  // If teamDeadlineMs is set, compute per-char budgets dynamically.
  // Budget split: Phase 1 gets 40%, Phase 3+3b gets 40%, Phase 2+overhead gets 20%.
  const numChars = Object.keys(perChar).length || 4;
  const phase1Fraction = 0.4;
  const perCharDeadlineMs = teamDeadlineMs
    ? Math.max(
        500,
        ((teamDeadlineMs - performance.now()) * phase1Fraction) / numChars
      )
    : rawPerCharDeadlineMs;

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
            console.warn("[optimizerV2] comboScoreFn failed:", e);
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

  // ── Saturation detection ──
  // For each support, test if any artifact stats affect team damage.
  // If super-artifact (max possible stats) vs empty sheet produces < ε
  // relative damage difference, the character is "intrinsically saturated"
  // and B&B is skipped entirely.
  const saturatedCharIds = new Set<string>();
  {
    const supportCharIds = allCharIds.filter(
      (id) => !carryCharIds.includes(id)
    );
    for (const cid of supportCharIds) {
      try {
        // Evaluate with empty artifact sheet
        const emptySheets = { ...baseSheets, [cid]: new StatSheet([]) };
        let dmgEmpty: number;
        if (comboScoreFn) {
          dmgEmpty = comboScoreFn(emptySheets, carryCharId);
        } else {
          const ps = teamBuild.getTeamStats(
            emptySheets,
            carryCharId,
            calcContext
          );
          dmgEmpty = teamBuild.getDamageResult(
            carryCharId,
            formulaId,
            ps,
            calcContext,
            reactionOverride
          ).totalDamage;
        }

        // Build super-artifact sheet: max stat per slot, then sum across slots
        const superStats: Partial<Record<StatKey, number>> = {};
        for (let si = 0; si < 5; si++) {
          const slot = allSlots[si];
          const slotArts = inventory.filter((a) => a.slotKey === slot);
          if (slotArts.length === 0) continue;
          const sa = buildSuperArtifact(slotArts);
          for (const [key, val] of Object.entries(sa.stats)) {
            const sk = key as StatKey;
            superStats[sk] = (superStats[sk] ?? 0) + val;
          }
        }
        const superSheet = StatSheet.fromRaw(superStats);
        const superSheets = { ...baseSheets, [cid]: superSheet };
        let dmgSuper: number;
        if (comboScoreFn) {
          dmgSuper = comboScoreFn(superSheets, carryCharId);
        } else {
          const ps = teamBuild.getTeamStats(
            superSheets,
            carryCharId,
            calcContext
          );
          dmgSuper = teamBuild.getDamageResult(
            carryCharId,
            formulaId,
            ps,
            calcContext,
            reactionOverride
          ).totalDamage;
        }

        const base = Math.max(dmgEmpty, 1);
        if (Math.abs(dmgSuper - dmgEmpty) / base < 0.001) {
          saturatedCharIds.add(cid);
        }
      } catch {
        // If evaluation fails, don't mark as saturated — let B&B handle it
      }
    }
  }

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
  // Phase 1: Sequential Per-character B&B → top-K results
  //
  // Process carry first, then supports. After each character, update
  // the running base sheets with that character's top-1 artifacts.
  // This way, each support's B&B evaluates carry damage in the context
  // of the carry's actual (top-1) artifacts + previous supports'
  // artifacts — capturing cross-character interactions that independent
  // B&B would miss.
  // ════════════════════════════════════════════════════════════════════

  const topKByChar: Record<string, TopKEntry[]> = {};
  const failReasons: Record<string, OptFailReason> = {};
  const passResults: TeamOptPassResult[] = [];
  const totalPhases = allCharIds.length + 1; // +1 for team allocation phase

  // Order: carries first, then supports (supports see carry's top-1 context)
  const phase1Order = [
    ...allCharIds.filter((id) => carryCharIds.includes(id)),
    ...allCharIds.filter((id) => !carryCharIds.includes(id)),
  ];

  // Running base sheets: updated after each character with their top-1 artifacts
  let runningBaseSheets = { ...baseSheets };

  for (let ci = 0; ci < phase1Order.length; ci++) {
    const charId = phase1Order[ci];
    const charConfig = effectivePerChar[charId];
    if (!charConfig) continue;

    // Skip saturated characters — they'll be filled heuristically after Phase 3b
    if (saturatedCharIds.has(charId)) {
      passResults.push({
        passId: "support",
        charId,
        bestDamage: -1,
        bestArtifacts: { ...emptyArtifacts },
      });
      continue;
    }

    const passId: TeamOptPassId = carryCharIds.includes(charId)
      ? "carry-1"
      : "support";

    // Yield progress: starting this character
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

    // Run B&B with running base sheets (includes previous chars' top-1)
    // Per-char budget clamped to team deadline
    const charDeadline = perCharDeadlineMs
      ? performance.now() + perCharDeadlineMs
      : undefined;
    let result = runCharacterBnB(
      charId,
      charConfig,
      effectiveTeamBuild,
      carryCharId,
      formulaId,
      inventory,
      globalConfig,
      runningBaseSheets,
      calcContext,
      undefined, // no exclusions in phase 1
      reactionOverride,
      comboScoreFn,
      TOP_K,
      charDeadline,
      undefined,
      maxArtsPerSlot ?? 0
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
      result = runCharacterBnB(
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
        TOP_K,
        charDeadline,
        undefined,
        maxArtsPerSlot ?? 0
      );
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

    // Update running base sheets with this character's top-1 artifacts
    // so subsequent characters see the updated team context
    if (best) {
      const pieces = best.artifacts.filter((a): a is ArtifactData => a != null);
      if (pieces.length > 0) {
        runningBaseSheets = {
          ...runningBaseSheets,
          [charId]: StatSheet.fromArtifacts(pieces),
        };
      }
    }

    // Yield progress: done with this character
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
  // Phase 1b: Contested Artifact Resolution
  //
  // When a "dominant" artifact (e.g., best flower) appears in ALL top-K
  // entries for multiple characters, the DFS can never find a conflict-
  // free allocation. Fix: identify artifacts that appear in >=90% of
  // entries for 2+ characters, then re-run B&B for lower-priority
  // characters with those artifacts excluded — adding alternatives to
  // their top-K pools.
  // ════════════════════════════════════════════════════════════════════

  {
    // Count per-artifact usage across characters
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
          // This artifact is in >=80% of this character's top-K
          if (!artUsage.has(artId)) artUsage.set(artId, []);
          artUsage.get(artId)!.push({ charId, count });
        }
      }
    }

    // Find contested artifacts: used dominantly by 2+ characters
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
      // For each contested artifact, determine the winner (highest priority).
      // Then, for each loser character, collect ALL contested artifacts they
      // should yield and re-run B&B once with all of them excluded.
      const excludeByChar = new Map<string, Set<string>>();

      for (const { artId, chars } of contested) {
        // Priority: carry > higher rank-1 damage
        const sorted = [...chars].sort((a, b) => {
          const aIsCarry = carryCharIds.includes(a.charId) ? 1 : 0;
          const bIsCarry = carryCharIds.includes(b.charId) ? 1 : 0;
          if (aIsCarry !== bIsCarry) return bIsCarry - aIsCarry;
          const aDmg = topKByChar[a.charId]?.[0]?.damage ?? 0;
          const bDmg = topKByChar[b.charId]?.[0]?.damage ?? 0;
          return bDmg - aDmg;
        });

        // The winner keeps the artifact; losers must yield it
        for (let i = 1; i < sorted.length; i++) {
          const loserId = sorted[i].charId;
          if (!excludeByChar.has(loserId))
            excludeByChar.set(loserId, new Set());
          excludeByChar.get(loserId)!.add(artId);
        }
      }

      // (debug) console.log(`[V2] Phase 1b: ${contested.length} contested, ${excludeByChar.size} re-runs`);

      // Re-run B&B for each loser with all their excluded artifacts at once
      for (const [loserId, excludeSet] of excludeByChar) {
        if (teamDeadlineMs && performance.now() > teamDeadlineMs) break;
        const loserConfig = effectivePerChar[loserId];
        if (!loserConfig) continue;

        const altDeadline = perCharDeadlineMs
          ? performance.now() + perCharDeadlineMs
          : undefined;

        const altResult = runCharacterBnB(
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
          TOP_K,
          altDeadline,
          undefined,
          maxArtsPerSlot ?? 0
        );

        // Merge alternative results into the existing top-K
        const existing = topKByChar[loserId] ?? [];
        const alternatives = altResult.collector.results;
        const merged = [...existing];
        for (const alt of alternatives) {
          // Only add entries that don't use ANY of the excluded artifacts
          let usesExcluded = false;
          for (const artId of excludeSet) {
            if (alt.artifactIds.has(artId)) {
              usesExcluded = true;
              break;
            }
          }
          if (!usesExcluded) merged.push(alt);
        }
        // Sort by damage descending and keep top-K * 2 (extra room for diversity)
        merged.sort((a, b) => b.damage - a.damage);
        topKByChar[loserId] = merged.slice(0, TOP_K * 2);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 2: Team allocation via conflict-aware DFS
  // ════════════════════════════════════════════════════════════════════

  // Only allocate characters that have valid results
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

  let { candidates, iterations: allocIterations } = findBestTeamAllocation(
    allocatableChars,
    topKByChar,
    MAX_TEAM_SEARCH,
    carryCharIds
  );

  // If DFS + greedy both failed, do sequential B&B assignment:
  // Process characters in priority order (carry first), running B&B
  // for each with previously assigned artifacts excluded. This is
  // guaranteed to produce a conflict-free assignment (like V1's approach).
  if (candidates.length === 0 && allocatableChars.length > 1) {
    // (debug) console.log(`[V2] Phase 2b: Sequential B&B fallback`);

    const seqOrder = [
      ...allocatableChars.filter((id) => carryCharIds.includes(id)),
      ...allocatableChars.filter((id) => !carryCharIds.includes(id)),
    ];
    const seqUsed = new Set<string>();
    const seqAssignment: Record<string, TopKEntry> = {};
    let seqScore = 0;

    for (const cid of seqOrder) {
      // First try existing top-K entries
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
        if (teamDeadlineMs && performance.now() > teamDeadlineMs) break;
        // Run a fresh B&B excluding all taken artifacts
        const charConfig = effectivePerChar[cid];
        if (!charConfig) continue;
        const altDeadline = perCharDeadlineMs
          ? performance.now() + perCharDeadlineMs
          : undefined;
        const altResult = runCharacterBnB(
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
          1, // only need the best result
          altDeadline,
          undefined,
          maxArtsPerSlot ?? 0
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
      // Use insertCandidate-style approach: create a proper candidate
      candidates = [{ assignment: { ...seqAssignment }, score: seqScore }];
      // Sequential fallback succeeded
    } else {
      // Sequential fallback couldn't assign all characters (shouldn't happen)
    }
  }

  // Re-evaluate top candidates with full team damage (not the sum proxy).
  // The DFS ranked by sum-of-individual-damages which doesn't capture
  // cross-character interactions. Full evaluation fixes this.
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

  // Build final artifact assignment from best full-team-evaluated allocation
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
  //
  // Phase 1 B&B ran the carry with base sheets (account-equipped
  // artifacts for supports). After Phase 2 allocated optimized artifacts
  // to supports, the carry's optimal build may differ because support
  // buffs changed. Re-run the carry's B&B with the allocated support
  // artifacts as context — analogous to V1's "carry round-2".
  // ════════════════════════════════════════════════════════════════════

  for (const carryId of carryCharIds) {
    const carryConfig = effectivePerChar[carryId];
    if (!carryConfig) continue;

    // Build base sheets: use Phase 2 allocated artifacts for all supports
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

    // Yield for cooperative scheduling / timeout checking
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

    // Evaluate Phase 2 carry artifacts in the refined context (warm-start baseline)
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

    // Run carry B&B with actual support context, warm-started from Phase 2
    const refineDeadline = perCharDeadlineMs
      ? performance.now() + perCharDeadlineMs
      : undefined;
    const refineResult = runCharacterBnB(
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
      TOP_K,
      refineDeadline,
      phase2Damage > 0 ? phase2Damage : undefined,
      maxArtsPerSlot ?? 0
    );

    // Only use refinement result if it actually beats Phase 2
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
  // Phase 3b: Full Team Re-optimization
  //
  // Sequentially re-optimize each character with all other characters'
  // artifacts locked/excluded. This closes the gap with V1's permutation
  // approach: each character gets a fresh B&B search tailored to the
  // remaining artifact pool after teammates have been assigned.
  // ════════════════════════════════════════════════════════════════════

  const MAX_REOPT_PASSES = 3;
  for (let reoptPass = 0; reoptPass < MAX_REOPT_PASSES; reoptPass++) {
    // If team deadline is set and remaining time < 1s, skip further passes
    if (teamDeadlineMs && teamDeadlineMs - performance.now() < 1000) break;

    let anyImproved = false;

    for (const charId of allCharIds) {
      const charConfig = effectivePerChar[charId];
      if (!charConfig) continue;
      if (saturatedCharIds.has(charId)) continue;

      // Build base sheets from current team assignment (all other chars)
      const reoptBaseSheets: Record<string, StatSheet> = { ...baseSheets };
      const reoptExcluded = new Set<string>();

      for (const otherId of allCharIds) {
        if (otherId === charId) continue;
        const otherArts = bestArtifactsByChar[otherId];
        if (!otherArts) continue;
        const pieces = allSlots
          .map((s) => otherArts[s])
          .filter((a): a is ArtifactData => a != null);
        if (pieces.length > 0) {
          reoptBaseSheets[otherId] = StatSheet.fromArtifacts(pieces);
        }
        for (const art of pieces) reoptExcluded.add(art.id);
      }

      // Evaluate current assignment in this context
      const currentPieces = allSlots.map(
        (s) => bestArtifactsByChar[charId]?.[s] ?? null
      ) as ArtifactTuple;
      const currentEval = evaluateBuild(
        currentPieces,
        effectiveTeamBuild,
        charId,
        carryCharId,
        formulaId,
        reoptBaseSheets,
        carryCharId,
        calcContext,
        charId,
        charConfig.targetEr,
        charConfig.targetCr,
        reactionOverride,
        comboScoreFn
      );

      // Phase 3b uses half the per-char budget (refinement, not discovery)
      const reoptDeadline = perCharDeadlineMs
        ? performance.now() + perCharDeadlineMs * 0.5
        : undefined;
      const reoptResult = runCharacterBnB(
        charId,
        charConfig,
        effectiveTeamBuild,
        carryCharId,
        formulaId,
        inventory,
        globalConfig,
        reoptBaseSheets,
        calcContext,
        reoptExcluded,
        reactionOverride,
        comboScoreFn,
        TOP_K,
        reoptDeadline,
        currentEval.damage > 0 ? currentEval.damage : undefined,
        maxArtsPerSlot ?? 0
      );

      if (
        reoptResult.collector.best &&
        reoptResult.collector.best.damage > currentEval.damage
      ) {
        bestArtifactsByChar[charId] = artsTupleToRecord(
          reoptResult.collector.best.artifacts
        );
        anyImproved = true;
      }
    }

    if (!anyImproved) break;
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 4: Heuristic Fill for Saturated Characters
  //
  // Saturated characters' artifacts don't affect team damage, so B&B
  // was skipped. Fill them from the remaining pool using build-page
  // heuristic weights, respecting set constraints and ER/CR targets.
  // ════════════════════════════════════════════════════════════════════

  if (saturatedCharIds.size > 0) {
    // Collect all artifact IDs already assigned to non-saturated characters
    const assignedIds = new Set<string>();
    for (const [cid, arts] of Object.entries(bestArtifactsByChar)) {
      if (saturatedCharIds.has(cid)) continue;
      for (const slot of allSlots) {
        const a = arts[slot];
        if (a) assignedIds.add(a.id);
      }
    }

    for (const charId of allCharIds) {
      if (!saturatedCharIds.has(charId)) continue;
      const charConfig = effectivePerChar[charId];
      if (!charConfig) continue;

      const is4pc = !!charConfig.artifactSetId;
      const is2pc =
        !charConfig.artifactSetId &&
        !!charConfig.artifactHalfSetIds &&
        charConfig.artifactHalfSetIds.length === 2;

      // Score and pick artifacts per slot using build weights
      const buildMatch = charConfig.buildMatch;
      const picked: Record<Slot, ArtifactData | null> = { ...emptyArtifacts };
      const pickedIds = new Set<string>();

      // For set constraints, track which slots are assigned to which set
      // We'll do a simple greedy: for 4pc, try to fill 4 slots on-set first
      // For 2+2, fill 2 slots per half-set first
      const slotSetAssignment: (string | null)[] = [
        null,
        null,
        null,
        null,
        null,
      ];

      if (is4pc) {
        // Need 4 slots on-set. Pick the slot with fewest on-set candidates as flex.
        const setId = charConfig.artifactSetId!;
        const onSetCounts = allSlots.map(
          (slot) =>
            inventory.filter(
              (a) =>
                a.slotKey === slot &&
                a.setKey === setId &&
                !assignedIds.has(a.id)
            ).length
        );
        // Flex slot = slot with fewest on-set candidates
        let flexSlotIdx = 0;
        for (let i = 1; i < 5; i++) {
          if (onSetCounts[i] < onSetCounts[flexSlotIdx]) flexSlotIdx = i;
        }
        for (let i = 0; i < 5; i++) {
          slotSetAssignment[i] = i === flexSlotIdx ? null : setId;
        }
      } else if (is2pc) {
        const [h1, h2] = charConfig.artifactHalfSetIds!;
        const h1Sets = new Set(artifactHalfSetsById[h1]?.setIds ?? []);
        const h2Sets = new Set(artifactHalfSetsById[h2]?.setIds ?? []);
        // Greedy: assign first 2 available slots to h1, next 2 to h2
        let h1Count = 0;
        let h2Count = 0;
        for (let i = 0; i < 5; i++) {
          if (h1Count < 2) {
            const hasH1 = inventory.some(
              (a) =>
                a.slotKey === allSlots[i] &&
                h1Sets.has(a.setKey) &&
                !assignedIds.has(a.id)
            );
            if (hasH1) {
              slotSetAssignment[i] = h1;
              h1Count++;
              continue;
            }
          }
          if (h2Count < 2) {
            const hasH2 = inventory.some(
              (a) =>
                a.slotKey === allSlots[i] &&
                h2Sets.has(a.setKey) &&
                !assignedIds.has(a.id)
            );
            if (hasH2) {
              slotSetAssignment[i] = h2;
              h2Count++;
            }
          }
        }
      }

      for (let si = 0; si < 5; si++) {
        const slot = allSlots[si];
        const requiredSetOrHalf = slotSetAssignment[si];

        let candidates = inventory.filter(
          (a) =>
            a.slotKey === slot && !assignedIds.has(a.id) && !pickedIds.has(a.id)
        );

        // Filter by set constraint for this slot
        if (requiredSetOrHalf) {
          const halfSet = artifactHalfSetsById[requiredSetOrHalf];
          if (halfSet) {
            // It's a half-set ID — filter to any set in that half-set group
            const validSets = new Set(halfSet.setIds);
            const filtered = candidates.filter((a) => validSets.has(a.setKey));
            if (filtered.length > 0) candidates = filtered;
          } else {
            // It's a full set ID
            const filtered = candidates.filter(
              (a) => a.setKey === requiredSetOrHalf
            );
            if (filtered.length > 0) candidates = filtered;
          }
        }

        if (candidates.length === 0) continue;

        // Score by build weights (no CR/CD fallback for saturated chars)
        // Use ER as fallback weight if no build match exists
        const fallbackWeights = buildMatch
          ? undefined
          : ({ er: 100 } as Record<string, number>);
        candidates.sort((a, b) => {
          const sa = buildMatch
            ? computeWeightScore(a, buildMatch, globalConfig, 1)
            : scoreSlot(a, fallbackWeights!, globalConfig);
          const sb = buildMatch
            ? computeWeightScore(b, buildMatch, globalConfig, 1)
            : scoreSlot(b, fallbackWeights!, globalConfig);
          if (sb !== sa) return sb - sa;
          // Tiebreak: prefer higher level
          return b.level - a.level;
        });

        picked[slot] = candidates[0];
        pickedIds.add(candidates[0].id);
      }

      bestArtifactsByChar[charId] = picked;
      // Mark assigned IDs so subsequent saturated chars don't reuse them
      for (const id of pickedIds) assignedIds.add(id);
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
