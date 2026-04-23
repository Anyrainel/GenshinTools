import { describe, expect, it } from "vitest";
import { isPartOffField } from "@/lib/dmgcalc/core/fieldState";

describe("reactionResolve helpers", () => {
  it("isPartOffField returns the intrinsic offField unless forceOnField overrides it", () => {
    // On-field part stays on-field regardless of override
    expect(isPartOffField({ offField: false }, undefined)).toBe(false);
    expect(isPartOffField({ offField: false }, false)).toBe(false);
    expect(isPartOffField({ offField: false }, true)).toBe(false);

    // Off-field part respects forceOnField override
    expect(isPartOffField({ offField: true }, undefined)).toBe(true);
    expect(isPartOffField({ offField: true }, false)).toBe(true);
    expect(isPartOffField({ offField: true }, true)).toBe(false);
  });
});
