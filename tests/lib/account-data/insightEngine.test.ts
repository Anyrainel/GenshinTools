import type {
  AccountData,
  ArtifactData,
  ArtifactScoreConfig,
  CharacterData,
  Slot,
  StatWeightMap,
  TierAssignment,
} from "@/data/types";
import {
  generateAllInsights,
  generateCharacterInsights,
} from "@/lib/account-data/insightEngine";
import { describe, expect, it } from "vitest";

// ── Fixtures ────────────────────────────────────────────────────────────

const DEFAULT_GLOBAL = { flatAtk: 30, flatHp: 30, flatDef: 30 };

const CR_CD_WEIGHTS: StatWeightMap = {
  cr: 100,
  cd: 100,
  "atk%": 80,
  er: 60,
  em: 0,
  "hp%": 0,
  "def%": 0,
  atk: 0,
  hp: 0,
  def: 0,
};

function makeScoreConfig(
  charId: string,
  weights: StatWeightMap = CR_CD_WEIGHTS
): ArtifactScoreConfig {
  return {
    global: DEFAULT_GLOBAL,
    characters: { [charId]: weights },
  };
}

function makeArtifact(overrides: Partial<ArtifactData> = {}): ArtifactData {
  return {
    id: `art-${Math.random().toString(36).slice(2, 8)}`,
    setKey: "gladiators_finale",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: { cr: 10, cd: 20, "atk%": 10, er: 5 },
    ...overrides,
  };
}

function makeCharacter(
  overrides: Partial<CharacterData> & { key: string }
): CharacterData {
  return {
    constellation: 0,
    level: 90,
    talent: { auto: 10, skill: 10, burst: 10 },
    artifacts: {},
    ...overrides,
  };
}

const DEFAULT_TIERS: TierAssignment = {
  test_char: { tier: "S", position: 0 },
};

// ── Tests ───────────────────────────────────────────────────────────────

