import { artifactIdToHalfSetId } from "@/data/constants";
import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import {
  type BuildMatchResult,
  getFixedMainStatValue,
  getTargetMainStatsForSlot,
  scoreMainStat,
  scoreSlot,
} from "../account-data/artifactScore";
import type { TeamBuild } from "./damageCalc";
import { StatSheet } from "./damageModels";
import type { CalcContext, DamageResult } from "./types";

export interface OptimizerOptions {
  teamBuild: TeamBuild;
  targetCharId: string;
  formulaId: string;
  targetEr: number; // e.g. 1.2 for 120%
  inventory: ArtifactData[];
  buildMatch: BuildMatchResult;
  globalConfig: GlobalStatWeights;
  baseSheets: Record<string, StatSheet>; // Sheets for other 3 chars
  calcContext: CalcContext;

  topN?: number; // Per-slot prune count (default 20)
  maxBuilds?: number; // Top builds to evaluate for damage (default 1000)

  artifactSetId?: string | null;
  artifactHalfSetIds?: string[];

  // ── Multi-pass support (all default to targetCharId for backward compat) ──
  swapCharId?: string; // Whose artifacts to enumerate
  calcTargetId?: string; // Who is "on field" for buff routing
  formulaCharId?: string; // Whose formula to evaluate
  erCheckCharId?: string; // Whose ER to check (default: swapCharId)
  excludedArtifactIds?: Set<string>; // Artifacts locked by prior passes
}

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
}

function scorePiece(
  art: ArtifactData,
  buildMatch: BuildMatchResult,
  globalConfig: GlobalStatWeights
): number {
  let score = scoreSlot(art, buildMatch.statWeights, globalConfig);

  // Add main stat contribution when it matches the build recommendation.
  const recommended = getTargetMainStatsForSlot(art.slotKey, buildMatch.build);
  if (recommended.has(art.mainStatKey)) {
    score += scoreMainStat(art.mainStatKey, art.rarity, globalConfig);
  }

  return score;
}

// ── Set matching helpers ──

