import "@/providers/reference/statLoaders";
import { describe, expect, it } from "vitest";
import { runWeaponChoice } from "@/domain/combat/analyzer/weaponChoice";
import { singleFormulaCombo } from "@/domain/combat/damage/core/combo";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { CalcContext, TeamSlotConfig } from "@/domain/combat/damage/types";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type {
  ArtifactAssignmentSuggestion,
  ChoiceRanking,
  WeaponChoiceCharConfig,
} from "@/domain/team/types";

import "@/domain/combat/damage/index";

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

const SUBOPTIMAL_ARTIFACT_CONFIGS: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 0,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
  },
];

function toWeaponChoiceCharConfigs(
  configs: TeamSlotConfig[]
): WeaponChoiceCharConfig[] {
  return configs.map((config) => ({
    charId: config.charId,
    level: config.charLevel,
    constellation: config.constellation,
    talentLevels: [10, 10, 10],
    artifactConfig: config.artifactSet,
    minEr: 1,
    minCr: 0,
  }));
}

describe("runWeaponChoice artifact mode", () => {
  async function comparePetra(
    configs: TeamSlotConfig[],
    opts: Record<string, string> = {}
  ) {
    const gen = runWeaponChoice({
      mode: "artifact",
      baseConfigs: configs,
      charConfigs: toWeaponChoiceCharConfigs(configs),
      combo: singleFormulaCombo("lisa", "lisa-hold"),
      calcContext: CTX,
      weaponStats: weaponStatsResource.peek()!,
      opts,
    });
    let rankings: Record<string, ChoiceRanking[]> = {};
    let suggestion: ArtifactAssignmentSuggestion | null | undefined;
    for await (const result of gen) {
      rankings = result.perCharacter;
      suggestion = result.artifactAssignmentSuggestion;
    }
    return { rankings, suggestion };
  }

  const petraConfigs: TeamSlotConfig[] = [
    {
      charId: "lisa",
      charLevel: 90,
      constellation: 0,
      weaponId: "skyward_atlas",
      refinement: 1,
      artifactSet: null,
    },
    {
      charId: "amber",
      charLevel: 90,
      constellation: 0,
      weaponId: "favonius_warbow",
      refinement: 1,
      artifactSet: null,
    },
    {
      charId: "zhongli",
      charLevel: 90,
      constellation: 0,
      weaponId: "favonius_lance",
      refinement: 1,
      artifactSet: { type: "4pc", setId: "archaic_petra" },
    },
  ];
  const isPetra = (entry: ChoiceRanking) =>
    entry.type === "artifact" &&
    entry.artifactSet.type === "4pc" &&
    entry.artifactSet.setId === "archaic_petra";

  it("chooses one feasible Petra element for the objective and retains it in recommendations", async () => {
    // Pyro is a valid selection, but the Electro objective benefits from Electro.
    const { rankings, suggestion } = await comparePetra(petraConfigs, {
      archaic_petra: "Pyro",
    });
    const petra = rankings.zhongli.filter(isPetra);
    expect(petra).toHaveLength(1);
    expect(petra[0]).toMatchObject({
      combatOptions: { archaic_petra: "Electro" },
    });
    expect(suggestion?.combatOptions).toEqual({ archaic_petra: "Electro" });
    expect(suggestion!.bestDamage).toBeGreaterThan(suggestion!.currentDamage);
  }, 60000);

  it("cannot recommend an active Petra buff for a team without Geo", async () => {
    const configs = petraConfigs.slice(0, 2);
    const { rankings } = await comparePetra(configs, {
      archaic_petra: "Electro",
    });
    expect(rankings.amber.filter(isPetra)).toHaveLength(1);
    expect(rankings.amber.find(isPetra)).toMatchObject({
      combatOptions: { archaic_petra: "none" },
    });
  }, 60000);

  it("detects a better reassignment when the current artifact allocation is suboptimal", async () => {
    const teamBuild = new TeamBuild(SUBOPTIMAL_ARTIFACT_CONFIGS);
    const formulaId = Object.keys(
      teamBuild.catalog.getFormulaIds().hu_tao ?? {}
    )[0];
    const weaponStats = weaponStatsResource.peek();
    expect(formulaId).toBeDefined();
    expect(weaponStats).toBeTruthy();

    const gen = runWeaponChoice({
      mode: "artifact",
      baseConfigs: SUBOPTIMAL_ARTIFACT_CONFIGS,
      charConfigs: toWeaponChoiceCharConfigs(SUBOPTIMAL_ARTIFACT_CONFIGS),
      combo: singleFormulaCombo("hu_tao", formulaId),
      calcContext: CTX,
      weaponStats: weaponStats ?? {},
      opts: {},
    });

    let suggestion: ArtifactAssignmentSuggestion | null | undefined;
    for await (const result of gen) {
      suggestion = result.artifactAssignmentSuggestion;
      if (suggestion) {
        await gen.return();
        break;
      }
    }

    expect(suggestion).toBeDefined();
    expect(suggestion?.bestDamage).toBeGreaterThan(
      suggestion?.currentDamage ?? 0
    );
    expect(suggestion?.assignments).toEqual([
      {
        charId: "hu_tao",
        artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
      },
      {
        charId: "xingqiu",
        artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
      },
    ]);
  });
});

