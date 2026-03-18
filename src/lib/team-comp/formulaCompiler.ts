/**
 * AST-based damage formula compiler.
 *
 * Compiles the full damage evaluation pipeline (stat resolution + buff application +
 * formula computation) into a single compiled function that takes a Float64Array
 * of artifact stat contributions and returns a damage number.
 *
 * Usage in the optimizer hot path:
 *   1. Call compileTeamDamage() once per B&B setup
 *   2. For each artifact combination, fill a Float64Array with artifact stat deltas
 *   3. Call compiled.evaluate(vars) → damage number
 *
 * This eliminates all Map lookups, object allocations, and virtual dispatch from
 * the inner loop, leaving ~20-50 arithmetic ops per evaluation.
 */

import { CrossScalingBuff, ScalingBuff } from "./damageBuffs";
import type { OptimizerContext, TeamBuild } from "./damageCalc";
import type { CharacterBase, FormulaPart } from "./damageModels";
import { StatBuff, StatSheet } from "./damageModels";
import { type Expr, E, compileExpr, simplify } from "./expr";
import { ExprStats, VarMapping, createExprStats } from "./exprStats";
import type {
  CalcContext,
  ComboFormula,
  DamageTag,
  ReactionOverride,
  ReactionType,
  StatKey,
} from "./types";
import { resolvePartReaction } from "./types";
import { createReactionVariant } from "./damageFormulas";
import { ELEMENT_ELIGIBLE_REACTIONS } from "./constants";

// ─── Public Interface ───

export interface CompiledTeamDamage {
  /** The flat variable layout */
  varMapping: VarMapping;
  /** Evaluate total damage from artifact stat arrays */
  evaluate: (vars: Float64Array) => number;
  /** ER check: returns total ER for constraint-checked character */
  evaluateEr?: (vars: Float64Array) => number;
  /** CR check: returns total CR for constraint-checked character */
  evaluateCr?: (vars: Float64Array) => number;
  /** Number of variables */
  numVars: number;
  /** The raw expression (for testing/debugging) */
  damageExpr: Expr;
}

// ─── All possible artifact stat keys ───

/** Stats that can appear on artifacts (main + sub). */
const ARTIFACT_STAT_KEYS: StatKey[] = [
  "hp",
  "hp%",
  "atk",
  "atk%",
  "def",
  "def%",
  "em",
  "er",
  "cr",
  "cd",
  "pyro%",
  "hydro%",
  "electro%",
  "cryo%",
  "dendro%",
  "anemo%",
  "geo%",
  "phys%",
];

// ─── Compilation Pipeline ───

/**
 * Build postExprStats for a given optimizer context, using a shared VarMapping.
 * This is the core pipeline shared between single-formula and combo compilation.
 */
function buildPostExprStatsForContext(
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  charIdx: number,
  calcContext: CalcContext
): Record<string, ExprStats> {
  const { swapCharId, charBuildOrder, supportPreStats, targetDependent } =
    optCtx;

  const charBuild =
    charBuildOrder.find(([id]) => id === swapCharId)?.[1] ?? null;
  if (!charBuild)
    throw new Error(`Character ${swapCharId} not found in team build`);

  const emptySheet = new StatSheet([]);
  const swapBaseline = charBuild.getPreStats(
    emptySheet,
    targetDependent[swapCharId] ?? []
  );

  const exprStatsMap: Record<string, ExprStats> = {};
  for (const [id] of charBuildOrder) {
    if (id === swapCharId) {
      exprStatsMap[id] = createExprStats(
        swapBaseline,
        charIdx,
        varMapping,
        new Set(ARTIFACT_STAT_KEYS)
      );
    } else {
      exprStatsMap[id] = createExprStats(
        supportPreStats[id]!,
        -1,
        varMapping,
        new Set()
      );
    }
  }

  const dynamicBuffExprs = collectDynamicBuffExprs(
    teamBuild,
    exprStatsMap,
    swapCharId,
    supportPreStats,
    swapBaseline
  );

  const postExprStats = applyDynamicBuffExprs(
    exprStatsMap,
    dynamicBuffExprs,
    teamBuild,
    swapCharId,
    optCtx
  );

  if (calcContext.critRateTarget != null) {
    const crDelta = (100 - calcContext.critRateTarget) / 100;
    for (const id of Object.keys(postExprStats)) {
      postExprStats[id] = postExprStats[id].withMergedConst([
        { key: "cr", value: crDelta },
      ]);
    }
  }

  return postExprStats;
}

