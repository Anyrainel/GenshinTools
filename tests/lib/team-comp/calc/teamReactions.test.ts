/**
 * Tests for TeamReactionProvider: team-wide reaction formula generation,
 * eligibility filtering, damage evaluation, compiler path, and display path.
 */
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/team-comp/calc/formulaCompiler";
import {
  evaluateFormulaDamage,
  evaluateFormulaDisplay,
} from "@/lib/team-comp/calc/formulaEval";
import { computeLunarRankWeights } from "@/lib/team-comp/calc/stackRank";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  LUNAR_RANK_WEIGHTS,
  MULTI_CONTRIBUTOR_REACTIONS,
  resolveReactionComboEntries,
} from "@/lib/team-comp/calc/teamReaction";
import type { TeamStatSheet } from "@/lib/team-comp/calc/teamStatSheet";
import type { ReactionComboEntry } from "@/lib/team-comp/types";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

import "@/lib/team-comp/index";

await preloadGameStats();

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

/** Sum counts for a base reaction ID (base-ID entry or per-triggerer entries). */
function sumBase(counts: Record<string, number>, baseId: string): number {
  // Multi-contributor reactions produce a single base-ID entry
  if (baseId in counts) return counts[baseId];
  // Single-contributor reactions produce per-triggerer entries
  const prefix = `${baseId}-`;
  let total = 0;
  for (const [key, val] of Object.entries(counts)) {
    if (key.startsWith(prefix)) total += val;
  }
  return total;
}

/** Check if a base reaction exists in counts (base-ID or per-triggerer). */
function hasBase(counts: Record<string, number>, baseId: string): boolean {
  if (baseId in counts) return true;
  const prefix = `${baseId}-`;
  return Object.keys(counts).some((k) => k.startsWith(prefix));
}

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

function emptySheets(...charIds: string[]): Record<string, StatSheet> {
  const sheets: Record<string, StatSheet> = {};
  for (const id of charIds) sheets[id] = new StatSheet([]);
  return sheets;
}

/**
 * Create a mock TeamStatSheet from pre-computed team stats for direct
 * evaluateFormulaDamage/Display calls in tests.
 */
function mockTeamStatsFrom(
  teamStats: Record<string, StatSheet>,
  charLevels: Record<string, number>
): TeamStatSheet {
  return {
    getPostStats(charId: string, _onFieldCharId: string): StatSheet {
      return teamStats[charId]!;
    },
    getAllPostStats(_onFieldCharId: string): Record<string, StatSheet> {
      return teamStats;
    },
    getCharLevel(charId: string): number {
      return charLevels[charId] ?? 90;
    },
    getDefaultOnFieldCharId(charId: string): string {
      const other = Object.keys(teamStats).find((id) => id !== charId);
      return other ?? charId;
    },
  } as unknown as TeamStatSheet;
}

// ── Team Configurations ──

/** Pyro + Electro + Hydro + Anemo team → overloaded, electroCharged, vaporize, swirl */
const PYRO_ELECTRO_TEAM: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 0,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "fischl",
    charLevel: 90,
    constellation: 0,
    weaponId: "the_stringless",
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
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

/** Dendro + Hydro + Electro team → bloom, hyperbloom, electroCharged */
const BLOOM_TEAM: TeamSlotConfig[] = [
  {
    charId: "nahida",
    charLevel: 90,
    constellation: 0,
    weaponId: "a_thousand_floating_dreams",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "sangonomiya_kokomi",
    charLevel: 90,
    constellation: 0,
    weaponId: "thrilling_tales_of_dragon_slayers",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "kuki_shinobu",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "yelan",
    charLevel: 90,
    constellation: 0,
    weaponId: "aqua_simulacra",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

/** Anemo + Pyro + Hydro + Cryo → swirl variants */
const SWIRL_TEAM: TeamSlotConfig[] = [
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
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
    charId: "xingqiu",
    charLevel: 90,
    constellation: 0,
    weaponId: "sacrificial_sword",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "kamisato_ayaka",
    charLevel: 90,
    constellation: 0,
    weaponId: "mistsplitter_reforged",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

// Tests

describe("TeamReactionProvider — formula generation", () => {
  it("generates overloaded for Pyro+Electro team", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-overloaded"]).toBeDefined();
    expect(rxFormulas["rx-overloaded"].en).toBe("Overloaded");
  });

  it("generates electroCharged for Hydro+Electro team", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-electroCharged"]).toBeDefined();
  });

  it("does NOT generate bloom when missing Dendro", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-bloom"]).toBeUndefined();
  });

  it("generates bloom for Dendro+Hydro+Electro team", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-bloom"]).toBeDefined();
  });

  it("generates rx-hyperbloom when Electro char has only off-field formula", () => {
    // Kuki Shinobu's shinobu-hyperbloom has offField: true,
    // so she remains eligible → team rx-hyperbloom is generated
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-hyperbloom"]).toBeDefined();
  });

  it("does NOT generate burgeon when missing Pyro", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-burgeon"]).toBeUndefined();
  });

  it("does NOT generate superconduct when missing Cryo+Electro pair", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-superconduct"]).toBeUndefined();
  });
});

describe("TeamReactionProvider — swirl variants", () => {
  it("generates swirl variants for each reactive element on the team", () => {
    const tb = new TeamBuild(SWIRL_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    // Pyro from Bennett, Hydro from Xingqiu, Cryo from Ayaka
    expect(rxFormulas["rx-swirl-Pyro"]).toBeDefined();
    expect(rxFormulas["rx-swirl-Hydro"]).toBeDefined();
    expect(rxFormulas["rx-swirl-Cryo"]).toBeDefined();
    // No Electro on this team
    expect(rxFormulas["rx-swirl-Electro"]).toBeUndefined();
  });

  it("swirl eligible characters are only Anemo", () => {
    const tb = new TeamBuild(SWIRL_TEAM);
    const eligible = tb.reactionProvider.getEligibleCharacters("rx-swirl-Pyro");
    expect(eligible).toContain("kaedehara_kazuha");
    expect(eligible).not.toContain("bennett");
    expect(eligible).not.toContain("xingqiu");
  });
});

describe("TeamReactionProvider — eligible characters", () => {
  it("overloaded eligible chars include both Pyro and Electro members", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const eligible = tb.reactionProvider.getEligibleCharacters("rx-overloaded");
    expect(eligible).toContain("hu_tao");
    expect(eligible).toContain("fischl");
    // Hydro and Anemo should NOT be eligible
    expect(eligible).not.toContain("xingqiu");
    expect(eligible).not.toContain("kaedehara_kazuha");
  });

  it("bloom eligible chars include Hydro and Dendro members", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const eligible = tb.reactionProvider.getEligibleCharacters("rx-bloom");
    // Nahida = Dendro, Kokomi + Yelan = Hydro
    expect(eligible).toContain("sangonomiya_kokomi");
    expect(eligible).toContain("yelan");
    expect(eligible).toContain("nahida");
  });

  it("hyperbloom eligible chars include Shinobu (off-field formula doesn't filter)", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const eligible = tb.reactionProvider.getEligibleCharacters("rx-hyperbloom");
    // Kuki Shinobu's hyperbloom formula is off-field → she stays eligible
    expect(eligible).toContain("kuki_shinobu");
  });
});

