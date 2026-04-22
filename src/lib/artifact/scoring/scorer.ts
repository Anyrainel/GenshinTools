/**
 * Normalized Artifact Scorer
 *
 * Scores artifacts on a 0-300 scale using:
 * - Main stat scoring (sands/goblet/circlet)
 * - Substat scoring (CD-equivalent formula)
 * - Normalization to 300-point scale
 */

import type {
  ArtifactData,
  Build,
  MainStat,
  MainStatSlot,
  Slot,
  SubStat,
  WeightedMainStat,
} from "@/data/types";
import { allSlots, mainStatSlots } from "@/data/types";
import {
  MAIN_STAT_CD_EQUIV_4STAR,
  MAIN_STAT_CD_EQUIV_5STAR,
  SUBSTAT_COEFFICIENTS,
  computeCrDeduction,
  getMainStatValue,
} from "./utils";

// ─── Score Result Types ───

export type SlotScore = {
  mainStatScore: number;
  substatScore: number;
  totalScore: number;
  mainStatCorrect: boolean;
};

export type ScoreResult = {
  /** Total score out of 300 */
  totalScore: number;
  /** Per-slot breakdown */
  slots: Record<Slot, SlotScore | null>;
  /** Main stat score subtotal (before normalization) */
  rawMainStatScore: number;
  /** Substat score subtotal (before normalization) */
  rawSubstatScore: number;
  /** Raw total (before normalization) */
  rawTotal: number;
  /** The normalizer applied (300 / idealScore) */
  normalizer: number;
  /** Number of equipped artifacts */
  equippedCount: number;
  /** How many main stats are correct (0-3 for sands/goblet/circlet) */
  mainStatMatches: number;
};

/** Map slot name → the corresponding Weights field on Build */
const SLOT_TO_WEIGHTS: Record<
  MainStatSlot,
  "sandsWeights" | "gobletWeights" | "circletWeights"
> = {
  sands: "sandsWeights",
  goblet: "gobletWeights",
  circlet: "circletWeights",
};

/**
 * Build a substat weight lookup from Build.substats (WeightedSubStat[]).
 */
function substatWeightMap(build: Build): Record<string, number> {
  const map: Record<string, number> = {};
  for (const { stat, weight } of build.substats) {
    map[stat] = weight;
  }
  return map;
}

/**
 * Score a character's equipped artifacts against a Build.
 */
export function scoreNormalized(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: Build,
  nonArtifactCr?: number
): ScoreResult {
  const weights = substatWeightMap(build);

  const slots: Record<Slot, SlotScore | null> = {
    flower: null,
    plume: null,
    sands: null,
    goblet: null,
    circlet: null,
  };

  let rawMainStatScore = 0;
  let rawSubstatScore = 0;
  let equippedCount = 0;
  let mainStatMatches = 0;

  for (const slot of allSlots) {
    const artifact = artifacts[slot];
    if (!artifact) continue;

    equippedCount++;
    const rarity = artifact.rarity === 4 ? 4 : 5;

    // ─── Substat score ───
    let slotSubScore = 0;
    if (artifact.substats) {
      for (const [key, val] of Object.entries(artifact.substats)) {
        if (val == null) continue;
        const stat = key as SubStat;
        const coeff = SUBSTAT_COEFFICIENTS[stat] ?? 0;
        const w = weights[stat] ?? 0;
        slotSubScore += val * coeff * (w / 100);
      }
    }
    rawSubstatScore += slotSubScore;

    // ─── Main stat score (sands/goblet/circlet only) ───
    let slotMainScore = 0;
    let mainStatCorrect = true;

    if (mainStatSlots.includes(slot as MainStatSlot)) {
      const msSlot = slot as MainStatSlot;
      const mainStatWeights: WeightedMainStat[] =
        build[SLOT_TO_WEIGHTS[msSlot]];
      const equippedMain = artifact.mainStatKey as MainStat;

      const matchedWeight = mainStatWeights.find(
        (w) => w.stat === equippedMain
      );

      if (matchedWeight) {
        const cdEquiv =
          matchedWeight.cdEquiv ??
          (rarity === 4 ? MAIN_STAT_CD_EQUIV_4STAR : MAIN_STAT_CD_EQUIV_5STAR);
        slotMainScore = cdEquiv * (matchedWeight.weight / 100);
        mainStatMatches++;
      } else {
        // Wrong main stat: score using substat coefficient if available
        const asSubstat = equippedMain as SubStat;
        const coeff = SUBSTAT_COEFFICIENTS[asSubstat];
        if (coeff) {
          const mainStatValue = getMainStatValue(equippedMain, rarity);
          const w = weights[asSubstat] ?? 0;
          slotMainScore = mainStatValue * coeff * (w / 100);
        }
        mainStatCorrect = false;
      }

      rawMainStatScore += slotMainScore;
    }

    slots[slot] = {
      mainStatScore: slotMainScore * build.normalizer,
      substatScore: slotSubScore * build.normalizer,
      totalScore: (slotMainScore + slotSubScore) * build.normalizer,
      mainStatCorrect,
    };
  }

  // CR clamp: deduct substat score contribution of CR exceeding the budget
  if (nonArtifactCr != null) {
    const crWeight = weights.cr ?? 0;
    if (crWeight > 0) {
      let totalArtifactCr = 0;
      for (const slot of allSlots) {
        const artifact = artifacts[slot];
        if (!artifact) continue;
        if (artifact.substats) {
          const crVal = artifact.substats.cr;
          if (crVal != null) totalArtifactCr += crVal / 100;
        }
        if (
          mainStatSlots.includes(slot as MainStatSlot) &&
          artifact.mainStatKey === "cr"
        ) {
          const rarity = artifact.rarity === 4 ? 4 : 5;
          totalArtifactCr += getMainStatValue("cr", rarity) / 100;
        }
      }
      rawSubstatScore -= computeCrDeduction(
        totalArtifactCr,
        nonArtifactCr,
        crWeight
      );
    }
  }

  const rawTotal = rawMainStatScore + rawSubstatScore;
  const totalScore = rawTotal * build.normalizer;

  return {
    totalScore,
    slots,
    rawMainStatScore,
    rawSubstatScore,
    rawTotal,
    normalizer: build.normalizer,
    equippedCount,
    mainStatMatches,
  };
}
