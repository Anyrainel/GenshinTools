import type { MainStat, SubStat } from "@/data/enums";
import type { DemandSource, TriageDemandGroup, TriageRule } from "./types";

export function makeEmbryoKey(
  source: DemandSource,
  slot: string,
  mainStat: MainStat,
  desired: SubStat[]
): string {
  const subs = desired.join(",");
  if (source.type === "4pc")
    return `4pc:${source.setKey}:${slot}:${mainStat}:${subs}`;
  if (source.type === "2pc")
    return `2pc:${source.halfSetId}:${slot}:${mainStat}:${subs}`;
  return `flex:${slot}:${mainStat}:${subs}`;
}

/** Deduplicate alternatives per character, sum fractions, then round once. */
export function countDemand(
  rules: TriageRule[]
): Map<string, TriageDemandGroup> {
  const contributions = new Map<string, Map<string, number>>();
  const groups = new Map<string, TriageDemandGroup>();
  for (const rule of rules) {
    const key = makeEmbryoKey(
      rule.demandSource,
      rule.slot,
      rule.mainStat,
      rule.desired
    );
    if (!contributions.has(key)) {
      contributions.set(key, new Map());
      groups.set(key, {
        source: rule.demandSource,
        slot: rule.slot,
        demand: 0,
      });
    }
    const characters = contributions.get(key)!;
    // Multiple selected set configurations may share a half-set. They are
    // alternatives for this character, so retain its largest contribution.
    characters.set(
      rule.characterId,
      Math.max(characters.get(rule.characterId) ?? 0, rule.demandWeight)
    );
  }
  for (const [key, characters] of contributions) {
    const total = [...characters.values()].reduce(
      (sum, weight) => sum + weight,
      0
    );
    // Repeated fractions such as 1/3 must not turn an integer into an extra slot.
    groups.get(key)!.demand = Math.ceil(total - 1e-9);
  }
  return groups;
}
