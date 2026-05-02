import type { LuckExpectation, Tier } from "@/data/enums";

export interface RecommendationSettings {
  allowPoolArtifactSteals: boolean;
  luckExpectationByTier: Record<Tier, LuckExpectation>;
}

export const DEFAULT_RECOMMENDATION_SETTINGS: RecommendationSettings = {
  allowPoolArtifactSteals: true,
  luckExpectationByTier: {
    S: "balanced",
    A: "balanced",
    B: "balanced",
    C: "balanced",
    D: "balanced",
    Pool: "balanced",
  },
};

export function cloneDefaultRecommendationSettings(): RecommendationSettings {
  return structuredClone(DEFAULT_RECOMMENDATION_SETTINGS);
}

export function normalizeRecommendationSettings(
  settings: Partial<RecommendationSettings>
): RecommendationSettings {
  return {
    allowPoolArtifactSteals:
      settings.allowPoolArtifactSteals ??
      DEFAULT_RECOMMENDATION_SETTINGS.allowPoolArtifactSteals,
    luckExpectationByTier: {
      ...DEFAULT_RECOMMENDATION_SETTINGS.luckExpectationByTier,
      ...settings.luckExpectationByTier,
    },
  };
}
