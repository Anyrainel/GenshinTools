import {
  adjustPartDamage,
  formulaCritRatio,
} from "@/lib/dmgcalc/core/formulaDisplay";
import type { DisplayPart } from "@/lib/dmgcalc/types";
import { describe, expect, it } from "vitest";

/** Helper to build a minimal DisplayPart with the fields adjustPartDamage reads. */
function makePart(
  overrides: Partial<DisplayPart> & {
    cr?: number;
    cd?: number;
    damage: number;
  }
): DisplayPart {
  return {
    template: "direct",
    statValues: { cr: overrides.cr ?? 0.5, cd: overrides.cd ?? 1.0 },
    params: { charLevel: 90, enemyLevel: 100, enemyRes: 0.1 },
    scalingKeys: [],
    scalingMulti: [],
    tag: {
      element: "pyro",
      ability: "normal",
      reaction: "none",
    },
    ...overrides,
  } as DisplayPart;
}

describe("adjustPartDamage", () => {
  it("returns original damage for expected mode", () => {
    const p = makePart({ damage: 10000, cr: 0.5, cd: 1.0 });
    expect(adjustPartDamage(p, "expected")).toBe(10000);
  });

  it("computes crit damage correctly", () => {
    // expected crit mult = 1 + 0.5 * 1.0 = 1.5
    // crit mult = 1 + 1.0 = 2.0
    // adjusted = 10000 / 1.5 * 2.0 = 13333.33...
    const p = makePart({ damage: 10000, cr: 0.5, cd: 1.0 });
    expect(adjustPartDamage(p, "crit")).toBeCloseTo(13333.33, 0);
  });

  it("computes non-crit damage correctly", () => {
    // expected crit mult = 1 + 0.5 * 1.0 = 1.5
    // noCrit mult = 1
    // adjusted = 10000 / 1.5 * 1 = 6666.67
    const p = makePart({ damage: 10000, cr: 0.5, cd: 1.0 });
    expect(adjustPartDamage(p, "noCrit")).toBeCloseTo(6666.67, 0);
  });

  it("crit mode returns same damage when cr >= 100%", () => {
    // expected mult = 1 + 1.0 * 1.0 = 2.0, crit mult = 2.0 — same
    const p = makePart({ damage: 20000, cr: 1.0, cd: 1.0 });
    expect(adjustPartDamage(p, "crit")).toBeCloseTo(20000, 0);
  });

  it("noCrit mode returns same damage when cr = 0", () => {
    // expected mult = 1 + 0 * 1.0 = 1, noCrit mult = 1 — same
    const p = makePart({ damage: 5000, cr: 0, cd: 1.0 });
    expect(adjustPartDamage(p, "noCrit")).toBeCloseTo(5000, 0);
  });

  it("uses reactionCr/reactionCd for transform template", () => {
    const p = makePart({
      damage: 8000,
      template: "transform",
      statValues: { reactionCr: 0.6, reactionCd: 0.8 },
    } as Partial<DisplayPart> & { damage: number });
    // expected mult = 1 + 0.6 * 0.8 = 1.48
    // crit mult = 1 + 0.8 = 1.8
    expect(adjustPartDamage(p, "crit")).toBeCloseTo((8000 / 1.48) * 1.8, 0);
  });
});