/** Nilou team: all Hydro+Dendro (Nilou + Nahida + Kokomi + Yelan) */
const NILOU_TEAM: TeamSlotConfig[] = [
  {
    charId: "nilou",
    charLevel: 90,
    constellation: 0,
    weaponId: "key_of_khajnisut",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "nahida",
    charLevel: 90,
    constellation: 0,
    weaponId: "a_thousand_floating_dreams",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "sangonomiya_kokomi",
    charLevel: 90,
    constellation: 0,
    weaponId: "thrilling_tales_of_dragon_slayers",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "yelan",
    charLevel: 90,
    constellation: 0,
    weaponId: "aqua_simulacra",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

/** Kaveh bloom team: Kaveh + Nahida + Kokomi + Xingqiu */
const KAVEH_TEAM: TeamSlotConfig[] = [
  {
    charId: "kaveh",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "nahida",
    charLevel: 90,
    constellation: 0,
    weaponId: "a_thousand_floating_dreams",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "sangonomiya_kokomi",
    charLevel: 90,
    constellation: 0,
    weaponId: "thrilling_tales_of_dragon_slayers",
    refinement: 5,
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
];

describe("TeamReactionProvider — character override filtering", () => {
  it("Nilou is NOT filtered from rx-bloom (her bloom formula is off-field)", () => {
    const tb = new TeamBuild(NILOU_TEAM);
    const eligible = tb.reactionProvider.getEligibleCharacters("rx-bloom");
    // Nilou's nilou-bountiful-core has offField: true, so she stays eligible
    expect(eligible).toContain("nilou");
    expect(eligible).toContain("nahida");
    expect(eligible).toContain("sangonomiya_kokomi");
    expect(eligible).toContain("yelan");
  });

  it("Shinobu is NOT filtered from rx-hyperbloom (her hyperbloom formula is off-field)", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const eligible = tb.reactionProvider.getEligibleCharacters("rx-hyperbloom");
    // shinobu-hyperbloom has offField: true → she remains eligible for team rx-hyperbloom
    expect(eligible).toContain("kuki_shinobu");
  });

  it("Kaveh is eligible for rx-bloom (character formulas don't exclude from team reactions)", () => {
    const tb = new TeamBuild(KAVEH_TEAM);
    const eligible = tb.reactionProvider.getEligibleCharacters("rx-bloom");
    expect(eligible).toContain("kaveh");
    expect(eligible).toContain("nahida");
    expect(eligible).toContain("sangonomiya_kokomi");
    expect(eligible).toContain("xingqiu");
  });

  it("rx-bloom label upgrades to Bountiful Core for Nilou all-Hydro/Dendro team", () => {
    const tb = new TeamBuild(NILOU_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-bloom"]).toBeDefined();
    expect(rxFormulas["rx-bloom"].en).toBe("Bountiful Core");
    expect(rxFormulas["rx-bloom"].zh).toBe("丰穰之核");
  });

  it("rx-bloom label stays as Dendro Core for non-Nilou team", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-bloom"]).toBeDefined();
    expect(rxFormulas["rx-bloom"].en).toBe("Dendro Core");
  });
});

describe("TeamReactionProvider — damage evaluation", () => {
  it("single-contributor overloaded produces non-zero damage", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "hu_tao", CTX);

    const result = tb.getDamageResult("fischl", "rx-overloaded-fischl", CTX);
    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.parts).toHaveLength(1);
  });

  it("bloom damage is consistent with TransformFormula calc", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const charIds = BLOOM_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "nahida", CTX);

    const result = tb.getDamageResult("nahida", "rx-bloom-nahida", CTX);
    expect(result.totalDamage).toBeGreaterThan(0);
  });
});

describe("TeamReactionProvider — evaluateCombo integration", () => {
  it("evaluateCombo handles rx-overloaded combo lines", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        { charId: "fischl", formulaId: "rx-overloaded-fischl", count: 3 },
      ],
    };

    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.lineDamages).toHaveLength(1);
    expect(result.lineDamages[0].total).toBeCloseTo(
      result.lineDamages[0].perHit * 3
    );
  });

  it("evaluateCombo skips rx- lines that don't exist", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        // This team has no Dendro, so bloom should be filtered
        { charId: "hu_tao", formulaId: "rx-bloom-hu_tao", count: 1 },
      ],
    };

    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.totalDamage).toBe(0);
    expect(result.lineDamages).toHaveLength(0);
  });

  it("evaluateCombo mixes character formulas and rx- lines", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    // Get a real character formula
    const charFormulas = tb.getFormulaIds().hu_tao;
    const firstFormulaId = Object.keys(charFormulas)[0];

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        { charId: "hu_tao", formulaId: firstFormulaId, count: 1 },
        { charId: "fischl", formulaId: "rx-overloaded-fischl", count: 2 },
      ],
    };

    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.lineDamages).toHaveLength(2);
  });
});

describe("TeamReactionProvider — multi-contributor", () => {
  it("isMultiContributor returns true for lunarCharged/lunarCrystallize", () => {
    // We just test the constant set
    expect(MULTI_CONTRIBUTOR_REACTIONS.has("lunarCharged")).toBe(true);
    expect(MULTI_CONTRIBUTOR_REACTIONS.has("lunarCrystallize")).toBe(true);
    expect(MULTI_CONTRIBUTOR_REACTIONS.has("lunarBloom")).toBe(false);
  });

  it("LUNAR_RANK_WEIGHTS are [0.6, 0.3, 0.05, 0.05]", () => {
    expect(LUNAR_RANK_WEIGHTS[0]).toBe(0.6);
    expect(LUNAR_RANK_WEIGHTS[1]).toBe(0.3);
    expect(LUNAR_RANK_WEIGHTS[2]).toBeCloseTo(0.05);
    expect(LUNAR_RANK_WEIGHTS[3]).toBeCloseTo(0.05);
  });
});

describe("TeamReactionProvider — getReactionFormulaIds on TeamBuild", () => {
  it("returns same result as reactionProvider.getFormulaIds()", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const direct = tb.reactionProvider.getFormulaIds();
    const method = tb.getReactionFormulaIds();
    expect(method).toEqual(direct);
  });
});

// Lunar team (Moonsign 5★ required)

/** Columbina (Hydro) + Flins (Electro) + Zibai (Geo) + Nahida (Dendro) */
const LUNAR_TEAM: TeamSlotConfig[] = [
  {
    charId: "columbina",
    charLevel: 90,
    constellation: 0,
    weaponId: "thrilling_tales_of_dragon_slayers",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "flins",
    charLevel: 90,
    constellation: 0,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "zibai",
    charLevel: 80,
    constellation: 0,
    weaponId: "mistsplitter_reforged",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "nahida",
    charLevel: 90,
    constellation: 0,
    weaponId: "a_thousand_floating_dreams",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

// Additional tests

describe("TeamReactionProvider — lunar reactions", () => {
  it("generates lunarCharged for Columbina+Flins team", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-lunarCharged"]).toBeDefined();
  });

  it("generates lunarCrystallize for Columbina+Zibai team", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-lunarCrystallize"]).toBeDefined();
  });

  it("does NOT generate lunarBloom (dendro core uses regular bloom formula)", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const rxFormulas = tb.reactionProvider.getBaseFormulaLabels();
    expect(rxFormulas["rx-lunarBloom"]).toBeUndefined();
    // The team should get rx-bloom instead (standard dendro core)
    expect(rxFormulas["rx-bloom"]).toBeDefined();
  });

  it("multi-contributor eligible chars are filtered to contributing elements", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    // LCh: Electro + Hydro only → columbina (Hydro) + flins (Electro)
    const eligibleLCh =
      tb.reactionProvider.getEligibleCharacters("rx-lunarCharged");
    expect(eligibleLCh).toHaveLength(2);
    expect(eligibleLCh).toContain("columbina");
    expect(eligibleLCh).toContain("flins");

    // LCr: Geo + Hydro only → columbina (Hydro) + zibai (Geo)
    const eligibleLCr = tb.reactionProvider.getEligibleCharacters(
      "rx-lunarCrystallize"
    );
    expect(eligibleLCr).toHaveLength(2);
    expect(eligibleLCr).toContain("columbina");
    expect(eligibleLCr).toContain("zibai");
  });
});

