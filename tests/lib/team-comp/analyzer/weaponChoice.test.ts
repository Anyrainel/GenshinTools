import { describe, expect, it } from "vitest";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { singleFormulaCombo } from "@/lib/dmgcalc/core/combo";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { CalcContext, TeamSlotConfig } from "@/lib/dmgcalc/types";
import { runWeaponChoice } from "@/lib/team-comp/analyzer/weaponChoice";
import type {
  ArtifactAssignmentSuggestion,
  WeaponChoiceCharConfig,
} from "@/lib/team-comp/types";

import "@/lib/dmgcalc";

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
        weaponId: "weapon_catalyst",
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
      weaponStats: { weapon_catalyst: stats.weapon_catalyst },
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
      ).toEqual(["weapon_catalyst", "weapon_catalyst"]);
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