describe("formulaCritRatio", () => {
  it("returns 1 for expected mode", () => {
    const parts = [makePart({ damage: 10000, cr: 0.5, cd: 1.0 })];
    expect(formulaCritRatio(parts, "expected")).toBe(1);
  });

  it("returns 1 for empty parts", () => {
    expect(formulaCritRatio([], "crit")).toBe(1);
  });

  it("returns 1 for zero-damage parts", () => {
    const parts = [makePart({ damage: 0, cr: 0.5, cd: 1.0 })];
    expect(formulaCritRatio(parts, "crit")).toBe(1);
  });

  it("returns correct crit ratio for single part", () => {
    // expected mult = 1 + 0.5 * 1.0 = 1.5
    // crit mult = 1 + 1.0 = 2.0
    // ratio = 2.0 / 1.5 = 1.3333...
    const parts = [makePart({ damage: 10000, cr: 0.5, cd: 1.0 })];
    expect(formulaCritRatio(parts, "crit")).toBeCloseTo(2.0 / 1.5, 6);
  });

  it("returns correct noCrit ratio for single part", () => {
    // expected mult = 1 + 0.5 * 1.0 = 1.5
    // noCrit mult = 1
    // ratio = 1.0 / 1.5 = 0.6667
    const parts = [makePart({ damage: 10000, cr: 0.5, cd: 1.0 })];
    expect(formulaCritRatio(parts, "noCrit")).toBeCloseTo(1.0 / 1.5, 6);
  });

  it("handles multi-hit parts correctly", () => {
    // Two parts: one with 3 hits, one with 1 hit, same CR/CD
    const parts = [
      makePart({ damage: 5000, cr: 0.7, cd: 1.4, hits: 3 }),
      makePart({ damage: 12000, cr: 0.7, cd: 1.4, hits: 1 }),
    ];
    // Since both share the same CR/CD, ratio = targetMult / expectedMult
    // expected mult = 1 + 0.7 * 1.4 = 1.98
    // crit mult = 1 + 1.4 = 2.4
    const ratio = formulaCritRatio(parts, "crit");
    expect(ratio).toBeCloseTo(2.4 / 1.98, 6);
  });

  it("scales lineDamages correctly when applied as multiplier", () => {
    const parts = [makePart({ damage: 8000, cr: 0.5, cd: 1.0, hits: 2 })];
    const ratio = formulaCritRatio(parts, "crit");

    const lineDamagePerHit = 16000; // 8000 * 2 hits
    const adjustedPerHit = lineDamagePerHit * ratio;

    // Manual: expected sum = 8000 * 2 = 16000
    // crit per hit = 8000 / 1.5 * 2.0 = 10666.67
    // adjusted sum = 10666.67 * 2 = 21333.33
    // ratio = 21333.33 / 16000 = 1.3333
    // adjustedPerHit = 16000 * 1.3333 = 21333.33
    expect(adjustedPerHit).toBeCloseTo(21333.33, 0);
  });

  it("handles mixed templates (direct + transform) in one formula", () => {
    // Direct part: cr=0.5, cd=1.0 → expected mult 1.5
    // Transform part: reactionCr=0.3, reactionCd=0.6 → expected mult 1.18
    const parts = [
      makePart({ damage: 10000, cr: 0.5, cd: 1.0, hits: 1 }),
      makePart({
        damage: 6000,
        template: "transform",
        statValues: { reactionCr: 0.3, reactionCd: 0.6 },
        hits: 1,
      } as Partial<DisplayPart> & { damage: number }),
    ];

    const critRatio = formulaCritRatio(parts, "crit");

    // Direct part adjusted: 10000 / 1.5 * 2.0 = 13333.33
    // Transform part adjusted: 6000 / 1.18 * 1.6 = 8135.59
    // Expected sum = 10000 + 6000 = 16000
    // Adjusted sum = 13333.33 + 8135.59 = 21468.93
    // ratio = 21468.93 / 16000 ≈ 1.34181
    const directAdj = (10000 / 1.5) * 2.0;
    const transformAdj = (6000 / 1.18) * 1.6;
    expect(critRatio).toBeCloseTo((directAdj + transformAdj) / 16000, 4);

    const noCritRatio = formulaCritRatio(parts, "noCrit");
    // Direct noCrit: 10000 / 1.5 * 1 = 6666.67
    // Transform noCrit: 6000 / 1.18 * 1 = 5084.75
    const directNoCrit = 10000 / 1.5;
    const transformNoCrit = 6000 / 1.18;
    expect(noCritRatio).toBeCloseTo(
      (directNoCrit + transformNoCrit) / 16000,
      4
    );
  });
});
