import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncComputationState<TResult, TOpts> {
  result: TResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: TOpts) => void;
  stop: () => void;
  reset: () => void;
}

export function useAsyncComputation<TYield, TResult = TYield, TOpts = unknown>(
  runFn: (opts: TOpts) => AsyncGenerator<TYield, void>,
  onYield?: (yielded: TYield, setState: (result: TResult) => void) => void,
  onStart?: () => void
): AsyncComputationState<TResult, TOpts> {
  const [result, setResult] = useState<TResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeGenerator = useRef<AsyncGenerator<TYield, void> | null>(null);
  const isMounted = useRef(true);

  const stop = useCallback(() => {
    if (activeGenerator.current) {
      activeGenerator.current.return(undefined);
      activeGenerator.current = null;
    }
    setIsComputing(false);
  }, []);
  const reset = useCallback(() => {
    stop();
    setResult(null);
    setError(null);
  }, [stop]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stop();
    };
  }, [stop]);

  // When onYield is omitted, TYield = TResult (enforced by the default type param).
  // TypeScript cannot verify this generic relationship statically.
  const handleYield =
    onYield ??
    ((yielded: TYield, setState: (r: TResult) => void) => {
      setState(yielded as unknown as TResult);
    });

  const start = useCallback(
    async (opts: TOpts) => {
      stop();
      setResult(null);
      setError(null);
      onStart?.();
      setIsComputing(true);
      const gen = runFn(opts);
      activeGenerator.current = gen;

      try {
        for await (const yielded of gen) {
          if (!isMounted.current || activeGenerator.current !== gen) break;
          handleYield(yielded, (next) => {
            if (isMounted.current && activeGenerator.current === gen)
              setResult(next);
          });
        }
      } catch (err) {
        if (isMounted.current && activeGenerator.current === gen) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted.current && activeGenerator.current === gen) {
          setIsComputing(false);
          activeGenerator.current = null;
        }
      }
    },
    [stop, runFn, handleYield, onStart]
  );

  return { result, isComputing, error, start, stop, reset };
}
