import {
  buildTeamConfigs,
  detectEquippedSets,
  setsMatch,
} from "@/components/team-comp/teamOptUtils";
import type { ArtifactData, ReactionType } from "@/data/types";
import type { CombatOpts } from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";
import {
  createAccountData,
  createArtifactData,
  createCharacterData,
  createWeaponData,
} from "../../fixtures";

// ── Helpers ────────────────────────────────────────────────────────────────

const CW = "crimson_witch_of_flames";
const GL = "gladiators_finale";
const ESF = "emblem_of_severed_fate";
const WT = "wanderers_troupe";

function makeArtifact(setKey: string, slot = "flower"): ArtifactData {
  return createArtifactData({
    id: `art-${Math.random()}`,
    setKey,
    slotKey: slot as ArtifactData["slotKey"],
  });
}

// ── detectEquippedSets ──────────────────────────────────────────────────────

describe("detectEquippedSets", () => {
  it("detects 4pc set when 4+ pieces match", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      makeArtifact(CW, "plume"),
      makeArtifact(CW, "sands"),
      makeArtifact(CW, "goblet"),
      makeArtifact(GL, "circlet"),
    ];
    const result = detectEquippedSets(arts);
    expect(result.artifactSetId).toBe(CW);
    expect(result.artifactHalfSetIds).toEqual([]);
  });

  it("detects 5pc as 4pc", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      makeArtifact(CW, "plume"),
      makeArtifact(CW, "sands"),
      makeArtifact(CW, "goblet"),
      makeArtifact(CW, "circlet"),
    ];
    const result = detectEquippedSets(arts);
    expect(result.artifactSetId).toBe(CW);
  });

  it("detects 2pc+2pc combo", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      makeArtifact(CW, "plume"),
      makeArtifact(ESF, "sands"),
      makeArtifact(ESF, "goblet"),
      makeArtifact(GL, "circlet"),
    ];
    const result = detectEquippedSets(arts);
    expect(result.artifactSetId).toBeNull();
    expect(result.artifactHalfSetIds).toHaveLength(2);
  });

  it("detects single 2pc bonus", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      makeArtifact(CW, "plume"),
      makeArtifact(ESF, "sands"),
      makeArtifact(GL, "goblet"),
      makeArtifact(WT, "circlet"),
    ];
    const result = detectEquippedSets(arts);
    expect(result.artifactSetId).toBeNull();
    expect(result.artifactHalfSetIds.length).toBeLessThanOrEqual(1);
  });

  it("returns no bonuses for rainbow set", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      makeArtifact(GL, "plume"),
      makeArtifact(ESF, "sands"),
      makeArtifact(WT, "goblet"),
      makeArtifact("thundering_fury", "circlet"),
    ];
    const result = detectEquippedSets(arts);
    expect(result.artifactSetId).toBeNull();
    expect(result.artifactHalfSetIds).toEqual([]);
  });

  it("handles empty array", () => {
    const result = detectEquippedSets([]);
    expect(result.artifactSetId).toBeNull();
    expect(result.artifactHalfSetIds).toEqual([]);
  });

  it("detects single 2pc from partial artifacts (3 pieces)", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      makeArtifact(CW, "plume"),
      makeArtifact(GL, "sands"),
    ];
    const result = detectEquippedSets(arts);
    expect(result.artifactSetId).toBeNull();
    // Single 2pc detected — length 1
    expect(result.artifactHalfSetIds).toHaveLength(1);
  });

  it("handles null/undefined entries in array", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      null,
      undefined,
      makeArtifact(CW, "sands"),
    ];
    const result = detectEquippedSets(
      arts as (ArtifactData | null | undefined)[]
    );
    expect(result.artifactSetId).toBeNull();
    expect(result.artifactHalfSetIds).toHaveLength(1);
  });

  it("returns no bonuses when only 1 piece of each set", () => {
    const arts = [makeArtifact(CW, "flower"), makeArtifact(GL, "plume")];
    const result = detectEquippedSets(arts);
    expect(result.artifactSetId).toBeNull();
    expect(result.artifactHalfSetIds).toEqual([]);
  });
});

// ── setsMatch ──────────────────────────────────────────────────────────────