/**
 * Compile a team's damage formula into a single optimized function.
 *
 * @param teamBuild - The team build configuration
 * @param formulaCharId - Character whose formula to evaluate
 * @param formulaId - Which formula to compile
 * @param calcContext - Enemy level, res, crit mode
 * @param optCtx - Pre-computed optimizer context (has support preStats, target-dependent buffs)
 * @param reactionOverride - Optional reaction override
 * @param erCheckCharId - Character to check ER constraint on
 * @param minEr - ER threshold (e.g. 1.6 for 160%)
 * @param minCr - CR threshold (e.g. 0.7 for 70%)
 */
export function compileTeamDamage(
  teamBuild: TeamBuild,
  formulaCharId: string,
  formulaId: string,
  calcContext: CalcContext,
  optCtx: OptimizerContext,
  reactionOverride?: ReactionOverride,
  erCheckCharId?: string,
  minEr?: number,
  minCr?: number
): CompiledTeamDamage {
  const varMapping = new VarMapping();
  const charIdx = optCtx.charBuildOrder.findIndex(
    ([id]) => id === optCtx.swapCharId
  );

  const postExprStats = buildPostExprStatsForContext(
    teamBuild,
    optCtx,
    varMapping,
    charIdx,
    calcContext
  );

  // Build formula Expr
  const formulaCharBuild = optCtx.charBuildOrder.find(
    ([id]) => id === formulaCharId
  )?.[1];
  if (!formulaCharBuild)
    throw new Error(`Formula char ${formulaCharId} not found`);

  const charBase = formulaCharBuild.charBase;
  const entry = charBase.getFormulaEntry(formulaId);
  if (!entry) throw new Error(`Unknown formula: ${formulaId}`);

  const formulaStats = postExprStats[formulaCharId]!;
  const damageExpr = buildTotalDamageExpr(
    entry.parts,
    formulaStats,
    charBase,
    calcContext,
    reactionOverride
  );

  const simplified = simplify(damageExpr);
  const evaluate = compileExpr(simplified);

  // Compile ER/CR constraint expressions
  let evaluateEr: ((vars: Float64Array) => number) | undefined;
  let evaluateCr: ((vars: Float64Array) => number) | undefined;

  if (erCheckCharId) {
    const erStats = postExprStats[erCheckCharId];
    if (erStats) {
      if (minEr && minEr > 0) {
        const erExpr = simplify(
          E.add(erStats.get("er"), E.const(-minEr))
        );
        evaluateEr = compileExpr(erExpr);
      }
      if (minCr && minCr > 0) {
        const crExpr = simplify(
          E.add(erStats.get("cr"), E.const(-minCr))
        );
        evaluateCr = compileExpr(crExpr);
      }
    }
  }

  return {
    varMapping,
    evaluate,
    evaluateEr,
    evaluateCr,
    numVars: varMapping.totalVars,
    damageExpr: simplified,
  };
}

/**
 * Compile a combo formula into a single optimized function.
 * Each combo line may have a different on-field character, so we build
 * separate postStats per unique on-field context, sharing a single VarMapping.
 */
