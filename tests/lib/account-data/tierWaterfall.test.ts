import { describe, expect, it } from "vitest";
import type { MainStat, Slot, SubStat, Tier } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type {
  AccountData,
  ArtifactData,
  Build,
  CharacterData,
  TierAssignment,
} from "@/data/types";
import { scoreFullBuild } from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import {
  type AllocationContext,
  runTierWaterfall,
  runTierWaterfallSteps,
} from "@/lib/account-data/tierWaterfall";
import type {
  ArtifactScoreResult,
  StatWeightMap,
} from "@/lib/artifact/scoring/artifactScore";
import { createArtifactScoreResult } from "../../fixtures";

const stepOrderAccountData: AccountData = {
  characters: [
    {
      key: "higher",
      level: 90,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
      artifacts: {},
    },
    {
      key: "lower",
      level: 90,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
      artifacts: {},
    },
  ],
  extraArtifacts: [],
  extraWeapons: [],
};

const mainStatBySlot: Record<Slot, ArtifactData["mainStatKey"]> = {
  flower: "hp",
  plume: "atk",
  sands: "atk%",
  goblet: "atk%",
  circlet: "cr",
};

function artifact(slot: Slot, id = `pool-${slot}`): ArtifactData {
  return {
    id,
    setKey: "Main",
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey: mainStatBySlot[slot],
    lock: false,
    substats: { cr: 3.9, cd: 7.8 },
  };
}

const build: Build = {
  id: "main-build",
  characterId: "ranked",
  visible: true,
  name: "Main",
  composition: "4pc",
  artifactSet: "Main",
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
  ],
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "atk%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 1,
};

describe("runTierWaterfallSteps", () => {
  it("yields completed character tiers from high to low priority", () => {
    const tierAssignments: TierAssignment = {
      lower: { tier: "A", position: 0 },
      higher: { tier: "S", position: 0 },
    };

    const steps = Array.from(
      runTierWaterfallSteps(stepOrderAccountData, {}, tierAssignments)
    );

    expect(steps.map((step) => step.tier)).toEqual(["S", "A"]);
    expect(steps[0].allocation.perCharacter.higher?.tier).toBe("S");
    expect(steps[0].allocation.perCharacter.lower).toBeUndefined();
    expect(steps[1].allocation.perCharacter.lower?.tier).toBe("A");
  });
});

