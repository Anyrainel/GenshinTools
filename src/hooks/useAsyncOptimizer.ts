import type {
  OptimizationResult,
  OptimizerOptions,
} from "@/lib/team-comp/optimizer";
import { runOptimization } from "@/lib/team-comp/optimizer";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncOptimizerState {
  result: OptimizationResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: OptimizerOptions) => void;
  stop: () => void;
}

export function useAsyncOptimizer(): AsyncOptimizerState {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeGenerator = useRef<AsyncGenerator<OptimizationResult> | null>(
    null
  );
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
      activeGenerator.current.return(
        undefined as unknown as OptimizationResult
      );
      activeGenerator.current = null;
    }
    setIsComputing(false);
  }, []);

  const start = useCallback(
    async (opts: OptimizerOptions) => {
      stop();
      setResult(null);
      setError(null);
      setIsComputing(true);

      try {
        const gen = runOptimization(opts);
        activeGenerator.current = gen;

        for await (const res of gen) {
          if (!isMounted.current) break;
          setResult(res);
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

  return { result, isComputing, error, start, stop };
}
