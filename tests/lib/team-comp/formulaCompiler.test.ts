import { describe, expect, it } from "vitest";

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
import {
  VarMapping,
  createExprStats,
} from "@/lib/team-comp/exprStats";
import { ScalingBuff, CrossScalingBuff } from "@/lib/team-comp/damageBuffs";
import type { CalcContext, CharCompConfig, ComboFormula, StatKey } from "@/lib/team-comp/types";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild, evaluateCombo } from "@/lib/team-comp/damageCalc";
import {
  compileTeamDamage,
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/team-comp/formulaCompiler";
import { buildSheetFromMainAndSubs, emptySubRolls, getRollValues } from "@/lib/team-comp/constrainedGreedy";
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
  const base = new StatSheet(
    baseStats.map(([key, value]) => ({ key, value }))
  );
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
      const artValues: [StatKey, number][] = [
        ["em", Math.random() * 800],
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
  for (const slot of ["flower", "plume", "sands", "goblet", "circlet"] as const) {
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
        const oldDamage = tb.getDamageResult(
          carryId,
          formulaId,
          teamStats,
          FUZZ_CTX
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
              : Infinity
            : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);
        expect(relErr).toBeLessThan(1e-6);
      }
    });
  }

  fuzzTeam("diluc team (carry swap)", DILUC_TEAM);
  fuzzTeam("raiden team (carry swap)", RAIDEN_TEAM);

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
      const charIdx = optCtx.charBuildOrder.findIndex(
        ([id]) => id === swapId
      );
      const vars = new Float64Array(compiled.numVars);
      vars.fill(0);
      fillVarsFromSheet(sheets[swapId], compiled.varMapping, charIdx, vars);
      const newDamage = compiled.evaluate(vars);

      const teamStats = tb.getTeamStats(sheets, carryId, FUZZ_CTX);
      const oldDamage = tb.getDamageResult(
        carryId,
        formulaId,
        teamStats,
        FUZZ_CTX
      ).totalDamage;

      const relErr =
        oldDamage === 0
          ? newDamage === 0
            ? 0
            : Infinity
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
        lines.push({ charId, formulaId, count: 1 + Math.floor(Math.random() * 3) });
      }
    }
    return { id: "fuzz-combo", label: { zh: "测试", en: "test" }, lines };
  }

  function fuzzComboTeam(
    label: string,
    configs: CharCompConfig[]
  ) {
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
          const oldDamage = evaluateCombo(tb, combo, sheets, FUZZ_CTX)
            .totalDamage;

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
                : Infinity
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

    const singleOverrides: Record<string, import("@/lib/team-comp/types").ReactionOverride> = {
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
            : Infinity
          : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);
      expect(relErr).toBeLessThan(1e-6);
    }
  });
});
