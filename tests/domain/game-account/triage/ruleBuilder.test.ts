import { describe, expect, it } from "vitest";
import { DEFAULT_GLOBAL_STAT_WEIGHTS } from "@/domain/build/artifact/scoring/constants";
import { DEFAULT_TRIAGE_SETTINGS } from "@/domain/game-account/triage/constants";
import { extractRules } from "@/domain/game-account/triage/ruleBuilder";
import { runTriage } from "@/domain/game-account/triage/triageEngine";
import type { TriageSettings } from "@/domain/game-account/triage/types";
import type {
  AccountData,
  ArtifactData,
  Build,
  WeightedMainStat,
  WeightedSubStat,
} from "@/domain/models";

function makeBuild(opts: {
  id?: string;
  visible?: boolean;
  composition?: "4pc" | "2pc+2pc";
  artifactSet?: string;
  halfSet1?: string;
  halfSet2?: string;
  minCons?: number;
  substats?: WeightedSubStat[];
  circletWeights?: WeightedMainStat[];
  sandsWeights?: WeightedMainStat[];
  gobletWeights?: WeightedMainStat[];
}): Build {
  return {
    id: opts.id ?? "b1",
    characterId: "test_char",
    name: "Test Build",
    visible: opts.visible ?? true,
    composition: opts.composition ?? "4pc",
    artifactSet: opts.artifactSet ?? "test_set",
    halfSet1: opts.halfSet1,
    halfSet2: opts.halfSet2,
    minCons: opts.minCons,
    substats: opts.substats ?? [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 80 },
    ],
    circletWeights: opts.circletWeights ?? [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
    ],
    sandsWeights: opts.sandsWeights ?? [{ stat: "atk%", weight: 100 }],
    gobletWeights: opts.gobletWeights ?? [{ stat: "pyro%", weight: 100 }],
    normalizer: 1,
  } as Build;
}

const EMPTY_ACCOUNT: AccountData = {
  characters: [],
  extraArtifacts: [],
} as unknown as AccountData;

const ACCOUNT_WITH_CHAR: AccountData = {
  characters: [{ key: "test_char", constellation: 0, artifacts: {} }],
  extraArtifacts: [],
} as unknown as AccountData;

const SETTINGS: TriageSettings = { ...DEFAULT_TRIAGE_SETTINGS };

describe("extractRules", () => {
  it("generates rules for all 5 slots", () => {
    const build = makeBuild({});
    const rules = extractRules(
      [{ characterId: "test_char", builds: [build] }],
      ACCOUNT_WITH_CHAR,
      SETTINGS
    );
    const slots = new Set(rules.map((r) => r.slot));
    expect(slots).toEqual(
      new Set(["flower", "plume", "sands", "goblet", "circlet"])
    );
  });

  it("respects mainStatThreshold", () => {
    const build = makeBuild({
      circletWeights: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 50 },
      ],
    });
    const rules = extractRules(
      [{ characterId: "test_char", builds: [build] }],
      ACCOUNT_WITH_CHAR,
      { ...SETTINGS, mainStatThreshold: 90 }
    );
    const circletMains = rules
      .filter((r) => r.slot === "circlet")
      .map((r) => r.mainStat);
    expect(circletMains).toContain("cr");
    expect(circletMains).not.toContain("cd");
  });

  it("skips hidden builds", () => {
    const build = makeBuild({ visible: false });
    const rules = extractRules(
      [{ characterId: "test_char", builds: [build] }],
      ACCOUNT_WITH_CHAR,
      SETTINGS
    );
    expect(rules).toHaveLength(0);
  });

  it("skips unowned characters when ownedOnly is true", () => {
    const build = makeBuild({});
    const rules = extractRules(
      [{ characterId: "test_char", builds: [build] }],
      EMPTY_ACCOUNT, // no characters
      { ...SETTINGS, ownedOnly: true }
    );
    expect(rules).toHaveLength(0);
  });

  it("includes unowned characters when ownedOnly is false", () => {
    const build = makeBuild({});
    const rules = extractRules(
      [{ characterId: "test_char", builds: [build] }],
      EMPTY_ACCOUNT,
      { ...SETTINGS, ownedOnly: false }
    );
    expect(rules.length).toBeGreaterThan(0);
  });

  it("selects one build per artifact set based on constellation", () => {
    const b0 = makeBuild({ id: "c0", minCons: 0, artifactSet: "set_a" });
    const b2 = makeBuild({ id: "c2", minCons: 2, artifactSet: "set_a" });
    const account = {
      characters: [{ key: "test_char", constellation: 3, artifacts: {} }],
      extraArtifacts: [],
    } as unknown as AccountData;

    const rules = extractRules(
      [{ characterId: "test_char", builds: [b0, b2] }],
      account,
      SETTINGS
    );
    // Should pick b2 (minCons=2 <= constellation=3, highest match)
    expect(rules.every((r) => r.buildId === "c2")).toBe(true);
  });

  it("uses multiple builds from different sets", () => {
    const b1 = makeBuild({ id: "build_a", artifactSet: "set_a" });
    const b2 = makeBuild({ id: "build_b", artifactSet: "set_b" });
    const rules = extractRules(
      [{ characterId: "test_char", builds: [b1, b2] }],
      ACCOUNT_WITH_CHAR,
      SETTINGS
    );
    const buildIds = new Set(rules.map((r) => r.buildId));
    expect(buildIds).toEqual(new Set(["build_a", "build_b"]));
  });

  it("classifies substats by optionalSubThreshold", () => {
    const build = makeBuild({
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
        { stat: "atk%", weight: 30 }, // below threshold
      ],
    });
    const rules = extractRules(
      [{ characterId: "test_char", builds: [build] }],
      ACCOUNT_WITH_CHAR,
      { ...SETTINGS, optionalSubThreshold: 50 }
    );
    const rule = rules[0];
    expect(rule.desired).toContain("cr");
    expect(rule.desired).toContain("cd");
    expect(rule.desired).not.toContain("atk%");
    expect(rule.optional).toContain("atk%");
  });

  it("derives fillers from desired %stats", () => {
    const build = makeBuild({
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
        { stat: "atk%", weight: 100 },
      ],
      sandsWeights: [{ stat: "atk%", weight: 100 }],
    });
    const rules = extractRules(
      [{ characterId: "test_char", builds: [build] }],
      ACCOUNT_WITH_CHAR,
      SETTINGS
    );
    // Sands atk% main → atk filler excluded (atk% is main).
    // On flower: atk% desired → atk filler should be excluded (plume has fixed atk)
    const flowerRule = rules.find((r) => r.slot === "flower");
    expect(flowerRule).toBeDefined();
    // flower has fixed flat hp, so hp filler from hp% is excluded
    // atk is NOT fixed flat on flower, so atk filler from atk% should be present
    expect(flowerRule!.fillers).toContain("atk");
  });
});

