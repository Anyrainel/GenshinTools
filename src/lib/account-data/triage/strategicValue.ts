/**
 * Strategic value pass for high-level artifacts.
 *
 * When `highLevelProtection` is disabled, artifacts at or above
 * `levelProtection` that fail normal triage are re-evaluated by a list of
 * rules. If any rule fires, the artifact is kept with a reason code.
 *
 * This module is intentionally small and pluggable: the rule list can grow
 * without restructuring callers.
 */

import type { ArtifactData, Rarity, SubStat } from "@/data/types";
import { getAllSubstats } from "@/lib/account-data/artifactProjection";
import { getSubstatAvgRoll } from "@/lib/artifact/scoring/utils";

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

// Concentrated-stat rule

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

/** Minimum upgrade rolls (total rolls minus initial one-per-substat) required
 * for the rule to consider firing. We don't evaluate artifacts that have
 * barely been upgraded — the concentration signal needs to come from real
 * upgrade decisions, not from the initial substat assignment. */
const MIN_UPGRADE_ROLLS = 3;

/** Fraction of upgrade rolls that must fall into a single category. Each
 * substat contributes one "initial" roll regardless of allocation, so we
 * subtract those before computing concentration — otherwise a 4-sub artifact
 * maxes out around 66% even in the most extreme CR/CD-stacked case. */
const CONCENTRATION_THRESHOLD = 0.6;

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

/** Concentrated-stat rule: fires if ≥60% of upgrade rolls landed in one
 * category. Upgrade rolls = total rolls − number of distinct substats. */
export const concentratedStatRule: StrategicRule = (artifact) => {
  const { total, perStat } = rollCountsByStat(artifact);
  const numSubs = Object.values(perStat).filter((n) => (n ?? 0) > 0).length;
  const upgradeTotal = Math.max(0, total - numSubs);
  if (upgradeTotal < MIN_UPGRADE_ROLLS) return { kept: false };

  for (const { reason, stats } of CATEGORIES) {
    let sum = 0;
    for (const s of stats) {
      const n = perStat[s] ?? 0;
      if (n > 0) sum += n - 1; // strip the initial roll
    }
    if (sum / upgradeTotal >= CONCENTRATION_THRESHOLD) {
      return { kept: true, reason };
    }
  }
  return { kept: false };
};

// Rule registry + public runner

const RULES: StrategicRule[] = [concentratedStatRule];

/** Run all strategic rules; return first match or not-kept. */
export function runStrategicRules(artifact: ArtifactData): StrategicRuleResult {
  for (const rule of RULES) {
    const result = rule(artifact);
    if (result.kept) return result;
  }
  return { kept: false };
}
