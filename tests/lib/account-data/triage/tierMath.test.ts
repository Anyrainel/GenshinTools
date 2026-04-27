import { describe, expect, it } from "vitest";
import {
  combinations,
  getTier,
  pDrawSet,
  pJoint,
  SUB_WEIGHTS,
} from "@/lib/account-data/triage/tierMath";

describe("combinations", () => {
  it("returns [[]] for k=0", () => {
    expect(combinations([1, 2, 3], 0)).toEqual([[]]);
  });

  it("returns empty for k > array length", () => {
    expect(combinations([1, 2], 3)).toEqual([]);
  });

  it("C(4,2) = 6 combinations", () => {
    expect(combinations([1, 2, 3, 4], 2)).toHaveLength(6);
  });

  it("C(5,3) = 10 combinations", () => {
    expect(combinations([1, 2, 3, 4, 5], 3)).toHaveLength(10);
  });

  it("returns correct elements", () => {
    const result = combinations(["a", "b", "c"], 2);
    expect(result).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
    ]);
  });
});

describe("pDrawSet", () => {
  it("uniform pool of 2 items, draw 1 = 0.5", () => {
    expect(pDrawSet({ a: 1, b: 1 }, ["a"])).toBeCloseTo(0.5);
  });

  it("weighted pool draw probability", () => {
    // Pool: cr=3, cd=3, total=6. P(cr) = 3/6 = 0.5
    const p = pDrawSet({ cr: 3, cd: 3 }, ["cr"]);
    expect(p).toBeCloseTo(0.5);
  });

  it("draw 2 from pool of 3 sums permutations", () => {
    // Pool: a=1, b=1, c=1. P(draw {a,b}) = P(ab) + P(ba) = 1/3*1/2 + 1/3*1/2 = 1/3
    const p = pDrawSet({ a: 1, b: 1, c: 1 }, ["a", "b"]);
    expect(p).toBeCloseTo(1 / 3);
  });

  it("probabilities sum to 1 for all 2-draws from 3", () => {
    const pool = { a: 1, b: 1, c: 1 };
    const total =
      pDrawSet(pool, ["a", "b"]) +
      pDrawSet(pool, ["a", "c"]) +
      pDrawSet(pool, ["b", "c"]);
    expect(total).toBeCloseTo(1);
  });
});

describe("pJoint", () => {
  it("returns 0 when requiredStrict exceeds m", () => {
    expect(pJoint({ cr: 3, cd: 3 }, ["cr"], [], 1, 0, 0, ["cr"])).toBe(0);
  });

  it("p of at least 1 strict from 2 in 4 draws", () => {
    const { hp: _, ...pool } = SUB_WEIGHTS as Record<string, number>; // exclude one main stat
    const p = pJoint(pool, ["cr", "cd"], [], 1, 0, 4);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it("requiring more strict than available returns 0", () => {
    expect(pJoint({ cr: 3, cd: 3, atk: 6 }, ["cr"], [], 2, 0, 3)).toBe(0);
  });

  it("requiring cr+cd in 2 draws from small pool", () => {
    const pool = { cr: 3, cd: 3, atk: 6 };
    const p = pJoint(pool, ["cr", "cd"], [], 2, 0, 2);
    // P(cr,cd in any order from 2 draws) = 2 * (3/12 * 3/9) = 2/12 ≈ 0.1667
    expect(p).toBeCloseTo(2 * (3 / 12) * (3 / 9), 4);
  });
});

describe("getTier", () => {
  it("very rare flower → Premium", () => {
    expect(getTier(0.005, "flower")).toBe("prime");
  });

  it("moderately rare flower → Quality", () => {
    expect(getTier(0.02, "flower")).toBe("solid");
  });

  it("somewhat rare flower → Neutral", () => {
    expect(getTier(0.1, "flower")).toBe("filler");
  });

  it("common flower → Trash", () => {
    expect(getTier(0.5, "flower")).toBe("fodder");
  });

  it("sands has stricter thresholds", () => {
    // 0.008 is solid for flower but not prime for sands; prime threshold for sands is 0.005.
    expect(getTier(0.003, "sands")).toBe("prime");
    expect(getTier(0.008, "sands")).toBe("solid");
    expect(getTier(0.05, "sands")).toBe("filler");
    expect(getTier(0.15, "sands")).toBe("fodder");
  });

  it("exact threshold boundaries", () => {
    // flowerFeather: premium=0.01, quality=0.04, neutral=0.15
    expect(getTier(0.01, "flower")).toBe("prime"); // <= 0.01
    expect(getTier(0.04, "flower")).toBe("solid"); // <= 0.04
    expect(getTier(0.15, "flower")).toBe("filler"); // <= 0.15
    expect(getTier(0.151, "flower")).toBe("fodder");
  });

  it("loose mode uses looser thresholds — promotes artifacts one tier looser", () => {
    // A rarity of 0.08 is filler in strict (> 0.04 solid cap on flower) but solid in loose.
    expect(getTier(0.08, "flower", "strict")).toBe("filler");
    expect(getTier(0.08, "flower", "loose")).toBe("solid");

    // A rarity of 0.2 is fodder on flower in strict (> 0.15) but filler in loose.
    expect(getTier(0.2, "flower", "strict")).toBe("fodder");
    expect(getTier(0.2, "flower", "loose")).toBe("filler");

    // Sands: 0.03 is filler strict (> 0.02) but solid loose (<= 0.04).
    expect(getTier(0.03, "sands", "strict")).toBe("filler");
    expect(getTier(0.03, "sands", "loose")).toBe("solid");
  });

  it("strict mode is the default when mode argument is omitted", () => {
    expect(getTier(0.3, "flower")).toBe(getTier(0.3, "flower", "strict"));
  });
});
