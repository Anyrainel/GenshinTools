import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import { singleFormulaCombo } from "@/domain/combat/damage/core/combo";
import {
  DirectFormula,
  StellarDirectFormula,
} from "@/domain/combat/damage/core/damageFormula";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/domain/combat/damage/core/formulaCompiler";
import type { CharacterBase } from "@/domain/combat/damage/core/implModel";
import { createCharacter } from "@/domain/combat/damage/core/registry";
import {
  getBuffInstanceKey,
  ScalingBuff,
  validateStatBuff,
} from "@/domain/combat/damage/core/statBuff";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import type { CalcContext } from "@/domain/combat/damage/types";
import type { StatKey } from "@/domain/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import "@/domain/combat/damage/index";

beforeAll(() =>
  Promise.all([characterStatsResource.preload(), weaponStatsResource.preload()])
);

function danica(constellation = 0, mode = "battle", ids = ["danica", "kaeya"]) {
  return createCharacter("danica", 90, constellation, new TeamMeta(ids), {
    danica: mode,
  });
}

function anastasya(
  constellation = 0,
  mode = "love-sealed",
  ids = ["anastasya", "kaeya", "fischl", "sucrose"]
) {
  return createCharacter("anastasya", 90, constellation, new TeamMeta(ids), {
    anastasya: mode,
  });
}

function accolade(character: CharacterBase, charId: string, key: StatKey) {
  return character.buffs
    .filter((buff) => buff.target.charId === charId)
    .flatMap((buff) => buff.staticBuffs)
    .filter((entry) => entry.key === key)
    .reduce((sum, entry) => sum + entry.value, 0);
}

const atk2000 = new StatSheet([{ key: "baseAtk", value: 2000 }]);

describe("new beta constellation talent metadata", () => {
  it.each([
    ["danica", "danica-skill", "danica-burst", "danica-normal"],
    ["anastasya", "anastasya-e-tap", "anastasya-q-love", "anastasya-normal"],
  ])(
    "raises only Q at %s C3 and only E at C5",
    (id, skillId, burstId, normalId) => {
      const meta = new TeamMeta([id, "kaeya", "fischl"]);
      const create = (constellation: number) =>
        createCharacter(id, 90, constellation, meta);
      const multiplier = (character: CharacterBase, formulaId: string) =>
        character.getFormulaEntry(formulaId)!.parts[0].formula.talentMultiplier;
      const c0 = create(0);
      const c3 = create(3);
      const c5 = create(5);
      expect(multiplier(c3, burstId)).toBeGreaterThan(multiplier(c0, burstId));
      expect(multiplier(c3, skillId)).toBe(multiplier(c0, skillId));
      expect(multiplier(c5, burstId)).toBe(multiplier(c3, burstId));
      expect(multiplier(c5, skillId)).toBeGreaterThan(multiplier(c3, skillId));
      expect(multiplier(c5, normalId)).toBe(multiplier(c0, normalId));
    }
  );
});

