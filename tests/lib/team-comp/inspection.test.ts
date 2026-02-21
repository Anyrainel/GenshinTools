import { describe, expect, it } from "vitest";

import {
  AVG_SUBSTAT_ROLL,
  computeRollEquivalents,
  isTrivialBuff,
} from "@/lib/team-comp/inspection";
import type { ResolvedBuff, StatKey } from "@/lib/team-comp/types";

describe("AVG_SUBSTAT_ROLL", () => {
  it("has all 10 rollable substat keys", () => {
    const keys = Object.keys(AVG_SUBSTAT_ROLL);
    expect(keys).toHaveLength(10);
    expect(keys).toContain("cr");
    expect(keys).toContain("cd");
    expect(keys).toContain("atk%");
    expect(keys).toContain("hp%");
    expect(keys).toContain("def%");
    expect(keys).toContain("em");
    expect(keys).toContain("er");
    expect(keys).toContain("atk");
    expect(keys).toContain("hp");
    expect(keys).toContain("def");
  });

  it("CR avg roll is approximately 3.31%", () => {
    expect(AVG_SUBSTAT_ROLL.cr).toBeCloseTo(0.0331);
  });

  it("CD avg roll is approximately 6.62%", () => {
    expect(AVG_SUBSTAT_ROLL.cd).toBeCloseTo(0.0662);
  });
});

describe("computeRollEquivalents", () => {
  it("computes roll equivalents for known stats", () => {
    const stats: Partial<Record<StatKey, number>> = {
      cr: 0.331, // 10 rolls
      cd: 0.331, // 5 rolls
      em: 39.6, // 2 rolls
    };

    const rolls = computeRollEquivalents(stats);

    expect(rolls.cr).toBeCloseTo(10.0, 0);
    expect(rolls.cd).toBeCloseTo(5.0, 0);
    expect(rolls.em).toBeCloseTo(2.0, 0);
  });

  it("ignores non-rollable stats", () => {
    const stats: Partial<Record<StatKey, number>> = {
      "pyro%": 0.466, // not a rollable substat
    };

    const rolls = computeRollEquivalents(stats);
    expect(rolls["pyro%"]).toBeUndefined();
  });

  it("returns empty for empty stats", () => {
    expect(computeRollEquivalents({})).toEqual({});
  });
});

describe("isTrivialBuff", () => {
  const SRC = { type: "character" as const, id: "test" };
  const TGT = { receiver: "self" as const };

  it("returns true for buffs with zero-value entries", () => {
    const buff: ResolvedBuff = {
      source: SRC,
      target: TGT,
      active: true,
      staticEntries: [{ key: "atk%", value: 0 }],
      dynamicEntries: [],
    };
    expect(isTrivialBuff(buff)).toBe(true);
  });

  it("returns false for buffs with meaningful entries", () => {
    const buff: ResolvedBuff = {
      source: SRC,
      target: TGT,
      active: true,
      staticEntries: [{ key: "atk%", value: 0.25 }],
      dynamicEntries: [],
    };
    expect(isTrivialBuff(buff)).toBe(false);
  });

  it("returns false if dynamic entries are above threshold", () => {
    const buff: ResolvedBuff = {
      source: SRC,
      target: TGT,
      active: true,
      staticEntries: [],
      dynamicEntries: [{ key: "pyro%", value: 0.15, cap: 0.4 }],
    };
    expect(isTrivialBuff(buff)).toBe(false);
  });

  it("returns true for buffs with below-threshold entries", () => {
    const buff: ResolvedBuff = {
      source: SRC,
      target: TGT,
      active: true,
      staticEntries: [{ key: "atk%", value: 0.0005 }],
      dynamicEntries: [],
    };
    expect(isTrivialBuff(buff)).toBe(true);
  });

  it("custom threshold works", () => {
    const buff: ResolvedBuff = {
      source: SRC,
      target: TGT,
      active: true,
      staticEntries: [{ key: "cr", value: 0.01 }],
      dynamicEntries: [],
    };
    expect(isTrivialBuff(buff, 0.02)).toBe(true);
    expect(isTrivialBuff(buff, 0.005)).toBe(false);
  });
});