describe("runWeaponChoice beta weapons", () => {
  it("evaluates the beta catalyst at both five-star refinements", async () => {
    const configs: TeamSlotConfig[] = [
      {
        charId: "lisa",
        charLevel: 90,
        constellation: 0,
        weaponId: "starsealed_edict",
        refinement: 1,
        artifactSet: null,
      },
    ];
    const teamBuild = new TeamBuild(configs);
    const formulaId = Object.keys(teamBuild.catalog.getFormulaIds().lisa)[0];
    const stats = weaponStatsResource.peek()!;
    const generator = runWeaponChoice({
      baseConfigs: configs,
      charConfigs: toWeaponChoiceCharConfigs(configs),
      combo: singleFormulaCombo("lisa", formulaId),
      calcContext: CTX,
      weaponStats: { starsealed_edict: stats.starsealed_edict },
      opts: {},
    });
    let completed = false;
    for await (const result of generator) {
      if (!result.done) continue;
      completed = true;
      const rankings = result.perCharacter.lisa;
      expect(rankings).toHaveLength(2);
      expect(
        rankings.map((choice) =>
          choice.type === "weapon" ? choice.weaponId : null
        )
      ).toEqual(["starsealed_edict", "starsealed_edict"]);
      expect(
        rankings
          .map((choice) =>
            choice.type === "weapon" ? choice.refinement : null
          )
          .sort()
      ).toEqual([1, 5]);
    }
    expect(completed).toBe(true);
  });
});

describe("runWeaponChoice owned weapons", () => {
  const configs = SUBOPTIMAL_ARTIFACT_CONFIGS.slice(0, 1);

  async function compareOwned(
    ownedWeaponChoices: { weaponId: string; refinement: number }[]
  ) {
    const teamBuild = new TeamBuild(configs);
    const formulaId = Object.keys(teamBuild.catalog.getFormulaIds().hu_tao)[0];
    const generator = runWeaponChoice({
      baseConfigs: configs,
      charConfigs: toWeaponChoiceCharConfigs(configs),
      combo: singleFormulaCombo("hu_tao", formulaId),
      calcContext: CTX,
      weaponStats: weaponStatsResource.peek()!,
      opts: {},
      ownedWeaponChoices,
    });
    for await (const result of generator) {
      if (result.done) return result.perCharacter.hu_tao;
    }
    throw new Error("Comparison did not complete");
  }

  it("evaluates actual intermediate refinements and ignores incompatible and unowned weapons", async () => {
    const rankings = await compareOwned([
      { weaponId: "staff_of_homa", refinement: 2 },
      { weaponId: "staff_of_homa", refinement: 3 },
      { weaponId: "staff_of_homa", refinement: 4 },
      { weaponId: "sacrificial_sword", refinement: 5 },
    ]);
    expect(rankings).toHaveLength(3);
    expect(rankings.map((r) => r.type === "weapon" && r.weaponId)).toEqual([
      "staff_of_homa",
      "staff_of_homa",
      "staff_of_homa",
    ]);
    expect(
      rankings.map((r) => r.type === "weapon" && r.refinement).sort()
    ).toEqual([2, 3, 4]);
    expect(rankings[0].percentOfBest).toBe(100);
    expect(rankings.every((r) => r.percentOfBest <= 100)).toBe(true);
  });

  it("returns an empty ranking instead of falling back to the full catalog", async () => {
    expect(await compareOwned([])).toEqual([]);
  });
});

