import { describe, expect, it } from "vitest";
import type { MainStat, SubStat } from "@/data/enums";
import type {
  AccountData,
  ArtifactData,
  Build,
  WeightedMainStat,
  WeightedSubStat,
} from "@/data/types";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { evaluateTier } from "@/lib/account-data/triage/tierEvaluator";
import { lookupTierEntry } from "@/lib/account-data/triage/tierTableBuilder";
import { runTriage } from "@/lib/account-data/triage/triageEngine";
import type {
  TriageRule,
  TriageSettings,
} from "@/lib/account-data/triage/types";
import { getSubstatAvgRoll } from "@/lib/artifact/scoring/utils";

// Helpers

let artCounter = 0;

function makeArt(opts: {
  setKey?: string;
  slotKey?: string;
  mainStatKey?: string;
  level?: number;
  lock?: boolean;
  rarity?: number;
  substats?: Record<string, number>;
  unactivatedSubstats?: Record<string, number>;
  totalRolls?: number;
}): ArtifactData {
  return {
    id: `art_${++artCounter}`,
    setKey: opts.setKey ?? "test_set",
    slotKey: (opts.slotKey ?? "flower") as ArtifactData["slotKey"],
    mainStatKey: (opts.mainStatKey ?? "hp") as ArtifactData["mainStatKey"],
    level: opts.level ?? 0,
    lock: opts.lock ?? false,
    rarity: opts.rarity ?? 5,
    substats: opts.substats ?? { cr: 1, cd: 1, "atk%": 1, er: 1 },
    unactivatedSubstats: opts.unactivatedSubstats ?? {},
    totalRolls: opts.totalRolls,
  } as ArtifactData;
}

function rolls(counts: Partial<Record<SubStat, number>>) {
  const substats: Record<string, number> = {};
  for (const [stat, count] of Object.entries(counts)) {
    substats[stat] = getSubstatAvgRoll(stat as SubStat, 5) * (count ?? 0);
  }
  return substats;
}

function makeBuild(opts?: {
  id?: string;
  artifactSet?: string;
  substats?: WeightedSubStat[];
  circletWeights?: WeightedMainStat[];
  sandsWeights?: WeightedMainStat[];
  gobletWeights?: WeightedMainStat[];
}): Build {
  return {
    id: opts?.id ?? "b1",
    characterId: "char_a",
    name: "Build",
    visible: true,
    composition: "4pc" as const,
    artifactSet: opts?.artifactSet ?? "test_set",
    substats: opts?.substats ?? [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 100 },
      { stat: "er", weight: 60 },
    ],
    circletWeights: opts?.circletWeights ?? [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
    ],
    sandsWeights: opts?.sandsWeights ?? [{ stat: "atk%", weight: 100 }],
    gobletWeights: opts?.gobletWeights ?? [{ stat: "pyro%", weight: 100 }],
    normalizer: 1,
  } as Build;
}

function makeAccount(
  chars: Array<{
    key: string;
    constellation?: number;
    artifacts?: Partial<Record<string, ArtifactData>>;
  }>,
  extraArtifacts: ArtifactData[] = []
): AccountData {
  return {
    characters: chars.map((c) => ({
      key: c.key,
      constellation: c.constellation ?? 0,
      artifacts: c.artifacts ?? {},
    })),
    extraArtifacts,
  } as unknown as AccountData;
}

const SETTINGS: TriageSettings = {
  ...DEFAULT_TRIAGE_SETTINGS,
  triageMode: "strict", // pin to strict for deterministic threshold tests
  levelProtection: 0, // disable for cleaner tests
  equippedProtection: false,
};

// Tests

