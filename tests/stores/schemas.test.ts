import { describe, expect, it } from "vitest";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { DEFAULT_COMPUTE_OPTIONS } from "@/lib/artifact-builds/computeFilters";
import { ArtifactSetConfigSchema } from "@/lib/team-comp/schemas";
import {
  AccountDataSchema,
  ArtifactDataSchema,
  BuildSchema,
  CharacterDataSchema,
  PersistedAccountStoreSchema,
  PersistedAnalyzerCacheStoreSchema,
  PersistedArchiveSessionStoreSchema,
  PersistedArtifactScoreStoreSchema,
  PersistedBaseTierStoreSchema,
  PersistedBuildsStoreSchema,
  PersistedFreezeStoreSchema,
  PersistedGreetingStoreSchema,
  PersistedPreferencesStoreSchema,
  PersistedResourceRecStoreSchema,
  PersistedSessionNavStoreSchema,
  PersistedTeamStoreSchema,
  PersistedTierListStoreSchema,
  PersistedTriageStoreSchema,
  TeamSchema,
  WeaponDataSchema,
} from "@/stores/schemas";

// ─── Helpers ───

/** Create a copy of `obj` with the given keys removed. */
function omit<T extends object>(obj: T, ...keys: (keyof T)[]): Partial<T> {
  const keySet = new Set<PropertyKey>(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !keySet.has(k))
  ) as Partial<T>;
}

function validArtifact(overrides: Record<string, unknown> = {}) {
  return {
    id: "art-1",
    setKey: "GladiatorsFinale",
    slotKey: "flower",
    mainStatKey: "hp",
    level: 20,
    rarity: 5,
    lock: true,
    substats: { critRate_: 3.9, critDMG_: 7.8 },
    ...overrides,
  };
}

function validWeapon(overrides: Record<string, unknown> = {}) {
  return {
    id: "wpn-1",
    key: "MistsplitterReforged",
    level: 90,
    refinement: 1,
    lock: true,
    ...overrides,
  };
}

function validCharacter(overrides: Record<string, unknown> = {}) {
  return {
    key: "Ayaka",
    constellation: 0,
    level: 90,
    talent: { auto: 10, skill: 8, burst: 10 },
    weapon: validWeapon(),
    artifacts: { flower: validArtifact() },
    ...overrides,
  };
}

const validTeam = {
  id: "team-1",
  name: "Freeze Team",
  characters: ["Ayaka", "Kokomi", null, null],
  weapons: ["MistsplitterReforged", null, null, null],
  artifacts: [
    { type: "4pc" as const, setId: "BlizzardStrayer" },
    null,
    null,
    null,
  ],
  reactions: [],
  opts: {},
  calcContext: {},
  formulaMode: "single" as const,
  extraBuffs: [],
  charSettings: {},
};

const validBuild = {
  id: "build-1",
  characterId: "Ayaka",
  name: "Freeze DPS",
  visible: true,
  composition: "4pc" as const,
  substats: [],
  sandsWeights: [],
  gobletWeights: [],
  circletWeights: [],
  normalizer: 0,
};

// ─── ArtifactDataSchema ───

describe("ArtifactDataSchema", () => {
  it("heals missing and wrong-type fields to defaults", () => {
    // Missing fields
    const missing = ArtifactDataSchema.parse(
      omit(validArtifact(), "level", "rarity", "lock", "substats")
    );
    expect(missing.level).toBe(0);
    expect(missing.rarity).toBe(5);
    expect(missing.lock).toBe(false);
    expect(missing.substats).toEqual({});

    // Wrong types
    const wrong = ArtifactDataSchema.parse(
      validArtifact({
        level: "twenty",
        rarity: true,
        lock: 1,
        substats: [1, 2],
      })
    );
    expect(wrong.level).toBe(0);
    expect(wrong.rarity).toBe(5);
    expect(wrong.lock).toBe(false);
    expect(wrong.substats).toEqual({});
  });
});

// ─── WeaponDataSchema ───

describe("WeaponDataSchema", () => {
  it("heals missing lock to false", () => {
    const result = WeaponDataSchema.parse(omit(validWeapon(), "lock"));
    expect(result.lock).toBe(false);
  });

  it("throws on missing required fields", () => {
    expect(() => WeaponDataSchema.parse({ lock: true })).toThrow();
  });
});

