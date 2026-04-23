import { describe, expect, it } from "vitest";
import { isPctStat } from "@/data/utils";
import {
  fmtDamage,
  fmtMult,
  fmtPercent,
  fmtStat,
} from "@/lib/team-comp/displayFormatter";

describe("fmtStat", () => {
  it("returns '0' for zero value", () => {
    expect(fmtStat("atk", 0)).toBe("0");
    expect(fmtStat("cr", 0)).toBe("0");
  });

  it("formats percent-key stats (cr, cd, er) as percentages", () => {
    expect(fmtStat("cr", 0.5)).toBe("50.0%");
    expect(fmtStat("cd", 1.2)).toBe("120.0%");
    expect(fmtStat("er", 0.2)).toBe("20.0%");
  });

  it("formats keys ending with '%' as percentages", () => {
    expect(fmtStat("atk%", 0.466)).toBe("46.6%");
    expect(fmtStat("hp%", 0.2)).toBe("20.0%");
    expect(fmtStat("pyro%", 0.466)).toBe("46.6%");
  });

  it("formats reactionCr and reactionCd as percentages", () => {
    expect(fmtStat("reactionCr", 0.4)).toBe("40.0%");
    expect(fmtStat("reactionCd", 0.5)).toBe("50.0%");
  });

  it("formats flat stats as localized numbers", () => {
    expect(fmtStat("atk", 311)).toMatch(/311/);
    expect(fmtStat("hp", 4780)).toMatch(/4[,.]?780/);
  });

  it("adds '+' sign when forceSign is true and value is positive", () => {
    expect(fmtStat("cr", 0.1, true)).toBe("+10.0%");
    expect(fmtStat("atk", 100, true)).toMatch(/^\+100/);
  });

  it("does not add '+' for negative values even with forceSign", () => {
    expect(fmtStat("cr", -0.1, true)).toBe("-10.0%");
  });

  it("does not add '+' when forceSign is false", () => {
    expect(fmtStat("cr", 0.5, false)).toBe("50.0%");
    expect(fmtStat("cr", 0.5)).toBe("50.0%");
  });

  it("formats human-readable percent values when pct=true", () => {
    expect(fmtStat("cr", 5.2, false, true)).toBe("5.2%");
    expect(fmtStat("atk%", 46.6, false, true)).toBe("46.6%");
    expect(fmtStat("atk", 311, false, true)).toMatch(/311/);
  });
});

describe("isPctStat", () => {
  it("returns true for keys ending with %", () => {
    expect(isPctStat("atk%")).toBe(true);
    expect(isPctStat("hp%")).toBe(true);
    expect(isPctStat("pyro%")).toBe(true);
  });

  it("returns true for cr, cd, er, reactionCr, reactionCd", () => {
    expect(isPctStat("cr")).toBe(true);
    expect(isPctStat("cd")).toBe(true);
    expect(isPctStat("er")).toBe(true);
    expect(isPctStat("reactionCr")).toBe(true);
    expect(isPctStat("reactionCd")).toBe(true);
  });

  it("returns false for flat stats", () => {
    expect(isPctStat("atk")).toBe(false);
    expect(isPctStat("hp")).toBe(false);
    expect(isPctStat("em")).toBe(false);
  });
});

describe("fmtMult", () => {
  it("formats value with × prefix and 3 decimal places", () => {
    expect(fmtMult(1)).toBe("×1.000");
    expect(fmtMult(1.5)).toBe("×1.500");
    expect(fmtMult(2.123)).toBe("×2.123");
  });

  it("rounds to 3 decimal places", () => {
    expect(fmtMult(1.23456)).toBe("×1.235");
  });

  it("handles zero", () => {
    expect(fmtMult(0)).toBe("×0.000");
  });
});

describe("fmtPercent", () => {
  it("returns '0%' for zero value", () => {
    expect(fmtPercent(0)).toBe("0%");
  });

  it("converts decimal to percentage", () => {
    expect(fmtPercent(0.5)).toBe("50.0%");
    expect(fmtPercent(1)).toBe("100.0%");
    expect(fmtPercent(0.123)).toBe("12.3%");
  });

  it("handles negative values", () => {
    expect(fmtPercent(-0.1)).toBe("-10.0%");
  });

  it("adds '+' sign when forceSign is true", () => {
    expect(fmtPercent(0.5, true)).toBe("+50.0%");
  });

  it("does not add '+' for negatives with forceSign", () => {
    expect(fmtPercent(-0.5, true)).toBe("-50.0%");
  });
});

describe("fmtDamage", () => {
  it("returns '0' for null or undefined", () => {
    expect(fmtDamage(null)).toBe("0");
    expect(fmtDamage(undefined)).toBe("0");
  });

  it("rounds and formats positive values", () => {
    expect(fmtDamage(1234.5)).toMatch(/1[,.]?235/);
    expect(fmtDamage(999.4)).toBe("999");
  });

  it("handles zero", () => {
    expect(fmtDamage(0)).toBe("0");
  });

  it("formats large numbers with locale separators", () => {
    const result = fmtDamage(1000000);
    // Should contain "1" followed by "000" followed by "000" with any separator
    expect(result).toMatch(/1.?000.?000/);
  });
});
