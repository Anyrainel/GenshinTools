/**
 * Tests for characterEditor.ts — focused on the artifact editing bugs:
 * 1. stripIncompleteNewArtifacts (save-validation logic)
 * 2. characterEditor mutation helpers used by the edit dialog
 */
import { describe, expect, it } from "vitest";

import type { AccountData, ArtifactData } from "@/data/types";
import {
  activateUnactivatedSubstat,
  createAndEquipArtifact,
  equipArtifactFromInventory,
  stripIncompleteNewArtifacts,
  swapArtifactWithCharacter,
  updateArtifactStats,
} from "@/lib/account-data/characterEditor";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeArtifact(overrides: Partial<ArtifactData> = {}): ArtifactData {
  return {
    id: "artifact-0",
    setKey: "crimson_witch_of_flames",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: {
      cr: 10.5,
      cd: 21.0,
      "atk%": 5.8,
      em: 40,
    },
    ...overrides,
  };
}

function makeAccountData(overrides: Partial<AccountData> = {}): AccountData {
  return {
    characters: [
      {
        key: "hu_tao",
        level: 90,
        constellation: 1,
        talent: { auto: 10, skill: 10, burst: 8 },
        artifacts: {
          flower: makeArtifact(),
        },
      },
    ],
    extraArtifacts: [],
    extraWeapons: [],
    ...overrides,
  };
}

// ─── stripIncompleteNewArtifacts ─────────────────────────────────────────────

describe("stripIncompleteNewArtifacts", () => {
  it("returns data unchanged when newlyCreatedIds is empty", () => {
    const data = makeAccountData();
    const result = stripIncompleteNewArtifacts(data, new Set());
    expect(result).toBe(data); // same reference — no clone needed
  });

  it("keeps newly-created artifact with 4 substats and no main-stat dupe", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({ id: "artifact-new" }),
          },
        },
      ],
    });

    const result = stripIncompleteNewArtifacts(data, new Set(["artifact-new"]));
    expect(result.characters[0].artifacts.flower).toBeDefined();
    expect(result.characters[0].artifacts.flower!.id).toBe("artifact-new");
  });

  it("strips newly-created artifact with fewer than 4 substats", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              id: "artifact-new",
              substats: { cr: 10.5, cd: 21.0, "atk%": 5.8 }, // only 3
            }),
          },
        },
      ],
    });

    const result = stripIncompleteNewArtifacts(data, new Set(["artifact-new"]));
    expect(result.characters[0].artifacts.flower).toBeUndefined();
  });

  it("strips newly-created artifact with main-stat dupe in substats", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              id: "artifact-new",
              mainStatKey: "hp",
              substats: { hp: 100, cr: 10, cd: 20, "atk%": 5 }, // hp dupes main
            }),
          },
        },
      ],
    });

    const result = stripIncompleteNewArtifacts(data, new Set(["artifact-new"]));
    expect(result.characters[0].artifacts.flower).toBeUndefined();
  });

  it("does not strip existing artifacts (not in newlyCreatedIds)", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              id: "artifact-existing",
              substats: { cr: 10.5, cd: 21.0 }, // only 2 substats
            }),
          },
        },
      ],
    });

    const result = stripIncompleteNewArtifacts(
      data,
      new Set(["artifact-other"])
    );
    // Existing artifact with 2 substats is not touched
    expect(result.characters[0].artifacts.flower).toBeDefined();
    expect(result.characters[0].artifacts.flower!.id).toBe("artifact-existing");
  });

  it("strips across multiple characters", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              id: "new-1",
              substats: { cr: 10, cd: 20 }, // incomplete
            }),
          },
        },
        {
          key: "xingqiu",
          level: 80,
          constellation: 6,
          talent: { auto: 1, skill: 10, burst: 10 },
          artifacts: {
            flower: makeArtifact({
              id: "new-2",
              substats: { cr: 10, cd: 20, "atk%": 5, em: 40 }, // complete
            }),
          },
        },
      ],
    });

    const result = stripIncompleteNewArtifacts(
      data,
      new Set(["new-1", "new-2"])
    );
    expect(result.characters[0].artifacts.flower).toBeUndefined();
    expect(result.characters[1].artifacts.flower).toBeDefined();
  });
});

// ─── Artifact swap & equip persistence ───────────────────────────────────────

