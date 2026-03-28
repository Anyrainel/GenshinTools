import {
  artifactHalfSetsById,
  artifactsById,
  statPools,
} from "@/data/constants";
import type { ArtifactData, MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";

import {
  type FlexSlotConfig,
  buildSheetFromMainAndSubs,
  constrainedGreedyAllocate,
  emptySubRolls,
  getRollValues,
  rollToInternal,
} from "./constrainedGreedy";
import type { TeamBuild } from "./damageCalc";
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
  fillVarsFromSheet,
  makeCompiledEvalDamage,
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
  FormulaContext,
  PartialBuffInfo,
  StatKey,
} from "./types";

export type { SubstatBudgetPreset } from "./substatBudget";

// ─── Types ───

export interface GeneratorOptions {
  teamBuild: TeamBuild;
  carryCharId: string;
  formula: FormulaContext;
  calcContext: CalcContext;
  /** Per-char, per-slot artifact set key for proper icon rendering */
  setKeysByChar?: Record<string, Record<Slot, string>>;
  /** Substat roll magnitude multiplier (0.7–1.0, default 0.85) */
  rollMultiplier?: number;
  /**
   * Per-slot substat roll budget preset. Overrides `calcContext.substatBudget`
   * when set (e.g. analyzer passes the default preset to ignore calcContext).
   */
  substatBudget?: SubstatBudgetPreset;
  /** Per-character ER/CR thresholds (internal format, e.g. 1.6 = 160% ER). */
  perChar?: Record<string, { minEr: number; minCr: number }>;
  /** Per-character "ignore artifact sets when ER/CR unmet" flag. */
  ignoreArtifactSets?: Record<string, boolean>;
}

