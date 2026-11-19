/**
 * Concentration value pass for high-level artifacts.
 *
 * When `highLevelProtection` is disabled, artifacts at or above
 * `levelProtection` that fail normal triage are re-evaluated by a list of
 * rules. If any rule fires, the artifact is kept with a reason code.
 *
 * This module is intentionally small and pluggable: the rule list can grow
 * without restructuring callers.
 */

import { getSubstatAvgRoll } from "@/domain/build/artifact/scoring/utils";
import type { SubStat } from "@/domain/enums";
import { MAX_LEVEL_BY_RARITY } from "@/domain/game-account/artifactProjection";
import type { ArtifactData } from "@/domain/models";
import { combinations, pDrawSet, SUB_WEIGHTS } from "./tierMath";

export type ConcentrationValueRuleResult =
  | { kept: true; reason: ConcentrationValueReason }
  | { kept: false };

export type ConcentrationValueReason =
  | "concentrated-crit"
  | "concentrated-er"
  | "concentrated-em"
  | "concentrated-atk%"
  | "concentrated-hp%"
  | "concentrated-def%";

export type ConcentrationValueRule = (
  artifact: ArtifactData
) => ConcentrationValueRuleResult;

// Concentrated-stat rule

/**
 * CR and CD contribute to the same category, each in its own average-roll units.
 */
const CATEGORIES: { reason: ConcentrationValueReason; stats: SubStat[] }[] = [
  { reason: "concentrated-crit", stats: ["cr", "cd"] },
  { reason: "concentrated-er", stats: ["er"] },
  { reason: "concentrated-em", stats: ["em"] },
  { reason: "concentrated-atk%", stats: ["atk%"] },
  { reason: "concentrated-hp%", stats: ["hp%"] },
  { reason: "concentrated-def%", stats: ["def%"] },
];

const SUBSTATS = Object.keys(SUB_WEIGHTS) as SubStat[];

/** Expected final substat values in units of one average roll of the same rarity. */
function projectedRolls(artifact: ArtifactData, rarity: 4 | 5) {
  const rolls = new Map<SubStat, number>();
  for (const stat of SUBSTATS) {
    const value = artifact.substats[stat];
    if (value != null && value > 0) {
      rolls.set(stat, value / getSubstatAvgRoll(stat, rarity));
    }
  }

  let remaining =
    MAX_LEVEL_BY_RARITY[rarity] / 4 - Math.floor(artifact.level / 4);
  if (remaining <= 0) return rolls;
  for (const [stat, value] of Object.entries(
    artifact.unactivatedSubstats ?? {}
  ) as [SubStat, number][]) {
    if (remaining === 0 || rolls.size >= 4) break;
    if (
      rolls.has(stat) ||
      stat === artifact.mainStatKey ||
      !Object.hasOwn(SUB_WEIGHTS, stat)
    )
      continue;
    rolls.set(stat, value > 0 ? value / getSubstatAvgRoll(stat, rarity) : 1);
    remaining--;
  }

  const draws = Math.min(remaining, Math.max(0, 4 - rolls.size));
  const expectedUpgradesPerLine = (remaining - draws) / 4;
  for (const [stat, value] of rolls)
    rolls.set(stat, value + expectedUpgradesPerLine);
  if (draws > 0) {
    const candidates = SUBSTATS.filter(
      (stat) => stat !== artifact.mainStatKey && !rolls.has(stat)
    );
    const pool = Object.fromEntries(
      candidates.map((stat) => [stat, SUB_WEIGHTS[stat]])
    );
    for (const drawn of combinations(candidates, draws)) {
      // Each new line gets an initial roll and can receive later upgrades.
      const contribution =
        pDrawSet(pool, drawn) * (1 + expectedUpgradesPerLine);
      for (const stat of drawn)
        rolls.set(stat, (rolls.get(stat) ?? 0) + contribution);
    }
  }
  return rolls;
}

export const concentratedStatRule: ConcentrationValueRule = (artifact) => {
  const rarity = artifact.rarity === 4 ? 4 : 5;
  const rolls = projectedRolls(artifact, rarity);
  const target = rarity === 4 ? 2 : 2.5;
  let bestReason: ConcentrationValueReason | undefined;
  let bestValue = 0;
  for (const { reason, stats } of CATEGORIES) {
    const value = stats.reduce((sum, stat) => sum + (rolls.get(stat) ?? 0), 0);
    if (value > bestValue) {
      bestValue = value;
      bestReason = reason;
    }
  }
  return bestReason && bestValue + 1e-9 >= target
    ? { kept: true, reason: bestReason }
    : { kept: false };
};

// Rule registry + public runner

const RULES: ConcentrationValueRule[] = [concentratedStatRule];

/** Run all concentration rules; return first match or not-kept. */
export function runConcentrationValueRules(
  artifact: ArtifactData
): ConcentrationValueRuleResult {
  for (const rule of RULES) {
    const result = rule(artifact);
    if (result.kept) return result;
  }
  return { kept: false };
}
