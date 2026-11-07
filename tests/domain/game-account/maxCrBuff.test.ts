import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CALC_CONTEXT } from "@/domain/combat/damage/constants";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type {
  DamageTag,
  OptionMap,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import { getCrBudget } from "@/domain/game-account/maxCrBuff";
import type { Build, CharacterData } from "@/domain/models";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";

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

function starsparkTeam(
  members: Array<[string, string]>,
  combatOpts: OptionMap = {}
) {
  const wearer = members[0][0];
  const configs: TeamSlotConfig[] = members.map(([charId, weaponId]) => ({
    charId,
    weaponId,
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    artifactSet: null,
  }));
  const withSet = new TeamBuild(
    configs.map((config) =>
      config.charId === wearer
        ? {
            ...config,
            artifactSet: { type: "4pc", setId: "artifact_15049" },
          }
        : config
    ),
    combatOpts
  );
  const withoutSet = new TeamBuild(configs, combatOpts);
  const sheets = Object.fromEntries(
    members.map(([charId]) => [charId, new StatSheet([])])
  );
  const stats = withSet.getTeamStats(sheets, wearer, DEFAULT_CALC_CONTEXT);
  const baseline = withoutSet.getTeamStats(
    sheets,
    wearer,
    DEFAULT_CALC_CONTEXT
  );
  const crDelta = (charId: string, tag: DamageTag) =>
    stats[charId].get("cr", tag) +
    stats[charId].get("reactionCr", tag) -
    baseline[charId].get("cr", tag) -
    baseline[charId].get("reactionCr", tag);
  const budget = getCrBudget({
    characterId: wearer,
    characterLevel: 90,
    constellation: 0,
    artifact: { composition: "4pc", artifactSet: "artifact_15049" },
  }).artifactSetCr;
  return { withSet, stats, crDelta, budget };
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
  ])(
    "includes the current CR secondary stat for $weaponId",
    ({ weaponId, expected }) => {
      const result = getCrBudget({
        characterId: "hu_tao",
        characterLevel: 90,
        constellation: 0,
        weaponId,
        weaponRefinement: 1,
      });

      expect(result.weaponSecondaryCr).toBeCloseTo(expected, 6);
    }
  );

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
  ])(
    "includes the current self-applicable CR ceiling for $label",
    ({ characterId, constellation, expected }) => {
      expect(
        getCrBudget({
          characterId,
          characterLevel: 90,
          constellation,
        }).characterBuffCr
      ).toBe(expected);
    }
  );

  it.each([
    [5, 0],
    [6, 0.1],
  ])(
    "includes Danica's C%i battle-mode CR ceiling",
    (constellation, expected) => {
      expect(
        getCrBudget({
          characterId: "danica",
          characterLevel: 90,
          constellation,
        }).characterBuffCr
      ).toBe(expected);
    }
  );

  it.each([
    ["kaeya", "4pc", 0.4],
    ["sucrose", "4pc", 0.4],
    ["razor", "4pc", 0.2],
    ["fischl", "4pc", 0],
    ["kaeya", "2pc+2pc", 0],
  ] as const)(
    "budgets reachable Cryo damage for Starspark four-piece builds: %s %s",
    (characterId, composition, expected) => {
      expect(
        getCrBudget({
          characterId,
          characterLevel: 90,
          constellation: 0,
          artifact: { composition, artifactSet: "artifact_15049" },
        }).artifactSetCr
      ).toBe(expected);
    }
  );

  it.each(["sucrose", "kaeya"])(
    "matches %s's own Cryo Stellar Swirl Vortex CR to its account ceiling",
    (wearer) => {
      const team = starsparkTeam([
        [wearer, wearer === "kaeya" ? "favonius_sword" : "favonius_codex"],
        ["odette", "favonius_sword"],
        ...(wearer === "kaeya"
          ? ([["sucrose", "favonius_codex"]] as Array<[string, string]>)
          : []),
      ]);
      const reaction = team.withSet.catalog.formulaIndex.get(
        "rx-stellarSwirl-sucrose"
      )!;
      const ownVortex = reaction.parts.find(
        ({ statsCharId, formula }) =>
          statsCharId === wearer && formula.tag.element === "Cryo"
      )!;
      expect(ownVortex).toBeDefined();
      expect(
        ownVortex.formula.calc(team.stats[wearer], 90, DEFAULT_CALC_CONTEXT)
      ).toBeGreaterThan(0);
      expect(team.crDelta(wearer, ownVortex.formula.tag)).toBeCloseTo(0.4);
      expect(team.budget).toBeCloseTo(
        team.crDelta(wearer, ownVortex.formula.tag)
      );
      // The extra 20% never extends to ordinary Cryo or non-Cryo Stellar hits.
      expect(
        team.crDelta(wearer, { ...ownVortex.formula.tag, reaction: "none" })
      ).toBeCloseTo(0.2);
      expect(
        team.crDelta(wearer, { ...ownVortex.formula.tag, element: "Anemo" })
      ).toBe(0);
      const teammateVortex = reaction.parts.find(
        ({ statsCharId, formula }) =>
          statsCharId === "odette" && formula.tag.element === "Cryo"
      )!;
      expect(team.crDelta("odette", teammateVortex.formula.tag)).toBe(0);
    }
  );

  it.each([
    ["razor", "favonius_greatsword", 0.2],
    ["fischl", "favonius_warbow", 0],
  ] as const)(
    "bounds %s's Cryo ceiling using actual infusion and Stellar damage paths",
    (wearer, weapon, expected) => {
      const team = starsparkTeam(
        [
          [wearer, weapon],
          ["chongyun", "favonius_greatsword"],
          ["odette", "favonius_sword"],
          ["sucrose", "favonius_codex"],
        ],
        { [`infusion:${wearer}`]: "chongyun" }
      );
      const ownParts = Array.from(
        team.withSet.catalog.formulaIndex.values()
      ).flatMap((entry) =>
        entry.parts.filter(
          (part) => (part.statsCharId ?? entry.owner) === wearer
        )
      );
      const ownCryoDamage = ownParts.filter(
        ({ formula }) =>
          formula.tag.element === "Cryo" &&
          formula.calc(team.stats[wearer], 90, DEFAULT_CALC_CONTEXT) > 0
      );
      if (wearer === "razor") {
        expect(ownCryoDamage.length).toBeGreaterThan(0);
        expect(
          ownCryoDamage.some(
            ({ formula }) =>
              formula.tag.ability === "normal" &&
              formula.tag.reaction === "none"
          )
        ).toBe(true);
      } else {
        // Bow attacks cannot receive Chongyun's melee infusion, and the
        // teammate's Cryo Vortex contributions are not Fischl's own damage.
        expect(ownCryoDamage).toHaveLength(0);
      }
      expect(
        Math.max(
          0,
          ...ownCryoDamage.map(({ formula }) =>
            team.crDelta(wearer, formula.tag)
          )
        )
      ).toBeCloseTo(expected);
      expect(team.budget).toBeCloseTo(expected);
      const conduct = team.withSet.catalog.formulaIndex.get(
        `rx-stellarConduct-${wearer}`
      )!;
      expect(conduct).toBeDefined();
      // Merely creating the Polestar Field cannot establish a 40% CR hit.
      expect(
        conduct.parts[0].formula.calc(
          team.stats[wearer],
          90,
          DEFAULT_CALC_CONTEXT
        )
      ).toBe(0);
    }
  );

  it("preserves Kokomi's negative CR adjustment in artifact headroom", () => {
    const result = getCrBudget({
      characterId: "sangonomiya_kokomi",
      characterLevel: 90,
      constellation: 0,
    });

    expect(result.characterBuffCr).toBe(-1);
    expect(result.totalNonArtifactCr).toBeCloseTo(-0.95, 6);
  });

  it("uses the team-independent Ascendant Gleam and Lunar reaction ceiling for Night of the Sky's Unveiling", () => {
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
