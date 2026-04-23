/**
 * TeamExprStatSheet: Expr-domain stat pipeline for the formula compiler.
 *
 * Owns the conversion from numeric StatSheets to ExprStatSheets with variable
 * artifact stats, dynamic buff expression collection, and lazy caching per
 * (onFieldCharId, excludeKeys?).
 *
 * Shares the caller's TeamStatSheet for numeric baseline computation instead of
 * creating a redundant internal copy. Variable characters use
 * getPreStatsNoArtifacts() (artifacts come from Float64Array variables),
 * supports use getPreStats() (artifacts baked in from baseSheets).
 */

import type { StatKey } from "@/data/enums";
import { ARTIFACT_STAT_KEYS } from "../constants";
import type { BuffActivationMap, CalcContext, FormulaPart } from "../types";
import {
  createExprStats,
  type ExprStatSheet,
  VarMapping,
} from "./exprStatSheet";
import { isOnField } from "./fieldState";
import {
  collectSingleBuffExprs,
  type DynamicBuffExpr,
  deduplicateDynamicBuffExprs,
  isCompilerDeferredFinalBuff,
} from "./formulaCompiler";
import { exclusionKey } from "./formulaEval";
import {
  getBuffInstanceKey,
  isBuffApplicable,
  type StatBuff,
} from "./statBuff";
import type { StatSheet } from "./statSheet";
import type { TeamMeta } from "./teamMeta";
import type { TeamStatSheet } from "./teamStatSheet";
import { makeCacheKey } from "./teamStatSheet";

/**
 * Centralized Expr-domain stat computation for the formula compiler.
 *
 * Uses a shared TeamStatSheet for numeric baseline computation, then converts
 * to ExprStatSheets with Float64Array variables for variable characters and
 * const values for supports.
 *
 * The VarMapping is shared across all getExprStats calls so the compiler
 * can build one unified expression tree.
 */
export class TeamExprStatSheet {
  readonly varMapping: VarMapping;
  private readonly teamStats: TeamStatSheet;
  private readonly charIds: readonly string[];
  private readonly variableCharIds: Set<string>;
  private readonly calcContext: CalcContext;
  private readonly teamMeta: TeamMeta;
  private readonly cache = new Map<string, Record<string, ExprStatSheet>>();

  constructor(
    teamStats: TeamStatSheet,
    baseSheets: Record<string, StatSheet>,
    variableCharIds: Set<string>,
    calcContext: CalcContext
  ) {
    this.teamStats = teamStats;
    this.variableCharIds = variableCharIds;
    this.calcContext = calcContext;
    this.varMapping = new VarMapping();
    this.teamMeta = teamStats.ledger.teamMeta;
    this.charIds = this.teamMeta.characters;

    // Set artifacts on the shared TeamStatSheet: supports get their baked-in
    // baseSheets, variable chars' artifact state doesn't matter since we use
    // getPreStatsNoArtifacts() for them.
    teamStats.setArtifacts(baseSheets, calcContext);
  }

  getCharLevel(charId: string): number {
    return this.teamStats.getCharLevel(charId);
  }

  /**
   * Get ExprStatSheet for a character in a given on-field context.
   * Results are lazily cached per (onFieldCharId, excludeKeys?).
   */
  getExprStats(
    charId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): ExprStatSheet {
    const cacheKey = makeCacheKey(onFieldCharId, excludeKeys);
    let cached = this.cache.get(cacheKey);
    if (cached) return cached[charId]!;

    cached = this.computeExprStatContext(onFieldCharId, excludeKeys);
    this.cache.set(cacheKey, cached);
    return cached[charId]!;
  }

  /**
   * Get all ExprStatSheets for a given on-field context.
   */
  getAllExprStats(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): Record<string, ExprStatSheet> {
    const cacheKey = makeCacheKey(onFieldCharId, excludeKeys);
    let cached = this.cache.get(cacheKey);
    if (cached) return cached;

    cached = this.computeExprStatContext(onFieldCharId, excludeKeys);
    this.cache.set(cacheKey, cached);
    return cached;
  }

  /**
   * Build ExprStats variants for all exclusion combinations needed by a BuffActivationMap.
   * Returns a Map from exclusionKey -> ExprStatSheet for the formula character.
   */
  buildBuffVariants(
    activation: BuffActivationMap,
    parts: FormulaPart[],
    formulaCharId: string,
    onFieldCharId: string
  ): Map<string, ExprStatSheet> {
    const variants = new Map<string, ExprStatSheet>();
    const seen = new Set<string>();

    for (let idx = 0; idx < parts.length; idx++) {
      const h = parts[idx].hits ?? 1;
      const affecting: { buffKey: string; activated: number }[] = [];
      for (const [buffKey, partMap] of Object.entries(activation)) {
        const activated = partMap[idx] ?? h;
        if (activated < h) affecting.push({ buffKey, activated });
      }
      if (affecting.length === 0) continue;

      const cutpointSet = new Set<number>([0, h]);
      for (const { activated } of affecting) {
        if (activated > 0 && activated < h) cutpointSet.add(activated);
      }
      const cutpoints = [...cutpointSet].sort((a, b) => a - b);

      for (let i = 0; i < cutpoints.length - 1; i++) {
        const end = cutpoints[i + 1];
        const excludeSet = new Set<string>();
        for (const { buffKey, activated } of affecting) {
          if (activated < end) excludeSet.add(buffKey);
        }
        if (excludeSet.size === 0) continue;
        const eKey = exclusionKey(excludeSet);
        if (seen.has(eKey)) continue;
        seen.add(eKey);
        const allExcluded = this.getAllExprStats(onFieldCharId, excludeSet);
        variants.set(eKey, allExcluded[formulaCharId]!);
      }
    }

    return variants;
  }

