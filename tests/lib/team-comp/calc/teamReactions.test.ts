/**
 * Tests for TeamReactionProvider: team-wide reaction formula generation,
 * eligibility filtering, damage evaluation, compiler path, and display path.
 */
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import {
  evaluateCombo,
  getComboDisplayResult,
} from "@/lib/team-comp/calc/damageCalc";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/team-comp/calc/formulaCompiler";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  LUNAR_RANK_WEIGHTS,
  MULTI_CONTRIBUTOR_REACTIONS,
  resolveReactionComboEntries,
} from "@/lib/team-comp/calc/teamReaction";
import type { ReactionComboEntry } from "@/lib/team-comp/types";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

import "@/lib/team-comp/index";

await preloadGameStats();

// ── Helpers ──

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

/** Sum per-triggerer counts for a base reaction ID. */
function sumBase(counts: Record<string, number>, baseId: string): number {
  const prefix = `${baseId}-`;
  let total = 0;
  for (const [key, val] of Object.entries(counts)) {
    if (key.startsWith(prefix)) total += val;
  }
  return total;
}

/** Check if a base reaction exists in per-triggerer counts. */
function hasBase(counts: Record<string, number>, baseId: string): boolean {
  const prefix = `${baseId}-`;
  return Object.keys(counts).some((k) => k.startsWith(prefix));
}

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
};

function emptySheets(...charIds: string[]): Record<string, StatSheet> {
  const sheets: Record<string, StatSheet> = {};
  for (const id of charIds) sheets[id] = new StatSheet([]);
  return sheets;
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

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

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

    const result = tb.reactionProvider.getDamageResult(
      "rx-overloaded-fischl",
      "fischl",
      teamStats.fischl!,
      CTX
    );
    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].hits).toBe(1);
  });

  it("bloom damage is consistent with TransformFormula calc", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const charIds = BLOOM_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "nahida", CTX);

    const result = tb.reactionProvider.getDamageResult(
      "rx-bloom-nahida",
      "nahida",
      teamStats.nahida!,
      CTX
    );
    // Bloom coefficient = 2.0, Level 90 multiplier ≈ 1446.85
    // With empty stats, EM = 0 so EMBonus = 0, reactionDmg% = 0
    // damage = 1446.85 * 2.0 * (1 + 0 + 0) * RES * CritMult
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

    const result = evaluateCombo(tb, combo, sheets, CTX);
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

    const result = evaluateCombo(tb, combo, sheets, CTX);
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

    const result = evaluateCombo(tb, combo, sheets, CTX);
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

