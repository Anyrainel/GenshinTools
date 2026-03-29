import type { ArtifactData, Slot } from "@/data/types";
import type { TriageDecision } from "@/lib/account-data/triage";
import {
  buildTriageInstructions,
  buildEquipInstructions,
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

function makeDecision(
  overrides: Partial<TriageDecision> & { artifact: ArtifactData; label: "lock" | "unlock" },
): TriageDecision {
  return {
    decidingResult: null,
    allResults: [],
    specialRules: [],
    supplyDemand: null,
    ...overrides,
  };
}

describe("buildTriageInstructions", () => {
  it("builds lock instruction when artifact is unlocked and decision is lock", () => {
    const art = makeArtifact({ lock: false });
    const decisions = [makeDecision({ artifact: art, label: "lock" })];
    const result = buildTriageInstructions(decisions);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("art-1");
    expect(result[0].changes).toEqual({ lock: true });
  });

  it("builds unlock instruction when artifact is locked and decision is unlock", () => {
    const art = makeArtifact({ lock: true });
    const decisions = [makeDecision({ artifact: art, label: "unlock" })];
    const result = buildTriageInstructions(decisions);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("art-1");
    expect(result[0].changes).toEqual({ lock: false });
  });

  it("skips artifacts already in the desired lock state", () => {
    const locked = makeArtifact({ id: "a1", lock: true });
    const unlocked = makeArtifact({ id: "a2", lock: false });
    const decisions = [
      makeDecision({ artifact: locked, label: "lock" }),
      makeDecision({ artifact: unlocked, label: "unlock" }),
    ];
    const result = buildTriageInstructions(decisions);
    expect(result).toHaveLength(0);
  });

  it("converts substats from Record to array format", () => {
    const art = makeArtifact({ substats: { cr: 3.89, cd: 7.77 } });
    const decisions = [makeDecision({ artifact: art, label: "lock" })];
    const result = buildTriageInstructions(decisions);
    expect(result[0].target.substats).toEqual([
      { key: "cr", value: 3.9 },
      { key: "cd", value: 7.8 },
    ]);
  });

  it("converts setKey from internal to GOOD format", () => {
    const art = makeArtifact({ setKey: "gladiators_finale" });
    const decisions = [makeDecision({ artifact: art, label: "lock" })];
    const result = buildTriageInstructions(decisions);
    expect(result[0].target.setKey).toBe("GladiatorsFinale");
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
