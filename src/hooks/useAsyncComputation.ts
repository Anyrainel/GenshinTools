import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncComputationState<TResult, TOpts> {
  result: TResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: TOpts) => void;
  stop: () => void;
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

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stop();
    };
  }, []);

  const stop = useCallback(() => {
    if (activeGenerator.current) {
      activeGenerator.current.return(undefined);
      activeGenerator.current = null;
    }
    setIsComputing(false);
  }, []);

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

      try {
        const gen = runFn(opts);
        activeGenerator.current = gen;

        for await (const yielded of gen) {
          if (!isMounted.current) break;
          handleYield(yielded, setResult);
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
    [stop, runFn, handleYield, onStart]
  );

  return { result, isComputing, error, start, stop };
}
