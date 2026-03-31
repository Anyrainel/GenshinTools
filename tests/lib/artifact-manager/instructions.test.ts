import type { ArtifactData, Slot } from "@/data/types";
import {
  buildEquipInstructions,
  buildTriageInstructions,
} from "@/lib/artifact-manager/instructions";
import { describe, expect, it } from "vitest";

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

describe("buildTriageInstructions", () => {
  it("builds lock instruction when artifact is unlocked and in toLock list", () => {
    const art = makeArtifact({ lock: false });
    const result = buildTriageInstructions([art], []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("art-1");
    expect(result[0].changes).toEqual({ lock: true });
  });

  it("builds unlock instruction when artifact is locked and in toUnlock list", () => {
    const art = makeArtifact({ lock: true });
    const result = buildTriageInstructions([], [art]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("art-1");
    expect(result[0].changes).toEqual({ lock: false });
  });

  it("skips artifacts already in the desired lock state", () => {
    const locked = makeArtifact({ id: "a1", lock: true });
    const unlocked = makeArtifact({ id: "a2", lock: false });
    const result = buildTriageInstructions([locked], [unlocked]);
    expect(result).toHaveLength(0);
  });

  it("converts substats from Record to array format", () => {
    const art = makeArtifact({ substats: { cr: 3.89, cd: 7.77 } });
    const result = buildTriageInstructions([art], []);
    expect(result[0].target.substats).toEqual([
      { key: "cr", value: 3.9 },
      { key: "cd", value: 7.8 },
    ]);
  });

  it("converts setKey from internal to GOOD format", () => {
    const art = makeArtifact({ setKey: "gladiators_finale" });
    const result = buildTriageInstructions([art], []);
    expect(result[0].target.setKey).toBe("GladiatorsFinale");
  });

  it("never sends unlock for toLock list or lock for toUnlock list", () => {
    const a1 = makeArtifact({ id: "a1", lock: false });
    const a2 = makeArtifact({ id: "a2", lock: true });
    const result = buildTriageInstructions([a1], [a2]);
    for (const inst of result) {
      if (inst.id === "a1") expect(inst.changes.lock).toBe(true);
      if (inst.id === "a2") expect(inst.changes.lock).toBe(false);
    }
    expect(result).toHaveLength(2);
  });

  it("handles both lists with multiple artifacts", () => {
    const lock1 = makeArtifact({ id: "l1", lock: false });
    const lock2 = makeArtifact({ id: "l2", lock: false });
    const unlock1 = makeArtifact({ id: "u1", lock: true });
    const result = buildTriageInstructions([lock1, lock2], [unlock1]);
    expect(result).toHaveLength(3);
    expect(result.filter((i) => i.changes.lock === true)).toHaveLength(2);
    expect(result.filter((i) => i.changes.lock === false)).toHaveLength(1);
  });

  it("returns empty when both lists are empty", () => {
    const result = buildTriageInstructions([], []);
    expect(result).toHaveLength(0);
  });
});

describe("buildEquipInstructions", () => {
  it("builds location instructions from frozen artifacts", () => {
    const art = makeArtifact();
    const input: Record<string, Partial<Record<Slot, ArtifactData | null>>> = {
      furina: { flower: art },
    };
    const result = buildEquipInstructions(input);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("art-1");
    expect(result[0].changes).toEqual({ location: "Furina" });
  });

  it("converts character ID to GOOD key for location", () => {
    const art = makeArtifact();
    const input: Record<string, Partial<Record<Slot, ArtifactData | null>>> = {
      raiden_shogun: { flower: art },
    };
    const result = buildEquipInstructions(input);
    expect(result[0].changes.location).toBe("RaidenShogun");
  });

  it("skips null artifact slots", () => {
    const art = makeArtifact();
    const input: Record<string, Partial<Record<Slot, ArtifactData | null>>> = {
      furina: { flower: art, plume: null },
    };
    const result = buildEquipInstructions(input);
    expect(result).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    const result = buildEquipInstructions({});
    expect(result).toHaveLength(0);
  });
});
