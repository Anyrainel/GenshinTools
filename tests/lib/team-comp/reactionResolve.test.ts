import {
  getLineReaction,
  isForcedOnField,
  isPartOffField,
} from "@/lib/team-comp/reactionResolve";
import type { ComboLine } from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

describe("reactionResolve helpers", () => {
  it("isForcedOnField reflects the forceOnField flag", () => {
    expect(isForcedOnField(undefined)).toBe(false);
    expect(isForcedOnField(null)).toBe(false);
    expect(isForcedOnField({})).toBe(false);
    expect(isForcedOnField({ forceOnField: false })).toBe(false);
    expect(isForcedOnField({ forceOnField: true })).toBe(true);
  });

  it("isPartOffField returns the intrinsic offField unless forceOnField overrides it", () => {
    expect(isPartOffField({ offField: false }, undefined)).toBe(false);
    expect(isPartOffField({ offField: true }, undefined)).toBe(true);
    expect(isPartOffField({ offField: true }, {})).toBe(true);
    expect(isPartOffField({ offField: true }, { forceOnField: true })).toBe(
      false
    );
    expect(isPartOffField({ offField: false }, { forceOnField: true })).toBe(
      false
    );
  });

  it("getLineReaction returns the line's reaction override", () => {
    const line: ComboLine = {
      charId: "c",
      formulaId: "f",
      count: 1,
      reaction: { reaction: "vaporize", forceOnField: true },
    };
    expect(getLineReaction(line)?.reaction).toBe("vaporize");
    expect(getLineReaction(undefined)).toBeUndefined();
    expect(getLineReaction(null)).toBeUndefined();
  });
});
