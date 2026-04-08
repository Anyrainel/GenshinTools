/**
 * Strategic value pass for high-level artifacts.
 *
 * When `strategicHighLevelEvaluation` is enabled, artifacts at or above
 * `levelProtection` that fail normal triage are re-evaluated by a list of
 * rules. If any rule fires, the artifact is kept with a reason code.
 *
 * This module is intentionally small and pluggable: the rule list can grow
 * without restructuring callers.
 */

import type { ArtifactData, Rarity, SubStat } from "@/data/types";
import { getAllSubstats } from "@/lib/account-data/artifactProjection";
import { getSubstatAvgRoll } from "@/lib/account-data/scoring/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StrategicRuleResult =
  | { kept: true; reason: StrategicReason }
  | { kept: false };

export type StrategicReason =
  | "concentrated-crit"
  | "concentrated-er"
  | "concentrated-em"
  | "concentrated-atk%"
  | "concentrated-hp%"
  | "concentrated-def%";

export type StrategicRule = (artifact: ArtifactData) => StrategicRuleResult;

// ---------------------------------------------------------------------------
// Concentrated-stat rule
// ---------------------------------------------------------------------------

/**
 * A category is a group of substats whose rolls we want to sum together when
 * judging concentration. Crit combines CR + CD; everything else is a single
 * substat.
 */
const CATEGORIES: { reason: StrategicReason; stats: SubStat[] }[] = [
  { reason: "concentrated-crit", stats: ["cr", "cd"] },
  { reason: "concentrated-er", stats: ["er"] },
  { reason: "concentrated-em", stats: ["em"] },
  { reason: "concentrated-atk%", stats: ["atk%"] },
  { reason: "concentrated-hp%", stats: ["hp%"] },
  { reason: "concentrated-def%", stats: ["def%"] },
];

/** Minimum total rolls (across all substats) for the rule to consider firing.
 * A freshly-lv8 artifact with 4 starting rolls should not qualify on a single
 * lucky roll; we require enough upgrade signal to be meaningful. */
const MIN_TOTAL_ROLLS = 6;

/** Fraction of total rolls that must fall into a single category. */
const CONCENTRATION_THRESHOLD = 0.7;

/** Convert a substat's accumulated value into an estimated roll count using
 * the average roll value for its rarity. Returns 0 for missing substats. */
function estimateRollCount(
  stat: SubStat,
  value: number | undefined,
  rarity: Rarity
): number {
  if (value == null || value <= 0) return 0;
  const r = (rarity === 4 ? 4 : 5) as 4 | 5;
  const avg = getSubstatAvgRoll(stat, r);
  if (!avg || avg <= 0) return 0;
  return value / avg;
}

/**
 * Returns total estimated rolls and rolls-per-stat for an artifact.
 * Uses combined activated + unactivated substats so pending strongbox rolls
 * and fully-upgraded rolls are counted consistently.
 */
function rollCountsByStat(artifact: ArtifactData): {
  total: number;
  perStat: Partial<Record<SubStat, number>>;
} {
  const subs = getAllSubstats(artifact);
  const perStat: Partial<Record<SubStat, number>> = {};
  let total = 0;
  for (const stat of subs) {
    const activated = artifact.substats?.[stat] ?? 0;
    const pending = artifact.unactivatedSubstats?.[stat] ?? 0;
    const value = activated + pending;
    const count = estimateRollCount(stat, value, artifact.rarity);
    perStat[stat] = count;
    total += count;
  }
  return { total, perStat };
}

/** Concentrated-stat rule: fires if ≥70% of rolls fell into one category. */
export const concentratedStatRule: StrategicRule = (artifact) => {
  const { total, perStat } = rollCountsByStat(artifact);
  if (total < MIN_TOTAL_ROLLS) return { kept: false };

  for (const { reason, stats } of CATEGORIES) {
    let sum = 0;
    for (const s of stats) sum += perStat[s] ?? 0;
    if (sum / total >= CONCENTRATION_THRESHOLD) {
      return { kept: true, reason };
    }
  }
  return { kept: false };
};

// ---------------------------------------------------------------------------
// Rule registry + public runner
// ---------------------------------------------------------------------------

const RULES: StrategicRule[] = [concentratedStatRule];

/** Run all strategic rules; return first match or not-kept. */
export function runStrategicRules(artifact: ArtifactData): StrategicRuleResult {
  for (const rule of RULES) {
    const result = rule(artifact);
    if (result.kept) return result;
  }
  return { kept: false };
}
