import { describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import {
  type BuildOptimizerConfig,
  enumerateBuilds,
  scoreFullBuild,
} from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import type { CrBudgetResult } from "@/lib/account-data/crBudget";
import { scoreSlotWithMainStat } from "@/lib/artifact/scoring/artifactScore";

const weights = { cr: 100, cd: 100, "atk%": 80 } as const;

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

function art(
  slot: Slot,
  id: string,
  setKey: string,
  substats: Partial<Record<string, number>> = {}
): CandidateArtifact {
  const mainStat: Record<Slot, string> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "atk%",
    circlet: "cr",
  };
  return {
    id,
    setKey,
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey: mainStat[slot] as CandidateArtifact["mainStatKey"],
    lock: false,
    substats: { cd: 5, cr: 3, ...substats },
    source: "swap",
    sourceArtifactId: id,
  };
}

/** Brute-force exhaustive enumeration of all valid 4pc + 1 flex builds. */
function bruteForceTopK(
  config: BuildOptimizerConfig,
  k: number
): { ids: string[]; score: number }[] {
  const builds: {
    artifacts: Record<Slot, CandidateArtifact>;
    score: number;
  }[] = [];
  const slots = allSlots;

  function recurse(d: number, current: Record<Slot, CandidateArtifact>) {
    if (d === slots.length) {
      // Check 4pc set constraint
      const setCount: Record<string, number> = {};
      for (const s of slots) {
        const a = current[s];
        setCount[a.setKey] = (setCount[a.setKey] ?? 0) + 1;
      }
      const mainSet = config.setConstraint.artifactSet;
      if (mainSet && (setCount[mainSet] ?? 0) < 4) return;
      const { finalScore } = scoreFullBuild(
        current,
        config.weights,
        config.targetMainStats,
        config.crBudget
      );
      builds.push({ artifacts: { ...current }, score: finalScore });
      return;
    }
    const slot = slots[d];
    for (const cand of config.candidates[slot]) {
      current[slot] = cand;
      recurse(d + 1, current);
    }
  }

  recurse(0, {} as Record<Slot, CandidateArtifact>);

  // Dedup by sorted artifact-ID signature
  const seen = new Set<string>();
  const unique: { ids: string[]; score: number }[] = [];
  builds.sort((a, b) => b.score - a.score);
  for (const b of builds) {
    const ids = slots.map((s) => b.artifacts[s].id).sort();
    const key = ids.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ids: slots.map((s) => b.artifacts[s].id), score: b.score });
    if (unique.length >= k) break;
  }
  return unique;
}

