import { describe, expect, it } from "vitest";
import { setInvestmentErPoint } from "@/domain/combat/analyzer/investmentEr";

describe("absolute ER transition editing with exact storage", () => {
  it("adds, edits, and removes dense intervals through the next real transition", () => {
    let map = setInvestmentErPoint({}, "a", 2, 1, 1.5);
    expect(map).toEqual({
      "a|2": 1.5,
      "a|3": 1.5,
      "a|4": 1.5,
      "a|5": 1.5,
      "a|6": 1.5,
    });
    map = setInvestmentErPoint(map, "a", 2, 1, 1.3);
    expect(Object.values(map).every((v) => v === 1.3)).toBe(true);
    map = setInvestmentErPoint(map, "a", 4, 1, 1.6);
    map = setInvestmentErPoint(map, "a", 2, 1, undefined);
    expect(map).toEqual({ "a|4": 1.6, "a|5": 1.6, "a|6": 1.6 });
    map = setInvestmentErPoint(map, "a", 4, 1, undefined);
    expect(map).toEqual({});
  });
  it("does not reinterpret old exact isolated overrides before an explicit edit", () => {
    const old = { "a|2": 1.5, "a|5": 1.8, "b|2": 1.4 };
    expect(setInvestmentErPoint(old, "a", 2, 1, 1.3)).toEqual({
      ...old,
      "a|2": 1.3,
    });
    expect(old).toEqual({ "a|2": 1.5, "a|5": 1.8, "b|2": 1.4 });
  });
});
