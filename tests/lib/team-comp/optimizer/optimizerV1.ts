import { artifactHalfSetsById, artifactIdToHalfSetId } from "@/data/constants";
import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import {
  type BuildMatchResult,
  getFixedMainStatValue,
  getMainStatValueAtLevel,
  getTargetMainStatsForSlot,
  scoreMainStat,
  scoreSlot,
} from "@/lib/account-data/artifactScore";
import { AVG_SUBSTAT_ROLL, toInternal } from "@/lib/account-data/scoring/utils";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import type { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import type {
  ArtifactSetConfig,
  CalcContext,
  DamageResult,
  OptFailReason,
  ReactionOverride,
  StatKey,
} from "@/lib/team-comp/types";

export interface OptimizerOptions {
  teamBuild: TeamBuild;
  targetCharId: string;
  formulaId: string;
  minEr: number; // e.g. 1.2 for 120%
  minCr: number; // e.g. 0.05 for 5% (for Favonius weapons)
  inventory: ArtifactData[];
  buildMatch?: BuildMatchResult | null;
  globalConfig: GlobalStatWeights;
  baseSheets: Record<string, StatSheet>; // Sheets for other 3 chars
  calcContext: CalcContext;

  artifactSet?: ArtifactSetConfig | null;

  // ── Multi-pass support (all default to targetCharId for backward compat) ──
  swapCharId?: string; // Whose artifacts to enumerate
  onFieldCharId?: string; // Who is "on field" for buff routing
  formulaCharId?: string; // Whose formula to evaluate
  erCheckCharId?: string; // Whose ER to check (default: swapCharId)
  excludedArtifactIds?: Set<string>; // Artifacts locked by prior passes
  reactionOverride?: ReactionOverride;
  altCount?: number; // Alternatives per slot in hill-climbing (default 7, use 5 on mobile)
  /** Absolute deadline (performance.now() ms). Hill-climbing exits early when reached. */
  deadlineMs?: number;
  /**
   * Custom scoring function. When provided, replaces the default
   * `getDamageResult(formulaCharId, formulaId, ...).totalDamage` calls.
   * Receives the full sheets map (with the candidate artifacts already applied)
   * and onFieldCharId for getTeamStats routing.
   */
  scoreFn?: (
    sheets: Record<string, StatSheet>,
    onFieldCharId: string
  ) => number;
}

/** Why the optimizer failed to find a valid build. */
export type { OptFailReason } from "@/lib/team-comp/types";

export interface OptimizationResult {
  bestDamage: number;
  bestDamageResult: DamageResult | null;
  bestArtifacts: Record<Slot, ArtifactData | null>;
  phase: "pruning" | "evaluating";
  progress: number; // 0 to 1
  combinationsEvaluated: number;
  combinationsTotal: number;
  startTime: number;
  endTime: number | null;
  done: boolean;
  failReason?: OptFailReason;
}

function scorePiece(
  art: ArtifactData,
  buildMatch: BuildMatchResult | null | undefined,
  globalConfig: GlobalStatWeights,
  crDiscount = 1
): number {
  if (!buildMatch) return 0;
  const baseWeights = buildMatch.statWeights;
  const weights =
    crDiscount < 1
      ? { ...baseWeights, cr: (baseWeights.cr ?? 0) * crDiscount }
      : baseWeights;
  let score = scoreSlot(art, weights, globalConfig);

  // Add main stat contribution when it matches the build recommendation.
  if (buildMatch) {
    const recommended = getTargetMainStatsForSlot(
      art.slotKey,
      buildMatch.build
    );
    if (recommended.has(art.mainStatKey)) {
      let mainScore = scoreMainStat(
        art.mainStatKey,
        art.rarity,
        globalConfig,
        art.level
      );
      // Also discount CR main stat when CR is devalued
      if (crDiscount < 1 && art.mainStatKey === "cr") {
        mainScore *= crDiscount;
      }
      score += mainScore;
    }
  }

  return score;
}

// ── Set matching helpers ──

export function matchesSetRequirement(
  pieces: readonly (ArtifactData | null)[],
  artifactSetId: string | null | undefined,
  artifactHalfSetIds: string[] | undefined
): boolean {
  const nonNull = pieces.filter((p): p is ArtifactData => p != null);

  // 4pc: need ≥4 pieces of the exact set key (1 flexible slot allowed)
  if (artifactSetId) {
    let count = 0;
    for (const p of nonNull) {
      if (p.setKey === artifactSetId) count++;
    }
    if (count < 4) return false;
  }

  // 2+2: the 2pc bonus activates per individual set (need ≥2 of the SAME set
  // key), not per halfSetId pool.  Count pieces per set key, then check that
  // at least one set key mapping to each required halfSetId has ≥2 pieces.
  if (
    artifactHalfSetIds &&
    artifactHalfSetIds.length !== 0 &&
    artifactHalfSetIds.length !== 2
  ) {
    throw new Error(
      `artifactHalfSetIds must have 0 or 2 entries, got ${artifactHalfSetIds.length}`
    );
  }
  if (artifactHalfSetIds && artifactHalfSetIds.length === 2) {
    const setKeyCounts = new Map<string, number>();
    for (const p of nonNull) {
      setKeyCounts.set(p.setKey, (setKeyCounts.get(p.setKey) ?? 0) + 1);
    }

    // Set keys that satisfy a halfSetId (individually have ≥2 pieces)
    const satisfying = (hId: string): string[] =>
      [...setKeyCounts.entries()]
        .filter(([k, n]) => artifactIdToHalfSetId[k] === hId && n >= 2)
        .map(([k]) => k);

    const [h1, h2] = artifactHalfSetIds;
    if (h1 === h2) {
      // Need 2 DISTINCT set keys each mapping to h1, each with ≥2 pieces
      if (satisfying(h1).length < 2) return false;
    } else {
      // Need one set for h1 with ≥2 pieces AND one set for h2 with ≥2 pieces
      if (satisfying(h1).length === 0 || satisfying(h2).length === 0)
        return false;
    }
  }

  return true;
}

/** Extract artifact ER contribution (internal, e.g. 0.518 for 51.8% ER sands). */
function getArtifactEr(art: ArtifactData | null): number {
  if (!art) return 0;
  let er = 0;
  if (art.mainStatKey === "er") {
    er += toInternal(
      "er",
      getMainStatValueAtLevel("er", art.rarity, art.level)
    );
  }
  if (art.substats.er) {
    er += toInternal("er", art.substats.er);
  }
  return er;
}

/** Extract artifact CR contribution (internal, e.g. 0.311 for 31.1% CR circlet). */
function getArtifactCr(art: ArtifactData | null): number {
  if (!art) return 0;
  let cr = 0;
  if (art.mainStatKey === "cr") {
    cr += toInternal(
      "cr",
      getMainStatValueAtLevel("cr", art.rarity, art.level)
    );
  }
  if (art.substats.cr) {
    cr += toInternal("cr", art.substats.cr);
  }
  return cr;
}

type ScoredArt = { art: ArtifactData; score: number; er: number };

type ArtifactTuple = [
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
];

function sameTuple(a: ArtifactTuple, b: ArtifactTuple): boolean {
  for (let i = 0; i < 5; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === null && bi === null) continue;
    if (ai === null || bi === null) return false;
    if (ai.id !== bi.id) return false;
  }
  return true;
}

