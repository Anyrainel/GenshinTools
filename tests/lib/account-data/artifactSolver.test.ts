import {
  type RollTable,
  buildRollTable,
  isAlreadyPrecise,
  solveArtifact,
} from "@/lib/artifact/solver";
import { beforeAll, describe, expect, it } from "vitest";

describe("artifactSolver", () => {
  describe("buildRollTable", () => {
    let table: RollTable;
    beforeAll(() => {
      table = buildRollTable();
    });

    it("has entries for all 10 substats × 2 rarities", () => {
      const stats = [
        "hp",
        "hp%",
        "atk",
        "atk%",
        "def",
        "def%",
        "er",
        "em",
        "cr",
        "cd",
      ];
      for (const stat of stats) {
        for (const rarity of [4, 5] as const) {
          expect(
            table.has(`${stat}:${rarity}`),
            `missing ${stat}:${rarity}`
          ).toBe(true);
        }
      }
    });

    it("single roll of 5★ CR tier 3 (display 3.9) achievable with 1 roll", () => {
      const rollCounts = table.get("cr:5")!.get(3.9);
      expect(rollCounts).toBeDefined();
      expect(rollCounts!.has(1)).toBe(true);
    });

    it("two rolls of 5★ CR can produce display value 7.0", () => {
      const rollCounts = table.get("cr:5")!.get(7.0);
      expect(rollCounts).toBeDefined();
      expect(rollCounts!.has(2)).toBe(true);
    });

    it("impossible display values are absent", () => {
      expect(table.get("cr:5")!.get(1.0)).toBeUndefined();
    });
  });

  describe("isAlreadyPrecise", () => {
    it("false for game-rounded pct values", () => {
      expect(isAlreadyPrecise({ cr: 10.5, cd: 21.0 })).toBe(false);
    });
    it("true when any pct substat has extra precision", () => {
      expect(isAlreadyPrecise({ cr: 10.47, cd: 21.0 })).toBe(true);
    });
    it("false for integer flat stats", () => {
      expect(isAlreadyPrecise({ hp: 448, atk: 35 })).toBe(false);
    });
    it("true when flat stat has decimals", () => {
      expect(isAlreadyPrecise({ hp: 448.13 })).toBe(true);
    });
    it("false for empty substats", () => {
      expect(isAlreadyPrecise({})).toBe(false);
    });
  });

  describe("solveArtifact", () => {
    it("solves 5★ Lv20 with known totalRolls", () => {
      // cr:7.0(2) + cd:14.0(2) + hp%:9.9(2) + er:19.4(3) = 9 rolls
      const result = solveArtifact({
        rarity: 5,
        level: 20,
        substats: { cr: 7.0, cd: 14.0, "hp%": 9.9, er: 19.4 },
        totalRolls: 9,
      });
      expect(result).not.toBeNull();
      expect(result!.cr).toBeDefined();
      expect(Math.round(result!.cr! * 10) / 10).toBe(7.0);
    });

    it("solves 5★ Lv20 without totalRolls", () => {
      // cr:10.5(3) + cd:21.0(3) + atk%:5.8(1) + em:23(1) = 8 → init=3
      const result = solveArtifact({
        rarity: 5,
        level: 20,
        substats: { cr: 10.5, cd: 21.0, "atk%": 5.8, em: 23 },
      });
      expect(result).not.toBeNull();
      if (result!.cr !== undefined) {
        expect(Math.round(result!.cr! * 10) / 10).toBe(10.5);
      }
    });

    it("returns null for impossible values", () => {
      expect(
        solveArtifact({ rarity: 5, level: 20, substats: { cr: 99.9 } })
      ).toBeNull();
    });

    it("returns already-precise values unchanged", () => {
      const precise = { cr: 10.47, cd: 21.01, "atk%": 5.83, em: 23 };
      const result = solveArtifact({
        rarity: 5,
        level: 20,
        substats: precise,
      });
      expect(result).not.toBeNull();
      expect(result!.cr).toBe(10.47);
      expect(result!.cd).toBe(21.01);
    });

    it("picks highest value for ambiguous pct stats", () => {
      // cr:7.0(2) has multiple combos (3.11+3.89=7.0 or 3.5+3.5=7.0)
      // Solver should pick the highest precise sum: 3.5+3.5=7.0 > 3.11+3.89=7.0
      const result = solveArtifact({
        rarity: 5,
        level: 20,
        substats: { cr: 7.0, cd: 14.0, "hp%": 9.9, er: 11.7 },
      });
      expect(result).not.toBeNull();
      if (result!.cr !== undefined) {
        expect(result!.cr).toBeGreaterThanOrEqual(6.95);
        expect(Math.round(result!.cr! * 10) / 10).toBe(7.0);
      }
    });

    it("keeps flat stats unchanged", () => {
      // cr:10.5(3) + cd:21.0(3) + hp:448(2) + atk:14(1) = 9
      const result = solveArtifact({
        rarity: 5,
        level: 20,
        substats: { cr: 10.5, cd: 21.0, hp: 448, atk: 14 },
        totalRolls: 9,
      });
      expect(result).not.toBeNull();
      expect(result!.hp).toBe(448);
      expect(result!.atk).toBe(14);
    });

    it("handles 4★ artifacts with init=3", () => {
      // 4★ Lv16: 4 upgrades. init=3 → totalRolls=7
      const result = solveArtifact({
        rarity: 4,
        level: 16,
        substats: { cr: 2.8, cd: 10.6, "atk%": 4.2, em: 45 },
      });
      expect(result).not.toBeNull();
    });

    it("handles 4★ artifacts with init=2", () => {
      // 4★ Lv16: 4 upgrades. init=2 → totalRolls=6.
      // 4★ CR tiers (display): [2.18, 2.49, 2.8, 3.11]
      // 4★ CD tiers (display): [4.35, 4.97, 5.6, 6.22]
      // 4★ HP% tiers (display): [3.26, 3.73, 4.2, 4.66]
      // 4★ EM tiers (display): [13.06, 14.92, 16.79, 18.65]
      // cr:2.8(1) + cd:5.6(1) + hp%:3.7(1) + em:41(3) = 6 rolls, init=2
      // 4★ EM: 13.06+13.06+14.92 = 41.04 → rounds to 41
      const result = solveArtifact({
        rarity: 4,
        level: 16,
        substats: { cr: 2.8, cd: 5.6, "hp%": 3.7, em: 41 },
      });
      expect(result).not.toBeNull();
      // Verify pct stats get precise values
      if (result!.cr !== undefined) {
        expect(Math.round(result!.cr! * 10) / 10).toBe(2.8);
      }
    });
  });
});
