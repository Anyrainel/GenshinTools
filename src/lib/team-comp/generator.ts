import {
  artifactHalfSetsById,
  artifactsById,
  statPools,
} from "@/data/constants";
import type { ArtifactData, MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";

import {
  buildSheetFromMainAndSubs,
  constrainedGreedyAllocate,
  emptySubRolls,
  getRollValues,
  rollToInternal,
} from "./constrainedGreedy";
import type { TeamBuild } from "./damageCalc";
import { evaluateCombo, hasOffFieldParts } from "./damageCalc";
import { StatSheet } from "./damageModels";
import {
  ER_20_HALF_SET_ID,
  type ErCrGap,
  computeErCrGap,
  computeSubstatPreFill,
  crMainStatInternal,
  erCrGapAfterMainStats,
  erMainStatInternal,
} from "./erCrConstraints";
import type { CompiledTeamDamage } from "./formulaCompiler";
import {
  compileComboTeamDamage,
  compileTeamDamage,
  fillVarsFromSheet,
} from "./formulaCompiler";
import type { SubstatBudgetPreset } from "./substatBudget";
import {
  maxRollsPerStatForPreset,
  resolveSubstatBudgetPreset,
  rollsPerSlotForPreset,
} from "./substatBudget";
import type {
  CalcContext,
  ComboFormula,
  ComboResult,
  DamageResult,
  ReactionOverride,
  StatKey,
} from "./types";

export type { SubstatBudgetPreset } from "./substatBudget";

// ─── Types ───

export interface GeneratorOptions {
  teamBuild: TeamBuild;
  carryCharId: string;
  formulaId: string;
  calcContext: CalcContext;
  /** Per-char, per-slot artifact set key for proper icon rendering */
  setKeysByChar?: Record<string, Record<Slot, string>>;
  /** Substat roll magnitude multiplier (0.7–1.0, default 0.85) */
  rollMultiplier?: number;
  /**
   * Per-slot substat roll budget preset. Overrides `calcContext.idealSubstatBudget`
   * when set (e.g. investment passes the default preset to ignore calcContext).
   */
  idealSubstatBudget?: SubstatBudgetPreset;
  /** Override reaction types for the damage formula */
  reactionOverride?: ReactionOverride;
  /** Combo formula for combo mode */
  combo?: ComboFormula;
  /** Per-formula reaction overrides for combo mode */
  reactionOverrides?: Record<string, ReactionOverride>;
  /** Per-character ER/CR thresholds (internal format, e.g. 1.6 = 160% ER). */
  perChar?: Record<string, { minEr: number; minCr: number }>;
  /** Per-character "ignore artifact sets when ER/CR unmet" flag. */
  ignoreArtifactSets?: Record<string, boolean>;
}

export interface GeneratorResult {
  artifactsByChar: Record<string, Record<Slot, ArtifactData>>;
  sheetsByChar: Record<string, StatSheet>;
  damage: number;
  damageResult: DamageResult | null;
  comboResult?: ComboResult;
  phase: string;
  progress: number;
  done: boolean;
}

// ─── Constants ───

// Valid main stat pools per slot
const mainStatPools: Record<Slot, readonly MainStat[]> = {
  flower: statPools.flower,
  plume: statPools.plume,
  sands: statPools.sands,
  goblet: statPools.goblet,
  circlet: statPools.circlet,
};

/** Determine artifact rarity for a character from their set keys */
function getCharRarity(
  charId: string,
  setKeysByChar?: Record<string, Record<Slot, string>>
): 4 | 5 {
  const slotKeys = setKeysByChar?.[charId];
  if (!slotKeys) return 5;
  for (const slot of allSlots) {
    const setKey = slotKeys[slot];
    if (setKey && artifactsById[setKey]?.rarity === 4) return 4;
  }
  return 5;
}

// ─── Helpers ───

function evaluateDamage(
  teamBuild: TeamBuild,
  sheets: Record<string, StatSheet>,
  carryCharId: string,
  formulaId: string,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): number {
  try {
    if (combo) {
      return evaluateCombo(teamBuild, combo, sheets, ctx, reactionOverrides)
        .totalDamage;
    }
    const teamStats = teamBuild.getTeamStats(sheets, carryCharId, ctx);
    // Compute off-field stats if the formula has off-field parts
    let offFieldStats: Record<string, StatSheet> | undefined;
    if (hasOffFieldParts(teamBuild, carryCharId, formulaId)) {
      const otherCharId = Object.keys(teamBuild.charBuilds).find(
        (id) => id !== carryCharId
      );
      if (otherCharId) {
        offFieldStats = teamBuild.getTeamStats(sheets, otherCharId, ctx);
      }
    }
    const result = teamBuild.getDamageResult(
      carryCharId,
      formulaId,
      teamStats,
      ctx,
      reactionOverride,
      offFieldStats
    );
    return result.totalDamage;
  } catch (e) {
    console.warn(
      `[generator] evaluateDamage failed for ${carryCharId}/${formulaId}:`,
      e
    );
    return 0;
  }
}

/**
 * Try to compile an AST-based fast evaluator for a single varying character.
 * Supports both single-formula and combo mode.
 * Returns null if compilation fails.
 */
function tryCompileEval(
  teamBuild: TeamBuild,
  swapCharId: string,
  carryCharId: string,
  formulaId: string,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>,
  partialBuffs?: import("./stackAllocation").PartialBuffInfo[],
  comboBuffOverrides?: Record<
    string,
    import("./stackAllocation").PartialBuffInfo[]
  >
): {
  compiled: CompiledTeamDamage;
  charIdx: number;
  vars: Float64Array;
} | null {
  try {
    if (combo) {
      // Combo mode: compile all formula lines into one expression
      const compiled = compileComboTeamDamage(
        teamBuild,
        combo,
        swapCharId,
        currentSheets,
        ctx,
        reactionOverrides,
        comboBuffOverrides
      );
      // charIdx must match the ordering used inside compileComboTeamDamage,
      // which uses createOptimizerContext → charBuildOrder = Object.entries(charBuilds).
      // We get the same ordering by creating any optCtx and reading charBuildOrder.
      const anyCalcTargetId = combo.lines[0]?.charId ?? carryCharId;
      const tmpCtx = teamBuild.createOptimizerContext(
        currentSheets,
        swapCharId,
        anyCalcTargetId,
        ctx
      );
      const charIdx = tmpCtx.charBuildOrder.findIndex(
        ([id]) => id === swapCharId
      );
      const vars = new Float64Array(compiled.numVars);
      return { compiled, charIdx, vars };
    }
    // Single formula mode
    const optCtx = teamBuild.createOptimizerContext(
      currentSheets,
      swapCharId,
      carryCharId,
      ctx
    );
    const compiled = compileTeamDamage(
      teamBuild,
      carryCharId,
      formulaId,
      ctx,
      optCtx,
      reactionOverride,
      undefined, // erCheckCharId
      undefined, // minEr
      undefined, // minCr
      partialBuffs
    );
    const charIdx = optCtx.charBuildOrder.findIndex(
      ([id]) => id === swapCharId
    );
    const vars = new Float64Array(compiled.numVars);
    return { compiled, charIdx, vars };
  } catch {
    return null;
  }
}

/** Create a fast evalDamage callback using compiled AST. */
function makeCompiledEvalDamage(
  swapCharId: string,
  compiled: CompiledTeamDamage,
  charIdx: number,
  vars: Float64Array
): (sheets: Record<string, StatSheet>) => number {
  return (sheets: Record<string, StatSheet>) => {
    vars.fill(0);
    const sheet = sheets[swapCharId];
    if (sheet) fillVarsFromSheet(sheet, compiled.varMapping, charIdx, vars);
    return compiled.evaluate(vars);
  };
}

function synthesizeArtifacts(
  charId: string,
  mainStats: Record<Slot, MainStat>,
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  rv: Record<SubStat, number>,
  slotSetKeys?: Record<Slot, string>
): Record<Slot, ArtifactData> {
  const result = {} as Record<Slot, ArtifactData>;
  for (const slot of allSlots) {
    const subs: Partial<Record<SubStat, number>> = {};
    const slotSubs = subRolls[slot];
    for (const [stat, rolls] of Object.entries(slotSubs)) {
      if (!rolls) continue;
      // Display format: percent stats as e.g. 13.26 for 13.26%, flat stats as-is
      subs[stat as SubStat] = +(rv[stat as SubStat] * rolls).toFixed(2);
    }

    const setKey = slotSetKeys?.[slot] ?? "ideal";
    result[slot] = {
      id: `ideal-${charId}-${slot}`,
      setKey,
      slotKey: slot,
      rarity: artifactsById[setKey]?.rarity ?? 5,
      mainStatKey: mainStats[slot],
      level: (artifactsById[setKey]?.rarity ?? 5) === 4 ? 16 : 20,
      lock: false,
      substats: subs,
    };
  }
  return result;
}

// ─── Derive slot set keys from TeamBuild configs ───

/**
 * Build per-char, per-slot set keys from the TeamBuild configs.
 * For 4pc: all 5 slots → the 4pc set key.
 * For 2+2pc: slots 1-3 (flower/plume/sands) → first half-set,
 *            slots 4-5 (goblet/circlet) → second half-set.
 * Falls back to "ideal" if half-set lookup fails.
 */
function deriveSetKeysByChar(
  teamBuild: TeamBuild
): Record<string, Record<Slot, string>> {
  const result: Record<string, Record<Slot, string>> = {};
  for (const cfg of teamBuild.configs) {
    if (cfg.artifactSetId) {
      // 4pc
      result[cfg.charId] = {
        flower: cfg.artifactSetId,
        plume: cfg.artifactSetId,
        sands: cfg.artifactSetId,
        goblet: cfg.artifactSetId,
        circlet: cfg.artifactSetId,
      };
    } else if (cfg.artifactHalfSetIds.length === 2) {
      // 2+2pc: pick a concrete 5★ set from each half-set
      const hs1 = artifactHalfSetsById[cfg.artifactHalfSetIds[0]];
      const hs2 = artifactHalfSetsById[cfg.artifactHalfSetIds[1]];
      const sk1 =
        hs1?.setIds.find((id) => artifactsById[id]?.rarity === 5) ??
        hs1?.setIds[0] ??
        "ideal";
      // For sk2, skip sk1 so both half-sets use distinct concrete sets
      const sk2 =
        hs2?.setIds.find(
          (id) => artifactsById[id]?.rarity === 5 && id !== sk1
        ) ??
        hs2?.setIds.find((id) => id !== sk1) ??
        hs2?.setIds[0] ??
        "ideal";
      result[cfg.charId] = {
        flower: sk1,
        plume: sk1,
        sands: sk1,
        goblet: sk2,
        circlet: sk2,
      };
    }
  }
  return result;
}

// ─── Phase 1: Find best main stats ───

function findBestMainStats(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): Record<Slot, MainStat> {
  const compiledCtx = tryCompileEval(
    teamBuild,
    charId,
    carryCharId,
    formulaId,
    currentSheets,
    ctx,
    reactionOverride,
    combo,
    reactionOverrides
  );
  const fastEval = compiledCtx
    ? makeCompiledEvalDamage(
        charId,
        compiledCtx.compiled,
        compiledCtx.charIdx,
        compiledCtx.vars
      )
    : null;

  let bestDamage = -1;
  let bestMainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "atk%",
    circlet: "cr",
  };

  // flower and plume are fixed
  for (const sands of mainStatPools.sands) {
    for (const goblet of mainStatPools.goblet) {
      for (const circlet of mainStatPools.circlet) {
        const mainStats: Record<Slot, MainStat> = {
          flower: "hp",
          plume: "atk",
          sands,
          goblet,
          circlet,
        };

        const sheet = buildSheetFromMainAndSubs(
          mainStats,
          emptySubRolls(),
          rv,
          rarity
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = fastEval
          ? fastEval(sheets)
          : evaluateDamage(
              teamBuild,
              sheets,
              carryCharId,
              formulaId,
              ctx,
              reactionOverride,
              combo,
              reactionOverrides
            );

        if (dmg > bestDamage) {
          bestDamage = dmg;
          bestMainStats = mainStats;
        }
      }
    }
  }

  return bestMainStats;
}

// ─── Phase 2: Fill substats via constrained greedy allocation ───
//
// Delegates to the shared constrainedGreedyAllocate, which respects:
// - 4 distinct substats per artifact
// - Main stat / substat exclusion
// - Per-stat and per-artifact roll caps

function fillSubstats(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  mainStats: Record<Slot, MainStat>,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5,
  budgetPreset: SubstatBudgetPreset,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>,
  preFill?: Record<Slot, Partial<Record<SubStat, number>>>
): Record<Slot, Partial<Record<SubStat, number>>> {
  const maxSlot = rollsPerSlotForPreset(budgetPreset, rarity);
  const maxStat = maxRollsPerStatForPreset(budgetPreset, rarity);
  const compiledCtx = tryCompileEval(
    teamBuild,
    charId,
    carryCharId,
    formulaId,
    currentSheets,
    ctx,
    reactionOverride,
    combo,
    reactionOverrides
  );
  const fastEval = compiledCtx
    ? makeCompiledEvalDamage(
        charId,
        compiledCtx.compiled,
        compiledCtx.charIdx,
        compiledCtx.vars
      )
    : null;

  return constrainedGreedyAllocate({
    charId,
    mainStats,
    currentSheets,
    evalDamage: fastEval
      ? fastEval
      : (sheets) =>
          evaluateDamage(
            teamBuild,
            sheets,
            carryCharId,
            formulaId,
            ctx,
            reactionOverride,
            combo,
            reactionOverrides
          ),
    rv,
    rarity,
    preFill,
    maxRollsPerSlot: maxSlot,
    maxRollsPerStat: maxStat,
  });
}

// ─── Constraint-aware main stat + substat generation ───

interface ConstraintAwareResult {
  mainStats: Record<Slot, MainStat>;
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>;
  sheet: StatSheet;
  damage: number;
}

/**
 * Generate main stats and substats with ER/CR constraint awareness.
 *
 * Strategy:
 * 1. Find best main stats by pure damage (normal path)
 * 2. If erGap >= ER sands value → also try forced ER sands
 * 3. If crGap >= CR circlet value → also try forced CR circlet
 * 4. If both → try both forced
 * 5. For each variant, pre-fill minimum ER/CR substats, then greedy the rest
 * 6. Return the best valid combo by damage
 */
function constraintAwareGenerate(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  gap: ErCrGap,
  rarity: 4 | 5,
  budgetPreset: SubstatBudgetPreset,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): ConstraintAwareResult {
  const maxSlot = rollsPerSlotForPreset(budgetPreset, rarity);
  const maxStat = maxRollsPerStatForPreset(budgetPreset, rarity);
  const needForceEr = gap.erGap >= erMainStatInternal(rarity);
  const needForceCr = gap.crGap >= crMainStatInternal(rarity);

  // Build list of main stat variants to try
  const variants: {
    label: string;
    forceSands?: MainStat;
    forceCirclet?: MainStat;
  }[] = [{ label: "normal" }];
  if (needForceEr) {
    variants.push({ label: "force-er", forceSands: "er" });
  }
  if (needForceCr) {
    variants.push({ label: "force-cr", forceCirclet: "cr" });
  }
  if (needForceEr && needForceCr) {
    variants.push({
      label: "force-er-cr",
      forceSands: "er",
      forceCirclet: "cr",
    });
  }

  let best: ConstraintAwareResult | null = null;

  for (const variant of variants) {
    // Find best main stats with optional forcing
    const mainStats = findBestMainStatsConstrained(
      teamBuild,
      charId,
      carryCharId,
      formulaId,
      currentSheets,
      ctx,
      rv,
      gap,
      rarity,
      budgetPreset,
      variant.forceSands,
      variant.forceCirclet,
      reactionOverride,
      combo,
      reactionOverrides
    );
    if (!mainStats) continue; // no feasible combo found

    // Compute remaining gap after main stats and build pre-fill
    const { erRemaining, crRemaining } = erCrGapAfterMainStats(
      gap,
      mainStats,
      rarity
    );
    const preFill =
      erRemaining > 0 || crRemaining > 0
        ? computeSubstatPreFill(
            erRemaining,
            crRemaining,
            mainStats,
            rarity,
            rv,
            maxSlot,
            maxStat
          )
        : undefined;
    if (preFill === null) continue; // infeasible even with max substats

    // Fill substats
    const subRolls = fillSubstats(
      teamBuild,
      charId,
      carryCharId,
      formulaId,
      mainStats,
      currentSheets,
      ctx,
      rv,
      rarity,
      budgetPreset,
      reactionOverride,
      combo,
      reactionOverrides,
      preFill
    );
    const sheet = buildSheetFromMainAndSubs(mainStats, subRolls, rv, rarity);
    const sheets = { ...currentSheets, [charId]: sheet };
    const damage = evaluateDamage(
      teamBuild,
      sheets,
      carryCharId,
      formulaId,
      ctx,
      reactionOverride,
      combo,
      reactionOverrides
    );

    if (!best || damage > best.damage) {
      best = { mainStats, subRolls, sheet, damage };
    }
  }

  // Fallback: if no variant produced a result, run unconstrained
  if (!best) {
    const mainStats = findBestMainStats(
      teamBuild,
      charId,
      carryCharId,
      formulaId,
      currentSheets,
      ctx,
      rv,
      rarity,
      reactionOverride,
      combo,
      reactionOverrides
    );
    const subRolls = fillSubstats(
      teamBuild,
      charId,
      carryCharId,
      formulaId,
      mainStats,
      currentSheets,
      ctx,
      rv,
      rarity,
      budgetPreset,
      reactionOverride,
      combo,
      reactionOverrides
    );
    const sheet = buildSheetFromMainAndSubs(mainStats, subRolls, rv, rarity);
    const sheets = { ...currentSheets, [charId]: sheet };
    const damage = evaluateDamage(
      teamBuild,
      sheets,
      carryCharId,
      formulaId,
      ctx,
      reactionOverride,
      combo,
      reactionOverrides
    );
    best = { mainStats, subRolls, sheet, damage };
  }

  return best;
}

/**
 * Find best main stats with optional forced sands/circlet and feasibility filtering.
 * Returns null if no feasible main stat combo exists.
 */
function findBestMainStatsConstrained(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  gap: ErCrGap,
  rarity: 4 | 5,
  budgetPreset: SubstatBudgetPreset,
  forceSands?: MainStat,
  forceCirclet?: MainStat,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): Record<Slot, MainStat> | null {
  const maxSlot = rollsPerSlotForPreset(budgetPreset, rarity);
  const maxStat = maxRollsPerStatForPreset(budgetPreset, rarity);
  const compiledCtx = tryCompileEval(
    teamBuild,
    charId,
    carryCharId,
    formulaId,
    currentSheets,
    ctx,
    reactionOverride,
    combo,
    reactionOverrides
  );
  const fastEval = compiledCtx
    ? makeCompiledEvalDamage(
        charId,
        compiledCtx.compiled,
        compiledCtx.charIdx,
        compiledCtx.vars
      )
    : null;

  let bestDamage = -1;
  let bestMainStats: Record<Slot, MainStat> | null = null;

  const sandsCandidates = forceSands ? [forceSands] : mainStatPools.sands;
  const circletCandidates = forceCirclet
    ? [forceCirclet]
    : mainStatPools.circlet;

  for (const sands of sandsCandidates) {
    for (const goblet of mainStatPools.goblet) {
      for (const circlet of circletCandidates) {
        const mainStats: Record<Slot, MainStat> = {
          flower: "hp",
          plume: "atk",
          sands,
          goblet,
          circlet,
        };

        // Early reject: check if substats can fill the remaining gap
        if (gap.erGap > 0 || gap.crGap > 0) {
          const { erRemaining, crRemaining } = erCrGapAfterMainStats(
            gap,
            mainStats,
            rarity
          );
          if (erRemaining > 0 || crRemaining > 0) {
            const preFill = computeSubstatPreFill(
              erRemaining,
              crRemaining,
              mainStats,
              rarity,
              rv,
              maxSlot,
              maxStat
            );
            if (preFill === null) continue; // infeasible
          }
        }

        const sheet = buildSheetFromMainAndSubs(
          mainStats,
          emptySubRolls(),
          rv,
          rarity
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = fastEval
          ? fastEval(sheets)
          : evaluateDamage(
              teamBuild,
              sheets,
              carryCharId,
              formulaId,
              ctx,
              reactionOverride,
              combo,
              reactionOverrides
            );

        if (dmg > bestDamage) {
          bestDamage = dmg;
          bestMainStats = mainStats;
        }
      }
    }
  }

  return bestMainStats;
}

// ─── Phase 1b: Find best main stats ignoring main/sub conflicts ───
// Used for carry refinement: substats are cleared and regenerated afterward,
// so we don't need to worry about a substat matching the new main stat.

function findBestMainStatsWithSubs(
  teamBuild: TeamBuild,
  charId: string,
  carryCharId: string,
  formulaId: string,
  currentSheets: Record<string, StatSheet>,
  existingSubRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): Record<Slot, MainStat> {
  const compiledCtx = tryCompileEval(
    teamBuild,
    charId,
    carryCharId,
    formulaId,
    currentSheets,
    ctx,
    reactionOverride,
    combo,
    reactionOverrides
  );
  const fastEval = compiledCtx
    ? makeCompiledEvalDamage(
        charId,
        compiledCtx.compiled,
        compiledCtx.charIdx,
        compiledCtx.vars
      )
    : null;

  let bestDamage = -1;
  let bestMainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "atk%",
    circlet: "cr",
  };

  for (const sands of mainStatPools.sands) {
    for (const goblet of mainStatPools.goblet) {
      for (const circlet of mainStatPools.circlet) {
        const mainStats: Record<Slot, MainStat> = {
          flower: "hp",
          plume: "atk",
          sands,
          goblet,
          circlet,
        };

        // Evaluate with existing substats still present (ignore conflicts)
        const sheet = buildSheetFromMainAndSubs(
          mainStats,
          existingSubRolls,
          rv,
          rarity
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = fastEval
          ? fastEval(sheets)
          : evaluateDamage(
              teamBuild,
              sheets,
              carryCharId,
              formulaId,
              ctx,
              reactionOverride,
              combo,
              reactionOverrides
            );

        if (dmg > bestDamage) {
          bestDamage = dmg;
          bestMainStats = mainStats;
        }
      }
    }
  }

  return bestMainStats;
}

// ─── Multi-pass Generator ───
//
// Pass order:
//   1. Main stats for carry
//   2. Main stats for each support
//   3. Substats for carry (step by step)
//   4. Substats for each support (step by step)
//   5. Re-roll main stats for carry (with substats present, ignore conflicts)
//   6. Clear & regenerate substats for carry

export async function* runGenerator(
  opts: GeneratorOptions
): AsyncGenerator<GeneratorResult> {
  const {
    teamBuild,
    carryCharId,
    formulaId,
    calcContext,
    reactionOverride,
    combo,
    reactionOverrides,
  } = opts;
  const budgetPreset = resolveSubstatBudgetPreset(
    opts.idealSubstatBudget,
    calcContext
  );
  // Derive slot→set mapping from TeamBuild configs; caller entries override
  const derived = deriveSetKeysByChar(teamBuild);
  const setKeysByChar: Record<string, Record<Slot, string>> = { ...derived };
  if (opts.setKeysByChar) {
    for (const [cid, slotKeys] of Object.entries(opts.setKeysByChar)) {
      setKeysByChar[cid] = slotKeys;
    }
  }
  const rollMult = opts.rollMultiplier;

  // Per-character rarity and roll values
  const charRarity: Record<string, 4 | 5> = {};
  const charRv: Record<string, Record<SubStat, number>> = {};
  const allCharIds = Object.keys(teamBuild.getFormulaIds());
  for (const cid of allCharIds) {
    const r = getCharRarity(cid, setKeysByChar);
    charRarity[cid] = r;
    charRv[cid] = getRollValues(rollMult, r);
  }
  // Default rv for makeResult (uses 5★ for progress display)
  const rv = getRollValues(rollMult);
  const supportCharIds = allCharIds.filter((id) => id !== carryCharId);

  // Total steps: carry(2) + supports(2*N) + reroll(1) + resub(1) + crcd(1) = 2N+5
  const totalSteps = 2 * supportCharIds.length + 5;
  let step = 0;

  const currentSheets: Record<string, StatSheet> = {};
  for (const cid of allCharIds) {
    currentSheets[cid] = new StatSheet([]);
  }

  const allMainStats: Record<string, Record<Slot, MainStat>> = {};
  const allSubRolls: Record<
    string,
    Record<Slot, Partial<Record<SubStat, number>>>
  > = {};

  const yieldProgress = (phase: string) =>
    makeResult(
      currentSheets,
      allMainStats,
      allSubRolls,
      allCharIds,
      phase,
      step / totalSteps,
      teamBuild,
      carryCharId,
      formulaId,
      calcContext,
      charRv,
      setKeysByChar,
      reactionOverride,
      combo,
      reactionOverrides
    );

  // ── Helper: compute ER/CR gap for a character ──
  const getCharGap = (cid: string): ErCrGap => {
    const pc = opts.perChar?.[cid];
    if (!pc || (pc.minEr <= 0 && pc.minCr <= 0)) return { erGap: 0, crGap: 0 };
    return computeErCrGap(
      teamBuild,
      cid,
      currentSheets,
      carryCharId,
      calcContext,
      pc.minEr,
      pc.minCr
    );
  };

  // ── Helper: get pre-fill for a character's chosen main stats ──
  const getPreFill = (
    cid: string,
    gap: ErCrGap,
    mainStats: Record<Slot, MainStat>,
    r: 4 | 5,
    cRv: Record<SubStat, number>
  ) => {
    if (gap.erGap <= 0 && gap.crGap <= 0) return undefined;
    const { erRemaining, crRemaining } = erCrGapAfterMainStats(
      gap,
      mainStats,
      r
    );
    if (erRemaining <= 0 && crRemaining <= 0) return undefined;
    return (
      computeSubstatPreFill(
        erRemaining,
        crRemaining,
        mainStats,
        r,
        cRv,
        rollsPerSlotForPreset(budgetPreset, r),
        maxRollsPerStatForPreset(budgetPreset, r)
      ) ?? undefined
    );
  };

  // ── Steps 1-2: Main stats + substats for carry, then supports ──
  // When ER/CR constraints exist, use constraint-aware generation that
  // tries forced main stat variants and pre-fills substats.
  const carryR = charRarity[carryCharId] ?? 5;
  const carryRv = charRv[carryCharId] ?? rv;
  const carryGap = getCharGap(carryCharId);

  yield yieldProgress("carry: main stats + substats");
  await yieldFrame();

  if (carryGap.erGap > 0 || carryGap.crGap > 0) {
    const result = constraintAwareGenerate(
      teamBuild,
      carryCharId,
      carryCharId,
      formulaId,
      currentSheets,
      calcContext,
      carryRv,
      carryGap,
      carryR,
      budgetPreset,
      reactionOverride,
      combo,
      reactionOverrides
    );
    allMainStats[carryCharId] = result.mainStats;
    allSubRolls[carryCharId] = result.subRolls;
    currentSheets[carryCharId] = result.sheet;
  } else {
    allMainStats[carryCharId] = findBestMainStats(
      teamBuild,
      carryCharId,
      carryCharId,
      formulaId,
      currentSheets,
      calcContext,
      carryRv,
      carryR,
      reactionOverride,
      combo,
      reactionOverrides
    );
    currentSheets[carryCharId] = buildSheetFromMainAndSubs(
      allMainStats[carryCharId],
      emptySubRolls(),
      carryRv,
      carryR
    );
    allSubRolls[carryCharId] = fillSubstats(
      teamBuild,
      carryCharId,
      carryCharId,
      formulaId,
      allMainStats[carryCharId],
      currentSheets,
      calcContext,
      carryRv,
      carryR,
      budgetPreset,
      reactionOverride,
      combo,
      reactionOverrides
    );
    currentSheets[carryCharId] = buildSheetFromMainAndSubs(
      allMainStats[carryCharId],
      allSubRolls[carryCharId],
      carryRv,
      carryR
    );
  }
  step += 2; // combined main+sub steps

  // ── Steps 3-4: Main stats + substats for each support ──
  for (const sid of supportCharIds) {
    const sR = charRarity[sid] ?? 5;
    const sRv = charRv[sid] ?? rv;
    const sGap = getCharGap(sid);

    yield yieldProgress(`${sid}: main stats + substats`);
    await yieldFrame();

    if (sGap.erGap > 0 || sGap.crGap > 0) {
      const result = constraintAwareGenerate(
        teamBuild,
        sid,
        carryCharId,
        formulaId,
        currentSheets,
        calcContext,
        sRv,
        sGap,
        sR,
        budgetPreset,
        reactionOverride,
        combo,
        reactionOverrides
      );
      allMainStats[sid] = result.mainStats;
      allSubRolls[sid] = result.subRolls;
      currentSheets[sid] = result.sheet;
    } else {
      allMainStats[sid] = findBestMainStats(
        teamBuild,
        sid,
        carryCharId,
        formulaId,
        currentSheets,
        calcContext,
        sRv,
        sR,
        reactionOverride,
        combo,
        reactionOverrides
      );
      currentSheets[sid] = buildSheetFromMainAndSubs(
        allMainStats[sid],
        emptySubRolls(),
        sRv,
        sR
      );
      allSubRolls[sid] = fillSubstats(
        teamBuild,
        sid,
        carryCharId,
        formulaId,
        allMainStats[sid],
        currentSheets,
        calcContext,
        sRv,
        sR,
        budgetPreset,
        reactionOverride,
        combo,
        reactionOverrides
      );
      currentSheets[sid] = buildSheetFromMainAndSubs(
        allMainStats[sid],
        allSubRolls[sid],
        sRv,
        sR
      );
    }
    step += 2; // combined main+sub steps
  }

  // ── Step 5: Re-roll main stats for carry (ignore main/sub conflicts) ──
  yield yieldProgress("carry: refine main stats");
  await yieldFrame();
  allMainStats[carryCharId] = findBestMainStatsWithSubs(
    teamBuild,
    carryCharId,
    carryCharId,
    formulaId,
    currentSheets,
    allSubRolls[carryCharId],
    calcContext,
    carryRv,
    carryR,
    reactionOverride,
    combo,
    reactionOverrides
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    carryRv,
    carryR
  );
  step++;

  // ── Step 6: Clear & regenerate substats for carry ──
  yield yieldProgress("carry: refine substats");
  await yieldFrame();
  {
    const refinedPreFill = getPreFill(
      carryCharId,
      carryGap,
      allMainStats[carryCharId],
      carryR,
      carryRv
    );
    allSubRolls[carryCharId] = fillSubstats(
      teamBuild,
      carryCharId,
      carryCharId,
      formulaId,
      allMainStats[carryCharId],
      currentSheets,
      calcContext,
      carryRv,
      carryR,
      budgetPreset,
      reactionOverride,
      combo,
      reactionOverrides,
      refinedPreFill
    );
  }
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    carryRv,
    carryR
  );
  step++;

  // ── Step 7: CR/CD circlet branching ──
  // Greedy tends to lock into one CR/CD path due to their multiplicative
  // relationship. If circlet is CR or CD, try the alternative with fresh
  // substat allocation and keep whichever yields higher damage.
  const currentCirclet = allMainStats[carryCharId].circlet;
  const altCirclet: MainStat | null =
    currentCirclet === "cr" ? "cd" : currentCirclet === "cd" ? "cr" : null;

  if (altCirclet) {
    yield yieldProgress("carry: compare cr/cd circlet");
    await yieldFrame();

    const currentDmg = evaluateDamage(
      teamBuild,
      currentSheets,
      carryCharId,
      formulaId,
      calcContext,
      reactionOverride,
      combo,
      reactionOverrides
    );

    // Try the alternative circlet with fresh substats
    const altMainStats = { ...allMainStats[carryCharId], circlet: altCirclet };
    const altPreFill = getPreFill(
      carryCharId,
      carryGap,
      altMainStats,
      carryR,
      carryRv
    );
    const altSubRolls = fillSubstats(
      teamBuild,
      carryCharId,
      carryCharId,
      formulaId,
      altMainStats,
      currentSheets,
      calcContext,
      carryRv,
      carryR,
      budgetPreset,
      reactionOverride,
      combo,
      reactionOverrides,
      altPreFill
    );
    const altSheet = buildSheetFromMainAndSubs(
      altMainStats,
      altSubRolls,
      carryRv,
      carryR
    );
    const altSheets = { ...currentSheets, [carryCharId]: altSheet };
    const altDmg = evaluateDamage(
      teamBuild,
      altSheets,
      carryCharId,
      formulaId,
      calcContext,
      reactionOverride,
      combo,
      reactionOverrides
    );

    if (altDmg > currentDmg) {
      allMainStats[carryCharId] = altMainStats;
      allSubRolls[carryCharId] = altSubRolls;
      currentSheets[carryCharId] = altSheet;
    }
  }
  step++;

  // ── Final result ──
  const artifactsByChar: Record<string, Record<Slot, ArtifactData>> = {};
  const sheetsByChar: Record<string, StatSheet> = {};

  for (const charId of allCharIds) {
    const ms = allMainStats[charId] ?? {
      flower: "hp" as MainStat,
      plume: "atk" as MainStat,
      sands: "atk%" as MainStat,
      goblet: "atk%" as MainStat,
      circlet: "cr" as MainStat,
    };
    const sr = allSubRolls[charId] ?? emptySubRolls();
    artifactsByChar[charId] = synthesizeArtifacts(
      charId,
      ms,
      sr,
      charRv[charId] ?? rv,
      setKeysByChar?.[charId]
    );
    sheetsByChar[charId] = currentSheets[charId] ?? new StatSheet([]);
  }

  let damage = 0;
  let damageResult: DamageResult | null = null;
  let finalComboResult: ComboResult | undefined;
  try {
    if (combo) {
      finalComboResult = evaluateCombo(
        teamBuild,
        combo,
        currentSheets,
        calcContext,
        reactionOverrides
      );
      damage = finalComboResult.totalDamage;
    } else {
      const teamStats = teamBuild.getTeamStats(
        currentSheets,
        carryCharId,
        calcContext
      );
      damageResult = teamBuild.getDamageResult(
        carryCharId,
        formulaId,
        teamStats,
        calcContext,
        reactionOverride
      );
      damage = damageResult.totalDamage;
    }
  } catch (e) {
    console.warn(`[generator] final damage calc failed for ${carryCharId}:`, e);
  }

  yield {
    artifactsByChar,
    sheetsByChar,
    damage,
    damageResult,
    comboResult: finalComboResult,
    phase: "done",
    progress: 1,
    done: true,
  };
}

// ─── Utility ───

function makeResult(
  currentSheets: Record<string, StatSheet>,
  allMainStats: Record<string, Record<Slot, MainStat>>,
  allSubRolls: Record<string, Record<Slot, Partial<Record<SubStat, number>>>>,
  allCharIds: string[],
  phase: string,
  progress: number,
  teamBuild: TeamBuild,
  carryCharId: string,
  formulaId: string,
  ctx: CalcContext,
  charRvMap: Record<string, Record<SubStat, number>>,
  setKeysByChar?: Record<string, Record<Slot, string>>,
  reactionOverride?: ReactionOverride,
  combo?: ComboFormula,
  reactionOverrides?: Record<string, ReactionOverride>
): GeneratorResult {
  const artifactsByChar: Record<string, Record<Slot, ArtifactData>> = {};
  const sheetsByChar: Record<string, StatSheet> = {};

  for (const charId of allCharIds) {
    const ms = allMainStats[charId];
    const sr = allSubRolls[charId];
    if (ms && sr) {
      artifactsByChar[charId] = synthesizeArtifacts(
        charId,
        ms,
        sr,
        charRvMap[charId],
        setKeysByChar?.[charId]
      );
      sheetsByChar[charId] = currentSheets[charId] ?? new StatSheet([]);
    }
  }

  let damage = 0;
  let damageResult: DamageResult | null = null;
  let comboResult: ComboResult | undefined;
  try {
    if (combo) {
      comboResult = evaluateCombo(
        teamBuild,
        combo,
        currentSheets,
        ctx,
        reactionOverrides
      );
      damage = comboResult.totalDamage;
    } else {
      const teamStats = teamBuild.getTeamStats(currentSheets, carryCharId, ctx);
      damageResult = teamBuild.getDamageResult(
        carryCharId,
        formulaId,
        teamStats,
        ctx,
        reactionOverride
      );
      damage = damageResult.totalDamage;
    }
  } catch (e) {
    console.warn(
      `[generator] snapshot damage calc failed for ${carryCharId}:`,
      e
    );
  }

  return {
    artifactsByChar,
    sheetsByChar,
    damage,
    damageResult,
    comboResult,
    phase,
    progress,
    done: false,
  };
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
