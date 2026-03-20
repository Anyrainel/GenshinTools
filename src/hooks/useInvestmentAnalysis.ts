import { useCallback, useEffect, useRef, useState } from "react";

import type {
  InvestmentOptions,
  InvestmentProgress,
  InvestmentResult,
} from "@/lib/team-comp/investmentOptimizer";
import {
  isInvestmentResult,
  runInvestmentAnalysis,
} from "@/lib/team-comp/investmentOptimizer";
import { useInvestmentCacheStore } from "@/stores/useInvestmentCacheStore";

/** Build a cache key from the investment options that affect the result. */
function buildCacheKey(opts: InvestmentOptions): string {
  const charParts = opts.configs
    .map((c) => {
      const w4 = c.weapon4Star
        ? `${c.weapon4Star.id}R${c.weapon4Star.refinement}`
        : "-";
      const w5 = c.weapon5Star ? c.weapon5Star.id : "-";
      return `${c.charId}:${c.rarity}:C${c.startConstellation}:${w4}:${w5}`;
    })
    .sort()
    .join("|");

  const comboPart = opts.combo.lines
    .filter((l) => l.count > 0)
    .map((l) => `${l.charId}:${l.formulaId}:${l.count}`)
    .join(",");

  return `${charParts}::${comboPart}`;
}

export interface UseInvestmentAnalysisState {
  progress: InvestmentProgress | null;
  result: InvestmentResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: InvestmentOptions) => void;
  stop: () => void;
}

export function useInvestmentAnalysis(): UseInvestmentAnalysisState {
  const [progress, setProgress] = useState<InvestmentProgress | null>(null);
  const [result, setResult] = useState<InvestmentResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef(false);
  const isMounted = useRef(true);
  const cacheGet = useInvestmentCacheStore((s) => s.get);
  const cacheSet = useInvestmentCacheStore((s) => s.set);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      abortRef.current = true;
    };
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsComputing(false);
  }, []);

  const start = useCallback(
    async (opts: InvestmentOptions) => {
      stop();
      abortRef.current = false;
      setProgress(null);
      setError(null);

      // Check cache first
      const key = buildCacheKey(opts);
      const cached = cacheGet(key);
      if (cached) {
        setResult(cached);
        return;
      }

      setResult(null);
      setIsComputing(true);

      try {
        const gen = runInvestmentAnalysis(opts);

        for await (const yielded of gen) {
          if (abortRef.current || !isMounted.current) break;

          if (isInvestmentResult(yielded)) {
            setResult(yielded);
            cacheSet(key, yielded);
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
        }
      }
    },
    [stop, cacheGet, cacheSet]
  );

  return { progress, result, isComputing, error, start, stop };
}
