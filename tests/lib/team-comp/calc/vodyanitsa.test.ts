import { beforeAll, expect, it } from "vitest";
import { characterStatsResource } from "@/data/gameStatsLoader";
import { createCharacter } from "@/lib/dmgcalc/core/registry";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import "@/lib/dmgcalc";

beforeAll(async () => {
  await characterStatsResource.preload();
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
