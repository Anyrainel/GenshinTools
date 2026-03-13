import type {
  ArtifactData,
  Build,
  CharacterData,
  GlobalStatWeights,
  MainStat,
} from "@/data/types";
import {
  type ArtifactScoreResult,
  type StatWeightMap,
  buildToWeightMap,
  matchBuild,
  scoreAllSlots,
  scoreWithBuilds,
} from "@/lib/account-data/artifactScore";
import { describe, expect, it } from "vitest";

const testWeights: StatWeightMap = {
  cr: 100,
  cd: 100,
  "hp%": 80,
  em: 60,
  "atk%": 40,
  er: 20,
};

const testGlobalConfig = {
  flatAtk: 50,
  flatHp: 0,
  flatDef: 0,
};

// Full character with all artifacts
const fullCharacter: CharacterData = {
  key: "hutao",
  constellation: 1,
  level: 90,
  talent: { auto: 10, skill: 10, burst: 8 },
  artifacts: {
    flower: {
      id: "art-1",
      setKey: "CrimsonWitchOfFlames",
      slotKey: "flower",
      level: 20,
      rarity: 5,
      mainStatKey: "hp",
      lock: true,
      substats: { cd: 28.8, cr: 6.6, "atk%": 5.8, em: 40 },
    },
    plume: {
      id: "art-2",
      setKey: "CrimsonWitchOfFlames",
      slotKey: "plume",
      level: 20,
      rarity: 5,
      mainStatKey: "atk",
      lock: true,
      substats: { cd: 21.8, cr: 10.5, "hp%": 9.3, em: 23 },
    },
    sands: {
      id: "art-3",
      setKey: "CrimsonWitchOfFlames",
      slotKey: "sands",
      level: 20,
      rarity: 5,
      mainStatKey: "hp%",
      lock: true,
      substats: { cd: 14.0, cr: 7.0, em: 56, er: 5.2 },
    },
    goblet: {
      id: "art-4",
      setKey: "CrimsonWitchOfFlames",
      slotKey: "goblet",
      level: 20,
      rarity: 5,
      mainStatKey: "pyro%",
      lock: true,
      substats: { cd: 19.4, cr: 3.9, "hp%": 14.6, hp: 299 },
    },
    circlet: {
      id: "art-5",
      setKey: "GladiatorsFinale",
      slotKey: "circlet",
      level: 20,
      rarity: 5,
      mainStatKey: "cd",
      lock: true,
      substats: { cr: 10.9, "hp%": 15.7, em: 35, atk: 33 },
    },
  },
};

// Partial character with some missing artifacts
const partialCharacter: CharacterData = {
  key: "hutao",
  constellation: 0,
  level: 80,
  talent: { auto: 8, skill: 8, burst: 6 },
  artifacts: {
    flower: fullCharacter.artifacts!.flower,
    plume: fullCharacter.artifacts!.plume,
    // sands, goblet, circlet missing
  },
};

// Character with no artifacts
const emptyCharacter: CharacterData = {
  key: "hutao",
  constellation: 0,
  level: 1,
  talent: { auto: 1, skill: 1, burst: 1 },
  artifacts: {},
};