// ─── CharacterDataSchema ───

describe("CharacterDataSchema", () => {
  it("heals missing and corrupted talent to defaults", () => {
    // Missing
    const missing = CharacterDataSchema.parse(omit(validCharacter(), "talent"));
    expect(missing.talent).toEqual({ auto: 1, skill: 1, burst: 1 });

    // Wrong type
    const wrong = CharacterDataSchema.parse(
      validCharacter({ talent: "maxed" })
    );
    expect(wrong.talent).toEqual({ auto: 1, skill: 1, burst: 1 });

    // Partial inner fields (fails because all required)
    const partial = CharacterDataSchema.parse(
      validCharacter({ talent: { auto: 10 } })
    );
    expect(partial.talent).toEqual({ auto: 1, skill: 1, burst: 1 });
  });

  it("heals missing and corrupted artifacts", () => {
    const missing = CharacterDataSchema.parse(
      omit(validCharacter(), "artifacts")
    );
    expect(missing.artifacts).toEqual({});

    const wrong = CharacterDataSchema.parse(
      validCharacter({ artifacts: "broken" })
    );
    expect(wrong.artifacts).toEqual({});

    // Corrupted entry healed to null
    const corrupted = CharacterDataSchema.parse(
      validCharacter({ artifacts: { flower: "not-an-artifact" } })
    );
    expect(corrupted.artifacts.flower).toBeNull();
  });

  it("weapon is optional", () => {
    const result = CharacterDataSchema.parse(omit(validCharacter(), "weapon"));
    expect(result.weapon).toBeUndefined();
  });
});

// ─── AccountDataSchema ───

describe("AccountDataSchema", () => {
  it("heals missing arrays and corrupted data to defaults", () => {
    // All missing fields
    const result = AccountDataSchema.parse({});
    expect(result.characters).toEqual([]);
    expect(result.extraArtifacts).toEqual([]);
    expect(result.extraWeapons).toEqual([]);

    // Corrupted type
    const corrupted = AccountDataSchema.parse({
      characters: "broken",
      extraArtifacts: 42,
      extraWeapons: null,
    });
    expect(corrupted.characters).toEqual([]);
    expect(corrupted.extraArtifacts).toEqual([]);
    expect(corrupted.extraWeapons).toEqual([]);
  });
});

// ─── PersistedAccountStoreSchema ───

describe("PersistedAccountStoreSchema", () => {
  it("heals all fields from empty object", () => {
    const result = PersistedAccountStoreSchema.parse({});
    expect(result).toEqual({
      accounts: {},
      activeAccountId: null,
      staleScoreCharIds: [],
    });
  });

  it("accepts staleScoreCharIds as true (literal union)", () => {
    const result = PersistedAccountStoreSchema.parse({
      accounts: {},
      activeAccountId: null,
      staleScoreCharIds: true,
    });
    expect(result.staleScoreCharIds).toBe(true);
  });

  it("heals corrupted staleScoreCharIds to []", () => {
    const result = PersistedAccountStoreSchema.parse({
      accounts: {},
      activeAccountId: null,
      staleScoreCharIds: { bad: true },
    });
    expect(result.staleScoreCharIds).toEqual([]);
  });

  it("heals account with missing lastUpdate to 0", () => {
    const result = PersistedAccountStoreSchema.parse({
      accounts: {
        1: {
          id: 1,
          name: "Test",
          data: { characters: [], extraArtifacts: [], extraWeapons: [] },
          scores: {},
        },
      },
      activeAccountId: null,
      staleScoreCharIds: [],
    });
    expect(result.accounts[1].lastUpdate).toBe(0);
  });

  it("heals non-finite lastUpdate to 0", () => {
    const result = PersistedAccountStoreSchema.parse({
      accounts: {
        1: {
          id: 1,
          name: "Test",
          data: { characters: [], extraArtifacts: [], extraWeapons: [] },
          scores: {},
          lastUpdate: Number.POSITIVE_INFINITY,
        },
      },
      activeAccountId: null,
      staleScoreCharIds: [],
    });
    expect(result.accounts[1].lastUpdate).toBe(0);
  });

  it("throws on non-object input", () => {
    expect(() => PersistedAccountStoreSchema.parse(42)).toThrow();
  });
});

