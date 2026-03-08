import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import type { BuildMatchResult } from "../account-data/artifactScore";
import type { TeamBuild } from "./damageCalc";
import { evaluateCombo } from "./damageCalc";
import { StatSheet } from "./damageModels";
import {
  type OptimizationResult,
  type OptimizerOptions,
  runOptimization,
} from "./optimizer";
import type {
  CalcContext,
  ComboFormula,
  ComboResult,
  DamageResult,
  ReactionOverride,
} from "./types";

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

interface TeamOptResultBase {
  bestDamage: number;
  bestArtifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  passResults: TeamOptPassResult[];
  done: true;
}

export interface TeamOptSingleResult extends TeamOptResultBase {
  mode: "single";
  bestDamageResult: DamageResult;
}

export interface TeamOptComboResult extends TeamOptResultBase {
  mode: "combo";
  bestComboResult: ComboResult;
}

export type TeamOptimizationResult = TeamOptSingleResult | TeamOptComboResult;

export type TeamOptYield = TeamOptimizationProgress | TeamOptimizationResult;

export interface PerCharConfig {
  targetEr: number;
  buildMatch?: BuildMatchResult | null;
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
  /** Per-character optimizer config (keyed by charId) */
  perChar: Record<string, PerCharConfig>;
  reactionOverride?: ReactionOverride;
  altCount?: number; // Alternatives per slot in hill-climbing (default 7, use 5 on mobile)
  /** Combo mode: optimize for total combo damage instead of single formula. */
  combo?: ComboFormula;
  /** Per-formula reaction overrides (keyed by "charId.formulaId"), used by combo evaluation. */
  reactionOverrides?: Record<string, ReactionOverride>;
}

// ─── Helpers ───

function collectArtifactIds(arts: Record<Slot, ArtifactData | null>): string[] {
  const ids: string[] = [];
  for (const slot of allSlots) {
    const a = arts[slot];
    if (a) ids.push(a.id);
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
    reactionOverride,
    combo,
    reactionOverrides,
  } = opts;

  const isComboMode =
    combo != null && combo.lines.filter((l) => l.count > 0).length > 0;

  // Build combo scoreFn if in combo mode
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
        } catch {
          return 0;
        }
      }
    : undefined;

  // Build pass list
  // Combo mode: all characters with combo lines are carries → supports → carries again
  // Single mode: carry-1 → supports → carry-2
  type PassDef = { passId: TeamOptPassId; charId: string };
  const passes: PassDef[] = [];

  if (isComboMode) {
    const comboCharIds = new Set(
      combo.lines.filter((l) => l.count > 0).map((l) => l.charId)
    );
    const carryCharIds = Object.keys(perChar).filter((id) =>
      comboCharIds.has(id)
    );
    const supportCharIds = Object.keys(perChar).filter(
      (id) => !comboCharIds.has(id)
    );

    // All carries first pass
    for (const cid of carryCharIds) {
      passes.push({ passId: "carry-1", charId: cid });
    }
    // Supports
    for (const sid of supportCharIds) {
      passes.push({ passId: "support", charId: sid });
    }
    // All carries second pass
    for (const cid of carryCharIds) {
      passes.push({ passId: "carry-2", charId: cid });
    }
  } else {
    const supportCharIds = Object.keys(perChar).filter(
      (id) => id !== carryCharId
    );
    passes.push({ passId: "carry-1", charId: carryCharId });
    for (const sid of supportCharIds) {
      passes.push({ passId: "support", charId: sid });
    }
    passes.push({ passId: "carry-2", charId: carryCharId });
  }

  const totalPasses = passes.length;
  const passResults: TeamOptPassResult[] = [];
  const excludedArtifactIds = new Set<string>();
  let currentSheets = { ...baseSheets };
  // Track carry-1 results for unlocking before carry-2
  const carry1Results = new Map<string, TeamOptPassResult>();

  for (let passIdx = 0; passIdx < totalPasses; passIdx++) {
    const { passId, charId } = passes[passIdx];
    const charConfig = perChar[charId];
    if (!charConfig) continue;

    // Before carry-2: unlock this character's carry-1 artifacts
    if (passId === "carry-2") {
      const prev = carry1Results.get(charId);
      if (prev) {
        for (const id of collectArtifactIds(prev.bestArtifacts)) {
          excludedArtifactIds.delete(id);
        }
      }
    }

    const isCarry = passId !== "support";

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
      artifactSetId: charConfig.artifactSetId ?? null,
      artifactHalfSetIds: charConfig.artifactHalfSetIds,
      // Multi-pass fields
      swapCharId: charId,
      calcTargetId: carryCharId,
      formulaCharId: carryCharId,
      erCheckCharId: isCarry ? charId : charId,
      excludedArtifactIds:
        excludedArtifactIds.size > 0 ? new Set(excludedArtifactIds) : undefined,
      reactionOverride,
      altCount: opts.altCount,
      scoreFn: comboScoreFn,
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
        carry1Results.set(charId, passResult);
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

  // Compute final damage with the finalized artifacts
  const finalSheets: Record<string, StatSheet> = { ...baseSheets };
  for (const [charId, arts] of Object.entries(bestArtifactsByChar)) {
    const pieces = allSlots
      .map((s) => arts[s])
      .filter((a): a is ArtifactData => a != null);
    finalSheets[charId] = StatSheet.fromArtifacts(pieces);
  }

  const resultBase = { bestArtifactsByChar, passResults, done: true as const };

  if (isComboMode) {
    const comboRes = evaluateCombo(
      teamBuild,
      combo,
      finalSheets,
      calcContext,
      reactionOverrides
    );
    yield {
      ...resultBase,
      mode: "combo",
      bestDamage: comboRes.totalDamage,
      bestComboResult: comboRes,
    } satisfies TeamOptComboResult;
  } else {
    const finalPostStats = teamBuild.getTeamStats(
      finalSheets,
      carryCharId,
      calcContext
    );
    const finalDmg = teamBuild.getDamageResult(
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
