import { describe, expect, it } from "vitest";
import type { ReactionType } from "@/data/enums";
import type { ArtifactData, ArtifactSetConfig } from "@/data/types";
import {
  calcComboResults,
  extractComboOverrides,
} from "@/lib/dmgcalc/core/comboBuffOverrides";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { OptionMap } from "@/lib/dmgcalc/types";
import {
  buildTeamConfigs,
  detectEquippedSets,
  frozenArtifactsMatchConfig,
  setsMatch,
  toStatSheets,
} from "@/lib/team-comp/teamConfigUtils";
import {
  createAccountData,
  createArtifactData,
  createCharacterData,
  createWeaponData,
} from "../../fixtures";

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
    expect(result).not.toBeNull();
    expect(result!.type).toBe("4pc");
    if (result?.type === "4pc") {
      expect(result.setId).toBe(CW);
    }
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
    expect(result).not.toBeNull();
    expect(result!.type).toBe("4pc");
    if (result?.type === "4pc") {
      expect(result.setId).toBe(CW);
    }
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
    expect(result).not.toBeNull();
    expect(result!.type).toBe("2pc+2pc");
    if (result?.type === "2pc+2pc") {
      expect(result.halfSetIds).toHaveLength(2);
    }
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
    // Single 2pc is not a complete set config — returns null
    expect(result).toBeNull();
  });

  it("returns null for rainbow set", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      makeArtifact(GL, "plume"),
      makeArtifact(ESF, "sands"),
      makeArtifact(WT, "goblet"),
      makeArtifact("thundering_fury", "circlet"),
    ];
    const result = detectEquippedSets(arts);
    expect(result).toBeNull();
  });

  it("handles empty array", () => {
    const result = detectEquippedSets([]);
    expect(result).toBeNull();
  });

  it("detects single 2pc from partial artifacts (3 pieces)", () => {
    const arts = [
      makeArtifact(CW, "flower"),
      makeArtifact(CW, "plume"),
      makeArtifact(GL, "sands"),
    ];
    const result = detectEquippedSets(arts);
    // Single 2pc is not a complete 2pc+2pc config — returns null
    expect(result).toBeNull();
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
    // Only 2 CW pieces = single 2pc, not a full config
    expect(result).toBeNull();
  });

  it("returns null when only 1 piece of each set", () => {
    const arts = [makeArtifact(CW, "flower"), makeArtifact(GL, "plume")];
    const result = detectEquippedSets(arts);
    expect(result).toBeNull();
  });
});

// ── setsMatch ──────────────────────────────────────────────────────────────

describe("setsMatch", () => {
  it("returns true for null goal", () => {
    const equipped: ArtifactSetConfig = { type: "4pc", setId: CW };
    expect(setsMatch(null, equipped)).toBe(true);
  });

  it("matches 4pc goal with equipped 4pc", () => {
    const goal: ArtifactSetConfig = { type: "4pc", setId: CW };
    const equipped: ArtifactSetConfig = { type: "4pc", setId: CW };
    expect(setsMatch(goal, equipped)).toBe(true);
  });

  it("rejects 4pc goal when different set equipped", () => {
    const goal: ArtifactSetConfig = { type: "4pc", setId: CW };
    const equipped: ArtifactSetConfig = { type: "4pc", setId: GL };
    expect(setsMatch(goal, equipped)).toBe(false);
  });

  it("rejects 4pc goal when no 4pc equipped", () => {
    const goal: ArtifactSetConfig = { type: "4pc", setId: CW };
    const equipped: ArtifactSetConfig = {
      type: "2pc+2pc",
      halfSetIds: ["pyro%-15", "er-20"],
    };
    expect(setsMatch(goal, equipped)).toBe(false);
  });

  it("matches 2pc+2pc goal with correct halfSetIds", () => {
    const goal: ArtifactSetConfig = {
      type: "2pc+2pc",
      halfSetIds: ["pyro%-15", "er-20"],
    };
    const equipped: ArtifactSetConfig = {
      type: "2pc+2pc",
      halfSetIds: ["pyro%-15", "er-20"],
    };
    expect(setsMatch(goal, equipped)).toBe(true);
  });

  it("matches 2pc+2pc regardless of order", () => {
    const goal: ArtifactSetConfig = {
      type: "2pc+2pc",
      halfSetIds: ["er-20", "pyro%-15"],
    };
    const equipped: ArtifactSetConfig = {
      type: "2pc+2pc",
      halfSetIds: ["pyro%-15", "er-20"],
    };
    expect(setsMatch(goal, equipped)).toBe(true);
  });

  it("rejects 2pc+2pc with mismatched halfSetIds", () => {
    const goal: ArtifactSetConfig = {
      type: "2pc+2pc",
      halfSetIds: ["pyro%-15", "er-20"],
    };
    const equipped: ArtifactSetConfig = {
      type: "2pc+2pc",
      halfSetIds: ["pyro%-15", "atk%-18"],
    };
    expect(setsMatch(goal, equipped)).toBe(false);
  });
});

