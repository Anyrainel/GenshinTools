import type {
  ArtifactData,
  Build,
  CharacterData,
  GlobalStatWeights,
  MainStat,
} from "@/data/types";
import {
  type BuildAwareScoreResult,
  buildToWeightMap,
  calculateBuildAwareScore,
  matchBuild,
} from "@/lib/account-data/artifactScore";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 30,
  flatHp: 30,
  flatDef: 30,
};

// --- Arlecchino Build (from preset: CRMaUWu) ---
// sands: ["atk%"], goblet: ["atk%", "pyro%"], circlet: ["cd"]
// substats: cd(100), cr(100), atk%(90), em(50)
const arlecchinoBuild: Build = {
  id: "CRMaUWu",
  name: "",
  visible: true,
  composition: "4pc",
  sands: ["atk%"],
  goblet: ["atk%", "pyro%"],
  circlet: ["cd"],
  substats: [
    { stat: "cd", weight: 100 },
    { stat: "cr", weight: 100 },
    { stat: "atk%", weight: 90 },
    { stat: "em", weight: 50 },
  ],
  artifactSet: "fragment_of_harmonic_whimsy",
  characterId: "arlecchino",
  styles: ["on-field"],
  roles: ["dps"],
};

// --- Citlali Builds (from preset: EB78-0G, EB6x_xG, EB78-9e) ---
const citlaliBuild1: Build = {
  id: "EB78-0G",
  name: "",
  visible: true,
  composition: "4pc",
  sands: ["em", "er"],
  goblet: ["em"],
  circlet: ["em"],
  substats: [
    { stat: "em", weight: 100 },
    { stat: "er", weight: 100 },
  ],
  artifactSet: "scroll_of_the_hero_of_cinder_city",
  characterId: "citlali",
  styles: ["off-field"],
  roles: ["support", "sustain"],
};

const citlaliBuild2: Build = {
  id: "EB6x_xG",
  name: "队友带勇者",
  visible: true,
  composition: "4pc",
  sands: ["em", "er"],
  goblet: ["em"],
  circlet: ["em"],
  substats: [
    { stat: "em", weight: 100 },
    { stat: "er", weight: 70 },
  ],
  artifactSet: "tenacity_of_the_millelith",
  characterId: "citlali",
  styles: ["off-field"],
  roles: ["support", "sustain"],
};

// C6-only build
const citlaliBuild3: Build = {
  id: "EB78-9e",
  name: "",
  visible: true,
  composition: "4pc",
  sands: ["em"],
  goblet: ["em"],
  circlet: ["em"],
  substats: [
    { stat: "em", weight: 100 },
    { stat: "cd", weight: 50 },
    { stat: "cr", weight: 50 },
  ],
  artifactSet: "scroll_of_the_hero_of_cinder_city",
  characterId: "citlali",
  styles: ["off-field"],
  roles: ["support", "sustain"],
  minCons: 6,
};

// --- Xilonen Support Build (from preset: Dbsz50G) ---
const xilonenBuild: Build = {
  id: "Dbsz50G",
  name: "",
  visible: true,
  composition: "4pc",
  sands: ["def%"],
  goblet: ["def%"],
  circlet: ["def%"],
  substats: [
    { stat: "def%", weight: 100 },
    { stat: "er", weight: 50 },
  ],
  artifactSet: "scroll_of_the_hero_of_cinder_city",
  characterId: "xilonen",
  styles: ["off-field"],
  roles: ["support", "sustain"],
};

