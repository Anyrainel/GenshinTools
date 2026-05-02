import { describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { AccountData, ArtifactData } from "@/data/types";
import { scoreFullBuild } from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import type { CrBudgetResult } from "@/lib/account-data/maxCrBuff";
import type {
  AllActions,
  ScoreUpAction,
} from "@/lib/account-data/scoreUpEngine";
import { recomputeTierUpgradeRecommendations } from "@/lib/account-data/scoreUpEngine";
import type { AllocatedBuild } from "@/lib/account-data/tierWaterfall";

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
  level: number,
  substats: ArtifactData["substats"]
): ArtifactData {
  return {
    id,
    setKey: "Main",
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

function makeAllocation(): {
  accountData: AccountData;
  allocation: AllocatedBuild;
} {
  const equippedArtifacts = {
    flower: artifact("flower", "current-flower", 0, {
      cr: 3.9,
      cd: 7.8,
      "atk%": 5.8,
      er: 6.5,
    }),
    plume: artifact("plume", "current-plume", 20, {}),
    sands: artifact("sands", "current-sands", 20, {}),
    goblet: artifact("goblet", "current-goblet", 20, {}),
    circlet: artifact("circlet", "current-circlet", 20, {}),
  } satisfies Record<Slot, ArtifactData>;
  const allocatedArtifacts = Object.fromEntries(
    allSlots.map((slot) => [slot, candidate(equippedArtifacts[slot])])
  ) as Record<Slot, CandidateArtifact>;
  const scored = scoreFullBuild(
    allocatedArtifacts,
    weights,
    targetMainStats,
    crBudget
  );
  const allocation: AllocatedBuild = {
    characterId: "hu_tao",
    tier: "S",
    build: {
      artifacts: allocatedArtifacts,
      slotScores: Object.fromEntries(
        allSlots.map((slot) => [slot, 0])
      ) as Record<Slot, number>,
      rawScore: scored.rawScore,
      crPenalty: scored.rawScore - scored.finalScore,
      finalScore: scored.finalScore,
      totalArtifactCr: scored.totalArtifactCr,
    },
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
    equipped: equippedArtifacts,
    luckExpectation: "cautious",
  };
  return {
    accountData: {
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 0,
          talent: { auto: 10, skill: 10, burst: 10 },
          weapon: undefined,
          artifacts: equippedArtifacts,
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    },
    allocation,
  };
}

describe("recomputeTierUpgradeRecommendations", () => {
  it("replaces only upgrade recommendations for the selected tier", () => {
    const { accountData, allocation } = makeAllocation();
    const tierAssignments = {
      hu_tao: { tier: "S", position: 0 },
      xiangling: { tier: "A", position: 0 },
    } as const;
    const preservedSwap: ScoreUpAction = {
      actionType: "swap",
      characterId: "hu_tao",
      slot: "plume",
      sourceArtifactId: "swap-plume",
      currentArtifactId: "current-plume",
      setKey: "Main",
      slotScoreDiff: 5,
      buildScoreDiff: 5,
      maxPotentialScore: 20,
    };
    const staleUpgrade: ScoreUpAction = {
      actionType: "upgrade",
      characterId: "hu_tao",
      slot: "flower",
      sourceArtifactId: "stale-upgrade",
      currentArtifactId: "current-flower",
      setKey: "Main",
      slotScoreDiff: 999,
      buildScoreDiff: 999,
      maxPotentialScore: 999,
      upgradeStrategy: 1,
    };
    const otherTierAction: ScoreUpAction = {
      actionType: "equip",
      characterId: "xiangling",
      slot: "flower",
      sourceArtifactId: "other-tier-flower",
      currentArtifactId: null,
      setKey: "Main",
      slotScoreDiff: 10,
      buildScoreDiff: 10,
      maxPotentialScore: 10,
    };
    const base: AllActions = {
      byActionType: {
        swap: [preservedSwap],
        equip: [otherTierAction],
        upgrade: [staleUpgrade],
      },
      perCharacter: {
        hu_tao: {
          characterId: "hu_tao",
          tier: "S",
          actions: [preservedSwap, staleUpgrade],
          allocatedBuild: allocation.build,
          allocation,
        },
        xiangling: {
          characterId: "xiangling",
          tier: "A",
          actions: [otherTierAction],
          allocatedBuild: null,
          allocation: null,
        },
      },
    };

    const cautious = recomputeTierUpgradeRecommendations(
      base,
      accountData,
      tierAssignments,
      "S",
      "cautious"
    );
    const hopeful = recomputeTierUpgradeRecommendations(
      cautious,
      accountData,
      tierAssignments,
      "S",
      "hopeful"
    );

    const cautiousUpgrade = cautious.perCharacter.hu_tao.actions.find(
      (action) => action.actionType === "upgrade"
    );
    const hopefulUpgrade = hopeful.perCharacter.hu_tao.actions.find(
      (action) => action.actionType === "upgrade"
    );

    expect(cautious.perCharacter.hu_tao.actions).toContainEqual(preservedSwap);
    expect(cautious.perCharacter.hu_tao.actions).not.toContainEqual(
      staleUpgrade
    );
    expect(cautiousUpgrade?.sourceArtifactId).toBe("current-flower");
    expect(hopefulUpgrade?.slotScoreDiff).toBeGreaterThan(
      cautiousUpgrade?.slotScoreDiff ?? 0
    );
    expect(hopeful.perCharacter.xiangling.actions).toEqual([otherTierAction]);
    expect(hopeful.byActionType.equip).toEqual([otherTierAction]);
    expect(hopeful.perCharacter.hu_tao.allocation?.luckExpectation).toBe(
      "hopeful"
    );
  });
});
