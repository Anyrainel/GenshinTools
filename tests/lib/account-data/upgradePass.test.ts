import { describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import type { OptimizedBuild } from "@/lib/account-data/buildOptimizer";
import { scoreFullBuild } from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import type { CrBudgetResult } from "@/lib/account-data/maxCrBuff";
import type { AllocatedBuild } from "@/lib/account-data/tierWaterfall";
import { runUpgradePassForCharacter } from "@/lib/account-data/upgradePass";

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

const targetMainStats: Record<Slot, Set<string>> = {
  flower: new Set(["hp"]),
  plume: new Set(["atk"]),
  sands: new Set(["atk%"]),
  goblet: new Set(["atk%"]),
  circlet: new Set(["cr"]),
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
  const scored = scoreFullBuild(artifacts, weights, targetMainStats, crBudget);
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
          targetMainStats,
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
          targetMainStats,
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
          targetMainStats,
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
