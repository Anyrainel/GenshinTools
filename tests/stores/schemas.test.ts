import { describe, expect, it } from "vitest";
import { ArtifactSetConfigSchema } from "@/lib/team-comp/schemas";
import {
  AccountDataSchema,
  ArtifactDataSchema,
  BuildSchema,
  CharacterDataSchema,
  PersistedAccountStoreSchema,
  PersistedBuildsStoreSchema,
  PersistedFreezeStoreSchema,
  PersistedResourceRecStoreSchema,
  PersistedTeamStoreSchema,
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
        a: {
          id: "a",
          name: "Test",
          data: { characters: [], extraArtifacts: [], extraWeapons: [] },
          scores: {},
        },
      },
      activeAccountId: null,
      staleScoreCharIds: [],
    });
    expect(result.accounts.a.lastUpdate).toBe(0);
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
    });
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
    expect(PersistedTeamStoreSchema.parse({})).toEqual({ teams: [] });
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

  it("throws on non-object input", () => {
    expect(() => PersistedFreezeStoreSchema.parse(false)).toThrow();
  });
});

// ─── PersistedResourceRecStoreSchema ───

describe("PersistedResourceRecStoreSchema", () => {
  it("heals all fields from empty object", () => {
    const result = PersistedResourceRecStoreSchema.parse({});
    expect(result.thresholds).toEqual({});
    expect(result.minScoreDiff).toEqual({
      craft: {},
      reroll: {},
      levelup: {},
    });
    expect(result.panelOpen).toBe(false);
    expect(result.showCraft).toBe(true);
    expect(result.showReroll).toBe(true);
    expect(result.showLevelup).toBe(true);
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

  it("heals wrong types for boolean fields", () => {
    const result = PersistedResourceRecStoreSchema.parse({
      panelOpen: "yes",
      showCraft: 0,
      showReroll: null,
      showLevelup: [],
    });
    expect(result.panelOpen).toBe(false);
    expect(result.showCraft).toBe(true);
    expect(result.showReroll).toBe(true);
    expect(result.showLevelup).toBe(true);
  });
});

// ─── PersistedTriageStoreSchema ───

describe("PersistedTriageStoreSchema", () => {
  const fullDefaults = {
    settings: {
      triageMode: "loose",
      mainStatThreshold: 90,
      optionalSubThreshold: 50,
      neutralKeep: 5,
      qualityMargin: 5,
      setSlotKeep: 3,
      ownedOnly: true,
      erHoardingEnabled: true,
      erHoardingAllEnabled: false,
      doubleCritLockEnabled: true,
      levelProtection: 12,
      highLevelProtection: true,
      equippedProtection: true,
      disabledFlexPatterns: [],
      enabledFlexPatterns: [],
      customFlexInputs: [],
    },
  };

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
    expect(result.settings.neutralKeep).toBe(5);
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
        customFlexInputs: "not-an-array",
      },
    });
    expect(result.settings.triageMode).toBe("loose");
    expect(result.settings.ownedOnly).toBe(true);
    expect(result.settings.erHoardingEnabled).toBe(true);
    expect(result.settings.doubleCritLockEnabled).toBe(true);
    expect(result.settings.mainStatThreshold).toBe(90);
    expect(result.settings.levelProtection).toBe(12);
    expect(result.settings.customFlexInputs).toEqual([]);
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
