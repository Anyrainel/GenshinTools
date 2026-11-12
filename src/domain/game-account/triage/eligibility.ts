import type { ArtifactData } from "@/domain/models";
import { artifactsById } from "@/domain/reference/catalog";

/** Four-star pieces only participate when their set has no five-star version. */
export function isTriageArtifactEligible(artifact: ArtifactData): boolean {
  return (
    artifact.rarity === 5 ||
    (artifact.rarity === 4 && artifactsById[artifact.setKey]?.rarity === 4)
  );
}