describe("runTierWaterfall", () => {
  it("can exclude artifacts equipped by Pool characters from recommendation search", () => {
    const poolArtifacts = Object.fromEntries(
      allSlots.map((slot) => [slot, artifact(slot)])
    ) as Record<Slot, ArtifactData>;
    const accountData: AccountData = {
      characters: [
        {
          key: "ranked",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {},
        },
        {
          key: "pool",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: poolArtifacts,
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };
    const tierAssignments = {
      ranked: { tier: "S", position: 0 },
      pool: { tier: "Pool", position: 0 },
    } as const;
    const scores = {
      ranked: createArtifactScoreResult({
        buildMatch: {
          build,
          statWeights: { cr: 100, cd: 100, "atk%": 80 },
        },
      }),
    };

    const allowed = runTierWaterfall(
      accountData,
      scores,
      tierAssignments,
      {},
      {
        allowPoolArtifactSteals: true,
      }
    );
    const denied = runTierWaterfall(
      accountData,
      scores,
      tierAssignments,
      {},
      {
        allowPoolArtifactSteals: false,
      }
    );

    expect(allowed.perCharacter.ranked.build).not.toBeNull();
    expect(denied.perCharacter.ranked.build).toBeNull();
  });

  it("excludes protected equipped artifacts from other characters", () => {
    const protectedArtifacts = Object.fromEntries(
      allSlots.map((slot) => [slot, artifact(slot, `protected-${slot}`)])
    ) as Record<Slot, ArtifactData>;
    const accountData: AccountData = {
      characters: [
        {
          key: "ranked",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {},
        },
        {
          key: "frozen_owner",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: protectedArtifacts,
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };
    const tierAssignments = {
      ranked: { tier: "S", position: 0 },
      frozen_owner: { tier: "A", position: 0 },
    } as const;
    const scores = {
      ranked: createArtifactScoreResult({
        buildMatch: {
          build,
          statWeights: { cr: 100, cd: 100, "atk%": 80 },
        },
      }),
    };

    const result = runTierWaterfall(
      accountData,
      scores,
      tierAssignments,
      {},
      {
        protectedArtifactIds: allSlots.map((slot) => `protected-${slot}`),
      }
    );

    expect(result.perCharacter.ranked.build).toBeNull();
  });

  it("keeps protected current artifacts available to their owner", () => {
    const currentArtifacts = Object.fromEntries(
      allSlots.map((slot) => [slot, artifact(slot, `current-${slot}`)])
    ) as Record<Slot, ArtifactData>;
    const accountData: AccountData = {
      characters: [
        {
          key: "ranked",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: currentArtifacts,
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };
    const tierAssignments = {
      ranked: { tier: "S", position: 0 },
    } as const;
    const scores = {
      ranked: createArtifactScoreResult({
        buildMatch: {
          build,
          statWeights: { cr: 100, cd: 100, "atk%": 80 },
        },
      }),
    };

    const result = runTierWaterfall(
      accountData,
      scores,
      tierAssignments,
      {},
      {
        protectedArtifactIds: allSlots.map((slot) => `current-${slot}`),
      }
    );

    expect(result.perCharacter.ranked.build).not.toBeNull();
    expect(
      allSlots.map(
        (slot) => result.perCharacter.ranked.build?.artifacts[slot]?.id
      )
    ).toEqual(allSlots.map((slot) => `current-${slot}`));
  });
});

// ─── Seeded fuzz + waterfall ordering invariants ───

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeFuzzBuild(characterId: string, setKey: string): Build {
  return {
    id: `${characterId}-build`,
    characterId,
    visible: true,
    name: "Fuzz",
    composition: "4pc",
    artifactSet: setKey,
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 75 },
      { stat: "em", weight: 50 },
    ],
    sandsWeights: [
      { stat: "atk%", weight: 100 },
      { stat: "er", weight: 60 },
    ],
    gobletWeights: [
      { stat: "atk%", weight: 100 },
      { stat: "pyro%", weight: 100 },
    ],
    circletWeights: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
    ],
    normalizer: 1,
  };
}

const FUZZ_STAT_WEIGHTS: StatWeightMap = {
  cr: 100,
  cd: 100,
  "atk%": 75,
  em: 50,
};

const FUZZ_MAIN_CHOICES: Record<Slot, MainStat[]> = {
  flower: ["hp"],
  plume: ["atk"],
  sands: ["atk%", "hp%", "er"],
  goblet: ["atk%", "pyro%", "hp%"],
  circlet: ["cr", "cd", "atk%"],
};

function fuzzArtifact(rand: () => number, index: number): ArtifactData {
  const slot = allSlots[index % allSlots.length];
  const mains = FUZZ_MAIN_CHOICES[slot];
  const substats: Partial<Record<SubStat, number>> = {};
  if (rand() < 0.85) substats.cr = Math.round(rand() * 150) / 10;
  if (rand() < 0.85) substats.cd = Math.round(rand() * 280) / 10;
  if (rand() < 0.6) substats["atk%"] = Math.round(rand() * 160) / 10;
  if (rand() < 0.5) substats.em = Math.round(rand() * 60);
  return {
    id: `art-${index}`,
    setKey: rand() < 0.7 ? "SetA" : "SetB",
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey: mains[Math.floor(rand() * mains.length)],
    lock: false,
    substats,
  };
}

interface FuzzScenario {
  accountData: AccountData;
  scores: Record<string, ArtifactScoreResult | null>;
  tierAssignments: TierAssignment;
  protectedArtifactIds: string[];
  /** Artifact id → key of the character wearing it at scenario start. */
  equippedOwner: Map<string, string>;
}

function makeFuzzScenario(seed: number): FuzzScenario {
  const rand = mulberry32(seed);
  const artifacts = Array.from({ length: 25 }, (_, i) => fuzzArtifact(rand, i));
  const charCount = 4 + Math.floor(rand() * 3);
  const unassigned = [...artifacts];
  const equippedOwner = new Map<string, string>();
  const characters: CharacterData[] = [];
  const tierAssignments: TierAssignment = {};
  const scores: Record<string, ArtifactScoreResult | null> = {};

  for (let c = 0; c < charCount; c++) {
    const key = `char-${c}`;
    const tier: Tier = c === 0 ? "S" : c === 1 || rand() < 0.5 ? "A" : "S";
    const equips: Partial<Record<Slot, ArtifactData>> = {};
    for (const slot of allSlots) {
      if (rand() >= 0.5) continue;
      const options = unassigned.filter((a) => a.slotKey === slot);
      if (options.length === 0) continue;
      const pick = options[Math.floor(rand() * options.length)];
      equips[slot] = pick;
      unassigned.splice(unassigned.indexOf(pick), 1);
      equippedOwner.set(pick.id, key);
    }
    characters.push({
      key,
      level: 90,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
      artifacts: equips,
    });
    tierAssignments[key] = { tier, position: c };
    scores[key] = createArtifactScoreResult({
      buildMatch: {
        build: makeFuzzBuild(key, rand() < 0.75 ? "SetA" : "SetB"),
        statWeights: { ...FUZZ_STAT_WEIGHTS },
      },
    });
  }

  const protectedArtifactIds = artifacts
    .filter(() => rand() < 0.12)
    .map((a) => a.id);

  return {
    accountData: { characters, extraArtifacts: unassigned, extraWeapons: [] },
    scores,
    tierAssignments,
    protectedArtifactIds,
    equippedOwner,
  };
}

function asCandidates(
  equipped: Partial<Record<Slot, ArtifactData>>
): Record<Slot, CandidateArtifact> {
  const out = {} as Record<Slot, CandidateArtifact>;
  for (const slot of allSlots) {
    const art = equipped[slot];
    if (!art) continue;
    out[slot] = { ...art, source: "current", sourceArtifactId: art.id };
  }
  return out;
}

function requireContext(
  ctx: AllocationContext | null,
  label: string
): AllocationContext {
  if (!ctx) throw new Error(`expected allocation context for ${label}`);
  return ctx;
}

describe("runTierWaterfall seeded fuzz", () => {
  const FUZZ_OPTIONS = {
    topK: 2,
    pricingRounds: 1,
    maxColumnsPerCharacter: 3,
    beamWidth: 4,
    repairSweeps: 1,
  };

  it("allocated builds are pairwise disjoint and protected artifacts never go to non-owners", () => {
    let totalAllocated = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const scenario = makeFuzzScenario(seed * 7919 + 17);
      const protectedSet = new Set(scenario.protectedArtifactIds);

      const result = runTierWaterfall(
        scenario.accountData,
        scenario.scores,
        scenario.tierAssignments,
        {},
        {
          ...FUZZ_OPTIONS,
          protectedArtifactIds: scenario.protectedArtifactIds,
        }
      );

      const claimedBy = new Map<string, string>();
      for (const [charKey, allocated] of Object.entries(result.perCharacter)) {
        if (!allocated.build) continue;
        totalAllocated++;
        for (const slot of allSlots) {
          const art = allocated.build.artifacts[slot];
          expect(
            claimedBy.get(art.id),
            `seed ${seed}: artifact ${art.id} claimed by both ${claimedBy.get(art.id)} and ${charKey}`
          ).toBeUndefined();
          claimedBy.set(art.id, charKey);

          if (protectedSet.has(art.id)) {
            expect(
              scenario.equippedOwner.get(art.id),
              `seed ${seed}: protected artifact ${art.id} allocated to non-owner ${charKey}`
            ).toBe(charKey);
          }
        }
      }

      const unclaimedIds = new Set(
        result.unclaimedAfterWaterfall.map((a) => a.id)
      );
      for (const id of claimedBy.keys()) {
        expect(
          unclaimedIds.has(id),
          `seed ${seed}: allocated artifact ${id} still reported unclaimed`
        ).toBe(false);
      }
    }
    // Guard against a vacuous pass: the scenarios must produce real builds.
    expect(totalAllocated).toBeGreaterThan(15);
  });
});

describe("runTierWaterfall ordering invariants", () => {
  it("gives a contested BiS set to the S character even when the A character would gain more", () => {
    const bisArtifacts = allSlots.map((slot) => artifact(slot, `bis-${slot}`));
    const accountData: AccountData = {
      characters: [
        {
          key: "s_char",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {},
        },
        {
          key: "a_char",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: {},
        },
      ],
      extraArtifacts: bisArtifacts,
      extraWeapons: [],
    };
    const tierAssignments: TierAssignment = {
      s_char: { tier: "S", position: 0 },
      a_char: { tier: "A", position: 0 },
    };
    const scores = {
      s_char: createArtifactScoreResult({
        buildMatch: {
          build: makeFuzzBuild("s_char", "Main"),
          statWeights: { cr: 50, cd: 50 },
        },
      }),
      a_char: createArtifactScoreResult({
        buildMatch: {
          build: makeFuzzBuild("a_char", "Main"),
          statWeights: { cr: 100, cd: 100, "atk%": 100 },
        },
      }),
    };

    const result = runTierWaterfall(accountData, scores, tierAssignments);

    const sBuild = result.perCharacter.s_char.build;
    expect(sBuild).not.toBeNull();
    expect(
      allSlots
        .map((slot) => sBuild?.artifacts[slot]?.id)
        .slice()
        .sort()
    ).toEqual(bisArtifacts.map((a) => a.id).sort());
    expect(result.perCharacter.a_char.build).toBeNull();

    // The A character's own weights value the contested set strictly higher
    // than what the S character actually scored — tier order still wins.
    const aCtx = requireContext(result.perCharacter.a_char.context, "a_char");
    const aWouldBe = scoreFullBuild(
      asCandidates(Object.fromEntries(bisArtifacts.map((a) => [a.slotKey, a]))),
      aCtx.config.weights,
      aCtx.config.targetMainStatWeights,
      aCtx.config.crBudget
    );
    expect(aWouldBe.finalScore).toBeGreaterThan(sBuild?.finalScore ?? 0);
  });

  it("never allocates below the equipped build score when the equipped set stays unclaimed", () => {
    const alphaEquips = Object.fromEntries(
      allSlots.map((slot) => {
        const mains: Record<Slot, MainStat> = {
          flower: "hp",
          plume: "atk",
          sands: "atk%",
          goblet: "atk%",
          circlet: "cr",
        };
        return [
          slot,
          {
            id: `alpha-${slot}`,
            setKey: "SetA",
            slotKey: slot,
            level: 20,
            rarity: 5,
            mainStatKey: mains[slot],
            lock: false,
            substats: { cr: 7.0, cd: 14.0 },
          } satisfies ArtifactData,
        ];
      })
    ) as Record<Slot, ArtifactData>;

    const betaEquips = Object.fromEntries(
      allSlots.map((slot) => {
        const mains: Record<Slot, MainStat> = {
          flower: "hp",
          plume: "atk",
          sands: "hp%",
          goblet: "hp%",
          circlet: "hp%",
        };
        return [
          slot,
          {
            id: `beta-${slot}`,
            setKey: "SetB",
            slotKey: slot,
            level: 20,
            rarity: 5,
            mainStatKey: mains[slot],
            lock: false,
            substats: { em: 30, "hp%": 10.0 },
          } satisfies ArtifactData,
        ];
      })
    ) as Record<Slot, ArtifactData>;

    const extras: ArtifactData[] = allSlots.flatMap((slot) => [
      { ...alphaEquips[slot], id: `spare-a-${slot}`, substats: { cr: 3.1 } },
      { ...betaEquips[slot], id: `spare-b-${slot}`, substats: { em: 10 } },
    ]);

    const accountData: AccountData = {
      characters: [
        {
          key: "alpha",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: alphaEquips,
        },
        {
          key: "beta",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts: betaEquips,
        },
      ],
      extraArtifacts: extras,
      extraWeapons: [],
    };
    const tierAssignments: TierAssignment = {
      alpha: { tier: "S", position: 0 },
      beta: { tier: "A", position: 0 },
    };
    const betaBuild: Build = {
      ...makeFuzzBuild("beta", "SetB"),
      substats: [
        { stat: "em", weight: 100 },
        { stat: "hp%", weight: 100 },
      ],
      sandsWeights: [{ stat: "hp%", weight: 100 }],
      gobletWeights: [{ stat: "hp%", weight: 100 }],
      circletWeights: [{ stat: "hp%", weight: 100 }],
    };
    const scores = {
      alpha: createArtifactScoreResult({
        buildMatch: {
          build: makeFuzzBuild("alpha", "SetA"),
          statWeights: { cr: 100, cd: 100, "atk%": 75 },
        },
      }),
      beta: createArtifactScoreResult({
        buildMatch: {
          build: betaBuild,
          statWeights: { em: 100, "hp%": 100 },
        },
      }),
    };

    const result = runTierWaterfall(accountData, scores, tierAssignments);

    // Precondition: neither character claimed the other's equipped set.
    const alphaIds = new Set(
      allSlots.map(
        (slot) => result.perCharacter.alpha.build?.artifacts[slot]?.id
      )
    );
    for (const slot of allSlots) {
      expect(alphaIds.has(betaEquips[slot].id)).toBe(false);
    }

    for (const key of ["alpha", "beta"] as const) {
      const allocated = result.perCharacter[key];
      expect(allocated.build, `${key} should be allocated`).not.toBeNull();
      const ctx = requireContext(allocated.context, key);
      const equippedScore = scoreFullBuild(
        asCandidates(allocated.equipped),
        ctx.config.weights,
        ctx.config.targetMainStatWeights,
        ctx.config.crBudget
      ).finalScore;
      expect(
        allocated.build?.finalScore ?? Number.NEGATIVE_INFINITY,
        `${key} allocated below its own equipped build`
      ).toBeGreaterThanOrEqual(equippedScore - 1e-9);
    }
  });
});
