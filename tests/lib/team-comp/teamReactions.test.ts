/**
 * Tests for TeamReactionProvider: team-wide reaction formula generation,
 * eligibility filtering, damage evaluation, compiler path, and display path.
 */
import { preloadGameStats } from "@/lib/gameStatsLoader";
import {
  TeamBuild,
  evaluateCombo,
  getComboDisplayResult,
} from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import {
  compileComboTeamDamage,
  compileTeamDamage,
  fillVarsFromSheet,
} from "@/lib/team-comp/formulaCompiler";
import {
  LUNAR_RANK_WEIGHTS,
  MULTI_CONTRIBUTOR_REACTIONS,
} from "@/lib/team-comp/teamReactions";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

import "@/lib/team-comp/index";

await preloadGameStats();

// ── Helpers ──

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
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-overloaded"]).toBeDefined();
    expect(rxFormulas["rx-overloaded"].en).toBe("Overloaded");
  });

  it("generates electroCharged for Hydro+Electro team", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-electroCharged"]).toBeDefined();
  });

  it("does NOT generate bloom when missing Dendro", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-bloom"]).toBeUndefined();
  });

  it("generates bloom for Dendro+Hydro+Electro team", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-bloom"]).toBeDefined();
  });

  it("generates rx-hyperbloom when Electro char has only off-field formula", () => {
    // Kuki Shinobu's shinobu-hyperbloom has offField: true,
    // so she remains eligible → team rx-hyperbloom is generated
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-hyperbloom"]).toBeDefined();
  });

  it("does NOT generate burgeon when missing Pyro", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-burgeon"]).toBeUndefined();
  });

  it("does NOT generate superconduct when missing Cryo+Electro pair", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-superconduct"]).toBeUndefined();
  });
});

describe("TeamReactionProvider — swirl variants", () => {
  it("generates swirl variants for each reactive element on the team", () => {
    const tb = new TeamBuild(SWIRL_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
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
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-bloom"]).toBeDefined();
    expect(rxFormulas["rx-bloom"].en).toBe("Bountiful Core");
    expect(rxFormulas["rx-bloom"].zh).toBe("丰穰之核");
  });

  it("rx-bloom label stays as Dendro Core for non-Nilou team", () => {
    const tb = new TeamBuild(BLOOM_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
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
      "rx-overloaded",
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
      "rx-bloom",
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
      lines: [{ charId: "fischl", formulaId: "rx-overloaded", count: 3 }],
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
        { charId: "hu_tao", formulaId: "rx-bloom", count: 1 },
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
        { charId: "fischl", formulaId: "rx-overloaded", count: 2 },
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
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-lunarCharged"]).toBeDefined();
  });

  it("generates lunarCrystallize for Columbina+Zibai team", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-lunarCrystallize"]).toBeDefined();
  });

  it("does NOT generate lunarBloom (dendro core uses regular bloom formula)", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const rxFormulas = tb.reactionProvider.getFormulaIds();
    expect(rxFormulas["rx-lunarBloom"]).toBeUndefined();
    // The team should get rx-bloom instead (standard dendro core)
    expect(rxFormulas["rx-bloom"]).toBeDefined();
  });

  it("multi-contributor eligible chars include all team members", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const eligible =
      tb.reactionProvider.getEligibleCharacters("rx-lunarCharged");
    expect(eligible).toHaveLength(4);
    expect(eligible).toContain("columbina");
    expect(eligible).toContain("flins");
    expect(eligible).toContain("zibai");
    expect(eligible).toContain("nahida");
  });
});