// ── Marginal-gain scoring ──

const MARGINAL_GAIN_DELTAS: Partial<Record<StatKey, number>> = {
  ...AVG_SUBSTAT_ROLL,
  "pyro%": toInternal("pyro%", getFixedMainStatValue("pyro%", 5)),
  "hydro%": toInternal("hydro%", getFixedMainStatValue("hydro%", 5)),
  "anemo%": toInternal("anemo%", getFixedMainStatValue("anemo%", 5)),
  "electro%": toInternal("electro%", getFixedMainStatValue("electro%", 5)),
  "dendro%": toInternal("dendro%", getFixedMainStatValue("dendro%", 5)),
  "cryo%": toInternal("cryo%", getFixedMainStatValue("cryo%", 5)),
  "geo%": toInternal("geo%", getFixedMainStatValue("geo%", 5)),
  "phys%": toInternal("phys%", getFixedMainStatValue("phys%", 5)),
  "heal%": toInternal("heal%", getFixedMainStatValue("heal%", 5)),
};

/** Score an artifact by its actual stat contributions weighted by marginal gains. */
function scorePieceMarginal(
  art: ArtifactData,
  marginalGains: Partial<Record<StatKey, number>>
): number {
  let score = 0;

  // Main stat contribution (level-aware)
  if (art.mainStatKey) {
    const mainVal = toInternal(
      art.mainStatKey,
      getMainStatValueAtLevel(art.mainStatKey, art.rarity, art.level)
    );
    const gain = marginalGains[art.mainStatKey as StatKey];
    if (gain) {
      const delta = MARGINAL_GAIN_DELTAS[art.mainStatKey as StatKey];
      if (delta) score += (mainVal / delta) * gain;
    }
  }

  // Substat contributions
  for (const [subKey, subVal] of Object.entries(art.substats)) {
    if (!subVal) continue;
    const v = toInternal(subKey, subVal);
    const gain = marginalGains[subKey as StatKey];
    if (gain) {
      const delta = MARGINAL_GAIN_DELTAS[subKey as StatKey];
      if (delta) score += (v / delta) * gain;
    }
  }

  return score;
}

/** Compute marginal gain per stat for the swap character. */
function computeMarginalGainsForOptimizer(
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  currentArtifacts: ArtifactTuple,
  onFieldCharId: string,
  calcContext: CalcContext,
  reactionOverride?: ReactionOverride,
  scoreFn?: (sheets: Record<string, StatSheet>, onFieldCharId: string) => number
): Partial<Record<StatKey, number>> {
  const currentSheet = StatSheet.fromArtifacts(currentArtifacts);
  const sheets = { ...baseSheets, [swapCharId]: currentSheet };

  const baseDamage = scoreFn
    ? scoreFn(sheets, onFieldCharId)
    : (() => {
        teamBuild.getTeamStats(sheets, onFieldCharId, calcContext);
        return teamBuild.getDamageResult(
          formulaCharId,
          formulaId,
          calcContext,
          reactionOverride
        ).totalDamage;
      })();
  if (baseDamage === 0) return {};

  const gains: Partial<Record<StatKey, number>> = {};
  const marginalKeys = Object.keys(MARGINAL_GAIN_DELTAS) as StatKey[];

  for (const key of marginalKeys) {
    const delta = MARGINAL_GAIN_DELTAS[key];
    if (!delta) continue;
    const tweakedSheet = currentSheet.withDelta(key, delta);
    const tweakedSheets = { ...baseSheets, [swapCharId]: tweakedSheet };

    const newDamage = scoreFn
      ? scoreFn(tweakedSheets, onFieldCharId)
      : (() => {
          teamBuild.getTeamStats(tweakedSheets, onFieldCharId, calcContext);
          return teamBuild.getDamageResult(
            formulaCharId,
            formulaId,
            calcContext,
            reactionOverride
          ).totalDamage;
        })();
    const gain = newDamage - baseDamage;
    if (gain !== 0) gains[key] = gain;
  }

  return gains;
}

