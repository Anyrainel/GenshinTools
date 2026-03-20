import { adjustPartDamage } from "@/components/team-comp/FormulaBreakdown";
import type { DisplayPart } from "@/lib/team-comp/types";
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
