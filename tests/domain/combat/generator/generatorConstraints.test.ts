import "@/providers/reference/statLoaders";
import { describe, expect, it } from "vitest";
import { getRollValues } from "@/domain/build/artifact/scoring/utils";
import { getMainStatValue } from "@/domain/build/statUtils";
import { singleFormulaCombo } from "@/domain/combat/damage/core/combo";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { CalcContext, TeamSlotConfig } from "@/domain/combat/damage/types";
import {
  type GeneratorOptions,
  type GeneratorResult,
  runGenerator,
} from "@/domain/combat/generator/generator";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import "@/domain/combat/damage/index";
import { drain, getFirstFormulaId } from "../../../fixtures/optimizerHelpers";

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
const COMBO = singleFormulaCombo("xingqiu", "xingqiu-burst-tick");

function makeConfig(weaponId = "primordial_jade_cutter"): TeamSlotConfig {
  return {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId,
    refinement: 1,
    artifactSet: null,
  };
}

function verifyEmittedBuilds(
  teamBuild: TeamBuild,
  results: GeneratorResult[],
  perChar: NonNullable<GeneratorOptions["perChar"]>
) {
  for (const result of results) {
    for (const [charId, artifacts] of Object.entries(result.artifactsByChar)) {
      expect(result.failReasons[charId]).toBeUndefined();
      const sheet = StatSheet.fromArtifacts(Object.values(artifacts));
      expect(sheet.get("er", null)).toBeCloseTo(
        result.sheetsByChar[charId].get("er", null),
        10
      );
      expect(sheet.get("cr", null)).toBeCloseTo(
        result.sheetsByChar[charId].get("cr", null),
        10
      );
      const stats = teamBuild.getTeamStats(result.sheetsByChar, charId, CTX)[
        charId
      ];
      expect(
        stats.get("er", null),
        `${result.phase}: ${charId} ER`
      ).toBeGreaterThanOrEqual((perChar[charId]?.minEr ?? 0) - 1e-6);
      expect(
        stats.get("cr", null),
        `${result.phase}: ${charId} CR`
      ).toBeGreaterThanOrEqual((perChar[charId]?.minCr ?? 0) - 1e-6);
    }
  }
}

