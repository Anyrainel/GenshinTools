import type { LuckExpectation, Rarity, SubStat } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import {
  getSubstatAvgRoll,
  getSubstatRollTiers,
} from "../artifact/scoring/utils";

export const MAX_LEVEL_BY_RARITY: Record<Rarity, number> = {
  5: 20,
  4: 16,
  3: 12,
  2: 8,
  1: 4,
};

/**
 * Get the expected roll value for a substat based on quality expectation.
 * - "cautious" → tier 2 (2nd lowest of 4 tiers)
 * - "balanced" → exact average of all 4 tiers (default)
 * - "hopeful"  → tier 3 (2nd highest of 4 tiers)
 */
export function getExpectedRollValue(
  stat: SubStat,
  rarity: Rarity,
  quality: LuckExpectation = "balanced"
): number {
  const r = rarity === 4 || rarity === 5 ? rarity : 5;
  if (quality === "balanced") {
    return getSubstatAvgRoll(stat, r as 4 | 5);
  }
  const tiers = getSubstatRollTiers(stat, r as 4 | 5);
  // cautious = tier index 1, hopeful = tier index 2
  return tiers[quality === "cautious" ? 1 : 2];
}

/** Combines activated and unactivated substats into a deduplicated list. */
export function getAllSubstats(artifact: ArtifactData): SubStat[] {
  const substats = Object.keys(artifact.substats || {}) as SubStat[];
  const unactivated = Object.keys(
    artifact.unactivatedSubstats || {}
  ) as SubStat[];
  return Array.from(new Set([...substats, ...unactivated]));
}
