import { beforeAll, describe, expect, it } from "vitest";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { Build, CharacterData } from "@/data/types";
import { getCrBudget } from "@/lib/account-data/maxCrBuff";

// Must preload game stats for resolveCharacterStats/resolveWeaponStats
beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

const testBuild: Build = {
  id: "test-build",
  characterId: "hu_tao",
  visible: true,
  composition: "4pc",
  artifactSet: "crimson_witch_of_flames",
  name: "Test",
  sandsWeights: [{ stat: "hp%", weight: 100 }],
  gobletWeights: [{ stat: "pyro%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 0,
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
    { stat: "hp%", weight: 80 },
    { stat: "em", weight: 60 },
  ],
};

function getBudgetFor(char: CharacterData, artifact?: Build) {
  return getCrBudget({
    characterId: char.key,
    characterLevel: char.level,
    constellation: char.constellation,
    weaponId: char.weapon?.key,
    weaponRefinement: char.weapon?.refinement,
    artifact,
  });
}

describe("getCrBudget", () => {
  it("includes base CR of 0.05", () => {
    const char: CharacterData = {
      key: "hu_tao",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };
    const result = getBudgetFor(char, testBuild);
    expect(result.baseCr).toBe(0.05);
    expect(result.totalNonArtifactCr).toBeGreaterThanOrEqual(0.05);
  });

  it("counts a CR ascension stat without subtracting base CR twice", () => {
    const char: CharacterData = {
      key: "yelan",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };

    const yelanBuild: Build = {
      ...testBuild,
      characterId: "yelan",
    };

    const result = getBudgetFor(char, yelanBuild);

    expect(result.ascensionCr).toBeCloseTo(0.192, 6);
    expect(result.totalNonArtifactCr).toBeCloseTo(0.05 + 0.192, 6);
  });

  it("detects weapon secondary CR", () => {
    const char: CharacterData = {
      key: "hu_tao",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      weapon: {
        id: "w1",
        key: "deathmatch",
        level: 90,
        refinement: 1,
        lock: false,
      },
      artifacts: {},
    };

    const result = getBudgetFor(char, testBuild);
    // Deathmatch has CR secondary stat
    expect(result.weaponSecondaryCr).toBeGreaterThan(0);
  });

  it.each([
    { weaponId: "clash_of_kings", expected: 0.276 },
    { weaponId: "exaiphanes_blade", expected: 0.331 },
    { weaponId: "forged_by_the_golden_melody", expected: 0.276 },
    { weaponId: "heretics_molten_blade", expected: 0.276 },
    { weaponId: "jade_vista", expected: 0.276 },
    { weaponId: "whitelake_frostfeather", expected: 0.221 },
  ])("includes the current CR secondary stat for $weaponId", ({
    weaponId,
    expected,
  }) => {
    const result = getCrBudget({
      characterId: "hu_tao",
      characterLevel: 90,
      constellation: 0,
      weaponId,
      weaponRefinement: 1,
    });

    expect(result.weaponSecondaryCr).toBeCloseTo(expected, 6);
  });

  it("handles missing weapon gracefully", () => {
    const char: CharacterData = {
      key: "hu_tao",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };

    const result = getBudgetFor(char, testBuild);
    expect(result.weaponSecondaryCr).toBe(0);
    expect(result.weaponPassiveCr).toBe(0);
  });

  it("sums all CR sources correctly", () => {
    const char: CharacterData = {
      key: "hu_tao",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };

    const result = getBudgetFor(char, testBuild);
    const expectedTotal =
      result.baseCr +
      result.ascensionCr +
      result.characterBuffCr +
      result.teamResonanceCr +
      result.weaponSecondaryCr +
      result.weaponPassiveCr +
      result.artifactSetCr;
    expect(result.totalNonArtifactCr).toBeCloseTo(expectedTotal, 6);
  });

  it("includes the expected double-Cryo resonance ceiling for Cryo characters", () => {
    const char: CharacterData = {
      key: "ganyu",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };

    const result = getBudgetFor(char, {
      ...testBuild,
      characterId: "ganyu",
    });

    expect(result.teamResonanceCr).toBe(0.15);
    expect(result.totalNonArtifactCr).toBeCloseTo(
      result.baseCr +
        result.ascensionCr +
        result.characterBuffCr +
        0.15 +
        result.weaponSecondaryCr +
        result.weaponPassiveCr +
        result.artifactSetCr,
      6
    );
  });

  it("does not add the Cryo resonance ceiling for non-Cryo characters", () => {
    const char: CharacterData = {
      key: "hu_tao",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };

    expect(getBudgetFor(char, testBuild).teamResonanceCr).toBe(0);
  });

  it.each([
    {
      label: "Mizuki C6",
      characterId: "yumemizuki_mizuki",
      constellation: 6,
      expected: 0.2,
    },
    {
      label: "Mona C4",
      characterId: "mona",
      constellation: 4,
      expected: 0.15,
    },
    {
      label: "Wanderer P1",
      characterId: "wanderer",
      constellation: 0,
      expected: 0.2,
    },
    {
      label: "Jahoda C6",
      characterId: "jahoda",
      constellation: 6,
      expected: 0.05,
    },
    {
      label: "Anemo Traveler's cross-resonance passive",
      characterId: "traveler_anemo",
      constellation: 0,
      expected: 0.1,
    },
    {
      label: "Cryo Traveler's cross-resonance passive",
      characterId: "traveler_cryo",
      constellation: 0,
      expected: 0.1,
    },
    {
      label: "Dendro Traveler's cross-resonance passive",
      characterId: "traveler_dendro",
      constellation: 0,
      expected: 0.1,
    },
    {
      label: "Electro Traveler's cross-resonance passive",
      characterId: "traveler_electro",
      constellation: 0,
      expected: 0.1,
    },
    {
      label: "Hydro Traveler's cross-resonance passive",
      characterId: "traveler_hydro",
      constellation: 0,
      expected: 0.1,
    },
    {
      label: "Pyro Traveler's cross-resonance passive",
      characterId: "traveler_pyro",
      constellation: 0,
      expected: 0.1,
    },
    {
      label: "Geo Traveler's cross-resonance passive and C1",
      characterId: "traveler_geo",
      constellation: 1,
      expected: 0.2,
    },
  ])("includes the current self-applicable CR ceiling for $label", ({
    characterId,
    constellation,
    expected,
  }) => {
    expect(
      getCrBudget({
        characterId,
        characterLevel: 90,
        constellation,
      }).characterBuffCr
    ).toBe(expected);
  });

  it("preserves Kokomi's negative CR adjustment in artifact headroom", () => {
    const result = getCrBudget({
      characterId: "sangonomiya_kokomi",
      characterLevel: 90,
      constellation: 0,
    });

    expect(result.characterBuffCr).toBe(-1);
    expect(result.totalNonArtifactCr).toBeCloseTo(-0.95, 6);
  });

  it("uses peak Ascendant Gleam CR for Night of the Sky's Unveiling", () => {
    const char: CharacterData = {
      key: "zibai",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };
    const nightBuild: Build = {
      ...testBuild,
      characterId: "zibai",
      artifactSet: "night_of_the_skys_unveiling",
    };

    const result = getBudgetFor(char, nightBuild);

    expect(result.artifactSetCr).toBeCloseTo(0.3, 6);
    expect(result.totalNonArtifactCr).toBeCloseTo(
      result.baseCr +
        result.ascensionCr +
        result.characterBuffCr +
        result.teamResonanceCr +
        result.weaponSecondaryCr +
        result.weaponPassiveCr +
        0.3,
      6
    );
  });

  it("applies wearer-faction gates for A Day Carved From Rising Winds", () => {
    const build: Build = {
      ...testBuild,
      artifactSet: "a_day_carved_from_rising_winds",
    };
    const hexerei: CharacterData = {
      key: "fischl",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };
    const nonHexerei: CharacterData = {
      key: "hu_tao",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };

    expect(getBudgetFor(hexerei, build).artifactSetCr).toBe(0.2);
    expect(getBudgetFor(nonHexerei, build).artifactSetCr).toBe(0);
  });

  it("counts artifact CR from both 2pc+2pc and 4pc set membership", () => {
    const char: CharacterData = {
      key: "hu_tao",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };
    const twoPlusTwoBuild: Build = {
      ...testBuild,
      composition: "2pc+2pc",
      artifactSet: undefined,
      halfSet1: "cr-12",
      halfSet2: "atk%-18",
    };
    const berserkerBuild: Build = {
      ...testBuild,
      artifactSet: "berserker",
    };

    expect(getBudgetFor(char, twoPlusTwoBuild).artifactSetCr).toBeCloseTo(
      0.12,
      6
    );
    expect(getBudgetFor(char, berserkerBuild).artifactSetCr).toBeCloseTo(
      0.36,
      6
    );
  });

  it("includes current CR artifact-set ceilings and wearer gates", () => {
    const wriothesley: CharacterData = {
      key: "wriothesley",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };
    const mizuki: CharacterData = {
      key: "yumemizuki_mizuki",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };
    const deepShadowBuild: Build = {
      ...testBuild,
      characterId: "wriothesley",
      artifactSet: "disenchantment_in_deep_shadow",
    };
    const scarletProofBuild: Build = {
      ...testBuild,
      characterId: "yumemizuki_mizuki",
      artifactSet: "scarlet_proof",
    };

    expect(getBudgetFor(wriothesley, deepShadowBuild).artifactSetCr).toBe(0.16);
    expect(getBudgetFor(mizuki, scarletProofBuild).artifactSetCr).toBe(0.16);
    expect(
      getBudgetFor({ ...wriothesley, key: "hu_tao" }, scarletProofBuild)
        .artifactSetCr
    ).toBe(0);
  });

  it("uses the reachable team ceiling for Lithic weapon CR", () => {
    const character = (key: string, weaponKey: string): CharacterData => ({
      key,
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      weapon: {
        id: "w1",
        key: weaponKey,
        level: 90,
        refinement: 5,
        lock: false,
      },
      artifacts: {},
    });

    expect(
      getBudgetFor(character("xiangling", "lithic_spear")).weaponPassiveCr
    ).toBeCloseTo(0.28, 6);
    expect(
      getBudgetFor(character("diluc", "lithic_blade")).weaponPassiveCr
    ).toBeCloseTo(0.21, 6);
  });

  it("includes character constellation and weapon passive CR ceilings", () => {
    const char: CharacterData = {
      key: "gaming",
      constellation: 6,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      weapon: {
        id: "w1",
        key: "fruitful_hook",
        level: 90,
        refinement: 5,
        lock: false,
      },
      artifacts: {},
    };

    const result = getBudgetFor(char, {
      ...testBuild,
      characterId: "gaming",
    });

    expect(result.characterBuffCr).toBe(0.2);
    expect(result.weaponPassiveCr).toBe(0.32);
    expect(result.totalNonArtifactCr).toBeCloseTo(
      result.baseCr +
        result.ascensionCr +
        result.characterBuffCr +
        result.teamResonanceCr +
        result.weaponSecondaryCr +
        result.weaponPassiveCr +
        result.artifactSetCr,
      6
    );
  });

  it("ignores Hu Tao C6 CR because it is an emergency trigger", () => {
    const char: CharacterData = {
      key: "hu_tao",
      constellation: 6,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    };

    const result = getBudgetFor(char, {
      ...testBuild,
      characterId: "hu_tao",
    });

    expect(result.characterBuffCr).toBe(0);
    expect(result.totalNonArtifactCr).toBeCloseTo(
      result.baseCr +
        result.ascensionCr +
        result.teamResonanceCr +
        result.weaponSecondaryCr +
        result.weaponPassiveCr +
        result.artifactSetCr,
      6
    );
  });
});
