/**
 * Regression test for the "Illuga gets geo% goblet for Linnea's
 * lunar-crystallize million-ton" bug from the dev server.
 *
 * Team: Linnea (carry) + Illuga + Columbina + Gorou.
 * Combo: linnea-million-ton (lunar crystallize) with forceOnField = true.
 * Expected: Illuga should pick goblet=em (her em scales linnea's baseDmg via
 * a teamOnField ScalingBuff). Geo% goblet is wrong because Illuga has no
 * buff that scales off her own geo%.
 */
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  type GeneratorOptions,
  runGenerator,
} from "@/lib/team-comp/generator/generator";
import type {
  CalcContext,
  ComboFormula,
  ComboLine,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";
import "@/lib/team-comp/index";
import { drain } from "../../../fixtures/optimizerHelpers";

await preloadGameStats();

const CTX: CalcContext = { enemyLevel: 100, enemyRes: 0.1 };

function configs(): TeamSlotConfig[] {
  return [
    {
      charId: "linnea",
      charLevel: 90,
      constellation: 0,
      weaponId: "prototype_amber",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "illuga",
      charLevel: 90,
      constellation: 0,
      weaponId: "prototype_amber",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "columbina",
      charLevel: 90,
      constellation: 0,
      weaponId: "prototype_amber",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "gorou",
      charLevel: 90,
      constellation: 0,
      weaponId: "prototype_amber",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];
}

describe("illuga generator", () => {
  it("picks em goblet for illuga when linnea's million-ton has forceOnField=true", async () => {
    const tb = new TeamBuild(configs());

    // Single combo line with reaction.forceOnField=true.
    const lines: ComboLine[] = [
      {
        charId: "linnea",
        formulaId: "linnea-million-ton",
        count: 1,
        reaction: { reaction: "lunarCrystallize", forceOnField: true },
      },
    ];
    const combo: ComboFormula = {
      id: "test-combo",
      label: { en: "Test", zh: "Test" },
      lines,
    };

    // Mimic the per-char ER/CR constraints handleGenerate builds.
    const perChar: Record<string, { minEr: number; minCr: number }> = {
      linnea: { minEr: 1.0, minCr: 0 },
      illuga: { minEr: 1.0, minCr: 0 },
      columbina: { minEr: 1.0, minCr: 0 },
      gorou: { minEr: 1.0, minCr: 0 },
    };

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "linnea",
      formula: { combo },
      calcContext: CTX,
      perChar,
    };

    const results = await drain(runGenerator(opts));
    const final = results[results.length - 1];
    const illugaArts = final.artifactsByChar.illuga;
    const mains = Object.fromEntries(
      Object.entries(illugaArts ?? {}).map(([k, v]) => [k, v.mainStatKey])
    );
    // eslint-disable-next-line no-console
    console.log("illuga main stats:", mains);

    expect(mains.goblet).toBe("em");
  });
});
