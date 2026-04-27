import { useCallback, useState } from "react";
import type { Tier } from "@/data/enums";
import type {
  AccountData,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import {
  type AllActions,
  generateRecommendationsByTier,
  type RecommendationTierUpdate,
} from "@/lib/account-data/scoreUpEngine";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { useAsyncComputation } from "./useAsyncComputation";

export interface RecommendationOptions {
  accountData: AccountData;
  scores: Record<string, ArtifactScoreResult | null>;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
}

export interface RecommendationProgress {
  completedTierCount: number;
  totalTierCount: number;
  currentTier: Tier | null;
}

export interface AsyncRecommendationsState {
  recommendations: AllActions | null;
  progress: RecommendationProgress;
  isComputing: boolean;
  error: Error | null;
  start: (opts: RecommendationOptions) => void;
  stop: () => void;
}

export function useAsyncRecommendations(): AsyncRecommendationsState {
  const [progress, setProgress] = useState<RecommendationProgress>({
    completedTierCount: 0,
    totalTierCount: 0,
    currentTier: null,
  });

  const onYield = useCallback(
    (
      yielded: RecommendationTierUpdate,
      setResult: (result: AllActions) => void
    ) => {
      setProgress({
        completedTierCount: yielded.completedTierCount,
        totalTierCount: yielded.totalTierCount,
        currentTier: yielded.tier,
      });
      setResult(yielded.recommendations);
    },
    []
  );

  const onStart = useCallback(() => {
    setProgress({
      completedTierCount: 0,
      totalTierCount: 0,
      currentTier: null,
    });
  }, []);

  const runRecommendations = useCallback(
    (opts: RecommendationOptions) =>
      generateRecommendationsByTier(
        opts.accountData,
        opts.scores,
        opts.tierAssignments,
        opts.tierCustomization
      ),
    []
  );

  const { result, isComputing, error, start, stop } = useAsyncComputation<
    RecommendationTierUpdate,
    AllActions,
    RecommendationOptions
  >(runRecommendations, onYield, onStart);

  return {
    recommendations: result,
    progress,
    isComputing,
    error,
    start,
    stop,
  };
}
