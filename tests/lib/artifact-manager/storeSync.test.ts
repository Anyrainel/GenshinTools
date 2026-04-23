import { describe, expect, it } from "vitest";
import type { AccountData, ArtifactData } from "@/data/types";
import type { IGOODArtifact } from "@/lib/account-data/import/goodConversion";
import {
  analyzeManageResults,
  applyEquipResults,
  applyJobResults,
  computeSnapshotDiff,
  rebuildAccountFromSnapshot,
} from "@/lib/account-data/manager/storeSync";
import type {
  EquipPayload,
  InstructionResult,
  ManagePayload,
} from "@/lib/account-data/manager/types";

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

function makePayload(
  lockIds: string[],
  unlockIds: string[] = []
): ManagePayload {
  return {
    request: { lock: [], unlock: [] },
    lockIds,
    unlockIds,
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
  it("flips lock state for successful lock results on extraArtifacts", () => {
    const account = makeAccount({
      extraArtifacts: [makeArtifact({ id: "a1", lock: false })],
    });
    const payload = makePayload(["a1"]);
    const results = [makeResult("lock:0", "success")];

    const updated = applyJobResults(account, payload, results);

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
    const payload = makePayload([], ["eq1"]);
    const results = [makeResult("unlock:0", "success")];

    const updated = applyJobResults(account, payload, results);

    expect(updated.characters[0].artifacts.flower!.lock).toBe(false);
  });

  it("skips non-success results (e.g. not_found)", () => {
    const account = makeAccount({
      extraArtifacts: [makeArtifact({ id: "a1", lock: false })],
    });
    const payload = makePayload(["a1"]);
    const results = [makeResult("lock:0", "not_found")];

    const updated = applyJobResults(account, payload, results);

    expect(updated.extraArtifacts[0].lock).toBe(false);
  });

  it('treats "already_correct" as success for lock sync', () => {
    const account = makeAccount({
      extraArtifacts: [makeArtifact({ id: "a1", lock: false })],
    });
    const payload = makePayload(["a1"]);
    const results = [makeResult("lock:0", "already_correct")];

    const updated = applyJobResults(account, payload, results);

    expect(updated.extraArtifacts[0].lock).toBe(true);
  });

  it("returns original account unchanged when no successful results", () => {
    const account = makeAccount({
      extraArtifacts: [makeArtifact({ id: "a1", lock: false })],
    });
    const payload = makePayload(["a1"]);
    const results = [makeResult("lock:0", "not_found")];

    const updated = applyJobResults(account, payload, results);

    expect(updated).toBe(account); // same reference
  });

  it("does not mutate the input account object", () => {
    const original = makeArtifact({ id: "a1", lock: false });
    const account = makeAccount({
      extraArtifacts: [original],
    });
    const payload = makePayload(["a1"]);
    const results = [makeResult("lock:0", "success")];

    const updated = applyJobResults(account, payload, results);

    // Original artifact unchanged
    expect(original.lock).toBe(false);
    expect(account.extraArtifacts[0].lock).toBe(false);
    // Updated has the new value
    expect(updated.extraArtifacts[0].lock).toBe(true);
  });

  it("handles mixed lock and unlock results", () => {
    const account = makeAccount({
      extraArtifacts: [
        makeArtifact({ id: "a1", lock: false }),
        makeArtifact({ id: "a2", lock: true }),
      ],
    });
    const payload = makePayload(["a1"], ["a2"]);
    const results = [
      makeResult("lock:0", "success"),
      makeResult("unlock:0", "success"),
    ];

    const updated = applyJobResults(account, payload, results);

    expect(updated.extraArtifacts[0].lock).toBe(true);
    expect(updated.extraArtifacts[1].lock).toBe(false);
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

describe("rebuildAccountFromSnapshot", () => {
  it("converts GOOD artifacts to internal format and assigns to extraArtifacts", () => {
    const account = makeAccount();
    const snapshot = [makeGOODArtifact()];

    const { data: updated } = rebuildAccountFromSnapshot(account, snapshot);

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

    const { data: updated } = rebuildAccountFromSnapshot(account, snapshot);

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

    const { data: updated } = rebuildAccountFromSnapshot(account, snapshot);

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

    const { data: updated } = rebuildAccountFromSnapshot(account, []);

    expect(updated.characters[0].constellation).toBe(2);
    expect(updated.characters[0].weapon?.key).toBe("engulfing_lightning");
    expect(updated.extraWeapons).toHaveLength(1);
  });

  it("creates stub character for artifacts equipped on unknown characters", () => {
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
    // "Furina" maps to "furina" via goodKeyToCharId, but furina is not in account
    const snapshot = [
      makeGOODArtifact({ location: "Furina", slotKey: "flower" }),
      makeGOODArtifact({ location: "Furina", slotKey: "plume" }),
      makeGOODArtifact({
        location: "RaidenShogun",
        slotKey: "sands",
        mainStatKey: "enerRech_",
      }),
    ];

    const { data: updated } = rebuildAccountFromSnapshot(account, snapshot);

    // Raiden preserved, Furina stub created
    expect(updated.characters).toHaveLength(2);
    const furina = updated.characters.find((c) => c.key === "furina");
    expect(furina).toBeDefined();
    expect(furina!.level).toBe(90);
    expect(furina!.constellation).toBe(0);
    expect(furina!.talent).toEqual({ auto: 1, skill: 1, burst: 1 });
    expect(furina!.weapon).toBeUndefined();
    expect(furina!.artifacts.flower).toBeDefined();
    expect(furina!.artifacts.plume).toBeDefined();
    // Raiden still gets her artifact
    expect(
      updated.characters.find((c) => c.key === "raiden_shogun")!.artifacts.sands
    ).toBeDefined();
    expect(updated.extraArtifacts).toHaveLength(0);
  });

  it("skips artifacts with unrecognized set keys", () => {
    const account = makeAccount();
    const snapshot = [
      makeGOODArtifact({ setKey: "UnknownSetThatDoesNotExist" }),
      makeGOODArtifact({ setKey: "EmblemOfSeveredFate" }),
    ];

    const { data: updated } = rebuildAccountFromSnapshot(account, snapshot);

    expect(updated.extraArtifacts).toHaveLength(1);
    expect(updated.extraArtifacts[0].setKey).toBe("emblem_of_severed_fate");
  });
});

function makeEquipPayload(
  artifactIds: string[],
  swapMap: Map<string, { fromChar: string | null; toChar: string }>
): EquipPayload {
  return {
    request: { equip: [] },
    artifactIds,
    swapMap,
  };
}

function makeChar(
  key: string,
  artifacts: Partial<Record<string, ArtifactData>> = {}
) {
  return {
    key,
    constellation: 0,
    level: 90,
    talent: { auto: 1, skill: 1, burst: 1 },
    artifacts,
  };
}

describe("applyEquipResults", () => {
  it("moves artifact from one character to another on success", () => {
    const artA = makeArtifact({ id: "artA", slotKey: "flower" });
    const account = makeAccount({
      characters: [
        makeChar("Raiden", { flower: artA }),
        makeChar("Furina", {}),
      ],
    });
    const payload = makeEquipPayload(
      ["artA"],
      new Map([["artA", { fromChar: "Raiden", toChar: "Furina" }]])
    );
    const results = [makeResult("equip:0", "success")];

    const updated = applyEquipResults(account, payload, results);

    expect(updated.characters[1].artifacts.flower).toEqual(artA);
    expect(updated.characters[0].artifacts.flower).toBeUndefined();
  });

  it("performs implicit swap when target character has artifact in same slot", () => {
    const artA = makeArtifact({ id: "artA", slotKey: "flower" });
    const artB = makeArtifact({ id: "artB", slotKey: "flower" });
    const account = makeAccount({
      characters: [
        makeChar("Raiden", { flower: artA }),
        makeChar("Furina", { flower: artB }),
      ],
    });
    const payload = makeEquipPayload(
      ["artA"],
      new Map([["artA", { fromChar: "Raiden", toChar: "Furina" }]])
    );
    const results = [makeResult("equip:0", "success")];

    const updated = applyEquipResults(account, payload, results);

    expect(updated.characters[1].artifacts.flower).toEqual(artA);
    expect(updated.characters[0].artifacts.flower).toEqual(artB);
  });

  it("moves artifact from inventory to character on success", () => {
    const artA = makeArtifact({ id: "artA", slotKey: "plume" });
    const account = makeAccount({
      characters: [makeChar("Furina", {})],
      extraArtifacts: [artA],
    });
    const payload = makeEquipPayload(
      ["artA"],
      new Map([["artA", { fromChar: null, toChar: "Furina" }]])
    );
    const results = [makeResult("equip:0", "success")];

    const updated = applyEquipResults(account, payload, results);

    expect(updated.characters[0].artifacts.plume).toEqual(artA);
    expect(updated.extraArtifacts).toHaveLength(0);
  });

  it("skips not_found results", () => {
    const artA = makeArtifact({ id: "artA", slotKey: "flower" });
    const account = makeAccount({
      extraArtifacts: [artA],
    });
    const payload = makeEquipPayload(
      ["artA"],
      new Map([["artA", { fromChar: null, toChar: "Furina" }]])
    );
    const results = [makeResult("equip:0", "not_found")];

    const updated = applyEquipResults(account, payload, results);

    expect(updated.extraArtifacts).toHaveLength(1);
    expect(updated.extraArtifacts[0].id).toBe("artA");
  });

  it("skips already_correct results", () => {
    const artA = makeArtifact({ id: "artA", slotKey: "flower" });
    const account = makeAccount({
      characters: [makeChar("Furina", { flower: artA })],
    });
    const payload = makeEquipPayload(
      ["artA"],
      new Map([["artA", { fromChar: "Furina", toChar: "Furina" }]])
    );
    const results = [makeResult("equip:0", "already_correct")];

    const updated = applyEquipResults(account, payload, results);

    expect(updated.characters[0].artifacts.flower).toEqual(artA);
  });

  it("does not mutate the input account", () => {
    const artA = makeArtifact({ id: "artA", slotKey: "flower" });
    const artB = makeArtifact({ id: "artB", slotKey: "flower" });
    const account = makeAccount({
      characters: [
        makeChar("Raiden", { flower: artA }),
        makeChar("Furina", { flower: artB }),
      ],
    });
    const payload = makeEquipPayload(
      ["artA"],
      new Map([["artA", { fromChar: "Raiden", toChar: "Furina" }]])
    );
    const results = [makeResult("equip:0", "success")];

    applyEquipResults(account, payload, results);

    // Original account unchanged
    expect(account.characters[0].artifacts.flower).toBe(artA);
    expect(account.characters[1].artifacts.flower).toBe(artB);
  });

  it("handles multiple equip results across characters", () => {
    const artA = makeArtifact({ id: "artA", slotKey: "flower" });
    const artB = makeArtifact({ id: "artB", slotKey: "plume" });
    const account = makeAccount({
      characters: [
        makeChar("Raiden", { flower: artA }),
        makeChar("Furina", {}),
        makeChar("Nahida", {}),
      ],
      extraArtifacts: [artB],
    });
    const payload = makeEquipPayload(
      ["artA", "artB"],
      new Map([
        ["artA", { fromChar: "Raiden", toChar: "Furina" }],
        ["artB", { fromChar: null, toChar: "Nahida" }],
      ])
    );
    const results = [
      makeResult("equip:0", "success"),
      makeResult("equip:1", "success"),
    ];

    const updated = applyEquipResults(account, payload, results);

    expect(updated.characters[0].artifacts.flower).toBeUndefined();
    expect(updated.characters[1].artifacts.flower).toEqual(artA);
    expect(updated.characters[2].artifacts.plume).toEqual(artB);
    expect(updated.extraArtifacts).toHaveLength(0);
  });

  it("sends displaced artifact to extraArtifacts when source is inventory", () => {
    const artA = makeArtifact({ id: "artA", slotKey: "flower" });
    const artB = makeArtifact({ id: "artB", slotKey: "flower" });
    const account = makeAccount({
      characters: [makeChar("Furina", { flower: artB })],
      extraArtifacts: [artA],
    });
    const payload = makeEquipPayload(
      ["artA"],
      new Map([["artA", { fromChar: null, toChar: "Furina" }]])
    );
    const results = [makeResult("equip:0", "success")];

    const updated = applyEquipResults(account, payload, results);

    expect(updated.characters[0].artifacts.flower).toEqual(artA);
    expect(updated.extraArtifacts).toHaveLength(1);
    expect(updated.extraArtifacts[0]).toEqual(artB);
  });
});

describe("computeSnapshotDiff", () => {
  it("counts artifacts and locked artifacts from both local and snapshot", () => {
    const account = makeAccount({
      characters: [
        makeChar("Raiden", {
          flower: makeArtifact({ id: "e1", lock: true }),
          plume: makeArtifact({ id: "e2", slotKey: "plume", lock: false }),
        }),
      ],
      extraArtifacts: [
        makeArtifact({ id: "x1", lock: true }),
        makeArtifact({ id: "x2", lock: false }),
        makeArtifact({ id: "x3", lock: true }),
      ],
    });

    const snapshot: IGOODArtifact[] = [
      makeGOODArtifact({ lock: true }),
      makeGOODArtifact({ lock: true }),
      makeGOODArtifact({ lock: false }),
      makeGOODArtifact({ lock: false }),
    ];

    const diff = computeSnapshotDiff(account, snapshot);

    expect(diff.localCount).toBe(5);
    expect(diff.localLocked).toBe(3);
    expect(diff.snapshotCount).toBe(4);
    expect(diff.snapshotLocked).toBe(2);
  });

  it("handles empty local and snapshot", () => {
    const diff = computeSnapshotDiff(makeAccount(), []);
    expect(diff.localCount).toBe(0);
    expect(diff.snapshotCount).toBe(0);
    expect(diff.localLocked).toBe(0);
    expect(diff.snapshotLocked).toBe(0);
  });
});

describe("analyzeManageResults", () => {
  it("groups results by status", () => {
    const payload = makePayload(["a1", "a2", "a3"], ["b1", "b2"]);
    const results: InstructionResult[] = [
      makeResult("lock:0", "success"),
      makeResult("lock:1", "not_found"),
      makeResult("lock:2", "already_correct"),
      makeResult("unlock:0", "success"),
      makeResult("unlock:1", "ui_error"),
    ];

    const analysis = analyzeManageResults(payload, results);

    expect(analysis.successCount).toBe(2);
    expect(analysis.alreadyCorrectCount).toBe(1);
    expect(analysis.notFoundCount).toBe(1);
    expect(analysis.errorCount).toBe(1);
    expect(analysis.hasDiscrepancies).toBe(true);
  });

  it("returns hasDiscrepancies=false when all succeed", () => {
    const payload = makePayload(["a1"], ["b1"]);
    const results: InstructionResult[] = [
      makeResult("lock:0", "success"),
      makeResult("unlock:0", "success"),
    ];

    const analysis = analyzeManageResults(payload, results);

    expect(analysis.successCount).toBe(2);
    expect(analysis.hasDiscrepancies).toBe(false);
  });

  it("skips results with out-of-range indices", () => {
    const payload = makePayload(["a1"]);
    const results: InstructionResult[] = [
      makeResult("lock:0", "success"),
      makeResult("lock:5", "success"), // out of range
      makeResult("unlock:0", "success"), // no unlock IDs
    ];

    const analysis = analyzeManageResults(payload, results);

    expect(analysis.successCount).toBe(1);
  });
});
