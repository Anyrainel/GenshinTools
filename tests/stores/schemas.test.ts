import { describe, expect, it } from "vitest";
import { DEFAULT_COMPUTE_OPTIONS } from "@/lib/artifact-builds/computeFilters";
import { ArtifactSetConfigSchema } from "@/lib/team-comp/schemas";
import {
  AccountDataSchema,
  ArtifactDataSchema,
  BuildSchema,
  CharacterDataSchema,
  PersistedAccountScoreCacheStoreSchema,
  PersistedAccountStoreSchema,
  PersistedArchiveSessionStoreSchema,
  PersistedArtifactScoreStoreSchema,
  PersistedBaseTierStoreSchema,
  PersistedBuildsStoreSchema,
  PersistedCloudSyncMetadataStoreSchema,
  PersistedFreezeStoreSchema,
  PersistedGenericTierListStoreSchema,
  PersistedGreetingStoreSchema,
  PersistedPreferencesStoreSchema,
  PersistedRecommendationSettingsStoreSchema,
  PersistedResourceRecStoreSchema,
  PersistedSessionNavStoreSchema,
  PersistedTeamResultCacheStoreSchema,
  PersistedTeamStoreSchema,
  PersistedTierListStoreSchema,
  PersistedTriageStoreSchema,
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
    });
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
    });
    expect(result.accounts[1].lastUpdate).toBe(0);
    expect(
      (result.accounts[1] as Record<string, unknown>).scores
    ).toBeUndefined();
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
    });
    expect(result.accounts[1].lastUpdate).toBe(0);
  });

  it("throws on non-object input", () => {
    expect(() => PersistedAccountStoreSchema.parse(42)).toThrow();
  });
});

