import type { Build } from "@/data/types";
import { migrateBuild } from "@/lib/artifact-builds/buildMigration";
import { describe, expect, it } from "vitest";

/** Minimal build object with just the fields migrateBuild touches. */
function makeBuild(
  halfSet1?: number | string,
  halfSet2?: number | string
): Build {
  return {
    halfSet1,
    halfSet2,
  } as Build;
}

describe("migrateBuild", () => {
  it("migrates numeric halfSet IDs to string IDs", () => {
    const build = makeBuild(1, 9);
    migrateBuild(build);
    expect(build.halfSet1).toBe("cryo%-15");
    expect(build.halfSet2).toBe("atk%-18");
  });

  it("handles all legacy numeric IDs", () => {
    const expected: Record<number, string> = {
      1: "cryo%-15",
      2: "hp%-20",
      3: "def%-30",
      4: "electro%-15",
      5: "electro-res-40",
      6: "geo%-15",
      7: "em-80",
      8: "burst-dmg%-20",
      9: "atk%-18",
      10: "phys%-25",
      11: "hydro%-15",
      12: "heal%-15",
      13: "pyro-res-40",
      14: "pyro%-15",
      15: "er-20",
      16: "anemo%-15",
      17: "heal%-15",
      18: "shield-35",
      19: "dendro%-15",
      20: "na-ca-dmg%-15",
      21: "skill-dmg%-20",
      22: "nightsoul-energy-6",
      23: "nightsoul-dmg%-15",
      24: "plunge-dmg%-25",
    };

    for (const [num, str] of Object.entries(expected)) {
      const build = makeBuild(Number(num), undefined);
      migrateBuild(build);
      expect(build.halfSet1).toBe(str);
    }
  });

  it("is idempotent on already-migrated string IDs", () => {
    const build = makeBuild("cryo%-15", "atk%-18");
    migrateBuild(build);
    expect(build.halfSet1).toBe("cryo%-15");
    expect(build.halfSet2).toBe("atk%-18");
  });

  it("handles undefined halfSets", () => {
    const build = makeBuild(undefined, undefined);
    migrateBuild(build);
    expect(build.halfSet1).toBeUndefined();
    expect(build.halfSet2).toBeUndefined();
  });

  it("handles mixed: one numeric, one already-migrated", () => {
    const build = makeBuild(7, "er-20");
    migrateBuild(build);
    expect(build.halfSet1).toBe("em-80");
    expect(build.halfSet2).toBe("er-20");
  });

  it("handles string-encoded numbers from JSON (e.g. '17')", () => {
    const build = makeBuild("17", "5");
    migrateBuild(build);
    expect(build.halfSet1).toBe("heal%-15");
    expect(build.halfSet2).toBe("electro-res-40");
  });

  it("clears unknown string IDs to undefined", () => {
    const build = makeBuild("nonexistent-id", undefined);
    migrateBuild(build);
    expect(build.halfSet1).toBeUndefined();
  });

  it("maps duplicate IDs 12 and 17 both to heal%-15", () => {
    const build12 = makeBuild(12, undefined);
    const build17 = makeBuild(17, undefined);
    migrateBuild(build12);
    migrateBuild(build17);
    expect(build12.halfSet1).toBe("heal%-15");
    expect(build17.halfSet1).toBe("heal%-15");
  });
});
