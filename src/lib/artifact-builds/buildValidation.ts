import { artifactHalfSetsById } from "@/data/gameResources";
import type { Build, BuildGroup } from "@/data/types";

/**
 * Validates a build configuration and returns a list of error keys (i18n-ui keys).
 * Returns an empty array if the build is valid.
 */
export function getBuildValidationErrors(build: Build): string[] {
  const errors: string[] = [];

  if (!build.styles || build.styles.length === 0) {
    errors.push("buildCard.missingStyle");
  }

  if (!build.roles || build.roles.length === 0) {
    errors.push("buildCard.missingRole");
  }

  // Check artifact set configuration
  if (build.composition === "4pc") {
    if (!build.artifactSet) {
      errors.push("buildCard.missing4pc");
    }
  } else {
    // 2pc+2pc
    if (!build.halfSet1 || !build.halfSet2) {
      errors.push("buildCard.missing2pc");
    } else {
      // Check if halfSet1 and halfSet2 are the same
      if (build.halfSet1 === build.halfSet2) {
        const halfSet = artifactHalfSetsById[build.halfSet1];
        if (!halfSet || halfSet.setIds.length <= 1) {
          errors.push("buildCard.notEnough2pc");
        }
      }
    }
  }

  // Check main stats
  if (build.sandsWeights.length === 0) {
    errors.push("buildCard.missingSands");
  }
  if (build.gobletWeights.length === 0) {
    errors.push("buildCard.missingGoblet");
  }
  if (build.circletWeights.length === 0) {
    errors.push("buildCard.missingCirclet");
  }

  // Check substats
  if (build.substats.length === 0) {
    errors.push("buildCard.missingSubstat");
  } else {
    // Check if at least one substat has weight 100
    const hasMaxWeight = build.substats.some((s) => s.weight === 100);
    if (!hasMaxWeight) {
      errors.push("buildCard.weightWarning");
    }
  }

  return errors;
}

export interface BuildValidationIssue {
  characterId: string;
  buildId: string;
  buildName: string;
  errorKeys: string[];
}

export function getResolvedBuildValidationIssues(
  groups: BuildGroup[]
): BuildValidationIssue[] {
  const issues: BuildValidationIssue[] = [];
  for (const group of groups) {
    for (const build of group.builds) {
      const errorKeys = getBuildValidationErrors(build);
      if (errorKeys.length === 0) continue;
      issues.push({
        characterId: group.characterId,
        buildId: build.id,
        buildName: build.name,
        errorKeys,
      });
    }
  }
  return issues;
}

export function filterValidBuildGroups(groups: BuildGroup[]): BuildGroup[] {
  const filtered: BuildGroup[] = [];
  for (const group of groups) {
    const builds = group.builds.filter(
      (build) => getBuildValidationErrors(build).length === 0
    );
    if (builds.length === 0) continue;
    filtered.push({ ...group, builds });
  }
  return filtered;
}
