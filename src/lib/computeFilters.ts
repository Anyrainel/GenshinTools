/**
 * Artifact Filter Computation with Must-Present Substats
 * Based on V3 algorithm with coverage theorem and merge rules
 */

import {
  Build,
  SetConfig,
  ArtifactSetConfigs,
  MainStat,
  MainStatPlus,
  MainStatSlot,
  SubStat,
  BuildGroup,
  SlotConfig,
  mainStatsPlus,
  ComputeOptions,
} from "../data/types";
import { artifactHalfSetsById, elementalMainStats } from "../data/constants";
import { simpleMerge } from "./simpleMerge";

export const DEFAULT_COMPUTE_OPTIONS: ComputeOptions = {
  skipCritBuilds: false,
  expandElementalGoblet: true,
  expandCritCirclet: true,
  mergeSingleFlexVariants: true,
  findRigidCommonSubset: true,
};

/**
 * Main entry point: Compute artifact filters from character builds
 *
 * Process:
 * 1. Add phase: Create individual configs from each build
 * 2. Merge phase: Merge configs using Coverage Theorem rules
 */
export function computeArtifactFilters(
  buildGroups: BuildGroup[],
  options: ComputeOptions = DEFAULT_COMPUTE_OPTIONS,
): ArtifactSetConfigs[] {
  const mergedOptions = { ...DEFAULT_COMPUTE_OPTIONS, ...options };
  const setFilters: Record<string, SetConfig[]> = {};

  // PHASE 1: ADD - Create configs from all builds
  buildGroups.forEach(({ characterId, builds }) => {
    builds
      .filter((build) => build.visible)
      .forEach((build) => {
        const relevantSets = getRelevantArtifactSets(build);
        const is4pc = build.composition === "4pc";

        relevantSets.forEach((setId) => {
          if (!setFilters[setId]) {
            setFilters[setId] = [];
          }

          const config = createConfigFromBuild(
            build,
            characterId,
            is4pc,
            mergedOptions,
          );

          // Skip CR+CD builds if option enabled
          if (mergedOptions.skipCritBuilds && hasCrCdMustPresent(config)) {
            return;
          }
          setFilters[setId].push(config);
        });
      });
  });

  // PHASE 2: MERGE - Merge configs using Coverage Theorem rules
  for (const setId in setFilters) {
    const mergedConfigs = simpleMerge(setFilters[setId], {
      mergeSingleFlexVariants: mergedOptions.mergeSingleFlexVariants,
      findRigidCommonSubset: mergedOptions.findRigidCommonSubset,
    });
    setFilters[setId] = mergedConfigs.map(finalizeMainStatsConversion);
  }

  // Convert to output format
  return Object.entries(setFilters).map(([setId, configurations]) => {
    return {
      setId,
      configurations: sortConfigurations(configurations),
    };
  });
}

function finalizeMainStatsConversion(config: SetConfig): SetConfig {
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
  {} as Record<string, number>,
);

const SPECIAL_MAIN_STAT_ORDER: Record<string, number> = {
  elemental: mainStatsPlus.indexOf("pyro%") - 1,
};

function sortMainStats(mainStats: MainStatPlus[]): MainStatPlus[] {
  return [...mainStats].sort(
    (a, b) => getMainStatOrder(a) - getMainStatOrder(b),
  );
}

function getMainStatOrder(stat: MainStatPlus): number {
  if (typeof stat === "string" && stat.endsWith("%") && stat !== "elemental%") {
    return mainStatIndex[stat] ?? Number.MAX_SAFE_INTEGER;
  }

  if (stat === "elemental%") {
    return SPECIAL_MAIN_STAT_ORDER.elemental ?? Number.MAX_SAFE_INTEGER;
  }

  return mainStatIndex[String(stat)] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Detect must-present substats using conservative heuristics
 *
 * Only detect patterns that are very likely to be must-present:
 * 1. CR+CD: Critical rate + critical damage (DPS builds)
 * 2. ER+ATK%: Energy recharge + attack% (burst DPS) - only if k=2
 * 3. ER+HP%: Energy recharge + HP% (support/healer) - only if k=2
 * 4. ER+DEF%: Energy recharge + DEF% (DEF-scaling support) - only if k=2
 */
function detectMustPresent(
  substats: SubStat[],
  minStatCount: number,
): SubStat[] {
  if (substats.length < 2) return [];

  // Pattern 1: CR+CD (DPS builds) - most reliable pattern
  if (substats.includes("cr") && substats.includes("cd")) {
    return ["cr", "cd"];
  }

  // Pattern 2: all substats are required by the count
  if (substats.length === minStatCount) {
    return substats;
  }

  return [];
}

/**
 * Check if build should be skipped (CR+CD auto-lock)
 * Uses must-present detection to determine if both CR and CD are required
 */
function hasCrCdMustPresent(config: SetConfig): boolean {
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
  } else if (
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
  options: ComputeOptions,
): SetConfig {
  const minStatCount = build.kOverride ?? build.substats.length;

  // Detect must-present (CR+CD heuristic only)
  const mustPresent = detectMustPresent(build.substats, minStatCount);

  // Preprocess main stats (expand elemental DMG and crit circlet early)
  const sandsMainStats = expandMainStats(build.sands, "sands", options, is4pc);
  const gobletMainStats = expandMainStats(
    build.goblet,
    "goblet",
    options,
    is4pc,
  );
  const circletMainStats = expandMainStats(
    build.circlet,
    "circlet",
    options,
    is4pc,
  );

  return {
    flowerPlume: {
      mainStats: [],
      substats: build.substats,
      mustPresent,
      minStatCount,
    },
    sands: {
      mainStats: sandsMainStats,
      substats: build.substats,
      mustPresent,
      minStatCount,
    },
    goblet: {
      mainStats: gobletMainStats,
      substats: build.substats,
      mustPresent,
      minStatCount,
    },
    circlet: {
      mainStats: circletMainStats,
      substats: build.substats,
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
  is4pc: boolean = false,
): MainStatPlus[] {
  const result: MainStatPlus[] = [...mainStats];

  // Expand elemental DMG%
  if (options.expandElementalGoblet && slot === "goblet") {
    const hasAnyElemental = mainStats.some((m) =>
      elementalMainStats.includes(m),
    );
    if (hasAnyElemental) {
      // Replace all elemental types with 'elemental%'
      const nonElemental = result.filter(
        (m) => !elementalMainStats.includes(m as MainStat),
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
 * Sort configurations by priority
 */
function sortConfigurations(configs: SetConfig[]): SetConfig[] {
  return configs.slice().sort((a, b) => {
    // Primary: 4pc count
    const a4pc = a.servedCharacters.filter((c) => c.has4pcBuild).length;
    const b4pc = b.servedCharacters.filter((c) => c.has4pcBuild).length;
    if (b4pc !== a4pc) return b4pc - a4pc;

    // Secondary: total character count
    return b.servedCharacters.length - a.servedCharacters.length;
  });
}