describe("artifact swap and equip (save persistence)", () => {
  it("swapArtifactWithCharacter exchanges artifacts between two characters", () => {
    const artA = makeArtifact({
      id: "art-a",
      setKey: "crimson_witch_of_flames",
    });
    const artB = makeArtifact({
      id: "art-b",
      setKey: "emblem_of_severed_fate",
    });
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: { flower: artA },
        },
        {
          key: "xingqiu",
          level: 80,
          constellation: 6,
          talent: { auto: 1, skill: 10, burst: 10 },
          artifacts: { flower: artB },
        },
      ],
    });

    const result = swapArtifactWithCharacter(
      data,
      "hu_tao",
      "flower",
      "xingqiu",
      "flower"
    );

    // Artifacts are swapped
    expect(result.characters[0].artifacts.flower?.setKey).toBe(
      "emblem_of_severed_fate"
    );
    expect(result.characters[1].artifacts.flower?.setKey).toBe(
      "crimson_witch_of_flames"
    );
  });

  it("equipArtifactFromInventory replaces equipped artifact and moves old to inventory", () => {
    const equipped = makeArtifact({ id: "art-equipped" });
    const inventory = makeArtifact({
      id: "art-inv",
      setKey: "emblem_of_severed_fate",
    });
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: { flower: equipped },
        },
      ],
      extraArtifacts: [inventory],
    });

    const result = equipArtifactFromInventory(
      data,
      "hu_tao",
      "flower",
      "art-inv"
    );

    expect(result.characters[0].artifacts.flower?.id).toBe("art-inv");
    expect(result.extraArtifacts).toHaveLength(1);
    expect(result.extraArtifacts[0].id).toBe("art-equipped");
  });

  it("swapped data differs from initial so onSave would fire", () => {
    const data = makeAccountData();
    const swapped = swapArtifactWithCharacter(
      makeAccountData({
        characters: [
          ...data.characters,
          {
            key: "xingqiu",
            level: 80,
            constellation: 6,
            talent: { auto: 1, skill: 10, burst: 10 },
            artifacts: {
              flower: makeArtifact({
                id: "art-b",
                setKey: "emblem_of_severed_fate",
              }),
            },
          },
        ],
      }),
      "hu_tao",
      "flower",
      "xingqiu",
      "flower"
    );

    // The diff check that handleCloseAndSave uses
    expect(JSON.stringify(swapped)).not.toBe(JSON.stringify(data));
  });
});

// ─── Substat editing on existing artifacts ───────────────────────────────────

describe("updateArtifactStats (substat editing)", () => {
  it("can add a 4th substat to an existing +0 artifact with 3 substats", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              level: 0,
              substats: { cr: 3.9, cd: 7.8, em: 23 }, // 3 substats
            }),
          },
        },
      ],
    });

    const result = updateArtifactStats(data, "hu_tao", "flower", {
      substats: { cr: 3.9, cd: 7.8, em: 23, "atk%": 5.8 },
    });

    const subs = result.characters[0].artifacts.flower!.substats;
    expect(Object.keys(subs)).toHaveLength(4);
    expect(subs["atk%"]).toBe(5.8);
    // Original substats preserved
    expect(subs.cr).toBe(3.9);
    expect(subs.cd).toBe(7.8);
    expect(subs.em).toBe(23);
  });

  it("updated artifact is not stripped by save validation (not in newlyCreatedIds)", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              id: "existing-art",
              level: 0,
              substats: { cr: 3.9, cd: 7.8, em: 23 }, // 3 substats
            }),
          },
        },
      ],
    });

    // Add a 4th substat
    const updated = updateArtifactStats(data, "hu_tao", "flower", {
      substats: { cr: 3.9, cd: 7.8, em: 23, "atk%": 5.8 },
    });

    // Save validation won't touch it since it's not newly created
    const saved = stripIncompleteNewArtifacts(updated, new Set());
    expect(saved.characters[0].artifacts.flower).toBeDefined();
    expect(
      Object.keys(saved.characters[0].artifacts.flower!.substats)
    ).toHaveLength(4);
  });

  it("existing artifact with 3 substats survives save validation even without adding 4th", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              id: "existing-art",
              level: 0,
              substats: { cr: 3.9, cd: 7.8, em: 23 }, // only 3 substats
            }),
          },
        },
      ],
    });

    // Even with validation, existing artifact is untouched
    const saved = stripIncompleteNewArtifacts(data, new Set());
    expect(saved.characters[0].artifacts.flower).toBeDefined();
    expect(
      Object.keys(saved.characters[0].artifacts.flower!.substats)
    ).toHaveLength(3);
  });
});