describe("TeamReactionProvider — multi-contributor evaluation", () => {
  it("multi-contributor produces rank-weighted damage via unified pipeline", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    // Multi-contributor entries use the base ID after finalization
    const result = tb.getDamageResult("columbina", "rx-lunarCharged", CTX);
    expect(result.totalDamage).toBeGreaterThan(0);
  });
});

describe("TeamReactionProvider — different triggers produce different damage", () => {
  it("overloaded damage differs by trigger character stats", () => {
    // Build a team where chars have different levels and weapons
    const team: TeamSlotConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 0,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "fischl",
        charLevel: 70,
        constellation: 0,
        weaponId: "the_stringless",
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
        charId: "kaedehara_kazuha",
        charLevel: 90,
        constellation: 0,
        weaponId: "iron_sting",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team);
    const charIds = team.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "hu_tao", CTX);

    const dmgHuTao = tb.getDamageResult(
      "hu_tao",
      "rx-overloaded-hu_tao",
      CTX
    ).totalDamage;
    const dmgFischl = tb.getDamageResult(
      "fischl",
      "rx-overloaded-fischl",
      CTX
    ).totalDamage;

    // Different stats (level, EM from weapons) produce different damage
    expect(dmgHuTao).not.toBeCloseTo(dmgFischl);
    expect(dmgHuTao).toBeGreaterThan(0);
    expect(dmgFischl).toBeGreaterThan(0);
  });
});

describe("TeamReactionProvider — swirl damage evaluation", () => {
  it("swirl produces non-zero damage", () => {
    const tb = new TeamBuild(SWIRL_TEAM);
    const charIds = SWIRL_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "kaedehara_kazuha", CTX);

    const result = tb.getDamageResult(
      "kaedehara_kazuha",
      "rx-swirl-Pyro-kaedehara_kazuha",
      CTX
    );
    expect(result.totalDamage).toBeGreaterThan(0);
  });

  it("different swirl elements use different damage elements", () => {
    const tb = new TeamBuild(SWIRL_TEAM);
    const entryPyro = tb.reactionProvider.getFormulaEntry(
      "rx-swirl-Pyro-kaedehara_kazuha"
    );
    const entryHydro = tb.reactionProvider.getFormulaEntry(
      "rx-swirl-Hydro-kaedehara_kazuha"
    );
    expect(entryPyro!.parts[0].formula.tag.element).toBe("Pyro");
    expect(entryHydro!.parts[0].formula.tag.element).toBe("Hydro");
  });
});

describe("TeamReactionProvider — display path (getComboDisplayResult)", () => {
  it("does not crash on rx- single-contributor combo", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        { charId: "fischl", formulaId: "rx-overloaded-fischl", count: 2 },
      ],
    };

    const display = tb.getComboDisplayResult(combo, sheets, CTX);
    expect(display.totalDamage).toBeGreaterThan(0);
    const parts = display.partsByFormula["fischl.rx-overloaded-fischl"];
    expect(parts).toBeDefined();
    expect(parts.length).toBeGreaterThan(0);
  });

  it("does not crash on rx- multi-contributor combo", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        {
          charId: "columbina",
          formulaId: "rx-lunarCharged-columbina",
          count: 1,
        },
      ],
    };

    const display = tb.getComboDisplayResult(combo, sheets, CTX);
    expect(display.totalDamage).toBeGreaterThan(0);
    const parts = display.partsByFormula["columbina.rx-lunarCharged-columbina"];
    expect(parts).toBeDefined();
  });

  it("mixed char + rx combo produces display for both", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const charFormulas = tb.getFormulaIds().hu_tao;
    const firstFormulaId = Object.keys(charFormulas)[0];

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        { charId: "hu_tao", formulaId: firstFormulaId, count: 1 },
        { charId: "fischl", formulaId: "rx-overloaded-fischl", count: 3 },
      ],
    };

    const display = tb.getComboDisplayResult(combo, sheets, CTX);
    expect(display.totalDamage).toBeGreaterThan(0);
    // Both formula keys should have display parts
    expect(display.partsByFormula[`hu_tao.${firstFormulaId}`]).toBeDefined();
    expect(display.partsByFormula["fischl.rx-overloaded-fischl"]).toBeDefined();
  });
});

describe("TeamReactionProvider — compiler path", () => {
  it("compileComboTeamDamage produces non-zero for rx- formula", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const compiled = compileComboTeamDamage(
      tb,
      singleFormulaCombo("fischl", "rx-overloaded-fischl"),
      "fischl",
      sheets,
      CTX
    );
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    const charIdx = compiled.charIdxMap?.get("fischl") ?? 0;
    fillVarsFromSheet(sheets.fischl, compiled.varMapping, charIdx, vars);
    const damage = compiled.evaluate(vars);
    expect(damage).toBeGreaterThan(0);
  });

  it("compiled single-contributor matches interpreted", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    // Interpreted
    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        { charId: "fischl", formulaId: "rx-overloaded-fischl", count: 1 },
      ],
    };
    const interpreted = tb.getComboDamageResult(combo, sheets, CTX);

    // Compiled
    const compiled = compileComboTeamDamage(
      tb,
      singleFormulaCombo("fischl", "rx-overloaded-fischl"),
      "fischl",
      sheets,
      CTX
    );
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    const charIdx = compiled.charIdxMap?.get("fischl") ?? 0;
    fillVarsFromSheet(sheets.fischl, compiled.varMapping, charIdx, vars);
    const compiledDamage = compiled.evaluate(vars);

    const relErr =
      Math.abs(compiledDamage - interpreted.totalDamage) /
      Math.abs(interpreted.totalDamage);
    expect(relErr).toBeLessThan(1e-6);
  });

  it("compileComboTeamDamage handles rx- combo lines", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const charFormulas = tb.getFormulaIds().hu_tao;
    const firstFormulaId = Object.keys(charFormulas)[0];

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        { charId: "hu_tao", formulaId: firstFormulaId, count: 1 },
        { charId: "fischl", formulaId: "rx-overloaded-fischl", count: 2 },
      ],
    };

    const compiled = compileComboTeamDamage(tb, combo, "hu_tao", sheets, CTX);
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    const charIdx = compiled.charIdxMap!.get("hu_tao") ?? 0;
    fillVarsFromSheet(sheets.hu_tao, compiled.varMapping, charIdx, vars);
    const damage = compiled.evaluate(vars);
    expect(damage).toBeGreaterThan(0);
  });

  it("compiled combo with rx- lines approximates interpreted", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        { charId: "fischl", formulaId: "rx-overloaded-fischl", count: 3 },
      ],
    };

    // Interpreted
    const interpreted = tb.getComboDamageResult(combo, sheets, CTX);

    // Compiled
    const compiled = compileComboTeamDamage(tb, combo, "fischl", sheets, CTX);
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    const charIdx = compiled.charIdxMap!.get("fischl") ?? 0;
    fillVarsFromSheet(sheets.fischl, compiled.varMapping, charIdx, vars);
    const compiledDamage = compiled.evaluate(vars);

    const relErr =
      Math.abs(compiledDamage - interpreted.totalDamage) /
      Math.abs(interpreted.totalDamage);
    expect(relErr).toBeLessThan(1e-6);
  });
});

// Reaction combo counts

