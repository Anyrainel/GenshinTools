import { beforeAll, describe, expect, it } from "vitest";
import type { ReactionType } from "@/data/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import {
  DirectFormula,
  StellarDirectFormula,
} from "@/lib/dmgcalc/core/damageFormula";
import { createCharacter } from "@/lib/dmgcalc/core/registry";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import type { CalcContext, FormulaEntry } from "@/lib/dmgcalc/types";
import "@/lib/dmgcalc";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

const CTX: CalcContext = {
  enemyLevel: 90,
  enemyRes: 0,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

type RadianceMode = "off" | "stellarSwirl" | "stellarConduct";

function getTravelerEntries(mode: RadianceMode): Record<string, FormulaEntry> {
  const teammate = mode === "stellarSwirl" ? "venti" : "fischl";
  const teamMeta = new TeamMeta(["traveler_cryo", teammate]);
  const traveler = createCharacter(
    "traveler_cryo",
    90,
    0,
    teamMeta,
    { traveler_cryo: mode },
    { auto: 10, skill: 10, burst: 10 }
  );

  return traveler.allFormulaEntries;
}

function expectFreezingIceMultipliers(
  entry: FormulaEntry,
  ordinaryCharge: FormulaEntry,
  reaction: ReactionType
): void {
  expect(entry.parts).toHaveLength(2);
  expect(ordinaryCharge.parts).toHaveLength(2);
  for (const [index, part] of entry.parts.entries()) {
    expect(part.formula.talentMultiplier).toBeCloseTo(
      ordinaryCharge.parts[index].formula.talentMultiplier + 1.4,
      10
    );
  }
  expect(entry.parts.map((part) => part.bespokeBuffs)).toEqual([
    undefined,
    undefined,
  ]);
  for (const part of entry.parts) {
    expect(part.formula.tag).toEqual({
      element: "Cryo",
      ability: "charge",
      reaction,
    });
  }
}

describe("Cryo Traveler P4 Freezing Ice charged attack", () => {
  it("only reports Stellar-Conduct when the team can actually trigger it", () => {
    expect(
      new TeamMeta(["traveler_cryo", "fischl"]).hasReaction("stellarConduct")
    ).toBe(true);
    expect(
      new TeamMeta(["traveler_cryo", "venti"]).hasReaction("stellarConduct")
    ).toBe(false);
    expect(
      new TeamMeta(["traveler_cryo"], {}, {}, "Electro").hasReaction(
        "stellarConduct"
      )
    ).toBe(true);
    expect(
      new TeamMeta(["traveler_cryo"], {}, {}, "Pyro").hasReaction(
        "stellarConduct"
      )
    ).toBe(false);
  });

  it("adds 140% ATK directly to both charged-attack hit multipliers", () => {
    const normalEntries = getTravelerEntries("off");
    const stellarSwirlEntries = getTravelerEntries("stellarSwirl");
    const stellarConductEntries = getTravelerEntries("stellarConduct");
    const normal = normalEntries["traveler-cryo-charge-freezing"];
    const stellarSwirl = stellarSwirlEntries["traveler-cryo-charge-freezing"];
    const stellarConduct =
      stellarConductEntries["traveler-cryo-charge-freezing"];

    expectFreezingIceMultipliers(
      normal,
      normalEntries["traveler-cryo-charge"],
      "none"
    );
    expectFreezingIceMultipliers(
      stellarSwirl,
      stellarSwirlEntries["traveler-cryo-charge"],
      "stellarSwirl"
    );
    expectFreezingIceMultipliers(
      stellarConduct,
      stellarConductEntries["traveler-cryo-charge"],
      "stellarConduct"
    );

    expect(normal.parts[0].formula).toBeInstanceOf(DirectFormula);
    expect(stellarSwirl.parts[0].formula).toBeInstanceOf(StellarDirectFormula);
    expect(stellarConduct.parts[0].formula).toBeInstanceOf(
      StellarDirectFormula
    );
  });

  it("applies ordinary base-DMG multiplier bonuses to the full enhanced multiplier", () => {
    const entries = getTravelerEntries("off");
    const formula = entries["traveler-cryo-charge-freezing"].parts[0].formula;
    const ordinaryMultiplier =
      entries["traveler-cryo-charge"].parts[0].formula.talentMultiplier;
    const stats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "baseDmg%", value: 0.5 },
    ]);

    // Equal levels and 0 RES leave only the ordinary 0.5 DEF multiplier.
    const expected = 1000 * (ordinaryMultiplier + 1.4) * 1.5 * 0.5;
    expect(formula.calc(stats, 90, CTX)).toBeCloseTo(expected);
  });

  it("applies Stellar Swirl zones to the full enhanced multiplier at coefficient 1", () => {
    const entries = getTravelerEntries("stellarSwirl");
    const formula = entries["traveler-cryo-charge-freezing"].parts[0].formula;
    const ordinaryMultiplier =
      entries["traveler-cryo-charge"].parts[0].formula.talentMultiplier;
    const stats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "baseDmg%", value: 0.5 },
      { key: "reactionBaseDmg%", value: 0.2 },
      { key: "reactionDmg%", value: 0.3 },
    ]);

    const expected = 1000 * (ordinaryMultiplier + 1.4) * 1 * 1.5 * 1.2 * 1.3;
    expect(formula.calc(stats, 90, CTX)).toBeCloseTo(expected);
  });

  it("applies Stellar-Conduct coefficient and reaction zones to the full enhanced multiplier", () => {
    const entries = getTravelerEntries("stellarConduct");
    const formula = entries["traveler-cryo-charge-freezing"].parts[0].formula;
    const ordinaryMultiplier =
      entries["traveler-cryo-charge"].parts[0].formula.talentMultiplier;
    const stats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "baseDmg%", value: 0.5 },
      { key: "reactionBaseDmg%", value: 0.2 },
      { key: "reactionDmg%", value: 0.3 },
    ]);
    const maxFieldCtx = { ...CTX, stellarAttachHits: 12 };

    const expected = 1000 * (ordinaryMultiplier + 1.4) * 2 * 1.5 * 1.2 * 1.3;
    expect(formula.calc(stats, 90, maxFieldCtx)).toBeCloseTo(expected);
  });
});
