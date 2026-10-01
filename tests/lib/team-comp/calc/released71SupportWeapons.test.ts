import { describe, expect, it } from "vitest";

import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import "@/lib/dmgcalc";
import { createWeapon } from "@/lib/dmgcalc/core/registry";
import {
  getBuffInstanceKey,
  isBuffApplicable,
  ScalingBuff,
  type StatBuff,
} from "@/lib/dmgcalc/core/statBuff";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

function staticValue(buffs: StatBuff[], key: string): number {
  return buffs
    .flatMap((buff) => buff.staticBuffs)
    .filter((entry) => entry.key === key)
    .reduce((sum, entry) => sum + entry.value, 0);
}

describe("Hymn of the Maelstrom", () => {
  it.each([
    1, 2, 3, 4, 5,
  ])("scales three healing stacks and the HP threshold at R%i", (refinement) => {
    const weapon = createWeapon(
      "hymn_of_the_maelstrom",
      refinement,
      "vodyanitsa",
      new TeamMeta(["vodyanitsa"])
    );
    const buffs = weapon.buffs;
    const perStack = [0.04, 0.05, 0.06, 0.07, 0.08][refinement - 1]!;
    expect(staticValue(buffs, "heal%")).toBeCloseTo(perStack);
    expect(staticValue(buffs, "hp%")).toBeCloseTo(3 * perStack);
    const atkBuff = buffs.find(
      (buff): buff is ScalingBuff => buff instanceof ScalingBuff
    )!;
    for (const hp of [30000, 40000]) {
      expect(
        atkBuff.dynamicBuffs(new StatSheet([{ key: "hp", value: hp }]))[0].value
      ).toBe(0);
    }
    expect(
      atkBuff.dynamicBuffs(new StatSheet([{ key: "hp", value: 50000 }]))[0]
        .value
    ).toBeCloseTo(3 * perStack);
    // Each stack reaches its cap at 60k HP; excess HP cannot increase it.
    for (const hp of [60000, 100000]) {
      expect(
        atkBuff.dynamicBuffs(new StatSheet([{ key: "hp", value: hp }]))[0].value
      ).toBeCloseTo(6 * perStack);
    }
  });

  it.each([
    ["vodyanitsa", "kamisato_ayaka"],
    ["vodyanitsa", "vesna", "qiqi"],
  ])("enhances HP and the ATK rate and cap after Frozen or Stellar Swirl: %j", (...characters) => {
    const buffs = createWeapon(
      "hymn_of_the_maelstrom",
      1,
      "vodyanitsa",
      new TeamMeta(characters)
    ).buffs;
    expect(staticValue(buffs, "heal%")).toBeCloseTo(0.04);
    expect(staticValue(buffs, "hp%")).toBeCloseTo(0.21);
    const atkBuff = buffs.find(
      (buff): buff is ScalingBuff => buff instanceof ScalingBuff
    )!;
    expect(
      atkBuff.dynamicBuffs(new StatSheet([{ key: "hp", value: 50000 }]))[0]
        .value
    ).toBeCloseTo(0.21);
    expect(
      atkBuff.dynamicBuffs(new StatSheet([{ key: "hp", value: 100000 }]))[0]
        .value
    ).toBeCloseTo(0.42);
    expect(atkBuff.source.noStackId).toBeTruthy();
    expect(isBuffApplicable(atkBuff, "vodyanitsa", "vesna", true)).toBe(true);
    expect(isBuffApplicable(atkBuff, "vodyanitsa", "vesna", false)).toBe(false);
    expect(isBuffApplicable(atkBuff, "vodyanitsa", "vodyanitsa", true)).toBe(
      true
    );
    const hpBuff = buffs.find((buff) =>
      buff.staticBuffs.some((entry) => entry.key === "hp%")
    )!;
    expect(isBuffApplicable(hpBuff, "vodyanitsa", "vodyanitsa", false)).toBe(
      true
    );
  });

  it("keeps only Healing Bonus when a non-healing wielder has a healer teammate", () => {
    const buffs = createWeapon(
      "hymn_of_the_maelstrom",
      5,
      "lisa",
      new TeamMeta(["lisa", "vodyanitsa", "kamisato_ayaka"])
    ).buffs;
    expect(buffs).toHaveLength(1);
    expect(staticValue(buffs, "heal%")).toBeCloseTo(0.08);
    expect(staticValue(buffs, "hp%")).toBe(0);
  });

  it("accepts a reaction triggered by teammates outside the wielder's element", () => {
    const buffs = createWeapon(
      "hymn_of_the_maelstrom",
      1,
      "baizhu",
      new TeamMeta(["baizhu", "xingqiu", "kamisato_ayaka"])
    ).buffs;
    expect(staticValue(buffs, "hp%")).toBeCloseTo(0.21);
  });

  it.each([
    "neuvillette",
    "wriothesley",
  ])("allows %s to trigger healing stacks by restoring their own HP", (charId) => {
    const meta = new TeamMeta([charId]);
    expect(meta.isHealer[charId]).toBe(false);
    const buffs = createWeapon("hymn_of_the_maelstrom", 1, charId, meta).buffs;
    // Neuvillette absorbs healing droplets; Wriothesley's enhanced charged
    // attack heals himself. Peak action stacks follow the same model as healers.
    expect(staticValue(buffs, "hp%")).toBeCloseTo(0.12);
    expect(buffs.some((buff) => buff instanceof ScalingBuff)).toBe(true);
  });

  it("scales the active teammate's ATK from the wielder's HP including the weapon's HP buff", () => {
    const team = new TeamBuild([
      {
        charId: "vodyanitsa",
        charLevel: 90,
        constellation: 0,
        weaponId: "hymn_of_the_maelstrom",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "kamisato_ayaka",
        charLevel: 90,
        constellation: 0,
        weaponId: "favonius_sword",
        refinement: 1,
        artifactSet: null,
      },
    ]);
    const artifacts = {
      vodyanitsa: new StatSheet([{ key: "hp", value: 25000 }]),
      kamisato_ayaka: new StatSheet([]),
    };
    const atkEntry = team.buffLedger.allBuffs.find(
      (entry) =>
        entry.buff.source.id === "hymn_of_the_maelstrom" &&
        entry.buff instanceof ScalingBuff
    )!;
    const withoutAtk = team.getTeamStatsExcluding(
      artifacts,
      "kamisato_ayaka",
      undefined,
      new Set([getBuffInstanceKey(atkEntry.buff, "vodyanitsa")])
    );
    const withAtk = team.getTeamStats(artifacts, "kamisato_ayaka");
    const hp = withAtk.vodyanitsa.get("hp", null);
    expect(hp).toBeGreaterThan(40000);
    expect(hp).toBeLessThan(60000);
    const expectedBonus = Math.min((hp - 40000) * 0.000021, 0.42);
    expect(
      withAtk.kamisato_ayaka.get("atk", null) -
        withoutAtk.kamisato_ayaka.get("atk", null)
    ).toBeCloseTo(withAtk.kamisato_ayaka.getRaw("baseAtk") * expectedBonus);
    expect(withAtk.vodyanitsa.get("atk", null)).toBeCloseTo(
      withoutAtk.vodyanitsa.get("atk", null)
    );
  });
});

