import type {
  AccountData,
  ArtifactData,
  Build,
  BuildGroup,
  GlobalStatWeights,
  MainStat,
  Slot,
} from "@/data/types";
import { allSlots } from "@/data/types";
import {
  type EvalBuild,
  collectEvalBuilds,
  evaluateAllBuilds,
  getArchetypeLabel,
  getArchetypeRole,
  getBarColor,
  getScalingStat,
  getTier,
} from "@/lib/account-data/buildEvaluation";
import { describe, expect, it } from "vitest";
import { createAccountData, createArtifactData } from "../../fixtures";

// ---------------------------------------------------------------------------
// Helpers & Factories
// ---------------------------------------------------------------------------

const GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 30,
  flatHp: 30,
  flatDef: 30,
};

function createBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: "test-build",
    name: "",
    visible: true,
    composition: "4pc",
    sandsWeights: [{ stat: "atk%", weight: 100 }],
    gobletWeights: [{ stat: "pyro%", weight: 100 }],
    circletWeights: [{ stat: "cd", weight: 100 }],
    normalizer: 0,
    substats: [
      { stat: "cd", weight: 100 },
      { stat: "cr", weight: 100 },
      { stat: "atk%", weight: 90 },
      { stat: "em", weight: 50 },
    ],
    artifactSet: "fragment_of_harmonic_whimsy",
    characterId: "arlecchino",
    roles: ["dps"],
    ...overrides,
  };
}

function createBuildGroup(characterId: string, builds: Build[]): BuildGroup {
  return { characterId, builds };
}

/** Create a set of 5 artifacts for a given set/substats. */
function makeArtifactSet(
  setKey: string,
  substats: ArtifactData["substats"] = { cr: 10, cd: 20 },
  mainStats: {
    sands?: MainStat;
    goblet?: MainStat;
    circlet?: MainStat;
  } = {}
): ArtifactData[] {
  const slots: { slotKey: Slot; mainStatKey: MainStat }[] = [
    { slotKey: "flower", mainStatKey: "hp" },
    { slotKey: "plume", mainStatKey: "atk" },
    { slotKey: "sands", mainStatKey: mainStats.sands ?? "atk%" },
    { slotKey: "goblet", mainStatKey: mainStats.goblet ?? "pyro%" },
    { slotKey: "circlet", mainStatKey: mainStats.circlet ?? "cd" },
  ];
  return slots.map((s, i) =>
    createArtifactData({
      id: `${setKey}-${s.slotKey}-${i}`,
      setKey,
      slotKey: s.slotKey,
      mainStatKey: s.mainStatKey,
      substats,
      rarity: 5,
      level: 20,
    })
  );
}

const mockT = {
  statShort: (key: string) => key.toUpperCase(),
  role: (key: string) => key.charAt(0).toUpperCase() + key.slice(1),
  halfSetShort: (key: string) => key.split("-")[0].toUpperCase(),
};

// Reusable builds
const atkDpsBuild = createBuild({
  id: "atk-dps",
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "pyro%", weight: 100 }],
  circletWeights: [{ stat: "cd", weight: 100 }],
  substats: [
    { stat: "cd", weight: 100 },
    { stat: "cr", weight: 100 },
    { stat: "atk%", weight: 90 },
    { stat: "em", weight: 50 },
  ],
  artifactSet: "fragment_of_harmonic_whimsy",
  roles: ["dps"],
});

const hpSupportBuild = createBuild({
  id: "hp-support",
  sandsWeights: [{ stat: "hp%", weight: 100 }],
  gobletWeights: [{ stat: "hp%", weight: 100 }],
  circletWeights: [{ stat: "heal%", weight: 100 }],
  substats: [
    { stat: "hp%", weight: 100 },
    { stat: "er", weight: 80 },
    { stat: "em", weight: 50 },
  ],
  artifactSet: "tenacity_of_the_millelith",
  characterId: "zhongli",
  roles: ["support"],
});

const twoPlusTwoBuild = createBuild({
  id: "2+2-build",
  composition: "2pc+2pc",
  artifactSet: undefined,
  halfSet1: "atk%-18",
  halfSet2: "hp%-20",
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "pyro%", weight: 100 }],
  circletWeights: [{ stat: "cd", weight: 100 }],
  substats: [
    { stat: "cd", weight: 100 },
    { stat: "cr", weight: 100 },
    { stat: "atk%", weight: 80 },
  ],
  roles: ["dps"],
});

