/**
 * Artifact Filter Computation with Must-Present Substats
 * Based on V3 algorithm with coverage theorem and merge rules
 */

import { mainStatsPlus } from "@/data/constants";
import type {
  MainStat,
  MainStatPlus,
  MainStatSlot,
  SubStat,
} from "@/data/enums";
import type { MergeAlgorithm } from "@/data/enums";
import { artifactHalfSetsById } from "@/data/gameResources";
import { elementalMainStats } from "../../data/constants";
import type {
  ArtifactBuildConfigs,
  Build,
  BuildConfig,
  BuildGroup,
  ComputeOptions,
  SlotConfig,
} from "../../data/types";
import { bruteForcePartitionAsync } from "./bruteForcePartition";
import { greedyMerge } from "./greedyMerge";
import { SLOT_KEYS, mergeConfigGroup } from "./mergeUtils";
import { smartMerge } from "./smartMerge";

export const DEFAULT_COMPUTE_OPTIONS: ComputeOptions = {
  expandElementalGoblet: true,
  expandCritCirclet: true,
  mergeAlgorithm: "smartMerge",
  normalizeFlatStats: true,
  substatWeightThreshold: 60,
  mustPresentWeightThreshold: 90,
};

/**
 * PHASE 1 (sync): Create raw per-set configs from all builds.
 * This is always fast — no merging happens here.
 */
export function buildRawConfigs(
  buildGroups: BuildGroup[],
  options: ComputeOptions = DEFAULT_COMPUTE_OPTIONS
): Record<string, BuildConfig[]> {
  const mergedOptions = { ...DEFAULT_COMPUTE_OPTIONS, ...options };
  const setFilters: Record<string, BuildConfig[]> = {};

  const visibleGroups = buildGroups.filter((group) => !group.hidden);
  for (const { characterId, builds } of visibleGroups) {
    const visibleBuilds = builds.filter((build) => build.visible);
    for (const build of visibleBuilds) {
      const relevantSets = getRelevantArtifactSets(build);
      const is4pc = build.composition === "4pc";

      for (const setId of relevantSets) {
        if (!setFilters[setId]) {
          setFilters[setId] = [];
        }
        const config = createConfigFromBuild(
          build,
          characterId,
          is4pc,
          mergedOptions
        );
        setFilters[setId].push(config);
      }
    }
  }
  return setFilters;
}

/**
 * When k - |mustPresent| ≤ 1 (at most 1 flexible slot), merging all configs
 * barely affects pass chance. Beyond that, pool expansion matters.
 */
function isSafeToMergeAll(configs: BuildConfig[]): boolean {
  const merged = mergeConfigGroup(configs);
  const flexSlots =
    merged.flowerPlume.minStatCount - merged.flowerPlume.mustPresent.length;
  return flexSlots <= 1;
}

/**
 * Post-process: if a config only has 2 substats (N=k=2), append corresponding
 * flat stats (e.g. ATK% → ATK) to widen the filter.
 */
function appendFlatStats(config: BuildConfig): BuildConfig {
  if (
    config.flowerPlume.substats.length > 2 ||
    config.flowerPlume.minStatCount !== config.flowerPlume.substats.length
  ) {
    return config;
  }

  const currentStats = new Set(config.flowerPlume.substats);
  let added = false;

  const pctToFlat: Record<string, SubStat> = {
    "atk%": "atk",
    "hp%": "hp",
    "def%": "def",
  };

  for (const pct of Object.keys(pctToFlat)) {
    if (currentStats.has(pct as SubStat)) {
      const flat = pctToFlat[pct];
      if (!currentStats.has(flat)) {
        currentStats.add(flat);
        added = true;
      }
    }
  }

  if (!added) return config;

  const newSubstats = Array.from(currentStats);
  const newMinCount = newSubstats.length;

  const result = { ...config };
  for (const key of SLOT_KEYS) {
    result[key] = {
      ...config[key],
      substats: newSubstats,
      minStatCount: newMinCount,
    };
  }
  return result;
}

