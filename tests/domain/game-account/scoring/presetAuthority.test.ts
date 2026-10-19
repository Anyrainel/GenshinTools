import {
  buildToWeightMap,
  calculateStatScore,
  getTargetMainStatWeightsForSlot,
  scaleFlatWeights,
  scoreSlotWithMainStatWeights,
  scoreWithBuilds,
} from "@/domain/build/artifact/scoring/artifactScore";
import {
  DEFAULT_GLOBAL_STAT_WEIGHTS,
  MAIN_STAT_CD_EQUIV_5STAR,
} from "@/domain/build/artifact/scoring/constants";
import { allSlots, type MainStat, type Slot } from "@/domain/enums";
import {
  collectEvalBuilds,
  evaluateAllBuilds,
  getEvalMainStatWeights,
} from "@/domain/game-account/buildEvaluation";
import {
  computeSuggestionPUpgrade,
  generateResourceSuggestions,
  suggestionCacheKey,
} from "@/domain/game-account/resourceTips";
import type { AccountData, ArtifactData, Build } from "@/domain/models";

const config = DEFAULT_GLOBAL_STAT_WEIGHTS;
const set = "fragment_of_harmonic_whimsy";
function build(overrides: Partial<Build> = {}): Build {
  return {
    id: "authority",
    characterId: "arlecchino",
    name: "",
    visible: true,
    roles: ["dps"],
    styles: ["on-field"],
    composition: "4pc",
    artifactSet: set,
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 100 },
      { stat: "atk", weight: 0 },
    ],
    sandsWeights: [
      { stat: "atk%", weight: 100 },
      { stat: "em", weight: 50 },
    ],
    gobletWeights: [{ stat: "pyro%", weight: 100 }],
    circletWeights: [{ stat: "cd", weight: 100 }],
    normalizer: 1,
    ...overrides,
  };
}
function art(
  slotKey: Slot,
  mainStatKey: MainStat,
  overrides: Partial<ArtifactData> = {}
): ArtifactData {
  return {
    id: `${slotKey}-${mainStatKey}`,
    slotKey,
    mainStatKey,
    setKey: set,
    rarity: 5,
    level: 20,
    lock: false,
    substats: {},
    ...overrides,
  };
}
const empty: AccountData = {
  characters: [],
  extraArtifacts: [],
  extraWeapons: [],
};
const groups = (b: Build) => [{ characterId: "arlecchino", builds: [b] }];
const evaluate = (b: Build, arts: ArtifactData[] = []) =>
  evaluateAllBuilds(
    groups(b),
    { ...empty, extraArtifacts: arts },
    config,
    true
  )[0].evaluations[0];
const thresholds = { S: 1, A: 1, B: 1, C: 1, D: 1, Pool: 1 };
const min = {
  craft: { ...thresholds, Pool: 0 },
  reroll: { ...thresholds, Pool: 0 },
  levelup: { ...thresholds, Pool: -100 },
};

it.each([0, 30, 100])(
  "applies global %s%% once, independently of explicit flat overrides",
  (conversion) => {
    const global = {
      flatAtk: conversion,
      flatHp: conversion,
      flatDef: conversion,
    };
    for (const flat of [0, 80, 100]) {
      const b = build({
        substats: [
          { stat: "atk%", weight: 100 },
          { stat: "hp%", weight: 75 },
          { stat: "def%", weight: 50 },
          { stat: "atk", weight: flat },
          { stat: "hp", weight: flat },
          { stat: "def", weight: flat },
        ],
      });
      const weights = buildToWeightMap(b, global);
      expect(weights.atk).toBe(conversion);
      expect(weights.hp).toBe(conversion * 0.75);
      expect(weights.def).toBe(conversion * 0.5);
      expect(scaleFlatWeights(weights, global)).toEqual(weights);
      const raw = collectEvalBuilds(groups(b), false)[0].weights;
      expect(scaleFlatWeights(raw, global)).toEqual(weights);
    }
  }
);

