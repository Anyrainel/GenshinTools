import { describe, expect, it } from "vitest";
import { SUBSTAT_COEFFICIENTS } from "@/data/constants";
import type { LuckExpectation, Slot, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import type { OptimizedBuild } from "@/lib/account-data/buildOptimizer";
import { scoreFullBuild } from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import type { CrBudgetResult } from "@/lib/account-data/maxCrBuff";
import type { AllocatedBuild } from "@/lib/account-data/tierWaterfall";
import { runUpgradePassForCharacter } from "@/lib/account-data/upgradePass";
import {
  getSubstatAvgRoll,
  getSubstatRollTiers,
} from "@/lib/artifact/scoring/utils";

const weights = { cr: 100, cd: 100, "atk%": 80 } as const;

const crBudget: CrBudgetResult = {
  baseCr: 0.05,
  ascensionCr: 0,
  characterBuffCr: 0,
  weaponSecondaryCr: 0,
  weaponPassiveCr: 0,
  artifactSetCr: 0,
  totalNonArtifactCr: 0.05,
};

const targetMainStatWeights: Record<Slot, ReadonlyMap<string, number>> = {
  flower: new Map([["hp", 100]]),
  plume: new Map([["atk", 100]]),
  sands: new Map([["atk%", 100]]),
  goblet: new Map([["atk%", 100]]),
  circlet: new Map([["cr", 100]]),
};

const mainStatBySlot: Record<Slot, ArtifactData["mainStatKey"]> = {
  flower: "hp",
  plume: "atk",
  sands: "atk%",
  goblet: "atk%",
  circlet: "cr",
};

function artifact(
  slot: Slot,
  id: string,
  setKey: string,
  level: number,
  substats: ArtifactData["substats"]
): ArtifactData {
  return {
    id,
    setKey,
    slotKey: slot,
    level,
    rarity: 5,
    mainStatKey: mainStatBySlot[slot],
    lock: false,
    substats,
  };
}

function candidate(art: ArtifactData): CandidateArtifact {
  return {
    ...art,
    source: "current",
    sourceArtifactId: art.id,
  };
}

function makeAllocatedBuild(
  artifacts: Record<Slot, CandidateArtifact>
): OptimizedBuild {
  const scored = scoreFullBuild(
    artifacts,
    weights,
    targetMainStatWeights,
    crBudget
  );
  const slotScores = {} as Record<Slot, number>;
  for (const slot of allSlots) slotScores[slot] = 0;
  return {
    artifacts,
    slotScores,
    rawScore: scored.rawScore,
    crPenalty: scored.rawScore - scored.finalScore,
    finalScore: scored.finalScore,
    totalArtifactCr: scored.totalArtifactCr,
  };
}

describe("runUpgradePassForCharacter", () => {
  it("does not use blocked same-or-higher-tier artifacts as compound swap partners", () => {
    const allocatedArtifacts = {
      flower: candidate(artifact("flower", "current-flex", "Off", 20, {})),
      plume: candidate(artifact("plume", "current-plume", "Main", 20, {})),
      sands: candidate(artifact("sands", "current-sands", "Main", 20, {})),
      goblet: candidate(artifact("goblet", "current-goblet", "Main", 20, {})),
      circlet: candidate(
        artifact("circlet", "current-circlet", "Main", 20, {})
      ),
    } satisfies Record<Slot, CandidateArtifact>;
    const build = makeAllocatedBuild(allocatedArtifacts);
    const flexUpgrade = artifact("flower", "upgrade-flex", "Main", 0, {
      cr: 3.9,
      cd: 7.8,
      "atk%": 5.8,
      er: 6.5,
    });
    const blockedSwap = artifact("sands", "blocked-swap", "Off", 20, {
      cr: 20,
      cd: 40,
      "atk%": 20,
    });

    const alloc: AllocatedBuild = {
      characterId: "hutao",
      tier: "S",
      build,
      context: {
        config: {
          weights,
          candidates: {
            flower: [],
            plume: [],
            sands: [],
            goblet: [],
            circlet: [],
          },
          crBudget,
          targetMainStatWeights,
          setConstraint: { composition: "4pc", artifactSet: "Main" },
        },
        crBudget,
        scoreResult: null as never,
      },
      equipped: {},
      luckExpectation: "balanced",
    };

    const result = runUpgradePassForCharacter(
      alloc,
      [
        ...allSlots.map((slot) => allocatedArtifacts[slot]),
        flexUpgrade,
        blockedSwap,
      ],
      {
        minScoreDiff: 0.001,
        blockedArtifactIds: new Set(["blocked-swap"]),
      }
    );

    expect(result.recommendations).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ swapArtifactId: "blocked-swap" }),
      ])
    );
  });

  it("does not use blocked same-or-higher-tier artifacts as external upgrade picks", () => {
    const allocatedArtifacts = {
      flower: candidate(artifact("flower", "current-flex", "Off", 20, {})),
      plume: candidate(artifact("plume", "current-plume", "Main", 20, {})),
      sands: candidate(artifact("sands", "current-sands", "Main", 20, {})),
      goblet: candidate(artifact("goblet", "current-goblet", "Main", 20, {})),
      circlet: candidate(
        artifact("circlet", "current-circlet", "Main", 20, {})
      ),
    } satisfies Record<Slot, CandidateArtifact>;
    const build = makeAllocatedBuild(allocatedArtifacts);
    const blockedUpgrade = artifact("flower", "blocked-upgrade", "Off", 0, {
      cr: 3.9,
      cd: 7.8,
      "atk%": 5.8,
      er: 6.5,
    });

    const alloc: AllocatedBuild = {
      characterId: "hutao",
      tier: "S",
      build,
      context: {
        config: {
          weights,
          candidates: {
            flower: [],
            plume: [],
            sands: [],
            goblet: [],
            circlet: [],
          },
          crBudget,
          targetMainStatWeights,
          setConstraint: { composition: "4pc", artifactSet: "Main" },
        },
        crBudget,
        scoreResult: null as never,
      },
      equipped: {},
      luckExpectation: "balanced",
    };

    const result = runUpgradePassForCharacter(
      alloc,
      [...allSlots.map((slot) => allocatedArtifacts[slot]), blockedUpgrade],
      {
        minScoreDiff: 0.001,
        blockedArtifactIds: new Set(["blocked-upgrade"]),
      }
    );

    expect(result.recommendations).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ upgradeArtifactId: "blocked-upgrade" }),
      ])
    );
  });

  it("does not replace fixed 2pc slots with a different set from the same half-set group", () => {
    const allocatedArtifacts = {
      flower: candidate(
        artifact("flower", "current-atk-flower", "gladiators_finale", 20, {})
      ),
      plume: candidate(
        artifact("plume", "current-atk-plume", "gladiators_finale", 20, {})
      ),
      sands: candidate(
        artifact(
          "sands",
          "current-hp-sands",
          "tenacity_of_the_millelith",
          20,
          {}
        )
      ),
      goblet: candidate(
        artifact(
          "goblet",
          "current-hp-goblet",
          "tenacity_of_the_millelith",
          20,
          {}
        )
      ),
      circlet: candidate(
        artifact("circlet", "current-flex-circlet", "berserker", 20, {})
      ),
    } satisfies Record<Slot, CandidateArtifact>;
    const build = makeAllocatedBuild(allocatedArtifacts);
    const mixedSetUpgrade = artifact(
      "flower",
      "mixed-set-atk-flower",
      "shimenawas_reminiscence",
      0,
      {
        cr: 10,
        cd: 40,
        "atk%": 20,
        er: 10,
      }
    );

    const alloc: AllocatedBuild = {
      characterId: "hutao",
      tier: "S",
      build,
      context: {
        config: {
          weights,
          candidates: {
            flower: [],
            plume: [],
            sands: [],
            goblet: [],
            circlet: [],
          },
          crBudget,
          targetMainStatWeights,
          setConstraint: {
            composition: "2pc+2pc",
            halfSet1: "atk%-18",
            halfSet2: "hp%-20",
          },
        },
        crBudget,
        scoreResult: null as never,
      },
      equipped: {},
      luckExpectation: "balanced",
    };

    const result = runUpgradePassForCharacter(
      alloc,
      [...allSlots.map((slot) => allocatedArtifacts[slot]), mixedSetUpgrade],
      { minScoreDiff: 0.001 }
    );

    expect(result.recommendations).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ upgradeArtifactId: "mixed-set-atk-flower" }),
      ])
    );
  });
});

