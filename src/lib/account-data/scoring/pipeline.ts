/**
 * Auto-Tune Pipeline
 *
 * Uses the real TeamBuild damage calculator from src/lib/team-comp/ to
 * compute auto-tuned substat weights via marginal damage analysis.
 *
 * Data flow:
 * 1. For each DPS character, construct TeamBuild with real buff resolution
 * 2. Enumerate all main stat combos (sands × goblet × circlet)
 * 3. Pre-filter by baseline damage, then run full greedy allocation
 * 4. Keep combos achieving ≥95% of best damage
 * 5. Average midpoint weights across qualifying combos and team contexts
 * 6. Derive main stat weights from damage ratios
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
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { MULTI_ELEMENT_CHARS } from "@/lib/team-comp/constants";
import {
  buildSheetFromMainAndSubs,
  emptySubRolls,
  getRollValues,
} from "@/lib/team-comp/generator/constrainedGreedy";
import type { I18nLabel, StatKey, TeamSlotConfig } from "@/lib/team-comp/types";
import {
  DEFAULT_CALC_CTX,
  TUNABLE_SUBSTATS,
  type WeightedFormula,
  autoTuneWeights,
  averageWeights,
  compileAutoTuneEval,
  computeIdealScore,
  toWeightedFormulas,
} from "./autoTune";
import type { AutoTuneResult } from "./utils";

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
  configs: TeamSlotConfig[],
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

// ─── Shared pipeline types ───

type TeamTuneContext = {
  configs: TeamSlotConfig[];
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

      // Compile once per team context
      const compileBaseStats = buildTeamArtifactStats(
        ctx.configs,
        characterId,
        new StatSheet([])
      );
      const evalDamageFn = compileAutoTuneEval(
        ctx.teamBuild,
        characterId,
        ctx.formulas,
        compileBaseStats,
        DEFAULT_CALC_CTX
      );

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
            const dmg = evalDamageFn(artifactStats);
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
        const dummySheet = buildBaselineSheet(combo.s, combo.g, combo.c);
        const artifactStats = buildTeamArtifactStats(
          ctx.configs,
          characterId,
          dummySheet
        );
        const tuneResult = autoTuneWeights(
          characterId,
          mainStats,
          artifactStats,
          evalDamageFn
        );

        teamResults.push({ combo, tuneResult });
      }

      // ─── Phase 3: Filter to ≥95% of best post-greedy damage ───
      // Baseline = best damage among balanced (non-lopsided) combos.
      // Lopsided combos are capped at 100% so they never define the baseline.
      const balancedDmgs = teamResults
        .filter((r) => !isLopsidedAllocation(r.tuneResult.rollAllocation))
        .map((r) => r.tuneResult.finalDamage);
      const bestBalancedDmg =
        balancedDmgs.length > 0 ? Math.max(...balancedDmgs) : null;
      const bestFinalDmg =
        bestBalancedDmg ??
        Math.max(...teamResults.map((r) => r.tuneResult.finalDamage));

      // Collect per-team breakdown
      const comboBreakdowns: ComboBreakdown[] = [];
      for (const { combo, tuneResult } of teamResults) {
        const comboLopsided =
          bestBalancedDmg !== null &&
          isLopsidedAllocation(tuneResult.rollAllocation);
        // Clamp to 1.0: lopsided combos whose raw damage exceeds the best
        // balanced damage are capped at 100% rather than being penalized.
        const normalizedDamage =
          bestFinalDmg > 0
            ? Math.min(tuneResult.finalDamage / bestFinalDmg, 1.0)
            : 0;

        comboBreakdowns.push({
          mainStats: { sands: combo.s, goblet: combo.g, circlet: combo.c },
          rollAllocation: { ...tuneResult.rollAllocation },
          damage: tuneResult.finalDamage,
          damageRatio: normalizedDamage,
          ...(comboLopsided && { lopsided: true }),
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
      const charFormulaLabels =
        ctx.teamBuild.getFormulaIds()[characterId] ?? {};
      teamBreakdowns.push({
        teamIndex: teamIdx,
        label: ctx.label,
        combos: comboBreakdowns, // all combos for debugging/display
        bestDamage: bestFinalDmg,
        formulas: ctx.formulas.map((f) => ({
          formulaId: f.formulaId,
          count: f.count,
          label: charFormulaLabels[f.formulaId],
        })),
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

// ─── Auto-Tune Library Function ───

export type ComboBreakdown = {
  mainStats: { sands: MainStat; goblet: MainStat; circlet: MainStat };
  rollAllocation: Record<SubStat, number>;
  damage: number;
  /** Normalized damage ratio (0-1); lopsided combos are clamped to 1.0. */
  damageRatio: number;
  /** True if this combo has lopsided allocation (max-2nd >= 15) and was clamped. */
  lopsided?: boolean;
};