// ── frozenArtifactsMatchConfig ──────────────────────────────────────────

describe("frozenArtifactsMatchConfig", () => {
  function makeFrozenArts(setKey: string) {
    const slots = ["flower", "plume", "sands", "goblet", "circlet"] as const;
    return Object.fromEntries(
      slots.map((s) => [s, makeArtifact(setKey, s)])
    ) as Record<(typeof slots)[number], ArtifactData | null>;
  }

  it("returns true when 4pc artifacts match 4pc goal", () => {
    expect(
      frozenArtifactsMatchConfig(makeFrozenArts(CW), {
        type: "4pc",
        setId: CW,
      })
    ).toBe(true);
  });

  it("returns false when 4pc artifacts do not match 4pc goal", () => {
    expect(
      frozenArtifactsMatchConfig(makeFrozenArts(GL), {
        type: "4pc",
        setId: CW,
      })
    ).toBe(false);
  });

  it("returns false when goalConfig is null", () => {
    expect(frozenArtifactsMatchConfig(makeFrozenArts(CW), null)).toBe(false);
  });

  it("returns true for matching 2pc+2pc", () => {
    const slots = ["flower", "plume", "sands", "goblet", "circlet"] as const;
    const arts = Object.fromEntries([
      ["flower", makeArtifact(CW, "flower")],
      ["plume", makeArtifact(CW, "plume")],
      ["sands", makeArtifact(ESF, "sands")],
      ["goblet", makeArtifact(ESF, "goblet")],
      ["circlet", makeArtifact(GL, "circlet")],
    ]) as Record<(typeof slots)[number], ArtifactData | null>;
    // Detect equipped sets to get the half-set IDs
    const equipped = detectEquippedSets(Object.values(arts));
    if (equipped?.type === "2pc+2pc") {
      expect(
        frozenArtifactsMatchConfig(arts, {
          type: "2pc+2pc",
          halfSetIds: equipped.halfSetIds,
        })
      ).toBe(true);
    }
  });

  it("returns false for mismatched 2pc+2pc", () => {
    const arts = makeFrozenArts(CW); // all CW = 4pc, not 2+2
    expect(
      frozenArtifactsMatchConfig(arts, {
        type: "2pc+2pc",
        halfSetIds: ["pyro%-15", "er-20"],
      })
    ).toBe(false);
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
      {
        type: "2pc+2pc" as const,
        halfSetIds: ["er-20", "atk%-18"] as [string, string],
      },
      null,
      null,
    ],
    reactions: [] as ReactionType[],
    opts: {} as OptionMap,
    calcContext: {
      enemyLevel: 110,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6" as const,
    },
    selectedFormula: null,
    optimizationResult: null,
    formulaMode: "single" as const,
    combo: null,
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
      } as OptionMap,
    };
    const configs = buildTeamConfigs(team, null);
    expect(configs[0].charLevel).toBe(80);
    expect(configs[0].constellation).toBe(2);
    expect(configs[0].refinement).toBe(3);
  });

  it("falls back to goal artifact sets when no account artifacts equipped", () => {
    const configs = buildTeamConfigs(baseTeam, null);
    // hu_tao has 4pc CW goal
    expect(configs[0].artifactSet).toEqual({ type: "4pc", setId: CW });
    // xingqiu has 2pc+2pc goal
    expect(configs[1].artifactSet).toEqual({
      type: "2pc+2pc",
      halfSetIds: ["er-20", "atk%-18"],
    });
  });

  it("uses team roster 4pc config even when equipped artifacts differ", () => {
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
    // Team roster says 4pc CW — that's the source of truth
    expect(configs[0].artifactSet).toEqual({ type: "4pc", setId: CW });
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
    const acct = createAccountData({
      characters: [
        createCharacterData({ key: "hu_tao" }),
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
    expect(configs[0].refinement).toBe(3);
  });

  it("skips character when weapon slot is empty", () => {
    const team = {
      ...baseTeam,
      characters: ["hu_tao", null, null, null] as (string | null)[],
      weapons: [null, null, null, null] as (string | null)[],
    };
    const configs = buildTeamConfigs(team, null);
    expect(configs).toHaveLength(0);
  });

  it("falls back to goal sets when only a single 2pc is equipped (partial artifacts)", () => {
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
    expect(configs[0].artifactSet).toEqual({ type: "4pc", setId: CW });
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
    expect(configs[0].artifactSet).toEqual({ type: "4pc", setId: CW });
  });

  it("uses team roster artifact config regardless of equipped artifacts", () => {
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
    // Team roster says 4pc CW — equipped artifacts are irrelevant
    expect(configs[0].artifactSet).toEqual({ type: "4pc", setId: CW });
  });
});

// ── toStatSheets ────────────────────────────────────────────────────────────

describe("toStatSheets", () => {
  it("builds stat sheets for each character", () => {
    const artsByChar: Record<string, Record<string, ArtifactData>> = {
      hu_tao: {
        flower: createArtifactData({
          slotKey: "flower",
          mainStatKey: "hp",
          substats: { cr: 10, cd: 20 },
        }),
      },
      xingqiu: {},
    };
    const sheets = toStatSheets(["hu_tao", "xingqiu"], artsByChar);
    expect(sheets.hu_tao).toBeInstanceOf(StatSheet);
    expect(sheets.xingqiu).toBeInstanceOf(StatSheet);
  });

  it("skips null charIds", () => {
    const sheets = toStatSheets([null, "hu_tao", null], {
      hu_tao: {},
    });
    expect(Object.keys(sheets)).toEqual(["hu_tao"]);
  });

  it("handles missing charId in artsByChar gracefully", () => {
    const sheets = toStatSheets(["hu_tao"], {});
    expect(sheets.hu_tao).toBeInstanceOf(StatSheet);
  });

  it("returns empty record for all-null charIds", () => {
    const sheets = toStatSheets([null, null], {});
    expect(sheets).toEqual({});
  });
});

// ── calcComboResults ────────────────────────────────────────────────────────

describe("calcComboResults", () => {
  it("returns nulls when build is null", () => {
    const combo = {
      id: "c1",
      label: { en: "Test", zh: "测试" },
      lines: [{ charId: "hu_tao", formulaId: "E", count: 1 }],
    };
    const result = calcComboResults(
      null,
      combo,
      {},
      {
        enemyLevel: 100,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6" as const,
      }
    );
    expect(result).toBeNull();
  });

  it("returns null when all lines have count 0", () => {
    const combo = {
      id: "c1",
      label: { en: "Test", zh: "测试" },
      lines: [{ charId: "hu_tao", formulaId: "E", count: 0 }],
    };
    const result = calcComboResults(
      {} as never,
      combo,
      {},
      {
        enemyLevel: 100,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6" as const,
      }
    );
    expect(result).toBeNull();
  });

  it("returns null when lines array is empty", () => {
    const combo = { id: "c1", label: { en: "Test", zh: "测试" }, lines: [] };
    const result = calcComboResults(
      {} as never,
      combo,
      {},
      {
        enemyLevel: 100,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6" as const,
      }
    );
    expect(result).toBeNull();
  });
});

// ── extractComboOverrides ─────────────────────────────────────────────────

describe("extractComboOverrides", () => {
  it("extracts overrides matching the given combo ID", () => {
    const store = {
      "combo:abc:diluc.diluc-slash": { buffA: { 0: 3 } },
      "combo:abc:xingqiu.xingqiu-rain": { buffB: { 1: 2 } },
      "combo:other:diluc.diluc-slash": { buffC: { 0: 1 } },
    };
    const result = extractComboOverrides(store, "abc");
    expect(result).toEqual({
      "diluc.diluc-slash": { buffA: { 0: 3 } },
      "xingqiu.xingqiu-rain": { buffB: { 1: 2 } },
    });
  });

  it("returns undefined when no overrides match", () => {
    const store = {
      "combo:other:diluc.diluc-slash": { buffA: { 0: 1 } },
    };
    expect(extractComboOverrides(store, "abc")).toBeUndefined();
  });

  it("returns undefined for empty store", () => {
    expect(extractComboOverrides({}, "abc")).toBeUndefined();
  });

  it("handles __single__ combo ID (single formula mode)", () => {
    const store = {
      "combo:__single__:diluc.diluc-slash": { buffA: { 0: 5 } },
    };
    const result = extractComboOverrides(store, "__single__");
    expect(result).toEqual({
      "diluc.diluc-slash": { buffA: { 0: 5 } },
    });
  });
});
