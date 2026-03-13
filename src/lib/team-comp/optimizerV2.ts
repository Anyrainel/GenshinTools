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
} from "../account-data/artifactScore";
import { TeamBuild, evaluateCombo } from "./damageCalc";
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

// ─── Constants ───

/** Default number of top results to keep per character for team allocation. */
const TOP_K = 200;
/** Max DFS iterations for team allocation before stopping. */
const MAX_TEAM_SEARCH = 500_000;
/** How many evaluations between cooperative yields. */
const YIELD_INTERVAL = 300;

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

  constructor(private k: number) {}

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
        scoreFn
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
          scoreFn
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
  topK: number
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

  const collector = new TopKCollector(topK);
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
  };

  // Build and run tasks
  if (is4pc) {
    for (const pattern of SET4_PATTERNS) {
      const built = buildSlotGroupsForPattern(
        pattern,
        slotData,
        charConfig.artifactSetId!
      );
      if (built) bnbDfs(built.groups, built.supers, ctx);
    }
  } else if (is2pc) {
    const [h1, h2] = charConfig.artifactHalfSetIds as [string, string];
    const h1Keys = artifactHalfSetsById[h1]?.setIds ?? [];
    const h2Keys = artifactHalfSetsById[h2]?.setIds ?? [];
    for (const pattern of SET22_PATTERNS) {
      for (const sk1 of h1Keys) {
        for (const sk2 of h2Keys) {
          if (h1 === h2 && sk1 === sk2) continue;
          const built = buildSlotGroupsForPattern(pattern, slotData, sk1, sk2);
          if (built) bnbDfs(built.groups, built.supers, ctx);
        }
      }
      if (h1 !== h2) {
        for (const sk1 of h2Keys) {
          for (const sk2 of h1Keys) {
            const built = buildSlotGroupsForPattern(
              pattern,
              slotData,
              sk1,
              sk2
            );
            if (built) bnbDfs(built.groups, built.supers, ctx);
          }
        }
      }
    }
  } else {
    // No set constraint → try all viable 4pc, 2+2, and rainbow
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
          const built = buildSlotGroupsForPattern(pattern, slotData, setKey);
          if (built) bnbDfs(built.groups, built.supers, ctx);
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
              const built = buildSlotGroupsForPattern(
                pattern,
                slotData,
                sk1,
                sk2
              );
              if (built) bnbDfs(built.groups, built.supers, ctx);
            }
          }
          if (h1 !== h2) {
            for (const sk1 of h2Keys) {
              for (const sk2 of h1Keys) {
                const built = buildSlotGroupsForPattern(
                  pattern,
                  slotData,
                  sk1,
                  sk2
                );
                if (built) bnbDfs(built.groups, built.supers, ctx);
              }
            }
          }
        }
      }
    }

    // Rainbow
    bnbDfs(
      slotData.map((sd) => sd.allArtifacts),
      slotData.map((sd) => sd.slotSuperArtifact),
      ctx
    );
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
function findBestTeamAllocation(
  charIds: string[],
  topKByChar: Record<string, TopKEntry[]>,
  maxIterations: number
): {
  assignment: Record<string, TopKEntry> | null;
  iterations: number;
} {
  if (charIds.length === 0) return { assignment: null, iterations: 0 };

  // Order characters by flexibility: least flexible first (smallest
  // gap between rank-1 and rank-K → most to lose from not getting their best)
  const ordered = [...charIds].sort((a, b) => {
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

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestAssignment: Record<string, TopKEntry> | null = null;
  let iterations = 0;

  // DFS: at each level, assign one character's result
  function dfs(
    level: number,
    usedArtifacts: Set<string>,
    currentScore: number,
    assignment: Record<string, TopKEntry>
  ): void {
    if (iterations >= maxIterations) return;

    if (level === ordered.length) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestAssignment = { ...assignment };
      }
      return;
    }

    const charId = ordered[level];
    const entries = topKByChar[charId] ?? [];

    // Upper-bound: current score + rank-1 damage for all remaining characters
    let ubRemaining = 0;
    for (let r = level; r < ordered.length; r++) {
      ubRemaining += rank1Damage[ordered[r]];
    }
    if (currentScore + ubRemaining <= bestScore) return;

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
      if (ubWithEntry <= bestScore) continue;

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
  return { assignment: bestAssignment, iterations };
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
  // Phase 1: Per-character B&B → top-K results
  // ════════════════════════════════════════════════════════════════════

  const topKByChar: Record<string, TopKEntry[]> = {};
  const failReasons: Record<string, OptFailReason> = {};
  const passResults: TeamOptPassResult[] = [];
  const totalPhases = allCharIds.length + 1; // +1 for team allocation phase

  for (let ci = 0; ci < allCharIds.length; ci++) {
    const charId = allCharIds[ci];
    const charConfig = effectivePerChar[charId];
    if (!charConfig) continue;

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

    // Run B&B
    let result = runCharacterBnB(
      charId,
      charConfig,
      effectiveTeamBuild,
      carryCharId,
      formulaId,
      inventory,
      globalConfig,
      baseSheets,
      calcContext,
      undefined, // no exclusions in phase 1
      reactionOverride,
      comboScoreFn,
      TOP_K
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
        baseSheets,
        calcContext,
        undefined,
        reactionOverride,
        comboScoreFn,
        TOP_K
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

  const { assignment } = findBestTeamAllocation(
    allocatableChars,
    topKByChar,
    MAX_TEAM_SEARCH
  );

  // Build final artifact assignment
  const bestArtifactsByChar: Record<
    string,
    Record<Slot, ArtifactData | null>
  > = {};
  for (const charId of allCharIds) {
    if (assignment?.[charId]) {
      bestArtifactsByChar[charId] = artsTupleToRecord(
        assignment[charId].artifacts
      );
    } else {
      // Fallback: use the character's rank-1 result (may conflict, but best we have)
      const best = topKByChar[charId]?.[0];
      bestArtifactsByChar[charId] = best
        ? artsTupleToRecord(best.artifacts)
        : { ...emptyArtifacts };
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
