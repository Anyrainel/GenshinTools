import { describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type {
  AccountData,
  ArtifactData,
  Build,
  TierAssignment,
} from "@/data/types";
import { scoreFullBuild } from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import type { CrBudgetResult } from "@/lib/account-data/maxCrBuff";
import type {
  AllActions,
  CharacterActions,
  ScoreUpAction,
} from "@/lib/account-data/scoreUpEngine";
import {
  generateAllScoreActions,
  recomputeTierUpgrades,
} from "@/lib/account-data/scoreUpEngine";
import type { AllocatedBuild } from "@/lib/account-data/tierWaterfall";
import { createArtifactScoreResult } from "../../fixtures";

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
    targetMainStatWeights,
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
        targetMainStatWeights,
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
          currentScore: null,
          allocation,
        },
        xiangling: {
          characterId: "xiangling",
          tier: "A",
          actions: [otherTierAction],
          allocatedBuild: null,
          currentScore: null,
          allocation: null,
        },
      },
    };

    const cautious = recomputeTierUpgrades(
      base,
      accountData,
      tierAssignments,
      "S",
      "cautious"
    );
    const hopeful = recomputeTierUpgrades(
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

  it("does not recommend protected external artifacts as upgrades", () => {
    const { accountData, allocation } = makeAllocation();
    const protectedUpgrade = artifact("plume", "protected-upgrade", 0, {
      cr: 15,
      cd: 30,
      "atk%": 10,
      er: 10,
    });
    accountData.extraArtifacts = [protectedUpgrade];
    const tierAssignments = {
      hu_tao: { tier: "S", position: 0 },
    } as const;
    const base: AllActions = {
      byActionType: { swap: [], equip: [], upgrade: [] },
      perCharacter: {
        hu_tao: {
          characterId: "hu_tao",
          tier: "S",
          actions: [],
          allocatedBuild: allocation.build,
          currentScore: null,
          allocation,
        },
      },
    };

    const unprotected = recomputeTierUpgrades(
      base,
      accountData,
      tierAssignments,
      "S",
      "hopeful"
    );
    const protectedResult = recomputeTierUpgrades(
      base,
      accountData,
      tierAssignments,
      "S",
      "hopeful",
      { protectedArtifactIds: ["protected-upgrade"] }
    );

    expect(
      unprotected.perCharacter.hu_tao.actions.some(
        (action) => action.sourceArtifactId === "protected-upgrade"
      )
    ).toBe(true);
    expect(
      protectedResult.perCharacter.hu_tao.actions.some(
        (action) => action.sourceArtifactId === "protected-upgrade"
      )
    ).toBe(false);
  });
});

// ─── End-to-end fixtures for generateAllScoreActions ───
// Character key "dps" is unknown to game data, so getCrBudget resolves to the
// fallback budget (totalNonArtifactCr = 0.05 → artifact CR cap 0.95).

const scoreUpBuild: Build = {
  id: "main-4pc",
  characterId: "dps",
  visible: true,
  name: "Main 4pc",
  composition: "4pc",
  artifactSet: "Main",
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
    { stat: "atk%", weight: 80 },
  ],
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "atk%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 1,
};

const dpsScores = {
  dps: createArtifactScoreResult({
    buildMatch: { build: scoreUpBuild, statWeights: { ...weights } },
  }),
};

const dpsTier: TierAssignment = { dps: { tier: "S", position: 0 } };

function makeDpsAccount(
  equipped: Record<Slot, ArtifactData>,
  extraArtifacts: ArtifactData[]
): AccountData {
  return {
    characters: [
      {
        key: "dps",
        level: 90,
        constellation: 0,
        talent: { auto: 10, skill: 10, burst: 10 },
        weapon: undefined,
        artifacts: equipped,
      },
    ],
    extraArtifacts,
    extraWeapons: [],
  };
}

/**
 * Equipped set whose artifact CR (0.738 substat + 0.311 circlet main at Lv.20)
 * overshoots the 0.95 fallback cap. The optimal allocation swaps both flower
 * and plume for the CD alternates: the plume swap is a plain raw-score win,
 * while the flower swap loses raw slot score (cd 40 < cr 23.3 × ~2) and pays
 * off only through CR-cap relief on the whole build.
 */
function crReliefEquipped(): Record<Slot, ArtifactData> {
  return {
    flower: artifact("flower", "eq-flower", 20, { cr: 23.3 }),
    plume: artifact("plume", "eq-plume", 20, { cr: 3.9 }),
    sands: artifact("sands", "eq-sands", 20, { cr: 23.3 }),
    goblet: artifact("goblet", "eq-goblet", 20, { cr: 23.3 }),
    circlet: artifact("circlet", "eq-circlet", 20, { cd: 10 }),
  };
}

