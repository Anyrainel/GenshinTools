import type { LuckExpectation, Tier } from "@/data/enums";
import { cloneData } from "@/lib/utils";

export interface ScoreUpSettings {
  allowPoolArtifactSteals: boolean;
  respectFrozenArtifacts: boolean;
  luckExpectationByTier: Record<Tier, LuckExpectation>;
}

export const DEFAULT_SCORE_UP_SETTINGS: ScoreUpSettings = {
  allowPoolArtifactSteals: true,
  respectFrozenArtifacts: true,
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
  return cloneData(DEFAULT_SCORE_UP_SETTINGS);
}

export function normalizeScoreUpSettings(
  settings: Partial<ScoreUpSettings>
): ScoreUpSettings {
  return {
    allowPoolArtifactSteals:
      settings.allowPoolArtifactSteals ??
      DEFAULT_SCORE_UP_SETTINGS.allowPoolArtifactSteals,
    respectFrozenArtifacts:
      settings.respectFrozenArtifacts ??
      DEFAULT_SCORE_UP_SETTINGS.respectFrozenArtifacts,
    luckExpectationByTier: {
      ...DEFAULT_SCORE_UP_SETTINGS.luckExpectationByTier,
      ...settings.luckExpectationByTier,
    },
  };
}