async function splitAndMergeAsync(
  configs: BuildConfig[],
  algorithm: MergeAlgorithm,
  normalizeFlatStats: boolean,
  signal: AbortSignal
): Promise<BuildConfig[]> {
  const mergeFn = async (group: BuildConfig[]) => {
    if (algorithm === "smartMerge") return smartMerge(group);
    if (algorithm === "greedyMerge") return greedyMerge(group);
    return await bruteForcePartitionAsync(group, signal);
  };

  const nonCrit = configs.filter((c) => !hasCrCdMustPresent(c));
  const crit = configs.filter((c) => hasCrCdMustPresent(c));

  const primary = nonCrit.length > 0 ? await mergeFn(nonCrit) : [];

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const critMerged =
    crit.length > 0
      ? isSafeToMergeAll(crit)
        ? [mergeConfigGroup(crit)]
        : await mergeFn(crit)
      : [];

  let results = [...primary, ...critMerged];
  if (normalizeFlatStats) {
    results = results.map(appendFlatStats);
  }
  return results.map(finalizeMainStatsConversion);
}

/**
 * PHASE 2 (async): Merge raw configs incrementally, yielding control
 * between sets so the main thread stays responsive.
 * Checks `signal.aborted` between sets for cancellation.
 */
export async function mergeConfigsAsync(
  rawConfigs: Record<string, BuildConfig[]>,
  algorithm: MergeAlgorithm,
  normalizeFlatStats: boolean,
  signal: AbortSignal
): Promise<ArtifactBuildConfigs[]> {
  const results: ArtifactBuildConfigs[] = [];
  const entries = Object.entries(rawConfigs);

  for (const [setId, configs] of entries) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const mergedConfigs = await splitAndMergeAsync(
      configs,
      algorithm,
      normalizeFlatStats,
      signal
    );

    results.push({
      setId,
      configurations: sortConfigurations(mergedConfigs),
    });
  }

  return results;
}

function finalizeMainStatsConversion(config: BuildConfig): BuildConfig {
  const finalizeSlot = (slot: SlotConfig): SlotConfig => ({
    ...slot,
    mainStats: sortMainStats(expandCrCdMainStats(slot.mainStats)),
  });

  return {
    ...config,
    flowerPlume: finalizeSlot(config.flowerPlume),
    sands: finalizeSlot(config.sands),
    goblet: finalizeSlot(config.goblet),
    circlet: finalizeSlot(config.circlet),
  };
}

function expandCrCdMainStats(mainStats: MainStatPlus[]): MainStatPlus[] {
  const result: MainStatPlus[] = [];
  const seen = new Set<string>();

  for (const stat of mainStats) {
    if (stat === "cr/cd") {
      for (const crit of ["cr", "cd"] as MainStat[]) {
        if (!seen.has(crit)) {
          seen.add(crit);
          result.push(crit);
        }
      }
    } else {
      const key = String(stat);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(stat);
      }
    }
  }

  return result;
}

const mainStatIndex: Record<string, number> = mainStatsPlus.reduce(
  (acc, stat, index) => {
    acc[stat] = index;
    return acc;
  },
  {} as Record<string, number>
);

const SPECIAL_MAIN_STAT_ORDER: Record<string, number> = {
  elemental: mainStatsPlus.indexOf("pyro%") - 1,
};

function sortMainStats(mainStats: MainStatPlus[]): MainStatPlus[] {
  return [...mainStats].sort(
    (a, b) => getMainStatOrder(a) - getMainStatOrder(b)
  );
}