describe("generator ER/CR constraints", () => {
  it.each(["primordial_jade_cutter", "sacrificial_sword"])(
    "keeps 230%% ER through every refinement with %s",
    async (weaponId) => {
      const teamBuild = new TeamBuild([makeConfig(weaponId)]);
      const perChar = { xingqiu: { minEr: 2.3, minCr: 0 } };
      const results = await drain(
        runGenerator({
          teamBuild,
          carryCharId: "xingqiu",
          combo: COMBO,
          calcContext: CTX,
          rollMultiplier: CTX.rollMultiplier,
          perChar,
        })
      );
      const final = results.at(-1)!;
      expect(final.done).toBe(true);
      expect(final.failReasons).toEqual({});
      expect(final.artifactsByChar.xingqiu).toBeDefined();
      verifyEmittedBuilds(teamBuild, results, perChar);
      let previousDamage = 0;
      for (const result of results) {
        if (!result.sheetsByChar.xingqiu) continue;
        const damage = teamBuild.getComboDamageResult(
          COMBO,
          result.sheetsByChar,
          CTX
        ).totalDamage;
        expect(
          damage,
          `${result.phase} must preserve the best feasible build`
        ).toBeGreaterThanOrEqual(previousDamage - 1e-6);
        previousDamage = damage;
      }
    }
  );

  it("uses weapon ER before spending artifact rolls on the remaining gap", async () => {
    const counts: number[] = [];
    for (const weaponId of ["primordial_jade_cutter", "sacrificial_sword"]) {
      const teamBuild = new TeamBuild([makeConfig(weaponId)]);
      const perChar = { xingqiu: { minEr: 1.8, minCr: 0 } };
      const results = await drain(
        runGenerator({
          teamBuild,
          carryCharId: "xingqiu",
          combo: COMBO,
          calcContext: CTX,
          perChar,
        })
      );
      verifyEmittedBuilds(teamBuild, results, perChar);
      const final = results.at(-1)!;
      counts.push(final.sheetsByChar.xingqiu.get("er", null));
    }
    expect(counts[1]).toBeLessThan(counts[0]);
  });

  it.each([
    { minEr: 6, minCr: 0, kind: "er-unmet" },
    { minEr: 1, minCr: 2, kind: "cr-unmet" },
  ])(
    "reports an infeasible $kind instead of returning an unconstrained build",
    async ({ minEr, minCr, kind }) => {
      const teamBuild = new TeamBuild([makeConfig()]);
      const perChar = { xingqiu: { minEr, minCr } };
      const results = await drain(
        runGenerator({
          teamBuild,
          carryCharId: "xingqiu",
          combo: COMBO,
          calcContext: CTX,
          perChar,
        })
      );
      const final = results.at(-1)!;
      expect(final.done).toBe(true);
      expect(final.failReasons.xingqiu.kind).toBe(kind);
      expect(final.artifactsByChar.xingqiu).toBeUndefined();
      expect(final.sheetsByChar.xingqiu).toBeUndefined();
      verifyEmittedBuilds(teamBuild, results, perChar);
    }
  );

  it("preserves simultaneous ER and CR requirements when comparing CR/CD circlets", async () => {
    const teamBuild = new TeamBuild([makeConfig("sacrificial_sword")]);
    const perChar = { xingqiu: { minEr: 2.3, minCr: 0.95 } };
    const results = await drain(
      runGenerator({
        teamBuild,
        carryCharId: "xingqiu",
        combo: COMBO,
        calcContext: CTX,
        perChar,
      })
    );
    expect(results.at(-1)!.failReasons).toEqual({});
    expect(results.at(-1)!.artifactsByChar.xingqiu).toBeDefined();
    verifyEmittedBuilds(teamBuild, results, perChar);
  });

  it("meets the threshold using the rounded artifact values callers equip", async () => {
    const teamBuild = new TeamBuild([makeConfig()]);
    const rv = getRollValues(0.85, 5);
    // Three ER rolls round down; the exact pre-rounding value is not enough.
    const minEr = 1 + (rv.er * 3) / 100;
    const perChar = { xingqiu: { minEr, minCr: 0 } };
    const results = await drain(
      runGenerator({
        teamBuild,
        carryCharId: "xingqiu",
        combo: COMBO,
        calcContext: CTX,
        rollMultiplier: 0.85,
        perChar,
      })
    );
    expect(results.at(-1)!.failReasons).toEqual({});
    verifyEmittedBuilds(teamBuild, results, perChar);
  });

  it("uses the 5-star flex slot's ER roll values and budget in a 4-star set", async () => {
    const teamBuild = new TeamBuild([
      { ...makeConfig(), artifactSet: { type: "4pc", setId: "instructor" } },
    ]);
    const rv4 = getRollValues(0.85, 4);
    const rv5 = getRollValues(0.85, 5);
    // Feasible with ER sands and a 5-star goblet/circlet, beyond the capacity
    // obtained by incorrectly treating all five pieces as 4-star artifacts.
    const minEr =
      1 + (getMainStatValue("er", 4) + 9 * rv4.er + 5 * rv5.er) / 100 - 0.002;
    const perChar = { xingqiu: { minEr, minCr: 0 } };
    const results = await drain(
      runGenerator({
        teamBuild,
        carryCharId: "xingqiu",
        combo: COMBO,
        calcContext: CTX,
        rollMultiplier: 0.85,
        perChar,
      })
    );
    const final = results.at(-1)!;
    expect(final.failReasons).toEqual({});
    expect(
      Object.values(final.artifactsByChar.xingqiu).filter((a) => a.rarity === 5)
    ).toHaveLength(1);
    verifyEmittedBuilds(teamBuild, results, perChar);
  });

  it("does not rely on rejected teammates' artifact-scaled team ER buffs", async () => {
    const teamBuild = new TeamBuild([
      makeConfig(),
      {
        charId: "kaedehara_kazuha",
        charLevel: 90,
        constellation: 0,
        weaponId: "xiphos_moonlight",
        refinement: 5,
        artifactSet: null,
      },
    ]);
    const perChar = {
      xingqiu: { minEr: 2.3, minCr: 0 },
      kaedehara_kazuha: { minEr: 1, minCr: 2 },
    };
    const results = await drain(
      runGenerator({
        teamBuild,
        carryCharId: "xingqiu",
        combo: COMBO,
        calcContext: CTX,
        perChar,
      })
    );
    const final = results.at(-1)!;
    expect(final.failReasons.kaedehara_kazuha.kind).toBe("cr-unmet");
    expect(final.artifactsByChar.kaedehara_kazuha).toBeUndefined();
    expect(final.artifactsByChar.xingqiu).toBeDefined();
    verifyEmittedBuilds(teamBuild, results, perChar);
  });

  it("counts artifact main stats converted into ER by Xiphos before declaring a build infeasible", async () => {
    const charId = "kaedehara_kazuha";
    const teamBuild = new TeamBuild([
      {
        charId,
        charLevel: 90,
        constellation: 6,
        weaponId: "xiphos_moonlight",
        refinement: 5,
        artifactSet: null,
      },
    ]);
    const perChar = { [charId]: { minEr: 3, minCr: 0 } };
    const results = await drain(
      runGenerator({
        teamBuild,
        carryCharId: charId,
        combo: singleFormulaCombo(charId, getFirstFormulaId(teamBuild, charId)),
        calcContext: CTX,
        rollMultiplier: 0.85,
        perChar,
      })
    );
    const final = results.at(-1)!;
    expect(final.failReasons).toEqual({});
    expect(final.artifactsByChar[charId]).toBeDefined();
    verifyEmittedBuilds(teamBuild, results, perChar);
  });
});