// --- Arlecchino's actual equipped artifacts (from GOOD export) ---
// 4x Fragment of Harmonic Whimsy + 1x Emblem of Severed Fate (circlet)
// sands: atk%, goblet: pyro%, circlet: cd → matches build exactly
const arlecchinoArtifacts: CharacterData["artifacts"] = {
  flower: {
    id: "art-arl-flower",
    setKey: "fragment_of_harmonic_whimsy",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: true,
    substats: { cr: 6.2, atk: 39, cd: 7.8, "atk%": 14.6 },
  },
  plume: {
    id: "art-arl-plume",
    setKey: "fragment_of_harmonic_whimsy",
    slotKey: "plume",
    level: 20,
    rarity: 5,
    mainStatKey: "atk",
    lock: true,
    substats: { cr: 14.4, "hp%": 5.8, cd: 5.4, hp: 478 },
  },
  sands: {
    id: "art-arl-sands",
    setKey: "fragment_of_harmonic_whimsy",
    slotKey: "sands",
    level: 20,
    rarity: 5,
    mainStatKey: "atk%",
    lock: false,
    substats: { er: 17.5, "hp%": 4.1, atk: 14, cd: 28.7 },
  },
  goblet: {
    id: "art-arl-goblet",
    setKey: "fragment_of_harmonic_whimsy",
    slotKey: "goblet",
    level: 20,
    rarity: 5,
    mainStatKey: "pyro%",
    lock: true,
    substats: { er: 6.5, "atk%": 9.3, cd: 26.4, cr: 3.1 },
  },
  circlet: {
    id: "art-arl-circlet",
    setKey: "emblem_of_severed_fate",
    slotKey: "circlet",
    level: 20,
    rarity: 5,
    mainStatKey: "cd",
    lock: true,
    substats: { hp: 299, "atk%": 4.7, "def%": 5.8, cr: 17.1 },
  },
};

const arlecchinoChar: CharacterData = {
  key: "arlecchino",
  constellation: 6,
  level: 100,
  talent: { auto: 10, skill: 9, burst: 10 },
  artifacts: arlecchinoArtifacts,
};

// --- Citlali's actual equipped artifacts (from GOOD export) ---
// 4x Scroll of the Hero of Cinder City + 1x Flower of Paradise Lost (goblet)
// sands: em, goblet: em, circlet: em → matches build1 and build3
const citlaliArtifacts: CharacterData["artifacts"] = {
  flower: {
    id: "art-cit-flower",
    setKey: "scroll_of_the_hero_of_cinder_city",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: { em: 84, "def%": 5.1, cd: 13.2, er: 4.5 },
  },
  plume: {
    id: "art-cit-plume",
    setKey: "scroll_of_the_hero_of_cinder_city",
    slotKey: "plume",
    level: 20,
    rarity: 5,
    mainStatKey: "atk",
    lock: true,
    substats: { cd: 20.2, em: 56, "hp%": 5.3, cr: 3.9 },
  },
  sands: {
    id: "art-cit-sands",
    setKey: "scroll_of_the_hero_of_cinder_city",
    slotKey: "sands",
    level: 20,
    rarity: 5,
    mainStatKey: "em",
    lock: true,
    substats: { cr: 10.1, def: 44, hp: 508, cd: 11.7 },
  },
  goblet: {
    id: "art-cit-goblet",
    setKey: "flower_of_paradise_lost",
    slotKey: "goblet",
    level: 20,
    rarity: 5,
    mainStatKey: "em",
    lock: true,
    substats: { cd: 14.8, cr: 7.4, hp: 687, def: 21 },
  },
  circlet: {
    id: "art-cit-circlet",
    setKey: "scroll_of_the_hero_of_cinder_city",
    slotKey: "circlet",
    level: 20,
    rarity: 5,
    mainStatKey: "em",
    lock: true,
    substats: { cr: 3.1, atk: 37, cd: 14.8, def: 63 },
  },
};

const citlaliChar: CharacterData = {
  key: "citlali",
  constellation: 6,
  level: 100,
  talent: { auto: 6, skill: 10, burst: 10 },
  artifacts: citlaliArtifacts,
};

// Character with no artifacts
const bareChar: CharacterData = {
  key: "amber",
  constellation: 0,
  level: 70,
  talent: { auto: 1, skill: 1, burst: 1 },
  artifacts: {},
};

