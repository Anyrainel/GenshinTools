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

import { getMainStatValueAtLevel } from "@/lib/account-data/scoring/utils";
import { ELEMENT_ELIGIBLE_REACTIONS } from "./constants";
import { CrossScalingBuff, ScalingBuff } from "./damageBuffs";
import {
  type OptimizerContext,
  type TeamBuild,
  hasOffFieldParts,
  isBuffApplicable,
} from "./damageCalc";
import { createReactionVariant } from "./damageFormulas";
import type { CharacterBase, FormulaPart } from "./damageModels";
import { StatBuff, StatSheet } from "./damageModels";
import { E, type Expr, compileExpr, simplify } from "./expr";
import { type ExprStats, VarMapping, createExprStats } from "./exprStats";
import type { PartialBuffInfo } from "./stackAllocation";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  DamageTag,
  ReactionOverride,
  ReactionType,
  StatKey,
} from "./types";
import { buffSourceKey, exclusionKey, resolvePartReaction } from "./types";

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
 * Build postExprStats excluding certain buffs (identified by buffSourceKey).
 * Used to pre-build stat variants for interval-based blending in the compiler.
 */
function buildPostExprStatsExcluding(
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  charIdx: number,
  calcContext: CalcContext,
  excludeKeys: Set<string>
): Record<string, ExprStats> {
  const { swapCharId, charBuildOrder, supportPreStats, targetDependent } =
    optCtx;

  const charBuild =
    charBuildOrder.find(([id]) => id === swapCharId)?.[1] ?? null;
  if (!charBuild)
    throw new Error(`Character ${swapCharId} not found in team build`);

  // Use exclusion-aware preStats for the swap character
  const emptySheet = new StatSheet([]);
  const swapBaseline = charBuild.getPreStatsExcluding(
    emptySheet,
    targetDependent[swapCharId] ?? [],
    teamBuild.allStaticBuffs,
    excludeKeys,
    swapCharId,
    teamBuild.teamMeta.regions[swapCharId],
    teamBuild.teamMeta.factions[swapCharId]
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
      // Support characters also need exclusion-aware preStats
      const supportBuild = charBuildOrder.find(([cid]) => cid === id)?.[1];
      if (supportBuild) {
        const supportExcluded = supportBuild.getPreStatsExcluding(
          optCtx.baseSheets[id] ?? new StatSheet([]),
          targetDependent[id] ?? [],
          teamBuild.allStaticBuffs,
          excludeKeys,
          id,
          teamBuild.teamMeta.regions[id],
          teamBuild.teamMeta.factions[id]
        );
        exprStatsMap[id] = createExprStats(
          supportExcluded,
          -1,
          varMapping,
          new Set()
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
  }

  // Collect dynamic buff exprs, filtering out excluded buff keys
  const dynamicBuffExprs = collectDynamicBuffExprs(
    teamBuild,
    exprStatsMap,
    swapCharId,
    supportPreStats,
    swapBaseline
  ).filter((b) => !excludeKeys.has(buffSourceKey(b.source)));

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
 * Build ExprStats variants for all exclusion combinations needed by PartialBuffInfos.
 * Returns a Map from exclusionKey → ExprStats for the formula character.
 */
function buildExprStatVariants(
  partialBuffs: PartialBuffInfo[],
  parts: FormulaPart[],
  formulaCharId: string,
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  charIdx: number,
  calcContext: CalcContext
): Map<string, ExprStats> {
  const variants = new Map<string, ExprStats>();
  const seen = new Set<string>();

  for (let idx = 0; idx < parts.length; idx++) {
    const h = parts[idx].hits ?? 1;
    const affecting = partialBuffs.filter((pb) => {
      const activated = pb.partActivation[idx] ?? h;
      return activated < h;
    });
    if (affecting.length === 0) continue;

    const cutpointSet = new Set<number>([0, h]);
    for (const pb of affecting) {
      const activated = pb.partActivation[idx] ?? h;
      if (activated > 0 && activated < h) cutpointSet.add(activated);
    }
    const cutpoints = [...cutpointSet].sort((a, b) => a - b);

    for (let i = 0; i < cutpoints.length - 1; i++) {
      const end = cutpoints[i + 1];
      const excludeSet = new Set<string>();
      for (const pb of affecting) {
        const activated = pb.partActivation[idx] ?? h;
        if (activated < end) excludeSet.add(pb.buffKey);
      }
      if (excludeSet.size === 0) continue;
      const eKey = exclusionKey(excludeSet);
      if (seen.has(eKey)) continue;
      seen.add(eKey);
      const excludedPostStats = buildPostExprStatsExcluding(
        teamBuild,
        optCtx,
        varMapping,
        charIdx,
        calcContext,
        excludeSet
      );
      variants.set(eKey, excludedPostStats[formulaCharId]!);
    }
  }

  return variants;
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
  minCr?: number,
  partialBuffs?: PartialBuffInfo[]
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

  // Compute off-field ExprStats if the formula has off-field parts
  let offFieldFormulaStats: ExprStats | undefined;
  if (entry.parts.some((p) => p.offField)) {
    const otherCharId = optCtx.charBuildOrder
      .map(([id]) => id)
      .find((id) => id !== formulaCharId);
    if (otherCharId) {
      const offFieldOptCtx = teamBuild.createOptimizerContext(
        optCtx.baseSheets,
        optCtx.swapCharId,
        otherCharId,
        calcContext
      );
      const offFieldPostExprStats = buildPostExprStatsForContext(
        teamBuild,
        offFieldOptCtx,
        varMapping,
        charIdx,
        calcContext
      );
      offFieldFormulaStats = offFieldPostExprStats[formulaCharId];
    }
  }

  // Pre-build ExprStats variants for partial buff blending
  let exprStatVariants: Map<string, ExprStats> | undefined;
  let offFieldExprVariants: Map<string, ExprStats> | undefined;
  if (partialBuffs && partialBuffs.length > 0) {
    exprStatVariants = buildExprStatVariants(
      partialBuffs,
      entry.parts,
      formulaCharId,
      teamBuild,
      optCtx,
      varMapping,
      charIdx,
      calcContext
    );
    if (offFieldFormulaStats) {
      const otherCharId = optCtx.charBuildOrder
        .map(([id]) => id)
        .find((id) => id !== formulaCharId);
      if (otherCharId) {
        const offFieldOptCtx = teamBuild.createOptimizerContext(
          optCtx.baseSheets,
          optCtx.swapCharId,
          otherCharId,
          calcContext
        );
        offFieldExprVariants = buildExprStatVariants(
          partialBuffs,
          entry.parts,
          formulaCharId,
          teamBuild,
          offFieldOptCtx,
          varMapping,
          charIdx,
          calcContext
        );
      }
    }
  }

  const damageExpr = buildTotalDamageExpr(
    entry.parts,
    formulaStats,
    charBase,
    calcContext,
    reactionOverride,
    offFieldFormulaStats,
    partialBuffs,
    exprStatVariants,
    offFieldExprVariants
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
          E.add(erStats.get("er", null), E.const(-minEr))
        );
        evaluateEr = compileExpr(erExpr);
      }
      if (minCr && minCr > 0) {
        const crExpr = simplify(
          E.add(erStats.get("cr", null), E.const(-minCr))
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
  singleModeOverrides?: Record<string, ReactionOverride>,
  buffOverrides?: Record<string, PartialBuffInfo[]>
): CompiledTeamDamage {
  const allFormulas = teamBuild.getFormulaIds();
  const validLines = combo.lines.filter((line) => {
    const charFormulas = allFormulas[line.charId];
    return charFormulas?.[line.formulaId];
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
  const linesByCalcTarget = new Map<string, typeof validLines>();
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

      // Compute off-field ExprStats if the formula has off-field parts
      let offFieldFormulaStats: ExprStats | undefined;
      if (entry.parts.some((p) => p.offField)) {
        const otherCharId = optCtx.charBuildOrder
          .map(([id]) => id)
          .find((id) => id !== line.charId);
        if (otherCharId) {
          const offFieldOptCtx = teamBuild.createOptimizerContext(
            baseSheets,
            swapCharId,
            otherCharId,
            calcContext
          );
          const offFieldPostExprStats = buildPostExprStatsForContext(
            teamBuild,
            offFieldOptCtx,
            varMapping,
            charIdx,
            calcContext
          );
          offFieldFormulaStats = offFieldPostExprStats[line.charId];
        }
      }

      // Look up by line index first (for per-line combo overrides), then formula key
      const lineIdx = validLines.indexOf(line);
      const lineKey = `${line.charId}.${line.formulaId}`;
      const linePartialBuffs =
        buffOverrides?.[`line:${lineIdx}`] ?? buffOverrides?.[lineKey];

      // Pre-build ExprStats variants for partial buff blending
      let lineExprVariants: Map<string, ExprStats> | undefined;
      let lineOffFieldVariants: Map<string, ExprStats> | undefined;
      if (linePartialBuffs && linePartialBuffs.length > 0) {
        lineExprVariants = buildExprStatVariants(
          linePartialBuffs,
          entry.parts,
          line.charId,
          teamBuild,
          optCtx,
          varMapping,
          charIdx,
          calcContext
        );
        if (offFieldFormulaStats) {
          const otherCharId2 = optCtx.charBuildOrder
            .map(([id]) => id)
            .find((id) => id !== line.charId);
          if (otherCharId2) {
            const offFieldOptCtx2 = teamBuild.createOptimizerContext(
              baseSheets,
              swapCharId,
              otherCharId2,
              calcContext
            );
            lineOffFieldVariants = buildExprStatVariants(
              linePartialBuffs,
              entry.parts,
              line.charId,
              teamBuild,
              offFieldOptCtx2,
              varMapping,
              charIdx,
              calcContext
            );
          }
        }
      }

      const lineExpr = buildTotalDamageExpr(
        entry.parts,
        formulaStats,
        charBase,
        calcContext,
        effectiveReaction,
        offFieldFormulaStats,
        linePartialBuffs,
        lineExprVariants,
        lineOffFieldVariants
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
      for (const { key, expr } of buff.dynamicBuffsExprTeam(
        ownerStats,
        teamExprStatsArr
      )) {
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

/**
 * Deduplicate dynamic buff Exprs by noStackId.
 *
 * When all competing buffs in a group are const, we pick the highest (same as
 * the standard path). When any buff is variable (depends on swap-char
 * artifacts), the runtime value may differ from the compile-time baseline, so
 * we emit E.max(...) to let the JIT resolve the winner at evaluation time.
 */
function deduplicateDynamicBuffExprs(
  buffs: DynamicBuffExpr[]
): DynamicBuffExpr[] {
  const result: DynamicBuffExpr[] = [];
  const groups = new Map<string, DynamicBuffExpr[]>();

  for (const b of buffs) {
    if (!b.source.noStackId) {
      result.push(b);
    } else {
      let g = groups.get(b.source.noStackId);
      if (!g) {
        g = [];
        groups.set(b.source.noStackId, g);
      }
      g.push(b);
    }
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }

    // Check if any Expr in the group is variable (non-const)
    const hasVariable = group.some((b) => b.expr.tag !== "const");

    if (!hasVariable) {
      // All const: pick the one with the highest value (same as standard path)
      let best = group[0]!;
      let maxVal = Number.NEGATIVE_INFINITY;
      for (const b of group) {
        const val = b.expr.tag === "const" ? b.expr.value : 0;
        if (val > maxVal) {
          maxVal = val;
          best = b;
        }
      }
      result.push(best);
    } else {
      // Variable group: emit E.max across all competing exprs.
      // All entries share the same output key and filter (noStackId groups
      // always produce the same stat — e.g., gleam resonance → reactionDmg%).
      // Use the first entry as the template for key/target/etc., replacing its
      // expr with E.max(expr1, expr2, ...).
      const template = group[0]!;
      let merged = group[0]!.expr;
      for (let i = 1; i < group.length; i++) {
        merged = E.max(merged, group[i]!.expr);
      }
      result.push({
        ...template,
        expr: simplify(merged),
      });
    }
  }

  return result;
}

function applyDynamicBuffExprs(
  preExprStats: Record<string, ExprStats>,
  dynamicBuffExprs: DynamicBuffExpr[],
  teamBuild: TeamBuild,
  swapCharId: string,
  optCtx: OptimizerContext
): Record<string, ExprStats> {
  const result: Record<string, ExprStats> = {};

  for (const [id] of optCtx.charBuildOrder) {
    let stats = preExprStats[id]!;

    // Filter applicable dynamic buffs for this character — reuse the standard isBuffApplicable
    const applicable = dynamicBuffExprs.filter((dbExpr) =>
      isBuffApplicable(
        // Wrap as a minimal StatBuff-like object for isBuffApplicable
        { target: dbExpr.target, source: dbExpr.source } as StatBuff,
        dbExpr.providerCharId,
        id,
        optCtx.calcTargetId,
        teamBuild.teamMeta.regions[id],
        teamBuild.teamMeta.factions[id]
      )
    );

    // Deduplicate by noStackId — for all-const groups, picks the highest
    // (same as standard path). For variable groups, emits E.max to defer
    // the winner choice to runtime.
    const deduped = deduplicateDynamicBuffExprs(applicable);

    for (const dbExpr of deduped) {
      if (dbExpr.expr.tag === "const") {
        stats = stats.withMergedConst(
          [{ key: dbExpr.key, value: dbExpr.expr.value }],
          dbExpr.target.filter
        );
      } else {
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

// ─── Formula Expr Builder ───

function buildTotalDamageExpr(
  parts: FormulaPart[],
  formulaStats: ExprStats,
  charBase: CharacterBase,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  offFieldFormulaStats?: ExprStats,
  partialBuffs?: PartialBuffInfo[],
  statsVariants?: Map<string, ExprStats>,
  offFieldVariants?: Map<string, ExprStats>
): Expr {
  const partExprs: Expr[] = [];

  for (let idx = 0; idx < parts.length; idx++) {
    const { formula, hits: totalHits, bespokeBuff, offField } = parts[idx];
    const h = totalHits ?? 1;

    // Use off-field stats when the part deals damage while the character is off-field
    const baseStats =
      offField && offFieldFormulaStats ? offFieldFormulaStats : formulaStats;
    const baseVariants =
      offField && offFieldVariants ? offFieldVariants : statsVariants;

    // Apply bespoke buff overlay
    let stats = baseStats;
    if (bespokeBuff) {
      // Merge static entries from bespoke buff
      stats = stats.withMergedConst(
        bespokeBuff.staticBuffs,
        bespokeBuff.target.filter
      );
      // Apply bespoke dynamic buffs
      if (
        bespokeBuff instanceof ScalingBuff ||
        bespokeBuff instanceof CrossScalingBuff
      ) {
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

    // Collect partial buffs affecting this part
    const partPartials = partialBuffs?.filter((pb) => {
      const activated = pb.partActivation[idx];
      return activated !== undefined && activated < h;
    });

    if (!hasReaction || formula.tag.reaction !== "none") {
      // No reaction override or formula has built-in reaction
      if (partPartials && partPartials.length > 0) {
        // Build blended expression for partial buff activation
        emitBlendedPartExprs(
          partExprs,
          formula,
          stats,
          charBase,
          ctx,
          h,
          idx,
          partPartials,
          baseVariants,
          bespokeBuff
        );
      } else {
        const partExpr = formula.buildExpr(stats, charBase.charLevel, ctx);
        partExprs.push(E.mul(partExpr, E.const(h)));
      }
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
      if (partPartials && partPartials.length > 0) {
        emitBlendedPartExprs(
          partExprs,
          effectiveFormula,
          stats,
          charBase,
          ctx,
          reactingHits,
          idx,
          partPartials,
          baseVariants,
          bespokeBuff
        );
      } else {
        const partExpr = effectiveFormula.buildExpr(
          stats,
          charBase.charLevel,
          ctx
        );
        partExprs.push(E.mul(partExpr, E.const(reactingHits)));
      }
    }
    if (nonReactingHits > 0) {
      if (partPartials && partPartials.length > 0) {
        emitBlendedPartExprs(
          partExprs,
          formula,
          stats,
          charBase,
          ctx,
          nonReactingHits,
          idx,
          partPartials,
          baseVariants,
          bespokeBuff
        );
      } else {
        const partExpr = formula.buildExpr(stats, charBase.charLevel, ctx);
        partExprs.push(E.mul(partExpr, E.const(nonReactingHits)));
      }
    }
  }

  if (partExprs.length === 0) return E.const(0);
  return E.add(...partExprs);
}

/**
 * Emit blended damage expressions for a part with partial buff activation.
 *
 * Uses interval-based blending: sorts buff cutoff points to create intervals
 * where different combinations of buffs are active, then emits a weighted
 * sum of expressions for each interval.
 *
 * Instead of negating buff entries, looks up pre-built ExprStats variants
 * for each exclusion combination and applies bespoke overlay on top.
 *
 * Example with buff1 (3/5 hits) and buff2 (2/5 hits) on a 5-hit part:
 *   2 × expr(b1,b2) + 1 × expr(b1) + 2 × expr()
 */
function emitBlendedPartExprs(
  partExprs: Expr[],
  formula: {
    buildExpr: (stats: ExprStats, charLevel: number, ctx: CalcContext) => Expr;
    tag: DamageTag;
  },
  defaultStats: ExprStats,
  charBase: CharacterBase,
  ctx: CalcContext,
  totalHits: number,
  partIdx: number,
  partials: PartialBuffInfo[],
  statsVariants?: Map<string, ExprStats>,
  bespokeBuff?: StatBuff
): void {
  // Collect affecting partials
  const affecting = partials.filter((pb) => {
    const activated = pb.partActivation[partIdx] ?? totalHits;
    return activated < totalHits;
  });

  if (affecting.length === 0) {
    const expr = formula.buildExpr(defaultStats, charBase.charLevel, ctx);
    partExprs.push(E.mul(expr, E.const(totalHits)));
    return;
  }

  // Build interval cutpoints from activation counts
  const cutpointSet = new Set<number>([0, totalHits]);
  for (const pb of affecting) {
    const activated = pb.partActivation[partIdx] ?? totalHits;
    if (activated > 0 && activated < totalHits) cutpointSet.add(activated);
  }
  const cutpoints = [...cutpointSet].sort((a, b) => a - b);

  // Emit one expression per interval
  for (let i = 0; i < cutpoints.length - 1; i++) {
    const end = cutpoints[i + 1];
    const width = cutpoints[i + 1] - cutpoints[i];
    if (width <= 0) continue;

    // Determine which buffs are inactive in this interval
    const excludeSet = new Set<string>();
    for (const pb of affecting) {
      const activated = pb.partActivation[partIdx] ?? totalHits;
      if (activated < end) excludeSet.add(pb.buffKey);
    }

    // Look up pre-built variant or use default stats
    let intervalStats: ExprStats;
    if (excludeSet.size === 0) {
      intervalStats = defaultStats;
    } else {
      const eKey = exclusionKey(excludeSet);
      const variant = statsVariants?.get(eKey);
      if (variant) {
        // Apply bespoke buff overlay on top of the variant
        intervalStats = applyBespokeOverlay(variant, bespokeBuff);
      } else {
        // Fallback: use default stats (shouldn't happen if variants were pre-built correctly)
        intervalStats = defaultStats;
      }
    }

    const expr = formula.buildExpr(intervalStats, charBase.charLevel, ctx);
    partExprs.push(E.mul(expr, E.const(width)));
  }
}

/** Apply bespoke buff overlay to ExprStats (static + dynamic parts). */
function applyBespokeOverlay(
  stats: ExprStats,
  bespokeBuff?: StatBuff
): ExprStats {
  if (!bespokeBuff) return stats;

  let result = stats.withMergedConst(
    bespokeBuff.staticBuffs,
    bespokeBuff.target.filter
  );

  if (
    bespokeBuff instanceof ScalingBuff ||
    bespokeBuff instanceof CrossScalingBuff
  ) {
    for (const { key, expr } of bespokeBuff.dynamicBuffsExpr(result)) {
      if (expr.tag === "const") {
        result = result.withMergedConst(
          [{ key, value: expr.value }],
          bespokeBuff.target.filter
        );
      } else {
        result = result.withMergedExpr(
          [{ key, expr }],
          bespokeBuff.target.filter
        );
      }
    }
  }

  return result;
}

// ─── Evaluation Helpers for Optimizer ───

// Elemental DMG stat keys → normalized key + filterKey
const ELEMENTAL_DMG_FILTER: Record<string, string> = {
  "pyro%": "e:Pyro",
  "hydro%": "e:Hydro",
  "electro%": "e:Electro",
  "cryo%": "e:Cryo",
  "dendro%": "e:Dendro",
  "anemo%": "e:Anemo",
  "geo%": "e:Geo",
  "phys%": "e:Physical",
};

const FLAT_STAT_SET = new Set(["hp", "atk", "def", "em"]);

/**
 * Pre-computed lookup table for fast artifact stat → var index mapping.
 * Avoids Map.get() calls and stat key normalization in the hot loop.
 */
export interface ArtifactVarLookup {
  /** Map from raw stat key (e.g. "atk%", "pyro%") → var index. -1 if unmapped. */
  keyToIdx: Map<string, number>;
  /** Map from raw stat key → true if it's a percentage stat (needs /100 conversion). */
  keyIsPct: Map<string, boolean>;
}

/**
 * Build a fast lookup table for a character's artifact stat → var index mapping.
 * Call once per compiled formula; reuse across all evaluations.
 */
export function buildArtifactVarLookup(
  varMapping: VarMapping,
  charIdx: number
): ArtifactVarLookup {
  const keyToIdx = new Map<string, number>();
  const keyIsPct = new Map<string, boolean>();

  // All possible artifact stat keys (main + sub)
  const allStatKeys = [
    "hp",
    "atk",
    "def",
    "em",
    "er",
    "hp%",
    "atk%",
    "def%",
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
    "heal%",
  ];

  for (const rawKey of allStatKeys) {
    const elFilter = ELEMENTAL_DMG_FILTER[rawKey];
    const normalizedKey = elFilter ? "dmg%" : rawKey;
    const filterKey = elFilter ?? "";
    const idx = varMapping.getVarIdx(
      charIdx,
      normalizedKey as StatKey,
      filterKey
    );
    if (idx !== undefined) {
      keyToIdx.set(rawKey, idx);
      keyIsPct.set(rawKey, !FLAT_STAT_SET.has(rawKey));
    }
  }

  return { keyToIdx, keyIsPct };
}

/**
 * Fill the Float64Array vars from an artifact tuple using a pre-built lookup.
 * Zero allocations, no Map construction — directly reads artifact stats.
 */
export function fillVarsFromArtifacts(
  artifacts: (import("@/data/types").ArtifactData | null)[],
  varMapping: VarMapping,
  charIdx: number,
  vars: Float64Array
): void {
  for (const art of artifacts) {
    if (!art) continue;
    // Main stat
    const mainKey = art.mainStatKey;
    if (mainKey) {
      const idx = lookupVarIdx(varMapping, charIdx, mainKey);
      if (idx !== undefined) {
        const displayVal = getMainStatValueAtLevel(
          mainKey as import("@/data/types").MainStat,
          art.rarity,
          art.level
        );
        vars[idx] += FLAT_STAT_SET.has(mainKey) ? displayVal : displayVal / 100;
      }
    }
    // Substats
    if (art.substats) {
      for (const subKey of Object.keys(art.substats)) {
        const subVal = art.substats[subKey as keyof typeof art.substats];
        if (!subVal) continue;
        const idx = lookupVarIdx(varMapping, charIdx, subKey);
        if (idx !== undefined) {
          vars[idx] += FLAT_STAT_SET.has(subKey) ? subVal : subVal / 100;
        }
      }
    }
  }
}

/**
 * Fill vars from artifacts using a pre-built ArtifactVarLookup.
 * Even faster than fillVarsFromArtifacts — avoids VarMapping.getVarIdx() calls.
 */
export function fillVarsFromArtifactsFast(
  artifacts: (import("@/data/types").ArtifactData | null)[],
  lookup: ArtifactVarLookup,
  vars: Float64Array
): void {
  for (const art of artifacts) {
    if (!art) continue;
    // Main stat
    const mainKey = art.mainStatKey;
    if (mainKey) {
      const idx = lookup.keyToIdx.get(mainKey);
      if (idx !== undefined) {
        const displayVal = getMainStatValueAtLevel(
          mainKey as import("@/data/types").MainStat,
          art.rarity,
          art.level
        );
        vars[idx] += lookup.keyIsPct.get(mainKey)
          ? displayVal / 100
          : displayVal;
      }
    }
    // Substats
    if (art.substats) {
      for (const subKey of Object.keys(art.substats)) {
        const subVal = art.substats[subKey as keyof typeof art.substats];
        if (!subVal) continue;
        const idx = lookup.keyToIdx.get(subKey);
        if (idx !== undefined) {
          vars[idx] += lookup.keyIsPct.get(subKey) ? subVal / 100 : subVal;
        }
      }
    }
  }
}

/** Look up a var index for an artifact stat key, handling elemental DMG normalization. */
function lookupVarIdx(
  varMapping: VarMapping,
  charIdx: number,
  rawKey: string
): number | undefined {
  const elFilter = ELEMENTAL_DMG_FILTER[rawKey];
  if (elFilter) {
    return varMapping.getVarIdx(charIdx, "dmg%" as StatKey, elFilter);
  }
  return varMapping.getVarIdx(charIdx, rawKey as StatKey, "");
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
  /** Number of entries to read from rawStats. If undefined, reads all. */
  count: number | undefined,
  varMapping: VarMapping,
  charIdx: number,
  vars: Float64Array
): void {
  const len = count ?? rawStats.length;
  for (let i = 0; i < len; i++) {
    const ss = rawStats[i];
    for (const [key, value] of Object.entries(ss)) {
      if (!value) continue;
      const idx = lookupVarIdx(varMapping, charIdx, key);
      if (idx !== undefined) {
        vars[idx] += value;
      }
    }
  }
}
