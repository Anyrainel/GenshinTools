/**
 * AST-based damage formula compiler.
 *
 * Compiles the full damage evaluation pipeline (stat resolution + buff application +
 * formula computation) into a single compiled function that takes a Float64Array
 * of artifact stat contributions and returns a damage number.
 *
 * Usage in the optimizer hot path:
 *   1. Call compileComboTeamDamage() once per B&B setup
 *   2. For each artifact combination, fill a Float64Array with artifact stat deltas
 *   3. Call compiled.evaluate(vars) → damage number
 *
 * This eliminates all Map lookups, object allocations, and virtual dispatch from
 * the inner loop, leaving ~20-50 arithmetic ops per evaluation.
 */

import type { ArtifactData, MainStat } from "@/data/types";
import { getMainStatValueAtLevel } from "@/lib/account-data/scoring/utils";
import { ARTIFACT_STAT_KEYS, ELEMENT_ELIGIBLE_REACTIONS } from "../constants";
import type { OptimizerContext, ProvidedStaticBuff } from "../types";
import type { FormulaPart } from "../types";
import type {
  CalcContext,
  ComboFormula,
  DamageTag,
  FormulaOverride,
  StatKey,
  TeamSlotConfig,
} from "../types";
import { resolvePartReaction } from "./combo";
import { isFinalStatKey } from "./damageCalc";
import { createReactionVariant } from "./damageFormula";
import { E, type Expr, compileExpr, simplify } from "./expr";
import {
  type ExprStatSheet,
  VarMapping,
  createExprStats,
} from "./exprStatSheet";
import { isOnField } from "./fieldState";
import { defaultOnFieldCharId, isPartOffField } from "./fieldState";
import { exclusionKey } from "./stackAllocation";
import type { PartialBuffInfo } from "./stackAllocation";
import { CrossScalingBuff, ScalingBuff, getBuffInstanceKey } from "./statBuff";
import { isBuffApplicable } from "./statBuff";
import { StatBuff } from "./statBuff";
import { bespokeMaxStacks } from "./statSheet";
import { StatSheet } from "./statSheet";
import type { TeamBuild } from "./teamBuild";
import { LUNAR_RANK_WEIGHTS } from "./teamReaction";

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
  /** Maps variable character IDs → charIdx (their position in charBuildOrder). */
  charIdxMap?: Map<string, number>;
}

// ─── Compilation Pipeline ───

/**
 * Build postExprStats for a given optimizer context, using a shared VarMapping.
 * This is the core pipeline shared between single-formula and combo compilation.
 *
 * All characters in `optCtx.variableCharIds` get Float64Array variables for their
 * artifact stats; other characters' stats are baked in from `supportPreStats`.
 */
