import { describe, expect, it } from "vitest";

import { aggregateComboFormulaDefaults } from "@/lib/team-comp/calc/comboBuffOverrides";
import { DirectFormula } from "@/lib/team-comp/calc/damageFormula";
import {
  type ComboLineEval,
  type FormulaPartEval,
  type StackLimitedBuffInfo,
  computeBlendedDamage,
  computeComboDefaultActivation,
  computeDefaultActivation,
  distributeComboHits,
  evaluateFormulaDamage,
  evaluateFormulaDisplay,
} from "@/lib/team-comp/calc/stackRank";
import { exclusionKey } from "@/lib/team-comp/calc/stackRank";
import { buffSourceKey } from "@/lib/team-comp/calc/statBuff";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import type { TeamStatSheet } from "@/lib/team-comp/calc/teamStatSheet";
import type { BuffActivationMap } from "@/lib/team-comp/types";
import type { FormulaEntry, FormulaPart } from "@/lib/team-comp/types";
import type { CalcContext, StatKey } from "@/lib/team-comp/types";

/**
 * Create a mock TeamStatSheet for computeBlendedDamage tests.
 * Returns the provided postStats for the "test" charId and builds
 * exclusion variants by negating the specified buff entries.
 */
function mockTeamStats(
  postStats: StatSheet,
  charLevel = 90,
  variantConfigs?: {
    buffKey: string;
    entries: { key: StatKey; value: number }[];
  }[]
): TeamStatSheet {
  const filter = {
    elements: ["Cryo" as const],
    abilities: ["skill" as const],
  };

  return {
    getPostStats(
      _charId: string,
      _onFieldCharId: string,
      excludeKeys?: Set<string>
    ): StatSheet {
      if (!excludeKeys || excludeKeys.size === 0) return postStats;
      if (!variantConfigs) return postStats;
      let stats = postStats;
      for (const cfg of variantConfigs) {
        if (excludeKeys.has(cfg.buffKey)) {
          for (const entry of cfg.entries) {
            stats = stats.merge(
              StatSheet.fromEntries(
                [{ key: entry.key, value: -entry.value }],
                filter
              )
            );
          }
        }
      }
      return stats;
    },
    getAllPostStats(_onFieldCharId: string): Record<string, StatSheet> {
      return { test: postStats };
    },
    getCharLevel(_charId: string): number {
      return charLevel;
    },
    getDefaultOnFieldCharId(_charId: string): string {
      return "test";
    },
  } as unknown as TeamStatSheet;
}

