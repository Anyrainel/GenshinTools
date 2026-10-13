import { describe, expect, it } from "vitest";
import { getNextPullBranches } from "@/domain/combat/analyzer/nextPulls";
import type {
  AnalyzerCharConfig,
  AnalyzerResult,
  CachedNodeRef,
} from "@/domain/combat/analyzer/types";

const configs: AnalyzerCharConfig[] = ["a", "b"].map((charId) => ({
  charId,
  rarity: 5,
  weapon5Star: { id: "weapon" },
  startConstellation: 0,
  startRefinement: 1,
  maxConstellation: 2,
  maxRefinement: 1,
}));
function node(a: number, b: number, damage: number): CachedNodeRef {
  return {
    id: `${a}${b}`,
    damage,
    allocation: Object.fromEntries(
      [
        ["a", a],
        ["b", b],
      ].map(([charId, constellation]) => [
        charId,
        {
          constellation,
          weaponId: "weapon",
          refinement: 1,
          is5StarWeapon: true,
        },
      ])
    ),
  } as CachedNodeRef;
}
function result(nodes: CachedNodeRef[]): AnalyzerResult {
  const baseline = node(0, 0, 100);
  return {
    dag: { nodes: [], edges: [], baselineJin: 4, maxJin: 6 },
    bestAtTier: new Map(),
    nodesByJin: new Map([
      [4, [baseline]],
      [5, nodes],
    ]),
    sequence: [
      {
        ...baseline,
        jin: 4,
        gainVsBaseline: 0,
        gainVsBaselinePct: 0,
        gainVsPrev: 0,
        gainVsPrevPct: 0,
      },
    ],
  };
}
describe("next pulls from one investment result", () => {
  it("does not offer free Traveler constellations as paid pulls even with a stale ceiling", () => {
    const baseline = node(0, 0, 100);
    const upgraded = node(1, 0, 120);
    for (const item of [baseline, upgraded]) {
      item.allocation.traveler_cryo = item.allocation.a;
      delete item.allocation.a;
    }
    const prior = result([]);
    prior.sequence[0].allocation = baseline.allocation;
    prior.nodesByJin = new Map([[0, [baseline, upgraded]]]);
    expect(
      getNextPullBranches(
        prior,
        [{ ...configs[0], charId: "traveler_cryo" }],
        1
      )
    ).toEqual([]);
  });
  it("keeps different first choices reaching the same best terminal allocation as separate branches", () => {
    const branches = getNextPullBranches(
      result([
        node(1, 0, 120),
        node(0, 1, 110),
        node(1, 1, 170),
        node(2, 0, 150),
        node(0, 2, 140),
      ]),
      configs,
      2
    );
    expect(branches).toHaveLength(2);
    expect(branches.map((b) => b.steps[0].id).sort()).toEqual(["01", "10"]);
    expect(branches.every((b) => b.steps.at(-1)?.id === "11")).toBe(true);
    expect(branches.every((b) => b.gainPct === 70)).toBe(true);
  });
  it("preserves a shorter terminal prefix when fewer than N copies remain", () => {
    const branches = getNextPullBranches(result([node(1, 0, 120)]), configs, 3);
    expect(branches).toHaveLength(1);
    expect(branches[0].steps.map((step) => step.id)).toEqual(["10"]);
  });
  it("does not reallocate or refund an earlier copy to jump to a better cached tier", () => {
    const branches = getNextPullBranches(
      result([node(1, 0, 120), node(0, 2, 200)]),
      configs,
      2
    );
    expect(branches[0].steps.map((step) => step.id)).toEqual(["10"]);
    expect(branches[0].gainPct).toBeCloseTo(20);
  });
});