it("keeps the configured crit weight and cdEquiv when expanding to the other crit main", () => {
  const b = build({
    circletWeights: [{ stat: "cd", weight: 75, cdEquiv: 50 }],
  });
  const mains = getTargetMainStatWeightsForSlot("circlet", b);
  expect(mains.get("cd")).toBeCloseTo((75 * 50) / MAIN_STAT_CD_EQUIV_5STAR);
  expect(mains.get("cr")).toBe(mains.get("cd"));
});

it("scores a flat-ATK artifact at 30% in both account scoring and completion, never 0%, 9% or 100%", () => {
  const b = build();
  const flower = art("flower", "hp", { substats: { atk: 100 } });
  const expected = calculateStatScore("atk", 100, { atk: 30 }).score;
  const ev = evaluate(b, [flower]);
  const scored = scoreWithBuilds(
    {
      key: "arlecchino",
      level: 90,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
      artifacts: { flower },
    },
    [b],
    config
  )!;
  expect(ev.slots.flower.score).toBeCloseTo(expected, 8);
  expect(scored.substatScore.subScore).toBeCloseTo(expected, 8);
});

it("empty cup and circlet preferences give zero main credit while keeping ER substat value", () => {
  const b = build({
    substats: [{ stat: "er", weight: 100 }],
    sandsWeights: [{ stat: "er", weight: 100 }],
    gobletWeights: [],
    circletWeights: [],
  });
  const arts = [
    art("goblet", "atk%", { substats: { er: 20 } }),
    art("circlet", "cr", { substats: { er: 20 } }),
  ];
  const ev = evaluate(b, arts);
  expect(ev.slots.goblet.artifact?.id).toBe(arts[0].id);
  expect(ev.slots.circlet.artifact?.id).toBe(arts[1].id);
  const score = scoreWithBuilds(
    {
      key: "arlecchino",
      level: 90,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
      artifacts: { goblet: arts[0], circlet: arts[1] },
    },
    [b],
    config
  )!;
  expect(score.normalized.rawMainStatScore).toBe(0);
  expect(ev.totalScore).toBeCloseTo(score.substatScore.subScore);
  expect(score.normalized.idealScore).toBeGreaterThan(0);
});

it.each(["4pc", "2pc+2pc"] as const)(
  "matches exhaustive total-score search for %s, instead of greedily choosing substats",
  (composition) => {
    const b = build({ composition, halfSet1: "atk%-18", halfSet2: "atk%-18" });
    const mains: MainStat[] = ["hp", "atk", "atk%", "pyro%", "cd"];
    const sets =
      composition === "4pc"
        ? [set, "gladiators_finale"]
        : ["gladiators_finale", "shimenawas_reminiscence"];
    const arts = allSlots.flatMap((slot, i) =>
      sets.map((setKey, index) =>
        art(slot, mains[i], {
          id: `${slot}-${index}`,
          setKey,
          substats: { cd: index * 3 },
        })
      )
    );
    arts.push(
      art("sands", "em", {
        id: "substat-trap",
        setKey: sets[0],
        substats: { cd: 10 },
      })
    );
    const ev = evaluate(b, arts);
    const weights = buildToWeightMap(b, config);
    let best = -Infinity;
    function visit(index: number, chosen: ArtifactData[]) {
      if (index === allSlots.length) {
        const counts = sets.map(
          (id) => chosen.filter((a) => a.setKey === id).length
        );
        if (composition === "4pc" ? counts[0] < 4 : counts.some((n) => n < 2))
          return;
        best = Math.max(
          best,
          chosen.reduce(
            (sum, a) =>
              sum +
              scoreSlotWithMainStatWeights(
                a,
                weights,
                getTargetMainStatWeightsForSlot(a.slotKey, b)
              ),
            0
          )
        );
        return;
      }
      for (const a of arts.filter((a) => a.slotKey === allSlots[index]))
        visit(index + 1, [...chosen, a]);
    }
    visit(0, []);
    expect(ev.totalScore).toBeCloseTo(best, 8);
    expect(ev.slots.sands.artifact?.id).not.toBe("substat-trap");
  }
);