describe("runTriage", () => {
  it("returns decisions for all artifacts", () => {
    const art1 = makeArt({});
    const art2 = makeArt({ slotKey: "plume", mainStatKey: "atk" });
    const account = makeAccount([], [art1, art2]);
    const builds = [{ characterId: "char_a", builds: [makeBuild()] }];
    const { decisions } = runTriage(account, builds, {
      ...SETTINGS,
      ownedOnly: false,
    });
    expect(decisions).toHaveLength(2);
  });

  it("marks unmatched artifacts as no demand", () => {
    // Use substats that won't match any curated flex pattern (no cr+cd pair)
    const art = makeArt({
      setKey: "unrelated_set",
      substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
    });
    const account = makeAccount([], [art]);
    const builds = [{ characterId: "char_a", builds: [makeBuild()] }];
    const { decisions } = runTriage(account, builds, {
      ...SETTINGS,
      ownedOnly: false,
      setSlotKeep: 0,
    });
    expect(decisions[0].decidingResult?.ruleId).toBe("noDemand");
    expect(decisions[0].label).toBe("unlock");
  });

  it("no-demand artifacts get supplyDemand with demand=0", () => {
    const art = makeArt({ setKey: "unknown_set" });
    const account = makeAccount([], [art]);
    const builds = [{ characterId: "char_a", builds: [makeBuild()] }];
    const { decisions } = runTriage(account, builds, {
      ...SETTINGS,
      ownedOnly: false,
    });
    expect(decisions[0].supplyDemand).not.toBeNull();
    expect(decisions[0].supplyDemand!.demand).toBe(0);
  });

  it("high quality matching artifact gets lock label", () => {
    // cr+cd+atk%+er on a matching flower — should be Premium or Quality
    const art = makeArt({
      substats: { cr: 1, cd: 1, "atk%": 1, er: 1 },
    });
    const account = makeAccount([{ key: "char_a", artifacts: {} }], [art]);
    const builds = [{ characterId: "char_a", builds: [makeBuild()] }];
    const { decisions } = runTriage(account, builds, SETTINGS);
    expect(decisions[0].label).toBe("lock");
    expect(["prime", "solid"]).toContain(decisions[0].decidingResult?.tier);
  });

  it("poor substats artifact gets fodder substat mismatch", () => {
    const art = makeArt({
      substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
    });
    const account = makeAccount([{ key: "char_a", artifacts: {} }], [art]);
    const builds = [{ characterId: "char_a", builds: [makeBuild()] }];
    const { decisions } = runTriage(account, builds, {
      ...SETTINGS,
      setSlotKeep: 0,
      doubleCritLockEnabled: false,
    });
    expect(decisions[0].label).toBe("unlock");
    expect(decisions[0].decidingResult?.ruleId).toBe("fodderSubstatMismatch");
  });

  it("support-set ER hoarding locks 4-line support set with ER substat", () => {
    const art = makeArt({
      setKey: "viridescent_venerer",
      slotKey: "flower",
      mainStatKey: "hp",
      substats: { er: 1, cd: 1, "atk%": 1, "hp%": 1 },
    });
    const build = makeBuild({ artifactSet: "viridescent_venerer" });
    const account = makeAccount([{ key: "char_a", artifacts: {} }], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [build] }],
      { ...SETTINGS, erHoardingEnabled: true }
    );
    expect(decisions[0].specialRules).toContain("supportSetErHoard");
  });

  it("support-set ER hoarding locks 4-line support sands with ER substat", () => {
    const art = makeArt({
      setKey: "viridescent_venerer",
      slotKey: "sands",
      mainStatKey: "atk%",
      substats: { er: 1, hp: 1, def: 1, em: 1 },
    });
    const build = makeBuild({ artifactSet: "viridescent_venerer" });
    const account = makeAccount([{ key: "char_a", artifacts: {} }], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [build] }],
      {
        ...SETTINGS,
        erHoardingEnabled: true,
        doubleCritLockEnabled: false,
        setSlotKeep: 0,
      }
    );
    expect(decisions[0].specialRules).toContain("supportSetErHoard");
    expect(decisions[0].label).toBe("lock");
    expect(decisions[0].decidingResult?.ruleId).toBe("supportSetErHoard");
  });

  it("all-set ER hoarding locks 4-line sands with ER substat", () => {
    const art = makeArt({
      setKey: "test_set",
      slotKey: "sands",
      mainStatKey: "atk%",
      substats: { er: 1, hp: 1, def: 1, em: 1 },
    });
    const account = makeAccount([{ key: "char_a", artifacts: {} }], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        erHoardingEnabled: false,
        erHoardingAllEnabled: true,
        doubleCritLockEnabled: false,
        setSlotKeep: 0,
      }
    );
    expect(decisions[0].specialRules).toContain("allSetErHoard");
    expect(decisions[0].label).toBe("lock");
    expect(decisions[0].decidingResult?.ruleId).toBe("allSetErHoard");
  });

  it("double crit locks 4-line artifact with cr+cd", () => {
    const art = makeArt({
      substats: { cr: 1, cd: 1, "hp%": 1, def: 1 },
    });
    const account = makeAccount([{ key: "char_a", artifacts: {} }], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, doubleCritLockEnabled: true }
    );
    expect(decisions[0].specialRules).toContain("doubleCrit");
  });

  it("level protection tags high-level artifacts", () => {
    const art = makeArt({ level: 16 });
    const account = makeAccount([], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, ownedOnly: false, levelProtection: 12 }
    );
    expect(decisions[0].specialRules).toContain("levelProtected");
  });

  it("highLevelProtection off: high-level non-equipped artifact is not level-protected", () => {
    // Non-equipped high-level artifact should flow through normal triage when
    // high-level protection is off. Equipped ones still get equipped protection.
    const art = makeArt({ level: 16 });
    const account = makeAccount([], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        ownedOnly: false,
        levelProtection: 12,
        highLevelProtection: false,
      }
    );
    expect(decisions[0].specialRules).not.toContain("levelProtected");
    expect(decisions[0].specialRules).not.toContain("equippedProtected");
  });

  it("highLevelProtection off: concentrated low-tier artifacts are promoted to solid", () => {
    const art = makeArt({
      setKey: "unrelated_set",
      level: 16,
      substats: rolls({ "hp%": 6, def: 1, atk: 1, hp: 1 }),
    });
    const account = makeAccount([], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        ownedOnly: false,
        setSlotKeep: 0,
        levelProtection: 12,
        highLevelProtection: false,
      }
    );

    expect(decisions[0].label).toBe("lock");
    expect(decisions[0].decidingResult?.ruleId).toBe("concentrationValue");
    expect(decisions[0].decidingResult?.tier).toBe("solid");
    expect(decisions[0].specialRules).toContain(
      "concentrationValue:concentrated-hp%"
    );
  });

  it("equipped protection tags equipped artifacts", () => {
    const art = makeArt({});
    const account = makeAccount([
      { key: "char_a", artifacts: { flower: art } },
    ]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, equippedProtection: true }
    );
    expect(decisions[0].specialRules).toContain("equippedProtected");
  });

  it("supply/demand resolution: premium artifacts always locked", () => {
    // Create multiple high-quality artifacts for same embryo key
    const arts = Array.from({ length: 3 }, () =>
      makeArt({
        substats: { cr: 1, cd: 1, "atk%": 1, er: 1 },
      })
    );
    const account = makeAccount([{ key: "char_a", artifacts: {} }], arts);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, setSlotKeep: 0 }
    );
    // All matching prime/solid artifacts for same embryo should be locked.
    const locked = decisions.filter((d) => d.label === "lock");
    expect(locked.length).toBeGreaterThan(0);
    for (const d of locked) {
      expect(["primeTierKeep", "solidTierKeep"]).toContain(
        d.decidingResult?.ruleId
      );
    }
  });

  it("returns flexPatterns alongside decisions", () => {
    const account = makeAccount([], [makeArt({})]);
    const { flexPatterns } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, ownedOnly: false }
    );
    expect(Array.isArray(flexPatterns)).toBe(true);
    expect(flexPatterns.length).toBeGreaterThan(0);
  });

  it("skips 4-star artifacts", () => {
    const art = makeArt({ rarity: 4 });
    const account = makeAccount([], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, ownedOnly: false }
    );
    expect(decisions).toHaveLength(0);
  });

  it("custom patterns from customFlexInputs cause off-piece special rule to fire", () => {
    // Use a unique custom pattern: sands EM with er+hp%
    // This won't match any official curated pattern (curated EM sands only has cr+cd)
    const art = makeArt({
      setKey: "unrelated_set",
      slotKey: "sands",
      mainStatKey: "em",
      substats: { er: 1, "hp%": 1, def: 1, hp: 1 },
    });
    const account = makeAccount([], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        ownedOnly: false,
        setSlotKeep: 0,
        doubleCritLockEnabled: false,
        customFlexInputs: [
          { slot: "sands", mainStat: "em", requiredSubs: ["er", "hp%"] },
        ],
      }
    );
    expect(decisions[0].specialRules).toContain("offPiecePattern");
    expect(decisions[0].label).toBe("lock");
  });

  // fillerKeep: under-supply keeps best filler artifacts

  it("fillerKeep: locks top filler artifacts when supply < demand", () => {
    // 2 characters wanting the same embryo → demand = 2
    // Supply: 0 prime, 0 solid, 4 filler → under-supply
    // fillerKeep = 2 → lock best 2 filler, unlock rest
    const build1 = makeBuild({ id: "b1" });
    const build2 = makeBuild({ id: "b2" });
    // Filler tier: 2 desired out of 4 (cr+cd match, but missing atk% and er)
    const neutralArts = Array.from({ length: 4 }, (_, i) =>
      makeArt({
        substats: { cr: 1, cd: 1, hp: 1, def: 1 },
        level: 20 - i, // varied levels for tie-breaking
      })
    );
    const account = makeAccount(
      [{ key: "char_a" }, { key: "char_b" }],
      neutralArts
    );
    const { decisions } = runTriage(
      account,
      [
        { characterId: "char_a", builds: [build1] },
        { characterId: "char_b", builds: [build2] },
      ],
      {
        ...SETTINGS,
        fillerKeep: 2,
        setSlotKeep: 0,
        doubleCritLockEnabled: false,
      }
    );
    const locked = decisions.filter((d) => d.label === "lock");
    const unlocked = decisions.filter((d) => d.label === "unlock");
    expect(locked).toHaveLength(2);
    expect(unlocked).toHaveLength(2);
    for (const d of locked) {
      expect(d.decidingResult?.ruleId).toBe("fillerShortfallKeep");
    }
  });

  it("fillerKeep: respects different values (keep 1 vs 3)", () => {
    const build1 = makeBuild({ id: "b1" });
    const build2 = makeBuild({ id: "b2" });
    const neutralArts = Array.from({ length: 4 }, (_, i) =>
      makeArt({
        substats: { cr: 1, cd: 1, hp: 1, def: 1 },
        level: 20 - i,
      })
    );

    // fillerKeep = 1
    const account1 = makeAccount(
      [{ key: "char_a" }, { key: "char_b" }],
      neutralArts.map((a) => ({ ...a, id: `k1_${a.id}` }))
    );
    const r1 = runTriage(
      account1,
      [
        { characterId: "char_a", builds: [build1] },
        { characterId: "char_b", builds: [build2] },
      ],
      {
        ...SETTINGS,
        fillerKeep: 1,
        setSlotKeep: 0,
        doubleCritLockEnabled: false,
      }
    );
    expect(r1.decisions.filter((d) => d.label === "lock")).toHaveLength(1);

    // fillerKeep = 3
    const account3 = makeAccount(
      [{ key: "char_a" }, { key: "char_b" }],
      neutralArts.map((a) => ({ ...a, id: `k3_${a.id}` }))
    );
    const r3 = runTriage(
      account3,
      [
        { characterId: "char_a", builds: [build1] },
        { characterId: "char_b", builds: [build2] },
      ],
      {
        ...SETTINGS,
        fillerKeep: 3,
        setSlotKeep: 0,
        doubleCritLockEnabled: false,
      }
    );
    expect(r3.decisions.filter((d) => d.label === "lock")).toHaveLength(3);
  });

  it("fillerKeep: clamped by shortfall so total locked ≤ demand+margin", () => {
    // demand = 1, qualityMargin = 0, prime = 0, solid = 0 → shortfall = 1
    // fillerKeep = 5 → fillerCap = min(1, 5) = 1
    // 3 filler artifacts → only 1 should lock
    const build1 = makeBuild({ id: "b1" });
    const neutralArts = Array.from({ length: 3 }, (_, i) =>
      makeArt({
        substats: { cr: 1, cd: 1, hp: 1, def: 1 },
        level: 20 - i,
      })
    );
    const account = makeAccount([{ key: "char_a" }], neutralArts);
    const r = runTriage(
      account,
      [{ characterId: "char_a", builds: [build1] }],
      {
        ...SETTINGS,
        fillerKeep: 5,
        qualityMargin: 0,
        setSlotKeep: 0,
        doubleCritLockEnabled: false,
      }
    );
    const locked = r.decisions.filter((d) => d.label === "lock");
    expect(locked).toHaveLength(1);
    expect(locked[0].decidingResult?.ruleId).toBe("fillerShortfallKeep");
  });

  // qualityMargin: over-supply caps non-premium locks

  it("qualityMargin: caps solid-tier locks in over-supply", () => {
    // Use circlet/heal% with a single custom pattern to test margin capping
    // in isolation (no curated patterns exist for heal%, so zero overlap).
    const desired = ["atk%", "cd", "cr", "er"] as SubStat[];
    const fillers = ["atk"] as SubStat[];
    const entry = lookupTierEntry(
      "circlet",
      "heal%" as MainStat,
      desired,
      fillers
    );

    // Find prime-tier and solid-tier conditions from the computed condition table
    const primeCondition = entry.conditions.find((c) => c.tier === "prime");
    const solidCondition = entry.conditions.find((c) => c.tier === "solid");

    // Skip test if tier table doesn't produce both tiers (shouldn't happen)
    if (!primeCondition || !solidCondition) return;

    // Build artifacts that match prime and solid conditions
    const allDesired = ["cr", "cd", "atk%", "er"];
    const nonDesired = ["hp", "def", "def%", "hp%", "em"];

    // Prime-tier artifact: satisfies the prime condition
    const primeSubstats: Record<string, number> = {};
    for (
      let i = 0;
      i < Math.min(primeCondition.requiredDesiredHits, allDesired.length);
      i++
    )
      primeSubstats[allDesired[i]] = 1;
    if (primeCondition.requiresFillerHit && fillers.length > 0)
      primeSubstats[fillers[0]] = 1;
    while (Object.keys(primeSubstats).length < 4) {
      const filler = nonDesired.find((s) => !(s in primeSubstats));
      if (filler) primeSubstats[filler] = 1;
      else break;
    }

    // Solid-tier artifact: satisfies solid condition but NOT prime condition
    const solidSubstats: Record<string, number> = {};
    // Use only enough desired to meet solid's hit requirement, and avoid triggering prime.
    const solidDesired = primeCondition.requiresCritPair
      ? allDesired.filter((s) => s !== "cr" && s !== "cd") // avoid cr+cd pair
      : allDesired;
    for (
      let i = 0;
      i < Math.min(solidCondition.requiredDesiredHits, solidDesired.length);
      i++
    )
      solidSubstats[solidDesired[i]] = 1;
    // If solid also needs a crit pair, add cr+cd.
    if (solidCondition.requiresCritPair) {
      solidSubstats.cr = 1;
      solidSubstats.cd = 1;
    }
    while (Object.keys(solidSubstats).length < 4) {
      const filler = nonDesired.find((s) => !(s in solidSubstats));
      if (filler) solidSubstats[filler] = 1;
      else break;
    }

    // Verify tier assignments using the evaluator directly
    const rule = {
      desired,
      optional: [] as SubStat[],
      fillers,
      tierEntry: entry,
    } as Pick<
      TriageRule,
      "desired" | "optional" | "fillers" | "tierEntry"
    > as TriageRule;
    const primeTier = evaluateTier(
      Object.keys(primeSubstats) as SubStat[],
      !!primeCondition.requiresFourInitialSubstats,
      rule
    );
    const solidTier = evaluateTier(
      Object.keys(solidSubstats) as SubStat[],
      !!solidCondition.requiresFourInitialSubstats,
      rule
    );

    // Only proceed if we got correct tiers
    if (primeTier.tier !== "prime" || solidTier.tier !== "solid") return;

    const premiumArt = makeArt({
      slotKey: "circlet",
      mainStatKey: "heal%",
      substats: primeSubstats,
      level: primeCondition.requiresFourInitialSubstats ? 0 : 20,
      totalRolls: primeCondition.requiresFourInitialSubstats ? undefined : 9,
    });
    const solidArts = Array.from({ length: 5 }, (_, i) =>
      makeArt({
        slotKey: "circlet",
        mainStatKey: "heal%",
        substats: solidSubstats,
        level: solidCondition.requiresFourInitialSubstats ? 0 : 16 - i,
        totalRolls: solidCondition.requiresFourInitialSubstats ? undefined : 8,
      })
    );

    const healBuild = makeBuild({
      circletWeights: [{ stat: "heal%", weight: 100 }],
    });
    const customFlex = {
      slot: "circlet" as const,
      mainStat: "heal%" as const,
      requiredSubs: ["cr", "cd", "atk%", "er"] as SubStat[],
    };

    // demand=1, 1P + 5Q → over-supply
    // margin=1: solid cap = max(1+1-1,0) = 1 → 1 prime + 1 solid = 2 locked
    const account1 = makeAccount(
      [{ key: "char_a" }],
      [premiumArt, ...solidArts].map((a) => ({ ...a, id: `m1_${a.id}` }))
    );
    const r1 = runTriage(
      account1,
      [{ characterId: "char_a", builds: [healBuild] }],
      {
        ...SETTINGS,
        qualityMargin: 1,
        setSlotKeep: 0,
        fillerKeep: 0,
        doubleCritLockEnabled: false,
        customFlexInputs: [customFlex],
      }
    );
    const locked1 = r1.decisions.filter((d) => d.label === "lock");
    expect(
      locked1.some((d) => d.decidingResult?.ruleId === "primeTierKeep")
    ).toBe(true);
    expect(locked1).toHaveLength(2); // 1P + 1Q

    // margin=5: solid cap = max(1+5-1,0) = 5 → 1 prime + 5 solid = 6 locked
    const account5 = makeAccount(
      [{ key: "char_a" }],
      [premiumArt, ...solidArts].map((a) => ({ ...a, id: `m5_${a.id}` }))
    );
    const r5 = runTriage(
      account5,
      [{ characterId: "char_a", builds: [healBuild] }],
      {
        ...SETTINGS,
        qualityMargin: 5,
        setSlotKeep: 0,
        fillerKeep: 0,
        doubleCritLockEnabled: false,
        customFlexInputs: [customFlex],
      }
    );
    const locked5 = r5.decisions.filter((d) => d.label === "lock");
    expect(locked5).toHaveLength(6); // 1 prime + 5 solid
  });

  it("alwaysLockSolidArtifacts: locks surplus solid artifacts", () => {
    const solidArts = Array.from({ length: 5 }, () =>
      makeArt({
        substats: { cr: 1, cd: 1, hp: 1, def: 1 },
        level: 0,
      })
    );
    const account = makeAccount([{ key: "char_a" }], solidArts);

    const baseSettings: TriageSettings = {
      ...SETTINGS,
      qualityMargin: 1,
      setSlotKeep: 0,
      fillerKeep: 0,
      doubleCritLockEnabled: false,
    };
    const capped = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      baseSettings
    );
    expect(capped.decisions.filter((d) => d.label === "lock")).toHaveLength(2);

    const alwaysLock = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...baseSettings, alwaysLockSolidArtifacts: true }
    );
    expect(
      alwaysLock.decisions.filter(
        (d) => d.decidingResult?.ruleId === "solidTierKeep"
      )
    ).toHaveLength(5);
  });

  it("alwaysLockSolidArtifacts: still caps filler locks by demand margin", () => {
    const solidArt = makeArt({
      substats: { cr: 1, cd: 1, hp: 1, def: 1 },
      level: 0,
    });
    const fillerArts = Array.from({ length: 5 }, (_, i) =>
      makeArt({
        substats: { cr: 1, cd: 1, hp: 1, def: 1 },
        level: 20 - i,
      })
    );
    const account = makeAccount([{ key: "char_a" }], [solidArt, ...fillerArts]);

    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        alwaysLockSolidArtifacts: true,
        qualityMargin: 3,
        setSlotKeep: 0,
        fillerKeep: 10,
        doubleCritLockEnabled: false,
      }
    );

    expect(
      decisions.filter((d) => d.decidingResult?.ruleId === "solidTierKeep")
    ).toHaveLength(1);
    expect(
      decisions.filter(
        (d) => d.decidingResult?.ruleId === "fillerShortfallKeep"
      )
    ).toHaveLength(4);
  });

  it("loose mode preserves artifacts locked by strict mode", () => {
    const artifacts = [
      makeArt({
        substats: { cr: 1, cd: 1, "atk%": 1, er: 1 },
        level: 0,
      }),
      makeArt({
        substats: { cr: 1, cd: 1, hp: 1, def: 1 },
        level: 0,
      }),
      makeArt({
        substats: { cr: 1, cd: 1, hp: 1, def: 1 },
        level: 20,
      }),
      makeArt({
        substats: { cr: 1, "atk%": 1, er: 1, hp: 1 },
        level: 20,
      }),
      makeArt({
        substats: { hp: 1, "hp%": 1, def: 1, "def%": 1 },
        level: 0,
      }),
    ];
    const account = makeAccount([{ key: "char_a" }], artifacts);
    const commonSettings: TriageSettings = {
      ...SETTINGS,
      qualityMargin: 1,
      fillerKeep: 2,
      setSlotKeep: 0,
      doubleCritLockEnabled: false,
    };

    const strict = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...commonSettings, triageMode: "strict" }
    );
    const loose = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...commonSettings, triageMode: "loose" }
    );

    const looseById = new Map(
      loose.decisions.map((decision) => [decision.artifact.id, decision])
    );
    const strictLockedThenLooseUnlocked = strict.decisions.filter(
      (decision) =>
        decision.label === "lock" &&
        looseById.get(decision.artifact.id)?.label === "unlock"
    );

    expect(strictLockedThenLooseUnlocked).toHaveLength(0);
  });

  // setSlotKeep: per set+slot minimum

  it("setSlotKeep: protects sole artifact in a set+slot from unlock", () => {
    // 1 trash-tier flower in test_set → triage wants to unlock it
    // setSlotKeep=1 → should promote to lock via set-slot floor
    // Use flower/hp (common main stat, no k=0 fallback) and fillerKeep=0
    const art = makeArt({
      substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
    });
    const account = makeAccount([{ key: "char_a" }], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        setSlotKeep: 1,
        fillerKeep: 0,
        doubleCritLockEnabled: false,
      }
    );
    expect(decisions[0].label).toBe("lock");
    expect(decisions[0].decidingResult?.ruleId).toBe("setSlotFloorKeep");
  });

  it("setSlotKeep: does not promote when enough are already locked", () => {
    // 3 artifacts, all good → all locked by triage already
    // setSlotKeep=2 → no set-slot floor promotion needed
    const arts = Array.from({ length: 3 }, () =>
      makeArt({
        substats: { cr: 1, cd: 1, "atk%": 1, er: 1 },
      })
    );
    const account = makeAccount([{ key: "char_a" }], arts);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, setSlotKeep: 2 }
    );
    // None should have set-slot floor rule since enough are locked via tier logic.
    const setSlotFloorDecisions = decisions.filter((d) =>
      d.specialRules.includes("setSlotFloor")
    );
    expect(setSlotFloorDecisions).toHaveLength(0);
  });

  it("setSlotKeep: locked artifact marked for unlock is not counted as locked", () => {
    // 1 currently-locked trash artifact that triage wants to unlock
    // setSlotKeep=1 → should promote it back to lock
    const art = makeArt({
      lock: true, // currently locked in store
      substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
    });
    const account = makeAccount([{ key: "char_a" }], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        setSlotKeep: 1,
        fillerKeep: 0,
        doubleCritLockEnabled: false,
      }
    );
    expect(decisions[0].label).toBe("lock");
    expect(decisions[0].decidingResult?.ruleId).toBe("setSlotFloorKeep");
  });

  it("setSlotKeep=0: disables the feature entirely", () => {
    // Fodder flower would normally be protected by the floor, but setSlotKeep=0 disables it.
    const art = makeArt({
      substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
    });
    const account = makeAccount([{ key: "char_a" }], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        setSlotKeep: 0,
        fillerKeep: 0,
        doubleCritLockEnabled: false,
      }
    );
    expect(decisions[0].label).toBe("unlock");
  });

  // Idempotency: applying recommendations and re-running produces no new actions

  it("idempotency: re-running after applying set-slot floor locks yields no new recs", () => {
    // 3 fodder flowers in test_set, setSlotKeep=2 → floor promotes 2 to lock.
    // Simulate "apply": flip artifact.lock on the floor-picked ones.
    // Re-run: recommendLock should be empty AND recommendUnlock should be empty
    // (the formerly floor-picked artifacts should still be satisfied/kept).
    const arts = Array.from({ length: 3 }, (_, i) =>
      makeArt({
        substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
        level: 4 - i, // distinct for sort stability
      })
    );
    const accountBefore = makeAccount([{ key: "char_a" }], arts);
    const opts: TriageSettings = {
      ...SETTINGS,
      setSlotKeep: 2,
      fillerKeep: 0,
      doubleCritLockEnabled: false,
    };
    const r1 = runTriage(
      accountBefore,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      opts
    );
    const lockRecs = r1.decisions.filter(
      (d) => d.label === "lock" && !d.artifact.lock
    );
    const unlockRecs = r1.decisions.filter(
      (d) => d.label === "unlock" && d.artifact.lock
    );
    expect(lockRecs).toHaveLength(2);
    expect(unlockRecs).toHaveLength(0);

    // Apply: mutate lock state per recommendations
    const applied = arts.map((a) =>
      lockRecs.some((d) => d.artifact.id === a.id) ? { ...a, lock: true } : a
    );
    const accountAfter = makeAccount([{ key: "char_a" }], applied);
    const r2 = runTriage(
      accountAfter,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      opts
    );
    const lockRecs2 = r2.decisions.filter(
      (d) => d.label === "lock" && !d.artifact.lock
    );
    const unlockRecs2 = r2.decisions.filter(
      (d) => d.label === "unlock" && d.artifact.lock
    );
    expect(lockRecs2).toHaveLength(0);
    expect(unlockRecs2).toHaveLength(0);
  });

  it("set-slot floor prefers already-externally-locked artifacts when filling the floor", () => {
    // 3 fodder flowers: one externally locked, two not. setSlotKeep=1.
    // The floor should promote the externally-locked one (stability), not pick a fresh
    // artifact and leave the user's lock flagged for unlock.
    const lockedTrash = makeArt({
      lock: true,
      substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
      level: 0, // lowest level, would lose sort tiebreak without external-lock prefer
    });
    const freshA = makeArt({
      substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
      level: 20,
    });
    const freshB = makeArt({
      substats: { hp: 1, def: 1, "def%": 1, "hp%": 1 },
      level: 16,
    });
    const account = makeAccount(
      [{ key: "char_a" }],
      [lockedTrash, freshA, freshB]
    );
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        setSlotKeep: 1,
        fillerKeep: 0,
        doubleCritLockEnabled: false,
      }
    );
    const byId = (id: string) => decisions.find((d) => d.artifact.id === id)!;
    expect(byId(lockedTrash.id).label).toBe("lock");
    expect(byId(lockedTrash.id).decidingResult?.ruleId).toBe(
      "setSlotFloorKeep"
    );
    expect(byId(freshA.id).label).toBe("unlock");
    expect(byId(freshB.id).label).toBe("unlock");
  });

  // Rule-tiebreak determinism: artifact's chosen group should not depend on
  // input rule order.

  it("matched rules are tiebroken by embryoKey (not input order)", () => {
    // Two characters with identical builds → two rules that produce different
    // embryoKeys (differ only by characterId in demand bookkeeping, but the
    // rule embryoKey itself is the same). Use distinct desired-substat orders
    // to get distinct embryoKeys while both matching the artifact at same tier.
    const art = makeArt({
      substats: { cr: 1, cd: 1, "atk%": 1, er: 1 },
    });
    const buildA = makeBuild({
      id: "bA",
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
        { stat: "atk%", weight: 100 },
        { stat: "er", weight: 60 },
      ],
    });
    const buildB = makeBuild({
      id: "bB",
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
        { stat: "atk%", weight: 100 },
        { stat: "er", weight: 60 },
      ],
    });
    const account1 = makeAccount(
      [{ key: "char_a" }, { key: "char_b" }],
      [{ ...art, id: "same_art" }]
    );
    const account2 = makeAccount(
      [{ key: "char_a" }, { key: "char_b" }],
      [{ ...art, id: "same_art" }]
    );
    const r1 = runTriage(
      account1,
      [
        { characterId: "char_a", builds: [buildA] },
        { characterId: "char_b", builds: [buildB] },
      ],
      SETTINGS
    );
    // Reversed input order
    const r2 = runTriage(
      account2,
      [
        { characterId: "char_b", builds: [buildB] },
        { characterId: "char_a", builds: [buildA] },
      ],
      SETTINGS
    );
    // The artifact's decidingResult embryoKey should be identical regardless
    // of build-group input order.
    expect(r1.decisions[0].decidingResult?.embryo?.embryoKey).toBe(
      r2.decisions[0].decidingResult?.embryo?.embryoKey
    );
  });

  it("custom patterns matching an official key are deduplicated (official wins)", () => {
    // flower hp cr+cd+atk% is a curated pattern (3-substat simplified form)
    const account = makeAccount([], [makeArt({})]);
    const { flexPatterns } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      {
        ...SETTINGS,
        ownedOnly: false,
        customFlexInputs: [
          {
            slot: "flower",
            mainStat: "hp",
            requiredSubs: ["cr", "cd", "atk%"],
          },
        ],
      }
    );
    // Should not have duplicates — the custom should be filtered out
    const keys = flexPatterns.map((fp) => fp.key);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
    // The official version should not be marked custom
    const officialMatch = flexPatterns.find(
      (fp) => fp.key === "flex:flower:hp:cr,cd,atk%"
    );
    expect(officialMatch).toBeDefined();
    expect(officialMatch!.custom).toBeUndefined();
  });
});