describe("generateCharacterInsights", () => {
  describe("empty / edge cases", () => {
    it("returns empty insights when character has no stat weights", () => {
      const char = makeCharacter({ key: "unknown_char" });
      const config = makeScoreConfig("other_char"); // no weights for unknown_char

      const result = generateCharacterInsights(char, [], config, DEFAULT_TIERS);

      expect(result.characterId).toBe("unknown_char");
      expect(result.insights).toHaveLength(0);
    });

    it("returns empty insights when character has no artifacts and no inventory", () => {
      const char = makeCharacter({ key: "test_char" });
      const config = makeScoreConfig("test_char");

      const result = generateCharacterInsights(char, [], config, DEFAULT_TIERS);

      // No artifacts equipped, no candidates → no insights
      expect(result.insights).toHaveLength(0);
    });

    it("iterates all 5 slots", () => {
      const slots: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];
      const char = makeCharacter({
        key: "test_char",
        artifacts: Object.fromEntries(
          slots.map((s) => [
            s,
            makeArtifact({
              slotKey: s,
              mainStatKey: s === "flower" ? "hp" : s === "plume" ? "atk" : "cr",
              substats: { hp: 1 }, // terrible substats
            }),
          ])
        ),
      });

      // Provide great alternatives for every slot
      const great = slots.map((s) =>
        makeArtifact({
          slotKey: s,
          mainStatKey: s === "flower" ? "hp" : s === "plume" ? "atk" : "cr",
          substats: { cr: 15, cd: 30, "atk%": 15, er: 10 },
          level: 20,
        })
      );

      const config = makeScoreConfig("test_char");
      const result = generateCharacterInsights(
        char,
        great,
        config,
        DEFAULT_TIERS
      );

      // Should have at least one insight (SWAP) for the slots
      expect(result.insights.length).toBeGreaterThan(0);
    });
  });

  describe("SWAP strategy", () => {
    it("suggests swapping when inventory has a strictly better artifact", () => {
      const equipped = makeArtifact({
        slotKey: "flower",
        substats: { cr: 3, cd: 5, "atk%": 3, hp: 500 },
        level: 20,
      });
      const better = makeArtifact({
        slotKey: "flower",
        substats: { cr: 14, cd: 28, "atk%": 14, er: 8 },
        level: 20,
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: equipped },
      });

      const result = generateCharacterInsights(
        char,
        [better],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      const swap = result.insights.find((i) => i.type === "SWAP");
      expect(swap).toBeDefined();
      expect(swap!.scoreDiff).toBeGreaterThan(0);
      expect(swap!.artifact?.id).toBe(better.id);
    });

    it("does not suggest swap when inventory artifact is worse", () => {
      const equipped = makeArtifact({
        slotKey: "flower",
        substats: { cr: 14, cd: 28, "atk%": 14, er: 8 },
        level: 20,
      });
      const worse = makeArtifact({
        slotKey: "flower",
        substats: { cr: 3, cd: 5, "atk%": 3, hp: 500 },
        level: 20,
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: equipped },
      });

      const result = generateCharacterInsights(
        char,
        [worse],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      const swap = result.insights.find((i) => i.type === "SWAP");
      expect(swap).toBeUndefined();
    });

    it("only steals from Pool-tier characters", () => {
      const equipped = makeArtifact({
        slotKey: "flower",
        substats: { cr: 3, cd: 5, "atk%": 3, hp: 500 },
        level: 20,
      });

      // Great artifact owned by an S-tier char → should NOT steal
      const sTierOwned = makeArtifact({
        slotKey: "flower",
        substats: { cr: 14, cd: 28, "atk%": 14, er: 8 },
        level: 20,
      });

      // Great artifact owned by a Pool-tier char → should steal
      const poolOwned = makeArtifact({
        slotKey: "flower",
        substats: { cr: 14, cd: 28, "atk%": 14, er: 8 },
        level: 20,
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: equipped },
      });

      const tiers: TierAssignment = {
        test_char: { tier: "S", position: 0 },
        s_tier_donor: { tier: "S", position: 1 },
        pool_donor: { tier: "Pool", position: 0 },
      };

      const sOwned = [{ ...sTierOwned, location: "s_tier_donor" }];
      const result1 = generateCharacterInsights(
        char,
        sOwned,
        makeScoreConfig("test_char"),
        tiers
      );
      const swap1 = result1.insights.find((i) => i.type === "SWAP");
      expect(swap1).toBeUndefined();

      const pOwned = [{ ...poolOwned, location: "pool_donor" }];
      const result2 = generateCharacterInsights(
        char,
        pOwned,
        makeScoreConfig("test_char"),
        tiers
      );
      const swap2 = result2.insights.find((i) => i.type === "SWAP");
      expect(swap2).toBeDefined();
      expect(swap2!.isSteal).toBe(true);
      expect(swap2!.donorCharacterId).toBe("pool_donor");
    });
  });

  describe("UPGRADE strategy", () => {
    it("suggests upgrading a low-level artifact with good substats", () => {
      // Equipped: bad max-level artifact
      const equipped = makeArtifact({
        slotKey: "flower",
        substats: { hp: 500, def: 20, "def%": 5, "hp%": 5 },
        level: 20,
      });

      // Inventory: great substats but only level 0
      const lowLevel = makeArtifact({
        slotKey: "flower",
        substats: { cr: 3.9, cd: 7.8, "atk%": 5.8, er: 6.5 },
        level: 0,
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: equipped },
      });

      const result = generateCharacterInsights(
        char,
        [lowLevel],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      const upgrade = result.insights.find((i) => i.type === "UPGRADE");
      expect(upgrade).toBeDefined();
      expect(upgrade!.scoreDiff).toBeGreaterThan(0);
    });

    it("suggests upgrading equipped artifact that is not max level", () => {
      const equipped = makeArtifact({
        slotKey: "flower",
        substats: { cr: 10, cd: 20, "atk%": 10, er: 5 },
        level: 0, // Not max level, great substats
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: equipped },
      });

      const result = generateCharacterInsights(
        char,
        [],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      const upgrade = result.insights.find(
        (i) => i.type === "UPGRADE" && i.isEquipped
      );
      expect(upgrade).toBeDefined();
    });
  });

  describe("FARM strategy", () => {
    it("suggests farming when current artifact score is much lower than expected", () => {
      // Equip a terrible max-level artifact
      const terrible = makeArtifact({
        slotKey: "flower",
        substats: { hp: 500, def: 20, "def%": 5, "hp%": 5 },
        level: 20,
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: terrible },
      });

      const result = generateCharacterInsights(
        char,
        [],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      const farm = result.insights.find((i) => i.type === "FARM");
      expect(farm).toBeDefined();
      expect(farm!.scoreDiff).toBeGreaterThan(0);
    });

    it("does not suggest farming when current artifact is already good", () => {
      const good = makeArtifact({
        slotKey: "flower",
        substats: { cr: 14, cd: 28, "atk%": 14, er: 8 },
        level: 20,
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: good },
      });

      const result = generateCharacterInsights(
        char,
        [],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      const farm = result.insights.find((i) => i.type === "FARM");
      expect(farm).toBeUndefined();
    });
  });

  describe("REROLL strategy", () => {
    it("suggests reroll for max-level 5★ artifact with a dead substat", () => {
      // Engineer extreme inputs: all rolls went into a 0-weight stat
      // to guarantee the reroll threshold (5.0) is exceeded.
      const artifact = makeArtifact({
        slotKey: "flower",
        rarity: 5,
        level: 20,
        substats: { cr: 3.9, cd: 7.8, "atk%": 5.8, def: 60 }, // massive def, weight 0
      });

      const weights: StatWeightMap = {
        cr: 100,
        cd: 100,
        "atk%": 80,
        er: 60,
        def: 0, // dead stat — reroll should redistribute these rolls
      };

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: artifact },
      });

      const result = generateCharacterInsights(
        char,
        [],
        makeScoreConfig("test_char", weights),
        DEFAULT_TIERS
      );

      const reroll = result.insights.find((i) => i.type === "REROLL");
      expect(reroll).toBeDefined();
      expect(reroll!.isEquipped).toBe(true);
      expect(reroll!.scoreDiff).toBeGreaterThan(0);
    });

    it("does not suggest reroll for non-5★ artifacts", () => {
      const artifact = makeArtifact({
        slotKey: "flower",
        rarity: 4,
        level: 16,
        substats: { cr: 5, cd: 10, "atk%": 5, def: 20 },
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: artifact },
      });

      const result = generateCharacterInsights(
        char,
        [],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      const reroll = result.insights.find((i) => i.type === "REROLL");
      expect(reroll).toBeUndefined();
    });
  });

  describe("priority ordering", () => {
    it("returns insights sorted by scoreDiff descending", () => {
      // Create a scenario where multiple insight types fire
      const terrible = makeArtifact({
        slotKey: "flower",
        substats: { hp: 500, def: 20, "def%": 3, "hp%": 3 },
        level: 20,
      });
      const great = makeArtifact({
        slotKey: "flower",
        substats: { cr: 14, cd: 28, "atk%": 14, er: 8 },
        level: 20,
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: terrible },
      });

      const result = generateCharacterInsights(
        char,
        [great],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      // Insights should be sorted by scoreDiff descending
      for (let i = 1; i < result.insights.length; i++) {
        expect(result.insights[i - 1].scoreDiff!).toBeGreaterThanOrEqual(
          result.insights[i].scoreDiff!
        );
      }
    });
  });

  describe("efficiencyDiff", () => {
    it("calculates efficiency as scoreDiff / maxPotentialScore", () => {
      const terrible = makeArtifact({
        slotKey: "flower",
        substats: { hp: 500, def: 20, "def%": 3, "hp%": 3 },
        level: 20,
      });
      const great = makeArtifact({
        slotKey: "flower",
        substats: { cr: 14, cd: 28, "atk%": 14, er: 8 },
        level: 20,
      });

      const char = makeCharacter({
        key: "test_char",
        artifacts: { flower: terrible },
      });

      const result = generateCharacterInsights(
        char,
        [great],
        makeScoreConfig("test_char"),
        DEFAULT_TIERS
      );

      // With terrible vs great artifacts, a SWAP insight is guaranteed
      expect(result.insights.length).toBeGreaterThan(0);
      const insight = result.insights[0];
      expect(insight.efficiencyDiff).toBeDefined();
      expect(insight.maxPotentialScore).toBeGreaterThan(0);
      expect(insight.efficiencyDiff).toBeCloseTo(
        insight.scoreDiff! / insight.maxPotentialScore!,
        4
      );
    });
  });
});

