import { describe, expect, it } from "vitest";

import { ErScalingBuff, deduplicateBuffs } from "@/lib/team-comp/damageBuffs";
import { ScalingBuff, StatBuff, StatSheet } from "@/lib/team-comp/damageModels";

describe("StatBuff", () => {
  it("base StatBuff has no dynamic buffs", () => {
    const buff = new StatBuff(
      { type: "character", id: "test", origin: "C1" },
      { receiver: "self" },
      [{ key: "atk%", value: 0.25 }]
    );
    expect(buff.staticBuffs).toHaveLength(1);
    expect(buff.dynamicBuffs(new StatSheet([]), [])).toHaveLength(0);
  });
});

describe("ScalingBuff", () => {
  it("computes dynamic buff from input stat", () => {
    const buff = new ScalingBuff(
      { type: "character", id: "test", origin: "C1" },
      { receiver: "onField" },
      [],
      "em",
      "pyro%",
      0.0004
    );
    const stats = new StatSheet([{ key: "em", value: 800 }]);
    const dynamic = buff.dynamicBuffs(stats);

    // 800 × 0.0004 = 0.32
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0]!.key).toBe("pyro%");
    expect(dynamic[0]!.value).toBeCloseTo(0.32);
  });

  it("respects cap", () => {
    const buff = new ScalingBuff(
      { type: "character", id: "test", origin: "C1" },
      { receiver: "onField" },
      [],
      "em",
      "pyro%",
      0.0004,
      0.2 // cap
    );
    const stats = new StatSheet([{ key: "em", value: 800 }]);
    const dynamic = buff.dynamicBuffs(stats);

    // 800 × 0.0004 = 0.32, capped to 0.20
    expect(dynamic[0]!.value).toBeCloseTo(0.2);
  });

  it("exposes inputKey, outputKey, cap as readonly", () => {
    const buff = new ScalingBuff(
      { type: "character", id: "test", origin: "C1" },
      { receiver: "onField" },
      [],
      "em",
      "pyro%",
      0.0004,
      0.2
    );
    expect(buff.inputKey).toBe("em");
    expect(buff.outputKey).toBe("pyro%");
    expect(buff.cap).toBeCloseTo(0.2);
  });
});

describe("ScalingBuff with threshold", () => {
  // Pattern: "For every 1 HP above 30000, gain 0.007% ATK"
  const buff = new ScalingBuff(
    { type: "character", id: "test", origin: "C1" },
    { receiver: "self" },
    [],
    "hp",
    "atk%",
    0.00007,
    undefined, // no cap
    30000 // threshold
  );

  it("subtracts threshold before scaling", () => {
    // HP = 15000 × (1 + 0.466) + 4780 = 26770
    const stats = new StatSheet([
      { key: "baseHp", value: 15000 },
      { key: "hp%", value: 0.466 },
      { key: "hp", value: 4780 },
    ]);
    const dynamic = buff.dynamicBuffs(stats);

    // HP 26770 < threshold 30000 → max(0, -3230) = 0
    expect(dynamic[0]!.value).toBe(0);
  });

  it("scales from HP above threshold", () => {
    const stats = new StatSheet([
      { key: "baseHp", value: 30000 },
      { key: "hp%", value: 0.4 },
      { key: "hp", value: 5000 },
    ]);
    const dynamic = buff.dynamicBuffs(stats);

    // HP = 30000 × 1.4 + 5000 = 47000
    // Above threshold: 47000 - 30000 = 17000
    // ATK% = 17000 × 0.00007 = 1.19
    expect(dynamic[0]!.value).toBeCloseTo(1.19, 2);
  });
});

describe("ErScalingBuff", () => {
  // Pattern: Engulfing Lightning — (ER - 100%) × 28% → ATK%, cap 80%
  const buff = new ErScalingBuff(
    { type: "weapon", id: "engulfing_lightning", origin: "R1" },
    { receiver: "self" },
    [],
    "atk%",
    0.28,
    0.8
  );

  it("scales ATK% from ER above 100%", () => {
    const stats = new StatSheet([{ key: "er", value: 1.5 }]);
    const dynamic = buff.dynamicBuffs(stats);

    // ER over base: 1.5 - 1.0 = 0.5 (raw)
    // ATK% = 0.5 × 0.28 = 0.14
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0]!.key).toBe("atk%");
    expect(dynamic[0]!.value).toBeCloseTo(0.14);
  });

  it("clamps to 0 when ER below 100%", () => {
    const stats = new StatSheet([{ key: "er", value: 0.8 }]);
    const dynamic = buff.dynamicBuffs(stats);

    // ER over base: max(0, 0.8 - 1.0) = 0
    expect(dynamic[0]!.value).toBe(0);
  });

  it("respects cap", () => {
    const stats = new StatSheet([{ key: "er", value: 5.0 }]);
    const dynamic = buff.dynamicBuffs(stats);

    // ER over base: 5.0 - 1.0 = 4.0
    // Raw ATK% = 4.0 × 0.28 = 1.12, capped to 0.80
    expect(dynamic[0]!.value).toBeCloseTo(0.8);
  });
});