describe("Danica 7.2 beta", () => {
  it("derives mutually exclusive modes and Radiance from the source activation paths", () => {
    const battle = danica();
    expect(battle.formulaIds).toHaveProperty("danica-e2-first");
    expect(battle.formulaIds).not.toHaveProperty("danica-entry");
    expect(
      battle.buffs.find((buff) => buff.source.origin === "P2")!.staticBuffs
    ).toEqual([{ key: "atkSpd%", value: 0.6 }]);
    const defense = danica(0, "defense");
    expect(defense.formulaIds).toHaveProperty("danica-entry");
    expect(defense.formulaIds).not.toHaveProperty("danica-e2-first");
    expect(
      defense.getFormulaEntry("danica-coordinated")!.parts[0].offField
    ).toBe(true);
    expect(defense.combo["danica-coordinated"]).toBe(16);
    const noField = danica(0, "defense", ["danica", "barbara"]);
    expect(noField.getFormulaEntry("danica-burst")!.parts).toHaveLength(3);
    expect(battle.getFormulaEntry("danica-burst")!.parts).toHaveLength(5);
  });

  it.each([
    ["battle", "fischl"],
    ["battle", "kaeya"],
  ])(
    "allows optional off-field coordinated attacks in %s with %s",
    (mode, teammate) => {
      const character = danica(0, mode, ["danica", teammate]);
      expect(character.formulaIds).toHaveProperty("danica-coordinated");
      expect(
        character.getFormulaEntry("danica-coordinated")!.parts[0].offField
      ).toBe(true);
      expect(character.combo["danica-coordinated"] ?? 0).toBe(0);
      expect(character.formulaIds).not.toHaveProperty("danica-entry");
      expect(
        danica(0, "battle", ["danica", "barbara"]).formulaIds
      ).not.toHaveProperty("danica-coordinated");
    }
  );

  it("precharges Defense with own Anchor normals while keeping coordinated attacks element-gated", () => {
    const character = danica(0, "defense", ["danica", "barbara"]);
    expect(character.formulaIds).toHaveProperty("danica-entry");
    expect(character.combo["danica-entry"]).toBe(1);
    expect(character.formulaIds).not.toHaveProperty("danica-coordinated");
    expect(character.combo).not.toHaveProperty("danica-coordinated");
    expect(
      [1, 2, 3, 4].map((stage) => character.combo[`danica-anchor-n${stage}`])
    ).toEqual([1, 1, 1, 1]);
    expect(
      character.buffs.find((buff) => buff.source.origin === "P2")!.staticBuffs
    ).toEqual([{ key: "atk%", value: 0.2 }]);
    expect(danica(0, "defense", ["danica"]).formulaIds).not.toHaveProperty(
      "danica-entry"
    );
    const field = createCharacter(
      "danica",
      90,
      0,
      new TeamMeta(["danica", "barbara"], {}, {}, "Cryo"),
      { danica: "defense" }
    );
    expect(field.formulaIds).toHaveProperty("danica-entry");
    expect(field.formulaIds).not.toHaveProperty("danica-coordinated");
    expect(field.getFormulaEntry("danica-burst")!.parts).toHaveLength(5);
    const qualified = danica(0, "defense", ["danica", "kaeya"]);
    expect(qualified.formulaIds).toHaveProperty("danica-coordinated");
    expect(
      qualified.buffs.find((buff) => buff.source.origin === "P2")!.staticBuffs
    ).toEqual([{ key: "atk%", value: 0.2 }]);
  });

  it("keeps talent rows, repeated hits and the five-E2 Excitement budget distinct", () => {
    const character = danica();
    expect(
      character.getFormulaEntry("danica-skill")!.parts[0].formula
        .talentMultiplier
    ).toBeCloseTo(0.7695, 4);
    const initial =
      character.getFormulaEntry("danica-e2-first")!.parts[0].formula;
    expect(initial).toBeInstanceOf(StellarDirectFormula);
    expect(initial.talentMultiplier).toBeCloseTo(1.4365, 4);
    expect(initial.tag).toEqual({
      element: "Electro",
      ability: "skill",
      reaction: "stellarConduct",
    });
    expect(character.getFormulaEntry("danica-anchor-n3")!.parts[0].hits).toBe(
      2
    );
    expect(
      character.getFormulaEntry("danica-anchor-n3")!.parts[0].formula.tag
        .ability
    ).toBe("normal");
    expect(
      character.combo["danica-e2-first"] + character.combo["danica-e2-battle"]
    ).toBe(5);
    expect(
      [1, 2, 3, 4].map((stage) => character.combo[`danica-anchor-n${stage}`])
    ).toEqual([1, 2, 3, 4]);
    expect(
      character
        .getFormulaEntry("danica-burst")!
        .parts.map((part) => part.hits ?? 1)
    ).toEqual([1, 3, 1, 1, 1]);
  });

  it("scales P3 by 0.7% per 100 ATK and caps team buffs", () => {
    const character = danica(1, "defense");
    const p3 = character.buffs.find(
      (buff) => buff instanceof ScalingBuff && buff.source.origin === "P3"
    )!;
    const [bonus] = p3.dynamicBuffs(
      new StatSheet([{ key: "baseAtk", value: 1000 }]),
      [atk2000]
    );
    expect(bonus.key).toBe("reactionBaseDmg%");
    expect(bonus.value).toBeCloseTo(0.07);
    expect(p3.dynamicBuffs(atk2000, [atk2000])[0].value).toBeCloseTo(0.14);
    expect(
      p3.dynamicBuffs(new StatSheet([{ key: "baseAtk", value: 3000 }]), [
        atk2000,
      ])[0].value
    ).toBe(0.14);
    const q = character.buffs.find((buff) => buff.source.origin === "Q")!;
    expect(q.target.receiver).toBe("team");
    expect(
      q.dynamicBuffs(new StatSheet([{ key: "baseAtk", value: 10000 }]), [
        atk2000,
      ])[0]
    ).toEqual({ key: "atk", value: 900 });
  });

  it("limits individual Toast pools and scopes battle CRIT bonuses to E2", () => {
    const character = danica(6);
    const toast = character.buffs.filter((buff) => buff.source.origin === "C2");
    expect(toast).toHaveLength(1);
    expect(toast[0].target.charId).toBe("kaeya");
    expect(toast[0].source.maxStacks).toBe(7);
    const first =
      character.getFormulaEntry("danica-e2-first")!.parts[0].bespokeBuffs!;
    const next =
      character.getFormulaEntry("danica-e2-battle")!.parts[0].bespokeBuffs!;
    expect(
      first
        .find((buff) => buff.source.origin === "C2")!
        .dynamicBuffs(atk2000, [atk2000])
    ).toEqual([{ key: "baseDmg", value: 21000 }]);
    expect(
      character
        .getFormulaEntry("danica-burst")!
        .parts[3].bespokeBuffs!.find((buff) => buff.source.origin === "C2")!
        .dynamicBuffs(atk2000, [atk2000])
    ).toEqual([{ key: "baseDmg", value: 3000 }]);
    const persistentCrit = character.buffs.filter(
      (buff) => buff instanceof ScalingBuff && buff.source.origin === "C6"
    );
    expect(
      persistentCrit.map((buff) => buff.dynamicBuffs(atk2000, [atk2000])[0])
    ).toEqual([
      { key: "reactionCr", value: 0.1 },
      { key: "reactionCd", value: 1 },
    ]);
    expect(
      persistentCrit.every(
        (buff) =>
          buff.target.receiver === "selfOnField" &&
          JSON.stringify(buff.target.filter) ===
            JSON.stringify({
              abilities: ["skill"],
              reactions: ["stellarConduct"],
            })
      )
    ).toBe(true);
    expect(
      persistentCrit.every(
        (buff) =>
          !buff.isApplicable("danica", "kaeya", true) &&
          !buff.isApplicable("danica", "danica", false)
      )
    ).toBe(true);
    expect(
      danica(6, "defense").buffs.some(
        (buff) =>
          buff instanceof ScalingBuff &&
          ["reactionCr", "reactionCd"].includes(buff.outputKey)
      )
    ).toBe(false);
    expect(next.some((buff) => buff.source.origin === "C2")).toBe(false);
    expect(
      character
        .getFormulaEntry("danica-burst")!
        .parts.every(
          (part) =>
            !part.bespokeBuffs?.some((buff) => buff.source.origin === "C6")
        )
    ).toBe(true);
    expect(
      character.buffs.find((buff) => buff.source.origin === "C6")!.staticBuffs
    ).toEqual([{ key: "elevated%", value: 0.2 }]);
  });

  it("retains C6 CRIT on all four later E2 casts while refunding Toast exactly once in numeric and compiled combos", () => {
    const context: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 1,
      substatBudget: "8_6",
    };
    const build = new TeamBuild(
      [
        {
          charId: "danica",
          charLevel: 90,
          constellation: 6,
          weaponId: "favonius_greatsword",
          refinement: 1,
          artifactSet: null,
        },
      ],
      { danica: "battle" }
    );
    const empty = { danica: new StatSheet([]) };
    build.teamStats.setArtifacts(empty, context);
    const baseAtk = build.teamStats
      .getPostStats("danica", "danica")
      .get("atk", null);
    const sheets = {
      danica: new StatSheet([
        { key: "atk", value: 2000 - baseAtk },
        { key: "cr", value: 0.15 },
      ]),
    };
    build.teamStats.setArtifacts(sheets, context);
    const c6Crit = build.buffLedger.allBuffs.filter(
      ({ buff }) =>
        buff.source.id === "danica" &&
        buff.source.origin === "C6" &&
        buff instanceof ScalingBuff &&
        ["reactionCr", "reactionCd"].includes(buff.outputKey)
    );
    const excluded = new Set(
      c6Crit.map(({ buff, providerCharId }) =>
        getBuffInstanceKey(buff, providerCharId)
      )
    );
    const base = build.teamStats.getPostStats("danica", "danica", excluded);
    const entry = build.catalog.formulaIndex.get("danica-e2-battle")!;
    const tag = entry.parts[0].formula.tag;
    expect(base.get("atk", tag)).toBeCloseTo(2000);
    expect(base.get("cr", tag)).toBeCloseTo(0.2);
    // Independent source reference: every cast receives +10% CR and +100% CD;
    // only one consumes the one-stack refund worth 150% of 2000 ATK.
    const crit = base.merge(
      new StatSheet([
        { key: "cr", value: 0.1 },
        { key: "cd", value: 1 },
      ])
    );
    const refunded = crit.merge(
      new StatSheet([{ key: "baseDmg", value: 3000 }])
    );
    const expected =
      entry.parts[0].formula.calc(crit, 90, context) * 3 +
      entry.parts[0].formula.calc(refunded, 90, context);
    const combo = singleFormulaCombo("danica", "danica-e2-battle");
    combo.lines[0].count = 4;
    const numeric = build.getComboDamageResult(
      combo,
      sheets,
      context
    ).totalDamage;
    const compiled = compileComboTeamDamage(
      build,
      combo,
      "danica",
      sheets,
      context
    );
    const vars = new Float64Array(compiled.numVars);
    fillVarsFromSheet(
      sheets.danica,
      compiled.varMapping,
      compiled.charIdxMap!.get("danica")!,
      vars
    );
    expect(numeric).toBeCloseTo(expected, 6);
    expect(compiled.evaluate(vars)).toBeCloseTo(expected, 6);
    expect(numeric).toBeGreaterThan(0);
    const resolved = build.teamStats.getPostStats("danica", "danica");
    expect(resolved.get("reactionCr", tag)).toBeCloseTo(0.1);
    expect(resolved.get("reactionCd", tag)).toBeCloseTo(1);
    // The same inherent reaction on Q must still fail the Skill-only scope.
    expect(resolved.get("reactionCr", { ...tag, ability: "burst" })).toBe(0);
    expect(resolved.get("reactionCd", { ...tag, ability: "burst" })).toBe(0);
    for (const formulaId of [
      "danica-skill",
      "danica-anchor-n1",
      "danica-burst",
    ]) {
      for (const part of build.catalog.formulaIndex.get(formulaId)!.parts) {
        expect(resolved.get("reactionCr", part.formula.tag)).toBe(0);
        expect(resolved.get("reactionCd", part.formula.tag)).toBe(0);
      }
    }
  });
});

