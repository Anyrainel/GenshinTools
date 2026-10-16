import "@/providers/reference/statLoaders";
import "@/domain/combat/damage/index";
import { describe, expect, it } from "vitest";
import { singleFormulaCombo } from "@/domain/combat/damage/core/combo";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/domain/combat/damage/core/formulaCompiler";
import { getBuffInstanceKey } from "@/domain/combat/damage/core/statBuff";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  DisplayResult,
  ReactionOverride,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";

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

/** Optional local stress controls; CI uses the fixed defaults below.
 * Seeds accept decimal or hexadecimal unsigned 32-bit integers. */
function fuzzConfig(
  defaultSeed: number,
  defaultRuns: number
): {
  seed: number;
  runs: number;
} {
  const seedText = process.env.DAMAGE_DISPLAY_FUZZ_SEED;
  const runsText = process.env.DAMAGE_DISPLAY_FUZZ_RUNS;
  const seed = seedText === undefined ? defaultSeed : Number(seedText);
  const runs = runsText === undefined ? defaultRuns : Number(runsText);
  if (
    seedText?.trim() === "" ||
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff
  ) {
    throw new Error(
      "DAMAGE_DISPLAY_FUZZ_SEED must be an unsigned 32-bit integer"
    );
  }
  if (!Number.isSafeInteger(runs) || runs <= 0) {
    throw new Error("DAMAGE_DISPLAY_FUZZ_RUNS must be a positive integer");
  }
  return { seed, runs };
}

function slot(charId: string, weaponId: string): TeamSlotConfig {
  return {
    charId,
    charLevel: 90,
    constellation: 0,
    weaponId,
    refinement: 1,
    artifactSet: null,
  };
}

const SCROLL = "scroll_of_the_hero_of_cinder_city";
const HU_TAO_TEAM: TeamSlotConfig[] = [
  slot("hu_tao", "staff_of_homa"),
  slot("yelan", "aqua_simulacra"),
  {
    ...slot("citlali", "starcallers_watch"),
    artifactSet: { type: "4pc", setId: SCROLL },
  },
  slot("furina", "splendor_of_tranquil_waters"),
];

function sheetsFor(tb: TeamBuild): Record<string, StatSheet> {
  return Object.fromEntries(
    Object.keys(tb.charBuilds).map((id) => [id, new StatSheet([])])
  );
}

function buffKey(tb: TeamBuild, sourceId: string): string {
  const buff = tb.buffLedger.allBuffs.find(
    (b) => b.buff.source.id === sourceId
  );
  expect(buff, sourceId).toBeDefined();
  return getBuffInstanceKey(buff!.buff, buff!.providerCharId);
}

function renderedDamage(display: DisplayResult): number {
  return Object.values(display.partsByFormula)
    .flat()
    .reduce((total, part) => total + part.damage * (part.hits ?? 1), 0);
}

function expectSameDamage(actual: number, expected: number): void {
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual - expected)).toBeLessThan(
    Math.max(1, Math.abs(expected)) * 1e-8
  );
}

function checkCombo(
  tb: TeamBuild,
  combo: ComboFormula,
  charId: string,
  sheets: Record<string, StatSheet>,
  activation: Record<number, BuffActivationMap>,
  ctx = CTX
): DisplayResult {
  const display = tb.getComboDisplayResult(combo, sheets, ctx, activation);
  const expected = tb.getComboDamageResult(combo, sheets, ctx, activation);
  expectSameDamage(display.totalDamage, expected.totalDamage);
  let rendered = 0;
  for (const [key, parts] of Object.entries(display.partsByFormula)) {
    const count = combo.lines
      .filter((line) => `${line.charId}.${line.formulaId}` === key)
      .reduce((sum, line) => sum + line.count, 0);
    rendered +=
      count *
      parts.reduce((sum, part) => sum + part.damage * (part.hits ?? 1), 0);
  }
  expectSameDamage(rendered, expected.totalDamage);
  const compiled = compileComboTeamDamage(
    tb,
    combo,
    charId,
    sheets,
    ctx,
    Object.fromEntries(
      Object.entries(activation).map(([index, value]) => [
        `line:${index}`,
        value,
      ])
    )
  );
  const vars = new Float64Array(compiled.numVars);
  fillVarsFromSheet(
    sheets[charId],
    compiled.varMapping,
    compiled.charIdxMap?.get(charId) ?? 0,
    vars
  );
  expectSameDamage(compiled.evaluate(vars), expected.totalDamage);
  return display;
}

