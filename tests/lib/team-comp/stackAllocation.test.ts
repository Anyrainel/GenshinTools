import { describe, expect, it } from "vitest";

import { DirectFormula, StatSheet } from "@/lib/team-comp/damageModels";
import type { FormulaPart } from "@/lib/team-comp/damageModels";
import {
  type ComboLineContext,
  type PartialBuffInfo,
  type StackLimitedBuffInfo,
  buildPartialBuffInfos,
  computeBlendedDamage,
  computeComboDefaultActivation,
  computeDefaultActivation,
  distributeComboHits,
} from "@/lib/team-comp/stackAllocation";
import type { CalcContext } from "@/lib/team-comp/types";
import { buffSourceKey, exclusionKey } from "@/lib/team-comp/types";

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
function makeBuffInfo(maxStacks: number, origin = "C2"): StackLimitedBuffInfo {
  return {
    source: {
      type: "character",
      id: "escoffier",
      origin,
      maxStacks,
    },
    maxStacks,
  };
}

/**
 * Helper: build sans-buff stats for computeDefaultActivation tests.
 * Removes the given entries from postStats to simulate excluding the buff.
 */
function makeSansBuffStats(
  postStats: StatSheet,
  buffs: StackLimitedBuffInfo[],
  removals: { key: string; value: number }[][]
): Map<string, StatSheet> {
  const filter = {
    elements: ["Cryo" as const],
    abilities: ["skill" as const],
  };
  const result = new Map<string, StatSheet>();
  for (let i = 0; i < buffs.length; i++) {
    const bKey = buffSourceKey(buffs[i].source);
    let sans = postStats;
    for (const entry of removals[i]) {
      sans = sans.merge(
        StatSheet.fromEntries([{ key: entry.key, value: -entry.value }], filter)
      );
    }
    result.set(bKey, sans);
  }
  return result;
}

/**
 * Helper: build stat variants map for computeBlendedDamage tests.
 * Each variant entry maps an exclusionKey → StatSheet with those buffs removed.
 */
