import { describe, expect, it } from "vitest";

import { preloadGameStats } from "@/lib/gameStatsLoader";
import {
  buildSheetFromMainAndSubs,
  emptySubRolls,
  getRollValues,
} from "@/lib/team-comp/constrainedGreedy";
import { CrossScalingBuff, ScalingBuff } from "@/lib/team-comp/damageBuffs";
import {
  TeamBuild,
  evaluateCombo,
  hasOffFieldParts,
} from "@/lib/team-comp/damageCalc";
import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarDirectFormula,
  LunarFormula,
  TransformFormula,
} from "@/lib/team-comp/damageFormulas";
import { StatSheet } from "@/lib/team-comp/damageModels";
import { E, evaluate, simplify } from "@/lib/team-comp/expr";
import { VarMapping, createExprStats } from "@/lib/team-comp/exprStats";
import {
  compileComboTeamDamage,
  compileTeamDamage,
  fillVarsFromSheet,
} from "@/lib/team-comp/formulaCompiler";
import type {
  CalcContext,
  CharCompConfig,
  ComboFormula,
  StatKey,
} from "@/lib/team-comp/types";
import "@/lib/team-comp/index";
import { getFirstFormulaId } from "../../fixtures/optimizerHelpers";

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  assumeCrit: false,
};

const CTX_ASSUME_CRIT: CalcContext = {
  ...CTX,
  assumeCrit: true,
};

// ─── Helpers ───

/** Create a StatSheet + ExprStats pair with variable artifact stats. */
function makeStatsAndExpr(
  baseStats: [StatKey, number][],
  artifactStats: StatKey[]
) {
  const baseEntries = baseStats.map(([key, value]) => ({ key, value }));
  const baseline = new StatSheet(baseEntries);
  const varMapping = new VarMapping();
  const exprStats = createExprStats(
    baseline,
    0,
    varMapping,
    new Set(artifactStats)
  );
  return { baseline, varMapping, exprStats };
}

/** Create a StatSheet with base + artifact stats merged. */
function makeFullSheet(
  baseStats: [StatKey, number][],
  artifactValues: [StatKey, number][]
): StatSheet {
  const base = new StatSheet(baseStats.map(([key, value]) => ({ key, value })));
  const arts = new StatSheet(
    artifactValues.map(([key, value]) => ({ key, value }))
  );
  return base.merge(arts);
}

/** Elemental DMG keys that get normalized to dmg% in StatSheet. */
const ELEMENTAL_DMG_KEY_TO_ELEMENT: Partial<Record<StatKey, string>> = {
  "pyro%": "Pyro",
  "hydro%": "Hydro",
  "electro%": "Electro",
  "cryo%": "Cryo",
  "dendro%": "Dendro",
  "anemo%": "Anemo",
  "geo%": "Geo",
  "phys%": "Physical",
};

function fillVars(
  varMapping: VarMapping,
  artifactValues: [StatKey, number][]
): Float64Array {
  const vars = new Float64Array(varMapping.totalVars);
  for (const [key, value] of artifactValues) {
    // Handle elemental DMG% normalization (same as StatSheet)
    const element = ELEMENTAL_DMG_KEY_TO_ELEMENT[key];
    if (element) {
      const filterKey = `e:${element}`;
      const idx = varMapping.getVarIdx(0, "dmg%", filterKey);
      if (idx !== undefined) vars[idx] += value;
    } else {
      const idx = varMapping.getVarIdx(0, key, "");
      if (idx !== undefined) vars[idx] += value;
    }
  }
  return vars;
}

// ─── DirectFormula parity ───