describe("deduplicateBuffs", () => {
  const evaluator = (b: StatBuff) => b.staticBuffs;

  it("keeps all buffs if noStackId is absent", () => {
    const b1 = new StatBuff(
      { type: "weapon", id: "w1", origin: "R1" },
      { receiver: "self" },
      [{ key: "atk%", value: 0.1 }]
    );
    const b2 = new StatBuff(
      { type: "weapon", id: "w2", origin: "R1" },
      { receiver: "self" },
      [{ key: "atk%", value: 0.2 }]
    );

    const result = deduplicateBuffs([b1, b2], evaluator);
    expect(result).toHaveLength(2);
    expect(result).toContain(b1);
    expect(result).toContain(b2);
  });

  it("picks the highest value buff for the same noStackId", () => {
    const src1 = {
      type: "weapon" as const,
      id: "w1",
      origin: "R1",
      noStackId: "millennial-atk",
    };
    const src2 = {
      type: "weapon" as const,
      id: "w2",
      origin: "R1",
      noStackId: "millennial-atk",
    };

    // b2 provides more ATK% than b1
    const b1 = new StatBuff(src1, { receiver: "team" }, [
      { key: "atk%", value: 0.2 },
    ]);
    const b2 = new StatBuff(src2, { receiver: "team" }, [
      { key: "atk%", value: 0.4 },
    ]);

    // Order 1
    const res1 = deduplicateBuffs([b1, b2], evaluator);
    expect(res1).toHaveLength(1);
    expect(res1[0]).toBe(b2);

    // Order 2
    const res2 = deduplicateBuffs([b2, b1], evaluator);
    expect(res2).toHaveLength(1);
    expect(res2[0]).toBe(b2);
  });

  it("evaluates multiple entries sum for tie breaking", () => {
    const src1 = {
      type: "artifactSet" as const,
      id: "a1",
      noStackId: "set-buff",
    };
    const src2 = {
      type: "artifactSet" as const,
      id: "a2",
      noStackId: "set-buff",
    };

    // b1: 0.2 + 0.1 = 0.3 total sum
    const b1 = new StatBuff(src1, { receiver: "team" }, [
      { key: "atk%", value: 0.2 },
      { key: "cr", value: 0.1 },
    ]);

    // b2: 0.4 total sum
    const b2 = new StatBuff(src2, { receiver: "team" }, [
      { key: "atk%", value: 0.4 },
    ]);

    const res = deduplicateBuffs([b1, b2], evaluator);
    expect(res).toHaveLength(1);
    expect(res[0]).toBe(b2);
  });

  it("handles a mix of stacked and non-stacked buffs", () => {
    const b1 = new StatBuff(
      { type: "weapon", id: "w1", origin: "R1" },
      { receiver: "self" },
      [{ key: "hp%", value: 0.1 }]
    );
    const b2 = new StatBuff(
      { type: "weapon", id: "w2", origin: "R1", noStackId: "stacker" },
      { receiver: "team" },
      [{ key: "hp%", value: 0.2 }]
    );
    const b3 = new StatBuff(
      { type: "weapon", id: "w3", origin: "R1", noStackId: "stacker" },
      { receiver: "team" },
      [{ key: "hp%", value: 0.4 }]
    );
    const b4 = new StatBuff(
      { type: "weapon", id: "w4", origin: "R1" },
      { receiver: "self" },
      [{ key: "hp%", value: 0.5 }]
    );

    const res = deduplicateBuffs([b1, b2, b3, b4], evaluator);

    // Should keep b1, b3 (won over b2), and b4
    expect(res).toHaveLength(3);
    expect(res).toContain(b1);
    expect(res).toContain(b3);
    expect(res).toContain(b4);
    expect(res).not.toContain(b2);
  });
});