export function matchesSetRequirement(
  pieces: readonly ArtifactData[],
  artifactSetId: string | null | undefined,
  artifactHalfSetIds: string[] | undefined
): boolean {
  // 4pc: need ≥4 pieces of the exact set key (1 flexible slot allowed)
  if (artifactSetId) {
    let count = 0;
    for (const p of pieces) {
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
    for (const p of pieces) {
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
      // (e.g. 2×Gladiator's + 2×Shimenawa for double ATK% 2pc)
      if (satisfying(h1).length < 2) return false;
    } else {
      // Need one set for h1 with ≥2 pieces AND one set for h2 with ≥2 pieces
      if (satisfying(h1).length === 0 || satisfying(h2).length === 0)
        return false;
    }
  }

  return true;
}

// ── Two-phase optimizer ──

/** Extract artifact ER contribution (decimal, e.g. 0.518 for 51.8% ER sands). */
function getArtifactEr(art: ArtifactData): number {
  let er = 0;
  if (art.mainStatKey === "er") {
    er += getFixedMainStatValue("er", art.rarity) / 100;
  }
  if (art.substats.er) {
    er += art.substats.er / 100;
  }
  return er;
}

type ScoredArt = { art: ArtifactData; score: number; er: number };

type Candidate = {
  totalScore: number;
  pieces: [
    ArtifactData,
    ArtifactData,
    ArtifactData,
    ArtifactData,
    ArtifactData,
  ];
};

export async function* runOptimization(
  opts: OptimizerOptions
): AsyncGenerator<OptimizationResult> {
  const {
    teamBuild,
    targetCharId,
    formulaId,
    targetEr,
    inventory,
    buildMatch,
    globalConfig,
    baseSheets,
    calcContext,
    artifactSetId,
    artifactHalfSetIds,
    excludedArtifactIds,
  } = opts;

  // Resolve effective IDs (default to targetCharId for backward compat)
  const swapCharId = opts.swapCharId ?? targetCharId;
  const calcTargetId = opts.calcTargetId ?? targetCharId;
  const formulaCharId = opts.formulaCharId ?? targetCharId;
  const erCheckCharId = opts.erCheckCharId ?? swapCharId;

  const topN = opts.topN || 20;
  const maxBuilds = opts.maxBuilds ?? 1000;
  const startTime = Date.now();

  // ── Per-slot pruning: keep top N artifacts per slot by heuristic score ──

  const scoredPools: Record<Slot, ScoredArt[]> = {
    flower: [],
    plume: [],
    sands: [],
    goblet: [],
    circlet: [],
  };

  const DUMMY_ART: ArtifactData = {
    id: "dummy",
    setKey: "empty",
    slotKey: "flower",
    rarity: 1,
    mainStatKey: "hp%",
    level: 0,
    lock: false,
    substats: {},
  };

  for (const slot of allSlots) {
    const slotArts = inventory.filter(
      (a) =>
        a.slotKey === slot &&
        (!excludedArtifactIds || !excludedArtifactIds.has(a.id))
    );

    const withScore = slotArts.map((art) => ({
      art,
      score: scorePiece(art, buildMatch, globalConfig),
      er: getArtifactEr(art),
    }));

    withScore.sort((a, b) => b.score - a.score);

    if (artifactSetId || artifactHalfSetIds?.length) {
      // Split into set-piece and off-set-piece sub-pools so that the one
      // flexible slot (4pc: 4+1; 2+2: 2+2+1) is always represented in every
      // slot's pool regardless of how many set pieces exist.
      // The score stored is the raw stat score (no artificial boost) so that
      // flexible-slot combos compete on equal footing with all-set combos
      // during phase-1 candidate ranking.
      const isSetPiece = (art: ArtifactData) =>
        (!!artifactSetId && art.setKey === artifactSetId) ||
        (!!artifactHalfSetIds &&
          artifactHalfSetIds.includes(artifactIdToHalfSetId[art.setKey]));
      const setPieces = withScore
        .filter((x) => isSetPiece(x.art))
        .slice(0, topN);
      const offSetPieces = withScore
        .filter((x) => !isSetPiece(x.art))
        .slice(0, topN);
      scoredPools[slot] = [...setPieces, ...offSetPieces];
      // Re-sort globally: higher index ⟹ lower score (required for branch-and-bound).
      scoredPools[slot].sort((a, b) => b.score - a.score);
    } else {
      scoredPools[slot] = withScore.slice(0, Math.max(topN, 1));
    }

    if (scoredPools[slot].length === 0) {
      scoredPools[slot] = [
        { art: { ...DUMMY_ART, slotKey: slot }, score: 0, er: 0 },
      ];
    }
  }

  // ── Pre-compute baseline ER (without artifacts) for cheap ER pre-filter ──
  // Run getTeamStats once with an empty artifact sheet for the swap character
  // to get ER from base (1.0) + weapon + ascension + team buffs.
  let erFloor = 0;
  if (targetEr > 0) {
    const baselineSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
    const baselineStats = teamBuild.getTeamStats(baselineSheets, calcTargetId);
    erFloor = baselineStats[erCheckCharId]?.get("er") ?? 0;
  }
  // Minimum artifact ER needed to meet the target
  const minArtifactEr = Math.max(0, targetEr - erFloor);

  // Conservative adjustment: 2pc set bonuses can grant ER (e.g. Emblem +20%)
  // but getArtifactEr only sums raw main/substat ER.  Reduce the pre-filter
  // threshold by the max possible set-bonus ER so we never reject a build that
  // would actually meet the target after set bonuses are applied.
  let maxSetErBonus = 0;
  if (minArtifactEr > 0) {
    const erHalfSetSlots = new Map<string, number>();
    for (const slot of allSlots) {
      const seen = new Set<string>();
      for (const { art } of scoredPools[slot]) {
        if (art.id === "dummy") continue;
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

  // ── Phase 1: Collect top-K builds by total heuristic score (cheap) ──
  // Set-check + ER pre-filter + sum of 5 pre-computed scores per combination.

  // Yield immediately so the UI can display 0% progress before the blocking loop.
  const pruningResult: OptimizationResult = {
    bestDamage: -1,
    bestDamageResult: null,
    bestArtifacts: {
      flower: null,
      plume: null,
      sands: null,
      goblet: null,
      circlet: null,
    },
    phase: "pruning",
    progress: 0,
    combinationsEvaluated: 0,
    combinationsTotal: 0,
    startTime,
    endTime: null,
    done: false,
  };
  yield pruningResult;
  await new Promise((resolve) => setTimeout(resolve, 0));

  // ── Phase 1: Collect top-K builds by total heuristic score ──
  // Branch-and-bound: pools are sorted descending by score, so if the best
  // possible total from a partial combination ≤ minCandidateScore, the entire
  // remaining subtree can be skipped with a break.
  //
  // suffixMax[k] = sum of the highest score in each slot from k to 4.
  // This is the upper bound on additional score from those remaining slots.
  const orderedPools = [
    scoredPools.flower,
    scoredPools.plume,
    scoredPools.sands,
    scoredPools.goblet,
    scoredPools.circlet,
  ] as const;
  const suffixMax = [0, 0, 0, 0, 0, 0]; // index 5 is sentinel (0)
  for (let k = 4; k >= 0; k--) {
    suffixMax[k] = (orderedPools[k][0]?.score ?? 0) + suffixMax[k + 1];
  }

  const candidates: Candidate[] = [];
  let minCandidateScore = Number.NEGATIVE_INFINITY;
  let bestValidScore = Number.NEGATIVE_INFINITY;
  const CLEANUP_THRESHOLD = maxBuilds * 2;

  for (let fi = 0; fi < scoredPools.flower.length; fi++) {
    const f = scoredPools.flower[fi];
    if (f.score + suffixMax[1] <= minCandidateScore) break;

    for (const p of scoredPools.plume) {
      const fp = f.score + p.score;
      if (fp + suffixMax[2] <= minCandidateScore) break;

      for (const s of scoredPools.sands) {
        const fps = fp + s.score;
        if (fps + suffixMax[3] <= minCandidateScore) break;

        for (const g of scoredPools.goblet) {
          const fpsg = fps + g.score;
          if (fpsg + suffixMax[4] <= minCandidateScore) break;

          for (const c of scoredPools.circlet) {
            const totalScore = fpsg + c.score;
            if (totalScore <= minCandidateScore) break; // pool sorted desc

            const pieces = [f.art, p.art, s.art, g.art, c.art] as const;

            if (
              !matchesSetRequirement(pieces, artifactSetId, artifactHalfSetIds)
            )
              continue;

            // Cheap ER pre-filter: skip builds that can't meet ER requirement
            if (effectiveMinArtifactEr > 0) {
              const artifactEr = f.er + p.er + s.er + g.er + c.er;
              if (artifactEr < effectiveMinArtifactEr) continue;
            }

            candidates.push({
              totalScore,
              pieces: [f.art, p.art, s.art, g.art, c.art],
            });

            // Dynamically tighten threshold when a new best valid score is found.
            // The final 1/3 cutoff removes scores ≤ bestValidScore/3 anyway,
            // so pruning those combinations early is always safe.
            if (totalScore > bestValidScore) {
              bestValidScore = totalScore;
              minCandidateScore = Math.max(
                minCandidateScore,
                bestValidScore / 3
              );
            }

            // Periodic trim to bound memory
            if (candidates.length >= CLEANUP_THRESHOLD) {
              candidates.sort((a, b) => b.totalScore - a.totalScore);
              candidates.length = maxBuilds;
              minCandidateScore = Math.max(
                minCandidateScore,
                candidates[candidates.length - 1].totalScore
              );
            }
          }
        }
      }
    }

    // Yield after each flower slice to unblock the event loop.
    yield pruningResult;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Final sort & trim
  candidates.sort((a, b) => b.totalScore - a.totalScore);
  if (candidates.length > maxBuilds) candidates.length = maxBuilds;

  // Score-relative cutoff: discard candidates scoring below 1/3 of the best.
  // Only applied when the best score is positive to avoid mishandling edge cases.
  if (candidates.length > 1 && candidates[0].totalScore > 0) {
    const threshold = candidates[0].totalScore / 3;
    const cutoffIdx = candidates.findIndex((c) => c.totalScore < threshold);
    if (cutoffIdx > 0) candidates.length = cutoffIdx;
  }

  // ── Phase 2: Evaluate damage on top candidates (expensive) ──

  const combinationsTotal = candidates.length;
  let combinationsEvaluated = 0;
  let bestDamage = -1;
  let bestDamageResult: DamageResult | null = null;
  let bestArtifacts: Record<Slot, ArtifactData | null> = {
    flower: null,
    plume: null,
    sands: null,
    goblet: null,
    circlet: null,
  };

  const getResult = (done = false): OptimizationResult => ({
    bestDamage,
    bestDamageResult,
    bestArtifacts: { ...bestArtifacts },
    phase: "evaluating",
    progress:
      combinationsTotal > 0 ? combinationsEvaluated / combinationsTotal : 1,
    combinationsEvaluated,
    combinationsTotal,
    startTime,
    endTime: done ? Date.now() : null,
    done,
  });

  const CHUNK_SIZE = 200;
  let chunkCount = 0;

  for (const cand of candidates) {
    combinationsEvaluated++;
    chunkCount++;

    const charSheet = StatSheet.fromArtifacts(cand.pieces);

    const updatedSheets = {
      ...baseSheets,
      [swapCharId]: charSheet,
    };
    const postStats = teamBuild.getTeamStats(updatedSheets, calcTargetId);

    const er = postStats[erCheckCharId]?.get("er") ?? 0;
    if (er >= targetEr) {
      const dmgRes = teamBuild.getDamageResult(
        formulaCharId,
        formulaId,
        postStats,
        calcContext
      );

      if (dmgRes && dmgRes.totalDamage > bestDamage) {
        bestDamage = dmgRes.totalDamage;
        bestDamageResult = dmgRes;
        bestArtifacts = {
          flower: cand.pieces[0],
          plume: cand.pieces[1],
          sands: cand.pieces[2],
          goblet: cand.pieces[3],
          circlet: cand.pieces[4],
        };
      }
    }

    // Yield control back to UI
    if (chunkCount >= CHUNK_SIZE) {
      chunkCount = 0;
      yield getResult(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  yield getResult(true);
}