export interface GeneratorResult {
  artifactsByChar: Record<string, Record<Slot, ArtifactData>>;
  sheetsByChar: Record<string, StatSheet>;
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

// ─── Flex Slot Helpers ───

/** Candidate slots for 5★ flex promotion (sands/goblet/circlet). */
const FLEX_CANDIDATES: Slot[] = ["sands", "goblet", "circlet"];

function makeFlexConfig(
  flexSlot: Slot,
  budgetPreset: SubstatBudgetPreset,
  rollMult?: number
): FlexSlotConfig {
  return {
    slot: flexSlot,
    rv: getRollValues(rollMult, 5),
    maxRolls: rollsPerSlotForPreset(budgetPreset, 5),
    statCap: rollsPerSlotForPreset(budgetPreset, 5) - 3,
  };
}

/** Pick a random 5★ artifact set key for the flex slot display icon. */
function pickRandom5StarSetKey(): string {
  const all5Star = Object.values(artifactsById).filter((a) => a?.rarity === 5);
  if (all5Star.length === 0) return "generated";
  return all5Star[Math.floor(Math.random() * all5Star.length)].id;
}

// ─── Helpers ───

/**
 * One-shot damage evaluation using compiled path.
 * Compiles fresh each call — use only for cold paths (≤10 calls per generator run).
 * For hot loops, use compileEval + makeCompiledEvalDamage instead.
 */
function evaluateDamage(
  teamBuild: TeamBuild,
  sheets: Record<string, StatSheet>,
  charId: string,
  combo: ComboFormula,
  ctx: CalcContext,
  buffOverrides?: Record<number, PartialBuffInfo[]>
): number {
  const { compiled, charIdx, vars } = compileEval(
    teamBuild,
    charId,
    combo,
    sheets,
    ctx,
    buffOverrides
  );
  vars.fill(0);
  const sheet = sheets[charId];
  if (sheet) fillVarsFromSheet(sheet, compiled.varMapping, charIdx, vars);
  return compiled.evaluate(vars);
}

/**
 * Compile an AST-based fast evaluator for a single varying character.
 */
function compileEval(
  teamBuild: TeamBuild,
  swapCharId: string,
  combo: ComboFormula,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  comboBuffOverrides?: Record<string, PartialBuffInfo[]>
): {
  compiled: CompiledTeamDamage;
  charIdx: number;
  vars: Float64Array;
} {
  const compiled = compileComboTeamDamage(
    teamBuild,
    combo,
    swapCharId,
    currentSheets,
    ctx,
    comboBuffOverrides
  );
  const charIdx = compiled.charIdxMap?.get(swapCharId) ?? 0;
  const vars = new Float64Array(compiled.numVars);
  return { compiled, charIdx, vars };
}

function synthesizeArtifacts(
  charId: string,
  mainStats: Record<Slot, MainStat>,
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  rv: Record<SubStat, number>,
  slotSetKeys?: Record<Slot, string>,
  flex?: FlexSlotConfig | null
): Record<Slot, ArtifactData> {
  const result = {} as Record<Slot, ArtifactData>;
  for (const slot of allSlots) {
    const slotRv = flex?.slot === slot ? flex.rv : rv;
    const subs: Partial<Record<SubStat, number>> = {};
    const slotSubs = subRolls[slot];
    for (const [stat, rolls] of Object.entries(slotSubs)) {
      if (!rolls) continue;
      // Display format: percent stats as e.g. 13.26 for 13.26%, flat stats as-is
      subs[stat as SubStat] = +(slotRv[stat as SubStat] * rolls).toFixed(2);
    }

    const setKey = slotSetKeys?.[slot] ?? "generated";
    result[slot] = {
      id: `gen-${charId}-${slot}`,
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
 * Falls back to "generated" if half-set lookup fails.
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
        "generated";
      // For sk2, skip sk1 so both half-sets use distinct concrete sets
      const sk2 =
        hs2?.setIds.find(
          (id) => artifactsById[id]?.rarity === 5 && id !== sk1
        ) ??
        hs2?.setIds.find((id) => id !== sk1) ??
        hs2?.setIds[0] ??
        "generated";
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
  combo: ComboFormula,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  flex?: FlexSlotConfig
): Record<Slot, MainStat> {
  const { compiled, charIdx, vars } = compileEval(
    teamBuild,
    charId,
    combo,
    currentSheets,
    ctx
  );
  const fastEval = makeCompiledEvalDamage(charId, compiled, charIdx, vars);

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
          rarity,
          flex
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = fastEval(sheets);

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
  combo: ComboFormula,
  mainStats: Record<Slot, MainStat>,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5,
  budgetPreset: SubstatBudgetPreset,
  preFill?: Record<Slot, Partial<Record<SubStat, number>>>,
  flex?: FlexSlotConfig
): Record<Slot, Partial<Record<SubStat, number>>> {
  const maxSlot = rollsPerSlotForPreset(budgetPreset, rarity);
  const maxStat = maxRollsPerStatForPreset(budgetPreset, rarity);
  const { compiled, charIdx, vars } = compileEval(
    teamBuild,
    charId,
    combo,
    currentSheets,
    ctx
  );
  const fastEval = makeCompiledEvalDamage(charId, compiled, charIdx, vars);

  return constrainedGreedyAllocate({
    charId,
    mainStats,
    currentSheets,
    evalDamage: fastEval,
    rv,
    rarity,
    preFill,
    maxRollsPerSlot: maxSlot,
    maxRollsPerStat: maxStat,
    flex,
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
  combo: ComboFormula,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  gap: ErCrGap,
  rarity: 4 | 5,
  budgetPreset: SubstatBudgetPreset,
  flex?: FlexSlotConfig,
  buffOverrides?: Record<number, PartialBuffInfo[]>
): ConstraintAwareResult {
  const maxSlot = rollsPerSlotForPreset(budgetPreset, rarity);
  const maxStat = maxRollsPerStatForPreset(budgetPreset, rarity);
  // If flex promotes sands to 5★, use 5★ ER main stat threshold
  const erRarity = flex?.slot === "sands" ? 5 : rarity;
  const needForceEr = gap.erGap >= erMainStatInternal(erRarity);
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
      combo,
      currentSheets,
      ctx,
      rv,
      gap,
      rarity,
      budgetPreset,
      variant.forceSands,
      variant.forceCirclet,
      flex
    );
    if (!mainStats) continue; // no feasible combo found

    // Compute remaining gap after main stats and build pre-fill
    const { erRemaining, crRemaining } = erCrGapAfterMainStats(
      gap,
      mainStats,
      rarity,
      flex
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
      combo,
      mainStats,
      currentSheets,
      ctx,
      rv,
      rarity,
      budgetPreset,
      preFill,
      flex
    );
    const sheet = buildSheetFromMainAndSubs(
      mainStats,
      subRolls,
      rv,
      rarity,
      flex
    );
    const sheets = { ...currentSheets, [charId]: sheet };
    const damage = evaluateDamage(
      teamBuild,
      sheets,
      charId,
      combo,
      ctx,
      buffOverrides
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
      combo,
      currentSheets,
      ctx,
      rv,
      rarity,
      flex
    );
    const subRolls = fillSubstats(
      teamBuild,
      charId,
      combo,
      mainStats,
      currentSheets,
      ctx,
      rv,
      rarity,
      budgetPreset,
      undefined, // preFill
      flex
    );
    const sheet = buildSheetFromMainAndSubs(
      mainStats,
      subRolls,
      rv,
      rarity,
      flex
    );
    const sheets = { ...currentSheets, [charId]: sheet };
    const damage = evaluateDamage(
      teamBuild,
      sheets,
      charId,
      combo,
      ctx,
      buffOverrides
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
  combo: ComboFormula,
  currentSheets: Record<string, StatSheet>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  gap: ErCrGap,
  rarity: 4 | 5,
  budgetPreset: SubstatBudgetPreset,
  forceSands?: MainStat,
  forceCirclet?: MainStat,
  flex?: FlexSlotConfig
): Record<Slot, MainStat> | null {
  const maxSlot = rollsPerSlotForPreset(budgetPreset, rarity);
  const maxStat = maxRollsPerStatForPreset(budgetPreset, rarity);
  const { compiled, charIdx, vars } = compileEval(
    teamBuild,
    charId,
    combo,
    currentSheets,
    ctx
  );
  const fastEval = makeCompiledEvalDamage(charId, compiled, charIdx, vars);

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
            rarity,
            flex
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
          rarity,
          flex
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = fastEval(sheets);

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
  combo: ComboFormula,
  currentSheets: Record<string, StatSheet>,
  existingSubRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  ctx: CalcContext,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  flex?: FlexSlotConfig
): Record<Slot, MainStat> {
  const { compiled, charIdx, vars } = compileEval(
    teamBuild,
    charId,
    combo,
    currentSheets,
    ctx
  );
  const fastEval = makeCompiledEvalDamage(charId, compiled, charIdx, vars);

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
          rarity,
          flex
        );
        const sheets = { ...currentSheets, [charId]: sheet };
        const dmg = fastEval(sheets);

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
  const { teamBuild, carryCharId, calcContext } = opts;
  const { combo, buffOverrides } = opts.formula;
  const budgetPreset = resolveSubstatBudgetPreset(
    opts.substatBudget,
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
      charRv,
      setKeysByChar
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
    cRv: Record<SubStat, number>,
    flex?: FlexSlotConfig
  ) => {
    if (gap.erGap <= 0 && gap.crGap <= 0) return undefined;
    const { erRemaining, crRemaining } = erCrGapAfterMainStats(
      gap,
      mainStats,
      r,
      flex
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

  // ── Helper: run generation for one character (with optional flex) ──
  // Returns { mainStats, subRolls, sheet, damage }
  const generateOneChar = (
    cid: string,
    cR: 4 | 5,
    cRv: Record<SubStat, number>,
    cGap: ErCrGap,
    flex?: FlexSlotConfig
  ): {
    mainStats: Record<Slot, MainStat>;
    subRolls: Record<Slot, Partial<Record<SubStat, number>>>;
    sheet: StatSheet;
    damage: number;
  } => {
    if (cGap.erGap > 0 || cGap.crGap > 0) {
      return constraintAwareGenerate(
        teamBuild,
        cid,
        combo,
        currentSheets,
        calcContext,
        cRv,
        cGap,
        cR,
        budgetPreset,
        flex,
        buffOverrides
      );
    }
    const mainStats = findBestMainStats(
      teamBuild,
      cid,
      combo,
      currentSheets,
      calcContext,
      cRv,
      cR,
      flex
    );
    currentSheets[cid] = buildSheetFromMainAndSubs(
      mainStats,
      emptySubRolls(),
      cRv,
      cR,
      flex
    );
    const subRolls = fillSubstats(
      teamBuild,
      cid,
      combo,
      mainStats,
      currentSheets,
      calcContext,
      cRv,
      cR,
      budgetPreset,
      undefined, // preFill
      flex
    );
    const sheet = buildSheetFromMainAndSubs(mainStats, subRolls, cRv, cR, flex);
    const sheets = { ...currentSheets, [cid]: sheet };
    const damage = evaluateDamage(
      teamBuild,
      sheets,
      cid,
      combo,
      calcContext,
      buffOverrides
    );
    return { mainStats, subRolls, sheet, damage };
  };

  // ── Helper: run generation with flex-slot loop for 4★ characters ──
  const generateWithFlex = (
    cid: string,
    cR: 4 | 5,
    cRv: Record<SubStat, number>,
    cGap: ErCrGap
  ): {
    mainStats: Record<Slot, MainStat>;
    subRolls: Record<Slot, Partial<Record<SubStat, number>>>;
    sheet: StatSheet;
    damage: number;
    winningFlex: FlexSlotConfig | null;
  } => {
    if (cR !== 4) {
      const result = generateOneChar(cid, cR, cRv, cGap);
      return { ...result, winningFlex: null };
    }
    // 4★ character: try each flex slot candidate and keep the best
    let bestResult: ReturnType<typeof generateOneChar> | null = null;
    let bestFlex: FlexSlotConfig | null = null;
    for (const flexSlot of FLEX_CANDIDATES) {
      const flex = makeFlexConfig(flexSlot, budgetPreset, rollMult);
      const result = generateOneChar(cid, cR, cRv, cGap, flex);
      if (!bestResult || result.damage > bestResult.damage) {
        bestResult = result;
        bestFlex = flex;
      }
    }
    return { ...bestResult!, winningFlex: bestFlex };
  };

  // ── Steps 1-2: Main stats + substats for carry, then supports ──
  // When ER/CR constraints exist, use constraint-aware generation that
  // tries forced main stat variants and pre-fills substats.
  // For 4★ characters, try each sands/goblet/circlet as a 5★ flex slot.
  const carryR = charRarity[carryCharId] ?? 5;
  const carryRv = charRv[carryCharId] ?? rv;
  const carryGap = getCharGap(carryCharId);
  // Track winning flex config per character for carry refinement and display
  const charFlex: Record<string, FlexSlotConfig | null> = {};

  yield yieldProgress("carry: main stats + substats");
  await yieldFrame();

  {
    const { mainStats, subRolls, sheet, winningFlex } = generateWithFlex(
      carryCharId,
      carryR,
      carryRv,
      carryGap
    );
    allMainStats[carryCharId] = mainStats;
    allSubRolls[carryCharId] = subRolls;
    currentSheets[carryCharId] = sheet;
    charFlex[carryCharId] = winningFlex;
  }
  step += 2; // combined main+sub steps

  // ── Steps 3-4: Main stats + substats for each support ──
  for (const sid of supportCharIds) {
    const sR = charRarity[sid] ?? 5;
    const sRv = charRv[sid] ?? rv;
    const sGap = getCharGap(sid);

    yield yieldProgress(`${sid}: main stats + substats`);
    await yieldFrame();

    const { mainStats, subRolls, sheet, winningFlex } = generateWithFlex(
      sid,
      sR,
      sRv,
      sGap
    );
    allMainStats[sid] = mainStats;
    allSubRolls[sid] = subRolls;
    currentSheets[sid] = sheet;
    charFlex[sid] = winningFlex;
    step += 2; // combined main+sub steps
  }

  // ── Step 5: Re-roll main stats for carry (ignore main/sub conflicts) ──
  const carryFlex = charFlex[carryCharId] ?? undefined;
  yield yieldProgress("carry: refine main stats");
  await yieldFrame();
  allMainStats[carryCharId] = findBestMainStatsWithSubs(
    teamBuild,
    carryCharId,
    combo,
    currentSheets,
    allSubRolls[carryCharId],
    calcContext,
    carryRv,
    carryR,
    carryFlex
  );
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    carryRv,
    carryR,
    carryFlex
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
      carryRv,
      carryFlex
    );
    allSubRolls[carryCharId] = fillSubstats(
      teamBuild,
      carryCharId,
      combo,
      allMainStats[carryCharId],
      currentSheets,
      calcContext,
      carryRv,
      carryR,
      budgetPreset,
      refinedPreFill,
      carryFlex
    );
  }
  currentSheets[carryCharId] = buildSheetFromMainAndSubs(
    allMainStats[carryCharId],
    allSubRolls[carryCharId],
    carryRv,
    carryR,
    carryFlex
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
      combo,
      calcContext,
      buffOverrides
    );

    // Try the alternative circlet with fresh substats
    const altMainStats = { ...allMainStats[carryCharId], circlet: altCirclet };
    const altPreFill = getPreFill(
      carryCharId,
      carryGap,
      altMainStats,
      carryR,
      carryRv,
      carryFlex
    );
    const altSubRolls = fillSubstats(
      teamBuild,
      carryCharId,
      combo,
      altMainStats,
      currentSheets,
      calcContext,
      carryRv,
      carryR,
      budgetPreset,
      altPreFill,
      carryFlex
    );
    const altSheet = buildSheetFromMainAndSubs(
      altMainStats,
      altSubRolls,
      carryRv,
      carryR,
      carryFlex
    );
    const altSheets = { ...currentSheets, [carryCharId]: altSheet };
    const altDmg = evaluateDamage(
      teamBuild,
      altSheets,
      carryCharId,
      combo,
      calcContext,
      buffOverrides
    );

    if (altDmg > currentDmg) {
      allMainStats[carryCharId] = altMainStats;
      allSubRolls[carryCharId] = altSubRolls;
      currentSheets[carryCharId] = altSheet;
    }
  }
  step++;

  // ── Final result ──
  // Override set keys for flex slots: use a random 5★ set for icon display
  for (const cid of allCharIds) {
    const flex = charFlex[cid];
    if (flex && setKeysByChar[cid]) {
      setKeysByChar[cid] = {
        ...setKeysByChar[cid],
        [flex.slot]: pickRandom5StarSetKey(),
      };
    }
  }

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
      setKeysByChar?.[charId],
      charFlex[charId]
    );
    sheetsByChar[charId] = currentSheets[charId] ?? new StatSheet([]);
  }

  yield {
    artifactsByChar,
    sheetsByChar,
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
  charRvMap: Record<string, Record<SubStat, number>>,
  setKeysByChar?: Record<string, Record<Slot, string>>
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

  return {
    artifactsByChar,
    sheetsByChar,
    phase,
    progress,
    done: false,
  };
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
