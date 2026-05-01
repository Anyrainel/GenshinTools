import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertEnkaToGOOD,
  type EnkaResponse,
  fetchEnkaData,
  hasCloudflareProxyForLocation,
} from "@/lib/account-data/import/enkaFetcher";

describe("enka", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setWindowLocation(hostname: string, port = "") {
    vi.spyOn(window, "location", "get").mockReturnValue({
      hostname,
      port,
    } as Location);
  }

  describe("hasCloudflareProxyForLocation", () => {
    it("uses the local proxy on Cloudflare deployment hosts", () => {
      expect(
        hasCloudflareProxyForLocation({
          hostname: "genshintools.pages.dev",
          port: "",
        })
      ).toBe(true);
      expect(
        hasCloudflareProxyForLocation({
          hostname: "ggartifact.anyrainel.workers.dev",
          port: "",
        })
      ).toBe(true);
      expect(
        hasCloudflareProxyForLocation({
          hostname: "cn.ggartifact.com",
          port: "",
        })
      ).toBe(true);
    });

    it("uses the local proxy for Wrangler dev but not Vite-only dev", () => {
      expect(
        hasCloudflareProxyForLocation({ hostname: "localhost", port: "8787" })
      ).toBe(true);
      expect(
        hasCloudflareProxyForLocation({ hostname: "127.0.0.1", port: "8788" })
      ).toBe(true);
      expect(
        hasCloudflareProxyForLocation({ hostname: "localhost", port: "5173" })
      ).toBe(false);
    });
  });

  describe("fetchEnkaData", () => {
    it("fetches Enka through the local Cloudflare proxy on Workers hosts", async () => {
      setWindowLocation("ggartifact.anyrainel.workers.dev");
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ playerInfo: { nickname: "A" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await expect(fetchEnkaData("123456789")).resolves.toMatchObject({
        playerInfo: { nickname: "A" },
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/enka/uid/123456789");
    });

    it("does not call a public CORS proxy on unsupported hosts", async () => {
      setWindowLocation("example.com");
      const fetchMock = vi.spyOn(globalThis, "fetch");

      await expect(fetchEnkaData("123456789")).rejects.toThrow(
        "Enka import requires the Cloudflare proxy"
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

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

    it("returns valid GOOD structure for empty avatar list", async () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [],
      });

      const { data: result } = await convertEnkaToGOOD(enkaData);

      expect(result.format).toBe("GOOD");
      expect(result.version).toBe(3);
      expect(result.source).toBe("enka");
      expect(result.characters).toEqual([]);
      expect(result.artifacts).toEqual([]);
      expect(result.weapons).toEqual([]);
    });

    it("returns valid GOOD structure when avatarInfoList is undefined", async () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: undefined,
      });

      const { data: result } = await convertEnkaToGOOD(enkaData);

      expect(result.format).toBe("GOOD");
      expect(result.characters).toEqual([]);
      expect(result.artifacts).toEqual([]);
      expect(result.weapons).toEqual([]);
    });

    it("correctly converts character data", async () => {
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

      const { data: result } = await convertEnkaToGOOD(enkaData);

      expect(result.characters).toHaveLength(1);
      expect(result.characters![0].key).toBe("alhaitham");
      expect(result.characters![0].level).toBe(90);
      expect(result.characters![0].constellation).toBe(3);
      expect(result.characters![0].talent).toEqual({
        auto: 10,
        skill: 9,
        burst: 8,
      });
    });

    it("handles missing propMap gracefully", async () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [
          {
            avatarId: 10000078,
            equipList: [],
          },
        ],
      });

      const { data: result } = await convertEnkaToGOOD(enkaData);

      expect(result.format).toBe("GOOD");
    });

    it("handles missing skillLevelMap gracefully", async () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [
          {
            avatarId: 10000078,
            propMap: {
              "4001": { ival: "90" },
            },
            equipList: [],
          },
        ],
      });

      const { data: result } = await convertEnkaToGOOD(enkaData);

      expect(result.format).toBe("GOOD");
    });

    it("skips unknown character IDs", async () => {
      const enkaData = createMinimalEnkaResponse({
        avatarInfoList: [
          {
            avatarId: 99999999, // Unknown ID
            propMap: {},
            equipList: [],
          },
        ],
      });

      const { data: result, warnings } = await convertEnkaToGOOD(enkaData);

      expect(result.characters?.length ?? 0).toBe(0);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe("character");
      expect(warnings[0].key).toContain("ID:99999999");
    });

    describe("multi-element character resolution", () => {
      it("resolves Traveler element via skillDepotId", async () => {
        const enkaData = createMinimalEnkaResponse({
          avatarInfoList: [
            {
              avatarId: 10000005, // Male Traveler
              skillDepotId: 507, // Electro
              propMap: { "4001": { ival: "90" } },
              equipList: [],
            },
          ],
        });

        const { data: result } = await convertEnkaToGOOD(enkaData);

        expect(result.characters).toHaveLength(1);
        expect(result.characters![0].key).toBe("traveler_electro");
      });

      it("resolves female Traveler to same internal key", async () => {
        const enkaData = createMinimalEnkaResponse({
          avatarInfoList: [
            {
              avatarId: 10000007, // Female Traveler
              skillDepotId: 708, // Dendro (female depot = male 508 + 200)
              propMap: { "4001": { ival: "90" } },
              equipList: [],
            },
          ],
        });

        const { data: result } = await convertEnkaToGOOD(enkaData);

        expect(result.characters).toHaveLength(1);
        expect(result.characters![0].key).toBe("traveler_dendro");
      });

      it("resolves Manekin element via skillDepotId", async () => {
        const enkaData = createMinimalEnkaResponse({
          avatarInfoList: [
            {
              avatarId: 10000117, // Manekin
              skillDepotId: 11706, // Anemo
              propMap: { "4001": { ival: "90" } },
              equipList: [],
            },
          ],
        });

        const { data: result } = await convertEnkaToGOOD(enkaData);

        expect(result.characters).toHaveLength(1);
        expect(result.characters![0].key).toBe("manekin_anemo");
      });

      it("resolves Manekina element via skillDepotId", async () => {
        const enkaData = createMinimalEnkaResponse({
          avatarInfoList: [
            {
              avatarId: 10000118, // Manekina
              skillDepotId: 11803, // Hydro
              propMap: { "4001": { ival: "90" } },
              equipList: [],
            },
          ],
        });

        const { data: result } = await convertEnkaToGOOD(enkaData);

        expect(result.characters).toHaveLength(1);
        expect(result.characters![0].key).toBe("manekina_hydro");
      });
    });

    describe("weapon conversion", () => {
      it("correctly converts equipped weapons", async () => {
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

        const { data: result } = await convertEnkaToGOOD(enkaData);

        expect(result.weapons!.length).toBe(1);
        expect(result.weapons![0].key).toBe("staff_of_homa");
        expect(result.weapons![0].level).toBe(90);
        expect(result.weapons![0].refinement).toBe(1);
        expect(result.weapons![0].location).toBe("hu_tao");
      });
    });

    describe("artifact conversion", () => {
      it("computes precise substat values from appendPropIdList", async () => {
        const enkaData = createMinimalEnkaResponse({
          avatarInfoList: [
            {
              avatarId: 10000046, // Hu Tao
              propMap: { "4001": { ival: "90" } },
              equipList: [
                {
                  itemId: 123456,
                  reliquary: {
                    level: 21,
                    mainPropId: 14001,
                    appendPropIdList: [
                      501203,
                      501204, // CR tier2 + tier3
                      501221,
                      501222,
                      501223, // CD tier0 + tier1 + tier2
                    ],
                  },
                  flat: {
                    nameTextMapHash: "654321",
                    setNameTextMapHash: "789",
                    rankLevel: 5,
                    itemType: "ITEM_RELIQUARY",
                    icon: "UI_RelicIcon_15006_4",
                    equipType: "EQUIP_BRACER",
                    reliquarySubstats: [
                      { appendPropId: 501201, statValue: 7.4 }, // CR rounded
                      { appendPropId: 501221, statValue: 18.7 }, // CD rounded
                    ],
                  },
                },
              ],
            },
          ],
        });

        const { data: result } = await convertEnkaToGOOD(enkaData);

        expect(result.artifacts!.length).toBe(1);
        const artifact = result.artifacts![0];
        expect(artifact.substats.length).toBe(2);
        // Precise CR: tier2 (3.50) + tier3 (3.89) = 7.39
        expect(artifact.substats[0].key).toBe("critRate_");
        expect(artifact.substats[0].value).toBeCloseTo(7.39, 2);
        // Precise CD: tier0 (5.44) + tier1 (6.22) + tier2 (6.99) = 18.65
        expect(artifact.substats[1].key).toBe("critDMG_");
        expect(artifact.substats[1].value).toBeCloseTo(18.65, 2);
      });

      it("falls back to flat.reliquarySubstats when appendPropIdList is missing", async () => {
        const enkaData = createMinimalEnkaResponse({
          avatarInfoList: [
            {
              avatarId: 10000046,
              propMap: { "4001": { ival: "90" } },
              equipList: [
                {
                  itemId: 123456,
                  reliquary: {
                    level: 21,
                    mainPropId: 14001,
                    // No appendPropIdList
                  },
                  flat: {
                    nameTextMapHash: "654321",
                    setNameTextMapHash: "789",
                    rankLevel: 5,
                    itemType: "ITEM_RELIQUARY",
                    icon: "UI_RelicIcon_15006_4",
                    equipType: "EQUIP_BRACER",
                    reliquarySubstats: [
                      { appendPropId: 501201, statValue: 7.4 },
                    ],
                  },
                },
              ],
            },
          ],
        });

        const { data: result } = await convertEnkaToGOOD(enkaData);

        expect(result.artifacts!.length).toBe(1);
        const artifact = result.artifacts![0];
        expect(artifact.substats[0].key).toBe("critRate_");
        expect(artifact.substats[0].value).toBe(7.4); // Rounded, not precise
      });

      it("correctly converts equipped artifacts with substats", async () => {
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

        const { data: result } = await convertEnkaToGOOD(enkaData);

        expect(result.artifacts!.length).toBe(1);
        const artifact = result.artifacts![0];
        expect(artifact.setKey).toBe("crimson_witch_of_flames");
        expect(artifact.level).toBe(20);
        expect(artifact.rarity).toBe(5);
        expect(artifact.substats.length).toBe(4);
        expect(artifact.substats[0].key).toBe("critRate_");
        expect(artifact.substats[0].value).toBe(10.5);
      });

      it("correctly maps artifact slots", async () => {
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

          const { data: result } = await convertEnkaToGOOD(enkaData);
          expect(result.artifacts!.length).toBe(1);
          expect(result.artifacts![0].slotKey).toBe(expectedSlot);
        }
      });

      it("correctly maps main stats", async () => {
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

          const { data: result } = await convertEnkaToGOOD(enkaData);
          expect(result.artifacts!.length).toBe(1);
          expect(result.artifacts![0].mainStatKey).toBe(expected);
        }
      });
    });
  });
});
