import type { ArtifactData } from "@/domain/models";
import { artifactsById } from "@/domain/reference/catalog";
import type { TriageDecision } from "./types";

/** Four-star pieces only participate when their set has no five-star version. */
export function isTriageArtifactEligible(artifact: ArtifactData): boolean {
  return (
    artifact.rarity === 5 ||
    (artifact.rarity === 4 && artifactsById[artifact.setKey]?.rarity === 4)
  );
}

export function isTriageRarityProtected(decision: TriageDecision): boolean {
  return (
    decision.specialRules.includes("fourStarProtection") ||
    decision.specialRules.includes("rarityProtected")
  );
}