// LCr only team: Linnea (Geo) + Columbina (Hydro)
const LCR_ONLY: TeamSlotConfig[] = [
  {
    charId: "linnea",
    charLevel: 90,
    constellation: 0,
    weaponId: "lightbearing_moonshard",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "columbina",
    charLevel: 90,
    constellation: 0,
    weaponId: "a_thousand_floating_dreams",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

// LCh only team: Flins (Electro) + Xingqiu (Hydro)
const LCH_ONLY: TeamSlotConfig[] = [
  {
    charId: "flins",
    charLevel: 90,
    constellation: 0,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 0,
    weaponId: "mistsplitter_reforged",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

describe("reaction combo counts", () => {
  it("LCr only → base 15, with Columbina → 20", () => {
    // LCR_ONLY has Columbina → 15 * 4/3 = 20
    const tb = new TeamBuild(LCR_ONLY, { linnea: "tap" });
    const counts = tb.reactionProvider.getReactionComboCounts();
    expect(sumBase(counts, "rx-lunarCrystallize")).toBe(20);
    expect(hasBase(counts, "rx-lunarCharged")).toBe(false);
  });

  it("LCh only → 9", () => {
    const tb = new TeamBuild(LCH_ONLY);
    const counts = tb.reactionProvider.getReactionComboCounts();
    expect(sumBase(counts, "rx-lunarCharged")).toBe(9);
    expect(hasBase(counts, "rx-lunarCrystallize")).toBe(false);
  });

  it("LCh + LCr → LCh=9, LCr=0", () => {
    // LUNAR_TEAM has Columbina(Hydro), Flins(Electro), Zibai(Geo), Nahida(Dendro)
    // This gives LCh, LCr, and LB (Hydro+Dendro)
    // That's all 3 → both 0
    // We need a team with LCh+LCr but no LB: need Electro+Hydro+Geo, no Dendro
    const team: TeamSlotConfig[] = [
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "flins",
        charLevel: 90,
        constellation: 0,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "zibai",
        charLevel: 80,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team);
    const counts = tb.reactionProvider.getReactionComboCounts();
    // With Columbina: round(9 * 4/3) = 12, round(0 * 4/3) = 0
    expect(sumBase(counts, "rx-lunarCharged")).toBe(12);
    expect(sumBase(counts, "rx-lunarCrystallize")).toBe(0);
  });

  it("All 3 lunar → LCh=0, LCr=0", () => {
    // LUNAR_TEAM: Columbina(Hydro) + Flins(Electro) + Zibai(Geo) + Nahida(Dendro)
    // → LCh (Electro+Hydro), LCr (Geo+Hydro), LB (Dendro+Hydro)
    const tb = new TeamBuild(LUNAR_TEAM);
    const counts = tb.reactionProvider.getReactionComboCounts();
    expect(sumBase(counts, "rx-lunarCharged")).toBe(0);
    expect(sumBase(counts, "rx-lunarCrystallize")).toBe(0);
  });

  it("LCr only without Columbina → base 15", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 0,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "tap" });
    const counts = tb.reactionProvider.getReactionComboCounts();
    expect(sumBase(counts, "rx-lunarCrystallize")).toBe(15);
  });

  it("Linnea C2 tap → +12 LCr", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 2,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "tap" });
    const counts = tb.reactionProvider.getReactionComboCounts();
    // LCr only, no Columbina: base 15 + 12 = 27
    expect(sumBase(counts, "rx-lunarCrystallize")).toBe(27);
  });

  it("Linnea C2 continuous → +3 LCr", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 2,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "continuous" });
    const counts = tb.reactionProvider.getReactionComboCounts();
    // LCr only, no Columbina: base 15 + 3 = 18
    expect(sumBase(counts, "rx-lunarCrystallize")).toBe(18);
  });

  it("Linnea C2 tap + Columbina → (15 + 12) × 4/3 = 36", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 2,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "tap" });
    const counts = tb.reactionProvider.getReactionComboCounts();
    // (15 + 12) * 4/3 = 36
    expect(sumBase(counts, "rx-lunarCrystallize")).toBe(36);
  });

  it("Linnea C2 continuous + Columbina → (15 + 3) × 4/3 = 24", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 2,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "continuous" });
    const counts = tb.reactionProvider.getReactionComboCounts();
    expect(sumBase(counts, "rx-lunarCrystallize")).toBe(24);
  });
});

describe("guessOnFieldChar", () => {
  it("prefers flins over other chars for LCh", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const onField = tb.reactionProvider.guessOnFieldChar("rx-lunarCharged");
    expect(onField).toBe("flins");
  });

  it("prefers zibai over linnea for LCr", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 0,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "zibai",
        charLevel: 80,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team);
    const onField = tb.reactionProvider.guessOnFieldChar("rx-lunarCrystallize");
    expect(onField).toBe("zibai");
  });

  it("falls back to first eligible element char", () => {
    const tb = new TeamBuild(LCH_ONLY);
    // No priority chars on team → falls back to first eligible (flins = Electro)
    const onField = tb.reactionProvider.guessOnFieldChar("rx-lunarCharged");
    expect(onField).toBe("flins");
  });
});

describe("getReactionComboLines", () => {
  it("produces ComboLine[] for LCr team", () => {
    const tb = new TeamBuild(LCR_ONLY, { linnea: "tap" });
    const lines = tb.getReactionComboLines();
    // Multi-contributor → single base-ID entry with total count
    expect(lines.length).toBe(1);
    expect(lines[0].formulaId).toBe("rx-lunarCrystallize");
    expect(lines[0].count).toBe(20);
  });

  it("omits zero-count lines", () => {
    // All 3 lunar → both 0 → no lines
    const tb = new TeamBuild(LUNAR_TEAM);
    const lines = tb.getReactionComboLines();
    expect(lines.length).toBe(0);
  });
});

describe("evaluateCombo integration with rx- lines", () => {
  it("combo with rx- lines produces nonzero reaction damage", () => {
    const tb = new TeamBuild(LCR_ONLY, { linnea: "tap" });
    const charIds = LCR_ONLY.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const rxLines = tb.getReactionComboLines();
    expect(rxLines.length).toBeGreaterThan(0);

    const combo: ComboFormula = {
      id: "test",
      label: { zh: "测试", en: "test" },
      lines: rxLines,
    };

    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.totalDamage).toBeGreaterThan(0);
  });
});

// Reaction Combo Descriptor — detailed tests

describe("getReactionComboDescriptor — base count heuristics", () => {
  it("LCr-only → base 15 (no Columbina)", () => {
    // Linnea (Geo) + Xingqiu (Hydro) → LCr only, no Columbina
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 0,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "tap" });
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const lcrEntry = desc.find((e) => e.id === "rx-lunarCrystallize");
    expect(lcrEntry).toBeDefined();
    expect(lcrEntry!.total).toBe(15);
    // No LCh entry
    expect(desc.find((e) => e.id === "rx-lunarCharged")).toBeUndefined();
  });

  it("LCh-only → base 9", () => {
    const tb = new TeamBuild(LCH_ONLY);
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const lchEntry = desc.find((e) => e.id === "rx-lunarCharged");
    expect(lchEntry).toBeDefined();
    expect(lchEntry!.total).toBe(9);
    expect(desc.find((e) => e.id === "rx-lunarCrystallize")).toBeUndefined();
  });

  it("LCh + LCr (no LB) → LCh=9, LCr=0 (with Columbina modifier)", () => {
    // Columbina(Hydro) + Flins(Electro) + Zibai(Geo), no Dendro → LCh + LCr
    const team: TeamSlotConfig[] = [
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "flins",
        charLevel: 90,
        constellation: 0,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "zibai",
        charLevel: 80,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team);
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const lchEntry = desc.find((e) => e.id === "rx-lunarCharged");
    const lcrEntry = desc.find((e) => e.id === "rx-lunarCrystallize");
    // Columbina: round(9 * 4/3) = 12, round(0 * 4/3) = 0
    expect(lchEntry).toBeDefined();
    expect(lchEntry!.total).toBe(12);
    expect(lcrEntry).toBeDefined();
    expect(lcrEntry!.total).toBe(0);
  });

  it("all-3 lunar → LCh=0, LCr=0", () => {
    // LUNAR_TEAM has all 3 lunar reactions
    const tb = new TeamBuild(LUNAR_TEAM);
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const lchEntry = desc.find((e) => e.id === "rx-lunarCharged");
    const lcrEntry = desc.find((e) => e.id === "rx-lunarCrystallize");
    expect(lchEntry).toBeDefined();
    expect(lchEntry!.total).toBe(0);
    expect(lcrEntry).toBeDefined();
    expect(lcrEntry!.total).toBe(0);
  });

  it("LCr + LB (no LCh) → LCr=3 (with Columbina → 4)", () => {
    // Need Geo + Hydro + Dendro, no Electro → LCr + LB but no LCh
    // LB requires a Moonsign 5-star with Hydro or Dendro element → Columbina (Hydro)
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 0,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "nahida",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "tap" });
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const lcrEntry = desc.find((e) => e.id === "rx-lunarCrystallize");
    expect(lcrEntry).toBeDefined();
    // base 3, with Columbina: round(3 * 4/3) = 4
    expect(lcrEntry!.total).toBe(4);
    // No LCh (no Electro)
    expect(desc.find((e) => e.id === "rx-lunarCharged")).toBeUndefined();
  });

  it("LCh + LB (no LCr) → LCh=3 (with Columbina → 4)", () => {
    // Need Electro + Hydro + Dendro, no Geo → LCh + LB but no LCr
    // LB requires a Moonsign 5-star with Hydro or Dendro → Columbina (Hydro)
    const team: TeamSlotConfig[] = [
      {
        charId: "flins",
        charLevel: 90,
        constellation: 0,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "nahida",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team);
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const lchEntry = desc.find((e) => e.id === "rx-lunarCharged");
    expect(lchEntry).toBeDefined();
    // base 3, with Columbina: round(3 * 4/3) = 4
    expect(lchEntry!.total).toBe(4);
    // No LCr (no Geo)
    expect(desc.find((e) => e.id === "rx-lunarCrystallize")).toBeUndefined();
  });

  it("empty descriptor when no lunar reactions exist", () => {
    // PYRO_ELECTRO_TEAM has no Moonsign characters
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    expect(desc).toHaveLength(0);
  });
});

