/**
 * V2 Artifact Scorer
 *
 * Scores artifacts on a 0-300 scale using:
 * - Main stat scoring (sands/goblet/circlet)
 * - Substat scoring (same CD-equivalent formula as V1)
 * - Normalization to 300-point scale
 */

import type {
  ArtifactData,
  MainStat,
  MainStatSlot,
  Slot,
  SubStat,
} from "@/data/types";
import { allSlots, mainStatSlots } from "@/data/types";
import type { BuildV2Weights, MainStatWeight } from "./types";
import {
  MAIN_STAT_CD_EQUIV_4STAR,
  MAIN_STAT_CD_EQUIV_5STAR,
  SUBSTAT_COEFFICIENTS,
} from "./types";

// ─── Score Result Types ───

export type V2SlotScore = {
  mainStatScore: number;
  substatScore: number;
  totalScore: number;
  mainStatCorrect: boolean;
};

export type V2ScoreResult = {
  /** Total score out of 300 */
  totalScore: number;
  /** Per-slot breakdown */
  slots: Record<Slot, V2SlotScore | null>;
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

/**
 * Score a character's equipped artifacts using V2 weights.
 */
export function scoreV2(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: BuildV2Weights
): V2ScoreResult {
  const slots: Record<Slot, V2SlotScore | null> = {
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
        const weight = build.substats[stat] ?? 0;
        slotSubScore += val * coeff * (weight / 100);
      }
    }
    rawSubstatScore += slotSubScore;

    // ─── Main stat score (sands/goblet/circlet only) ───
    let slotMainScore = 0;
    let mainStatCorrect = true;

    if (mainStatSlots.includes(slot as MainStatSlot)) {
      const mainStatSlot = slot as MainStatSlot;
      const mainStatWeights = build[mainStatSlot] as MainStatWeight[];
      const equippedMain = artifact.mainStatKey as MainStat;

      // Find if this main stat is in the recommended list
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
        // Wrong main stat: score it at reduced value
        // Use the substat coefficient if available, otherwise 0
        const asSubstat = equippedMain as SubStat;
        const coeff = SUBSTAT_COEFFICIENTS[asSubstat];
        if (coeff) {
          // Score the main stat value as a substat equivalent
          const mainStatValue = getMainStatValue(equippedMain, rarity);
          const weight = build.substats[asSubstat] ?? 0;
          slotMainScore = mainStatValue * coeff * (weight / 100);
        }
        // Elemental/Physical DMG% that isn't recommended: score 0
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

/**
 * Get the Lv.20 value of a main stat for scoring purposes.
 */
function getMainStatValue(stat: MainStat, rarity: number): number {
  const values5: Record<string, number> = {
    hp: 4780,
    atk: 311,
    "hp%": 46.6,
    "atk%": 46.6,
    "def%": 58.3,
    em: 186.5,
    er: 51.8,
    cr: 31.1,
    cd: 62.2,
  };

  const values4: Record<string, number> = {
    hp: 3571,
    atk: 232,
    "hp%": 34.8,
    "atk%": 34.8,
    "def%": 43.5,
    em: 139.3,
    er: 38.7,
    cr: 23.2,
    cd: 46.4,
  };

  const table = rarity === 4 ? values4 : values5;
  return table[stat] ?? 0;
}

/**
 * Score interpretation helper.
 */
export function getScoreTier(score: number): { label: string; tier: string } {
  if (score >= 270) return { label: "Exceptional", tier: "S" };
  if (score >= 240) return { label: "Very Strong", tier: "A" };
  if (score >= 200) return { label: "Solid", tier: "B" };
  if (score >= 160) return { label: "Decent", tier: "C" };
  if (score >= 120) return { label: "Needs Work", tier: "D" };
  return { label: "Unbuilt", tier: "F" };
}
