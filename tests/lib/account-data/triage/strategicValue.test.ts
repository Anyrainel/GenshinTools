import type { SubStat } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import {
  concentratedStatRule,
  runStrategicRules,
} from "@/lib/account-data/triage/strategicValue";
import { getSubstatAvgRoll } from "@/lib/artifact/scoring/utils";
import { describe, expect, it } from "vitest";

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
  it("fires when ≥60% of rolls are crit (CR+CD combined)", () => {
    const art = artifactWithRolls({ cr: 4, cd: 4, atk: 1, hp: 1 });
    const r = concentratedStatRule(art);
    expect(r).toEqual({ kept: true, reason: "concentrated-crit" });
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

describe("runStrategicRules", () => {
  it("returns not-kept when no rule fires", () => {
    const art = artifactWithRolls({ atk: 3, hp: 3, def: 3 });
    expect(runStrategicRules(art).kept).toBe(false);
  });

  it("returns first matching rule", () => {
    const art = artifactWithRolls({ cr: 5, cd: 4, atk: 1 });
    const r = runStrategicRules(art);
    expect(r.kept).toBe(true);
    if (r.kept) expect(r.reason).toBe("concentrated-crit");
  });
});
