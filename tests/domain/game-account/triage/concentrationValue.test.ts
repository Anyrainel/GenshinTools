import { describe, expect, it } from "vitest";
import { getSubstatAvgRoll } from "@/domain/build/artifact/scoring/utils";
import type { SubStat } from "@/domain/enums";
import {
  concentratedStatRule,
  runConcentrationValueRules,
} from "@/domain/game-account/triage/concentrationValue";
import type { ArtifactData } from "@/domain/models";

/** Build a minimal 5★ ArtifactData with given substat *roll counts*. */
function artifactWithRolls(
  rolls: Partial<Record<SubStat, number>>,
  level = 16
): ArtifactData {
  const substats: Partial<Record<SubStat, number>> = {};
  for (const [stat, count] of Object.entries(rolls)) {
    const avg = getSubstatAvgRoll(stat as SubStat, 5);
    substats[stat as SubStat] = (count ?? 0) * avg;
  }
  return {
    id: "test",
    setKey: "gladiators_finale",
    slotKey: "flower",
    level,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats,
  };
}

describe("concentratedStatRule", () => {
  const instructorFlower: ArtifactData = {
    id: "four-star-flower",
    setKey: "instructor",
    slotKey: "flower",
    mainStatKey: "hp",
    rarity: 4,
    level: 16,
    lock: true,
    totalRolls: 7,
    substats: { em: 35, def: 15, "hp%": 10.72, cd: 4.35 },
    initialValues: { em: 19, def: 15, "hp%": 3.7, cd: 4.4 },
  };

  it.each([undefined, { em: 2, def: 1, "hp%": 3, cd: 1 }])(
    "counts two HP upgrades out of three regardless of individual roll quality",
    (substatRollCounts) => {
      expect(
        concentratedStatRule({ ...instructorFlower, substatRollCounts })
      ).toEqual({
        kept: true,
        reason: "concentrated-hp%",
      });
    }
  );

  it("uses source counts for a 50% allocation even when the accumulated rolls were low", () => {
    const piece: ArtifactData = {
      ...instructorFlower,
      level: 16,
      totalRolls: 6,
      substats: { "hp%": 6.52, def: 37, atk: 11, em: 13 },
      substatRollCounts: { "hp%": 2, def: 2, atk: 1, em: 1 },
    };
    expect(concentratedStatRule(piece)).toEqual({
      kept: true,
      reason: "concentrated-hp%",
    });
    expect(concentratedStatRule({ ...piece, totalRolls: 5 })).toEqual({
      kept: true,
      reason: "concentrated-hp%",
    });
    expect(concentratedStatRule({ ...piece, rarity: 5 }).kept).toBe(false);
    expect(
      concentratedStatRule({
        ...piece,
        totalRolls: 5,
        substatRollCounts: { "hp%": 2, def: 1, atk: 1, em: 1 },
      }).kept
    ).toBe(false);
  });

  it("uses the source to distinguish two legal allocations with identical displayed values", () => {
    const piece: ArtifactData = {
      ...instructorFlower,
      setKey: "gladiators_finale",
      rarity: 5,
      level: 20,
      totalRolls: 9,
      substats: { "hp%": 16.3, def: 65, atk: 14, em: 16 },
      initialValues: undefined,
    };
    // Both HP% and flat DEF could each represent three or four rolls.
    expect(
      concentratedStatRule({ ...piece, substatRollCounts: { "hp%": 4 } })
    ).toEqual({
      kept: true,
      reason: "concentrated-hp%",
    });
    expect(
      concentratedStatRule({ ...piece, substatRollCounts: { "hp%": 3 } }).kept
    ).toBe(false);
  });

  it("fires for concentrated crit (CR+CD combined)", () => {
    const art = artifactWithRolls({ cr: 4, cd: 4, atk: 1, hp: 1 });
    const r = concentratedStatRule(art);
    expect(r).toEqual({ kept: true, reason: "concentrated-crit" });
  });

  it("keeps usable legacy stats when an obsolete substat prevents exact reconstruction", () => {
    const art = artifactWithRolls({ er: 5, def: 1, atk: 1 });
    Object.assign(art.substats, { unknownStat: 20 });
    expect(concentratedStatRule(art)).toEqual({
      kept: true,
      reason: "concentrated-er",
    });
  });

  it("fires when exactly half of upgrade rolls are concentrated", () => {
    const art = artifactWithRolls({ "hp%": 3, def: 2, atk: 2, hp: 1 });
    expect(concentratedStatRule(art)).toEqual({
      kept: true,
      reason: "concentrated-hp%",
    });
  });

  it("uses known initial values instead of attributing initial-roll quality to upgrades", () => {
    const art = artifactWithRolls({ "hp%": 3, def: 2, atk: 2, hp: 1 });
    art.initialValues = {
      "hp%": getSubstatAvgRoll("hp%", 5) * 1.2,
      def: getSubstatAvgRoll("def", 5) * 0.8,
      atk: getSubstatAvgRoll("atk", 5) * 0.8,
      hp: getSubstatAvgRoll("hp", 5) * 0.8,
    };

    expect(concentratedStatRule(art).kept).toBe(false);
  });

  it("fires for concentrated ER", () => {
    const art = artifactWithRolls({ er: 6, atk: 1, hp: 1 });
    const r = concentratedStatRule(art);
    expect(r).toEqual({ kept: true, reason: "concentrated-er" });
  });

  it("fires for concentrated EM", () => {
    const art = artifactWithRolls({ em: 7, atk: 1, hp: 1, def: 1 });
    expect(concentratedStatRule(art)).toEqual({
      kept: true,
      reason: "concentrated-em",
    });
  });

  it("fires for concentrated ATK%", () => {
    const art = artifactWithRolls({ "atk%": 6, cr: 1, em: 1 });
    expect(concentratedStatRule(art)).toEqual({
      kept: true,
      reason: "concentrated-atk%",
    });
  });

  it("does NOT fire when no category dominates", () => {
    const art = artifactWithRolls({ cr: 2, "atk%": 2, em: 2, er: 2 });
    expect(concentratedStatRule(art).kept).toBe(false);
  });

  it("does NOT fire below minimum upgrade rolls", () => {
    // 3 total rolls on one stat = 2 upgrade rolls, below MIN_UPGRADE_ROLLS=3.
    const art = artifactWithRolls({ cr: 3 });
    expect(concentratedStatRule(art).kept).toBe(false);
  });

  it("CR alone dominating fires concentrated-crit", () => {
    const art = artifactWithRolls({ cr: 7, atk: 1, hp: 1, def: 1 });
    expect(concentratedStatRule(art)).toEqual({
      kept: true,
      reason: "concentrated-crit",
    });
  });
});

describe("runConcentrationValueRules", () => {
  it("returns not-kept when no rule fires", () => {
    const art = artifactWithRolls({ atk: 3, hp: 3, def: 3 });
    expect(runConcentrationValueRules(art).kept).toBe(false);
  });

  it("returns first matching rule", () => {
    const art = artifactWithRolls({ cr: 5, cd: 4, atk: 1 });
    const r = runConcentrationValueRules(art);
    expect(r.kept).toBe(true);
    if (r.kept) expect(r.reason).toBe("concentrated-crit");
  });
});