function crReliefExtras(): ArtifactData[] {
  return [
    artifact("plume", "alt-plume", 20, { cd: 46.6 }),
    artifact("flower", "alt-flower", 20, { cd: 40 }),
  ];
}

function allocationActions(entry: CharacterActions): ScoreUpAction[] {
  return entry.actions.filter((action) => action.actionType !== "upgrade");
}

/** Replay surfaced swap/equip actions onto the equipped set, slot by slot. */
function applyAllocationActions(
  equipped: Partial<Record<Slot, ArtifactData>>,
  actions: ScoreUpAction[]
): Record<Slot, string | null> {
  const result = Object.fromEntries(
    allSlots.map((slot) => [slot, equipped[slot]?.id ?? null])
  ) as Record<Slot, string | null>;
  for (const action of actions) {
    if (action.actionType === "upgrade") continue;
    result[action.slot] = action.sourceArtifactId;
  }
  return result;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateAllScoreActions allocation atomicity", () => {
  it("surfaces every changed slot of the allocated build, including negative-diff CR-relief swaps", () => {
    const equipped = crReliefEquipped();
    const accountData = makeDpsAccount(equipped, crReliefExtras());

    const result = generateAllScoreActions(accountData, dpsScores, dpsTier);
    const entry = result.perCharacter.dps;
    const build = entry.allocatedBuild;

    expect(build).not.toBeNull();
    expect(build?.artifacts.flower.id).toBe("alt-flower");
    expect(build?.artifacts.plume.id).toBe("alt-plume");

    const swaps = allocationActions(entry);
    expect(swaps).toHaveLength(2);
    const flowerSwap = swaps.find((action) => action.slot === "flower");
    const plumeSwap = swaps.find((action) => action.slot === "plume");
    expect(flowerSwap?.actionType).toBe("swap");
    expect(plumeSwap?.actionType).toBe("swap");
    expect(flowerSwap?.sourceArtifactId).toBe("alt-flower");
    expect(flowerSwap?.currentArtifactId).toBe("eq-flower");
    expect(flowerSwap!.slotScoreDiff).toBeLessThan(0);
    expect(plumeSwap!.slotScoreDiff).toBeGreaterThan(0);

    const applied = applyAllocationActions(equipped, entry.actions);
    for (const slot of allSlots) {
      expect(applied[slot]).toBe(build?.artifacts[slot]?.id ?? null);
    }
  });

  it("never surfaces swap or equip actions for slots whose allocated artifact is already equipped", () => {
    const equipped = crReliefEquipped();
    const accountData = makeDpsAccount(equipped, crReliefExtras());

    const result = generateAllScoreActions(accountData, dpsScores, dpsTier);
    const entry = result.perCharacter.dps;
    const build = entry.allocatedBuild;
    expect(build).not.toBeNull();

    const unchangedSlots = allSlots.filter(
      (slot) => build?.artifacts[slot]?.id === equipped[slot].id
    );
    expect(unchangedSlots).toEqual(["sands", "goblet", "circlet"]);

    for (const action of allocationActions(entry)) {
      expect(unchangedSlots).not.toContain(action.slot);
      expect(build?.artifacts[action.slot]?.id).not.toBe(
        equipped[action.slot].id
      );
    }
  });
});

