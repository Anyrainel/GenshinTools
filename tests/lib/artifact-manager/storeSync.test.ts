import type { AccountData, ArtifactData } from "@/data/types";
import type { IGOODArtifact } from "@/lib/account-data/goodConversion";
import {
  applyJobResults,
  replaceArtifactsFromSnapshot,
} from "@/lib/artifact-manager/storeSync";
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

function makeInstruction(id: string, lock: boolean | null = true): Instruction {
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
  status: InstructionResult["status"] = "success"
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

function makeGOODArtifact(
  overrides: Partial<IGOODArtifact> = {}
): IGOODArtifact {
  return {
    setKey: "GladiatorsFinale",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    location: "",
    lock: true,
    substats: [
      { key: "critRate_", value: 3.9 },
      { key: "critDMG_", value: 7.8 },
    ],
    ...overrides,
  };
}

describe("replaceArtifactsFromSnapshot", () => {
  it("converts GOOD artifacts to internal format and assigns to extraArtifacts", () => {
    const account = makeAccount();
    const snapshot = [makeGOODArtifact()];

    const updated = replaceArtifactsFromSnapshot(account, snapshot);

    expect(updated.extraArtifacts).toHaveLength(1);
    expect(updated.extraArtifacts[0].setKey).toBe("gladiators_finale");
    expect(updated.extraArtifacts[0].slotKey).toBe("flower");
    expect(updated.extraArtifacts[0].lock).toBe(true);
    expect(updated.extraArtifacts[0].substats.cr).toBeDefined();
    expect(updated.extraArtifacts[0].substats.cd).toBeDefined();
  });

  it("assigns artifacts to characters by location", () => {
    const account = makeAccount({
      characters: [
        {
          key: "raiden_shogun",
          constellation: 0,
          level: 90,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {},
        },
      ],
    });
    const snapshot = [
      makeGOODArtifact({ location: "RaidenShogun", slotKey: "flower" }),
      makeGOODArtifact({ location: "", slotKey: "plume" }),
    ];

    const updated = replaceArtifactsFromSnapshot(account, snapshot);

    expect(updated.characters[0].artifacts.flower).toBeDefined();
    expect(updated.characters[0].artifacts.flower!.setKey).toBe(
      "gladiators_finale"
    );
    expect(updated.extraArtifacts).toHaveLength(1);
    expect(updated.extraArtifacts[0].slotKey).toBe("plume");
  });

  it("clears old artifacts from characters before assigning new ones", () => {
    const account = makeAccount({
      characters: [
        {
          key: "raiden_shogun",
          constellation: 0,
          level: 90,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {
            flower: makeArtifact({ id: "old-flower" }),
            plume: makeArtifact({ id: "old-plume", slotKey: "plume" }),
          },
        },
      ],
      extraArtifacts: [makeArtifact({ id: "old-extra" })],
    });
    // Snapshot only has one artifact for the character
    const snapshot = [
      makeGOODArtifact({
        location: "RaidenShogun",
        slotKey: "sands",
        mainStatKey: "enerRech_",
      }),
    ];

    const updated = replaceArtifactsFromSnapshot(account, snapshot);

    // Old artifacts should be gone, only new sands assigned
    expect(updated.characters[0].artifacts.flower).toBeUndefined();
    expect(updated.characters[0].artifacts.plume).toBeUndefined();
    expect(updated.characters[0].artifacts.sands).toBeDefined();
    expect(updated.extraArtifacts).toHaveLength(0);
  });

  it("preserves character and weapon data", () => {
    const account = makeAccount({
      characters: [
        {
          key: "raiden_shogun",
          constellation: 2,
          level: 90,
          talent: { auto: 1, skill: 9, burst: 10 },
          weapon: {
            id: "w1",
            key: "engulfing_lightning",
            level: 90,
            refinement: 1,
            lock: false,
          },
          artifacts: {
            flower: makeArtifact({ id: "old" }),
          },
        },
      ],
      extraWeapons: [
        { id: "w2", key: "the_catch", level: 90, refinement: 5, lock: false },
      ],
    });

    const updated = replaceArtifactsFromSnapshot(account, []);

    expect(updated.characters[0].constellation).toBe(2);
    expect(updated.characters[0].weapon?.key).toBe("engulfing_lightning");
    expect(updated.extraWeapons).toHaveLength(1);
  });

  it("skips artifacts with unrecognized set keys", () => {
    const account = makeAccount();
    const snapshot = [
      makeGOODArtifact({ setKey: "UnknownSetThatDoesNotExist" }),
      makeGOODArtifact({ setKey: "EmblemOfSeveredFate" }),
    ];

    const updated = replaceArtifactsFromSnapshot(account, snapshot);

    expect(updated.extraArtifacts).toHaveLength(1);
    expect(updated.extraArtifacts[0].setKey).toBe("emblem_of_severed_fate");
  });
});
