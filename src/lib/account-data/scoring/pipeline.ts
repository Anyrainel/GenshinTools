/**
 * Build Weight Generation Pipeline
 *
 * Uses the real TeamBuild damage calculator from src/lib/team-comp/ to
 * compute auto-tuned substat weights via marginal damage analysis.
 *
 * Data flow:
 * 1. Load Flagship Teams preset → full 4-member team compositions
 * 2. For each DPS character, construct TeamBuild with real buff resolution
 * 3. Enumerate all main stat combos (sands × goblet × circlet)
 * 4. Pre-filter by baseline damage, then run full greedy allocation
 * 5. Keep combos achieving ≥95% of best damage
 * 6. Average midpoint weights across qualifying combos and team contexts
 * 7. Derive main stat weights from damage ratios
 */

// Ensure all character/weapon/artifact implementations are registered
import "@/lib/team-comp";

import { getGobletPool, statPools } from "@/data/constants";
import type {
  Element,
  MainStat,
  Slot,
  SubStat,
  WeightedMainStat,
  WeightedSubStat,
} from "@/data/types";
import { getCharacterStatsSync } from "@/lib/gameStatsLoader";
import {
  buildSheetFromMainAndSubs,
  emptySubRolls,
  getRollValues,
} from "@/lib/team-comp/constrainedGreedy";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  CharCompConfig,
  ReactionOverride,
  StatKey,
} from "@/lib/team-comp/types";
import {
  DEFAULT_CALC_CTX,
  TUNABLE_SUBSTATS,
  type WeightedFormula,
  autoTuneWeights,
  averageWeights,
  computeIdealScore,
  evalBaselineDamage,
  toWeightedFormulas,
} from "./autoTune";
import {
  CHARACTER_BUILD_PROFILES,
  type CharacterBuildProfile,
  getFlagshipTeamsForChar,
  teamEntryToConfigs,
} from "./teamDatabase";
import type { AutoTuneResult } from "./utils";

/** Pipeline-specific metadata for display (WeightsView). Not part of Build. */
export type PipelineBuildMeta = {
  characterId: string;
  scalingStat: "atk" | "hp" | "def" | "em";
  element: string;
  /** Ideal greedy roll allocation averaged across team contexts */
  idealRolls: Record<SubStat, number>;
  reaction: string;
  artifactSet?: string;
  /** Substat weights as Record (convenient for display iteration) */
  substats: Record<SubStat, number>;
  /** Main stat weights per slot (typed with cdEquiv for display) */
  sandsWeights: WeightedMainStat[];
  gobletWeights: WeightedMainStat[];
  circletWeights: WeightedMainStat[];
  normalizer: number;
  meta: {
    method: "auto" | "manual";
    weaponId: string;
    teamContexts: string[];
    generatedAt: number;
  };
};

export type PipelineResult = {
  builds: PipelineBuildMeta[];
  /** Profiles indexed by characterId — contains team display data */
  profiles: Record<string, CharacterBuildProfile>;
  errors: { characterId: string; error: string }[];
  generatedAt: number;
};

// ─── Main stat candidates per slot (from canonical statPools) ───

const SANDS_CANDIDATES: readonly MainStat[] = statPools.sands;
/** Circlet candidates for DPS optimization (heal% excluded). */
const CIRCLET_CANDIDATES: MainStat[] = statPools.circlet.filter(
  (s) => s !== "heal%"
);

const rv = getRollValues();

/** Build a baseline StatSheet from main stats only (no substats). */
function buildBaselineSheet(
  sands: MainStat,
  goblet: MainStat,
  circlet: MainStat
): StatSheet {
  const mainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands,
    goblet,
    circlet,
  };
  return buildSheetFromMainAndSubs(mainStats, emptySubRolls(), rv);
}

/** Flower + Plume only sheet for teammates (no variable main stats). */
const FLOWER_PLUME_SHEET = new StatSheet([
  { key: "hp" as StatKey, value: 4780 },
  { key: "atk" as StatKey, value: 311 },
]);

/**
 * Build the artifact stats map for all team members.
 * DPS gets the specified sheet; teammates get flower+plume only.
 */