/** Evaluate a build: returns damage if ER passes, -1 otherwise. */
function evaluateBuild(
  pieces: ArtifactTuple,
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  onFieldCharId: string,
  calcContext: CalcContext,
  erCheckCharId: string,
  minEr: number,
  minCr: number,
  reactionOverride?: ReactionOverride,
  scoreFn?: (sheets: Record<string, StatSheet>, onFieldCharId: string) => number
): { damage: number; result: DamageResult | null } {
  const charSheet = StatSheet.fromArtifacts(pieces);
  const updatedSheets = { ...baseSheets, [swapCharId]: charSheet };
  const postStats = teamBuild.getTeamStats(
    updatedSheets,
    onFieldCharId,
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

  if (scoreFn) {
    return { damage: scoreFn(updatedSheets, onFieldCharId), result: null };
  }

  const dmgRes = teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    calcContext,
    reactionOverride
  );
  return { damage: dmgRes.totalDamage, result: dmgRes };
}

// ── Seed build generators ──

/** Generate 5 seed builds for 4pc (or no-set). One per flex slot. */
function buildSeedBuilds4pc(
  scoredPools: Record<Slot, ScoredArt[]>,
  artifactSetId: string | null | undefined
): ArtifactTuple[] {
  const seeds: ArtifactTuple[] = [];

  for (let flexIdx = 0; flexIdx < 5; flexIdx++) {
    const pieces: (ArtifactData | null)[] = [];
    for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
      const slot = allSlots[slotIdx];
      const pool = scoredPools[slot];
      const best = pool.length > 0 ? pool[0].art : null;

      if (slotIdx === flexIdx || !artifactSetId) {
        // Flex slot (or no-set): pick best overall piece
        pieces.push(best);
      } else {
        // Set-constrained slot: pick best set piece, fallback to best overall
        const setPiece = pool.find((s) => s.art.setKey === artifactSetId);
        pieces.push(setPiece?.art ?? best);
      }
    }
    seeds.push(pieces as ArtifactTuple);
  }

  return seeds;
}

/** Generate top seed builds for 2+2 by brute-forcing slot assignments. */
function buildSeedBuilds2pc(
  scoredPools: Record<Slot, ScoredArt[]>,
  artifactHalfSetIds: string[],
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  onFieldCharId: string,
  calcContext: CalcContext,
  erCheckCharId: string,
  minEr: number,
  minCr: number,
  reactionOverride?: ReactionOverride,
  scoreFn?: (sheets: Record<string, StatSheet>, onFieldCharId: string) => number
): ArtifactTuple[] {
  const [h1, h2] = artifactHalfSetIds;
  // Concrete setKeys for each halfSetId
  const h1SetKeys = artifactHalfSetsById[h1]?.setIds ?? [];
  const h2SetKeys = artifactHalfSetsById[h2]?.setIds ?? [];

  type SeedCandidate = { pieces: ArtifactTuple; damage: number };
  const candidates: SeedCandidate[] = [];

  /** Try to fill a slot layout with a specific setKey pair and evaluate. */
  function tryLayout(
    set1Slots: number[],
    set2Slots: number[],
    flexSlot: number,
    sk1: string,
    sk2: string
  ) {
    const pieces: (ArtifactData | null)[] = new Array(5).fill(null);

    for (const slotIdx of set1Slots) {
      const pool = scoredPools[allSlots[slotIdx]];
      const match = pool.find((s) => s.art.setKey === sk1);
      if (!match) return;
      pieces[slotIdx] = match.art;
    }

    for (const slotIdx of set2Slots) {
      const pool = scoredPools[allSlots[slotIdx]];
      const match = pool.find((s) => s.art.setKey === sk2);
      if (!match) return;
      pieces[slotIdx] = match.art;
    }

    const flexPool = scoredPools[allSlots[flexSlot]];
    pieces[flexSlot] = flexPool.length > 0 ? flexPool[0].art : null;

    const tuple = pieces as ArtifactTuple;
    if (!matchesSetRequirement(tuple, null, artifactHalfSetIds)) return;

    const { damage } = evaluateBuild(
      tuple,
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
    candidates.push({ pieces: tuple, damage });
  }

  // C(5,2) ways to pick 2 slots for set1, then C(3,2) from remaining for set2
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const remaining = [0, 1, 2, 3, 4].filter((x) => x !== i && x !== j);
      for (let ri = 0; ri < remaining.length; ri++) {
        for (let rj = ri + 1; rj < remaining.length; rj++) {
          const flexSlot = remaining.filter(
            (x) => x !== remaining[ri] && x !== remaining[rj]
          )[0];
          const firstSlots = [i, j];
          const secondSlots = [remaining[ri], remaining[rj]];

          // Try each concrete setKey for h1 × each concrete setKey for h2
          for (const sk1 of h1SetKeys) {
            for (const sk2 of h2SetKeys) {
              if (h1 === h2 && sk1 === sk2) continue;
              tryLayout(firstSlots, secondSlots, flexSlot, sk1, sk2);
            }
          }

          // Also try swapped slot assignment if h1 !== h2
          if (h1 !== h2) {
            for (const sk1 of h1SetKeys) {
              for (const sk2 of h2SetKeys) {
                tryLayout(secondSlots, firstSlots, flexSlot, sk2, sk1);
              }
            }
          }
        }
      }
    }
  }

  // Sort by damage descending, keep top 20
  candidates.sort((a, b) => b.damage - a.damage);
  return candidates.slice(0, 20).map((c) => c.pieces);
}

