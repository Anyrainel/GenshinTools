import type {
  GeneratorOptions,
  GeneratorResult,
} from "@/lib/team-comp/generator";
import { runGenerator } from "@/lib/team-comp/generator";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncGeneratorState {
  result: GeneratorResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: GeneratorOptions) => void;
  stop: () => void;
}

export function useAsyncGenerator(): AsyncGeneratorState {
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeGenerator = useRef<AsyncGenerator<GeneratorResult> | null>(null);
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
      activeGenerator.current.return(undefined as unknown as GeneratorResult);
      activeGenerator.current = null;
    }
    setIsComputing(false);
  }, []);

  const start = useCallback(
    async (opts: GeneratorOptions) => {
      stop();
      setResult(null);
      setError(null);
      setIsComputing(true);

      try {
        const gen = runGenerator(opts);
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