// ─── BuildSchema ───

describe("BuildSchema", () => {
  it("heals missing and wrong-type fields to defaults", () => {
    const missing = BuildSchema.parse(
      omit({ ...validBuild }, "name", "visible", "substats", "normalizer")
    );
    expect(missing.name).toBe("");
    expect(missing.visible).toBe(true);
    expect(missing.substats).toEqual([]);
    expect(missing.normalizer).toBe(0);

    const wrong = BuildSchema.parse({
      ...validBuild,
      visible: "yes",
      normalizer: "high",
      composition: "invalid",
    });
    expect(wrong.visible).toBe(true);
    expect(wrong.normalizer).toBe(0);
    expect(wrong.composition).toBe("4pc");
  });
});

// ─── PersistedBuildsStoreSchema ───

describe("PersistedBuildsStoreSchema", () => {
  it("heals all fields from empty object", () => {
    const result = PersistedBuildsStoreSchema.parse({});
    expect(result).toEqual({
      builds: {},
      characterToBuildIds: {},
      presetDeletedBuildIds: [],
      validationErrors: {},
      activePresetId: null,
      hasPromptedForPreset: false,
      hiddenCharacters: {},
      characterWeapons: {},
      computeOptions: DEFAULT_COMPUTE_OPTIONS,
      author: "",
      description: "",
    });
  });

  it("preserves user-facing fields that previously got stripped", () => {
    const result = PersistedBuildsStoreSchema.parse({
      activePresetId: "gg-v1",
      hasPromptedForPreset: true,
      hiddenCharacters: { diluc: true },
      characterWeapons: { diluc: ["wolfs_gravestone"] },
      computeOptions: { normalizeFlatStats: false },
      author: "me",
      description: "my builds",
    });
    expect(result.activePresetId).toBe("gg-v1");
    expect(result.hasPromptedForPreset).toBe(true);
    expect(result.hiddenCharacters).toEqual({ diluc: true });
    expect(result.characterWeapons).toEqual({ diluc: ["wolfs_gravestone"] });
    expect(result.computeOptions).toEqual({ normalizeFlatStats: false });
    expect(result.author).toBe("me");
    expect(result.description).toBe("my builds");
  });

  it("throws on non-object input", () => {
    expect(() => PersistedBuildsStoreSchema.parse("garbage")).toThrow();
  });
});

// ─── TeamSchema ───

describe("TeamSchema", () => {
  it("heals missing array fields to null-filled defaults", () => {
    const input = omit({ ...validTeam }, "characters", "weapons", "artifacts");
    const result = TeamSchema.parse(input);
    expect(result.characters).toEqual([null, null, null, null]);
    expect(result.weapons).toEqual([null, null, null, null]);
    expect(result.artifacts).toEqual([null, null, null, null]);
  });

  it("heals invalid artifact configs within array to null", () => {
    const result = TeamSchema.parse({
      ...validTeam,
      artifacts: [{ type: "invalid", setId: "x" }, null, null, null],
    });
    expect(result.artifacts[0]).toBeNull();
  });

  it("heals missing scalar fields to defaults", () => {
    const input = omit(
      { ...validTeam },
      "name",
      "reactions",
      "opts",
      "extraBuffs",
      "charSettings"
    );
    const result = TeamSchema.parse(input);
    expect(result.name).toBe("");
    expect(result.reactions).toEqual([]);
    expect(result.opts).toEqual({});
    expect(result.extraBuffs).toEqual([]);
    expect(result.charSettings).toEqual({});
  });

  it("heals invalid formulaMode and accepts valid combo", () => {
    const invalid = TeamSchema.parse({ ...validTeam, formulaMode: "triple" });
    expect(invalid.formulaMode).toBe("single");

    const combo = TeamSchema.parse({ ...validTeam, formulaMode: "combo" });
    expect(combo.formulaMode).toBe("combo");
  });

  it("accepts 2pc+2pc artifact config", () => {
    const result = TeamSchema.parse({
      ...validTeam,
      artifacts: [
        {
          type: "2pc+2pc",
          halfSetIds: ["GladiatorsFinale", "ShimenawasReminiscence"],
        },
        null,
        null,
        null,
      ],
    });
    expect(result.artifacts[0]).toEqual({
      type: "2pc+2pc",
      halfSetIds: ["GladiatorsFinale", "ShimenawasReminiscence"],
    });
  });
});

