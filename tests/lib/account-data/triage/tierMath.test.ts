import {
  SUB_WEIGHTS,
  combinations,
  getTier,
  pDrawSet,
  pJoint,
} from "@/lib/account-data/triage/tierMath";
import { describe, expect, it } from "vitest";

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
    expect(getTier(0.005, "flower")).toBe("P");
  });

  it("moderately rare flower → Quality", () => {
    expect(getTier(0.02, "flower")).toBe("Q");
  });

  it("somewhat rare flower → Neutral", () => {
    expect(getTier(0.1, "flower")).toBe("N");
  });

  it("common flower → Trash", () => {
    expect(getTier(0.5, "flower")).toBe("T");
  });

  it("sands has stricter thresholds", () => {
    // 0.008 is Q for flower but P for sands? No: P threshold for sands = 0.005
    expect(getTier(0.003, "sands")).toBe("P");
    expect(getTier(0.008, "sands")).toBe("Q");
    expect(getTier(0.05, "sands")).toBe("N");
    expect(getTier(0.15, "sands")).toBe("T");
  });

  it("exact threshold boundaries", () => {
    // flowerFeather: premium=0.01, quality=0.04, neutral=0.20
    expect(getTier(0.01, "flower")).toBe("P"); // <= 0.01
    expect(getTier(0.04, "flower")).toBe("Q"); // <= 0.04
    expect(getTier(0.2, "flower")).toBe("N"); // <= 0.20
    expect(getTier(0.201, "flower")).toBe("T");
  });
});
