import type { ArtifactData } from "@/data/types";

/** Detect whether an artifact started with 4 initial substats. */
export function isInitial4Line(artifact: ArtifactData): boolean {
  const activatedCount = Object.keys(artifact.substats ?? {}).length;
  const unactivatedCount = Object.keys(
    artifact.unactivatedSubstats ?? {}
  ).length;
  const totalRolls = artifact.totalRolls ?? activatedCount + unactivatedCount;
  const upgradeRolls = Math.floor(artifact.level / 4);
  return totalRolls - upgradeRolls >= 4;
}
