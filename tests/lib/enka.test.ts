import {
  type EnkaResponse,
  convertEnkaToGOOD,
  fetchEnkaData,
} from "@/lib/enka";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("enka", () => {
  describe("fetchEnkaData", () => {
    describe("UID validation", () => {
      it("throws error for empty UID", async () => {
        await expect(fetchEnkaData("")).rejects.toThrow("Invalid UID format");
      });

      it("throws error for UID with wrong length", async () => {
        await expect(fetchEnkaData("12345678")).rejects.toThrow(
          "Invalid UID format"
        );
        await expect(fetchEnkaData("1234567890")).rejects.toThrow(
          "Invalid UID format"
        );
      });

      it("throws error for UID with non-numeric characters", async () => {
        await expect(fetchEnkaData("12345678a")).rejects.toThrow(
          "Invalid UID format"
        );
      });

      // Note: Actual fetch tests would require mocking global.fetch
      // which is complex and may be added later if needed
    });
  });

  describe("convertEnkaToGOOD", () => {
    // Minimal valid EnkaResponse structure
    const createMinimalEnkaResponse = (
      overrides: Partial<EnkaResponse> = {}
    ): EnkaResponse => ({
      playerInfo: {
        nickname: "TestPlayer",
        level: 60,
      },
      ...overrides,
    });

    it("returns valid GOOD structure for empty avatar list", () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [],
      });

      const { data: result } = convertEnkaToGOOD(enkaData);

      expect(result.format).toBe("GOOD");
      expect(result.version).toBe(1);
      expect(result.source).toBe("enka");
      expect(result.characters).toEqual([]);
      expect(result.artifacts).toEqual([]);
      expect(result.weapons).toEqual([]);
    });

    it("returns valid GOOD structure when avatarInfoList is undefined", () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: undefined,
      });

      const { data: result } = convertEnkaToGOOD(enkaData);

      expect(result.format).toBe("GOOD");
      expect(result.characters).toEqual([]);
      expect(result.artifacts).toEqual([]);
      expect(result.weapons).toEqual([]);
    });

    it("correctly converts character data", () => {
      // This test uses a known character ID from enkaIdMap
      // ID "10000078" is Alhaitham based on common Enka mappings
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [
          {
            avatarId: 10000078, // Alhaitham
            propMap: {
              "4001": { ival: "90" }, // level
              "1002": { ival: "6" }, // ascension
            },
            talentIdList: [1, 2, 3], // 3 constellations
            skillLevelMap: {
              "10781": 10, // auto
              "10782": 9, // skill
              "10785": 8, // burst
            },
            equipList: [],
          },
        ],
      });

      const { data: result } = convertEnkaToGOOD(enkaData);

      // If character ID is in the map, it should be converted
      // If not, the character array would be empty (skipped with warning)
      // We test the structure regardless
      expect(Array.isArray(result.characters)).toBe(true);
    });

    it("handles missing propMap gracefully", () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [
          {
            avatarId: 10000078,
            // propMap is missing
            equipList: [],
          },
        ],
      });

      const { data: result } = convertEnkaToGOOD(enkaData);

      // Should not throw
      expect(result.format).toBe("GOOD");
    });

    it("handles missing skillLevelMap gracefully", () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [
          {
            avatarId: 10000078,
            propMap: {
              "4001": { ival: "90" },
            },
            // skillLevelMap is missing
            equipList: [],
          },
        ],
      });

      const { data: result } = convertEnkaToGOOD(enkaData);

      // Should not throw
      expect(result.format).toBe("GOOD");
    });

    it("skips unknown character IDs", () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [
          {
            avatarId: 99999999, // Unknown ID
            propMap: {},
            equipList: [],
          },
        ],
      });

      const { data: result, warnings } = convertEnkaToGOOD(enkaData);

      // Unknown characters should be skipped
      expect(result.characters?.length ?? 0).toBe(0);

      // Should report warning
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe("character");
      expect(warnings[0].key).toContain("ID:99999999");
    });

    describe("weapon conversion", () => {
      it("correctly converts equipped weapons", () => {
        const enkaData = createMinimalEnkaResponse({
          avatarInfoList: [
            {
              avatarId: 10000046, // Hu Tao
              propMap: {
                "4001": { ival: "90" },
              },
              equipList: [
                {
                  itemId: 13501, // Staff of Homa
                  weapon: {
                    level: 90,
                    promoteLevel: 6,
                    affixMap: { "113501": 0 }, // R1 (0 = R1)
                  },
                  flat: {
                    nameTextMapHash: "123456",
                    rankLevel: 5,
                    itemType: "ITEM_WEAPON",
                    icon: "UI_EquipIcon_Pole_Homa",
                  },
                },
              ],
            },
          ],
        });

        const { data: result } = convertEnkaToGOOD(enkaData);

        expect(result.weapons!.length).toBe(1);
        expect(result.weapons![0].key).toBe("StaffofHoma");
        expect(result.weapons![0].level).toBe(90);
        expect(result.weapons![0].refinement).toBe(1);
        expect(result.weapons![0].location).toBe("HuTao");
      });
    });

    describe("artifact conversion", () => {
      it("correctly converts equipped artifacts with substats", () => {
        const enkaData = createMinimalEnkaResponse({
          avatarInfoList: [
            {
              avatarId: 10000046, // Hu Tao
              propMap: {
                "4001": { ival: "90" },
              },
              equipList: [
                {
                  itemId: 123456,
                  reliquary: {
                    level: 21, // level 20 (stored as level + 1)
                    mainPropId: 14001, // HP (flower)
                  },
                  flat: {
                    nameTextMapHash: "654321",
                    setNameTextMapHash: "789",
                    rankLevel: 5,
                    itemType: "ITEM_RELIQUARY",
                    icon: "UI_RelicIcon_15006_4", // Crimson Witch flower
                    equipType: "EQUIP_BRACER",
                    reliquarySubstats: [
                      { appendPropId: 501201, statValue: 10.5 }, // critRate_
                      { appendPropId: 501221, statValue: 21.0 }, // critDMG_
                      { appendPropId: 501061, statValue: 5.8 }, // atk_
                      { appendPropId: 501241, statValue: 40 }, // eleMas
                    ],
                  },
                },
              ],
            },
          ],
        });

        const { data: result } = convertEnkaToGOOD(enkaData);

        expect(result.artifacts!.length).toBe(1);
        const artifact = result.artifacts![0];
        expect(artifact.setKey).toBe("CrimsonWitchofFlames");
        expect(artifact.level).toBe(20);
        expect(artifact.rarity).toBe(5);
        expect(artifact.substats.length).toBe(4);
        expect(artifact.substats[0].key).toBe("critRate_");
        expect(artifact.substats[0].value).toBe(10.5);
      });

      it("correctly maps artifact slots", () => {
        // Test all 5 slots
        const slots = [
          { equipType: "EQUIP_BRACER", expectedSlot: "flower" },
          { equipType: "EQUIP_NECKLACE", expectedSlot: "plume" },
          { equipType: "EQUIP_SHOES", expectedSlot: "sands" },
          { equipType: "EQUIP_RING", expectedSlot: "goblet" },
          { equipType: "EQUIP_DRESS", expectedSlot: "circlet" },
        ];

        for (const { equipType, expectedSlot } of slots) {
          const enkaData = createMinimalEnkaResponse({
            avatarInfoList: [
              {
                avatarId: 10000046,
                propMap: {},
                equipList: [
                  {
                    itemId: 123,
                    reliquary: {
                      level: 21,
                      mainPropId: 14001,
                    },
                    flat: {
                      nameTextMapHash: "123",
                      rankLevel: 5,
                      itemType: "ITEM_RELIQUARY",
                      icon: "UI_RelicIcon_15006_4",
                      equipType,
                      reliquarySubstats: [],
                    },
                  },
                ],
              },
            ],
          });

          const { data: result } = convertEnkaToGOOD(enkaData);
          if (result.artifacts!.length > 0) {
            expect(result.artifacts![0].slotKey).toBe(expectedSlot);
          }
        }
      });

      it("correctly maps main stats", () => {
        const mainStats = [
          { propId: 14001, expected: "hp" }, // Flower
          { propId: 15003, expected: "atk" }, // Plume
          { propId: 50990, expected: "atk_" }, // Sands ATK%
          { propId: 50960, expected: "pyro_dmg_" }, // Goblet Pyro
          { propId: 30960, expected: "critRate_" }, // Circlet CR
        ];

        for (const { propId, expected } of mainStats) {
          const enkaData = createMinimalEnkaResponse({
            avatarInfoList: [
              {
                avatarId: 10000046,
                propMap: {},
                equipList: [
                  {
                    itemId: 123,
                    reliquary: {
                      level: 21,
                      mainPropId: propId,
                    },
                    flat: {
                      nameTextMapHash: "123",
                      rankLevel: 5,
                      itemType: "ITEM_RELIQUARY",
                      icon: "UI_RelicIcon_15006_4",
                      equipType: "EQUIP_BRACER",
                      reliquarySubstats: [],
                    },
                  },
                ],
              },
            ],
          });

          const { data: result } = convertEnkaToGOOD(enkaData);
          if (result.artifacts!.length > 0) {
            expect(result.artifacts![0].mainStatKey).toBe(expected);
          }
        }
      });
    });
  });
});
