import { hasPaidConstellations } from "./investmentCost";
import type {
  AnalyzerCharConfig,
  AnalyzerResult,
  CachedNodeRef,
  TeamInvestment,
} from "./types";

export type InvestmentBranch = { steps: CachedNodeRef[]; gainPct: number };

function allocationKey(allocation: TeamInvestment): string {
  return Object.entries(allocation)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, c]) => `${id}:${c.constellation}:${c.weaponId}:${c.refinement}`)
    .join("|");
}

/** Branch previews reuse evaluated nodes from the one path run. They cannot
 * refund/reallocate existing copies or combine independent recommendations. */
export function getNextPullBranches(
  result: AnalyzerResult,
  configs: AnalyzerCharConfig[],
  copies: number
): InvestmentBranch[] {
  const baseline = result.sequence[0];
  if (!baseline || copies < 1) return [];
  const evaluated = new Map(
    [...result.nodesByJin.values()]
      .flat()
      .map((node) => [allocationKey(node.allocation), node])
  );
  const next = (node: CachedNodeRef) => {
    const successors: CachedNodeRef[] = [];
    for (const config of configs) {
      const state = node.allocation[config.charId];
      if (!state) continue;
      const changes: Partial<typeof state>[] = [];
      if (
        hasPaidConstellations(config) &&
        state.constellation < config.maxConstellation
      )
        changes.push({ constellation: state.constellation + 1 });
      if (state.is5StarWeapon && state.refinement < config.maxRefinement)
        changes.push({ refinement: state.refinement + 1 });
      if (
        !state.is5StarWeapon &&
        config.weapon5Star &&
        config.maxRefinement > 0
      )
        changes.push({
          weaponId: config.weapon5Star.id,
          refinement: 1,
          is5StarWeapon: true,
        });
      for (const change of changes) {
        const candidate = evaluated.get(
          allocationKey({
            ...node.allocation,
            [config.charId]: { ...state, ...change },
          })
        );
        if (candidate) successors.push(candidate);
      }
    }
    return successors;
  };
  const start = {
    id: "baseline",
    allocation: baseline.allocation,
    damage: baseline.damage,
  };
  const branches: InvestmentBranch[] = [];
  for (const first of next(start)) {
    let frontier = new Map([[allocationKey(first.allocation), [first]]]);
    for (let depth = 1; depth < copies; depth++) {
      const expanded = new Map<string, CachedNodeRef[]>();
      for (const path of frontier.values()) {
        const successors = next(path[path.length - 1]);
        if (!successors.length)
          expanded.set(allocationKey(path[path.length - 1].allocation), path);
        for (const node of successors) {
          const key = allocationKey(node.allocation);
          if (!expanded.has(key)) expanded.set(key, [...path, node]);
        }
      }
      frontier = expanded;
    }
    const best = [...frontier.values()].sort(
      (a, b) =>
        b.length - a.length || b[b.length - 1].damage - a[a.length - 1].damage
    )[0];
    if (best)
      branches.push({
        steps: best,
        gainPct:
          baseline.damage > 0
            ? (best[best.length - 1].damage / baseline.damage - 1) * 100
            : 0,
      });
  }
  return branches.sort(
    (a, b) =>
      b.steps[b.steps.length - 1].damage - a.steps[a.steps.length - 1].damage
  );
}