describe("setsMatch", () => {
  it("returns true for null goal", () => {
    expect(
      setsMatch(null as never, { artifactSetId: CW, artifactHalfSetIds: [] })
    ).toBe(true);
  });

  it("matches 4pc goal with equipped 4pc", () => {
    const goal = { type: "4pc" as const, setId: CW };
    expect(setsMatch(goal, { artifactSetId: CW, artifactHalfSetIds: [] })).toBe(
      true
    );
  });

  it("rejects 4pc goal when different set equipped", () => {
    const goal = { type: "4pc" as const, setId: CW };
    expect(setsMatch(goal, { artifactSetId: GL, artifactHalfSetIds: [] })).toBe(
      false
    );
  });

  it("rejects 4pc goal when no 4pc equipped", () => {
    const goal = { type: "4pc" as const, setId: CW };
    expect(
      setsMatch(goal, {
        artifactSetId: null,
        artifactHalfSetIds: ["pyro%-15", "er-20"],
      })
    ).toBe(false);
  });

  it("matches 2pc+2pc goal with correct halfSetIds", () => {
    const goal = { type: "2pc+2pc" as const, id1: "pyro%-15", id2: "er-20" };
    const equipped = {
      artifactSetId: null,
      artifactHalfSetIds: ["pyro%-15", "er-20"],
    };
    expect(setsMatch(goal, equipped)).toBe(true);
  });

  it("matches 2pc+2pc regardless of order", () => {
    const goal = { type: "2pc+2pc" as const, id1: "er-20", id2: "pyro%-15" };
    const equipped = {
      artifactSetId: null,
      artifactHalfSetIds: ["pyro%-15", "er-20"],
    };
    expect(setsMatch(goal, equipped)).toBe(true);
  });

  it("rejects 2pc+2pc with mismatched halfSetIds", () => {
    const goal = { type: "2pc+2pc" as const, id1: "pyro%-15", id2: "er-20" };
    const equipped = {
      artifactSetId: null,
      artifactHalfSetIds: ["pyro%-15", "atk%-18"],
    };
    expect(setsMatch(goal, equipped)).toBe(false);
  });
});

// ── buildTeamConfigs ─────────────────────────────────────────────────────