/** Verify the payload actually rendered by DamageCard, not only totalDamage.
 * The old bug left totalDamage correct while replacing its rendered parts with
 * direct damage. Comparing only public totals cannot catch that regression. */
function checkSingle(
  tb: TeamBuild,
  charId: string,
  formulaId: string,
  sheets: Record<string, StatSheet>,
  reaction: ReactionOverride,
  activation: BuffActivationMap,
  ctx = CTX,
  forceOnField?: boolean
): DisplayResult {
  const combo = singleFormulaCombo(charId, formulaId, reaction, forceOnField);
  const calculated = tb.getComboDamageResult(combo, sheets, ctx, {
    0: activation,
  }).totalDamage;
  const comboDisplay = tb.getComboDisplayResult(combo, sheets, ctx, {
    0: activation,
  });
  const singleDisplay = tb.getDisplayResult(
    charId,
    formulaId,
    sheets,
    ctx,
    reaction,
    undefined,
    activation,
    forceOnField
  );
  for (const display of [comboDisplay, singleDisplay]) {
    expectSameDamage(display.totalDamage, calculated);
    expectSameDamage(renderedDamage(display), calculated);
  }
  const comboParts = Object.values(comboDisplay.partsByFormula).flat();
  const singleParts = Object.values(singleDisplay.partsByFormula).flat();
  expect(comboParts.map((p) => [p.template, p.tag, p.params])).toEqual(
    singleParts.map((p) => [p.template, p.tag, p.params])
  );

  const compiled = compileComboTeamDamage(tb, combo, charId, sheets, ctx, {
    "line:0": activation,
  });
  const vars = new Float64Array(compiled.numVars);
  fillVarsFromSheet(
    sheets[charId],
    compiled.varMapping,
    compiled.charIdxMap?.get(charId) ?? 0,
    vars
  );
  expectSameDamage(compiled.evaluate(vars), calculated);
  return comboDisplay;
}

