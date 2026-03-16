import type {
  AccountData,
  ArtifactData,
  Build,
  CharacterData,
  WeightedMainStat,
  WeightedSubStat,
} from "@/data/types";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/defaults";
import { runTriage } from "@/lib/account-data/triage/triageEngine";
import type { TriageSettings } from "@/lib/account-data/triage/types";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  levelProtection: 0, // disable for cleaner tests
  equippedProtection: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

  it("marks unmatched artifacts as TD (no demand)", () => {
    const art = makeArt({ setKey: "unrelated_set" });
    const account = makeAccount([], [art]);
    const builds = [{ characterId: "char_a", builds: [makeBuild()] }];
    const { decisions } = runTriage(account, builds, {
      ...SETTINGS,
      ownedOnly: false,
      setSlotKeep: 0,
    });
    expect(decisions[0].decidingResult?.ruleId).toBe("TD");
    expect(decisions[0].label).toBe("unlock");
  });

  it("TD artifacts get supplyDemand with demand=0", () => {
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
    expect(["P", "Q"]).toContain(decisions[0].decidingResult?.tier);
  });

  it("poor substats artifact gets TF (substats don't match)", () => {
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
    expect(decisions[0].decidingResult?.ruleId).toBe("TF");
  });

  it("SP1: ER hoarding locks 4L support set with ER substat", () => {
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
    expect(decisions[0].specialRules).toContain("SP1");
  });

  it("SP5: double crit locks 4L artifact with cr+cd", () => {
    const art = makeArt({
      substats: { cr: 1, cd: 1, "hp%": 1, def: 1 },
    });
    const account = makeAccount([{ key: "char_a", artifacts: {} }], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, doubleCritLockEnabled: true }
    );
    expect(decisions[0].specialRules).toContain("SP5");
  });

  it("SP3: level protection tags high-level artifacts", () => {
    const art = makeArt({ level: 16 });
    const account = makeAccount([], [art]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, ownedOnly: false, levelProtection: 12 }
    );
    expect(decisions[0].specialRules).toContain("SP3");
  });

  it("SP4: equipped protection tags equipped artifacts", () => {
    const art = makeArt({});
    const account = makeAccount([
      { key: "char_a", artifacts: { flower: art } },
    ]);
    const { decisions } = runTriage(
      account,
      [{ characterId: "char_a", builds: [makeBuild()] }],
      { ...SETTINGS, equippedProtection: true }
    );
    expect(decisions[0].specialRules).toContain("SP4");
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
    // All matching P/Q artifacts for same embryo should be locked (demand=1, but P always locks)
    const locked = decisions.filter((d) => d.label === "lock");
    expect(locked.length).toBeGreaterThan(0);
    for (const d of locked) {
      expect(["TP", "TQ"]).toContain(d.decidingResult?.ruleId);
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
});
