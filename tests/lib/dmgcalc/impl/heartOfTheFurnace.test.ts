import { beforeAll, describe, expect, it } from "vitest";
import { characterStatsResource } from "@/data/gameStatsLoader";
import { createArtifactSet } from "@/lib/dmgcalc/core/registry";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import "@/lib/dmgcalc";

beforeAll(async () => {
  await characterStatsResource.preload();
});

describe("Heart of the Furnace activation", () => {
  it.each([
    "collapse",
    "stable",
  ])("activates from Mitya's intrinsic Stellar hits in %s without Cryo", (state) => {
    const team = new TeamMeta(["mitya", "bennett"]);
    expect(team.hasReaction("stellarConduct")).toBe(false);
    expect(team.hasReaction("stellarSwirl")).toBe(false);
    const artifact = createArtifactSet("heart_of_the_furnace", "mitya", team, {
      mitya: state,
    });
    expect(artifact.stats).toEqual([]);
    expect(artifact.buffs).toHaveLength(2);
    expect(artifact.buffs[0].target).toEqual({ receiver: "self" });
    expect(artifact.buffs[0].staticBuffs).toEqual([
      { key: "atk%", value: 0.12 },
    ]);
    expect(artifact.buffs[1].target).toEqual({
      receiver: "team",
      filter: { reactions: ["stellarConduct", "stellarSwirl"] },
    });
    expect(artifact.buffs[1].staticBuffs).toEqual([
      { key: "reactionDmg%", value: 0.5 },
    ]);
    expect(artifact.buffs[1].source.noStackId).toBe("heart_of_the_furnace");
  });

  it("honors Cyno's enabled Radiance hits without Cryo", () => {
    const team = new TeamMeta(["mitya", "cyno"]);
    expect(team.hasReaction("stellarConduct")).toBe(false);
    expect(
      createArtifactSet("heart_of_the_furnace", "cyno", team, { cyno: "on" })
        .buffs
    ).toHaveLength(2);
    expect(
      createArtifactSet("heart_of_the_furnace", "cyno", team, { cyno: "off" })
        .buffs
    ).toEqual([]);
    const noField = new TeamMeta(["cyno", "bennett"]);
    expect(
      createArtifactSet("heart_of_the_furnace", "cyno", noField, { cyno: "on" })
        .buffs
    ).toEqual([]);
  });

  it.each([
    0, 6,
  ])("does not grant field-only wearers the effect at C%i", (constellation) => {
    for (const wearer of ["valeriy", "beidou", "bennett"]) {
      const team = new TeamMeta(["mitya", wearer], {
        [wearer]: constellation,
      });
      expect(team.hasPolestarField()).toBe(true);
      expect(
        createArtifactSet("heart_of_the_furnace", wearer, team, {
          valeriy: "stellar-100",
          beidou: "on",
        }).buffs
      ).toEqual([]);
    }
  });

  it.each([
    "fischl",
    "kaeya",
  ])("activates for the Stellar-Conduct participant %s", (wearer) => {
    const team = new TeamMeta(["mitya", "fischl", "kaeya", "bennett"]);
    expect(team.hasReaction("stellarConduct", wearer)).toBe(true);
    expect(
      createArtifactSet("heart_of_the_furnace", wearer, team).buffs
    ).toHaveLength(2);
    expect(
      createArtifactSet("heart_of_the_furnace", "bennett", team).buffs
    ).toEqual([]);
  });

  it("requires Anemo to trigger Stellar Swirl or an enabled direct Stellar hit", () => {
    const team = new TeamMeta(["vesna", "sucrose", "qiqi"]);
    expect(team.hasReaction("stellarSwirl")).toBe(true);
    expect(
      createArtifactSet("heart_of_the_furnace", "sucrose", team).buffs
    ).toHaveLength(2);
    expect(
      createArtifactSet("heart_of_the_furnace", "qiqi", team, {
        qiqi: "stellarSwirl",
      }).buffs
    ).toEqual([]);
  });
});
