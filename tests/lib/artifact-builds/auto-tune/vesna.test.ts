import { beforeAll, describe, expect, it } from "vitest";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { buildSheetFromMainAndSubs } from "@/lib/artifact/scoring/sheetBuilder";
import { emptySubRolls, getRollValues } from "@/lib/artifact/scoring/utils";
import {
  buildAutoTuneCombo,
  compileAutoTuneEval,
  DEFAULT_CALC_CTX,
} from "@/lib/artifact-builds/auto-tune/autoTune";
import {
  aggregateTeamResults,
  autoTuneTeam,
} from "@/lib/artifact-builds/auto-tune/pipeline";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

// Default flagship preset: no account data/overrides, so all supports are C0R1.
function flagshipConfigs(constellation: number): TeamSlotConfig[] {
  return [
    ["vesna", "beyond_the_chrysalis", "scarlet_proof"],
    ["vodyanitsa", "hymn_of_the_maelstrom", "tenacity_of_the_millelith"],
    ["odette", "whitelake_frostfeather", "heart_of_the_furnace"],
    ["faruzan", "favonius_warbow", "noblesse_oblige"],
  ].map(([charId, weaponId, setId]) => ({
    charId,
    weaponId,
    charLevel: 90,
    constellation: charId === "vesna" ? constellation : 0,
    refinement: 1,
    artifactSet: { type: "4pc", setId },
  }));
}

describe("Vesna default-team AutoTune", () => {
  it.each([
    0, 1, 6,
  ])("prefers ATK and CRIT over triple EM at C%d", (constellation) => {
    const configs = flagshipConfigs(constellation);
    const team = new TeamBuild(configs);
    const formulas = Object.entries(team.catalog.getCombo("vesna")).map(
      ([formulaId, count]) => ({ formulaId, count })
    );
    const result = autoTuneTeam({
      characterId: "vesna",
      configs,
      opts: {},
      formulas,
      label: "Vesna flagship",
      teamIndex: 0,
      element: "Anemo",
    });
    const output = aggregateTeamResults([result], "vesna", "Anemo");
    expect(output.sandsWeights[0].stat).toBe("atk%");
    expect(output.gobletWeights[0].stat).toBe("atk%");
    expect(["cr", "cd"]).toContain(output.circletWeights[0].stat);
    const tripleEm = result.teamBreakdown.combos.find((combo) =>
      Object.values(combo.mainStats).every((stat) => stat === "em")
    );
    expect(tripleEm).toBeDefined();
    expect(tripleEm!.damageRatio).toBeLessThan(0.96);

    // AutoTune's compiled objective must agree with the displayed combo engine.
    const sheets = Object.fromEntries(
      configs.map((config) => [
        config.charId,
        new StatSheet([
          { key: "hp", value: 4780 },
          { key: "atk", value: 311 },
        ]),
      ])
    );
    sheets.vesna = buildSheetFromMainAndSubs(
      {
        flower: "hp",
        plume: "atk",
        sands: "atk%",
        goblet: "atk%",
        circlet: "cd",
      },
      emptySubRolls(),
      getRollValues()
    );
    const evalDamage = compileAutoTuneEval(team, "vesna", formulas, sheets);
    const displayed = team.getComboDamageResult(
      buildAutoTuneCombo("vesna", formulas),
      sheets,
      { ...DEFAULT_CALC_CTX, enemyRes: 0.1 }
    );
    expect(evalDamage(sheets)).toBeCloseTo(displayed.totalDamage, 2);
  });
});