describe("generateAllScoreActions score gain consistency", () => {
  it("exposes currentScore as scoreFullBuild over equipped artifacts and ties every allocation action's buildScoreDiff to finalScore - currentScore", () => {
    const equipped = crReliefEquipped();
    const accountData = makeDpsAccount(equipped, crReliefExtras());

    const result = generateAllScoreActions(accountData, dpsScores, dpsTier);
    const entry = result.perCharacter.dps;

    expect(entry.currentScore).not.toBeNull();
    expect(entry.allocatedBuild).not.toBeNull();

    const config = entry.allocation!.context!.config;
    const equippedCandidates = Object.fromEntries(
      allSlots.map((slot) => [slot, candidate(equipped[slot])])
    ) as Record<Slot, CandidateArtifact>;
    const expectedCurrent = scoreFullBuild(
      equippedCandidates,
      config.weights,
      config.targetMainStatWeights,
      config.crBudget
    ).finalScore;
    expect(entry.currentScore).toBeCloseTo(expectedCurrent, 9);

    const expectedDiff =
      entry.allocatedBuild!.finalScore - (entry.currentScore ?? 0);
    expect(expectedDiff).toBeGreaterThan(0);
    const swaps = allocationActions(entry);
    expect(swaps.length).toBeGreaterThan(0);
    for (const action of swaps) {
      expect(Math.abs(action.buildScoreDiff - expectedDiff)).toBeLessThan(1e-9);
    }
  });

  it("reports zero gain when the allocation equals the equipped build exactly", () => {
    const accountData = makeDpsAccount(crReliefEquipped(), []);

    const result = generateAllScoreActions(accountData, dpsScores, dpsTier);
    const entry = result.perCharacter.dps;

    expect(entry.allocatedBuild).not.toBeNull();
    expect(
      allSlots.map((slot) => entry.allocatedBuild?.artifacts[slot]?.id)
    ).toEqual(allSlots.map((slot) => `eq-${slot}`));
    expect(allocationActions(entry)).toHaveLength(0);
    expect(entry.currentScore).not.toBeNull();
    expect(entry.allocatedBuild!.finalScore).toBeCloseTo(
      entry.currentScore ?? Number.NaN,
      9
    );
  });

  it("never allocates below the keepable equipped build when the equipped set stays in the pool (seeded sweep)", () => {
    const rand = mulberry32(0x5eed5);
    const roll = (max: number) => Math.round(rand() * max * 10) / 10;

    for (let iter = 0; iter < 12; iter++) {
      const equipped = Object.fromEntries(
        allSlots.map((slot) => [
          slot,
          artifact(slot, `eq-${slot}-${iter}`, 20, {
            cr: roll(25),
            cd: roll(40),
            "atk%": roll(20),
            er: roll(25),
          }),
        ])
      ) as Record<Slot, ArtifactData>;
      const extraArtifacts: ArtifactData[] = [];
      for (let i = 0; i < 6; i++) {
        const slot = allSlots[Math.floor(rand() * allSlots.length)];
        const extra = artifact(slot, `extra-${iter}-${i}`, 20, {
          cr: roll(25),
          cd: roll(40),
          "atk%": roll(20),
          er: roll(25),
        });
        if (rand() < 0.3) extra.setKey = "Off";
        extraArtifacts.push(extra);
      }
      const accountData = makeDpsAccount(equipped, extraArtifacts);

      const result = generateAllScoreActions(
        accountData,
        dpsScores,
        dpsTier,
        {},
        { pricingRounds: 2 }
      );
      const entry = result.perCharacter.dps;

      expect(entry.allocatedBuild).not.toBeNull();
      expect(entry.currentScore).not.toBeNull();
      expect(entry.allocatedBuild!.finalScore).toBeGreaterThanOrEqual(
        (entry.currentScore ?? Number.POSITIVE_INFINITY) - 1e-9
      );

      const applied = applyAllocationActions(equipped, entry.actions);
      for (const slot of allSlots) {
        expect(applied[slot]).toBe(
          entry.allocatedBuild?.artifacts[slot]?.id ?? null
        );
      }
    }
  });
});

describe("recomputeTierUpgrades end-to-end", () => {
  it("preserves currentScore and allocation actions while recomputing only the tier's upgrades", () => {
    const equipped = crReliefEquipped();
    const upgradeable = artifact("sands", "up-sands", 8, {
      cr: 3.5,
      cd: 23.3,
      "atk%": 9.9,
      er: 4.5,
    });
    const accountData = makeDpsAccount(equipped, [
      ...crReliefExtras(),
      upgradeable,
    ]);

    const original = generateAllScoreActions(accountData, dpsScores, dpsTier);
    const originalEntry = original.perCharacter.dps;
    const originalUpgrade = originalEntry.actions.find(
      (action) => action.actionType === "upgrade"
    );
    expect(originalUpgrade?.sourceArtifactId).toBe("up-sands");

    const recomputed = recomputeTierUpgrades(
      original,
      accountData,
      dpsTier,
      "S",
      "hopeful"
    );
    const entry = recomputed.perCharacter.dps;

    expect(entry.currentScore).toBe(originalEntry.currentScore);
    expect(entry.currentScore).not.toBeNull();
    expect(allocationActions(entry)).toEqual(allocationActions(originalEntry));
    expect(entry.allocation?.luckExpectation).toBe("hopeful");

    const hopefulUpgrade = entry.actions.find(
      (action) => action.actionType === "upgrade"
    );
    expect(hopefulUpgrade?.sourceArtifactId).toBe("up-sands");
    expect(hopefulUpgrade!.slotScoreDiff).toBeGreaterThan(
      originalUpgrade!.slotScoreDiff
    );
  });
});
