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
import { solveArtifactRollCounts } from "@/domain/build/artifact/solver";
import type { SubStat } from "@/domain/enums";
import type { ArtifactData } from "@/domain/models";

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
 * A category is a group of substats whose rolls we want to sum together when
 * judging concentration. Crit combines CR + CD; everything else is a single
 * substat.
 */
const CATEGORIES: { reason: ConcentrationValueReason; stats: SubStat[] }[] = [
  { reason: "concentrated-crit", stats: ["cr", "cd"] },
  { reason: "concentrated-er", stats: ["er"] },
  { reason: "concentrated-em", stats: ["em"] },
  { reason: "concentrated-atk%", stats: ["atk%"] },
  { reason: "concentrated-hp%", stats: ["hp%"] },
  { reason: "concentrated-def%", stats: ["def%"] },
];

/** Share of actual upgrades that must land in a single category. */
const CONCENTRATION_THRESHOLD = 0.5;

function estimateUpgrades(
  artifact: ArtifactData,
  stat: SubStat,
  rarity: 4 | 5
): number {
  const avg = getSubstatAvgRoll(stat, rarity);
  if (!Number.isFinite(avg) || avg <= 0) return 0;
  const value = artifact.substats[stat]!;
  const initial = artifact.initialValues?.[stat] ?? avg;
  return Math.max(0, (value - initial) / avg);
}

/** Concentrated-stat rule: fires if ≥50% of upgrade rolls landed in one
 * category. Upgrade rolls = total rolls − number of distinct substats. */
export const concentratedStatRule: ConcentrationValueRule = (artifact) => {
  const rarity = artifact.rarity === 4 ? 4 : 5;
  const stats = Object.keys(artifact.substats) as SubStat[];
  const known = artifact.substatRollCounts;
  const completeCounts =
    known && stats.every((stat) => known[stat] !== undefined);
  const counts = completeCounts
    ? known
    : solveArtifactRollCounts({ ...artifact, rarity }, known);
  const upgrades: Partial<Record<SubStat, number>> = {};
  let inferredTotal = 0;
  for (const stat of stats) {
    const count = counts?.[stat] ?? known?.[stat];
    // Only legacy values that fail discrete roll reconstruction need an estimate.
    const upgradeCount =
      count !== undefined
        ? count - 1
        : estimateUpgrades(artifact, stat, rarity);
    upgrades[stat] = upgradeCount;
    inferredTotal += upgradeCount;
  }
  // totalRolls excludes the pending fourth substat in GOOD v3.
  const upgradeTotal =
    !completeCounts && artifact.totalRolls !== undefined
      ? artifact.totalRolls - stats.length
      : inferredTotal;
  if (upgradeTotal < (rarity === 4 ? 2 : 3)) return { kept: false };

  for (const { reason, stats } of CATEGORIES) {
    const sum = stats.reduce((n, stat) => n + (upgrades[stat] ?? 0), 0);
    if (sum / upgradeTotal >= CONCENTRATION_THRESHOLD) {
      return { kept: true, reason };
    }
  }
  return { kept: false };
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
