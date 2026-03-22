import { artifactHalfSetsById } from "@/data/constants";
import type { Build } from "@/data/types";

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