// ─── PersistedTeamStoreSchema ───

describe("PersistedTeamStoreSchema", () => {
  it("heals all fields from empty object", () => {
    expect(PersistedTeamStoreSchema.parse({})).toEqual({
      teams: [],
      author: "",
      description: "",
    });
  });

  it("preserves author and description metadata", () => {
    const result = PersistedTeamStoreSchema.parse({
      teams: [],
      author: "me",
      description: "my teams",
    });
    expect(result.author).toBe("me");
    expect(result.description).toBe("my teams");
  });

  it("throws on non-object input", () => {
    expect(() => PersistedTeamStoreSchema.parse(null)).toThrow();
  });
});

// ─── PersistedFreezeStoreSchema ───

describe("PersistedFreezeStoreSchema", () => {
  it("heals all fields from empty object", () => {
    expect(PersistedFreezeStoreSchema.parse({})).toEqual({
      frozenTeams: {},
      reuseMode: "sameChar",
      frozenArtifactIds: [],
    });
  });

  it("validates reuseMode enum", () => {
    // Invalid heals to default
    const invalid = PersistedFreezeStoreSchema.parse({
      reuseMode: "badValue",
    });
    expect(invalid.reuseMode).toBe("sameChar");

    // All valid values accepted
    for (const mode of ["none", "sameChar", "forceReuse"] as const) {
      const result = PersistedFreezeStoreSchema.parse({
        frozenTeams: {},
        reuseMode: mode,
        frozenArtifactIds: [],
      });
      expect(result.reuseMode).toBe(mode);
    }
  });

  it("heals corrupted nested data", () => {
    const result = PersistedFreezeStoreSchema.parse({
      frozenTeams: {
        "team-1": {
          frozenCharIds: "not-an-array",
          artifactsByChar: 42,
        },
      },
      reuseMode: "sameChar",
      frozenArtifactIds: [],
    });
    expect(result.frozenTeams["team-1"].frozenCharIds).toEqual([]);
    expect(result.frozenTeams["team-1"].artifactsByChar).toEqual({});
  });

  it("heals corrupted artifact inside frozenTeam to null", () => {
    const result = PersistedFreezeStoreSchema.parse({
      frozenTeams: {
        "team-1": {
          frozenCharIds: [],
          artifactsByChar: {
            Ayaka: { flower: "not-an-artifact" },
          },
        },
      },
      reuseMode: "sameChar",
      frozenArtifactIds: [],
    });
    expect(
      result.frozenTeams["team-1"].artifactsByChar.Ayaka.flower
    ).toBeNull();
  });

  it("heals account-scoped freeze buckets", () => {
    const result = PersistedFreezeStoreSchema.parse({
      freezesByProfileId: {
        "0": {
          frozenTeams: {
            "team-1": {
              frozenCharIds: ["Ayaka"],
              artifactsByChar: {
                Ayaka: { flower: "not-an-artifact" },
              },
            },
          },
          reuseMode: "forceReuse",
          frozenArtifactIds: ["artifact-1"],
        },
        "123456789": {
          frozenTeams: 42,
          reuseMode: "bad",
          frozenArtifactIds: "bad",
        },
      },
    });

    expect(result.freezesByProfileId?.["0"].reuseMode).toBe("forceReuse");
    expect(result.freezesByProfileId?.["0"].frozenArtifactIds).toEqual([
      "artifact-1",
    ]);
    expect(
      result.freezesByProfileId?.["0"].frozenTeams["team-1"].artifactsByChar
        .Ayaka.flower
    ).toBeNull();
    expect(result.freezesByProfileId?.["123456789"].frozenTeams).toEqual({});
    expect(result.freezesByProfileId?.["123456789"].reuseMode).toBe("sameChar");
    expect(result.freezesByProfileId?.["123456789"].frozenArtifactIds).toEqual(
      []
    );
  });

  it("throws on non-object input", () => {
    expect(() => PersistedFreezeStoreSchema.parse(false)).toThrow();
  });
});