export type TeamBreakdown = {
  teamIndex: number;
  label: string;
  combos: ComboBreakdown[];
  bestDamage: number;
  /** Formula IDs, counts, and labels used for this team context (for display). */
  formulas?: { formulaId: string; count: number; label?: I18nLabel }[];
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
  configs: TeamSlotConfig[];
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

  // Multi-element characters (Varka, Chasca) deal damage in converted elements
  // (e.g. Pyro from teammates), so the full goblet pool is needed to evaluate
  // all relevant elemental DMG% options — not just the character's own element.
  const gobletCandidates = MULTI_ELEMENT_CHARS.has(characterId)
    ? statPools.goblet
    : getGobletPool(element as Element);
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

  // Compile once — reused across all main stat combos in Phase 1 + Phase 2.
  // Teammates get flower+plume sheet; DPS sheet doesn't matter (variable).
  const compileBaseStats = buildTeamArtifactStats(
    configs,
    characterId,
    new StatSheet([])
  );
  const evalDamageFn = compileAutoTuneEval(
    teamBuild,
    characterId,
    formulas,
    compileBaseStats,
    DEFAULT_CALC_CTX
  );

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
        const dmg = evalDamageFn(artifactStats);
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
      characterId,
      mainStats,
      artifactStats,
      evalDamageFn
    );
    teamResults.push({ combo, tuneResult });
  }

  // Phase 3: Filter to ≥95% of best post-greedy damage
  // Baseline = best damage among balanced (non-lopsided) combos, capped at 100%.
  const balancedDmgs = teamResults
    .filter((r) => !isLopsidedAllocation(r.tuneResult.rollAllocation))
    .map((r) => r.tuneResult.finalDamage);
  const bestBalancedDmg =
    balancedDmgs.length > 0 ? Math.max(...balancedDmgs) : null;
  const bestFinalDmg =
    bestBalancedDmg ??
    Math.max(...teamResults.map((r) => r.tuneResult.finalDamage));

  const comboBreakdowns: ComboBreakdown[] = [];
  const qualifying: ComboResult[] = [];

  for (const { combo, tuneResult } of teamResults) {
    const comboLopsided =
      bestBalancedDmg !== null &&
      isLopsidedAllocation(tuneResult.rollAllocation);
    // Clamp to 1.0: lopsided combos whose raw damage exceeds the best
    // balanced damage are capped at 100% rather than being penalized.
    const normalizedDamage =
      bestFinalDmg > 0
        ? Math.min(tuneResult.finalDamage / bestFinalDmg, 1.0)
        : 0;
    comboBreakdowns.push({
      mainStats: { sands: combo.s, goblet: combo.g, circlet: combo.c },
      rollAllocation: { ...tuneResult.rollAllocation },
      damage: tuneResult.finalDamage,
      damageRatio: normalizedDamage,
      ...(comboLopsided && { lopsided: true }),
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

  const charFormulaLabels = teamBuild.getFormulaIds()[characterId] ?? {};
  return {
    qualifying,
    teamBreakdown: {
      teamIndex,
      label,
      combos: comboBreakdowns,
      bestDamage: bestFinalDmg,
      formulas: formulas.map((f) => ({
        formulaId: f.formulaId,
        count: f.count,
        label: charFormulaLabels[f.formulaId],
      })),
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
  const gobletCandidates = MULTI_ELEMENT_CHARS.has(characterId)
    ? statPools.goblet
    : getGobletPool(element as Element);
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
 * Check if an allocation is lopsided: max roll count - second max >= threshold.
 */
function isLopsidedAllocation(
  allocation: Record<string, number>,
  threshold = 15
): boolean {
  const rolls = Object.values(allocation)
    .filter((v) => v > 0)
    .sort((a, b) => b - a);
  if (rolls.length < 2) return false;
  return rolls[0] - rolls[1] >= threshold;
}

/**
 * Compute main stat weights for a slot based on damage ratios.
 * For each candidate, find the best normalized damage across all qualifying combos
 * that use that candidate. Express as percentage of overall best (0-100).
 * Only include candidates that appear in qualifying combos.
 *
 * Combos with lopsided allocation (max - 2nd-max >= 15 rolls) are excluded from
 * the 100% baseline. The best balanced combo's damage becomes 100%.
 * All ratios are capped at 1.0 (no combo exceeds 100%).
 * Results are sorted by weight descending.
 */
function computeMainStatWeightsFromDamage(
  slot: "sands" | "goblet" | "circlet",
  candidates: readonly MainStat[],
  qualifying: ComboResult[]
): WeightedMainStat[] {
  // For each candidate stat, find the best combo (by damage, then cr/cd split).
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

  // normalizedDamage already has: balanced baseline and cap at 1.0 baked in.
  // Just apply 5x-4 directly.
  const entries = Object.entries(bestPerStat).map(
    ([stat, { dmg, crCdDiff }]) => {
      const weight = Math.max(0, Math.round((5 * dmg - 4) * 100));
      return {
        stat: stat as MainStat,
        weight,
        crCdDiff,
        dmg,
      };
    }
  );

  // Sort by weight desc, then by cr/cd split asc for ties.
  entries.sort((a, b) => {
    const wDiff = b.weight - a.weight;
    if (wDiff !== 0) return wDiff;
    return a.crCdDiff - b.crCdDiff;
  });

  // Among weight-tied candidates, penalize those with worse cr/cd split by 2pts.
  for (let i = 1; i < entries.length; i++) {
    const curr = entries[i];
    const prev = entries[i - 1];
    if (curr.weight === prev.weight && curr.crCdDiff > prev.crCdDiff + 0.5) {
      curr.weight = Math.max(0, curr.weight - 2);
    }
  }

  // Re-sort after tie-breaking penalty
  entries.sort((a, b) => {
    const wDiff = b.weight - a.weight;
    if (wDiff !== 0) return wDiff;
    return a.crCdDiff - b.crCdDiff;
  });

  return entries.map(({ stat, weight }) => ({ stat, weight }));
}