function makeStatVariants(
  postStats: StatSheet,
  buffConfigs: { buffKey: string; entries: { key: string; value: number }[] }[]
): Map<string, StatSheet> {
  const filter = {
    elements: ["Cryo" as const],
    abilities: ["skill" as const],
  };
  const variants = new Map<string, StatSheet>();

  // Build variants for all 2^N combinations (excluding empty set)
  const n = buffConfigs.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const excludeSet = new Set<string>();
    let stats = postStats;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        excludeSet.add(buffConfigs[i].buffKey);
        for (const entry of buffConfigs[i].entries) {
          stats = stats.merge(
            StatSheet.fromEntries(
              [{ key: entry.key, value: -entry.value }],
              filter
            )
          );
        }
      }
    }
    variants.set(exclusionKey(excludeSet), stats);
  }

  return variants;
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
    const sansBuffStats = makeSansBuffStats(
      postStats,
      [buff],
      [[{ key: "baseDmg", value: 500 }]]
    );
    const result = computeDefaultActivation(
      parts,
      [buff],
      postStats,
      90,
      ctx,
      undefined,
      undefined,
      sansBuffStats
    );

    const bKey = buffSourceKey(buff.source);
    expect(result[bKey]).toBeDefined();
    // With 5 stacks: 2 to part 0 (highest marginal), 3 to part 1
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
    const sansBuffStats = makeSansBuffStats(
      postStats,
      [buff],
      [[{ key: "baseDmg", value: 500 }]]
    );
    const result = computeDefaultActivation(
      parts,
      [buff],
      postStats,
      90,
      ctx,
      undefined,
      undefined,
      sansBuffStats
    );

    expect(Object.keys(result)).toHaveLength(0);
  });

  it("handles single-part formula correctly", () => {
    const parts = makeParts([{ multi: 2.16, hits: 21 }]);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const buff = makeBuffInfo(5);
    const sansBuffStats = makeSansBuffStats(
      postStats,
      [buff],
      [[{ key: "baseDmg", value: 500 }]]
    );
    const result = computeDefaultActivation(
      parts,
      [buff],
      postStats,
      90,
      ctx,
      undefined,
      undefined,
      sansBuffStats
    );

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

    const sansBuffStats = makeSansBuffStats(
      postStats,
      [buff1, buff2],
      [[{ key: "baseDmg", value: 300 }], [{ key: "dmg%", value: 0.2 }]]
    );

    const result = computeDefaultActivation(
      parts,
      [buff1, buff2],
      postStats,
      90,
      ctx,
      undefined,
      undefined,
      sansBuffStats
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

describe("buildPartialBuffInfos", () => {
  it("fills 0 for parts not in greedy allocation (regression)", () => {
    // 3 parts: part 0 (2 hits), part 1 (5 hits), part 2 (3 hits)
    // Budget = 5, greedy gives { 0: 2, 1: 3 } — part 2 missing (= 0 stacks)
    const parts = makeParts([
      { multi: 3.0, hits: 2 },
      { multi: 2.0, hits: 5 },
      { multi: 1.0, hits: 3 },
    ]);

    const buff = makeBuffInfo(5);
    const bKey = buffSourceKey(buff.source);

    // Simulate greedy result: part 2 gets 0 (missing from map)
    const activation = { [bKey]: { 0: 2, 1: 3 } };

    const specs = buildPartialBuffInfos(activation, [buff], parts);
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
    const buff = makeBuffInfo(3);
    const bKey = buffSourceKey(buff.source);

    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    // Greedy gives all 3 stacks to part 0 (2 hits) + 1 to part 1
    // But simulate: part 1 gets 0 stacks (missing from map)
    const activation = { [bKey]: { 0: 2 } };
    const specs = buildPartialBuffInfos(activation, [buff], parts);

    const variants = makeStatVariants(postStats, [
      { buffKey: bKey, entries: [{ key: "baseDmg", value: 500 }] },
    ]);
    const result = computeBlendedDamage(
      parts,
      specs,
      postStats,
      variants,
      90,
      ctx
    );

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

    // Empty partials = fully active, empty variants
    const result = computeBlendedDamage(
      parts,
      [],
      postStats,
      new Map(),
      90,
      ctx
    );

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
    const spec: PartialBuffInfo = {
      buffKey,
      partActivation: { 0: 5 }, // 5 out of 21 hits
    };

    const variants = makeStatVariants(postStats, [
      { buffKey, entries: [{ key: "baseDmg", value: 500 }] },
    ]);
    const result = computeBlendedDamage(
      parts,
      [spec],
      postStats,
      variants,
      90,
      ctx
    );

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
    const spec: PartialBuffInfo = {
      buffKey,
      partActivation: { 0: 5 },
    };

    const variants = makeStatVariants(postStats, [
      { buffKey, entries: [{ key: "baseDmg", value: buffValue }] },
    ]);

    const dmgWith = parts[0].formula.calc(postStats, 90, ctx);
    const fullDamage = dmgWith * 21;

    const blended = computeBlendedDamage(
      parts,
      [spec],
      postStats,
      variants,
      90,
      ctx
    );
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

    const spec1: PartialBuffInfo = {
      buffKey: buffKey1,
      partActivation: { 0: 3 }, // active for first 3 hits
    };
    const spec2: PartialBuffInfo = {
      buffKey: buffKey2,
      partActivation: { 0: 2 }, // active for first 2 hits
    };

    const variants = makeStatVariants(postStats, [
      { buffKey: buffKey1, entries: [{ key: "baseDmg", value: 300 }] },
      { buffKey: buffKey2, entries: [{ key: "dmg%", value: 0.5 }] },
    ]);

    const result = computeBlendedDamage(
      parts,
      [spec1, spec2],
      postStats,
      variants,
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

describe("computeComboDefaultActivation", () => {
  it("shares maxStack budget across all combo lines", () => {
    // Two lines: line 0 has high-damage formula (2 hits × 2 reps),
    // line 1 has low-damage formula (3 hits × 1 rep).
    // Budget = 5 stacks, total hits = 4 + 3 = 7.
    // Should allocate to highest marginal gain first (line 0's formula).
    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const filter = {
      elements: ["Cryo" as const],
      abilities: ["skill" as const],
    };
    const sansStats = postStats.merge(
      StatSheet.fromEntries([{ key: "baseDmg", value: -500 }], filter)
    );

    const buff = makeBuffInfo(5);
    const bKey = buffSourceKey(buff.source);
    const sansBuffMap = new Map([[bKey, sansStats]]);

    const lines: ComboLineContext[] = [
      {
        parts: makeParts([{ multi: 3.0, hits: 2 }]),
        lineCount: 2,
        postStats,
        charLevel: 90,
        sansBuffStats: sansBuffMap,
      },
      {
        parts: makeParts([{ multi: 1.0, hits: 3 }]),
        lineCount: 1,
        postStats,
        charLevel: 90,
        sansBuffStats: sansBuffMap,
      },
    ];

    const result = computeComboDefaultActivation(lines, [buff], ctx);

    // Line 0: 2 hits × 2 reps = 4 available, high marginal → gets 4 stacks
    // Line 1: 3 hits × 1 rep = 3 available, low marginal → gets remaining 1 stack
    // Per-cast: line 0 = 4/2 = 2 (full), line 1 = 1/1 = 1
    expect(result[0][bKey]![0]).toBe(2); // line 0, part 0: full (2 hits per cast)
    expect(result[1][bKey]![0]).toBe(1); // line 1, part 0: 1 out of 3 hits
  });

  it("does not allocate when budget covers all hits", () => {
    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const filter = {
      elements: ["Cryo" as const],
      abilities: ["skill" as const],
    };
    const sansStats = postStats.merge(
      StatSheet.fromEntries([{ key: "baseDmg", value: -500 }], filter)
    );

    // maxStacks=5 covers all 2 hits
    const buff = makeBuffInfo(5);
    const bKey = buffSourceKey(buff.source);
    const sansBuffMap = new Map([[bKey, sansStats]]);

    const lines: ComboLineContext[] = [
      {
        parts: makeParts([{ multi: 2.0, hits: 2 }]),
        lineCount: 1,
        postStats,
        charLevel: 90,
        sansBuffStats: sansBuffMap,
      },
    ];
    const result = computeComboDefaultActivation(lines, [buff], ctx);
    // No entry: budget covers everything
    expect(result[0][bKey]).toBeUndefined();
  });

  it("returns empty maps when no stack-limited buffs", () => {
    const postStats = new StatSheet([{ key: "baseAtk", value: 800 }]);
    const lines: ComboLineContext[] = [
      {
        parts: makeParts([{ multi: 2.0, hits: 3 }]),
        lineCount: 1,
        postStats,
        charLevel: 90,
      },
    ];
    const result = computeComboDefaultActivation(lines, [], ctx);
    expect(result[0]).toEqual({});
  });

  it("fills zeros for unallocated parts across lines", () => {
    const postStats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "baseDmg", value: 500 },
    ]);

    const filter = {
      elements: ["Cryo" as const],
      abilities: ["skill" as const],
    };
    const sansStats = postStats.merge(
      StatSheet.fromEntries([{ key: "baseDmg", value: -500 }], filter)
    );

    const buff = makeBuffInfo(3);
    const bKey = buffSourceKey(buff.source);
    const sansBuffMap = new Map([[bKey, sansStats]]);

    // Two lines, each with 2 parts, budget = 3
    const lines: ComboLineContext[] = [
      {
        parts: makeParts([
          { multi: 3.0, hits: 5 },
          { multi: 1.0, hits: 5 },
        ]),
        lineCount: 1,
        postStats,
        charLevel: 90,
        sansBuffStats: sansBuffMap,
      },
      {
        parts: makeParts([
          { multi: 2.0, hits: 5 },
          { multi: 0.5, hits: 5 },
        ]),
        lineCount: 1,
        postStats,
        charLevel: 90,
        sansBuffStats: sansBuffMap,
      },
    ];
    const result = computeComboDefaultActivation(lines, [buff], ctx);

    // Budget = 3 out of 20 total hits.
    // Highest marginal: line 0 part 0 (multi=3.0), gets min(3, 5) = 3
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