// Character with 4-star artifacts
const fourStarCharacter: CharacterData = {
  key: "hutao",
  constellation: 0,
  level: 70,
  talent: { auto: 6, skill: 6, burst: 6 },
  artifacts: {
    flower: {
      id: "art-4star",
      setKey: "Instructor",
      slotKey: "flower",
      level: 16,
      rarity: 4,
      mainStatKey: "hp",
      lock: false,
      substats: { cr: 3.5, cd: 7.0, em: 20 },
    },
  },
};

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

  describe("missing slots — set matching tolerance", () => {
    it("still matches 4pc when 1 slot is missing and 3 equipped are from the set", () => {
      // Arlecchino has 4pc fragment_of_harmonic_whimsy; remove goblet (1 missing)
      // Remaining: flower, plume, sands from set (3 pieces) + circlet from different set
      const partialArtifacts: CharacterData["artifacts"] = {
        flower: arlecchinoArtifacts.flower,
        plume: arlecchinoArtifacts.plume,
        sands: arlecchinoArtifacts.sands,
        // goblet missing
        circlet: arlecchinoArtifacts.circlet, // emblem_of_severed_fate
      };
      const result = matchBuild(partialArtifacts, [arlecchinoBuild], 6)!;
      expect(result.setMatched).toBe(true);
    });

    it("does not match 4pc when 1 slot is missing and only 2 equipped are from the set", () => {
      // Only 2 pieces from the set → not enough even with 1 missing
      const partialArtifacts: CharacterData["artifacts"] = {
        flower: arlecchinoArtifacts.flower, // fragment
        plume: arlecchinoArtifacts.plume, // fragment
        // sands missing
        // goblet missing — wait, we need 4 equipped for 1 missing
        circlet: arlecchinoArtifacts.circlet, // emblem
      };
      // 3 equipped, 2 missing, 2 from set → threshold = max(3, 4-2) = 3 → not matched
      const result = matchBuild(partialArtifacts, [arlecchinoBuild], 6)!;
      expect(result.setMatched).toBe(false);
    });

    it("prefers 4pc build over alternative when 1 slot is unequipped", () => {
      // With goblet missing, the 4pc build should still win over a non-set build
      const partialArtifacts: CharacterData["artifacts"] = {
        flower: arlecchinoArtifacts.flower,
        plume: arlecchinoArtifacts.plume,
        sands: arlecchinoArtifacts.sands,
        circlet: arlecchinoArtifacts.circlet,
      };
      const altBuild: Build = {
        ...xilonenBuild,
        id: "alt-build",
        artifactSet: "tenacity_of_the_millelith",
      };
      const result = matchBuild(
        partialArtifacts,
        [altBuild, arlecchinoBuild],
        6
      )!;
      expect(result.build.id).toBe("CRMaUWu");
      expect(result.setMatched).toBe(true);
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
    expect(map).toEqual({ cd: 100, cr: 100, "atk%": 90, atk: 90, em: 50 });
  });

  it("returns empty map for build with no substats", () => {
    const emptyBuild = { ...arlecchinoBuild, substats: [] };
    expect(buildToWeightMap(emptyBuild)).toEqual({});
  });
});

