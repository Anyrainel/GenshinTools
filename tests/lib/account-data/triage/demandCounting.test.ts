import { describe, expect, it } from "vitest";
import { artifactHalfSetsById } from "@/data/gameResources";
import type { AccountData, ArtifactData, Build } from "@/data/types";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { countDemand } from "@/lib/account-data/triage/demandCounting";
import {
  extractRules,
  selectActiveBuildGroups,
} from "@/lib/account-data/triage/ruleBuilder";
import { runTriage } from "@/lib/account-data/triage/triageEngine";

const base = {
  id: "base",
  characterId: "a",
  name: "Test",
  visible: true,
  composition: "4pc",
  artifactSet: "test_set",
  minCons: 0,
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
  ],
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "pyro%", weight: 100 }],
  circletWeights: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
  ],
  normalizer: 1,
} as Build;
const settings = { ...DEFAULT_TRIAGE_SETTINGS };
function fixture(builds: Build[]) {
  const groups = builds.map((build, i) => ({
    characterId: `char_${i}`,
    builds: [build],
  }));
  const account = {
    characters: groups.map((group) => ({
      key: group.characterId,
      constellation: 0,
      artifacts: {},
    })),
    extraArtifacts: [],
  } as unknown as AccountData;
  return { groups, account, rules: extractRules(groups, account, settings) };
}
const halfIds = Object.keys(artifactHalfSetsById).filter(
  (id) => artifactHalfSetsById[id].setIds.length > 1
);
const [halfA, halfB, halfC] = halfIds;

