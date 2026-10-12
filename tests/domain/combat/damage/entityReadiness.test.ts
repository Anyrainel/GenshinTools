import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CALC_CONTEXT } from "@/domain/combat/damage/constants";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/domain/combat/damage/core/formulaCompiler";
import {
  createArtifactHalfSet,
  createArtifactSet,
} from "@/domain/combat/damage/core/registry";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import type {
  ComboFormula,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import type { WeaponType } from "@/domain/enums";
import {
  allArtifacts,
  allCharacters,
  allWeapons,
} from "@/domain/reference/catalog";
import {
  CHARACTER_LEVEL_TIERS,
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import { artifactHalfSets } from "@/generated/catalog/resources";
import {
  betaArtifacts,
  betaCharacters,
  betaWeapons,
} from "@/generated/catalog/resources_beta";

// Import the public build entry directly: callers must not need an unrelated
// page import to register the entities, and missing data must fail this suite.
beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

const wearers: Record<WeaponType, string> = {
  Sword: "kaeya",
  Claymore: "diluc",
  Polearm: "xiangling",
  Catalyst: "lisa",
  Bow: "amber",
};

function config(charId: string, weaponId: string): TeamSlotConfig {
  return {
    charId,
    weaponId,
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    artifactSet: null,
  };
}

describe("released and beta calculator entity readiness", () => {
  it("includes beta catalog entries in the push gate", () => {
    expect(process.env.__BETA_ENABLED_OVERRIDE__).toBe("true");
    // Test setup enables beta before catalogs and resource loaders initialize.
    // A changed setup must not silently narrow the gate to released entities.
    for (const [catalog, beta] of [
      [allCharacters, betaCharacters],
      [allWeapons, betaWeapons],
      [allArtifacts, betaArtifacts],
    ]) {
      const ids = catalog.map(({ id }) => id);
      for (const { id } of beta) expect(ids).toContain(id);
    }
  });
  it.each(allCharacters.map(({ id }) => id))(
    "character %s builds at every level tier",
    (charId) => {
      const stats = characterStatsResource.peek()![charId];
      expect(stats, `${charId} has bundled stats`).toBeDefined();
      const weaponId = allWeapons
        .map(({ id }) => id)
        .find(
          (id) => weaponStatsResource.peek()![id]?.type === stats.weaponType
        )!;
      expect(weaponId).toBeDefined();
      for (const level of CHARACTER_LEVEL_TIERS) {
        for (const constellation of [0, 6]) {
          const build = new TeamBuild([
            {
              ...config(charId, weaponId),
              charLevel: Number(level),
              constellation,
            },
          ]);
          // Some support kits intentionally expose buffs without damage formulas.
          expect(build.catalog.getFormulaIds()[charId]).toBeDefined();
          expect(
            build.getTeamStats({ [charId]: new StatSheet([]) }, charId)
          ).toBeDefined();
        }
      }
    }
  );

  it.each(allWeapons.map(({ id }) => id))(
    "weapon %s builds at R1 and R5",
    (weaponId) => {
      const stats = weaponStatsResource.peek()![weaponId];
      expect(stats, `${weaponId} has bundled stats`).toBeDefined();
      const charId = wearers[stats.type];
      for (const refinement of [1, 5]) {
        const build = new TeamBuild([
          { ...config(charId, weaponId), refinement },
        ]);
        expect(
          build.getTeamStats({ [charId]: new StatSheet([]) }, charId)
        ).toBeDefined();
      }
    }
  );

  it.each(allArtifacts.map(({ id }) => id))(
    "artifact %s initializes stats and buffs",
    (setId) => {
      const artifact = createArtifactSet(
        setId,
        "kaeya",
        new TeamMeta(["kaeya"])
      );
      expect(artifact.stats).toBeDefined();
      expect(artifact.buffs).toBeDefined();
    }
  );

  it.each(artifactHalfSets.map(({ id }) => id))(
    "half-set %s initializes stats and buffs",
    (halfSetId) => {
      const artifact = createArtifactHalfSet(
        halfSetId,
        "kaeya",
        new TeamMeta(["kaeya"])
      );
      expect(artifact.stats).toBeDefined();
      expect(artifact.buffs).toBeDefined();
    }
  );

  it("constructs the reported Vesna team and compiles its optimizer objective", () => {
    const configs: TeamSlotConfig[] = [
      {
        ...config("vesna", "beyond_the_chrysalis"),
        charLevel: 95,
        constellation: 2,
        artifactSet: { type: "4pc", setId: "scarlet_proof" },
      },
      {
        ...config("odette", "whitelake_frostfeather"),
        artifactSet: { type: "4pc", setId: "heart_of_the_furnace" },
      },
      {
        ...config("traveler_cryo", "sacrificial_sword"),
        charLevel: 80,
        constellation: 4,
        refinement: 3,
        artifactSet: { type: "4pc", setId: "noblesse_oblige" },
      },
      {
        ...config("vodyanitsa", "thrilling_tales_of_dragon_slayers"),
        refinement: 5,
        artifactSet: { type: "4pc", setId: "tenacity_of_the_millelith" },
      },
    ];
    const build = new TeamBuild(configs);
    const combo: ComboFormula = {
      id: "vesna-readiness",
      label: { en: "Vesna readiness", zh: "薇丝娜测试" },
      lines: Object.entries(build.catalog.getCombo("vesna")).map(
        ([formulaId, count]) => ({ charId: "vesna", formulaId, count })
      ),
    };
    expect(combo.lines.length).toBeGreaterThan(0);
    const sheets = Object.fromEntries(
      configs.map(({ charId }) => [charId, new StatSheet([])])
    );
    const displayed = build.getComboDamageResult(
      combo,
      sheets,
      DEFAULT_CALC_CONTEXT
    );
    const compiled = compileComboTeamDamage(
      build,
      combo,
      configs.map(({ charId }) => charId),
      sheets,
      DEFAULT_CALC_CONTEXT
    );
    const damage = compiled.evaluate(
      new Float64Array(compiled.varMapping.totalVars)
    );
    expect(Number.isFinite(damage)).toBe(true);
    expect(damage).toBeGreaterThan(0);
    expect(damage).toBeCloseTo(displayed.totalDamage, 2);
  });

  it.each([
    [0, "stable"],
    [0, "collapse"],
    [6, "stable"],
    [6, "collapse"],
  ] as const)(
    "compiles a beta team at C%i in %s mode with matching displayed damage",
    (constellation, mode) => {
      const configs = [
        { ...config("mitya", "weapon_catalyst"), constellation },
        { ...config("valeriy", "prized_isshin_blade"), constellation },
        config("qiqi", "sacrificial_sword"),
      ];
      const build = new TeamBuild(configs, { mitya: mode });
      const combo: ComboFormula = {
        id: "beta-readiness",
        label: { en: "Beta readiness", zh: "测试角色" },
        lines: configs.flatMap(({ charId }) =>
          Object.entries(build.catalog.getCombo(charId)).map(
            ([formulaId, count]) => ({ charId, formulaId, count })
          )
        ),
      };
      const sheets = Object.fromEntries(
        configs.map(({ charId }) => [
          charId,
          new StatSheet([
            { key: "atk", value: 311 },
            { key: "atk%", value: 0.466 },
            { key: "em", value: 160 },
            { key: "cr", value: 0.31 },
            { key: "cd", value: 0.622 },
          ]),
        ])
      );
      const displayed = build.getComboDamageResult(
        combo,
        sheets,
        DEFAULT_CALC_CONTEXT
      );
      const compiled = compileComboTeamDamage(
        build,
        combo,
        configs.map(({ charId }) => charId),
        sheets,
        DEFAULT_CALC_CONTEXT
      );
      const vars = new Float64Array(compiled.numVars);
      for (const [charId, index] of compiled.charIdxMap!)
        fillVarsFromSheet(sheets[charId], compiled.varMapping, index, vars);
      const damage = compiled.evaluate(vars);
      expect(Number.isFinite(damage)).toBe(true);
      expect(damage).toBeGreaterThan(0);
      expect(damage).toBeCloseTo(displayed.totalDamage, 2);
    }
  );
});
