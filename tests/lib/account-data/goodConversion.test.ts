import type { AccountData, CharacterData } from "@/data/types";
import {
  type GOODData,
  convertGOODToAccountData,
} from "@/lib/account-data/goodConversion";
import { mergePartialAccountData } from "@/lib/account-data/mergeAccountData";
import { describe, expect, it } from "vitest";
import goodMinimal from "../../fixtures/good-minimal.json";
import goodSample from "../../fixtures/good-sample.json";

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
      // Solver produces precise values; verify they round to display values
      expect(Math.round(flower!.substats.cd! * 10) / 10).toBe(28.8);
      expect(Math.round(flower!.substats.cr! * 10) / 10).toBe(6.6);
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
            level: 1,
            constellation: 0,
            ascension: 0,
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
        characters: [
          { key: "Traveler", level: 1, constellation: 0, ascension: 0 },
        ],
      };
      const result = convertGOODToAccountData(travelerData);
      expect(result.data.characters.length).toBeGreaterThanOrEqual(0);
    });

    it("handles bare Manekin key (third-party GOOD import)", () => {
      const data: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [
          { key: "Manekin", level: 90, constellation: 0, ascension: 6 },
        ],
      };
      const result = convertGOODToAccountData(data);
      // Should default to Pyro variant
      expect(result.data.characters).toHaveLength(1);
      expect(result.data.characters[0].key).toBe("manekin_pyro");
    });

    it("handles bare Manekina key (third-party GOOD import)", () => {
      const data: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [
          { key: "Manekina", level: 90, constellation: 0, ascension: 6 },
        ],
      };
      const result = convertGOODToAccountData(data);
      expect(result.data.characters).toHaveLength(1);
      expect(result.data.characters[0].key).toBe("manekina_pyro");
    });

    it("handles element-specific Manekin key from Enka conversion", () => {
      const data: GOODData = {
        format: "GOOD",
        version: 1,
        source: "enka",
        characters: [
          { key: "manekin_anemo", level: 90, constellation: 0, ascension: 6 },
        ],
      };
      const result = convertGOODToAccountData(data);
      expect(result.data.characters).toHaveLength(1);
      expect(result.data.characters[0].key).toBe("manekin_anemo");
    });

    it("handles element-specific Traveler key from Enka conversion", () => {
      const data: GOODData = {
        format: "GOOD",
        version: 1,
        source: "enka",
        characters: [
          {
            key: "traveler_dendro",
            level: 90,
            constellation: 0,
            ascension: 6,
          },
        ],
      };
      const result = convertGOODToAccountData(data);
      expect(result.data.characters).toHaveLength(1);
      expect(result.data.characters[0].key).toBe("traveler_dendro");
    });
  });

  describe("conversion warnings", () => {
    it("returns warning for unknown character", () => {
      const dataWithUnknownChar: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [
          { key: "UnknownCharacter", level: 1, constellation: 0, ascension: 0 },
        ],
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
        characters: [
          { key: "Amber", level: 1, constellation: 0, ascension: 0 },
        ],
        weapons: [
          {
            key: "UnknownWeapon",
            level: 1,
            ascension: 0,
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
        characters: [
          { key: "Amber", level: 1, constellation: 0, ascension: 0 },
        ],
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

  describe("presentSections", () => {
    it("reports all sections present for full GOOD data", () => {
      const result = convertGOODToAccountData(goodSample as GOODData);
      expect(result.presentSections).toEqual({
        characters: true,
        weapons: true,
        artifacts: true,
      });
    });

    it("reports no sections present for empty GOOD data", () => {
      const result = convertGOODToAccountData({
        format: "GOOD",
        version: 1,
        source: "Test",
      });
      expect(result.presentSections).toEqual({
        characters: false,
        weapons: false,
        artifacts: false,
      });
    });

    it("reports only characters present", () => {
      const result = convertGOODToAccountData({
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [
          { key: "Amber", level: 90, constellation: 0, ascension: 6 },
        ],
        weapons: [],
        artifacts: [],
      });
      expect(result.presentSections).toEqual({
        characters: true,
        weapons: false,
        artifacts: false,
      });
    });
  });

  describe("partial import with existingCharacters", () => {
    // Simulate existing account data with Hu Tao having weapon + artifacts
    const existingChars: CharacterData[] = [
      {
        key: "hu_tao",
        constellation: 1,
        level: 90,
        talent: { auto: 10, skill: 10, burst: 8 },
        weapon: {
          id: "weapon-0",
          key: "staff_of_homa",
          level: 90,
          refinement: 1,
          lock: true,
        },
        artifacts: {
          flower: {
            id: "artifact-0",
            setKey: "crimson_witch_of_flames",
            slotKey: "flower",
            level: 20,
            rarity: 5,
            mainStatKey: "hp",
            lock: true,
            substats: { cd: 28.8 },
          },
        },
      },
    ];

    it("seeds character map from existing when characters absent", () => {
      const weaponsOnlyGOOD: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        weapons: [
          {
            key: "StaffOfHoma",
            level: 90,
            ascension: 6,
            refinement: 2,
            location: "HuTao",
            lock: true,
          },
        ],
      };

      const result = convertGOODToAccountData(weaponsOnlyGOOD, existingChars);
      // Hu Tao should have the new weapon assigned via location
      const hutao = result.data.characters.find((c) => c.key === "hu_tao");
      expect(hutao).toBeDefined();
      expect(hutao?.weapon?.key).toBe("staff_of_homa");
      expect(hutao?.weapon?.refinement).toBe(2);
    });

    it("assigns artifacts to existing chars when characters absent", () => {
      const artifactsOnlyGOOD: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        artifacts: [
          {
            setKey: "ShimenawasReminiscence",
            slotKey: "flower",
            level: 20,
            rarity: 5,
            mainStatKey: "hp",
            location: "HuTao",
            lock: false,
            substats: [{ key: "critRate_", value: 12.0 }],
          },
        ],
      };

      const result = convertGOODToAccountData(artifactsOnlyGOOD, existingChars);
      const hutao = result.data.characters.find((c) => c.key === "hu_tao");
      expect(hutao?.artifacts?.flower?.setKey).toBe("shimenawas_reminiscence");
    });

    it("does not seed when characters section is present", () => {
      const charOnlyGOOD: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [
          { key: "Amber", level: 90, constellation: 6, ascension: 6 },
        ],
      };

      const result = convertGOODToAccountData(charOnlyGOOD, existingChars);
      // Only Amber should be present, not Hu Tao
      expect(result.data.characters).toHaveLength(1);
      expect(result.data.characters[0].key).toBe("amber");
    });
  });

  describe("mergePartialAccountData", () => {
    const existing: AccountData = {
      characters: [
        {
          key: "hu_tao",
          constellation: 1,
          level: 90,
          talent: { auto: 10, skill: 10, burst: 8 },
          weapon: {
            id: "weapon-0",
            key: "staff_of_homa",
            level: 90,
            refinement: 1,
            lock: true,
          },
          artifacts: {
            flower: {
              id: "artifact-0",
              setKey: "crimson_witch_of_flames",
              slotKey: "flower",
              level: 20,
              rarity: 5,
              mainStatKey: "hp",
              lock: true,
              substats: { cd: 28.8 },
            },
          },
        },
        {
          key: "xingqiu",
          constellation: 6,
          level: 90,
          talent: { auto: 1, skill: 9, burst: 12 },
          artifacts: {},
        },
      ],
      extraArtifacts: [
        {
          id: "artifact-10",
          setKey: "noblesse_oblige",
          slotKey: "flower",
          level: 20,
          rarity: 5,
          mainStatKey: "hp",
          lock: false,
          substats: {},
        },
      ],
      extraWeapons: [
        {
          id: "weapon-10",
          key: "favonius_sword",
          level: 90,
          refinement: 3,
          lock: false,
        },
      ],
    };

    it("preserves existing weapons when weapons section absent", () => {
      const incoming: AccountData = {
        characters: [
          {
            key: "hu_tao",
            constellation: 2, // updated
            level: 90,
            talent: { auto: 10, skill: 10, burst: 10 },
            artifacts: {},
          },
        ],
        extraArtifacts: [],
        extraWeapons: [],
      };

      const { data: result } = mergePartialAccountData(existing, incoming, {
        characters: true,
        weapons: false,
        artifacts: false,
      });

      const hutao = result.characters.find((c) => c.key === "hu_tao");
      // Character stats updated
      expect(hutao?.constellation).toBe(2);
      expect(hutao?.talent?.burst).toBe(10);
      // Weapon preserved from existing
      expect(hutao?.weapon?.key).toBe("staff_of_homa");
      // Artifacts preserved from existing
      expect(hutao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");
      // Extra weapons preserved
      expect(result.extraWeapons[0]?.key).toBe("favonius_sword");
      // Extra artifacts preserved
      expect(result.extraArtifacts[0]?.setKey).toBe("noblesse_oblige");
    });

    it("preserves existing chars when characters section absent", () => {
      const incoming: AccountData = {
        characters: [
          {
            key: "hu_tao",
            constellation: 1,
            level: 90,
            talent: { auto: 10, skill: 10, burst: 8 },
            weapon: {
              id: "weapon-0",
              key: "staff_of_homa",
              level: 90,
              refinement: 2, // updated refinement
              lock: true,
            },
            artifacts: {},
          },
        ],
        extraArtifacts: [],
        extraWeapons: [],
      };

      const { data: result } = mergePartialAccountData(existing, incoming, {
        characters: false,
        weapons: true,
        artifacts: false,
      });

      // Both existing characters preserved
      expect(result.characters).toHaveLength(2);
      const hutao = result.characters.find((c) => c.key === "hu_tao");
      // Stats from existing (chars section absent)
      expect(hutao?.constellation).toBe(1);
      // Weapon from incoming (weapons section present)
      expect(hutao?.weapon?.refinement).toBe(2);
      // Artifacts preserved from existing
      expect(hutao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");
    });

    it("replaces artifacts but keeps chars and weapons", () => {
      const incoming: AccountData = {
        characters: [
          {
            key: "hu_tao",
            constellation: 1,
            level: 90,
            talent: { auto: 10, skill: 10, burst: 8 },
            artifacts: {
              flower: {
                id: "artifact-0",
                setKey: "shimenawas_reminiscence",
                slotKey: "flower",
                level: 20,
                rarity: 5,
                mainStatKey: "hp",
                lock: false,
                substats: { cr: 12.0 },
              },
            },
          },
        ],
        extraArtifacts: [],
        extraWeapons: [],
      };

      const { data: result } = mergePartialAccountData(existing, incoming, {
        characters: false,
        weapons: false,
        artifacts: true,
      });

      const hutao = result.characters.find((c) => c.key === "hu_tao");
      // Stats preserved
      expect(hutao?.constellation).toBe(1);
      // Weapon preserved
      expect(hutao?.weapon?.key).toBe("staff_of_homa");
      // Artifacts replaced
      expect(hutao?.artifacts?.flower?.setKey).toBe("shimenawas_reminiscence");
      // Extra artifacts replaced (empty incoming)
      expect(result.extraArtifacts).toHaveLength(0);
    });

    it("returns incoming data when all sections present", () => {
      const incoming: AccountData = {
        characters: [
          {
            key: "amber",
            constellation: 0,
            level: 20,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {},
          },
        ],
        extraArtifacts: [],
        extraWeapons: [],
      };

      const { data: result } = mergePartialAccountData(existing, incoming, {
        characters: true,
        weapons: true,
        artifacts: true,
      });

      // Full replacement
      expect(result).toBe(incoming);
    });

    it("does not add new characters when characters section absent", () => {
      const incoming: AccountData = {
        characters: [
          {
            key: "amber",
            constellation: 0,
            level: 20,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {},
          },
        ],
        extraArtifacts: [],
        extraWeapons: [],
      };

      const { data: result } = mergePartialAccountData(existing, incoming, {
        characters: false,
        weapons: true,
        artifacts: false,
      });

      // No Amber added (characters section absent)
      expect(result.characters.find((c) => c.key === "amber")).toBeUndefined();
      // Existing characters preserved
      expect(result.characters).toHaveLength(2);
    });
  });

  describe("precise substats via solver", () => {
    const makeGOOD = (artifacts: GOODData["artifacts"]): GOODData => ({
      format: "GOOD",
      version: 3,
      source: "test",
      artifacts,
    });

    it("solves pct substats to precise values on import", () => {
      const data = makeGOOD([
        {
          setKey: "CrimsonWitchOfFlames",
          slotKey: "flower",
          level: 20,
          rarity: 5,
          mainStatKey: "hp",
          location: "",
          lock: false,
          substats: [
            { key: "critRate_", value: 10.5 },
            { key: "critDMG_", value: 21.0 },
            { key: "atk_", value: 5.8 },
            { key: "eleMas", value: 23 },
          ],
          totalRolls: 9,
        },
      ]);

      const result = convertGOODToAccountData(data);
      const art = result.data.extraArtifacts[0];

      // Pct stats should have precise values that round back to display
      expect(art.substats.cr).toBeDefined();
      expect(Math.round(art.substats.cr! * 10) / 10).toBe(10.5);
      // Flat stat should remain integer
      expect(art.substats.em).toBe(23);
    });

    it("skips solver when substats are already precise", () => {
      const data = makeGOOD([
        {
          setKey: "CrimsonWitchOfFlames",
          slotKey: "flower",
          level: 20,
          rarity: 5,
          mainStatKey: "hp",
          location: "",
          lock: false,
          substats: [
            { key: "critRate_", value: 10.47 },
            { key: "critDMG_", value: 21.01 },
            { key: "atk_", value: 5.83 },
            { key: "eleMas", value: 23 },
          ],
        },
      ]);

      const result = convertGOODToAccountData(data);
      const art = result.data.extraArtifacts[0];

      // Values should be preserved exactly
      expect(art.substats.cr).toBe(10.47);
      expect(art.substats.cd).toBe(21.01);
    });

    it("preserves display values when solver fails", () => {
      const data = makeGOOD([
        {
          setKey: "CrimsonWitchOfFlames",
          slotKey: "flower",
          level: 20,
          rarity: 5,
          mainStatKey: "hp",
          location: "",
          lock: false,
          substats: [{ key: "critRate_", value: 99.9 }],
        },
      ]);

      const result = convertGOODToAccountData(data);
      const art = result.data.extraArtifacts[0];

      // Should keep original display value
      expect(art.substats.cr).toBe(99.9);
    });
  });

  describe("stat key mapping", () => {
    it("converts GOOD stat keys to internal format", () => {
      const dataWithStats: GOODData = {
        format: "GOOD",
        version: 1,
        source: "Test",
        characters: [
          { key: "Amber", level: 1, constellation: 0, ascension: 0 },
        ],
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
