import type { ArtifactData } from "@/data/types";
import { isInitial4Line } from "@/lib/account-data/triage/is4L";
import { describe, expect, it } from "vitest";

function makeArt(opts: {
  substats?: Record<string, number>;
  unactivatedSubstats?: Record<string, number>;
  totalRolls?: number;
  level?: number;
}): ArtifactData {
  return {
    id: "test",
    setKey: "test_set",
    slotKey: "flower",
    rarity: 5,
    level: opts.level ?? 0,
    lock: false,
    mainStatKey: "hp",
    substats: opts.substats ?? {},
    unactivatedSubstats: opts.unactivatedSubstats ?? {},
    totalRolls: opts.totalRolls,
  } as ArtifactData;
}

describe("isInitial4Line", () => {
  it("level 0 with 4 substats is 4-line", () => {
    expect(
      isInitial4Line(
        makeArt({ substats: { cr: 1, cd: 1, "atk%": 1, er: 1 }, level: 0 })
      )
    ).toBe(true);
  });

  it("level 0 with 3 substats is 3-line", () => {
    expect(
      isInitial4Line(
        makeArt({ substats: { cr: 1, cd: 1, "atk%": 1 }, level: 0 })
      )
    ).toBe(false);
  });

  it("level 4 with 4 substats (3-line + 1 upgrade) is 3-line", () => {
    // 3 initial + 1 from level 4 upgrade = 4 total, but upgradeRolls=1, so 4-1=3 initial
    expect(
      isInitial4Line(
        makeArt({ substats: { cr: 1, cd: 1, "atk%": 1, er: 1 }, level: 4 })
      )
    ).toBe(false);
  });

  it("level 4 with 5 substats (4-line + 1 upgrade) is 4-line", () => {
    expect(
      isInitial4Line(
        makeArt({
          substats: { cr: 1, cd: 1, "atk%": 1, er: 1, em: 1 },
          level: 4,
        })
      )
    ).toBe(true);
  });

  it("level 20 with 4 activated + 1 unactivated uses totalRolls correctly", () => {
    // totalRolls=9, upgradeRolls=5, initial=4
    expect(
      isInitial4Line(
        makeArt({
          substats: { cr: 3, cd: 2, "atk%": 2, er: 2 },
          unactivatedSubstats: {},
          totalRolls: 9,
          level: 20,
        })
      )
    ).toBe(true);
  });

  it("level 20 with totalRolls=8 is 3-line", () => {
    // totalRolls=8, upgradeRolls=5, initial=3
    expect(
      isInitial4Line(
        makeArt({
          substats: { cr: 3, cd: 2, "atk%": 2 },
          totalRolls: 8,
          level: 20,
        })
      )
    ).toBe(false);
  });

  it("handles missing substats gracefully", () => {
    expect(isInitial4Line(makeArt({ level: 0 }))).toBe(false);
  });

  it("counts unactivatedSubstats", () => {
    // 3 activated + 1 unactivated = 4 total at level 0
    expect(
      isInitial4Line(
        makeArt({
          substats: { cr: 1, cd: 1, "atk%": 1 },
          unactivatedSubstats: { er: 0 },
          level: 0,
        })
      )
    ).toBe(true);
  });
});