describe("scoreWithMatchedBuild", () => {
  describe("Arlecchino — perfect build match", () => {
    let result: ArtifactScoreResult;

    it("matches the correct build with set+main stat match", () => {
      result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.buildMatch).toBeDefined();
      expect(result.buildMatch!.build.id).toBe("CRMaUWu");
      expect(result.buildMatch!.setMatched).toBe(true);
      expect(result.buildMatch!.mainStatMatches).toBe(3);
    });

    it("reports isComplete = true with 5 artifacts", () => {
      result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.substatScore.isComplete).toBe(true);
    });

    it("generates positive sub scores for weighted stats", () => {
      result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.substatScore.subScore).toBeGreaterThan(0);
      expect(result.substatScore.statScores.cr.subScore).toBeGreaterThan(0);
      expect(result.substatScore.statScores.cd.subScore).toBeGreaterThan(0);
    });

    it("gives zero sub score for unweighted stats", () => {
      result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.substatScore.statScores["def%"].subScore).toBe(0);
      expect(result.substatScore.statScores["hp%"].subScore).toBe(0);
    });

    it("populates slot-level scores", () => {
      result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const slots = ["flower", "plume", "sands", "goblet", "circlet"] as const;
      for (const slot of slots) {
        expect(result.substatScore.slotSubScores[slot]).toBeGreaterThanOrEqual(
          0
        );
        expect(result.substatScore.slotMaxSubScores[slot]).toBeGreaterThan(0);
      }
    });
  });

  describe("Citlali — EM stacking build", () => {
    it("matches the set-matched build over non-set-matched", () => {
      const result = scoreWithBuilds(
        citlaliChar,
        [citlaliBuild2, citlaliBuild1], // build2 is tenacity (no match), build1 is scroll (4pc)
        GLOBAL_CONFIG
      );
      expect(result.buildMatch!.build.id).toBe("EB78-0G");
      expect(result.buildMatch!.setMatched).toBe(true);
    });

    it("scores EM substats highly", () => {
      const result = scoreWithBuilds(
        citlaliChar,
        [citlaliBuild1],
        GLOBAL_CONFIG
      );
      expect(result.substatScore.statScores.em.subScore).toBeGreaterThan(0);
      expect(result.substatScore.statScores.em.subValue).toBeGreaterThan(0);
    });

    it("scores ER substats (weight 100 in build1)", () => {
      const result = scoreWithBuilds(
        citlaliChar,
        [citlaliBuild1],
        GLOBAL_CONFIG
      );
      expect(result.substatScore.statScores.er.subScore).toBeGreaterThan(0);
    });

    it("gives zero score for CR/CD (not weighted in build1)", () => {
      const result = scoreWithBuilds(
        citlaliChar,
        [citlaliBuild1],
        GLOBAL_CONFIG
      );
      expect(result.substatScore.statScores.cr.subScore).toBe(0);
      expect(result.substatScore.statScores.cd.subScore).toBe(0);
    });

    it("scores CR/CD when using C6 build (build3)", () => {
      const result = scoreWithBuilds(
        citlaliChar,
        [citlaliBuild3], // cd(50), cr(50)
        GLOBAL_CONFIG
      );
      expect(result.substatScore.statScores.cr.subScore).toBeGreaterThan(0);
      expect(result.substatScore.statScores.cd.subScore).toBeGreaterThan(0);
    });
  });

  describe("missing slot — correct build and scoring", () => {
    it("selects the correct 4pc build when goblet is missing", () => {
      const partialChar: CharacterData = {
        ...arlecchinoChar,
        artifacts: {
          flower: arlecchinoArtifacts.flower,
          plume: arlecchinoArtifacts.plume,
          sands: arlecchinoArtifacts.sands,
          // goblet missing
          circlet: arlecchinoArtifacts.circlet,
        },
      };
      const result = scoreWithBuilds(
        partialChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.buildMatch).not.toBeNull();
      expect(result.buildMatch!.build.id).toBe("CRMaUWu");
      expect(result.buildMatch!.setMatched).toBe(true);
    });

    it("produces positive slot scores for equipped slots when 1 slot is missing", () => {
      const partialChar: CharacterData = {
        ...arlecchinoChar,
        artifacts: {
          flower: arlecchinoArtifacts.flower,
          plume: arlecchinoArtifacts.plume,
          sands: arlecchinoArtifacts.sands,
          circlet: arlecchinoArtifacts.circlet,
        },
      };
      const result = scoreWithBuilds(
        partialChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      // All equipped slots should have positive sub scores and max scores
      for (const slot of ["flower", "plume", "sands", "circlet"] as const) {
        expect(result.substatScore.slotSubScores[slot]).toBeGreaterThan(0);
        expect(result.substatScore.slotMaxSubScores[slot]).toBeGreaterThan(0);
      }
      // Missing slot stays at 0
      expect(result.substatScore.slotSubScores.goblet).toBe(0);
      expect(result.substatScore.slotMaxSubScores.goblet).toBe(0);
    });

    it("uses correct build weights even when competing build has different set", () => {
      const partialChar: CharacterData = {
        ...arlecchinoChar,
        artifacts: {
          flower: arlecchinoArtifacts.flower,
          plume: arlecchinoArtifacts.plume,
          sands: arlecchinoArtifacts.sands,
          circlet: arlecchinoArtifacts.circlet,
        },
      };
      // Add a competing build with different set and different weights
      const altBuild: Build = {
        ...xilonenBuild,
        id: "alt-def-build",
      };
      const result = scoreWithBuilds(
        partialChar,
        [altBuild, arlecchinoBuild],
        GLOBAL_CONFIG
      );
      // Should still pick arlecchinoBuild (3 set pieces with 1 missing)
      expect(result.buildMatch!.build.id).toBe("CRMaUWu");
      // CR/CD should score positively (arlecchinoBuild weights)
      expect(result.substatScore.statScores.cr.subScore).toBeGreaterThan(0);
      expect(result.substatScore.statScores.cd.subScore).toBeGreaterThan(0);
    });
  });

  describe("fallback — no builds", () => {
    it("returns null buildMatch when no builds provided", () => {
      const result = scoreWithBuilds(arlecchinoChar, [], GLOBAL_CONFIG);
      expect(result.buildMatch).toBeNull();
    });

    it("scores with fallback weights (cr/cd 100%)", () => {
      const result = scoreWithBuilds(arlecchinoChar, [], GLOBAL_CONFIG);
      expect(result.substatScore.subScore).toBeGreaterThan(0);
    });

    it("still reports isComplete correctly", () => {
      const result = scoreWithBuilds(arlecchinoChar, [], GLOBAL_CONFIG);
      expect(result.substatScore.isComplete).toBe(true);

      const barResult = scoreWithBuilds(bareChar, [], GLOBAL_CONFIG);
      expect(barResult.substatScore.isComplete).toBe(false);
    });
  });

  describe("score consistency", () => {
    it("total subScore equals sum of slot sub scores", () => {
      const result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const slotSubSum = Object.values(
        result.substatScore.slotSubScores
      ).reduce((s, v) => s + v, 0);
      expect(result.substatScore.subScore).toBeCloseTo(slotSubSum, 5);
    });

    it("stat sub values sum is consistent across slots", () => {
      const result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      // CR subValue should equal sum of all CR substat values across artifacts
      // flower: 6.2, plume: 14.4, goblet: 3.1, circlet: 17.1 = 40.8
      expect(result.substatScore.statScores.cr.subValue).toBeCloseTo(40.8, 1);
    });
  });
});

