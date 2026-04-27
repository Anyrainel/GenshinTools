import { describe, expect, it } from "vitest";
import type { Build } from "@/data/types";
import {
  filterValidBuildGroups,
  getBuildValidationErrors,
  getResolvedBuildValidationIssues,
} from "@/lib/artifact-builds/buildValidation";

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
  sandsWeights: [{ stat: "hp%", weight: 100 }],
  gobletWeights: [{ stat: "pyro%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 0,
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
    expect(errors).toContain("buildCard.missing4pc");
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
    expect(errors).toContain("buildCard.missing2pc");
  });

  it("reports missing halfSet2 for 2pc+2pc composition", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      composition: "2pc+2pc",
      artifactSet: undefined,
      halfSet1: "cryo%-15",
      halfSet2: undefined,
    });
    expect(errors).toContain("buildCard.missing2pc");
  });

  it("reports same halfSet IDs with insufficient backing sets", () => {
    // halfSet ID 999 won't exist in artifactHalfSetsById
    const errors = getBuildValidationErrors({
      ...validBuild,
      composition: "2pc+2pc",
      artifactSet: undefined,
      halfSet1: "nonexistent-999",
      halfSet2: "nonexistent-999",
    });
    expect(errors).toContain("buildCard.notEnough2pc");
  });

  // --- Main Stats ---

  it("reports missing sands main stat", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      sandsWeights: [],
    });
    expect(errors).toContain("buildCard.missingSands");
  });

  it("reports missing goblet main stat", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      gobletWeights: [],
    });
    expect(errors).toContain("buildCard.missingGoblet");
  });

  it("reports missing circlet main stat", () => {
    const errors = getBuildValidationErrors({
      ...validBuild,
      circletWeights: [],
    });
    expect(errors).toContain("buildCard.missingCirclet");
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
      sandsWeights: [],
      gobletWeights: [],
      circletWeights: [],
      normalizer: 0,
      substats: [],
    };
    const errors = getBuildValidationErrors(emptyBuild);
    expect(errors).toHaveLength(7);
    expect(errors).toContain("buildCard.missingStyle");
    expect(errors).toContain("buildCard.missingRole");
    expect(errors).toContain("buildCard.missing4pc");
    expect(errors).toContain("buildCard.missingSands");
    expect(errors).toContain("buildCard.missingGoblet");
    expect(errors).toContain("buildCard.missingCirclet");
    expect(errors).toContain("buildCard.missingSubstat");
  });
});

describe("resolved build validation helpers", () => {
  const invalidBuild: Build = {
    ...validBuild,
    id: "invalid",
    name: "",
    substats: [],
  };

  const groups = [
    {
      characterId: "hu_tao",
      hidden: false,
      weapons: [],
      builds: [validBuild, invalidBuild],
    },
  ];

  it("collects issues for invalid resolved builds", () => {
    expect(getResolvedBuildValidationIssues(groups)).toEqual([
      {
        characterId: "hu_tao",
        buildId: "invalid",
        buildName: "",
        errorKeys: ["buildCard.missingSubstat"],
      },
    ]);
  });

  it("filters invalid builds out of resolved groups", () => {
    expect(filterValidBuildGroups(groups)).toEqual([
      {
        characterId: "hu_tao",
        hidden: false,
        weapons: [],
        builds: [validBuild],
      },
    ]);
  });
});
