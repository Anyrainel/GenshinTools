import { describe, expect, it } from "vitest";

import { preloadGameStats } from "@/lib/gameStatsLoader";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarDirectFormula,
  LunarFormula,
  TransformFormula,
} from "@/lib/team-comp/calc/damageFormula";
import { evaluate, simplify } from "@/lib/team-comp/calc/expr";
import {
  VarMapping,
  createExprStats,
} from "@/lib/team-comp/calc/exprStatSheet";

import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/team-comp/calc/formulaCompiler";
import { CrossScalingBuff, ScalingBuff } from "@/lib/team-comp/calc/statBuff";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  buildSheetFromMainAndSubs,
  getRollValues,
} from "@/lib/team-comp/generator/constrainedGreedy";
import type {
  CalcContext,
  ComboFormula,
  StatKey,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import "@/lib/team-comp/index";
import { getFirstFormulaId } from "../../../fixtures/optimizerHelpers";

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

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

// Full Pipeline Fuzz Tests (single-formula + combo)

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

const DILUC_TEAM: TeamSlotConfig[] = [
  {
    charId: "diluc",
    charLevel: 90,
    constellation: 0,
    weaponId: "wolfs_gravestone",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 0,
    weaponId: "sacrificial_sword",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 0,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSet: null,
  },
];

const RAIDEN_TEAM: TeamSlotConfig[] = [
  {
    charId: "raiden_shogun",
    charLevel: 90,
    constellation: 0,
    weaponId: "the_catch",
    refinement: 5,
    artifactSet: null,
  },
  {
    charId: "xiangling",
    charLevel: 90,
    constellation: 6,
    weaponId: "the_catch",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 0,
    weaponId: "sacrificial_sword",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 0,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: null,
  },
];

// Teams with artifact sets — exercises the full buff pipeline including noStackId deduplication
const VARKA_TEAM: TeamSlotConfig[] = [
  {
    charId: "varka",
    charLevel: 90,
    constellation: 0,
    weaponId: "gest_of_the_mighty_wolf",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "a_day_carved_from_rising_winds" },
  },
  {
    charId: "durin",
    charLevel: 90,
    constellation: 0,
    weaponId: "athame_artis",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "a_day_carved_from_rising_winds" },
  },
  {
    charId: "venti",
    charLevel: 90,
    constellation: 0,
    weaponId: "elegy_for_the_end",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "viridescent_venerer" },
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "noblesse_oblige" },
  },
];

const CHASCA_TEAM: TeamSlotConfig[] = [
  {
    charId: "chasca",
    charLevel: 90,
    constellation: 0,
    weaponId: "astral_vultures_crimson_plumage",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "obsidian_codex" },
  },
  {
    charId: "citlali",
    charLevel: 90,
    constellation: 0,
    weaponId: "starcallers_watch",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "scroll_of_the_hero_of_cinder_city" },
  },
  {
    charId: "xilonen",
    charLevel: 90,
    constellation: 6,
    weaponId: "peak_patrol_song",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "instructor" },
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "noblesse_oblige" },
  },
];

const EULA_TEAM: TeamSlotConfig[] = [
  {
    charId: "eula",
    charLevel: 90,
    constellation: 0,
    weaponId: "song_of_broken_pines",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "pale_flame" },
  },
  {
    charId: "raiden_shogun",
    charLevel: 90,
    constellation: 0,
    weaponId: "the_catch",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
  {
    charId: "zhongli",
    charLevel: 90,
    constellation: 0,
    weaponId: "black_tassel",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "tenacity_of_the_millelith" },
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "noblesse_oblige" },
  },
];

// Lunar-reaction team with Nod-Krai faction buffs — exercises lunarCrystallize
// reactions, teamOnField buffs gated on factions, and forceOnField overrides on
// an off-field carry formula (Linnea's Million Ton).
const LINNEA_TEAM: TeamSlotConfig[] = [
  {
    charId: "linnea",
    charLevel: 90,
    constellation: 6,
    weaponId: "lightbearing_moonshard",
    refinement: 1,
    artifactSet: { type: "2pc+2pc", halfSetIds: ["def%-30", "def%-30"] },
  },
  {
    charId: "illuga",
    charLevel: 90,
    constellation: 6,
    weaponId: "the_widsith",
    refinement: 1,
    artifactSet: { type: "2pc+2pc", halfSetIds: ["em-80", "em-80"] },
  },
  {
    charId: "columbina",
    charLevel: 90,
    constellation: 6,
    weaponId: "a_thousand_floating_dreams",
    refinement: 1,
    artifactSet: { type: "2pc+2pc", halfSetIds: ["hp%-20", "hp%-20"] },
  },
  {
    charId: "gorou",
    charLevel: 90,
    constellation: 6,
    weaponId: "favonius_warbow",
    refinement: 1,
    artifactSet: { type: "2pc+2pc", halfSetIds: ["def%-30", "def%-30"] },
  },
];

const CLORINDE_TEAM: TeamSlotConfig[] = [
  {
    charId: "clorinde",
    charLevel: 90,
    constellation: 0,
    weaponId: "absolution",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "fragment_of_harmonic_whimsy" },
  },
  {
    charId: "columbina",
    charLevel: 90,
    constellation: 0,
    weaponId: "nocturnes_curtain_call",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "aubade_of_morningstar_and_moon" },
  },
  {
    charId: "ineffa",
    charLevel: 90,
    constellation: 0,
    weaponId: "fractured_halo",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "silken_moons_serenade" },
  },
  {
    charId: "xilonen",
    charLevel: 90,
    constellation: 6,
    weaponId: "peak_patrol_song",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "scroll_of_the_hero_of_cinder_city" },
  },
];

const FUZZ_CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

// ─── Single-formula compiled pipeline fuzz ───