const ctx: CalcContext = {
  enemyLevel: 90,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

const cryoSkillTag = {
  element: "Cryo" as const,
  ability: "skill" as const,
  reaction: "none" as const,
};

// Helper: create a simple DirectFormula that scales off ATK
function makeFormula(multi: number): DirectFormula {
  return new DirectFormula(multi, cryoSkillTag, "atk");
}

// Helper: build parts array
function makeParts(
  configs: { multi: number; hits: number; offField?: boolean }[]
): FormulaPart[] {
  return configs.map(({ multi, hits, offField }) => ({
    formula: makeFormula(multi),
    hits,
    offField,
  }));
}

// Helper: create a stack-limited buff info
function makeBuffInfo(maxStacks: number, origin = "C2"): StackLimitedBuffInfo {
  const source = {
    type: "character" as const,
    id: "escoffier",
    origin,
    maxStacks,
  };
  return {
    source,
    buffKey: buffSourceKey(source),
    maxStacks,
  };
}

/**
 * Helper: build FormulaPartEval[] from parts and postStats.
 */
function makePartEvals(
  parts: FormulaPart[],
  postStats: StatSheet,
  charLevel = 90
): FormulaPartEval[] {
  return parts.map((p) => ({
    formula: p.formula,
    stats: postStats,
    charLevel,
    hits: p.hits ?? 1,
  }));
}

/**
 * Helper: build FormulaPartEval[] with per-part stats (for off-field tests).
 */
function makePartEvalsWithStats(
  parts: FormulaPart[],
  statsPerPart: StatSheet[],
  charLevel = 90
): FormulaPartEval[] {
  return parts.map((p, i) => ({
    formula: p.formula,
    stats: statsPerPart[i],
    charLevel,
    hits: p.hits ?? 1,
  }));
}

describe("computeDefaultActivation", () => {
  it("allocates stacks greedily to highest-damage parts first", () => {
    // 3 parts: high-damage (2 hits), medium (5 hits), low (3 hits)
    // Budget = 5 stacks
    // Expected: 2 stacks to high, 3 stacks to medium, 0 to low
    const parts = makeParts([
      { multi: 3.0, hits: 2 }, // highest damage per hit
      { multi: 2.0, hits: 5 }, // medium
      { multi: 1.0, hits: 3 }, // lowest
    ]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 }, // buff contribution
    ]);

    const buff = makeBuffInfo(5);
    const partEvals = makePartEvals(parts, postStats);
    const result = computeDefaultActivation(partEvals, [buff], ctx);

    const bKey = buffSourceKey(buff.source);
    expect(result[bKey]).toBeDefined();
    // With 5 stacks: 2 to part 0 (highest multiplier), 3 to part 1
    expect(result[bKey]![0]).toBe(2);
    expect(result[bKey]![1]).toBe(3);
    // Part 2 gets nothing (explicit 0 so UI doesn't default to "fully active")
    expect(result[bKey]![2]).toBe(0);
  });

  it("returns empty map when maxStacks >= total hits", () => {
    const parts = makeParts([
      { multi: 2.0, hits: 2 },
      { multi: 1.0, hits: 3 },
    ]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    // 5 stacks for 5 total hits = fully active
    const buff = makeBuffInfo(5);
    const partEvals = makePartEvals(parts, postStats);
    const result = computeDefaultActivation(partEvals, [buff], ctx);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it("handles single-part formula correctly", () => {
    const parts = makeParts([{ multi: 2.16, hits: 21 }]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const buff = makeBuffInfo(5);
    const partEvals = makePartEvals(parts, postStats);
    const result = computeDefaultActivation(partEvals, [buff], ctx);

    const bKey = buffSourceKey(buff.source);
    expect(result[bKey]![0]).toBe(5);
  });

  it("handles multiple independent stack-limited buffs", () => {
    const parts = makeParts([
      { multi: 2.0, hits: 10 },
      { multi: 1.0, hits: 10 },
    ]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 300 },
      { key: "dmg%", value: 0.2 },
    ]);

    const buff1 = makeBuffInfo(5, "C2");
    const buff2 = makeBuffInfo(3, "C4");

    const partEvals = makePartEvals(parts, postStats);

    const result = computeDefaultActivation(partEvals, [buff1, buff2], ctx);

    const bKey1 = buffSourceKey(buff1.source);
    const bKey2 = buffSourceKey(buff2.source);
    expect(result[bKey1]).toBeDefined();
    expect(result[bKey2]).toBeDefined();
    // Both should prioritize part 0 (higher multiplier)
    expect(result[bKey1]![0]).toBe(5);
    expect(result[bKey2]![0]).toBe(3);
  });

  it("returns empty when no stack-limited buffs", () => {
    const parts = makeParts([{ multi: 2.0, hits: 5 }]);
    const postStats = new StatSheet([{ key: "baseAtk", value: 800 }]);

    const partEvals = makePartEvals(parts, postStats);
    const result = computeDefaultActivation(partEvals, [], ctx);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("unallocated parts in blended damage", () => {
  it("unallocated parts get 0 stacks in blended damage", () => {
    // Verify end-to-end: part with 0 stacks should get NO buff
    const parts = makeParts([
      { multi: 3.0, hits: 2 },
      { multi: 1.0, hits: 3 },
    ]);

    const filter = {
      elements: ["Cryo" as const],
      abilities: ["skill" as const],
    };
    const buff = makeBuffInfo(3);
    const bKey = buffSourceKey(buff.source);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    // part 0 gets 2 stacks, part 1 gets 0 (missing from map = 0 activation)
    const activation: BuffActivationMap = { [bKey]: { 0: 2, 1: 0 } };

    const buffConfigs = [
      { buffKey: bKey, entries: [{ key: "baseDmg" as StatKey, value: 500 }] },
    ];
    const ts = mockTeamStats(postStats, 90, buffConfigs);
    const result = computeBlendedDamage(parts, activation, "test", ts, ctx);

    // Part 0: 2 hits fully buffed
    const dmgWith = parts[0].formula.calc(postStats, 90, ctx);
    // Part 1: 3 hits with NO buff
    const sansStats = postStats.merge(
      StatSheet.fromEntries([{ key: "baseDmg", value: -500 }], filter)
    );
    const dmgWithout = parts[1].formula.calc(sansStats, 90, ctx);

    const expected = 2 * dmgWith + 3 * dmgWithout;
    expect(result.totalDamage).toBeCloseTo(expected);
  });
});

describe("computeBlendedDamage", () => {
  it("returns same as unblended when no partial buffs", () => {
    const parts = makeParts([
      { multi: 2.0, hits: 3 },
      { multi: 1.0, hits: 5 },
    ]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "baseDmg", value: 500 },
    ]);

    const ts = mockTeamStats(postStats);
    const result = computeBlendedDamage(parts, {}, "test", ts, ctx);

    const dmg0 = parts[0].formula.calc(postStats, 90, ctx);
    const dmg1 = parts[1].formula.calc(postStats, 90, ctx);
    expect(result.totalDamage).toBeCloseTo(dmg0 * 3 + dmg1 * 5);
  });

  it("blends correctly with single partial buff", () => {
    const parts = makeParts([{ multi: 2.16, hits: 21 }]);

    const filter = {
      elements: ["Cryo" as const],
      abilities: ["skill" as const],
    };
    const postStats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "baseDmg", value: 500 },
    ]);

    const buffKey = "character:escoffier:C2";
    const activation: BuffActivationMap = {
      [buffKey]: { 0: 5 }, // 5 out of 21 hits
    };

    const buffConfigs = [
      { buffKey, entries: [{ key: "baseDmg" as StatKey, value: 500 }] },
    ];
    const ts = mockTeamStats(postStats, 90, buffConfigs);
    const result = computeBlendedDamage(parts, activation, "test", ts, ctx);

    const dmgWith = parts[0].formula.calc(postStats, 90, ctx);
    const sansStats = postStats.merge(
      StatSheet.fromEntries([{ key: "baseDmg", value: -500 }], filter)
    );
    const dmgWithout = parts[0].formula.calc(sansStats, 90, ctx);

    const expected = 5 * dmgWith + 16 * dmgWithout;
    expect(result.totalDamage).toBeCloseTo(expected);
    expect(result.partDamages[0]!.hits).toBe(21);
    expect(result.partDamages[0]!.damage).toBeCloseTo(expected / 21);
  });

  it("Escoffier-like scenario: 21-hit formula with 5 stacks", () => {
    const parts = makeParts([{ multi: 2.55, hits: 21 }]);
    const buffValue = 1920;
    const filter = {
      elements: ["Cryo" as const],
      abilities: ["skill" as const],
    };

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: buffValue },
    ]);

    const buffKey = "character:escoffier:C2";
    const activation: BuffActivationMap = {
      [buffKey]: { 0: 5 },
    };

    const buffConfigs = [
      { buffKey, entries: [{ key: "baseDmg" as StatKey, value: buffValue }] },
    ];
    const ts = mockTeamStats(postStats, 90, buffConfigs);

    const dmgWith = parts[0].formula.calc(postStats, 90, ctx);
    const fullDamage = dmgWith * 21;

    const blended = computeBlendedDamage(parts, activation, "test", ts, ctx);
    expect(blended.totalDamage).toBeLessThan(fullDamage);

    const sansStats = postStats.merge(
      StatSheet.fromEntries([{ key: "baseDmg", value: -buffValue }], filter)
    );
    const dmgWithout = parts[0].formula.calc(sansStats, 90, ctx);
    const expectedBlended = 5 * dmgWith + 16 * dmgWithout;
    expect(blended.totalDamage).toBeCloseTo(expectedBlended);
  });

  it("handles multiple buffs with different fall-off points (interval-based)", () => {
    // 5-hit part, buff1 active for 3 hits, buff2 active for 2 hits
    // Expected: 2 × Dmg(b1,b2) + 1 × Dmg(b1) + 2 × Dmg()
    const parts = makeParts([{ multi: 2.0, hits: 5 }]);

    const filter = {
      elements: ["Cryo" as const],
      abilities: ["skill" as const],
    };
    const postStats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "baseDmg", value: 300 },
      { key: "dmg%", value: 0.5 },
    ]);

    const buffKey1 = "character:escoffier:C2";
    const buffKey2 = "character:escoffier:C4";

    const activation: BuffActivationMap = {
      [buffKey1]: { 0: 3 }, // active for first 3 hits
      [buffKey2]: { 0: 2 }, // active for first 2 hits
    };

    const buffConfigs = [
      {
        buffKey: buffKey1,
        entries: [{ key: "baseDmg" as StatKey, value: 300 }],
      },
      { buffKey: buffKey2, entries: [{ key: "dmg%" as StatKey, value: 0.5 }] },
    ];
    const ts = mockTeamStats(postStats, 90, buffConfigs);

    const result = computeBlendedDamage(parts, activation, "test", ts, ctx);

    // Compute damage for each interval:
    // (0,2]: both active → full postStats
    const dmgBoth = parts[0].formula.calc(postStats, 90, ctx);
    // (2,3]: only buff1 active, buff2 fallen off → negate buff2
    const sansB2 = postStats.merge(
      StatSheet.fromEntries([{ key: "dmg%", value: -0.5 }], filter)
    );
    const dmgB1Only = parts[0].formula.calc(sansB2, 90, ctx);
    // (3,5]: both fallen off → negate both
    const sansAll = postStats
      .merge(StatSheet.fromEntries([{ key: "baseDmg", value: -300 }], filter))
      .merge(StatSheet.fromEntries([{ key: "dmg%", value: -0.5 }], filter));
    const dmgNone = parts[0].formula.calc(sansAll, 90, ctx);

    const expected = 2 * dmgBoth + 1 * dmgB1Only + 2 * dmgNone;
    expect(result.totalDamage).toBeCloseTo(expected);
  });
});

