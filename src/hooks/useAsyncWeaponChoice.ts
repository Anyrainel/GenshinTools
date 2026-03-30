import {
  type WeaponChoiceOptions,
  type WeaponChoiceResult,
  runWeaponChoice,
} from "@/lib/team-comp/weaponChoice";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncWeaponChoiceState {
  result: WeaponChoiceResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: WeaponChoiceOptions) => void;
  stop: () => void;
}

export function useAsyncWeaponChoice(): AsyncWeaponChoiceState {
  const [result, setResult] = useState<WeaponChoiceResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeGenerator = useRef<AsyncGenerator<
    WeaponChoiceResult,
    void
  > | null>(null);
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

  const start = useCallback(
    async (opts: WeaponChoiceOptions) => {
      stop();
      setResult(null);
      setError(null);
      setIsComputing(true);

      try {
        const gen = runWeaponChoice(opts);
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