function buildTeamArtifactStats(
  configs: CharCompConfig[],
  dpsCharId: string,
  dpsSheet: StatSheet
): Record<string, StatSheet> {
  const stats: Record<string, StatSheet> = {};
  for (const config of configs) {
    stats[config.charId] =
      config.charId === dpsCharId ? dpsSheet : FLOWER_PLUME_SHEET;
  }
  return stats;
}

/** Resolve the DPS character's element from character_stats.json. */
function resolveElement(charId: string): string {
  const charStats = getCharacterStatsSync();
  if (!charStats) return "";
  return charStats[charId]?.element ?? "";
}

/** Find all damage formula IDs for a character in a TeamBuild. */
function findAllFormulaIds(teamBuild: TeamBuild, charId: string): string[] {
  const formulas = teamBuild.getFormulaIds();
  const charFormulas = formulas[charId];
  if (!charFormulas) return [];
  return Object.keys(charFormulas);
}

/** Pre-filter threshold: combos with baseline damage below this fraction of best are skipped. */
const BASELINE_PREFILTER = 0.5;
/** Qualifying threshold: combos achieving ≥ this fraction of best post-greedy damage are kept. */
const QUALIFYING_THRESHOLD = 0.96;

// ─── Combo result from one main-stat combo + one team context ───

type ComboResult = {
  sands: MainStat;
  goblet: MainStat;
  circlet: MainStat;
  tuneResult: AutoTuneResult;
  /** normalizedDamage = finalDamage / bestFinalDamage within this team context */
  normalizedDamage: number;
};

/**
 * Run the full V2 weight generation pipeline for all profiled characters.
 * Requires game stats to be preloaded via preloadGameStats() or useGameStats().
 */
