/**
 * V2 Build Weight Generation Pipeline
 *
 * Uses the real TeamBuild damage calculator from src/lib/team-comp/ to
 * compute auto-tuned substat weights via marginal damage analysis.
 *
 * Data flow:
 * 1. Load Flagship Teams preset → full 4-member team compositions
 * 2. For each DPS character, construct TeamBuild with real buff resolution
 * 3. Enumerate all main stat combos (sands × goblet × circlet)
 * 4. Pre-filter by baseline damage, then run full greedy allocation
 * 5. Keep combos achieving ≥90% of best damage
 * 6. Average midpoint weights across qualifying combos and team contexts
 * 7. Derive main stat weights from damage ratios
 */

// Ensure all character/weapon/artifact implementations are registered
import "@/lib/team-comp";

import type { MainStat, SubStat } from "@/data/types";
import { getCharacterStatsSync } from "@/lib/gameStatsLoader";
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
  autoTuneWeights,
  averageWeights,
  computeIdealScore,
  evalBaselineDamage,
} from "./autoTune";
import {
  CHARACTER_BUILD_PROFILES,
  type CharacterBuildProfile,
  getFlagshipTeamsForChar,
  teamEntryToConfigs,
} from "./teamDatabase";
import type { AutoTuneResult, BuildV2Weights, MainStatWeight } from "./types";

export type PipelineResult = {
  builds: BuildV2Weights[];
  /** Profiles indexed by characterId — contains team display data */
  profiles: Record<string, CharacterBuildProfile>;
  errors: { characterId: string; error: string }[];
  generatedAt: number;
};

// ─── Main stat candidates per slot ───

const SANDS_CANDIDATES: MainStat[] = ["hp%", "atk%", "def%", "em", "er"];
const CIRCLET_CANDIDATES: MainStat[] = [
  "cr",
  "cd",
  "hp%",
  "atk%",
  "def%",
  "em",
];

function getGobletCandidates(elemDmgKey: string): MainStat[] {
  return [elemDmgKey as MainStat, "hp%", "atk%", "def%", "em", "phys%"];
}

// ─── Main stat values at Lv.20 (5-star), in decimal form ───

const MAIN_STAT_DECIMAL: Record<string, number> = {
  "hp%": 0.466,
  "atk%": 0.466,
  "def%": 0.583,
  em: 186.5,
  er: 0.518,
  cr: 0.311,
  cd: 0.622,
  "pyro%": 0.466,
  "hydro%": 0.466,
  "cryo%": 0.466,
  "electro%": 0.466,
  "anemo%": 0.466,
  "geo%": 0.466,
  "dendro%": 0.466,
  "phys%": 0.583,
};

/** Element → DMG% key mapping */
const ELEMENT_TO_DMG_KEY: Record<string, StatKey> = {
  Pyro: "pyro%",
  Hydro: "hydro%",
  Cryo: "cryo%",
  Electro: "electro%",
  Anemo: "anemo%",
  Geo: "geo%",
  Dendro: "dendro%",
};

/**
 * Build baseline artifact StatSheet containing only main stats (no substats).
 * Flower: +4780 HP, Plume: +311 ATK, Sands/Goblet/Circlet: specified mains.
 */
function buildBaselineArtifactSheet(
  sandsMain: string,
  gobletMain: string,
  circletMain: string
): StatSheet {
  const entries: { key: StatKey; value: number }[] = [
    { key: "hp" as StatKey, value: 4780 },
    { key: "atk" as StatKey, value: 311 },
  ];

  for (const main of [sandsMain, gobletMain, circletMain]) {
    const val = MAIN_STAT_DECIMAL[main];
    if (val !== undefined) {
      entries.push({ key: main as StatKey, value: val });
    }
  }

  return new StatSheet(entries);
}

/**
 * Build the artifact stats map for all team members.
 * DPS gets the specified main stats; teammates get flower+plume only.
 */
