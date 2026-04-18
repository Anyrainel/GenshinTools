import type { ArtifactData } from "@/data/types";
import { validateAndSolveArtifact } from "@/lib/artifact/validation";
import { describe, expect, it } from "vitest";

function makeArt(overrides: Partial<ArtifactData> = {}): ArtifactData {
  return {
    id: "art-1",
    setKey: "crimson_witch_of_flames",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: { cr: 7.0, cd: 14.0, "hp%": 9.9, er: 19.4 },
    ...overrides,
  };
}

describe("validateAndSolveArtifact", () => {
  it("returns solved with precise values for valid 5★ +20", () => {
    const art = makeArt();
    const result = validateAndSolveArtifact(art);
    expect("solved" in result).toBe(true);
    if ("solved" in result) {
      expect(result.solved.substats.cr).toBeDefined();
      // Precise value should differ from game-rounded display
      // (solver produces higher-precision pct values)
    }
  });

  it("solves valid 5★ +0 with 3 activated + 1 unactivated", () => {
    const art = makeArt({
      level: 0,
      substats: { cr: 3.9, cd: 7.8, "hp%": 4.7 },
      unactivatedSubstats: { er: 6.5 },
    });
    const result = validateAndSolveArtifact(art);
    expect("solved" in result).toBe(true);
    if ("solved" in result) {
      expect(result.solved.substats.cr).toBeDefined();
      expect(result.solved.unactivatedSubstats?.er).toBeDefined();
    }
  });

  it("returns error for invalid individual stat (cr: 1.0 is impossible)", () => {
    const art = makeArt({
      substats: { cr: 1.0, cd: 14.0, "hp%": 9.9, er: 19.4 },
    });
    const result = validateAndSolveArtifact(art);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("cr");
    }
  });

  it("returns error for valid individuals but impossible combination", () => {
    // All single-roll values on a +20 artifact (needs 8-9 total rolls, but each stat has 1)
    const art = makeArt({
      level: 20,
      substats: { cr: 3.9, cd: 7.8, "hp%": 4.7, er: 6.5 },
    });
    const result = validateAndSolveArtifact(art);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("charEdit.invalidRollCombination");
    }
  });

  it("passes through already-precise values without overwrite", () => {
    const preciseSubstats = {
      cr: 3.8896,
      cd: 7.7718,
      "hp%": 4.6632,
      er: 6.4828,
    } as ArtifactData["substats"];
    const art = makeArt({
      level: 0,
      substats: preciseSubstats,
    });
    const result = validateAndSolveArtifact(art);
    expect("solved" in result).toBe(true);
    if ("solved" in result) {
      expect(result.solved.substats).toEqual(preciseSubstats);
    }
  });

  it("skips validation for 3★ artifact", () => {
    const art = makeArt({ rarity: 3 });
    const result = validateAndSolveArtifact(art);
    expect("solved" in result).toBe(true);
    if ("solved" in result) {
      expect(result.solved).toBe(art);
    }
  });

  it("skips validation for empty substats", () => {
    const art = makeArt({ substats: {} });
    const result = validateAndSolveArtifact(art);
    expect("solved" in result).toBe(true);
    if ("solved" in result) {
      expect(result.solved).toBe(art);
    }
  });

  it("returns error for invalid unactivated single-roll value", () => {
    const art = makeArt({
      level: 0,
      substats: { cr: 3.9, cd: 7.8, "hp%": 4.7 },
      unactivatedSubstats: { "atk%": 99.9 },
    });
    const result = validateAndSolveArtifact(art);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("atk%");
    }
  });
});