describe("Anastasya 7.2 beta", () => {
  it.each([
    ["stellarConduct", 0.605],
    ["stellarSwirl", 0.907],
  ])(
    "replaces only the final Crown and Honor hits under %s",
    (radiance, crownMultiplier) => {
      const ids =
        radiance === "stellarSwirl"
          ? ["anastasya", "kaeya", "sucrose"]
          : ["anastasya", "kaeya", "fischl", "sucrose"];
      const love = anastasya(0, "love-sealed", ids);
      const crown = love.getFormulaEntry("anastasya-crown")!.parts;
      expect(crown.map((part) => part.hits ?? 1)).toEqual([1, 1, 1]);
      expect(crown.map((part) => part.formula.tag.reaction)).toEqual([
        "none",
        radiance,
        radiance,
      ]);
      expect(crown.every((part) => part.offField)).toBe(true);
      expect(love.combo["anastasya-crown"]).toBe(10);
      expect(crown[1].formula.talentMultiplier).toBeCloseTo(crownMultiplier, 3);
      expect(
        love.buffs.find((buff) => buff.source.origin === "Q")?.staticBuffs
      ).toEqual([{ key: "reactionDmg%", value: 0.3 }]);
      const honor = anastasya(0, "honor-sealed", ids);
      expect(honor.getFormulaEntry("anastasya-honor-n1")!.parts).toHaveLength(
        1
      );
      expect(
        honor.getFormulaEntry("anastasya-honor-n1")!.parts[0].formula
      ).toBeInstanceOf(StellarDirectFormula);
      expect(
        honor
          .getFormulaEntry("anastasya-honor-n4")!
          .parts.map((part) => part.hits ?? 1)
      ).toEqual([2, 1]);
      expect(
        honor
          .getFormulaEntry("anastasya-honor-n4")!
          .parts.every((part) => part.formula.tag.ability === "normal")
      ).toBe(true);
      const off = anastasya(0, "honor-sealed", ["anastasya", "kaeya"]);
      expect(
        off.getFormulaEntry("anastasya-honor-n1")!.parts[0].formula
      ).toBeInstanceOf(DirectFormula);
      expect(off.getFormulaEntry("anastasya-honor-n4")!.parts[0].hits).toBe(3);
      expect(
        off.getFormulaEntry("anastasya-q-honor")!.parts[0].formula.tag.reaction
      ).toBe("stellarConduct");
    }
  );

  it("uses the current ordinary and Stellar rows without combining Doom hits", () => {
    const character = anastasya(0, "honor-sealed");
    expect(
      character.getFormulaEntry("anastasya-e-hold")!.parts[0].formula
        .talentMultiplier
    ).toBeCloseTo(2.837, 3);
    expect(
      character.getFormulaEntry("anastasya-honor-n1")!.parts[0].formula
        .talentMultiplier
    ).toBeCloseTo(0.7058, 4);
    expect(
      character.getFormulaEntry("anastasya-q-honor")!.parts[0].formula
        .talentMultiplier
    ).toBeCloseTo(5.6112, 4);
    const doom = character.getFormulaEntry("anastasya-doom-1")!.parts;
    expect(doom[0].hits).toBe(5);
    expect(doom[0].formula.talentMultiplier).toBeCloseTo(0.481, 3);
    expect(doom[1].formula.talentMultiplier).toBeCloseTo(1.202, 3);
    expect(doom.every((part) => part.formula.tag.ability === "skill")).toBe(
      true
    );
  });

  it("distributes Accolades through Sealing, preserves donors at C1 and multiplies at C4", () => {
    const love0 = anastasya();
    expect(accolade(love0, "anastasya", "cd")).toBe(0);
    expect(accolade(love0, "fischl", "cd")).toBeCloseTo(0.16);
    const honor0 = anastasya(0, "honor-sealed");
    expect(accolade(honor0, "anastasya", "cd")).toBeCloseTo(0.48);
    expect(accolade(honor0, "kaeya", "cd")).toBe(0);
    const love1 = anastasya(1);
    expect(accolade(love1, "anastasya", "cd")).toBeCloseTo(0.12);
    expect(accolade(love1, "kaeya", "atk%")).toBeCloseTo(0.3);
    expect(accolade(love1, "fischl", "em")).toBe(120);
    expect(accolade(anastasya(4), "fischl", "em")).toBe(156);
    const unsealed = anastasya(0, "love-unsealed");
    expect(accolade(unsealed, "anastasya", "cd")).toBeCloseTo(0.12);
    expect(accolade(unsealed, "fischl", "cd")).toBeCloseTo(0.12);
  });

  it("keeps C2's original-DMG bonus off E cast and removes C6 Honor Elevation before Doom", () => {
    const character = anastasya(6, "honor-sealed");
    expect(
      character.getFormulaEntry("anastasya-e-hold")!.parts[0].bespokeBuffs
    ).toBeUndefined();
    const normal =
      character.getFormulaEntry("anastasya-honor-n1")!.parts[0].bespokeBuffs!;
    expect(normal.flatMap((buff) => buff.staticBuffs)).toContainEqual({
      key: "baseDmg%",
      value: 0.25,
    });
    expect(normal.flatMap((buff) => buff.staticBuffs)).toContainEqual({
      key: "elevated%",
      value: 0.2,
    });
    const doom = character.getFormulaEntry("anastasya-doom-1")!.parts;
    expect(
      doom.every((part) =>
        part
          .bespokeBuffs!.flatMap((buff) => buff.staticBuffs)
          .every((entry) => entry.key !== "elevated%")
      )
    ).toBe(true);
    const low = anastasya(0, "honor-sealed");
    expect(
      low.rawComboDescriptor.find((line) => line.id === "anastasya-c6-doom")!
        .count
    ).toBe(0);
    expect(low.combo).not.toHaveProperty("anastasya-c6-doom");
    expect(character.combo["anastasya-c6-doom"]).toBe(1);
    expect(
      character.getFormulaEntry("anastasya-c6-doom")!.parts[0].offField
    ).toBeUndefined();
    expect(
      anastasya(6).getFormulaEntry("anastasya-c6-triumph")!.parts[0].offField
    ).toBe(true);
  });

  it("validates every scoped buff and keeps quantified P2/P3 in separate zones", () => {
    for (const character of [
      danica(6),
      danica(6, "defense"),
      anastasya(6),
      anastasya(6, "honor-sealed", ["anastasya", "sucrose"]),
    ]) {
      for (const buff of [
        ...character.buffs,
        ...character.getBespokeBuffs().map((entry) => entry.buff),
      ]) {
        expect(() =>
          validateStatBuff(buff.staticBuffs, buff.target, buff.source)
        ).not.toThrow();
      }
    }
    const character = anastasya();
    expect(
      character.buffs.find((buff) => buff.source.origin === "P2")!.staticBuffs
    ).toEqual([{ key: "reactionCoeff%", value: 0.15 }]);
    expect(
      character.buffs
        .find(
          (buff) => buff instanceof ScalingBuff && buff.source.origin === "P3"
        )!
        .dynamicBuffs(atk2000, [atk2000])[0].value
    ).toBeCloseTo(0.14);
  });
});