export function compileComboTeamDamage(
  teamBuild: TeamBuild,
  combo: ComboFormula,
  swapCharId: string,
  baseSheets: Record<string, StatSheet>,
  calcContext: CalcContext,
  singleModeOverrides?: Record<string, ReactionOverride>
): CompiledTeamDamage {
  const allFormulas = teamBuild.getFormulaIds();
  const validLines = combo.lines.filter((line) => {
    const charFormulas = allFormulas[line.charId];
    return charFormulas && charFormulas[line.formulaId];
  });

  if (validLines.length === 0) {
    const vm = new VarMapping();
    return {
      varMapping: vm,
      evaluate: () => 0,
      numVars: 0,
      damageExpr: E.const(0),
    };
  }

  // Group lines by on-field character (= calcTargetId)
  const linesByCalcTarget = new Map<
    string,
    typeof validLines
  >();
  for (const line of validLines) {
    let group = linesByCalcTarget.get(line.charId);
    if (!group) {
      group = [];
      linesByCalcTarget.set(line.charId, group);
    }
    group.push(line);
  }

  const varMapping = new VarMapping();
  const allPartExprs: Expr[] = [];

  for (const [calcTargetId, lines] of linesByCalcTarget) {
    const optCtx = teamBuild.createOptimizerContext(
      baseSheets,
      swapCharId,
      calcTargetId,
      calcContext
    );
    const charIdx = optCtx.charBuildOrder.findIndex(
      ([id]) => id === swapCharId
    );

    const postExprStats = buildPostExprStatsForContext(
      teamBuild,
      optCtx,
      varMapping,
      charIdx,
      calcContext
    );

    for (const line of lines) {
      const formulaCharBuild = optCtx.charBuildOrder.find(
        ([id]) => id === line.charId
      )?.[1];
      if (!formulaCharBuild) continue;

      const charBase = formulaCharBuild.charBase;
      const entry = charBase.getFormulaEntry(line.formulaId);
      if (!entry) continue;

      // Merge reaction overrides: single-mode as defaults, combo line on top
      let effectiveReaction = line.reaction;
      if (singleModeOverrides) {
        const key = `${line.charId}.${line.formulaId}`;
        const singleOverride = singleModeOverrides[key];
        if (singleOverride && effectiveReaction) {
          effectiveReaction = {
            ...effectiveReaction,
            partReactions: {
              ...singleOverride.partReactions,
              ...effectiveReaction.partReactions,
            },
            partHits: {
              ...singleOverride.partHits,
              ...effectiveReaction.partHits,
            },
          };
          if (
            effectiveReaction.partReactions &&
            Object.keys(effectiveReaction.partReactions).length === 0
          )
            effectiveReaction.partReactions = undefined;
          if (
            effectiveReaction.partHits &&
            Object.keys(effectiveReaction.partHits).length === 0
          )
            effectiveReaction.partHits = undefined;
        } else if (singleOverride && !effectiveReaction) {
          effectiveReaction = singleOverride;
        }
      }

      const formulaStats = postExprStats[line.charId]!;
      const lineExpr = buildTotalDamageExpr(
        entry.parts,
        formulaStats,
        charBase,
        calcContext,
        effectiveReaction
      );
      allPartExprs.push(E.mul(lineExpr, E.const(line.count)));
    }
  }

  if (allPartExprs.length === 0) {
    return {
      varMapping,
      evaluate: () => 0,
      numVars: varMapping.totalVars,
      damageExpr: E.const(0),
    };
  }

  const damageExpr = simplify(E.add(...allPartExprs));
  const evaluate = compileExpr(damageExpr);

  return {
    varMapping,
    evaluate,
    numVars: varMapping.totalVars,
    damageExpr,
  };
}

// ─── Dynamic Buff Expression Collection ───

interface DynamicBuffExpr {
  key: StatKey;
  expr: Expr;
  target: StatBuff["target"];
  providerCharId: string;
  source: StatBuff["source"];
}

function collectDynamicBuffExprs(
  teamBuild: TeamBuild,
  exprStatsMap: Record<string, ExprStats>,
  swapCharId: string,
  supportPreStats: Record<string, StatSheet>,
  swapBaseline: StatSheet
): DynamicBuffExpr[] {
  const results: DynamicBuffExpr[] = [];

  // Build teamPreStatsArr at baseline (supports have fixed artifacts, swap has none).
  // Used for fallback numeric evaluation of opaque dynamicBuffs (e.g. Nahida P1).
  const teamPreStatsArr: StatSheet[] = [];
  const charIds = Object.keys(exprStatsMap);
  for (const id of charIds) {
    if (id === swapCharId) {
      teamPreStatsArr.push(swapBaseline);
    } else if (supportPreStats[id]) {
      teamPreStatsArr.push(supportPreStats[id]);
    }
  }

  for (const { buff, providerCharId } of teamBuild.allStaticBuffs) {
    if (providerCharId === "resonance") continue;

    const ownerStats = exprStatsMap[providerCharId];
    if (!ownerStats) continue;

    if (buff instanceof ScalingBuff) {
      for (const { key, expr } of buff.dynamicBuffsExpr(ownerStats)) {
        results.push({
          key,
          expr,
          target: buff.target,
          providerCharId,
          source: buff.source,
        });
      }
    } else if (buff instanceof CrossScalingBuff) {
      for (const { key, expr } of buff.dynamicBuffsExpr(ownerStats)) {
        results.push({
          key,
          expr,
          target: buff.target,
          providerCharId,
          source: buff.source,
        });
      }
    } else if (buff.dynamicBuffsExprTeam) {
      // Expr-aware team dynamic buff (e.g. Nahida P1)
      const teamExprStatsArr = charIds.map((id) => exprStatsMap[id]!);
      for (const { key, expr } of buff.dynamicBuffsExprTeam(ownerStats, teamExprStatsArr)) {
        results.push({
          key,
          expr,
          target: buff.target,
          providerCharId,
          source: buff.source,
        });
      }
    } else if (buff.dynamicBuffs !== StatBuff.prototype.dynamicBuffs) {
      // Opaque dynamicBuffs override — fallback to numeric evaluation at baseline.
      const ownerSheet =
        providerCharId === swapCharId
          ? swapBaseline
          : (supportPreStats[providerCharId] ?? swapBaseline);
      const entries = buff.dynamicBuffs(ownerSheet, teamPreStatsArr);
      for (const { key, value } of entries) {
        results.push({
          key,
          expr: E.const(value),
          target: buff.target,
          providerCharId,
          source: buff.source,
        });
      }
    }
  }

  return results;
}

