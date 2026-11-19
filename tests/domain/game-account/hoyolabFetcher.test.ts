import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertHoyolabToGOOD,
  fetchHoyolabData,
  type HoyolabFetchResult,
  uidToRegion,
  uidToServer,
} from "@/providers/hoyolab/hoyolabFetcher";

describe("hoyolabFetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeDetail(
    name: string,
    element: string,
    id: number
  ): HoyolabFetchResult["characters"][number] {
    return {
      base: {
        id,
        name,
        element,
        level: 90,
        rarity: 5,
        actived_constellation_num: 6,
      },
      weapon: {
        id: 11302,
        name: "Traveler's Handy Sword",
        type: 1,
        rarity: 3,
        level: 90,
        promote_level: 6,
        affix_level: 5,
      },
      relics: [],
      skills: [
        { name: "Normal Attack", level: 9, skill_type: 1 },
        { name: "Elemental Skill", level: 9, skill_type: 1 },
        { name: "Elemental Burst", level: 9, skill_type: 1 },
      ],
    };
  }

  it("uses HoYoLAB element data to resolve multi-element characters", () => {
    const result = convertHoyolabToGOOD({
      uid: "800000000",
      region: "os",
      server: "os_asia",
      characters: [
        makeDetail("Traveler", "Geo", 10000005),
        makeDetail("Manekin", "Hydro", 10000117),
        makeDetail("Manekina", "Anemo", 10000118),
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.data.characters?.map((character) => character.key)).toEqual([
      "traveler_geo",
      "manekin_hydro",
      "manekina_anemo",
    ]);
    expect(
      result.data.characters?.map((character) => character.element)
    ).toEqual(["Geo", "Hydro", "Anemo"]);
    expect(result.data.weapons?.map((weapon) => weapon.location)).toEqual([
      "traveler_geo",
      "manekin_hydro",
      "manekina_anemo",
    ]);
  });

  it("recognizes Cryo multi-element characters", () => {
    const result = convertHoyolabToGOOD({
      uid: "800000000",
      region: "os",
      server: "os_asia",
      characters: [
        makeDetail("Traveler", "Cryo", 10000005),
        makeDetail("Manekin", "Cryo", 10000117),
        makeDetail("Manekina", "Cryo", 10000118),
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.data.characters?.map((character) => character.key)).toEqual([
      "traveler_cryo",
      "manekin_cryo",
      "manekina_cryo",
    ]);
  });

  it("preserves individual substat upgrade counts from the character record", () => {
    const character = makeDetail("Nilou", "Hydro", 10000070);
    character.relics = [
      {
        id: 1,
        name: "Instructor's Brooch",
        pos: 1,
        rarity: 4,
        level: 16,
        set: { id: 10007, name: "Instructor" },
        main_property: { property_type: 2, value: "3571", times: 0 },
        sub_property_list: [
          { property_type: 28, value: "35", times: 1 },
          { property_type: 8, value: "15", times: 0 },
          { property_type: 3, value: "10.7%", times: 2 },
          { property_type: 22, value: "4.4%", times: 0 },
        ],
      },
    ];
    const { data } = convertHoyolabToGOOD({
      uid: "800000000",
      region: "os",
      server: "os_asia",
      characters: [character],
    });
    expect(data.artifacts?.[0].totalRolls).toBe(7);
    expect(data.artifacts?.[0].substats.map((s) => s.rollCount)).toEqual([
      2, 1, 3, 1,
    ]);
  });

  it("defaults multi-element characters without element data to Cryo", () => {
    const result = convertHoyolabToGOOD({
      uid: "800000000",
      region: "os",
      server: "os_asia",
      characters: [makeDetail("Traveler", "", 10000005)],
    });

    expect(result.warnings).toEqual([]);
    expect(result.data.characters?.[0]).toMatchObject({
      key: "traveler_cryo",
    });
  });

  it.each([10035, 5003, 10041, 1034])(
    "identifies retcode %i as a security verification challenge",
    async (retcode) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ retcode, message: "", data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );

      await expect(
        fetchHoyolabData("123456789", {
          ltuidV2: "uid",
          ltmidV2: "mid",
          ltokenV2: "token",
        })
      ).rejects.toThrow(
        `米游社要求进行安全验证（${retcode}）。请先在米游社 App 或网页中打开战绩页并完成验证，稍后再试。`
      );
    }
  );

  it.each([
    ["123456789", "cn", "cn_gf01"],
    ["523456789", "cn", "cn_qd01"],
    ["800000000", "os", "os_asia"],
    ["1800000000", "os", "os_asia"],
    ["1000000000", null, null],
    ["6800000000", null, null],
  ])("routes UID %s using the complete prefix", (uid, region, server) => {
    expect(uidToRegion(uid as string)).toBe(region);
    expect(uidToServer(uid as string)).toBe(server);
  });

  it("preserves character/list element as a detail fallback", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body));
        const data =
          "character_ids" in body
            ? {
                list: [makeDetail("Manekin", "", 10000117)],
              }
            : {
                list: [
                  {
                    id: 10000117,
                    name: "Manekin",
                    element: "Hydro",
                    level: 90,
                    rarity: 5,
                    actived_constellation_num: 6,
                  },
                ],
              };

        return new Response(
          JSON.stringify({
            retcode: 0,
            message: "OK",
            data,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      });

    const fetched = await fetchHoyolabData("1800000000", {
      ltuidV2: "uid",
      ltmidV2: "mid",
      ltokenV2: "token",
    });
    const result = convertHoyolabToGOOD(fetched);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/hoyolab/os/character/list",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-hoyolab-ltuid-v2": "uid",
          "x-hoyolab-ltmid-v2": "mid",
          "x-hoyolab-ltoken-v2": "token",
        }),
      })
    );
    expect(fetched.characters[0]?.base.element).toBe("Hydro");
    expect(fetched.region).toBe("os");
    expect(fetched.server).toBe("os_asia");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      role_id: "1800000000",
      server: "os_asia",
    });
    expect(result.warnings).toEqual([]);
    expect(result.data.characters?.[0]?.key).toBe("manekin_hydro");
  });
});