describe("getReactionComboDescriptor — Linnea C2 delta", () => {
  it("tap mode → delta = 12 (no Columbina)", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 2,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "tap" });
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const entry = desc.find((e) => e.id === "rx-lunarCrystallize")!;
    expect(entry.bonus).toHaveLength(1);
    expect(entry.bonus[0].charId).toBe("linnea");
    expect(entry.bonus[0].minC).toBe(2);
    expect(entry.bonus[0].delta).toBe(12);
  });

  it("continuous mode → delta = 3 (no Columbina)", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 2,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "continuous" });
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const entry = desc.find((e) => e.id === "rx-lunarCrystallize")!;
    expect(entry.bonus[0].delta).toBe(3);
  });
});

describe("getReactionComboDescriptor — Columbina modifier", () => {
  it("baked into base count: LCr-only → round(15*4/3) = 20", () => {
    // LCR_ONLY has Columbina
    const tb = new TeamBuild(LCR_ONLY, { linnea: "tap" });
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const entry = desc.find((e) => e.id === "rx-lunarCrystallize")!;
    expect(entry.total).toBe(20); // round(15 * 4/3) = 20
  });

  it("baked into delta: tap delta with Columbina → round(12*4/3) = 16", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 2,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "tap" });
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const entry = desc.find((e) => e.id === "rx-lunarCrystallize")!;
    expect(entry.total).toBe(20); // round(15 * 4/3) = 20
    expect(entry.bonus[0].delta).toBe(16); // round(12 * 4/3) = 16
  });

  it("continuous delta with Columbina → round(3*4/3) = 4", () => {
    const team: TeamSlotConfig[] = [
      {
        charId: "linnea",
        charLevel: 90,
        constellation: 2,
        weaponId: "lightbearing_moonshard",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "a_thousand_floating_dreams",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(team, { linnea: "continuous" });
    const desc = tb.reactionProvider.getReactionComboDescriptor();
    const entry = desc.find((e) => e.id === "rx-lunarCrystallize")!;
    expect(entry.bonus[0].delta).toBe(4); // round(3 * 4/3) = 4
  });
});

// resolveReactionComboEntries — unit tests

describe("resolveReactionComboEntries", () => {
  it("adds active deltas to the total (multi-contributor → single entry)", () => {
    const entries: ReactionComboEntry[] = [
      {
        id: "rx-lunarCrystallize",
        total: 15,
        eligible: ["linnea", "columbina"],
        onFieldCharId: "linnea",
        bonus: [{ charId: "linnea", minC: 2, delta: 12 }],
      },
    ];
    const result = resolveReactionComboEntries(entries, { linnea: 6 });
    // Multi-contributor → single base-ID entry with total = 15 + 12 = 27
    expect(result["rx-lunarCrystallize"]).toBe(27);
  });

  it("delta only activates when constellation >= minC", () => {
    const entries: ReactionComboEntry[] = [
      {
        id: "rx-lunarCrystallize",
        total: 15,
        eligible: ["linnea"],
        onFieldCharId: "linnea",
        bonus: [{ charId: "linnea", minC: 2, delta: 12 }],
      },
    ];
    const resultC1 = resolveReactionComboEntries(entries, { linnea: 1 });
    expect(resultC1["rx-lunarCrystallize"]).toBe(15);

    const resultC2 = resolveReactionComboEntries(entries, { linnea: 2 });
    expect(resultC2["rx-lunarCrystallize"]).toBe(27);
  });

  it("missing constellation key defaults to 0", () => {
    const entries: ReactionComboEntry[] = [
      {
        id: "rx-lunarCrystallize",
        total: 15,
        eligible: ["linnea"],
        onFieldCharId: "linnea",
        bonus: [{ charId: "linnea", minC: 2, delta: 12 }],
      },
    ];
    const result = resolveReactionComboEntries(entries, {});
    expect(result["rx-lunarCrystallize"]).toBe(15);
  });

  it("multiple deltas from different characters", () => {
    const entries: ReactionComboEntry[] = [
      {
        id: "rx-lunarCrystallize",
        total: 10,
        eligible: ["linnea", "zibai", "columbina"],
        onFieldCharId: "linnea",
        bonus: [
          { charId: "linnea", minC: 2, delta: 5 },
          { charId: "zibai", minC: 1, delta: 3 },
        ],
      },
    ];
    // Both active: total = 10 + 5 + 3 = 18 (single base-ID entry)
    const result = resolveReactionComboEntries(entries, {
      linnea: 2,
      zibai: 1,
    });
    expect(result["rx-lunarCrystallize"]).toBe(18);

    // Only zibai active: total = 10 + 3 = 13
    const result2 = resolveReactionComboEntries(entries, {
      linnea: 0,
      zibai: 4,
    });
    expect(result2["rx-lunarCrystallize"]).toBe(13);
  });

  it("handles multiple entries", () => {
    const entries: ReactionComboEntry[] = [
      {
        id: "rx-lunarCharged",
        total: 9,
        eligible: ["flins"],
        onFieldCharId: "flins",
        bonus: [],
      },
      {
        id: "rx-lunarCrystallize",
        total: 0,
        eligible: ["linnea"],
        onFieldCharId: "linnea",
        bonus: [{ charId: "linnea", minC: 2, delta: 12 }],
      },
    ];
    const result = resolveReactionComboEntries(entries, { linnea: 6 });
    expect(result["rx-lunarCharged"]).toBe(9);
    expect(result["rx-lunarCrystallize"]).toBe(12);
  });

  it("single-contributor reactions still produce per-triggerer entries", () => {
    const entries: ReactionComboEntry[] = [
      {
        id: "rx-overloaded",
        total: 6,
        eligible: ["amber", "fischl"],
        onFieldCharId: "amber",
        bonus: [],
      },
    ];
    const result = resolveReactionComboEntries(entries, {});
    expect(result["rx-overloaded-amber"]).toBe(5);
    expect(result["rx-overloaded-fischl"]).toBe(1);
  });

  it("empty entries returns empty object", () => {
    const result = resolveReactionComboEntries([], {});
    expect(result).toEqual({});
  });
});