// ============================================================================
// Tests
// ============================================================================

describe("getScalingStat", () => {
  it("infers atk from atk% sands", () => {
    const build = createBuild({
      sandsWeights: [{ stat: "atk%", weight: 100 }],
    });
    expect(getScalingStat(build)).toBe("atk");
  });

  it("infers hp from hp% sands", () => {
    const build = createBuild({ sandsWeights: [{ stat: "hp%", weight: 100 }] });
    expect(getScalingStat(build)).toBe("hp");
  });

  it("infers def from def% sands", () => {
    const build = createBuild({
      sandsWeights: [{ stat: "def%", weight: 100 }],
    });
    expect(getScalingStat(build)).toBe("def");
  });

  it("infers em from em sands", () => {
    const build = createBuild({ sandsWeights: [{ stat: "em", weight: 100 }] });
    expect(getScalingStat(build)).toBe("em");
  });

  it("falls back to substat weights when sands is ER-only", () => {
    const build = createBuild({
      sandsWeights: [{ stat: "er", weight: 100 }],
      substats: [
        { stat: "hp%", weight: 100 },
        { stat: "er", weight: 80 },
      ],
    });
    expect(getScalingStat(build)).toBe("hp");
  });

  it("falls back to atk when sands is empty and no scaling substats", () => {
    const build = createBuild({
      sandsWeights: [],
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
      ],
    });
    expect(getScalingStat(build)).toBe("atk");
  });

  it("sands main stat takes priority over higher-weighted substats", () => {
    // hp% sands, but atk% substat is much higher weighted
    const build = createBuild({
      sandsWeights: [{ stat: "hp%", weight: 100 }],
      substats: [
        { stat: "atk%", weight: 100 },
        { stat: "hp%", weight: 30 },
      ],
    });
    expect(getScalingStat(build)).toBe("hp");
  });
});

describe("getArchetypeRole", () => {
  it("returns dps when roles includes dps", () => {
    const build = createBuild({ roles: ["dps"] });
    expect(getArchetypeRole(build)).toBe("dps");
  });

  it("returns support when roles includes support", () => {
    const build = createBuild({ roles: ["support"] });
    expect(getArchetypeRole(build)).toBe("support");
  });

  it("returns dps when roles includes both dps and support", () => {
    const build = createBuild({ roles: ["dps", "support"] });
    expect(getArchetypeRole(build)).toBe("dps");
  });

  it("returns support when roles is non-dps (e.g. sustain)", () => {
    const build = createBuild({ roles: ["sustain"] });
    expect(getArchetypeRole(build)).toBe("support");
  });

  it("infers dps from cd>=50 when roles is empty", () => {
    const build = createBuild({
      roles: [],
      substats: [{ stat: "cd", weight: 50 }],
    });
    expect(getArchetypeRole(build)).toBe("dps");
  });

  it("infers support from cd<50 when roles is empty", () => {
    const build = createBuild({
      roles: [],
      substats: [{ stat: "cd", weight: 49 }],
    });
    expect(getArchetypeRole(build)).toBe("support");
  });

  it("boundary: cd=50 is dps, cd=49 is support", () => {
    const build50 = createBuild({
      roles: [],
      substats: [{ stat: "cd", weight: 50 }],
    });
    const build49 = createBuild({
      roles: [],
      substats: [{ stat: "cd", weight: 49 }],
    });
    expect(getArchetypeRole(build50)).toBe("dps");
    expect(getArchetypeRole(build49)).toBe("support");
  });
});

