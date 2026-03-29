import { applyJobResults } from "@/lib/artifact-manager/storeSync";
import type { AccountData, ArtifactData } from "@/data/types";
import type {
  Instruction,
  InstructionResult,
} from "@/lib/artifact-manager/types";
import { describe, expect, it } from "vitest";

function makeArtifact(overrides: Partial<ArtifactData> = {}): ArtifactData {
  return {
    id: "art-1",
    setKey: "GladiatorsFinale",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: {},
    ...overrides,
  };
}

function makeInstruction(
  id: string,
  lock: boolean | null = true,
): Instruction {
  return {
    id,
    target: {
      setKey: "GladiatorsFinale",
      slotKey: "flower",
      rarity: 5,
      level: 20,
      mainStatKey: "hp",
      substats: [],
    },
    changes: { lock },
  };
}

function makeResult(
  id: string,
  status: InstructionResult["status"] = "success",
): InstructionResult {
  return { id, status };
}

function makeAccount(overrides: Partial<AccountData> = {}): AccountData {
  return {
    characters: [],
    extraArtifacts: [],
    extraWeapons: [],
    ...overrides,
  };
}

describe("applyJobResults", () => {
  it("flips lock state for successful lock instructions on extraArtifacts", () => {
    const account = makeAccount({
      extraArtifacts: [makeArtifact({ id: "a1", lock: false })],
    });
    const instructions = [makeInstruction("a1", true)];
    const results = [makeResult("a1", "success")];

    const updated = applyJobResults(account, instructions, results);

    expect(updated.extraArtifacts[0].lock).toBe(true);
  });

  it("flips lock state for equipped artifacts on a character", () => {
    const account = makeAccount({
      characters: [
        {
          key: "Furina",
          constellation: 0,
          level: 90,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {
            flower: makeArtifact({ id: "eq1", lock: true }),
          },
        },
      ],
    });
    const instructions = [makeInstruction("eq1", false)];
    const results = [makeResult("eq1", "success")];

    const updated = applyJobResults(account, instructions, results);

    expect(updated.characters[0].artifacts.flower!.lock).toBe(false);
  });

  it("skips non-success results (e.g. not_found)", () => {
    const account = makeAccount({
      extraArtifacts: [makeArtifact({ id: "a1", lock: false })],
    });
    const instructions = [makeInstruction("a1", true)];
    const results = [makeResult("a1", "not_found")];

    const updated = applyJobResults(account, instructions, results);

    expect(updated.extraArtifacts[0].lock).toBe(false);
  });

  it('treats "already_correct" as success for lock sync', () => {
    const account = makeAccount({
      extraArtifacts: [makeArtifact({ id: "a1", lock: false })],
    });
    const instructions = [makeInstruction("a1", true)];
    const results = [makeResult("a1", "already_correct")];

    const updated = applyJobResults(account, instructions, results);

    expect(updated.extraArtifacts[0].lock).toBe(true);
  });

  it("returns original account unchanged when no successful results", () => {
    const account = makeAccount({
      extraArtifacts: [makeArtifact({ id: "a1", lock: false })],
    });
    const instructions = [makeInstruction("a1", true)];
    const results = [makeResult("a1", "not_found")];

    const updated = applyJobResults(account, instructions, results);

    expect(updated).toBe(account); // same reference
  });

  it("does not mutate the input account object", () => {
    const original = makeArtifact({ id: "a1", lock: false });
    const account = makeAccount({
      extraArtifacts: [original],
    });
    const instructions = [makeInstruction("a1", true)];
    const results = [makeResult("a1", "success")];

    const updated = applyJobResults(account, instructions, results);

    // Original artifact unchanged
    expect(original.lock).toBe(false);
    expect(account.extraArtifacts[0].lock).toBe(false);
    // Updated has the new value
    expect(updated.extraArtifacts[0].lock).toBe(true);
  });
});
