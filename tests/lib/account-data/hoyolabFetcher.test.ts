import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertHoyolabToGOOD,
  fetchHoyolabData,
  type HoyolabFetchResult,
} from "@/lib/account-data/import/hoyolabFetcher";

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

    const fetched = await fetchHoyolabData("800000000", {
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
    expect(result.warnings).toEqual([]);
    expect(result.data.characters?.[0]?.key).toBe("manekin_hydro");
  });
});