// ─── Apply Dynamic Buffs as Expr ───

function applyDynamicBuffExprs(
  preExprStats: Record<string, ExprStats>,
  dynamicBuffExprs: DynamicBuffExpr[],
  teamBuild: TeamBuild,
  swapCharId: string,
  optCtx: OptimizerContext
): Record<string, ExprStats> {
  // For now, bake dynamic buff values as constants evaluated at the support preStats,
  // unless the provider is the swapChar (then use Expr).
  // This is a simplification that works when only one character has variable artifacts.

  const result: Record<string, ExprStats> = {};

  for (const [id] of optCtx.charBuildOrder) {
    let stats = preExprStats[id]!;

    // Collect applicable dynamic buffs for this character
    for (const dbExpr of dynamicBuffExprs) {
      if (
        !isBuffApplicableSimple(
          dbExpr.target,
          dbExpr.providerCharId,
          id,
          optCtx.calcTargetId,
          teamBuild
        )
      ) {
        continue;
      }

      if (dbExpr.expr.tag === "const") {
        // Constant dynamic buff — merge as constant
        stats = stats.withMergedConst(
          [{ key: dbExpr.key, value: dbExpr.expr.value }],
          dbExpr.target.filter
        );
      } else {
        // Variable dynamic buff — merge the Expr directly into ExprStats.
        // The Expr contains variables referencing the provider's artifact stats,
        // so it will evaluate correctly for each artifact combination.
        stats = stats.withMergedExpr(
          [{ key: dbExpr.key, expr: dbExpr.expr }],
          dbExpr.target.filter
        );
      }
    }

    result[id] = stats;
  }

  return result;
}

/** Simplified buff applicability check for the compiler. */
function isBuffApplicableSimple(
  target: StatBuff["target"],
  providerCharId: string,
  selfCharId: string,
  calcTargetId: string,
  teamBuild: TeamBuild
): boolean {
  const r = target.receiver;

  // Check charId restriction
  if (target.charId && target.charId !== selfCharId) return false;

  // Check region/faction
  if (target.regions) {
    const region = teamBuild.teamMeta.regions[selfCharId];
    if (!region || !target.regions.includes(region)) return false;
  }
  if (target.factions) {
    const faction = teamBuild.teamMeta.factions[selfCharId];
    if (!target.factions.includes(faction)) return false;
  }

  switch (r) {
    case "self":
    case "selfOffField":
      return providerCharId === selfCharId;
    case "selfOnField":
      return providerCharId === selfCharId && selfCharId === calcTargetId;
    case "onField":
      return selfCharId === calcTargetId;
    case "otherOnField":
      return selfCharId !== providerCharId && selfCharId === calcTargetId;
    case "team":
      return true;
    default:
      return false;
  }
}

// ─── Formula Expr Builder ───

