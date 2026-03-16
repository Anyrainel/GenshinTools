import type { SubStat } from "@/data/types";
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
  hasCrCd: boolean;
  hasFill: boolean;
  matchedCondition: TierCondition | null;
};

export function evaluateTier(
  artifactSubs: SubStat[],
  is4L: boolean,
  rule: TriageRule
): TierResult {
  const hitCount = countHits(artifactSubs, rule.desired);
  const hitOptional = countHits(artifactSubs, rule.optional);
  const hasCrCd = artifactSubs.includes("cr") && artifactSubs.includes("cd");
  const hasFill =
    hitCount === rule.tierEntry.subN &&
    rule.fillers.some((f) => artifactSubs.includes(f));
  const hitTotal = hitCount + hitOptional + (hasFill ? 1 : 0);

  for (const cond of rule.tierEntry.conditions) {
    if (hitCount < cond.k) continue;
    if (cond.crcd && !hasCrCd) continue;
    if (cond.is4L && !is4L) continue;
    if (cond.fill && !hasFill) continue;
    return {
      tier: cond.tier,
      hitCount,
      hitOptional,
      hitTotal,
      hasCrCd,
      hasFill,
      matchedCondition: cond,
    };
  }
  return {
    tier: "T",
    hitCount,
    hitOptional,
    hitTotal,
    hasCrCd,
    hasFill,
    matchedCondition: null,
  };
}
