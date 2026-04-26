import { describe, expect, it } from "vitest";
import { allSlots } from "@/data/enums";
import type { AccountData, ArtifactData } from "@/data/types";
import type { OptimizedBuild } from "@/lib/account-data/buildOptimizer";
import {
  buildRecommendationEquipInstructions,
  buildTriageInstructions,
} from "@/lib/account-data/manager/instructions";

function makeArtifact(overrides: Partial<ArtifactData> = {}): ArtifactData {
  return {
    id: "art-1",
    setKey: "emblem_of_severed_fate",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp%",
    lock: false,
    substats: { cr: 3.89, cd: 7.77, er: 5.18, atk: 19 },
    ...overrides,
  };
}

function makeOptimizedBuild(
  artifacts: OptimizedBuild["artifacts"]
): OptimizedBuild {
  return {
    artifacts,
    slotScores: {
      flower: 1,
      plume: 1,
      sands: 1,
      goblet: 1,
      circlet: 1,
    },
    rawScore: 5,
    crPenalty: 0,
    finalScore: 5,
    totalArtifactCr: 0,
  };
}

describe("buildTriageInstructions", () => {
  it("builds lock entry when artifact is unlocked and in toLock list", () => {
    const art = makeArtifact({ lock: false });
    const result = buildTriageInstructions([art], []);
    expect(result.request.lock).toHaveLength(1);
    expect(result.request.unlock).toHaveLength(0);
    expect(result.lockIds).toEqual(["art-1"]);
  });

  it("builds unlock entry when artifact is locked and in toUnlock list", () => {
    const art = makeArtifact({ lock: true });
    const result = buildTriageInstructions([], [art]);
    expect(result.request.unlock).toHaveLength(1);
    expect(result.request.lock).toHaveLength(0);
    expect(result.unlockIds).toEqual(["art-1"]);
  });

  it("skips artifacts already in the desired lock state", () => {
    const locked = makeArtifact({ id: "a1", lock: true });
    const unlocked = makeArtifact({ id: "a2", lock: false });
    const result = buildTriageInstructions([locked], [unlocked]);
    expect(result.request.lock).toHaveLength(0);
    expect(result.request.unlock).toHaveLength(0);
  });

  it("converts substats to GOOD format array with rounded values", () => {
    const art = makeArtifact({ substats: { cr: 3.89, cd: 7.77 } });
    const result = buildTriageInstructions([art], []);
    const subs = result.request.lock[0].substats;
    expect(subs).toContainEqual({ key: "critRate_", value: 3.9 });
    expect(subs).toContainEqual({ key: "critDMG_", value: 7.8 });
  });

  it("converts setKey from internal to GOOD format", () => {
    const art = makeArtifact({ setKey: "gladiators_finale" });
    const result = buildTriageInstructions([art], []);
    expect(result.request.lock[0].setKey).toBe("GladiatorsFinale");
  });

  it("converts mainStatKey to GOOD format", () => {
    const art = makeArtifact({ mainStatKey: "hp%" });
    const result = buildTriageInstructions([art], []);
    expect(result.request.lock[0].mainStatKey).toBe("hp_");
  });

  it("never sends unlock for toLock list or lock for toUnlock list", () => {
    const a1 = makeArtifact({ id: "a1", lock: false });
    const a2 = makeArtifact({ id: "a2", lock: true });
    const result = buildTriageInstructions([a1], [a2]);
    expect(result.request.lock).toHaveLength(1);
    expect(result.request.unlock).toHaveLength(1);
    expect(result.lockIds).toEqual(["a1"]);
    expect(result.unlockIds).toEqual(["a2"]);
  });

  it("handles both lists with multiple artifacts", () => {
    const lock1 = makeArtifact({ id: "l1", lock: false });
    const lock2 = makeArtifact({ id: "l2", lock: false });
    const unlock1 = makeArtifact({ id: "u1", lock: true });
    const result = buildTriageInstructions([lock1, lock2], [unlock1]);
    expect(result.request.lock).toHaveLength(2);
    expect(result.request.unlock).toHaveLength(1);
    expect(result.lockIds).toEqual(["l1", "l2"]);
    expect(result.unlockIds).toEqual(["u1"]);
  });

  it("returns empty when both lists are empty", () => {
    const result = buildTriageInstructions([], []);
    expect(result.request.lock).toHaveLength(0);
    expect(result.request.unlock).toHaveLength(0);
  });

  it("includes unactivatedSubstats when present", () => {
    const art = makeArtifact({
      level: 0,
      substats: { cr: 3.89, cd: 7.77, er: 5.18 },
      unactivatedSubstats: { def: 23 },
    });
    const result = buildTriageInstructions([art], []);
    expect(result.request.lock[0].unactivatedSubstats).toEqual([
      { key: "def", value: 23 },
    ]);
  });
});

describe("buildRecommendationEquipInstructions", () => {
  it("builds equip entries from selected best allocation builds", () => {
    const allocatedArtifacts = Object.fromEntries(
      allSlots.map((slot, index) => [
        slot,
        makeArtifact({
          id: `allocated-${slot}`,
          slotKey: slot,
          mainStatKey: index === 1 ? "atk" : "hp%",
        }),
      ])
    ) as OptimizedBuild["artifacts"];
    const currentFlower = makeArtifact({
      id: "current-flower",
      slotKey: "flower",
    });
    const donorFlower = allocatedArtifacts.flower;
    const account: AccountData = {
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 0,
          talent: { auto: 10, skill: 10, burst: 10 },
          weapon: undefined,
          artifacts: { flower: currentFlower },
        },
        {
          key: "xiangling",
          level: 80,
          constellation: 6,
          talent: { auto: 1, skill: 9, burst: 12 },
          weapon: undefined,
          artifacts: { flower: donorFlower },
        },
      ],
      extraArtifacts: allSlots
        .filter((slot) => slot !== "flower")
        .map((slot) => allocatedArtifacts[slot]),
      extraWeapons: [],
    };
    const artifactLookup = new Map(
      Object.values(allocatedArtifacts).map((art) => [art.id, art])
    );

    const result = buildRecommendationEquipInstructions(
      [
        {
          characterId: "hu_tao",
          allocatedBuild: makeOptimizedBuild(allocatedArtifacts),
        },
        { characterId: "xiangling", allocatedBuild: null },
      ],
      account,
      artifactLookup
    );

    expect(result.request.equip).toHaveLength(5);
    expect(result.artifactIds).toEqual(
      allSlots.map((slot) => `allocated-${slot}`)
    );
    expect(result.request.equip[0].location).toBe("HuTao");
    expect(result.swapMap.get("allocated-flower")).toEqual({
      fromChar: "xiangling",
      toChar: "hu_tao",
    });
  });
});
