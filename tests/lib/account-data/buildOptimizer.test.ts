import type { Slot } from "@/data/enums";
import type { GlobalStatWeights } from "@/data/types";
import { optimizeBuild } from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import type { CrBudgetResult } from "@/lib/account-data/crBudget";
import type { StatWeightMap } from "@/lib/artifact/scoring/artifactScore";
import { describe, expect, it } from "vitest";

const testWeights: StatWeightMap = {
  cr: 100,
  cd: 100,
  "atk%": 80,
  em: 60,
};

const testGlobalConfig: GlobalStatWeights = {
  flatAtk: 50,
  flatHp: 0,
  flatDef: 0,
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
      globalConfig: testGlobalConfig,
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
      globalConfig: testGlobalConfig,
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
      globalConfig: testGlobalConfig,
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
      globalConfig: testGlobalConfig,
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