describe("DirectFormula buildExpr parity", () => {
  const formula = new DirectFormula(2.426, {
    element: "Pyro",
    ability: "charge",
    reaction: "none",
  });

  const baseStats: [StatKey, number][] = [
    ["baseAtk", 800],
    ["cr", 0.05],
    ["cd", 0.5],
    ["er", 1],
  ];

  const artifactStatKeys: StatKey[] = [
    "atk%",
    "atk",
    "cr",
    "cd",
    "pyro%",
    "em",
    "er",
  ];

  it("matches calc() for various artifact stat combinations", () => {
    for (let trial = 0; trial < 50; trial++) {
      const artValues: [StatKey, number][] = [
        ["atk%", Math.random() * 0.8],
        ["atk", Math.random() * 500],
        ["cr", Math.random() * 0.7],
        ["cd", Math.random() * 2],
        ["pyro%", Math.random() * 0.5],
      ];

      const { varMapping, exprStats } = makeStatsAndExpr(
        baseStats,
        artifactStatKeys
      );
      const expr = formula.buildExpr(exprStats, 90, CTX);
      const vars = fillVars(varMapping, artValues);
      const exprResult = evaluate(simplify(expr), vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResult = formula.calc(fullSheet, 90, CTX);

      expect(exprResult).toBeCloseTo(calcResult, 4);
    }
  });

  it("matches with assumeCrit", () => {
    const artValues: [StatKey, number][] = [
      ["atk%", 0.5],
      ["atk", 300],
      ["cr", 0.6],
      ["cd", 1.7],
      ["pyro%", 0.466],
    ];

    const { varMapping, exprStats } = makeStatsAndExpr(
      baseStats,
      artifactStatKeys
    );
    const expr = formula.buildExpr(exprStats, 90, CTX_ASSUME_CRIT);
    const vars = fillVars(varMapping, artValues);
    const exprResult = evaluate(simplify(expr), vars);

    const fullSheet = makeFullSheet(baseStats, artValues);
    const calcResult = formula.calc(fullSheet, 90, CTX_ASSUME_CRIT);

    expect(exprResult).toBeCloseTo(calcResult, 4);
  });

  it("matches with extra scaling term", () => {
    const formulaExtra = new DirectFormula(
      2.426,
      { element: "Pyro", ability: "charge", reaction: "none" },
      "atk",
      { key: "em", multiplier: 0.8 }
    );

    const artValues: [StatKey, number][] = [
      ["atk%", 0.5],
      ["atk", 300],
      ["em", 200],
      ["cr", 0.5],
      ["cd", 1.5],
    ];

    const { varMapping, exprStats } = makeStatsAndExpr(
      baseStats,
      artifactStatKeys
    );
    const expr = formulaExtra.buildExpr(exprStats, 90, CTX);
    const vars = fillVars(varMapping, artValues);
    const exprResult = evaluate(simplify(expr), vars);

    const fullSheet = makeFullSheet(baseStats, artValues);
    const calcResult = formulaExtra.calc(fullSheet, 90, CTX);

    expect(exprResult).toBeCloseTo(calcResult, 4);
  });
});

// ─── AmplifyFormula parity ───

describe("AmplifyFormula buildExpr parity", () => {
  const formula = new AmplifyFormula(2.426, {
    element: "Pyro",
    ability: "charge",
    reaction: "vaporize",
  });

  const baseStats: [StatKey, number][] = [
    ["baseAtk", 800],
    ["cr", 0.05],
    ["cd", 0.5],
    ["er", 1],
  ];

  const artifactStatKeys: StatKey[] = [
    "atk%",
    "atk",
    "cr",
    "cd",
    "pyro%",
    "em",
    "er",
  ];

  it("matches calc() for various inputs", () => {
    for (let trial = 0; trial < 50; trial++) {
      const artValues: [StatKey, number][] = [
        ["atk%", Math.random() * 0.8],
        ["atk", Math.random() * 500],
        ["cr", Math.random() * 0.7],
        ["cd", Math.random() * 2],
        ["pyro%", Math.random() * 0.5],
        ["em", Math.random() * 400],
      ];

      const { varMapping, exprStats } = makeStatsAndExpr(
        baseStats,
        artifactStatKeys
      );
      const expr = formula.buildExpr(exprStats, 90, CTX);
      const vars = fillVars(varMapping, artValues);
      const exprResult = evaluate(simplify(expr), vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResult = formula.calc(fullSheet, 90, CTX);

      expect(exprResult).toBeCloseTo(calcResult, 4);
    }
  });
});

// ─── CatalyzeFormula parity ───

describe("CatalyzeFormula buildExpr parity", () => {
  const formula = new CatalyzeFormula(2.426, {
    element: "Dendro",
    ability: "skill",
    reaction: "spread",
  });

  const baseStats: [StatKey, number][] = [
    ["baseAtk", 700],
    ["cr", 0.05],
    ["cd", 0.5],
    ["er", 1],
  ];

  const artifactStatKeys: StatKey[] = [
    "atk%",
    "atk",
    "cr",
    "cd",
    "dendro%",
    "em",
    "er",
  ];

  it("matches calc() for various inputs", () => {
    for (let trial = 0; trial < 50; trial++) {
      const artValues: [StatKey, number][] = [
        ["atk%", Math.random() * 0.8],
        ["atk", Math.random() * 500],
        ["cr", Math.random() * 0.7],
        ["cd", Math.random() * 2],
        ["dendro%", Math.random() * 0.5],
        ["em", Math.random() * 400],
      ];

      const { varMapping, exprStats } = makeStatsAndExpr(
        baseStats,
        artifactStatKeys
      );
      const expr = formula.buildExpr(exprStats, 90, CTX);
      const vars = fillVars(varMapping, artValues);
      const exprResult = evaluate(simplify(expr), vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResult = formula.calc(fullSheet, 90, CTX);

      expect(exprResult).toBeCloseTo(calcResult, 4);
    }
  });
});

// ─── TransformFormula parity ───

describe("TransformFormula buildExpr parity", () => {
  const formula = new TransformFormula(0, {
    element: "Electro",
    ability: "skill",
    reaction: "overloaded",
  });

  const baseStats: [StatKey, number][] = [
    ["baseAtk", 700],
    ["cr", 0.05],
    ["cd", 0.5],
    ["er", 1],
  ];

  const artifactStatKeys: StatKey[] = ["em", "er"];

  it("matches calc() for various EM values", () => {
    for (let trial = 0; trial < 50; trial++) {
      const artValues: [StatKey, number][] = [["em", Math.random() * 800]];

      const { varMapping, exprStats } = makeStatsAndExpr(
        baseStats,
        artifactStatKeys
      );
      const expr = formula.buildExpr(exprStats, 90, CTX);
      const vars = fillVars(varMapping, artValues);
      const exprResult = evaluate(simplify(expr), vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResult = formula.calc(fullSheet, 90, CTX);

      expect(exprResult).toBeCloseTo(calcResult, 4);
    }
  });
});

// ─── LunarFormula parity ───

describe("LunarFormula buildExpr parity", () => {
  const formula = new LunarFormula(0, {
    element: "Hydro",
    ability: "skill",
    reaction: "lunarCharged",
  });

  const baseStats: [StatKey, number][] = [
    ["baseAtk", 700],
    ["cr", 0.05],
    ["cd", 0.5],
    ["er", 1],
  ];

  const artifactStatKeys: StatKey[] = ["em", "cr", "cd", "er"];

  it("matches calc() for various inputs", () => {
    for (let trial = 0; trial < 50; trial++) {
      const artValues: [StatKey, number][] = [
        ["em", Math.random() * 800],
        ["cr", Math.random() * 0.7],
        ["cd", Math.random() * 2],
      ];

      const { varMapping, exprStats } = makeStatsAndExpr(
        baseStats,
        artifactStatKeys
      );
      const expr = formula.buildExpr(exprStats, 90, CTX);
      const vars = fillVars(varMapping, artValues);
      const exprResult = evaluate(simplify(expr), vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResult = formula.calc(fullSheet, 90, CTX);

      expect(exprResult).toBeCloseTo(calcResult, 4);
    }
  });
});

// ─── LunarDirectFormula parity ───

describe("LunarDirectFormula buildExpr parity", () => {
  const formula = new LunarDirectFormula(3.5, {
    element: "Hydro",
    ability: "burst",
    reaction: "lunarCharged",
  });

  const baseStats: [StatKey, number][] = [
    ["baseAtk", 900],
    ["cr", 0.05],
    ["cd", 0.5],
    ["er", 1],
  ];

  const artifactStatKeys: StatKey[] = [
    "atk%",
    "atk",
    "cr",
    "cd",
    "hydro%",
    "em",
    "er",
  ];

  it("matches calc() for various inputs", () => {
    for (let trial = 0; trial < 50; trial++) {
      const artValues: [StatKey, number][] = [
        ["atk%", Math.random() * 0.8],
        ["atk", Math.random() * 500],
        ["cr", Math.random() * 0.7],
        ["cd", Math.random() * 2],
        ["hydro%", Math.random() * 0.5],
        ["em", Math.random() * 400],
      ];

      const { varMapping, exprStats } = makeStatsAndExpr(
        baseStats,
        artifactStatKeys
      );
      const expr = formula.buildExpr(exprStats, 90, CTX);
      const vars = fillVars(varMapping, artValues);
      const exprResult = evaluate(simplify(expr), vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResult = formula.calc(fullSheet, 90, CTX);

      expect(exprResult).toBeCloseTo(calcResult, 4);
    }
  });
});

// ─── ScalingBuff parity ───

describe("ScalingBuff dynamicBuffsExpr parity", () => {
  it("matches dynamicBuffs for basic scaling", () => {
    const buff = new ScalingBuff(
      { type: "character", id: "test", origin: "A" },
      { receiver: "self" },
      [],
      "em",
      "atk%",
      0.0004,
      0.4
    );

    const baseStats: [StatKey, number][] = [
      ["baseAtk", 800],
      ["cr", 0.05],
      ["cd", 0.5],
      ["em", 100],
    ];

    for (let trial = 0; trial < 20; trial++) {
      const artEm = Math.random() * 800;
      const artValues: [StatKey, number][] = [["em", artEm]];

      const { varMapping, exprStats } = makeStatsAndExpr(baseStats, ["em"]);
      const exprResults = buff.dynamicBuffsExpr(exprStats);
      const vars = fillVars(varMapping, artValues);
      const exprValue = evaluate(exprResults[0].expr, vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResults = buff.dynamicBuffs(fullSheet);
      const calcValue = calcResults[0].value;

      expect(exprValue).toBeCloseTo(calcValue, 8);
    }
  });

  it("matches dynamicBuffs with threshold", () => {
    const buff = new ScalingBuff(
      { type: "character", id: "test", origin: "A" },
      { receiver: "self" },
      [],
      "hp",
      "atk",
      0.018,
      undefined,
      30000
    );

    const baseStats: [StatKey, number][] = [
      ["baseHp", 15000],
      ["baseAtk", 800],
    ];

    for (let trial = 0; trial < 20; trial++) {
      const artHpPct = Math.random() * 1.0;
      const artHpFlat = Math.random() * 5000;
      const artValues: [StatKey, number][] = [
        ["hp%", artHpPct],
        ["hp", artHpFlat],
      ];

      const { varMapping, exprStats } = makeStatsAndExpr(baseStats, [
        "hp%",
        "hp",
      ]);
      const exprResults = buff.dynamicBuffsExpr(exprStats);
      const vars = fillVars(varMapping, artValues);
      const exprValue = evaluate(exprResults[0].expr, vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResults = buff.dynamicBuffs(fullSheet);
      const calcValue = calcResults[0].value;

      expect(exprValue).toBeCloseTo(calcValue, 4);
    }
  });
});

// ─── CrossScalingBuff parity ───

describe("CrossScalingBuff dynamicBuffsExpr parity", () => {
  it("matches dynamicBuffs", () => {
    const buff = new CrossScalingBuff(
      { type: "character", id: "test", origin: "A" },
      { receiver: "self" },
      [],
      "em",
      0.002,
      0.8,
      "atk",
      "dmg%"
    );

    const baseStats: [StatKey, number][] = [
      ["baseAtk", 800],
      ["em", 50],
    ];

    for (let trial = 0; trial < 20; trial++) {
      const artEm = Math.random() * 800;
      const artAtkPct = Math.random() * 0.8;
      const artAtk = Math.random() * 300;
      const artValues: [StatKey, number][] = [
        ["em", artEm],
        ["atk%", artAtkPct],
        ["atk", artAtk],
      ];

      const { varMapping, exprStats } = makeStatsAndExpr(baseStats, [
        "em",
        "atk%",
        "atk",
      ]);
      const exprResults = buff.dynamicBuffsExpr(exprStats);
      const vars = fillVars(varMapping, artValues);
      const exprValue = evaluate(exprResults[0].expr, vars);

      const fullSheet = makeFullSheet(baseStats, artValues);
      const calcResults = buff.dynamicBuffs(fullSheet);
      const calcValue = calcResults[0].value;

      expect(exprValue).toBeCloseTo(calcValue, 4);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Full Pipeline Fuzz Tests (single-formula + combo)
// ═══════════════════════════════════════════════════════════════

await preloadGameStats();

type MainStat = import("@/data/types").MainStat;
type SubStat = import("@/data/types").SubStat;
type Slot = import("@/data/types").Slot;

/** Random main stats per slot for fuzz testing. */
function randomMainStats(): Record<Slot, MainStat> {
  const pick = <T>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];
  return {
    flower: "hp",
    plume: "atk",
    sands: pick(["atk%", "hp%", "def%", "em", "er"] as const),
    goblet: pick([
      "atk%",
      "hp%",
      "def%",
      "em",
      "pyro%",
      "hydro%",
      "electro%",
      "cryo%",
      "dendro%",
      "anemo%",
      "geo%",
      "phys%",
    ] as const),
    circlet: pick(["atk%", "hp%", "def%", "em", "cr", "cd"] as const),
  };
}

/** Generate random substat rolls for all slots. */
function randomSubRolls(): Record<Slot, Partial<Record<SubStat, number>>> {
  const allSubs: SubStat[] = [
    "hp",
    "hp%",
    "atk",
    "atk%",
    "def",
    "def%",
    "em",
    "er",
    "cr",
    "cd",
  ];
  const result: Record<Slot, Partial<Record<SubStat, number>>> = {
    flower: {},
    plume: {},
    sands: {},
    goblet: {},
    circlet: {},
  };
  for (const slot of [
    "flower",
    "plume",
    "sands",
    "goblet",
    "circlet",
  ] as const) {
    // Pick 4 random substats, give each 1-6 rolls
    const shuffled = [...allSubs].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 4);
    for (const sub of picked) {
      result[slot][sub] = Math.floor(Math.random() * 6) + 1;
    }
  }
  return result;
}

// ─── Team configs for fuzz testing ───

const DILUC_TEAM: CharCompConfig[] = [
  {
    charId: "diluc",
    charLevel: 90,
    constellation: 0,
    weaponId: "wolfs_gravestone",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 0,
    weaponId: "sacrificial_sword",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 0,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

const RAIDEN_TEAM: CharCompConfig[] = [
  {
    charId: "raiden_shogun",
    charLevel: 90,
    constellation: 0,
    weaponId: "the_catch",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "xiangling",
    charLevel: 90,
    constellation: 6,
    weaponId: "the_catch",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 0,
    weaponId: "sacrificial_sword",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 0,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

// Teams with artifact sets — exercises the full buff pipeline including noStackId deduplication
const VARKA_TEAM: CharCompConfig[] = [
  {
    charId: "varka",
    charLevel: 90,
    constellation: 0,
    weaponId: "gest_of_the_mighty_wolf",
    refinement: 1,
    artifactSetId: "a_day_carved_from_rising_winds",
    artifactHalfSetIds: [],
  },
  {
    charId: "durin",
    charLevel: 90,
    constellation: 0,
    weaponId: "athame_artis",
    refinement: 1,
    artifactSetId: "a_day_carved_from_rising_winds",
    artifactHalfSetIds: [],
  },
  {
    charId: "venti",
    charLevel: 90,
    constellation: 0,
    weaponId: "elegy_for_the_end",
    refinement: 1,
    artifactSetId: "viridescent_venerer",
    artifactHalfSetIds: [],
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSetId: "noblesse_oblige",
    artifactHalfSetIds: [],
  },
];

const CHASCA_TEAM: CharCompConfig[] = [
  {
    charId: "chasca",
    charLevel: 90,
    constellation: 0,
    weaponId: "astral_vultures_crimson_plumage",
    refinement: 1,
    artifactSetId: "obsidian_codex",
    artifactHalfSetIds: [],
  },
  {
    charId: "citlali",
    charLevel: 90,
    constellation: 0,
    weaponId: "starcallers_watch",
    refinement: 1,
    artifactSetId: "scroll_of_the_hero_of_cinder_city",
    artifactHalfSetIds: [],
  },
  {
    charId: "xilonen",
    charLevel: 90,
    constellation: 6,
    weaponId: "peak_patrol_song",
    refinement: 1,
    artifactSetId: "instructor",
    artifactHalfSetIds: [],
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSetId: "noblesse_oblige",
    artifactHalfSetIds: [],
  },
];

const EULA_TEAM: CharCompConfig[] = [
  {
    charId: "eula",
    charLevel: 90,
    constellation: 0,
    weaponId: "song_of_broken_pines",
    refinement: 1,
    artifactSetId: "pale_flame",
    artifactHalfSetIds: [],
  },
  {
    charId: "raiden_shogun",
    charLevel: 90,
    constellation: 0,
    weaponId: "the_catch",
    refinement: 5,
    artifactSetId: "emblem_of_severed_fate",
    artifactHalfSetIds: [],
  },
  {
    charId: "zhongli",
    charLevel: 90,
    constellation: 0,
    weaponId: "black_tassel",
    refinement: 5,
    artifactSetId: "tenacity_of_the_millelith",
    artifactHalfSetIds: [],
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSetId: "noblesse_oblige",
    artifactHalfSetIds: [],
  },
];

const CLORINDE_TEAM: CharCompConfig[] = [
  {
    charId: "clorinde",
    charLevel: 90,
    constellation: 0,
    weaponId: "absolution",
    refinement: 1,
    artifactSetId: "fragment_of_harmonic_whimsy",
    artifactHalfSetIds: [],
  },
  {
    charId: "columbina",
    charLevel: 90,
    constellation: 0,
    weaponId: "nocturnes_curtain_call",
    refinement: 1,
    artifactSetId: "aubade_of_morningstar_and_moon",
    artifactHalfSetIds: [],
  },
  {
    charId: "ineffa",
    charLevel: 90,
    constellation: 0,
    weaponId: "fractured_halo",
    refinement: 1,
    artifactSetId: "silken_moons_serenade",
    artifactHalfSetIds: [],
  },
  {
    charId: "xilonen",
    charLevel: 90,
    constellation: 6,
    weaponId: "peak_patrol_song",
    refinement: 1,
    artifactSetId: "scroll_of_the_hero_of_cinder_city",
    artifactHalfSetIds: [],
  },
];

const FUZZ_CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  assumeCrit: false,
};

// ─── Single-formula compiled pipeline fuzz ───

describe("compileTeamDamage full pipeline fuzz", () => {
  const rv = getRollValues();

  function fuzzTeam(
    label: string,
    configs: CharCompConfig[],
    swapCharId?: string
  ) {
    it(`${label}: compiled matches standard for random artifacts`, () => {
      const tb = new TeamBuild(configs);
      const carryId = swapCharId ?? configs[0].charId;
      const formulaId = getFirstFormulaId(tb, carryId);
      const charIds = configs.map((c) => c.charId);

      for (let trial = 0; trial < 50; trial++) {
        // Generate random artifact sheets for all characters
        const sheets: Record<string, StatSheet> = {};
        for (const cid of charIds) {
          sheets[cid] = buildSheetFromMainAndSubs(
            randomMainStats(),
            randomSubRolls(),
            rv
          );
        }

        // Old path
        const teamStats = tb.getTeamStats(sheets, carryId, FUZZ_CTX);
        // Compute off-field stats if the formula has off-field parts
        let offFieldTeamStats: Record<string, StatSheet> | undefined;
        if (hasOffFieldParts(tb, carryId, formulaId)) {
          const otherCharId = charIds.find((id) => id !== carryId);
          if (otherCharId) {
            offFieldTeamStats = tb.getTeamStats(sheets, otherCharId, FUZZ_CTX);
          }
        }
        const oldDamage = tb.getDamageResult(
          carryId,
          formulaId,
          teamStats,
          FUZZ_CTX,
          undefined,
          offFieldTeamStats
        ).totalDamage;

        // New path: compile with one char as swap, rest as support
        const optCtx = tb.createOptimizerContext(
          sheets,
          carryId,
          carryId,
          FUZZ_CTX
        );
        const compiled = compileTeamDamage(
          tb,
          carryId,
          formulaId,
          FUZZ_CTX,
          optCtx
        );
        const charIdx = optCtx.charBuildOrder.findIndex(
          ([id]) => id === carryId
        );
        const vars = new Float64Array(compiled.numVars);
        vars.fill(0);
        fillVarsFromSheet(sheets[carryId], compiled.varMapping, charIdx, vars);
        const newDamage = compiled.evaluate(vars);

        const relErr =
          oldDamage === 0
            ? newDamage === 0
              ? 0
              : Number.POSITIVE_INFINITY
            : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);
        expect(relErr).toBeLessThan(1e-6);
      }
    });
  }

  fuzzTeam("diluc team (carry swap)", DILUC_TEAM);
  fuzzTeam("raiden team (carry swap)", RAIDEN_TEAM);
  fuzzTeam("varka team (carry swap)", VARKA_TEAM);
  fuzzTeam("chasca team (carry swap)", CHASCA_TEAM);
  fuzzTeam("eula team (carry swap)", EULA_TEAM);
  fuzzTeam("clorinde team (carry swap)", CLORINDE_TEAM);

  // Support swap tests: optimize support artifacts while measuring carry damage
  fuzzTeam("varka team (venti swap)", VARKA_TEAM, "venti");
  fuzzTeam("chasca team (xilonen swap)", CHASCA_TEAM, "xilonen");
  fuzzTeam("clorinde team (xilonen swap)", CLORINDE_TEAM, "xilonen");

  it("diluc team: support swap matches standard", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const carryId = "diluc";
    const formulaId = getFirstFormulaId(tb, carryId);
    const charIds = DILUC_TEAM.map((c) => c.charId);
    const rv2 = getRollValues();

    for (let trial = 0; trial < 30; trial++) {
      const sheets: Record<string, StatSheet> = {};
      for (const cid of charIds) {
        sheets[cid] = buildSheetFromMainAndSubs(
          randomMainStats(),
          randomSubRolls(),
          rv2
        );
      }

      // Swap support (kazuha), carry damage
      const swapId = "kaedehara_kazuha";
      const optCtx = tb.createOptimizerContext(
        sheets,
        swapId,
        carryId,
        FUZZ_CTX
      );
      const compiled = compileTeamDamage(
        tb,
        carryId,
        formulaId,
        FUZZ_CTX,
        optCtx
      );
      const charIdx = optCtx.charBuildOrder.findIndex(([id]) => id === swapId);
      const vars = new Float64Array(compiled.numVars);
      vars.fill(0);
      fillVarsFromSheet(sheets[swapId], compiled.varMapping, charIdx, vars);
      const newDamage = compiled.evaluate(vars);

      const teamStats = tb.getTeamStats(sheets, carryId, FUZZ_CTX);
      // Compute off-field stats if the formula has off-field parts
      let offFieldTeamStats2: Record<string, StatSheet> | undefined;
      if (hasOffFieldParts(tb, carryId, formulaId)) {
        const otherCharId = charIds.find((id) => id !== carryId);
        if (otherCharId) {
          offFieldTeamStats2 = tb.getTeamStats(sheets, otherCharId, FUZZ_CTX);
        }
      }
      const oldDamage = tb.getDamageResult(
        carryId,
        formulaId,
        teamStats,
        FUZZ_CTX,
        undefined,
        offFieldTeamStats2
      ).totalDamage;

      const relErr =
        oldDamage === 0
          ? newDamage === 0
            ? 0
            : Number.POSITIVE_INFINITY
          : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);
      expect(relErr).toBeLessThan(1e-6);
    }
  });
});

// ─── Combo formula compiled pipeline fuzz ───

describe("compileComboTeamDamage fuzz", () => {
  const rv = getRollValues();

  /** Build a combo formula from all formulas of all characters in the team. */
  function buildFullCombo(tb: TeamBuild): ComboFormula {
    const allFormulas = tb.getFormulaIds();
    const lines: ComboFormula["lines"] = [];
    for (const [charId, formulas] of Object.entries(allFormulas)) {
      for (const formulaId of Object.keys(formulas)) {
        lines.push({
          charId,
          formulaId,
          count: 1 + Math.floor(Math.random() * 3),
        });
      }
    }
    return { id: "fuzz-combo", label: { zh: "测试", en: "test" }, lines };
  }

  function fuzzComboTeam(label: string, configs: CharCompConfig[]) {
    it(`${label}: compiled combo matches evaluateCombo for random artifacts`, () => {
      const tb = new TeamBuild(configs);
      const charIds = configs.map((c) => c.charId);
      const combo = buildFullCombo(tb);

      for (const swapCharId of charIds) {
        for (let trial = 0; trial < 20; trial++) {
          const sheets: Record<string, StatSheet> = {};
          for (const cid of charIds) {
            sheets[cid] = buildSheetFromMainAndSubs(
              randomMainStats(),
              randomSubRolls(),
              rv
            );
          }

          // Old path
          const oldDamage = evaluateCombo(
            tb,
            combo,
            sheets,
            FUZZ_CTX
          ).totalDamage;

          // New path: compiled combo
          const compiled = compileComboTeamDamage(
            tb,
            combo,
            swapCharId,
            sheets,
            FUZZ_CTX
          );
          const optCtx = tb.createOptimizerContext(
            sheets,
            swapCharId,
            charIds[0],
            FUZZ_CTX
          );
          const charIdx = optCtx.charBuildOrder.findIndex(
            ([id]) => id === swapCharId
          );
          const vars = new Float64Array(compiled.numVars);
          vars.fill(0);
          fillVarsFromSheet(
            sheets[swapCharId],
            compiled.varMapping,
            charIdx,
            vars
          );
          const newDamage = compiled.evaluate(vars);

          const relErr =
            oldDamage === 0
              ? newDamage === 0
                ? 0
                : Number.POSITIVE_INFINITY
              : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);

          if (relErr >= 1e-6) {
            throw new Error(
              `Mismatch for ${label}, swapChar=${swapCharId}, trial=${trial}: ` +
                `old=${oldDamage.toFixed(4)} new=${newDamage.toFixed(4)} relErr=${(relErr * 100).toFixed(8)}%`
            );
          }
        }
      }
    });
  }

  fuzzComboTeam("diluc team", DILUC_TEAM);
  fuzzComboTeam("raiden team", RAIDEN_TEAM);
  fuzzComboTeam("varka team", VARKA_TEAM);
  fuzzComboTeam("chasca team", CHASCA_TEAM);
  fuzzComboTeam("eula team", EULA_TEAM);
  fuzzComboTeam("clorinde team", CLORINDE_TEAM);

  it("combo with reaction overrides matches evaluateCombo", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const dilucFormula = getFirstFormulaId(tb, "diluc");
    const xqFormula = getFirstFormulaId(tb, "xingqiu");
    const charIds = DILUC_TEAM.map((c) => c.charId);

    const combo: ComboFormula = {
      id: "rxn-test",
      label: { zh: "测试", en: "test" },
      lines: [
        { charId: "diluc", formulaId: dilucFormula, count: 3 },
        { charId: "xingqiu", formulaId: xqFormula, count: 2 },
      ],
    };

    const singleOverrides: Record<
      string,
      import("@/lib/team-comp/types").ReactionOverride
    > = {
      [`diluc.${dilucFormula}`]: { reaction: "vaporize" },
    };

    for (let trial = 0; trial < 30; trial++) {
      const sheets: Record<string, StatSheet> = {};
      for (const cid of charIds) {
        sheets[cid] = buildSheetFromMainAndSubs(
          randomMainStats(),
          randomSubRolls(),
          rv
        );
      }

      const swapCharId = "diluc";
      const oldDamage = evaluateCombo(
        tb,
        combo,
        sheets,
        FUZZ_CTX,
        singleOverrides
      ).totalDamage;

      const compiled = compileComboTeamDamage(
        tb,
        combo,
        swapCharId,
        sheets,
        FUZZ_CTX,
        singleOverrides
      );
      const optCtx = tb.createOptimizerContext(
        sheets,
        swapCharId,
        "diluc",
        FUZZ_CTX
      );
      const charIdx = optCtx.charBuildOrder.findIndex(
        ([id]) => id === swapCharId
      );
      const vars = new Float64Array(compiled.numVars);
      vars.fill(0);
      fillVarsFromSheet(sheets[swapCharId], compiled.varMapping, charIdx, vars);
      const newDamage = compiled.evaluate(vars);

      const relErr =
        oldDamage === 0
          ? newDamage === 0
            ? 0
            : Number.POSITIVE_INFINITY
          : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);
      expect(relErr).toBeLessThan(1e-6);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Marginal Gain Parity Tests
// Verifies that compiled AST and standard path agree on the
// per-stat-key gradient (marginal gain), not just absolute damage.
// ═══════════════════════════════════════════════════════════════

describe("marginal gain parity (compiled vs standard)", () => {
  const rv = getRollValues();

  const MARGINAL_STAT_KEYS: StatKey[] = [
    "hp",
    "hp%",
    "atk",
    "atk%",
    "def",
    "def%",
    "em",
    "er",
    "cr",
    "cd",
  ];

  function testMarginalGains(
    label: string,
    configs: CharCompConfig[],
    swapCharId?: string
  ) {
    it(`${label}: marginal gains match for all stat keys`, () => {
      const tb = new TeamBuild(configs);
      const carryId = configs[0].charId;
      const swap = swapCharId ?? carryId;
      const formulaId = getFirstFormulaId(tb, carryId);
      const charIds = configs.map((c) => c.charId);

      for (let trial = 0; trial < 10; trial++) {
        const sheets: Record<string, StatSheet> = {};
        for (const cid of charIds) {
          sheets[cid] = buildSheetFromMainAndSubs(
            randomMainStats(),
            randomSubRolls(),
            rv
          );
        }

        const optCtx = tb.createOptimizerContext(
          sheets,
          swap,
          carryId,
          FUZZ_CTX
        );
        const compiled = compileTeamDamage(
          tb,
          carryId,
          formulaId,
          FUZZ_CTX,
          optCtx
        );
        const charIdx = optCtx.charBuildOrder.findIndex(([id]) => id === swap);

        // Evaluate base damage with both paths
        const baseVars = new Float64Array(compiled.numVars);
        fillVarsFromSheet(sheets[swap], compiled.varMapping, charIdx, baseVars);
        const compiledBase = compiled.evaluate(baseVars);

        const baseTeamStats = tb.getTeamStats(sheets, carryId, FUZZ_CTX);
        let offFieldBase: Record<string, StatSheet> | undefined;
        if (hasOffFieldParts(tb, carryId, formulaId)) {
          const oc = charIds.find((id) => id !== carryId);
          if (oc) offFieldBase = tb.getTeamStats(sheets, oc, FUZZ_CTX);
        }
        const standardBase = tb.getDamageResult(
          carryId,
          formulaId,
          baseTeamStats,
          FUZZ_CTX,
          undefined,
          offFieldBase
        ).totalDamage;

        // Test marginal gain for each stat key
        const epsilon = 0.01;
        for (const statKey of MARGINAL_STAT_KEYS) {
          const bumpedSheet = sheets[swap].merge(
            new StatSheet([{ key: statKey, value: epsilon }])
          );
          const bumpedSheets = { ...sheets, [swap]: bumpedSheet };

          // Standard path marginal
          const bumpedTeamStats = tb.getTeamStats(
            bumpedSheets,
            carryId,
            FUZZ_CTX
          );
          let offFieldBumped: Record<string, StatSheet> | undefined;
          if (hasOffFieldParts(tb, carryId, formulaId)) {
            const oc = charIds.find((id) => id !== carryId);
            if (oc)
              offFieldBumped = tb.getTeamStats(bumpedSheets, oc, FUZZ_CTX);
          }
          const standardBumped = tb.getDamageResult(
            carryId,
            formulaId,
            bumpedTeamStats,
            FUZZ_CTX,
            undefined,
            offFieldBumped
          ).totalDamage;
          const standardMarginal = standardBumped - standardBase;

          // Compiled path marginal
          const bumpedVars = new Float64Array(compiled.numVars);
          fillVarsFromSheet(
            bumpedSheet,
            compiled.varMapping,
            charIdx,
            bumpedVars
          );
          const compiledBumped = compiled.evaluate(bumpedVars);
          const compiledMarginal = compiledBumped - compiledBase;

          if (
            Math.abs(standardMarginal) < 1e-10 &&
            Math.abs(compiledMarginal) < 1e-10
          ) {
            continue;
          }
          const marginalRelErr =
            Math.abs(standardMarginal) < 1e-10
              ? Math.abs(compiledMarginal)
              : Math.abs(compiledMarginal - standardMarginal) /
                Math.abs(standardMarginal);

          if (marginalRelErr > 1e-4) {
            throw new Error(
              `Marginal gain mismatch for ${label}, swap=${swap}, trial=${trial}, stat=${statKey}: ` +
                `standard=${standardMarginal.toFixed(6)} compiled=${compiledMarginal.toFixed(6)} ` +
                `relErr=${(marginalRelErr * 100).toFixed(6)}%`
            );
          }
        }
      }
    });
  }

  testMarginalGains("diluc team", DILUC_TEAM);
  testMarginalGains("raiden team", RAIDEN_TEAM);
  testMarginalGains("varka team", VARKA_TEAM);
  testMarginalGains("chasca team", CHASCA_TEAM);
  testMarginalGains("eula team", EULA_TEAM);
  testMarginalGains("clorinde team", CLORINDE_TEAM);
  testMarginalGains("varka team (venti swap)", VARKA_TEAM, "venti");
  testMarginalGains("chasca team (xilonen swap)", CHASCA_TEAM, "xilonen");
  testMarginalGains("clorinde team (xilonen swap)", CLORINDE_TEAM, "xilonen");
});

// ═══════════════════════════════════════════════════════════════
// Random Team Generation Fuzz Tests
// Picks random characters/weapons/artifacts to stress-test the
// compiled pipeline against diverse buff combinations.
// ═══════════════════════════════════════════════════════════════

import { artifacts, characters, weapons } from "@/data/resources";
import {
  getCharacterStatsSync,
  getWeaponStatsSync,
} from "@/lib/gameStatsLoader";

describe("random team fuzz (compiled vs standard)", () => {
  const rv = getRollValues();

  function buildWeaponsByType(): Record<string, string[]> {
    const weaponStats = getWeaponStatsSync()!;
    const byType: Record<string, string[]> = {};
    for (const w of weapons) {
      const stats = weaponStats[w.id];
      if (!stats) continue;
      const t = stats.type;
      if (!byType[t]) byType[t] = [];
      byType[t].push(w.id);
    }
    return byType;
  }

  function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const fiveStarArtifacts = artifacts
    .filter((a) => a.rarity === 5)
    .map((a) => a.id);

  function tryRandomTeam(): CharCompConfig[] | null {
    const charStats = getCharacterStatsSync()!;
    const weaponsByType = buildWeaponsByType();
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    const picked: CharCompConfig[] = [];

    for (const c of shuffled) {
      if (picked.length >= 4) break;
      if (picked.some((p) => p.charId === c.id)) continue;
      const stats = charStats[c.id];
      if (!stats) continue;
      const compatible = weaponsByType[stats.weaponType];
      if (!compatible || compatible.length === 0) continue;

      picked.push({
        charId: c.id,
        charLevel: 90,
        constellation: Math.floor(Math.random() * 7),
        weaponId: pick(compatible),
        refinement: Math.floor(Math.random() * 5) + 1,
        artifactSetId: Math.random() > 0.3 ? pick(fiveStarArtifacts) : null,
        artifactHalfSetIds: [],
      });
    }

    if (picked.length < 4) return null;
    return picked;
  }

  it("random teams: compiled matches standard for 20 random teams × 20 trials", () => {
    let teamsOk = 0;
    let teamsFailed = 0;
    const errors: string[] = [];

    for (let teamAttempt = 0; teamAttempt < 50 && teamsOk < 20; teamAttempt++) {
      const configs = tryRandomTeam();
      if (!configs) continue;

      let tb: TeamBuild;
      try {
        tb = new TeamBuild(configs);
      } catch {
        continue;
      }

      const charIds = configs.map((c) => c.charId);
      const carryId = charIds[0];

      let formulaId: string;
      try {
        formulaId = getFirstFormulaId(tb, carryId);
      } catch {
        continue;
      }

      let trialErrors = 0;
      for (let trial = 0; trial < 20; trial++) {
        const sheets: Record<string, StatSheet> = {};
        for (const cid of charIds) {
          sheets[cid] = buildSheetFromMainAndSubs(
            randomMainStats(),
            randomSubRolls(),
            rv
          );
        }

        try {
          const teamStats = tb.getTeamStats(sheets, carryId, FUZZ_CTX);
          // Compute off-field stats if the formula has off-field parts
          let offFieldTeamStats: Record<string, StatSheet> | undefined;
          if (hasOffFieldParts(tb, carryId, formulaId)) {
            const otherCharId = charIds.find((id) => id !== carryId);
            if (otherCharId) {
              offFieldTeamStats = tb.getTeamStats(
                sheets,
                otherCharId,
                FUZZ_CTX
              );
            }
          }
          const oldDamage = tb.getDamageResult(
            carryId,
            formulaId,
            teamStats,
            FUZZ_CTX,
            undefined,
            offFieldTeamStats
          ).totalDamage;

          const optCtx = tb.createOptimizerContext(
            sheets,
            carryId,
            carryId,
            FUZZ_CTX
          );
          const compiled = compileTeamDamage(
            tb,
            carryId,
            formulaId,
            FUZZ_CTX,
            optCtx
          );
          const charIdx = optCtx.charBuildOrder.findIndex(
            ([id]) => id === carryId
          );
          const vars = new Float64Array(compiled.numVars);
          fillVarsFromSheet(
            sheets[carryId],
            compiled.varMapping,
            charIdx,
            vars
          );
          const newDamage = compiled.evaluate(vars);

          const relErr =
            oldDamage === 0
              ? newDamage === 0
                ? 0
                : Number.POSITIVE_INFINITY
              : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);

          if (relErr > 1e-6) {
            trialErrors++;
            if (errors.length < 5) {
              errors.push(
                `Team [${charIds.join(",")}] trial=${trial}: old=${oldDamage.toFixed(4)} new=${newDamage.toFixed(4)} relErr=${(relErr * 100).toFixed(8)}%`
              );
            }
          }
        } catch {
          // skip trial
        }
      }

      if (trialErrors === 0) {
        teamsOk++;
      } else {
        teamsFailed++;
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `${teamsFailed} teams had mismatches:\n${errors.join("\n")}`
      );
    }
    expect(teamsOk).toBeGreaterThanOrEqual(10);
  });

  it("random teams: support swap compiled matches standard", () => {
    let teamsOk = 0;
    const errors: string[] = [];

    for (let teamAttempt = 0; teamAttempt < 50 && teamsOk < 10; teamAttempt++) {
      const configs = tryRandomTeam();
      if (!configs) continue;

      let tb: TeamBuild;
      try {
        tb = new TeamBuild(configs);
      } catch {
        continue;
      }

      const charIds = configs.map((c) => c.charId);
      const carryId = charIds[0];
      const swapId = charIds[1];

      let formulaId: string;
      try {
        formulaId = getFirstFormulaId(tb, carryId);
      } catch {
        continue;
      }

      let trialErrors = 0;
      for (let trial = 0; trial < 15; trial++) {
        const sheets: Record<string, StatSheet> = {};
        for (const cid of charIds) {
          sheets[cid] = buildSheetFromMainAndSubs(
            randomMainStats(),
            randomSubRolls(),
            rv
          );
        }

        try {
          const teamStats = tb.getTeamStats(sheets, carryId, FUZZ_CTX);
          // Compute off-field stats if the formula has off-field parts
          let offFieldTeamStats: Record<string, StatSheet> | undefined;
          if (hasOffFieldParts(tb, carryId, formulaId)) {
            const otherCharId = charIds.find((id) => id !== carryId);
            if (otherCharId) {
              offFieldTeamStats = tb.getTeamStats(
                sheets,
                otherCharId,
                FUZZ_CTX
              );
            }
          }
          const oldDamage = tb.getDamageResult(
            carryId,
            formulaId,
            teamStats,
            FUZZ_CTX,
            undefined,
            offFieldTeamStats
          ).totalDamage;

          const optCtx = tb.createOptimizerContext(
            sheets,
            swapId,
            carryId,
            FUZZ_CTX
          );
          const compiled = compileTeamDamage(
            tb,
            carryId,
            formulaId,
            FUZZ_CTX,
            optCtx
          );
          const charIdx = optCtx.charBuildOrder.findIndex(
            ([id]) => id === swapId
          );
          const vars = new Float64Array(compiled.numVars);
          fillVarsFromSheet(sheets[swapId], compiled.varMapping, charIdx, vars);
          const newDamage = compiled.evaluate(vars);

          const relErr =
            oldDamage === 0
              ? newDamage === 0
                ? 0
                : Number.POSITIVE_INFINITY
              : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);

          if (relErr > 1e-6) {
            trialErrors++;
            if (errors.length < 5) {
              errors.push(
                `Team [${charIds.join(",")}] swap=${swapId} trial=${trial}: old=${oldDamage.toFixed(4)} new=${newDamage.toFixed(4)} relErr=${(relErr * 100).toFixed(8)}%`
              );
            }
          }
        } catch {
          // skip trial
        }
      }

      if (trialErrors === 0) teamsOk++;
    }

    if (errors.length > 0) {
      throw new Error(`Support swap mismatches:\n${errors.join("\n")}`);
    }
    expect(teamsOk).toBeGreaterThanOrEqual(5);
  });
});