// Character with mismatched main stats (sands: hp%, goblet: hp%, circlet: hp%)
const mismatchedChar: CharacterData = {
  key: "arlecchino",
  constellation: 6,
  level: 100,
  talent: { auto: 10, skill: 9, burst: 10 },
  artifacts: {
    flower: arlecchinoArtifacts.flower!,
    plume: arlecchinoArtifacts.plume!,
    sands: {
      id: "art-wrong-sands",
      setKey: "fragment_of_harmonic_whimsy",
      slotKey: "sands",
      level: 20,
      rarity: 5,
      mainStatKey: "hp%",
      lock: false,
      substats: { cr: 5, cd: 10 },
    },
    goblet: {
      id: "art-wrong-goblet",
      setKey: "fragment_of_harmonic_whimsy",
      slotKey: "goblet",
      level: 20,
      rarity: 5,
      mainStatKey: "hp%",
      lock: false,
      substats: { cr: 5, cd: 10 },
    },
    circlet: {
      id: "art-wrong-circlet",
      setKey: "fragment_of_harmonic_whimsy",
      slotKey: "circlet",
      level: 20,
      rarity: 5,
      mainStatKey: "hp%",
      lock: false,
      substats: { cr: 5, cd: 10 },
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("matchBuild", () => {
  describe("basic behavior", () => {
    it("returns null when no builds provided", () => {
      expect(matchBuild(arlecchinoArtifacts, [], 6)).toBeNull();
    });

    it("matches hidden builds when no visible builds exist", () => {
      const hiddenBuild = { ...arlecchinoBuild, visible: false };
      const result = matchBuild(arlecchinoArtifacts, [hiddenBuild], 6)!;
      expect(result).not.toBeNull();
      expect(result.build.id).toBe("CRMaUWu");
    });

    it("prefers visible builds over hidden on equal match", () => {
      const hiddenBuild = {
        ...arlecchinoBuild,
        id: "hidden-1",
        visible: false,
      };
      const visibleBuild = {
        ...arlecchinoBuild,
        id: "visible-1",
        visible: true,
      };
      const result = matchBuild(
        arlecchinoArtifacts,
        [hiddenBuild, visibleBuild],
        6
      )!;
      expect(result.build.id).toBe("visible-1");
    });

    it("picks hidden build when it has set match but visible does not", () => {
      // Visible build expects scroll_of_the_hero → 0 set pieces for Arlecchino
      const visibleBuild = { ...xilonenBuild, visible: true };
      // Hidden build expects fragment_of_harmonic_whimsy → 4 set pieces
      const hiddenBuild = { ...arlecchinoBuild, visible: false };
      const result = matchBuild(
        arlecchinoArtifacts,
        [visibleBuild, hiddenBuild],
        6
      )!;
      expect(result.build.id).toBe("CRMaUWu");
      expect(result.setMatched).toBe(true);
    });
  });

  describe("artifact set matching (tier 1)", () => {
    it("matches Arlecchino 4pc Fragment of Harmonic Whimsy", () => {
      // Arlecchino has 4 pieces of fragment_of_harmonic_whimsy
      const result = matchBuild(arlecchinoArtifacts, [arlecchinoBuild], 6)!;
      expect(result.setMatched).toBe(true);
      expect(result.mainStatMatches).toBe(3);
    });

    it("matches Citlali 4pc Scroll of the Hero of Cinder City", () => {
      // Citlali has 4 pieces of scroll_of_the_hero_of_cinder_city
      const result = matchBuild(citlaliArtifacts, [citlaliBuild1], 6)!;
      expect(result.setMatched).toBe(true);
    });

    it("prefers set-matched build over non-set-matched build with better main stats", () => {
      // Build A: wrong set but matching main stats
      const wrongSetBuild: Build = {
        ...arlecchinoBuild,
        id: "wrong-set",
        artifactSet: "tenacity_of_the_millelith", // not what's equipped
      };
      // Build B: correct set
      const result = matchBuild(
        arlecchinoArtifacts,
        [wrongSetBuild, arlecchinoBuild],
        6
      )!;
      expect(result.build.id).toBe("CRMaUWu");
      expect(result.setMatched).toBe(true);
    });

    it("reports setMatched=false when no build's set matches", () => {
      const wrongSetBuild: Build = {
        ...arlecchinoBuild,
        id: "wrong-set",
        artifactSet: "tenacity_of_the_millelith",
      };
      const result = matchBuild(arlecchinoArtifacts, [wrongSetBuild], 6)!;
      expect(result.setMatched).toBe(false);
    });

    it("distinguishes between builds by artifact set when main stats are the same", () => {
      // Both Citlali builds have the same main stats (em/em/em)
      // Build1 = scroll (4 pieces equipped), Build2 = tenacity (0 pieces)
      const result = matchBuild(
        citlaliArtifacts,
        [citlaliBuild2, citlaliBuild1],
        6
      )!;
      // Build1 should win because its set matches despite being listed second
      expect(result.build.id).toBe("EB78-0G");
      expect(result.setMatched).toBe(true);
    });
  });

  describe("main stat matching (tier 2)", () => {
    it("uses constellation to break ties when set and main stats match", () => {
      // Both build1 (C0) and build3 (C6) use scroll_of_the_hero_of_cinder_city
      // and have matching main stats — constellation tie-breaker picks C6 for C6 character
      const result = matchBuild(
        citlaliArtifacts,
        [citlaliBuild1, citlaliBuild3],
        6
      )!;
      expect(result.build.id).toBe("EB78-9e"); // C6 build wins
    });

    it("picks build with better main stat match when sets are equal", () => {
      // Create two builds with same set but different main stat recommendations
      const buildGoodMains: Build = {
        ...citlaliBuild1,
        id: "good-mains",
        sands: ["em"],
        goblet: ["em"],
        circlet: ["em"],
      };
      const buildBadMains: Build = {
        ...citlaliBuild1,
        id: "bad-mains",
        sands: ["er"],
        goblet: ["hp%"],
        circlet: ["hp%"],
      };
      // Citlali has em/em/em
      const result = matchBuild(
        citlaliArtifacts,
        [buildBadMains, buildGoodMains],
        6
      )!;
      expect(result.build.id).toBe("good-mains");
      expect(result.mainStatMatches).toBe(3);
    });

    it("reports main stat mismatches correctly", () => {
      // Arlecchino with Fragment 4pc but wrong main stats
      const result = matchBuild(
        mismatchedChar.artifacts,
        [arlecchinoBuild],
        6
      )!;
      expect(result.setMatched).toBe(true); // 5 pieces of fragment (flower+plume+sands+goblet+circlet)
      expect(result.mainStatMatches).toBe(0);
      expect(result.mainStatMismatches).toHaveLength(3);

      const sandsMismatch = result.mainStatMismatches.find(
        (m) => m.slot === "sands"
      )!;
      expect(sandsMismatch.equipped).toBe("hp%");
      expect(sandsMismatch.recommended).toEqual(["atk%"]);
    });

    it("handles missing artifact slots for main stat check", () => {
      const partial: CharacterData["artifacts"] = {
        sands: arlecchinoArtifacts.sands,
      };
      const result = matchBuild(partial, [arlecchinoBuild], 6)!;
      // Only sands can be checked: atk% ∈ [atk%] → 1 match, 0 mismatches
      expect(result.mainStatMatches).toBe(1);
      expect(result.mainStatMismatches).toHaveLength(0);
    });
  });

  describe("constellation matching (tier 3)", () => {
    it("picks highest satisfied constellation when set and main stats tie", () => {
      // C0 build and C6 build, both match set and main stats
      const c0Build: Build = { ...citlaliBuild1, id: "c0-build", minCons: 0 };
      const c6Build: Build = { ...citlaliBuild3, id: "c6-build", minCons: 6 };
      // Character at C6 → should pick C6 build
      const result = matchBuild(citlaliArtifacts, [c0Build, c6Build], 6)!;
      expect(result.build.id).toBe("c6-build");
    });

    it("skips builds with unsatisfied constellation requirement", () => {
      const c0Build: Build = { ...citlaliBuild1, id: "c0-build", minCons: 0 };
      const c6Build: Build = { ...citlaliBuild3, id: "c6-build", minCons: 6 };
      // Character at C4 → should pick C0 build (can't use C6)
      const result = matchBuild(citlaliArtifacts, [c0Build, c6Build], 4)!;
      expect(result.build.id).toBe("c0-build");
    });

    it("picks C2 when C0, C2, C6 exist and character is C4", () => {
      const c0Build: Build = { ...citlaliBuild1, id: "c0-build", minCons: 0 };
      const c2Build: Build = { ...citlaliBuild1, id: "c2-build", minCons: 2 };
      const c6Build: Build = { ...citlaliBuild3, id: "c6-build", minCons: 6 };
      const result = matchBuild(
        citlaliArtifacts,
        [c0Build, c2Build, c6Build],
        4
      )!;
      expect(result.build.id).toBe("c2-build");
    });

    it("treats undefined minCons as 0", () => {
      const noConsBuild: Build = { ...citlaliBuild1, id: "no-cons" };
      noConsBuild.minCons = undefined;
      const c2Build: Build = { ...citlaliBuild1, id: "c2-build", minCons: 2 };
      // At C2, should pick c2-build (highest satisfied)
      const result = matchBuild(citlaliArtifacts, [noConsBuild, c2Build], 2)!;
      expect(result.build.id).toBe("c2-build");
    });
  });

  describe("no set match — all builds are candidates", () => {
    it("falls through to main stat matching when no set matches", () => {
      // Give Arlecchino builds that don't match her equipped set
      const wrongSet1: Build = {
        ...arlecchinoBuild,
        id: "wrong1",
        artifactSet: "tenacity_of_the_millelith",
        sands: ["atk%"],
        goblet: ["pyro%"],
        circlet: ["cd"],
      };
      const wrongSet2: Build = {
        ...xilonenBuild,
        id: "wrong2",
        artifactSet: "crimson_witch_of_flames",
      };
      const result = matchBuild(
        arlecchinoArtifacts,
        [wrongSet2, wrongSet1],
        6
      )!;
      // Neither matches set, so main stat matching decides
      // wrongSet1: sands=atk%(✓) goblet=pyro%(✓) circlet=cd(✓) → 3
      // wrongSet2: sands=def%(✗) goblet=def%(✗) circlet=def%(✗) → 0
      expect(result.build.id).toBe("wrong1");
      expect(result.setMatched).toBe(false);
      expect(result.mainStatMatches).toBe(3);
    });
  });
});

describe("buildToWeightMap", () => {
  it("converts WeightedSubStat[] to StatWeightMap", () => {
    const map = buildToWeightMap(arlecchinoBuild);
    expect(map).toEqual({ cd: 100, cr: 100, "atk%": 90, em: 50 });
  });

  it("returns empty map for build with no substats", () => {
    const emptyBuild = { ...arlecchinoBuild, substats: [] };
    expect(buildToWeightMap(emptyBuild)).toEqual({});
  });
});

describe("calculateBuildAwareScore", () => {
  describe("Arlecchino — perfect build match", () => {
    let result: BuildAwareScoreResult;

    it("matches the correct build with set+main stat match", () => {
      result = calculateBuildAwareScore(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.matchedBuild).not.toBeNull();
      expect(result.matchedBuild!.build.id).toBe("CRMaUWu");
      expect(result.matchedBuild!.setMatched).toBe(true);
      expect(result.matchedBuild!.mainStatMatches).toBe(3);
    });

    it("reports isComplete = true with 5 artifacts", () => {
      result = calculateBuildAwareScore(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.isComplete).toBe(true);
    });

    it("generates positive sub scores for weighted stats", () => {
      result = calculateBuildAwareScore(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.subScore).toBeGreaterThan(0);
      expect(result.statScores.cr.subScore).toBeGreaterThan(0);
      expect(result.statScores.cd.subScore).toBeGreaterThan(0);
    });

    it("gives zero sub score for unweighted stats", () => {
      result = calculateBuildAwareScore(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.statScores["def%"].subScore).toBe(0);
      expect(result.statScores["hp%"].subScore).toBe(0);
    });

    it("populates slot-level scores", () => {
      result = calculateBuildAwareScore(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      for (const slot of ["flower", "plume", "sands", "goblet", "circlet"]) {
        expect(result.slotSubScores[slot]).toBeDefined();
        expect(result.slotMaxSubScores[slot]).toBeDefined();
      }
    });
  });

  describe("Citlali — EM stacking build", () => {
    it("matches the set-matched build over non-set-matched", () => {
      const result = calculateBuildAwareScore(
        citlaliChar,
        [citlaliBuild2, citlaliBuild1], // build2 is tenacity (no match), build1 is scroll (4pc)
        GLOBAL_CONFIG
      );
      expect(result.matchedBuild!.build.id).toBe("EB78-0G");
      expect(result.matchedBuild!.setMatched).toBe(true);
    });

    it("scores EM substats highly", () => {
      const result = calculateBuildAwareScore(
        citlaliChar,
        [citlaliBuild1],
        GLOBAL_CONFIG
      );
      expect(result.statScores.em.subScore).toBeGreaterThan(0);
      expect(result.statScores.em.subValue).toBeGreaterThan(0);
    });

    it("scores ER substats (weight 100 in build1)", () => {
      const result = calculateBuildAwareScore(
        citlaliChar,
        [citlaliBuild1],
        GLOBAL_CONFIG
      );
      expect(result.statScores.er.subScore).toBeGreaterThan(0);
    });

    it("gives zero score for CR/CD (not weighted in build1)", () => {
      const result = calculateBuildAwareScore(
        citlaliChar,
        [citlaliBuild1],
        GLOBAL_CONFIG
      );
      expect(result.statScores.cr.subScore).toBe(0);
      expect(result.statScores.cd.subScore).toBe(0);
    });

    it("scores CR/CD when using C6 build (build3)", () => {
      const result = calculateBuildAwareScore(
        citlaliChar,
        [citlaliBuild3], // cd(50), cr(50)
        GLOBAL_CONFIG
      );
      expect(result.statScores.cr.subScore).toBeGreaterThan(0);
      expect(result.statScores.cd.subScore).toBeGreaterThan(0);
    });
  });

  describe("fallback — no builds", () => {
    it("returns matchedBuild = null", () => {
      const result = calculateBuildAwareScore(
        arlecchinoChar,
        [],
        GLOBAL_CONFIG
      );
      expect(result.matchedBuild).toBeNull();
    });

    it("scores all substats at zero (no weights)", () => {
      const result = calculateBuildAwareScore(
        arlecchinoChar,
        [],
        GLOBAL_CONFIG
      );
      expect(result.subScore).toBe(0);
      expect(result.mainScore).toBe(0);
    });

    it("still reports isComplete correctly", () => {
      const result = calculateBuildAwareScore(
        arlecchinoChar,
        [],
        GLOBAL_CONFIG
      );
      expect(result.isComplete).toBe(true);

      const barResult = calculateBuildAwareScore(bareChar, [], GLOBAL_CONFIG);
      expect(barResult.isComplete).toBe(false);
    });
  });

  describe("score consistency", () => {
    it("total subScore equals sum of slot sub scores", () => {
      const result = calculateBuildAwareScore(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const slotSubSum = Object.values(result.slotSubScores).reduce(
        (s, v) => s + v,
        0
      );
      expect(result.subScore).toBeCloseTo(slotSubSum, 5);
    });

    it("total mainScore equals sum of slot main scores", () => {
      const result = calculateBuildAwareScore(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const slotMainSum = Object.values(result.slotMainScores).reduce(
        (s, v) => s + v,
        0
      );
      expect(result.mainScore).toBeCloseTo(slotMainSum, 5);
    });

    it("stat sub values sum is consistent across slots", () => {
      const result = calculateBuildAwareScore(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      // CR subValue should equal sum of all CR substat values across artifacts
      // flower: 6.2, plume: 14.4, goblet: 3.1, circlet: 17.1 = 40.8
      expect(result.statScores.cr.subValue).toBeCloseTo(40.8, 1);
    });
  });
});
