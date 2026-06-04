import { describe, expect, it } from "vitest";
import { migrateScoreUpSettingsStore } from "@/stores/migration/scoreUpSettings";

describe("migrateScoreUpSettingsStore", () => {
  it("adds frozen-artifact protection to v1 profile settings", () => {
    const result = migrateScoreUpSettingsStore(
      {
        settingsByProfileId: {
          "0": {
            allowPoolArtifactSteals: false,
            luckExpectationByTier: { S: "hopeful" },
          },
        },
      },
      1
    ) as {
      settingsByProfileId: {
        "0": {
          allowPoolArtifactSteals: boolean;
          respectFrozenArtifacts: boolean;
          luckExpectationByTier: { S: string; A: string };
        };
      };
    };

    expect(result.settingsByProfileId["0"].allowPoolArtifactSteals).toBe(false);
    expect(result.settingsByProfileId["0"].respectFrozenArtifacts).toBe(true);
    expect(result.settingsByProfileId["0"].luckExpectationByTier.S).toBe(
      "hopeful"
    );
    expect(result.settingsByProfileId["0"].luckExpectationByTier.A).toBe(
      "balanced"
    );
  });
});
