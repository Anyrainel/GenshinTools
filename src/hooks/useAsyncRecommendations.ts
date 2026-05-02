import { useCallback, useState } from "react";
import type { Tier } from "@/data/enums";
import type {
  AccountData,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import {
  type AllActions,
  generateScoreActionsByTier,
  type ScoreUpTierUpdate,
} from "@/lib/account-data/scoreUpEngine";
import type { AllocationOptions } from "@/lib/account-data/tierWaterfall";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { useAsyncComputation } from "./useAsyncComputation";

export interface ScoreUpOptions {
  accountData: AccountData;
  scores: Record<string, ArtifactScoreResult | null>;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  options?: AllocationOptions;
}

export interface ScoreUpProgress {
  completedTierCount: number;
  totalTierCount: number;
  currentTier: Tier | null;
}

export interface AsyncScoreUpState {
  recommendations: AllActions | null;
  progress: ScoreUpProgress;
  isComputing: boolean;
  error: Error | null;
  start: (opts: ScoreUpOptions) => void;
  stop: () => void;
}

export function useAsyncScoreUp(): AsyncScoreUpState {
  const [progress, setProgress] = useState<ScoreUpProgress>({
    completedTierCount: 0,
    totalTierCount: 0,
    currentTier: null,
  });

  const onYield = useCallback(
    (yielded: ScoreUpTierUpdate, setResult: (result: AllActions) => void) => {
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
    (opts: ScoreUpOptions) =>
      generateScoreActionsByTier(
        opts.accountData,
        opts.scores,
        opts.tierAssignments,
        opts.tierCustomization,
        opts.options
      ),
    []
  );

  const { result, isComputing, error, start, stop } = useAsyncComputation<
    ScoreUpTierUpdate,
    AllActions,
    ScoreUpOptions
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