describe("TeamReactionProvider — multi-contributor evaluation", () => {
  it("getMultiContributorResult produces rank-weighted damage", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const result = tb.reactionProvider.getMultiContributorResult(
      "rx-lunarCharged",
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
      "rx-lunarCharged",
      "columbina",
      teamStats,
      CTX
    );
    expect(display.contributors).toHaveLength(4);
    expect(display.totalDamage).toBeGreaterThan(0);
    // Rank 1 should have weight 0.6
    expect(display.contributors[0].rank).toBe(1);
    expect(display.contributors[0].weight).toBe(0.6);
    // Sorted descending by damage
    expect(display.contributors[0].damage).toBeGreaterThanOrEqual(
      display.contributors[1].damage
    );
  });

  it("multi-contributor total matches manual rank-weighted sum", () => {
    const tb = new TeamBuild(LUNAR_TEAM);
    const charIds = LUNAR_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);
    const teamStats = tb.getTeamStats(sheets, "columbina", CTX);

    const display = tb.reactionProvider.getMultiContributorDisplay(
      "rx-lunarCharged",
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
      "rx-overloaded",
      "hu_tao",
      teamStats.hu_tao!,
      CTX
    ).totalDamage;
    const dmgFischl = tb.reactionProvider.getDamageResult(
      "rx-overloaded",
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
      "rx-swirl-Pyro",
      "kaedehara_kazuha",
      teamStats.kaedehara_kazuha!,
      CTX
    );
    expect(result.totalDamage).toBeGreaterThan(0);
  });

  it("different swirl elements use different damage elements", () => {
    const tb = new TeamBuild(SWIRL_TEAM);
    const entryPyro = tb.reactionProvider.getFormulaEntry("rx-swirl-Pyro");
    const entryHydro = tb.reactionProvider.getFormulaEntry("rx-swirl-Hydro");
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
      lines: [{ charId: "fischl", formulaId: "rx-overloaded", count: 2 }],
    };

    const display = getComboDisplayResult(tb, combo, sheets, CTX);
    expect(display.totalDamage).toBeGreaterThan(0);
    const parts = display.partsByFormula["fischl.rx-overloaded"];
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
      lines: [{ charId: "columbina", formulaId: "rx-lunarCharged", count: 1 }],
    };

    const display = getComboDisplayResult(tb, combo, sheets, CTX);
    expect(display.totalDamage).toBeGreaterThan(0);
    const parts = display.partsByFormula["columbina.rx-lunarCharged"];
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
        { charId: "fischl", formulaId: "rx-overloaded", count: 3 },
      ],
    };

    const display = getComboDisplayResult(tb, combo, sheets, CTX);
    expect(display.totalDamage).toBeGreaterThan(0);
    // Both formula keys should have display parts
    expect(display.partsByFormula[`hu_tao.${firstFormulaId}`]).toBeDefined();
    expect(display.partsByFormula["fischl.rx-overloaded"]).toBeDefined();
  });
});

describe("TeamReactionProvider — compiler path", () => {
  it("compileTeamDamage produces non-zero for rx- formula", () => {
    const tb = new TeamBuild(PYRO_ELECTRO_TEAM);
    const charIds = PYRO_ELECTRO_TEAM.map((c) => c.charId);
    const sheets = emptySheets(...charIds);

    const optCtx = tb.createOptimizerContext(sheets, "fischl", "fischl", CTX);
    const compiled = compileTeamDamage(
      tb,
      "fischl",
      "rx-overloaded",
      CTX,
      optCtx
    );
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    // Fill swap char's vars from empty sheet
    const charIdx = optCtx.charBuildOrder.findIndex(([id]) => id === "fischl");
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
      lines: [{ charId: "fischl", formulaId: "rx-overloaded", count: 1 }],
    };
    const interpreted = evaluateCombo(tb, combo, sheets, CTX);

    // Compiled
    const optCtx = tb.createOptimizerContext(sheets, "fischl", "fischl", CTX);
    const compiled = compileTeamDamage(
      tb,
      "fischl",
      "rx-overloaded",
      CTX,
      optCtx
    );
    const vars = new Float64Array(compiled.numVars);
    vars.fill(0);
    const charIdx = optCtx.charBuildOrder.findIndex(([id]) => id === "fischl");
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
        { charId: "fischl", formulaId: "rx-overloaded", count: 2 },
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
      lines: [{ charId: "fischl", formulaId: "rx-overloaded", count: 3 }],
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
