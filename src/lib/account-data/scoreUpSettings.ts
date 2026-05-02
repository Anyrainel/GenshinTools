import type { LuckExpectation, Tier } from "@/data/enums";

export interface ScoreUpSettings {
  allowPoolArtifactSteals: boolean;
  luckExpectationByTier: Record<Tier, LuckExpectation>;
}

export const DEFAULT_SCORE_UP_SETTINGS: ScoreUpSettings = {
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

export function cloneDefaultScoreUpSettings(): ScoreUpSettings {
  return structuredClone(DEFAULT_SCORE_UP_SETTINGS);
}

export function normalizeScoreUpSettings(
  settings: Partial<ScoreUpSettings>
): ScoreUpSettings {
  return {
    allowPoolArtifactSteals:
      settings.allowPoolArtifactSteals ??
      DEFAULT_SCORE_UP_SETTINGS.allowPoolArtifactSteals,
    luckExpectationByTier: {
      ...DEFAULT_SCORE_UP_SETTINGS.luckExpectationByTier,
      ...settings.luckExpectationByTier,
    },
  };
}
