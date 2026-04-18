/**
 * Behavioral lock for buildSetKeysByChar — set key derivation from WeaponChoiceCharConfig[].
 */
import { artifactHalfSetsById, artifactsById } from "@/data/constants";
import { buildSetKeysByChar } from "@/lib/team-comp/analyzer/weaponChoice";
import type { WeaponChoiceCharConfig } from "@/stores/useTeamStore";
import { describe, expect, it } from "vitest";

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

function makeCharConfig(
  overrides: Partial<WeaponChoiceCharConfig> & { charId: string }
): WeaponChoiceCharConfig {
  return {
    level: 90,
    constellation: 0,
    talentLevels: [10, 10, 10],
    artifactConfig: null,
    minEr: 1.0,
    minCr: 0.05,
    ...overrides,
  };
}

describe("buildSetKeysByChar", () => {
  it("4pc config: all 5 slots get the same setKey", () => {
    const configs: WeaponChoiceCharConfig[] = [
      makeCharConfig({
        charId: "diluc",
        artifactConfig: { type: "4pc", setId: "crimson_witch_of_flames" },
      }),
    ];
    const result = buildSetKeysByChar(configs);

    expect(result.diluc).toBeDefined();
    expect(result.diluc.flower).toBe("crimson_witch_of_flames");
    expect(result.diluc.plume).toBe("crimson_witch_of_flames");
    expect(result.diluc.sands).toBe("crimson_witch_of_flames");
    expect(result.diluc.goblet).toBe("crimson_witch_of_flames");
    expect(result.diluc.circlet).toBe("crimson_witch_of_flames");
  });

  it("2+2pc config: flower/plume/sands get sk1, goblet/circlet get sk2", () => {
    const configs: WeaponChoiceCharConfig[] = [
      makeCharConfig({
        charId: "diluc",
        artifactConfig: {
          type: "2pc+2pc",
          id1: HALF_SET_ATK,
          id2: HALF_SET_EM,
        },
      }),
    ];
    const result = buildSetKeysByChar(configs);

    expect(result.diluc).toBeDefined();
    expect(result.diluc.flower).toBe(expected5StarAtk);
    expect(result.diluc.plume).toBe(expected5StarAtk);
    expect(result.diluc.sands).toBe(expected5StarAtk);
    expect(result.diluc.goblet).toBe(expected5StarEm);
    expect(result.diluc.circlet).toBe(expected5StarEm);
    expect(expected5StarAtk).not.toBe(expected5StarEm);
  });

  it("null artifactConfig: character is skipped", () => {
    const configs: WeaponChoiceCharConfig[] = [
      makeCharConfig({ charId: "diluc", artifactConfig: null }),
    ];
    const result = buildSetKeysByChar(configs);

    expect(result.diluc).toBeUndefined();
  });

  it("multiple characters with different configs", () => {
    const configs: WeaponChoiceCharConfig[] = [
      makeCharConfig({
        charId: "diluc",
        artifactConfig: { type: "4pc", setId: "crimson_witch_of_flames" },
      }),
      makeCharConfig({
        charId: "xingqiu",
        artifactConfig: {
          type: "2pc+2pc",
          id1: HALF_SET_ATK,
          id2: HALF_SET_EM,
        },
      }),
      makeCharConfig({
        charId: "bennett",
        artifactConfig: null,
      }),
    ];
    const result = buildSetKeysByChar(configs);

    // diluc: 4pc
    expect(result.diluc.flower).toBe("crimson_witch_of_flames");

    // xingqiu: 2+2pc
    expect(result.xingqiu.flower).toBe(expected5StarAtk);
    expect(result.xingqiu.goblet).toBe(expected5StarEm);

    // bennett: skipped
    expect(result.bennett).toBeUndefined();
  });

  it("same half-set for both 2pc slots produces distinct concrete sets", () => {
    const configs: WeaponChoiceCharConfig[] = [
      makeCharConfig({
        charId: "diluc",
        artifactConfig: {
          type: "2pc+2pc",
          id1: HALF_SET_ATK,
          id2: HALF_SET_ATK,
        },
      }),
    ];
    const result = buildSetKeysByChar(configs);

    expect(result.diluc).toBeDefined();
    expect(result.diluc.flower).not.toBe(result.diluc.goblet);
  });
});