function buildTeamArtifactStats(
  configs: CharCompConfig[],
  dpsCharId: string,
  dpsSheet: StatSheet
): Record<string, StatSheet> {
  const stats: Record<string, StatSheet> = {};
  for (const config of configs) {
    if (config.charId === dpsCharId) {
      stats[config.charId] = dpsSheet;
    } else {
      stats[config.charId] = new StatSheet([
        { key: "hp" as StatKey, value: 4780 },
        { key: "atk" as StatKey, value: 311 },
      ]);
    }
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
const QUALIFYING_THRESHOLD = 0.9;

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
  const builds: BuildV2Weights[] = [];
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

/**
 * Generate V2 weights for a single character build profile.
 *
 * For each team context:
 * 1. Enumerate all sands × goblet × circlet main stat combos
 * 2. Quick baseline eval → pre-filter to ≥50% of best baseline damage
 * 3. Full greedy allocation for viable combos
 * 4. Keep combos achieving ≥90% of best post-greedy damage
 * 5. Average midpoint marginals across qualifying combos
 *
 * Then across team contexts:
 * 6. Average substat weights (re-normalize to 100)
 * 7. Main stat weight per slot = best damage with that stat / overall best × 100
 */
export function generateBuildWeights(
  profile: CharacterBuildProfile,
  generatedAt: number = Date.now()
): BuildV2Weights {
  const { characterId } = profile;
  const teamEntries = getFlagshipTeamsForChar(characterId);

  if (teamEntries.length === 0) {
    throw new Error(`No Flagship Team data for ${characterId}`);
  }

  const element = resolveElement(characterId) || profile.element;
  const elemDmgKey = ELEMENT_TO_DMG_KEY[element] ?? ("pyro%" as StatKey);
  const gobletCandidates = getGobletCandidates(elemDmgKey);

  // Collect qualifying combos across all team contexts
  const allQualifying: ComboResult[] = [];
  const teamNames: string[] = [];

  for (const { team } of teamEntries) {
    try {
      const configs = teamEntryToConfigs(team) as CharCompConfig[];
      const teamBuild = new TeamBuild(configs, team.opts ?? {});

      // Find ALL formula IDs for this character
      const formulaIds = findAllFormulaIds(teamBuild, characterId);
      if (formulaIds.length === 0) continue;

      // Reaction override
      const reaction = team.reactions[0];
      const reactionOverride: ReactionOverride | undefined =
        reaction && reaction !== "none"
          ? { reaction: reaction as ReactionOverride["reaction"] }
          : undefined;

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
            const sheet = buildBaselineArtifactSheet(s, g, c);
            const artifactStats = buildTeamArtifactStats(
              configs,
              characterId,
              sheet
            );
            const dmg = evalBaselineDamage(
              teamBuild,
              characterId,
              formulaIds,
              artifactStats,
              DEFAULT_CALC_CTX,
              reactionOverride
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
        const sheet = buildBaselineArtifactSheet(combo.s, combo.g, combo.c);
        const artifactStats = buildTeamArtifactStats(
          configs,
          characterId,
          sheet
        );

        const tuneResult = autoTuneWeights(
          teamBuild,
          characterId,
          formulaIds,
          artifactStats,
          DEFAULT_CALC_CTX,
          reactionOverride
        );

        teamResults.push({ combo, tuneResult });
      }

      // ─── Phase 3: Filter to ≥90% of best post-greedy damage ───
      const bestFinalDmg = Math.max(
        ...teamResults.map((r) => r.tuneResult.finalDamage)
      );

      for (const { combo, tuneResult } of teamResults) {
        const normalizedDamage =
          bestFinalDmg > 0 ? tuneResult.finalDamage / bestFinalDmg : 0;

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

      teamNames.push(team.name || `Team ${team.id.slice(-4)}`);
    } catch {}
  }

  if (allQualifying.length === 0) {
    throw new Error(
      `All team contexts failed for ${characterId}. Check that character/weapon/artifact implementations exist.`
    );
  }

  // ─── Aggregate across qualifying combos ───

  // Substat weights: average midpoint weights, re-normalize to 100
  const avgWeights = averageWeights(allQualifying.map((q) => q.tuneResult));

  // Ideal rolls: average roll allocations
  const idealRolls = {} as Record<SubStat, number>;
  for (const stat of TUNABLE_SUBSTATS) {
    const sum = allQualifying.reduce(
      (acc, q) => acc + (q.tuneResult.rollAllocation[stat] || 0),
      0
    );
    idealRolls[stat] = Math.round((sum / allQualifying.length) * 10) / 10;
  }

  // ─── Main stat weights: best damage achievable with that stat / overall best ───
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

  // Infer scaling stat from which %-stat has highest weight among atk%/hp%/def%
  const scalingStat = inferScalingStatFromWeights(avgWeights);

  // Primary reaction from first team
  const primaryReaction = teamEntries[0]?.team.reactions[0] ?? "none";

  // ─── Compute ideal score and normalizer ───
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
    characterId,
    buildName: `${characterId} V2 Auto`,
    roles: ["dps"],
    styles: ["on-field"],
    scalingStat,
    element,
    artifactSet: profile.defaultArtifactSet,
    substats: avgWeights,
    idealRolls,
    sands: sandsWeights,
    goblet: gobletWeights,
    circlet: circletWeights,
    reaction: primaryReaction,
    idealScore,
    normalizer,
    meta: {
      method: "auto",
      weaponId: profile.weapons[0] ?? "",
      teamContexts: teamNames,
      generatedAt,
    },
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
  candidates: MainStat[],
  qualifying: ComboResult[]
): MainStatWeight[] {
  const bestPerStat: Record<string, number> = {};

  for (const combo of qualifying) {
    const stat = combo[slot];
    const dmg = combo.normalizedDamage;
    if (!bestPerStat[stat] || dmg > bestPerStat[stat]) {
      bestPerStat[stat] = dmg;
    }
  }

  // Sort by best damage descending, express as percentage (0-100)
  return Object.entries(bestPerStat)
    .sort(([, a], [, b]) => b - a)
    .map(([stat, dmg]) => ({
      stat: stat as MainStat,
      weight: Math.round(dmg * 100),
    }));
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
 * Convert a BuildV2Weights to legacy Build format for backward compatibility.
 */
export function v2WeightsToLegacyBuild(v2: BuildV2Weights): {
  substats: { stat: SubStat; weight: number }[];
  sands: MainStat[];
  goblet: MainStat[];
  circlet: MainStat[];
} {
  const substats = Object.entries(v2.substats)
    .filter(([, weight]) => weight > 0)
    .map(([stat, weight]) => ({ stat: stat as SubStat, weight }))
    .sort((a, b) => b.weight - a.weight);

  return {
    substats,
    sands: v2.sands.map((s) => s.stat),
    goblet: v2.goblet.map((s) => s.stat),
    circlet: v2.circlet.map((s) => s.stat),
  };
}

/**
 * Pretty-print a BuildV2Weights for debugging.
 */
export function formatBuildWeights(build: BuildV2Weights): string {
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
    `  Sands:   ${build.sands.map((s) => `${s.stat}(${s.weight}%)`).join(", ")}`
  );
  lines.push(
    `  Goblet:  ${build.goblet.map((s) => `${s.stat}(${s.weight}%)`).join(", ")}`
  );
  lines.push(
    `  Circlet: ${build.circlet.map((s) => `${s.stat}(${s.weight}%)`).join(", ")}`
  );

  lines.push("");
  lines.push(`Ideal Score: ${build.idealScore.toFixed(1)}`);
  lines.push(`Normalizer:  ${build.normalizer.toFixed(4)}`);
  lines.push("Max Score:   300");

  return lines.join("\n");
}
