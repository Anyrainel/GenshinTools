import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import type { BuildMatchResult } from "../account-data/artifactScore";
import type { TeamBuild } from "./damageCalc";
import { StatSheet } from "./damageModels";
import {
  type OptimizationResult,
  type OptimizerOptions,
  runOptimization,
} from "./optimizer";
import type { CalcContext, DamageResult } from "./types";

// ─── Types ───

export type TeamOptPassId = "carry-1" | "support" | "carry-2";

export interface TeamOptPassResult {
  passId: TeamOptPassId;
  charId: string;
  bestDamage: number;
  bestArtifacts: Record<Slot, ArtifactData | null>;
}

export interface TeamOptimizationProgress {
  currentPass: TeamOptPassId;
  currentPassCharId: string;
  passIndex: number;
  totalPasses: number;
  passPhase: "pruning" | "evaluating";
  passProgress: number; // 0–1 within current pass
  overallProgress: number; // 0–1 across all passes
  passResults: TeamOptPassResult[];
  done: false;
}

export interface TeamOptimizationResult {
  bestDamage: number;
  bestDamageResult: DamageResult | null;
  bestArtifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  passResults: TeamOptPassResult[];
  done: true;
}

export type TeamOptYield = TeamOptimizationProgress | TeamOptimizationResult;

export interface PerCharConfig {
  targetEr: number;
  buildMatch: BuildMatchResult;
  artifactSetId?: string | null;
  artifactHalfSetIds?: string[];
}

export interface TeamOptimizerOptions {
  teamBuild: TeamBuild;
  carryCharId: string;
  formulaId: string;
  inventory: ArtifactData[];
  calcContext: CalcContext;
  globalConfig: GlobalStatWeights;
  baseSheets: Record<string, StatSheet>;
  topN?: number;
  /** Per-character optimizer config (keyed by charId) */
  perChar: Record<string, PerCharConfig>;
}

// ─── Helpers ───

function collectArtifactIds(arts: Record<Slot, ArtifactData | null>): string[] {
  const ids: string[] = [];
  for (const slot of allSlots) {
    const a = arts[slot];
    if (a && a.id !== "dummy") ids.push(a.id);
  }
  return ids;
}

const emptyArtifacts: Record<Slot, ArtifactData | null> = {
  flower: null,
  plume: null,
  sands: null,
  goblet: null,
  circlet: null,
};

// ─── Multi-Pass Generator ───

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
  } = opts;
  const topN = opts.topN ?? 40;

  // Build pass list: carry-1, supports, carry-2
  const supportCharIds = Object.keys(perChar).filter(
    (id) => id !== carryCharId
  );

  type PassDef = { passId: TeamOptPassId; charId: string };
  const passes: PassDef[] = [{ passId: "carry-1", charId: carryCharId }];
  for (const sid of supportCharIds) {
    // Skip supports with no buildMatch (can't optimize)
    if (!perChar[sid]?.buildMatch) continue;
    passes.push({ passId: "support", charId: sid });
  }
  passes.push({ passId: "carry-2", charId: carryCharId });

  const totalPasses = passes.length;
  const passResults: TeamOptPassResult[] = [];
  const excludedArtifactIds = new Set<string>();
  let currentSheets = { ...baseSheets };
  let carry1Result: TeamOptPassResult | null = null;

  for (let passIdx = 0; passIdx < totalPasses; passIdx++) {
    const { passId, charId } = passes[passIdx];
    const charConfig = perChar[charId];
    if (!charConfig) continue;

    // Before carry-2: unlock carry's pass-1 artifacts
    if (passId === "carry-2" && carry1Result) {
      for (const id of collectArtifactIds(carry1Result.bestArtifacts)) {
        excludedArtifactIds.delete(id);
      }
    }

    const isCarry = charId === carryCharId;

    const passOpts: OptimizerOptions = {
      teamBuild,
      targetCharId: carryCharId,
      formulaId,
      targetEr: charConfig.targetEr,
      inventory,
      buildMatch: charConfig.buildMatch,
      globalConfig,
      baseSheets: currentSheets,
      calcContext,
      topN: isCarry ? topN : Math.min(topN, 20),
      artifactSetId: charConfig.artifactSetId ?? null,
      artifactHalfSetIds: charConfig.artifactHalfSetIds,
      // Multi-pass fields
      swapCharId: charId,
      calcTargetId: carryCharId,
      formulaCharId: carryCharId,
      erCheckCharId: isCarry ? carryCharId : charId,
      excludedArtifactIds:
        excludedArtifactIds.size > 0 ? new Set(excludedArtifactIds) : undefined,
    };

    const gen = runOptimization(passOpts);

    let lastResult: OptimizationResult | null = null;
    for await (const res of gen) {
      lastResult = res;

      // Yield progress
      const passWeight = 1 / totalPasses;
      const overallProgress = passIdx * passWeight + res.progress * passWeight;

      yield {
        currentPass: passId,
        currentPassCharId: charId,
        passIndex: passIdx,
        totalPasses,
        passPhase: res.phase,
        passProgress: res.progress,
        overallProgress,
        passResults: [...passResults],
        done: false,
      } satisfies TeamOptimizationProgress;
    }

    // Pass completed — lock artifacts and update sheets
    if (lastResult) {
      const passResult: TeamOptPassResult = {
        passId,
        charId,
        bestDamage: lastResult.bestDamage,
        bestArtifacts: lastResult.bestArtifacts,
      };

      if (passId === "carry-1") {
        carry1Result = passResult;
      }

      passResults.push(passResult);

      // Lock assigned artifacts
      for (const id of collectArtifactIds(lastResult.bestArtifacts)) {
        excludedArtifactIds.add(id);
      }

      // Update sheets with the pass result
      const piecesArray = allSlots
        .map((s) => lastResult!.bestArtifacts[s])
        .filter((a): a is ArtifactData => a != null);
      currentSheets = {
        ...currentSheets,
        [charId]: StatSheet.fromArtifacts(piecesArray),
      };
    }
  }

  // Build final artifact map
  const bestArtifactsByChar: Record<
    string,
    Record<Slot, ArtifactData | null>
  > = {};

  // Start with empty artifacts for all characters in perChar
  for (const charId of Object.keys(perChar)) {
    bestArtifactsByChar[charId] = { ...emptyArtifacts };
  }

  // Apply results from each pass (last pass per character wins)
  for (const pr of passResults) {
    bestArtifactsByChar[pr.charId] = pr.bestArtifacts;
  }

  // Compute final carry damage with the finalized artifacts
  const finalSheets: Record<string, StatSheet> = { ...baseSheets };
  for (const [charId, arts] of Object.entries(bestArtifactsByChar)) {
    const pieces = allSlots
      .map((s) => arts[s])
      .filter((a): a is ArtifactData => a != null);
    finalSheets[charId] = StatSheet.fromArtifacts(pieces);
  }
  const finalPostStats = teamBuild.getTeamStats(finalSheets, carryCharId);
  const finalDmg = teamBuild.getDamageResult(
    carryCharId,
    formulaId,
    finalPostStats,
    calcContext
  );

  yield {
    bestDamage: finalDmg.totalDamage,
    bestDamageResult: finalDmg,
    bestArtifactsByChar,
    passResults,
    done: true,
  } satisfies TeamOptimizationResult;
}