function buildPostExprStatsForContext(
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  calcContext: CalcContext
): Record<string, ExprStatSheet> {
  const { variableCharIds, charBuildOrder, supportPreStats, targetDependent } =
    optCtx;

  const emptySheet = new StatSheet([]);

  // Compute baselines (empty-sheet preStats) for all variable characters
  const variableBaselines: Record<string, StatSheet> = {};
  for (const varCharId of variableCharIds) {
    const build = charBuildOrder.find(([id]) => id === varCharId)?.[1];
    if (!build)
      throw new Error(
        `Variable character ${varCharId} not found in team build`
      );
    variableBaselines[varCharId] = build.getPreStats(
      emptySheet,
      targetDependent[varCharId] ?? []
    );
  }

  const exprStatsMap: Record<string, ExprStatSheet> = {};
  for (const [id] of charBuildOrder) {
    if (variableCharIds.has(id)) {
      const charIdx = charBuildOrder.findIndex(([cid]) => cid === id);
      exprStatsMap[id] = createExprStats(
        variableBaselines[id],
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

  const postExprStats = collectAndApplyDynamicBuffExprsTwoPass(
    teamBuild,
    exprStatsMap,
    variableCharIds,
    supportPreStats,
    variableBaselines,
    optCtx
  );

  if (calcContext.perCharCrTarget) {
    for (const [id, target] of Object.entries(calcContext.perCharCrTarget)) {
      if (postExprStats[id]) {
        const crDelta = (100 - target) / 100;
        postExprStats[id] = postExprStats[id].withMergedConst([
          { key: "cr", value: crDelta },
        ]);
      }
    }
  }

  return postExprStats;
}

/**
 * Resolve unified OptCtx field-dep info into a legacy-compatible resolved OptCtx
 * for a specific field state. This derives `targetDependent` and resolved
 * `supportPreStats` from `unifiedFieldDep`.
 *
 * @param fs When "actual", each char uses their actual field state based on
 *   onFieldCharId. When "off", the formula owner is off-field and the first
 *   other team member is on-field.
 * @param configs Team configs, required when fs="off" to determine the
 *   default on-field character.
 */
function resolveOptCtxForFieldState(
  optCtx: OptimizerContext,
  fs: "actual" | "off",
  configs?: TeamSlotConfig[]
): OptimizerContext {
  const { charBuildOrder, unifiedFieldDep, baseSheets } = optCtx;
  if (!unifiedFieldDep)
    throw new Error("resolveOptCtxForFieldState requires unified OptCtx");

  if (fs === "off" && !configs)
    throw new Error(
      "resolveOptCtxForFieldState requires configs when fs='off'"
    );

  const onFieldCharId =
    fs === "actual"
      ? optCtx.onFieldCharId
      : defaultOnFieldCharId(optCtx.onFieldCharId, configs!);

  // Build resolved targetDependent + supportPreStats from unifiedFieldDep
  const targetDependent: Record<string, ProvidedStaticBuff[]> = {};
  const supportPreStats: Record<string, StatSheet> = {};

  for (const [id, build] of charBuildOrder) {
    const dep = unifiedFieldDep[id]!;
    const isOn = isOnField(id, onFieldCharId);
    const buffs = isOn ? dep.onField : dep.offField;
    targetDependent[id] = buffs;

    if (!optCtx.variableCharIds.has(id)) {
      // Support character: resolve preStats with the appropriate buffs
      supportPreStats[id] = build.getPreStats(
        baseSheets[id] ?? new StatSheet([]),
        buffs
      );
    }
  }

  return {
    ...optCtx,
    onFieldCharId,
    targetDependent,
    supportPreStats,
  };
}

/**
 * Build resolved postExprStats from a unified optimizer context.
 * Resolves each character to their actual field state (on-field or off-field)
 * and uses the legacy ExprStats pipeline (no field-state tags in ExprStats).
 */
function buildUnifiedPostExprStatsForContext(
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  calcContext: CalcContext
): Record<string, ExprStatSheet> {
  const resolvedCtx = resolveOptCtxForFieldState(optCtx, "actual");
  return buildPostExprStatsForContext(
    teamBuild,
    resolvedCtx,
    varMapping,
    calcContext
  );
}

/**
 * Build off-field-resolved postExprStats from a unified optimizer context.
 *
 * The formula character is off-field; the first other team member is on-field
 * (matching `defaultOnFieldCharId` in the calc path). Each character gets
 * field-dependent buffs based on their actual field state.
 */
function buildOffFieldPostExprStatsForContext(
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  calcContext: CalcContext
): Record<string, ExprStatSheet> {
  const { charBuildOrder, unifiedFieldDep, baseSheets, variableCharIds } =
    optCtx;
  if (!unifiedFieldDep)
    throw new Error(
      "buildOffFieldPostExprStatsForContext requires unified OptCtx"
    );

  // The formula owner (optCtx.onFieldCharId) is off-field for off-field parts.
  // Determine who IS on-field: the first other team member.
  const offFieldOnFieldCharId = defaultOnFieldCharId(
    optCtx.onFieldCharId,
    teamBuild.configs
  );

  const emptySheet = new StatSheet([]);

  // Each character gets field-dependent buffs based on their actual field state.
  // The formula owner is off-field; the default-other is on-field.
  const targetDependent: Record<string, ProvidedStaticBuff[]> = {};
  const supportPreStats: Record<string, StatSheet> = {};
  const variableBaselines: Record<string, StatSheet> = {};

  for (const [id, build] of charBuildOrder) {
    const dep = unifiedFieldDep[id]!;
    const isOn = isOnField(id, offFieldOnFieldCharId);
    const buffs = isOn ? dep.onField : dep.offField;
    targetDependent[id] = buffs;

    if (!variableCharIds.has(id)) {
      supportPreStats[id] = build.getPreStats(
        baseSheets[id] ?? new StatSheet([]),
        buffs
      );
    } else {
      variableBaselines[id] = build.getPreStats(emptySheet, buffs);
    }
  }

  // Build receiver ExprStats with field-state-appropriate baselines
  const exprStatsMap: Record<string, ExprStatSheet> = {};
  for (const [id] of charBuildOrder) {
    if (variableCharIds.has(id)) {
      const charIdx = charBuildOrder.findIndex(([cid]) => cid === id);
      exprStatsMap[id] = createExprStats(
        variableBaselines[id],
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

  // Two-pass dynamic buff collection with proper field state.
  const receiverCtx: OptimizerContext = {
    ...optCtx,
    onFieldCharId: offFieldOnFieldCharId,
    targetDependent,
    supportPreStats,
  };

  const postExprStats = collectAndApplyDynamicBuffExprsTwoPass(
    teamBuild,
    exprStatsMap,
    variableCharIds,
    supportPreStats,
    variableBaselines,
    receiverCtx
  );

  if (calcContext.perCharCrTarget) {
    for (const [id, target] of Object.entries(calcContext.perCharCrTarget)) {
      if (postExprStats[id]) {
        const crDelta = (100 - target) / 100;
        postExprStats[id] = postExprStats[id].withMergedConst([
          { key: "cr", value: crDelta },
        ]);
      }
    }
  }

  return postExprStats;
}

function buildUnifiedPostExprStatsExcluding(
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  calcContext: CalcContext,
  excludeKeys: Set<string>
): Record<string, ExprStatSheet> {
  const resolvedCtx = resolveOptCtxForFieldState(optCtx, "actual");
  return buildPostExprStatsExcluding(
    teamBuild,
    resolvedCtx,
    varMapping,
    calcContext,
    excludeKeys
  );
}

/**
 * Build postExprStats excluding certain buffs (identified by canonical buff keys).
 * Used to pre-build stat variants for interval-based blending in the compiler.
 */
function buildPostExprStatsExcluding(
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  calcContext: CalcContext,
  excludeKeys: Set<string>
): Record<string, ExprStatSheet> {
  const { variableCharIds, charBuildOrder, supportPreStats, targetDependent } =
    optCtx;

  const emptySheet = new StatSheet([]);

  // Compute exclusion-aware baselines for variable characters
  const variableBaselines: Record<string, StatSheet> = {};
  for (const varCharId of variableCharIds) {
    const build = charBuildOrder.find(([id]) => id === varCharId)?.[1];
    if (!build)
      throw new Error(
        `Variable character ${varCharId} not found in team build`
      );
    variableBaselines[varCharId] = build.getPreStatsExcluding(
      emptySheet,
      targetDependent[varCharId] ?? [],
      teamBuild.allStaticBuffs,
      excludeKeys,
      varCharId,
      teamBuild.teamMeta.regions[varCharId],
      teamBuild.teamMeta.factions[varCharId]
    );
  }

  const exprStatsMap: Record<string, ExprStatSheet> = {};
  for (const [id] of charBuildOrder) {
    if (variableCharIds.has(id)) {
      const charIdx = charBuildOrder.findIndex(([cid]) => cid === id);
      exprStatsMap[id] = createExprStats(
        variableBaselines[id],
        charIdx,
        varMapping,
        new Set(ARTIFACT_STAT_KEYS)
      );
    } else {
      // Non-variable characters also need exclusion-aware preStats
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

  // Two-pass dynamic buff collection + application, with excluded keys
  const postExprStats = collectAndApplyDynamicBuffExprsTwoPass(
    teamBuild,
    exprStatsMap,
    variableCharIds,
    supportPreStats,
    variableBaselines,
    optCtx,
    excludeKeys
  );

  if (calcContext.perCharCrTarget) {
    for (const [id, target] of Object.entries(calcContext.perCharCrTarget)) {
      if (postExprStats[id]) {
        const crDelta = (100 - target) / 100;
        postExprStats[id] = postExprStats[id].withMergedConst([
          { key: "cr", value: crDelta },
        ]);
      }
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
  calcContext: CalcContext
): Map<string, ExprStatSheet> {
  const variants = new Map<string, ExprStatSheet>();
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
        calcContext,
        excludeSet
      );
      variants.set(eKey, excludedPostStats[formulaCharId]!);
    }
  }

  return variants;
}

/**
 * Build field-state-tagged ExprStats variants for exclusion combinations.
 * Returns unified ExprStats — callers use withFieldState() for per-part views.
 */
function buildUnifiedExprStatVariants(
  partialBuffs: PartialBuffInfo[],
  parts: FormulaPart[],
  formulaCharId: string,
  teamBuild: TeamBuild,
  optCtx: OptimizerContext,
  varMapping: VarMapping,
  calcContext: CalcContext
): Map<string, ExprStatSheet> {
  const variants = new Map<string, ExprStatSheet>();
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
      const excludedPostStats = buildUnifiedPostExprStatsExcluding(
        teamBuild,
        optCtx,
        varMapping,
        calcContext,
        excludeSet
      );
      variants.set(eKey, excludedPostStats[formulaCharId]!);
    }
  }

  return variants;
}

/**
 * Compile a combo formula into a single optimized function.
 * Each combo line may have a different on-field character, so we build
 * separate postStats per unique on-field context, sharing a single VarMapping.
 */
export function compileComboTeamDamage(
  teamBuild: TeamBuild,
  combo: ComboFormula,
  swapCharId: string | string[],
  baseSheets: Record<string, StatSheet>,
  calcContext: CalcContext,
  buffOverrides?: Record<string, PartialBuffInfo[]>,
  erCheckCharId?: string,
  minEr?: number,
  minCr?: number
): CompiledTeamDamage {
  const allFormulas = teamBuild.getFormulaIds();
  const reactionFormulas = teamBuild.reactionProvider.getFormulaIds();
  const validLines = combo.lines.filter((line) => {
    if (line.count <= 0) return false;
    if (line.formulaId.startsWith("rx-")) {
      return reactionFormulas[line.formulaId] !== undefined;
    }
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

  // Group lines by on-field character (= onFieldCharId)
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
  const configs = teamBuild.configs;
  // Each formula owner is on-field for their on-field parts.
  // Build unified ExprStats with field-state tags; off-field parts use
  // a separate off-field ExprStats built lazily per calc target.
  for (const [onFieldCharId, lines] of linesByCalcTarget) {
    const optCtx = teamBuild.createUnifiedOptimizerContext(
      baseSheets,
      swapCharId,
      onFieldCharId,
      calcContext
    );
    // On-field resolved ExprStats (each char at their actual field state)
    const postExprStats = buildUnifiedPostExprStatsForContext(
      teamBuild,
      optCtx,
      varMapping,
      calcContext
    );

    // Build off-field ExprStats lazily (only if any line has off-field parts)
    let offFieldExprStats: Record<string, ExprStatSheet> | undefined;
    const getOffFieldExprStats = () => {
      if (!offFieldExprStats) {
        offFieldExprStats = buildOffFieldPostExprStatsForContext(
          teamBuild,
          optCtx,
          varMapping,
          calcContext
        );
      }
      return offFieldExprStats;
    };

    for (const line of lines) {
      // Team reaction formula path: compile directly from reactionProvider
      if (line.formulaId.startsWith("rx-")) {
        const rp = teamBuild.reactionProvider;
        const rxEntry = rp.getFormulaEntry(line.formulaId);
        if (!rxEntry) continue;

        const rxFormula = rxEntry.parts[0].formula;

        if (rp.isMultiContributor(line.formulaId)) {
          const rankWeights = rp.getRankWeights(line.formulaId);
          const eligible = rp.getEligibleCharacters(line.formulaId);
          const charExprs: Expr[] = [];
          for (const cfg of configs) {
            if (!eligible.includes(cfg.charId)) continue;
            // Reaction formulas use on-field stats
            const charStats = postExprStats[cfg.charId];
            if (!charStats) continue;
            const weight = rankWeights?.get(cfg.charId);
            const w =
              weight ??
              LUNAR_RANK_WEIGHTS.reduce((a, b) => a + b, 0) / eligible.length;
            if (w === 0) continue;
            charExprs.push(
              E.mul(
                rxFormula.buildExpr(charStats, cfg.charLevel, calcContext),
                E.const(w)
              )
            );
          }
          if (charExprs.length > 0) {
            const lunarExpr = E.mul(E.add(...charExprs), E.const(line.count));
            allPartExprs.push(lunarExpr);
          }
        } else {
          // Reaction formulas use on-field stats; prefer entry's statsCharId
          const triggerCharId = rxEntry.statsCharId ?? line.charId;
          const triggerStats = postExprStats[triggerCharId];
          if (!triggerStats) continue;
          const charLevel =
            configs.find((c) => c.charId === triggerCharId)?.charLevel ?? 90;
          const lineExpr = rxFormula.buildExpr(
            triggerStats,
            charLevel,
            calcContext
          );
          allPartExprs.push(E.mul(lineExpr, E.const(line.count)));
        }
        continue;
      }

      // Prefer charBase lookup to avoid formulaIndex collisions (e.g. manekin);
      // fall back to formulaIndex for cross-scaled formulas.
      const formulaCharBuild = teamBuild.charBuilds[line.charId];
      const entry =
        formulaCharBuild?.charBase.getFormulaEntry(line.formulaId) ??
        teamBuild.formulaIndex.get(line.formulaId);
      if (!entry) continue;

      const effectiveReaction = line.reaction;

      // Resolve the stats character: cross-scaled formulas (e.g. Nicole projection)
      // evaluate with the statsCharId's stats instead of line.charId.
      const statsCharId = entry.statsCharId ?? line.charId;

      // On-field stats for the formula character (from field-state view)
      const formulaStats = postExprStats[statsCharId]!;
      const hasOffField = entry.parts.some((p) =>
        isPartOffField(p, effectiveReaction)
      );
      const offFieldFormulaStats = hasOffField
        ? getOffFieldExprStats()[statsCharId]
        : undefined;

      // Look up by line index first (for per-line combo overrides), then formula key
      const lineIdx = validLines.indexOf(line);
      const lineKey = `${line.charId}.${line.formulaId}`;
      const lineBuffs =
        buffOverrides?.[`line:${lineIdx}`] ?? buffOverrides?.[lineKey];

      // Pre-build ExprStats variants for partial buff blending
      let lineExprVariants: Map<string, ExprStatSheet> | undefined;
      let lineOffFieldVariants: Map<string, ExprStatSheet> | undefined;
      if (lineBuffs && lineBuffs.length > 0) {
        // On-field variants
        lineExprVariants = buildUnifiedExprStatVariants(
          lineBuffs,
          entry.parts,
          line.charId,
          teamBuild,
          optCtx,
          varMapping,
          calcContext
        );
        // Off-field variants if needed
        if (hasOffField) {
          const offFieldOptCtx = resolveOptCtxForFieldState(
            optCtx,
            "off",
            teamBuild.configs
          );
          lineOffFieldVariants = buildExprStatVariants(
            lineBuffs,
            entry.parts,
            line.charId,
            teamBuild,
            offFieldOptCtx,
            varMapping,
            calcContext
          );
        }
      }

      // Resolve charLevel: for cross-scaled formulas, use the stats char's level
      const lineCharLevel =
        configs.find((c) => c.charId === statsCharId)?.charLevel ?? 90;
      const lineExpr = buildTotalDamageExpr(
        entry.parts,
        formulaStats,
        lineCharLevel,
        calcContext,
        effectiveReaction,
        offFieldFormulaStats,
        lineBuffs,
        lineExprVariants,
        lineOffFieldVariants,
        line.count
      );
      allPartExprs.push(lineExpr);
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

  // Compile ER/CR constraint expressions.
  // ER/CR matter when the constrained character is on-field (casting skill/burst),
  // so build their stats with themselves on-field, not a formula owner.
  let evaluateEr: ((vars: Float64Array) => number) | undefined;
  let evaluateCr: ((vars: Float64Array) => number) | undefined;

  if (erCheckCharId && (minEr ?? 0) + (minCr ?? 0) > 0) {
    // ER/CR matter when the constrained character is on-field (casting skill/burst),
    // so build stats with themselves on-field.
    const erCrOptCtx = teamBuild.createUnifiedOptimizerContext(
      baseSheets,
      swapCharId,
      erCheckCharId,
      calcContext
    );
    const erCrResolved = buildUnifiedPostExprStatsForContext(
      teamBuild,
      erCrOptCtx,
      varMapping,
      calcContext
    );
    const erStats = erCrResolved[erCheckCharId];
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

  // Build charIdxMap for all variable characters
  const variableCharIds = Array.isArray(swapCharId) ? swapCharId : [swapCharId];
  const sampleCalcTarget = validLines[0]?.charId ?? variableCharIds[0];
  const sampleOptCtx = teamBuild.createUnifiedOptimizerContext(
    baseSheets,
    swapCharId,
    sampleCalcTarget,
    calcContext
  );
  const charIdxMap = new Map<string, number>();
  for (const varCharId of variableCharIds) {
    const idx = sampleOptCtx.charBuildOrder.findIndex(
      ([id]) => id === varCharId
    );
    if (idx >= 0) charIdxMap.set(varCharId, idx);
  }

  return {
    varMapping,
    evaluate,
    evaluateEr,
    evaluateCr,
    numVars: varMapping.totalVars,
    damageExpr,
    charIdxMap,
  };
}

// ─── Dynamic Buff Expression Collection ───

interface DynamicBuffExpr {
  key: StatKey;
  expr: Expr;
  target: StatBuff["target"];
  providerCharId: string;
  source: StatBuff["source"];
  buffKey: string;
}

/**
 * Whether a buff's dynamic output targets a final stat in the compiler path.
 * Same logic as isDeferredFinalBuff in damageCalc.ts.
 */
function isCompilerDeferredFinalBuff(buff: StatBuff): boolean {
  if (buff instanceof ScalingBuff) return isFinalStatKey(buff.outputKey);
  if (buff instanceof CrossScalingBuff) return isFinalStatKey(buff.outputKey);
  return false;
}

/**
 * Collect dynamic buff exprs from a single buff, returning them as DynamicBuffExpr[].
 */
function collectSingleBuffExprs(
  buff: StatBuff,
  providerCharId: string,
  exprStatsMap: Record<string, ExprStatSheet>,
  variableCharIds: Set<string>,
  supportPreStats: Record<string, StatSheet>,
  variableBaselines: Record<string, StatSheet>,
  teamPreStatsArr: StatSheet[]
): DynamicBuffExpr[] {
  const ownerStats = exprStatsMap[providerCharId];
  if (!ownerStats) return [];

  const results: DynamicBuffExpr[] = [];
  const buffKey = getBuffInstanceKey(buff, providerCharId);

  if (buff instanceof ScalingBuff) {
    for (const { key, expr } of buff.dynamicBuffsExpr(ownerStats)) {
      results.push({
        key,
        expr,
        target: buff.target,
        providerCharId,
        source: buff.source,
        buffKey,
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
        buffKey,
      });
    }
  } else if (buff.dynamicBuffsExprTeam) {
    // Expr-aware team dynamic buff (e.g. Nahida P1)
    const charIds = Object.keys(exprStatsMap);
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
        buffKey,
      });
    }
  } else if (buff.dynamicBuffs !== StatBuff.prototype.dynamicBuffs) {
    // Opaque dynamicBuffs override — fallback to numeric evaluation at baseline.
    const firstVariableBaseline = Object.values(variableBaselines)[0];
    const ownerSheet = variableCharIds.has(providerCharId)
      ? variableBaselines[providerCharId]
      : (supportPreStats[providerCharId] ?? firstVariableBaseline);
    const entries = buff.dynamicBuffs(ownerSheet, teamPreStatsArr);
    for (const { key, value } of entries) {
      results.push({
        key,
        expr: E.const(value),
        target: buff.target,
        providerCharId,
        source: buff.source,
        buffKey,
      });
    }
  }

  return results;
}

/**
 * Two-pass dynamic buff collection + application for the compiler path.
 *
 * Pass 1: Collect sheet-stat dynamic buff exprs, apply them → midExprStats.
 * Pass 2: Re-collect final-stat dynamic buff exprs using midExprStats, apply all → postExprStats.
 */
function collectAndApplyDynamicBuffExprsTwoPass(
  teamBuild: TeamBuild,
  exprStatsMap: Record<string, ExprStatSheet>,
  variableCharIds: Set<string>,
  supportPreStats: Record<string, StatSheet>,
  variableBaselines: Record<string, StatSheet>,
  optCtx: OptimizerContext,
  excludeKeys?: Set<string>,
  /** Provider-resolved ExprStats for ScalingBuff evaluation. When provided,
   *  collectSingleBuffExprs reads provider stats from this map instead of
   *  exprStatsMap. Used by the off-field path where receiver baselines are
   *  off-field but providers should see their actual field state. */
  providerExprStats?: Record<string, ExprStatSheet>,
  providerSupportPreStats?: Record<string, StatSheet>,
  providerVariableBaselines?: Record<string, StatSheet>
): Record<string, ExprStatSheet> {
  const effectiveProviderExpr = providerExprStats ?? exprStatsMap;
  const effectiveProviderSupport = providerSupportPreStats ?? supportPreStats;
  const effectiveProviderBaselines =
    providerVariableBaselines ?? variableBaselines;

  // Build teamPreStatsArr at baseline (variable chars use empty-sheet baselines,
  // non-variable chars use supportPreStats). Used for fallback numeric evaluation
  // of opaque dynamicBuffs (e.g. Nahida P1).
  const teamPreStatsArr: StatSheet[] = [];
  const charIds = Object.keys(exprStatsMap);
  for (const id of charIds) {
    if (variableCharIds.has(id)) {
      teamPreStatsArr.push(
        effectiveProviderBaselines[id] ?? variableBaselines[id]
      );
    } else if (effectiveProviderSupport[id]) {
      teamPreStatsArr.push(effectiveProviderSupport[id]);
    }
  }

  const sheetBuffExprs: DynamicBuffExpr[] = [];
  const deferredBuffs: { buff: StatBuff; providerCharId: string }[] = [];

  for (const { buff, providerCharId } of teamBuild.allStaticBuffs) {
    if (providerCharId === "resonance" || providerCharId === "extra") continue;
    if (excludeKeys?.has(getBuffInstanceKey(buff, providerCharId))) continue;

    if (isCompilerDeferredFinalBuff(buff)) {
      deferredBuffs.push({ buff, providerCharId });
      continue;
    }

    const exprs = collectSingleBuffExprs(
      buff,
      providerCharId,
      effectiveProviderExpr,
      variableCharIds,
      effectiveProviderSupport,
      effectiveProviderBaselines,
      teamPreStatsArr
    );
    sheetBuffExprs.push(...exprs);
  }

  if (deferredBuffs.length === 0) {
    // No final-stat buffs — single pass suffices.
    return applyDynamicBuffExprs(
      exprStatsMap,
      sheetBuffExprs,
      teamBuild,
      variableCharIds,
      optCtx
    );
  }

  // Two-pass: apply sheet-stat exprs to get midExprStats, then re-collect
  // final-stat exprs using midExprStats so they see dynamic sheet stats.
  const midExprStats = applyDynamicBuffExprs(
    exprStatsMap,
    sheetBuffExprs,
    teamBuild,
    variableCharIds,
    optCtx
  );

  const finalBuffExprs: DynamicBuffExpr[] = [];
  for (const { buff, providerCharId } of deferredBuffs) {
    const exprs = collectSingleBuffExprs(
      buff,
      providerCharId,
      midExprStats,
      variableCharIds,
      effectiveProviderSupport,
      effectiveProviderBaselines,
      teamPreStatsArr
    );
    finalBuffExprs.push(...exprs);
  }

  // Apply final-stat buffs on top of midExprStats
  return applyDynamicBuffExprs(
    midExprStats,
    finalBuffExprs,
    teamBuild,
    variableCharIds,
    optCtx
  );
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
  preExprStats: Record<string, ExprStatSheet>,
  dynamicBuffExprs: DynamicBuffExpr[],
  teamBuild: TeamBuild,
  _variableCharIds: Set<string>,
  optCtx: OptimizerContext
): Record<string, ExprStatSheet> {
  const result: Record<string, ExprStatSheet> = {};

  for (const [id] of optCtx.charBuildOrder) {
    let stats = preExprStats[id]!;

    // Char-level field state: each character is classified on/off via
    // isOnField(id, optCtx.onFieldCharId). Part-level field status is
    // unavailable here; the compiler selects on-field vs off-field
    // ExprStats per formula part via isPartOffField later.
    const applicable = dynamicBuffExprs.filter((dbExpr) =>
      isBuffApplicable(
        { target: dbExpr.target, source: dbExpr.source } as StatBuff,
        dbExpr.providerCharId,
        id,
        isOnField(id, optCtx.onFieldCharId),
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
  formulaStats: ExprStatSheet,
  charLevel: number,
  ctx: CalcContext,
  reactionOverride?: FormulaOverride,
  offFieldFormulaStats?: ExprStatSheet,
  partialBuffs?: PartialBuffInfo[],
  statsVariants?: Map<string, ExprStatSheet>,
  offFieldVariants?: Map<string, ExprStatSheet>,
  comboCount = 1
): Expr {
  const partExprs: Expr[] = [];

  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    const { formula, hits: totalHits, bespokeBuffs } = part;
    const h = totalHits ?? 1;

    // Use off-field stats when the part deals damage while the character is off-field
    const effectiveOffField = isPartOffField(part, reactionOverride);
    const baseStats =
      effectiveOffField && offFieldFormulaStats
        ? offFieldFormulaStats
        : formulaStats;
    const baseVariants =
      effectiveOffField && offFieldVariants ? offFieldVariants : statsVariants;

    const hasReaction =
      reactionOverride?.reaction && reactionOverride.reaction !== "none";

    if (!hasReaction || formula.tag.reaction !== "none") {
      emitBlendedPartExprs(
        partExprs,
        formula,
        baseStats,
        charLevel,
        ctx,
        h * comboCount,
        h * comboCount,
        idx,
        partialBuffs,
        baseVariants,
        bespokeBuffs
      );
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
        ? Math.min(reactionOverride.rxnPartHits?.[idx] ?? h, h)
        : 0;
    const nonReactingHits = h - reactingHits;

    if (reactingHits > 0) {
      const effectiveFormula =
        targetReaction !== formula.tag.reaction
          ? createReactionVariant(formula, targetReaction)
          : formula;
      emitBlendedPartExprs(
        partExprs,
        effectiveFormula,
        baseStats,
        charLevel,
        ctx,
        reactingHits * comboCount,
        h * comboCount,
        idx,
        partialBuffs,
        baseVariants,
        bespokeBuffs
      );
    }
    if (nonReactingHits > 0) {
      emitBlendedPartExprs(
        partExprs,
        formula,
        baseStats,
        charLevel,
        ctx,
        nonReactingHits * comboCount,
        h * comboCount,
        idx,
        partialBuffs,
        baseVariants,
        bespokeBuffs
      );
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
    buildExpr: (
      stats: ExprStatSheet,
      charLevel: number,
      ctx: CalcContext
    ) => Expr;
    tag: DamageTag;
  },
  baseStats: ExprStatSheet,
  charLevel: number,
  ctx: CalcContext,
  totalHits: number,
  originalPartHits: number,
  partIdx: number,
  partials: PartialBuffInfo[] | undefined,
  statsVariants?: Map<string, ExprStatSheet>,
  bespokeBuffs?: StatBuff[]
): void {
  // Scale activation counts for reaction sub-parts: partialBuffs are stored
  // per full part (originalPartHits), but this call may evaluate only a
  // sub-slice (reacting or non-reacting). Mirrors _calcPartBlended.
  const scale = totalHits / originalPartHits;
  const bespokeMax = bespokeMaxStacks(bespokeBuffs);
  const scaledBespokeMax = bespokeMax != null ? bespokeMax * scale : undefined;
  const bespokeCutoff =
    bespokeBuffs?.length &&
    scaledBespokeMax != null &&
    scaledBespokeMax < totalHits
      ? scaledBespokeMax
      : totalHits;
  // Compute bespoke entries ONCE against baseStats so dynamic scaling
  // (e.g. EM → baseDmg) uses full base values, matching display/calc semantics.
  const bespokeEntries = bespokeBuffs?.length
    ? captureBespokeEntries(baseStats, bespokeBuffs)
    : undefined;
  const withBespoke = bespokeEntries
    ? mergeBespokeEntriesAll(baseStats, bespokeEntries, bespokeBuffs!)
    : baseStats;

  // Collect affecting partials (activations compared in the scaled sub-part frame)
  const affecting = (partials ?? []).filter((pb) => {
    const activated = (pb.partActivation[partIdx] ?? originalPartHits) * scale;
    return activated < totalHits;
  });

  // Fast path: uniform across all hits
  if (affecting.length === 0 && bespokeCutoff === totalHits) {
    const expr = formula.buildExpr(withBespoke, charLevel, ctx);
    partExprs.push(E.mul(expr, E.const(totalHits)));
    return;
  }

  // Build interval cutpoints from activation counts and bespoke cutoff
  const cutpointSet = new Set<number>([0, totalHits]);
  if (bespokeCutoff < totalHits) cutpointSet.add(bespokeCutoff);
  for (const pb of affecting) {
    const activated = (pb.partActivation[partIdx] ?? originalPartHits) * scale;
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
      const activated =
        (pb.partActivation[partIdx] ?? originalPartHits) * scale;
      if (activated < end) excludeSet.add(pb.buffKey);
    }

    const bespokeActive = end <= bespokeCutoff;

    let intervalStats: ExprStatSheet;
    if (excludeSet.size === 0) {
      intervalStats = bespokeActive ? withBespoke : baseStats;
    } else {
      const eKey = exclusionKey(excludeSet);
      const variant = statsVariants?.get(eKey) ?? baseStats;
      intervalStats =
        bespokeActive && bespokeEntries && bespokeBuffs
          ? mergeBespokeEntriesAll(variant, bespokeEntries, bespokeBuffs)
          : variant;
    }
    const expr = formula.buildExpr(intervalStats, charLevel, ctx);
    partExprs.push(E.mul(expr, E.const(width)));
  }
}

/**
 * Capture a bespoke buff's static + dynamic entries as (key, expr) pairs,
 * with dynamic scaling evaluated ONCE against the given baseStats. This
 * matches display/calc semantics where per-part bespoke overlays are built
 * from the character's base stats (not per-interval variant stats).
 */
function captureBespokeEntries(
  baseStats: ExprStatSheet,
  bespokeBuffs: StatBuff[]
): { key: StatKey; expr: Expr; filter?: StatBuff["target"]["filter"] }[] {
  const entries: {
    key: StatKey;
    expr: Expr;
    filter?: StatBuff["target"]["filter"];
  }[] = [];
  for (const bb of bespokeBuffs) {
    const f = bb.target.filter;
    for (const { key, value } of bb.staticBuffs) {
      entries.push({ key, expr: E.const(value), filter: f });
    }
    if (bb instanceof ScalingBuff || bb instanceof CrossScalingBuff) {
      for (const { key, expr } of bb.dynamicBuffsExpr(baseStats)) {
        entries.push({ key, expr, filter: f });
      }
    }
  }
  return entries;
}

/** Merge pre-captured bespoke entries (with per-entry filters) into any ExprStats. */
function mergeBespokeEntriesAll(
  stats: ExprStatSheet,
  entries: {
    key: StatKey;
    expr: Expr;
    filter?: StatBuff["target"]["filter"];
  }[],
  _bespokeBuffs: StatBuff[]
): ExprStatSheet {
  let result = stats;
  for (const { key, expr, filter } of entries) {
    if (expr.tag === "const") {
      result = result.withMergedConst([{ key, value: expr.value }], filter);
    } else {
      result = result.withMergedExpr([{ key, expr }], filter);
    }
  }
  return result;
}

/** Apply bespoke buff array overlay to ExprStats (static + dynamic parts). */
function applyBespokeOverlay(
  stats: ExprStatSheet,
  bespokeBuffs?: StatBuff[]
): ExprStatSheet {
  if (!bespokeBuffs?.length) return stats;

  let result = stats;
  for (const bb of bespokeBuffs) {
    result = result.withMergedConst(bb.staticBuffs, bb.target.filter);

    if (bb instanceof ScalingBuff || bb instanceof CrossScalingBuff) {
      for (const { key, expr } of bb.dynamicBuffsExpr(result)) {
        if (expr.tag === "const") {
          result = result.withMergedConst(
            [{ key, value: expr.value }],
            bb.target.filter
          );
        } else {
          result = result.withMergedExpr([{ key, expr }], bb.target.filter);
        }
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
  artifacts: (ArtifactData | null)[],
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
          mainKey as MainStat,
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
 * Used by generator compiled evaluation.
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
 * Create a fast evalDamage callback that fills a Float64Array from a single
 * character's StatSheet and evaluates the compiled expression.
 *
 * Returned signature matches DamageEvalFn: (sheets) => number.
 */
export function makeCompiledEvalDamage(
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

/**
 * Fill the Float64Array vars from raw stat maps (e.g. super-artifact stats).
 * Used for upper bound evaluation in compiled mode.
 */
export function fillVarsFromRawStats(
  rawStats: Partial<Record<StatKey, number>>[],
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
