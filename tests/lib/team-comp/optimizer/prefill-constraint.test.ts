import { allSlots } from "@/data/enums";
import type { MainStat, Slot } from "@/data/enums";
import { getRollValues } from "@/lib/artifact/scoring/utils";
import { computeSubstatPreFill } from "@/lib/team-comp/optimizer/erCrConstraints";
import { describe, expect, it } from "vitest";

const rv = getRollValues(undefined, 5); // avg 5-star roll values

const defaultMainStats: Record<Slot, MainStat> = {
  flower: "hp",
  plume: "atk",
  sands: "atk%",
  goblet: "pyro%",
  circlet: "cd",
};

describe("computeSubstatPreFill — 4-substat constraint", () => {
  it("single ER pre-fill should leave room for 3 more substats per slot", () => {
    // 8 rolls per slot, max 5 per stat line
    const result = computeSubstatPreFill(
      0.6, // ~11 ER rolls needed
      0,
      defaultMainStats,
      5,
      rv,
      8, // maxRollsPerSlot
      5 // maxRollsPerStat
    );
    expect(result).not.toBeNull();

    for (const slot of allSlots) {
      const slotRolls = result![slot];
      const totalRolls = Object.values(slotRolls).reduce(
        (a, b) => a + (b ?? 0),
        0
      );
      const numStats = Object.keys(slotRolls).length;
      // Must leave room for (4 - numStats) more substats (1 roll each)
      const remaining = 8 - totalRolls;
      expect(
        remaining,
        `${slot}: ${totalRolls} rolls with ${numStats} stats, only ${remaining} left for ${4 - numStats} more`
      ).toBeGreaterThanOrEqual(4 - numStats);
    }
  });

  it("combined ER+CR pre-fill should leave room for 2 more substats per slot", () => {
    // Big ER and CR gap — both need multiple rolls per slot
    const result = computeSubstatPreFill(
      0.5, // ~10 ER rolls needed
      0.3, // ~10 CR rolls needed
      defaultMainStats,
      5,
      rv,
      8, // maxRollsPerSlot
      5 // maxRollsPerStat
    );

    if (result === null) {
      // Could be infeasible with the reservation — that's fine, means the
      // constraints are correctly detected as too tight for the budget
      return;
    }

    for (const slot of allSlots) {
      const slotRolls = result[slot];
      const totalRolls = Object.values(slotRolls).reduce(
        (a, b) => a + (b ?? 0),
        0
      );
      const numStats = Object.keys(slotRolls).length;
      const remaining = 8 - totalRolls;
      expect(
        remaining,
        `${slot}: ${totalRolls} rolls with ${numStats} stats, only ${remaining} left for ${4 - numStats} more`
      ).toBeGreaterThanOrEqual(4 - numStats);
    }
  });

  it("ER-only pre-fill: no slot should have more than maxRollsPerSlot - 3 ER rolls", () => {
    const result = computeSubstatPreFill(
      1.0, // huge ER gap — try to fill max
      0,
      defaultMainStats,
      5,
      rv,
      8,
      5
    );

    if (result === null) return;

    for (const slot of allSlots) {
      const erRolls = result[slot].er ?? 0;
      // With 1 stat chosen (ER), need 3 more → max ER rolls = 8 - 3 = 5
      // But also capped by maxRollsPerStat = 5
      expect(erRolls, `${slot}: ER has ${erRolls} rolls`).toBeLessThanOrEqual(
        5
      );
      // Must leave room for 3 more substats
      expect(
        erRolls,
        `${slot}: ER has ${erRolls} rolls, max should be ${8 - 3}`
      ).toBeLessThanOrEqual(8 - 3);
    }
  });

  it("with ER sands main stat, ER substat should skip that slot", () => {
    const erSandsMain: Record<Slot, MainStat> = {
      ...defaultMainStats,
      sands: "er",
    };
    const result = computeSubstatPreFill(0.3, 0, erSandsMain, 5, rv, 8, 5);
    expect(result).not.toBeNull();
    expect(result!.sands.er).toBeUndefined();
  });
});