describe("fractional triage demand", () => {
  it("splits only accepted, unique main stats and rounds after summing characters", () => {
    const build = {
      ...base,
      circletWeights: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
        { stat: "cr", weight: 100 },
        { stat: "heal%", weight: 30 },
      ],
    } as Build;
    const { rules } = fixture([build, build, build]);
    expect(rules.filter((r) => r.slot === "circlet")).toHaveLength(6);
    expect(
      rules
        .filter((r) => r.slot === "circlet")
        .every((r) => r.demandWeight === 0.5)
    ).toBe(true);
    expect(
      [...countDemand(rules).values()]
        .filter((r) => r.slot === "circlet")
        .map((r) => r.demand)
    ).toEqual([2, 2]);
    expect(
      [...countDemand(rules).values()].find((r) => r.slot === "flower")?.demand
    ).toBe(3);
  });

  it("multiplies main-stat fractions by the half-set discount", () => {
    const build = {
      ...base,
      composition: "2pc+2pc",
      halfSet1: halfA,
      halfSet2: halfB,
    } as Build;
    const four = fixture(Array(4).fill(build));
    expect(
      four.rules
        .filter((r) => r.slot === "circlet")
        .every((r) => r.demandWeight === 0.25)
    ).toBe(true);
    expect(
      [...countDemand(four.rules).values()]
        .filter((r) => r.slot === "circlet")
        .map((r) => r.demand)
    ).toEqual([1, 1, 1, 1]);
    const five = fixture(Array(5).fill(build));
    expect(
      [...countDemand(five.rules).values()]
        .filter((r) => r.slot === "circlet")
        .every((r) => r.demand === 2)
    ).toBe(true);
  });

  it("assigns full set demand when both halves use the same bonus", () => {
    const { rules } = fixture([
      {
        ...base,
        composition: "2pc+2pc",
        halfSet1: halfA,
        halfSet2: halfA,
      } as Build,
    ]);
    expect(rules.filter((r) => r.slot === "flower")).toHaveLength(1);
    expect(rules.find((r) => r.slot === "flower")?.demandWeight).toBe(1);
    expect(
      rules.filter((r) => r.slot === "circlet").map((r) => r.demandWeight)
    ).toEqual([0.5, 0.5]);
  });

  it("deduplicates a character's shared half-set alternatives using its largest contribution", () => {
    const builds = [
      {
        ...base,
        id: "ab",
        composition: "2pc+2pc",
        halfSet1: halfA,
        halfSet2: halfB,
      },
      {
        ...base,
        id: "ac",
        composition: "2pc+2pc",
        halfSet1: halfA,
        halfSet2: halfC,
      },
      {
        ...base,
        id: "aa",
        composition: "2pc+2pc",
        halfSet1: halfA,
        halfSet2: halfA,
      },
    ] as Build[];
    const groups = ["a", "b"].map((characterId) => ({ characterId, builds }));
    const account = {
      characters: groups.map((g) => ({
        key: g.characterId,
        constellation: 0,
        artifacts: {},
      })),
      extraArtifacts: [],
    } as unknown as AccountData;
    const counts = countDemand(extractRules(groups, account, settings));
    const aCirclets = [...counts.values()].filter(
      (r) =>
        r.slot === "circlet" &&
        r.source.type === "2pc" &&
        r.source.halfSetId === halfA
    );
    expect(aCirclets.map((r) => r.demand)).toEqual([1, 1]);
    expect(counts.get(`2pc:${halfA}:flower:hp:cd,cr`)?.demand).toBe(2);
  });

  it("does not round an exact integer up due to floating-point fractions", () => {
    const { rules } = fixture(
      Array(9).fill({
        ...base,
        circletWeights: [
          { stat: "cr", weight: 100 },
          { stat: "cd", weight: 100 },
          { stat: "heal%", weight: 100 },
        ],
      })
    );
    expect(
      [...countDemand(rules).values()]
        .filter((r) => r.slot === "circlet")
        .map((r) => r.demand)
    ).toEqual([3, 3, 3]);
  });

  it("uses the same rounded demand for decisions and statistics, retaining empty supply groups", () => {
    const { groups, account } = fixture([base, base]);
    const artifact = {
      id: "circlet",
      setKey: "test_set",
      slotKey: "circlet",
      mainStatKey: "cr",
      rarity: 5,
      level: 0,
      lock: false,
      substats: {},
    } as ArtifactData;
    const result = runTriage(
      { ...account, extraArtifacts: [artifact] },
      groups,
      settings
    );
    expect(result.decisions[0].supplyDemand?.demand).toBe(1);
    const set = result.statistics.sets.find(
      (row) => row.key === "4pc:test_set"
    )!;
    expect(set.slots.circlet).toEqual({
      demand: 2,
      gap: 2,
      supplyByTier: { prime: 0, solid: 0, filler: 1, fodder: 0 },
    });
    expect(set.slots.sands).toEqual({
      demand: 2,
      gap: 2,
      supplyByTier: { prime: 0, solid: 0, filler: 0, fodder: 0 },
    });
    expect(set.demand).toBe(10);
    expect(result.statistics.totalDemand).toBe(10);
    expect(result.statistics.totalSupply).toBe(1);
    expect(result.statistics.totalBuilds).toBe(2);
  });

  it("ranks selected build counts and preserves ownership, disabled-build, and constellation selection", () => {
    const groups: { characterId: string; builds: Build[] }[] = [
      {
        characterId: "a",
        builds: [
          base,
          { ...base, id: "c2", minCons: 2 },
          { ...base, id: "off", visible: false, artifactSet: "off" },
        ],
      },
      {
        characterId: "b",
        builds: [base, { ...base, id: "other", artifactSet: "other" }],
      },
      { characterId: "unowned", builds: [base] },
    ];
    const account = {
      characters: [
        { key: "a", constellation: 2, artifacts: {} },
        { key: "b", constellation: 0, artifacts: {} },
      ],
      extraArtifacts: [],
    } as unknown as AccountData;
    expect(
      selectActiveBuildGroups(groups, account, settings)[0].builds.map(
        (b) => b.id
      )
    ).toEqual(["c2"]);
    const { statistics } = runTriage(account, groups, settings);
    expect(statistics.characters).toEqual([
      { characterId: "b", totalBuildCount: 2, activeBuildCount: 2 },
      { characterId: "a", totalBuildCount: 3, activeBuildCount: 1 },
      { characterId: "unowned", totalBuildCount: 1, activeBuildCount: 0 },
    ]);
    expect(statistics.sets[0].demand).toBeGreaterThanOrEqual(
      statistics.sets[1].demand
    );
    expect(statistics.totalBuilds).toBe(6);
    expect(statistics.totalActiveBuilds).toBe(3);
  });

  it("shows half-set demand once and assigns supply only to its shared pool", () => {
    const build = {
      ...base,
      composition: "2pc+2pc",
      halfSet1: halfA,
      halfSet2: halfB,
    } as Build;
    const { groups, account } = fixture([build]);
    const setKey = artifactHalfSetsById[halfA].setIds[0];
    const art = {
      id: "a",
      rarity: 5,
      setKey,
      slotKey: "flower",
      mainStatKey: "hp",
      level: 0,
      substats: {},
    } as ArtifactData;
    const result = runTriage(
      { ...account, extraArtifacts: [art] },
      groups,
      settings
    );
    expect(
      result.statistics.sets.find((row) => row.key === `2pc:${halfA}`)
        ?.supplyByTier.fodder
    ).toBe(1);
    expect(
      result.statistics.sets.find((row) => row.key === `4pc:${setKey}`)
    ).toBeUndefined();
    expect(result.statistics.totalSupply).toBe(1);
    expect(
      result.statistics.sets.filter((row) => row.source.type === "2pc")
    ).toHaveLength(2);
  });
});