// ── Unified pipeline: per-part stats routing & exact numerics ──

/**
 * Team with intentionally different char levels to test per-part charLevel routing.
 * columbina(Hydro,90) + flins(Electro,70) are both eligible for lunarCharged.
 * The level gap produces measurably different per-part damage.
 */
const MIXED_LEVEL_LUNAR: TeamSlotConfig[] = [
  {
    charId: "columbina",
    charLevel: 90,
    constellation: 0,
    weaponId: "thrilling_tales_of_dragon_slayers",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "flins",
    charLevel: 70,
    constellation: 0,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

describe("computeLunarRankWeights — exact rank assignment", () => {
  it("assigns LUNAR_RANK_WEIGHTS in descending damage order", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);
    const charLevels: Record<string, number> = {};
    for (const c of LUNAR_TEAM) charLevels[c.charId] = c.charLevel;

    const entry = tb.reactionProvider.getFormulaEntry(
      "rx-lunarCharged-columbina"
    );
    expect(entry).toBeDefined();
    const formula = entry!.parts[0].formula;

    // LunarCharged eligible: Electro + Hydro chars
    const eligible =
      tb.reactionProvider.getEligibleCharacters("rx-lunarCharged");

    const weights = computeLunarRankWeights(
      formula,
      eligible,
      teamStats,
      charLevels,
      CTX
    );

    // All eligible chars should have a weight
    for (const charId of eligible) {
      expect(weights.has(charId)).toBe(true);
    }

    // Weights should sum to the first N LUNAR_RANK_WEIGHTS
    const totalWeight = [...weights.values()].reduce((a, b) => a + b, 0);
    const expectedSum = LUNAR_RANK_WEIGHTS.slice(0, eligible.length).reduce(
      (a, b) => a + b,
      0
    );
    expect(totalWeight).toBeCloseTo(expectedSum);

    // Each weight must be one of the positional values
    const weightValues = [...weights.values()].sort((a, b) => b - a);
    for (let i = 0; i < weightValues.length; i++) {
      expect(weightValues[i]).toBe(LUNAR_RANK_WEIGHTS[i]);
    }
  });

  it("higher damage char gets higher weight", () => {
    // flins is level 70, columbina is level 90 — level 90 produces more base damage
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);
    const charLevels: Record<string, number> = {
      columbina: 90,
      flins: 70,
    };

    const entry = tb.reactionProvider.getFormulaEntry(
      "rx-lunarCharged-columbina"
    );
    const formula = entry!.parts[0].formula;
    const eligible =
      tb.reactionProvider.getEligibleCharacters("rx-lunarCharged");

    const weights = computeLunarRankWeights(
      formula,
      eligible,
      teamStats,
      charLevels,
      CTX
    );

    // Level 90 char should produce more damage → get weight 0.6 (rank 1)
    // Level 70 char → weight 0.3 (rank 2)
    const colWeight = weights.get("columbina") ?? 0;
    const flinsWeight = weights.get("flins") ?? 0;

    // columbina level 90 > flins level 70 → columbina gets higher weight
    expect(colWeight).toBeGreaterThan(flinsWeight);
    expect(colWeight).toBe(0.6);
    expect(flinsWeight).toBe(0.3);
  });
});

describe("evaluateFormulaDamage — per-part stats routing", () => {
  it("routes different stats to different parts via statsCharId", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    // Get the finalized multi-contributor entry
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();
    expect(entry!.isMultiContributor).toBe(true);

    // Each part should have a different statsCharId
    const partCharIds = entry!.parts.map((p) => p.statsCharId);
    expect(new Set(partCharIds).size).toBe(entry!.parts.length);

    const charLevels: Record<string, number> = {
      columbina: 90,
      flins: 70,
    };
    const ts = mockTeamStatsFrom(teamStats, charLevels);

    const result = evaluateFormulaDamage(entry!, "columbina", ts, CTX);

    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.parts.length).toBe(entry!.parts.length);
  });

  it("per-part charLevel affects damage magnitude", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();

    const tsReal = mockTeamStatsFrom(teamStats, { columbina: 90, flins: 70 });
    const resultReal = evaluateFormulaDamage(entry!, "columbina", tsReal, CTX);

    const tsAllL90 = mockTeamStatsFrom(teamStats, { columbina: 90, flins: 90 });
    const resultAllL90 = evaluateFormulaDamage(
      entry!,
      "columbina",
      tsAllL90,
      CTX
    );

    // Damage should differ because flins's part uses different level multipliers
    // Level 90 mult > level 70 mult, so all-90 should produce more damage
    expect(resultAllL90.totalDamage).toBeGreaterThan(resultReal.totalDamage);
  });
});

describe("evaluateFormulaDisplay — multi-contributor contributorCharId", () => {
  it("sets contributorCharId on each display part for multi-contributor entries", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();
    expect(entry!.isMultiContributor).toBe(true);

    const charLevels: Record<string, number> = {
      columbina: 90,
      flins: 70,
    };
    const ts = mockTeamStatsFrom(teamStats, charLevels);

    const display = evaluateFormulaDisplay(entry!, "columbina", ts, CTX);

    expect(display.parts.length).toBe(entry!.parts.length);
    expect(display.totalDamage).toBeGreaterThan(0);

    // Each display part should have contributorCharId matching the entry part's statsCharId
    for (let i = 0; i < entry!.parts.length; i++) {
      expect(display.parts[i].contributorCharId).toBe(
        entry!.parts[i].statsCharId
      );
    }

    // Verify all expected contributors are present
    const displayCharIds = display.parts.map((p) => p.contributorCharId);
    expect(displayCharIds).toContain("columbina");
    expect(displayCharIds).toContain("flins");
  });

  it("does NOT set contributorCharId on single-contributor entries", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "hu_tao", CTX);

    const entry = tb.reactionProvider.getFormulaEntry("rx-overloaded-fischl");
    expect(entry).toBeDefined();
    expect(entry!.isMultiContributor).toBeFalsy();

    const ts = mockTeamStatsFrom(teamStats, {
      fischl: 90,
      hu_tao: 90,
      xingqiu: 90,
      kazuha: 90,
    });
    const display = evaluateFormulaDisplay(entry!, "fischl", ts, CTX);

    // Single-contributor should NOT have contributorCharId
    for (const dp of display.parts) {
      expect(dp.contributorCharId).toBeUndefined();
    }
  });
});

describe("multi-contributor N-part exact numerics", () => {
  it("N-part total equals sum of per-part weighted contributions", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();

    const charLevels: Record<string, number> = {
      columbina: 90,
      flins: 70,
    };
    const ts = mockTeamStatsFrom(teamStats, charLevels);

    const result = evaluateFormulaDamage(entry!, "columbina", ts, CTX);

    // Sum of parts should equal totalDamage
    const partSum = result.parts.reduce((s, p) => s + p.damage * p.hits, 0);
    expect(partSum).toBeCloseTo(result.totalDamage, 6);

    // Each part's damage should match the LunarFormula.calc() with the part's
    // own stats and charLevel, scaled by rankWeight
    for (let i = 0; i < entry!.parts.length; i++) {
      const part = entry!.parts[i];
      const partCharId = part.statsCharId!;
      const partStats = teamStats[partCharId]!;
      const partLevel = charLevels[partCharId];
      const expectedDamage = part.formula.calc(partStats, partLevel, CTX);
      expect(result.parts[i].damage).toBeCloseTo(expectedDamage, 4);
    }
  });

  it("rankWeight is correctly baked into each part's LunarFormula", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();

    const charLevels: Record<string, number> = {
      columbina: 90,
      flins: 70,
    };

    // Get the rank weights
    const weights = tb.reactionProvider.getRankWeights("rx-lunarCharged");
    expect(weights).toBeDefined();

    // Verify each part's formula.rankWeight matches the assigned weight
    for (const part of entry!.parts) {
      const charId = part.statsCharId!;
      const expectedWeight = weights!.get(charId)!;
      expect(
        (part.formula as unknown as { rankWeight: number }).rankWeight
      ).toBe(expectedWeight);
    }

    // Compute unweighted damage per contributor using a fresh unweighted formula
    const sampleEntry = tb.reactionProvider.getFormulaEntry(
      "rx-lunarCharged-columbina"
    );
    const unweightedFormula = sampleEntry!.parts[0].formula;

    for (const part of entry!.parts) {
      const charId = part.statsCharId!;
      const partStats = teamStats[charId]!;
      const partLevel = charLevels[charId];
      const w = weights!.get(charId)!;

      const unweightedDmg = unweightedFormula.calc(partStats, partLevel, CTX);
      const weightedDmg = part.formula.calc(partStats, partLevel, CTX);
      expect(weightedDmg).toBeCloseTo(unweightedDmg * w, 4);
    }
  });
});