describe("runWeaponChoice minimum ER", () => {
  const configs: TeamSlotConfig[] = [
    {
      charId: "xingqiu",
      charLevel: 90,
      constellation: 6,
      weaponId: "primordial_jade_cutter",
      refinement: 1,
      artifactSet: null,
    },
  ];
  const ownedWeaponChoices = [
    { weaponId: "primordial_jade_cutter", refinement: 1 },
    { weaponId: "sacrificial_sword", refinement: 1 },
  ];

  async function compare(minEr: number) {
    const generator = runWeaponChoice({
      baseConfigs: configs,
      charConfigs: toWeaponChoiceCharConfigs(configs).map((config) => ({
        ...config,
        minEr,
      })),
      combo: singleFormulaCombo("xingqiu", "xingqiu-burst-tick"),
      calcContext: CTX,
      weaponStats: weaponStatsResource.peek()!,
      ownedWeaponChoices,
      opts: {},
    });
    for await (const result of generator) {
      if (result.done) return result;
    }
    throw new Error("Comparison did not complete");
  }

  it("counts weapon ER before spending artifact rolls on the remaining gap", async () => {
    const result = await compare(2.3);
    const rankings = result.perCharacter.xingqiu;
    expect(result.excludedChoices.xingqiu).toEqual([]);
    expect(rankings).toHaveLength(2);
    const jade = rankings.find(
      (entry) =>
        entry.type === "weapon" && entry.weaponId === "primordial_jade_cutter"
    )!;
    const sacrificial = rankings.find(
      (entry) =>
        entry.type === "weapon" && entry.weaponId === "sacrificial_sword"
    )!;
    expect(jade.substatRolls?.er).toBeGreaterThan(
      sacrificial.substatRolls?.er ?? 0
    );
  });

  it("excludes an infeasible weapon from both ranking and damage normalization", async () => {
    const result = await compare(2.8);
    expect(result.perCharacter.xingqiu).toMatchObject([
      { weaponId: "sacrificial_sword", percentOfBest: 100 },
    ]);
    expect(result.excludedChoices.xingqiu).toEqual([
      expect.objectContaining({
        type: "weapon",
        weaponId: "primordial_jade_cutter",
        refinement: 1,
        failReasons: {
          xingqiu: expect.objectContaining({ kind: "er-unmet", minEr: 2.8 }),
        },
      }),
    ]);
    expect(result.excludedChoices.xingqiu[0]).not.toHaveProperty("damage");
    expect(result.excludedChoices.xingqiu[0]).not.toHaveProperty(
      "percentOfBest"
    );
  });

  it("returns explicit constraint failures when every weapon is infeasible", async () => {
    const result = await compare(6);
    expect(result.perCharacter.xingqiu).toEqual([]);
    expect(result.excludedChoices.xingqiu).toHaveLength(2);
    for (const choice of result.excludedChoices.xingqiu) {
      expect(choice.failReasons.xingqiu).toMatchObject({
        kind: "er-unmet",
        minEr: 6,
      });
    }
  });

  it("excludes infeasible artifact sets instead of ranking their unconstrained damage", async () => {
    const generator = runWeaponChoice({
      mode: "artifact",
      baseConfigs: configs,
      charConfigs: toWeaponChoiceCharConfigs(configs).map((config) => ({
        ...config,
        minEr: 6,
      })),
      combo: singleFormulaCombo("xingqiu", "xingqiu-burst-tick"),
      calcContext: CTX,
      weaponStats: weaponStatsResource.peek()!,
      opts: {},
    });
    let completed = false;
    for await (const result of generator) {
      if (!result.done) continue;
      completed = true;
      expect(result.perCharacter.xingqiu).toEqual([]);
      expect(result.artifactAssignmentSuggestion).toBeNull();
      expect(result.excludedChoices.xingqiu.length).toBeGreaterThan(1);
      for (const choice of result.excludedChoices.xingqiu) {
        expect(choice.type).toBe("artifact");
        expect(choice.failReasons.xingqiu).toMatchObject({
          kind: "er-unmet",
          minEr: 6,
        });
        expect(choice).not.toHaveProperty("damage");
      }
    }
    expect(completed).toBe(true);
  }, 60000);
});