// ─── createAndEquipArtifact ──────────────────────────────────────────────────

describe("createAndEquipArtifact", () => {
  it("creates artifact with empty substats", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {},
        },
      ],
    });

    const result = createAndEquipArtifact(
      data,
      "hu_tao",
      "flower",
      "crimson_witch_of_flames",
      "hp"
    );

    const art = result.characters[0].artifacts.flower;
    expect(art).toBeDefined();
    expect(Object.keys(art!.substats)).toHaveLength(0);
  });

  it("moves old artifact to inventory when creating new one in occupied slot", () => {
    const data = makeAccountData(); // has flower equipped

    const result = createAndEquipArtifact(
      data,
      "hu_tao",
      "flower",
      "emblem_of_severed_fate",
      "hp"
    );

    expect(result.characters[0].artifacts.flower?.setKey).toBe(
      "emblem_of_severed_fate"
    );
    expect(result.extraArtifacts).toHaveLength(1);
    expect(result.extraArtifacts[0].setKey).toBe("crimson_witch_of_flames");
  });
});

// ─── updateArtifactStats — unactivatedSubstats ──────────────────────────────

describe("updateArtifactStats (unactivatedSubstats)", () => {
  it("sets unactivatedSubstats on an artifact", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              substats: { cr: 3.9, cd: 7.8, em: 23 },
            }),
          },
        },
      ],
    });

    const result = updateArtifactStats(data, "hu_tao", "flower", {
      unactivatedSubstats: { "atk%": 5.8 },
    });

    const art = result.characters[0].artifacts.flower!;
    expect(art.unactivatedSubstats).toEqual({ "atk%": 5.8 });
  });

  it("clears unactivatedSubstats when set to {}", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              substats: { cr: 3.9, cd: 7.8, em: 23 },
              unactivatedSubstats: { "atk%": 5.8 },
            }),
          },
        },
      ],
    });

    const result = updateArtifactStats(data, "hu_tao", "flower", {
      unactivatedSubstats: {},
    });

    const art = result.characters[0].artifacts.flower!;
    expect(art.unactivatedSubstats).toEqual({});
  });
});

// ─── activateUnactivatedSubstat ─────────────────────────────────────────────

describe("activateUnactivatedSubstat", () => {
  it("moves unactivated substats into activated substats and clears field", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              substats: { cr: 3.9, cd: 7.8, em: 23 },
              unactivatedSubstats: { "atk%": 5.8 },
            }),
          },
        },
      ],
    });

    const result = activateUnactivatedSubstat(data, "hu_tao", "flower");

    const art = result.characters[0].artifacts.flower!;
    expect(art.substats).toEqual({ cr: 3.9, cd: 7.8, em: 23, "atk%": 5.8 });
    expect(art.unactivatedSubstats).toBeUndefined();
  });

  it("no-ops when no unactivated substats exist", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              substats: { cr: 3.9, cd: 7.8, em: 23, "atk%": 5.8 },
            }),
          },
        },
      ],
    });

    const result = activateUnactivatedSubstat(data, "hu_tao", "flower");

    const art = result.characters[0].artifacts.flower!;
    expect(art.substats).toEqual({ cr: 3.9, cd: 7.8, em: 23, "atk%": 5.8 });
    expect(art.unactivatedSubstats).toBeUndefined();
  });
});

// ─── stripIncompleteNewArtifacts — unactivatedSubstats ──────────────────────

describe("stripIncompleteNewArtifacts (unactivatedSubstats)", () => {
  it("keeps new artifact when activated(3) + unactivated(1) = 4", () => {
    const data = makeAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 8 },
          artifacts: {
            flower: makeArtifact({
              id: "artifact-new",
              mainStatKey: "hp",
              substats: { cr: 3.9, cd: 7.8, em: 23 },
              unactivatedSubstats: { "atk%": 5.8 },
            }),
          },
        },
      ],
    });

    const result = stripIncompleteNewArtifacts(data, new Set(["artifact-new"]));
    expect(result.characters[0].artifacts.flower).toBeDefined();
    expect(result.characters[0].artifacts.flower!.id).toBe("artifact-new");
  });
});