/** Enumerate all combinations from per-slot alternative lists, with prefix-sum pruning for ER/CR. */
function enumerateCombinations(
  alternatives: (ArtifactData | null)[][], // alternatives[slotIdx] = list of candidates for that slot
  artifactSetId: string | null | undefined,
  artifactHalfSetIds: string[] | undefined,
  effectiveMinArtifactEr: number,
  effectiveMinArtifactCr = 0
): ArtifactTuple[] {
  const result: ArtifactTuple[] = [];

  // Normalize empty alternative lists to [null] so the slot stays null
  const norm = alternatives.map((a) =>
    a.length > 0 ? a : [null as ArtifactData | null]
  );

  const needEr = effectiveMinArtifactEr > 0;
  const needCr = effectiveMinArtifactCr > 0;

  // Precompute max ER/CR achievable per slot for prefix-sum pruning.
  // maxErFromSlot[i] = max ER any single candidate in slot i can contribute.
  // suffixMaxEr[i] = sum of maxErFromSlot[j] for j = i..4  (max ER achievable from slots i onward).
  // This lets us prune: if cumEr + suffixMaxEr[nextSlot] < threshold, skip the entire subtree.
  const suffixMaxEr = new Float64Array(6); // index 5 = 0 (sentinel)
  const suffixMaxCr = new Float64Array(6);
  if (needEr) {
    for (let i = 4; i >= 0; i--) {
      let maxEr = 0;
      for (const a of norm[i]) maxEr = Math.max(maxEr, getArtifactEr(a));
      suffixMaxEr[i] = suffixMaxEr[i + 1] + maxEr;
    }
  }
  if (needCr) {
    for (let i = 4; i >= 0; i--) {
      let maxCr = 0;
      for (const a of norm[i]) maxCr = Math.max(maxCr, getArtifactCr(a));
      suffixMaxCr[i] = suffixMaxCr[i + 1] + maxCr;
    }
  }

  for (const a0 of norm[0]) {
    const er0 = needEr ? getArtifactEr(a0) : 0;
    const cr0 = needCr ? getArtifactCr(a0) : 0;
    // Prune: even with best possible pieces in slots 1-4, can't reach threshold
    if (needEr && er0 + suffixMaxEr[1] < effectiveMinArtifactEr) continue;
    if (needCr && cr0 + suffixMaxCr[1] < effectiveMinArtifactCr) continue;

    for (const a1 of norm[1]) {
      const er1 = er0 + (needEr ? getArtifactEr(a1) : 0);
      const cr1 = cr0 + (needCr ? getArtifactCr(a1) : 0);
      if (needEr && er1 + suffixMaxEr[2] < effectiveMinArtifactEr) continue;
      if (needCr && cr1 + suffixMaxCr[2] < effectiveMinArtifactCr) continue;

      for (const a2 of norm[2]) {
        const er2 = er1 + (needEr ? getArtifactEr(a2) : 0);
        const cr2 = cr1 + (needCr ? getArtifactCr(a2) : 0);
        if (needEr && er2 + suffixMaxEr[3] < effectiveMinArtifactEr) continue;
        if (needCr && cr2 + suffixMaxCr[3] < effectiveMinArtifactCr) continue;

        for (const a3 of norm[3]) {
          const er3 = er2 + (needEr ? getArtifactEr(a3) : 0);
          const cr3 = cr2 + (needCr ? getArtifactCr(a3) : 0);
          if (needEr && er3 + suffixMaxEr[4] < effectiveMinArtifactEr) continue;
          if (needCr && cr3 + suffixMaxCr[4] < effectiveMinArtifactCr) continue;

          for (const a4 of norm[4]) {
            const pieces: ArtifactTuple = [a0, a1, a2, a3, a4];

            if (
              !matchesSetRequirement(pieces, artifactSetId, artifactHalfSetIds)
            )
              continue;

            if (needEr) {
              const totalEr = er3 + getArtifactEr(a4);
              if (totalEr < effectiveMinArtifactEr) continue;
            }

            if (needCr) {
              const totalCr = cr3 + getArtifactCr(a4);
              if (totalCr < effectiveMinArtifactCr) continue;
            }

            result.push(pieces);
          }
        }
      }
    }
  }

  return result;
}

// ── Marginal-Gain Hill-Climbing Optimizer ──