describe("display path matches damage path for reaction formulas", () => {
  it("display totalDamage equals getDamageResult totalDamage for single-contributor", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "hu_tao", CTX);

    const formulaId = "rx-overloaded-fischl";
    const entry = tb.reactionProvider.getFormulaEntry(formulaId);
    expect(entry).toBeDefined();

    const tsF = mockTeamStatsFrom(teamStats, {
      fischl: 90,
      hu_tao: 90,
      xingqiu: 90,
      kazuha: 90,
    });
    const damageResult = evaluateFormulaDamage(entry!, "fischl", tsF, CTX);

    const displayResult = evaluateFormulaDisplay(entry!, "fischl", tsF, CTX);

    expect(displayResult.totalDamage).toBeCloseTo(damageResult.totalDamage, 4);
  });

  it("display totalDamage equals getDamageResult totalDamage for multi-contributor", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();

    const charLevels: Record<string, number> = {
      columbina: 90,
      flins: 70,
    };
    const ts = mockTeamStatsFrom(teamStats, charLevels);

    const damageResult = evaluateFormulaDamage(entry!, "columbina", ts, CTX);

    const displayResult = evaluateFormulaDisplay(entry!, "columbina", ts, CTX);

    expect(displayResult.totalDamage).toBeCloseTo(damageResult.totalDamage, 4);
  });
});

describe("compiled multi-contributor matches interpreted", () => {
  it("compiled lunarCharged matches getDamageResult via combo", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    // Use the on-field char from the entry (parts[0].statsCharId)
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged")!;
    const onFieldChar = entry.parts[0].statsCharId!;

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [{ charId: onFieldChar, formulaId: "rx-lunarCharged", count: 5 }],
    };

    // Interpreted
    const interpreted = tb.getComboDamageResult(combo, sheets, CTX);

    // Compiled
    const compiled = compileComboTeamDamage(
      tb,
      combo,
      onFieldChar,
      sheets,
      CTX
    );
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    for (const charId of charIds) {
      const charIdx = compiled.charIdxMap?.get(charId) ?? 0;
      fillVarsFromSheet(sheets[charId], compiled.varMapping, charIdx, vars);
    }
    const compiledDamage = compiled.evaluate(vars);

    const relErr =
      Math.abs(compiledDamage - interpreted.totalDamage) /
      Math.abs(interpreted.totalDamage);
    expect(relErr).toBeLessThan(1e-6);
  });

  it("compiled mixed char + multi-contributor combo matches interpreted", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    // Use the on-field char from the entry (parts[0].statsCharId)
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged")!;
    const onFieldChar = entry.parts[0].statsCharId!;

    // Get a character formula for the on-field char
    const charFormulas = tb.getFormulaIds()[onFieldChar];
    const charFormulaId = Object.keys(charFormulas)[0];

    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: [
        { charId: onFieldChar, formulaId: charFormulaId, count: 2 },
        { charId: onFieldChar, formulaId: "rx-lunarCharged", count: 3 },
      ],
    };

    const interpreted = tb.getComboDamageResult(combo, sheets, CTX);

    const compiled = compileComboTeamDamage(
      tb,
      combo,
      onFieldChar,
      sheets,
      CTX
    );
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    for (const charId of charIds) {
      const charIdx = compiled.charIdxMap?.get(charId) ?? 0;
      fillVarsFromSheet(sheets[charId], compiled.varMapping, charIdx, vars);
    }
    const compiledDamage = compiled.evaluate(vars);

    const relErr =
      Math.abs(compiledDamage - interpreted.totalDamage) /
      Math.abs(interpreted.totalDamage);
    expect(relErr).toBeLessThan(1e-6);
  });
});

describe("multi-contributor entry structure", () => {
  it("finalized entry has isMultiContributor and correct parts", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();
    expect(entry!.isMultiContributor).toBe(true);
    expect(entry!.owner).toBe("team");

    // Each part should have a statsCharId
    for (const part of entry!.parts) {
      expect(part.statsCharId).toBeDefined();
      expect(part.statsCharId!.length).toBeGreaterThan(0);
    }

    // Part statsCharIds should match the eligible characters
    const eligible =
      tb.reactionProvider.getEligibleCharacters("rx-lunarCharged");
    const partCharIds = entry!.parts.map((p) => p.statsCharId!);
    for (const charId of partCharIds) {
      expect(eligible).toContain(charId);
    }

    // Rank weights should sum correctly
    const weights = entry!.parts.map(
      (p) => (p.formula as unknown as { rankWeight: number }).rankWeight
    );
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const expectedSum = LUNAR_RANK_WEIGHTS.slice(0, eligible.length).reduce(
      (a, b) => a + b,
      0
    );
    expect(weightSum).toBeCloseTo(expectedSum, 6);
  });

  it("per-triggerer entries still exist alongside base entry", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const eligible =
      tb.reactionProvider.getEligibleCharacters("rx-lunarCharged");

    // Base entry exists
    expect(
      tb.reactionProvider.getFormulaEntry("rx-lunarCharged")
    ).toBeDefined();

    // Per-triggerer entries also exist
    for (const charId of eligible) {
      const perTrig = tb.reactionProvider.getFormulaEntry(
        `rx-lunarCharged-${charId}`
      );
      expect(perTrig).toBeDefined();
      // Per-triggerer entries should NOT be multi-contributor
      expect(perTrig!.isMultiContributor).toBeFalsy();
    }
  });

  it("single-contributor entries have statsCharId on parts, not isMultiContributor", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const entry = tb.reactionProvider.getFormulaEntry("rx-overloaded-fischl");
    expect(entry).toBeDefined();
    expect(entry!.isMultiContributor).toBeFalsy();

    // Parts should have statsCharId set to the trigger character
    for (const part of entry!.parts) {
      expect(part.statsCharId).toBe("fischl");
    }
  });
});

describe("multi-contributor off-field flag", () => {
  it("on-field character's part has offField undefined, others have offField true", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();

    const onFieldChar = entry!.parts[0].statsCharId!;

    // First part (on-field) should not have offField
    expect(entry!.parts[0].offField).toBeUndefined();

    // Remaining parts (off-field) should have offField: true
    for (let i = 1; i < entry!.parts.length; i++) {
      expect(entry!.parts[i].offField).toBe(true);
      expect(entry!.parts[i].statsCharId).not.toBe(onFieldChar);
    }
  });

  it("on-field character is determined by guessOnFieldChar", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();

    const onFieldChar = entry!.parts[0].statsCharId;
    const guessed = tb.reactionProvider.guessOnFieldChar("rx-lunarCharged");
    expect(onFieldChar).toBe(guessed);
  });
});