// ─── PersistedResourceRecStoreSchema ───

describe("PersistedResourceRecStoreSchema", () => {
  it("heals structural fields from empty object", () => {
    const result = PersistedResourceRecStoreSchema.parse({});
    expect(result.thresholds).toEqual({});
    expect(result.minScoreDiff).toEqual({
      craft: {},
      reroll: {},
      levelup: {},
    });
    expect(result.panelOpen).toBe(false);
    expect(result.showCraft).toBeUndefined();
    expect(result.showReroll).toBeUndefined();
    expect(result.showLevelup).toBeUndefined();
  });

  it("heals corrupted minScoreDiff while preserving valid inner data", () => {
    // Completely corrupted
    const corrupted = PersistedResourceRecStoreSchema.parse({
      minScoreDiff: "broken",
    });
    expect(corrupted.minScoreDiff).toEqual({
      craft: {},
      reroll: {},
      levelup: {},
    });

    // Partial — preserves craft, heals missing reroll/levelup
    const partial = PersistedResourceRecStoreSchema.parse({
      minScoreDiff: { craft: { GladiatorsFinale: 5 } },
    });
    expect(partial.minScoreDiff.craft).toEqual({ GladiatorsFinale: 5 });
    expect(partial.minScoreDiff.reroll).toEqual({});
    expect(partial.minScoreDiff.levelup).toEqual({});
  });

  it("drops wrong types for optional visibility fields", () => {
    const result = PersistedResourceRecStoreSchema.parse({
      panelOpen: "yes",
      showCraft: 0,
      showReroll: null,
      showLevelup: [],
    });
    expect(result.panelOpen).toBe(false);
    expect(result.showCraft).toBeUndefined();
    expect(result.showReroll).toBeUndefined();
    expect(result.showLevelup).toBeUndefined();
  });

  it("heals account-scoped settings", () => {
    const result = PersistedResourceRecStoreSchema.parse({
      settingsByProfileId: {
        "0": {
          thresholds: { S: 0.95 },
          minScoreDiff: { craft: { A: 7 } },
          panelOpen: true,
          showCraft: false,
          showReroll: "bad",
          showLevelup: true,
        },
      },
    });

    expect(result.settingsByProfileId?.["0"].thresholds.S).toBe(0.95);
    expect(result.settingsByProfileId?.["0"].minScoreDiff.craft.A).toBe(7);
    expect(result.settingsByProfileId?.["0"].minScoreDiff.reroll).toEqual({});
    expect(result.settingsByProfileId?.["0"].panelOpen).toBe(true);
    expect(result.settingsByProfileId?.["0"].showCraft).toBe(false);
    expect(result.settingsByProfileId?.["0"].showReroll).toBe(true);
    expect(result.settingsByProfileId?.["0"].showLevelup).toBe(true);
  });
});

// ─── PersistedTriageStoreSchema ───