// ═══════════════════════════════════════════════════════════════
// Lunar team (Moonsign 5★ required)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// Additional tests
// ═══════════════════════════════════════════════════════════════

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
  it("getMultiContributorResult produces rank-weighted damage", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const result = tb.reactionProvider.getMultiContributorResult(
      "rx-lunarCharged-columbina",
      "columbina",
      teamStats,
      CTX
    );
    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.parts).toHaveLength(1);
  });

  it("getMultiContributorDisplay returns ranked contributors", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const display = tb.reactionProvider.getMultiContributorDisplay(
      "rx-lunarCharged-columbina",
      "columbina",
      teamStats,
      CTX
    );
    // Only Electro + Hydro chars contribute to LCh
    expect(display.contributors).toHaveLength(2);
    expect(display.totalDamage).toBeGreaterThan(0);
    // Rank 1 should have weight 0.6 (highest weight first)
    expect(display.contributors[0].rank).toBe(1);
    expect(display.contributors[0].weight).toBe(0.6);
    expect(display.contributors[1].rank).toBe(2);
    expect(display.contributors[1].weight).toBe(0.3);
  });

  it("multi-contributor total matches manual rank-weighted sum", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const display = tb.reactionProvider.getMultiContributorDisplay(
      "rx-lunarCharged-columbina",
      "columbina",
      teamStats,
      CTX
    );
    const manual = display.contributors.reduce(
      (sum, c) => sum + c.damage * c.weight,
      0
    );
    expect(display.totalDamage).toBeCloseTo(manual);
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

    const dmgHuTao = tb.reactionProvider.getDamageResult(
      "rx-overloaded-hu_tao",
      "hu_tao",
      teamStats.hu_tao!,
      CTX
    ).totalDamage;
    const dmgFischl = tb.reactionProvider.getDamageResult(
      "rx-overloaded-fischl",
      "fischl",
      teamStats.fischl!,
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

    const result = tb.reactionProvider.getDamageResult(
      "rx-swirl-Pyro-kaedehara_kazuha",
      "kaedehara_kazuha",
      teamStats.kaedehara_kazuha!,
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

    const display = getComboDisplayResult(tb, combo, sheets, CTX);
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

    const display = getComboDisplayResult(tb, combo, sheets, CTX);
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

    const display = getComboDisplayResult(tb, combo, sheets, CTX);
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
    const interpreted = evaluateCombo(tb, combo, sheets, CTX);

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
    const interpreted = evaluateCombo(tb, combo, sheets, CTX);

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

// ═══════════════════════════════════════════════════════════════
// Reaction combo counts
// ═══════════════════════════════════════════════════════════════

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
    // Linnea (Geo) + Columbina (Hydro) both eligible for LCr
    // Total = 20 (15 * 4/3 with Columbina), distributed: on-field gets 19, other gets 1
    expect(lines.length).toBe(2);
    expect(
      lines.every((l) => l.formulaId.startsWith("rx-lunarCrystallize-"))
    ).toBe(true);
    expect(lines.reduce((s, l) => s + l.count, 0)).toBe(20);
    const onFieldLine = lines.find((l) => l.count > 1);
    expect(onFieldLine).toBeDefined();
    expect(onFieldLine!.count).toBe(19);
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

    const result = evaluateCombo(tb, combo, sheets, CTX);
    expect(result.totalDamage).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Reaction Combo Descriptor — detailed tests
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// resolveReactionComboEntries — unit tests
// ═══════════════════════════════════════════════════════════════

describe("resolveReactionComboEntries", () => {
  it("adds active deltas to the total and distributes", () => {
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
    // total = 15 + 12 = 27, linnea gets 27 - 1 = 26, columbina gets 1
    expect(result["rx-lunarCrystallize-linnea"]).toBe(26);
    expect(result["rx-lunarCrystallize-columbina"]).toBe(1);
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
    expect(resultC1["rx-lunarCrystallize-linnea"]).toBe(15);

    const resultC2 = resolveReactionComboEntries(entries, { linnea: 2 });
    expect(resultC2["rx-lunarCrystallize-linnea"]).toBe(27);
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
    expect(result["rx-lunarCrystallize-linnea"]).toBe(15);
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
    // Both active: total = 10 + 5 + 3 = 18, linnea = 18 - 2 = 16, others = 1
    const result = resolveReactionComboEntries(entries, {
      linnea: 2,
      zibai: 1,
    });
    expect(result["rx-lunarCrystallize-linnea"]).toBe(16);
    expect(result["rx-lunarCrystallize-zibai"]).toBe(1);
    expect(result["rx-lunarCrystallize-columbina"]).toBe(1);

    // Only zibai active: total = 10 + 3 = 13, linnea = 13 - 2 = 11, others = 1
    const result2 = resolveReactionComboEntries(entries, {
      linnea: 0,
      zibai: 4,
    });
    expect(result2["rx-lunarCrystallize-linnea"]).toBe(11);
    expect(result2["rx-lunarCrystallize-zibai"]).toBe(1);
    expect(result2["rx-lunarCrystallize-columbina"]).toBe(1);
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
    expect(result["rx-lunarCharged-flins"]).toBe(9);
    expect(result["rx-lunarCrystallize-linnea"]).toBe(12);
  });

  it("empty entries returns empty object", () => {
    const result = resolveReactionComboEntries([], {});
    expect(result).toEqual({});
  });
});