describe("computeComboDefaultActivation", () => {
  it("shares maxStack budget across all combo lines", () => {
    // Two lines: line 0 has high-damage formula (2 hits × 2 reps),
    // line 1 has low-damage formula (3 hits × 1 rep).
    // Budget = 5 stacks, total hits = 4 + 3 = 7.
    // Should allocate to highest multiplier first (line 0's formula).
    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const buff = makeBuffInfo(5);
    const bKey = buffSourceKey(buff.source);

    const parts0 = makeParts([{ multi: 3.0, hits: 2 }]);
    const parts1 = makeParts([{ multi: 1.0, hits: 3 }]);
    const pe0 = makePartEvals(parts0, postStats);
    const pe1 = makePartEvals(parts1, postStats);

    const lines: ComboLineEval[] = [
      { partEvals: pe0, lineCount: 2 },
      { partEvals: pe1, lineCount: 1 },
    ];

    const result = computeComboDefaultActivation(lines, [buff], ctx);

    // Line 0: 2 hits × 2 reps = 4 available, high multiplier → gets 4 stacks
    // Line 1: 3 hits × 1 rep = 3 available, low multiplier → gets remaining 1 stack
    // Per-cast: line 0 = 4/2 = 2 (full), line 1 = 1/1 = 1
    expect(result[0][bKey]![0]).toBe(2); // line 0, part 0: full (2 hits per cast)
    expect(result[1][bKey]![0]).toBe(1); // line 1, part 0: 1 out of 3 hits
  });

  it("does not allocate when budget covers all hits", () => {
    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    // maxStacks=5 covers all 2 hits
    const buff = makeBuffInfo(5);
    const bKey = buffSourceKey(buff.source);

    const parts0 = makeParts([{ multi: 2.0, hits: 2 }]);
    const partEvals = makePartEvals(parts0, postStats);

    const lines: ComboLineEval[] = [{ partEvals, lineCount: 1 }];
    const result = computeComboDefaultActivation(lines, [buff], ctx);
    // No entry: budget covers everything
    expect(result[0][bKey]).toBeUndefined();
  });

  it("returns empty maps when no stack-limited buffs", () => {
    const postStats = new StatSheet([{ key: "baseAtk", value: 800 }]);
    const parts0 = makeParts([{ multi: 2.0, hits: 3 }]);
    const partEvals = makePartEvals(parts0, postStats);

    const lines: ComboLineEval[] = [{ partEvals, lineCount: 1 }];
    const result = computeComboDefaultActivation(lines, [], ctx);
    expect(result[0]).toEqual({});
  });

  it("fills zeros for unallocated parts across lines", () => {
    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const buff = makeBuffInfo(3);
    const bKey = buffSourceKey(buff.source);

    const parts0 = makeParts([
      { multi: 3.0, hits: 5 },
      { multi: 1.0, hits: 5 },
    ]);
    const parts1 = makeParts([
      { multi: 2.0, hits: 5 },
      { multi: 0.5, hits: 5 },
    ]);
    const pe0 = makePartEvals(parts0, postStats);
    const pe1 = makePartEvals(parts1, postStats);

    // Two lines, each with 2 parts, budget = 3
    const lines: ComboLineEval[] = [
      { partEvals: pe0, lineCount: 1 },
      { partEvals: pe1, lineCount: 1 },
    ];
    const result = computeComboDefaultActivation(lines, [buff], ctx);

    // Budget = 3 out of 20 total hits.
    // Highest multiplier: line 0 part 0 (multi=3.0), gets min(3, 5) = 3
    // Remaining 0 for all others → explicit 0
    expect(result[0][bKey]![0]).toBe(3);
    expect(result[0][bKey]![1]).toBe(0);
    expect(result[1][bKey]![0]).toBe(0);
    expect(result[1][bKey]![1]).toBe(0);
  });
});

