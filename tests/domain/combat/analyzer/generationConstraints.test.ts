import "@/providers/reference/statLoaders";
import { describe, expect, it } from "vitest";
import {
  isAnalyzerResult,
  runAnalysis,
} from "@/domain/combat/analyzer/analyzer";
import type {
  AnalyzerOptions,
  AnalyzerResult,
} from "@/domain/combat/analyzer/types";
import { singleFormulaCombo } from "@/domain/combat/damage/core/combo";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { TeamSlotConfig } from "@/domain/combat/damage/types";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

function options(minEr: number): AnalyzerOptions {
  const baseConfigs: TeamSlotConfig[] = [
    {
      charId: "xingqiu",
      charLevel: 90,
      constellation: 6,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSet: null,
    },
  ];
  return {
    configs: [
      {
        charId: "xingqiu",
        rarity: 4,
        weapon4Star: { id: "sacrificial_sword", refinement: 1 },
        weapon5Star: { id: "primordial_jade_cutter" },
        startConstellation: 6,
        startRefinement: 0,
        maxConstellation: 6,
        maxRefinement: 1,
      },
    ],
    baseConfigs,
    teamBuild: new TeamBuild(baseConfigs),
    templateCombo: singleFormulaCombo("xingqiu", "xingqiu-burst-tick"),
    perChar: { xingqiu: { minEr, minCr: 0 } },
    calcContext: {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    },
  };
}

async function analyze(minEr: number): Promise<AnalyzerResult> {
  for await (const result of runAnalysis(options(minEr))) {
    if (isAnalyzerResult(result)) return result;
  }
  throw new Error("Expected completed analysis");
}

describe("investment generation constraints", () => {
  it("does not turn failed generation into empty-artifact damage rankings", async () => {
    const result = await analyze(6);
    expect(result.dag.nodes).toEqual([]);
    expect(result.dag.edges).toEqual([]);
    expect(result.sequence).toEqual([]);
    expect(result.bestAtTier.size).toBe(0);
    expect(result.nodesByJin.size).toBe(0);
  });

  it("keeps feasible weapon snapshots while excluding an infeasible alternative", async () => {
    const result = await analyze(2.8);
    expect(result.dag.nodes.length).toBeGreaterThan(0);
    const allocations = [...result.nodesByJin.values()].flat();
    expect(allocations.length).toBeGreaterThan(0);
    expect(
      allocations.every(
        (node) => node.allocation.xingqiu.weaponId === "sacrificial_sword"
      )
    ).toBe(true);
    expect(allocations.every((node) => node.damage > 0)).toBe(true);
  });
});