function getMainStatOrder(stat: MainStatPlus): number {
  if (stat === "elemental%") {
    return SPECIAL_MAIN_STAT_ORDER.elemental ?? Number.MAX_SAFE_INTEGER;
  }
  return mainStatIndex[stat] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Check if build should be skipped (CR+CD auto-lock)
 * Uses must-present detection to determine if both CR and CD are required
 */
export function hasCrCdMustPresent(config: BuildConfig): boolean {
  return (
    config.flowerPlume.mustPresent.includes("cr") &&
    config.flowerPlume.mustPresent.includes("cd")
  );
}

/**
 * Get relevant artifact sets for a build
 */
function getRelevantArtifactSets(build: Build): string[] {
  if (build.composition === "4pc" && build.artifactSet) {
    return [build.artifactSet];
  }
  if (
    build.composition === "2pc+2pc" &&
    build.halfSet1 !== undefined &&
    build.halfSet2 !== undefined
  ) {
    const halfSet1 = artifactHalfSetsById[build.halfSet1];
    const halfSet2 = artifactHalfSetsById[build.halfSet2];

    if (!halfSet1 || !halfSet2) {
      return [];
    }

    const setsSet = new Set([...halfSet1.setIds, ...halfSet2.setIds]);
    return Array.from(setsSet);
  }

  return [];
}

/**
 * Create a config from a single build
 */
function createConfigFromBuild(
  build: Build,
  characterId: string,
  is4pc: boolean,
  options: ComputeOptions
): BuildConfig {
  const includeThreshold =
    options.substatWeightThreshold ??
    DEFAULT_COMPUTE_OPTIONS.substatWeightThreshold!;
  const mustPresentThreshold =
    options.mustPresentWeightThreshold ??
    DEFAULT_COMPUTE_OPTIONS.mustPresentWeightThreshold!;

  // Filter substats by weight: only include those at or above the inclusion threshold
  const effectiveSubstats = build.substats
    .filter((s) => s.weight >= includeThreshold)
    .map((s) => s.stat);

  // Derive must-present from substat weights at or above the must-present threshold
  const mustPresent = build.substats
    .filter((s) => s.weight >= mustPresentThreshold)
    .map((s) => s.stat);

  // Always derive k from substat count, capped at 3.
  // k=3 is the practical ceiling for reliable artifact locking
  // (4+ substats rarely all appear together).
  const minStatCount = Math.min(effectiveSubstats.length, 3);

  // Preprocess main stats (expand elemental DMG and crit circlet early)
  const sandsMainStats = expandMainStats(
    build.sandsWeights.map((w) => w.stat),
    "sands",
    options,
    is4pc
  );
  const gobletMainStats = expandMainStats(
    build.gobletWeights.map((w) => w.stat),
    "goblet",
    options,
    is4pc
  );
  const circletMainStats = expandMainStats(
    build.circletWeights.map((w) => w.stat),
    "circlet",
    options,
    is4pc
  );

  return {
    flowerPlume: {
      mainStats: [],
      substats: effectiveSubstats,
      mustPresent,
      minStatCount,
    },
    sands: {
      mainStats: sandsMainStats,
      substats: effectiveSubstats,
      mustPresent,
      minStatCount,
    },
    goblet: {
      mainStats: gobletMainStats,
      substats: effectiveSubstats,
      mustPresent,
      minStatCount,
    },
    circlet: {
      mainStats: circletMainStats,
      substats: effectiveSubstats,
      mustPresent,
      minStatCount,
    },
    servedCharacters: [
      {
        characterId,
        hasPerfectMerge: true,
        has4pcBuild: is4pc,
      },
    ],
  };
}

/**
 * Preprocess main stats based on options (expand elemental DMG and crit circlet)
 * This happens early to simplify merging logic
 */
function expandMainStats(
  mainStats: MainStat[],
  slot: MainStatSlot,
  options: ComputeOptions,
  is4pc = false
): MainStatPlus[] {
  const result: MainStatPlus[] = [...mainStats];

  // Expand elemental DMG%
  if (options.expandElementalGoblet && slot === "goblet") {
    const hasAnyElemental = mainStats.some((m) =>
      elementalMainStats.includes(m)
    );
    if (hasAnyElemental) {
      // Replace all elemental types with 'elemental%'
      const nonElemental = result.filter(
        (m) => !elementalMainStats.includes(m as MainStat)
      );
      return ["elemental%", ...nonElemental];
    }
  }

  // Expand CR/CD circlet
  if (options.expandCritCirclet && slot === "circlet" && is4pc) {
    const hasCR = mainStats.includes("cr");
    const hasCD = mainStats.includes("cd");
    if (hasCR || hasCD) {
      // Replace CR and/or CD with 'cr/cd'
      const nonCrit = result.filter((m) => m !== "cr" && m !== "cd");
      return ["cr/cd", ...nonCrit];
    }
  }

  return result;
}

/**
 * Sort configurations by priority.
 * CR+CD configs are ranked last so users see non-crit configs first.
 */
function sortConfigurations(configs: BuildConfig[]): BuildConfig[] {
  return configs.slice().sort((a, b) => {
    // Primary: CR+CD configs go last
    const aCrit = hasCrCdMustPresent(a) ? 1 : 0;
    const bCrit = hasCrCdMustPresent(b) ? 1 : 0;
    if (aCrit !== bCrit) return aCrit - bCrit;

    // Secondary: 4pc count
    const a4pc = a.servedCharacters.filter((c) => c.has4pcBuild).length;
    const b4pc = b.servedCharacters.filter((c) => c.has4pcBuild).length;
    if (b4pc !== a4pc) return b4pc - a4pc;

    // Tertiary: total character count
    return b.servedCharacters.length - a.servedCharacters.length;
  });
}