describe("enumerateBuilds", () => {
  it("top-1 score matches brute-force optimum (4pc, single artifact per slot)", () => {
    const config: BuildOptimizerConfig = {
      weights,
      candidates: {
        flower: [art("flower", "f1", "CW", { cd: 30, cr: 10 })],
        plume: [art("plume", "p1", "CW", { cd: 25, cr: 8 })],
        sands: [art("sands", "s1", "CW", { cd: 20, cr: 7 })],
        goblet: [art("goblet", "g1", "CW", { cd: 15, cr: 6 })],
        circlet: [art("circlet", "c1", "CW", { cd: 22, cr: 5 })],
      },
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: { composition: "4pc", artifactSet: "CW" },
    };
    const result = enumerateBuilds(config, 1);
    const bf = bruteForceTopK(config, 1);
    expect(result.builds[0].finalScore).toBeCloseTo(bf[0].score, 4);
  });

  it("top-1 score matches brute-force on a multi-candidate 4pc problem", () => {
    const config: BuildOptimizerConfig = {
      weights,
      candidates: {
        flower: [
          art("flower", "f1", "CW", { cd: 20, cr: 5 }),
          art("flower", "f2", "CW", { cd: 30, cr: 8 }),
          art("flower", "f3", "Other", { cd: 35, cr: 10 }),
        ],
        plume: [
          art("plume", "p1", "CW", { cd: 25, cr: 6 }),
          art("plume", "p2", "Other", { cd: 28, cr: 9 }),
        ],
        sands: [
          art("sands", "s1", "CW", { cd: 18, cr: 6 }),
          art("sands", "s2", "Other", { cd: 22, cr: 7 }),
        ],
        goblet: [
          art("goblet", "g1", "CW", { cd: 12, cr: 5 }),
          art("goblet", "g2", "Other", { cd: 25, cr: 9 }),
        ],
        circlet: [
          art("circlet", "c1", "CW", { cd: 20, cr: 4 }),
          art("circlet", "c2", "Other", { cd: 28, cr: 6 }),
        ],
      },
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: { composition: "4pc", artifactSet: "CW" },
    };
    const result = enumerateBuilds(config, 1);
    const bf = bruteForceTopK(config, 1);
    expect(result.builds[0].finalScore).toBeCloseTo(bf[0].score, 4);
  });

  it("top-K results are in score-descending order", () => {
    const config: BuildOptimizerConfig = {
      weights,
      candidates: {
        flower: [
          art("flower", "f1", "CW", { cd: 20 }),
          art("flower", "f2", "CW", { cd: 30 }),
          art("flower", "f3", "CW", { cd: 25 }),
        ],
        plume: [
          art("plume", "p1", "CW", { cd: 25 }),
          art("plume", "p2", "CW", { cd: 18 }),
        ],
        sands: [art("sands", "s1", "CW", { cd: 18 })],
        goblet: [art("goblet", "g1", "CW", { cd: 12 })],
        circlet: [art("circlet", "c1", "CW", { cd: 20 })],
      },
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: { composition: "4pc", artifactSet: "CW" },
    };
    const result = enumerateBuilds(config, 10);
    expect(result.builds.length).toBeGreaterThan(1);
    for (let i = 1; i < result.builds.length; i++) {
      expect(result.builds[i - 1].finalScore).toBeGreaterThanOrEqual(
        result.builds[i].finalScore
      );
    }
  });

  it("top-K contains no duplicate builds (dedup by artifact ID set)", () => {
    // 5x mainSet artifacts → all 5 patterns produce the same 5-artifact assignment
    const config: BuildOptimizerConfig = {
      weights,
      candidates: {
        flower: [art("flower", "f1", "CW", { cd: 20 })],
        plume: [art("plume", "p1", "CW", { cd: 25 })],
        sands: [art("sands", "s1", "CW", { cd: 18 })],
        goblet: [art("goblet", "g1", "CW", { cd: 12 })],
        circlet: [art("circlet", "c1", "CW", { cd: 20 })],
      },
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: { composition: "4pc", artifactSet: "CW" },
    };
    const result = enumerateBuilds(config, 10);
    // Only one possible build — all 5 pieces of CW.
    expect(result.builds.length).toBe(1);
  });

  it("respects soft main stat (wrong-main-stat candidate competes on substats only)", () => {
    // Sands has two candidates: correct-main-stat (atk%) with weak substats,
    // wrong-main-stat (er) with strong substats. The optimizer should pick
    // whichever produces the higher overall score.
    const correctMainWeakSub = art("sands", "s-good-main", "CW", { cd: 5 });
    const wrongMainStrongSub: CandidateArtifact = {
      ...art("sands", "s-bad-main", "CW"),
      mainStatKey: "er",
      substats: { cd: 50, cr: 20 },
    };
    const config: BuildOptimizerConfig = {
      weights,
      candidates: {
        flower: [art("flower", "f1", "CW", { cd: 20 })],
        plume: [art("plume", "p1", "CW", { cd: 20 })],
        sands: [correctMainWeakSub, wrongMainStrongSub],
        goblet: [art("goblet", "g1", "CW", { cd: 20 })],
        circlet: [art("circlet", "c1", "CW", { cd: 20 })],
      },
      crBudget: baseCrBudget,
      targetMainStats: defaultTargetMainStats,
      setConstraint: { composition: "4pc", artifactSet: "CW" },
    };
    const result = enumerateBuilds(config, 1);
    expect(result.builds[0].artifacts.sands.id).toBe("s-bad-main");

    // Sanity: the picked artifact contributes more (substat sum dominates the
    // missing main stat for these inflated values).
    const goodScore = scoreSlotWithMainStat(
      correctMainWeakSub,
      weights,
      defaultTargetMainStats.sands
    );
    const badScore = scoreSlotWithMainStat(
      wrongMainStrongSub,
      weights,
      defaultTargetMainStats.sands
    );
    expect(badScore).toBeGreaterThan(goodScore);
  });

  it("allows builds that exceed 100% CR (soft cap)", () => {
    // All artifacts pump CR to push the build over the 100% cap.
    // Pre-existing non-artifact CR is 50% → 5 artifacts each contributing
    // ~15% CR substat = total ~125%. Build should still be feasible (just
    // with the over-cap CR contributing 0 net).
    const highCrSub = { cr: 30 };
    const cfg: BuildOptimizerConfig = {
      weights,
      candidates: {
        flower: [art("flower", "f1", "CW", highCrSub)],
        plume: [art("plume", "p1", "CW", highCrSub)],
        sands: [art("sands", "s1", "CW", highCrSub)],
        goblet: [art("goblet", "g1", "CW", highCrSub)],
        circlet: [
          {
            ...art("circlet", "c1", "CW"),
            mainStatKey: "cr",
            substats: highCrSub,
          },
        ],
      },
      crBudget: { ...baseCrBudget, totalNonArtifactCr: 0.5 },
      targetMainStats: defaultTargetMainStats,
      setConstraint: { composition: "4pc", artifactSet: "CW" },
    };
    const result = enumerateBuilds(cfg, 1);
    expect(result.builds.length).toBe(1);
    // The build should be returned (not rejected) even though CR will exceed
    // 100% — soft cap, contributes 0 past the cap.
    expect(result.builds[0].finalScore).toBeGreaterThan(0);
  });
});