describe("reaction display with buff activation", () => {
  it.each(["none", "vaporize", "melt"] as const)(
    "retains Hu Tao %s damage and formula when Scroll is disabled or enabled",
    (reaction) => {
      const tb = new TeamBuild(HU_TAO_TEAM);
      const sheets = sheetsFor(tb);
      const key = buffKey(tb, SCROLL);
      for (const hits of [0, 0.5, 1]) {
        const display = checkSingle(
          tb,
          "hu_tao",
          "hutao-charged",
          sheets,
          { reaction },
          { [key]: { 0: hits } }
        );
        const part = display.partsByFormula["hu_tao.hutao-charged"][0];
        expect(part.template).toBe(reaction === "none" ? "direct" : "amplify");
        expect(part.tag?.reaction).toBe(reaction);
        if (reaction !== "none") {
          expect(part.params.reactionCoeff).toBe(
            reaction === "vaporize" ? 1.5 : 2
          );
        }
      }
    }
  );

  it("retains different per-part reactions when a buff is disabled", () => {
    const tb = new TeamBuild([
      slot("diluc", "wolfs_gravestone"),
      slot("xingqiu", "sacrificial_sword"),
      slot("bennett", "aquila_favonia"),
    ]);
    const display = checkSingle(
      tb,
      "diluc",
      "diluc-skill",
      sheetsFor(tb),
      { reaction: "vaporize", rxnParts: { 1: "none", 2: "melt" } },
      { [buffKey(tb, "bennett")]: { 0: 0, 1: 0, 2: 0 } }
    );
    expect(
      display.partsByFormula["diluc.diluc-skill"].map((p) => p.tag?.reaction)
    ).toEqual(["vaporize", "none", "melt"]);
  });

  it("preserves off-field context and forceOnField while rebuilding parts", () => {
    const tb = new TeamBuild([
      slot("furina", "splendor_of_tranquil_waters"),
      slot("nahida", "a_thousand_floating_dreams"),
      slot("bennett", "aquila_favonia"),
      slot("hu_tao", "staff_of_homa"),
    ]);
    const sheets = sheetsFor(tb);
    sheets.nahida = new StatSheet([{ key: "em", value: 1000 }]);
    const key = buffKey(tb, "nahida");
    for (const forceOnField of [false, true]) {
      for (const hits of [0, 0.5, 1]) {
        const display = checkSingle(
          tb,
          "furina",
          "furina-salon-total",
          sheets,
          { reaction: "vaporize" },
          { [key]: { 0: hits * 18, 1: hits * 9, 2: hits * 5 } },
          CTX,
          forceOnField
        );
        for (const part of display.partsByFormula[
          "furina.furina-salon-total"
        ]) {
          expect(part.template).toBe("amplify");
          expect(part.params.reactionCoeff).toBe(2);
        }
      }
    }
  });

  it("keeps reacting and direct subparts separate under partial activation", () => {
    const tb = new TeamBuild([
      slot("yae_miko", "kaguras_verity"),
      slot("nahida", "a_thousand_floating_dreams"),
      slot("bennett", "aquila_favonia"),
    ]);
    for (const hits of [0, 1, 2, 3]) {
      const display = checkSingle(
        tb,
        "yae_miko",
        "yae_miko-burst",
        sheetsFor(tb),
        { reaction: "aggravate", rxnPartHits: { 1: 2 } },
        { [buffKey(tb, "bennett")]: { 0: 0, 1: hits } }
      );
      const parts = display.partsByFormula["yae_miko.yae_miko-burst"];
      expect(parts.map((p) => [p.template, p.hits])).toEqual([
        ["catalyze", 1],
        ["catalyze", 2],
        ["direct", 1],
      ]);
    }
  });

  it("treats an omitted repeated-line override as fully active", () => {
    const tb = new TeamBuild(HU_TAO_TEAM);
    const sheets = sheetsFor(tb);
    const combo: ComboFormula = {
      id: "repeated",
      label: { en: "Repeated", zh: "重复" },
      lines: [
        {
          charId: "hu_tao",
          formulaId: "hutao-charged",
          count: 2,
          reaction: { reaction: "vaporize" },
        },
        {
          charId: "hu_tao",
          formulaId: "hutao-charged",
          count: 3,
          reaction: { reaction: "vaporize" },
        },
      ],
    };
    const activation = { 0: { [buffKey(tb, SCROLL)]: { 0: 0 } } };
    checkCombo(tb, combo, "hu_tao", sheets, activation);
  });

  it("seeded fuzz: repeated formulas preserve line reactions, field contexts and per-cast activation", () => {
    const { seed, runs } = fuzzConfig(0x72a4c131, 40);
    let state = seed;
    function random(): number {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    }
    const tb = new TeamBuild([
      slot("furina", "splendor_of_tranquil_waters"),
      slot("nahida", "a_thousand_floating_dreams"),
      slot("hu_tao", "staff_of_homa"),
    ]);
    const key = buffKey(tb, "nahida");
    for (let trial = 0; trial < runs; trial++) {
      const sheets = sheetsFor(tb);
      sheets.nahida = new StatSheet([
        { key: "em", value: 100 + random() * 1000 },
      ]);
      sheets.furina = new StatSheet([
        { key: "hp%", value: random() * 2 },
        { key: "cr", value: random() },
        { key: "cd", value: random() * 3 },
      ]);
      const combo: ComboFormula = {
        id: "repeated-fuzz",
        label: { en: "Repeated", zh: "重复" },
        lines: Array.from({ length: 2 }, () => ({
          charId: "furina",
          formulaId: "furina-salon-total",
          count: 1 + Math.floor(random() * 4),
          forceOnField: random() < 0.5,
          reaction: {
            reaction: random() < 0.5 ? "none" : "vaporize",
            rxnPartHits: {
              0: Math.floor(random() * 19),
              1: Math.floor(random() * 10),
              2: Math.floor(random() * 6),
            },
          },
        })),
      };
      // Alternating sparse/explicit overrides exercises the default fully-on line.
      const activation: Record<number, BuffActivationMap> = {
        0: {
          [key]: {
            0: Math.floor(random() * 19),
            1: Math.floor(random() * 10),
            2: Math.floor(random() * 6),
          },
        },
      };
      if (trial % 2) activation[1] = { [key]: { 0: 0, 1: 0, 2: 0 } };
      const ctx = {
        ...CTX,
        enemyLevel: 70 + Math.floor(random() * 61),
        enemyRes: random() * 1.2 - 0.3,
      };
      try {
        checkCombo(tb, combo, "furina", sheets, activation, ctx);
      } catch (error) {
        throw new Error(
          `seed=${seed}, trial=${trial}, combo=${JSON.stringify(combo)}, activation=${JSON.stringify(activation)}, ctx=${JSON.stringify(ctx)}`,
          { cause: error }
        );
      }
    }
  });

  it("seeded fuzz: rendered reaction splits agree with calculator and compiler", () => {
    const { seed, runs } = fuzzConfig(0x51a7c1a1, 120);
    let state = seed;
    function random(): number {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    }
    const hutao = new TeamBuild(HU_TAO_TEAM);
    const yae = new TeamBuild([
      slot("yae_miko", "kaguras_verity"),
      slot("nahida", "a_thousand_floating_dreams"),
      slot("bennett", "aquila_favonia"),
    ]);
    for (let trial = 0; trial < runs; trial++) {
      const split = trial % 2 === 1;
      const tb = split ? yae : hutao;
      const charId = split ? "yae_miko" : "hu_tao";
      const formulaId = split ? "yae_miko-burst" : "hutao-charged";
      const sheets = sheetsFor(tb);
      sheets[charId] = new StatSheet([
        { key: "atk%", value: random() * 2 },
        { key: "hp%", value: random() * 2 },
        { key: "em", value: random() * 1000 },
        { key: "cr", value: random() },
        { key: "cd", value: random() * 3 },
      ]);
      const reaction: ReactionOverride = split
        ? {
            reaction: "aggravate",
            rxnPartHits: { 1: Math.floor(random() * 4) },
          }
        : { reaction: (["none", "vaporize", "melt"] as const)[trial % 3] };
      const key = buffKey(tb, split ? "bennett" : SCROLL);
      const activation: BuffActivationMap = {
        [key]: split
          ? { 0: Math.floor(random() * 2), 1: Math.floor(random() * 4) }
          : { 0: Math.floor(random() * 3) / 2 },
      };
      const ctx = {
        ...CTX,
        enemyLevel: 70 + Math.floor(random() * 61),
        enemyRes: random() * 1.2 - 0.3,
      };
      try {
        checkSingle(tb, charId, formulaId, sheets, reaction, activation, ctx);
      } catch (error) {
        throw new Error(
          `seed=${seed}, trial=${trial}, charId=${charId}, formulaId=${formulaId}, reaction=${JSON.stringify(reaction)}, activation=${JSON.stringify(activation)}, ctx=${JSON.stringify(ctx)}`,
          { cause: error }
        );
      }
    }
  });
});
