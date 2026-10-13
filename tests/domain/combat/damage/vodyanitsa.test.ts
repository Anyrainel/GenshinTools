import "@/providers/reference/statLoaders";
import { beforeAll, expect, it } from "vitest";
import { CharBuild } from "@/domain/combat/damage/core/charBuild";
import { createCharacter } from "@/domain/combat/damage/core/registry";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import "@/domain/combat/damage/index";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

it("includes ascension HP and both HP half sets in Vodyanitsa's idle HP", () => {
  const build = new CharBuild(
    {
      charId: "vodyanitsa",
      charLevel: 90,
      constellation: 0,
      weaponId: "thrilling_tales_of_dragon_slayers",
      refinement: 5,
      artifactSet: { type: "2pc+2pc", halfSetIds: ["hp%-20", "hp%-20"] },
    },
    new TeamMeta(["vodyanitsa"])
  );
  const idle = build.baseStatSheet.mergeEntries([
    { key: "hp%", value: 3 * 0.466 + 0.4 },
    { key: "hp", value: 4780 + 1000 },
  ]);
  expect(idle.get("baseHp", null)).toBe(14818);
  expect(idle.get("hp", null)).toBeCloseTo(
    14818 * (1 + 0.288 + 0.4 + 0.352 + 3 * 0.466 + 0.4) + 5780
  );
});

it("uses released Vodyanitsa talent rows rather than healing, duration, or stamina", () => {
  const character = createCharacter(
    "vodyanitsa",
    90,
    0,
    new TeamMeta(["vodyanitsa"])
  );
  const shred = character.buffs.find((buff) => buff.source.origin === "E");
  expect(shred?.staticBuffs).toEqual([{ key: "resReduction%", value: 0.3 }]);

  const horn = character.getFormulaEntry("vodyanitsa-mic")?.parts[0].formula;
  const initial =
    character.getFormulaEntry("vodyanitsa-skill")?.parts[0].formula;
  expect(horn?.talentMultiplier).toBe(initial?.talentMultiplier);
  expect(horn?.scalingKey).toBe("hp");
  expect(horn?.talentMultiplier).toBeCloseTo(0.058896, 6);

  const plunge = character.getFormulaEntry("vodyanitsa-plunge-high")?.parts[0]
    .formula;
  expect(plunge?.talentMultiplier).toBeCloseTo(2.80568, 5);
});

it.each([
  [false, 0.14, 3500],
  [true, 0.26, 6500],
])(
  "enforces shared P2 stack budgets, HP threshold, and caps in Stellar mode %s",
  (stellar, scale, cap) => {
    const team = new TeamMeta(
      stellar ? ["vodyanitsa", "vesna", "kaeya"] : ["vodyanitsa", "kaeya"]
    );
    const character = createCharacter("vodyanitsa", 90, 0, team);
    const p2 = character.buffs.filter((buff) => buff.source.origin === "P2");
    expect(p2.map((buff) => buff.source.maxStacks)).toEqual([25, 10]);
    expect(p2.map((buff) => buff.target.receiver)).toEqual([
      "teamOnField",
      "teamOffField",
    ]);
    for (const buff of p2) {
      expect(
        buff.dynamicBuffs(new StatSheet([{ key: "hp", value: 40000 }]), [])
      ).toEqual([{ key: "baseDmg", value: 0 }]);
      expect(
        buff.dynamicBuffs(new StatSheet([{ key: "hp", value: 50000 }]), [])
      ).toEqual([{ key: "baseDmg", value: 10000 * scale }]);
      expect(
        buff.dynamicBuffs(new StatSheet([{ key: "hp", value: 100000 }]), [])
      ).toEqual([{ key: "baseDmg", value: cap }]);
    }
  }
);

it("models both C4 healing branches and keeps high HP as the existing default", () => {
  const team = new TeamMeta(["vodyanitsa"]);
  const high = createCharacter("vodyanitsa", 90, 4, team);
  const low = createCharacter("vodyanitsa", 90, 4, team, {
    vodyanitsa: "low",
  });
  expect(
    high.buffs.find((buff) => buff.source.origin === "C4")?.staticBuffs
  ).toEqual([{ key: "hp%", value: 0.6 }]);
  expect(
    low.buffs.find((buff) => buff.source.origin === "C4")?.staticBuffs
  ).toEqual([{ key: "heal%", value: 0.5 }]);
  expect(
    createCharacter("vodyanitsa", 90, 3, team, {
      vodyanitsa: "low",
    }).buffs.some((buff) => buff.source.origin === "C4")
  ).toBe(false);
});