describe("PersistedAccountScoreCacheStoreSchema", () => {
  it("heals all fields from empty object", () => {
    const result = PersistedAccountScoreCacheStoreSchema.parse({});
    expect(result).toEqual({
      scoresByProfileId: {},
      staleScoreCharIdsByProfileId: {},
    });
  });

  it("accepts per-profile score and staleness cache data", () => {
    const result = PersistedAccountScoreCacheStoreSchema.parse({
      scoresByProfileId: {
        1: { hu_tao: null },
      },
      staleScoreCharIdsByProfileId: {
        1: true,
        2: ["xiangling"],
      },
    });

    expect(result.scoresByProfileId[1].hu_tao).toBeNull();
    expect(result.staleScoreCharIdsByProfileId[1]).toBe(true);
    expect(result.staleScoreCharIdsByProfileId[2]).toEqual(["xiangling"]);
  });

  it("heals corrupted cache maps to empty objects", () => {
    const result = PersistedAccountScoreCacheStoreSchema.parse({
      scoresByProfileId: "bad",
      staleScoreCharIdsByProfileId: "bad",
    });

    expect(result.scoresByProfileId).toEqual({});
    expect(result.staleScoreCharIdsByProfileId).toEqual({});
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
      deltas: [],
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

  it("preserves valid preset delta entries", () => {
    const result = PersistedBuildsStoreSchema.parse({
      deltas: [
        { kind: "preset", id: "preset-build", displayIndex: 0 },
        { kind: "preset", id: "deleted-build", deleted: true },
        { kind: "custom", id: "custom-build", value: validBuild },
      ],
    });

    expect(result.deltas).toHaveLength(3);
    expect(result.deltas[0]).toEqual({
      kind: "preset",
      id: "preset-build",
      displayIndex: 0,
    });
    expect(result.deltas[1]).toEqual({
      kind: "preset",
      id: "deleted-build",
      deleted: true,
    });
    expect(result.deltas[2]?.kind).toBe("custom");
  });

  it("drops corrupted preset delta entries", () => {
    const result = PersistedBuildsStoreSchema.parse({
      deltas: [
        { kind: "preset", id: "valid" },
        { kind: "custom", id: "missing-value" },
        { kind: "bad", id: "bad" },
      ],
    });

    expect(result.deltas).toEqual([{ kind: "preset", id: "valid" }]);
  });

  it("throws on non-object input", () => {
    expect(() => PersistedBuildsStoreSchema.parse("garbage")).toThrow();
  });
});

// ─── PersistedTeamStoreSchema ───

describe("PersistedTeamStoreSchema", () => {
  it("heals all fields from empty object", () => {
    expect(PersistedTeamStoreSchema.parse({})).toEqual({
      activePresetId: null,
      compDeltas: [],
      configsByTeamId: {},
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
      freezesByProfileId: {},
    });
  });

  it("validates reuseMode enum", () => {
    // Invalid heals to default
    const invalid = PersistedFreezeStoreSchema.parse({
      freezesByProfileId: {
        "0": {
          frozenTeamLoadouts: {},
          reuseMode: "badValue",
          frozenArtifactIds: [],
        },
      },
    });
    expect(invalid.freezesByProfileId["0"].reuseMode).toBe("sameChar");

    // All valid values accepted
    for (const mode of ["none", "sameChar", "forceReuse"] as const) {
      const result = PersistedFreezeStoreSchema.parse({
        freezesByProfileId: {
          "0": {
            frozenTeamLoadouts: {},
            reuseMode: mode,
            frozenArtifactIds: [],
          },
        },
      });
      expect(result.freezesByProfileId["0"].reuseMode).toBe(mode);
    }
  });

  it("heals corrupted latest loadout data", () => {
    const result = PersistedFreezeStoreSchema.parse({
      freezesByProfileId: {
        "0": {
          frozenTeamLoadouts: {
            "team-1": {
              frozenCharIds: "not-an-array",
              artifactIdsByChar: 42,
            },
          },
          reuseMode: "sameChar",
          frozenArtifactIds: [],
        },
      },
    });
    expect(
      result.freezesByProfileId["0"].frozenTeamLoadouts["team-1"].frozenCharIds
    ).toEqual([]);
    expect(
      result.freezesByProfileId["0"].frozenTeamLoadouts["team-1"]
        .artifactIdsByChar
    ).toEqual({});
  });

  it("heals account-scoped freeze loadout buckets", () => {
    const result = PersistedFreezeStoreSchema.parse({
      freezesByProfileId: {
        "0": {
          frozenTeamLoadouts: {
            "team-1": {
              frozenCharIds: ["Ayaka"],
              artifactIdsByChar: { Ayaka: { flower: "artifact-1" } },
            },
          },
          reuseMode: "forceReuse",
          frozenArtifactIds: ["artifact-1"],
        },
        "123456789": {
          frozenTeamLoadouts: 42,
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
      result.freezesByProfileId?.["0"].frozenTeamLoadouts?.["team-1"]
        .artifactIdsByChar.Ayaka.flower
    ).toBe("artifact-1");
    expect(result.freezesByProfileId?.["123456789"].frozenTeamLoadouts).toEqual(
      {}
    );
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
    expect(result).toEqual({ settingsByProfileId: {} });
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

// ─── PersistedRecommendationSettingsStoreSchema ───

describe("PersistedRecommendationSettingsStoreSchema", () => {
  it("heals structural fields from empty object", () => {
    const result = PersistedRecommendationSettingsStoreSchema.parse({});
    expect(result).toEqual({ settingsByProfileId: {} });
  });

  it("heals account-scoped settings", () => {
    const result = PersistedRecommendationSettingsStoreSchema.parse({
      settingsByProfileId: {
        "0": {
          allowPoolArtifactSteals: false,
          luckExpectationByTier: {
            S: "hopeful",
            A: "bad",
          },
        },
      },
    });

    expect(result.settingsByProfileId?.["0"].allowPoolArtifactSteals).toBe(
      false
    );
    expect(result.settingsByProfileId?.["0"].luckExpectationByTier.S).toBe(
      "hopeful"
    );
    expect(result.settingsByProfileId?.["0"].luckExpectationByTier.A).toBe(
      "balanced"
    );
  });
});

// ─── PersistedTriageStoreSchema ───

describe("PersistedTriageStoreSchema", () => {
  it("heals missing or corrupted settings to full defaults", () => {
    expect(PersistedTriageStoreSchema.parse({})).toEqual({
      settingsByProfileId: {},
    });
    expect(
      PersistedTriageStoreSchema.parse({ settingsByProfileId: 42 })
    ).toEqual({
      settingsByProfileId: {},
    });
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
    expect(result.settingsByProfileId?.["0"].backupAmountMode).toBe("normal");
    expect(result.settingsByProfileId?.["123456789"].triageMode).toBe("strict");
    expect(result.settingsByProfileId?.["123456789"].customFlexInputs).toEqual(
      []
    );
  });

  it("heals missing backup amount mode from keep-rule values", () => {
    const result = PersistedTriageStoreSchema.parse({
      settingsByProfileId: {
        "0": {
          qualityMargin: 10,
          fillerKeep: 5,
          setSlotKeep: 3,
        },
        "1": {
          qualityMargin: 8,
          fillerKeep: 3,
          setSlotKeep: 3,
        },
      },
    });

    expect(result.settingsByProfileId?.["0"].backupAmountMode).toBe("extra");
    expect(result.settingsByProfileId?.["1"].backupAmountMode).toBe("custom");
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

// ─── PersistedGenericTierListStoreSchema ───

describe("PersistedGenericTierListStoreSchema", () => {
  it("heals missing multi-list tier fields", () => {
    expect(PersistedGenericTierListStoreSchema.parse({})).toEqual({
      tierLists: {},
      activeTierListId: 1,
      nextId: 2,
    });
  });

  it("preserves valid generic tier-list instances", () => {
    const result = PersistedGenericTierListStoreSchema.parse({
      tierLists: {
        2: {
          id: 2,
          tierAssignments: {
            staff_of_homa: { tier: "S", position: 0 },
          },
          tierCustomization: {},
          customTitle: "Weapons",
          author: "me",
          description: "notes",
        },
      },
      activeTierListId: 2,
      nextId: 3,
    });

    expect(result.activeTierListId).toBe(2);
    expect(result.nextId).toBe(3);
    expect(result.tierLists[2].customTitle).toBe("Weapons");
    expect(result.tierLists[2]).not.toHaveProperty("linkedAccountId");
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

// ─── PersistedCloudSyncMetadataStoreSchema ───

describe("PersistedCloudSyncMetadataStoreSchema", () => {
  it("heals local cloud sync metadata maps", () => {
    expect(PersistedCloudSyncMetadataStoreSchema.parse({})).toEqual({
      deviceId: "",
      partitionsById: {},
      conflictsById: {},
    });

    const result = PersistedCloudSyncMetadataStoreSchema.parse({
      deviceId: 123,
      partitionsById: {
        "builds/default": {
          namespace: "builds",
          partitionKey: "default",
          lastSeenRev: "rev-1",
          lastAppliedHash: "sha256:old",
          dirty: "yes",
          updatedAt: "bad",
        },
      },
      conflictsById: {
        "builds/default": {
          id: "builds/default",
          namespace: "builds",
          partitionKey: "default",
          groupKey: "builds:default",
          conflictPolicy: "explicit-choice",
          reason: "both-changed",
          detectedAt: "bad",
        },
      },
    });

    expect(result.deviceId).toBe("");
    expect(result.partitionsById["builds/default"]).toMatchObject({
      namespace: "builds",
      partitionKey: "default",
      lastSeenRev: "rev-1",
      lastAppliedHash: "sha256:old",
      updatedAt: 0,
    });
    expect(result.partitionsById["builds/default"].dirty).toBeUndefined();
    expect(result.conflictsById["builds/default"]).toMatchObject({
      id: "builds/default",
      reason: "both-changed",
      detectedAt: 0,
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

// ─── PersistedTeamResultCacheStoreSchema ───

describe("PersistedTeamResultCacheStoreSchema", () => {
  it("heals team result cache envelope", () => {
    expect(PersistedTeamResultCacheStoreSchema.parse({})).toEqual({
      resultsByTeamId: {},
    });
    expect(
      PersistedTeamResultCacheStoreSchema.parse({
        resultsByTeamId: {
          "team-1": { choiceResults: { weapon: { timestamp: 1 } } },
        },
      }).resultsByTeamId["team-1"]
    ).toEqual({});
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
