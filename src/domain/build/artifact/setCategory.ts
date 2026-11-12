import {
  TIER_LIST_OTHER_ARTIFACT_SETS,
  TIER_LIST_SUPPORT_ARTIFACT_SETS,
} from "@/config/gameConstants";
import { artifactsById } from "@/domain/reference/catalog";

export type ArtifactSetCategory = "dps" | "support" | "other";

export const ARTIFACT_SET_CATEGORIES: ArtifactSetCategory[] = [
  "dps",
  "support",
  "other",
];

export function getArtifactSetCategory(setId: string): ArtifactSetCategory {
  const artifactSet = artifactsById[setId];
  if (!artifactSet) return "other";
  if (TIER_LIST_SUPPORT_ARTIFACT_SETS.has(setId)) return "support";
  if (artifactSet.rarity === 4 || TIER_LIST_OTHER_ARTIFACT_SETS.has(setId)) {
    return "other";
  }
  return "dps";
}
