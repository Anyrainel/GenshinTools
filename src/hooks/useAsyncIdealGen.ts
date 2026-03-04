import type {
  IdealGenOptions,
  IdealGenResult,
} from "@/lib/team-comp/idealArtifactGen";
import { runIdealArtifactGen } from "@/lib/team-comp/idealArtifactGen";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncIdealGenState {
  result: IdealGenResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: IdealGenOptions) => void;
  stop: () => void;
}

export function useAsyncIdealGen(): AsyncIdealGenState {
  const [result, setResult] = useState<IdealGenResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeGenerator = useRef<AsyncGenerator<IdealGenResult> | null>(null);
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
      activeGenerator.current.return(undefined as unknown as IdealGenResult);
      activeGenerator.current = null;
    }
    setIsComputing(false);
  }, []);

  const start = useCallback(
    async (opts: IdealGenOptions) => {
      stop();
      setResult(null);
      setError(null);
      setIsComputing(true);

      try {
        const gen = runIdealArtifactGen(opts);
        activeGenerator.current = gen;

        for await (const yielded of gen) {
          if (!isMounted.current) break;
          setResult(yielded);
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