// ---------------------------------------------------------------------------
// Normalized Score (main stat scoring + 300-point scale)
// ---------------------------------------------------------------------------

describe("normalizedScore", () => {
  describe("full character — all main stats correct", () => {
    it("returns normalized info when build is matched", () => {
      const result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.normalized).not.toBeNull();
    });

    it("normalizedScore = (rawMainStatScore + subScore) × normalizer", () => {
      const result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      const expected =
        (n.rawMainStatScore + result.substatScore.subScore) * n.normalizer;
      expect(n.normalizedScore).toBeCloseTo(expected, 5);
    });

    it("normalizer = 300 / idealScore", () => {
      const result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      expect(n.normalizer).toBeCloseTo(300 / n.idealScore, 5);
    });

    it("awards 62.1 CD-equiv per correct 5★ main stat slot", () => {
      const result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      // Arlecchino: sands=atk%(✓), goblet=pyro%(✓), circlet=cd(✓) → 3 × 62.1
      expect(n.rawMainStatScore).toBeCloseTo(62.1 * 3, 1);
      expect(n.slotMainStatScores.sands).toBeCloseTo(62.1, 1);
      expect(n.slotMainStatScores.goblet).toBeCloseTo(62.1, 1);
      expect(n.slotMainStatScores.circlet).toBeCloseTo(62.1, 1);
    });

    it("flower and plume main stat scores are always 0", () => {
      const result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      expect(n.slotMainStatScores.flower).toBe(0);
      expect(n.slotMainStatScores.plume).toBe(0);
    });

    it("normalizedScore is below 300 for non-perfect artifacts", () => {
      const result = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(result.normalized!.normalizedScore).toBeLessThan(300);
      expect(result.normalized!.normalizedScore).toBeGreaterThan(0);
    });
  });

  describe("all main stats wrong", () => {
    it("rawMainStatScore is 0 when all main stats mismatch", () => {
      const result = scoreWithBuilds(
        mismatchedChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      expect(n.rawMainStatScore).toBe(0);
      expect(n.slotMainStatScores.sands).toBe(0);
      expect(n.slotMainStatScores.goblet).toBe(0);
      expect(n.slotMainStatScores.circlet).toBe(0);
    });

    it("normalizedScore is much lower than with correct main stats", () => {
      const correct = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const wrong = scoreWithBuilds(
        mismatchedChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(wrong.normalized!.normalizedScore).toBeLessThan(
        correct.normalized!.normalizedScore
      );
    });
  });

  describe("partial character — missing slots", () => {
    it("scores main stats only for equipped sands/goblet/circlet", () => {
      // Only sands equipped (correct main stat atk%)
      const partialChar: CharacterData = {
        ...arlecchinoChar,
        artifacts: {
          flower: arlecchinoArtifacts.flower,
          plume: arlecchinoArtifacts.plume,
          sands: arlecchinoArtifacts.sands,
          // goblet, circlet missing
        },
      };
      const result = scoreWithBuilds(
        partialChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      // Only sands contributes main stat score
      expect(n.slotMainStatScores.sands).toBeCloseTo(62.1, 1);
      expect(n.slotMainStatScores.goblet).toBe(0);
      expect(n.slotMainStatScores.circlet).toBe(0);
      expect(n.rawMainStatScore).toBeCloseTo(62.1, 1);
    });

    it("normalizedScore is lower with missing slots", () => {
      const partialChar: CharacterData = {
        ...arlecchinoChar,
        artifacts: {
          flower: arlecchinoArtifacts.flower,
          plume: arlecchinoArtifacts.plume,
          sands: arlecchinoArtifacts.sands,
        },
      };
      const full = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const partial = scoreWithBuilds(
        partialChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      expect(partial.normalized!.normalizedScore).toBeLessThan(
        full.normalized!.normalizedScore
      );
    });

    it("uses the same normalizer regardless of how many slots are equipped", () => {
      const partialChar: CharacterData = {
        ...arlecchinoChar,
        artifacts: {
          flower: arlecchinoArtifacts.flower,
          sands: arlecchinoArtifacts.sands,
        },
      };
      const full = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const partial = scoreWithBuilds(
        partialChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      // Normalizer depends only on build weights, not on what's equipped
      expect(partial.normalized!.normalizer).toBeCloseTo(
        full.normalized!.normalizer,
        5
      );
    });
  });

  describe("only flower and plume equipped", () => {
    it("rawMainStatScore is 0 (no sands/goblet/circlet)", () => {
      const partialChar: CharacterData = {
        ...arlecchinoChar,
        artifacts: {
          flower: arlecchinoArtifacts.flower,
          plume: arlecchinoArtifacts.plume,
        },
      };
      const result = scoreWithBuilds(
        partialChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      expect(n.rawMainStatScore).toBe(0);
      // But substats still contribute
      expect(n.normalizedScore).toBeGreaterThan(0);
    });
  });

  describe("no build — fallback", () => {
    it("normalized is null when no builds provided", () => {
      const result = scoreWithBuilds(arlecchinoChar, [], GLOBAL_CONFIG);
      expect(result.normalized).toBeNull();
    });
  });

  describe("empty character — no artifacts", () => {
    it("normalized score is 0 with no artifacts", () => {
      const result = scoreWithBuilds(
        bareChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      expect(n.normalizedScore).toBe(0);
      expect(n.rawMainStatScore).toBe(0);
    });
  });

  describe("4-star artifact main stat", () => {
    it("awards 46.4 CD-equiv for a correct 4★ main stat", () => {
      const char4Star: CharacterData = {
        key: "citlali",
        constellation: 0,
        level: 70,
        talent: { auto: 1, skill: 1, burst: 1 },
        artifacts: {
          sands: {
            id: "art-4star-sands",
            setKey: "scroll_of_the_hero_of_cinder_city",
            slotKey: "sands",
            level: 16,
            rarity: 4,
            mainStatKey: "em",
            lock: false,
            substats: { er: 5.0, cr: 3.0 },
          },
        },
      };
      const result = scoreWithBuilds(char4Star, [citlaliBuild1], GLOBAL_CONFIG);
      const n = result.normalized!;
      expect(n.slotMainStatScores.sands).toBeCloseTo(46.4, 1);
    });
  });

  describe("mixed correct and wrong main stats", () => {
    it("scores only the correct slots", () => {
      // sands correct (atk%), goblet wrong (hp%), circlet correct (cd)
      const mixedChar: CharacterData = {
        ...arlecchinoChar,
        artifacts: {
          flower: arlecchinoArtifacts.flower,
          plume: arlecchinoArtifacts.plume,
          sands: arlecchinoArtifacts.sands, // atk% ✓
          goblet: {
            id: "art-wrong-gob",
            setKey: "fragment_of_harmonic_whimsy",
            slotKey: "goblet",
            level: 20,
            rarity: 5,
            mainStatKey: "hp%", // ✗ (build wants atk% or pyro%)
            lock: false,
            substats: { cr: 5, cd: 10 },
          },
          circlet: arlecchinoArtifacts.circlet, // cd ✓
        },
      };
      const result = scoreWithBuilds(
        mixedChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      expect(n.slotMainStatScores.sands).toBeCloseTo(62.1, 1);
      expect(n.slotMainStatScores.goblet).toBe(0);
      expect(n.slotMainStatScores.circlet).toBeCloseTo(62.1, 1);
      expect(n.rawMainStatScore).toBeCloseTo(62.1 * 2, 1);
    });
  });

  describe("Citlali EM build — normalizer differs by build weights", () => {
    it("produces different normalizer than Arlecchino build", () => {
      const arlResult = scoreWithBuilds(
        arlecchinoChar,
        [arlecchinoBuild],
        GLOBAL_CONFIG
      );
      const citResult = scoreWithBuilds(
        citlaliChar,
        [citlaliBuild1],
        GLOBAL_CONFIG
      );
      // Different weight distributions → different ideal scores → different normalizers
      expect(arlResult.normalized!.normalizer).not.toBeCloseTo(
        citResult.normalized!.normalizer,
        2
      );
    });

    it("all 3 main stats scored for Citlali EM build", () => {
      const result = scoreWithBuilds(
        citlaliChar,
        [citlaliBuild1],
        GLOBAL_CONFIG
      );
      const n = result.normalized!;
      // Citlali: sands=em(✓), goblet=em(✓), circlet=em(✓)
      expect(n.rawMainStatScore).toBeCloseTo(62.1 * 3, 1);
    });
  });
});

describe("calculateArtifactScore", () => {
  describe("complete character (5 artifacts)", () => {
    it("returns isComplete = true", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.isComplete).toBe(true);
    });

    it("calculates positive sub score and slot scores", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.subScore).toBeGreaterThan(0);
    });

    it("populates slotSubScores for all 5 slots", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      const slots: Array<keyof typeof result.slotSubScores> = [
        "flower",
        "plume",
        "sands",
        "goblet",
        "circlet",
      ];
      slots.forEach((slot) => {
        expect(result.slotSubScores[slot]).toBeDefined();
        expect(result.slotSubScores[slot]).toBeGreaterThanOrEqual(0);
      });
    });

    it("populates slotMaxSubScores for 5-star artifacts", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      const slots: Array<keyof typeof result.slotMaxSubScores> = [
        "flower",
        "plume",
        "sands",
        "goblet",
        "circlet",
      ];
      slots.forEach((slot) => {
        expect(result.slotMaxSubScores[slot]).toBeGreaterThan(0);
      });
    });

    it("populates statScores with breakdown per stat", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      // CD should have both main (from circlet) and sub values
      expect(result.statScores.cd).toBeDefined();
      expect(result.statScores.cd.subValue).toBeGreaterThan(0);
      // CR should only have sub value (not a main stat on any piece)
      expect(result.statScores.cr).toBeDefined();
      expect(result.statScores.cr.subValue).toBeGreaterThan(0);
    });
  });

  describe("partial character (missing artifacts)", () => {
    it("returns isComplete = false", () => {
      const result = scoreAllSlots(
        partialCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.isComplete).toBe(false);
    });

    it("still calculates scores for equipped artifacts", () => {
      const result = scoreAllSlots(
        partialCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.subScore).toBeGreaterThan(0);
      expect(result.slotSubScores.flower).toBeGreaterThan(0);
      expect(result.slotSubScores.plume).toBeGreaterThan(0);
    });

    it("sets 0 scores for missing slots", () => {
      const result = scoreAllSlots(
        partialCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.slotSubScores.goblet).toBe(0);
      expect(result.slotSubScores.circlet).toBe(0);
    });
  });

  describe("character with no artifacts", () => {
    it("returns all zero scores", () => {
      const result = scoreAllSlots(
        emptyCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.subScore).toBe(0);
      expect(result.isComplete).toBe(false);
    });
  });

  describe("4-star artifacts", () => {
    it("calculates sub scores for 4-star artifacts", () => {
      const result = scoreAllSlots(
        fourStarCharacter,
        testWeights,
        testGlobalConfig
      );
      // Flower main stat is HP which has 0 weight, so main score is 0
      // But we have CR, CD, EM substats which should contribute
      expect(result.slotSubScores.flower).toBeGreaterThan(0);
    });

    it("calculates slotMaxSubScores for 4-star artifacts (lower than 5-star)", () => {
      const result = scoreAllSlots(
        fourStarCharacter,
        testWeights,
        testGlobalConfig
      );
      const result5Star = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      // 4-star max sub score formula uses fewer rolls (6 vs 8) and lower CD roll value
      // Both should have positive max sub scores for flower
      expect(result.slotMaxSubScores.flower).toBeGreaterThan(0);
      expect(result5Star.slotMaxSubScores.flower).toBeGreaterThan(0);
      expect(result.slotMaxSubScores.flower).toBeLessThan(
        result5Star.slotMaxSubScores.flower
      );
    });
  });

  describe("empty weights", () => {
    it("returns zero scores when weights object is empty", () => {
      const result = scoreAllSlots(fullCharacter, {}, testGlobalConfig);
      expect(result.subScore).toBe(0);
    });
  });

  describe("stat count computation", () => {
    it("computes statCount > 0 for a complete character with weighted stats", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.statCount).toBeGreaterThan(0);
    });

    it("returns statCount = 0 when no artifacts are equipped", () => {
      const result = scoreAllSlots(
        emptyCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.statCount).toBe(0);
    });

    it("returns statCount = 0 when weights are empty", () => {
      const result = scoreAllSlots(fullCharacter, {}, testGlobalConfig);
      expect(result.statCount).toBe(0);
    });

    it("computes per-stat subCount for weighted stats", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      // CR has weight 100, and fullCharacter has CR substats
      expect(result.statScores.cr.subCount).toBeGreaterThan(0);
      // CD has weight 100
      expect(result.statScores.cd.subCount).toBeGreaterThan(0);
    });

    it("does not count stats with zero weight", () => {
      // def% has no weight in testWeights
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result.statScores["def%"].subCount).toBe(0);
    });

    it("statCount equals the sum of all per-stat subCounts", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      const subCountSum = Object.values(result.statScores).reduce(
        (sum, s) => sum + s.subCount,
        0
      );
      expect(result.statCount).toBeCloseTo(subCountSum, 5);
    });

    it("computes lower subCount for 4-star artifacts", () => {
      // 4-star artifacts have lower max rolls, so same value yields higher roll count
      // But 4-star artifacts typically have lower stat values
      const result4 = scoreAllSlots(
        fourStarCharacter,
        testWeights,
        testGlobalConfig
      );
      expect(result4.statCount).toBeGreaterThan(0);
    });
  });

  describe("stat weight calculations", () => {
    it("applies weight correctly to crit stats", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      // CD has 100 weight, CR has 100 weight
      // Both should contribute to sub score
      expect(result.statScores.cd.weight).toBe(100);
      expect(result.statScores.cr.weight).toBe(100);
    });

    it("applies global flat effectiveness to flat stats", () => {
      const result = scoreAllSlots(
        fullCharacter,
        testWeights,
        testGlobalConfig
      );
      // We have flatAtk = 50, so atk weight should be effectively halved
      // The circlet has atk: 33 substat
      expect(result.statScores.atk.subValue).toBe(33);
    });
  });
});