describe("generateAllInsights", () => {
  it("skips Pool-tier characters", () => {
    const accountData: AccountData = {
      characters: [
        makeCharacter({ key: "pool_char" }),
        makeCharacter({ key: "s_char" }),
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };

    const tiers: TierAssignment = {
      pool_char: { tier: "Pool", position: 0 },
      s_char: { tier: "S", position: 0 },
    };

    const config: ArtifactScoreConfig = {
      global: DEFAULT_GLOBAL,
      characters: {
        pool_char: CR_CD_WEIGHTS,
        s_char: CR_CD_WEIGHTS,
      },
    };

    const results = generateAllInsights(accountData, config, tiers);

    expect(results).toHaveLength(2);
    const poolResult = results.find((r) => r.characterId === "pool_char");
    expect(poolResult?.insights).toHaveLength(0);
  });

  it("defaults untiered characters to Pool (skipped)", () => {
    const accountData: AccountData = {
      characters: [makeCharacter({ key: "untiered_char" })],
      extraArtifacts: [],
      extraWeapons: [],
    };

    const results = generateAllInsights(
      accountData,
      makeScoreConfig("untiered_char"),
      {} // empty tier assignments
    );

    expect(results[0].insights).toHaveLength(0);
  });

  it("includes extraArtifacts as swap candidates", () => {
    const terrible = makeArtifact({
      slotKey: "flower",
      substats: { hp: 500, def: 20, "def%": 3, "hp%": 3 },
      level: 20,
    });
    const great = makeArtifact({
      slotKey: "flower",
      substats: { cr: 14, cd: 28, "atk%": 14, er: 8 },
      level: 20,
    });

    const accountData: AccountData = {
      characters: [
        makeCharacter({ key: "test_char", artifacts: { flower: terrible } }),
      ],
      extraArtifacts: [great], // In inventory
      extraWeapons: [],
    };

    const results = generateAllInsights(
      accountData,
      makeScoreConfig("test_char"),
      DEFAULT_TIERS
    );

    const swap = results[0].insights.find((i) => i.type === "SWAP");
    expect(swap).toBeDefined();
    expect(swap!.isSteal).toBe(false); // From inventory, not stolen
  });

  it("applies per-tier luck multiplier from tierCustomization", () => {
    const terrible = makeArtifact({
      slotKey: "flower",
      substats: { hp: 500, def: 20, "def%": 3, "hp%": 3 },
      level: 20,
    });

    const accountData: AccountData = {
      characters: [
        makeCharacter({ key: "test_char", artifacts: { flower: terrible } }),
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };

    const resultCautious = generateAllInsights(
      accountData,
      makeScoreConfig("test_char"),
      DEFAULT_TIERS,
      { S: { displayName: "S", hidden: false, luckExpectation: "cautious" } }
    );

    const resultHopeful = generateAllInsights(
      accountData,
      makeScoreConfig("test_char"),
      DEFAULT_TIERS,
      { S: { displayName: "S", hidden: false, luckExpectation: "hopeful" } }
    );

    // Both produce results for the single character
    expect(resultCautious).toHaveLength(1);
    expect(resultHopeful).toHaveLength(1);

    // Both should produce FARM insights (terrible artifact)
    const farmCautious = resultCautious[0].insights.find(
      (i) => i.type === "FARM"
    );
    const farmHopeful = resultHopeful[0].insights.find(
      (i) => i.type === "FARM"
    );
    expect(farmCautious).toBeDefined();
    expect(farmHopeful).toBeDefined();

    // Hopeful (0.9x) expects higher farm score → larger scoreDiff than cautious (0.8x)
    expect(farmHopeful!.scoreDiff!).toBeGreaterThan(farmCautious!.scoreDiff!);
  });
});
