import type { Build } from "@/data/types";
import { getBuildValidationErrors } from "@/lib/artifact-builds/buildValidation";
import { describe, expect, it } from "vitest";

const validBuild: Build = {
  id: "test-1",
  characterId: "hu_tao",
  visible: true,
  name: "Main DPS",
  composition: "4pc",
  artifactSet: "crimson_witch_of_flames",
  styles: ["on-field"],
  roles: ["dps"],
  minCons: 0,
  sands: ["hp%"],
  goblet: ["pyro%"],
  circlet: ["cr"],
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
    { stat: "hp%", weight: 80 },
    { stat: "em", weight: 70 },
  ],
};

describe("getBuildValidationErrors", () => {
  it("returns empty array for a valid build", () => {
    expect(getBuildValidationErrors(validBuild)).toEqual([]);
  });

  // --- Style & Role ---

  it("reports missing styles", () => {
    const errors = getBuildValidationErrors({ ...validBuild, styles: [] });
    expect(errors).toContain("buildCard.missingStyle");
  });

  it("reports missing roles", () => {
    const errors = getBuildValidationErrors({ ...validBuild, roles: [] });
    expect(errors).toContain("buildCard.missingRole");
  });

  it("reports missing styles when undefined", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      styles: undefined,
    });
    expect(errors).toContain("buildCard.missingStyle");
  });

  // --- 4pc Artifact ---

  it("reports missing artifact set for 4pc composition", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      composition: "4pc",
      artifactSet: undefined,
    });
    expect(errors).toContain("buildCard.missing4pcSet");
  });

  // --- 2pc+2pc Artifact ---

  it("reports missing half sets for 2pc+2pc composition", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      composition: "2pc+2pc",
      artifactSet: undefined,
      halfSet1: undefined,
      halfSet2: undefined,
    });
    expect(errors).toContain("buildCard.missing2pcSets");
  });

  it("reports missing halfSet2 for 2pc+2pc composition", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      composition: "2pc+2pc",
      artifactSet: undefined,
      halfSet1: 1,
      halfSet2: undefined,
    });
    expect(errors).toContain("buildCard.missing2pcSets");
  });

  it("reports same halfSet IDs with insufficient backing sets", () => {
    // halfSet ID 999 won't exist in artifactHalfSetsById
    const errors = getBuildValidationErrors({
      ...validBuild,
      composition: "2pc+2pc",
      artifactSet: undefined,
      halfSet1: 999,
      halfSet2: 999,
    });
    expect(errors).toContain("buildCard.notEnoughSame2pcSets");
  });

  // --- Main Stats ---

  it("reports missing sands main stat", () => {
    const errors = getBuildValidationErrors({ ...validBuild, sands: [] });
    expect(errors).toContain("buildCard.missingSandsMainStat");
  });

  it("reports missing goblet main stat", () => {
    const errors = getBuildValidationErrors({ ...validBuild, goblet: [] });
    expect(errors).toContain("buildCard.missingGobletMainStat");
  });

  it("reports missing circlet main stat", () => {
    const errors = getBuildValidationErrors({ ...validBuild, circlet: [] });
    expect(errors).toContain("buildCard.missingCircletMainStat");
  });

  // --- Substats ---

  it("reports missing substats", () => {
    const errors = getBuildValidationErrors({ ...validBuild, substats: [] });
    expect(errors).toContain("buildCard.missingSubstat");
  });

  it("reports weight warning when no substat has weight 100", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      substats: [
        { stat: "cr", weight: 90 },
        { stat: "cd", weight: 80 },
      ],
    });
    expect(errors).toContain("buildCard.weightWarning");
  });

  it("does not report weight warning when at least one substat has weight 100", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 50 },
      ],
    });
    expect(errors).not.toContain("buildCard.weightWarning");
  });

  // --- Multiple errors ---

  it("accumulates all errors for a completely empty build", () => {
    const emptyBuild: Build = {
      id: "empty",
      characterId: "test",
      visible: true,
      name: "",
      composition: "4pc",
      styles: [],
      roles: [],
      sands: [],
      goblet: [],
      circlet: [],
      substats: [],
    };
    const errors = getBuildValidationErrors(emptyBuild);
    expect(errors).toHaveLength(7);
    expect(errors).toContain("buildCard.missingStyle");
    expect(errors).toContain("buildCard.missingRole");
    expect(errors).toContain("buildCard.missing4pcSet");
    expect(errors).toContain("buildCard.missingSandsMainStat");
    expect(errors).toContain("buildCard.missingGobletMainStat");
    expect(errors).toContain("buildCard.missingCircletMainStat");
    expect(errors).toContain("buildCard.missingSubstat");
  });
});