describe("runUpgradePassForCharacter upgrade projection", () => {
  function artifact4(
    slot: Slot,
    id: string,
    level: number,
    substats: ArtifactData["substats"],
    unactivatedSubstats?: ArtifactData["unactivatedSubstats"]
  ): ArtifactData {
    return {
      ...artifact(slot, id, "Main", level, substats),
      rarity: 4,
      unactivatedSubstats,
    };
  }

  function lineScore(stat: SubStat, value: number): number {
    const weight = (weights as Partial<Record<SubStat, number>>)[stat] ?? 0;
    return value * (SUBSTAT_COEFFICIENTS[stat] ?? 0) * (weight / 100);
  }

  /**
   * Drives the pass with an all-"Main" 4pc build of max-level, empty-substat
   * artifacts, so the flower-slot upgrade rec's scoreDiff equals the projected
   * substat score of the candidate (flower main stat contributes nothing).
   */
  function runFixedSlotUpgrade(
    upgrade: ArtifactData,
    luck: LuckExpectation = "balanced"
  ): number {
    const allocatedArtifacts = {
      flower: candidate(artifact("flower", "cur-flower", "Main", 20, {})),
      plume: candidate(artifact("plume", "cur-plume", "Main", 20, {})),
      sands: candidate(artifact("sands", "cur-sands", "Main", 20, {})),
      goblet: candidate(artifact("goblet", "cur-goblet", "Main", 20, {})),
      circlet: candidate(artifact("circlet", "cur-circlet", "Main", 20, {})),
    } satisfies Record<Slot, CandidateArtifact>;
    const build = makeAllocatedBuild(allocatedArtifacts);
    const alloc: AllocatedBuild = {
      characterId: "hutao",
      tier: "S",
      build,
      context: {
        config: {
          weights,
          candidates: {
            flower: [],
            plume: [],
            sands: [],
            goblet: [],
            circlet: [],
          },
          crBudget,
          targetMainStatWeights,
          setConstraint: { composition: "4pc", artifactSet: "Main" },
        },
        crBudget,
        scoreResult: null as never,
      },
      equipped: {},
      luckExpectation: luck,
    };
    const result = runUpgradePassForCharacter(
      alloc,
      [...allSlots.map((slot) => allocatedArtifacts[slot]), upgrade],
      { minScoreDiff: 0.001 }
    );
    const rec = result.recommendations.find(
      (r) => r.upgradeArtifactId === upgrade.id
    );
    expect(rec).toBeDefined();
    return rec?.scoreDiff ?? 0;
  }

  it("projects floor(20/4) - floor(level/4) added rolls for a 5-star 4-line artifact at every level", () => {
    const lines: [SubStat, number][] = [
      ["cr", 3.3],
      ["cd", 7.0],
      ["atk%", 4.5],
      ["er", 5.0],
    ];
    // Regression: level 9 used to project 2 added rolls instead of 3, and
    // levels 1-3 lost one roll as well (old code used floor((max-level)/4)).
    const expectedAddedRollsByLevel: [number, number][] = [
      [0, 5],
      [1, 5],
      [2, 5],
      [3, 5],
      [5, 4],
      [8, 3],
      [9, 3],
      [19, 1],
    ];
    for (const [level, addedRolls] of expectedAddedRollsByLevel) {
      const diff = runFixedSlotUpgrade(
        artifact("flower", `up-lv${level}`, "Main", level, {
          cr: lines[0][1],
          cd: lines[1][1],
          "atk%": lines[2][1],
          er: lines[3][1],
        })
      );
      let expected = 0;
      for (const [stat, val] of lines) {
        expected += lineScore(
          stat,
          val + getSubstatAvgRoll(stat, 5) * (addedRolls / 4)
        );
      }
      expect(diff, `level ${level}`).toBeCloseTo(expected, 8);
    }
  });

  it("activates a known unactivated 4th line on a 4-star before splitting the remaining rolls", () => {
    const diff = runFixedSlotUpgrade(
      artifact4(
        "flower",
        "up-4star-activation",
        0,
        { cr: 2.8, "atk%": 4.1, er: 3.6 },
        { cd: 0 }
      )
    );
    // 4-star lv0: 4 rolls total; cd activation consumes 1 at the expected
    // 4-star roll value, the remaining 3 split across 4 lines (0.75 each).
    const avg4 = (stat: SubStat) => getSubstatAvgRoll(stat, 4);
    const expected =
      lineScore("cr", 2.8 + 0.75 * avg4("cr")) +
      lineScore("cd", 1.75 * avg4("cd")) +
      lineScore("atk%", 4.1 + 0.75 * avg4("atk%")) +
      lineScore("er", 3.6 + 0.75 * avg4("er"));
    expect(diff).toBeCloseTo(expected, 8);
    // Audit reference value for this exact artifact and cr100/cd100/atk%80.
    expect(diff).toBeCloseTo(26.344, 1);
  });

  it("uses the recorded unactivated value instead of the expected roll value when present", () => {
    const recordedCd = 7.0;
    const diff = runFixedSlotUpgrade(
      artifact4(
        "flower",
        "up-4star-recorded",
        0,
        { cr: 2.8, "atk%": 4.1, er: 3.6 },
        { cd: recordedCd }
      )
    );
    const avg4 = (stat: SubStat) => getSubstatAvgRoll(stat, 4);
    const expected =
      lineScore("cr", 2.8 + 0.75 * avg4("cr")) +
      lineScore("cd", recordedCd + 0.75 * avg4("cd")) +
      lineScore("atk%", 4.1 + 0.75 * avg4("atk%")) +
      lineScore("er", 3.6 + 0.75 * avg4("er"));
    expect(diff).toBeCloseTo(expected, 8);
  });

  it("activates both unactivated lines of a 2-active 4-star before equal distribution", () => {
    const diff = runFixedSlotUpgrade(
      artifact4(
        "flower",
        "up-4star-two-unactivated",
        0,
        { cr: 2.8, cd: 5.4 },
        { "atk%": 0, er: 4.0 }
      )
    );
    // 4 rolls total; 2 activations (atk% at expected value, er at recorded
    // 4.0) leave 2 rolls split across 4 lines (0.5 each).
    const avg4 = (stat: SubStat) => getSubstatAvgRoll(stat, 4);
    const expected =
      lineScore("cr", 2.8 + 0.5 * avg4("cr")) +
      lineScore("cd", 5.4 + 0.5 * avg4("cd")) +
      lineScore("atk%", 1.5 * avg4("atk%")) +
      lineScore("er", 4.0 + 0.5 * avg4("er"));
    expect(diff).toBeCloseTo(expected, 8);
  });

  it("scales projected roll values by luck expectation: hopeful > balanced > cautious", () => {
    const lines: [SubStat, number][] = [
      ["cr", 3.5],
      ["cd", 7.0],
      ["atk%", 4.1],
      ["er", 4.5],
    ];
    const mk = (id: string) =>
      artifact("flower", id, "Main", 0, {
        cr: lines[0][1],
        cd: lines[1][1],
        "atk%": lines[2][1],
        er: lines[3][1],
      });
    const cautious = runFixedSlotUpgrade(mk("up-luck-cautious"), "cautious");
    const balanced = runFixedSlotUpgrade(mk("up-luck-balanced"), "balanced");
    const hopeful = runFixedSlotUpgrade(mk("up-luck-hopeful"), "hopeful");

    expect(hopeful).toBeGreaterThan(balanced);
    expect(balanced).toBeGreaterThan(cautious);

    // hopeful = tier index 2 of the 4 roll tiers, 1.25 rolls per line.
    let expectedHopeful = 0;
    for (const [stat, val] of lines) {
      expectedHopeful += lineScore(
        stat,
        val + getSubstatRollTiers(stat, 5)[2] * 1.25
      );
    }
    expect(hopeful).toBeCloseTo(expectedHopeful, 8);
  });
});
