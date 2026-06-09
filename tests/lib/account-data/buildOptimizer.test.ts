import { describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import {
  optimizeBuild,
  scoreFullBuild,
} from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import type { CrBudgetResult } from "@/lib/account-data/maxCrBuff";
import type { StatWeightMap } from "@/lib/artifact/scoring/artifactScore";

const testWeights: StatWeightMap = {
  cr: 100,
  cd: 100,
  "atk%": 80,
  em: 60,
};

function makeCandidate(
  overrides: Partial<CandidateArtifact> & {
    slotKey: Slot;
    source: CandidateArtifact["source"];
  }
): CandidateArtifact {
  return {
    id: `test-${overrides.slotKey}-${overrides.source}`,
    setKey: "CrimsonWitchOfFlames",
    level: 20,
    rarity: 5,
    mainStatKey:
      overrides.slotKey === "flower"
        ? "hp"
        : overrides.slotKey === "plume"
          ? "atk"
          : "atk%",
    lock: false,
    substats: { cr: 3.9, cd: 7.8 },
    ...overrides,
  };
}

const baseCrBudget: CrBudgetResult = {
  baseCr: 0.05,
  ascensionCr: 0,
  characterBuffCr: 0,
  weaponSecondaryCr: 0,
  weaponPassiveCr: 0,
  artifactSetCr: 0,
  totalNonArtifactCr: 0.05,
};

const defaultTargetMainStats: Record<Slot, Set<string>> = {
  flower: new Set(["hp"]),
  plume: new Set(["atk"]),
  sands: new Set(["atk%"]),
  goblet: new Set(["atk%"]),
  circlet: new Set(["cr"]),
};

describe("buildOptimizer", () => {
  it("returns top builds sorted by finalScore desc", () => {
    const candidates: Record<Slot, CandidateArtifact[]> = {
      flower: [
        makeCandidate({
          slotKey: "flower",
          source: "current",
          substats: { cr: 3.9, cd: 15.6 },
        }),
        makeCandidate({
          slotKey: "flower",
          source: "swap",
          id: "swap-flower",
          substats: { cr: 7.8, cd: 23.3 },
        }),
      ],
      plume: [
        makeCandidate({
          slotKey: "plume",
          source: "current",
          substats: { cr: 3.9, cd: 7.8 },
        }),
      ],
      sands: [
        makeCandidate({
          slotKey: "sands",
          source: "current",
          substats: { cr: 3.9, cd: 7.8 },
        }),
      ],
      goblet: [
        makeCandidate({
          slotKey: "goblet",
          source: "current",
          substats: { cr: 3.9, cd: 7.8 },
        }),
      ],
      circlet: [
        makeCandidate({
          slotKey: "circlet",
          source: "current",
          mainStatKey: "cr",
          substats: { cd: 15.6 },
        }),
      ],
    };

    const result = optimizeBuild({
      weights: testWeights,
      candidates,
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: {
        composition: "4pc",
        artifactSet: "CrimsonWitchOfFlames",
      },
      topN: 3,
    });

    expect(result.builds.length).toBeGreaterThan(0);
    // Verify descending order
    for (let i = 1; i < result.builds.length; i++) {
      expect(result.builds[i - 1].finalScore).toBeGreaterThanOrEqual(
        result.builds[i].finalScore
      );
    }
  });

  it("applies CR penalty for over-cap builds", () => {
    // All artifacts have high CR substats
    const highCrCandidate = (slot: Slot) =>
      makeCandidate({
        slotKey: slot,
        source: "current",
        substats: { cr: 15.0, cd: 7.8 }, // 15% CR per piece
      });

    const candidates: Record<Slot, CandidateArtifact[]> = {
      flower: [highCrCandidate("flower")],
      plume: [highCrCandidate("plume")],
      sands: [highCrCandidate("sands")],
      goblet: [highCrCandidate("goblet")],
      circlet: [
        makeCandidate({
          slotKey: "circlet",
          source: "current",
          mainStatKey: "cr", // 31.1% CR main stat
          substats: { cr: 15.0, cd: 7.8 },
        }),
      ],
    };

    // High non-artifact CR budget
    const highCrBudget: CrBudgetResult = {
      ...baseCrBudget,
      ascensionCr: 0.192,
      weaponSecondaryCr: 0.441,
      totalNonArtifactCr: 0.05 + 0.192 + 0.441,
    };

    const result = optimizeBuild({
      weights: testWeights,
      candidates,
      crBudget: highCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: {
        composition: "4pc",
        artifactSet: "CrimsonWitchOfFlames",
      },
    });

    expect(result.builds.length).toBeGreaterThan(0);
    const topBuild = result.builds[0];
    // With so much CR, penalty should be > 0
    expect(topBuild.crPenalty).toBeGreaterThan(0);
    expect(topBuild.finalScore).toBeLessThan(topBuild.rawScore);
  });

  it("does not let over-cap CR outrank useful non-CR stats", () => {
    const highCrFlower = makeCandidate({
      slotKey: "flower",
      source: "swap",
      id: "high-cr-flower",
      substats: { cr: 20 },
    });
    const balancedFlower = makeCandidate({
      slotKey: "flower",
      source: "swap",
      id: "balanced-flower",
      substats: { cr: 5, "atk%": 20 },
    });
    const candidates: Record<Slot, CandidateArtifact[]> = {
      flower: [highCrFlower, balancedFlower],
      plume: [
        makeCandidate({
          slotKey: "plume",
          source: "current",
          substats: {},
        }),
      ],
      sands: [
        makeCandidate({
          slotKey: "sands",
          source: "current",
          substats: {},
        }),
      ],
      goblet: [
        makeCandidate({
          slotKey: "goblet",
          source: "current",
          substats: {},
        }),
      ],
      circlet: [
        makeCandidate({
          slotKey: "circlet",
          source: "current",
          mainStatKey: "cd",
          substats: {},
        }),
      ],
    };

    const result = optimizeBuild({
      weights: testWeights,
      candidates,
      crBudget: { ...baseCrBudget, totalNonArtifactCr: 0.95 },
      targetMainStats: { ...defaultTargetMainStats, circlet: new Set(["cd"]) },
      setConstraint: {
        composition: "4pc",
        artifactSet: "CrimsonWitchOfFlames",
      },
      topN: 2,
    });

    expect(result.builds[0].artifacts.flower.id).toBe("balanced-flower");

    const highCrBuild = {
      ...result.builds[0].artifacts,
      flower: highCrFlower,
    };
    const balancedBuild = {
      ...result.builds[0].artifacts,
      flower: balancedFlower,
    };
    const scoreConfig = {
      weights: testWeights,
      targetMainStats: { ...defaultTargetMainStats, circlet: new Set(["cd"]) },
      crBudget: { ...baseCrBudget, totalNonArtifactCr: 0.95 },
    };
    expect(
      scoreFullBuild(
        balancedBuild,
        scoreConfig.weights,
        scoreConfig.targetMainStats,
        scoreConfig.crBudget
      ).finalScore
    ).toBeGreaterThan(
      scoreFullBuild(
        highCrBuild,
        scoreConfig.weights,
        scoreConfig.targetMainStats,
        scoreConfig.crBudget
      ).finalScore
    );
  });

  it("filters candidates by set constraint for 4pc", () => {
    const candidates: Record<Slot, CandidateArtifact[]> = {
      flower: [
        makeCandidate({
          slotKey: "flower",
          source: "current",
          setKey: "WrongSet",
        }),
      ],
      plume: [makeCandidate({ slotKey: "plume", source: "current" })],
      sands: [makeCandidate({ slotKey: "sands", source: "current" })],
      goblet: [makeCandidate({ slotKey: "goblet", source: "current" })],
      circlet: [makeCandidate({ slotKey: "circlet", source: "current" })],
    };

    const result = optimizeBuild({
      weights: testWeights,
      candidates,
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: {
        composition: "4pc",
        artifactSet: "CrimsonWitchOfFlames",
      },
    });

    // Should find builds where flower is flex slot (pattern with flower as flex)
    expect(result.builds.length).toBeGreaterThan(0);
    // The flower must use WrongSet since it's the only candidate
    expect(result.builds[0].artifacts.flower.setKey).toBe("WrongSet");
  });

  it("requires 2pc+2pc half-set picks to use concrete in-game 2pc sets", () => {
    const candidates: Record<Slot, CandidateArtifact[]> = {
      flower: [
        makeCandidate({
          slotKey: "flower",
          source: "current",
          id: "atk-flower",
          setKey: "gladiators_finale",
          substats: { cd: 10 },
        }),
      ],
      plume: [
        makeCandidate({
          slotKey: "plume",
          source: "current",
          id: "atk-plume",
          setKey: "gladiators_finale",
          substats: { cd: 10 },
        }),
      ],
      sands: [
        makeCandidate({
          slotKey: "sands",
          source: "current",
          id: "hp-sands",
          setKey: "tenacity_of_the_millelith",
          substats: { cd: 10 },
        }),
      ],
      goblet: [
        makeCandidate({
          slotKey: "goblet",
          source: "swap",
          id: "invalid-mixed-hp-goblet",
          setKey: "vourukashas_glow",
          substats: { cd: 100 },
        }),
        makeCandidate({
          slotKey: "goblet",
          source: "current",
          id: "valid-hp-goblet",
          setKey: "tenacity_of_the_millelith",
          substats: {},
        }),
      ],
      circlet: [
        makeCandidate({
          slotKey: "circlet",
          source: "current",
          id: "atk-circlet",
          setKey: "gladiators_finale",
          mainStatKey: "cr",
          substats: { cd: 10 },
        }),
      ],
    };

    const result = optimizeBuild({
      weights: testWeights,
      candidates,
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: {
        composition: "2pc+2pc",
        halfSet1: "atk%-18",
        halfSet2: "hp%-20",
      },
    });

    expect(result.builds.length).toBeGreaterThan(0);
    expect(result.builds[0].artifacts.goblet.id).toBe("valid-hp-goblet");
    expect(
      Object.values(result.builds[0].artifacts).filter(
        (artifact) => artifact.setKey === "gladiators_finale"
      )
    ).toHaveLength(3);
    expect(
      Object.values(result.builds[0].artifacts).filter(
        (artifact) => artifact.setKey === "tenacity_of_the_millelith"
      )
    ).toHaveLength(2);
  });

  it("does not count one concrete 4pc set as two same-half 2pc bonuses", () => {
    const candidates: Record<Slot, CandidateArtifact[]> = {
      flower: [
        makeCandidate({
          slotKey: "flower",
          source: "current",
          setKey: "gladiators_finale",
        }),
      ],
      plume: [
        makeCandidate({
          slotKey: "plume",
          source: "current",
          setKey: "gladiators_finale",
        }),
      ],
      sands: [
        makeCandidate({
          slotKey: "sands",
          source: "current",
          setKey: "gladiators_finale",
        }),
      ],
      goblet: [
        makeCandidate({
          slotKey: "goblet",
          source: "current",
          setKey: "gladiators_finale",
        }),
      ],
      circlet: [
        makeCandidate({
          slotKey: "circlet",
          source: "current",
          setKey: "shimenawas_reminiscence",
          mainStatKey: "cr",
        }),
      ],
    };

    const result = optimizeBuild({
      weights: testWeights,
      candidates,
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: {
        composition: "2pc+2pc",
        halfSet1: "atk%-18",
        halfSet2: "atk%-18",
      },
    });

    expect(result.builds).toEqual([]);
  });

  it("skips patterns where any slot has 0 candidates", () => {
    // Only one candidate for each slot, all same set
    const candidates: Record<Slot, CandidateArtifact[]> = {
      flower: [makeCandidate({ slotKey: "flower", source: "current" })],
      plume: [makeCandidate({ slotKey: "plume", source: "current" })],
      sands: [makeCandidate({ slotKey: "sands", source: "current" })],
      goblet: [makeCandidate({ slotKey: "goblet", source: "current" })],
      circlet: [], // No candidates!
    };

    const result = optimizeBuild({
      weights: testWeights,
      candidates,
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: {
        composition: "4pc",
        artifactSet: "CrimsonWitchOfFlames",
      },
    });

    // No builds possible since circlet is empty
    expect(result.builds.length).toBe(0);
  });
});