describe("distributeComboHits", () => {
  it("fills first line before second", () => {
    // 3-hit formula, 2 lines with count=2 and count=1, total slider=4
    const result = distributeComboHits(4, 3, [2, 1]);
    // Line 0 (2 reps): max 6, gets 4
    // Line 1 (1 rep): max 3, gets 0
    expect(result).toEqual([4, 0]);
  });

  it("fills all lines when budget suffices", () => {
    const result = distributeComboHits(9, 3, [2, 1]);
    expect(result).toEqual([6, 3]);
  });

  it("partially fills a line", () => {
    // slider=7 out of 9 total
    const result = distributeComboHits(7, 3, [2, 1]);
    // Line 0 gets 6 (full), line 1 gets 1
    expect(result).toEqual([6, 1]);
  });

  it("handles zero budget", () => {
    expect(distributeComboHits(0, 3, [2, 1])).toEqual([0, 0]);
  });

  it("handles single line", () => {
    expect(distributeComboHits(4, 3, [3])).toEqual([4]);
  });
});

describe("aggregateComboFormulaDefaults", () => {
  it("sums per-line per-cast values for matching formula", () => {
    const bKey = "character:escoffier:C2";

    // Two combo lines for the same formula, each with different per-cast values
    const activeLines = [
      { charId: "skirk", formulaId: "burst", count: 2 },
      { charId: "skirk", formulaId: "burst", count: 3 },
    ];
    // Per-line per-cast: line 0 gets 1.5 per cast, line 1 gets 0.5 per cast
    const perLine = [{ [bKey]: { 0: 1.5 } }, { [bKey]: { 0: 0.5 } }];

    const result = aggregateComboFormulaDefaults(
      activeLines,
      perLine,
      "skirk",
      "burst"
    );

    // Total = 1.5 × 2 + 0.5 × 3 = 4.5
    expect(result[bKey]![0]).toBeCloseTo(4.5);
  });

  it("Escoffier C2 (maxStacks=5) across 4 reps keeps total ≤ 5", () => {
    // Simulate computeComboDefaultActivation giving per-cast values for a
    // 21-hit formula repeated 4 times. Budget = 5 across 84 total hits.
    // Greedy allocation: 5 stacks → per-cast = 5/4 = 1.25 each line.
    const bKey = "character:escoffier:C2";
    const activeLines = [
      { charId: "skirk", formulaId: "burst", count: 1 },
      { charId: "skirk", formulaId: "burst", count: 1 },
      { charId: "skirk", formulaId: "burst", count: 1 },
      { charId: "skirk", formulaId: "burst", count: 1 },
    ];
    const perLine = [
      { [bKey]: { 0: 1.25 } },
      { [bKey]: { 0: 1.25 } },
      { [bKey]: { 0: 1.25 } },
      { [bKey]: { 0: 1.25 } },
    ];

    const result = aggregateComboFormulaDefaults(
      activeLines,
      perLine,
      "skirk",
      "burst"
    );

    // Total must be exactly 5 (not 21 per-formula × 4)
    expect(result[bKey]![0]).toBe(5);
  });

  it("ignores lines for different formula", () => {
    const bKey = "character:escoffier:C2";
    const activeLines = [
      { charId: "skirk", formulaId: "burst", count: 2 },
      { charId: "skirk", formulaId: "charged", count: 1 },
    ];
    const perLine = [{ [bKey]: { 0: 2.0 } }, { [bKey]: { 0: 1.0 } }];

    const result = aggregateComboFormulaDefaults(
      activeLines,
      perLine,
      "skirk",
      "burst"
    );

    // Only line 0 matches → 2.0 × 2 = 4.0
    expect(result[bKey]![0]).toBe(4.0);
  });
});

