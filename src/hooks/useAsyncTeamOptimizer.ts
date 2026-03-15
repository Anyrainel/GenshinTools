import type {
  TeamOptYield,
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptimizerOptions,
} from "@/lib/team-comp/optimizerV2";
import { runTeamOptimization } from "@/lib/team-comp/optimizerV2";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncTeamOptimizerState {
  progress: TeamOptimizationProgress | null;
  result: TeamOptimizationResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: TeamOptimizerOptions) => void;
  stop: () => void;
}

export function useAsyncTeamOptimizer(): AsyncTeamOptimizerState {
  const [progress, setProgress] = useState<TeamOptimizationProgress | null>(
    null
  );
  const [result, setResult] = useState<TeamOptimizationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeGenerator = useRef<AsyncGenerator<TeamOptYield> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stop();
    };
  }, []);

  const stop = useCallback(() => {
    if (activeGenerator.current) {
      activeGenerator.current.return(undefined as unknown as TeamOptYield);
      activeGenerator.current = null;
    }
    setIsComputing(false);
  }, []);

  const start = useCallback(
    async (opts: TeamOptimizerOptions) => {
      stop();
      setProgress(null);
      setResult(null);
      setError(null);
      setIsComputing(true);

      try {
        const gen = runTeamOptimization(opts);
        activeGenerator.current = gen;

        for await (const yielded of gen) {
          if (!isMounted.current) break;
          if (yielded.done) {
            setResult(yielded);
          } else {
            setProgress(yielded);
          }
        }
      } catch (err) {
        if (isMounted.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted.current) {
          setIsComputing(false);
          activeGenerator.current = null;
        }
      }
    },
    [stop]
  );

  return { progress, result, isComputing, error, start, stop };
}
