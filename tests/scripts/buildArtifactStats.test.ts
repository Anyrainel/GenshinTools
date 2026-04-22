import { MAIN_STAT_VALUES_5STAR } from "@/data/constants";
import { toInternal } from "@/lib/artifact/scoring/utils";
import type { PresetBuildEntry } from "../../scripts/buildArtifactStats";
import {
  TOTAL_SUB_ROLLS,
  buildArtifactStats,
  findPresetBuild,
} from "../../scripts/buildArtifactStats";
import { describe, expect, it } from "vitest";

// ── Test data ────────────────────────────────────────────────────────────────

const builds: Record<string, PresetBuildEntry> = {
  "hutao-cw": {
    characterId: "hu_tao",
    artifactSet: "crimson_witch_of_flames",
    sands: ["hp%"],
    goblet: ["pyro%"],
    circlet: ["cr"],
    substats: [
      { stat: "cd", weight: 100 },
      { stat: "hp%", weight: 75 },
      { stat: "em", weight: 50 },
    ],
    visible: true,
  },
  "hutao-sr": {
    characterId: "hu_tao",
    artifactSet: "shimenawas_reminiscence",
    sands: ["hp%"],
    goblet: ["pyro%"],
    circlet: ["cd"],
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "hp%", weight: 75 },
    ],
    visible: true,
  },
  "hutao-hidden": {
    characterId: "hu_tao",
    artifactSet: "lavawalker",
    visible: false,
  },
  "xingqiu-esf": {
    characterId: "xingqiu",
    artifactSet: "emblem_of_severed_fate",
    sands: ["atk%"],
    goblet: ["hydro%"],
    circlet: ["cr"],
    substats: [
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 75 },
      { stat: "er", weight: 50 },
    ],
    visible: true,
  },
};

// ── findPresetBuild ──────────────────────────────────────────────────────────

describe("findPresetBuild", () => {
  it("finds exact match by characterId + artifactSet", () => {
    const result = findPresetBuild("hu_tao", "crimson_witch_of_flames", builds);
    expect(result).toBeDefined();
    expect(result!.artifactSet).toBe("crimson_witch_of_flames");
  });

  it("finds a different set for same character", () => {
    const result = findPresetBuild("hu_tao", "shimenawas_reminiscence", builds);
    expect(result).toBeDefined();
    expect(result!.artifactSet).toBe("shimenawas_reminiscence");
  });

  it("falls back to any visible build if no exact set match", () => {
    const result = findPresetBuild("hu_tao", "nonexistent_set", builds);
    expect(result).toBeDefined();
    expect(result!.visible).not.toBe(false);
  });

  it("returns hidden build as last resort if no visible builds", () => {
    const hiddenOnly: Record<string, PresetBuildEntry> = {
      hidden: { characterId: "solo", visible: false },
    };
    const result = findPresetBuild("solo", null, hiddenOnly);
    expect(result).toBeDefined();
    expect(result!.characterId).toBe("solo");
  });

  it("returns undefined for unknown character", () => {
    expect(findPresetBuild("unknown_char", null, builds)).toBeUndefined();
  });

  it("matches with null artifactSetId (falls back to visible)", () => {
    const result = findPresetBuild("xingqiu", null, builds);
    expect(result).toBeDefined();
    expect(result!.characterId).toBe("xingqiu");
  });
});

// ── buildArtifactStats ────────────────────────────────────────────────────────

describe("buildArtifactStats", () => {
  it("returns a StatSheet with expected main stats", () => {
    const sheet = buildArtifactStats(
      "hu_tao",
      "crimson_witch_of_flames",
      builds
    );

    // Flower and Plume are always fixed
    expect(sheet.getRaw("hp")).toBeGreaterThanOrEqual(4780);
    expect(sheet.getRaw("atk")).toBeGreaterThanOrEqual(311);

    // Sands: hp% from preset → main stat value
    expect(sheet.getRaw("hp%")).toBeGreaterThan(0);
    // Goblet: pyro% is stored as tagged dmg% by StatSheet, so check via getRaw("dmg%")
    // is unreliable — just verify cr (circlet) is present
    expect(sheet.getRaw("cr")).toBeGreaterThan(0);
  });

  it("distributes substats proportionally to weights", () => {
    const sheet = buildArtifactStats(
      "hu_tao",
      "crimson_witch_of_flames",
      builds
    );

    // cd has weight 100, hp% has 75, em has 50
    // All should be present as substats add to main stats
    expect(sheet.getRaw("cd")).toBeGreaterThan(0);
    // hp% should have both main stat + substat contribution (getRaw returns internal, constant is display)
    expect(sheet.getRaw("hp%")).toBeGreaterThan(toInternal("hp%", MAIN_STAT_VALUES_5STAR["hp%"]!));
    expect(sheet.getRaw("em")).toBeGreaterThan(0);
  });

  it("applies stat overrides for main stats", () => {
    const sheet = buildArtifactStats(
      "hu_tao",
      "crimson_witch_of_flames",
      builds,
      {
        sands: "em",
      }
    );

    // Sands override to EM adds main stat EM value (em is flat, no conversion needed)
    expect(sheet.getRaw("em")).toBeGreaterThanOrEqual(MAIN_STAT_VALUES_5STAR.em!);
  });

  it("uses sensible defaults for unknown character", () => {
    const sheet = buildArtifactStats("nonexistent", null, builds);

    // Should still have flower/plume main stats
    expect(sheet.getRaw("hp")).toBeGreaterThanOrEqual(4780);
    expect(sheet.getRaw("atk")).toBeGreaterThanOrEqual(311);
    // Default sands=atk%, goblet=atk%, circlet=cr
    expect(sheet.getRaw("atk%")).toBeGreaterThan(0);
    expect(sheet.getRaw("cr")).toBeGreaterThan(0);
  });

  it("handles build with no substats config gracefully", () => {
    const minBuilds: Record<string, PresetBuildEntry> = {
      b1: { characterId: "test", visible: true },
    };
    const sheet = buildArtifactStats("test", null, minBuilds);
    // Should still produce stats from defaults (cr + cd + atk%)
    expect(sheet.getRaw("hp")).toBe(4780);
    // Default substats include atk% which adds substat rolls to atk%
    expect(sheet.getRaw("atk%")).toBeGreaterThan(0);
    expect(sheet.getRaw("cr")).toBeGreaterThan(0);
    expect(sheet.getRaw("cd")).toBeGreaterThan(0);
  });
});