describe("collectEvalBuilds", () => {
  describe("4pc collection", () => {
    it("collects a single 4pc build", () => {
      const groups = [createBuildGroup("char1", [atkDpsBuild])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(1);
      expect(result[0].composition).toBe("4pc");
      expect(result[0].artifactSet).toBe("fragment_of_harmonic_whimsy");
    });

    it("deduplicates builds with the same fingerprint", () => {
      // Two builds with identical set, weights, and role → same key → merge
      const build1 = createBuild({ id: "b1", characterId: "char1" });
      const build2 = createBuild({ id: "b2", characterId: "char2" });
      const groups = [
        createBuildGroup("char1", [build1]),
        createBuildGroup("char2", [build2]),
      ];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(1);
      expect(result[0].characterIds).toContain("char1");
      expect(result[0].characterIds).toContain("char2");
      expect(result[0].builds).toHaveLength(2);
    });

    it("keeps builds separate when artifact set differs", () => {
      const build1 = createBuild({
        id: "b1",
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const build2 = createBuild({
        id: "b2",
        artifactSet: "tenacity_of_the_millelith",
      });
      const groups = [createBuildGroup("char1", [build1, build2])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(2);
    });

    it("keeps builds separate when role differs", () => {
      const dpsBuild = createBuild({ id: "dps", roles: ["dps"] });
      const supBuild = createBuild({
        id: "sup",
        roles: ["support"],
        substats: [
          { stat: "hp%", weight: 100 },
          { stat: "er", weight: 80 },
        ],
      });
      const groups = [createBuildGroup("char1", [dpsBuild, supBuild])];
      const result = collectEvalBuilds(groups, false);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("keeps builds separate when weight fingerprint differs", () => {
      const build1 = createBuild({
        id: "b1",
        substats: [
          { stat: "cd", weight: 100 },
          { stat: "cr", weight: 100 },
        ],
      });
      const build2 = createBuild({
        id: "b2",
        substats: [
          { stat: "em", weight: 100 },
          { stat: "er", weight: 100 },
        ],
      });
      const groups = [createBuildGroup("char1", [build1, build2])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(2);
    });

    it("skips 4pc build with no artifactSet", () => {
      const build = createBuild({ artifactSet: undefined });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(0);
    });
  });

  describe("weight merging", () => {
    it("takes the max weight per stat when merging", () => {
      // Both builds: cd,cr at bucket 100; atk% at bucket 100 (90+) → same fingerprint
      // Only 50-tier stats differ → they should merge
      const build1 = createBuild({
        id: "b1",
        substats: [
          { stat: "cd", weight: 100 },
          { stat: "cr", weight: 100 },
          { stat: "atk%", weight: 95 },
          { stat: "em", weight: 50 },
        ],
      });
      const build2 = createBuild({
        id: "b2",
        substats: [
          { stat: "cd", weight: 100 },
          { stat: "cr", weight: 100 },
          { stat: "atk%", weight: 90 },
          { stat: "er", weight: 60 },
        ],
      });
      const groups = [createBuildGroup("char1", [build1, build2])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(1);
      // Max of atk%: max(95, 90) = 95
      expect(result[0].weights["atk%"]).toBe(95);
      // Both 50-tier stats merged
      expect(result[0].weights.em).toBe(50);
      expect(result[0].weights.er).toBe(60);
    });
  });

  describe("main stat merging", () => {
    it("unions sands/goblet/circlet main stats", () => {
      const build1 = createBuild({
        id: "b1",
        sandsWeights: [{ stat: "atk%", weight: 100 }],
        gobletWeights: [{ stat: "pyro%", weight: 100 }],
        circletWeights: [{ stat: "cd", weight: 100 }],
      });
      const build2 = createBuild({
        id: "b2",
        sandsWeights: [{ stat: "em", weight: 100 }],
        gobletWeights: [{ stat: "atk%", weight: 100 }],
        circletWeights: [{ stat: "cr", weight: 100 }],
      });
      // Both share same 100+75 fingerprint → should merge
      const groups = [createBuildGroup("char1", [build1, build2])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(1);
      expect(result[0].mainStats.sands).toContain("atk%");
      expect(result[0].mainStats.sands).toContain("em");
      expect(result[0].mainStats.goblet).toContain("pyro%");
      expect(result[0].mainStats.goblet).toContain("atk%");
      expect(result[0].mainStats.circlet).toContain("cd");
      expect(result[0].mainStats.circlet).toContain("cr");
    });

    it("does not duplicate main stats in union", () => {
      const build1 = createBuild({
        id: "b1",
        sandsWeights: [{ stat: "atk%", weight: 100 }],
      });
      const build2 = createBuild({
        id: "b2",
        sandsWeights: [{ stat: "atk%", weight: 100 }],
      });
      const groups = [createBuildGroup("char1", [build1, build2])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(1);
      const sandsCounts = result[0].mainStats.sands.filter((s) => s === "atk%");
      expect(sandsCounts).toHaveLength(1);
    });
  });

  describe("character merging", () => {
    it("unions characterIds without duplicates", () => {
      const build1 = createBuild({ id: "b1" });
      const build2 = createBuild({ id: "b2" });
      const groups = [
        createBuildGroup("char1", [build1]),
        createBuildGroup("char1", [build2]),
      ];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(1);
      const charIds = result[0].characterIds.filter((c) => c === "char1");
      expect(charIds).toHaveLength(1);
    });
  });

  describe("flat stat expansion", () => {
    it("expands atk% weight to flat atk", () => {
      const build = createBuild({
        substats: [{ stat: "atk%", weight: 100 }],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      expect(result[0].weights.atk).toBe(100);
    });

    it("expands hp% weight to flat hp", () => {
      const build = createBuild({
        substats: [{ stat: "hp%", weight: 100 }],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      expect(result[0].weights.hp).toBe(100);
    });

    it("expands def% weight to flat def", () => {
      const build = createBuild({
        substats: [{ stat: "def%", weight: 100 }],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      expect(result[0].weights.def).toBe(100);
    });

    it("does not overwrite flat stat if already higher", () => {
      const build = createBuild({
        substats: [
          { stat: "atk%", weight: 50 },
          { stat: "atk", weight: 80 },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      expect(result[0].weights.atk).toBe(80);
    });
  });

  describe("sortedSubstats", () => {
    it("buckets weights into 100/75/50 tiers", () => {
      const build = createBuild({
        substats: [
          { stat: "cd", weight: 100 },
          { stat: "cr", weight: 75 },
          { stat: "em", weight: 55 },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      const sorted = result[0].sortedSubstats;
      const cdEntry = sorted.find((s) => s.stat === "cd");
      const crEntry = sorted.find((s) => s.stat === "cr");
      const emEntry = sorted.find((s) => s.stat === "em");
      expect(cdEntry?.weight).toBe(100);
      expect(crEntry?.weight).toBe(75);
      expect(emEntry?.weight).toBe(50);
    });

    it("excludes stats below weight 50", () => {
      const build = createBuild({
        substats: [
          { stat: "cd", weight: 100 },
          { stat: "em", weight: 40 },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      const emEntry = result[0].sortedSubstats.find((s) => s.stat === "em");
      expect(emEntry).toBeUndefined();
    });

    it("hides flat stats when % counterpart dominates", () => {
      const build = createBuild({
        substats: [{ stat: "atk%", weight: 100 }],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      // atk should be expanded to 100 but hidden in sortedSubstats
      expect(result[0].weights.atk).toBe(100);
      const atkFlat = result[0].sortedSubstats.find((s) => s.stat === "atk");
      expect(atkFlat).toBeUndefined();
    });

    it("shows flat stat when it exceeds % counterpart", () => {
      const build = createBuild({
        substats: [
          { stat: "atk%", weight: 50 },
          { stat: "atk", weight: 80 },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, false);
      const atkFlat = result[0].sortedSubstats.find((s) => s.stat === "atk");
      expect(atkFlat).toBeDefined();
    });
  });

  describe("2+2 collection", () => {
    it("collects valid 2+2 builds when include2pc=true", () => {
      const groups = [createBuildGroup("char1", [twoPlusTwoBuild])];
      const result = collectEvalBuilds(groups, true);
      expect(result).toHaveLength(1);
      expect(result[0].composition).toBe("2+2");
      expect(result[0].artifactSet).toBe("__2+2__");
    });

    it("sets halfSet IDs and filtered set IDs", () => {
      const groups = [createBuildGroup("char1", [twoPlusTwoBuild])];
      const result = collectEvalBuilds(groups, true);
      expect(result[0].halfSet1Id).toBeDefined();
      expect(result[0].halfSet2Id).toBeDefined();
      // Should have rarity-5 set IDs
      expect(result[0].halfSet1SetIds!.length).toBeGreaterThan(0);
      expect(result[0].halfSet2SetIds!.length).toBeGreaterThan(0);
    });

    it("uses canonical pair ordering (sorted half-set IDs)", () => {
      // Build with halfSet1=hp%-20, halfSet2=atk%-18 should produce
      // same dedup key as halfSet1=atk%-18, halfSet2=hp%-20
      const buildA = createBuild({
        id: "2+2-a",
        composition: "2pc+2pc",
        artifactSet: undefined,
        halfSet1: "atk%-18",
        halfSet2: "hp%-20",
        roles: ["dps"],
      });
      const buildB = createBuild({
        id: "2+2-b",
        composition: "2pc+2pc",
        artifactSet: undefined,
        halfSet1: "hp%-20",
        halfSet2: "atk%-18",
        roles: ["dps"],
      });
      const groups = [createBuildGroup("char1", [buildA, buildB])];
      const result = collectEvalBuilds(groups, true);
      // Should merge into 1 due to canonical ordering
      expect(result).toHaveLength(1);
      expect(result[0].builds).toHaveLength(2);
    });

    it("skips 2+2 builds when include2pc=false", () => {
      const groups = [createBuildGroup("char1", [twoPlusTwoBuild])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(0);
    });

    it("skips builds with invalid half-set IDs", () => {
      const build = createBuild({
        composition: "2pc+2pc",
        artifactSet: undefined,
        halfSet1: "nonexistent-1",
        halfSet2: "nonexistent-2",
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, true);
      expect(result).toHaveLength(0);
    });

    it("skips 2+2 when all sets in a half-set are rarity < 5", () => {
      // cr-12 only has berserker which is rarity 4
      const build = createBuild({
        composition: "2pc+2pc",
        artifactSet: undefined,
        halfSet1: "cr-12",
        halfSet2: "atk%-18",
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = collectEvalBuilds(groups, true);
      // Should be skipped because cr-12 has no rarity-5 sets
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      const result = collectEvalBuilds([], false);
      expect(result).toHaveLength(0);
    });

    it("handles build group with empty builds array", () => {
      const groups = [createBuildGroup("char1", [])];
      const result = collectEvalBuilds(groups, false);
      expect(result).toHaveLength(0);
    });
  });
});

describe("getTier", () => {
  it("returns 90 tier for completeness >= 0.9", () => {
    expect(getTier(0.9).id).toBe("90");
  });

  it("returns 80 tier for completeness 0.8", () => {
    expect(getTier(0.8).id).toBe("80");
  });

  it("returns 70 tier for completeness 0.7", () => {
    expect(getTier(0.7).id).toBe("70");
  });

  it("returns 60 tier for completeness 0.6", () => {
    expect(getTier(0.6).id).toBe("60");
  });

  it("returns 0 tier for completeness 0.59", () => {
    expect(getTier(0.59).id).toBe("0");
  });

  it("returns 0 tier for completeness 0", () => {
    expect(getTier(0).id).toBe("0");
  });

  it("returns 90 tier for completeness over 1.0", () => {
    expect(getTier(1.5).id).toBe("90");
  });

  it("returns 0 tier for negative completeness", () => {
    expect(getTier(-0.5).id).toBe("0");
  });
});

describe("getBarColor", () => {
  it("returns bg-emerald-500 for 90+ tier", () => {
    expect(getBarColor(0.95)).toBe("bg-emerald-500");
  });

  it("returns bg-lime-400 for 80+ tier", () => {
    expect(getBarColor(0.85)).toBe("bg-lime-400");
  });

  it("returns bg-yellow-400 for 70+ tier", () => {
    expect(getBarColor(0.75)).toBe("bg-yellow-400");
  });

  it("returns bg-orange-400 for 60+ tier", () => {
    expect(getBarColor(0.65)).toBe("bg-orange-400");
  });

  it("returns bg-red-400 for below 60", () => {
    expect(getBarColor(0.3)).toBe("bg-red-400");
  });
});

describe("getArchetypeLabel", () => {
  it("returns 'scalingStat · role' for 4pc builds", () => {
    const evalBuild: EvalBuild = {
      key: "test",
      artifactSet: "some_set",
      composition: "4pc",
      flexCount: 1,
      builds: [],
      characterIds: [],
      weights: {},
      mainStats: { sands: [], goblet: [], circlet: [] },
      sortedSubstats: [],
      scalingStat: "atk",
      archetypeRole: "dps",
    };
    const label = getArchetypeLabel(evalBuild, mockT);
    expect(label).toBe("ATK · Dps");
  });

  it("returns 'halfSet1+halfSet2 · role' for 2+2 builds", () => {
    const evalBuild: EvalBuild = {
      key: "test",
      artifactSet: "__2+2__",
      composition: "2+2",
      flexCount: 1,
      builds: [],
      characterIds: [],
      weights: {},
      mainStats: { sands: [], goblet: [], circlet: [] },
      sortedSubstats: [],
      scalingStat: "atk",
      archetypeRole: "support",
      halfSet1Id: "atk%-18",
      halfSet2Id: "hp%-20",
    };
    const label = getArchetypeLabel(evalBuild, mockT);
    expect(label).toBe("ATK%+HP% · Support");
  });

  it("falls back to scaling stat when 2+2 has missing halfSetIds", () => {
    const evalBuild: EvalBuild = {
      key: "test",
      artifactSet: "__2+2__",
      composition: "2+2",
      flexCount: 1,
      builds: [],
      characterIds: [],
      weights: {},
      mainStats: { sands: [], goblet: [], circlet: [] },
      sortedSubstats: [],
      scalingStat: "hp",
      archetypeRole: "support",
      // halfSet1Id and halfSet2Id are undefined
    };
    const label = getArchetypeLabel(evalBuild, mockT);
    expect(label).toBe("HP · Support");
  });

  it("uses translation functions correctly", () => {
    const customT = {
      statShort: (key: string) => (key === "em" ? "精通" : key),
      role: (key: string) => (key === "dps" ? "输出" : "辅助"),
      halfSetShort: (key: string) => key,
    };
    const evalBuild: EvalBuild = {
      key: "test",
      artifactSet: "some_set",
      composition: "4pc",
      flexCount: 1,
      builds: [],
      characterIds: [],
      weights: {},
      mainStats: { sands: [], goblet: [], circlet: [] },
      sortedSubstats: [],
      scalingStat: "em",
      archetypeRole: "dps",
    };
    expect(getArchetypeLabel(evalBuild, customT)).toBe("精通 · 输出");
  });
});

describe("evaluateAllBuilds", () => {
  const emptyAccount = createAccountData();

  describe("basic 4pc evaluation", () => {
    it("returns correct number of SetGroups", () => {
      const build1 = createBuild({
        id: "b1",
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const build2 = createBuild({
        id: "b2",
        artifactSet: "tenacity_of_the_millelith",
        substats: [
          { stat: "hp%", weight: 100 },
          { stat: "er", weight: 80 },
        ],
        sandsWeights: [{ stat: "hp%", weight: 100 }],
        roles: ["support"],
      });
      const groups = [createBuildGroup("char1", [build1, build2])];
      const result = evaluateAllBuilds(
        groups,
        emptyAccount,
        GLOBAL_CONFIG,
        false
      );
      expect(result).toHaveLength(2);
    });

    it("completeness is between 0 and 1 with artifacts", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const artifacts = makeArtifactSet("fragment_of_harmonic_whimsy");
      const account = createAccountData({
        characters: [
          {
            key: "char1",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {
              flower: artifacts[0],
              plume: artifacts[1],
              sands: artifacts[2],
              goblet: artifacts[3],
              circlet: artifacts[4],
            },
          },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, false);
      expect(result).toHaveLength(1);
      const completeness = result[0].evaluations[0].completeness;
      expect(completeness).toBeGreaterThan(0);
      expect(completeness).toBeLessThanOrEqual(1);
    });

    it("completeness is 0 when no artifacts match", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(
        groups,
        emptyAccount,
        GLOBAL_CONFIG,
        false
      );
      expect(result).toHaveLength(1);
      expect(result[0].evaluations[0].completeness).toBe(0);
    });
  });

  describe("sorting", () => {
    it("groups are sorted by worstCompleteness ascending", () => {
      // Two builds: one with matching artifacts, one without
      const build1 = createBuild({
        id: "has-arts",
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const build2 = createBuild({
        id: "no-arts",
        artifactSet: "tenacity_of_the_millelith",
        substats: [
          { stat: "hp%", weight: 100 },
          { stat: "er", weight: 80 },
        ],
        sandsWeights: [{ stat: "hp%", weight: 100 }],
        roles: ["support"],
      });
      const artifacts = makeArtifactSet("fragment_of_harmonic_whimsy");
      const account = createAccountData({
        characters: [
          {
            key: "char1",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {
              flower: artifacts[0],
              plume: artifacts[1],
              sands: artifacts[2],
              goblet: artifacts[3],
              circlet: artifacts[4],
            },
          },
        ],
      });
      const groups = [createBuildGroup("char1", [build1, build2])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, false);
      expect(result.length).toBe(2);
      // First group should have the worst (lowest) completeness
      expect(result[0].worstCompleteness).toBeLessThanOrEqual(
        result[1].worstCompleteness
      );
    });

    it("evaluations within group are sorted by completeness ascending", () => {
      // Two builds in the same set with different substats
      const build1 = createBuild({
        id: "b1",
        artifactSet: "fragment_of_harmonic_whimsy",
        substats: [
          { stat: "cd", weight: 100 },
          { stat: "cr", weight: 100 },
          { stat: "atk%", weight: 90 },
        ],
        roles: ["dps"],
      });
      const build2 = createBuild({
        id: "b2",
        artifactSet: "fragment_of_harmonic_whimsy",
        substats: [
          { stat: "em", weight: 100 },
          { stat: "er", weight: 100 },
        ],
        sandsWeights: [{ stat: "em", weight: 100 }],
        roles: ["support"],
      });
      const groups = [createBuildGroup("char1", [build1, build2])];
      const result = evaluateAllBuilds(
        groups,
        emptyAccount,
        GLOBAL_CONFIG,
        false
      );
      // Find the fragment group
      const fragGroup = result.find(
        (g) => g.artifactSet === "fragment_of_harmonic_whimsy"
      );
      if (fragGroup && fragGroup.evaluations.length > 1) {
        expect(fragGroup.evaluations[0].completeness).toBeLessThanOrEqual(
          fragGroup.evaluations[1].completeness
        );
      }
    });
  });

  describe("slot details", () => {
    it("every slot has score >= 0 and maxScore > 0", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const artifacts = makeArtifactSet("fragment_of_harmonic_whimsy");
      const account = createAccountData({
        characters: [
          {
            key: "char1",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {
              flower: artifacts[0],
              plume: artifacts[1],
              sands: artifacts[2],
              goblet: artifacts[3],
              circlet: artifacts[4],
            },
          },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, false);
      const evaluation = result[0].evaluations[0];
      for (const slot of allSlots) {
        expect(evaluation.slots[slot].score).toBeGreaterThanOrEqual(0);
        expect(evaluation.slots[slot].maxScore).toBeGreaterThan(0);
      }
    });

    it("totalScore equals sum of slot scores", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const artifacts = makeArtifactSet("fragment_of_harmonic_whimsy");
      const account = createAccountData({
        characters: [
          {
            key: "char1",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {
              flower: artifacts[0],
              plume: artifacts[1],
              sands: artifacts[2],
              goblet: artifacts[3],
              circlet: artifacts[4],
            },
          },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, false);
      const evaluation = result[0].evaluations[0];
      const slotSum = allSlots.reduce(
        (sum, slot) => sum + evaluation.slots[slot].score,
        0
      );
      expect(evaluation.totalScore).toBeCloseTo(slotSum, 5);
    });

    it("has on-set and flex slot assignment", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const artifacts = makeArtifactSet("fragment_of_harmonic_whimsy");
      const account = createAccountData({
        characters: [
          {
            key: "char1",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {
              flower: artifacts[0],
              plume: artifacts[1],
              sands: artifacts[2],
              goblet: artifacts[3],
              circlet: artifacts[4],
            },
          },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, false);
      const evaluation = result[0].evaluations[0];
      const flexSlots = allSlots.filter(
        (slot) => evaluation.slots[slot].isFlexSlot
      );
      const onSetSlots = allSlots.filter(
        (slot) => !evaluation.slots[slot].isFlexSlot
      );
      // 4pc: flexCount=1 → exactly 1 flex slot, 4 on-set
      expect(flexSlots).toHaveLength(1);
      expect(onSetSlots).toHaveLength(4);
    });
  });

  describe("completeness calculation", () => {
    it("completeness equals totalScore / totalMaxScore", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const artifacts = makeArtifactSet("fragment_of_harmonic_whimsy");
      const account = createAccountData({
        characters: [
          {
            key: "char1",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {
              flower: artifacts[0],
              plume: artifacts[1],
              sands: artifacts[2],
              goblet: artifacts[3],
              circlet: artifacts[4],
            },
          },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, false);
      const evaluation = result[0].evaluations[0];
      if (evaluation.totalMaxScore > 0) {
        expect(evaluation.completeness).toBeCloseTo(
          evaluation.totalScore / evaluation.totalMaxScore,
          5
        );
      }
    });

    it("completeness is 0 when totalMaxScore is 0", () => {
      // Build with no weighted substats → maxScore effectively 0
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
        substats: [],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(
        groups,
        emptyAccount,
        GLOBAL_CONFIG,
        false
      );
      expect(result[0].evaluations[0].completeness).toBe(0);
    });
  });

  describe("2+2 evaluation", () => {
    it("includes 2+2 builds when flag is true", () => {
      const groups = [createBuildGroup("char1", [twoPlusTwoBuild])];
      const result = evaluateAllBuilds(
        groups,
        emptyAccount,
        GLOBAL_CONFIG,
        true
      );
      expect(result).toHaveLength(1);
      expect(result[0].artifactSet).toBe("__2+2__");
    });

    it("excludes 2+2 builds when flag is false", () => {
      const groups = [createBuildGroup("char1", [twoPlusTwoBuild])];
      const result = evaluateAllBuilds(
        groups,
        emptyAccount,
        GLOBAL_CONFIG,
        false
      );
      expect(result).toHaveLength(0);
    });

    it("assigns 4 on-set and 1 flex for 2+2 builds", () => {
      const artifacts = [
        ...makeArtifactSet("gladiators_finale"),
        ...makeArtifactSet("tenacity_of_the_millelith"),
      ];
      const account = createAccountData({ extraArtifacts: artifacts });
      const groups = [createBuildGroup("char1", [twoPlusTwoBuild])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, true);
      expect(result).toHaveLength(1);
      const evaluation = result[0].evaluations[0];
      const flexCount = allSlots.filter(
        (s) => evaluation.slots[s].isFlexSlot
      ).length;
      const onSetCount = allSlots.filter(
        (s) => !evaluation.slots[s].isFlexSlot
      ).length;
      expect(flexCount).toBe(1);
      expect(onSetCount).toBe(4);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty buildGroups", () => {
      const result = evaluateAllBuilds([], emptyAccount, GLOBAL_CONFIG, false);
      expect(result).toHaveLength(0);
    });

    it("handles empty account with builds", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(
        groups,
        emptyAccount,
        GLOBAL_CONFIG,
        false
      );
      expect(result).toHaveLength(1);
      expect(result[0].evaluations[0].completeness).toBe(0);
    });

    it("handles builds with no recommended main stats", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
        sandsWeights: [],
        gobletWeights: [],
        circletWeights: [],
      });
      const artifacts = makeArtifactSet("fragment_of_harmonic_whimsy");
      const account = createAccountData({
        characters: [
          {
            key: "char1",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {
              flower: artifacts[0],
              plume: artifacts[1],
              sands: artifacts[2],
              goblet: artifacts[3],
              circlet: artifacts[4],
            },
          },
        ],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, false);
      expect(result).toHaveLength(1);
      // Should still compute without errors
      expect(result[0].evaluations[0].totalMaxScore).toBeGreaterThan(0);
    });

    it("finds artifacts from both characters and extraArtifacts", () => {
      const build = createBuild({
        artifactSet: "fragment_of_harmonic_whimsy",
      });
      const charArtifacts = makeArtifactSet(
        "fragment_of_harmonic_whimsy",
        { cr: 12, cd: 25 },
        { sands: "atk%", goblet: "pyro%", circlet: "cd" }
      );
      const extraArt = createArtifactData({
        id: "extra-1",
        setKey: "fragment_of_harmonic_whimsy",
        slotKey: "flower",
        mainStatKey: "hp",
        substats: { cr: 14, cd: 28, "atk%": 10, em: 40 },
        rarity: 5,
        level: 20,
      });
      const account = createAccountData({
        characters: [
          {
            key: "char1",
            level: 90,
            constellation: 0,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {
              flower: charArtifacts[0],
              plume: charArtifacts[1],
              sands: charArtifacts[2],
              goblet: charArtifacts[3],
              circlet: charArtifacts[4],
            },
          },
        ],
        extraArtifacts: [extraArt],
      });
      const groups = [createBuildGroup("char1", [build])];
      const result = evaluateAllBuilds(groups, account, GLOBAL_CONFIG, false);
      expect(result[0].evaluations[0].completeness).toBeGreaterThan(0);
    });
  });
});
