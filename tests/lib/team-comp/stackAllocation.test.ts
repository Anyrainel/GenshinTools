import { describe, expect, it } from "vitest";

import { DirectFormula, StatSheet } from "@/lib/team-comp/damageModels";
import type { FormulaPart } from "@/lib/team-comp/damageModels";
import {
  type PartialBuffSpec,
  type StackLimitedBuffInfo,
  buildPartialBuffSpecs,
  computeBlendedDamage,
  computeDefaultActivation,
  distributeComboHits,
} from "@/lib/team-comp/stackAllocation";
import type { CalcContext } from "@/lib/team-comp/types";
import { buffSourceKey } from "@/lib/team-comp/types";

const ctx: CalcContext = { enemyLevel: 90, enemyRes: 0.1 };

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
function makeBuffInfo(
  maxStacks: number,
  entries: { key: string; value: number }[],
  origin = "C2"
): StackLimitedBuffInfo {
  return {
    source: {
      type: "character",
      id: "escoffier",
      origin,
      maxStacks,
    },
    maxStacks,
    entries: entries as StackLimitedBuffInfo["entries"],
    filter: {
      elements: ["Cryo"],
      abilities: ["skill"],
    },
  };
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

    const buff = makeBuffInfo(5, [{ key: "baseDmg", value: 500 }]);
    const result = computeDefaultActivation(parts, [buff], postStats, 90, ctx);

    const bKey = buffSourceKey(buff.source);
    expect(result[bKey]).toBeDefined();
    // With 5 stacks: 2 to part 0 (highest marginal), 3 to part 1
    expect(result[bKey]![0]).toBe(2);
    expect(result[bKey]![1]).toBe(3);
    // Part 2 gets nothing (not in map means 0)
    expect(result[bKey]![2]).toBeUndefined();
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
    const buff = makeBuffInfo(5, [{ key: "baseDmg", value: 500 }]);
    const result = computeDefaultActivation(parts, [buff], postStats, 90, ctx);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it("handles single-part formula correctly", () => {
    const parts = makeParts([{ multi: 2.16, hits: 21 }]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const buff = makeBuffInfo(5, [{ key: "baseDmg", value: 500 }]);
    const result = computeDefaultActivation(parts, [buff], postStats, 90, ctx);

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

    const buff1 = makeBuffInfo(5, [{ key: "baseDmg", value: 300 }], "C2");
    const buff2 = makeBuffInfo(3, [{ key: "dmg%", value: 0.2 }], "C4");

    const result = computeDefaultActivation(
      parts,
      [buff1, buff2],
      postStats,
      90,
      ctx
    );

    const bKey1 = buffSourceKey(buff1.source);
    const bKey2 = buffSourceKey(buff2.source);
    expect(result[bKey1]).toBeDefined();
    expect(result[bKey2]).toBeDefined();
    // Both should prioritize part 0 (higher damage)
    expect(result[bKey1]![0]).toBe(5);
    expect(result[bKey2]![0]).toBe(3);
  });

  it("returns empty when no stack-limited buffs", () => {
    const parts = makeParts([{ multi: 2.0, hits: 5 }]);
    const postStats = new StatSheet([{ key: "baseAtk", value: 800 }]);

    const result = computeDefaultActivation(parts, [], postStats, 90, ctx);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("buildPartialBuffSpecs", () => {
  it("fills 0 for parts not in greedy allocation (regression)", () => {
    // 3 parts: part 0 (2 hits), part 1 (5 hits), part 2 (3 hits)
    // Budget = 5, greedy gives { 0: 2, 1: 3 } — part 2 missing (= 0 stacks)
    const parts = makeParts([
      { multi: 3.0, hits: 2 },
      { multi: 2.0, hits: 5 },
      { multi: 1.0, hits: 3 },
    ]);

    const buff = makeBuffInfo(5, [{ key: "baseDmg", value: 500 }]);
    const bKey = buffSourceKey(buff.source);

    // Simulate greedy result: part 2 gets 0 (missing from map)
    const activation = { [bKey]: { 0: 2, 1: 3 } };

    const specs = buildPartialBuffSpecs(activation, [buff], parts);
    expect(specs).toHaveLength(1);

    // Part 2 must have explicit 0, not be missing
    expect(specs[0].partActivation[2]).toBe(0);
    // Parts with stacks are preserved
    expect(specs[0].partActivation[0]).toBe(2);
    expect(specs[0].partActivation[1]).toBe(3);
  });

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
    const buff = makeBuffInfo(3, [{ key: "baseDmg", value: 500 }]);
    const bKey = buffSourceKey(buff.source);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    // Greedy gives all 3 stacks to part 0 (2 hits) + 1 to part 1
    // But simulate: part 1 gets 0 stacks (missing from map)
    const activation = { [bKey]: { 0: 2 } };
    const specs = buildPartialBuffSpecs(activation, [buff], parts);

    const result = computeBlendedDamage(parts, specs, postStats, 90, ctx);

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

    // Empty partials = fully active
    const result = computeBlendedDamage(parts, [], postStats, 90, ctx);

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

    const spec: PartialBuffSpec = {
      negatedEntries: [{ key: "baseDmg", value: -500 }],
      filter,
      partActivation: { 0: 5 }, // 5 out of 21 hits
    };

    const result = computeBlendedDamage(parts, [spec], postStats, 90, ctx);

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

    const spec: PartialBuffSpec = {
      negatedEntries: [{ key: "baseDmg", value: -buffValue }],
      filter,
      partActivation: { 0: 5 },
    };

    const dmgWith = parts[0].formula.calc(postStats, 90, ctx);
    const fullDamage = dmgWith * 21;

    const blended = computeBlendedDamage(parts, [spec], postStats, 90, ctx);
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

    const spec1: PartialBuffSpec = {
      negatedEntries: [{ key: "baseDmg", value: -300 }],
      filter,
      partActivation: { 0: 3 }, // active for first 3 hits
    };
    const spec2: PartialBuffSpec = {
      negatedEntries: [{ key: "dmg%", value: -0.5 }],
      filter,
      partActivation: { 0: 2 }, // active for first 2 hits
    };

    const result = computeBlendedDamage(
      parts,
      [spec1, spec2],
      postStats,
      90,
      ctx
    );

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