export function runPipeline(): PipelineResult {
  const builds: PipelineBuildMeta[] = [];
  const errors: { characterId: string; error: string }[] = [];
  const generatedAt = Date.now();

  for (const profile of CHARACTER_BUILD_PROFILES) {
    try {
      const build = generateBuildWeights(profile, generatedAt);
      builds.push(build);
    } catch (err) {
      errors.push({
        characterId: profile.characterId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const profiles: Record<string, CharacterBuildProfile> = {};
  for (const build of builds) {
    const profile = CHARACTER_BUILD_PROFILES.find(
      (p) => p.characterId === build.characterId
    );
    if (profile) profiles[build.characterId] = profile;
  }

  return { builds, profiles, errors, generatedAt };
}

// ─── Shared pipeline types ───

type TeamTuneContext = {
  configs: CharCompConfig[];
  teamBuild: TeamBuild;
  formulas: WeightedFormula[];
  label: string;
};

type AggregatedResult = {
  allQualifying: ComboResult[];
  avgWeights: Record<SubStat, number>;
  idealRolls: Record<SubStat, number>;
  sandsWeights: WeightedMainStat[];
  gobletWeights: WeightedMainStat[];
  circletWeights: WeightedMainStat[];
  idealScore: number;
  normalizer: number;
  teamBreakdowns: TeamBreakdown[];
};

/**
 * Run the shared combo enumeration → filtering → averaging pipeline
 * for a DPS character across one or more team contexts.
 */
function runComboEnumerationPipeline(
  characterId: string,
  gobletCandidates: readonly MainStat[],
  teamContexts: TeamTuneContext[]
): AggregatedResult {
  const allQualifying: ComboResult[] = [];
  const teamBreakdowns: TeamBreakdown[] = [];

  for (let teamIdx = 0; teamIdx < teamContexts.length; teamIdx++) {
    const ctx = teamContexts[teamIdx];
    try {
      if (ctx.formulas.length === 0) continue;

      // ─── Phase 1: Quick baseline eval for all combos ───
      const combos: {
        s: MainStat;
        g: MainStat;
        c: MainStat;
        baselineDmg: number;
      }[] = [];

      for (const s of SANDS_CANDIDATES) {
        for (const g of gobletCandidates) {
          for (const c of CIRCLET_CANDIDATES) {
            const sheet = buildBaselineSheet(s, g, c);
            const artifactStats = buildTeamArtifactStats(
              ctx.configs,
              characterId,
              sheet
            );
            const dmg = evalBaselineDamage(
              ctx.teamBuild,
              characterId,
              ctx.formulas,
              artifactStats,
              DEFAULT_CALC_CTX
            );
            combos.push({ s, g, c, baselineDmg: dmg });
          }
        }
      }

      // Pre-filter: keep combos with baseline ≥ 50% of best baseline
      const baselineBest = Math.max(...combos.map((c) => c.baselineDmg));
      const viable = combos.filter(
        (c) => c.baselineDmg >= baselineBest * BASELINE_PREFILTER
      );

      // ─── Phase 2: Full greedy allocation for viable combos ───
      const teamResults: {
        combo: (typeof viable)[0];
        tuneResult: AutoTuneResult;
      }[] = [];

      for (const combo of viable) {
        const mainStats: Record<Slot, MainStat> = {
          flower: "hp",
          plume: "atk",
          sands: combo.s,
          goblet: combo.g,
          circlet: combo.c,
        };
        // Build teammate artifact stats (DPS sheet will be built by autoTuneWeights from mainStats)
        const dummySheet = buildBaselineSheet(combo.s, combo.g, combo.c);
        const artifactStats = buildTeamArtifactStats(
          ctx.configs,
          characterId,
          dummySheet
        );

        const tuneResult = autoTuneWeights(
          ctx.teamBuild,
          characterId,
          ctx.formulas,
          mainStats,
          artifactStats,
          DEFAULT_CALC_CTX
        );

        teamResults.push({ combo, tuneResult });
      }

      // ─── Phase 3: Filter to ≥95% of best post-greedy damage ───
      const bestFinalDmg = Math.max(
        ...teamResults.map((r) => r.tuneResult.finalDamage)
      );

      // Collect per-team breakdown
      const comboBreakdowns: ComboBreakdown[] = [];
      for (const { combo, tuneResult } of teamResults) {
        const normalizedDamage =
          bestFinalDmg > 0 ? tuneResult.finalDamage / bestFinalDmg : 0;

        comboBreakdowns.push({
          mainStats: { sands: combo.s, goblet: combo.g, circlet: combo.c },
          rollAllocation: { ...tuneResult.rollAllocation },
          damage: tuneResult.finalDamage,
          damageRatio: normalizedDamage,
        });

        if (normalizedDamage >= QUALIFYING_THRESHOLD) {
          allQualifying.push({
            sands: combo.s,
            goblet: combo.g,
            circlet: combo.c,
            tuneResult,
            normalizedDamage,
          });
        }
      }

      // Sort breakdowns by damage descending, keep top combos
      comboBreakdowns.sort((a, b) => b.damage - a.damage);
      teamBreakdowns.push({
        teamIndex: teamIdx,
        label: ctx.label,
        combos: comboBreakdowns, // all combos for debugging/display
        bestDamage: bestFinalDmg,
      });
    } catch {}
  }

  if (allQualifying.length === 0) {
    throw new Error(
      `All team contexts failed for ${characterId}. Check that character/weapon/artifact implementations exist.`
    );
  }

  // ─── Aggregate across qualifying combos ───
  const avgWeights = averageWeights(allQualifying.map((q) => q.tuneResult));

  // Ideal rolls from the best qualifying combo.
  // Tiebreaker: prefer combos with more even cr/cd roll split.
  const sortedQualifying = [...allQualifying].sort((a, b) => {
    const dmgDiff = b.tuneResult.finalDamage - a.tuneResult.finalDamage;
    if (Math.abs(dmgDiff) > 1e-6) return dmgDiff;
    const aCrCdDiff = Math.abs(
      (a.tuneResult.rollAllocation.cr || 0) -
        (a.tuneResult.rollAllocation.cd || 0)
    );
    const bCrCdDiff = Math.abs(
      (b.tuneResult.rollAllocation.cr || 0) -
        (b.tuneResult.rollAllocation.cd || 0)
    );
    return aCrCdDiff - bCrCdDiff;
  });
  const bestCombo = sortedQualifying[0];
  const idealRolls = {} as Record<SubStat, number>;
  for (const stat of TUNABLE_SUBSTATS) {
    idealRolls[stat] =
      Math.round((bestCombo.tuneResult.rollAllocation[stat] || 0) * 10) / 10;
  }

  const sandsWeights = computeMainStatWeightsFromDamage(
    "sands",
    SANDS_CANDIDATES,
    allQualifying
  );
  const gobletWeights = computeMainStatWeightsFromDamage(
    "goblet",
    gobletCandidates,
    allQualifying
  );
  const circletWeights = computeMainStatWeightsFromDamage(
    "circlet",
    CIRCLET_CANDIDATES,
    allQualifying
  );

  const bestSandsWeight = sandsWeights[0]?.weight ?? 100;
  const bestGobletWeight = gobletWeights[0]?.weight ?? 100;
  const bestCircletWeight = circletWeights[0]?.weight ?? 100;

  const { idealScore, normalizer } = computeIdealScore(
    avgWeights,
    bestSandsWeight,
    bestGobletWeight,
    bestCircletWeight
  );

  return {
    allQualifying,
    avgWeights,
    idealRolls,
    sandsWeights,
    gobletWeights,
    circletWeights,
    idealScore,
    normalizer,
    teamBreakdowns,
  };
}

/**
 * Generate V2 weights for a single character build profile.
 *
 * For each team context:
 * 1. Enumerate all sands × goblet × circlet main stat combos
 * 2. Quick baseline eval → pre-filter to ≥50% of best baseline damage
 * 3. Full greedy allocation for viable combos
 * 4. Keep combos achieving ≥95% of best post-greedy damage
 * 5. Average midpoint marginals across qualifying combos
 *
 * Then across team contexts:
 * 6. Average substat weights (re-normalize to 100)
 * 7. Main stat weight per slot = best damage with that stat / overall best × 100
 */
export function generateBuildWeights(
  profile: CharacterBuildProfile,
  generatedAt: number = Date.now()
): PipelineBuildMeta {
  const { characterId } = profile;
  const teamEntries = getFlagshipTeamsForChar(characterId);

  if (teamEntries.length === 0) {
    throw new Error(`No Flagship Team data for ${characterId}`);
  }

  const element = resolveElement(characterId) || profile.element;
  const gobletCandidates = getGobletPool(element as Element);

  // Build team tune contexts
  const teamContexts: TeamTuneContext[] = [];
  const teamNames: string[] = [];

  for (const { team } of teamEntries) {
    try {
      const configs = teamEntryToConfigs(team) as CharCompConfig[];
      const teamBuild = new TeamBuild(configs, team.opts ?? {});
      const formulaIds = findAllFormulaIds(teamBuild, characterId);
      if (formulaIds.length === 0) continue;

      const reaction = team.reactions[0];
      const reactionOverride: ReactionOverride | undefined =
        reaction && reaction !== "none"
          ? { reaction: reaction as ReactionOverride["reaction"] }
          : undefined;

      const label = team.name || `Team ${team.id.slice(-4)}`;
      teamContexts.push({
        configs,
        teamBuild,
        formulas: toWeightedFormulas(formulaIds, reactionOverride),
        label,
      });
      teamNames.push(label);
    } catch {}
  }

  const result = runComboEnumerationPipeline(
    characterId,
    gobletCandidates,
    teamContexts
  );

  const scalingStat = inferScalingStatFromWeights(result.avgWeights);
  const primaryReaction = teamEntries[0]?.team.reactions[0] ?? "none";

  return {
    characterId,
    scalingStat,
    element,
    artifactSet: profile.defaultArtifactSet,
    substats: result.avgWeights,
    idealRolls: result.idealRolls,
    sandsWeights: result.sandsWeights,
    gobletWeights: result.gobletWeights,
    circletWeights: result.circletWeights,
    reaction: primaryReaction,
    normalizer: result.normalizer,
    meta: {
      method: "auto",
      weaponId: profile.weapons[0] ?? "",
      teamContexts: teamNames,
      generatedAt,
    },
  };
}

// ─── Auto-Tune Library Function ───

export type AutoTuneInput = {
  /** The character to optimize */
  characterId: string;
  /** Team setups — each is a full 4-member CharCompConfig[] with variable C/R */
  teamSetups: CharCompConfig[][];
  /** Team build options per team (for buff resolution) */
  teamOpts?: Record<string, unknown>[];
  /** Weighted formulas (formulaId + count + per-formula reaction). If omitted, uses all formulas with count=1. */
  formulas?: WeightedFormula[];
  /** Team labels for display */
  teamLabels?: string[];
  /** Element for goblet candidates */
  element: string;
};

export type ComboBreakdown = {
  mainStats: { sands: MainStat; goblet: MainStat; circlet: MainStat };
  rollAllocation: Record<SubStat, number>;
  damage: number;
  damageRatio: number;
};

export type TeamBreakdown = {
  teamIndex: number;
  label: string;
  combos: ComboBreakdown[];
  bestDamage: number;
};

export type AutoTuneOutput = {
  substats: WeightedSubStat[];
  sandsWeights: WeightedMainStat[];
  gobletWeights: WeightedMainStat[];
  circletWeights: WeightedMainStat[];
  normalizer: number;
  idealRolls: Record<SubStat, number>;
  teamBreakdowns: TeamBreakdown[];
};

/**
 * Input for a single-team auto-tune worker task.
 * Contains everything needed to compute one team's results independently.
 */
export type AutoTuneTeamInput = {
  characterId: string;
  configs: CharCompConfig[];
  opts: Record<string, string>;
  formulas?: WeightedFormula[];
  label: string;
  teamIndex: number;
  element: string;
};

/**
 * Result from a single-team auto-tune computation.
 * Multiple of these are aggregated into the final AutoTuneOutput.
 */
export type AutoTuneTeamResult = {
  qualifying: ComboResult[];
  teamBreakdown: TeamBreakdown;
};

/**
 * Compute auto-tune results for a single team context.
 * This is the parallelizable unit of work — each team is independent.
 */
export function autoTuneTeam(input: AutoTuneTeamInput): AutoTuneTeamResult {
  const { characterId, configs, opts, element, label, teamIndex } = input;

  const gobletCandidates = getGobletPool(element as Element);
  const teamBuild = new TeamBuild(configs, opts);

  let formulas: WeightedFormula[];
  if (input.formulas && input.formulas.length > 0) {
    formulas = input.formulas;
  } else {
    formulas = toWeightedFormulas(findAllFormulaIds(teamBuild, characterId));
  }
  if (formulas.length === 0) {
    throw new Error(`No formulas found for ${characterId} in team "${label}"`);
  }

  // Phase 1: Quick baseline eval for all combos
  const combos: {
    s: MainStat;
    g: MainStat;
    c: MainStat;
    baselineDmg: number;
  }[] = [];

  for (const s of SANDS_CANDIDATES) {
    for (const g of gobletCandidates) {
      for (const c of CIRCLET_CANDIDATES) {
        const sheet = buildBaselineSheet(s, g, c);
        const artifactStats = buildTeamArtifactStats(
          configs,
          characterId,
          sheet
        );
        const dmg = evalBaselineDamage(
          teamBuild,
          characterId,
          formulas,
          artifactStats,
          DEFAULT_CALC_CTX
        );
        combos.push({ s, g, c, baselineDmg: dmg });
      }
    }
  }

  // Pre-filter: keep combos with baseline ≥ 50% of best baseline
  const baselineBest = Math.max(...combos.map((c) => c.baselineDmg));
  const viable = combos.filter(
    (c) => c.baselineDmg >= baselineBest * BASELINE_PREFILTER
  );

  // Phase 2: Full greedy allocation for viable combos
  const teamResults: {
    combo: (typeof viable)[0];
    tuneResult: AutoTuneResult;
  }[] = [];

  for (const combo of viable) {
    const mainStats: Record<Slot, MainStat> = {
      flower: "hp",
      plume: "atk",
      sands: combo.s,
      goblet: combo.g,
      circlet: combo.c,
    };
    const dummySheet = buildBaselineSheet(combo.s, combo.g, combo.c);
    const artifactStats = buildTeamArtifactStats(
      configs,
      characterId,
      dummySheet
    );
    const tuneResult = autoTuneWeights(
      teamBuild,
      characterId,
      formulas,
      mainStats,
      artifactStats,
      DEFAULT_CALC_CTX
    );
    teamResults.push({ combo, tuneResult });
  }

  // Phase 3: Filter to ≥95% of best post-greedy damage
  const bestFinalDmg = Math.max(
    ...teamResults.map((r) => r.tuneResult.finalDamage)
  );

  const comboBreakdowns: ComboBreakdown[] = [];
  const qualifying: ComboResult[] = [];

  for (const { combo, tuneResult } of teamResults) {
    const normalizedDamage =
      bestFinalDmg > 0 ? tuneResult.finalDamage / bestFinalDmg : 0;
    comboBreakdowns.push({
      mainStats: { sands: combo.s, goblet: combo.g, circlet: combo.c },
      rollAllocation: { ...tuneResult.rollAllocation },
      damage: tuneResult.finalDamage,
      damageRatio: normalizedDamage,
    });
    if (normalizedDamage >= QUALIFYING_THRESHOLD) {
      qualifying.push({
        sands: combo.s,
        goblet: combo.g,
        circlet: combo.c,
        tuneResult,
        normalizedDamage,
      });
    }
  }

  comboBreakdowns.sort((a, b) => b.damage - a.damage);

  return {
    qualifying,
    teamBreakdown: {
      teamIndex,
      label,
      combos: comboBreakdowns,
      bestDamage: bestFinalDmg,
    },
  };
}

/**
 * Aggregate results from multiple single-team auto-tune computations
 * into the final AutoTuneOutput.
 */
export function aggregateTeamResults(
  teamResults: AutoTuneTeamResult[],
  characterId: string,
  element: string
): AutoTuneOutput {
  const gobletCandidates = getGobletPool(element as Element);
  const allQualifying: ComboResult[] = [];
  const teamBreakdowns: TeamBreakdown[] = [];

  for (const result of teamResults) {
    allQualifying.push(...result.qualifying);
    teamBreakdowns.push(result.teamBreakdown);
  }

  if (allQualifying.length === 0) {
    throw new Error(
      `All team contexts failed for ${characterId}. Check that character/weapon/artifact implementations exist.`
    );
  }

  const avgWeights = averageWeights(allQualifying.map((q) => q.tuneResult));

  const sortedQualifying = [...allQualifying].sort((a, b) => {
    const dmgDiff = b.tuneResult.finalDamage - a.tuneResult.finalDamage;
    if (Math.abs(dmgDiff) > 1e-6) return dmgDiff;
    const aCrCdDiff = Math.abs(
      (a.tuneResult.rollAllocation.cr || 0) -
        (a.tuneResult.rollAllocation.cd || 0)
    );
    const bCrCdDiff = Math.abs(
      (b.tuneResult.rollAllocation.cr || 0) -
        (b.tuneResult.rollAllocation.cd || 0)
    );
    return aCrCdDiff - bCrCdDiff;
  });
  const bestCombo = sortedQualifying[0];
  const idealRolls = {} as Record<SubStat, number>;
  for (const stat of TUNABLE_SUBSTATS) {
    idealRolls[stat] =
      Math.round((bestCombo.tuneResult.rollAllocation[stat] || 0) * 10) / 10;
  }

  const sandsWeights = computeMainStatWeightsFromDamage(
    "sands",
    SANDS_CANDIDATES,
    allQualifying
  );
  const gobletWeights = computeMainStatWeightsFromDamage(
    "goblet",
    gobletCandidates,
    allQualifying
  );
  const circletWeights = computeMainStatWeightsFromDamage(
    "circlet",
    CIRCLET_CANDIDATES,
    allQualifying
  );

  const bestSandsWeight = sandsWeights[0]?.weight ?? 100;
  const bestGobletWeight = gobletWeights[0]?.weight ?? 100;
  const bestCircletWeight = circletWeights[0]?.weight ?? 100;

  const { normalizer } = computeIdealScore(
    avgWeights,
    bestSandsWeight,
    bestGobletWeight,
    bestCircletWeight
  );

  // Normalize weights
  const weights = { ...avgWeights };
  const maxNonCr = Math.max(
    ...Object.entries(weights)
      .filter(([stat]) => stat !== "cr")
      .map(([, w]) => w)
  );
  if (maxNonCr > 0 && maxNonCr !== 100) {
    const scale = 100 / maxNonCr;
    for (const stat of Object.keys(weights) as SubStat[]) {
      weights[stat] = Math.round(weights[stat] * scale);
    }
  }
  if (weights.cr > 100) weights.cr = 100;

  const substats = Object.entries(weights)
    .filter(([, weight]) => weight > 20)
    .map(([stat, weight]) => ({ stat: stat as SubStat, weight }))
    .sort((a, b) => b.weight - a.weight);

  return {
    substats,
    sandsWeights,
    gobletWeights,
    circletWeights,
    normalizer,
    idealRolls,
    teamBreakdowns,
  };
}

/**
 * Compute auto-tuned weights for a single build given explicit inputs.
 *
 * Unlike `generateBuildWeights` which reads from the preset database,
 * this function accepts team configs directly — constellation/refinement
 * come from the CharCompConfig, enabling variable C/R.
 */
export function autoTuneBuild(input: AutoTuneInput): AutoTuneOutput {
  const { characterId, teamSetups, element } = input;

  const gobletCandidates = getGobletPool(element as Element);

  // Build team tune contexts from explicit configs
  const teamContexts: TeamTuneContext[] = [];

  for (let i = 0; i < teamSetups.length; i++) {
    const configs = teamSetups[i];
    const opts = (input.teamOpts?.[i] ?? {}) as Record<string, string>;
    const teamBuild = new TeamBuild(configs, opts);

    // Resolve formulas with counts and per-formula reactions
    let formulas: WeightedFormula[];
    if (input.formulas && input.formulas.length > 0) {
      formulas = input.formulas;
    } else {
      formulas = toWeightedFormulas(findAllFormulaIds(teamBuild, characterId));
    }
    if (formulas.length === 0) continue;

    const label = input.teamLabels?.[i] ?? `Team ${i + 1}`;
    teamContexts.push({
      configs,
      teamBuild,
      formulas,
      label,
    });
  }

  if (teamContexts.length === 0) {
    throw new Error(
      `No valid team contexts for ${characterId}. Check configs and formula IDs.`
    );
  }

  const result = runComboEnumerationPipeline(
    characterId,
    gobletCandidates,
    teamContexts
  );

  // Convert to production Build-compatible format
  // Normalize: highest non-cr stat → 100, clamp cr to 100
  const weights = { ...result.avgWeights };
  const maxNonCr = Math.max(
    ...Object.entries(weights)
      .filter(([stat]) => stat !== "cr")
      .map(([, w]) => w)
  );
  if (maxNonCr > 0 && maxNonCr !== 100) {
    const scale = 100 / maxNonCr;
    for (const stat of Object.keys(weights) as SubStat[]) {
      weights[stat] = Math.round(weights[stat] * scale);
    }
  }
  if (weights.cr > 100) weights.cr = 100;

  const substats = Object.entries(weights)
    .filter(([, weight]) => weight > 20)
    .map(([stat, weight]) => ({ stat: stat as SubStat, weight }))
    .sort((a, b) => b.weight - a.weight);

  return {
    substats,
    sandsWeights: result.sandsWeights,
    gobletWeights: result.gobletWeights,
    circletWeights: result.circletWeights,
    normalizer: result.normalizer,
    idealRolls: result.idealRolls,
    teamBreakdowns: result.teamBreakdowns,
  };
}

/**
 * Compute main stat weights for a slot based on damage ratios.
 * For each candidate, find the best normalized damage across all qualifying combos
 * that use that candidate. Express as percentage of overall best (0-100).
 * Only include candidates that appear in qualifying combos.
 */
function computeMainStatWeightsFromDamage(
  slot: "sands" | "goblet" | "circlet",
  candidates: readonly MainStat[],
  qualifying: ComboResult[]
): WeightedMainStat[] {
  // For each candidate stat, find the best combo (by damage, then cr/cd split)
  const bestPerStat: Record<string, { dmg: number; crCdDiff: number }> = {};

  for (const combo of qualifying) {
    const stat = combo[slot];
    const dmg = combo.normalizedDamage;
    const crCdDiff = Math.abs(
      (combo.tuneResult.rollAllocation.cr || 0) -
        (combo.tuneResult.rollAllocation.cd || 0)
    );
    const prev = bestPerStat[stat];
    if (
      !prev ||
      dmg > prev.dmg + 1e-6 ||
      (Math.abs(dmg - prev.dmg) <= 1e-6 && crCdDiff < prev.crCdDiff)
    ) {
      bestPerStat[stat] = { dmg, crCdDiff };
    }
  }

  // Find the best cr/cd split across all candidates
  const bestCrCdDiff = Math.min(
    ...Object.values(bestPerStat).map((v) => v.crCdDiff)
  );

  // Sort by damage desc, then by cr/cd split asc (even split preferred).
  // This means among damage-tied stats, the one with better cr/cd split ranks first.
  const sorted = Object.entries(bestPerStat).sort(([, a], [, b]) => {
    const dmgDiff = b.dmg - a.dmg;
    if (Math.abs(dmgDiff) > 1e-6) return dmgDiff;
    return a.crCdDiff - b.crCdDiff;
  });

  // Enlarge differences by 5x to counteract substat compensation compressing
  // the ratios. Formula: (5 × ratio - 4) × 100
  // Maps: 1.0→100, 0.99→95, 0.97→85, 0.95→75
  // Among damage-tied candidates, penalize those with worse cr/cd split by 2pts.
  return sorted.map(([stat, { dmg, crCdDiff }], i) => {
    let weight = Math.max(0, Math.round((5 * dmg - 4) * 100));
    // Penalize damage-tied candidates (within 1%) that have a worse cr/cd split
    // than the best-split candidate at their damage tier
    if (i > 0) {
      const prev = sorted[i - 1][1];
      if (Math.abs(dmg - prev.dmg) < 0.01 && crCdDiff > prev.crCdDiff + 0.5) {
        weight = Math.max(0, weight - 2);
      }
    }
    return { stat: stat as MainStat, weight };
  });
}

/** Infer scaling stat from substat weight distribution. */
function inferScalingStatFromWeights(
  weights: Record<SubStat, number>
): "atk" | "hp" | "def" | "em" {
  const atkW = weights["atk%"] ?? 0;
  const hpW = weights["hp%"] ?? 0;
  const defW = weights["def%"] ?? 0;
  const emW = weights.em ?? 0;

  if (hpW > atkW && hpW > defW && hpW > emW) return "hp";
  if (defW > atkW && defW > hpW && defW > emW) return "def";
  if (emW > atkW && emW > hpW && emW > defW) return "em";
  return "atk";
}

/**
 * Pretty-print a PipelineBuildMeta for debugging.
 */
export function formatPipelineBuild(build: PipelineBuildMeta): string {
  const lines: string[] = [];
  lines.push(
    `═══ ${build.characterId} (${build.element} ${build.scalingStat}) ═══`
  );
  lines.push(`Artifact: ${build.artifactSet ?? "any"}`);
  lines.push(`Reaction: ${build.reaction}`);
  lines.push(`Weapon: ${build.meta.weaponId}`);
  lines.push(`Teams: ${build.meta.teamContexts.join(", ")}`);
  lines.push("");

  lines.push("Substat Weights:");
  const sorted = Object.entries(build.substats)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a);
  for (const [stat, weight] of sorted) {
    lines.push(`  ${stat.padEnd(6)} ${weight}`);
  }

  lines.push("");
  lines.push("Ideal Rolls:");
  const rollsSorted = Object.entries(build.idealRolls)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  for (const [stat, rolls] of rollsSorted) {
    lines.push(`  ${stat.padEnd(6)} ${rolls}`);
  }

  lines.push("");
  lines.push("Main Stats:");
  lines.push(
    `  Sands:   ${build.sandsWeights.map((s) => `${s.stat}(${s.weight}%)`).join(", ")}`
  );
  lines.push(
    `  Goblet:  ${build.gobletWeights.map((s) => `${s.stat}(${s.weight}%)`).join(", ")}`
  );
  lines.push(
    `  Circlet: ${build.circletWeights.map((s) => `${s.stat}(${s.weight}%)`).join(", ")}`
  );

  lines.push("");
  lines.push(`Normalizer:  ${build.normalizer.toFixed(4)}`);
  lines.push("Max Score:   300");

  return lines.join("\n");
}
