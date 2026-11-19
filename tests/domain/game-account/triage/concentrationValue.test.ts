import { describe, expect, it } from "vitest";
import { getSubstatAvgRoll } from "@/domain/build/artifact/scoring/utils";
import type { SubStat } from "@/domain/enums";
import { runConcentrationValueRules } from "@/domain/game-account/triage/concentrationValue";
import type { ArtifactData } from "@/domain/models";

function flower(
  rarity: 4 | 5,
  level: number,
  substats: ArtifactData["substats"]
): ArtifactData {
  return {
    id: "flower",
    setKey: rarity === 4 ? "instructor" : "gladiators_finale",
    slotKey: "flower",
    mainStatKey: "hp",
    rarity,
    level,
    lock: true,
    substats,
  };
}

function rollValue(stat: SubStat, rolls: number, rarity: 4 | 5): number {
  return getSubstatAvgRoll(stat, rarity) * rolls;
}

describe("concentration by expected category value at maximum level", () => {
  it.each([
    { rarity: 4, level: 16, target: 2 },
    { rarity: 5, level: 20, target: 2.5 },
  ] as const)(
    "treats $target average rolls as an inclusive full-level threshold for $rarity stars",
    ({ rarity, level, target }) => {
      const result = (amount: number) =>
        runConcentrationValueRules(
          flower(rarity, level, {
            er: rollValue("er", amount, rarity),
            atk: 14,
            def: 15,
            em: 16,
          })
        );
      expect(result(target)).toEqual({ kept: true, reason: "concentrated-er" });
      expect(result(target - 0.001)).toEqual({ kept: false });
    }
  );

  it("keeps the +16 Instructor flower for HP%, with and without scanner roll metadata", () => {
    const piece = flower(4, 16, { em: 35, def: 15, "hp%": 10.72, cd: 4.35 });
    const expected = { kept: true, reason: "concentrated-hp%" };
    expect(runConcentrationValueRules(piece)).toEqual(expected);
    expect(
      runConcentrationValueRules({
        ...piece,
        totalRolls: 7,
        initialValues: { em: 19, def: 15, "hp%": 3.7, cd: 4.4 },
        substatRollCounts: { em: 2, def: 1, "hp%": 3, cd: 1 },
      })
    ).toEqual(expected);
    // Two low HP% rolls give only 1.65 average rolls at four stars.
    expect(
      runConcentrationValueRules({
        ...flower(4, 16, { "hp%": 6.52, def: 37, atk: 11, em: 13 }),
        substatRollCounts: { "hp%": 2, def: 2, atk: 1, em: 1 },
      })
    ).toEqual({ kept: false });
  });

  it("adds CR and CD in their own units and reports the strongest qualifying category", () => {
    const piece = flower(5, 20, {
      cr: rollValue("cr", 1.9, 5),
      cd: rollValue("cd", 0.8, 5),
      "hp%": rollValue("hp%", 3, 5),
      atk: 16,
    });
    expect(runConcentrationValueRules(piece)).toEqual({
      kept: true,
      reason: "concentrated-hp%",
    });
    expect(
      runConcentrationValueRules({
        ...piece,
        substats: { ...piece.substats, "hp%": rollValue("hp%", 2.6, 5) },
      })
    ).toEqual({ kept: true, reason: "concentrated-crit" });
  });

  it.each([
    { rarity: 4, amount: 1.75 },
    { rarity: 5, amount: 2 },
  ] as const)(
    "credits the remaining +4 checkpoints once for $rarity stars",
    ({ rarity, amount }) => {
      const piece = flower(rarity, 12, {
        er: rollValue("er", amount, rarity),
        atk: 14,
        def: 13,
        em: 16,
      });
      for (const level of [12, 13]) {
        expect(runConcentrationValueRules({ ...piece, level })).toEqual({
          kept: true,
          reason: "concentrated-er",
        });
      }
      expect(runConcentrationValueRules({ ...piece, level: 16 })).toEqual({
        kept: false,
      });
    }
  );

  it.each(["em", "atk%", "def%"] as const)(
    "evaluates %s independently of other categories",
    (stat) => {
      const piece = flower(5, 20, {
        [stat]: rollValue(stat, 2.6, 5),
        atk: 16,
        def: 19,
        er: 5.5,
      });
      expect(runConcentrationValueRules(piece)).toEqual({
        kept: true,
        reason: `concentrated-${stat}`,
      });
    }
  );

  it("credits two of four possible upgrade lines to double crit", () => {
    const piece = flower(5, 16, {
      cr: rollValue("cr", 1, 5),
      cd: rollValue("cd", 1, 5),
      atk: 20,
      def: 25,
    });
    expect(runConcentrationValueRules(piece)).toEqual({
      kept: true,
      reason: "concentrated-crit",
    });
    expect(runConcentrationValueRules({ ...piece, level: 20 })).toEqual({
      kept: false,
    });
  });

  it("spends a checkpoint to open the known fourth line and counts its actual value only once", () => {
    const piece = flower(4, 0, { atk: 12, def: 13, em: 13 });
    // Three ordinary upgrades remain after opening ER. Its 1.18 initial rolls plus 0.75 are below 2.
    const pending = { er: 5.18 };
    expect(
      runConcentrationValueRules({ ...piece, unactivatedSubstats: pending })
    ).toEqual({ kept: false });
    expect(
      runConcentrationValueRules({
        ...piece,
        level: 4,
        substats: { ...piece.substats, ...pending },
      })
    ).toEqual({ kept: false });
    // With CR already present, revealing CD also makes both lines eligible for the remaining upgrades.
    const critPiece = flower(4, 0, { cr: 2.18, atk: 12, def: 13 });
    expect(
      runConcentrationValueRules({
        ...critPiece,
        unactivatedSubstats: { cd: 4.35 },
      })
    ).toEqual({ kept: true, reason: "concentrated-crit" });
  });

  it("weights an unknown fourth line after excluding the main stat and all active lines", () => {
    // Flower with CR, flat DEF and flat ATK: the unused pool has weight 23, with 3 for CD.
    // Projected crit = current CR + 3/23 + (1 + 3/23) * 3/4.
    const result = (cr: number) =>
      runConcentrationValueRules(flower(4, 0, { cr, def: 13, atk: 12 }));
    expect(result(2.8)).toEqual({ kept: true, reason: "concentrated-crit" });
    expect(result(2.49)).toEqual({ kept: false });
  });

  it("spends two checkpoints opening lines on a two-line four-star and draws without replacement", () => {
    // From CR and flat ATK, P(CD in two openings) = 3/29 + 6/29*3/23 + 20/29*3/25.
    // At maximum CR this still finishes just below 2; equal-weight draws or two free upgrades would pass.
    const piece = flower(4, 0, { cr: 3.11, atk: 12 });
    expect(runConcentrationValueRules(piece)).toEqual({ kept: false });
    // A known CD opening raises the category before the two remaining ordinary upgrades.
    expect(
      runConcentrationValueRules({
        ...piece,
        unactivatedSubstats: { cd: 4.35 },
      })
    ).toEqual({ kept: true, reason: "concentrated-crit" });
  });
});
