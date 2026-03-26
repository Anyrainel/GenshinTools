import type {
  ArtifactData,
  CharacterData,
  GlobalStatWeights,
  InvestmentThresholds,
  Slot,
} from "@/data/types";
import type {
  BuildMatchResult,
  StatWeightMap,
} from "@/lib/account-data/artifactScore";
import type { BuildOptimizerResult } from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import { generateRecommendations } from "@/lib/account-data/recommendationEngine";
import { describe, expect, it } from "vitest";

// ─── Helpers ───

const testWeights: StatWeightMap = { cr: 100, cd: 100 };

const testGlobalConfig: GlobalStatWeights = {
  flatAtk: 0,
  flatHp: 0,
  flatDef: 0,
};

const defaultTargetMainStats: Record<Slot, Set<string>> = {
  flower: new Set(["hp"]),
  plume: new Set(["atk"]),
  sands: new Set(["atk%"]),
  goblet: new Set(["atk%"]),
  circlet: new Set(["cr"]),
};

/** Create a minimal artifact with zero substats so scoreSlotWithMainStat → 0. */
function emptyArtifact(slot: Slot, id: string): ArtifactData {
  const mainStats: Record<Slot, string> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "atk%",
    circlet: "cr",
  };
  return {
    id,
    setKey: "CrimsonWitchOfFlames",
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey: mainStats[slot] as ArtifactData["mainStatKey"],
    lock: false,
    substats: {},
  };
}

function makeCandidate(
  slot: Slot,
  source: CandidateArtifact["source"],
  overrides?: Partial<CandidateArtifact>
): CandidateArtifact {
  return {
    ...emptyArtifact(slot, `opt-${slot}-${source}`),
    source,
    sourceArtifactId: overrides?.sourceArtifactId,
    ...overrides,
  };
}

function makeChar(slots: Partial<Record<Slot, ArtifactData>>): CharacterData {
  return {
    key: "testChar",
    constellation: 0,
    level: 90,
    talent: { auto: 10, skill: 10, burst: 10 },
    artifacts: slots,
  };
}

function makeBuildMatch(): BuildMatchResult {
  return {
    build: {
      id: "b1",
      characterId: "testChar",
      visible: true,
      name: "Test",
      composition: "4pc" as const,
      artifactSet: "CrimsonWitchOfFlames",
      substats: [],
      sandsWeights: [],
      gobletWeights: [],
      circletWeights: [],
      normalizer: 1,
    },
    buildIndex: 0,
    statWeights: testWeights,
    setMatched: true,
    setDifferent: false,
    mainStatMatches: 3,
    mainStatMismatches: [],
  };
}

/**
 * Build an optimizer result where specific slots have non-current sources and
 * controlled slotScores (which determines the diff vs current score of 0).
 */
function makeOptimizerResult(
  slotEntries: {
    slot: Slot;
    source: CandidateArtifact["source"];
    slotScore: number;
    sourceArtifactId?: string;
    donorCharacterId?: string;
  }[]
): BuildOptimizerResult {
  const artifacts = {} as Record<Slot, CandidateArtifact>;
  const slotScores = {} as Record<Slot, number>;

  // Fill all slots with "current" source by default (no change)
  for (const slot of [
    "flower",
    "plume",
    "sands",
    "goblet",
    "circlet",
  ] as Slot[]) {
    artifacts[slot] = makeCandidate(slot, "current", {
      sourceArtifactId: `current-${slot}`,
    });
    slotScores[slot] = 0;
  }

  // Override specific slots
  for (const entry of slotEntries) {
    artifacts[entry.slot] = makeCandidate(entry.slot, entry.source, {
      sourceArtifactId: entry.sourceArtifactId ?? `opt-${entry.slot}`,
      donorCharacterId: entry.donorCharacterId,
    });
    slotScores[entry.slot] = entry.slotScore;
  }

  const totalScore = Object.values(slotScores).reduce((a, b) => a + b, 0);
  return {
    builds: [
      {
        artifacts,
        slotScores,
        rawScore: totalScore,
        crPenalty: 0,
        finalScore: totalScore,
        totalArtifactCr: 0,
      },
    ],
    currentScore: 0,
    combinationsEvaluated: 1,
  };
}

// ─── Tests ───