describe("buildTeamConfigs", () => {
  const baseTeam = {
    id: "t1",
    name: "Test Team",
    characters: ["hu_tao", "xingqiu", null, null] as (string | null)[],
    weapons: ["staff_of_homa", "sacrificial_sword", null, null] as (
      | string
      | null
    )[],
    artifacts: [
      { type: "4pc" as const, setId: CW },
      { type: "2pc+2pc" as const, id1: "er-20", id2: "atk%-18" },
      null,
      null,
    ],
    reactions: [] as ReactionType[],
    opts: {} as CombatOpts,
    targetEr: {},
    selectedFormula: null,
    optimizationResult: null,
    reactionOverrides: {},
    formulaMode: "single" as const,
    combos: [],
    selectedCombo: null,
  };

  it("builds configs for non-null characters", () => {
    const configs = buildTeamConfigs(baseTeam, null);
    expect(configs).toHaveLength(2);
    expect(configs[0].charId).toBe("hu_tao");
    expect(configs[1].charId).toBe("xingqiu");
  });

  it("defaults to level 90, constellation 0, refinement 1 without account data", () => {
    const configs = buildTeamConfigs(baseTeam, null);
    expect(configs[0].charLevel).toBe(90);
    expect(configs[0].constellation).toBe(0);
    expect(configs[0].refinement).toBe(1);
  });

  it("uses account data for level and constellation", () => {
    const acct = createAccountData({
      characters: [
        createCharacterData({
          key: "hu_tao",
          level: 90,
          constellation: 1,
          artifacts: {},
        }),
      ],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    expect(configs[0].charLevel).toBe(90);
    expect(configs[0].constellation).toBe(1);
  });

  it("uses overrides from team opts", () => {
    const team = {
      ...baseTeam,
      opts: {
        "hu_tao.overrideLevel": "80",
        "hu_tao.overrideConstellation": "2",
        "hu_tao.overrideRefinement": "3",
      } as CombatOpts,
    };
    const configs = buildTeamConfigs(team, null);
    expect(configs[0].charLevel).toBe(80);
    expect(configs[0].constellation).toBe(2);
    expect(configs[0].refinement).toBe(3);
  });

  it("falls back to goal artifact sets when no account artifacts equipped", () => {
    const configs = buildTeamConfigs(baseTeam, null);
    // hu_tao has 4pc CW goal
    expect(configs[0].artifactSetId).toBe(CW);
    expect(configs[0].artifactHalfSetIds).toEqual([]);
    // xingqiu has 2pc+2pc goal
    expect(configs[1].artifactSetId).toBeNull();
    expect(configs[1].artifactHalfSetIds).toEqual(["er-20", "atk%-18"]);
  });

  it("detects equipped artifact sets from account data", () => {
    const acct = createAccountData({
      characters: [
        createCharacterData({
          key: "hu_tao",
          artifacts: {
            flower: createArtifactData({ setKey: CW, slotKey: "flower" }),
            plume: createArtifactData({ setKey: CW, slotKey: "plume" }),
            sands: createArtifactData({ setKey: CW, slotKey: "sands" }),
            goblet: createArtifactData({ setKey: CW, slotKey: "goblet" }),
            circlet: createArtifactData({ setKey: GL, slotKey: "circlet" }),
          },
        }),
      ],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    expect(configs[0].artifactSetId).toBe(CW);
  });

  it("picks highest weapon refinement from account", () => {
    const acct = createAccountData({
      extraWeapons: [
        createWeaponData({ key: "staff_of_homa", refinement: 1 }),
        createWeaponData({ key: "staff_of_homa", refinement: 3 }),
      ],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    expect(configs[0].refinement).toBe(3);
  });

  it("picks refinement from character's equipped weapon", () => {
    const acct = createAccountData({
      characters: [
        createCharacterData({
          key: "hu_tao",
          weapon: {
            id: "w1",
            key: "staff_of_homa",
            level: 90,
            refinement: 5,
            lock: false,
          },
        }),
      ],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    expect(configs[0].refinement).toBe(5);
  });

  it("picks refinement from weapon equipped on a different character", () => {
    // staff_of_homa is assigned to hu_tao in the team, but in account data
    // it's equipped on zhongli. The lookup should still find it.
    const acct = createAccountData({
      characters: [
        createCharacterData({ key: "hu_tao" }), // no weapon equipped
        createCharacterData({
          key: "zhongli",
          weapon: {
            id: "w1",
            key: "staff_of_homa",
            level: 90,
            refinement: 4,
            lock: false,
          },
        }),
      ],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    expect(configs[0].refinement).toBe(4);
  });

  it("picks highest refinement across equipped and extra weapons", () => {
    const acct = createAccountData({
      characters: [
        createCharacterData({
          key: "xingqiu",
          weapon: {
            id: "w1",
            key: "staff_of_homa",
            level: 90,
            refinement: 3,
            lock: false,
          },
        }),
      ],
      extraWeapons: [createWeaponData({ key: "staff_of_homa", refinement: 2 })],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    // Should pick 3 (equipped on xingqiu) over 2 (extra inventory)
    expect(configs[0].refinement).toBe(3);
  });

  it("defaults weapon to dull_blade for empty slot", () => {
    const team = {
      ...baseTeam,
      characters: ["hu_tao", null, null, null] as (string | null)[],
      weapons: [null, null, null, null] as (string | null)[],
    };
    const configs = buildTeamConfigs(team, null);
    expect(configs[0].weaponId).toBe("dull_blade");
  });

  it("falls back to goal sets when only a single 2pc is equipped (partial artifacts)", () => {
    // Character has only 3 artifacts, forming a single 2pc — should fall back
    // to the 4pc CW goal rather than using the incomplete single-2pc detection.
    const acct = createAccountData({
      characters: [
        createCharacterData({
          key: "hu_tao",
          artifacts: {
            flower: createArtifactData({ setKey: CW, slotKey: "flower" }),
            plume: createArtifactData({ setKey: CW, slotKey: "plume" }),
            sands: createArtifactData({ setKey: GL, slotKey: "sands" }),
          },
        }),
      ],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    // Goal for hu_tao is 4pc CW — should fall back since single 2pc is incomplete
    expect(configs[0].artifactSetId).toBe(CW);
    expect(configs[0].artifactHalfSetIds).toEqual([]);
  });

  it("falls back to goal sets when character has 0 artifacts", () => {
    const acct = createAccountData({
      characters: [
        createCharacterData({
          key: "hu_tao",
          artifacts: {},
        }),
      ],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    expect(configs[0].artifactSetId).toBe(CW);
    expect(configs[0].artifactHalfSetIds).toEqual([]);
  });

  it("uses detected 2+2pc when equipped artifacts form a complete 2+2", () => {
    const acct = createAccountData({
      characters: [
        createCharacterData({
          key: "hu_tao",
          artifacts: {
            flower: createArtifactData({ setKey: CW, slotKey: "flower" }),
            plume: createArtifactData({ setKey: CW, slotKey: "plume" }),
            sands: createArtifactData({ setKey: GL, slotKey: "sands" }),
            goblet: createArtifactData({ setKey: GL, slotKey: "goblet" }),
            circlet: createArtifactData({ setKey: WT, slotKey: "circlet" }),
          },
        }),
      ],
    });
    const configs = buildTeamConfigs(baseTeam, acct);
    // Should detect equipped 2+2pc, NOT fall back to goal 4pc CW
    expect(configs[0].artifactSetId).toBeNull();
    expect(configs[0].artifactHalfSetIds).toHaveLength(2);
  });
});