function buildTotalDamageExpr(
  parts: FormulaPart[],
  formulaStats: ExprStats,
  charBase: CharacterBase,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride
): Expr {
  const partExprs: Expr[] = [];

  for (let idx = 0; idx < parts.length; idx++) {
    const { formula, hits: totalHits, bespokeBuff } = parts[idx];
    const h = totalHits ?? 1;

    // Apply bespoke buff overlay
    let stats = formulaStats;
    if (bespokeBuff) {
      // Merge static entries from bespoke buff
      stats = stats.withMergedConst(
        bespokeBuff.staticBuffs,
        bespokeBuff.target.filter
      );
      // Apply bespoke dynamic buffs
      if (bespokeBuff instanceof ScalingBuff || bespokeBuff instanceof CrossScalingBuff) {
        for (const { key, expr } of bespokeBuff.dynamicBuffsExpr(stats)) {
          if (expr.tag === "const") {
            stats = stats.withMergedConst(
              [{ key, value: expr.value }],
              bespokeBuff.target.filter
            );
          } else {
            stats = stats.withMergedExpr(
              [{ key, expr }],
              bespokeBuff.target.filter
            );
          }
        }
      }
    }

    const hasReaction =
      reactionOverride?.reaction && reactionOverride.reaction !== "none";

    if (!hasReaction || formula.tag.reaction !== "none") {
      // No reaction override or formula has built-in reaction
      const partExpr = formula.buildExpr(stats, charBase.charLevel, ctx);
      partExprs.push(E.mul(partExpr, E.const(h)));
      continue;
    }

    // Reaction override logic
    const partEligible =
      ELEMENT_ELIGIBLE_REACTIONS[
        formula.tag.element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
      ];
    const targetReaction = resolvePartReaction(
      reactionOverride,
      idx,
      partEligible
    );

    const reactingHits =
      targetReaction !== "none"
        ? Math.min(reactionOverride.partHits?.[idx] ?? h, h)
        : 0;
    const nonReactingHits = h - reactingHits;

    if (reactingHits > 0) {
      const effectiveFormula =
        targetReaction !== formula.tag.reaction
          ? createReactionVariant(formula, targetReaction)
          : formula;
      const partExpr = effectiveFormula.buildExpr(
        stats,
        charBase.charLevel,
        ctx
      );
      partExprs.push(E.mul(partExpr, E.const(reactingHits)));
    }
    if (nonReactingHits > 0) {
      const partExpr = formula.buildExpr(stats, charBase.charLevel, ctx);
      partExprs.push(E.mul(partExpr, E.const(nonReactingHits)));
    }
  }

  if (partExprs.length === 0) return E.const(0);
  return E.add(...partExprs);
}

// ─── Evaluation Helper for Optimizer ───

/**
 * Fill the Float64Array vars from an artifact tuple using the VarMapping.
 * Each artifact's stats are added to the appropriate variable indices.
 */
export function fillVarsFromArtifacts(
  artifacts: (import("@/data/types").ArtifactData | null)[],
  varMapping: VarMapping,
  charIdx: number,
  vars: Float64Array
): void {
  for (const art of artifacts) {
    if (!art) continue;
    // Add each stat contribution from the artifact
    for (const entry of StatSheet.fromArtifacts([art]).dump()) {
      const idx = varMapping.getVarIdx(charIdx, entry.key, entry.filterKey);
      if (idx !== undefined) {
        vars[idx] += entry.value;
      }
    }
  }
}

/**
 * Fill the Float64Array vars from a StatSheet (e.g. synthesized artifact sheet).
 * Used by idealArtifactGen compiled evaluation.
 */
export function fillVarsFromSheet(
  sheet: StatSheet,
  varMapping: VarMapping,
  charIdx: number,
  vars: Float64Array
): void {
  for (const entry of sheet.dump()) {
    const idx = varMapping.getVarIdx(charIdx, entry.key, entry.filterKey);
    if (idx !== undefined) {
      vars[idx] += entry.value;
    }
  }
}

/**
 * Fill the Float64Array vars from raw stat maps (e.g. super-artifact stats).
 * Used for upper bound evaluation in compiled mode.
 */
export function fillVarsFromRawStats(
  rawStats: Partial<Record<import("./types").StatKey, number>>[],
  varMapping: VarMapping,
  charIdx: number,
  vars: Float64Array
): void {
  for (const ss of rawStats) {
    const sheet = StatSheet.fromRaw(ss);
    for (const entry of sheet.dump()) {
      const idx = varMapping.getVarIdx(charIdx, entry.key, entry.filterKey);
      if (idx !== undefined) {
        vars[idx] += entry.value;
      }
    }
  }
}