describe("computeDefaultActivation — off-field parts", () => {
  it("uses per-part stats for off-field parts in multiplier ranking", () => {
    // Part 0: on-field, high multi (2 hits)
    // Part 1: off-field, high multi (3 hits)
    // Off-field stats have LOWER ATK, so part 1 has lower multiplier
    // Budget = 3 → should go to part 0 first (higher multiplier), then part 1
    const parts = makeParts([
      { multi: 2.0, hits: 2 },
      { multi: 2.0, hits: 3, offField: true },
    ]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "baseDmg", value: 500 },
    ]);

    // Off-field stats have lower ATK → lower multiplier
    const offFieldPostStats = new StatSheet([
      { key: "baseAtk", value: 500 },
      { key: "baseDmg", value: 500 },
    ]);

    const buff = makeBuffInfo(3);
    const bKey = buffSourceKey(buff.source);

    // Per-part: part 0 uses on-field stats, part 1 uses off-field stats
    const partEvals = makePartEvalsWithStats(parts, [
      postStats,
      offFieldPostStats,
    ]);

    const result = computeDefaultActivation(partEvals, [buff], ctx);

    expect(result[bKey]).toBeDefined();
    // On-field part (baseAtk=1000) has higher multiplier than off-field (baseAtk=500)
    // So part 0 gets full 2 stacks first, part 1 gets remaining 1
    expect(result[bKey]![0]).toBe(2);
    expect(result[bKey]![1]).toBe(1);
  });

  it("falls back to same stats when no off-field variant provided", () => {
    // Even with offField: true, if caller provides same stats for all parts,
    // the fallback path is exercised.
    const parts = makeParts([
      { multi: 1.0, hits: 2 },
      { multi: 3.0, hits: 2, offField: true },
    ]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const buff = makeBuffInfo(3);
    const bKey = buffSourceKey(buff.source);

    // All parts use the same stats (no off-field variant)
    const partEvals = makePartEvals(parts, postStats);

    const result = computeDefaultActivation(partEvals, [buff], ctx);

    expect(result[bKey]).toBeDefined();
    // Both parts see the same stats (no off-field variant provided),
    // so the fallback path is exercised. Verify total allocated equals maxStacks.
    const total = result[bKey]![0] + result[bKey]![1];
    expect(total).toBe(3);
  });
});

