import type { StatKey } from "@/domain/enums";
import { isDeferredFinalBuff } from "./dynamicBuffEval";
import { E, type Expr, simplify } from "./expr";
import type { ExprStatSheet } from "./exprStatSheet";
import {
  CrossScalingBuff,
  getBuffInstanceKey,
  ScalingBuff,
  StatBuff,
} from "./statBuff";
import type { StatSheet } from "./statSheet";

// ─── Dynamic Buff Expression Collection ───

export interface DynamicBuffExpr {
  key: StatKey;
  expr: Expr;
  target: StatBuff["target"];
  providerCharId: string;
  source: StatBuff["source"];
  buffKey: string;
}

/**
 * Whether a buff's dynamic output targets a final stat in the compiler path.
 * Delegates to isDeferredFinalBuff — same classification for both paths.
 */
export function isCompilerDeferredFinalBuff(buff: StatBuff): boolean {
  return isDeferredFinalBuff(buff);
}

/**
 * Collect dynamic buff exprs from a single buff, returning them as DynamicBuffExpr[].
 */
export function collectSingleBuffExprs(
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

// ─── Apply Dynamic Buffs as Expr ───

/**
 * Deduplicate dynamic buff Exprs by noStackId.
 *
 * When all competing buffs in a group are const, we pick the highest (same as
 * the standard path). When any buff is variable (depends on swap-char
 * artifacts), the runtime value may differ from the compile-time baseline, so
 * we emit E.max(...) to let the JIT resolve the winner at evaluation time.
 */
export function deduplicateDynamicBuffExprs(
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
