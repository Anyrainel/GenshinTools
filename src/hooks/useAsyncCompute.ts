import type {
  ArtifactSetConfigs,
  BuildGroup,
  ComputeOptions,
  MergeAlgorithm,
  SetConfig,
} from "@/data/types";
import {
  DEFAULT_COMPUTE_OPTIONS,
  buildRawConfigs,
  mergeConfigsAsync,
} from "@/lib/artifact-builds/computeFilters";
import { useEffect, useRef, useState } from "react";

interface AsyncComputeState {
  /** Cached results — always available (may be stale while recomputing) */
  results: ArtifactSetConfigs[];
  /** True while a merge computation is in progress */
  isComputing: boolean;
}

// ── Module-level cache ──
// Persists across mounts so tab switches are instant.

/** Per-set merged results, keyed by setId */
const cachedPerSet: Record<string, ArtifactSetConfigs> = {};
/** Per-set raw config fingerprints for incremental diff */
let cachedRawKeys: Record<string, string> = {};
/** Compute options used for the cached results */
let cachedOptionsKey = "";
/** Flattened results array (derived from cachedPerSet) */
let cachedResults: ArtifactSetConfigs[] = [];
/** Active abort controller */
let activeController: AbortController | null = null;

function rawConfigKey(configs: SetConfig[]): string {
  // Structural fingerprint of a set's raw (pre-merge) configs.
  // JSON.stringify is fast enough for small arrays of simple objects.
  return JSON.stringify(configs);
}

function optionsKey(options: ComputeOptions): string {
  return JSON.stringify(options);
}

function flattenCache(): ArtifactSetConfigs[] {
  return Object.values(cachedPerSet);
}

/**
 * Async artifact filter computation with per-set incremental caching.
 *
 * - Returns cached results instantly on mount (fast tab switches).
 * - On input change, diffs per-set raw configs against cached fingerprints.
 * - Only recomputes Phase 2 (merge) for sets whose raw configs changed.
 * - Aborts the previous computation if inputs change mid-flight.
 */
export function useAsyncCompute(
  characterBuilds: BuildGroup[],
  computeOptions: ComputeOptions
): AsyncComputeState {
  const [results, setResults] = useState<ArtifactSetConfigs[]>(cachedResults);
  const [isComputing, setIsComputing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Cancel any in-flight computation
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    // Phase 1: sync — create raw per-set configs (fast)
    const rawConfigs = buildRawConfigs(characterBuilds, computeOptions);
    const mergedOptions = { ...DEFAULT_COMPUTE_OPTIONS, ...computeOptions };
    const algorithm: MergeAlgorithm =
      mergedOptions.mergeAlgorithm ?? "bruteForce";
    const normalizeFlatStats = mergedOptions.normalizeFlatStats ?? true;
    const currentOptionsKey = optionsKey(computeOptions);

    // If algorithm/options changed, all sets must be recomputed
    const optionsChanged = currentOptionsKey !== cachedOptionsKey;

    // Diff: identify which sets need recomputation
    const newRawKeys: Record<string, string> = {};
    const dirtyConfigs: Record<string, SetConfig[]> = {};

    for (const [setId, configs] of Object.entries(rawConfigs)) {
      const key = rawConfigKey(configs);
      newRawKeys[setId] = key;

      if (optionsChanged || key !== cachedRawKeys[setId]) {
        dirtyConfigs[setId] = configs;
      }
    }

    // Remove cached sets that no longer exist in raw configs
    for (const setId of Object.keys(cachedPerSet)) {
      if (!(setId in rawConfigs)) {
        delete cachedPerSet[setId];
      }
    }

    // If nothing changed, return cached results immediately
    if (Object.keys(dirtyConfigs).length === 0) {
      cachedResults = flattenCache();
      setResults(cachedResults);
      setIsComputing(false);
      return;
    }

    setIsComputing(true);

    // Phase 2: async — merge only dirty sets
    mergeConfigsAsync(
      dirtyConfigs,
      algorithm,
      normalizeFlatStats,
      controller.signal
    )
      .then((mergedSets) => {
        if (controller.signal.aborted) return;

        // Update per-set cache with new results
        for (const setResult of mergedSets) {
          cachedPerSet[setResult.setId] = setResult;
        }
        cachedRawKeys = newRawKeys;
        cachedOptionsKey = currentOptionsKey;
        cachedResults = flattenCache();

        if (mountedRef.current) {
          setResults(cachedResults);
          setIsComputing(false);
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        throw e;
      });

    return () => {
      mountedRef.current = false;
    };
  }, [characterBuilds, computeOptions]);

  return { results, isComputing };
}