describe("buffSourceKey", () => {
  it("produces deterministic key", () => {
    const source = {
      type: "character" as const,
      id: "escoffier",
      origin: "C2",
    };
    expect(buffSourceKey(source)).toBe("character:escoffier:C2");
  });

  it("handles missing origin", () => {
    const source = { type: "weapon" as const, id: "mistsplitter" };
    expect(buffSourceKey(source)).toBe("weapon:mistsplitter:");
  });
});

// ── On-field vs off-field stat routing ──────────────────────────────────────

/**
 * Mock that returns DIFFERENT stat sheets depending on onFieldCharId.
 * - getPostStats("alice", "alice") → onFieldStats (ATK 2000)
 * - getPostStats("alice", "bob")  → offFieldStats (ATK 1000)
 *
 * This lets us verify that on-field parts use on-field stats and
 * off-field parts use off-field stats.
 */
function mockFieldAwareTeamStats(
  onFieldStats: StatSheet,
  offFieldStats: StatSheet
): TeamStatSheet {
  return {
    getPostStats(
      _charId: string,
      onFieldCharId: string,
      _excludeKeys?: Set<string>
    ): StatSheet {
      return onFieldCharId === "alice" ? onFieldStats : offFieldStats;
    },
    getAllPostStats(onFieldCharId: string): Record<string, StatSheet> {
      const stats = onFieldCharId === "alice" ? onFieldStats : offFieldStats;
      return { alice: stats, bob: stats };
    },
    getCharLevel(_charId: string): number {
      return 90;
    },
    getDefaultOnFieldCharId(charId: string): string {
      return charId === "alice" ? "bob" : "alice";
    },
  } as unknown as TeamStatSheet;
}