describe("Winter's Heavy Heart", () => {
  it.each([
    1, 2, 3, 4, 5,
  ])("counts Cryo and Electro party members including the wielder at R%i", (refinement) => {
    const buffs = createWeapon(
      "winters_heavy_heart",
      refinement,
      "lisa",
      new TeamMeta(["lisa", "fischl", "kamisato_ayaka", "qiqi"])
    ).buffs;
    expect(staticValue(buffs, "em")).toBe(
      2 * [24, 30, 36, 42, 48][refinement - 1]!
    );
    expect(staticValue(buffs, "atk%")).toBeCloseTo(
      2 * [0.048, 0.06, 0.072, 0.084, 0.096][refinement - 1]!
    );
    expect(staticValue(buffs, "reactionDmg%")).toBe(0);
  });

  it.each([
    1, 2, 3, 4, 5,
  ])("replaces the base branch with Stellar bonuses under Radiance at R%i", (refinement) => {
    const buffs = createWeapon(
      "winters_heavy_heart",
      refinement,
      "lisa",
      new TeamMeta(["lisa", "odette", "qiqi", "fischl"]),
      { winters_heavy_heart: "on" }
    ).buffs;
    expect(staticValue(buffs, "em")).toBe(
      4 * [20, 25, 30, 35, 40][refinement - 1]!
    );
    expect(staticValue(buffs, "atk%")).toBe(0);
    expect(staticValue(buffs, "reactionDmg%")).toBeCloseTo(
      4 * [0.06, 0.075, 0.09, 0.105, 0.12][refinement - 1]!
    );
    expect(
      buffs.find((buff) =>
        buff.staticBuffs.some((entry) => entry.key === "reactionDmg%")
      )?.target.filter?.reactions
    ).toEqual(["stellarConduct", "stellarSwirl"]);
  });

  it("falls back to the base branch when Radiance is unavailable and ignores other elements", () => {
    const buffs = createWeapon(
      "winters_heavy_heart",
      1,
      "lisa",
      new TeamMeta(["lisa", "kamisato_ayaka", "bennett", "xingqiu"]),
      { winters_heavy_heart: "on" }
    ).buffs;
    expect(staticValue(buffs, "em")).toBe(24);
    expect(staticValue(buffs, "atk%")).toBeCloseTo(0.048);
    expect(staticValue(buffs, "reactionDmg%")).toBe(0);
  });
});

describe("Breezeborne Refrain", () => {
  it.each([
    1, 2, 3, 4, 5,
  ])("grants ER and a team Stellar bonus at R%i", (refinement) => {
    const buffs = createWeapon(
      "breezeborne_refrain",
      refinement,
      "fischl",
      new TeamMeta(["fischl", "vesna"])
    ).buffs;
    expect(staticValue(buffs, "er")).toBeCloseTo(
      [0.2, 0.25, 0.3, 0.35, 0.4][refinement - 1]!
    );
    expect(staticValue(buffs, "reactionDmg%")).toBeCloseTo(
      [0.24, 0.3, 0.36, 0.42, 0.48][refinement - 1]!
    );
    const partyBuff = buffs[1];
    expect(partyBuff.source.noStackId).toBeTruthy();
    expect(partyBuff.target.filter?.reactions).toEqual([
      "stellarConduct",
      "stellarSwirl",
    ]);
    expect(isBuffApplicable(partyBuff, "fischl", "vesna", false)).toBe(true);
    expect(isBuffApplicable(partyBuff, "fischl", "fischl", false)).toBe(true);
  });

  it("honors the selected party buff uptime while preserving unconditional ER", () => {
    const buffs = createWeapon(
      "breezeborne_refrain",
      5,
      "fischl",
      new TeamMeta(["fischl", "vesna"]),
      { breezeborne_refrain: "0.5" }
    ).buffs;
    expect(staticValue(buffs, "er")).toBeCloseTo(0.4);
    expect(staticValue(buffs, "reactionDmg%")).toBeCloseTo(0.24);
  });
});
