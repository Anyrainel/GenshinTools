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

function matchesSetRequirement(
  pieces: readonly ArtifactData[],
  artifactSetId: string | null | undefined,
  artifactHalfSetIds: string[] | undefined
): boolean {
  if (artifactSetId) {
    let count = 0;
    for (const p of pieces) {
      if (p.setKey === artifactSetId) count++;
    }
    if (count < 4) return false;
  }

  if (artifactHalfSetIds && artifactHalfSetIds.length === 2) {
    const halfSetCounts = new Map<string, number>();
    for (const p of pieces) {
      const halfSetId = artifactIdToHalfSetId[p.setKey];
      if (halfSetId != null) {
        halfSetCounts.set(halfSetId, (halfSetCounts.get(halfSetId) ?? 0) + 1);
      }
    }
    const [h1, h2] = artifactHalfSetIds;
    const c1 = halfSetCounts.get(h1) ?? 0;
    const c2 = halfSetCounts.get(h2) ?? 0;
    if (h1 === h2) {
      if (c1 < 4) return false;
    } else {
      if (c1 < 2 || c2 < 2) return false;
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

    const withScore = slotArts.map((art) => {
      let score = scorePiece(art, buildMatch, globalConfig);
      // Boost score if it matches a required set to ensure it's not pruned
      if (artifactSetId && art.setKey === artifactSetId) score += 10000;
      if (
        artifactHalfSetIds &&
        artifactIdToHalfSetId[art.setKey] !== undefined &&
        artifactHalfSetIds.includes(artifactIdToHalfSetId[art.setKey])
      ) {
        score += 10000;
      }
      return { art, score, er: getArtifactEr(art) };
    });

    withScore.sort((a, b) => b.score - a.score);
    scoredPools[slot] = withScore.slice(0, Math.max(topN, 1));

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

  // ── Phase 1: Collect top-K builds by total heuristic score (cheap) ──
  // Set-check + ER pre-filter + sum of 5 pre-computed scores per combination.

  const candidates: Candidate[] = [];
  let minCandidateScore = Number.NEGATIVE_INFINITY;
  const CLEANUP_THRESHOLD = maxBuilds * 2;

  for (const f of scoredPools.flower) {
    for (const p of scoredPools.plume) {
      for (const s of scoredPools.sands) {
        for (const g of scoredPools.goblet) {
          for (const c of scoredPools.circlet) {
            const pieces = [f.art, p.art, s.art, g.art, c.art] as const;

            if (
              !matchesSetRequirement(pieces, artifactSetId, artifactHalfSetIds)
            )
              continue;

            // Cheap ER pre-filter: skip builds that can't meet ER requirement
            if (minArtifactEr > 0) {
              const artifactEr = f.er + p.er + s.er + g.er + c.er;
              if (artifactEr < minArtifactEr) continue;
            }

            const totalScore = f.score + p.score + s.score + g.score + c.score;
            if (
              candidates.length >= maxBuilds &&
              totalScore <= minCandidateScore
            )
              continue;

            candidates.push({
              totalScore,
              pieces: [f.art, p.art, s.art, g.art, c.art],
            });

            // Periodic trim to bound memory
            if (candidates.length >= CLEANUP_THRESHOLD) {
              candidates.sort((a, b) => b.totalScore - a.totalScore);
              candidates.length = maxBuilds;
              minCandidateScore = candidates[candidates.length - 1].totalScore;
            }
          }
        }
      }
    }
  }

  // Final sort & trim
  candidates.sort((a, b) => b.totalScore - a.totalScore);
  if (candidates.length > maxBuilds) candidates.length = maxBuilds;

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