describe("on-field vs off-field stat routing", () => {
  const highAtkStats = StatSheet.fromEntries(
    [{ key: "atk" as StatKey, value: 1000 }],
    { elements: ["Cryo" as const], abilities: ["skill" as const] }
  );
  const lowAtkStats = StatSheet.fromEntries(
    [{ key: "atk" as StatKey, value: 500 }],
    { elements: ["Cryo" as const], abilities: ["skill" as const] }
  );

  // alice on-field → highAtk, alice off-field (bob on-field) → lowAtk
  const ts = mockFieldAwareTeamStats(highAtkStats, lowAtkStats);

  const mixedParts = makeParts([
    { multi: 1, hits: 1, offField: false }, // on-field part
    { multi: 1, hits: 1, offField: true }, // off-field part
  ]);

  const mixedEntry: FormulaEntry = {
    label: { en: "test", zh: "test" },
    parts: mixedParts,
  };

  it("computeBlendedDamage: on-field part uses on-field stats, off-field part uses off-field stats", () => {
    const mixed = computeBlendedDamage(mixedParts, {}, "alice", ts, ctx);

    // Same formula multiplier, so damage difference comes purely from stats
    expect(mixed.partDamages[0].damage).toBeGreaterThan(
      mixed.partDamages[1].damage
    );

    // Verify against single-part baselines
    const onFieldOnly = computeBlendedDamage(
      makeParts([{ multi: 1, hits: 1, offField: false }]),
      {},
      "alice",
      ts,
      ctx
    );
    const offFieldOnly = computeBlendedDamage(
      makeParts([{ multi: 1, hits: 1, offField: true }]),
      {},
      "alice",
      ts,
      ctx
    );

    expect(mixed.partDamages[0].damage).toBe(onFieldOnly.totalDamage);
    expect(mixed.partDamages[1].damage).toBe(offFieldOnly.totalDamage);
    // Confirm they're actually different (stats diverge)
    expect(onFieldOnly.totalDamage).not.toBe(offFieldOnly.totalDamage);
  });

  it("evaluateFormulaDamage: on-field part uses on-field stats, off-field part uses off-field stats", () => {
    const result = evaluateFormulaDamage(mixedEntry, "alice", ts, ctx);

    expect(result.parts[0].damage).toBeGreaterThan(result.parts[1].damage);

    // Cross-check: all-on-field entry should match on-field part
    const allOnEntry: FormulaEntry = {
      label: { en: "test", zh: "test" },
      parts: makeParts([{ multi: 1, hits: 1, offField: false }]),
    };
    const onResult = evaluateFormulaDamage(allOnEntry, "alice", ts, ctx);
    expect(result.parts[0].damage).toBe(onResult.parts[0].damage);

    // Cross-check: all-off-field entry should match off-field part
    const allOffEntry: FormulaEntry = {
      label: { en: "test", zh: "test" },
      parts: makeParts([{ multi: 1, hits: 1, offField: true }]),
    };
    const offResult = evaluateFormulaDamage(allOffEntry, "alice", ts, ctx);
    expect(result.parts[1].damage).toBe(offResult.parts[0].damage);
  });

  it("evaluateFormulaDisplay: on-field part uses on-field stats, off-field part uses off-field stats", () => {
    const display = evaluateFormulaDisplay(mixedEntry, "alice", ts, ctx);

    // Display parts should show different damage for on-field vs off-field
    const onFieldDp = display.parts.find((p) => !p.offField)!;
    const offFieldDp = display.parts.find((p) => p.offField)!;
    expect(onFieldDp).toBeDefined();
    expect(offFieldDp).toBeDefined();
    expect(onFieldDp.damage).toBeGreaterThan(offFieldDp.damage);
  });

  it("forceOnField collapses off-field parts to use on-field stats", () => {
    const withForce = computeBlendedDamage(
      mixedParts,
      {},
      "alice",
      ts,
      ctx,
      undefined,
      true // forceOnField
    );
    const withoutForce = computeBlendedDamage(mixedParts, {}, "alice", ts, ctx);

    // With forceOnField, both parts should use on-field stats → same damage
    expect(withForce.partDamages[0].damage).toBe(
      withForce.partDamages[1].damage
    );
    // Without forceOnField, they differ
    expect(withoutForce.partDamages[0].damage).not.toBe(
      withoutForce.partDamages[1].damage
    );
    // The off-field part should have higher damage with forceOnField (on-field stats > off-field stats)
    expect(withForce.partDamages[1].damage).toBeGreaterThan(
      withoutForce.partDamages[1].damage
    );
    // The on-field part should be unchanged
    expect(withForce.partDamages[0].damage).toBe(
      withoutForce.partDamages[0].damage
    );
  });

  it("evaluateFormulaDamage: forceOnField makes all parts use on-field stats", () => {
    const forced = evaluateFormulaDamage(
      mixedEntry,
      "alice",
      ts,
      ctx,
      undefined,
      undefined,
      true
    );
    const normal = evaluateFormulaDamage(mixedEntry, "alice", ts, ctx);

    // With forceOnField, both parts get on-field stats → identical damage
    expect(forced.parts[0].damage).toBe(forced.parts[1].damage);
    // Total damage should be higher with forceOnField
    expect(forced.totalDamage).toBeGreaterThan(normal.totalDamage);
  });

  it("evaluateFormulaDisplay: forceOnField removes offField flag from display parts", () => {
    const forced = evaluateFormulaDisplay(
      mixedEntry,
      "alice",
      ts,
      ctx,
      undefined,
      true
    );

    // No part should be marked offField
    expect(forced.parts.every((p) => !p.offField)).toBe(true);
    // Both parts should have equal damage (same stats)
    expect(forced.parts[0].damage).toBe(forced.parts[1].damage);
  });
});
