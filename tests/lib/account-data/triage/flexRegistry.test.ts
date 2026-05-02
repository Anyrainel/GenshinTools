import { describe, expect, it } from "vitest";
import { buildCustomFlexPattern } from "@/lib/account-data/triage/flexRegistry";

describe("buildCustomFlexPattern", () => {
  it("returns correct key, sorted subs, rarity, and custom flag", () => {
    const result = buildCustomFlexPattern({
      slot: "sands",
      mainStat: "em",
      requiredSubs: ["cd", "cr", "atk%"],
    });
    expect(result).not.toBeNull();
    expect(result!.custom).toBe(true);
    // Subs should be sorted by canonical order: cr, cd, atk%
    expect(result!.requiredSubs).toEqual(["cr", "cd", "atk%"]);
    expect(result!.key).toBe("flex:sands:em:cr,cd,atk%");
    expect(result!.rarity).toBeGreaterThan(0);
    expect(result!.slot).toBe("sands");
    expect(result!.mainStat).toBe("em");
  });

  it("returns null for invalid substat combination (main stat as sub on non-NON_SUB slot)", () => {
    // atk% is the main stat on sands, but atk% IS a valid substat
    // so let's test a truly invalid case: a sub that doesn't exist in the pool
    // Actually, the NON_SUB set excludes elemental% etc from the sub pool.
    // Using a goblet with pyro% main — pyro% is NON_SUB so pool doesn't exclude it.
    // But if we use subs that include a stat equal to main on a non-NON_SUB slot,
    // that stat gets excluded from the pool and the combo becomes invalid.
    const result = buildCustomFlexPattern({
      slot: "sands",
      mainStat: "atk%",
      requiredSubs: ["atk%"], // atk% can't be both main and sub
    });
    expect(result).toBeNull();
  });

  it("returns valid pattern for 1 substat", () => {
    const result = buildCustomFlexPattern({
      slot: "flower",
      mainStat: "hp",
      requiredSubs: ["cr"],
    });
    expect(result).not.toBeNull();
    expect(result!.requiredSubs).toEqual(["cr"]);
    expect(result!.rarity).toBeGreaterThan(0);
  });

  it("returns valid pattern for 4 substats", () => {
    const result = buildCustomFlexPattern({
      slot: "flower",
      mainStat: "hp",
      requiredSubs: ["er", "atk%", "cd", "cr"],
    });
    expect(result).not.toBeNull();
    expect(result!.requiredSubs).toEqual(["cr", "cd", "atk%", "er"]);
  });

  it("handles NON_SUB main stats correctly (elemental goblet)", () => {
    const result = buildCustomFlexPattern({
      slot: "goblet",
      mainStat: "pyro%",
      requiredSubs: ["cr", "cd"],
    });
    expect(result).not.toBeNull();
    expect(result!.key).toBe("flex:goblet:pyro%:cr,cd");
  });

  it("marks custom patterns that require four initial substats", () => {
    const result = buildCustomFlexPattern({
      slot: "goblet",
      mainStat: "pyro%",
      requiredSubs: ["cr", "cd"],
      requiresFourInitialSubstats: true,
    });

    expect(result).not.toBeNull();
    expect(result!.key).toBe("flex:goblet:pyro%:cr,cd:4line");
    expect(result!.requiresFourInitialSubstats).toBe(true);
  });
});
