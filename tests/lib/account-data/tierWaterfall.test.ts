import { describe, expect, it } from "vitest";
import type { AccountData, TierAssignment } from "@/data/types";
import { runTierWaterfallSteps } from "@/lib/account-data/tierWaterfall";

const accountData: AccountData = {
  characters: [
    {
      key: "higher",
      level: 90,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
      artifacts: {},
    },
    {
      key: "lower",
      level: 90,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
      artifacts: {},
    },
  ],
  extraArtifacts: [],
  extraWeapons: [],
};

describe("runTierWaterfallSteps", () => {
  it("yields completed character tiers from high to low priority", () => {
    const tierAssignments: TierAssignment = {
      lower: { tier: "A", position: 0 },
      higher: { tier: "S", position: 0 },
    };

    const steps = Array.from(
      runTierWaterfallSteps(accountData, {}, tierAssignments)
    );

    expect(steps.map((step) => step.tier)).toEqual(["S", "A"]);
    expect(steps[0].allocation.perCharacter.higher?.tier).toBe("S");
    expect(steps[0].allocation.perCharacter.lower).toBeUndefined();
    expect(steps[1].allocation.perCharacter.lower?.tier).toBe("A");
  });
});
