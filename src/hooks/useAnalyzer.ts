import { useCallback, useEffect, useRef, useState } from "react";

import {
  isAnalyzerResult,
  runAnalysis,
} from "@/lib/team-comp/analyzer/analyzer";
import type {
  AnalyzerOptions,
  AnalyzerProgress,
  AnalyzerResult,
} from "@/lib/team-comp/analyzer/types";
import { useAnalyzerCacheStore } from "@/stores/useAnalyzerCacheStore";
import { useTeamResultCacheStore } from "@/stores/useTeamResultCacheStore";

/** Build a cache key from the analyzer options that affect the result. */
function buildCacheKey(opts: AnalyzerOptions): string {
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

  const combo = opts.templateCombo;

  const comboPart = combo.lines
    .filter((l) => l.count > 0)
    .map((l) => {
      const rx = l.reaction;
      const rxStr = rx
        ? `${rx.reaction ?? ""}|${JSON.stringify(rx.rxnParts ?? {})}|${JSON.stringify(rx.rxnPartHits ?? {})}`
        : "";
      return `${l.charId}:${l.formulaId}:${l.count}:${rxStr}`;
    })
    .join(",");

  // Include overrides in the cache key so different overrides don't return stale results
  const overridePart = opts.comboOverrides
    ? JSON.stringify(opts.comboOverrides)
    : "";
  const minErPart = opts.minErOverrides
    ? JSON.stringify(opts.minErOverrides)
    : "";

  return `${charParts}::${comboPart}::${overridePart}::${minErPart}`;
}

export interface UseAnalyzerState {
  progress: AnalyzerProgress | null;
  result: AnalyzerResult | null;
  isComputing: boolean;
  error: Error | null;
  start: (opts: AnalyzerOptions, force?: boolean) => void;
  stop: () => void;
}

export function useAnalyzer(teamId: string): UseAnalyzerState {
  const cacheGet = useAnalyzerCacheStore((s) => s.get);
  const cacheSet = useAnalyzerCacheStore((s) => s.set);
  const getInvestmentResult = useTeamResultCacheStore(
    (s) => s.getInvestmentResult
  );
  const setInvestmentResult = useTeamResultCacheStore(
    (s) => s.setInvestmentResult
  );

  const [progress, setProgress] = useState<AnalyzerProgress | null>(null);
  const [result, setResult] = useState<AnalyzerResult | null>(
    () => getInvestmentResult(teamId) ?? null
  );
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef(false);
  const isMounted = useRef(true);

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
    async (opts: AnalyzerOptions, force?: boolean) => {
      if (!opts.templateCombo) {
        setError(new Error("Analyzer requires a template combo"));
        return;
      }
      stop();
      abortRef.current = false;
      setProgress(null);
      setError(null);

      // Check cache first (skip if force recompute)
      const key = buildCacheKey(opts);
      if (!force) {
        const cached = cacheGet(key);
        if (cached) {
          setResult(cached);
          return;
        }
      }

      setResult(null);
      setIsComputing(true);

      try {
        const gen = runAnalysis(opts);

        for await (const yielded of gen) {
          if (abortRef.current || !isMounted.current) break;

          if (isAnalyzerResult(yielded)) {
            setResult(yielded);
            cacheSet(key, yielded);
            setInvestmentResult(teamId, yielded);
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
    [stop, cacheGet, cacheSet, setInvestmentResult, teamId]
  );

  return { progress, result, isComputing, error, start, stop };
}
