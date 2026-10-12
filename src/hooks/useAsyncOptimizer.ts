import { useCallback, useState } from "react";
import { runTeamOptimization } from "@/lib/team-comp/optimizer/teamOptimization";
import type {
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptimizerOptions,
  TeamOptYield,
} from "@/lib/team-comp/types";
import { useAsyncComputation } from "./useAsyncComputation";

export interface AsyncOptimizerState {
  progress: TeamOptimizationProgress | null;
  result: TeamOptimizationResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: TeamOptimizerOptions) => void;
  stop: () => void;
  reset: () => void;
}

export function useAsyncOptimizer(): AsyncOptimizerState {
  const [progress, setProgress] = useState<TeamOptimizationProgress | null>(
    null
  );

  const onYield = useCallback(
    (
      yielded: TeamOptYield,
      setResult: (result: TeamOptimizationResult) => void
    ) => {
      if (yielded.done) {
        setResult(yielded);
      } else {
        setProgress(yielded);
      }
    },
    []
  );

  const onStart = useCallback(() => {
    setProgress(null);
  }, []);

  const {
    result,
    isComputing,
    error,
    start,
    stop,
    reset: resetComputation,
  } = useAsyncComputation<
    TeamOptYield,
    TeamOptimizationResult,
    TeamOptimizerOptions
  >(runTeamOptimization, onYield, onStart);

  const reset = useCallback(() => {
    setProgress(null);
    resetComputation();
  }, [resetComputation]);
  return { progress, result, isComputing, error, start, stop, reset };
}
