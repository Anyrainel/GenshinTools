import { isPartOffField } from "@/lib/team-comp/calc/fieldState";
import { describe, expect, it } from "vitest";

describe("reactionResolve helpers", () => {
  it("isPartOffField returns the intrinsic offField unless forceOnField overrides it", () => {
    // On-field part stays on-field regardless of override
    expect(isPartOffField({ offField: false }, undefined)).toBe(false);
    expect(isPartOffField({ offField: false }, null)).toBe(false);
    expect(isPartOffField({ offField: false }, {})).toBe(false);
    expect(isPartOffField({ offField: false }, { forceOnField: true })).toBe(
      false
    );

    // Off-field part respects forceOnField override
    expect(isPartOffField({ offField: true }, undefined)).toBe(true);
    expect(isPartOffField({ offField: true }, null)).toBe(true);
    expect(isPartOffField({ offField: true }, {})).toBe(true);
    expect(isPartOffField({ offField: true }, { forceOnField: false })).toBe(
      true
    );
    expect(isPartOffField({ offField: true }, { forceOnField: true })).toBe(
      false
    );
  });
});