describe("pure scaling-stat builds", () => {
  it.each([
    ["hp%", "hp"],
    ["atk%", "atk"],
    ["def%", "def"],
  ] as const)(
    "pursues %s through %s when the main consumes it",
    (pct, flat) => {
      const build = makeBuild({
        substats: [{ stat: pct, weight: 100 }],
        sandsWeights: [{ stat: pct, weight: 100 }],
      });
      const rules = extractRules(
        [{ characterId: "test_char", builds: [build] }],
        ACCOUNT_WITH_CHAR,
        SETTINGS
      );
      expect(rules.find((rule) => rule.slot === "sands")).toMatchObject({
        desired: [flat],
        fillers: [],
        tierEntry: { desiredSubstatCount: 1 },
      });
      expect(rules.find((rule) => rule.slot === "flower")?.desired).toEqual([
        pct,
      ]);
    }
  );

  it("preserves other positive build weights below the desired-stat threshold", () => {
    const build = makeBuild({
      substats: [
        { stat: "hp%", weight: 100 },
        { stat: "er", weight: 25 },
      ],
      sandsWeights: [{ stat: "hp%", weight: 100 }],
    });
    const rules = extractRules(
      [{ characterId: "test_char", builds: [build] }],
      ACCOUNT_WITH_CHAR,
      SETTINGS
    );
    expect(rules.find((rule) => rule.slot === "sands")).toMatchObject({
      desired: ["hp%"],
      optional: ["er"],
      fillers: ["hp"],
      soleFlatTarget: undefined,
    });
  });

  it("fills limited Instructor HP sands demand in flat HP order, respecting a zero flat HP weight", () => {
    const build = makeBuild({
      artifactSet: "instructor",
      substats: [{ stat: "hp%", weight: 100 }],
      sandsWeights: [{ stat: "hp%", weight: 100 }],
    });
    const groups = [{ characterId: "nilou", builds: [build] }];
    const settings: TriageSettings = {
      ...SETTINGS,
      triageMode: "strict",
      ownedOnly: false,
      highLevelProtection: false,
      setSlotKeep: 0,
      fillerKeep: 2,
      qualityMargin: 5,
    };
    const base: ArtifactData = {
      id: "no-flat-hp",
      setKey: "instructor",
      slotKey: "sands",
      mainStatKey: "hp%",
      substats: { er: 4.14, cr: 2.49 },
      rarity: 4,
      level: 0,
      lock: true,
    };
    const account: AccountData = {
      characters: [],
      extraWeapons: [],
      extraArtifacts: [
        base,
        { ...base, id: "one-roll", substats: { hp: 192, er: 4.14 }, level: 0 },
        {
          ...base,
          id: "two-rolls",
          substats: { hp: 382, er: 4.14, def: 13, atk: 11 },
          level: 8,
        },
        {
          ...base,
          id: "three-rolls",
          substats: { hp: 573, def: 13, atk: 11, cr: 2.49 },
          level: 12,
        },
        {
          ...base,
          id: "upgrades-in-flat-atk",
          substats: { hp: 191, def: 13, atk: 61, cr: 2.49 },
          level: 16,
        },
      ],
    };
    const { decisions } = runTriage(account, groups, settings);
    expect(
      decisions.map((d) => [d.artifact.id, d.label, d.decidingResult?.tier])
    ).toEqual([
      ["no-flat-hp", "unlock", "fodder"],
      ["one-roll", "unlock", "filler"],
      ["two-rolls", "lock", "filler"],
      ["three-rolls", "lock", "filler"],
      ["upgrades-in-flat-atk", "unlock", "filler"],
    ]);
    const unweighted = runTriage(account, groups, settings, groups, {
      ...DEFAULT_GLOBAL_STAT_WEIGHTS,
      flatHp: 0,
    });
    expect(
      unweighted.decisions.every(
        (d) => d.label === "unlock" && d.decidingResult?.tier === "fodder"
      )
    ).toBe(true);
  });
});