  // ─── Internal pipeline ────────────────────────────────────────────────

  private computeExprStatContext(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): Record<string, ExprStatSheet> {
    // Get baselines: variable chars without artifacts, supports with artifacts
    const variableBaselines: Record<string, StatSheet> = {};
    for (const varCharId of this.variableCharIds) {
      variableBaselines[varCharId] = this.teamStats.getPreStatsNoArtifacts(
        varCharId,
        onFieldCharId,
        excludeKeys
      );
    }

    const supportPreStats: Record<string, StatSheet> = {};
    for (const id of this.charIds) {
      if (!this.variableCharIds.has(id)) {
        supportPreStats[id] = this.teamStats.getPreStats(
          id,
          onFieldCharId,
          excludeKeys
        );
      }
    }

    // Create ExprStatSheets
    const exprStatsMap: Record<string, ExprStatSheet> = {};
    for (const id of this.charIds) {
      if (this.variableCharIds.has(id)) {
        const charIdx = this.charIds.indexOf(id);
        exprStatsMap[id] = createExprStats(
          variableBaselines[id],
          charIdx,
          this.varMapping,
          new Set(ARTIFACT_STAT_KEYS)
        );
      } else {
        exprStatsMap[id] = createExprStats(
          supportPreStats[id]!,
          -1,
          this.varMapping,
          new Set()
        );
      }
    }

    // Two-pass dynamic buff expression collection/application
    const postExprStats = this.collectAndApplyDynamicBuffExprsTwoPass(
      exprStatsMap,
      supportPreStats,
      variableBaselines,
      onFieldCharId,
      excludeKeys
    );

    // Apply CR target deltas
    if (this.calcContext.perCharCrTarget) {
      for (const [id, target] of Object.entries(
        this.calcContext.perCharCrTarget
      )) {
        if (postExprStats[id]) {
          const crDelta = (100 - target) / 100;
          postExprStats[id] = postExprStats[id].withMergedConst([
            { key: "cr" as StatKey, value: crDelta },
          ]);
        }
      }
    }

    return postExprStats;
  }

  private collectAndApplyDynamicBuffExprsTwoPass(
    exprStatsMap: Record<string, ExprStatSheet>,
    supportPreStats: Record<string, StatSheet>,
    variableBaselines: Record<string, StatSheet>,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): Record<string, ExprStatSheet> {
    // Build teamPreStatsArr for fallback numeric evaluation
    const teamPreStatsArr: StatSheet[] = [];
    const charIds = Object.keys(exprStatsMap);
    for (const id of charIds) {
      if (this.variableCharIds.has(id)) {
        teamPreStatsArr.push(variableBaselines[id]);
      } else if (supportPreStats[id]) {
        teamPreStatsArr.push(supportPreStats[id]);
      }
    }

    const allStaticBuffs = this.teamStats.ledger.allBuffs;
    const sheetBuffExprs: DynamicBuffExpr[] = [];
    const deferredBuffs: { buff: StatBuff; providerCharId: string }[] = [];

    for (const { buff, providerCharId } of allStaticBuffs) {
      if (excludeKeys?.has(getBuffInstanceKey(buff, providerCharId))) continue;

      if (isCompilerDeferredFinalBuff(buff)) {
        deferredBuffs.push({ buff, providerCharId });
        continue;
      }

      const exprs = collectSingleBuffExprs(
        buff,
        providerCharId,
        exprStatsMap,
        this.variableCharIds,
        supportPreStats,
        variableBaselines,
        teamPreStatsArr
      );
      sheetBuffExprs.push(...exprs);
    }

    if (deferredBuffs.length === 0) {
      return this.applyDynamicBuffExprs(
        exprStatsMap,
        sheetBuffExprs,
        onFieldCharId
      );
    }

    // Two-pass: apply sheet-stat exprs to get midExprStats, then re-collect
    // final-stat exprs using midExprStats
    const midExprStats = this.applyDynamicBuffExprs(
      exprStatsMap,
      sheetBuffExprs,
      onFieldCharId
    );

    const finalBuffExprs: DynamicBuffExpr[] = [];
    for (const { buff, providerCharId } of deferredBuffs) {
      const exprs = collectSingleBuffExprs(
        buff,
        providerCharId,
        midExprStats,
        this.variableCharIds,
        supportPreStats,
        variableBaselines,
        teamPreStatsArr
      );
      finalBuffExprs.push(...exprs);
    }

    return this.applyDynamicBuffExprs(
      midExprStats,
      finalBuffExprs,
      onFieldCharId
    );
  }

  private applyDynamicBuffExprs(
    preExprStats: Record<string, ExprStatSheet>,
    dynamicBuffExprs: DynamicBuffExpr[],
    onFieldCharId: string
  ): Record<string, ExprStatSheet> {
    const result: Record<string, ExprStatSheet> = {};

    for (const id of this.charIds) {
      let stats = preExprStats[id]!;

      const applicable = dynamicBuffExprs.filter((dbExpr) =>
        isBuffApplicable(
          { target: dbExpr.target },
          dbExpr.providerCharId,
          id,
          isOnField(id, onFieldCharId),
          this.teamMeta.regions[id],
          this.teamMeta.factions[id]
        )
      );

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
}
