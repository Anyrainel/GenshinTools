import type { SubStat } from "@/data/enums";
import { getTier, type TriageMode } from "./tierMath";
import type { QualityTier, TierCondition, TriageRule } from "./types";

function countHits(subs: SubStat[], targets: SubStat[]): number {
  let c = 0;
  for (const s of subs) if (targets.includes(s)) c++;
  return c;
}

export type TierResult = {
  tier: QualityTier;
  hitCount: number;
  hitOptional: number;
  hitTotal: number;
  hasCritPair: boolean;
  hasFill: boolean;
  matchedCondition: TierCondition | null;
};

export function evaluateTier(
  artifactSubs: SubStat[],
  startedWithFourSubstats: boolean,
  rule: TriageRule,
  mode: TriageMode = "strict"
): TierResult {
  const hitCount = countHits(artifactSubs, rule.desired);
  const hitOptional = countHits(artifactSubs, rule.optional);
  const hasCritPair =
    artifactSubs.includes("cr") && artifactSubs.includes("cd");
  const hasFill =
    hitCount === rule.tierEntry.desiredSubstatCount &&
    rule.fillers.some((f) => artifactSubs.includes(f));
  const hitTotal = hitCount + hitOptional + (hasFill ? 1 : 0);

  for (const cond of rule.tierEntry.conditions) {
    if (hitCount < cond.requiredDesiredHits) continue;
    if (cond.requiresCritPair && !hasCritPair) continue;
    if (cond.requiresFourInitialSubstats && !startedWithFourSubstats) continue;
    if (cond.requiresFillerHit && !hasFill) continue;
    const tier = getTier(cond.rarity, rule.slot, mode);
    return {
      tier,
      hitCount,
      hitOptional,
      hitTotal,
      hasCritPair,
      hasFill,
      matchedCondition: cond,
    };
  }
  return {
    tier: "fodder",
    hitCount,
    hitOptional,
    hitTotal,
    hasCritPair,
    hasFill,
    matchedCondition: null,
  };
}
