import {
  clearTierTableCache,
  getMainProb,
  lookupTierEntry,
  structuralKey,
} from "@/lib/account-data/triage/tierTableBuilder";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => clearTierTableCache());

describe("getMainProb", () => {
  it("flower/plume always return 1.0", () => {
    expect(getMainProb("flower", "hp")).toBe(1.0);
    expect(getMainProb("plume", "atk")).toBe(1.0);
  });

  it("sands atk% is ~26.66%", () => {
    const p = getMainProb("sands", "atk%");
    expect(p).toBeGreaterThan(0.25);
    expect(p).toBeLessThan(0.28);
  });

  it("circlet cr is 10%", () => {
    const p = getMainProb("circlet", "cr");
    expect(p).toBeCloseTo(10 / 100, 2);
  });

  it("goblet elemental% is rare", () => {
    const p = getMainProb("goblet", "pyro%");
    expect(p).toBeLessThan(0.06);
    expect(p).toBeGreaterThan(0);
  });

  it("non-existent main stat returns 0", () => {
    expect(getMainProb("sands", "cr")).toBe(0);
  });
});

describe("structuralKey", () => {
  it("same stats produce same key", () => {
    const k1 = structuralKey("flower", "hp", ["cr", "cd", "atk%"], ["atk"]);
    const k2 = structuralKey("flower", "hp", ["cr", "cd", "atk%"], ["atk"]);
    expect(k1).toBe(k2);
  });

  it("different slots with same tier class share key", () => {
    // flower and plume are both "ff" tier class with mainProb 1.0
    const k1 = structuralKey("flower", "hp", ["cr", "cd"], []);
    const k2 = structuralKey("plume", "atk", ["cr", "cd"], []);
    expect(k1).toBe(k2);
  });

  it("sands vs circlet have different tier class", () => {
    const k1 = structuralKey("sands", "atk%", ["cr", "cd"], []);
    const k2 = structuralKey("circlet", "atk%", ["cr", "cd"], []);
    // Both are "sgc" but different mainProb
    expect(k1).not.toBe(k2);
  });
});

describe("lookupTierEntry", () => {
  it("returns conditions for cr+cd+atk% on flower", () => {
    const entry = lookupTierEntry(
      "flower",
      "hp",
      ["cr", "cd", "atk%"],
      ["atk"]
    );
    expect(entry.subN).toBe(3); // cr, cd, atk% (hp excluded as main stat for flower)
    expect(entry.hasCrCd).toBe(true);
    expect(entry.hasFillers).toBe(true);
    expect(entry.conditions.length).toBeGreaterThan(0);
  });

  it("conditions are sorted best-first (P before Q before N)", () => {
    const entry = lookupTierEntry(
      "flower",
      "hp",
      ["cr", "cd", "atk%", "er"],
      []
    );
    const tierOrder = { P: 0, Q: 1, N: 2 };
    for (let i = 1; i < entry.conditions.length; i++) {
      const prev = tierOrder[entry.conditions[i - 1].tier];
      const curr = tierOrder[entry.conditions[i].tier];
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it("desired stat matching main stat is excluded from subN", () => {
    // atk% is both desired and main stat on sands — should be excluded
    const entry = lookupTierEntry("sands", "atk%", ["cr", "cd", "atk%"], []);
    expect(entry.subN).toBe(2); // only cr, cd remain
  });

  it("caches entries (same key returns same reference)", () => {
    const e1 = lookupTierEntry("flower", "hp", ["cr", "cd"], []);
    const e2 = lookupTierEntry("flower", "hp", ["cr", "cd"], []);
    expect(e1).toBe(e2);
  });

  it("returns empty conditions when no desired substats remain", () => {
    // flower main = hp, desired = [hp] → hp excluded → subN=0
    const entry = lookupTierEntry("flower", "hp", ["hp"], []);
    expect(entry.subN).toBe(0);
    expect(entry.conditions).toHaveLength(0);
  });

  it("rare main stat can produce k=0 condition", () => {
    // goblet pyro% is rare (~5%), so even k=0 (any substats) might qualify
    const entry = lookupTierEntry("goblet", "pyro%", ["cr", "cd", "atk%"], []);
    const k0 = entry.conditions.find((c) => c.k === 0);
    expect(k0).toBeDefined();
    // pyro% goblet ~5% main prob, k=0 rarity = mainProb alone
    expect(["P", "Q", "N"]).toContain(k0!.tier);
  });

  it("circlet em has conditions", () => {
    const entry = lookupTierEntry("circlet", "em", ["cr", "cd"], []);
    expect(entry.conditions.length).toBeGreaterThan(0);
    expect(entry.subN).toBe(2);
  });
});