export async function* runOptimization(
  opts: OptimizerOptions
): AsyncGenerator<OptimizationResult> {
  const {
    teamBuild,
    targetCharId,
    formulaId,
    minEr,
    minCr,
    inventory,
    buildMatch,
    globalConfig,
    baseSheets,
    calcContext,
    artifactSet,
    excludedArtifactIds,
    reactionOverride,
    scoreFn,
    deadlineMs,
  } = opts;

  // Derive internal set variables from the new ArtifactSetConfig type
  const artifactSetId: string | null =
    artifactSet?.type === "4pc" ? artifactSet.setId : null;
  const artifactHalfSetIds: string[] | undefined =
    artifactSet?.type === "2pc+2pc" ? [...artifactSet.halfSetIds] : undefined;

  // Resolve effective IDs (default to targetCharId for backward compat)
  const swapCharId = opts.swapCharId ?? targetCharId;
  const onFieldCharId = opts.onFieldCharId ?? targetCharId;
  const formulaCharId = opts.formulaCharId ?? targetCharId;
  const erCheckCharId = opts.erCheckCharId ?? swapCharId;

  const startTime = Date.now();

  // ── CR discount for heuristic scoring ──
  let crDiscount = 1;
  if (swapCharId === formulaCharId) {
    if (calcContext.perCharCrTarget?.[swapCharId] != null) {
      const baselineSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
      const baselineStats = teamBuild.getTeamStats(
        baselineSheets,
        onFieldCharId,
        calcContext
      );
      const effectiveCr = baselineStats[formulaCharId]?.get("cr", null) ?? 0;
      crDiscount = effectiveCr >= 1.0 ? 0 : Math.max(0, 1 - effectiveCr);
    }
  }

  // ── Boost buildMatch weights with ER/CR gap from requirements ──
  // Same approach as V2's boostWeightsForConstraints(): inject synthetic
  // ER/CR weights proportional to the gap so that artifact ranking already
  // favours pieces that help meet constraints.
  let effectiveBuildMatch = buildMatch;
  if (buildMatch && (minEr > 0 || minCr > 0)) {
    const blSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
    const blStats = teamBuild.getTeamStats(
      blSheets,
      onFieldCharId,
      calcContext
    );
    const baseWeights = buildMatch.statWeights;
    const maxWeight = Math.max(
      0,
      ...Object.values(baseWeights).map((v) => Math.abs(v ?? 0))
    );
    if (maxWeight > 0) {
      let boosted: Record<string, number> | null = null;
      if (minEr > 0) {
        const erFloorBl = blStats[erCheckCharId]?.get("er", null) ?? 0;
        const erGap = Math.max(0, minEr - erFloorBl);
        if (erGap > 0) {
          boosted = boosted ?? { ...baseWeights };
          const syntheticEr = Math.min(erGap, 1.5) * maxWeight;
          boosted.er = Math.max(boosted.er ?? 0, syntheticEr);
        }
      }
      if (minCr > 0) {
        const crFloorBl = blStats[erCheckCharId]?.get("cr", null) ?? 0;
        const crGap = Math.max(0, minCr - crFloorBl);
        if (crGap > 0) {
          boosted = boosted ?? { ...baseWeights };
          const syntheticCr = crGap * maxWeight;
          boosted.cr = Math.max(boosted.cr ?? 0, syntheticCr);
        }
      }
      if (boosted) {
        effectiveBuildMatch = { ...buildMatch, statWeights: boosted };
      }
    }
  }

  // ── Per-slot preparation: keep the full inventory, sorted only for seeding ──

  const scoredPools: Record<Slot, ScoredArt[]> = {
    flower: [],
    plume: [],
    sands: [],
    goblet: [],
    circlet: [],
  };

  for (const slot of allSlots) {
    const slotArts = inventory.filter(
      (a) =>
        a.slotKey === slot &&
        (!excludedArtifactIds || !excludedArtifactIds.has(a.id))
    );

    const withScore = slotArts.map((art) => ({
      art,
      score: scorePiece(art, effectiveBuildMatch, globalConfig, crDiscount),
      er: getArtifactEr(art),
    }));

    withScore.sort((a, b) => b.score - a.score);

    scoredPools[slot] = withScore;
  }

  // ── Check for empty pools ──
  const emptySlots = allSlots.filter((s) => scoredPools[s].length === 0);

  // ── Pre-compute baseline ER for cheap ER pre-filter ──
  let erFloor = 0;
  if (minEr > 0) {
    const baselineSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
    const baselineStats = teamBuild.getTeamStats(baselineSheets, onFieldCharId);
    erFloor = baselineStats[erCheckCharId]?.get("er", null) ?? 0;
  }
  const minArtifactEr = Math.max(0, minEr - erFloor);

  let maxSetErBonus = 0;
  if (minArtifactEr > 0) {
    const erHalfSetSlots = new Map<string, number>();
    for (const slot of allSlots) {
      const seen = new Set<string>();
      for (const { art } of scoredPools[slot]) {
        const hsId = artifactIdToHalfSetId[art.setKey];
        if (!hsId || !hsId.startsWith("er-") || seen.has(hsId)) continue;
        seen.add(hsId);
        erHalfSetSlots.set(hsId, (erHalfSetSlots.get(hsId) ?? 0) + 1);
      }
    }
    for (const [hsId, slotCount] of erHalfSetSlots) {
      if (slotCount >= 2) {
        const bonus = Number.parseFloat(hsId.slice(3)) / 100;
        if (Number.isFinite(bonus) && bonus > maxSetErBonus)
          maxSetErBonus = bonus;
      }
    }
  }
  const effectiveMinArtifactEr = Math.max(0, minArtifactEr - maxSetErBonus);

  // ── Pre-compute max achievable ER from artifacts (for early-exit) ──
  let maxAchievableArtifactEr = maxSetErBonus;
  if (minArtifactEr > 0) {
    for (const slot of allSlots) {
      let bestSlotEr = 0;
      for (const { er } of scoredPools[slot]) {
        if (er > bestSlotEr) bestSlotEr = er;
      }
      maxAchievableArtifactEr += bestSlotEr;
    }
  }

  // ── Pre-compute baseline CR for cheap CR pre-filter ──
  let crFloor = 0;
  if (minCr > 0) {
    const baselineSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
    const baselineStats = teamBuild.getTeamStats(baselineSheets, onFieldCharId);
    crFloor = baselineStats[erCheckCharId]?.get("cr", null) ?? 0;
  }
  const minArtifactCr = Math.max(0, minCr - crFloor);
  const effectiveMinArtifactCr = Math.max(0, minArtifactCr);

  // ── Yield initial progress ──
  let bestDamage = -1;
  let bestDamageResult: DamageResult | null = null;
  let bestArtifacts: Record<Slot, ArtifactData | null> = {
    flower: null,
    plume: null,
    sands: null,
    goblet: null,
    circlet: null,
  };
  let combinationsEvaluated = 0;
  let combinationsTotal = 0;
  let failReason: OptFailReason | undefined;

  const getResult = (
    phase: "pruning" | "evaluating",
    done = false
  ): OptimizationResult => ({
    bestDamage,
    bestDamageResult,
    bestArtifacts: { ...bestArtifacts },
    phase,
    progress:
      combinationsTotal > 0 ? combinationsEvaluated / combinationsTotal : 0,
    combinationsEvaluated,
    combinationsTotal,
    startTime,
    endTime: done ? Date.now() : null,
    done,
    ...(done && failReason ? { failReason } : {}),
  });

  yield getResult("pruning");
  await new Promise((resolve) => setTimeout(resolve, 0));

  // ── Determine mode and build seeds ──
  const is4pc = !!artifactSetId;
  const is2pc =
    !artifactSetId && !!artifactHalfSetIds && artifactHalfSetIds.length === 2;

  // ── Early-exit: check if the set requirement is satisfiable ──
  // This must run BEFORE the ER check so that impossible sets are reported
  // as "set-impossible" rather than "er-unmet".
  {
    let setFeasible = true;
    if (is4pc) {
      let slotsWithSetPiece = 0;
      for (const slot of allSlots) {
        if (scoredPools[slot].some((s) => s.art.setKey === artifactSetId))
          slotsWithSetPiece++;
      }
      if (slotsWithSetPiece < 4) {
        setFeasible = false;
        const slotCounts: Record<string, number> = {};
        for (const slot of allSlots) {
          slotCounts[slot] = scoredPools[slot].filter(
            (s) => s.art.setKey === artifactSetId
          ).length;
        }
        failReason = {
          kind: "set-impossible",
          artifactSet,
          slotCounts,
        };
      }
    } else if (is2pc) {
      const [h1, h2] = artifactHalfSetIds!;
      const slotsForHalf = (hId: string): number => {
        let count = 0;
        for (const slot of allSlots) {
          if (
            scoredPools[slot].some(
              (s) => artifactIdToHalfSetId[s.art.setKey] === hId
            )
          )
            count++;
        }
        return count;
      };
      if (slotsForHalf(h1) < 2 || slotsForHalf(h2) < 2) {
        setFeasible = false;
        const slotCounts: Record<string, number> = {};
        for (const slot of allSlots) {
          slotCounts[slot] = scoredPools[slot].length;
        }
        failReason = {
          kind: "set-impossible",
          artifactSet,
          slotCounts,
        };
      }
    }

    if (!setFeasible) {
      combinationsTotal = combinationsEvaluated;
      yield getResult("evaluating", true);
      return;
    }
  }

  // ── Early-exit: check if ER target is achievable ──
  if (minArtifactEr > 0) {
    // Compute set-constrained max ER: for each slot, the best ER from artifacts
    // that satisfy the set requirement, plus the flex slot(s) can use any artifact.
    let setConstrainedMaxEr = maxAchievableArtifactEr; // fallback = set-agnostic

    if (is4pc) {
      // 4pc: 4 slots must use set pieces, 1 flex slot gets best overall ER
      // For each slot, compute best ER from set pieces and best ER from any piece
      const bestSetEr: number[] = [];
      const bestAnyEr: number[] = [];
      for (const slot of allSlots) {
        let bestSet = 0;
        let bestAny = 0;
        for (const { art, er } of scoredPools[slot]) {
          if (er > bestAny) bestAny = er;
          if (art.setKey === artifactSetId && er > bestSet) bestSet = er;
        }
        bestSetEr.push(bestSet);
        bestAnyEr.push(bestAny);
      }
      // Try each slot as the flex slot, sum set-ER for the other 4 + any-ER for flex
      let bestCombo = -1;
      for (let flex = 0; flex < 5; flex++) {
        // Check that the other 4 slots actually have set pieces
        let valid = true;
        let total = maxSetErBonus;
        for (let s = 0; s < 5; s++) {
          if (s === flex) {
            total += bestAnyEr[s];
          } else {
            if (
              bestSetEr[s] === 0 &&
              scoredPools[allSlots[s]].every(
                (p) => p.art.setKey !== artifactSetId
              )
            ) {
              valid = false;
              break;
            }
            total += bestSetEr[s];
          }
        }
        if (valid && total > bestCombo) bestCombo = total;
      }
      if (bestCombo >= 0) setConstrainedMaxEr = bestCombo;
    } else if (is2pc) {
      // 2pc+2pc: 2 slots for half-set 1, 2 for half-set 2, 1 flex
      // This is complex to compute exactly; use the set-agnostic max as upper bound
      // (the set-agnostic check is still valuable for bailing on truly impossible cases)
    }

    if (setConstrainedMaxEr < minArtifactEr - 0.001) {
      failReason = {
        kind: "er-unmet",
        minEr,
        bestEr: erFloor + setConstrainedMaxEr,
      };
      combinationsTotal = combinationsEvaluated;
      yield getResult("evaluating", true);
      return;
    }
  }
  // no-set = neither 4pc nor 2+2

  let seedBuilds: ArtifactTuple[];

  if (is2pc) {
    seedBuilds = buildSeedBuilds2pc(
      scoredPools,
      artifactHalfSetIds!,
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
  } else {
    // 4pc or no-set: 5 seed builds
    seedBuilds = buildSeedBuilds4pc(scoredPools, artifactSetId);
  }

  // Add ER-greedy seed when there's an ER gap — picks highest-ER artifact per slot
  if (minArtifactEr > 0 && seedBuilds.length > 0) {
    const erSeed: ArtifactTuple = [...seedBuilds[0]];
    for (let s = 0; s < 5; s++) {
      const slot = allSlots[s];
      let bestEr = getArtifactEr(erSeed[s]);
      for (const { art, er } of scoredPools[slot]) {
        if (er > bestEr) {
          bestEr = er;
          erSeed[s] = art;
        }
      }
    }
    seedBuilds.push(erSeed);
  }

  // Deduplicate seeds by artifact ID tuple
  {
    const seen = new Set<string>();
    seedBuilds = seedBuilds.filter((s) => {
      const key = s.map((a) => a?.id ?? "null").join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (seedBuilds.length === 0) {
    if (emptySlots.length > 0) {
      failReason = { kind: "empty-pool", emptySlots };
    } else if (is4pc) {
      // Count how many slots have a piece from the required set
      const slotCounts: Record<string, number> = {};
      for (const slot of allSlots) {
        const count = scoredPools[slot].filter(
          (s) => s.art.setKey === artifactSetId
        ).length;
        slotCounts[slot] = count;
      }
      failReason = {
        kind: "set-impossible",
        artifactSet,
        slotCounts,
      };
    } else if (is2pc) {
      const slotCounts: Record<string, number> = {};
      for (const slot of allSlots) {
        slotCounts[slot] = scoredPools[slot].length;
      }
      failReason = {
        kind: "set-impossible",
        artifactSet,
        slotCounts,
      };
    } else {
      failReason = {
        kind: "no-seeds",
        artifactSet,
      };
    }
    yield getResult("evaluating", true);
    return;
  }

  // ── Early-exit: check if the set requirement is satisfiable ──
  // If it's impossible, no amount of altCount widening will help, so bail
  // before the retry loop to avoid expensive no-op iterations.
  let setFeasible = true;
  if (is4pc) {
    let slotsWithSetPiece = 0;
    for (const slot of allSlots) {
      if (scoredPools[slot].some((s) => s.art.setKey === artifactSetId))
        slotsWithSetPiece++;
    }
    if (slotsWithSetPiece < 4) {
      setFeasible = false;
      const slotCounts: Record<string, number> = {};
      for (const slot of allSlots) {
        slotCounts[slot] = scoredPools[slot].filter(
          (s) => s.art.setKey === artifactSetId
        ).length;
      }
      failReason = { kind: "set-impossible", artifactSet, slotCounts };
    }
  } else if (is2pc) {
    // For 2+2, check that each half-set has pieces in ≥2 distinct slots
    const [h1, h2] = artifactHalfSetIds!;
    const slotsForHalf = (hId: string): number => {
      let count = 0;
      for (const slot of allSlots) {
        if (
          scoredPools[slot].some(
            (s) => artifactIdToHalfSetId[s.art.setKey] === hId
          )
        )
          count++;
      }
      return count;
    };
    if (slotsForHalf(h1) < 2 || slotsForHalf(h2) < 2) {
      setFeasible = false;
      const slotCounts: Record<string, number> = {};
      for (const slot of allSlots) {
        slotCounts[slot] = scoredPools[slot].length;
      }
      failReason = {
        kind: "set-impossible",
        artifactSet,
        slotCounts,
      };
    }
  }

  if (!setFeasible) {
    combinationsTotal = combinationsEvaluated;
    yield getResult("evaluating", true);
    return;
  }

  // Number of alternatives per slot depends on mode
  const baseAltCount = is2pc ? 1 : (opts.altCount ?? 7);
  const ALT_COUNT_STEP = 5;
  const MAX_HILL_CLIMB_STEPS = 20;
  const IMPROVEMENT_EPSILON = 0.001;
  const CHUNK_SIZE = 200;

  // ── Helper: update best if improved ──
  function updateBest(
    pieces: ArtifactTuple,
    damage: number,
    result: DamageResult | null
  ) {
    if (damage > bestDamage) {
      bestDamage = damage;
      bestDamageResult = result;
      bestArtifacts = {
        flower: pieces[0],
        plume: pieces[1],
        sands: pieces[2],
        goblet: pieces[3],
        circlet: pieces[4],
      };
    }
  }

  const maxPoolSize = Math.max(...allSlots.map((s) => scoredPools[s].length));

  // Retry with increasing altCount when ER requirement can't be met
  let altCount = baseAltCount;

  for (;;) {
    // Estimate total evaluations for progress reporting
    const combosPerStep = (1 + altCount) ** 5;
    combinationsTotal =
      seedBuilds.length * (1 + combosPerStep) * MAX_HILL_CLIMB_STEPS;

    yield getResult("pruning");
    await new Promise((resolve) => setTimeout(resolve, 0));

    let chunkCount = 0;

    for (const seed of seedBuilds) {
      let current = seed;
      let currentEval = evaluateBuild(
        current,
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

      const seedValid = matchesSetRequirement(
        current,
        artifactSetId,
        artifactHalfSetIds
      );
      if (currentEval.damage > 0 && seedValid) {
        updateBest(current, currentEval.damage, currentEval.result);
      }
      combinationsEvaluated++;
      chunkCount++;

      for (let step = 0; step < MAX_HILL_CLIMB_STEPS; step++) {
        const marginalGains = computeMarginalGainsForOptimizer(
          teamBuild,
          swapCharId,
          formulaCharId,
          formulaId,
          baseSheets,
          current,
          onFieldCharId,
          calcContext,
          reactionOverride,
          scoreFn
        );

        // Inject synthetic ER/CR marginal gains when below threshold.
        // When the constraint is unmet, builds are invalid (damage=-1), so
        // ER/CR pieces need to rank higher in alternatives. The multiplier
        // ramps up with each step: 0.5, 1.0, 1.5, 2.0, ... so early steps
        // balance damage + constraint, and later steps push harder if still unmet.
        if (minEr > 0 || minCr > 0) {
          const currentSheet = StatSheet.fromArtifacts(current);
          const sheets = { ...baseSheets, [swapCharId]: currentSheet };
          const postStats = teamBuild.getTeamStats(
            sheets,
            onFieldCharId,
            calcContext
          );
          const maxGain = Math.max(
            0,
            ...Object.values(marginalGains).map((v) => Math.abs(v ?? 0))
          );
          const rampMultiplier = step + 1;
          if (minEr > 0) {
            const currentEr = postStats[erCheckCharId]?.get("er", null) ?? 0;
            if (currentEr < minEr) {
              marginalGains.er = Math.max(
                marginalGains.er ?? 0,
                maxGain * rampMultiplier
              );
            }
          }
          if (minCr > 0) {
            const currentCr = postStats[erCheckCharId]?.get("cr", null) ?? 0;
            if (currentCr < minCr) {
              marginalGains.cr = Math.max(
                marginalGains.cr ?? 0,
                maxGain * rampMultiplier
              );
            }
          }
        }

        const perSlotAlternatives: (ArtifactData | null)[][] = [];
        for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
          const slot = allSlots[slotIdx];
          const pool = scoredPools[slot];
          const currentArt = current[slotIdx];
          const currentArtId = currentArt?.id;

          const scored = pool
            .filter((s) => currentArtId == null || s.art.id !== currentArtId)
            .map((s) => ({
              art: s.art,
              mgScore: scorePieceMarginal(s.art, marginalGains),
            }))
            .sort((a, b) => b.mgScore - a.mgScore);

          const topAlts = scored.slice(0, altCount).map((s) => s.art);
          if (currentArt) {
            perSlotAlternatives.push([currentArt, ...topAlts]);
          } else if (topAlts.length > 0) {
            perSlotAlternatives.push(topAlts);
          } else {
            perSlotAlternatives.push([]);
          }
        }

        const combos = enumerateCombinations(
          perSlotAlternatives,
          artifactSetId,
          artifactHalfSetIds,
          effectiveMinArtifactEr,
          effectiveMinArtifactCr
        );

        let bestLocalTuple = current;
        let bestLocalDamage = currentEval.damage;
        let bestLocalResult = currentEval.result;

        let deadlineHit = false;
        for (const combo of combos) {
          if (sameTuple(combo, current)) {
            combinationsEvaluated++;
            chunkCount++;
            continue;
          }

          const { damage, result } = evaluateBuild(
            combo,
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
          if (damage > 0) {
            updateBest(combo, damage, result);
          }
          if (damage > bestLocalDamage + IMPROVEMENT_EPSILON) {
            bestLocalTuple = combo;
            bestLocalDamage = damage;
            bestLocalResult = result;
          }

          combinationsEvaluated++;
          chunkCount++;

          if (chunkCount >= CHUNK_SIZE) {
            chunkCount = 0;
            yield getResult("evaluating");
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (deadlineMs && performance.now() >= deadlineMs) {
              deadlineHit = true;
              break;
            }
          }
        }
        if (deadlineHit) break;

        if (bestLocalDamage <= currentEval.damage + IMPROVEMENT_EPSILON) {
          break;
        }

        current = bestLocalTuple;
        currentEval = { damage: bestLocalDamage, result: bestLocalResult };
      }

      yield getResult("evaluating");
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (deadlineMs && performance.now() >= deadlineMs) break;
    }

    // If we found a valid build, or there's no ER/CR requirement, or we've
    // already widened altCount to cover all available pieces, stop retrying.
    if (bestDamage > 0 || (minEr <= 0 && minCr <= 0) || altCount >= maxPoolSize)
      break;
    if (deadlineMs && performance.now() >= deadlineMs) break;

    // Only widen if at least one slot would gain new candidates
    const nextAltCount = Math.min(altCount + ALT_COUNT_STEP, maxPoolSize);
    if (nextAltCount <= altCount) break;
    altCount = nextAltCount;
  }

  // Diagnose failure when no valid build was found
  if (bestDamage <= 0 && !failReason) {
    if (emptySlots.length > 0) {
      failReason = { kind: "empty-pool", emptySlots };
    } else if (minEr > 0 || minCr > 0) {
      // Find the best ER/CR we could achieve across seeds to report the gap
      let bestErSeen = 0;
      let bestCrSeen = 0;
      for (const seed of seedBuilds) {
        const charSheet = StatSheet.fromArtifacts(seed);
        const updatedSheets = { ...baseSheets, [swapCharId]: charSheet };
        const postStats = teamBuild.getTeamStats(
          updatedSheets,
          onFieldCharId,
          calcContext
        );
        const er = postStats[erCheckCharId]?.get("er", null) ?? 0;
        if (er > bestErSeen) bestErSeen = er;
        const cr = postStats[erCheckCharId]?.get("cr", null) ?? 0;
        if (cr > bestCrSeen) bestCrSeen = cr;
      }
      if (minEr > 0 && bestErSeen < minEr) {
        failReason = { kind: "er-unmet", minEr, bestEr: bestErSeen };
      } else if (minCr > 0 && bestCrSeen < minCr) {
        failReason = { kind: "cr-unmet", minCr, bestCr: bestCrSeen };
      } else {
        failReason = {
          kind: "all-filtered",
          combinationsTotal: combinationsEvaluated,
        };
      }
    } else {
      failReason = {
        kind: "all-filtered",
        combinationsTotal: combinationsEvaluated,
      };
    }
  }

  // Update total to match actual evaluations for final progress = 1
  combinationsTotal = combinationsEvaluated;
  yield getResult("evaluating", true);
}
