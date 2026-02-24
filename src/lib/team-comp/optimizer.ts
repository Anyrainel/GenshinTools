import { artifactIdToHalfSetId } from "@/data/constants";
import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import {
  type BuildMatchResult,
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

  topN?: number; // Heuristic prune count per slot (default 50)

  artifactSetId?: string | null;
  artifactHalfSetIds?: string[];
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
  // scoreMainStat uses w=1 (fully recommended); callers are responsible for
  // only invoking this for recommended main stats.
  const recommended = getTargetMainStatsForSlot(art.slotKey, buildMatch.build);
  if (recommended.has(art.mainStatKey)) {
    score += scoreMainStat(art.mainStatKey, art.rarity, globalConfig);
  }

  return score;
}

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
  } = opts;

  const topN = opts.topN || 50;
  const startTime = Date.now();

  // Prune & group artifacts by slot
  const slotPools: Record<Slot, ArtifactData[]> = {
    flower: [],
    plume: [],
    sands: [],
    goblet: [],
    circlet: [],
  };

  for (const slot of allSlots) {
    const slotArts = inventory.filter((a) => a.slotKey === slot);

    // Apply strict set filtering if 4pc is required
    // If it's 2pc+2pc, we can't filter here as easily because any 2 sets are fine.
    // However, if we know 4pc is required, we can just enforce it strictly *or* leave 1 off-piece slot.
    // For simplicity, let's just use topN heuristics and check combinations later.
    // But we MUST make sure pieces matching the set are prioritized if we only take topN!
    // If we only take topN, we might discard the only 4pc piece! Let's score sets artificially higher?
    // Actually, simple solution for now: sort unconditionally.
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
      return { art, score };
    });

    withScore.sort((a, b) => b.score - a.score);
    slotPools[slot] = withScore.slice(0, Math.max(topN, 1)).map((x) => x.art);

    if (slotPools[slot].length === 0) {
      // Dummy to prevent 0 combinations
      slotPools[slot] = [
        {
          id: "dummy",
          setKey: "empty",
          slotKey: slot,
          rarity: 1,
          mainStatKey: "hp%",
          level: 0,
          lock: false,
          substats: {},
        },
      ];
    }
  }

  const combinationsTotal =
    slotPools.flower.length *
    slotPools.plume.length *
    slotPools.sands.length *
    slotPools.goblet.length *
    slotPools.circlet.length;

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
    progress: combinationsEvaluated / combinationsTotal,
    combinationsEvaluated,
    combinationsTotal,
    startTime,
    endTime: done ? Date.now() : null,
    done,
  });

  const CHUNK_SIZE = 5000;
  let chunkCount = 0;

  for (const f of slotPools.flower) {
    for (const p of slotPools.plume) {
      for (const s of slotPools.sands) {
        for (const g of slotPools.goblet) {
          for (const c of slotPools.circlet) {
            combinationsEvaluated++;
            chunkCount++;

            const piecesRec: Record<Slot, ArtifactData> = {
              flower: f,
              plume: p,
              sands: s,
              goblet: g,
              circlet: c,
            };

            // 1. Check Set Requirements
            let matchesSet = true;
            if (artifactSetId) {
              let count = 0;
              for (const slot of allSlots) {
                if (piecesRec[slot].setKey === artifactSetId) count++;
              }
              if (count < 4) matchesSet = false;
            }

            if (
              matchesSet &&
              artifactHalfSetIds &&
              artifactHalfSetIds.length === 2
            ) {
              const halfSetCounts = new Map<string, number>();
              for (const slot of allSlots) {
                const setKey = piecesRec[slot].setKey;
                const halfSetId = artifactIdToHalfSetId[setKey];
                if (halfSetId != null) {
                  halfSetCounts.set(
                    halfSetId,
                    (halfSetCounts.get(halfSetId) ?? 0) + 1
                  );
                }
              }
              const [h1, h2] = artifactHalfSetIds;
              const c1 = halfSetCounts.get(h1) ?? 0;
              const c2 = halfSetCounts.get(h2) ?? 0;
              if (h1 === h2) {
                if (c1 < 4) matchesSet = false;
              } else {
                if (c1 < 2 || c2 < 2) matchesSet = false;
              }
            }

            if (matchesSet) {
              // 2. Compute Sheet & ER Constraint
              const piecesArray = [f, p, s, g, c];
              const charSheet = StatSheet.fromArtifacts(piecesArray);

              const updatedSheets = {
                ...baseSheets,
                [targetCharId]: charSheet,
              };
              const postStats = teamBuild.getTeamStats(
                updatedSheets,
                targetCharId
              );

              // team metas stat sheet gives ER as a unified value (1.0 = 100%)
              const er = postStats[targetCharId]?.get("er") ?? 0;
              if (er >= targetEr) {
                // 3. Evaluate Damage Formula
                const dmgRes = teamBuild.getDamageResult(
                  targetCharId,
                  formulaId,
                  postStats,
                  calcContext
                );

                if (dmgRes && dmgRes.totalDamage > bestDamage) {
                  bestDamage = dmgRes.totalDamage;
                  bestDamageResult = dmgRes;
                  bestArtifacts = { ...piecesRec };
                }
              }
            }

            // Yield control back to UI
            if (chunkCount >= CHUNK_SIZE) {
              chunkCount = 0;
              yield getResult(false);
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
        }
      }
    }
  }

  yield getResult(true);
}
