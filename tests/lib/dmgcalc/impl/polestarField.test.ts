import { beforeAll, describe, expect, it } from "vitest";
import { characterStatsResource } from "@/data/gameStatsLoader";
import { getOptionDef, isChoiceEnabled } from "@/lib/dmgcalc/core/registry";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import "@/lib/dmgcalc";

beforeAll(async () => {
  await characterStatsResource.preload();
});

describe("Polestar Field availability", () => {
  it("separates burst-created fields from reaction capability", () => {
    const team = new TeamMeta(["mitya", "bennett"]);
    expect(team.hasPolestarField()).toBe(true);
    expect(team.hasReaction("stellarConduct")).toBe(false);
    expect(new TeamMeta(["valeriy", "bennett"]).hasPolestarField()).toBe(false);
  });

  it.each([
    ["diona", "stellarConduct"],
    ["beidou", "on"],
    ["wriothesley", "on"],
    ["yae_miko", "on"],
    ["qiqi", "stellarConduct"],
    ["traveler_cryo", "stellarConduct"],
    ["cyno", "on"],
    ["alyosha", "on"],
    ["sandrone", "stellarConduct"],
    ["odette", "stellarConduct"],
  ])("enables %s's field state with Mitya and blocks it without a field", (id, value) => {
    const choice = getOptionDef(id)!.choices.find(
      (entry) => entry.value === value
    )!;
    expect(
      isChoiceEnabled(choice, new TeamMeta(["mitya", id, "bennett"]))
    ).toBe(true);
    expect(isChoiceEnabled(choice, new TeamMeta([id, "bennett"]))).toBe(false);
  });

  it("preserves distinct Swirl Radiance without manufacturing a field", () => {
    const team = new TeamMeta(["vesna", "qiqi"]);
    expect(team.hasReaction("stellarSwirl")).toBe(true);
    expect(team.hasPolestarField()).toBe(false);
    const choices = getOptionDef("qiqi")!.choices;
    expect(
      isChoiceEnabled(
        choices.find((entry) => entry.value === "stellarConduct")!,
        team
      )
    ).toBe(false);
    expect(
      isChoiceEnabled(
        choices.find((entry) => entry.value === "stellarSwirl")!,
        team
      )
    ).toBe(true);
  });
});