describe("PersistedTriageStoreSchema", () => {
  const fullDefaults = { settings: DEFAULT_TRIAGE_SETTINGS };

  it("heals missing or corrupted settings to full defaults", () => {
    expect(PersistedTriageStoreSchema.parse({})).toEqual(fullDefaults);
    expect(PersistedTriageStoreSchema.parse({ settings: 42 })).toEqual(
      fullDefaults
    );
  });

  it("preserves valid fields while healing missing ones", () => {
    const result = PersistedTriageStoreSchema.parse({
      settings: { triageMode: "strict", mainStatThreshold: 80 },
    });
    expect(result.settings.triageMode).toBe("strict");
    expect(result.settings.mainStatThreshold).toBe(80);
    // Healed fields
    expect(result.settings.optionalSubThreshold).toBe(50);
    expect(result.settings.fillerKeep).toBe(DEFAULT_TRIAGE_SETTINGS.fillerKeep);
    expect(result.settings.alwaysLockSolidArtifacts).toBe(false);
    expect(result.settings.ownedOnly).toBe(true);
    expect(result.settings.levelProtection).toBe(12);
    expect(result.settings.customFlexInputs).toEqual([]);
  });

  it("heals wrong types for enum, boolean, and number settings", () => {
    const result = PersistedTriageStoreSchema.parse({
      settings: {
        triageMode: "medium",
        ownedOnly: "no",
        erHoardingEnabled: 0,
        doubleCritLockEnabled: null,
        mainStatThreshold: "high",
        levelProtection: false,
        alwaysLockSolidArtifacts: "yes",
        customFlexInputs: "not-an-array",
      },
    });
    expect(result.settings.triageMode).toBe("loose");
    expect(result.settings.ownedOnly).toBe(true);
    expect(result.settings.erHoardingEnabled).toBe(true);
    expect(result.settings.doubleCritLockEnabled).toBe(true);
    expect(result.settings.mainStatThreshold).toBe(
      DEFAULT_TRIAGE_SETTINGS.mainStatThreshold
    );
    expect(result.settings.levelProtection).toBe(12);
    expect(result.settings.alwaysLockSolidArtifacts).toBe(false);
    expect(result.settings.customFlexInputs).toEqual([]);
  });

  it("heals account-scoped settings", () => {
    const result = PersistedTriageStoreSchema.parse({
      settingsByProfileId: {
        "0": { mainStatThreshold: 85 },
        "123456789": {
          triageMode: "strict",
          customFlexInputs: "not-an-array",
        },
      },
    });

    expect(result.settingsByProfileId?.["0"].mainStatThreshold).toBe(85);
    expect(result.settingsByProfileId?.["0"].ownedOnly).toBe(true);
    expect(result.settingsByProfileId?.["123456789"].triageMode).toBe("strict");
    expect(result.settingsByProfileId?.["123456789"].customFlexInputs).toEqual(
      []
    );
  });
});

// ─── PersistedBaseTierStoreSchema ───

describe("PersistedBaseTierStoreSchema", () => {
  it("heals missing base tier-list fields", () => {
    expect(PersistedBaseTierStoreSchema.parse({})).toEqual({
      tierAssignments: {},
      tierCustomization: {},
      customTitle: "",
      author: "",
      description: "",
    });
  });

  it("preserves valid assignments and customization", () => {
    const result = PersistedBaseTierStoreSchema.parse({
      tierAssignments: {
        ayaka: { tier: "S", position: 1 },
      },
      tierCustomization: {
        S: { displayName: "Top", hidden: false, luckExpectation: 12 },
      },
      customTitle: "Characters",
      author: "me",
      description: "notes",
    });
    expect(result.tierAssignments.ayaka).toEqual({
      tier: "S",
      position: 1,
    });
    expect(result.tierCustomization.S).toEqual({
      displayName: "Top",
      hidden: false,
      luckExpectation: 12,
    });
    expect(result.customTitle).toBe("Characters");
  });
});

// ─── PersistedTierListStoreSchema ───

describe("PersistedTierListStoreSchema", () => {
  it("heals missing multi-list tier fields", () => {
    expect(PersistedTierListStoreSchema.parse({})).toEqual({
      tierLists: {},
      activeTierListId: 1,
      nextId: 2,
      showWeapons: true,
      showTravelers: false,
      showManekin: false,
    });
  });

  it("heals corrupted flags and drops removed recommendation prefs", () => {
    const result = PersistedTierListStoreSchema.parse({
      activeTierListId: "bad",
      showWeapons: "yes",
      recommendationPrefs: {
        scoreDiffThreshold: "high",
        includeUpgrades: null,
      },
    });
    expect(result.activeTierListId).toBe(1);
    expect(result.showWeapons).toBe(true);
    expect(result).not.toHaveProperty("recommendationPrefs");
  });
});

// ─── PersistedPreferencesStoreSchema ───

describe("PersistedPreferencesStoreSchema", () => {
  it("heals missing or corrupted sort preferences", () => {
    expect(PersistedPreferencesStoreSchema.parse({})).toEqual({
      characterSort: {
        tierSort: "desc",
        releaseSort: "desc",
        scoreSort: "off",
      },
    });

    const result = PersistedPreferencesStoreSchema.parse({
      characterSort: {
        tierSort: "sideways",
        releaseSort: "asc",
        scoreSort: "desc",
      },
    });
    expect(result.characterSort).toEqual({
      tierSort: "desc",
      releaseSort: "asc",
      scoreSort: "desc",
    });
  });
});

