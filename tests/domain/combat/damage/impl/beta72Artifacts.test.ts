import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import { createArtifactSet } from "@/domain/combat/damage/core/registry";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
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

describe("Glacier and Snowfield", () => {
  it("labels only the post-Burst bonus as requiring an action", () => {
    const set = createArtifactSet(
      "glacier_and_snowfield",
      "kaeya",
      new TeamMeta(["kaeya"])
    );
    expect(set.buffs.map((buff) => buff.source.triggers ?? [])).toEqual([
      [],
      [],
      ["Q"],
    ]);
  });

  it("keeps the permanent half-set in idle and the post-Burst bonus in combat", () => {
    const build = new TeamBuild([
      {
        charId: "kaeya",
        weaponId: "favonius_sword",
        charLevel: 90,
        constellation: 0,
        refinement: 1,
        artifactSet: { type: "4pc", setId: "glacier_and_snowfield" },
      },
    ]);
    const combat = build.getTeamStats({}, "kaeya").kaeya;
    const idle = build.teamStats.getIdleStats().kaeya;
    for (const sheet of [idle.onField, idle.offField]) {
      expect(sheet.getIdleStats()["cryo%"]).toBeCloseTo(0.15);
    }
    expect(combat.getIdleStats()["cryo%"]).toBeCloseTo(0.45);
    for (const [reaction, bonus] of [
      ["superconduct", 1],
      ["melt", 0.15],
      ["stellarConduct", 0],
      ["vaporize", 0],
    ] as const) {
      expect(
        combat.get("reactionDmg%", {
          element: "Cryo",
          ability: "skill",
          reaction,
        })
      ).toBeCloseTo(bonus);
    }
  });
});
