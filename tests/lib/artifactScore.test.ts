import type { ArtifactScoreConfig, CharacterData } from "@/data/types";
import { calculateArtifactScore } from "@/lib/artifactScore";
import { describe, expect, it } from "vitest";

// Test config with known weights
const testConfig: ArtifactScoreConfig = {
  global: {
    flatAtk: 50,
    flatHp: 0,
    flatDef: 0,
  },
  characters: {
    hutao: {
      cr: 100,
      cd: 100,
      "hp%": 80,
      em: 60,
      "atk%": 40,
      er: 20,
      "pyro%": 100,
    },
  },
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

describe("calculateArtifactScore", () => {
  describe("complete character (5 artifacts)", () => {
    it("returns isComplete = true", () => {
      const result = calculateArtifactScore(fullCharacter, testConfig);
      expect(result.isComplete).toBe(true);
    });

    it("calculates positive main and sub scores", () => {
      const result = calculateArtifactScore(fullCharacter, testConfig);
      expect(result.mainScore).toBeGreaterThan(0);
      expect(result.subScore).toBeGreaterThan(0);
    });

    it("populates slotMainScores for all 5 slots", () => {
      const result = calculateArtifactScore(fullCharacter, testConfig);
      const slots = ["flower", "plume", "sands", "goblet", "circlet"];
      slots.forEach((slot) => {
        expect(result.slotMainScores[slot]).toBeDefined();
        expect(result.slotMainScores[slot]).toBeGreaterThanOrEqual(0);
      });
    });

    it("populates slotSubScores for all 5 slots", () => {
      const result = calculateArtifactScore(fullCharacter, testConfig);
      const slots = ["flower", "plume", "sands", "goblet", "circlet"];
      slots.forEach((slot) => {
        expect(result.slotSubScores[slot]).toBeDefined();
        expect(result.slotSubScores[slot]).toBeGreaterThanOrEqual(0);
      });
    });

    it("populates slotMaxSubScores for 5-star artifacts", () => {
      const result = calculateArtifactScore(fullCharacter, testConfig);
      const slots = ["flower", "plume", "sands", "goblet", "circlet"];
      slots.forEach((slot) => {
        expect(result.slotMaxSubScores[slot]).toBeGreaterThan(0);
      });
    });

    it("populates statScores with breakdown per stat", () => {
      const result = calculateArtifactScore(fullCharacter, testConfig);
      // CD should have both main (from circlet) and sub values
      expect(result.statScores.cd).toBeDefined();
      expect(result.statScores.cd.mainValue).toBeGreaterThan(0);
      expect(result.statScores.cd.subValue).toBeGreaterThan(0);
      // CR should only have sub value (not a main stat on any piece)
      expect(result.statScores.cr).toBeDefined();
      expect(result.statScores.cr.subValue).toBeGreaterThan(0);
    });
  });

  describe("partial character (missing artifacts)", () => {
    it("returns isComplete = false", () => {
      const result = calculateArtifactScore(partialCharacter, testConfig);
      expect(result.isComplete).toBe(false);
    });

    it("still calculates scores for equipped artifacts", () => {
      const result = calculateArtifactScore(partialCharacter, testConfig);
      expect(result.subScore).toBeGreaterThan(0);
      expect(result.slotSubScores.flower).toBeGreaterThan(0);
      expect(result.slotSubScores.plume).toBeGreaterThan(0);
    });

    it("sets 0 scores for missing slots", () => {
      const result = calculateArtifactScore(partialCharacter, testConfig);
      expect(result.slotMainScores.sands).toBe(0);
      expect(result.slotSubScores.goblet).toBe(0);
      expect(result.slotSubScores.circlet).toBe(0);
    });
  });

  describe("character with no artifacts", () => {
    it("returns all zero scores", () => {
      const result = calculateArtifactScore(emptyCharacter, testConfig);
      expect(result.mainScore).toBe(0);
      expect(result.subScore).toBe(0);
      expect(result.isComplete).toBe(false);
    });
  });

  describe("4-star artifacts", () => {
    it("calculates sub scores for 4-star artifacts", () => {
      const result = calculateArtifactScore(fourStarCharacter, testConfig);
      // Flower main stat is HP which has 0 weight, so main score is 0
      // But we have CR, CD, EM substats which should contribute
      expect(result.slotSubScores.flower).toBeGreaterThan(0);
    });

    it("calculates slotMaxSubScores for 4-star artifacts (lower than 5-star)", () => {
      const result = calculateArtifactScore(fourStarCharacter, testConfig);
      const result5Star = calculateArtifactScore(fullCharacter, testConfig);
      // 4-star max sub score formula uses fewer rolls (6 vs 8) and lower CD roll value
      // Both should have positive max sub scores for flower
      expect(result.slotMaxSubScores.flower).toBeGreaterThan(0);
      expect(result5Star.slotMaxSubScores.flower).toBeGreaterThan(0);
      expect(result.slotMaxSubScores.flower).toBeLessThan(
        result5Star.slotMaxSubScores.flower
      );
    });
  });

  describe("character with no weight config", () => {
    it("returns zero scores when character has no weights", () => {
      const noWeightChar: CharacterData = {
        ...fullCharacter,
        key: "unknown_character",
      };
      const result = calculateArtifactScore(noWeightChar, testConfig);
      expect(result.subScore).toBe(0);
      expect(result.mainScore).toBe(0);
    });
  });

  describe("stat weight calculations", () => {
    it("applies weight correctly to crit stats", () => {
      const result = calculateArtifactScore(fullCharacter, testConfig);
      // CD has 100 weight, CR has 100 weight
      // Both should contribute to sub score
      expect(result.statScores.cd.weight).toBe(100);
      expect(result.statScores.cr.weight).toBe(100);
    });

    it("applies global flat effectiveness to flat stats", () => {
      const result = calculateArtifactScore(fullCharacter, testConfig);
      // We have flatAtk = 50, so atk weight should be effectively halved
      // The circlet has atk: 33 substat
      expect(result.statScores.atk.subValue).toBe(33);
    });
  });
});