// ─── PersistedGreetingStoreSchema ───

describe("PersistedGreetingStoreSchema", () => {
  it("heals greeting flags", () => {
    expect(PersistedGreetingStoreSchema.parse({})).toEqual({
      onboardingCompleted: false,
      lastSeenUpdate: null,
    });

    const result = PersistedGreetingStoreSchema.parse({
      onboardingCompleted: true,
      lastSeenUpdate: "2026-04-25",
    });
    expect(result.onboardingCompleted).toBe(true);
    expect(result.lastSeenUpdate).toBe("2026-04-25");
  });
});

// ─── PersistedArtifactScoreStoreSchema ───

describe("PersistedArtifactScoreStoreSchema", () => {
  it("heals global score weights", () => {
    expect(PersistedArtifactScoreStoreSchema.parse({})).toEqual({
      config: { global: { flatAtk: 30, flatHp: 30, flatDef: 30 } },
    });

    const result = PersistedArtifactScoreStoreSchema.parse({
      config: {
        global: { flatAtk: 10, flatHp: "bad", flatDef: 50 },
      },
    });
    expect(result.config.global).toEqual({
      flatAtk: 10,
      flatHp: 30,
      flatDef: 50,
    });
  });
});

// ─── PersistedArchiveSessionStoreSchema ───

describe("PersistedArchiveSessionStoreSchema", () => {
  it("heals archive session fields", () => {
    expect(PersistedArchiveSessionStoreSchema.parse({})).toEqual({
      characterSearch: "",
      weaponSearch: "",
      artifactSearch: "",
      bossSearch: "",
      selectedCharacterId: null,
      selectedBossId: null,
    });
  });
});

// ─── PersistedSessionNavStoreSchema ───

describe("PersistedSessionNavStoreSchema", () => {
  it("heals view settings", () => {
    const result = PersistedSessionNavStoreSchema.parse({
      viewSettings: {
        damage: { activeTeamId: "team-1", teamSort: "tier" },
        investment: { ownedOnly: true, erCalcExpanded: true },
        weaponChoice: { teamSort: "bad" },
      },
    });
    expect(result.viewSettings.damage).toEqual({
      activeTeamId: "team-1",
      ownedOnly: null,
      teamSort: "tier",
      erCalcExpanded: false,
    });
    expect(result.viewSettings.investment).toEqual({
      activeTeamId: null,
      ownedOnly: true,
      teamSort: "default",
      erCalcExpanded: true,
    });
    expect(result.viewSettings.weaponChoice.teamSort).toBe("default");
  });
});

// ─── PersistedAnalyzerCacheStoreSchema ───

describe("PersistedAnalyzerCacheStoreSchema", () => {
  it("heals analyzer cache envelope", () => {
    expect(PersistedAnalyzerCacheStoreSchema.parse({})).toEqual({
      lastByTeam: {},
    });
    expect(
      PersistedAnalyzerCacheStoreSchema.parse({
        lastByTeam: { "team-1": { expensive: "opaque-cache-payload" } },
      }).lastByTeam["team-1"]
    ).toEqual({ expensive: "opaque-cache-payload" });
  });
});

// ─── ArtifactSetConfigSchema ───

describe("ArtifactSetConfigSchema", () => {
  it("rejects invalid discriminator and missing required fields", () => {
    // Bad discriminator
    expect(
      ArtifactSetConfigSchema.safeParse({ type: "3pc", setId: "x" }).success
    ).toBe(false);

    // 4pc missing setId
    expect(ArtifactSetConfigSchema.safeParse({ type: "4pc" }).success).toBe(
      false
    );

    // 2pc+2pc missing halfSetIds
    expect(ArtifactSetConfigSchema.safeParse({ type: "2pc+2pc" }).success).toBe(
      false
    );

    // 2pc+2pc wrong tuple length
    expect(
      ArtifactSetConfigSchema.safeParse({
        type: "2pc+2pc",
        halfSetIds: ["GladiatorsFinale"],
      }).success
    ).toBe(false);

    // Non-object
    expect(ArtifactSetConfigSchema.safeParse("BlizzardStrayer").success).toBe(
      false
    );
  });
});