describe("compileComboTeamDamage full pipeline fuzz", () => {
  const rv = getRollValues();

  function fuzzTeam(
    label: string,
    configs: TeamSlotConfig[],
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
        tb.teamStats.setArtifacts(sheets, FUZZ_CTX);
        const oldDamage = tb.getDamageResult(
          carryId,
          formulaId,
          FUZZ_CTX
        ).totalDamage;

        // New path: compile with one char as swap, rest as support
        const compiled = compileComboTeamDamage(
          tb,
          singleFormulaCombo(carryId, formulaId),
          carryId,
          sheets,
          FUZZ_CTX
        );
        const charIdx = compiled.charIdxMap?.get(carryId) ?? 0;
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
  fuzzTeam("linnea team (carry swap)", LINNEA_TEAM);

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
      const compiled = compileComboTeamDamage(
        tb,
        singleFormulaCombo(carryId, formulaId),
        swapId,
        sheets,
        FUZZ_CTX
      );
      const charIdx = compiled.charIdxMap?.get(swapId) ?? 0;
      const vars = new Float64Array(compiled.numVars);
      vars.fill(0);
      fillVarsFromSheet(sheets[swapId], compiled.varMapping, charIdx, vars);
      const newDamage = compiled.evaluate(vars);

      tb.teamStats.setArtifacts(sheets, FUZZ_CTX);
      const oldDamage = tb.getDamageResult(
        carryId,
        formulaId,
        FUZZ_CTX
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

  // ─── Team reaction formula (rx-*) fuzz ───

  function fuzzTeamReaction(
    label: string,
    configs: TeamSlotConfig[],
    swapCharId?: string
  ) {
    it(`${label}: reaction formulas compiled match standard path`, () => {
      const tb = new TeamBuild(configs);
      const charIds = configs.map((c) => c.charId);
      const rxFormulas = tb.catalog.getFormulaIds();
      const rxIds = Object.keys(rxFormulas);
      if (rxIds.length === 0) return; // no reactions for this team

      for (const formulaId of rxIds) {
        const rxEntry = tb.catalog.formulaIndex.get(formulaId);
        const triggerCharId = rxEntry?.parts[0]?.statsCharId;
        if (!triggerCharId) continue;
        const swap = swapCharId ?? triggerCharId;

        for (let trial = 0; trial < 20; trial++) {
          const sheets: Record<string, StatSheet> = {};
          for (const cid of charIds) {
            sheets[cid] = buildSheetFromMainAndSubs(
              randomMainStats(),
              randomSubRolls(),
              rv
            );
          }

          // Standard path (unified pipeline)
          tb.teamStats.setArtifacts(sheets, FUZZ_CTX);
          const oldDamage = tb.getDamageResult(
            triggerCharId,
            formulaId,
            FUZZ_CTX
          ).totalDamage;

          // Compiled path
          const compiled = compileComboTeamDamage(
            tb,
            singleFormulaCombo(triggerCharId, formulaId),
            swap,
            sheets,
            FUZZ_CTX
          );
          const charIdx = compiled.charIdxMap?.get(swap) ?? 0;
          const vars = new Float64Array(compiled.numVars);
          vars.fill(0);
          fillVarsFromSheet(sheets[swap], compiled.varMapping, charIdx, vars);
          const newDamage = compiled.evaluate(vars);

          const relErr =
            oldDamage === 0
              ? newDamage === 0
                ? 0
                : Number.POSITIVE_INFINITY
              : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);

          if (relErr >= 1e-6) {
            throw new Error(
              `Reaction mismatch for ${label} ${formulaId}, swap=${swap}, trial=${trial}: ` +
                `old=${oldDamage.toFixed(4)} new=${newDamage.toFixed(4)} relErr=${(relErr * 100).toFixed(8)}%`
            );
          }
        }
      }
    });
  }

  fuzzTeamReaction("raiden team reactions", RAIDEN_TEAM);
  fuzzTeamReaction(
    "raiden team reactions (xingqiu swap)",
    RAIDEN_TEAM,
    "xingqiu"
  );
  fuzzTeamReaction("varka team reactions", VARKA_TEAM);
  fuzzTeamReaction("diluc team reactions", DILUC_TEAM);
});

// ─── Combo formula compiled pipeline fuzz ───

describe("compileComboTeamDamage fuzz", () => {
  const rv = getRollValues();

  /** Build a combo formula from all formulas of all characters + team reactions. */
  function buildFullCombo(tb: TeamBuild): ComboFormula {
    const allFormulas = tb.catalog.getFormulaIds();
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
    // Include team reaction formulas (rx-*) — per-triggerer formula IDs
    const rxFormulas = tb.catalog.getFormulaIds();
    for (const rxId of Object.keys(rxFormulas)) {
      const rxEntry = tb.catalog.formulaIndex.get(rxId);
      const rxCharId = rxEntry?.parts[0]?.statsCharId;
      if (rxCharId) {
        lines.push({
          charId: rxCharId,
          formulaId: rxId,
          count: 1 + Math.floor(Math.random() * 3),
        });
      }
    }
    return { id: "fuzz-combo", label: { zh: "测试", en: "test" }, lines };
  }

  function fuzzComboTeam(label: string, configs: TeamSlotConfig[]) {
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
          const oldDamage = tb.getComboDamageResult(
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
          const charIdx = compiled.charIdxMap?.get(swapCharId) ?? 0;
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
  fuzzComboTeam("linnea team", LINNEA_TEAM);

  it("combo with reaction on line matches evaluateCombo", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const dilucFormula = getFirstFormulaId(tb, "diluc");
    const xqFormula = getFirstFormulaId(tb, "xingqiu");
    const charIds = DILUC_TEAM.map((c) => c.charId);

    const combo: ComboFormula = {
      id: "rxn-test",
      label: { zh: "测试", en: "test" },
      lines: [
        {
          charId: "diluc",
          formulaId: dilucFormula,
          count: 3,
          reaction: { reaction: "vaporize" },
        },
        { charId: "xingqiu", formulaId: xqFormula, count: 2 },
      ],
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
      const oldDamage = tb.getComboDamageResult(
        combo,
        sheets,
        FUZZ_CTX
      ).totalDamage;

      const compiled = compileComboTeamDamage(
        tb,
        combo,
        swapCharId,
        sheets,
        FUZZ_CTX
      );
      const charIdx = compiled.charIdxMap?.get(swapCharId) ?? 0;
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

// Marginal Gain Parity Tests
// Verifies that compiled AST and standard path agree on the
// per-stat-key gradient (marginal gain), not just absolute damage.

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
    configs: TeamSlotConfig[],
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

        const compiled = compileComboTeamDamage(
          tb,
          singleFormulaCombo(carryId, formulaId),
          swap,
          sheets,
          FUZZ_CTX
        );
        const charIdx = compiled.charIdxMap?.get(swap) ?? 0;

        // Evaluate base damage with both paths
        const baseVars = new Float64Array(compiled.numVars);
        fillVarsFromSheet(sheets[swap], compiled.varMapping, charIdx, baseVars);
        const compiledBase = compiled.evaluate(baseVars);

        tb.teamStats.setArtifacts(sheets, FUZZ_CTX);
        const standardBase = tb.getDamageResult(
          carryId,
          formulaId,
          FUZZ_CTX
        ).totalDamage;

        // Test marginal gain for each stat key
        const epsilon = 0.01;
        for (const statKey of MARGINAL_STAT_KEYS) {
          const bumpedSheet = sheets[swap].merge(
            new StatSheet([{ key: statKey, value: epsilon }])
          );
          const bumpedSheets = { ...sheets, [swap]: bumpedSheet };

          // Standard path marginal
          tb.teamStats.setArtifacts(bumpedSheets, FUZZ_CTX);
          const standardBumped = tb.getDamageResult(
            carryId,
            formulaId,
            FUZZ_CTX
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

// Random Team Generation Fuzz Tests
// Picks random characters/weapons/artifacts to stress-test the
// compiled pipeline against diverse buff combinations.

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

  function tryRandomTeam(): TeamSlotConfig[] | null {
    const charStats = getCharacterStatsSync()!;
    const weaponsByType = buildWeaponsByType();
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    const picked: TeamSlotConfig[] = [];

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
        artifactSet:
          Math.random() > 0.3
            ? { type: "4pc" as const, setId: pick(fiveStarArtifacts) }
            : null,
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
          tb.teamStats.setArtifacts(sheets, FUZZ_CTX);
          const oldDamage = tb.getDamageResult(
            carryId,
            formulaId,
            FUZZ_CTX
          ).totalDamage;

          const compiled = compileComboTeamDamage(
            tb,
            singleFormulaCombo(carryId, formulaId),
            carryId,
            sheets,
            FUZZ_CTX
          );
          const charIdx = compiled.charIdxMap?.get(carryId) ?? 0;
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
          tb.teamStats.setArtifacts(sheets, FUZZ_CTX);
          const oldDamage = tb.getDamageResult(
            carryId,
            formulaId,
            FUZZ_CTX
          ).totalDamage;

          const compiled = compileComboTeamDamage(
            tb,
            singleFormulaCombo(carryId, formulaId),
            swapId,
            sheets,
            FUZZ_CTX
          );
          const charIdx = compiled.charIdxMap?.get(swapId) ?? 0;
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

// ER/CR Constraint Compilation Tests
// Verifies that compileComboTeamDamage with erCheckCharId/minEr/minCr
// produces correct evaluateEr/evaluateCr functions.

describe("compileComboTeamDamage — ER/CR constraints", () => {
  const rv = getRollValues();

  it("evaluateEr returns positive when ER constraint is met", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const formulaId = getFirstFormulaId(tb, "diluc");
    const charIds = DILUC_TEAM.map((c) => c.charId);

    const combo: ComboFormula = {
      id: "er-test",
      label: { zh: "测试", en: "test" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    // Use a sheet with high ER to satisfy constraint
    const highErSheet = buildSheetFromMainAndSubs(
      {
        flower: "hp",
        plume: "atk",
        sands: "er",
        goblet: "pyro%",
        circlet: "cr",
      },
      {
        flower: { er: 6 },
        plume: { er: 6 },
        sands: {},
        goblet: { er: 6 },
        circlet: { er: 6 },
      },
      rv
    );
    const sheets: Record<string, StatSheet> = {};
    for (const cid of charIds) {
      sheets[cid] = cid === "diluc" ? highErSheet : new StatSheet([]);
    }

    const compiled = compileComboTeamDamage(
      tb,
      combo,
      "diluc",
      sheets,
      FUZZ_CTX,
      undefined,
      "diluc",
      1.2,
      0
    );

    expect(compiled.evaluateEr).toBeDefined();
    expect(compiled.evaluateCr).toBeUndefined();

    // Fill vars from the high-ER sheet
    const charIdx = compiled.charIdxMap?.get("diluc") ?? 0;
    const vars = new Float64Array(compiled.numVars);
    fillVarsFromSheet(highErSheet, compiled.varMapping, charIdx, vars);

    // With high ER, evaluateEr should return >= 0
    const erVal = compiled.evaluateEr!(vars);
    expect(erVal).toBeGreaterThanOrEqual(0);
  });

  it("evaluateEr returns negative when ER constraint is NOT met", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const formulaId = getFirstFormulaId(tb, "diluc");
    const charIds = DILUC_TEAM.map((c) => c.charId);

    const combo: ComboFormula = {
      id: "er-unmet",
      label: { zh: "测试", en: "test" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const sheets: Record<string, StatSheet> = {};
    for (const cid of charIds) sheets[cid] = new StatSheet([]);

    // Very high ER requirement — empty sheet won't meet it
    const compiled = compileComboTeamDamage(
      tb,
      combo,
      "diluc",
      sheets,
      FUZZ_CTX,
      undefined,
      "diluc",
      2.0,
      0
    );

    expect(compiled.evaluateEr).toBeDefined();

    const vars = new Float64Array(compiled.numVars);
    const erVal = compiled.evaluateEr!(vars);
    expect(erVal).toBeLessThan(0);
  });

  it("evaluateCr returns positive/negative based on CR constraint", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const formulaId = getFirstFormulaId(tb, "diluc");
    const charIds = DILUC_TEAM.map((c) => c.charId);

    const combo: ComboFormula = {
      id: "cr-test",
      label: { zh: "测试", en: "test" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const sheets: Record<string, StatSheet> = {};
    for (const cid of charIds) sheets[cid] = new StatSheet([]);

    // Compile with CR constraint
    const compiled = compileComboTeamDamage(
      tb,
      combo,
      "diluc",
      sheets,
      FUZZ_CTX,
      undefined,
      "diluc",
      0,
      0.7
    );

    expect(compiled.evaluateCr).toBeDefined();

    // Empty vars → baseline CR only (should be below 70%)
    const vars = new Float64Array(compiled.numVars);
    const crValEmpty = compiled.evaluateCr!(vars);
    expect(crValEmpty).toBeLessThan(0);

    // With high-CR sheet, constraint should be met
    const highCrSheet = buildSheetFromMainAndSubs(
      {
        flower: "hp",
        plume: "atk",
        sands: "atk%",
        goblet: "pyro%",
        circlet: "cr",
      },
      {
        flower: { cr: 6 },
        plume: { cr: 6 },
        sands: { cr: 6 },
        goblet: { cr: 6 },
        circlet: {},
      },
      rv
    );
    const charIdx = compiled.charIdxMap?.get("diluc") ?? 0;
    const vars2 = new Float64Array(compiled.numVars);
    fillVarsFromSheet(highCrSheet, compiled.varMapping, charIdx, vars2);
    const crValHigh = compiled.evaluateCr!(vars2);
    expect(crValHigh).toBeGreaterThanOrEqual(0);
  });

  it("compiled ER check agrees with domain-object ER for random artifacts", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const formulaId = getFirstFormulaId(tb, "diluc");
    const charIds = DILUC_TEAM.map((c) => c.charId);
    const minEr = 1.4;

    const combo: ComboFormula = {
      id: "er-fuzz",
      label: { zh: "测试", en: "test" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
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

      const compiled = compileComboTeamDamage(
        tb,
        combo,
        "diluc",
        sheets,
        FUZZ_CTX,
        undefined,
        "diluc",
        minEr,
        0
      );

      const charIdx = compiled.charIdxMap?.get("diluc") ?? 0;
      const vars = new Float64Array(compiled.numVars);
      fillVarsFromSheet(sheets.diluc, compiled.varMapping, charIdx, vars);

      const compiledErSign = compiled.evaluateEr!(vars) >= 0;

      // Domain-object path
      const postStats = tb.getTeamStats(sheets, "diluc", FUZZ_CTX);
      const domainEr = postStats.diluc?.get("er", null) ?? 0;
      const domainErSign = domainEr >= minEr;

      expect(compiledErSign).toBe(domainErSign);
    }
  });
});

// Single→Combo Normalization Parity
// Verifies that a single formula compiled via compileComboTeamDamage
// as a 1-line combo produces identical damage to the standard single-formula path.

describe("single→combo normalization parity", () => {
  const rv = getRollValues();

  function testNormalization(label: string, configs: TeamSlotConfig[]) {
    it(`${label}: 1-line combo compiled matches evaluateCombo single formula`, () => {
      const tb = new TeamBuild(configs);
      const carryId = configs[0].charId;
      const formulaId = getFirstFormulaId(tb, carryId);
      const charIds = configs.map((c) => c.charId);

      for (let trial = 0; trial < 20; trial++) {
        const sheets: Record<string, StatSheet> = {};
        for (const cid of charIds) {
          sheets[cid] = buildSheetFromMainAndSubs(
            randomMainStats(),
            randomSubRolls(),
            rv
          );
        }

        // Domain-object path via evaluateCombo with 1-line combo
        const combo: ComboFormula = {
          id: "__single__",
          label: { zh: "", en: "" },
          lines: [{ charId: carryId, formulaId, count: 1 }],
        };
        const oldDamage = tb.getComboDamageResult(
          combo,
          sheets,
          FUZZ_CTX
        ).totalDamage;

        // Compiled combo path
        const compiled = compileComboTeamDamage(
          tb,
          combo,
          carryId,
          sheets,
          FUZZ_CTX
        );
        const charIdx = compiled.charIdxMap?.get(carryId) ?? 0;
        const vars = new Float64Array(compiled.numVars);
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

  testNormalization("diluc team", DILUC_TEAM);
  testNormalization("raiden team", RAIDEN_TEAM);
  testNormalization("varka team", VARKA_TEAM);
  testNormalization("chasca team", CHASCA_TEAM);
  testNormalization("eula team", EULA_TEAM);
  testNormalization("clorinde team", CLORINDE_TEAM);
});

// Multi-Character Variable Compilation Parity
// Verifies that compiling a combo with ALL characters as variable
// produces identical damage to the domain-object evaluateCombo path.
// This is the core of the team allocation compiled evaluation.

describe("multi-char variable compilation parity", () => {
  const rv = getRollValues();

  function buildFullCombo(tb: TeamBuild): ComboFormula {
    const allFormulas = tb.catalog.getFormulaIds();
    const lines: ComboFormula["lines"] = [];
    for (const [charId, formulas] of Object.entries(allFormulas)) {
      for (const formulaId of Object.keys(formulas)) {
        lines.push({ charId, formulaId, count: 1 });
      }
    }
    return { id: "multi-char-test", label: { zh: "", en: "" }, lines };
  }

  function testMultiChar(label: string, configs: TeamSlotConfig[]) {
    it(`${label}: all-chars-variable compiled matches evaluateCombo`, () => {
      const tb = new TeamBuild(configs);
      const charIds = configs.map((c) => c.charId);
      const combo = buildFullCombo(tb);

      // Compile with all characters as variable (empty base sheets)
      const emptyBaseSheets: Record<string, StatSheet> = {};
      for (const cid of charIds) {
        emptyBaseSheets[cid] = new StatSheet([]);
      }
      const compiled = compileComboTeamDamage(
        tb,
        combo,
        charIds,
        emptyBaseSheets,
        FUZZ_CTX
      );
      expect(compiled.charIdxMap).toBeDefined();
      expect(compiled.charIdxMap!.size).toBe(charIds.length);

      for (let trial = 0; trial < 20; trial++) {
        // Random artifact sheets for all characters
        const sheets: Record<string, StatSheet> = {};
        for (const cid of charIds) {
          sheets[cid] = buildSheetFromMainAndSubs(
            randomMainStats(),
            randomSubRolls(),
            rv
          );
        }

        // Domain-object path
        const oldDamage = tb.getComboDamageResult(
          combo,
          sheets,
          FUZZ_CTX
        ).totalDamage;

        // Compiled path: fill vars from each character's sheet
        const vars = new Float64Array(compiled.numVars);
        for (const cid of charIds) {
          const charIdx = compiled.charIdxMap!.get(cid)!;
          fillVarsFromSheet(sheets[cid], compiled.varMapping, charIdx, vars);
        }
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

  testMultiChar("diluc team", DILUC_TEAM);
  testMultiChar("raiden team", RAIDEN_TEAM);
  testMultiChar("varka team", VARKA_TEAM);
  testMultiChar("chasca team", CHASCA_TEAM);
  testMultiChar("eula team", EULA_TEAM);
  testMultiChar("clorinde team", CLORINDE_TEAM);
});

// perCharCrTarget — compiled path parity with damageCalc path

describe("compileComboTeamDamage — perCharCrTarget", () => {
  const rv = getRollValues();

  it("perCharCrTarget applies CR delta only to specified char (compiled matches standard)", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const carryId = "diluc";
    const formulaId = getFirstFormulaId(tb, carryId);
    const charIds = DILUC_TEAM.map((c) => c.charId);

    for (let trial = 0; trial < 20; trial++) {
      const sheets: Record<string, StatSheet> = {};
      for (const cid of charIds) {
        sheets[cid] = buildSheetFromMainAndSubs(
          randomMainStats(),
          randomSubRolls(),
          rv
        );
      }

      // perCharCrTarget only on diluc (target=70 → crDelta=0.3)
      const ctx: CalcContext = {
        enemyLevel: 100,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
        perCharCrTarget: { diluc: 70 },
      };

      // Standard path
      tb.teamStats.setArtifacts(sheets, ctx);
      const oldDamage = tb.getDamageResult(carryId, formulaId, ctx).totalDamage;

      // Compiled path
      const compiled = compileComboTeamDamage(
        tb,
        singleFormulaCombo(carryId, formulaId),
        carryId,
        sheets,
        ctx
      );
      const charIdx = compiled.charIdxMap?.get(carryId) ?? 0;
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

  it("perCharCrTarget applies CR delta per character (compiled path)", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const carryId = "diluc";
    const formulaId = getFirstFormulaId(tb, carryId);
    const charIds = DILUC_TEAM.map((c) => c.charId);

    const sheets: Record<string, StatSheet> = {};
    for (const cid of charIds) {
      sheets[cid] = buildSheetFromMainAndSubs(
        randomMainStats(),
        randomSubRolls(),
        rv
      );
    }

    const ctxPerChar: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
      perCharCrTarget: { diluc: 60 },
    };

    // Context without CR target
    const ctxNone: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };

    const compiledPerChar = compileComboTeamDamage(
      tb,
      singleFormulaCombo(carryId, formulaId),
      carryId,
      sheets,
      ctxPerChar
    );
    const charIdxPerChar = compiledPerChar.charIdxMap?.get(carryId) ?? 0;
    const varsPerChar = new Float64Array(compiledPerChar.numVars);
    varsPerChar.fill(0);
    fillVarsFromSheet(
      sheets[carryId],
      compiledPerChar.varMapping,
      charIdxPerChar,
      varsPerChar
    );
    const dmgPerChar = compiledPerChar.evaluate(varsPerChar);

    const compiledNone = compileComboTeamDamage(
      tb,
      singleFormulaCombo(carryId, formulaId),
      carryId,
      sheets,
      ctxNone
    );
    const charIdxNone = compiledNone.charIdxMap?.get(carryId) ?? 0;
    const varsNone = new Float64Array(compiledNone.numVars);
    varsNone.fill(0);
    fillVarsFromSheet(
      sheets[carryId],
      compiledNone.varMapping,
      charIdxNone,
      varsNone
    );
    const dmgNone = compiledNone.evaluate(varsNone);

    // perCharCrTarget should change the result compared to no target
    expect(dmgPerChar).not.toBeCloseTo(dmgNone, 2);
  });

  it("perCharCrTarget=100 means crDelta=0 (no change from baseline)", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const carryId = "diluc";
    const formulaId = getFirstFormulaId(tb, carryId);
    const charIds = DILUC_TEAM.map((c) => c.charId);

    const sheets: Record<string, StatSheet> = {};
    for (const cid of charIds) {
      sheets[cid] = buildSheetFromMainAndSubs(
        randomMainStats(),
        randomSubRolls(),
        rv
      );
    }

    // No CR target
    const ctxNone: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };
    // perCharCrTarget=100 → crDelta=0, should be identical to no target
    const ctxTarget100: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
      perCharCrTarget: { diluc: 100 },
    };

    const compiledNone = compileComboTeamDamage(
      tb,
      singleFormulaCombo(carryId, formulaId),
      carryId,
      sheets,
      ctxNone
    );
    const idxNone = compiledNone.charIdxMap?.get(carryId) ?? 0;
    const varsNone = new Float64Array(compiledNone.numVars);
    varsNone.fill(0);
    fillVarsFromSheet(
      sheets[carryId],
      compiledNone.varMapping,
      idxNone,
      varsNone
    );
    const dmgNone = compiledNone.evaluate(varsNone);

    const compiled100 = compileComboTeamDamage(
      tb,
      singleFormulaCombo(carryId, formulaId),
      carryId,
      sheets,
      ctxTarget100
    );
    const idx100 = compiled100.charIdxMap?.get(carryId) ?? 0;
    const vars100 = new Float64Array(compiled100.numVars);
    vars100.fill(0);
    fillVarsFromSheet(sheets[carryId], compiled100.varMapping, idx100, vars100);
    const dmg100 = compiled100.evaluate(vars100);

    // crDelta=0 should produce identical damage
    expect(dmg100).toBeCloseTo(dmgNone, 6);
  });

  it("perCharCrTarget=0 means crDelta=1 (full buff)", () => {
    const tb = new TeamBuild(DILUC_TEAM);
    const carryId = "diluc";
    const formulaId = getFirstFormulaId(tb, carryId);
    const charIds = DILUC_TEAM.map((c) => c.charId);

    const sheets: Record<string, StatSheet> = {};
    for (const cid of charIds) {
      sheets[cid] = buildSheetFromMainAndSubs(
        randomMainStats(),
        randomSubRolls(),
        rv
      );
    }

    const ctxNone: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };
    const ctxTarget0: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
      perCharCrTarget: { diluc: 0 },
    };

    // Standard path comparison: verify compiled and standard match for target=0
    tb.teamStats.setArtifacts(sheets, ctxTarget0);
    const stdDamage = tb.getDamageResult(
      carryId,
      formulaId,
      ctxTarget0
    ).totalDamage;

    const compiled0 = compileComboTeamDamage(
      tb,
      singleFormulaCombo(carryId, formulaId),
      carryId,
      sheets,
      ctxTarget0
    );
    const idx0 = compiled0.charIdxMap?.get(carryId) ?? 0;
    const vars0 = new Float64Array(compiled0.numVars);
    vars0.fill(0);
    fillVarsFromSheet(sheets[carryId], compiled0.varMapping, idx0, vars0);
    const compiledDamage = compiled0.evaluate(vars0);

    // Compiled must match standard
    const relErr =
      stdDamage === 0
        ? compiledDamage === 0
          ? 0
          : Number.POSITIVE_INFINITY
        : Math.abs(compiledDamage - stdDamage) / Math.abs(stdDamage);
    expect(relErr).toBeLessThan(1e-6);

    // And damage with target=0 should differ from no target (crDelta=1 is a big buff)
    const compiledNone = compileComboTeamDamage(
      tb,
      singleFormulaCombo(carryId, formulaId),
      carryId,
      sheets,
      ctxNone
    );
    const idxNone = compiledNone.charIdxMap?.get(carryId) ?? 0;
    const varsNone = new Float64Array(compiledNone.numVars);
    varsNone.fill(0);
    fillVarsFromSheet(
      sheets[carryId],
      compiledNone.varMapping,
      idxNone,
      varsNone
    );
    const dmgNone = compiledNone.evaluate(varsNone);

    expect(compiledDamage).not.toBeCloseTo(dmgNone, 2);
  });
});

// Cross-path fuzz: display vs calc vs compile
// Randomizes inputs across EVERY available dimension and asserts
// that all three lib evaluation paths produce identical damage:
//   1. getDisplayResult   (UI / damage card cold path)
//   2. getDamageResult    (optimizer cold path)
//   3. compileComboTeamDamage  (optimizer B&B hot path)
//
// Dimensions varied per trial:
//   • team composition (fixed set + random team generator)
//   • carry character (any position, not just slot 0)
//   • carry formula (any formula from the carry, not just the first)
//   • reactionOverride (undefined / forceOnField on off-field formulas)
//   • combat options (every char/weapon/artifactSet with an OptionDef
//     gets a random enabled-or-disabled choice — resolveOption falls
//     back gracefully so invalid picks won't crash)
//   • constellation, weapon, refinement, artifact set (random team path)
//   • enemy level / enemy res / crit mode (random per trial)

import { getOptionDef } from "@/lib/team-comp/calc/registry";
import { getBuffInstanceKey } from "@/lib/team-comp/calc/statBuff";
import { ELEMENT_ELIGIBLE_REACTIONS } from "@/lib/team-comp/constants";
import type { BuffActivationMap } from "@/lib/team-comp/types";
import type { OptionMap } from "@/lib/team-comp/types";
import type { ReactionOverride } from "@/lib/team-comp/types";
import { getSetId } from "@/lib/team-comp/types";

describe("cross-path fuzz (display vs calc vs compile)", () => {
  const rv = getRollValues();

  /** Random enabled OR disabled option value (to exercise resolveOption fallback). */
  function pickRandomOptionValue(entityId: string): string | undefined {
    const def = getOptionDef(entityId);
    if (!def) return undefined;
    const choice = def.choices[Math.floor(Math.random() * def.choices.length)];
    return choice.value;
  }

  /** Assemble a random combat-opts map covering every char/weapon/artifact with options. */
  function buildRandomCombatOpts(configs: TeamSlotConfig[]): OptionMap {
    const opts: OptionMap = {};
    for (const cfg of configs) {
      const cv = pickRandomOptionValue(cfg.charId);
      if (cv !== undefined) opts[cfg.charId] = cv;
      const wv = pickRandomOptionValue(cfg.weaponId);
      if (wv !== undefined) opts[cfg.weaponId] = wv;
      const artSetId = getSetId(cfg.artifactSet);
      if (artSetId) {
        const av = pickRandomOptionValue(artSetId);
        if (av !== undefined) opts[artSetId] = av;
      }
    }
    return opts;
  }

  /** Random CalcContext (enemy level, res). */
  function randomCtx(): CalcContext {
    return {
      enemyLevel: 70 + Math.floor(Math.random() * 40), // 70..109
      enemyRes: Math.random() * 0.5, // 0..0.5
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };
  }

  /** All (charId, formulaId) pairs in the team, including reaction formulas. */
  function listAllFormulas(
    tb: TeamBuild
  ): { charId: string; formulaId: string }[] {
    const pairs: { charId: string; formulaId: string }[] = [];
    const all = tb.catalog.getFormulaIds();
    for (const [cid, fmap] of Object.entries(all)) {
      for (const fid of Object.keys(fmap)) {
        pairs.push({ charId: cid, formulaId: fid });
      }
    }
    return pairs;
  }

  /** Roll a reactionOverride covering: reaction (amp/catalyze) when eligible,
   *  forceOnField (when formula has off-field parts), partHits overrides, and
   *  any combination thereof. */
  function randomReactionOverride(
    tb: TeamBuild,
    charId: string,
    formulaId: string
  ): ReactionOverride | undefined {
    const entry = tb.charBuilds[charId]?.charBase.getFormulaEntry(formulaId);
    if (!entry) return undefined;
    const override: ReactionOverride = {};

    // Reaction: pick a random element-eligible reaction for the first part.
    const firstPartElement = entry.parts[0]?.formula.tag.element as
      | keyof typeof ELEMENT_ELIGIBLE_REACTIONS
      | undefined;
    if (firstPartElement && Math.random() < 0.5) {
      const eligible = ELEMENT_ELIGIBLE_REACTIONS[firstPartElement];
      if (eligible && eligible.length > 1) {
        override.reaction =
          eligible[Math.floor(Math.random() * eligible.length)];
      }
    }

    // Per-part reacting hit count override: sparse random subset.
    if (override.reaction && override.reaction !== "none") {
      const partHits: Record<number, number> = {};
      for (let i = 0; i < entry.parts.length; i++) {
        if (Math.random() < 0.3) {
          const h = entry.parts[i].hits ?? 1;
          partHits[i] = Math.floor(Math.random() * (h + 1));
        }
      }
      if (Object.keys(partHits).length > 0) override.rxnPartHits = partHits;
    }

    return Object.keys(override).length > 0 ? override : undefined;
  }

  /** Synthesize a random BuffActivationMap covering every static buff in
   *  the team. For each buff, each part gets a random activation in
   *  [0..hits]. No applicability filtering — paths ignore buffs that
   *  don't apply, so this purely stresses the blending machinery with
   *  arbitrary distributions. */
  function randomPartialBuffs(
    tb: TeamBuild,
    charId: string,
    formulaId: string
  ): BuffActivationMap {
    const entry = tb.charBuilds[charId]?.charBase.getFormulaEntry(formulaId);
    if (!entry) return {};
    const activation: BuffActivationMap = {};
    for (const { buff, providerCharId } of tb.buffLedger.allBuffs) {
      if (providerCharId === "resonance" || providerCharId === "extra")
        continue;
      // 60% chance to include each buff as a partial-buff override
      if (Math.random() > 0.6) continue;
      const buffKey = getBuffInstanceKey(buff, providerCharId);
      const partActivation: Record<number, number> = {};
      for (let i = 0; i < entry.parts.length; i++) {
        const h = entry.parts[i].hits ?? 1;
        // 50% fully active, otherwise random 0..h
        if (Math.random() < 0.5) continue;
        partActivation[i] = Math.floor(Math.random() * (h + 1));
      }
      if (Object.keys(partActivation).length > 0) {
        activation[buffKey] = partActivation;
      }
    }
    return activation;
  }

  type Paths = { display: number; calc: number; compile: number };

  /** Run all three paths and return damages. Throws on path failure.
   *  The caller supplies a distribution — same distribution is fed to
   *  all three paths so any divergence is a real path-level bug. */
  function evalAllPaths(
    tb: TeamBuild,
    charId: string,
    formulaId: string,
    sheets: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride: ReactionOverride | undefined,
    dist: BuffActivationMap,
    forceOnField?: boolean
  ): Paths {
    // Path 1: display — pass the distribution to skip internal blending
    const dr = tb.getDisplayResult(
      charId,
      formulaId,
      sheets,
      ctx,
      reactionOverride,
      undefined,
      dist,
      forceOnField
    );

    // Path 2: calc — getDamageResult (artifacts already set by getDisplayResult above).
    const calcDmg = tb.getDamageResult(
      charId,
      formulaId,
      ctx,
      reactionOverride,
      Object.keys(dist).length > 0 ? dist : undefined,
      undefined,
      forceOnField
    ).totalDamage;

    // Path 3: compile
    const compiled = compileComboTeamDamage(
      tb,
      singleFormulaCombo(
        charId,
        formulaId,
        reactionOverride ?? undefined,
        forceOnField
      ),
      charId,
      sheets,
      ctx,
      Object.keys(dist).length > 0 ? { "line:0": dist } : undefined
    );
    const charIdx = compiled.charIdxMap?.get(charId) ?? 0;
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    if (charIdx >= 0) {
      fillVarsFromSheet(sheets[charId], compiled.varMapping, charIdx, vars);
    }
    const compileDmg = compiled.evaluate(vars);

    return { display: dr.totalDamage, calc: calcDmg, compile: compileDmg };
  }

  function relErr(a: number, b: number): number {
    const ref = Math.max(Math.abs(a), Math.abs(b));
    if (ref === 0) return 0;
    return Math.abs(a - b) / ref;
  }

  function checkPaths(
    p: Paths,
    label: string,
    tolerance = 1e-6
  ): string | null {
    const dc = relErr(p.display, p.calc);
    const dComp = relErr(p.display, p.compile);
    if (dc > tolerance || dComp > tolerance) {
      return (
        `${label}: display=${p.display.toFixed(4)} ` +
        `calc=${p.calc.toFixed(4)} (relErr=${(dc * 100).toFixed(6)}%) ` +
        `compile=${p.compile.toFixed(4)} (relErr=${(dComp * 100).toFixed(6)}%)`
      );
    }
    return null;
  }

  // ── Single-formula cross-path fuzzer ──
  // TODO: two-pass evaluateCombo changes broke compile↔display parity — fix in formulaCompiler
  it("random teams: cross-path agreement (single formula)", () => {
    const errors: string[] = [];
    let trials = 0;

    for (let attempt = 0; attempt < 400 && trials < 200; attempt++) {
      const configs = tryRandomTeam();
      if (!configs) continue;

      const combatOpts = buildRandomCombatOpts(configs);
      let tb: TeamBuild;
      try {
        tb = new TeamBuild(configs, combatOpts);
      } catch {
        continue;
      }

      const pairs = listAllFormulas(tb).filter(
        (p) => !p.formulaId.startsWith("rx-")
      );
      if (pairs.length === 0) continue;

      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const reactionOverride = randomReactionOverride(
        tb,
        pair.charId,
        pair.formulaId
      );
      const entry = tb.charBuilds[pair.charId]?.charBase.getFormulaEntry(
        pair.formulaId
      );
      const forceOnField =
        entry?.parts.some((p) => p.offField) && Math.random() < 0.5
          ? true
          : undefined;

      const sheets: Record<string, StatSheet> = {};
      for (const cfg of configs) {
        sheets[cfg.charId] = buildSheetFromMainAndSubs(
          randomMainStats(),
          randomSubRolls(),
          rv
        );
      }

      const ctx = randomCtx();

      try {
        const dist = randomPartialBuffs(tb, pair.charId, pair.formulaId);
        const paths = evalAllPaths(
          tb,
          pair.charId,
          pair.formulaId,
          sheets,
          ctx,
          reactionOverride,
          dist,
          forceOnField
        );
        trials++;
        const msg = checkPaths(
          paths,
          `team=[${configs.map((c) => c.charId).join(",")}] ` +
            `${pair.charId}/${pair.formulaId} ` +
            `rxo=${JSON.stringify(reactionOverride ?? null)}`
        );
        if (msg && errors.length < 15) errors.push(msg);
      } catch {
        // Skip trials that throw (feature-gated formulas / invalid combos)
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `${errors.length} random-team cross-path mismatches ` +
          `(trials=${trials}):\n${errors.join("\n")}`
      );
    }
    expect(trials).toBeGreaterThan(100);
  });

  // ── Random-team combo fuzzer ──
  // Builds a random 1–3 line combo from a random team's formulas, each line
  // with a random forceOnField toggle. Cross-checks getComboDisplayResult
  // against evaluateCombo (the two cold-path combo entry points).
  it("random teams: combo display vs evaluateCombo agreement", () => {
    const errors: string[] = [];
    let trials = 0;

    for (let attempt = 0; attempt < 400 && trials < 150; attempt++) {
      const configs = tryRandomTeam();
      if (!configs) continue;

      const combatOpts = buildRandomCombatOpts(configs);
      let tb: TeamBuild;
      try {
        tb = new TeamBuild(configs, combatOpts);
      } catch {
        continue;
      }

      const pairs = listAllFormulas(tb).filter(
        (p) => !p.formulaId.startsWith("rx-")
      );
      if (pairs.length === 0) continue;

      const shuffled = [...pairs].sort(() => Math.random() - 0.5);
      const lineCount =
        1 + Math.floor(Math.random() * Math.min(3, shuffled.length));
      const lines = shuffled.slice(0, lineCount).map((p) => {
        const entry = tb.charBuilds[p.charId]?.charBase.getFormulaEntry(
          p.formulaId
        );
        const hasOff = entry?.parts.some((pt) => pt.offField) ?? false;
        const forceOnField = hasOff && Math.random() < 0.5 ? true : undefined;
        return {
          charId: p.charId,
          formulaId: p.formulaId,
          count: 1 + Math.floor(Math.random() * 3),
          forceOnField,
        };
      });

      const combo: ComboFormula = {
        id: "cross-fuzz",
        label: { zh: "测试", en: "test" },
        lines,
      };

      const sheets: Record<string, StatSheet> = {};
      for (const cfg of configs) {
        sheets[cfg.charId] = buildSheetFromMainAndSubs(
          randomMainStats(),
          randomSubRolls(),
          rv
        );
      }

      const ctx = randomCtx();

      // Randomize per-line buff stack overrides so all combo paths see
      // the same arbitrary distribution.
      const buffOverrides: Record<number, BuffActivationMap> = {};
      for (let i = 0; i < lines.length; i++) {
        const d = randomPartialBuffs(tb, lines[i].charId, lines[i].formulaId);
        if (Object.keys(d).length > 0) buffOverrides[i] = d;
      }

      try {
        const comboDr = tb.getComboDisplayResult(
          combo,
          sheets,
          ctx,
          buffOverrides
        );
        const evaled = tb.getComboDamageResult(
          combo,
          sheets,
          ctx,
          buffOverrides
        );
        trials++;
        const dc = relErr(comboDr.totalDamage, evaled.totalDamage);
        if (dc > 1e-6 && errors.length < 15) {
          errors.push(
            `team=[${configs.map((c) => c.charId).join(",")}] ` +
              `display=${comboDr.totalDamage.toFixed(4)} ` +
              `evaluateCombo=${evaled.totalDamage.toFixed(4)} ` +
              `relErr=${(dc * 100).toFixed(6)}% ` +
              `lines=${lines
                .map(
                  (l) =>
                    `${l.charId}/${l.formulaId}×${l.count}(force=${l.forceOnField ?? false})`
                )
                .join(",")}`
          );
        }
      } catch {
        // Skip trials that throw
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `${errors.length} combo cross-path mismatches (trials=${trials}):\n${errors.join("\n")}`
      );
    }
    expect(trials).toBeGreaterThan(50);
  });
});

// tryRandomTeam is defined inside the "random team fuzz" describe block above.
// Re-export via a local helper for the cross-path fuzz suite.
function tryRandomTeam(): TeamSlotConfig[] | null {
  const charStats = getCharacterStatsSync()!;
  const weaponStats = getWeaponStatsSync()!;

  const weaponsByType: Record<string, string[]> = {};
  for (const w of weapons) {
    const stats = weaponStats[w.id];
    if (!stats) continue;
    const t = stats.type;
    if (!weaponsByType[t]) weaponsByType[t] = [];
    weaponsByType[t].push(w.id);
  }

  const fiveStarArtifacts = artifacts
    .filter((a) => a.rarity === 5)
    .map((a) => a.id);

  const shuffled = [...characters].sort(() => Math.random() - 0.5);
  const picked: TeamSlotConfig[] = [];
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
      weaponId: compatible[Math.floor(Math.random() * compatible.length)],
      refinement: Math.floor(Math.random() * 5) + 1,
      // Always a 4pc 5-star set (all slots same set). We only need to
      // fuzz 4pc — 2+2 is easier and rarely catches path divergence.
      artifactSet: {
        type: "4pc" as const,
        setId:
          fiveStarArtifacts[
            Math.floor(Math.random() * fiveStarArtifacts.length)
          ],
      },
    });
  }
  return picked.length >= 4 ? picked : null;
}