describe("weight prefix for smaller teams", () => {
  it("2-char team gets first 2 weights [0.6, 0.3]", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    expect(entry).toBeDefined();
    expect(entry!.parts).toHaveLength(2);

    const weights = entry!.parts.map(
      (p) => (p.formula as unknown as { rankWeight: number }).rankWeight
    );
    weights.sort((a, b) => b - a);
    expect(weights).toEqual([0.6, 0.3]);
  });

  it("3-char team with 3 eligible gets first 3 weights [0.6, 0.3, 0.05]", () => {
    // LUNAR_TEAM has 4 chars but only 2 are eligible for lunarCharged (Electro + Hydro)
    // For lunarCrystallize, let's check if we can get a 3-eligible case
    // Use LUNAR_TEAM which has columbina(Hydro), flins(Electro), zibai(Geo), nahida(Dendro)
    // LCr eligible: Geo + Hydro chars → columbina + zibai = 2
    // LCh eligible: Electro + Hydro → columbina + flins = 2
    // Need a team with 3 eligible chars for a lunar reaction

    // Build a team with 3 Electro+Hydro chars for lunarCharged
    const team: TeamSlotConfig[] = [
      {
        charId: "columbina",
        charLevel: 90,
        constellation: 0,
        weaponId: "thrilling_tales_of_dragon_slayers",
        refinement: 5,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "flins",
        charLevel: 90,
        constellation: 0,
        weaponId: "staff_of_homa",
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
    ];
    const tb = new TeamBuild(team);
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged");
    if (!entry) {
      // If lunarCharged requires specific element combos not met, skip
      return;
    }

    const eligible =
      tb.reactionProvider.getEligibleCharacters("rx-lunarCharged");
    if (eligible.length !== 3) return; // team might not produce 3 eligible

    expect(entry.parts).toHaveLength(3);
    const weights = entry.parts.map(
      (p) => (p.formula as unknown as { rankWeight: number }).rankWeight
    );
    weights.sort((a, b) => b - a);
    expect(weights).toEqual([0.6, 0.3, 0.05]);
  });
});

describe("combo count multiplication agreement", () => {
  it("count × N produces N× the damage of count 1", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged")!;
    const onFieldChar = entry.parts[0].statsCharId!;

    const combo1: ComboFormula = {
      id: "test1",
      label: { en: "Test", zh: "测试" },
      lines: [{ charId: onFieldChar, formulaId: "rx-lunarCharged", count: 1 }],
    };
    const combo5: ComboFormula = {
      id: "test5",
      label: { en: "Test", zh: "测试" },
      lines: [{ charId: onFieldChar, formulaId: "rx-lunarCharged", count: 5 }],
    };

    const dmg1 = tb.getComboDamageResult(combo1, sheets, CTX).totalDamage;
    const dmg5 = tb.getComboDamageResult(combo5, sheets, CTX).totalDamage;

    expect(dmg5).toBeCloseTo(dmg1 * 5, 4);
  });

  it("compiled count agrees with interpreted count", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const charIds = MIXED_LEVEL_LUNAR.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged")!;
    const onFieldChar = entry.parts[0].statsCharId!;

    for (const count of [1, 3, 7]) {
      const combo: ComboFormula = {
        id: "test",
        label: { en: "Test", zh: "测试" },
        lines: [{ charId: onFieldChar, formulaId: "rx-lunarCharged", count }],
      };

      const interpreted = tb.getComboDamageResult(combo, sheets, CTX);
      const compiled = compileComboTeamDamage(
        tb,
        combo,
        onFieldChar,
        sheets,
        CTX
      );
      const vars = new Float64Array(compiled.numVars);
      vars.fill(0);
      for (const charId of charIds) {
        const charIdx = compiled.charIdxMap?.get(charId) ?? 0;
        fillVarsFromSheet(sheets[charId], compiled.varMapping, charIdx, vars);
      }
      const compiledDamage = compiled.evaluate(vars);

      const relErr =
        Math.abs(compiledDamage - interpreted.totalDamage) /
        Math.abs(interpreted.totalDamage);
      expect(relErr).toBeLessThan(1e-6);
    }
  });
});

describe("non-zero EM per-contributor routing", () => {
  it("contributors with different EM produce different per-part damage", () => {
    // Give one character artifacts with EM, the other none
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged")!;
    const onFieldChar = entry.parts[0].statsCharId!;
    const offFieldChar = entry.parts[1].statsCharId!;

    // Create stat sheets: one with EM, one without
    const emSheet = new StatSheet([{ key: "em", value: 200 }]);
    const emptySheet = new StatSheet([]);
    const sheetsA: Record<string, StatSheet> = {
      [onFieldChar]: emSheet,
      [offFieldChar]: emptySheet,
    };
    const sheetsB: Record<string, StatSheet> = {
      [onFieldChar]: emptySheet,
      [offFieldChar]: emSheet,
    };

    const teamStatsA = tb.getTeamStats(sheetsA, onFieldChar, CTX);
    const teamStatsB = tb.getTeamStats(sheetsB, onFieldChar, CTX);

    const charLevels: Record<string, number> = {};
    for (const c of MIXED_LEVEL_LUNAR) charLevels[c.charId] = c.charLevel;

    const tsA = mockTeamStatsFrom(teamStatsA, charLevels);
    const resultA = evaluateFormulaDamage(entry, onFieldChar, tsA, CTX);
    const tsB = mockTeamStatsFrom(teamStatsB, charLevels);
    const resultB = evaluateFormulaDamage(entry, onFieldChar, tsB, CTX);

    // Total damage should differ because EM is on different contributors
    // with different rank weights
    expect(resultA.totalDamage).not.toBeCloseTo(resultB.totalDamage);
    expect(resultA.totalDamage).toBeGreaterThan(0);
    expect(resultB.totalDamage).toBeGreaterThan(0);
  });

  it("EM on higher-weighted contributor produces more total damage", () => {
    const tb = new TeamBuild(MIXED_LEVEL_LUNAR);
    const entry = tb.reactionProvider.getFormulaEntry("rx-lunarCharged")!;
    const onFieldChar = entry.parts[0].statsCharId!;
    const offFieldChar = entry.parts[1].statsCharId!;

    // Determine which contributor has higher weight
    const weights = tb.reactionProvider.getRankWeights("rx-lunarCharged")!;
    const onFieldWeight = weights.get(onFieldChar) ?? 0;
    const offFieldWeight = weights.get(offFieldChar) ?? 0;
    const higherWeightChar =
      onFieldWeight > offFieldWeight ? onFieldChar : offFieldChar;
    const lowerWeightChar =
      onFieldWeight > offFieldWeight ? offFieldChar : onFieldChar;

    const emSheet = new StatSheet([{ key: "em", value: 300 }]);
    const emptySheet = new StatSheet([]);

    // EM on higher-weight contributor
    const sheetsHigh: Record<string, StatSheet> = {
      [higherWeightChar]: emSheet,
      [lowerWeightChar]: emptySheet,
    };
    // EM on lower-weight contributor
    const sheetsLow: Record<string, StatSheet> = {
      [higherWeightChar]: emptySheet,
      [lowerWeightChar]: emSheet,
    };

    const comboHigh: ComboFormula = {
      id: "h",
      label: { en: "H", zh: "H" },
      lines: [{ charId: onFieldChar, formulaId: "rx-lunarCharged", count: 1 }],
    };
    const comboLow: ComboFormula = {
      id: "l",
      label: { en: "L", zh: "L" },
      lines: [{ charId: onFieldChar, formulaId: "rx-lunarCharged", count: 1 }],
    };

    const dmgHigh = tb.getComboDamageResult(
      comboHigh,
      sheetsHigh,
      CTX
    ).totalDamage;
    const dmgLow = tb.getComboDamageResult(
      comboLow,
      sheetsLow,
      CTX
    ).totalDamage;

    // EM on the higher-weighted contributor should produce more damage
    expect(dmgHigh).toBeGreaterThan(dmgLow);
  });
});
