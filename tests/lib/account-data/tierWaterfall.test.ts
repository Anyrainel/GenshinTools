import { describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type {
  AccountData,
  ArtifactData,
  Build,
  TierAssignment,
} from "@/data/types";
import {
  runTierWaterfall,
  runTierWaterfallSteps,
} from "@/lib/account-data/tierWaterfall";
import { createArtifactScoreResult } from "../../fixtures";

const stepOrderAccountData: AccountData = {
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

const mainStatBySlot: Record<Slot, ArtifactData["mainStatKey"]> = {
  flower: "hp",
  plume: "atk",
  sands: "atk%",
  goblet: "atk%",
  circlet: "cr",
};

function artifact(slot: Slot): ArtifactData {
  return {
    id: `pool-${slot}`,
    setKey: "Main",
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey: mainStatBySlot[slot],
    lock: false,
    substats: { cr: 3.9, cd: 7.8 },
  };
}

const build: Build = {
  id: "main-build",
  characterId: "ranked",
  visible: true,
  name: "Main",
  composition: "4pc",
  artifactSet: "Main",
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
  ],
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "atk%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 1,
};

describe("runTierWaterfallSteps", () => {
  it("yields completed character tiers from high to low priority", () => {
    const tierAssignments: TierAssignment = {
      lower: { tier: "A", position: 0 },
      higher: { tier: "S", position: 0 },
    };

    const steps = Array.from(
      runTierWaterfallSteps(stepOrderAccountData, {}, tierAssignments)
    );

    expect(steps.map((step) => step.tier)).toEqual(["S", "A"]);
    expect(steps[0].allocation.perCharacter.higher?.tier).toBe("S");
    expect(steps[0].allocation.perCharacter.lower).toBeUndefined();
    expect(steps[1].allocation.perCharacter.lower?.tier).toBe("A");
  });
});

describe("runTierWaterfall", () => {
  it("can exclude artifacts equipped by Pool characters from recommendation search", () => {
    const poolArtifacts = Object.fromEntries(
      allSlots.map((slot) => [slot, artifact(slot)])
    ) as Record<Slot, ArtifactData>;
    const accountData: AccountData = {
      characters: [
        {
          key: "ranked",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {},
        },
        {
          key: "pool",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: poolArtifacts,
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };
    const tierAssignments = {
      ranked: { tier: "S", position: 0 },
      pool: { tier: "Pool", position: 0 },
    } as const;
    const scores = {
      ranked: createArtifactScoreResult({
        buildMatch: {
          build,
          statWeights: { cr: 100, cd: 100, "atk%": 80 },
        },
      }),
    };

    const allowed = runTierWaterfall(
      accountData,
      scores,
      tierAssignments,
      {},
      {
        allowPoolArtifactSteals: true,
      }
    );
    const denied = runTierWaterfall(
      accountData,
      scores,
      tierAssignments,
      {},
      {
        allowPoolArtifactSteals: false,
      }
    );

    expect(allowed.perCharacter.ranked.build).not.toBeNull();
    expect(denied.perCharacter.ranked.build).toBeNull();
  });
});
