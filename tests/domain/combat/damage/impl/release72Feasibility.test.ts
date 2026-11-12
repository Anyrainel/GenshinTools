import "@/providers/reference/statLoaders";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { WeaponBase } from "@/domain/combat/damage/core/implModel";
import {
  createCharacter,
  createWeapon,
} from "@/domain/combat/damage/core/registry";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import type { CalcContext } from "@/domain/combat/damage/types";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import "@/domain/combat/damage/index";

beforeAll(async () => {
  vi.stubEnv("__BETA_ENABLED_OVERRIDE__", "false");
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

afterAll(() => vi.unstubAllEnvs());

const context: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 1,
  substatBudget: "8_6",
};

function weaponSheet(
  weapon: WeaponBase,
  onField: boolean,
  omitReactionCrit = false
) {
  return weapon.buffs.reduce((sheet, buff) => {
    if (!buff.isApplicable(weapon.charId, weapon.charId, onField)) return sheet;
    return sheet.merge(
      StatSheet.fromEntries(
        buff.staticBuffs.filter(
          (entry) => !omitReactionCrit || entry.key !== "reactionCd"
        ),
        buff.target.filter
      )
    );
  }, new StatSheet([]));
}

describe("official 7.2 combat feasibility", () => {
  it.each([["mitya"], ["mitya", "lisa"], ["mitya", "barbara"]])(
    "limits C0 steady Beacons without Stellar-Conduct generation: %j",
    (...ids) => {
      const character = createCharacter("mitya", 90, 0, new TeamMeta(ids), {
        mitya: "stable",
      });
      const p1 = character.buffs.find((buff) => buff.source.origin === "P1")!;
      expect(p1.staticBuffs).toEqual([{ key: "em", value: 90 }]);
      expect(p1.isApplicable("mitya", ids.at(-1)!, false)).toBe(true);
      expect(character.formulaIds).not.toHaveProperty("mitya-prism-surge");
      const shatter = character.getFormulaEntry("mitya-prism-shatter")!.parts[0]
        .formula;
      expect(shatter.talentMultiplier).toBeCloseTo(1.656 * 3);
      const sheet = new StatSheet([{ key: "em", value: 500 }]);
      const reactive = createCharacter(
        "mitya",
        90,
        0,
        new TeamMeta(["mitya", "qiqi"]),
        { mitya: "stable" }
      );
      const fullShatter = reactive.getFormulaEntry("mitya-prism-shatter")!
        .parts[0].formula;
      expect(shatter.calc(sheet, 90, context)).toBeCloseTo(
        fullShatter.calc(sheet, 90, context) * 0.75
      );
    }
  );

  it("keeps four-Beacon capacity and overflow available with a Cryo teammate or enemy aura", () => {
    for (const meta of [
      new TeamMeta(["mitya", "qiqi"]),
      new TeamMeta(["mitya"], {}, {}, "Cryo"),
    ]) {
      const character = createCharacter("mitya", 90, 0, meta, {
        mitya: "stable",
      });
      expect(meta.hasReaction("stellarConduct")).toBe(true);
      expect(
        character.buffs.find((buff) => buff.source.origin === "P1")!.staticBuffs
      ).toEqual([{ key: "em", value: 120 }]);
      expect(character.formulaIds).toHaveProperty("mitya-prism-surge");
      expect(
        character.getFormulaEntry("mitya-prism-shatter")!.parts[0].formula
          .talentMultiplier
      ).toBeCloseTo(1.656 * 4);
    }
  });

  it("retains the C1+ peak estimate and collapse starter counts", () => {
    for (const constellation of [0, 1, 4, 6]) {
      for (const ids of [["mitya"], ["mitya", "qiqi"]]) {
        const meta = new TeamMeta(ids);
        const collapse = createCharacter("mitya", 90, constellation, meta, {
          mitya: "collapse",
        });
        expect(
          collapse.buffs.find((buff) => buff.source.origin === "P1")
        ).toBeUndefined();
        expect(collapse.combo["mitya-prism-consume"]).toBe(
          constellation >= 1 ? 4 : 3
        );
        if (constellation >= 1) {
          const stable = createCharacter("mitya", 90, constellation, meta, {
            mitya: "stable",
          });
          expect(
            stable.buffs.find((buff) => buff.source.origin === "P1")!
              .staticBuffs
          ).toEqual([{ key: "em", value: 150 }]);
          expect(stable.formulaIds).toHaveProperty("mitya-prism-surge");
          expect(stable.combo["mitya-c4"] ?? 0).toBe(
            constellation >= 4 ? 1 : 0
          );
        }
      }
    }
  });

  it.each([
    [1, 120, 0.36],
    [2, 150, 0.45],
    [3, 180, 0.54],
    [4, 210, 0.63],
    [5, 240, 0.72],
  ])(
    "grants Starsealed Edict R%i Law damage stacks through Electro-Charged and a Burst-created field",
    (refinement, em, reactionCd) => {
      const meta = new TeamMeta(["mitya", "barbara"]);
      expect(meta.hasPolestarField()).toBe(true);
      expect(meta.hasReaction("stellarConduct")).toBe(false);
      expect(meta.hasReaction("electroCharged")).toBe(true);
      const weapon = createWeapon(
        "starsealed_edict",
        refinement,
        "mitya",
        meta
      );
      const character = createCharacter("mitya", 90, 0, meta, {
        mitya: "collapse",
      });
      const formula = character.getFormulaEntry("mitya-prism-consume")!.parts[0]
        .formula;
      const baseline = new StatSheet([
        { key: "em", value: 500 },
        { key: "cr", value: 0.5 },
        { key: "cd", value: 1 },
      ]);
      for (const onField of [true, false]) {
        const sheet = weaponSheet(weapon, onField);
        expect(sheet.get("em", null)).toBe(em);
        expect(sheet.get("reactionCd", formula.tag)).toBeCloseTo(reactionCd);
        // The weapon's field-gated rider reaches the actual inherent reaction
        // formula even though this team cannot trigger Stellar-Conduct.
        const complete = baseline.merge(sheet);
        const withoutRider = baseline.merge(weaponSheet(weapon, onField, true));
        const cd = complete.get("cd", formula.tag);
        expect(
          formula.calc(complete, 90, context) /
            formula.calc(withoutRider, 90, context)
        ).toBeCloseTo((1 + 0.5 * (cd + reactionCd)) / (1 + 0.5 * cd));
        for (const reaction of [
          "electroCharged",
          "superconduct",
          "stellarSwirl",
        ] as const) {
          expect(sheet.get("reactionCd", { ...formula.tag, reaction })).toBe(0);
        }
      }
    }
  );

  it("does not invent Law stacks from a solo Polestar Field or Radiance from ordinary reactions", () => {
    for (const ids of [["mitya"], ["mitya", "lisa"]]) {
      const meta = new TeamMeta(ids);
      expect(meta.hasPolestarField()).toBe(true);
      const sheet = weaponSheet(
        createWeapon("starsealed_edict", 1, "mitya", meta),
        false
      );
      expect(sheet.get("em", null)).toBe(48);
      expect(
        sheet.get("reactionCd", {
          element: "Electro",
          ability: "skill",
          reaction: "stellarConduct",
        })
      ).toBe(0);
    }
    const ordinaryMeta = new TeamMeta(["lisa", "barbara"]);
    const sheet = weaponSheet(
      createWeapon("starsealed_edict", 1, "lisa", ordinaryMeta),
      true
    );
    expect(ordinaryMeta.hasPolestarField()).toBe(false);
    expect(sheet.get("em", null)).toBe(120);
    expect(
      sheet.get("reactionCd", {
        element: "Electro",
        ability: "skill",
        reaction: "stellarConduct",
      })
    ).toBe(0);
  });

  it("requires the wearer to carry Conduct Radiance in the same field-only team", () => {
    const meta = new TeamMeta(["mitya", "barbara", "lisa"]);
    expect(meta.hasPolestarField()).toBe(true);
    expect(meta.hasReaction("stellarConduct")).toBe(false);
    for (const [charId, reactionCd] of [
      ["mitya", 0.36],
      ["lisa", 0],
    ] as const) {
      const sheet = weaponSheet(
        createWeapon("starsealed_edict", 1, charId, meta),
        false
      );
      expect(sheet.get("em", null)).toBe(120);
      expect(
        sheet.get("reactionCd", {
          element: "Electro",
          ability: "skill",
          reaction: "stellarConduct",
        })
      ).toBeCloseTo(reactionCd);
    }
  });

  it("keeps Law EM without a Conduct rider for a Swirl-only carrier", () => {
    const meta = new TeamMeta(["yumemizuki_mizuki", "vesna", "qiqi"]);
    expect(meta.getRadianceState("yumemizuki_mizuki")).toBe("stellarSwirl");
    const sheet = weaponSheet(
      createWeapon("starsealed_edict", 1, "yumemizuki_mizuki", meta),
      true
    );
    expect(sheet.get("em", null)).toBe(120);
    for (const reaction of ["stellarConduct", "stellarSwirl"] as const) {
      expect(
        sheet.get("reactionCd", {
          element: "Anemo",
          ability: "skill",
          reaction,
        })
      ).toBe(0);
    }
  });
});