it("uses main-stat weights for resource expectations and exact improvement probabilities", () => {
  const suggestions = [100, 50].map((weight) => {
    const b = build({ sandsWeights: [{ stat: "atk%", weight }] });
    const evaluation = evaluate(b);
    return generateResourceSuggestions(
      [{ artifactSet: set, evaluations: [evaluation], worstCompleteness: 0 }],
      empty,
      {},
      thresholds,
      min,
      config
    ).find((s) => s.kind === "craft" && s.slot === "sands")!;
  });
  const [full, half] = suggestions;
  expect(full.expectedScoreGain - half.expectedScoreGain).toBeCloseTo(
    MAIN_STAT_CD_EQUIV_5STAR / 2,
    1
  );
  const fullP = computeSuggestionPUpgrade(
    { ...full, baselineScore: 80 },
    config
  );
  const halfP = computeSuggestionPUpgrade(
    { ...half, baselineScore: 80 },
    config
  );
  expect(fullP).toBeGreaterThan(halfP);
  expect(suggestionCacheKey(full, "global")).not.toBe(
    suggestionCacheKey(half, "global")
  );
  expect(getEvalMainStatWeights("sands", half.evalBuild).get("atk%")).toBe(50);
});

it.each(["reroll", "levelup"] as const)(
  "uses the same main credit in %s expectations and probabilities",
  (kind) => {
    const source = art("sands", "atk%", {
      level: kind === "reroll" ? 20 : 0,
      totalRolls: 8,
      substats: { cr: 3.5, cd: 7, atk: 14, def: 19 },
    });
    const account = { ...empty, extraArtifacts: [source] };
    const low = { S: -100, A: -100, B: -100, C: -100, D: -100, Pool: -100 };
    const pair = [100, 50].map((weight) => {
      const b = build({ sandsWeights: [{ stat: "atk%", weight }] });
      const ev = evaluate(b, [source]);
      return generateResourceSuggestions(
        [
          {
            artifactSet: set,
            evaluations: [ev],
            worstCompleteness: ev.completeness,
          },
        ],
        account,
        {},
        thresholds,
        { craft: low, reroll: low, levelup: low },
        config
      ).find((s) => s.kind === kind && s.slot === "sands")!;
    });
    expect(pair[0]).toBeDefined();
    expect(pair[1]).toBeDefined();
    const after = pair.map((s) => s.expectedScoreGain + s.baselineScore);
    expect(after[0] - after[1]).toBeCloseTo(MAIN_STAT_CD_EQUIV_5STAR / 2, 1);
    expect(
      computeSuggestionPUpgrade({ ...pair[0], baselineScore: 80 }, config)
    ).toBeGreaterThan(
      computeSuggestionPUpgrade({ ...pair[1], baselineScore: 80 }, config)
    );
  }
);

it("can suggest cup/head resources for an ER-only build with empty main preferences", () => {
  const b = build({
    substats: [{ stat: "er", weight: 100 }],
    gobletWeights: [],
    circletWeights: [],
  });
  const source = art("circlet", "heal%", {
    level: 0,
    substats: { er: 6.5, atk: 14, def: 19, hp: 209 },
  });
  const account = { ...empty, extraArtifacts: [source] };
  const ev = evaluate(b, [source]);
  const suggestions = generateResourceSuggestions(
    [
      {
        artifactSet: set,
        evaluations: [ev],
        worstCompleteness: ev.completeness,
      },
    ],
    account,
    {},
    thresholds,
    min,
    config
  );
  expect(
    suggestions.some((s) => s.slot === "goblet" && s.kind === "craft")
  ).toBe(true);
  const upgrade = suggestions.find(
    (s) => s.kind === "levelup" && s.sourceArtifact?.id === source.id
  )!;
  expect(upgrade).toBeDefined();
  expect(upgrade.expectedScoreGain).toBeGreaterThan(0);
  expect(getEvalMainStatWeights("circlet", upgrade.evalBuild).size).toBe(0);
});
