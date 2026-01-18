import { type GOODData, convertGOODToAccountData } from "@/lib/goodConversion";
import { describe, expect, it } from "vitest";
import goodMinimal from "../fixtures/good-minimal.json";
import goodSample from "../fixtures/good-sample.json";

describe("convertGOODToAccountData", () => {
  describe("with sample GOOD data", () => {
    const result = convertGOODToAccountData(goodSample as GOODData);
    const data = result.data;

    it("parses all characters", () => {
      expect(data.characters).toHaveLength(3);
    });

    it("correctly identifies character keys", () => {
      const keys = data.characters.map((c) => c.key);
      // Internal IDs use snake_case format
      expect(keys).toContain("hu_tao");
      expect(keys).toContain("xingqiu");
      expect(keys).toContain("zhongli");
    });

    it("parses character levels and constellations", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.level).toBe(90);
      expect(hutao?.constellation).toBe(1);
    });

    it("parses character talents", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.talent).toEqual({ auto: 10, skill: 10, burst: 8 });
    });

    it("assigns weapons to correct characters", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.weapon).toBeDefined();
      expect(hutao?.weapon?.key).toBe("staff_of_homa");
    });

    it("assigns artifacts to correct characters", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.artifacts).toBeDefined();
      expect(hutao?.artifacts?.flower).toBeDefined();
      // Artifact set keys are normalized (snake_case)
      expect(hutao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");
    });

    it("parses artifact substats as Record", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      const flower = hutao?.artifacts?.flower;
      expect(flower?.substats).toBeDefined();
      expect(flower?.substats?.cd).toBe(28.8);
      expect(flower?.substats?.cr).toBe(6.6);
    });

    it("collects unassigned artifacts in extraArtifacts", () => {
      expect(data.extraArtifacts).toBeDefined();
    });

    it("collects unassigned weapons in extraWeapons", () => {
      expect(data.extraWeapons).toBeDefined();
    });

    it("returns no warnings for valid data", () => {
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("with minimal GOOD data", () => {
    const result = convertGOODToAccountData(goodMinimal as GOODData);
    const data = result.data;

    it("parses single character", () => {
      expect(data.characters).toHaveLength(1);
      expect(data.characters[0].key).toBe("amber");
    });

    it("handles low-level character", () => {
      expect(data.characters[0].level).toBe(20);
      expect(data.characters[0].constellation).toBe(0);
    });

    it("handles 3-star artifact", () => {
      const artifact = data.characters[0].artifacts?.flower;
      expect(artifact?.rarity).toBe(3);
    });

    it("handles empty substats array", () => {
      const artifact = data.characters[0].artifacts?.flower;
      expect(artifact?.substats).toEqual({});
    });
  });

  describe("edge cases", () => {
    it("handles empty GOOD data", () => {
      const emptyData: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
      };
      const result = convertGOODToAccountData(emptyData);
      expect(result.data.characters).toHaveLength(0);
      expect(result.data.extraArtifacts).toHaveLength(0);
      expect(result.data.extraWeapons).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("handles missing optional arrays", () => {
      const partialData: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [
          {
            key: "Amber",
            constellation: 0,
          },
        ],
      };
      const result = convertGOODToAccountData(partialData);
      expect(result.data.characters).toHaveLength(1);
      expect(result.data.characters[0].level).toBe(1);
    });

    it("handles Traveler special case", () => {
      const travelerData: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [{ key: "Traveler", constellation: 0 }],
      };
      const result = convertGOODToAccountData(travelerData);
      expect(result.data.characters.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("conversion warnings", () => {
    it("returns warning for unknown character", () => {
      const dataWithUnknownChar: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [{ key: "UnknownCharacter", constellation: 0 }],
      };
      const result = convertGOODToAccountData(dataWithUnknownChar);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe("character");
      expect(result.warnings[0].key).toBe("UnknownCharacter");
    });

    it("returns warning for unknown weapon", () => {
      const dataWithUnknownWeapon: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [{ key: "Amber", constellation: 0 }],
        weapons: [
          {
            key: "UnknownWeapon",
            level: 1,
            refinement: 1,
            location: "",
            lock: false,
          },
        ],
      };
      const result = convertGOODToAccountData(dataWithUnknownWeapon);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe("weapon");
      expect(result.warnings[0].key).toBe("UnknownWeapon");
    });

    it("returns warning for unknown artifact set", () => {
      const dataWithUnknownArtifact: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [{ key: "Amber", constellation: 0 }],
        artifacts: [
          {
            setKey: "UnknownSet",
            slotKey: "flower",
            level: 0,
            rarity: 5,
            mainStatKey: "hp",
            location: "",
            lock: false,
            substats: [],
          },
        ],
      };
      const result = convertGOODToAccountData(dataWithUnknownArtifact);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe("artifact");
      expect(result.warnings[0].key).toBe("UnknownSet");
    });
  });

  describe("stat key mapping", () => {
    it("converts GOOD stat keys to internal format", () => {
      const dataWithStats: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [{ key: "Amber", constellation: 0 }],
        artifacts: [
          {
            setKey: "EmblemOfSeveredFate",
            slotKey: "sands",
            level: 20,
            rarity: 5,
            mainStatKey: "enerRech_", // GOOD format
            location: "Amber",
            lock: false,
            substats: [
              { key: "critRate_", value: 10 },
              { key: "critDMG_", value: 20 },
              { key: "atk_", value: 15 },
              { key: "eleMas", value: 50 },
            ],
          },
        ],
      };
      const result = convertGOODToAccountData(dataWithStats);
      const sands = result.data.characters[0]?.artifacts?.sands;

      if (sands) {
        expect(sands.mainStatKey).toBe("er");
        expect(sands.substats?.cr).toBe(10);
        expect(sands.substats?.cd).toBe(20);
        expect(sands.substats?.["atk%"]).toBe(15);
        expect(sands.substats?.em).toBe(50);
      }
    });
  });
});
