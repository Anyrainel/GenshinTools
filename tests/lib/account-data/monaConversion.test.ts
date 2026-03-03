import {
  type MonaData,
  convertMonaToAccountData,
} from "@/lib/account-data/monaConversion";
import { describe, expect, it } from "vitest";
import monaSample from "../../fixtures/mona-sample.json";

describe("convertMonaToAccountData", () => {
  describe("with sample Mona data", () => {
    const result = convertMonaToAccountData(monaSample as MonaData);
    const data = result.data;

    it("creates character entries from equip field", () => {
      // Hu Tao (胡桃) and Xingqiu (行秋)
      expect(data.characters).toHaveLength(2);
      const keys = data.characters.map((c) => c.key);
      expect(keys).toContain("hu_tao");
      expect(keys).toContain("xingqiu");
    });

    it("creates characters with C0, lv90, talent 10/10/10", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.level).toBe(90);
      expect(hutao?.constellation).toBe(0);
      expect(hutao?.talent).toEqual({ auto: 10, skill: 10, burst: 10 });
    });

    it("assigns artifacts to correct characters", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.artifacts?.flower).toBeDefined();
      expect(hutao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");
    });

    it("maps Mona slot names to internal slots", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      // feather -> plume
      expect(hutao?.artifacts?.plume).toBeDefined();
      expect(hutao?.artifacts?.plume?.slotKey).toBe("plume");
      // sand -> sands
      expect(hutao?.artifacts?.sands).toBeDefined();
      expect(hutao?.artifacts?.sands?.slotKey).toBe("sands");
      // cup -> goblet
      expect(hutao?.artifacts?.goblet).toBeDefined();
      expect(hutao?.artifacts?.goblet?.slotKey).toBe("goblet");
      // head -> circlet
      expect(hutao?.artifacts?.circlet).toBeDefined();
      expect(hutao?.artifacts?.circlet?.slotKey).toBe("circlet");
    });

    it("converts percentage substats from decimals to x100", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      const flower = hutao?.artifacts?.flower;
      // Mona: 0.288 -> internal: 28.8
      expect(flower?.substats?.cd).toBe(28.8);
      // Mona: 0.066 -> internal: 6.6
      expect(flower?.substats?.cr).toBe(6.6);
      // Mona: 0.058 -> internal: 5.8
      expect(flower?.substats?.["atk%"]).toBe(5.8);
    });

    it("keeps flat substats as-is", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      const flower = hutao?.artifacts?.flower;
      // EM 40 stays 40
      expect(flower?.substats?.em).toBe(40);
    });

    it("maps Mona stat keys to internal format", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      // flower main stat: lifeStatic -> hp
      expect(hutao?.artifacts?.flower?.mainStatKey).toBe("hp");
      // sands main stat: lifePercentage -> hp%
      expect(hutao?.artifacts?.sands?.mainStatKey).toBe("hp%");
      // goblet main stat: fireBonus -> pyro%
      expect(hutao?.artifacts?.goblet?.mainStatKey).toBe("pyro%");
      // circlet main stat: criticalDamage -> cd
      expect(hutao?.artifacts?.circlet?.mainStatKey).toBe("cd");
    });

    it("handles set name overrides (crimsonWitch -> Crimson Witch of Flames)", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");
    });

    it("handles set name overrides (gladiatorFinale -> Gladiator's Finale)", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.artifacts?.circlet?.setKey).toBe("gladiators_finale");
    });

    it("handles newer PascalCase set names (NymphsDream)", () => {
      // NymphsDream is an unequipped artifact, should be in extraArtifacts
      const nymphs = data.extraArtifacts.find(
        (a) => a.setKey === "nymphs_dream"
      );
      expect(nymphs).toBeDefined();
    });

    it("sets lock to false (Mona format has no lock info)", () => {
      const hutao = data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.artifacts?.flower?.lock).toBe(false);
    });

    it("puts unequipped artifacts in extraArtifacts", () => {
      expect(data.extraArtifacts.length).toBeGreaterThanOrEqual(1);
    });

    it("has empty extraWeapons (Mona has no weapon data)", () => {
      expect(data.extraWeapons).toHaveLength(0);
    });

    it("returns no warnings for valid data", () => {
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty Mona data", () => {
      const emptyData: MonaData = { version: "1" };
      const result = convertMonaToAccountData(emptyData);
      expect(result.data.characters).toHaveLength(0);
      expect(result.data.extraArtifacts).toHaveLength(0);
      expect(result.data.extraWeapons).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("handles English equip names", () => {
      const data: MonaData = {
        version: "1",
        flower: [
          {
            setName: "emblemOfSeveredFate",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: "Zhongli",
          },
        ],
      };
      const result = convertMonaToAccountData(data);
      expect(result.data.characters).toHaveLength(1);
      expect(result.data.characters[0].key).toBe("zhongli");
    });

    it("handles bare Traveler name in Chinese", () => {
      const data: MonaData = {
        version: "1",
        flower: [
          {
            setName: "emblemOfSeveredFate",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: "旅行者",
          },
        ],
      };
      const result = convertMonaToAccountData(data);
      expect(result.data.characters).toHaveLength(1);
      // Should default to Anemo variant
      expect(result.data.characters[0].key).toMatch(/^traveler_/);
    });

    it("returns warning for unknown artifact set", () => {
      const data: MonaData = {
        version: "1",
        flower: [
          {
            setName: "unknownSet",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: "",
          },
        ],
      };
      const result = convertMonaToAccountData(data);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe("artifact");
      expect(result.warnings[0].key).toBe("unknownSet");
    });

    it("deduplicates warnings for the same set name", () => {
      const data: MonaData = {
        version: "1",
        flower: [
          {
            setName: "unknownSet",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: "",
          },
          {
            setName: "unknownSet",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: "",
          },
        ],
      };
      const result = convertMonaToAccountData(data);
      expect(result.warnings).toHaveLength(1);
    });

    it("silently skips artifact sets in the skip list", () => {
      const data: MonaData = {
        version: "1",
        flower: [
          {
            setName: "adventurer",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 1000 },
            normalTags: [],
            omit: false,
            level: 0,
            star: 3,
            equip: "",
          },
        ],
      };
      const result = convertMonaToAccountData(data);
      expect(result.data.extraArtifacts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("percentage conversion", () => {
    it("correctly rounds percentage values", () => {
      const data: MonaData = {
        version: "1",
        flower: [
          {
            setName: "emblemOfSeveredFate",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [
              { name: "critical", value: 0.062 },
              { name: "criticalDamage", value: 0.194 },
              { name: "recharge", value: 0.052 },
              { name: "defendStatic", value: 23 },
            ],
            omit: false,
            level: 20,
            star: 5,
            equip: "",
          },
        ],
      };
      const result = convertMonaToAccountData(data);
      const art = result.data.extraArtifacts[0];
      expect(art.substats?.cr).toBe(6.2);
      expect(art.substats?.cd).toBe(19.4);
      expect(art.substats?.er).toBe(5.2);
      expect(art.substats?.def).toBe(23);
    });
  });
});