describe("generateRecommendations — threshold filtering", () => {
  const highThresholds: InvestmentThresholds = {
    swap: 10,
    upgrade: 30,
    reroll: 20,
    farm: 15,
  };

  describe("swap threshold", () => {
    it("includes swap recommendation when diff >= threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "swap", slotScore: 10 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const swapRecs = result.recommendations.filter(
        (r) => r.actionType === "swap"
      );
      expect(swapRecs).toHaveLength(1);
      expect(swapRecs[0].slot).toBe("flower");
    });

    it("excludes swap recommendation when diff < threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "swap", slotScore: 9.9 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const swapRecs = result.recommendations.filter(
        (r) => r.actionType === "swap"
      );
      expect(swapRecs).toHaveLength(0);
    });
  });

  describe("upgrade threshold (in-place)", () => {
    it("includes upgrade-in-place when diff >= threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      // source = "current" with same sourceArtifactId triggers upgrade-in-place path
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          {
            slot: "flower",
            source: "current",
            slotScore: 30,
            sourceArtifactId: "current-flower",
          },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const upgradeRecs = result.recommendations.filter(
        (r) => r.actionType === "upgrade"
      );
      expect(upgradeRecs).toHaveLength(1);
    });

    it("excludes upgrade-in-place when diff < threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          {
            slot: "flower",
            source: "current",
            slotScore: 29,
            sourceArtifactId: "current-flower",
          },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const upgradeRecs = result.recommendations.filter(
        (r) => r.actionType === "upgrade"
      );
      expect(upgradeRecs).toHaveLength(0);
    });
  });

  describe("upgrade threshold (from another artifact)", () => {
    it("includes upgrade recommendation when diff >= threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "upgrade", slotScore: 30 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const upgradeRecs = result.recommendations.filter(
        (r) => r.actionType === "upgrade"
      );
      expect(upgradeRecs).toHaveLength(1);
    });

    it("excludes upgrade recommendation when diff < threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "upgrade", slotScore: 29 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const upgradeRecs = result.recommendations.filter(
        (r) => r.actionType === "upgrade"
      );
      expect(upgradeRecs).toHaveLength(0);
    });
  });

  describe("reroll threshold", () => {
    it("includes reroll recommendation when diff >= threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "reroll", slotScore: 20 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const rerollRecs = result.recommendations.filter(
        (r) => r.actionType === "reroll"
      );
      expect(rerollRecs).toHaveLength(1);
    });

    it("excludes reroll recommendation when diff < threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "reroll", slotScore: 19.9 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const rerollRecs = result.recommendations.filter(
        (r) => r.actionType === "reroll"
      );
      expect(rerollRecs).toHaveLength(0);
    });
  });

  describe("farm threshold", () => {
    it("includes farm recommendation when diff >= threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "farm", slotScore: 15 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const farmRecs = result.recommendations.filter(
        (r) => r.actionType === "farm"
      );
      expect(farmRecs).toHaveLength(1);
    });

    it("excludes farm recommendation when diff < threshold", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "farm", slotScore: 14.9 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const farmRecs = result.recommendations.filter(
        (r) => r.actionType === "farm"
      );
      expect(farmRecs).toHaveLength(0);
    });
  });

  describe("equip (no current artifact) always uses 0.5 threshold", () => {
    it("includes equip recommendation for small diff when no current artifact", () => {
      // No current artifact in flower slot → action is "equip", not "swap"
      const char = makeChar({});
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([{ slot: "flower", source: "swap", slotScore: 1 }]),
        testGlobalConfig,
        defaultTargetMainStats,
        highThresholds
      );
      const equipRecs = result.recommendations.filter(
        (r) => r.actionType === "equip"
      );
      expect(equipRecs).toHaveLength(1);
    });
  });

  describe("without thresholds, uses default 0.5 minimum", () => {
    it("includes recommendation when diff >= 0.5", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "swap", slotScore: 0.5 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats
        // no thresholds
      );
      expect(result.recommendations).toHaveLength(1);
    });

    it("excludes recommendation when diff < 0.5", () => {
      const char = makeChar({
        flower: emptyArtifact("flower", "current-flower"),
      });
      const result = generateRecommendations(
        char,
        makeBuildMatch(),
        makeOptimizerResult([
          { slot: "flower", source: "swap", slotScore: 0.4 },
        ]),
        testGlobalConfig,
        defaultTargetMainStats
      );
      expect(result.recommendations).toHaveLength(0);
    });
  });
});
