/**
 * Behavioral lock for deriveSetKeysByChar — set key derivation from TeamBuild configs.
 */

import { describe, expect, it } from "vitest";
import { artifactHalfSetsById, artifactsById } from "@/data/gameResources";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import { deriveSetKeysByChar } from "@/lib/team-comp/generator/generator";

import "@/lib/dmgcalc";

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

const HALF_SET_ATK = "atk%-18";
const HALF_SET_EM = "em-80";

// Pre-compute expected concrete 5-star set for each half-set
const expected5StarAtk =
  artifactHalfSetsById[HALF_SET_ATK]?.setIds.find(
    (id) => artifactsById[id]?.rarity === 5
  ) ?? "";
const expected5StarEm =
  artifactHalfSetsById[HALF_SET_EM]?.setIds.find(
    (id) => artifactsById[id]?.rarity === 5
  ) ?? "";

function makeBaseConfigs(
  overrides: Partial<TeamSlotConfig>[] = []
): TeamSlotConfig[] {
  const defaults: TeamSlotConfig[] = [
    {
      charId: "diluc",
      charLevel: 90,
      constellation: 0,
      weaponId: "wolfs_gravestone",
      refinement: 1,
      artifactSet: null,
    },
    {
      charId: "xingqiu",
      charLevel: 90,
      constellation: 0,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSet: null,
    },
    {
      charId: "bennett",
      charLevel: 90,
      constellation: 0,
      weaponId: "aquila_favonia",
      refinement: 1,
      artifactSet: null,
    },
    {
      charId: "kaedehara_kazuha",
      charLevel: 90,
      constellation: 0,
      weaponId: "iron_sting",
      refinement: 1,
      artifactSet: null,
    },
  ];
  for (let i = 0; i < overrides.length; i++) {
    defaults[i] = { ...defaults[i], ...overrides[i] };
  }
  return defaults;
}

describe("deriveSetKeysByChar", () => {
  it("4pc config: all 5 slots get the same setKey", () => {
    const configs = makeBaseConfigs([
      { artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" } },
    ]);
    const tb = new TeamBuild(configs);
    const result = deriveSetKeysByChar(tb);

    expect(result.diluc).toBeDefined();
    expect(result.diluc.flower).toBe("crimson_witch_of_flames");
    expect(result.diluc.plume).toBe("crimson_witch_of_flames");
    expect(result.diluc.sands).toBe("crimson_witch_of_flames");
    expect(result.diluc.goblet).toBe("crimson_witch_of_flames");
    expect(result.diluc.circlet).toBe("crimson_witch_of_flames");
  });

  it("2+2pc config: flower/plume/sands get sk1, goblet/circlet get sk2", () => {
    const configs = makeBaseConfigs([
      {
        artifactSet: {
          type: "2pc+2pc",
          halfSetIds: [HALF_SET_ATK, HALF_SET_EM],
        },
      },
    ]);
    const tb = new TeamBuild(configs);
    const result = deriveSetKeysByChar(tb);

    expect(result.diluc).toBeDefined();
    // First 3 slots use first half-set's concrete 5-star set
    expect(result.diluc.flower).toBe(expected5StarAtk);
    expect(result.diluc.plume).toBe(expected5StarAtk);
    expect(result.diluc.sands).toBe(expected5StarAtk);
    // Last 2 slots use second half-set's concrete 5-star set
    expect(result.diluc.goblet).toBe(expected5StarEm);
    expect(result.diluc.circlet).toBe(expected5StarEm);
    // Two sets must be distinct
    expect(expected5StarAtk).not.toBe(expected5StarEm);
  });

  it("empty/missing config: character is skipped", () => {
    const configs = makeBaseConfigs([
      // diluc has no artifact config
      { artifactSet: null },
    ]);
    const tb = new TeamBuild(configs);
    const result = deriveSetKeysByChar(tb);

    // diluc should not be in the result
    expect(result.diluc).toBeUndefined();
  });

  it("multiple characters with different configs", () => {
    const configs = makeBaseConfigs([
      { artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" } },
      {
        artifactSet: {
          type: "2pc+2pc",
          halfSetIds: [HALF_SET_ATK, HALF_SET_EM],
        },
      },
      // bennett: no config
      // kazuha: no config
    ]);
    const tb = new TeamBuild(configs);
    const result = deriveSetKeysByChar(tb);

    // diluc: 4pc
    expect(result.diluc).toBeDefined();
    expect(result.diluc.flower).toBe("crimson_witch_of_flames");

    // xingqiu: 2+2pc
    expect(result.xingqiu).toBeDefined();
    expect(result.xingqiu.flower).toBe(expected5StarAtk);
    expect(result.xingqiu.goblet).toBe(expected5StarEm);

    // bennett and kazuha: skipped
    expect(result.bennett).toBeUndefined();
    expect(result.kaedehara_kazuha).toBeUndefined();
  });

  it("same half-set for both 2pc slots produces distinct concrete sets", () => {
    const configs = makeBaseConfigs([
      {
        artifactSet: {
          type: "2pc+2pc",
          halfSetIds: [HALF_SET_ATK, HALF_SET_ATK],
        },
      },
    ]);
    const tb = new TeamBuild(configs);
    const result = deriveSetKeysByChar(tb);

    expect(result.diluc).toBeDefined();
    // sk1 and sk2 must be different even though they come from the same half-set
    expect(result.diluc.flower).not.toBe(result.diluc.goblet);
  });
});
