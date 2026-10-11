import { beforeAll, describe, expect, it } from "vitest";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { AccountData, CharacterData } from "@/data/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { CalcContext, ComboFormula } from "@/lib/dmgcalc/types";
import {
  buildAccountInvestmentBaseline,
  buildAccountInvestmentCandidates,
  computeAccountInvestments,
  rankAccountInvestments,
} from "@/lib/team-comp/analyzer/accountInvestment";
import type { AnalyzerCharConfig } from "@/lib/team-comp/analyzer/types";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

function character(
  key: string,
  weapon: string,
  constellation: number,
  refinement: number
): CharacterData {
  return {
    key,
    level: 90,
    constellation,
    talent: { auto: 10, skill: 10, burst: 10 },
    weapon: {
      id: `${key}-weapon`,
      key: weapon,
      level: 90,
      refinement,
      lock: false,
    },
    artifacts: {},
  };
}

const selected: AnalyzerCharConfig[] = [
  {
    charId: "hu_tao",
    rarity: 5,
    weapon5Star: { id: "staff_of_homa" },
    startConstellation: 0,
    startRefinement: 1,
    maxConstellation: 6,
    maxRefinement: 5,
  },
  {
    charId: "xingqiu",
    rarity: 4,
    weapon5Star: { id: "primordial_jade_cutter" },
    startConstellation: 0,
    startRefinement: 0,
    maxConstellation: 6,
    maxRefinement: 5,
  },
];

function account(): AccountData {
  return {
    characters: [
      character("hu_tao", "staff_of_homa", 2, 3),
      character("xingqiu", "sacrificial_sword", 6, 2),
    ],
    extraArtifacts: [],
    extraWeapons: [],
  };
}

describe("account investment alternatives", () => {
  it("uses real constellations and equipped refinements instead of hypothetical path starts", () => {
    const data = account();
    const baseline = buildAccountInvestmentBaseline(
      selected.map((c) => c.charId),
      data
    )!;
    expect(baseline[0]).toMatchObject({ constellation: 2, refinement: 3 });
    expect(baseline[1]).toMatchObject({ constellation: 6, refinement: 2 });
    const candidates = buildAccountInvestmentCandidates(
      baseline,
      selected,
      data
    );
    expect(candidates.map((c) => [c.charId, c.kind, c.from, c.to])).toEqual([
      ["hu_tao", "constellation", 2, 3],
      ["hu_tao", "refinement", 3, 4],
      ["xingqiu", "weapon", 0, 1],
    ]);
    for (const candidate of candidates) {
      const changed = candidate.configs.filter(
        (c, index) => c !== baseline[index]
      );
      expect(changed).toHaveLength(1);
      expect(changed[0].charId).toBe(candidate.charId);
    }
    expect(data.characters[0].constellation).toBe(2);
  });

  it("does not charge for an alternative already owned in inventory or on another member", () => {
    const data = account();
    data.extraWeapons.push({
      id: "p-j-c",
      key: "primordial_jade_cutter",
      level: 90,
      refinement: 2,
      lock: false,
    });
    const baseline = buildAccountInvestmentBaseline(
      ["hu_tao", "xingqiu"],
      data
    )!;
    expect(
      buildAccountInvestmentCandidates(baseline, selected, data).some(
        (c) => c.kind === "weapon"
      )
    ).toBe(false);
    data.characters.push(character("bennett", "primordial_jade_cutter", 6, 2));
    data.extraWeapons = [];
    expect(
      buildAccountInvestmentCandidates(baseline, selected, data).some(
        (c) => c.kind === "weapon"
      )
    ).toBe(false);
  });

  it("handles capped investments and missing equipped account members", () => {
    const data = account();
    data.characters[0].constellation = 6;
    data.characters[0].weapon!.refinement = 5;
    const baseline = buildAccountInvestmentBaseline(["hu_tao"], data)!;
    expect(buildAccountInvestmentCandidates(baseline, selected, data)).toEqual(
      []
    );
    expect(buildAccountInvestmentBaseline(["zhongli"], data)).toBeNull();
    delete data.characters[0].weapon;
    expect(buildAccountInvestmentBaseline(["hu_tao"], data)).toBeNull();
  });

  it("ranks independent alternatives against one baseline rather than sequential steps", () => {
    const data = account();
    const baseline = buildAccountInvestmentBaseline(
      ["hu_tao", "xingqiu"],
      data
    )!;
    const candidates = buildAccountInvestmentCandidates(
      baseline,
      selected,
      data
    );
    const result = rankAccountInvestments(baseline, candidates, (configs) => {
      const hu = configs[0];
      return (
        100 +
        (hu.constellation - 2) * 20 +
        (hu.refinement - 3) * 10 +
        (configs[1].weaponId === "primordial_jade_cutter" ? 30 : 0)
      );
    });
    expect(result.baselineDamage).toBe(100);
    expect(
      result.recommendations.map((r) => [r.kind, r.gain, r.gainPct])
    ).toEqual([
      ["weapon", 30, 30],
      ["constellation", 20, 20],
      ["refinement", 10, 10],
    ]);
  });

  it("evaluates real engine damage with the account baseline and exposes no full-path mutations", () => {
    const data = account();
    data.characters[0].artifacts.flower = {
      id: "equipped-flower",
      setKey: "crimson_witch_of_flames",
      slotKey: "flower",
      level: 20,
      rarity: 5,
      mainStatKey: "hp",
      lock: false,
      substats: { cd: 20, cr: 10, "hp%": 15 },
    };
    const baseline = buildAccountInvestmentBaseline(
      ["hu_tao", "xingqiu"],
      data
    )!;
    const team = new TeamBuild(baseline);
    const combo: ComboFormula = {
      id: "test",
      label: { en: "Test", zh: "测试" },
      lines: Object.entries(team.catalog.getCombo("hu_tao")).map(
        ([formulaId, count]) => ({ charId: "hu_tao", formulaId, count })
      ),
    };
    const context: CalcContext = {
      enemyLevel: 110,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };
    const selectedBefore = structuredClone(selected);
    const result = computeAccountInvestments(data, baseline, selected, {
      teamBuild: team,
      templateCombo: combo,
      calcContext: context,
    });
    const sheets = {
      hu_tao: StatSheet.fromArtifacts(
        Object.values(data.characters[0].artifacts)
      ),
      xingqiu: new StatSheet([]),
    };
    expect(result.baselineDamage).toBeCloseTo(
      team.getComboDamageResult(combo, sheets, context).totalDamage
    );
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.every((r) => Number.isFinite(r.damage))).toBe(
      true
    );
    expect(selected).toEqual(selectedBefore);
  });
});
